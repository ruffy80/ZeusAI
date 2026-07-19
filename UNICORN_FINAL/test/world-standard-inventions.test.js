'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUSAI_SOCIAL_DATA_DIR = require('path').join(
  require('os').tmpdir(),
  'zeusai-ws-test-' + process.pid
);

const assert = require('assert');
const ws = require('../backend/modules/social-orchestrator/world-standard');
const surface = require('../backend/modules/social-orchestrator/social-surface');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('✓', name);
  passed += 1;
}

const uid = 'zid_ws_user_a';
const uid2 = 'zid_ws_user_b';
surface.ensureProfile(uid, { name: 'WS A' });
surface.ensureProfile(uid2, { name: 'WS B' });

check('lists 12 world inventions', () => {
  const list = ws.list();
  assert.equal(list.ok, true);
  assert.ok(list.items.length >= 12);
});

check('attention ledger spend + donate', () => {
  const before = ws.getAttentionLedger(uid);
  assert.ok(before.balanceSec >= 60);
  const spend = ws.spendAttention(uid, { seconds: 10, creatorId: uid2, action: 'view' });
  assert.equal(spend.ok, true);
  const don = ws.donateAttention(uid, { toUserId: uid2, seconds: 30 });
  assert.equal(don.ok, true);
});

check('anti-deepfake bond challenge + resolve', () => {
  const composed = surface.compose({ authorId: uid, text: 'Bonded claim about markets' });
  assert.equal(composed.ok, true);
  const bond = ws.postBond(uid, { postId: composed.post.id, amountBtc: 0.0002 });
  assert.equal(bond.ok, true);
  const ch = ws.challengeBond(uid2, { bondId: bond.bond.id, reason: 'possible deepfake', evidence: 'hash mismatch' });
  assert.equal(ch.ok, true);
  assert.equal(ch.bond.status, 'contested');
  const res = ws.resolveBond(uid2, { bondId: bond.bond.id, outcome: 'slash' });
  assert.equal(res.ok, true);
  assert.equal(res.bond.status, 'slashed');
});

check('consent graph atomic channels', () => {
  const set = ws.setConsent(uid, { peerId: uid2, feed: true, story: false, dm: true, recommend: false });
  assert.equal(set.ok, true);
  assert.equal(set.consent.story, false);
  assert.equal(ws.allows(uid, uid2, 'dm'), true);
  assert.equal(ws.allows(uid, uid2, 'recommend'), false);
});

check('consent graph gates follow and dm', () => {
  // uid2 denies feed+dm from uid
  ws.setConsent(uid2, { peerId: uid, feed: false, dm: false, story: true, recommend: true });
  const fol = surface.follow({ followerId: uid, targetId: uid2 });
  assert.equal(fol.ok, false);
  assert.equal(fol.error, 'consent_denied');
  const dm = surface.sendDm({ from: uid, to: uid2, text: 'hello' });
  assert.equal(dm.ok, false);
  assert.equal(dm.error, 'consent_denied');
  // restore defaults so later tests can interact
  ws.setConsent(uid2, { peerId: uid, feed: true, dm: true, story: true, recommend: true });
  const folOk = surface.follow({ followerId: uid, targetId: uid2 });
  assert.equal(folOk.ok, true);
});

check('time-bounded virality scores', () => {
  const fresh = { createdAt: new Date().toISOString(), stats: { likes: 100, shares: 10, views: 1000 } };
  const v = ws.viralScore(fresh);
  assert.equal(v.expired, false);
  assert.ok(v.score > 0);
  const old = {
    createdAt: new Date(Date.now() - 80 * 3600 * 1000).toISOString(),
    stats: { likes: 100, shares: 10, views: 1000 },
  };
  const v2 = ws.viralScore(old);
  assert.equal(v2.expired, true);
});

check('federation CID pin', () => {
  const pin = ws.pinFederation(uid, { postId: 'p_test_fed', text: 'hello mesh' });
  assert.equal(pin.ok, true);
  assert.ok(String(pin.cid).startsWith('cid:'));
});

check('reputation without mob', () => {
  const r = ws.getReputation(uid);
  assert.equal(r.ok, true);
  assert.ok(r.score >= 0 && r.score <= 100);
});

check('creator split contracts', () => {
  const s = ws.setSplit(uid, {
    postId: 'p_split_1',
    shares: [{ userId: uid, pct: 60 }, { userId: uid2, pct: 40 }],
  });
  assert.equal(s.ok, true);
  const alloc = ws.allocateRoyalty('p_split_1', 0.001);
  assert.equal(alloc.ok, true);
  assert.equal(alloc.allocations.length, 2);
});

check('emotional bandwidth cap + override', () => {
  let last;
  for (let i = 0; i < 14; i += 1) {
    last = ws.checkBandwidth(uid, { text: 'rage hate outrage drama', tags: ['#rage'] });
  }
  assert.equal(last.allowed, false);
  const ov = ws.overrideBandwidth(uid, { minutes: 30 });
  assert.equal(ov.ok, true);
  const after = ws.checkBandwidth(uid, { text: 'rage', tags: [] });
  assert.equal(after.allowed, true);
  assert.equal(after.overridden, true);
});

check('ambiguity mode claims', () => {
  const c = ws.setClaimState(uid, { postId: 'p_claim_1', state: 'contested', evidence: 'two sources disagree' });
  assert.equal(c.ok, true);
  assert.equal(c.claim.state, 'contested');
  assert.ok(c.claim.evidenceAgainst.length >= 1);
});

check('exit-complete portability pack', () => {
  const pack = surface.exportExit(uid);
  assert.equal(pack.ok, true);
  assert.equal(pack.pack.format, 'zeusai-social-exit-v1');
  assert.ok(pack.pack.hash);
  assert.ok(pack.pack.surface);
});

check('zero-ad intent gate', () => {
  const bad = ws.signAdSlot(uid, { intent: 'discover', creativeId: 'x' });
  assert.equal(bad.ok, false);
  surface.setIntent('trade', uid);
  const ok = ws.signAdSlot(uid, { intent: 'trade', creativeId: 'deal' });
  assert.equal(ok.ok, true);
  assert.ok(ok.slot.signature);
});

check('proof-of-human light challenge', () => {
  const ch = ws.issueHumanChallenge(uid);
  assert.equal(ch.ok, true);
  // Extract numbers from "What is a+b?"
  const m = /(\d+)\+(\d+)/.exec(ch.prompt);
  assert.ok(m);
  const ans = Number(m[1]) + Number(m[2]);
  const v = ws.verifyHumanChallenge(uid, { challengeId: ch.challengeId, answer: String(ans) });
  assert.equal(v.ok, true);
  assert.equal(ws.isHumanFresh(uid), true);
});

check('compose wires federation + surface inventions include world set', () => {
  const made = surface.compose({
    authorId: uid,
    text: 'World-standard post with mesh + claim',
    claimState: 'unverified',
    bondBtc: 0.00005,
    splitShares: [{ userId: uid, pct: 100 }],
  });
  assert.equal(made.ok, true);
  assert.ok(made.federation && made.federation.cid);
  assert.ok(made.post.federationCid);
  const inv = surface.inventions();
  assert.ok(inv.items.length >= 20);
  assert.ok(inv.worldStandard && inv.worldStandard.inventionsLive >= 12);
});

console.log(`\n✅ world-standard-inventions: ${passed} tests passed\n`);
