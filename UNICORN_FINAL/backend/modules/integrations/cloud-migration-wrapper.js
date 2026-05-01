// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

/**
 * CLOUD MIGRATION WRAPPER (complementary)
 *
 * Sits ABOVE the existing aws-auto-healer / gcp-cost-optimizer / azure
 * enterprise modules. Provides a single decision API that picks the
 * cheapest healthy provider for a given workload. Does NOT modify any
 * provider module — only reads their public status / pricing hints.
 */

const PROVIDERS = ['aws', 'gcp', 'azure'];

const _state = {
  name: 'cloud-migration-wrapper',
  startedAt: null,
  lastDecision: null,
  decisions: [],
};

// Heuristic per-provider cost factors (tunable via env). Used as last-resort
// when live pricing modules are unavailable.
const COST_FACTORS = {
  aws:   parseFloat(process.env.CLOUD_FACTOR_AWS   || '1.00'),
  gcp:   parseFloat(process.env.CLOUD_FACTOR_GCP   || '0.92'),
  azure: parseFloat(process.env.CLOUD_FACTOR_AZURE || '0.97'),
};

function _safeProviderCost(name, workload) {
  // Try to consult the provider's existing optimizer module if loaded.
  try {
    if (name === 'aws') {
      const m = require('../aws-auto-healer');
      if (m && typeof m.estimateCost === 'function') return m.estimateCost(workload);
    } else if (name === 'gcp') {
      const m = require('../gcp-cost-optimizer');
      if (m && typeof m.estimateCost === 'function') return m.estimateCost(workload);
    } else if (name === 'azure') {
      const m = require('../azure-cost-optimizer');
      if (m && typeof m.estimateCost === 'function') return m.estimateCost(workload);
    }
  } catch (_) { /* module may not exist; fall through */ }
  // Fallback heuristic
  const baseCpuCost = 0.05; // USD per vCPU-hour
  const cpu = (workload && workload.cpu) || 1;
  const hours = (workload && workload.hours) || 1;
  return Number((baseCpuCost * cpu * hours * COST_FACTORS[name]).toFixed(4));
}

function pickProvider(workload = {}) {
  const candidates = PROVIDERS.map(name => ({
    name,
    estimatedCostUSD: _safeProviderCost(name, workload),
  }));
  candidates.sort((a, b) => a.estimatedCostUSD - b.estimatedCostUSD);
  const decision = {
    at: new Date().toISOString(),
    workload,
    chosen: candidates[0],
    candidates,
  };
  _state.lastDecision = decision;
  _state.decisions.unshift(decision);
  if (_state.decisions.length > 100) _state.decisions.length = 100;
  return decision;
}

function init({ app } = {}) {
  if (_state.startedAt) return;
  _state.startedAt = new Date().toISOString();
  if (app && typeof app.post === 'function') {
    app.post('/api/cloud/migrate/recommend', (req, res) => {
      res.json({ ok: true, decision: pickProvider(req.body || {}) });
    });
    app.get('/api/cloud/migrate/state', (_req, res) => {
      res.json({ ok: true, state: _state });
    });
  }
}

function getStatus() {
  return { name: _state.name, startedAt: _state.startedAt, decisions: _state.decisions.length };
}

module.exports = { name: 'cloud-migration-wrapper', init, getStatus, pickProvider };
