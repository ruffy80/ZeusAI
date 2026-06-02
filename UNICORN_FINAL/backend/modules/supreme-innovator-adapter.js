// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-02T15:34:49.617Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// Adapter real (fără no-op) între vechile API-uri de innovation și unicornInnovator.
const core = require('./unicornInnovator');

function metricsFromStatus(status) {
  const generated = Number(status.generated ?? status.totalInnovationsGenerated ?? 0);
  const deployed = Number(status.approved ?? status.totalFeaturesDeployed ?? 0);
  const rejected = Number(status.rejected ?? 0);
  const cycles = Number(status.cycles ?? status.totalCycles ?? 0);
  const deploymentSuccessRate = generated > 0 ? Number(((deployed / generated) * 100).toFixed(2)) : 0;
  return {
    totalInnovationsGenerated: generated,
    totalFeaturesDeployed: deployed,
    totalRejected: rejected,
    totalCycles: cycles,
    deploymentSuccessRate,
  };
}

function triggerInnovation() {
  if (typeof core.autonomousInnovator === 'function') return core.autonomousInnovator();
  if (typeof core.innovationGenerator === 'function') return core.innovationGenerator();
  throw new Error('unicornInnovator has no trigger method');
}

const adapter = {
  // Canonical
  getStatus: () => (typeof core.getStatus === 'function' ? core.getStatus() : {}),
  getHistory: (limit = 50) => (typeof core.getHistory === 'function' ? core.getHistory(limit) : []),
  getPending: () => (typeof core.getPending === 'function' ? core.getPending() : []),
  approve: (id) => core.approve(id),
  reject: (id) => core.reject(id),
  getBus: () => (typeof core.getBus === 'function' ? core.getBus() : null),

  // Legacy compatibility aliases (real behavior)
  getInnovationHistory: (limit = 20) => (typeof core.getHistory === 'function' ? core.getHistory(limit) : []),
  getDeploymentMetrics: () => metricsFromStatus(typeof core.getStatus === 'function' ? core.getStatus() : {}),
  generateNewInnovation: () => triggerInnovation(),
  selfOptimize: () => triggerInnovation(),
  triggerCycle: () => triggerInnovation(),
  start: () => ({ ok: true, active: true, status: typeof core.getStatus === 'function' ? core.getStatus() : {} }),
  run: () => triggerInnovation(),
};

module.exports = new Proxy(adapter, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (core && prop in core) return core[prop];
    if (typeof prop === 'string') {
      return function unsupported() {
        return { ok: false, error: 'unsupported_method', method: prop, adapter: 'supreme-innovator-adapter' };
      };
    }
    return undefined;
  }
});
