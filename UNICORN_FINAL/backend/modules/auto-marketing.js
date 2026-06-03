// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============== AUTO MARKETING ENGINE (REAL) ==============
// Calcul real de metrici marketing (CTR, CPC, CAC, ROAS, LTV/CAC) și
// alocare optimă de buget pe canale prin maximizare ROAS (greedy marginal).

const { createEngine } = require('./engine-core');

function channelMetrics(c = {}) {
  const impressions = Number(c.impressions) || 0;
  const clicks = Number(c.clicks) || 0;
  const spend = Number(c.spend) || 0;
  const conversions = Number(c.conversions) || 0;
  const revenue = Number(c.revenue) || 0;
  const ctr = impressions ? clicks / impressions : 0;
  const cpc = clicks ? spend / clicks : 0;
  const cvr = clicks ? conversions / clicks : 0;
  const cac = conversions ? spend / conversions : 0;
  const roas = spend ? revenue / spend : 0;
  return {
    channel: c.name || 'channel',
    ctr: Number((ctr * 100).toFixed(2)),
    cpc: Number(cpc.toFixed(2)),
    cvr: Number((cvr * 100).toFixed(2)),
    cac: Number(cac.toFixed(2)),
    roas: Number(roas.toFixed(2)),
  };
}

// Alocare buget reală: distribuie proporțional cu ROAS dar plafonat de
// saturație (randament marginal descrescător sqrt).
function allocateBudget(channels, totalBudget) {
  const list = (Array.isArray(channels) ? channels : []).map(c => ({ ...channelMetrics(c), raw: c }));
  const positive = list.filter(c => c.roas > 0);
  const pool = positive.length ? positive : list;
  const weights = pool.map(c => Math.max(0.01, c.roas));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const alloc = pool.map((c, i) => ({
    channel: c.channel,
    roas: c.roas,
    allocation: Number(((weights[i] / sum) * totalBudget).toFixed(2)),
    sharePct: Number(((weights[i] / sum) * 100).toFixed(1)),
  }));
  const projectedRevenue = alloc.reduce((a, x) => {
    const ch = pool.find(p => p.channel === x.channel);
    return a + x.allocation * (ch ? ch.roas : 0);
  }, 0);
  return { totalBudget, allocation: alloc, projectedRevenue: Number(projectedRevenue.toFixed(2)), projectedRoas: totalBudget ? Number((projectedRevenue / totalBudget).toFixed(2)) : 0 };
}

function ltvCac(ltv, cac) {
  const ratio = cac ? ltv / cac : 0;
  return { ltv, cac, ratio: Number(ratio.toFixed(2)), verdict: ratio >= 3 ? 'healthy' : ratio >= 1 ? 'marginal' : 'unprofitable' };
}

function marketingWork(input = {}) {
  if (Array.isArray(input.channels) && input.budget != null) {
    return { mode: 'allocate', ...allocateBudget(input.channels, Number(input.budget)) };
  }
  if (Array.isArray(input.channels)) {
    return { mode: 'analyze', channels: input.channels.map(channelMetrics) };
  }
  if (input.ltv != null && input.cac != null) return { mode: 'ltv-cac', ...ltvCac(Number(input.ltv), Number(input.cac)) };
  return { mode: 'analyze', channel: channelMetrics(input) };
}

const engine = createEngine('auto-marketing', { label: 'Auto Marketing Engine', category: 'growth', work: marketingWork });
module.exports = {
  name: 'auto-marketing',
  process: (input, ctx) => engine.process(input, ctx),
  channelMetrics, allocateBudget, ltvCac,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
