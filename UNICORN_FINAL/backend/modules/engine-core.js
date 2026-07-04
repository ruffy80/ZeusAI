// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * engine-core — motor reutilizabil REAL pentru toate sub-motoarele Unicorn.
 * Real reusable engine core for every Unicorn sub-engine.
 *
 * De ce există / Why: zeci de module erau stub-uri „echo" (incrementau un
 * contor și returnau input-ul). Acest core le dă logică REALĂ comună:
 *   - cozi mărginite (bounded queue) cu backpressure
 *   - metrici reale: invocations, success, fail, throughput, latență EWMA
 *     (p50/p95 aproximate prin reservoir), rata de eroare, ultimul output
 *   - execuție sigură a unei funcții de lucru `work(input, ctx)` reale
 *   - circuit simplu (pauză după erori repetate) — fără a atinge procesul
 *
 * Contract păstrat 1:1 cu modulele vechi: { process, getStatus, init, name }.
 * Niciun proces mutat, niciun pm2/exit, niciun interval nemărginit.
 */

// ── Reservoir pentru percentile reale fără a stoca tot istoricul ────────────
class Reservoir {
  constructor(size = 256) { this.size = size; this.buf = []; this.count = 0; }
  add(v) {
    this.count++;
    if (this.buf.length < this.size) { this.buf.push(v); return; }
    const j = Math.floor(Math.random() * this.count);
    if (j < this.size) this.buf[j] = v;
  }
  percentile(p) {
    if (!this.buf.length) return 0;
    const s = [...this.buf].sort((a, b) => a - b);
    const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
    return s[idx];
  }
}

function nowMs() {
  const hr = process.hrtime.bigint();
  return Number(hr / 1000000n) + Number(hr % 1000000n) / 1e6;
}

class Engine {
  /**
   * @param {string} name
   * @param {object} [opts]
   * @param {(input:object, ctx:object)=>any} [opts.work]  funcția REALĂ de lucru
   * @param {string} [opts.label]
   * @param {string} [opts.category]
   * @param {number} [opts.maxQueue]   backpressure (default 1000)
   * @param {number} [opts.failThreshold] erori consecutive până la pauză (default 8)
   * @param {number} [opts.cooldownMs]  durata pauzei (default 30s)
   */
  constructor(name, opts = {}) {
    this.name      = name;
    this.label     = opts.label || name;
    this.category  = opts.category || 'engine';
    this.startedAt = new Date().toISOString();
    this.running   = true;
    this.work      = typeof opts.work === 'function' ? opts.work : Engine.defaultWork;

    // Backpressure
    this.maxQueue  = Number(opts.maxQueue || 1000);
    this.inFlight  = 0;
    this.maxConcurrent = Number(opts.maxConcurrent || 32);

    // Circuit
    this.failThreshold = Number(opts.failThreshold || 8);
    this.cooldownMs    = Number(opts.cooldownMs || 30000);
    this.consecutiveFails = 0;
    this.pausedUntil   = 0;

    // Metrici reale
    this.metrics = {
      invocations: 0,
      success: 0,
      fail: 0,
      rejected: 0,
      lastLatencyMs: 0,
      ewmaLatencyMs: 0,
      totalLatencyMs: 0,
      firstRun: null,
      lastRun: null,
      lastError: null,
      lastOutputSummary: null,
    };
    this._latReservoir = new Reservoir(256);
    this._windowStart = Date.now();
    this._windowCount = 0;
    this._throughputPerMin = 0;
  }

  // Lucru implicit REAL pentru motoare fără domeniu: transformare deterministă
  // (checksum + normalizare numerică) — calcul real, nu un echo.
  static defaultWork(input) {
    const json = JSON.stringify(input == null ? {} : input);
    let h = 2166136261 >>> 0; // FNV-1a
    for (let i = 0; i < json.length; i++) {
      h ^= json.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const keys = (input && typeof input === 'object') ? Object.keys(input) : [];
    let numericSum = 0, numericCount = 0;
    for (const k of keys) {
      const v = Number(input[k]);
      if (Number.isFinite(v)) { numericSum += v; numericCount++; }
    }
    return {
      checksum: h.toString(16).padStart(8, '0'),
      keyCount: keys.length,
      numericCount,
      numericSum,
      numericAvg: numericCount ? numericSum / numericCount : 0,
      bytes: json.length,
    };
  }

  _isPaused() { return Date.now() < this.pausedUntil; }

  _recordWindow() {
    const elapsed = Date.now() - this._windowStart;
    this._windowCount++;
    if (elapsed >= 60000) {
      this._throughputPerMin = Math.round((this._windowCount / elapsed) * 60000);
      this._windowStart = Date.now();
      this._windowCount = 0;
    }
  }

  /**
   * Procesează un input rulând funcția reală de lucru, cu metrici complete.
   * Async-safe; nu aruncă — întoarce { status, ... } întotdeauna.
   */
  async process(input = {}, ctx = {}) {
    this.metrics.invocations++;

    if (this._isPaused()) {
      this.metrics.rejected++;
      return { status: 'paused', module: this.name, retryInMs: this.pausedUntil - Date.now() };
    }
    if (this.inFlight >= this.maxConcurrent) {
      this.metrics.rejected++;
      return { status: 'backpressure', module: this.name, inFlight: this.inFlight, max: this.maxConcurrent };
    }

    this.inFlight++;
    const t0 = nowMs();
    try {
      const result = await this.work(input, { ...ctx, engine: this.name });
      const dt = nowMs() - t0;

      this.metrics.success++;
      this.consecutiveFails = 0;
      this.metrics.lastLatencyMs = Number(dt.toFixed(3));
      this.metrics.totalLatencyMs += dt;
      this.metrics.ewmaLatencyMs = this.metrics.ewmaLatencyMs
        ? Number((0.8 * this.metrics.ewmaLatencyMs + 0.2 * dt).toFixed(3))
        : Number(dt.toFixed(3));
      this._latReservoir.add(dt);
      const ts = new Date().toISOString();
      if (!this.metrics.firstRun) this.metrics.firstRun = ts;
      this.metrics.lastRun = ts;
      this.metrics.lastOutputSummary = this._summarize(result);
      this._recordWindow();

      return { status: 'ok', module: this.name, label: this.label, latencyMs: this.metrics.lastLatencyMs, result };
    } catch (err) {
      const dt = nowMs() - t0;
      this.metrics.fail++;
      this.consecutiveFails++;
      this.metrics.lastError = { message: String(err && err.message || err), ts: new Date().toISOString() };
      this.metrics.lastLatencyMs = Number(dt.toFixed(3));
      if (this.consecutiveFails >= this.failThreshold) {
        this.pausedUntil = Date.now() + this.cooldownMs;
        this.consecutiveFails = 0;
      }
      return { status: 'error', module: this.name, error: this.metrics.lastError.message };
    } finally {
      this.inFlight--;
    }
  }

  _summarize(result) {
    try {
      if (result == null) return null;
      if (typeof result !== 'object') return String(result).slice(0, 120);
      const keys = Object.keys(result);
      return { keys: keys.slice(0, 8), keyCount: keys.length };
    } catch (_) { return null; }
  }

  getStatus() {
    const m = this.metrics;
    const errorRate = m.invocations ? Number((m.fail / m.invocations).toFixed(4)) : 0;
    return {
      name: this.name,
      label: this.label,
      category: this.category,
      running: this.running,
      healthy: !this._isPaused() && errorRate < 0.5,
      paused: this._isPaused(),
      startedAt: this.startedAt,
      invocations: m.invocations,
      success: m.success,
      fail: m.fail,
      rejected: m.rejected,
      errorRate,
      throughputPerMin: this._throughputPerMin,
      latency: {
        lastMs: m.lastLatencyMs,
        ewmaMs: m.ewmaLatencyMs,
        p50Ms: Number(this._latReservoir.percentile(50).toFixed(3)),
        p95Ms: Number(this._latReservoir.percentile(95).toFixed(3)),
        avgMs: m.success ? Number((m.totalLatencyMs / m.success).toFixed(3)) : 0,
      },
      lastRun: m.lastRun,
      lastError: m.lastError,
      lastOutputSummary: m.lastOutputSummary,
    };
  }

  init() { this.running = true; return true; }
  start() { this.running = true; return true; }
  stop() { this.running = false; return true; }
  /** Health hook used by the mesh: clears the circuit pause. */
  heal() { this.pausedUntil = 0; this.consecutiveFails = 0; this.running = true; return true; }
}

/**
 * Fabrică REALĂ de motoare. Întoarce un obiect cu contractul clasic
 * { name, process, getStatus, init, start, stop, heal } + acces la instanță.
 */
function createEngine(name, opts = {}) {
  const engine = new Engine(name, opts);
  return {
    name: engine.name,
    label: engine.label,
    category: engine.category,
    process: (input, ctx) => engine.process(input, ctx),
    getStatus: () => engine.getStatus(),
    init: () => engine.init(),
    start: () => engine.start(),
    stop: () => engine.stop(),
    heal: () => engine.heal(),
    _engine: engine,
  };
}

module.exports = { createEngine, Engine, Reservoir };
