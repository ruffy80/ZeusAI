// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T13:11:19.928Z
// Data: 2026-04-16T12:40:29.171Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * GLOBAL LOAD BALANCER — Zeus AI Unicorn Multi-Tenant SaaS Platform
 *
 * Multi-region readiness, load balancing, failover, self-healing:
 *   1. Region registry (in-memory + env-driven)
 *   2. Weighted round-robin and latency-based routing
 *   3. Health probing of all registered regions/backends
 *   4. Automatic failover on unhealthy region detection
 *   5. Circuit breaker per region (open / half-open / closed)
 *   6. Traffic shift: canary, blue/green, percentage split
 *   7. Self-healing: auto-reintegrate recovered regions
 *   8. Zero manual intervention: all decisions automated
 */

const axios = require('axios');
const EventEmitter = require('events');

// ── Config ────────────────────────────────────────────────────────────────────
const PROBE_INTERVAL_MS  = parseInt(process.env.GLB_PROBE_MS       || '30000', 10);
const CIRCUIT_OPEN_MS    = parseInt(process.env.GLB_CIRCUIT_OPEN_MS || '60000', 10);
const FAIL_THRESHOLD     = parseInt(process.env.GLB_FAIL_THRESHOLD  || '3',     10);
const SUCCESS_THRESHOLD  = parseInt(process.env.GLB_SUCCESS_THRESH  || '2',     10);

// ── Region/backend registry ───────────────────────────────────────────────────
// Seed from env: GLB_REGIONS=name:url:weight,...
const _regions = new Map();

function _parseRegionsFromEnv() {
  const raw = process.env.GLB_REGIONS || '';
  if (!raw) return;
  for (const entry of raw.split(',')) {
    const parts = entry.trim().split(':');
    if (parts.length >= 2) {
      const name   = parts[0];
      const url    = parts.slice(1, -1).join(':') || parts[1];
      const weight = parseInt(parts[parts.length - 1], 10) || 1;
      registerRegion({ name, url, weight });
    }
  }
}

function registerRegion({ name, url, weight = 1, region = 'default', metadata = {} } = {}) {
  if (!name || !url) throw new Error('name and url are required');
  // Validate URL scheme to prevent SSRF
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Only http/https URLs are allowed; got: ${parsed.protocol}`);
    }
  } catch (e) {
    throw new Error(`Invalid region URL: ${e.message}`);
  }
  _regions.set(name, {
    name,
    url,
    weight,
    region,
    metadata,
    status: 'unknown',   // unknown | healthy | unhealthy | circuit_open
    failCount: 0,
    successCount: 0,
    latencyMs: 0,
    lastProbed: null,
    circuitOpenAt: null,
    trafficWeight: weight,
  });
}

function removeRegion(name) {
  _regions.delete(name);
}

function listRegions() {
  return [..._regions.values()].map(r => ({ ...r }));
}

// ── Circuit breaker ───────────────────────────────────────────────────────────

function _isCircuitOpen(r) {
  if (r.status !== 'circuit_open') return false;
  if (Date.now() - r.circuitOpenAt > CIRCUIT_OPEN_MS) {
    // Half-open: allow a probe
    r.status = 'unknown';
    r.failCount = 0;
    return false;
  }
  return true;
}

function _recordSuccess(r) {
  r.failCount = 0;
  r.successCount++;
  if (r.status !== 'healthy') {
    if (r.successCount >= SUCCESS_THRESHOLD) {
      r.status = 'healthy';
      console.log(`[GlobalLoadBalancer] Region "${r.name}" recovered → healthy`);
    }
  }
}

function _recordFailure(r) {
  r.failCount++;
  r.successCount = 0;
  if (r.failCount >= FAIL_THRESHOLD) {
    r.status = 'circuit_open';
    r.circuitOpenAt = Date.now();
    console.warn(`[GlobalLoadBalancer] Circuit OPEN for region "${r.name}" after ${r.failCount} failures`);
  } else {
    r.status = 'unhealthy';
  }
}

// ── Health probing ────────────────────────────────────────────────────────────

// ── Allowed probe URL schemes ─────────────────────────────────────────────────
// Only probe http/https URLs to prevent SSRF via file://, ftp://, etc.
function _validateProbeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }
    return parsed.href;
  } catch (e) {
    throw new Error(`Invalid region URL: ${e.message}`);
  }
}

async function probeRegion(name) {
  const r = _regions.get(name);
  if (!r) throw new Error(`Region not found: ${name}`);
  if (_isCircuitOpen(r)) return r;

  let healthUrl;
  try {
    const base = _validateProbeUrl(r.url);
    healthUrl = base.replace(/\/$/, '') + '/health';
  } catch (e) {
    console.warn(`[GlobalLoadBalancer] Skipping probe for "${name}": ${e.message}`);
    _recordFailure(r);
    return r;
  }

  const start = Date.now();
  try {
    const resp = await axios.get(healthUrl, { timeout: 5000, validateStatus: s => s < 500 });
    const latency = Date.now() - start;
    r.latencyMs = latency;
    r.lastProbed = new Date().toISOString();
    if (resp.status < 400) {
      _recordSuccess(r);
    } else {
      _recordFailure(r);
    }
  } catch {
    r.latencyMs = Date.now() - start;
    r.lastProbed = new Date().toISOString();
    _recordFailure(r);
  }
  return r;
}

async function probeAll() {
  const results = await Promise.allSettled([..._regions.keys()].map(name => probeRegion(name)));
  return results.map((r, i) => {
    const name = [..._regions.keys()][i];
    return { name, status: r.status === 'fulfilled' ? r.value.status : 'error' };
  });
}

// ── Routing ───────────────────────────────────────────────────────────────────

// Weighted round-robin state
const _rrCounters = new Map();

function _getHealthyRegions() {
  return [..._regions.values()].filter(r =>
    r.status === 'healthy' || r.status === 'unknown'
  );
}

/**
 * selectRegion(strategy)
 * strategy: 'round_robin' | 'latency' | 'random' | 'primary'
 * Returns the selected region or null if none available.
 */
function selectRegion(strategy = 'latency') {
  const healthy = _getHealthyRegions();
  if (healthy.length === 0) return null;

  if (strategy === 'latency') {
    // Select lowest latency; unknown latency treated as 9999ms
    return healthy.sort((a, b) => (a.latencyMs || 9999) - (b.latencyMs || 9999))[0];
  }

  if (strategy === 'random') {
    // Weighted random
    const totalWeight = healthy.reduce((s, r) => s + r.trafficWeight, 0);
    let rand = Math.random() * totalWeight;
    for (const r of healthy) {
      rand -= r.trafficWeight;
      if (rand <= 0) return r;
    }
    return healthy[0];
  }

  if (strategy === 'round_robin') {
    const key = 'global';
    const idx = (_rrCounters.get(key) || 0) % healthy.length;
    _rrCounters.set(key, idx + 1);
    return healthy[idx];
  }

  if (strategy === 'primary') {
    return healthy[0];
  }

  return healthy[0];
}

// ── Traffic splitting (canary / blue-green) ───────────────────────────────────

const _splits = new Map(); // name -> { primary, canary, canaryPct }

function setSplit(name, { primary, canary, canaryPct = 10 } = {}) {
  _splits.set(name, { primary, canary, canaryPct });
}

function removeSplit(name) {
  _splits.delete(name);
}

function resolveTarget(splitName) {
  const split = _splits.get(splitName);
  if (!split) return null;
  const useCanary = Math.random() * 100 < split.canaryPct;
  return useCanary ? split.canary : split.primary;
}

// ── Self-healing watchdog ─────────────────────────────────────────────────────

class GlobalLoadBalancer extends EventEmitter {
  constructor() {
    super();
    this._running = false;
    this._probeTimer = null;
    this._stats = { totalProbes: 0, failovers: 0, recoveries: 0 };
  }

  start() {
    if (this._running) return;
    this._running = true;

    // Register self as default region if no regions configured
    if (_regions.size === 0) {
      const selfUrl = process.env.PUBLIC_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
      registerRegion({ name: 'local', url: selfUrl, weight: 1, region: 'local' });
    }
    _parseRegionsFromEnv();

    this._probeTimer = setInterval(async () => {
      this._stats.totalProbes++;
      const before = [..._regions.values()].filter(r => r.status === 'healthy').length;
      await probeAll();
      const after = [..._regions.values()].filter(r => r.status === 'healthy').length;
      if (after < before) { this._stats.failovers++; this.emit('failover', { healthy: after }); }
      if (after > before) { this._stats.recoveries++; this.emit('recovery', { healthy: after }); }
    }, PROBE_INTERVAL_MS);
    this._probeTimer.unref();

    console.log('[GlobalLoadBalancer] Started');
  }

  stop() {
    this._running = false;
    if (this._probeTimer) { clearInterval(this._probeTimer); this._probeTimer = null; }
  }

  getStatus() {
    const regions = listRegions();
    return {
      module: 'GlobalLoadBalancer',
      status: this._running ? 'active' : 'stopped',
      regionCount: regions.length,
      healthy: regions.filter(r => r.status === 'healthy').length,
      unhealthy: regions.filter(r => r.status === 'unhealthy' || r.status === 'circuit_open').length,
      splits: _splits.size,
      strategy: process.env.GLB_STRATEGY || 'latency',
      stats: this._stats,
      regions,
    };
  }
}

const globalLB = new GlobalLoadBalancer();
globalLB.start();

module.exports = {
  globalLB,
  registerRegion,
  removeRegion,
  listRegions,
  probeRegion,
  probeAll,
  selectRegion,
  setSplit,
  removeSplit,
  resolveTarget,
};
