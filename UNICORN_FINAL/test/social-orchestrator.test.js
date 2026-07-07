'use strict';

const assert = require('assert');
const orchestrator = require('../backend/modules/social-orchestrator/orchestrator');

orchestrator.configure({
  profitAutopilot: {
    getStatus: () => ({ ok: true, profitPotentialUsd: { low: 148000, high: 355200 } }),
  },
  pnlTimeMachine: {
    getStatus: () => ({ ok: true, baselineMonthlyRevenueUsd: 148000 }),
  },
  socialViralizer: {
    generateSocialPost: (_platform, seed) => ({ content: `promo:${seed}` }),
  },
  zacc: {
    status: () => ({ publisher: { published: 12 }, learning: { patternsLearned: 420 } }),
    publisher: { list: () => [{ id: 'p1', title: 'Post One', marginPct: 55, priceUsd: 129 }] },
  },
  subscriptionEngine: { getStatus: () => ({ ok: true, mrr: 2700, arr: 32400 }) },
});

Promise.resolve(orchestrator.process({ action: 'run-health' })).then((h) => {
  assert.equal(typeof h.ok, 'boolean');
  assert.ok(h.checks && h.checks.resources);
  return orchestrator.process({ action: 'run-decision' });
}).then((d) => {
  assert.equal(d.ok, true);
  return orchestrator.process({ action: 'run-innovation' });
}).then((i) => {
  assert.equal(i.ok, true);
  return orchestrator.process({ action: 'run-viral' });
}).then((v) => {
  assert.equal(v.ok, true);
  return orchestrator.process({ action: 'check-global-presence' });
}).then((g) => {
  assert.equal(g.ok, true);
  return orchestrator.process({ action: 'validate-feature-parity' });
}).then((p) => {
  assert.equal(typeof p.ok, 'boolean');
  return orchestrator.process({ action: 'discover-federation-peers' });
}).then((f) => {
  assert.equal(f.ok, true);
  const s = orchestrator.getStatus();
  assert.equal(s.ok, true);
  assert.ok(Array.isArray(s.modules) && s.modules.length >= 10);
  assert.ok(s.globalPresence && s.globalPresence.ok);
  assert.ok(s.featureParity && s.featureParity.ok);
  assert.ok(s.federation && s.federation.ok);
  console.log('✅ social-orchestrator.test.js: passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
