'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const { AutonomousSignalProtocol, PROTOCOL } = require('../backend/modules/social-orchestrator/signal-protocol');
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

const proto = new AutonomousSignalProtocol();
const a = proto.append('strategy-signal', { title: 'boot', result: 'ok' });
const b = proto.append('system-signal', { type: 'health', note: 'pass' });
assert.equal(PROTOCOL, 'zeusai-social-asp-v1');
assert.ok(a.hash && b.hash);
assert.equal(b.prevHash, a.hash);
assert.equal(proto.verifyChain().ok, true);

const reach = proto.proofOfReach(
  { profitUsdDay: 120, profitBtcDay: 0.002 },
  [{ name: 'feed', state: 'active' }, { name: 'viral', state: 'active' }],
  'dry-run'
);
assert.equal(reach.ok, true);
assert.ok(reach.attentionArbitrageScore >= 0);
assert.ok(Array.isArray(reach.differentiators) && reach.differentiators.length >= 4);

Promise.resolve(orchestrator.process({ action: 'run-decision' })).then(() => {
  const status = orchestrator.getStatus();
  assert.equal(status.ok, true);
  assert.equal(status.brand, 'ZeusAI Social');
  assert.equal(status.name, 'zeusai-social');
  assert.ok(status.pulse && status.pulse.protocol === PROTOCOL);
  assert.ok(status.proofOfReach && status.proofOfReach.ok);
  const feed = orchestrator.getPublicFeed(8);
  assert.ok(Array.isArray(feed));
  const pulse = orchestrator.getPulse(6);
  assert.equal(pulse.brand, 'ZeusAI Social');
  assert.ok(pulse.loops && pulse.loops.health === true);
  assert.equal(orchestrator.verifyChain().ok, true);
  console.log('✅ zeusai-social.test.js: passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
