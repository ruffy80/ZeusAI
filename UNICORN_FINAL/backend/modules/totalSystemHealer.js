'use strict';
const adapter = require('./supreme-self-healer-adapter');
function wrap(fn, fallback) {
  return typeof fn === 'function' ? fn.bind(adapter) : fallback;
}
const api = {
  start: wrap(adapter.start, () => ({ ok: true, started: true })),
  getStatus: wrap(adapter.getStatus, () => ({ ok: true, module: 'totalSystemHealer' })),
  heal: wrap(adapter.heal, () => ({ ok: true })),
  scanAndHeal: wrap(adapter.scanAndHeal, () => (typeof adapter.heal === 'function' ? adapter.heal() : { ok: true, action: 'scanAndHeal' })),
  checkModuleHealth: wrap(adapter.checkModuleHealth, (name) => ({ ok: true, module: name || 'unknown', health: 'observed' })),
  repairModule: wrap(adapter.repairModule, (name) => ({ ok: true, module: name || 'unknown', repaired: false, note: 'external_healer_owns_restart' })),
  analyzeLogs: wrap(adapter.analyzeLogs, () => ({ ok: true, lines: 0 })),
};
module.exports = new Proxy(api, {
  get(target, prop, receiver) {
    if (prop in target) return Reflect.get(target, prop, receiver);
    const v = adapter[prop];
    return typeof v === 'function' ? v.bind(adapter) : v;
  },
});
