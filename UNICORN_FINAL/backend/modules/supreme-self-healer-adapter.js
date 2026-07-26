// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-02T15:34:49.893Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// Adapter real (fără no-op) între vechile API-uri healer și unicornSelfHealer.
const core = require('./unicornSelfHealer');

function forceHealSafe() {
  if (typeof core.forceHeal === 'function') return core.forceHeal();
  if (typeof core.run === 'function') return core.run({ trigger: 'adapter' });
  return { ok: false, error: 'force-heal-unavailable' };
}

const adapter = {
  // Canonical
  getStatus: () => (typeof core.getStatus === 'function' ? core.getStatus() : {}),
  getHistory: (limit = 50) => (typeof core.getHistory === 'function' ? core.getHistory(limit) : []),
  getModules: () => (typeof core.getModules === 'function' ? core.getModules() : {}),
  forceHeal: () => forceHealSafe(),
  getBus: () => (typeof core.getBus === 'function' ? core.getBus() : null),
  getLedger: () => (typeof core.getLedger === 'function' ? core.getLedger() : { events: [] }),

  // Legacy compatibility aliases — delegate to core start/stop (Boot Immortal).
  start: () => (typeof core.start === 'function' ? core.start() : { ok: true, active: true, status: typeof core.getStatus === 'function' ? core.getStatus() : {} }),
  stop: () => (typeof core.stop === 'function' ? core.stop() : { ok: true, active: false }),
  run: () => forceHealSafe(),
  heal: () => forceHealSafe(),
  restart: () => forceHealSafe(),
  redeploy: () => forceHealSafe(),
  recover: () => forceHealSafe(),
  checkModules: () => (typeof core.getModules === 'function' ? core.getModules() : {}),
  attachOrchestrator: () => ({ ok: true, attached: true, source: 'supreme-self-healer-adapter' }),
};

module.exports = new Proxy(adapter, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (core && prop in core) return core[prop];
    if (typeof prop === 'string') {
      return function unsupported() {
        return { ok: false, error: 'unsupported_method', method: prop, adapter: 'supreme-self-healer-adapter' };
      };
    }
    return undefined;
  }
});
