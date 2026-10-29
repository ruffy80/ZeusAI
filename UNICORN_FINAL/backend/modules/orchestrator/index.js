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
      ['processPaidOrders', 'btcInvoiceLedger.listPending (read only)'],
      ['autoRepair', 'observe zac + docker; do not restart postgres'],
      ['backupDatabase', 'existing backup timer; this facade does not dump the live db'],
    ];
    for (const [capability, migratedFrom] of rows) {
      const hash = crypto.createHash('sha256').update(capability + '|' + migratedFrom).digest('hex').slice(0, 16);
      this.versions.set(capability, {
        version: '1.0.0',
        migrated_from: migratedFrom,
        fingerprint_hash: hash,
        rolled_back_at: null,
      });
    }
    this.persistVersions();
    this.writeStatus();
  }

  async healthCheck() {
    const port = Number(process.env.PORT || 3000);
    return new Promise((resolve, reject) => {
      const req = http.get({
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: 4000,
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            const body = JSON.parse(text);
            resolve({ statusCode: res.statusCode, ok: body && body.ok === true, status: body && body.status });
          } catch (e) {
            reject(new Error('health_not_json'));
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('health_timeout')); });
      req.on('error', reject);
    });
  }

  async syncPrices() {
    const priceNegotiator = require('../priceNegotiator');
    const quote = await priceNegotiator.getPrice('website-audit', {});
    return {
      serviceId: quote && quote.serviceId,
      usd: quote && quote.usd,
      source: quote && quote.source,
      mutated: false,
    };
  }

  async processPaidOrders() {
    const ledger = require('../btcInvoiceLedger');
    const pending = typeof ledger.listPending === 'function' ? ledger.listPending() : [];
    return { pending: Array.isArray(pending) ? pending.length : 0, mutated: false };
  }

  async autoRepair() {
    let scoreRepair = null;
    try {
      scoreRepair = require('../../../modules/score').repair();
    } catch (err) {
      scoreRepair = { ok: false, error: err && err.message };
    }
    return {
      action: 'observe',
      restarted: [],
      scoreRepair,
      note: 'Repair intent only. postgres and redis are not restarted from this facade.',
    };
  }

  async backupDatabase() {
    return { action: 'skip', reason: 'live database backup stays on the existing timer' };
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
      if (this.state.shadowMode) {
        console.log('[SHADOW] would run: health, prices, orders, repair');
        this.state.cycles += 1;
        this.writeStatus();
        return;
      }
      await this.withLock('health', () => this.safeRun('healthCheck', () => this.healthCheck()));
      await this.withLock('prices', () => this.safeRun('syncPrices', () => this.syncPrices()));
      await this.withLock('orders', () => this.safeRun('processPaidOrders', () => this.processPaidOrders()));
      await this.withLock('repair', () => this.safeRun('autoRepair', () => this.autoRepair()));
      this.state.cycles += 1;
      this.writeStatus();
      console.log(JSON.stringify({
        cycle: this.state.cycles,
        mem: process.memoryUsage().heapUsed,
        locks: [...this.locks.keys()],
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
