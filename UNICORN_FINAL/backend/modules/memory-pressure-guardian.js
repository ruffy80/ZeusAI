'use strict';

const EventEmitter = require('events');

const NAME = 'memory-pressure-guardian';
const CHECK_INTERVAL_MS = 60_000;

const clearers = new Map();
const bus = new EventEmitter();

const state = {
  startedAt: null,
  checks: 0,
  pressureEvents: 0,
  gcRuns: 0,
  cacheClears: 0,
  lastStatus: null,
  recentActions: [],
};

let intervalRef = null;
let memorySampler = () => process.memoryUsage();

function softLimitMb() {
  return Math.max(64, Number(process.env.MEMORY_SOFT_LIMIT_MB || 1200));
}

function noteAction(action) {
  state.recentActions.unshift(action);
  state.recentActions = state.recentActions.slice(0, 20);
}

function registerCacheClearer(name, fn) {
  if (!name || typeof fn !== 'function') return { ok: false, error: 'name_and_function_required' };
  clearers.set(String(name), fn);
  return { ok: true, registered: clearers.size };
}

function runClearers() {
  const results = [];
  for (const [name, clearer] of clearers.entries()) {
    try {
      const result = clearer();
      state.cacheClears += 1;
      results.push({ name, ok: true, result: result && typeof result === 'object' ? result : null });
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
    }
  }
  return results;
}

function check() {
  const usage = memorySampler() || {};
  const heapUsedMb = Number(((Number(usage.heapUsed || 0)) / (1024 * 1024)).toFixed(2));
  const heapTotalMb = Number(((Number(usage.heapTotal || 0)) / (1024 * 1024)).toFixed(2));
  const rssMb = Number(((Number(usage.rss || 0)) / (1024 * 1024)).toFixed(2));
  const limitMb = softLimitMb();
  const overLimit = heapUsedMb > limitMb;
  const status = {
    module: NAME,
    checkedAt: new Date().toISOString(),
    heapUsedMB: heapUsedMb,
    heapTotalMB: heapTotalMb,
    rssMB: rssMb,
    limitMB: limitMb,
    overLimit,
    gcTriggered: false,
    clearersRun: [],
  };

  state.checks += 1;
  if (overLimit) {
    state.pressureEvents += 1;
    if (typeof global.gc === 'function') {
      global.gc();
      state.gcRuns += 1;
      status.gcTriggered = true;
    }
    status.clearersRun = runClearers();
    noteAction({
      at: status.checkedAt,
      heapUsedMB: heapUsedMb,
      limitMB: limitMb,
      gcTriggered: status.gcTriggered,
      clearerCount: status.clearersRun.length,
    });
    bus.emit('pressure', status);
  }
  bus.emit('status', status);
  state.lastStatus = status;
  return status;
}

function start() {
  if (intervalRef) return { ok: true, alreadyRunning: true };
  state.startedAt = new Date().toISOString();
  intervalRef = setInterval(() => {
    try { check(); } catch (_) {}
  }, CHECK_INTERVAL_MS);
  if (intervalRef.unref) intervalRef.unref();
  return { ok: true, intervalMs: CHECK_INTERVAL_MS };
}

function stop() {
  if (intervalRef) clearInterval(intervalRef);
  intervalRef = null;
  return { ok: true };
}

function getStatus() {
  return {
    module: NAME,
    running: !!intervalRef,
    startedAt: state.startedAt,
    checks: state.checks,
    pressureEvents: state.pressureEvents,
    gcRuns: state.gcRuns,
    cacheClears: state.cacheClears,
    limitMB: softLimitMb(),
    registeredClearers: Array.from(clearers.keys()),
    lastStatus: state.lastStatus,
    recentActions: state.recentActions,
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  if (action === 'check') return { ok: true, action, status: check() };
  if (action === 'start') return start();
  if (action === 'stop') return stop();
  return { ok: true, action: 'status', status: getStatus() };
}

function _setMemorySampler(fn) {
  memorySampler = typeof fn === 'function' ? fn : (() => process.memoryUsage());
}

function _resetForTests() {
  stop();
  clearers.clear();
  state.startedAt = null;
  state.checks = 0;
  state.pressureEvents = 0;
  state.gcRuns = 0;
  state.cacheClears = 0;
  state.lastStatus = null;
  state.recentActions = [];
  memorySampler = () => process.memoryUsage();
}

module.exports = {
  name: NAME,
  events: bus,
  registerCacheClearer,
  registerTrimmer: registerCacheClearer,
  check,
  start,
  stop,
  getStatus,
  process: processInput,
  _setMemorySampler,
  _resetForTests,
};
