// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
// ==================== QUANTUM HEALING ENGINE ====================
// Real-time anomaly detection + corrective action on the Node runtime.
// Monitors: event-loop lag, heap pressure, RSS growth.
// Triggers: cache flush, manual GC (if --expose-gc), structured alert.
//
// Algorithm: EWMA (exponentially-weighted moving average) baseline +
// z-score deviation. When |z| >= ANOMALY_Z for two consecutive samples,
// the metric is flagged and a healing action is dispatched (with cooldown).

const { EventEmitter } = require('events');
const v8 = require('v8');

const SAMPLE_INTERVAL_MS = 5000;
const EWMA_ALPHA = 0.2;
const ANOMALY_Z = 3;
const HEAL_COOLDOWN_MS = 30000;
const HISTORY_SIZE = 240; // ~20 min @ 5s

const _state = {
  name: 'quantum-healing',
  label: 'Quantum Healing Engine',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'unknown',
  metrics: {
    eventLoopLagMs: { ewma: 0, ewmaSq: 0, last: 0 },
    heapUsedPct:    { ewma: 0, ewmaSq: 0, last: 0 },
    rssMB:          { ewma: 0, ewmaSq: 0, last: 0 },
  },
  history: [],
  anomalies: [],
  heals: [],
  lastHealAt: {},
  consecutiveAnomalies: {},
  timer: null,
};

const _bus = new EventEmitter();

function _measureEventLoopLag() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lagNs = Number(process.hrtime.bigint() - start);
      resolve(lagNs / 1e6);
    });
  });
}

function _updateEwma(slot, value) {
  const a = EWMA_ALPHA;
  slot.last = value;
  if (slot.ewma === 0 && slot.ewmaSq === 0) {
    slot.ewma = value;
    slot.ewmaSq = value * value;
  } else {
    slot.ewma = a * value + (1 - a) * slot.ewma;
    slot.ewmaSq = a * (value * value) + (1 - a) * slot.ewmaSq;
  }
}

function _zScore(slot) {
  const variance = Math.max(0, slot.ewmaSq - slot.ewma * slot.ewma);
  const stddev = Math.sqrt(variance);
  if (stddev < 1e-6) return 0;
  return (slot.last - slot.ewma) / stddev;
}

function _attemptHeal(metric, value, z) {
  const now = Date.now();
  if ((now - (_state.lastHealAt[metric] || 0)) < HEAL_COOLDOWN_MS) {
    return { skipped: true, reason: 'cooldown' };
  }
  const action = { metric, value, z: Number(z.toFixed(2)), at: new Date().toISOString(), steps: [] };

  if (metric === 'heapUsedPct' || metric === 'rssMB') {
    if (typeof global.gc === 'function') {
      try { global.gc(); action.steps.push('global.gc()'); } catch (_) { /* noop */ }
    } else {
      action.steps.push('gc_not_exposed');
    }
  }
  if (metric === 'eventLoopLagMs') {
    if (_state.history.length > HISTORY_SIZE / 2) {
      _state.history.splice(0, _state.history.length - HISTORY_SIZE / 2);
      action.steps.push('history_trim');
    }
    action.steps.push('yield');
  }

  _state.lastHealAt[metric] = now;
  _state.heals.push(action);
  if (_state.heals.length > 50) _state.heals.shift();
  _bus.emit('heal', action);
  return action;
}

async function _sample() {
  try {
    const lag = await _measureEventLoopLag();
    const heap = v8.getHeapStatistics();
    const heapUsedPct = (heap.used_heap_size / heap.heap_size_limit) * 100;
    const rssMB = process.memoryUsage().rss / 1024 / 1024;

    const samples = { eventLoopLagMs: lag, heapUsedPct, rssMB };
    const flags = [];

    for (const [key, value] of Object.entries(samples)) {
      const slot = _state.metrics[key];
      const hadBaseline = slot.ewma !== 0;
      _updateEwma(slot, value);
      const z = hadBaseline ? _zScore(slot) : 0;
      if (Math.abs(z) >= ANOMALY_Z) {
        _state.consecutiveAnomalies[key] = (_state.consecutiveAnomalies[key] || 0) + 1;
        if (_state.consecutiveAnomalies[key] >= 2) flags.push({ metric: key, value, z });
      } else {
        _state.consecutiveAnomalies[key] = 0;
      }
    }

    _state.history.push({ at: Date.now(), ...samples });
    if (_state.history.length > HISTORY_SIZE) _state.history.shift();

    for (const flag of flags) {
      const anomaly = { ...flag, at: new Date().toISOString() };
      _state.anomalies.push(anomaly);
      if (_state.anomalies.length > 100) _state.anomalies.shift();
      _bus.emit('anomaly', anomaly);
      _attemptHeal(flag.metric, flag.value, flag.z);
    }

    _state.health = flags.length ? 'degraded' : 'good';
    _state.lastRun = new Date().toISOString();
  } catch (err) {
    _state.health = 'error';
    _state.lastError = err.message;
  }
}

function init() {
  if (_state.timer) return;
  _state.startedAt = new Date().toISOString();
  _sample().catch(() => {});
  _state.timer = setInterval(() => { _sample().catch(() => {}); }, SAMPLE_INTERVAL_MS);
  if (typeof _state.timer.unref === 'function') _state.timer.unref();
  console.log('🦄 Quantum Healing Engine activat (real anomaly detection).');
}

function stop() {
  if (_state.timer) { clearInterval(_state.timer); _state.timer = null; }
}

async function process(input = {}) {
  _state.processCount++;
  if (input && input.forceSample) await _sample();
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
    processCount: _state.processCount,
    health: _state.health,
    metrics: {
      eventLoopLagMs: Number(_state.metrics.eventLoopLagMs.last.toFixed(2)),
      heapUsedPct:    Number(_state.metrics.heapUsedPct.last.toFixed(2)),
      rssMB:          Number(_state.metrics.rssMB.last.toFixed(2)),
    },
    anomalies: _state.anomalies.slice(-5),
    heals: _state.heals.slice(-5),
    timestamp: _state.lastRun || new Date().toISOString(),
  };
}

function getStatus() {
  return {
    name: _state.name,
    label: _state.label,
    startedAt: _state.startedAt,
    lastRun: _state.lastRun,
    processCount: _state.processCount,
    health: _state.health,
    metrics: {
      eventLoopLagMs: { ewma: Number(_state.metrics.eventLoopLagMs.ewma.toFixed(2)), last: Number(_state.metrics.eventLoopLagMs.last.toFixed(2)) },
      heapUsedPct:    { ewma: Number(_state.metrics.heapUsedPct.ewma.toFixed(2)),    last: Number(_state.metrics.heapUsedPct.last.toFixed(2)) },
      rssMB:          { ewma: Number(_state.metrics.rssMB.ewma.toFixed(2)),          last: Number(_state.metrics.rssMB.last.toFixed(2)) },
    },
    historyPoints: _state.history.length,
    anomalyCount: _state.anomalies.length,
    healCount: _state.heals.length,
  };
}

function getHistory(limit = 60) { return _state.history.slice(-limit); }
function on(event, listener) { _bus.on(event, listener); return () => _bus.off(event, listener); }

init();

module.exports = { process, getStatus, getHistory, init, stop, on, name: 'quantum-healing' };
