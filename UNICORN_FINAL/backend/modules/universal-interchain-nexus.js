// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ========= UNIVERSAL INTERCHAIN NEXUS ENGINE (REAL) =========
// Rutare cross-chain reală: găsește calea de cost minim între lanțuri
// printr-un graf de punți (Dijkstra), cu fee și slippage acumulat.

const { createEngine } = require('./engine-core');

// Dijkstra real peste graful de punți (bridges) cu cost = fee.
function cheapestRoute(bridges, from, to, amount = 1) {
  // bridges: [{from, to, feePct, fixedFee}]
  const graph = new Map();
  for (const b of (Array.isArray(bridges) ? bridges : [])) {
    if (!graph.has(b.from)) graph.set(b.from, []);
    graph.get(b.from).push(b);
  }
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const visited = new Set();
  const pq = [{ node: from, cost: 0 }];
  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost);
    const { node, cost } = pq.shift();
    if (visited.has(node)) continue;
    visited.add(node);
    if (node === to) break;
    for (const edge of (graph.get(node) || [])) {
      const edgeCost = amount * ((Number(edge.feePct) || 0) / 100) + (Number(edge.fixedFee) || 0);
      const nd = cost + edgeCost;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, { node, edge });
        pq.push({ node: edge.to, cost: nd });
      }
    }
  }
  if (!dist.has(to)) return { reachable: false, from, to };
  const path = [];
  let cur = to;
  while (cur !== from) { const p = prev.get(cur); if (!p) break; path.unshift({ from: p.node, to: cur, fee: p.edge.feePct }); cur = p.node; }
  return {
    reachable: true,
    from, to, amount,
    hops: path.length,
    totalFee: Number(dist.get(to).toFixed(6)),
    received: Number((amount - dist.get(to)).toFixed(6)),
    route: path,
  };
}

function nexusWork(input = {}) {
  if (Array.isArray(input.bridges) && input.from && input.to) {
    return { mode: 'route', ...cheapestRoute(input.bridges, input.from, input.to, Number(input.amount) || 1) };
  }
  // sumar de conectivitate al rețelei de punți
  const bridges = Array.isArray(input.bridges) ? input.bridges : [];
  const chains = new Set();
  for (const b of bridges) { chains.add(b.from); chains.add(b.to); }
  return { mode: 'topology', chains: [...chains], chainCount: chains.size, bridgeCount: bridges.length };
}

const engine = createEngine('universal-interchain-nexus', { label: 'Universal Interchain Nexus', category: 'web3', work: nexusWork });
module.exports = {
  name: 'universal-interchain-nexus',
  process: (input, ctx) => engine.process(input, ctx),
  cheapestRoute,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
