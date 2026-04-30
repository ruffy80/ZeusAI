// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-30T15:05:08.469Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/*
 * adaptiveEnginePool
 * ------------------
 * Lazy materialization of the AdaptivePool#NN + EnginePool#N logical workers
 * declared in MODULE_REGISTRY. Each entry is a tiny stateful object holding
 * its execution counters; nothing is started, nothing schedules intervals.
 *
 * Pool de motoare adaptive — materializare lazy. Aditiv. Niciun interval.
 */

const ADAPTIVE_COUNT = parseInt(process.env.UNICORN_ADAPTIVE_COUNT || '82', 10);
const ENGINE_COUNT   = parseInt(process.env.UNICORN_ENGINE_COUNT   || '62', 10);

const _adaptive = [];
const _engines  = [];

for (let i = 1; i <= ADAPTIVE_COUNT; i++) {
  _adaptive.push({ id: 'AdaptivePool#' + String(i).padStart(2, '0'), kind: 'adaptive', state: 'idle', invocations: 0 });
}
for (let i = 1; i <= ENGINE_COUNT; i++) {
  _engines.push({ id: 'EnginePool#' + i, kind: 'engine', state: 'idle', invocations: 0 });
}

function listSummary() {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    adaptive: { count: _adaptive.length, idle: _adaptive.filter((w) => w.state === 'idle').length },
    engines:  { count: _engines.length,  idle: _engines.filter((w) => w.state === 'idle').length },
    total: _adaptive.length + _engines.length,
  };
}

function listWorkers(kind) {
  if (kind === 'adaptive') return _adaptive.map((w) => ({ ...w }));
  if (kind === 'engine')   return _engines.map((w) => ({ ...w }));
  return [..._adaptive, ..._engines].map((w) => ({ ...w }));
}

function invoke(id) {
  const w = [..._adaptive, ..._engines].find((x) => x.id === id);
  if (!w) return { ok: false, error: 'unknown worker' };
  w.invocations += 1;
  return { ok: true, worker: { ...w } };
}

function getStatus() {
  return { ok: true, name: 'adaptiveEnginePool', adaptive: _adaptive.length, engines: _engines.length };
}

module.exports = { listSummary, listWorkers, invoke, getStatus };
