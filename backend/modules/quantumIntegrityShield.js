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
const AUTO_HEAL_CMD     = process.env.QIS_AUTO_HEAL_CMD || 'pm2 restart unicorn unicorn-orchestrator unicorn-health-guardian';
const AUTO_ROLLBACK_CMD = process.env.QIS_AUTO_ROLLBACK_CMD || '';
const AUTO_HEAL_COOLDOWN_MS = parseInt(process.env.QIS_AUTO_HEAL_COOLDOWN_MS || '180000', 10);

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

const REQUIRED_PM2_PROCESSES = (process.env.QIS_REQUIRED_PROCESSES || 'unicorn,unicorn-orchestrator,unicorn-health-guardian')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

class QuantumIntegrityShield {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60000;
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
      if (!Array.isArray(list) || list.length === 0) {
        console.warn('[QuantumIntegrityShield] pm2 jlist returned no processes. Auto-heal will be skipped.');
        return { ok: false, missing: REQUIRED_PM2_PROCESSES.slice(), error: 'pm2_no_processes' };
      }
      const online = new Set(
        list
          .filter((p) => p?.pm2_env?.status === 'online')
          .map((p) => String(p.name || '').trim())
          .filter(Boolean)
      );
      const missing = REQUIRED_PM2_PROCESSES.filter((name) => !online.has(name));
      return { ok: missing.length === 0, missing };
    } catch (err) {
      console.warn('[QuantumIntegrityShield] pm2 check failed:', err.message);
      return { ok: false, missing: REQUIRED_PM2_PROCESSES.slice(), error: 'pm2_unavailable' };
    }
  }

  _attemptSelfHeal(status, issues) {
    if (!AUTO_HEAL_ENABLED) return;
    if (status !== 'compromised' && status !== 'degraded') return;

    // Skip auto-heal if pm2 is not running or no processes are found
    const pm2State = this._checkPm2Processes();
    if (pm2State.error === 'pm2_no_processes' || pm2State.error === 'pm2_unavailable') {
      console.warn('[QuantumIntegrityShield] Auto-heal skipped: pm2 not running or no processes found.');
      return;
    }

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
    if (heapPct > 0.9) {
      issues.push({ type: 'memory_pressure', severity: 'warning',
        detail: `Heap utilizat ${Math.round(heapPct * 100)}% (${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB)` });
    }

    // 4. Verificare procese PM2 critice
    const pm2State = this._checkPm2Processes();
    if (!pm2State.ok) {
      issues.push({
        type: 'pm2_process_missing',
        severity: 'error',
        detail: `Procese PM2 lipsă: ${(pm2State.missing || []).join(', ') || 'unknown'}`,
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
      console.warn(`[QuantumIntegrityShield] Scan ${timestamp}: ${status} — ${issues.length} issue(s)`);
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
    };
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
