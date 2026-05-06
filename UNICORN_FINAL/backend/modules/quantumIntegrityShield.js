// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnkmh0qh4wuv22e
// Data: 2026-04-13T03:22:29.397Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// QuantumIntegrityShield – componentă de validare autonomă a integrității sistemului
// Verifică hash-uri, semnături de module și starea runtime pentru a detecta
// corupere de date sau manipulare neautorizată. // Quantum Integrity Shield – autonomous system integrity validator
'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

const SCAN_INTERVAL_MS  = parseInt(process.env.QIS_SCAN_INTERVAL_MS  || '300000',  10); // 5 min
const MAX_SCAN_HISTORY  = 100;
const AUTO_HEAL_ENABLED = String(process.env.QIS_AUTO_HEAL_ENABLED || 'true').toLowerCase() !== 'false';
const AUTO_HEAL_CMD     = process.env.QIS_AUTO_HEAL_CMD || 'pm2 reload ecosystem.config.js --update-env || pm2 reload unicorn-backend unicorn-site unicorn-guardian --update-env';
const AUTO_ROLLBACK_CMD = process.env.QIS_AUTO_ROLLBACK_CMD || '';
const AUTO_HEAL_COOLDOWN_MS = parseInt(process.env.QIS_AUTO_HEAL_COOLDOWN_MS || '180000', 10);
const HEAP_WARN_PCT = Number(process.env.QIS_HEAP_WARN_PCT || '0.98');
const HEAP_WARN_MIN_MB = Number(process.env.QIS_HEAP_WARN_MIN_MB || '512');

// Module critice care trebuie verificate / Critical modules to verify
const CRITICAL_MODULES = [
  'quantumVault',
  'QuantumSecurityLayer',
  'quantumResilienceCore',
  'sovereignAccessGuardian',
  'central-orchestrator',
];

const CRITICAL_FILES = [
  path.join(__dirname, '../index.js'),
  path.join(__dirname, '../../ecosystem.config.js'),
  path.join(__dirname, '../../scripts/fix-server.sh'),
  path.join(__dirname, '../../scripts/create-backup.sh'),
  path.join(__dirname, '../../scripts/rollback-last-backup.sh'),
];

const LEGACY_PM2_NAME_MAP = {
  unicorn: 'unicorn-backend',
  'unicorn-orchestrator': 'unicorn-site',
  'unicorn-health-guardian': 'unicorn-guardian',
  'unicorn-quantum-watchdog': 'unicorn-guardian',
};
const REQUIRED_PM2_PROCESSES = (Object.prototype.hasOwnProperty.call(process.env, 'QIS_REQUIRED_PROCESSES')
  ? process.env.QIS_REQUIRED_PROCESSES
  : 'unicorn-backend,unicorn-site,autoscaler')
  .split(',')
  .map((s) => LEGACY_PM2_NAME_MAP[s.trim()] || s.trim())
  .filter(Boolean);

class QuantumIntegrityShield {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000;
    this.name        = 'QuantumIntegrityShield';
    this.startedAt   = new Date().toISOString();
    this.active      = false;
    this.scanHistory = [];       // dernières MAX_SCAN_HISTORY scans
    this.lastScan    = null;     // { timestamp, status, issues, hashes }
    this._timer      = null;
    this._baselineHashes = {};   // { moduleName: sha256 }
    this._baselineFileHashes = {}; // { filePath: sha256 }
    this.lastSelfHealAt = null;
    this.lastSelfHealResult = null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  start() {
    if (this.active) return;
    if (process.env.DISABLE_SELF_MUTATION === '1') {
      console.log('[QuantumIntegrityShield] rulează în mod non-mutating (DISABLE_SELF_MUTATION=1)');
    }
    this.active = true;
    this._computeBaselineHashes();
    this._computeBaselineFileHashes();
    this._scheduleScan(2000);
    setInterval(() => this._scheduleScan(0), SCAN_INTERVAL_MS);
    console.log('[QuantumIntegrityShield] Activat — interval scan:', SCAN_INTERVAL_MS, 'ms');
  }

  stop() {
    this.active = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  // ── Core logic ───────────────────────────────────────────────────

  _scheduleScan(delayMs) {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._runScan(), delayMs);
  }

  _computeBaselineHashes() {
    const modulesDir = path.join(__dirname);
    for (const mod of CRITICAL_MODULES) {
      const filePath = path.join(modulesDir, `${mod}.js`);
      try {
        const content = fs.readFileSync(filePath);
        this._baselineHashes[mod] = crypto.createHash('sha256').update(content).digest('hex');
      } catch {
        this._baselineHashes[mod] = null; // module absent sau inaccessibil
      }
    }
  }

  _computeBaselineFileHashes() {
    for (const filePath of CRITICAL_FILES) {
      try {
        const content = fs.readFileSync(filePath);
        this._baselineFileHashes[filePath] = crypto.createHash('sha256').update(content).digest('hex');
      } catch {
        this._baselineFileHashes[filePath] = null;
      }
    }
  }

  _checkPm2Processes() {
    if (!REQUIRED_PM2_PROCESSES.length) return { ok: true, missing: [] };
    try {
      const raw = execSync('pm2 jlist', { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
      const list = JSON.parse(raw || '[]');
      const online = new Set(
        list
          .filter((p) => p?.pm2_env?.status === 'online')
          .map((p) => String(p.name || '').trim())
          .filter(Boolean)
      );
      const missing = REQUIRED_PM2_PROCESSES.filter((name) => !online.has(name));
      return { ok: missing.length === 0, missing };
    } catch {
      return { ok: false, missing: REQUIRED_PM2_PROCESSES.slice(), error: 'pm2_unavailable' };
    }
  }

  _attemptSelfHeal(status, issues) {
    if (!AUTO_HEAL_ENABLED) return;
    if (status !== 'compromised' && status !== 'degraded') return;

    const now = Date.now();
    if (this.lastSelfHealAt && now - this.lastSelfHealAt < AUTO_HEAL_COOLDOWN_MS) return;
    this.lastSelfHealAt = now;

    try {
      if (AUTO_HEAL_CMD) execSync(AUTO_HEAL_CMD, { stdio: 'ignore' });
      this.lastSelfHealResult = { at: new Date().toISOString(), ok: true, command: AUTO_HEAL_CMD };
      console.warn('[QuantumIntegrityShield] Auto-heal executat:', AUTO_HEAL_CMD);
    } catch (err) {
      this.lastSelfHealResult = { at: new Date().toISOString(), ok: false, command: AUTO_HEAL_CMD, error: err.message };
      console.warn('[QuantumIntegrityShield] Auto-heal failed:', err.message);
      const hasError = issues.some((i) => i.severity === 'error');
      if (hasError && AUTO_ROLLBACK_CMD) {
        try {
          execSync(AUTO_ROLLBACK_CMD, { stdio: 'ignore' });
          console.warn('[QuantumIntegrityShield] Auto-rollback executat:', AUTO_ROLLBACK_CMD);
        } catch (rollbackErr) {
          console.warn('[QuantumIntegrityShield] Auto-rollback failed:', rollbackErr.message);
        }
      }
    }
  }

  _runScan() {
    const timestamp = new Date().toISOString();
    const issues    = [];
    const hashes    = {};
    const fileHashes = {};

    // 1. Verificare integritate fișiere module critice
    const modulesDir = path.join(__dirname);
    for (const mod of CRITICAL_MODULES) {
      const filePath = path.join(modulesDir, `${mod}.js`);
      try {
        const content    = fs.readFileSync(filePath);
        const currentHash = crypto.createHash('sha256').update(content).digest('hex');
        hashes[mod]       = currentHash;

        const baseline = this._baselineHashes[mod];
        if (baseline && baseline !== currentHash) {
          issues.push({ type: 'hash_mismatch', module: mod, severity: 'warning',
            detail: 'Conținut modificat față de baseline / Content changed since baseline' });
        }
      } catch {
        hashes[mod] = null;
        issues.push({ type: 'module_missing', module: mod, severity: 'error',
          detail: `Modul critic inaccesibil: ${mod}` });
      }
    }

    // 1b. Verificare integritate fișiere critice de deploy/runtime
    for (const filePath of CRITICAL_FILES) {
      try {
        const content = fs.readFileSync(filePath);
        const currentHash = crypto.createHash('sha256').update(content).digest('hex');
        fileHashes[filePath] = currentHash;
        const baseline = this._baselineFileHashes[filePath];
        if (baseline && baseline !== currentHash) {
          issues.push({
            type: 'critical_file_changed',
            file: path.relative(path.join(__dirname, '..', '..'), filePath),
            severity: 'warning',
            detail: 'Fișier critic modificat față de baseline',
          });
        }
      } catch {
        fileHashes[filePath] = null;
        issues.push({
          type: 'critical_file_missing',
          file: path.relative(path.join(__dirname, '..', '..'), filePath),
          severity: 'error',
          detail: 'Fișier critic lipsă/inaccesibil',
        });
      }
    }

    // 2. Verificare runtime — variabile de mediu critice
    const requiredEnvVars = ['NODE_ENV'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push({ type: 'env_missing', variable: envVar, severity: 'info',
          detail: `Variabilă de mediu lipsă: ${envVar}` });
      }
    }

    // 3. Verificare memorie (alertă dacă > 90% heap)
    const mem = process.memoryUsage();
    const heapPct = mem.heapUsed / mem.heapTotal;
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    if (heapPct > HEAP_WARN_PCT && heapUsedMb >= HEAP_WARN_MIN_MB) {
      issues.push({ type: 'memory_pressure', severity: 'warning',
        detail: `Heap utilizat ${Math.round(heapPct * 100)}% (${heapUsedMb}MB / ${heapTotalMb}MB)` });
    }

    // 4. Verificare procese PM2 critice
    const pm2State = this._checkPm2Processes();
    if (!pm2State.ok) {
      // When running inside a PM2-managed process, pm2 jlist may be unavailable
      // (IPC channel not accessible from cluster workers). Treat as warning, not error,
      // to avoid false 'compromised' state when all services are actually healthy.
      const severity = 'warning';
      issues.push({
        type: 'pm2_process_missing',
        severity,
        detail: pm2State.error === 'pm2_unavailable'
          ? 'PM2 IPC indisponibil din contextul procesului curent (non-fatal)'
          : `Procese PM2 lipsă: ${(pm2State.missing || []).join(', ') || 'unknown'}`,
      });
    }

    const status = issues.some(i => i.severity === 'error') ? 'compromised'
      : issues.some(i => i.severity === 'warning')          ? 'degraded'
      : 'intact';

    const scanResult = { timestamp, status, issues, hashes, fileHashes, pm2: pm2State };
    this.lastScan = scanResult;

    this.scanHistory.push(scanResult);
    if (this.scanHistory.length > MAX_SCAN_HISTORY) {
      this.scanHistory.shift();
    }

    if (status !== 'intact') {
      const summary = issues
        .map(i => `${i.type || 'unknown'}(${i.severity || 'info'})`)
        .join(', ');
      console.warn(`[QuantumIntegrityShield] Scan ${timestamp}: ${status} — ${issues.length} issue(s): [${summary}]`);
    }

    this._attemptSelfHeal(status, issues);

    return scanResult;
  }

  // ── Public API ───────────────────────────────────────────────────

  /** Returnează statusul curent al scutului / Returns current shield status */
  getStatus() {
    return {
      name:       this.name,
      active:     this.active,
      startedAt:  this.startedAt,
      lastScan:   this.lastScan,
      integrity:  this.lastScan ? this.lastScan.status : 'pending',
      scansTotal: this.scanHistory.length,
      autoHealEnabled: AUTO_HEAL_ENABLED,
      lastSelfHealAt: this.lastSelfHealAt ? new Date(this.lastSelfHealAt).toISOString() : null,
      lastSelfHealResult: this.lastSelfHealResult,
      diagnostics: this._diagnostics(),
    };
  }

  _diagnostics() {
    const scan = this.lastScan;
    const issues = scan && Array.isArray(scan.issues) ? scan.issues : [];
    return {
      health: scan ? scan.status : 'pending',
      issues,
      rootCauses: issues.map((issue) => ({
        type: issue.type,
        severity: issue.severity,
        detail: issue.detail,
        fix: this._recommendedFix(issue),
      })),
      requiredPm2Processes: REQUIRED_PM2_PROCESSES,
      heapPolicy: { warnPct: HEAP_WARN_PCT, warnMinMb: HEAP_WARN_MIN_MB },
    };
  }

  _recommendedFix(issue) {
    if (!issue || !issue.type) return 'No action required.';
    if (issue.type === 'pm2_process_missing') return 'Verify PM2 ecosystem names match QIS_REQUIRED_PROCESSES and reload ecosystem.config.js.';
    if (issue.type === 'memory_pressure') return 'Inspect heap growth; warning is ignored below QIS_HEAP_WARN_MIN_MB to avoid false positives on small Node heaps.';
    if (issue.type === 'critical_file_missing') return 'Restore required deployment script or remove stale critical-file entry if retired.';
    if (issue.type === 'module_missing') return 'Restore the critical module file or remove retired module from the critical set.';
    if (issue.type === 'hash_mismatch' || issue.type === 'critical_file_changed') return 'Confirm deploy provenance, then restart service to establish a fresh boot baseline.';
    return 'Review the issue and apply the documented operational runbook.';
  }

  /** Forțează un scan imediat / Force an immediate scan */
  async scan() {
    return this._runScan();
  }

  /** Returnează istoricul scanărilor / Returns scan history */
  getScanHistory(limit = 20) {
    return this.scanHistory.slice(-Math.min(limit, MAX_SCAN_HISTORY));
  }
}

const shield = new QuantumIntegrityShield();
shield.start();

module.exports = shield;
module.exports.QuantumIntegrityShield = QuantumIntegrityShield;
