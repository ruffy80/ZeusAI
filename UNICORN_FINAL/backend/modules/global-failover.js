// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T13:08:48.839Z
// Data: 2026-04-16T12:40:29.161Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/**
 * Global Failover & Scaling Controller
 * - Multi-region health tracking
 * - Automatic traffic rerouting on region failure
 * - Horizontal scaling triggers
 * - Load shedding under extreme pressure
 * - Geo-based routing decisions
 */

const { EventEmitter } = require('events');

// ─── Region definitions ───────────────────────────────────────────────────────
const REGIONS = {
  'us-east':    { label: 'US East (Virginia)',  priority: 1, endpoint: process.env.REGION_US_EAST_URL    || '' },
  'us-west':    { label: 'US West (Oregon)',    priority: 2, endpoint: process.env.REGION_US_WEST_URL    || '' },
  'eu-central': { label: 'EU Central (Frankfurt)', priority: 3, endpoint: process.env.REGION_EU_CENTRAL_URL || '' },
  'ap-south':   { label: 'AP South (Singapore)',priority: 4, endpoint: process.env.REGION_AP_SOUTH_URL   || '' },
};

// ─── Health state per region ──────────────────────────────────────────────────
const regionHealth = new Map(); // region → { status, failures, lastCheck, latencyMs }
for (const id of Object.keys(REGIONS)) {
  regionHealth.set(id, { status: 'healthy', failures: 0, lastCheck: null, latencyMs: 0 });
}

// ─── Scaling state ─────────────────────────────────────────────────────────────
const scalingState = {
  currentInstances: parseInt(process.env.UNICORN_INSTANCES || '2'),
  minInstances: 1,
  maxInstances: parseInt(process.env.MAX_INSTANCES || '20'),
  cpuThresholdUp: 75,   // % to scale up
  cpuThresholdDown: 25, // % to scale down
  lastScaleEvent: null,
  cooldownMs: 5 * 60 * 1000, // 5 min cooldown
  lastScaleAt: 0,
};

// ─── Traffic weights ──────────────────────────────────────────────────────────
const trafficWeights = new Map(); // region → weight (0-100)
for (const id of Object.keys(REGIONS)) trafficWeights.set(id, 100);

// ─── Event log ────────────────────────────────────────────────────────────────
const eventLog = [];
const MAX_LOG = 200;

class GlobalFailover extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.cacheTTL = 60000;
    this.active = false;
    this.primaryRegion = 'us-east';
    this.startTime = Date.now();
    this._healthCheckInterval = null;
  }

  start(intervalMs = 30000) {
    if (this.active) return;
    this.active = true;
    this._healthCheckInterval = setInterval(() => this._runHealthChecks(), intervalMs);
    this._healthCheckInterval.unref?.();
    this._log('info', 'GlobalFailover started', { regions: Object.keys(REGIONS) });
  }

  stop() {
    if (this._healthCheckInterval) clearInterval(this._healthCheckInterval);
    this.active = false;
  }

  // ── Health checks ──────────────────────────────────────────────────────────
  async _runHealthChecks() {
    for (const [regionId, meta] of Object.entries(REGIONS)) {
      if (!meta.endpoint) continue;
      const start = Date.now();
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(meta.endpoint + '/api/health', { signal: ctrl.signal });
        clearTimeout(timeout);
        const latency = Date.now() - start;
        this._recordHealth(regionId, resp.ok, latency, null);
      } catch (err) {
        this._recordHealth(regionId, false, Date.now() - start, err.message);
      }
    }
  }

  _recordHealth(regionId, healthy, latencyMs, error) {
    const h = regionHealth.get(regionId);
    if (!h) return;
    h.lastCheck = new Date().toISOString();
    h.latencyMs = latencyMs;

    if (healthy) {
      if (h.status === 'failed') {
        h.status = 'recovering';
        h.failures = 0;
        this._log('info', `Region ${regionId} recovering`, {});
        this.emit('region:recovering', { regionId });
        this._restoreRegionTraffic(regionId);
      } else if (h.status === 'recovering') {
        h.status = 'healthy';
        this._log('info', `Region ${regionId} healthy`, { latencyMs });
        this.emit('region:healthy', { regionId });
      } else {
        h.status = 'healthy';
        h.failures = 0;
      }
    } else {
      h.failures++;
      const threshold = 3;
      if (h.failures >= threshold && h.status !== 'failed') {
        h.status = 'failed';
        this._log('warn', `Region ${regionId} FAILED (${h.failures} failures)`, { error });
        this.emit('region:failed', { regionId, failures: h.failures });
        this._triggerFailover(regionId);
      }
    }
  }

  // ── Failover logic ─────────────────────────────────────────────────────────
  _triggerFailover(failedRegion) {
    // Drain traffic from failed region
    trafficWeights.set(failedRegion, 0);

    // Find next healthy region to promote
    const candidates = [...regionHealth.entries()]
      .filter(([id, h]) => id !== failedRegion && h.status === 'healthy')
      .sort((a, b) => (REGIONS[a[0]].priority || 99) - (REGIONS[b[0]].priority || 99));

    if (candidates.length === 0) {
      this._log('error', 'No healthy regions available — running in degraded mode', {});
      this.emit('failover:degraded', { failedRegion });
      return;
    }

    const [newPrimary] = candidates[0];
    if (this.primaryRegion === failedRegion) {
      this.primaryRegion = newPrimary;
      this._log('warn', `Failover: primary region switched to ${newPrimary}`, { failedRegion });
      this.emit('failover:completed', { failedRegion, newPrimary });
    }

    // Redistribute weight
    const healthyRegions = candidates.map(([id]) => id);
    const weightEach = Math.floor(100 / healthyRegions.length);
    for (const id of healthyRegions) trafficWeights.set(id, weightEach);
  }

  _restoreRegionTraffic(regionId) {
    // Gradually restore weight
    const healthy = [...regionHealth.entries()].filter(([, h]) => h.status !== 'failed').map(([id]) => id);
    const w = Math.floor(100 / healthy.length);
    for (const id of healthy) trafficWeights.set(id, w);
  }

  // ── Manual override ────────────────────────────────────────────────────────
  forceFailover(targetRegion) {
    if (!REGIONS[targetRegion]) throw new Error(`Unknown region: ${targetRegion}`);
    const old = this.primaryRegion;
    this.primaryRegion = targetRegion;
    // Zero out all others, 100 to target
    for (const id of Object.keys(REGIONS)) trafficWeights.set(id, id === targetRegion ? 100 : 0);
    this._log('warn', `Manual failover: ${old} → ${targetRegion}`, {});
    this.emit('failover:manual', { from: old, to: targetRegion });
    return { success: true, from: old, to: targetRegion };
  }

  // ── Scaling ────────────────────────────────────────────────────────────────
  reportLoad(cpuPercent, memPercent) {
    const now = Date.now();
    if (now - scalingState.lastScaleAt < scalingState.cooldownMs) return null; // in cooldown

    if (cpuPercent > scalingState.cpuThresholdUp &&
        scalingState.currentInstances < scalingState.maxInstances) {
      const newCount = Math.min(scalingState.currentInstances + 2, scalingState.maxInstances);
      const event = { action: 'scale-up', from: scalingState.currentInstances, to: newCount, reason: `CPU ${cpuPercent}%` };
      scalingState.currentInstances = newCount;
      scalingState.lastScaleAt = now;
      scalingState.lastScaleEvent = event;
      this._log('info', `Scale UP: ${event.from} → ${event.to}`, event);
      this.emit('scale:up', event);
      return event;
    }

    if (cpuPercent < scalingState.cpuThresholdDown &&
        scalingState.currentInstances > scalingState.minInstances) {
      const newCount = Math.max(scalingState.currentInstances - 1, scalingState.minInstances);
      const event = { action: 'scale-down', from: scalingState.currentInstances, to: newCount, reason: `CPU ${cpuPercent}%` };
      scalingState.currentInstances = newCount;
      scalingState.lastScaleAt = now;
      scalingState.lastScaleEvent = event;
      this._log('info', `Scale DOWN: ${event.from} → ${event.to}`, event);
      this.emit('scale:down', event);
      return event;
    }

    return null;
  }

  // ── Logging ────────────────────────────────────────────────────────────────
  _log(level, message, data) {
    const entry = { ts: new Date().toISOString(), level, message, data };
    eventLog.push(entry);
    if (eventLog.length > MAX_LOG) eventLog.shift();
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  getStatus() {
    const regions = {};
    for (const [id, h] of regionHealth) {
      regions[id] = { ...h, weight: trafficWeights.get(id), ...REGIONS[id] };
    }
    return {
      module: 'GlobalFailover',
      version: '1.0.0',
      active: this.active,
      primaryRegion: this.primaryRegion,
      regions,
      scaling: { ...scalingState },
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  getEventLog(limit = 50) {
    return eventLog.slice(-limit);
  }

  // ── Routing helper ─────────────────────────────────────────────────────────
  getTargetRegion(preferredRegion) {
    if (preferredRegion && regionHealth.get(preferredRegion)?.status === 'healthy') {
      return preferredRegion;
    }
    // Weighted random selection among healthy regions
    const entries = [...regionHealth.entries()]
      .filter(([, h]) => h.status === 'healthy')
      .map(([id]) => ({ id, weight: trafficWeights.get(id) || 0 }))
      .filter(e => e.weight > 0);

    if (entries.length === 0) return this.primaryRegion;
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let rand = Math.random() * total;
    for (const e of entries) {
      rand -= e.weight;
      if (rand <= 0) return e.id;
    }
    return entries[0].id;
  }
}

const instance = new GlobalFailover();
instance.start();
module.exports = instance;
module.exports.GlobalFailover = GlobalFailover;
