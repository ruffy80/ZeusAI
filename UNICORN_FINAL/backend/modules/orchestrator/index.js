'use strict';

/**
 * Unified orchestrator facade.
 *
 * Old orchestrators stay loaded. This process does not delete them and does
 * not mark invoices paid. Shadow mode logs the cycle and does not call the
 * capability. A simulated failure is not a collected payment.
 *
 * State files default to /opt/zeusai/state. Tests set ZEUS_STATE_DIR.
 */
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const STATE_DIR = process.env.ZEUS_STATE_DIR || '/opt/zeusai/state';

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* read-only test */ }
}

class UnifiedOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.locks = new Map();
    this.failures = new Map();
    this.predictions = new Map();
    this.replayLog = [];
    this.versions = new Map();
    this.state = {
      running: false,
      cycles: 0,
      lastErrors: [],
      shadowMode: process.env.SHADOW_MODE === 'true',
    };
    this.businessCapabilities = new Set(['processPaidOrders', 'syncPrices']);
    this._timer = null;
    this._backupTimer = null;
  }

  async withLock(resource, fn) {
    if (this.locks.get(resource)) return null;
    this.locks.set(resource, true);
    try { return await fn(); }
    finally { this.locks.delete(resource); }
  }

  async safeRun(name, fn, timeoutMs = 25000) {
    const f = this.failures.get(name) || { count: 0, blockedUntil: 0 };
    if (Date.now() < f.blockedUntil) return undefined;
    const started = Date.now();
    try {
      const result = await Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), timeoutMs);
        }),
      ]);
      f.count = 0;
      f.blockedUntil = 0;
      this.failures.set(name, f);
      const duration = Date.now() - started;
      this.recordReplay(name, 'success', duration);
      this.updatePrediction(name, duration);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      f.count += 1;
      this.state.lastErrors.push({ name, error: err.message, at: Date.now() });
      if (this.state.lastErrors.length > 50) this.state.lastErrors.shift();
      const duration = Date.now() - started;
      this.recordReplay(name, 'error', duration, err.message);
      this.updatePrediction(name, duration);
      if (this.businessCapabilities.has(name)) {
        this.emit('business_alert', { capability: name, error: err.message });
        f.blockedUntil = Date.now() + 60000;
      } else if (f.count >= 3) {
        f.blockedUntil = Date.now() + 600000;
        this.emit('capability_blocked', name);
        this.writeAutopsy(name, err);
      }
      this.failures.set(name, f);
      return undefined;
    }
  }

  updatePrediction(capability, durationMs) {
    const p = this.predictions.get(capability) || { durations: [], trend: 0 };
    p.durations.push(durationMs);
    if (p.durations.length > 20) p.durations.shift();
    const avg = p.durations.reduce((a, b) => a + b, 0) / p.durations.length;
    const lastFive = p.durations.slice(-5);
    const lastAvg = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
    p.trend = avg > 0 ? lastAvg / avg : 0;
    if (p.durations.length >= 5 && p.trend > 2.5) {
      this.emit('predictive_warning', { capability, trend: p.trend });
    }
    this.predictions.set(capability, p);
  }

  flushReplay() {
    if (!this.replayLog.length) return null;
    try {
      const dir = path.join(STATE_DIR, 'replay');
      ensureDir(dir);
      const file = path.join(dir, Date.now() + '.json');
      fs.writeFileSync(file, JSON.stringify(this.replayLog.slice(-100)));
      return file;
    } catch (_) {
      return null;
    }
  }

  recordReplay(name, status, duration, error) {
    this.replayLog.push({ t: Date.now(), name, status, duration, error: error || null });
    if (this.replayLog.length > 10000) this.replayLog.shift();
    if (this.replayLog.length % 100 === 0) this.flushReplay();
  }

  writeAutopsy(capability, error) {
    const autopsy = [
      '# Incident: ' + capability,
      'Date: ' + new Date().toISOString(),
      'Error: ' + (error && error.message),
      'Stack: ' + (error && error.stack),
      'Playbook: 1) Check ' + capability + ' dependencies 2) Restart if >3 failures 3) Verify DB connection 4) Re-run manually',
      '',
    ].join('\n');
    try {
      const dir = path.join(STATE_DIR, 'autopsies');
      ensureDir(dir);
      const file = path.join(dir, capability + '_' + Date.now() + '.md');
      fs.writeFileSync(file, autopsy);
      return file;
    } catch (_) {
      return null;
    }
  }

  versionSnapshot() {
    const out = [];
    for (const [capability, meta] of this.versions.entries()) {
      out.push({ capability, ...meta });
    }
    return out;
  }

  persistVersions() {
    const dir = path.join(STATE_DIR, 'versions');
    ensureDir(dir);
    for (const [capability, meta] of this.versions.entries()) {
      const body = {
        version: meta.version,
        migrated_from: meta.migrated_from,
        fingerprint_hash: meta.fingerprint_hash,
        rolled_back_at: null,
      };
      try {
        fs.writeFileSync(path.join(dir, capability + '.json'), JSON.stringify(body, null, 2));
      } catch (_) { /* state dir may be absent in a unit test */ }
    }
  }

  registerCapabilities() {
    const rows = [
      ['healthCheck', 'GET /api/health'],
      ['syncPrices', 'priceNegotiator.getPrice'],
      ['processPaidOrders', 'btcInvoiceLedger + on-chain verify + paid-delivery (write)'],
      ['autoRepair', 'auto-heal zac + docker + postgresql'],
      ['backupDatabase', 'pg_dump zeusai + state snapshot'],
      ['commercialMonitor', 'commercial-layer.status (postgresql primary)'],
    ];
    for (const [capability, migratedFrom] of rows) {
      const hash = crypto.createHash('sha256').update(capability + '|' + migratedFrom).digest('hex').slice(0, 16);
      this.versions.set(capability, {
        version: '2.0.0',
        migrated_from: migratedFrom,
        fingerprint_hash: hash,
        rolled_back_at: null,
      });
    }
    this.persistVersions();
    this.writeStatus();
  }

  logShadow({ capability, wouldDo, affectedResources = [], estimatedImpact = '' }) {
    const payload = {
      shadow: true,
      capability: String(capability || ''),
      wouldDo: String(wouldDo || ''),
      affectedResources: Array.isArray(affectedResources) ? affectedResources : [],
      estimatedImpact: String(estimatedImpact || ''),
      timestamp: new Date().toISOString(),
    };
    const line = JSON.stringify(payload);
    console.log(line);
    const logFile = process.env.ORCHESTRATOR_SHADOW_LOG || '/var/log/orchestrator-shadow.log';
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (_) { /* non-root test environment */ }
    return payload;
  }

  probePostgres(port = 5432, host = '127.0.0.1') {
    const net = require('net');
    return new Promise((resolve) => {
      const socket = net.connect({ host, port, timeout: 1500 });
      const done = (ok) => {
        try { socket.destroy(); } catch (_) {}
        resolve(ok);
      };
      socket.on('connect', () => done(true));
      socket.on('timeout', () => done(false));
      socket.on('error', () => done(false));
    });
  }

  async healthCheck() {
    const port = Number(process.env.PORT || 3000);
    const res = await new Promise((resolve, reject) => {
      const req = http.get({
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: 4000,
      }, (resp) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            const body = JSON.parse(text);
            resolve({ statusCode: resp.statusCode, ok: body && body.ok === true, status: body && body.status });
          } catch (e) {
            reject(new Error('health_not_json'));
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('health_timeout')); });
      req.on('error', reject);
    });
    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'healthCheck',
        wouldDo: 'Probe GET /api/health on 127.0.0.1:' + port + ' (status ' + res.statusCode + ')',
        affectedResources: ['backend:3000'],
        estimatedImpact: 'Health status verified (' + (res.status || 'ok') + ')',
      });
    }
    return res;
  }

  async syncPrices() {
    const priceNegotiator = require('../priceNegotiator');
    const quote = await priceNegotiator.getPrice('website-audit', {});
    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'syncPrices',
        wouldDo: 'Sync live BTC/USD quote ($' + (quote && quote.usd) + ') from ' + (quote && quote.source),
        affectedResources: ['priceNegotiator', 'catalog'],
        estimatedImpact: 'Keep catalog BTC spot quotes synchronized',
      });
    }
    return {
      serviceId: quote && quote.serviceId,
      usd: quote && quote.usd,
      source: quote && quote.source,
      mutated: false,
    };
  }

  async processPaidOrders() {
    const ledger = require('../btcInvoiceLedger');
    const paidDelivery = require('../paid-delivery');
    const pending = typeof ledger.listPending === 'function' ? ledger.listPending() : [];
    const paidList = typeof ledger.listInvoices === 'function' ? ledger.listInvoices({ status: 'paid', limit: 200 }) : [];
    const delivDir = paidDelivery.deliveryDir();
    const undelivered = paidList.filter((inv) => {
      if (!inv || inv.id == null) return false;
      return !fs.existsSync(path.join(delivDir, String(inv.id) + '.json'));
    });

    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'processPaidOrders',
        wouldDo: 'Verify ' + pending.length + ' pending BTC invoices on-chain and fulfill ' + undelivered.length + ' paid undelivered orders',
        affectedResources: ['orders', 'deliveries', 'btcInvoiceLedger'],
        estimatedImpact: pending.length + ' pending orders checked, ' + undelivered.length + ' deliveries would be generated',
      });
      return {
        processed: 0,
        pending: pending.length,
        undelivered: undelivered.length,
        shadow: true,
        mutated: false,
      };
    }

    let verified = 0;
    let delivered = 0;
    const deliveredOrders = [];
    const verifier = require('../btcPaymentVerifier').createPaymentVerifier({
      address: ledger.PAYOUT_ADDRESS,
      onPaid: (inv) => {
        verified += 1;
        const out = paidDelivery.writePaidDelivery(inv, { licenseId: 'lic_' + inv.id });
        if (out && out.ok) {
          delivered += 1;
          deliveredOrders.push(inv.id);
          paidDelivery.queueDeliveryEmail(inv).catch(() => {});
        }
      },
    });
    await verifier.tick();

    for (const inv of undelivered) {
      const out = paidDelivery.writePaidDelivery(inv, { licenseId: 'lic_' + inv.id });
      if (out && out.ok && !out.already) {
        delivered += 1;
        deliveredOrders.push(inv.id);
        paidDelivery.queueDeliveryEmail(inv).catch(() => {});
      }
    }

    return {
      processed: verified + delivered,
      verified,
      delivered,
      deliveredOrders,
      pending: ledger.listPending().length,
      mutated: (verified + delivered) > 0,
    };
  }

  async autoRepair() {
    const pgUp = await this.probePostgres(5432, '127.0.0.1');
    const health = { postgres: pgUp ? 'up' : 'down' };

    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'autoRepair',
        wouldDo: health.postgres === 'down'
          ? 'Restart PostgreSQL via systemctl restart postgresql || docker restart unicorn-postgres'
          : 'Verify PostgreSQL (up) and run score.repair()',
        affectedResources: health.postgres === 'down' ? ['postgresql', 'unicorn-postgres'] : ['postgresql', 'score'],
        estimatedImpact: health.postgres === 'down'
          ? 'PostgreSQL service/container restarted to restore port 5432'
          : '0 restarts needed (PostgreSQL and services healthy)',
      });
      return {
        action: 'shadow',
        postgres: health.postgres,
        restarted: [],
        wouldRestart: health.postgres === 'down' ? ['postgresql'] : [],
      };
    }

    const restarted = [];
    if (health.postgres === 'down') {
      const { execSync } = require('child_process');
      execSync('systemctl restart postgresql 2>/dev/null || docker restart unicorn-postgres', { timeout: 20000 });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const pgAfter = await this.probePostgres(5432, '127.0.0.1');
      health.postgres = pgAfter ? 'up' : 'down';
      restarted.push('postgresql');
    }

    let scoreRepair = null;
    try {
      let scoreMod;
      try {
        scoreMod = require('../../../modules/score');
      } catch (_) {
        try {
          scoreMod = require('../score');
        } catch (__) {
          scoreMod = require('/var/www/unicorn/current/modules/score');
        }
      }
      scoreRepair = scoreMod.repair();
    } catch (err) {
      scoreRepair = { ok: false, error: err && err.message };
    }
    return {
      action: restarted.length > 0 ? 'repaired' : 'healthy',
      postgres: health.postgres,
      restarted,
      scoreRepair,
    };
  }

  async backupDatabase() {
    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'backupDatabase',
        wouldDo: 'Dump PostgreSQL database zeusai to /opt/zeusai/state/backups',
        affectedResources: ['postgresql:zeusai'],
        estimatedImpact: 'Create timestamped SQL backup file',
      });
      return { action: 'shadow', wouldBackup: 'zeusai' };
    }
    try {
      const { execSync } = require('child_process');
      const dir = path.join(STATE_DIR, 'backups');
      ensureDir(dir);
      const file = path.join(dir, 'zeusai_' + Date.now() + '.sql');
      execSync('docker exec -i unicorn-postgres pg_dump -U zeusai zeusai > ' + JSON.stringify(file), { timeout: 60000 });
      return { action: 'backed_up', file };
    } catch (err) {
      return { action: 'error', error: err && err.message };
    }
  }

  async commercialMonitor() {
    const layer = require('../commercial-layer');
    if (typeof layer.probeStores === 'function') {
      await layer.probeStores();
    }
    const snap = layer.status();
    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'commercialMonitor',
        wouldDo: 'Monitor commercial layer storage (' + (snap.storage && snap.storage.engine) + ') and plans/bundles',
        affectedResources: ['commercial-layer', 'postgresql'],
        estimatedImpact: 'Verified storage engine=' + (snap.storage && snap.storage.engine) + ', plans=' + snap.plans + ', bundles=' + snap.bundles,
      });
    }
    return { ok: true, monitoring: true, repaired: false, plans: snap.plans, bundles: snap.bundles, storage: snap.storage };
  }

  writeStatus() {
    try {
      ensureDir(STATE_DIR);
      fs.writeFileSync(path.join(STATE_DIR, 'orchestrator-status.json'), JSON.stringify({
        pid: process.pid,
        at: new Date().toISOString(),
        state: this.state,
        versions: this.versionSnapshot(),
      }));
    } catch (_) { /* status file is best-effort */ }
  }

  startScheduler() {
    const tick = async () => {
      this.state.shadowMode = process.env.SHADOW_MODE === 'true';
      const healthRes = await this.withLock('health', () => this.safeRun('healthCheck', () => this.healthCheck()));
      const pricesRes = await this.withLock('prices', () => this.safeRun('syncPrices', () => this.syncPrices()));
      const ordersRes = await this.withLock('orders', () => this.safeRun('processPaidOrders', () => this.processPaidOrders()));
      const repairRes = await this.withLock('repair', () => this.safeRun('autoRepair', () => this.autoRepair()));
      const commRes = await this.withLock('commercial', () => this.safeRun('commercialMonitor', () => this.commercialMonitor()));
      this.state.cycles += 1;
      this.writeStatus();
      console.log(JSON.stringify({
        cycle: this.state.cycles,
        shadowMode: this.state.shadowMode,
        mem: process.memoryUsage().heapUsed,
        locks: [...this.locks.keys()],
        results: {
          healthCheck: healthRes,
          syncPrices: pricesRes,
          processPaidOrders: ordersRes,
          autoRepair: repairRes,
          commercialMonitor: commRes,
        },
      }));
    };
    this._timer = setInterval(tick, Number(process.env.ORCHESTRATOR_TICK_MS || 30000));
    this._backupTimer = setInterval(() => {
      this.withLock('backup', () => this.safeRun('backupDatabase', () => this.backupDatabase(), 300000));
    }, 86400000);
    if (require.main !== module) {
      if (typeof this._timer.unref === 'function') this._timer.unref();
      if (typeof this._backupTimer.unref === 'function') this._backupTimer.unref();
    }
    tick().catch((e) => this.state.lastErrors.push({ name: 'tick', error: e.message, at: Date.now() }));
  }

  async start() {
    if (this.state.running) return;
    this.state.running = true;
    this.registerCapabilities();
    this.startScheduler();
    this.emit('started');
  }

  async shutdown() {
    this.state.running = false;
    if (this._timer) clearInterval(this._timer);
    if (this._backupTimer) clearInterval(this._backupTimer);
    const started = Date.now();
    while (this.locks.size && Date.now() - started < 30000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.flushReplay();
  }
}

async function runSandbox(ms = 60000) {
  const orch = new UnifiedOrchestrator();
  const log = [];
  let overlaps = 0;
  let active = 0;
  const cap = async (name) => {
    for (;;) {
      const result = await orch.withLock('sandbox-resource', async () => {
        active += 1;
        if (active > 1) overlaps += 1;
        log.push({ name, at: Date.now() });
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        return name;
      });
      if (result !== null) return result;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  };
  const started = Date.now();
  let rounds = 0;
  const budget = Math.max(200, Number(ms) || 60000);
  while (Date.now() - started < budget) {
    await Promise.all([cap('alpha'), cap('beta')]);
    rounds += 1;
  }
  return {
    ok: overlaps === 0 && log.some((row) => row.name === 'alpha') && log.some((row) => row.name === 'beta'),
    overlaps,
    rounds,
    logCount: log.length,
    ranMs: Date.now() - started,
    conflicts: overlaps,
  };
}

const orchestrator = new UnifiedOrchestrator();

if (require.main === module) {
  process.on('SIGTERM', async () => { await orchestrator.shutdown(); process.exit(0); });
  process.on('SIGINT', async () => { await orchestrator.shutdown(); process.exit(0); });
  orchestrator.start().catch((e) => {
    console.error('[orchestrator] start failed', e && e.message);
    process.exit(1);
  });
}

module.exports = orchestrator;
module.exports.UnifiedOrchestrator = UnifiedOrchestrator;
module.exports.runSandbox = runSandbox;
