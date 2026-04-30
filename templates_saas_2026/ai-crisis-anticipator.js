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
  // Simulează scoruri dinamice
  return scenarios.map(s => ({
    ...s,
    likelihood: +(s.likelihood + (Math.random() - 0.5) * 0.05).toFixed(2),
    aiAdvice: s.aiAdvice
  }));
}

function simulateImpact(scenarioId, exposure = 1) {
  const s = scenarios.find(x => x.id === scenarioId);
  if (!s) return { error: 'Scenario not found' };
  // Exemplu: scor de impact ajustat
  return {
    ...s,
    simulatedImpact: +(s.likelihood * exposure * (0.8 + Math.random() * 0.4)).toFixed(2),
    aiAdvice: s.aiAdvice
  };
}

module.exports = { getCrisisForecast, simulateImpact };