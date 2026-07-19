'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUSAI_SOCIAL_DATA_DIR = require('path').join(require('os').tmpdir(), 'zeusai-social-test-' + process.pid);

const assert = require('assert');
const { AutonomousSignalProtocol, PROTOCOL } = require('../backend/modules/social-orchestrator/signal-protocol');
const orchestrator = require('../backend/modules/social-orchestrator/orchestrator');
const surface = require('../backend/modules/social-orchestrator/social-surface');

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

// World-standard surface
const snap = surface.snapshot();
assert.equal(snap.ok, true);
assert.ok(snap.posts >= 4);
assert.ok(snap.stories >= 1);
assert.ok(snap.shorts >= 1);
assert.ok(snap.inventions >= 8);

const tl = surface.timeline('for-you', 10);
assert.ok(tl.items.length >= 3);
assert.ok(tl.items[0].proofOfAuthorship);

const shorts = surface.shorts();
assert.ok(shorts.items.every((p) => p.kind === 'short' || p.kind === 'reel'));

const parity = surface.parity();
assert.ok(parity.totals.featuresLive >= 40);
assert.ok(parity.platforms.facebook.length >= 5);
assert.ok(parity.platforms.tiktok.length >= 5);

const composed = surface.compose({ text: 'World-standard signal from tests', kind: 'text' });
assert.equal(composed.ok, true);
assert.ok(composed.post.proofOfAuthorship);

const reacted = surface.react({ postId: composed.post.id, type: 'like' });
assert.equal(reacted.ok, true);
assert.ok(reacted.royaltyHintBtc >= 0);

const receipt = surface.issueAttentionReceipt(composed.post.id, 'tester');
assert.equal(receipt.ok, true);
assert.ok(receipt.receipt.hash);
assert.ok(receipt.wellbeing.score <= 100);

surface.setIntent('learn');
assert.equal(surface.getWellbeing().intent, 'learn');

const ssr = surface.renderSsrFeed(3);
assert.ok(ssr.includes('za-post'));
assert.ok(ssr.includes('Proof-of-Authorship') || ssr.includes('za-post-proof'));

Promise.resolve(orchestrator.process({ action: 'run-decision' })).then(() => {
  const status = orchestrator.getStatus();
  assert.equal(status.ok, true);
  assert.equal(status.brand, 'ZeusAI Social');
  assert.equal(status.name, 'zeusai-social');
  assert.ok(status.pulse && status.pulse.protocol === PROTOCOL);
  assert.ok(status.proofOfReach && status.proofOfReach.ok);
  assert.ok(status.pulse.surface && status.pulse.surface.ok);
  assert.ok(Array.isArray(status.pulse.inventions) && status.pulse.inventions.length >= 8);
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
