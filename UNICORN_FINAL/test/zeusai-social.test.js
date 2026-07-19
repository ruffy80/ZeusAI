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

const snap = surface.snapshot();
assert.equal(snap.ok, true);
assert.ok(snap.posts >= 4);
assert.ok(snap.inventions >= 8);

assert.equal(surface.compose({ text: 'no auth' }).error, 'auth_required');
assert.equal(surface.react({ postId: 'x' }).error, 'auth_required');
assert.equal(surface.follow({ targetId: 'u_aria' }).error, 'auth_required');
assert.equal(surface.setIntent('learn').error, 'auth_required');

const uid = 'zid_test_social_user_1';
const ensured = surface.ensureProfile(uid, { name: 'Test Social', email: 't@example.com' });
assert.equal(ensured.ok, true);
assert.ok(ensured.profile.handle);

// Composing now requires a fresh Proof-of-Human challenge.
const ws = surface.world();
function humanize(u) {
  const ch = ws.issueHumanChallenge(u);
  const m = /(\d+)\+(\d+)/.exec(ch.prompt);
  ws.verifyHumanChallenge(u, { challengeId: ch.challengeId, answer: String(Number(m[1]) + Number(m[2])) });
}
humanize(uid);

const composed = surface.compose({ authorId: uid, text: 'Real-world signal from authenticated user', kind: 'text' });
assert.equal(composed.ok, true);
assert.equal(composed.post.author.id, uid);

const reacted = surface.react({ postId: composed.post.id, type: 'like', actorId: uid });
assert.equal(reacted.ok, true);

const shared = surface.sharePost(composed.post.id, uid);
assert.equal(shared.ok, true);
assert.ok(shared.shareUrl.includes(composed.post.id));

surface.setIntent('learn', uid);
assert.equal(surface.getWellbeing(uid).intent, 'learn');

const receipt = surface.issueAttentionReceipt(composed.post.id, uid);
assert.equal(receipt.ok, true);

const following = surface.timeline('following', 10, uid);
assert.equal(following.ok, true);

const me = surface.me(uid);
assert.equal(me.ok, true);
assert.equal(me.profile.id, uid);

const byHandle = surface.getProfileByHandle(ensured.profile.handle);
assert.equal(byHandle.ok, true);

Promise.resolve(orchestrator.process({ action: 'run-decision' })).then(() => {
  const pulse = orchestrator.getPulse(6);
  assert.equal(pulse.brand, 'ZeusAI Social');
  assert.ok(pulse.surface && pulse.surface.ok);
  assert.equal(orchestrator.verifyChain().ok, true);
  console.log('✅ zeusai-social.test.js: passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
