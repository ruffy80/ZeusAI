// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============== SWARM INTELLIGENCE ENGINE (REAL) ==============
// Particle Swarm Optimization real (PSO) + consens cuantificat de roi.
// Minimizează o funcție obiectiv (distanță față de target) și agregă
// voturi ponderate ale agenților în decizie cu convergență măsurată.

const { createEngine } = require('./engine-core');

// PSO real pe vector: minimizează suma (x_i - target_i)^2 + penalizare.
function pso(target, opts = {}) {
  const dim = target.length;
  const particles = Math.max(8, opts.particles || 24);
  const iters = Math.max(10, opts.iterations || 60);
  const w = 0.72, c1 = 1.49, c2 = 1.49;
  const lo = opts.min ?? -10, hi = opts.max ?? 10;
  // RNG deterministic (mulberry32) pentru rezultate reproductibile
  let seed = (opts.seed ?? 1234567) >>> 0;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const cost = (x) => x.reduce((a, v, i) => a + (v - target[i]) ** 2, 0);
  const swarm = [];
  let gbest = null, gbestCost = Infinity;
  for (let p = 0; p < particles; p++) {
    const pos = Array.from({ length: dim }, () => lo + rnd() * (hi - lo));
    const vel = Array.from({ length: dim }, () => (rnd() - 0.5));
    const c = cost(pos);
    const part = { pos, vel, best: [...pos], bestCost: c };
    if (c < gbestCost) { gbestCost = c; gbest = [...pos]; }
    swarm.push(part);
  }
  let convergedAt = iters;
  for (let it = 0; it < iters; it++) {
    let improved = false;
    for (const part of swarm) {
      for (let d = 0; d < dim; d++) {
        part.vel[d] = w * part.vel[d] + c1 * rnd() * (part.best[d] - part.pos[d]) + c2 * rnd() * (gbest[d] - part.pos[d]);
        part.pos[d] = Math.max(lo, Math.min(hi, part.pos[d] + part.vel[d]));
      }
      const c = cost(part.pos);
      if (c < part.bestCost) { part.bestCost = c; part.best = [...part.pos]; }
      if (c < gbestCost) { gbestCost = c; gbest = [...part.pos]; improved = true; }
    }
    if (improved && gbestCost < 1e-6 && convergedAt === iters) convergedAt = it;
  }
  return { solution: gbest.map(v => Number(v.toFixed(4))), cost: Number(gbestCost.toFixed(6)), iterations: iters, convergedAt };
}

// Consens ponderat real: agenți cu (vote, weight, confidence).
function consensus(agents) {
  const list = (Array.isArray(agents) ? agents : []).filter(a => a && a.vote != null);
  if (!list.length) return { decision: null, agreement: 0, quorum: false };
  const tally = {};
  let totalW = 0;
  for (const a of list) {
    const w = (Number(a.weight) || 1) * (Number(a.confidence) || 1);
    tally[a.vote] = (tally[a.vote] || 0) + w;
    totalW += w;
  }
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const [decision, score] = ranked[0];
  const agreement = totalW ? score / totalW : 0;
  return {
    decision,
    agreement: Number(agreement.toFixed(4)),
    quorum: agreement >= 0.5,
    distribution: Object.fromEntries(ranked.map(([k, v]) => [k, Number((v / totalW).toFixed(4))])),
    agents: list.length,
  };
}

function swarmWork(input = {}) {
  if (Array.isArray(input.agents)) return { mode: 'consensus', ...consensus(input.agents) };
  if (Array.isArray(input.target)) return { mode: 'optimize', ...pso(input.target.map(Number), input) };
  // implicit: optimizează spre originea unui vector aleator stabil
  return { mode: 'optimize', ...pso([0, 0, 0], input) };
}

const engine = createEngine('swarm-intelligence', { label: 'Swarm Intelligence', category: 'intelligence', work: swarmWork });
module.exports = {
  name: 'swarm-intelligence',
  process: (input, ctx) => engine.process(input, ctx),
  pso, consensus,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
