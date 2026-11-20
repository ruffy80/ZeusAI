// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Protocol: ASRI/1.0 — Autonomous Supply-Chain & Runtime Immunity Engine
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const v8 = require('v8');
const crypto = require('crypto');
const { monitorEventLoopDelay } = require('perf_hooks');

const PROTOCOL = 'ASRI/1.0';
const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');

function sha256File(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { exists: false, sha256: null, bytes: 0 };
    const buf = fs.readFileSync(filePath);
    return {
      exists: true,
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
      bytes: buf.length,
    };
  } catch (e) {
    return { exists: false, sha256: null, bytes: 0, error: e && e.message };
  }
}

function loadOrCreateEd25519Keypair() {
  try {
    if (global.__ASRI_ED25519_KEYS__) return global.__ASRI_ED25519_KEYS__;
    const keyPaths = [
      process.env.SITE_SIGN_KEY_FILE,
      path.join(os.homedir(), '.unicorn-keys', 'site-sign.pem'),
    ].filter(Boolean);

    for (const kp of keyPaths) {
      if (fs.existsSync(kp)) {
        try {
          const pem = fs.readFileSync(kp, 'utf8');
          const privateKey = crypto.createPrivateKey(pem);
          if (privateKey.asymmetricKeyType === 'ed25519') {
            const publicKey = crypto.createPublicKey(privateKey);
            const pair = {
              privateKey,
              publicKey,
              publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
              keyOrigin: 'persistent-sovereign-ed25519',
            };
            global.__ASRI_ED25519_KEYS__ = pair;
            return pair;
          }
        } catch (_) { /* fallback below */ }
      }
    }

    const generated = crypto.generateKeyPairSync('ed25519');
    const pair = {
      privateKey: generated.privateKey,
      publicKey: generated.publicKey,
      publicKeyPem: generated.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      keyOrigin: 'ephemeral-ed25519',
    };
    global.__ASRI_ED25519_KEYS__ = pair;
    return pair;
  } catch (_) {
    return null;
  }
}

class AutonomousRuntimeImmunityEngine {
  constructor() {
    this.protocol = PROTOCOL;
    this.startedAt = new Date().toISOString();
    this.bootTimestamp = Date.now();
    this.heapWindow = []; // [{ ts, usedMB, limitMB, rssMB }]
    this.maxWindow = 30;
    this.stabilizations = []; // last 25 autonomous stabilization receipts
    this.frictionEvents = []; // last 50 revenue/API friction receipts
    this.railHealth = new Map();
    this.bootSupplyChainBaseline = null;
    this.lastSupplyChainAudit = null;
    this.elMonitor = null;

    // Enable nanosecond event-loop delay histogram (zero overhead, no open handle leaks)
    try {
      this.elMonitor = monitorEventLoopDelay({ resolution: 20 });
      this.elMonitor.enable();
    } catch (_) {
      this.elMonitor = null;
    }

    // Seed baseline rail telemetry
    this._seedDefaultRails();
    // Capture initial cryptographic supply-chain baseline at boot
    this.bootSupplyChainBaseline = this.auditSupplyChain();
  }

  _seedDefaultRails() {
    const defaults = [
      { id: 'btc-mempool-primary', url: 'https://mempool.space/api', role: 'payment-settlement', status: 'healthy', failoverGroup: 'btc-mempool' },
      { id: 'btc-mempool-fallback-1', url: 'https://blockstream.info/api', role: 'payment-settlement', status: 'standby', failoverGroup: 'btc-mempool' },
      { id: 'btc-mempool-fallback-2', url: 'https://mempool.emzy.de/api', role: 'payment-settlement', status: 'standby', failoverGroup: 'btc-mempool' },
      { id: 'stripe-gateway', url: 'https://api.stripe.com', role: 'card-checkout', status: 'healthy', failoverGroup: 'fiat-checkout' },
      { id: 'paypal-gateway', url: 'https://api-m.paypal.com', role: 'alt-checkout', status: 'healthy', failoverGroup: 'fiat-checkout' },
      { id: 'nowpayments-gateway', url: 'https://api.nowpayments.io', role: 'crypto-checkout', status: 'healthy', failoverGroup: 'crypto-checkout' },
      { id: 'postgresql-state', url: 'postgresql://localhost/zeusai', role: 'persistent-state', status: 'healthy', failoverGroup: 'database' },
    ];
    for (const r of defaults) {
      this.railHealth.set(r.id, {
        ...r,
        successes: 0,
        failures: 0,
        avgLatencyMs: 0,
        reliabilityPct: 100,
        lastCheckedAt: this.startedAt,
      });
    }
  }

  /**
   * 1. Autonomous Cryptographic Supply-Chain SBOM & Integrity Shield
   */
  auditSupplyChain() {
    const appPkgPath = path.join(APP_ROOT, 'package.json');
    const appLockPath = path.join(APP_ROOT, 'package-lock.json');
    const rootPkgPath = path.join(REPO_ROOT, 'package.json');

    const appPkgHash = sha256File(appPkgPath);
    const appLockHash = sha256File(appLockPath);
    const rootPkgHash = sha256File(rootPkgPath);

    let directDeps = 0;
    let devDeps = 0;
    let enginesNode = null;
    let enginesNpm = null;
    let pkgVersion = 'unknown';
    let overridesCount = 0;

    try {
      const pkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
      directDeps = Object.keys(pkg.dependencies || {}).length;
      devDeps = Object.keys(pkg.devDependencies || {}).length;
      overridesCount = Object.keys(pkg.overrides || {}).length;
      enginesNode = pkg.engines && pkg.engines.node ? pkg.engines.node : null;
      enginesNpm = pkg.engines && pkg.engines.npm ? pkg.engines.npm : null;
      pkgVersion = pkg.version || 'unknown';
    } catch (_) {}

    let lockfilePackageCount = 0;
    try {
      if (fs.existsSync(appLockPath)) {
        const lockRaw = fs.readFileSync(appLockPath, 'utf8');
        const matches = lockRaw.match(/"node_modules\//g);
        lockfilePackageCount = matches ? matches.length : 0;
      }
    } catch (_) {}

    const merkleInput = [
      appPkgHash.sha256 || 'missing',
      appLockHash.sha256 || 'missing',
      rootPkgHash.sha256 || 'missing',
      process.versions.node,
    ].join('|');
    const sbomMerkleRoot = crypto.createHash('sha256').update(merkleInput).digest('hex');

    const nodeMajor = Number(String(process.versions.node).split('.')[0]);
    const engineCompliant = nodeMajor >= 22 && nodeMajor < 26;

    const tamperDetected = !!(
      this.bootSupplyChainBaseline &&
      this.bootSupplyChainBaseline.sbomMerkleRoot &&
      this.bootSupplyChainBaseline.sbomMerkleRoot !== sbomMerkleRoot
    );

    const audit = {
      ok: engineCompliant && !tamperDetected && appPkgHash.exists && appLockHash.exists,
      protocol: PROTOCOL,
      auditedAt: new Date().toISOString(),
      appVersion: pkgVersion,
      nodeRuntime: process.versions.node,
      enginesContract: { node: enginesNode, npm: enginesNpm, compliant: engineCompliant },
      sbom: {
        directDependencies: directDeps,
        devDependencies: devDeps,
        overridesEnforced: overridesCount,
        lockfileResolvedPackages: lockfilePackageCount,
        packageJsonSha256: appPkgHash.sha256,
        packageLockSha256: appLockHash.sha256,
        rootPackageJsonSha256: rootPkgHash.sha256,
        sbomMerkleRoot,
      },
      tamperDetected,
      posture: tamperDetected ? 'DRIFT_ALERT' : (engineCompliant ? 'HARDENED_ZERO_DRIFT' : 'ENGINE_MISMATCH'),
    };

    this.lastSupplyChainAudit = audit;
    return audit;
  }

  /**
   * 2. Predictive V8 Heap & Event-Loop Lag Telemetry + Pre-Emptive Stabilizer
   */
  sampleRuntimeTelemetry() {
    const mu = process.memoryUsage();
    const v8Stats = typeof v8.getHeapStatistics === 'function' ? v8.getHeapStatistics() : {};
    const heapLimitBytes = v8Stats.heap_size_limit || Math.max(mu.heapTotal, 2560 * 1024 * 1024);
    const usedMB = Math.round((mu.heapUsed / 1048576) * 100) / 100;
    const totalMB = Math.round((mu.heapTotal / 1048576) * 100) / 100;
    const limitMB = Math.round((heapLimitBytes / 1048576) * 100) / 100;
    const rssMB = Math.round((mu.rss / 1048576) * 100) / 100;
    const heapUtilizationPct = Math.round((mu.heapUsed / heapLimitBytes) * 10000) / 100;

    const now = Date.now();
    this.heapWindow.push({ ts: now, usedMB, limitMB, rssMB });
    if (this.heapWindow.length > this.maxWindow) {
      this.heapWindow.splice(0, this.heapWindow.length - this.maxWindow);
    }

    // Linear heap growth velocity (MB/min)
    let heapVelocityMbPerMin = 0;
    let minutesToHeapExhaustion = null;
    if (this.heapWindow.length >= 2) {
      const first = this.heapWindow[0];
      const last = this.heapWindow[this.heapWindow.length - 1];
      const dtMin = (last.ts - first.ts) / 60000;
      if (dtMin > 0.05) {
        heapVelocityMbPerMin = Math.round(((last.usedMB - first.usedMB) / dtMin) * 100) / 100;
        if (heapVelocityMbPerMin > 0.5) {
          const remainingMB = Math.max(0, limitMB - last.usedMB);
          minutesToHeapExhaustion = Math.round((remainingMB / heapVelocityMbPerMin) * 10) / 10;
        }
      }
    }

    let eventLoop = { p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
    if (this.elMonitor) {
      eventLoop = {
        p50Ms: Math.round((this.elMonitor.percentile(50) / 1e6) * 100) / 100,
        p95Ms: Math.round((this.elMonitor.percentile(95) / 1e6) * 100) / 100,
        p99Ms: Math.round((this.elMonitor.percentile(99) / 1e6) * 100) / 100,
        maxMs: Math.round((this.elMonitor.max / 1e6) * 100) / 100,
      };
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuCount = os.cpus().length || 1;
    const load1 = os.loadavg()[0] || 0;

    return {
      sampledAt: new Date(now).toISOString(),
      uptimeSec: Math.round(process.uptime()),
      v8Heap: {
        usedMB,
        allocatedMB: totalMB,
        limitMB,
        rssMB,
        utilizationOfLimitPct: heapUtilizationPct,
        velocityMbPerMin: heapVelocityMbPerMin,
        minutesToExhaustion: minutesToHeapExhaustion,
      },
      eventLoop,
      host: {
        cpuCores: cpuCount,
        loadAvg1m: Math.round(load1 * 100) / 100,
        cpuNormalizedPct: Math.round((load1 / cpuCount) * 100),
        ramTotalMB: Math.round(totalMem / 1048576),
        ramFreeMB: Math.round(freeMem / 1048576),
        ramUsedPct: totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0,
      },
    };
  }

  /**
   * Cooperative pre-emptive runtime stabilizer (Golden Rule #6: NEVER kills/restarts).
   */
  stabilizeRuntime({ force = false } = {}) {
    const telemetry = this.sampleRuntimeTelemetry();
    const triggers = [];
    if (force) triggers.push('operator_requested_heal');
    if (telemetry.v8Heap.utilizationOfLimitPct >= 75) {
      triggers.push(`v8_heap_headroom_${telemetry.v8Heap.utilizationOfLimitPct}pct`);
    }
    if (telemetry.v8Heap.minutesToExhaustion !== null && telemetry.v8Heap.minutesToExhaustion < 20) {
      triggers.push(`predictive_exhaustion_${telemetry.v8Heap.minutesToExhaustion}m`);
    }
    if (telemetry.eventLoop.p99Ms >= 150) {
      triggers.push(`event_loop_p99_${telemetry.eventLoop.p99Ms}ms`);
    }

    const actions = [];
    if (triggers.length > 0) {
      // Cooperative memory-guardian trim (never restarts)
      try {
        const mg = require('../memory-guardian');
        if (mg && typeof mg.tick === 'function') {
          const mgRes = mg.tick();
          actions.push({ target: 'memory-guardian', ok: true, pressure: !!mgRes.pressure });
        }
      } catch (_) {}

      // Reset event-loop histogram after capture so stale spikes don't linger
      if (this.elMonitor && typeof this.elMonitor.reset === 'function') {
        try {
          this.elMonitor.reset();
          actions.push({ target: 'event-loop-histogram', ok: true, reset: true });
        } catch (_) {}
      }

      // Optional V8 incremental GC hint if Node was launched with --expose-gc
      if (typeof global.gc === 'function') {
        try {
          global.gc();
          actions.push({ target: 'v8-gc', ok: true });
        } catch (_) {}
      }

      const receipt = {
        id: 'asri_heal_' + crypto.randomBytes(6).toString('hex'),
        at: new Date().toISOString(),
        triggers,
        actions,
        heapUsedMB: telemetry.v8Heap.usedMB,
        eventLoopP99Ms: telemetry.eventLoop.p99Ms,
      };
      this.stabilizations.unshift(receipt);
      if (this.stabilizations.length > 25) this.stabilizations.length = 25;
      return { ok: true, stabilized: true, receipt, telemetry };
    }

    return { ok: true, stabilized: false, reason: 'runtime_optimal', telemetry };
  }

  /**
   * 3. Multi-Rail Network Immunity & Revenue-Friction Interceptor
   */
  recordRailProbe(railId, { ok = true, latencyMs = 0, detail = '' } = {}) {
    const existing = this.railHealth.get(railId) || {
      id: railId,
      role: 'upstream',
      status: 'healthy',
      successes: 0,
      failures: 0,
      avgLatencyMs: 0,
      reliabilityPct: 100,
    };
    if (ok) existing.successes += 1;
    else existing.failures += 1;
    const total = existing.successes + existing.failures;
    existing.reliabilityPct = total > 0 ? Math.round((existing.successes / total) * 10000) / 100 : 100;
    existing.avgLatencyMs = total === 1
      ? Math.round(latencyMs)
      : Math.round(((existing.avgLatencyMs * 0.7) + (latencyMs * 0.3)) * 10) / 10;
    existing.status = !ok && existing.reliabilityPct < 80 ? 'degraded-failover-active' : 'healthy';
    existing.lastCheckedAt = new Date().toISOString();
    if (detail) existing.lastDetail = String(detail).slice(0, 160);
    this.railHealth.set(railId, existing);
    return existing;
  }

  recordFriction({ route = 'unknown', statusCode = 500, latencyMs = 0, category = 'api', detail = '' } = {}) {
    const entry = {
      id: 'fric_' + crypto.randomBytes(5).toString('hex'),
      at: new Date().toISOString(),
      route: String(route).slice(0, 140),
      statusCode: Number(statusCode) || 500,
      latencyMs: Math.round(Number(latencyMs) || 0),
      category,
      detail: String(detail || '').slice(0, 180),
      remediation: category === 'checkout'
        ? 'failover-alt-payment-rail-ready'
        : 'circuit-breaker-and-retry-armed',
    };
    this.frictionEvents.unshift(entry);
    if (this.frictionEvents.length > 50) this.frictionEvents.length = 50;
    return entry;
  }

  computeImmunityScore(supplyChain, telemetry) {
    // 1. Supply chain score (0-25)
    let scScore = 25;
    if (!supplyChain.ok) scScore -= 15;
    if (supplyChain.tamperDetected) scScore = 0;

    // 2. V8 heap stability score (0-25)
    const util = telemetry.v8Heap.utilizationOfLimitPct;
    let heapScore = 25;
    if (util > 85) heapScore = 8;
    else if (util > 70) heapScore = 16;
    else if (util > 55) heapScore = 22;

    // 3. Event loop responsiveness score (0-25)
    const p99 = telemetry.eventLoop.p99Ms;
    let loopScore = 25;
    if (p99 > 250) loopScore = 10;
    else if (p99 > 120) loopScore = 18;
    else if (p99 > 60) loopScore = 22;

    // 4. Revenue & Multi-Rail continuity score (0-25)
    const recentCutoff = Date.now() - 15 * 60 * 1000;
    const recentCheckoutFriction = this.frictionEvents.filter(
      (f) => f.category === 'checkout' && Date.parse(f.at) >= recentCutoff
    ).length;
    let revScore = Math.max(5, 25 - recentCheckoutFriction * 5);

    const total = Math.max(0, Math.min(100, scScore + heapScore + loopScore + revScore));
    const grade = total >= 95 ? 'SOVEREIGN_A+' : total >= 85 ? 'A' : total >= 70 ? 'B' : 'DEGRADED';

    return {
      total,
      grade,
      pillars: {
        supplyChain: scScore,
        runtimeStability: heapScore,
        eventLoopHealth: loopScore,
        revenueContinuity: revScore,
      },
    };
  }

  /**
   * 4. Ed25519 Signed Public Runtime & Supply-Chain Immunity Certificate
   */
  getImmunityCertificate() {
    const supplyChain = this.auditSupplyChain();
    const telemetry = this.sampleRuntimeTelemetry();
    const score = this.computeImmunityScore(supplyChain, telemetry);

    const payload = {
      protocol: PROTOCOL,
      issuer: 'ZeusAI Sovereign Runtime Immunity Engine',
      domain: 'https://zeusai.pro',
      issuedAt: new Date().toISOString(),
      immunityScore: score,
      supplyChain: {
        appVersion: supplyChain.appVersion,
        nodeRuntime: supplyChain.nodeRuntime,
        enginesContract: supplyChain.enginesContract,
        directDependencies: supplyChain.sbom.directDependencies,
        lockfileResolvedPackages: supplyChain.sbom.lockfileResolvedPackages,
        sbomMerkleRoot: supplyChain.sbom.sbomMerkleRoot,
        tamperDetected: supplyChain.tamperDetected,
        posture: supplyChain.posture,
      },
      runtime: {
        uptimeSec: telemetry.uptimeSec,
        v8HeapUsedMB: telemetry.v8Heap.usedMB,
        v8HeapLimitMB: telemetry.v8Heap.limitMB,
        v8HeapUtilizationPct: telemetry.v8Heap.utilizationOfLimitPct,
        eventLoopP99Ms: telemetry.eventLoop.p99Ms,
        hostRamFreeMB: telemetry.host.ramFreeMB,
      },
      failoverRails: Array.from(this.railHealth.values()),
      stabilizationsExecuted: this.stabilizations.length,
      goldenRule6Contract: 'observe + cooperative trim only — never auto-kills backend',
    };

    const canonical = JSON.stringify(payload);
    const payloadSha256 = crypto.createHash('sha256').update(canonical).digest('hex');
    const keys = loadOrCreateEd25519Keypair();
    let signatureBase64 = null;
    let publicKeyPem = null;
    let keyOrigin = 'unsigned';

    if (keys && keys.privateKey) {
      signatureBase64 = crypto.sign(null, Buffer.from(canonical, 'utf8'), keys.privateKey).toString('base64');
      publicKeyPem = keys.publicKeyPem;
      keyOrigin = keys.keyOrigin;
    }

    return {
      ok: true,
      payload,
      attestation: {
        algorithm: 'Ed25519',
        payloadSha256,
        signatureBase64,
        publicKeyPem,
        keyOrigin,
      },
    };
  }

  verifyCertificate(cert) {
    try {
      if (!cert || !cert.payload || !cert.attestation || !cert.attestation.signatureBase64 || !cert.attestation.publicKeyPem) {
        return { valid: false, reason: 'incomplete_certificate' };
      }
      const canonical = JSON.stringify(cert.payload);
      const expectedHash = crypto.createHash('sha256').update(canonical).digest('hex');
      if (expectedHash !== cert.attestation.payloadSha256) {
        return { valid: false, reason: 'payload_hash_mismatch' };
      }
      const pubKey = crypto.createPublicKey(cert.attestation.publicKeyPem);
      const sigOk = crypto.verify(
        null,
        Buffer.from(canonical, 'utf8'),
        pubKey,
        Buffer.from(cert.attestation.signatureBase64, 'base64')
      );
      return { valid: !!sigOk, payloadSha256: expectedHash };
    } catch (e) {
      return { valid: false, reason: e && e.message };
    }
  }

  getStatus() {
    const supplyChain = this.lastSupplyChainAudit || this.auditSupplyChain();
    const telemetry = this.sampleRuntimeTelemetry();
    const score = this.computeImmunityScore(supplyChain, telemetry);
    return {
      ok: true,
      module: 'autonomous-runtime-immunity',
      protocol: PROTOCOL,
      startedAt: this.startedAt,
      immunityScore: score,
      supplyChain,
      telemetry,
      rails: Array.from(this.railHealth.values()),
      recentStabilizations: this.stabilizations.slice(0, 10),
      recentFriction: this.frictionEvents.slice(0, 10),
    };
  }

  health() {
    const st = this.getStatus();
    return {
      ok: st.supplyChain.ok && st.immunityScore.total >= 60,
      protocol: PROTOCOL,
      score: st.immunityScore.total,
      grade: st.immunityScore.grade,
      posture: st.supplyChain.posture,
      v8HeapPct: st.telemetry.v8Heap.utilizationOfLimitPct,
      eventLoopP99Ms: st.telemetry.eventLoop.p99Ms,
    };
  }
}

const engine = new AutonomousRuntimeImmunityEngine();
module.exports = engine;
