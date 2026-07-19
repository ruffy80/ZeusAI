'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUSAI_SOCIAL_DATA_DIR = require('path').join(
  require('os').tmpdir(),
  'zeusai-supreme-test-' + process.pid
);

const assert = require('assert');
const surface = require('../backend/modules/social-orchestrator/social-surface');
const ws = surface.world();

let passed = 0;
function check(name, fn) {
  fn();
  console.log('✓', name);
  passed += 1;
}

const A = 'zid_sup_a';
const B = 'zid_sup_b';
const C = 'zid_sup_c';
surface.ensureProfile(A, { name: 'Supreme A' });
surface.ensureProfile(B, { name: 'Supreme B' });
surface.ensureProfile(C, { name: 'Supreme C' });

function humanize(u) {
  const ch = ws.issueHumanChallenge(u);
  const m = /(\d+)\+(\d+)/.exec(ch.prompt);
  ws.verifyHumanChallenge(u, { challengeId: ch.challengeId, answer: String(Number(m[1]) + Number(m[2])) });
}

check('compose is gated by Proof-of-Human challenge', () => {
  const blocked = surface.compose({ authorId: A, text: 'I have not proven humanity yet' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'needs_human_challenge');
  humanize(A);
  const ok = surface.compose({ authorId: A, text: 'Now I am fresh #autonomy' });
  assert.equal(ok.ok, true);
});

let postId;
check('compose stores a real post', () => {
  humanize(A);
  const made = surface.compose({ authorId: A, text: 'Anchor post for supreme tests', tags: ['#supreme'] });
  assert.equal(made.ok, true);
  postId = made.post.id;
  assert.equal(made.post.commentCount, 0);
});

check('addComment stores comment, bumps stats, notifies author', () => {
  const before = surface.getPost(postId).post.stats.comments;
  const c = surface.addComment({ postId, actorId: B, text: 'First real comment' });
  assert.equal(c.ok, true);
  assert.ok(c.comment.id);
  assert.equal(c.comment.author.id, B);
  assert.equal(c.stats.comments, before + 1);
  const list = surface.getComments(postId);
  assert.equal(list.ok, true);
  assert.ok(list.items.some((x) => x.text === 'First real comment'));
  assert.equal(list.count, list.items.length);
});

check('react(comment) does NOT inflate comment count', () => {
  const before = surface.getPost(postId).post.stats.comments;
  const r = surface.react({ postId, type: 'comment', actorId: B });
  assert.equal(r.ok, true);
  assert.equal(surface.getPost(postId).post.stats.comments, before);
});

check('notifications: author sees unread + can mark read', () => {
  const notifs = surface.getNotifications(A);
  assert.equal(notifs.ok, true);
  assert.ok(notifs.unread >= 1);
  assert.ok(notifs.items.some((n) => n.type === 'comment'));
  const me = surface.me(A);
  assert.equal(me.unreadNotifications, notifs.unread);
  const marked = surface.markNotificationsRead(A);
  assert.equal(marked.ok, true);
  assert.ok(marked.marked >= 1);
  assert.equal(surface.getNotifications(A).unread, 0);
  assert.equal(surface.me(A).unreadNotifications, 0);
});

check('react(like/save) notifies author and records bookmark', () => {
  surface.react({ postId, type: 'like', actorId: B });
  const saved = surface.react({ postId, type: 'save', actorId: B });
  assert.equal(saved.ok, true);
  const notifs = surface.getNotifications(A);
  assert.ok(notifs.items.some((n) => n.type === 'like'));
  assert.ok(notifs.items.some((n) => n.type === 'save'));
});

check('bookmarks resolve to enriched posts', () => {
  const bm = surface.getBookmarks(B);
  assert.equal(bm.ok, true);
  assert.ok(bm.items.some((x) => x.post && x.post.id === postId));
});

check('follow then unfollow updates the graph', () => {
  const f = surface.follow({ followerId: B, targetId: A });
  assert.equal(f.ok, true);
  assert.ok(surface.me(B).followingIds.includes(A));
  // follow notifies target
  assert.ok(surface.getNotifications(A).items.some((n) => n.type === 'follow'));
  const uf = surface.unfollow({ followerId: B, targetId: A });
  assert.equal(uf.ok, true);
  assert.equal(uf.changed, true);
  assert.ok(!surface.me(B).followingIds.includes(A));
  // unfollowing again is idempotent
  assert.equal(surface.unfollow({ followerId: B, targetId: A }).changed, false);
});

check('quoteRepost creates a quoting post and bumps original shares', () => {
  humanize(B);
  const beforeShares = surface.getPost(postId).post.stats.shares;
  const q = surface.quoteRepost({ actorId: B, postId, text: 'Quoting this signal' });
  assert.equal(q.ok, true);
  assert.equal(q.post.quotedPostId, postId);
  assert.ok(q.post.quotedPost && q.post.quotedPost.id === postId);
  assert.equal(surface.getPost(postId).post.stats.shares, beforeShares + 1);
  assert.ok(surface.getNotifications(A).items.some((n) => n.type === 'quote'));
});

check('tag timeline filters by hashtag', () => {
  const tl = surface.timeline('tag:#supreme', 20);
  assert.equal(tl.ok, true);
  assert.ok(tl.items.length >= 1);
  assert.ok(tl.items.every((p) => (p.tags || []).some((t) => String(t).toLowerCase() === '#supreme')));
});

check('story compose also appends to the stories rail', () => {
  humanize(A);
  const before = surface.stories().items.length;
  const st = surface.compose({ authorId: A, text: 'Ephemeral story line', kind: 'story' });
  assert.equal(st.ok, true);
  assert.equal(surface.stories().items.length, before + 1);
});

check('bond resolve is forbidden for the author', () => {
  humanize(A);
  const made = surface.compose({ authorId: A, text: 'Bonded supreme claim' });
  const bond = ws.postBond(A, { postId: made.post.id, amountBtc: 0.0002 });
  assert.equal(bond.ok, true);
  const bad = ws.resolveBond(A, { bondId: bond.bond.id, outcome: 'upheld' });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'forbidden');
});

check('bond resolve is forbidden for a challenger', () => {
  humanize(A);
  const made = surface.compose({ authorId: A, text: 'Another bonded claim' });
  const bond = ws.postBond(A, { postId: made.post.id, amountBtc: 0.0002 });
  ws.challengeBond(B, { bondId: bond.bond.id, reason: 'suspect', evidence: 'x' });
  const bad = ws.resolveBond(B, { bondId: bond.bond.id, outcome: 'slash' });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'forbidden');
  // neutral party with an open challenge may resolve
  const ok = ws.resolveBond(C, { bondId: bond.bond.id, outcome: 'slash' });
  assert.equal(ok.ok, true);
});

check('engagement royalty accrues into the ledger', () => {
  ws.setSplit(A, { postId, shares: [{ userId: A, pct: 70 }, { userId: B, pct: 30 }] });
  const before = ws.getRoyalty(postId);
  assert.equal(before.accruedBtc, 0);
  const acc = surface.accrueEngagementRoyalty(postId, 0.001);
  assert.equal(acc.ok, true);
  assert.ok(acc.accruedBtc > 0);
  const after = ws.getRoyalty(postId);
  assert.ok(after.accruedBtc >= 0.001 - 1e-9);
  assert.equal(after.exists, true);
  // enriched post surfaces the accrued royalty
  assert.ok(surface.getPost(postId).post.royaltyAccruedBtc > 0);
  // accruing on a missing post fails cleanly
  assert.equal(surface.accrueEngagementRoyalty('p_does_not_exist', 0.001).error, 'post_not_found');
});

check('claim verified requires high reputation', () => {
  // Low-rep actor cannot mark verified…
  const low = ws.setClaimState(C, { postId, state: 'verified', evidence: 'trust me' });
  assert.equal(low.ok, false);
  assert.equal(low.error, 'forbidden');
  // …but can set contested/unverified freely.
  const contested = ws.setClaimState(C, { postId, state: 'contested', evidence: 'two sides' });
  assert.equal(contested.ok, true);
  // Raise reputation above the gate, then verified succeeds.
  let guard = 0;
  while (ws.getReputation(C).score < 70 && guard < 40) { humanize(C); guard += 1; }
  assert.ok(ws.getReputation(C).score >= 70);
  const ok = ws.setClaimState(C, { postId, state: 'verified', evidence: 'confirmed by ledger' });
  assert.equal(ok.ok, true);
  assert.equal(ok.claim.state, 'verified');
});

check('parity matrix reports planned features honestly', () => {
  const p = surface.parity();
  assert.equal(p.ok, true);
  const all = Object.values(p.matrix).flat();
  const byId = {};
  for (const f of all) byId[f.id] = f;
  for (const planned of ['live_streams', 'spaces', 'duets', 'stitches', 'group_chats', 'events']) {
    assert.equal(byId[planned].status, 'planned', planned + ' should be planned');
    assert.equal(byId[planned].implemented, false);
  }
  for (const live of ['comments', 'bookmarks', 'notifications', 'quotes', 'stories']) {
    assert.equal(byId[live].status, 'live', live + ' should be live');
  }
  assert.ok(p.totals.featuresPlanned >= 6);
});

check('world status counts royalty posts', () => {
  const s = ws.status();
  assert.ok(s.counts.royaltyPosts >= 1);
});

console.log(`\n✅ social-supreme: ${passed} tests passed\n`);
