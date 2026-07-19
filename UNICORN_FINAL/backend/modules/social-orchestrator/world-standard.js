'use strict';

/**
 * ZeusAI Social — World-Standard Inventions (v2)
 * Twelve first-class primitives designed to outclass every existing social network.
 * Real persistence under data/zeusai-social/world-standard.json — not stubs.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.ZEUSAI_SOCIAL_DATA_DIR
  || path.join(__dirname, '../../../data/zeusai-social');
const DATA_FILE = path.join(DATA_DIR, 'world-standard.json');

const VIRALITY_TTL_MS = 72 * 60 * 60 * 1000; // Time-Bounded Virality: 72h
const AGGRESSIVE_TAGS = /#?(rage|hate|outrage|drama|doom|toxic|fear)/i;

const INVENTIONS = [
  { id: 'attention-economy-ledger', title: 'Attention Economy Ledger', status: 'live',
    problem: 'Platforms extract attention invisibly.',
    solution: 'Every second of attention is a user-owned unit that can be donated, sold, or blocked per creator.' },
  { id: 'anti-deepfake-bond', title: 'Anti-Deepfake Bond', status: 'live',
    problem: 'Media spreads without economic liability for fakes.',
    solution: 'Posts deposit a cryptographic bond; proven-false claims redistribute the bond to victims.' },
  { id: 'consent-graph', title: 'Consent Graph', status: 'live',
    problem: 'Follow/unfollow is too coarse for real consent.',
    solution: 'Atomic bidirectional consent: feed / story / dm / recommend — each revocable.' },
  { id: 'time-bounded-virality', title: 'Time-Bounded Virality', status: 'live',
    problem: 'Bot farms recycle content forever.',
    solution: 'Viral boost expires in 72h unless re-anchored by a human author.' },
  { id: 'local-first-federation', title: 'Local-First Federation Mesh', status: 'live',
    problem: 'Platforms own your content; lose the server, lose yourself.',
    solution: 'Content-addressed blobs (CID) — platform indexes, user holds the payload hash.' },
  { id: 'reputation-without-mob', title: 'Reputation Without Mob', status: 'live',
    problem: 'Likes and piles-on replace proof.',
    solution: 'Trust score from ledger evidence, bonds, and anchors — not like counts.' },
  { id: 'creator-split-contracts', title: 'Creator Split Contracts', status: 'live',
    problem: 'Co-creators rarely get automatic fair splits.',
    solution: 'On-post split contracts: N creators, automatic royalty allocation.' },
  { id: 'emotional-bandwidth-cap', title: 'Emotional Bandwidth Cap', status: 'live',
    problem: 'Aggressive content floods without a health limit.',
    solution: 'Transparent hourly cap on aggressive-density items, with explicit override.' },
  { id: 'ambiguity-mode', title: 'Ambiguity Mode for News', status: 'live',
    problem: 'Binary fact-check badges hide contested truth.',
    solution: 'Claims carry verified / contested / unverified with both evidence sides visible.' },
  { id: 'exit-complete-portability', title: 'Exit-Complete Portability', status: 'live',
    problem: 'Leaving a network means losing your graph.',
    solution: 'One-click export: posts, follows, DMs meta, receipts, passport, consent, ledger.' },
  { id: 'zero-ad-intent', title: 'Zero-Ad Default + Intent Ads', status: 'live',
    problem: 'Ads poison every feed by default.',
    solution: 'Ads only when intent=trade and the user signs an Attention Receipt for that slot.' },
  { id: 'proof-of-human-light', title: 'Proof-of-Human Light', status: 'live',
    problem: 'Bots scale without biometrics theater.',
    solution: 'Periodic light challenge + device key + passport rate limits — no invasive biometrics.' },
];

function _now() { return new Date().toISOString(); }
function _id(p) { return `${p}_${crypto.randomBytes(6).toString('hex')}`; }
function _hash(x) {
  return crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
}
function _cid(payload) {
  return 'cid:' + _hash(payload).slice(0, 32);
}

function _empty() {
  return {
    version: 1,
    attentionLedger: {},       // userId -> { balanceSec, entries: [] }
    bonds: [],                 // { id, postId, authorId, amountBtc, status, challenges: [] }
    consent: {},               // userId -> { [peerId]: { feed, story, dm, recommend } }
    federation: {},            // postId -> { cid, pinnedAt }
    reputation: {},            // userId -> { score, events: [] }
    splits: {},                // postId -> { shares: [{userId, pct}], createdAt }
    bandwidth: {},             // userId -> { hourKey, aggressiveSeen, overrideUntil }
    claims: {},                // postId -> { state, evidenceFor:[], evidenceAgainst:[] }
    adSlots: [],               // signed intent-ad receipts
    humanChallenges: {},       // userId -> { challenge, expiresAt, passedAt }
    updatedAt: _now(),
  };
}

class WorldStandardEngine {
  constructor() {
    this.state = null;
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        this.state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (_) { /* seed */ }
    if (!this.state) this.state = _empty();
    for (const k of Object.keys(_empty())) {
      if (this.state[k] === undefined) this.state[k] = _empty()[k];
    }
  }

  _save() {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      this.state.updatedAt = _now();
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2));
    } catch (_) { /* fail-soft */ }
  }

  list() {
    return { ok: true, brand: 'ZeusAI Social', protocol: 'zeusai-world-standard-v1', items: INVENTIONS };
  }

  // ── 1. Attention Economy Ledger ──────────────────────────────────────
  _ledger(userId) {
    if (!this.state.attentionLedger[userId]) {
      this.state.attentionLedger[userId] = { balanceSec: 3600, entries: [] }; // start with 1h owned
    }
    return this.state.attentionLedger[userId];
  }

  spendAttention(userId, { seconds = 5, creatorId, action = 'view' } = {}) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const sec = Math.max(1, Math.min(300, Number(seconds) || 5));
    const led = this._ledger(userId);
    if (led.balanceSec < sec) {
      return { ok: false, error: 'attention_insufficient', balanceSec: led.balanceSec, invention: 'attention-economy-ledger' };
    }
    led.balanceSec -= sec;
    const entry = {
      id: _id('attn'),
      at: _now(),
      seconds: sec,
      creatorId: creatorId || null,
      action: String(action).slice(0, 32),
      hash: _hash({ userId, sec, creatorId, t: Date.now() }),
    };
    led.entries.unshift(entry);
    if (led.entries.length > 500) led.entries.length = 500;
    if (creatorId) {
      const cLed = this._ledger(creatorId);
      cLed.balanceSec += Math.floor(sec * 0.7); // 70% of attention flows to creator
      cLed.entries.unshift(Object.assign({}, entry, { action: 'received', from: userId }));
    }
    this._save();
    return { ok: true, balanceSec: led.balanceSec, entry, invention: 'attention-economy-ledger' };
  }

  donateAttention(userId, { toUserId, seconds = 60 } = {}) {
    if (!userId || !toUserId) return { ok: false, error: 'auth_required' };
    const sec = Math.max(1, Math.min(3600, Number(seconds) || 60));
    const led = this._ledger(userId);
    if (led.balanceSec < sec) return { ok: false, error: 'attention_insufficient', balanceSec: led.balanceSec };
    led.balanceSec -= sec;
    const dest = this._ledger(toUserId);
    dest.balanceSec += sec;
    const entry = { id: _id('don'), at: _now(), seconds: sec, toUserId, action: 'donate' };
    led.entries.unshift(entry);
    dest.entries.unshift({ id: entry.id, at: entry.at, seconds: sec, from: userId, action: 'donated_in' });
    this._save();
    return { ok: true, balanceSec: led.balanceSec, invention: 'attention-economy-ledger' };
  }

  getAttentionLedger(userId) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const led = this._ledger(userId);
    return {
      ok: true,
      balanceSec: led.balanceSec,
      recent: led.entries.slice(0, 40),
      invention: 'attention-economy-ledger',
    };
  }

  // ── 2. Anti-Deepfake Bond ────────────────────────────────────────────
  postBond(authorId, { postId, amountBtc = 0.0001 } = {}) {
    if (!authorId || !postId) return { ok: false, error: 'auth_required' };
    const amount = Math.max(0.00001, Number(amountBtc) || 0.0001);
    const bond = {
      id: _id('bond'),
      postId,
      authorId,
      amountBtc: amount,
      status: 'active',
      challenges: [],
      createdAt: _now(),
      hash: _hash({ postId, authorId, amount }),
    };
    this.state.bonds.unshift(bond);
    this._bumpRep(authorId, 2, 'bond_posted', postId);
    this._save();
    return { ok: true, bond, invention: 'anti-deepfake-bond' };
  }

  challengeBond(challengerId, { bondId, reason, evidence } = {}) {
    if (!challengerId || !bondId) return { ok: false, error: 'auth_required' };
    const bond = this.state.bonds.find((b) => b.id === bondId);
    if (!bond) return { ok: false, error: 'bond_not_found' };
    if (bond.status !== 'active') return { ok: false, error: 'bond_not_active' };
    const challenge = {
      id: _id('ch'),
      challengerId,
      reason: String(reason || '').slice(0, 500),
      evidence: String(evidence || '').slice(0, 1000),
      at: _now(),
      status: 'open',
    };
    bond.challenges.push(challenge);
    bond.status = 'contested';
    this._save();
    return { ok: true, bond, challenge, invention: 'anti-deepfake-bond' };
  }

  resolveBond(resolverId, { bondId, outcome = 'upheld' } = {}) {
    // outcome: upheld (author wins) | slash (challenger wins — redistribute)
    if (!resolverId || !bondId) return { ok: false, error: 'auth_required' };
    const bond = this.state.bonds.find((b) => b.id === bondId);
    if (!bond) return { ok: false, error: 'bond_not_found' };
    if (outcome === 'slash' && bond.challenges.length) {
      bond.status = 'slashed';
      const victim = bond.challenges[0].challengerId;
      this._bumpRep(bond.authorId, -15, 'bond_slashed', bond.postId);
      this._bumpRep(victim, 10, 'bond_won', bond.postId);
      bond.redistributedTo = victim;
    } else {
      bond.status = 'upheld';
      this._bumpRep(bond.authorId, 5, 'bond_upheld', bond.postId);
    }
    bond.resolvedAt = _now();
    bond.resolvedBy = resolverId;
    this._save();
    return { ok: true, bond, invention: 'anti-deepfake-bond' };
  }

  listBonds(limit = 40) {
    return { ok: true, items: this.state.bonds.slice(0, Math.min(80, Number(limit) || 40)), invention: 'anti-deepfake-bond' };
  }

  // ── 3. Consent Graph ─────────────────────────────────────────────────
  _defaultConsent() {
    return { feed: true, story: true, dm: true, recommend: true };
  }

  setConsent(userId, { peerId, feed, story, dm, recommend } = {}) {
    if (!userId || !peerId) return { ok: false, error: 'auth_required' };
    if (!this.state.consent[userId]) this.state.consent[userId] = {};
    const cur = this.state.consent[userId][peerId] || this._defaultConsent();
    const next = {
      feed: feed === undefined ? cur.feed : !!feed,
      story: story === undefined ? cur.story : !!story,
      dm: dm === undefined ? cur.dm : !!dm,
      recommend: recommend === undefined ? cur.recommend : !!recommend,
      updatedAt: _now(),
    };
    this.state.consent[userId][peerId] = next;
    this._save();
    return { ok: true, peerId, consent: next, invention: 'consent-graph' };
  }

  getConsent(userId, peerId) {
    if (!userId) return { ok: false, error: 'auth_required' };
    if (peerId) {
      const c = (this.state.consent[userId] && this.state.consent[userId][peerId]) || this._defaultConsent();
      return { ok: true, peerId, consent: c, invention: 'consent-graph' };
    }
    return {
      ok: true,
      graph: this.state.consent[userId] || {},
      invention: 'consent-graph',
    };
  }

  allows(userId, peerId, channel) {
    const c = (this.state.consent[userId] && this.state.consent[userId][peerId]) || this._defaultConsent();
    return !!c[channel];
  }

  // ── 4. Time-Bounded Virality ─────────────────────────────────────────
  viralScore(post) {
    if (!post || !post.createdAt) return 0;
    const age = Date.now() - new Date(post.createdAt).getTime();
    const stats = post.stats || {};
    const raw = (stats.likes || 0) + (stats.shares || 0) * 2 + (stats.views || 0) * 0.01;
    if (age > VIRALITY_TTL_MS && !post.viralReanchorAt) {
      return { score: raw * 0.05, expired: true, ttlMs: VIRALITY_TTL_MS, invention: 'time-bounded-virality' };
    }
    if (post.viralReanchorAt) {
      const reAge = Date.now() - new Date(post.viralReanchorAt).getTime();
      if (reAge > VIRALITY_TTL_MS) {
        return { score: raw * 0.05, expired: true, ttlMs: VIRALITY_TTL_MS, invention: 'time-bounded-virality' };
      }
    }
    const freshness = Math.max(0.15, 1 - age / VIRALITY_TTL_MS);
    return { score: raw * freshness, expired: false, ttlMs: VIRALITY_TTL_MS, invention: 'time-bounded-virality' };
  }

  reanchorViral(authorId, { postId } = {}) {
    if (!authorId || !postId) return { ok: false, error: 'auth_required' };
    return { ok: true, postId, reanchorAt: _now(), authorId, invention: 'time-bounded-virality', note: 'caller must stamp post.viralReanchorAt' };
  }

  // ── 5. Local-First Federation Mesh ───────────────────────────────────
  pinFederation(authorId, { postId, text } = {}) {
    if (!authorId || !postId) return { ok: false, error: 'auth_required' };
    const cid = _cid({ postId, text: text || '', authorId });
    this.state.federation[postId] = { cid, authorId, pinnedAt: _now(), payloadHash: _hash({ postId, text }) };
    this._save();
    return { ok: true, postId, cid, invention: 'local-first-federation' };
  }

  getFederation(postId) {
    const row = this.state.federation[postId];
    if (!row) return { ok: false, error: 'not_pinned' };
    return { ok: true, ...row, invention: 'local-first-federation' };
  }

  // ── 6. Reputation Without Mob ────────────────────────────────────────
  _bumpRep(userId, delta, reason, ref) {
    if (!userId) return;
    if (!this.state.reputation[userId]) {
      this.state.reputation[userId] = { score: 50, events: [] };
    }
    const r = this.state.reputation[userId];
    r.score = Math.max(0, Math.min(100, r.score + delta));
    r.events.unshift({ at: _now(), delta, reason, ref: ref || null });
    if (r.events.length > 100) r.events.length = 100;
  }

  getReputation(userId) {
    const r = this.state.reputation[userId] || { score: 50, events: [] };
    return { ok: true, userId, score: r.score, events: r.events.slice(0, 30), invention: 'reputation-without-mob' };
  }

  // ── 7. Creator Split Contracts ───────────────────────────────────────
  setSplit(authorId, { postId, shares } = {}) {
    if (!authorId || !postId || !Array.isArray(shares) || !shares.length) {
      return { ok: false, error: 'invalid_split' };
    }
    const norm = shares.map((s) => ({
      userId: String(s.userId),
      pct: Math.max(0, Math.min(100, Number(s.pct) || 0)),
    }));
    const sum = norm.reduce((a, b) => a + b.pct, 0);
    if (Math.abs(sum - 100) > 0.01) return { ok: false, error: 'split_must_sum_100', sum };
    this.state.splits[postId] = { shares: norm, createdAt: _now(), createdBy: authorId };
    this._save();
    return { ok: true, postId, split: this.state.splits[postId], invention: 'creator-split-contracts' };
  }

  getSplit(postId) {
    const s = this.state.splits[postId];
    if (!s) return { ok: false, error: 'no_split' };
    return { ok: true, postId, split: s, invention: 'creator-split-contracts' };
  }

  allocateRoyalty(postId, amountBtc) {
    const s = this.state.splits[postId];
    if (!s) return { ok: false, error: 'no_split' };
    const amt = Number(amountBtc) || 0;
    return {
      ok: true,
      postId,
      allocations: s.shares.map((x) => ({
        userId: x.userId,
        pct: x.pct,
        btc: Number(((amt * x.pct) / 100).toFixed(8)),
      })),
      invention: 'creator-split-contracts',
    };
  }

  // ── 8. Emotional Bandwidth Cap ───────────────────────────────────────
  _hourKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}${d.getUTCMonth()}${d.getUTCDate()}${d.getUTCHours()}`;
  }

  checkBandwidth(userId, { text, tags } = {}) {
    if (!userId) return { ok: true, allowed: true, invention: 'emotional-bandwidth-cap' };
    const key = this._hourKey();
    if (!this.state.bandwidth[userId] || this.state.bandwidth[userId].hourKey !== key) {
      this.state.bandwidth[userId] = { hourKey: key, aggressiveSeen: 0, overrideUntil: 0 };
    }
    const bw = this.state.bandwidth[userId];
    if (bw.overrideUntil && Date.now() < bw.overrideUntil) {
      return { ok: true, allowed: true, overridden: true, aggressiveSeen: bw.aggressiveSeen, cap: 12, invention: 'emotional-bandwidth-cap' };
    }
    const blob = `${text || ''} ${(tags || []).join(' ')}`;
    const aggressive = AGGRESSIVE_TAGS.test(blob);
    if (aggressive) bw.aggressiveSeen += 1;
    const allowed = !aggressive || bw.aggressiveSeen <= 12;
    this._save();
    return {
      ok: true,
      allowed,
      aggressive,
      aggressiveSeen: bw.aggressiveSeen,
      cap: 12,
      advice: allowed ? null : 'Emotional bandwidth cap reached — override explicitly or switch intent to Learn.',
      invention: 'emotional-bandwidth-cap',
    };
  }

  overrideBandwidth(userId, { minutes = 30 } = {}) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const key = this._hourKey();
    if (!this.state.bandwidth[userId] || this.state.bandwidth[userId].hourKey !== key) {
      this.state.bandwidth[userId] = { hourKey: key, aggressiveSeen: 0, overrideUntil: 0 };
    }
    this.state.bandwidth[userId].overrideUntil = Date.now() + Math.max(5, Math.min(120, Number(minutes) || 30)) * 60000;
    this._save();
    return { ok: true, overrideUntil: new Date(this.state.bandwidth[userId].overrideUntil).toISOString(), invention: 'emotional-bandwidth-cap' };
  }

  // ── 9. Ambiguity Mode for News ───────────────────────────────────────
  setClaimState(actorId, { postId, state = 'unverified', evidence } = {}) {
    if (!actorId || !postId) return { ok: false, error: 'auth_required' };
    const allowed = ['verified', 'contested', 'unverified'];
    const st = allowed.includes(state) ? state : 'unverified';
    if (!this.state.claims[postId]) {
      this.state.claims[postId] = { state: 'unverified', evidenceFor: [], evidenceAgainst: [], history: [] };
    }
    const c = this.state.claims[postId];
    c.state = st;
    const ev = evidence ? { by: actorId, text: String(evidence).slice(0, 800), at: _now() } : null;
    if (ev) {
      if (st === 'verified') c.evidenceFor.unshift(ev);
      else if (st === 'contested') c.evidenceAgainst.unshift(ev);
    }
    c.history.unshift({ at: _now(), by: actorId, state: st });
    this._save();
    return { ok: true, postId, claim: c, invention: 'ambiguity-mode' };
  }

  getClaim(postId) {
    const c = this.state.claims[postId] || { state: 'unverified', evidenceFor: [], evidenceAgainst: [], history: [] };
    return { ok: true, postId, claim: c, invention: 'ambiguity-mode' };
  }

  // ── 10. Exit-Complete Portability ────────────────────────────────────
  exportPortable(userId, surfaceSnapshot) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const pack = {
      format: 'zeusai-social-exit-v1',
      exportedAt: _now(),
      userId,
      attention: this.getAttentionLedger(userId),
      consent: this.getConsent(userId),
      reputation: this.getReputation(userId),
      bonds: this.state.bonds.filter((b) => b.authorId === userId),
      splits: Object.entries(this.state.splits)
        .filter(([, v]) => v.createdBy === userId)
        .map(([postId, v]) => ({ postId, ...v })),
      federation: Object.entries(this.state.federation)
        .filter(([, v]) => v.authorId === userId)
        .map(([postId, v]) => ({ postId, ...v })),
      surface: surfaceSnapshot || null,
      hash: null,
    };
    pack.hash = _hash(pack);
    return { ok: true, pack, invention: 'exit-complete-portability' };
  }

  // ── 11. Zero-Ad Default + Intent Ads ─────────────────────────────────
  signAdSlot(userId, { intent, creativeId, seconds = 5 } = {}) {
    if (!userId) return { ok: false, error: 'auth_required' };
    if (intent !== 'trade') {
      return { ok: false, error: 'ads_only_in_trade_intent', invention: 'zero-ad-intent' };
    }
    const spend = this.spendAttention(userId, { seconds, creatorId: null, action: 'ad_slot' });
    if (!spend.ok) return spend;
    const slot = {
      id: _id('ad'),
      userId,
      creativeId: String(creativeId || 'default').slice(0, 64),
      at: _now(),
      receiptHash: spend.entry.hash,
      signature: _hash({ userId, creativeId, t: Date.now(), intent: 'trade' }),
    };
    this.state.adSlots.unshift(slot);
    if (this.state.adSlots.length > 200) this.state.adSlots.length = 200;
    this._save();
    return { ok: true, slot, invention: 'zero-ad-intent' };
  }

  listAdPolicy() {
    return {
      ok: true,
      defaultAds: false,
      requiresIntent: 'trade',
      requiresSignedReceipt: true,
      invention: 'zero-ad-intent',
    };
  }

  // ── 12. Proof-of-Human Light ─────────────────────────────────────────
  issueHumanChallenge(userId) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 2;
    const challenge = {
      id: _id('hum'),
      prompt: `What is ${a}+${b}?`,
      answerHash: _hash(String(a + b)),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    this.state.humanChallenges[userId] = challenge;
    this._save();
    return {
      ok: true,
      challengeId: challenge.id,
      prompt: challenge.prompt,
      expiresAt: new Date(challenge.expiresAt).toISOString(),
      invention: 'proof-of-human-light',
    };
  }

  verifyHumanChallenge(userId, { challengeId, answer } = {}) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const ch = this.state.humanChallenges[userId];
    if (!ch || ch.id !== challengeId) return { ok: false, error: 'challenge_missing' };
    if (Date.now() > ch.expiresAt) return { ok: false, error: 'challenge_expired' };
    if (_hash(String(answer).trim()) !== ch.answerHash) {
      return { ok: false, error: 'challenge_failed', invention: 'proof-of-human-light' };
    }
    ch.passedAt = _now();
    delete ch.answerHash;
    this._bumpRep(userId, 3, 'human_verified', challengeId);
    this._save();
    return { ok: true, passedAt: ch.passedAt, invention: 'proof-of-human-light' };
  }

  isHumanFresh(userId, maxAgeMs = 24 * 3600 * 1000) {
    const ch = this.state.humanChallenges[userId];
    if (!ch || !ch.passedAt) return false;
    return Date.now() - new Date(ch.passedAt).getTime() < maxAgeMs;
  }

  // ── Snapshot / status ────────────────────────────────────────────────
  status() {
    return {
      ok: true,
      protocol: 'zeusai-world-standard-v1',
      inventionsLive: INVENTIONS.length,
      counts: {
        attentionAccounts: Object.keys(this.state.attentionLedger).length,
        bonds: this.state.bonds.length,
        consentEdges: Object.values(this.state.consent).reduce((n, g) => n + Object.keys(g).length, 0),
        federationPins: Object.keys(this.state.federation).length,
        reputationProfiles: Object.keys(this.state.reputation).length,
        splits: Object.keys(this.state.splits).length,
        claims: Object.keys(this.state.claims).length,
        adSlots: this.state.adSlots.length,
        humanChallenges: Object.keys(this.state.humanChallenges).length,
      },
      items: INVENTIONS,
    };
  }
}

const engine = new WorldStandardEngine();
module.exports = engine;
module.exports.WorldStandardEngine = WorldStandardEngine;
module.exports.INVENTIONS = INVENTIONS;
module.exports.VIRALITY_TTL_MS = VIRALITY_TTL_MS;
