// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T20:56:24.799Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:15:50.132Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.889Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.364Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.345Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.969Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.690Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.553Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// unicornMeshOrchestrator.js
// Orchestrator central — conectează automat toate modulele unicornului,
// creează un bus de evenimente, monitorizează sănătatea fiecărui modul
// și le face să comunice între ele în permanență.
// Swiss-watch execution: fiecare modul își are locul, rulează sincronizat.

'use strict';

const { EventEmitter } = require('events');

const HEALTH_CYCLE_MS   = 30_000;   // puls global la 30s
const SYNC_CYCLE_MS     = 60_000;   // sincronizare completă la 60s
const REPORT_CYCLE_MS   = 300_000;  // raport complet la 5 min

class UnicornMeshOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.cacheTTL = 60000;
    this.setMaxListeners(100);
    this.registry   = new Map(); // name → { instance, lastStatus, lastSeen, healthy }
    this.eventLog   = [];
    this.healthLog  = [];
    this.startedAt  = Date.now();
    this.cycleCount = 0;
    this._timers    = [];
    this.running    = false;
  }

  // ------------------------------------------------------------------ registry

  /**
   * Înregistrează un modul în mesh.
   * @param {string} name      – identificator unic
   * @param {object} instance  – instanța modulului (trebuie să aibă cel puțin un getter de stare)
   * @param {object} [opts]    – { statusFn: string } – numele metodei ce returnează statusul
   */
  register(name, instance, opts = {}) {
    if (!name || !instance) return;
    const statusFn = opts.statusFn
      || (instance.getStatus ? 'getStatus' : null)
      || (instance.getRevenueStatus ? 'getRevenueStatus' : null)
      || (instance.getViralStatus ? 'getViralStatus' : null)
      || (instance.getMetrics ? 'getMetrics' : null)
      || null;

    this.registry.set(name, {
      instance,
      statusFn,
      lastStatus: null,
      lastSeen: null,
      healthy: true,
      errors: 0,
    });
    this._log(`✅ Modul înregistrat: ${name}`);
    this.emit('module:registered', { name, ts: new Date().toISOString() });
  }

  // ------------------------------------------------------------------ start

  start() {
    if (this.running) return;
    this.running = true;
    this._log('🚀 UnicornMeshOrchestrator pornit — Swiss-watch mode activ');

    // Puls imediat
    setTimeout(() => this._healthCycle(), 2000);

    // Timere periodice
    this._timers.push(setInterval(() => this._healthCycle(),  HEALTH_CYCLE_MS));
    this._timers.push(setInterval(() => this._syncCycle(),    SYNC_CYCLE_MS));
    this._timers.push(setInterval(() => this._reportCycle(),  REPORT_CYCLE_MS));

    this.emit('orchestrator:started', { ts: new Date().toISOString() });
  }

  stop() {
    this._timers.forEach(t => clearInterval(t));
    this._timers = [];
    this.running = false;
    this._log('⏹️  UnicornMeshOrchestrator oprit');
  }

  // ------------------------------------------------------------------ cycles

  _healthCycle() {
    this.cycleCount++;
    const snapshot = {};

    for (const [name, entry] of this.registry) {
      try {
        const status = entry.statusFn
          ? entry.instance[entry.statusFn]()
          : { health: 'unknown' };

        entry.lastStatus = status;
        entry.lastSeen   = Date.now();
        entry.healthy    = this._isHealthy(status);
        entry.errors     = entry.healthy ? 0 : entry.errors + 1;

        snapshot[name] = { healthy: entry.healthy, ts: entry.lastSeen };

        if (!entry.healthy) {
          this._log(`⚠️  Modul degradat: ${name} (erori: ${entry.errors})`);
          this.emit('module:unhealthy', { name, status, ts: new Date().toISOString() });
          this._healModule(name, entry);
        }
      } catch (err) {
        entry.errors++;
        this._log(`❌ Eroare status ${name}: ${err.message}`);
        this.emit('module:error', { name, error: err.message, ts: new Date().toISOString() });
      }
    }

    this.healthLog.push({ cycle: this.cycleCount, ts: new Date().toISOString(), snapshot });
    if (this.healthLog.length > 100) this.healthLog.shift();

    this.emit('mesh:heartbeat', { cycle: this.cycleCount, modules: snapshot, ts: new Date().toISOString() });
  }

  _syncCycle() {
    this._log(`🔄 Sincronizare mesh (${this.registry.size} module active)`);
    const aggregated = this._collectAggregate();

    // Broadcast stare globală către toate modulele care suportă onMeshSync
    for (const [name, entry] of this.registry) {
      try {
        if (typeof entry.instance.onMeshSync === 'function') {
          entry.instance.onMeshSync(aggregated);
        }
      } catch { /* optional hook */ }
    }

    this.emit('mesh:sync', { aggregated, ts: new Date().toISOString() });
  }

  _reportCycle() {
    const report = this.getStatus();
    this._log(`📊 Raport mesh: ${report.healthyModules}/${report.totalModules} module sănătoase | uptime: ${Math.floor(report.uptimeMs / 60000)} min`);
    this.emit('mesh:report', { report, ts: new Date().toISOString() });
  }

  // ------------------------------------------------------------------ healing

  _healModule(name, entry) {
    // Încearcă să apeleze metode de vindecare dacă există
    try {
      if (typeof entry.instance.heal === 'function') {
        entry.instance.heal();
        this._log(`🔧 heal() apelat pe: ${name}`);
      } else if (typeof entry.instance.restart === 'function') {
        entry.instance.restart();
        this._log(`🔄 restart() apelat pe: ${name}`);
      } else if (typeof entry.instance.start === 'function' && entry.errors > 3) {
        entry.instance.start();
        this._log(`▶️  start() re-apelat pe: ${name}`);
      }
    } catch (err) {
      this._log(`❌ Vindecare eșuată pentru ${name}: ${err.message}`);
    }
  }

  // ------------------------------------------------------------------ helpers

  _isHealthy(status) {
    if (!status) return false;
    // Blacklist approach: only flag unhealthy when there is an explicit negative signal.
    // Modules use different vocabulary (FULLY_AUTONOMOUS, intact, degraded, PARTIAL, etc.)
    // so a strict whitelist causes false degraded reports.
    const BAD_HEALTH  = new Set(['error', 'failed', 'down', 'critical', 'compromised', 'crashed', 'unknown']);
    const BAD_STATUS  = new Set(['error', 'failed', 'down', 'compromised', 'crashed']);
    if (status.health && typeof status.health === 'string' && BAD_HEALTH.has(status.health.toLowerCase())) return false;
    if (status.status && typeof status.status === 'string' && BAD_STATUS.has(status.status.toLowerCase())) return false;
    return true;
  }

  _collectAggregate() {
    const aggregate = { modules: {}, ts: new Date().toISOString(), meshHealthy: true };
    for (const [name, entry] of this.registry) {
      aggregate.modules[name] = {
        healthy: entry.healthy,
        errors:  entry.errors,
        lastSeen: entry.lastSeen,
        status: entry.lastStatus,
      };
      if (!entry.healthy) aggregate.meshHealthy = false;
    }
    return aggregate;
  }

  _log(message) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${message}`;
    console.log(`🕰️  MESH: ${message}`);
    this.eventLog.push(line);
    if (this.eventLog.length > 200) this.eventLog.shift();
  }

  // ------------------------------------------------------------------ public API

  getStatus() {
    let healthyModules = 0;
    const moduleList = [];
    for (const [name, entry] of this.registry) {
      if (entry.healthy) healthyModules++;
      moduleList.push({
        name,
        healthy: entry.healthy,
        errors: entry.errors,
        lastSeen: entry.lastSeen ? new Date(entry.lastSeen).toISOString() : null,
      });
    }
    return {
      running:        this.running,
      uptimeMs:       Date.now() - this.startedAt,
      cycleCount:     this.cycleCount,
      totalModules:   this.registry.size,
      healthyModules,
      meshHealthy:    healthyModules === this.registry.size,
      modules:        moduleList,
      recentLog:      this.eventLog.slice(-20),
    };
  }

  getHealthHistory(limit = 20) {
    return this.healthLog.slice(-Math.min(limit, 100));
  }

  getEventLog(limit = 50) {
    return this.eventLog.slice(-Math.min(limit, 200));
  }
}

module.exports = new UnicornMeshOrchestrator();
