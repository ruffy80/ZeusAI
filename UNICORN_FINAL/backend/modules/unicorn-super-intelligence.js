// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ========= UNICORN SUPER-INTELLIGENCE ENGINE (REAL) =========
// Agregator de decizie: combină semnale multiple ponderate într-o decizie
// cu încredere (softmax real), entropie (incertitudine) și explicație.
// Onest: este un ensemble determinist, nu un model extern.

const { createEngine } = require('./engine-core');

function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map(s => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(e => e / sum);
}

// Entropie Shannon reală → incertitudinea deciziei.
function entropy(probs) {
  return -probs.reduce((a, p) => a + (p > 0 ? p * Math.log2(p) : 0), 0);
}

// Decizie din opțiuni cu semnale ponderate.
function decide(options) {
  const list = Array.isArray(options) ? options : [];
  if (!list.length) return { decision: null, confidence: 0 };
  const scores = list.map(o => {
    const signals = o.signals || {};
    const weights = o.weights || {};
    let s = 0;
    for (const [k, v] of Object.entries(signals)) s += Number(v) * (Number(weights[k]) || 1);
    return s;
  });
  const probs = softmax(scores);
  const ranked = list.map((o, i) => ({ option: o.name || `opt${i}`, score: Number(scores[i].toFixed(4)), probability: Number(probs[i].toFixed(4)) }))
    .sort((a, b) => b.probability - a.probability);
  const H = entropy(probs);
  const maxH = Math.log2(list.length) || 1;
  return {
    decision: ranked[0].option,
    confidence: ranked[0].probability,
    uncertainty: Number((H / maxH).toFixed(4)),
    ranking: ranked,
    explanation: `Selectat '${ranked[0].option}' cu probabilitate ${(ranked[0].probability * 100).toFixed(1)}% (incertitudine ${(H / maxH * 100).toFixed(0)}%).`,
  };
}

function siWork(input = {}) {
  if (Array.isArray(input.options)) return { mode: 'decide', ...decide(input.options) };
  if (Array.isArray(input)) return { mode: 'decide', ...decide(input) };
  return { mode: 'decide', ...decide([input]) };
}

const engine = createEngine('unicorn-super-intelligence', { label: 'Unicorn Super-Intelligence', category: 'intelligence', work: siWork });
module.exports = {
  name: 'unicorn-super-intelligence',
  process: (input, ctx) => engine.process(input, ctx),
  decide, softmax, entropy,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
