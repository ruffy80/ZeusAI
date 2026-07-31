'use strict';

/**
 * InnovationEngine — essential-module surface.
 * Combines supreme innovator adapter (when available) + src innovation report.
 * Gated: generation stays idle under stable / without INNOVATION_GENERATE=1.
 */

const path = require('path');

let innovator = null;
try { innovator = require('./supreme-innovator-adapter'); } catch (_) { innovator = null; }

let srcEngine = null;
try { srcEngine = require(path.join(__dirname, '../../src/innovation/innovation-engine')); } catch (_) { srcEngine = null; }

const state = {
  running: false,
  startedAt: null,
  cycles: 0,
  lastInnovations: [],
  timer: null,
};

function analyzeTrends() {
  const report = srcEngine && typeof srcEngine.buildInnovationReport === 'function'
    ? srcEngine.buildInnovationReport()
    : { ideas: [], note: 'src_engine_unavailable' };
  return {
    ok: true,
    trends: (report && report.ideas) || report.innovations || [],
    report,
    at: new Date().toISOString(),
  };
}

function generateInnovations() {
  state.cycles += 1;
  if (innovator && typeof innovator.generate === 'function') {
    try {
      const out = innovator.generate();
      state.lastInnovations = Array.isArray(out) ? out.slice(0, 10) : [out];
      return { ok: true, innovations: state.lastInnovations, source: 'innovator' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  const trends = analyzeTrends();
  state.lastInnovations = (trends.trends || []).slice(0, 5);
  return {
    ok: true,
    innovations: state.lastInnovations,
    source: 'report',
    note: 'Observe/report only unless INNOVATION_GENERATE=1 arms innovator',
  };
}

function implementInnovation(innovation) {
  if (String(process.env.INNOVATION_AUTO_SHIP || '0') !== '1') {
    return {
      ok: false,
      implemented: false,
      innovation: innovation && (innovation.name || innovation.id) || null,
      note: 'implementation gated — set INNOVATION_AUTO_SHIP=1 under growth',
    };
  }
  if (innovator && typeof innovator.implement === 'function') {
    return innovator.implement(innovation);
  }
  return { ok: false, implemented: false, note: 'no_implementor' };
}

function start() {
  const profile = String(process.env.UNICORN_RUNTIME_PROFILE || '').toLowerCase();
  const stable = profile === 'stable' || profile === 'safe' || process.env.DISABLE_SELF_MUTATION === '1';
  if (innovator && typeof innovator.start === 'function') {
    try { innovator.start(); } catch (_) { /* ok */ }
  }
  state.running = true;
  state.startedAt = state.startedAt || new Date().toISOString();
  if (!stable && process.env.INNOVATION_ENGINE_CRON !== '0') {
    const SIX_H = 6 * 60 * 60 * 1000;
    if (!state.timer) {
      state.timer = setInterval(() => {
        try { generateInnovations(); } catch (_) { /* ok */ }
      }, SIX_H);
      if (state.timer.unref) state.timer.unref();
    }
  }
  return getStatus();
}

function getStatus() {
  const base = innovator && typeof innovator.getStatus === 'function' ? innovator.getStatus() : {};
  return {
    ok: true,
    module: 'innovationEngine',
    name: 'Innovation Engine',
    running: !!state.running,
    startedAt: state.startedAt,
    cycles: state.cycles,
    lastCount: state.lastInnovations.length,
    innovator: base,
    honesty: { autoShipsOnlyWhenArmed: true },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  start,
  analyzeTrends,
  generateInnovations,
  implementInnovation,
  getStatus,
  process: async (input = {}) => {
    const action = input.action || 'tick';
    if (action === 'trends') return analyzeTrends();
    if (action === 'generate') return generateInnovations();
    return getStatus();
  },
};
