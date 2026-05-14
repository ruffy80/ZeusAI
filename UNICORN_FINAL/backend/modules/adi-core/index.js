// ADI-Core Main Entry — REAL self-discovering AI integration core
// Discovers → Evaluates → Integrates (persisted) → Routes → Self-improves
const discovery   = require('./discovery');
const evaluator   = require('./evaluator');
const registry    = require('./registry');
const adapterGen  = require('./adapter-gen');
const router      = require('./router');
const selfImprove = require('./self-improve');

const adiState = {
  startedAt: Date.now(),
  lastRunAt: 0,
  lastRunMs: 0,
  runs: 0,
  errors: 0,
  discovered: [],
  evaluated: [],
  integrated: [],
  routes: {},
  lastImprovement: null,
};

async function runADI() {
  const t0 = Date.now();
  try {
    adiState.discovered = await discovery.discover();
    adiState.evaluated  = await evaluator.evaluate(adiState.discovered);
    adiState.integrated = await registry.integrate(adiState.evaluated);
    adiState.routes     = await router.updateRoutes(adiState.integrated);
    adiState.lastImprovement = await selfImprove.improve();
    adiState.runs++;
    adiState.lastRunAt = Date.now();
    adiState.lastRunMs = adiState.lastRunAt - t0;
    return { ok: true, durationMs: adiState.lastRunMs, integrated: adiState.integrated.length, tags: Object.keys(adiState.routes).length };
  } catch (e) {
    adiState.errors++;
    return { ok: false, error: String(e && e.message || e) };
  }
}

function getStatus() {
  return {
    ok: true,
    startedAt: adiState.startedAt,
    lastRunAt: adiState.lastRunAt,
    lastRunMs: adiState.lastRunMs,
    runs: adiState.runs,
    errors: adiState.errors,
    discoveredCount: adiState.discovered.length,
    integratedCount: adiState.integrated.length,
    tags: Object.keys(adiState.routes),
    routes: adiState.routes,
    lastImprovement: adiState.lastImprovement,
    integrated: adiState.integrated.map(m => ({
      id: m.id, type: m.type, score: m.score, latencyMs: m.latencyMs, lastSeen: m.lastSeen
    })),
  };
}

async function call(tag, prompt, opts) { return router.call(tag, prompt, opts); }

module.exports = { runADI, getStatus, call, adiState, discovery, evaluator, registry, adapterGen, router, selfImprove };
