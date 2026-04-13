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

const SCAN_INTERVAL_MS  = parseInt(process.env.QIS_SCAN_INTERVAL_MS  || '300000',  10); // 5 min
const MAX_SCAN_HISTORY  = 100;

// Module critice care trebuie verificate / Critical modules to verify
const CRITICAL_MODULES = [
  'quantumVault',
  'QuantumSecurityLayer',
  'quantumResilienceCore',
  'sovereignAccessGuardian',
  'central-orchestrator',
];

class QuantumIntegrityShield {
  constructor() {
    this.name        = 'QuantumIntegrityShield';
    this.startedAt   = new Date().toISOString();
    this.active      = false;
    this.scanHistory = [];       // dernières MAX_SCAN_HISTORY scans
    this.lastScan    = null;     // { timestamp, status, issues, hashes }
    this._timer      = null;
    this._baselineHashes = {};   // { moduleName: sha256 }
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  start() {
    if (this.active) return;
    this.active = true;
    this._computeBaselineHashes();
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

  _runScan() {
    const timestamp = new Date().toISOString();
    const issues    = [];
    const hashes    = {};

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

    const status = issues.some(i => i.severity === 'error') ? 'compromised'
      : issues.some(i => i.severity === 'warning')          ? 'degraded'
      : 'intact';

    const scanResult = { timestamp, status, issues, hashes };
    this.lastScan = scanResult;

    this.scanHistory.push(scanResult);
    if (this.scanHistory.length > MAX_SCAN_HISTORY) {
      this.scanHistory.shift();
    }

    if (status !== 'intact') {
      console.warn(`[QuantumIntegrityShield] Scan ${timestamp}: ${status} — ${issues.length} issue(s)`);
    }

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
