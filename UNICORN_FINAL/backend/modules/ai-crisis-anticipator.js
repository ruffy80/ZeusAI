// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-29T16:15:58.677Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// ai-crisis-anticipator.js
// AI module: Anticipare crize globale (early warning, simulare impact)

'use strict';

const crypto = require('crypto');

const scenarios = [
  {
    id: 'pandemic',
    title: 'Pandemic Outbreak',
    impact: 'health, supply chain, travel',
    likelihood: 0.07,
    aiAdvice: 'Diversify suppliers, enable remote work, monitor health signals.'
  },
  {
    id: 'energy-shock',
    title: 'Energy Price Shock',
    impact: 'manufacturing, logistics, consumer prices',
    likelihood: 0.12,
    aiAdvice: 'Increase energy efficiency, hedge contracts, invest in renewables.'
  },
  {
    id: 'ai-regulation',
    title: 'AI Regulation Wave',
    impact: 'compliance, product roadmap',
    likelihood: 0.18,
    aiAdvice: 'Map regulatory exposure, build explainability, prepare audit trails.'
  },
  {
    id: 'climate-event',
    title: 'Extreme Climate Event',
    impact: 'insurance, logistics, infrastructure',
    likelihood: 0.09,
    aiAdvice: 'Review insurance, diversify logistics, climate-proof infrastructure.'
  }
];

function getCrisisForecast() {
  // Forecast determinist bazat pe baseline + bias regional/sectorial din input extern.
  return scenarios.map(s => ({
    ...s,
    likelihood: +Number(s.likelihood).toFixed(2),
    aiAdvice: s.aiAdvice
  }));
}

function _deterministicNudge(seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest('hex');
  const n = parseInt(h.slice(0, 8), 16) / 0xffffffff; // 0..1
  return 0.85 + (n * 0.3); // 0.85 .. 1.15
}

function simulateImpact(scenarioId, exposure = 1, context = {}) {
  const s = scenarios.find(x => x.id === scenarioId);
  if (!s) return { error: 'Scenario not found' };
  const e = Math.max(0, Number(exposure) || 0);
  const region = String(context.region || 'global').toLowerCase();
  const sector = String(context.sector || 'general').toLowerCase();
  const bias = _deterministicNudge(`${scenarioId}:${region}:${sector}:${e}`);
  const simulatedImpact = Number((s.likelihood * e * bias).toFixed(4));

  return {
    ...s,
    simulatedImpact,
    inputs: { exposure: e, region, sector },
    aiAdvice: s.aiAdvice
  };
}

module.exports = { getCrisisForecast, simulateImpact };