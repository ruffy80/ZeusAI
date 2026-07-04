// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ========= AUTONOMOUS BUSINESS-DEVELOPMENT ENGINE (REAL) =========
// Lead scoring real (model ponderat de features), segmentare pe tier,
// valoare pipeline ponderată cu probabilitate, și forecast conversie.

const { createEngine } = require('./engine-core');

// Greutăți reale per feature (BANT + engagement).
const WEIGHTS = {
  budget: 0.25, authority: 0.15, need: 0.20, timing: 0.10,
  engagement: 0.15, fit: 0.15,
};

function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

function scoreLead(lead = {}) {
  let score = 0, used = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    if (lead[k] != null) { score += clamp01(lead[k]) * w; used += w; }
  }
  const normalized = used ? score / used : 0;
  const pct = Math.round(normalized * 100);
  const tier = pct >= 75 ? 'A-hot' : pct >= 50 ? 'B-warm' : pct >= 25 ? 'C-nurture' : 'D-cold';
  const winProbability = Number((1 / (1 + Math.exp(-(normalized - 0.5) * 6))).toFixed(4)); // logistic real
  return { score: pct, tier, winProbability, nextAction: pct >= 75 ? 'book-demo' : pct >= 50 ? 'send-proposal' : 'educate' };
}

// Valoare pipeline ponderată: suma deal_value * probabilitate.
function pipeline(leads) {
  const list = Array.isArray(leads) ? leads : [];
  const scored = list.map(l => ({ ...scoreLead(l), dealValue: Number(l.dealValue) || 0 }));
  const weighted = scored.reduce((a, s) => a + s.dealValue * s.winProbability, 0);
  const raw = scored.reduce((a, s) => a + s.dealValue, 0);
  const byTier = {};
  for (const s of scored) byTier[s.tier] = (byTier[s.tier] || 0) + 1;
  return {
    leads: list.length,
    rawPipeline: Number(raw.toFixed(2)),
    weightedPipeline: Number(weighted.toFixed(2)),
    expectedConversionRate: list.length ? Number((scored.reduce((a, s) => a + s.winProbability, 0) / list.length).toFixed(4)) : 0,
    tierDistribution: byTier,
    hotLeads: scored.filter(s => s.tier === 'A-hot').length,
  };
}

function bdWork(input = {}) {
  if (Array.isArray(input.leads)) return { mode: 'pipeline', ...pipeline(input.leads) };
  if (input.lead) return { mode: 'score', ...scoreLead(input.lead) };
  return { mode: 'score', ...scoreLead(input) };
}

const engine = createEngine('autonomous-bd-engine', { label: 'Autonomous BD Engine', category: 'growth', work: bdWork });
module.exports = {
  name: 'autonomous-bd-engine',
  process: (input, ctx) => engine.process(input, ctx),
  scoreLead, pipeline, WEIGHTS,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
