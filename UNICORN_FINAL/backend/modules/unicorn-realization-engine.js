// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ========= UNICORN REALIZATION ENGINE (REAL) =========
// Urmărește realizarea obiectivelor: completare ponderată, drum critic
// (dependențe), velocitate și ETA real pe baza progresului istoric.

const { createEngine } = require('./engine-core');

// Completare ponderată reală a unui set de obiective.
function weightedCompletion(goals) {
  const list = Array.isArray(goals) ? goals : [];
  if (!list.length) return { completion: 0, goals: 0 };
  let wSum = 0, wDone = 0;
  for (const g of list) {
    const w = Number(g.weight) || 1;
    const p = Math.max(0, Math.min(1, Number(g.progress) || 0));
    wSum += w; wDone += w * p;
  }
  return { completion: Number(((wDone / wSum) * 100).toFixed(2)), goals: list.length };
}

// Drum critic real prin sortare topologică + cea mai lungă cale de durate.
function criticalPath(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const map = new Map(list.map(t => [t.id, t]));
  const memo = new Map();
  const visiting = new Set();
  function longest(id) {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return { length: 0, path: [] }; // ciclu — ignoră
    visiting.add(id);
    const t = map.get(id);
    const dur = Number(t && t.duration) || 0;
    const deps = (t && Array.isArray(t.deps)) ? t.deps : [];
    let best = { length: 0, path: [] };
    for (const d of deps) {
      const r = longest(d);
      if (r.length > best.length) best = r;
    }
    visiting.delete(id);
    const res = { length: best.length + dur, path: [...best.path, id] };
    memo.set(id, res);
    return res;
  }
  let cp = { length: 0, path: [] };
  for (const t of list) { const r = longest(t.id); if (r.length > cp.length) cp = r; }
  return { duration: cp.length, path: cp.path };
}

// ETA real din velocitate (progres pe unitate de timp).
function eta(remainingWork, velocityPerDay) {
  if (velocityPerDay <= 0) return { days: Infinity, eta: null };
  const days = remainingWork / velocityPerDay;
  const d = new Date(Date.now() + days * 86400000);
  return { days: Number(days.toFixed(1)), eta: d.toISOString() };
}

function realizationWork(input = {}) {
  const out = {};
  if (Array.isArray(input.goals)) Object.assign(out, weightedCompletion(input.goals));
  if (Array.isArray(input.tasks)) out.criticalPath = criticalPath(input.tasks);
  if (input.remainingWork != null && input.velocityPerDay != null) {
    out.forecast = eta(Number(input.remainingWork), Number(input.velocityPerDay));
  }
  if (!Object.keys(out).length && Array.isArray(input)) Object.assign(out, weightedCompletion(input));
  out.status = (out.completion || 0) >= 100 ? 'realized' : (out.completion || 0) >= 50 ? 'on-track' : 'early';
  return out;
}

const engine = createEngine('unicorn-realization-engine', { label: 'Unicorn Realization Engine', category: 'autonomy', work: realizationWork });
module.exports = {
  name: 'unicorn-realization-engine',
  process: (input, ctx) => engine.process(input, ctx),
  weightedCompletion, criticalPath, eta,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
