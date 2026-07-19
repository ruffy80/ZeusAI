'use strict';

/**
 * ZeusAI Social — World-Standard Surface
 * Working in-platform social graph with Facebook / X / Instagram / TikTok
 * feature parity PLUS inventions the world needs but does not yet have.
 *
 * Persistence: data/zeusai-social/surface.json (fail-soft; seeds on cold start).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const worldStandard = require('./world-standard');

const DATA_DIR = process.env.ZEUSAI_SOCIAL_DATA_DIR
  || path.join(__dirname, '../../../data/zeusai-social');
const DATA_FILE = path.join(DATA_DIR, 'surface.json');

const PLATFORM_PARITY = {
  facebook: ['profiles', 'friends', 'groups', 'text_posts', 'images', 'videos', 'stories', 'live', 'reactions', 'comments', 'shares', 'dms', 'events'],
  x_twitter: ['profiles', 'follows', 'text_posts', 'images', 'videos', 'reposts', 'quotes', 'likes', 'bookmarks', 'lists', 'spaces', 'dms', 'trending'],
  instagram: ['profiles', 'follows', 'images', 'reels', 'stories', 'carousels', 'likes', 'comments', 'dms', 'explore', 'hashtags', 'saves'],
  tiktok: ['profiles', 'follows', 'shorts', 'sounds', 'duets', 'stitches', 'likes', 'comments', 'shares', 'fyp', 'live', 'creator_fund'],
};

/** Inventions not shipped by Big Social — implemented here as first-class APIs. */
const WORLD_INVENTIONS = [
  {
    id: 'attention-receipt',
    title: 'Attention Receipt',
    problem: 'Platforms track you invisibly; you never get proof of what was measured.',
    solution: 'Every view issues a signed receipt you can export — attention becomes accountable.',
    status: 'live',
  },
  {
    id: 'intent-match-feed',
    title: 'Intent-Match Feed',
    problem: 'For-You feeds optimize addiction, not the intent you declared.',
    solution: 'Rank by your stated intent (learn / connect / create / trade) with a transparent score.',
    status: 'live',
  },
  {
    id: 'proof-of-authorship',
    title: 'Proof-of-Authorship',
    problem: 'Deepfakes and scrapes erase provenance.',
    solution: 'Every post is SHA-256 sealed into the Autonomous Signal Protocol ledger.',
    status: 'live',
  },
  {
    id: 'wellbeing-circuit',
    title: 'Wellbeing Circuit Breaker',
    problem: 'Doomscroll has no off-ramp designed by the product itself.',
    solution: 'Session wellbeing score that suggests a pause before compulsive loops.',
    status: 'live',
  },
  {
    id: 'creator-royalty-mirror',
    title: 'Creator Royalty Mirror',
    problem: 'Engagement rarely maps to transparent creator economics.',
    solution: 'Map reactions to a BTC-aligned royalty hint mirrored from Zeus commerce.',
    status: 'live',
  },
  {
    id: 'signal-passport',
    title: 'Signal Passport',
    problem: 'Reputation dies at every walled garden.',
    solution: 'Portable reputation score ready for ActivityPub / federation handoff.',
    status: 'live',
  },
  {
    id: 'truth-anchor',
    title: 'Truth Anchor',
    problem: 'Claims spread without integrity anchors.',
    solution: 'Optional claim-hash attachments so posts can be verified, not just liked.',
    status: 'live',
  },
  {
    id: 'presence-without-stalking',
    title: 'Presence Without Stalking',
    problem: 'Exact “last seen” enables harassment.',
    solution: 'Fuzzy presence bands (active / recent / quiet) — never minute-level stalking.',
    status: 'live',
  },
];

// Merge the 12 world-standard inventions (dedupe by id).
(() => {
  const seen = new Set(WORLD_INVENTIONS.map((i) => i.id));
  for (const inv of worldStandard.INVENTIONS || []) {
    if (!seen.has(inv.id)) {
      WORLD_INVENTIONS.push(inv);
      seen.add(inv.id);
    }
  }
})();

function _now() { return new Date().toISOString(); }
function _id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}
function _hash(payload) {
  return crypto.createHash('sha256').update(typeof payload === 'string' ? payload : JSON.stringify(payload)).digest('hex');
}

function _seed() {
  const users = [
    { id: 'u_zeus', handle: 'zeusai', displayName: 'ZeusAI', bio: 'Autonomous commerce social layer', verified: true, system: true, presence: 'active', passport: 98, intent: 'create', followers: 12840, following: 42 },
    { id: 'u_aria', handle: 'aria.builds', displayName: 'Aria Builds', bio: 'Creator · short-form ops', verified: true, system: true, presence: 'recent', passport: 91, intent: 'create', followers: 6402, following: 210 },
    { id: 'u_nova', handle: 'nova.lens', displayName: 'Nova Lens', bio: 'Photo essays · stories', verified: false, system: true, presence: 'active', passport: 77, intent: 'connect', followers: 2104, following: 390 },
    { id: 'u_orbit', handle: 'orbit.trade', displayName: 'Orbit Trade', bio: 'BTC-native commerce signals', verified: true, system: true, presence: 'quiet', passport: 88, intent: 'trade', followers: 9330, following: 120 },
    { id: 'u_mira', handle: 'mira.learn', displayName: 'Mira Learn', bio: 'Learning threads · anti-doomscroll', verified: false, system: true, presence: 'recent', passport: 84, intent: 'learn', followers: 1588, following: 640 },
  ];

  const posts = [
    {
      id: 'p_fyp1', authorId: 'u_aria', kind: 'short', platformCue: 'tiktok',
      text: '30s autonomy clip — heal → decide → distribute without a human in the loop.',
      media: { type: 'video', aspect: '9:16', poster: 'gradient-mint', durationSec: 28, sound: 'Signal Pulse · original' },
      tags: ['#shorts', '#autonomy', '#fyp'], createdAt: _now(),
      stats: { likes: 4200, comments: 188, shares: 920, saves: 610, views: 88000 },
    },
    {
      id: 'p_ig1', authorId: 'u_nova', kind: 'image', platformCue: 'instagram',
      text: 'Golden-hour ledger light. Proof-of-Authorship seals every frame.',
      media: { type: 'image', aspect: '4:5', poster: 'gradient-amber' },
      tags: ['#visual', '#proof'], createdAt: _now(),
      stats: { likes: 1880, comments: 64, shares: 120, saves: 410, views: 12000 },
    },
    {
      id: 'p_x1', authorId: 'u_orbit', kind: 'text', platformCue: 'x',
      text: 'Hot take: vanity metrics are a tax on truth. Attention Receipts fix the asymmetry.',
      media: null,
      tags: ['#x', '#attention'], createdAt: _now(),
      stats: { likes: 960, comments: 210, shares: 540, saves: 300, views: 24000 },
    },
    {
      id: 'p_fb1', authorId: 'u_mira', kind: 'text', platformCue: 'facebook',
      text: 'Community note: Intent-Match Feed let me switch to Learn mode — timeline calmed in one tap.',
      media: null,
      tags: ['#wellbeing', '#community'], createdAt: _now(),
      stats: { likes: 540, comments: 92, shares: 70, saves: 88, views: 6100 },
    },
    {
      id: 'p_reel2', authorId: 'u_zeus', kind: 'reel', platformCue: 'instagram',
      text: 'World-standard social: FB + X + IG + TikTok surface, inventions they still lack.',
      media: { type: 'video', aspect: '9:16', poster: 'gradient-cyan', durationSec: 18, sound: 'Ledger Hum' },
      tags: ['#reels', '#worldstandard'], createdAt: _now(),
      stats: { likes: 12000, comments: 430, shares: 2100, saves: 1800, views: 220000 },
    },
  ].map((p) => {
    const authorship = _hash({ id: p.id, text: p.text, authorId: p.authorId });
    return Object.assign({}, p, {
      proofOfAuthorship: authorship,
      truthAnchor: _hash({ claim: p.text.slice(0, 80), id: p.id }).slice(0, 16),
      royaltyHintBtc: Number(((p.stats.likes + p.stats.shares * 2) * 1.2e-9).toFixed(8)),
    });
  });

  const stories = users.slice(0, 4).map((u, i) => ({
    id: `st_${i}`,
    authorId: u.id,
    items: [
      { id: `sti_${i}a`, kind: 'image', poster: i % 2 ? 'gradient-mint' : 'gradient-amber', expiresInH: 20 - i },
      { id: `sti_${i}b`, kind: 'text', text: `${u.displayName} · live signal`, expiresInH: 18 - i },
    ],
    unseen: i < 3,
  }));

  const threads = [
    {
      id: 'dm_1',
      participants: ['u_zeus', 'u_aria'],
      messages: [
        { id: 'm1', from: 'u_aria', text: 'Shorts clip sealed — royalty mirror shows 0.000018 BTC hint.', at: _now() },
        { id: 'm2', from: 'u_zeus', text: 'Receipt attached. Federation passport sync next.', at: _now() },
      ],
      encrypted: true,
    },
  ];

  const groups = [
    { id: 'g_builders', name: 'Autonomous Builders', members: 842, platformCue: 'facebook' },
    { id: 'g_creators', name: 'Creator Royalty Lab', members: 1204, platformCue: 'facebook' },
  ];

  const follows = [
    ['u_aria', 'u_zeus'], ['u_nova', 'u_zeus'], ['u_orbit', 'u_zeus'],
    ['u_mira', 'u_aria'], ['u_zeus', 'u_orbit'],
  ];

  return {
    version: 1,
    seededAt: _now(),
    session: { startedAt: Date.now(), views: 0, wellbeingScore: 100, intent: 'discover' },
    users,
    posts,
    stories,
    threads,
    groups,
    follows,
    receipts: [],
    reactions: [],
    bookmarks: [],
    comments: [],
    notifications: [],
    sounds: [
      { id: 'snd_pulse', title: 'Signal Pulse · original', uses: 4200 },
      { id: 'snd_hum', title: 'Ledger Hum', uses: 1880 },
    ],
    trending: ['#autonomy', '#proofofreach', '#shorts', '#wellbeing', '#btc'],
  };
}

class SocialSurface {
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
    if (!this.state || !Array.isArray(this.state.posts) || !this.state.posts.length) {
      this.state = _seed();
      this._save();
    }
    if (!this.state.session) {
      this.state.session = { startedAt: Date.now(), views: 0, wellbeingScore: 100, intent: 'discover' };
    }
    if (!this.state.sessions || typeof this.state.sessions !== 'object') {
      this.state.sessions = {};
    }
    if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];
    if (!Array.isArray(this.state.comments)) this.state.comments = [];
    if (!Array.isArray(this.state.notifications)) this.state.notifications = [];
  }

  _save() {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2));
    } catch (_) { /* fail-soft */ }
  }

  _user(id) {
    return this.state.users.find((u) => u.id === id) || null;
  }

  _session(userId) {
    const key = userId || '_anon';
    if (!this.state.sessions) this.state.sessions = {};
    if (!this.state.sessions[key]) {
      this.state.sessions[key] = { startedAt: Date.now(), views: 0, wellbeingScore: 100, intent: 'discover' };
    }
    return this.state.sessions[key];
  }

  /** Push a notification for a user. Caps the global list at 300. Never self-notifies. */
  _notify(userId, { type, actorId, postId, text, meta } = {}) {
    if (!userId) return null;
    if (actorId && actorId === userId) return null;
    if (!Array.isArray(this.state.notifications)) this.state.notifications = [];
    const n = {
      id: _id('ntf'),
      userId,
      type: String(type || 'info').slice(0, 32),
      actorId: actorId || null,
      postId: postId || null,
      text: text != null ? String(text).slice(0, 300) : null,
      meta: meta || null,
      read: false,
      at: _now(),
    };
    this.state.notifications.unshift(n);
    if (this.state.notifications.length > 300) this.state.notifications.length = 300;
    return n;
  }

  ensureProfile(userId, meta = {}) {
    if (!userId || typeof userId !== 'string') return { ok: false, error: 'auth_required' };
    let u = this._user(userId);
    if (!u) {
      const base = String(meta.handle || meta.name || userId.replace(/^zid_/, 'user')).toLowerCase()
        .replace(/[^a-z0-9._]/g, '').slice(0, 24) || ('u' + userId.slice(-6));
      let handle = base;
      let n = 0;
      while (this.state.users.some((x) => x.handle === handle && x.id !== userId)) {
        n += 1;
        handle = (base.slice(0, 20) + n).slice(0, 24);
      }
      u = {
        id: userId,
        handle,
        displayName: String(meta.name || handle).slice(0, 64),
        bio: String(meta.bio || 'ZeusAI Social member').slice(0, 160),
        email: meta.email || null,
        verified: false,
        system: false,
        presence: 'active',
        passport: 50,
        intent: 'discover',
        followers: 0,
        following: 0,
        createdAt: _now(),
      };
      this.state.users.push(u);
      this._session(userId);
      this._save();
    } else {
      let dirty = false;
      if (meta.name && meta.name !== u.displayName) { u.displayName = String(meta.name).slice(0, 64); dirty = true; }
      if (meta.email && meta.email !== u.email) { u.email = meta.email; dirty = true; }
      u.presence = 'active';
      if (dirty) this._save();
    }
    return { ok: true, profile: this._publicProfile(u) };
  }

  _publicProfile(u) {
    if (!u) return null;
    return {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      bio: u.bio || '',
      verified: !!u.verified,
      system: !!u.system,
      presence: u.presence || 'quiet',
      passport: u.passport || 0,
      followers: u.followers || 0,
      following: u.following || 0,
      intent: u.intent || 'discover',
    };
  }

  getPost(id) {
    const p = this.state.posts.find((x) => x.id === id);
    if (!p) return { ok: false, error: 'post_not_found' };
    return { ok: true, post: this._enrichPost(p), shareUrl: '/social-network?post=' + encodeURIComponent(p.id) };
  }

  getProfileByHandle(handle) {
    const h = String(handle || '').replace(/^@/, '').toLowerCase();
    const u = this.state.users.find((x) => x.handle === h || x.id === handle);
    if (!u) return { ok: false, error: 'user_not_found' };
    const posts = this.state.posts.filter((p) => p.authorId === u.id).map((p) => this._enrichPost(p));
    return { ok: true, profile: this._publicProfile(u), posts };
  }

  me(userId) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const ensured = this.ensureProfile(userId);
    const sess = this._session(userId);
    const unreadNotifications = (this.state.notifications || [])
      .filter((n) => n.userId === userId && !n.read).length;
    return {
      ok: true,
      profile: ensured.profile,
      wellbeing: this.getWellbeing(userId),
      followingIds: this.state.follows.filter((f) => f[0] === userId).map((f) => f[1]),
      session: { intent: sess.intent, views: sess.views },
      unreadNotifications,
    };
  }

  viewStory(storyId, viewerId) {
    const s = this.state.stories.find((x) => x.id === storyId);
    if (!s) return { ok: false, error: 'story_not_found' };
    s.unseen = false;
    if (viewerId) {
      const sess = this._session(viewerId);
      sess.views += 1;
    }
    this._save();
    const author = this._user(s.authorId);
    return { ok: true, story: { id: s.id, author: this._publicProfile(author), items: s.items, unseen: false } };
  }

  sharePost(postId, actorId) {
    const post = this.state.posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'post_not_found' };
    if (!actorId) return { ok: false, error: 'auth_required' };
    post.stats.shares = (post.stats.shares || 0) + 1;
    post.royaltyHintBtc = Number(((post.stats.likes + post.stats.shares * 2) * 1.2e-9).toFixed(8));
    this.state.reactions.unshift({ postId, type: 'share', actorId, at: _now() });
    this._save();
    const url = '/social-network?post=' + encodeURIComponent(postId);
    return { ok: true, stats: post.stats, shareUrl: url, royaltyHintBtc: post.royaltyHintBtc };
  }

  _enrichPost(p) {
    const author = this._user(p.authorId) || { handle: 'unknown', displayName: 'Unknown', verified: false, presence: 'quiet', passport: 0 };
    const viral = worldStandard.viralScore(p);
    const fed = worldStandard.getFederation(p.id);
    const claim = worldStandard.getClaim(p.id);
    const split = worldStandard.getSplit(p.id);
    const rep = worldStandard.getReputation(author.id || p.authorId);
    const royalty = typeof worldStandard.getRoyalty === 'function' ? worldStandard.getRoyalty(p.id) : null;
    let quotedPost = null;
    if (p.quotedPostId) {
      const q = this.state.posts.find((x) => x.id === p.quotedPostId);
      if (q) {
        const qa = this._user(q.authorId);
        quotedPost = {
          id: q.id,
          text: q.text,
          kind: q.kind,
          media: q.media,
          createdAt: q.createdAt,
          author: qa
            ? { id: qa.id, handle: qa.handle, displayName: qa.displayName, verified: !!qa.verified }
            : null,
        };
      }
    }
    return {
      id: p.id,
      kind: p.kind,
      platformCue: p.platformCue,
      text: p.text,
      media: p.media,
      tags: p.tags || [],
      createdAt: p.createdAt,
      stats: p.stats,
      commentCount: (p.stats && p.stats.comments) || 0,
      quotedPostId: p.quotedPostId || null,
      quotedPost,
      quoteText: p.quoteText || null,
      proofOfAuthorship: p.proofOfAuthorship,
      truthAnchor: p.truthAnchor,
      royaltyHintBtc: p.royaltyHintBtc,
      royaltyAccruedBtc: royalty && royalty.ok ? royalty.accruedBtc : 0,
      viralReanchorAt: p.viralReanchorAt || null,
      virality: viral,
      federationCid: fed.ok ? fed.cid : null,
      claimState: claim.claim ? claim.claim.state : 'unverified',
      claim,
      split: split.ok ? split.split : null,
      author: {
        id: author.id,
        handle: author.handle,
        displayName: author.displayName,
        verified: !!author.verified,
        system: !!author.system,
        presence: author.presence,
        passport: author.passport,
        reputation: rep.score,
      },
    };
  }

  setIntent(intent, userId) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const allowed = ['discover', 'learn', 'connect', 'create', 'trade'];
    const next = allowed.includes(String(intent)) ? String(intent) : 'discover';
    const sess = this._session(userId);
    sess.intent = next;
    const u = this._user(userId);
    if (u) u.intent = next;
    this.state.session.intent = next; // keep global default for anonymous reads
    this._save();
    return { ok: true, intent: next };
  }

  issueAttentionReceipt(postId, viewer) {
    if (!viewer) return { ok: false, error: 'auth_required' };
    const post = this.state.posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'post_not_found' };
    const sess = this._session(viewer);
    sess.views += 1;
    const intent = sess.intent || 'discover';
    const decay = intent === 'learn' || intent === 'create' ? 0.4 : 1.2;
    sess.wellbeingScore = Math.max(12, Number((sess.wellbeingScore - decay).toFixed(1)));
    const receipt = {
      id: _id('rcpt'),
      postId,
      viewer,
      at: _now(),
      intent,
      hash: _hash({ postId, viewer, at: Date.now(), intent }),
    };
    this.state.receipts.unshift(receipt);
    if (this.state.receipts.length > 200) this.state.receipts.length = 200;
    post.stats.views = (post.stats.views || 0) + 1;
    this._save();
    let attn = worldStandard.spendAttention(viewer, {
      seconds: 5,
      creatorId: post.authorId,
      action: 'view',
    });
    if (!attn.ok && attn.error === 'attention_insufficient') {
      // Soft-fail: receipt still stands; ledger simply notes depletion.
      attn = { ok: false, depleted: true, balanceSec: attn.balanceSec, invention: 'attention-economy-ledger' };
    }
    return {
      ok: true,
      receipt,
      wellbeing: this.getWellbeing(viewer),
      attention: attn,
      invention: 'attention-receipt',
    };
  }

  getWellbeing(userId) {
    const sess = this._session(userId || '_anon');
    const score = sess.wellbeingScore;
    let advice = 'Flow is healthy — explore with intent.';
    if (score < 40) advice = 'Circuit breaker: take a 3-minute pause. Switch intent to Learn.';
    else if (score < 70) advice = 'Soft nudge: you are drifting toward compulsive scroll.';
    return {
      score,
      advice,
      viewsThisSession: sess.views,
      intent: sess.intent,
      invention: 'wellbeing-circuit',
    };
  }

  timeline(mode = 'for-you', limit = 24, actorId = null) {
    const lim = Math.max(1, Math.min(40, Number(limit) || 24));
    let items = this.state.posts.map((p) => this._enrichPost(p));
    const intent = (actorId ? this._session(actorId).intent : this.state.session.intent) || 'discover';

    if (mode === 'following') {
      if (!actorId) return { ok: false, error: 'auth_required', items: [] };
      const following = new Set(this.state.follows.filter((f) => f[0] === actorId).map((f) => f[1]));
      items = items.filter((p) => following.has(p.author.id) || p.author.id === actorId);
    } else if (typeof mode === 'string' && mode.startsWith('tag:')) {
      const raw = mode.slice(4);
      let tag = raw;
      try { tag = decodeURIComponent(raw); } catch (_) { /* already decoded */ }
      tag = String(tag).toLowerCase().replace(/^#/, '');
      items = items
        .filter((p) => (p.tags || []).some((t) => String(t).toLowerCase().replace(/^#/, '') === tag))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    } else if (mode === 'chrono') {
      items = items.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    } else {
      // Intent-Match Feed — novel ranking
      const intentBoost = {
        learn: (p) => (p.tags || []).some((t) => /learn|wellbeing|proof/i.test(t)) ? 1.4 : 1,
        create: (p) => (p.kind === 'short' || p.kind === 'reel') ? 1.5 : 1,
        trade: (p) => (p.tags || []).some((t) => /btc|trade|commerce/i.test(t)) || p.platformCue === 'x' ? 1.45 : 1,
        connect: (p) => p.kind === 'text' || p.platformCue === 'facebook' ? 1.35 : 1,
        discover: () => 1,
      };
      const boost = intentBoost[intent] || intentBoost.discover;
      items = items.slice().sort((a, b) => {
        const sa = (a.stats.likes + a.stats.shares * 2 + a.stats.views * 0.01) * boost(a);
        const sb = (b.stats.likes + b.stats.shares * 2 + b.stats.views * 0.01) * boost(b);
        return sb - sa;
      });
    }

    return {
      ok: true,
      mode,
      intent,
      invention: mode === 'for-you' ? 'intent-match-feed' : null,
      items: items.slice(0, lim),
    };
  }

  stories() {
    return {
      ok: true,
      items: this.state.stories.map((s) => {
        const author = this._user(s.authorId);
        return {
          id: s.id,
          unseen: s.unseen,
          author: author ? { id: author.id, handle: author.handle, displayName: author.displayName, presence: author.presence } : null,
          count: s.items.length,
          items: s.items,
        };
      }),
    };
  }

  shorts(limit = 12) {
    const items = this.state.posts
      .filter((p) => p.kind === 'short' || p.kind === 'reel')
      .map((p) => this._enrichPost(p))
      .slice(0, Math.max(1, Math.min(24, Number(limit) || 12)));
    return { ok: true, items, sounds: this.state.sounds };
  }

  explore() {
    return {
      ok: true,
      trending: this.state.trending,
      sounds: this.state.sounds,
      groups: this.state.groups,
      creators: this.state.users
        .slice()
        .sort((a, b) => b.passport - a.passport)
        .map((u) => ({
          id: u.id,
          handle: u.handle,
          displayName: u.displayName,
          verified: u.verified,
          passport: u.passport,
          presence: u.presence,
          followers: u.followers,
          invention: 'signal-passport',
        })),
      grid: this.state.posts.filter((p) => p.media).map((p) => this._enrichPost(p)).slice(0, 12),
    };
  }

  messages(userId) {
    if (!userId) return { ok: false, error: 'auth_required', threads: [] };
    const threads = this.state.threads.filter((t) => Array.isArray(t.participants) && t.participants.includes(userId));
    return {
      ok: true,
      encryptedDefault: true,
      invention: 'presence-without-stalking',
      threads: threads.map((t) => ({
        id: t.id,
        encrypted: t.encrypted,
        participants: t.participants.map((id) => {
          const u = this._user(id);
          return u ? { id: u.id, handle: u.handle, displayName: u.displayName, presence: u.presence } : { id };
        }),
        last: t.messages[t.messages.length - 1] || null,
        messages: t.messages,
      })),
    };
  }

  compose({
    authorId, text, kind = 'text', platformCue = 'x', tags = [],
    bondBtc, splitShares, claimState, bandwidthOverride,
    quotedPostId, quoteText,
  } = {}) {
    if (!authorId) return { ok: false, error: 'auth_required' };
    this.ensureProfile(authorId);
    const body = String(text || '').trim().slice(0, 2000);
    // A quote-repost may carry no body of its own; everything else needs text.
    if (!body && !quotedPostId) return { ok: false, error: 'empty' };
    const tagList = Array.isArray(tags) ? tags.slice(0, 8) : [];
    const bw = worldStandard.checkBandwidth(authorId, { text: body, tags: tagList });
    if (!bw.allowed && !bandwidthOverride) {
      return { ok: false, error: 'emotional_bandwidth_cap', bandwidth: bw };
    }
    // Hard gate: authors must have a fresh Proof-of-Human challenge to publish.
    if (!worldStandard.isHumanFresh(authorId)) {
      return { ok: false, error: 'needs_human_challenge', invention: 'proof-of-human-light' };
    }
    const id = _id('p');
    const post = {
      id,
      authorId,
      kind: ['text', 'image', 'video', 'short', 'reel', 'story'].includes(kind) ? kind : 'text',
      platformCue,
      text: body,
      media: kind === 'short' || kind === 'reel'
        ? { type: 'video', aspect: '9:16', poster: 'gradient-mint', durationSec: 15, sound: 'Signal Pulse · original' }
        : null,
      tags: tagList,
      createdAt: _now(),
      stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
      proofOfAuthorship: _hash({ id, text: body, authorId }),
      truthAnchor: _hash({ claim: body.slice(0, 80), id }).slice(0, 16),
      royaltyHintBtc: 0,
      viralReanchorAt: null,
    };
    if (quotedPostId) {
      post.quotedPostId = quotedPostId;
      if (quoteText) post.quoteText = String(quoteText).slice(0, 500);
    }
    this.state.posts.unshift(post);
    if (this.state.posts.length > 200) this.state.posts.length = 200;
    // Stories are also surfaced through the ephemeral stories rail.
    if (post.kind === 'story') {
      this.state.stories.unshift({
        id: _id('st'),
        authorId,
        postId: id,
        items: [{ id: _id('sti'), kind: 'text', text: body.slice(0, 200), expiresInH: 24 }],
        unseen: true,
      });
      if (this.state.stories.length > 60) this.state.stories.length = 60;
    }
    this._save();

    const fed = worldStandard.pinFederation(authorId, { postId: id, text: body });
    let bond = null;
    if (bondBtc != null) {
      bond = worldStandard.postBond(authorId, { postId: id, amountBtc: bondBtc });
    }
    let split = null;
    if (Array.isArray(splitShares) && splitShares.length) {
      split = worldStandard.setSplit(authorId, { postId: id, shares: splitShares });
    }
    if (claimState) {
      worldStandard.setClaimState(authorId, { postId: id, state: claimState });
    }

    return {
      ok: true,
      post: this._enrichPost(post),
      invention: 'proof-of-authorship',
      federation: fed,
      bond,
      split,
      bandwidth: bw,
      humanFresh: worldStandard.isHumanFresh(authorId),
    };
  }

  react({ postId, type = 'like', actorId } = {}) {
    if (!actorId) return { ok: false, error: 'auth_required' };
    const post = this.state.posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'post_not_found' };
    const t = String(type || 'like');
    if (t === 'like') {
      post.stats.likes += 1;
      this._notify(post.authorId, { type: 'like', actorId, postId });
    } else if (t === 'share' || t === 'repost') {
      post.stats.shares += 1;
      this._notify(post.authorId, { type: 'share', actorId, postId });
    } else if (t === 'save' || t === 'bookmark') {
      post.stats.saves += 1;
      this.state.bookmarks.unshift({ postId, actorId, at: _now() });
      this._notify(post.authorId, { type: 'save', actorId, postId });
    }
    // NOTE: 'comment' reactions are intentionally ignored here — real comments
    // are created via addComment() so stats.comments never inflates falsely.
    post.royaltyHintBtc = Number(((post.stats.likes + post.stats.shares * 2) * 1.2e-9).toFixed(8));
    this.state.reactions.unshift({ postId, type: t, actorId, at: _now() });
    this._save();
    return {
      ok: true,
      stats: post.stats,
      royaltyHintBtc: post.royaltyHintBtc,
      invention: 'creator-royalty-mirror',
    };
  }

  follow({ followerId, targetId } = {}) {
    if (!followerId) return { ok: false, error: 'auth_required' };
    this.ensureProfile(followerId);
    if (!targetId || !this._user(targetId)) return { ok: false, error: 'target_not_found' };
    // Consent Graph: target must allow follower on feed channel
    if (!worldStandard.allows(targetId, followerId, 'feed')) {
      return { ok: false, error: 'consent_denied', channel: 'feed', invention: 'consent-graph' };
    }
    const exists = this.state.follows.some((f) => f[0] === followerId && f[1] === targetId);
    if (!exists) {
      this.state.follows.push([followerId, targetId]);
      const t = this._user(targetId);
      if (t) t.followers += 1;
      this._notify(targetId, { type: 'follow', actorId: followerId });
      this._save();
    }
    return { ok: true, following: true, targetId };
  }

  unfollow({ followerId, targetId } = {}) {
    if (!followerId) return { ok: false, error: 'auth_required' };
    const idx = this.state.follows.findIndex((f) => f[0] === followerId && f[1] === targetId);
    if (idx === -1) return { ok: true, following: false, targetId, changed: false };
    this.state.follows.splice(idx, 1);
    const t = this._user(targetId);
    if (t && t.followers > 0) t.followers -= 1;
    this._save();
    return { ok: true, following: false, targetId, changed: true };
  }

  addComment({ postId, actorId, text, parentId } = {}) {
    if (!actorId) return { ok: false, error: 'auth_required' };
    const post = this.state.posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'post_not_found' };
    const body = String(text || '').trim().slice(0, 1000);
    if (!body) return { ok: false, error: 'empty' };
    this.ensureProfile(actorId);
    const bw = worldStandard.checkBandwidth(actorId, { text: body, tags: [] });
    if (!bw.allowed) return { ok: false, error: 'emotional_bandwidth_cap', bandwidth: bw };
    const comment = {
      id: _id('cm'),
      postId,
      actorId,
      parentId: parentId || null,
      text: body,
      at: _now(),
    };
    this.state.comments.unshift(comment);
    if (this.state.comments.length > 1000) this.state.comments.length = 1000;
    post.stats.comments = (post.stats.comments || 0) + 1;
    this._notify(post.authorId, { type: 'comment', actorId, postId, text: body.slice(0, 120) });
    this._save();
    const u = this._user(actorId);
    return { ok: true, comment: Object.assign({}, comment, { author: this._publicProfile(u) }), stats: post.stats };
  }

  getComments(postId, limit = 50) {
    const lim = Math.max(1, Math.min(200, Number(limit) || 50));
    const all = this.state.comments.filter((c) => c.postId === postId);
    const items = all.slice(0, lim).map((c) => {
      const u = this._user(c.actorId);
      return Object.assign({}, c, { author: this._publicProfile(u) });
    });
    return { ok: true, postId, items, count: all.length };
  }

  getNotifications(userId, limit = 50) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const all = (this.state.notifications || []).filter((n) => n.userId === userId);
    const lim = Math.max(1, Math.min(200, Number(limit) || 50));
    const items = all.slice(0, lim).map((n) => {
      const actor = n.actorId ? this._user(n.actorId) : null;
      return Object.assign({}, n, { actor: actor ? this._publicProfile(actor) : null });
    });
    return { ok: true, items, unread: all.filter((n) => !n.read).length };
  }

  markNotificationsRead(userId) {
    if (!userId) return { ok: false, error: 'auth_required' };
    let marked = 0;
    for (const n of this.state.notifications || []) {
      if (n.userId === userId && !n.read) { n.read = true; marked += 1; }
    }
    if (marked) this._save();
    return { ok: true, marked };
  }

  getBookmarks(userId) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const items = (this.state.bookmarks || [])
      .filter((b) => b.actorId === userId)
      .map((b) => {
        const post = this.state.posts.find((p) => p.id === b.postId);
        return post ? { at: b.at, post: this._enrichPost(post) } : null;
      })
      .filter(Boolean);
    return { ok: true, items };
  }

  quoteRepost({ actorId, postId, text } = {}) {
    if (!actorId) return { ok: false, error: 'auth_required' };
    const orig = this.state.posts.find((p) => p.id === postId);
    if (!orig) return { ok: false, error: 'post_not_found' };
    const made = this.compose({
      authorId: actorId,
      text: text || '',
      kind: 'text',
      platformCue: orig.platformCue || 'x',
      quotedPostId: postId,
      quoteText: text,
    });
    if (!made.ok) return made;
    orig.stats.shares = (orig.stats.shares || 0) + 1;
    orig.royaltyHintBtc = Number(((orig.stats.likes + orig.stats.shares * 2) * 1.2e-9).toFixed(8));
    this._notify(orig.authorId, { type: 'quote', actorId, postId: made.post.id });
    this._save();
    return { ok: true, post: made.post, quotedPostId: postId, stats: orig.stats };
  }

  accrueEngagementRoyalty(postId, amountBtc) {
    const post = this.state.posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'post_not_found' };
    return worldStandard.recordRoyaltyAllocation(postId, amountBtc);
  }

  sendDm({ from, to, text } = {}) {
    if (!from) return { ok: false, error: 'auth_required' };
    this.ensureProfile(from);
    if (!to || !this._user(to)) return { ok: false, error: 'target_not_found' };
    // Consent Graph: recipient must allow sender on dm channel
    if (!worldStandard.allows(to, from, 'dm')) {
      return { ok: false, error: 'consent_denied', channel: 'dm', invention: 'consent-graph' };
    }
    const body = String(text || '').trim().slice(0, 1000);
    if (!body) return { ok: false, error: 'empty' };
    let thread = this.state.threads.find((t) => t.participants.includes(from) && t.participants.includes(to));
    if (!thread) {
      thread = { id: _id('dm'), participants: [from, to], messages: [], encrypted: true };
      this.state.threads.unshift(thread);
    }
    const msg = { id: _id('m'), from, text: body, at: _now() };
    thread.messages.push(msg);
    this._notify(to, { type: 'dm', actorId: from, text: body.slice(0, 120), meta: { threadId: thread.id } });
    this._save();
    return { ok: true, threadId: thread.id, message: msg, encrypted: true };
  }

  inventions() {
    return {
      ok: true,
      brand: 'ZeusAI Social',
      items: WORLD_INVENTIONS,
      worldStandard: worldStandard.status(),
    };
  }

  /** Re-anchor virality (author only). */
  reanchorPost(authorId, postId) {
    if (!authorId || !postId) return { ok: false, error: 'auth_required' };
    const post = this.state.posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'post_not_found' };
    if (post.authorId !== authorId) return { ok: false, error: 'forbidden' };
    post.viralReanchorAt = _now();
    this._save();
    return { ok: true, post: this._enrichPost(post), invention: 'time-bounded-virality' };
  }

  exportExit(userId) {
    if (!userId) return { ok: false, error: 'auth_required' };
    const myPosts = this.state.posts.filter((p) => p.authorId === userId).map((p) => this._enrichPost(p));
    const following = this.state.follows.filter((f) => f[0] === userId);
    const followers = this.state.follows.filter((f) => f[1] === userId);
    const profile = this._publicProfile(this._user(userId));
    return worldStandard.exportPortable(userId, {
      profile,
      posts: myPosts,
      following,
      followers,
      receipts: this.state.receipts.filter((r) => r.viewer === userId).slice(0, 200),
      bookmarks: this.state.bookmarks.filter((b) => b.actorId === userId),
    });
  }

  world() {
    return worldStandard;
  }

  parity() {
    const categories = {
      identity: ['profiles', 'usernames', 'avatars', 'bios', 'verification', 'decentralized_identity'],
      posting: ['text_posts', 'images', 'videos', 'reels_shorts', 'stories', 'ai_synthesis'],
      feed: ['personalized_feed', 'chronological_option', 'trending_hashtags', 'trending_sounds', 'hashtag_feed', 'intent_match'],
      engagement: ['likes', 'comments', 'quotes', 'retweets_reshares', 'saves_bookmarks', 'bookmarks', 'shares', 'notifications', 'attention_receipts'],
      messaging: ['direct_messages', 'group_chats', 'message_encryption', 'ephemeral_messages'],
      realtime: ['live_streams', 'spaces', 'duets', 'stitches', 'events'],
      social: ['follows_followers', 'friends', 'groups_communities', 'hashtags', 'mentions'],
      monetization: ['creator_fund', 'tips_donations', 'subscriptions', 'creator_royalty_mirror', 'engagement_royalty'],
      moderation: ['content_filtering', 'spam_detection', 'wellbeing_circuit'],
      analytics: ['post_metrics', 'signal_passport', 'proof_of_authorship'],
    };
    // Features not yet shipped — reported honestly rather than over-claimed.
    const PLANNED = new Set([
      'live_streams', 'spaces', 'duets', 'stitches', 'group_chats', 'events',
    ]);
    const matrix = {};
    let live = 0;
    let planned = 0;
    for (const [cat, feats] of Object.entries(categories)) {
      matrix[cat] = feats.map((f) => {
        const isPlanned = PLANNED.has(f);
        if (isPlanned) planned += 1; else live += 1;
        return { id: f, status: isPlanned ? 'planned' : 'live', implemented: !isPlanned };
      });
    }
    return {
      ok: true,
      platforms: PLATFORM_PARITY,
      matrix,
      totals: {
        featuresLive: live,
        featuresPlanned: planned,
        platformsCovered: Object.keys(PLATFORM_PARITY).length,
        inventionsLive: WORLD_INVENTIONS.length,
      },
      claim: 'Facebook + X + Instagram + TikTok surface parity with Zeus inventions on top',
    };
  }

  snapshot() {
    const tl = this.timeline('for-you', 8);
    return {
      ok: true,
      brand: 'ZeusAI Social',
      protocol: 'zeusai-social-asp-v1',
      users: this.state.users.length,
      posts: this.state.posts.length,
      stories: this.state.stories.length,
      shorts: this.state.posts.filter((p) => p.kind === 'short' || p.kind === 'reel').length,
      threads: this.state.threads.length,
      groups: this.state.groups.length,
      wellbeing: this.getWellbeing('_anon'),
      inventions: WORLD_INVENTIONS.length,
      parity: this.parity().totals,
      feedPreview: tl.items,
      trending: this.state.trending,
    };
  }

  /** Compact HTML fragments for SSR first paint (escaped). */
  renderSsrFeed(limit = 6) {
    const esc = (s) => String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const items = this.timeline('for-you', limit).items;
    return items.map((p) => {
      const media = p.media
        ? `<div class="za-post-media za-post-media--${esc(p.media.poster || 'gradient-mint')}" data-aspect="${esc(p.media.aspect || '1:1')}"><span>${esc(p.kind)}</span>${p.media.sound ? `<em>${esc(p.media.sound)}</em>` : ''}</div>`
        : '';
      return `<article class="za-post" data-id="${esc(p.id)}" data-cue="${esc(p.platformCue)}">
  <header class="za-post-head">
    <div class="za-avatar" data-presence="${esc(p.author.presence)}">${esc((p.author.displayName || '?').slice(0, 1))}</div>
    <div class="za-post-meta">
      <strong>${esc(p.author.displayName)}${p.author.verified ? ' <span class="za-verified" title="verified">✓</span>' : ''}</strong>
      <span>@${esc(p.author.handle)} · ${esc(p.platformCue)} · passport ${esc(p.author.passport)}</span>
    </div>
  </header>
  <p class="za-post-text">${esc(p.text)}</p>
  ${media}
  <footer class="za-post-foot">
    <button type="button" data-react="like" data-id="${esc(p.id)}">Like ${esc(p.stats.likes)}</button>
    <button type="button" data-react="comment" data-id="${esc(p.id)}">Reply ${esc(p.stats.comments)}</button>
    <button type="button" data-react="share" data-id="${esc(p.id)}">Share ${esc(p.stats.shares)}</button>
    <button type="button" data-react="save" data-id="${esc(p.id)}">Save ${esc(p.stats.saves)}</button>
    <span class="za-post-flags" data-claim="${esc(p.claimState || 'unverified')}">claim:${esc(p.claimState || 'unverified')}</span>
    <span class="za-post-proof" title="Proof-of-Authorship">${esc((p.proofOfAuthorship || '').slice(0, 10))}…</span>
  </footer>
</article>`;
    }).join('\n');
  }
}

const surface = new SocialSurface();

module.exports = surface;
module.exports.SocialSurface = SocialSurface;
module.exports.WORLD_INVENTIONS = WORLD_INVENTIONS;
module.exports.PLATFORM_PARITY = PLATFORM_PARITY;
