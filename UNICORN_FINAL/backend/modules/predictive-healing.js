// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
// ==================== PREDICTIVE HEALING ENGINE ====================
// Forecasts failures BEFORE they happen using sliding-window linear
// regression on key health metrics. When a metric is trending toward
// a critical threshold inside FORECAST_HORIZON_MS, an early warning is
// emitted with an estimated time-to-breach (ETA).
//
// Inputs are pulled live from quantum-healing's history (CPU/memory
// /event-loop) plus an internal error-rate buffer fed via observe().
//
// Output: { health, predictions: [{ metric, slope, eta_ms, severity }] }

const { EventEmitter } = require('events');
const v8 = require('v8');

const SAMPLE_INTERVAL_MS = 10000;
const WINDOW_SIZE = 30;                  // 30 samples ≈ 5 min @ 10s
const FORECAST_HORIZON_MS = 15 * 60_000; // predict up to 15 min ahead
const SLOPE_MIN_SIGNIFICANT = 1e-6;

// Thresholds at which a metric is considered "critical" (breach point).
const CRITICAL = {
  heapUsedPct:    90,    // %
  rssMB:          1500,  // MB
  eventLoopLagMs: 200,   // ms
  errorRatePerMin: 30,   // errors/min
};

const _state = {
  name: 'predictive-healing',
  label: 'Predictive Healing Engine',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'unknown',
  series: {
    heapUsedPct:     [],
    rssMB:           [],
    eventLoopLagMs:  [],
    errorRatePerMin: [],
  },
  errorBucket: { startMs: Date.now(), count: 0 },
  predictions: [],
  warnings: [],
  timer: null,
};

const _bus = new EventEmitter();

function _measureEventLoopLag() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => resolve(Number(process.hrtime.bigint() - start) / 1e6));
  });
}

// Closed-form simple linear regression on (t,y).
// Returns { slope_per_ms, intercept, r2 }.
function _linreg(points) {
  const n = points.length;
  if (n < 3) return { slope: 0, intercept: 0, r2: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (const { t, y } of points) {
    sx += t; sy += y; sxx += t * t; sxy += t * y; syy += y * y;
  }
  const denom = (n * sxx - sx * sx);
  if (Math.abs(denom) < 1e-9) return { slope: 0, intercept: sy / n, r2: 0 };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const ssTot = syy - (sy * sy) / n;
  const ssRes = (() => {
    let s = 0;
    for (const { t, y } of points) {
      const yhat = slope * t + intercept;
      s += (y - yhat) * (y - yhat);
    }
    return s;
  })();
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, intercept, r2 };
}

function _forecastBreach(metric, series) {
  const threshold = CRITICAL[metric];
  if (threshold == null || series.length < 5) return null;

  const t0 = series[0].t;
  const points = series.map(({ t, y }) => ({ t: t - t0, y }));
  const { slope, intercept, r2 } = _linreg(points);

  if (Math.abs(slope) < SLOPE_MIN_SIGNIFICANT) return null;
  if (r2 < 0.3) return null; // weak fit, skip

  const lastPoint = points[points.length - 1];
  // y(t) = slope * t + intercept ; solve for y = threshold.
  const tBreach = (threshold - intercept) / slope;
  const eta_ms = tBreach - lastPoint.t;

  // Only predict if the metric is moving toward threshold and breach is in the future window.
  if (eta_ms <= 0 || eta_ms > FORECAST_HORIZON_MS) return null;
  if (slope > 0 && lastPoint.y >= threshold) return null; // already breached, not a prediction

  const severity = eta_ms < 60_000 ? 'critical' : eta_ms < 5 * 60_000 ? 'high' : 'medium';
  return {
    metric,
    currentValue: Number(lastPoint.y.toFixed(2)),
    threshold,
    slope: Number(slope.toFixed(6)),
    r2: Number(r2.toFixed(3)),
    eta_ms: Math.round(eta_ms),
    eta_human: _humanizeMs(eta_ms),
    severity,
    at: new Date().toISOString(),
  };
}

function _humanizeMs(ms) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function _pushSeries(key, value) {
  const arr = _state.series[key];
  arr.push({ t: Date.now(), y: value });
  if (arr.length > WINDOW_SIZE) arr.shift();
}

function _rotateErrorBucket() {
  const now = Date.now();
  const elapsed = now - _state.errorBucket.startMs;
  if (elapsed >= 60_000) {
    const ratePerMin = (_state.errorBucket.count * 60_000) / elapsed;
    _pushSeries('errorRatePerMin', ratePerMin);
    _state.errorBucket = { startMs: now, count: 0 };
  }
}

async function _sample() {
  try {
    _rotateErrorBucket();

    const lag = await _measureEventLoopLag();
    const heap = v8.getHeapStatistics();
    const heapUsedPct = (heap.used_heap_size / heap.heap_size_limit) * 100;
    const rssMB = process.memoryUsage().rss / 1024 / 1024;

    _pushSeries('eventLoopLagMs', lag);
    _pushSeries('heapUsedPct', heapUsedPct);
    _pushSeries('rssMB', rssMB);

    const fresh = [];
    for (const key of Object.keys(_state.series)) {
      const pred = _forecastBreach(key, _state.series[key]);
      if (pred) fresh.push(pred);
    }

    _state.predictions = fresh;
    for (const p of fresh) {
      _state.warnings.push(p);
      _bus.emit('prediction', p);
    }
    if (_state.warnings.length > 100) _state.warnings.splice(0, _state.warnings.length - 100);

    _state.health = fresh.some(p => p.severity === 'critical') ? 'critical'
                  : fresh.some(p => p.severity === 'high')     ? 'at_risk'
                  : fresh.length                                ? 'watch'
                  : 'good';
    _state.lastRun = new Date().toISOString();
  } catch (err) {
    _state.health = 'error';
    _state.lastError = err.message;
  }
}

function observe(eventType /* 'error' | 'request' | ... */) {
  if (eventType === 'error') _state.errorBucket.count += 1;
}

function init() {
  if (_state.timer) return;
  _state.startedAt = new Date().toISOString();
  _sample().catch(() => {});
  _state.timer = setInterval(() => { _sample().catch(() => {}); }, SAMPLE_INTERVAL_MS);
  if (typeof _state.timer.unref === 'function') _state.timer.unref();
  console.log('🦄 Predictive Healing Engine activat (real linear-regression forecasting).');
}

function stop() {
  if (_state.timer) { clearInterval(_state.timer); _state.timer = null; }
}

async function process(input = {}) {
  _state.processCount++;
  if (input && input.observe) observe(input.observe);
  if (input && input.forceSample) await _sample();
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
    processCount: _state.processCount,
    health: _state.health,
    predictions: _state.predictions,
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
    activePredictions: _state.predictions.length,
    seriesPoints: Object.fromEntries(
      Object.entries(_state.series).map(([k, v]) => [k, v.length])
    ),
    warningsTotal: _state.warnings.length,
    nextPrediction: _state.predictions[0] || null,
  };
}

function getPredictions() { return _state.predictions; }
function on(event, listener) { _bus.on(event, listener); return () => _bus.off(event, listener); }

init();

module.exports = { process, getStatus, getPredictions, observe, init, stop, on, name: 'predictive-healing' };
