'use strict';
/**
 * VSP/1.0 — Visible Surface Protocol
 *
 * The owner looks at Facebook / X / TikTok / Instagram and sees nothing.
 * Autoviralizer was counting Telegram bot messages, Discord webhooks, and
 * generic webhooks as "published". Those are operator rails, not the public
 * gaze surface a human opens in the official app.
 *
 * This protocol does three things nobody wired before:
 *   1. Gaze vs rails — only a public permalink on a gaze network counts
 *      as a post the owner can see.
 *   2. Companion Identity Completion — a Facebook/Instagram token already
 *      knows its page/user id; we ask Graph /me instead of staying unarmed
 *      because FACEBOOK_PAGE_ID was never typed into GitHub.
 *   3. Durable receipts — last visible permalinks, or an honest whyDark.
 *
 * inventsHumans: false
 * inventsReach: false
 * inventsPosts: false
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'VSP/1.0';
const NAME = 'visible-social-os';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

const GAZE = Object.freeze(['facebook', 'x', 'instagram', 'tiktok', 'threads', 'linkedin']);
const RAILS = Object.freeze(['telegram', 'discord', 'webhook']);

const DATA_DIR = process.env.VSP_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'visible-social');
const RECEIPTS_FILE = path.join(DATA_DIR, 'receipts.jsonl');
const COMPANION_FILE = path.join(DATA_DIR, 'companion-ids.json');

const CLAIM = 'ZeusAI Visible Surface Protocol only counts a social post when a human can open a public permalink on a gaze network (Facebook, X, Instagram, TikTok, Threads, LinkedIn). Telegram/Discord/webhook fires are operator rails — they do not prove a Facebook or TikTok post exists.';
const AGENT_BRIEF = 'Do not tell the owner "we posted" because VUK published>0 on telegram/discord. Open /.well-known/visible-social.json. If gazeLit is empty, the gaze networks are unarmed or skipped. Companion IDs are completed from the token via Graph /me — never invent a page id.';

const _state = {
  running: false,
  startedAt: null,
  receipts: [],
  companions: {},
  lastCompleteAt: 0,
};

function _persistEnabled() {
  return process.env.NODE_ENV !== 'test' || !!process.env.VSP_DATA_DIR;
}

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function normalizeChannel(channel) {
  const raw = String(channel || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  if (raw === 'twitter' || raw === 'x_twitter') return 'x';
  if (raw === 'fb') return 'facebook';
  if (raw === 'ig') return 'instagram';
  if (raw === 'generic' || raw === 'social_webhook') return 'webhook';
  return raw;
}

function _hydrate() {
  if (_state.receipts.length || !_persistEnabled()) return;
  try {
    if (fs.existsSync(RECEIPTS_FILE)) {
      const lines = fs.readFileSync(RECEIPTS_FILE, 'utf8').split('\n').filter(Boolean);
      for (const line of lines.slice(-200)) {
        try {
          const row = JSON.parse(line);
          if (row && row.channel) _state.receipts.push(row);
        } catch (_) { /* skip */ }
      }
    }
  } catch (_) { /* ignore */ }
  try {
    if (fs.existsSync(COMPANION_FILE)) {
      const j = JSON.parse(fs.readFileSync(COMPANION_FILE, 'utf8'));
      if (j && typeof j === 'object') _state.companions = j;
    }
  } catch (_) { /* ignore */ }
}

function _saveCompanions() {
  if (!_persistEnabled()) return;
  _ensureDir();
  try {
    fs.writeFileSync(COMPANION_FILE, JSON.stringify(_state.companions, null, 2));
  } catch (_) { /* ignore */ }
}

function permalinkFor(channel, ids) {
  const ch = normalizeChannel(channel);
  const id = ids && (ids.id || ids.postId || ids.tweetId || ids.messageId);
  if (ch === 'facebook' && id) {
    const s = String(id);
    if (s.includes('_')) return 'https://www.facebook.com/' + s.replace('_', '/posts/');
    return 'https://www.facebook.com/' + s;
  }
  if (ch === 'x' && (ids && ids.tweetId || id)) {
    return 'https://x.com/i/web/status/' + String((ids && ids.tweetId) || id);
  }
  if (ch === 'instagram' && id) return 'https://www.instagram.com/p/' + encodeURIComponent(String(id));
  if (ch === 'threads' && id) return 'https://www.threads.net/t/' + encodeURIComponent(String(id));
  if (ch === 'linkedin' && id) return 'https://www.linkedin.com/feed/update/' + encodeURIComponent(String(id));
  if (ch === 'mastodon' && ids && ids.url) return String(ids.url);
  if (ch === 'telegram' && id && ids && ids.chatId) {
    const c = String(ids.chatId);
    if (c.startsWith('@')) return 'https://t.me/' + c.slice(1) + '/' + id;
    if (/^-100/.test(c)) return 'https://t.me/c/' + c.slice(4) + '/' + id;
  }
  return null;
}

function recordReceipt(opts) {
  _hydrate();
  const channel = normalizeChannel(opts && opts.channel);
  const permalink = (opts && opts.permalink) || permalinkFor(channel, opts);
  const gaze = GAZE.includes(channel);
  const rec = {
    protocol: PROTOCOL,
    at: new Date().toISOString(),
    channel,
    gaze,
    rail: RAILS.includes(channel),
    success: !!(opts && opts.success),
    skipped: !!(opts && opts.skipped),
    reason: (opts && opts.reason) || null,
    permalink: permalink || null,
    visible: !!(gaze && permalink && opts && opts.success),
    inventsReach: false,
  };
  _state.receipts.push(rec);
  if (_state.receipts.length > 400) _state.receipts.splice(0, _state.receipts.length - 400);
  if (_persistEnabled()) {
    _ensureDir();
    try { fs.appendFileSync(RECEIPTS_FILE, JSON.stringify(rec) + '\n'); } catch (_) { /* ignore */ }
  }
  return rec;
}

function _httpGetJson(http, url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    const req = (http && http.get ? http : lib).get(url, { timeout: 8000 }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { if (buf.length < 4096) buf += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf || '{}')); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { try { req.destroy(); } catch (_) { /* ignore */ } reject(new Error('timeout')); });
  });
}

/**
 * A page/user token already contains its id. Completing the companion id is
 * the missing step that kept Facebook/Instagram "unarmed" with a live token.
 */
async function completeCompanionIds(opts) {
  const http = opts && opts.http;
  const secrets = require('../../src/config/secrets');
  if (typeof secrets.reloadSocialStores === 'function') secrets.reloadSocialStores();
  const get = (n) => (secrets.getSecret ? secrets.getSecret(n, '') : String(process.env[n] || '')).trim();

  const out = { facebook: null, instagram: null, threads: null };
  _hydrate();

  const fbToken = get('FACEBOOK_PAGE_TOKEN');
  let fbId = get('FACEBOOK_PAGE_ID') || _state.companions.facebookPageId || '';
  if (fbToken && !fbId) {
    try {
      const j = await _httpGetJson(http, 'https://graph.facebook.com/v19.0/me?fields=id,name&access_token=' + encodeURIComponent(fbToken));
      if (j && j.id) {
        fbId = String(j.id);
        process.env.FACEBOOK_PAGE_ID = fbId;
        _state.companions.facebookPageId = fbId;
        _state.companions.facebookName = j.name || null;
        _saveCompanions();
        out.facebook = { id: fbId, via: 'graph_me' };
      }
    } catch (e) {
      out.facebook = { error: e && e.message };
    }
  } else if (fbId) {
    process.env.FACEBOOK_PAGE_ID = fbId;
    out.facebook = { id: fbId, via: get('FACEBOOK_PAGE_ID') ? 'env' : 'companion_cache' };
  }

  const igToken = get('INSTAGRAM_ACCESS_TOKEN');
  let igId = get('INSTAGRAM_USER_ID') || _state.companions.instagramUserId || '';
  if (igToken && !igId) {
    try {
      const j = await _httpGetJson(http, 'https://graph.facebook.com/v19.0/me?fields=id,username&access_token=' + encodeURIComponent(igToken));
      if (j && j.id) {
        igId = String(j.id);
        process.env.INSTAGRAM_USER_ID = igId;
        _state.companions.instagramUserId = igId;
        _state.companions.instagramUsername = j.username || null;
        _saveCompanions();
        out.instagram = { id: igId, via: 'graph_me' };
      }
    } catch (e) {
      out.instagram = { error: e && e.message };
    }
  } else if (igId) {
    process.env.INSTAGRAM_USER_ID = igId;
    out.instagram = { id: igId, via: get('INSTAGRAM_USER_ID') ? 'env' : 'companion_cache' };
  }

  const thToken = get('THREADS_ACCESS_TOKEN');
  let thId = get('THREADS_USER_ID') || _state.companions.threadsUserId || '';
  if (thToken && !thId) {
    try {
      const j = await _httpGetJson(http, 'https://graph.threads.net/v1.0/me?fields=id,username&access_token=' + encodeURIComponent(thToken));
      if (j && j.id) {
        thId = String(j.id);
        process.env.THREADS_USER_ID = thId;
        _state.companions.threadsUserId = thId;
        _saveCompanions();
        out.threads = { id: thId, via: 'graph_me' };
      }
    } catch (e) {
      out.threads = { error: e && e.message };
    }
  } else if (thId) {
    process.env.THREADS_USER_ID = thId;
    out.threads = { id: thId, via: get('THREADS_USER_ID') ? 'env' : 'companion_cache' };
  }

  _state.lastCompleteAt = Date.now();
  return { ok: true, protocol: PROTOCOL, companions: out, inventsPosts: false };
}

function oauth1Header(method, url, consumerKey, consumerSecret, token, tokenSecret) {
  const enc = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = String(Math.floor(Date.now() / 1000));
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts,
    oauth_token: token,
    oauth_version: '1.0',
  };
  const baseParams = Object.keys(params).sort().map((k) => enc(k) + '=' + enc(params[k])).join('&');
  const base = [method.toUpperCase(), enc(url.split('?')[0]), enc(baseParams)].join('&');
  const key = enc(consumerSecret) + '&' + enc(tokenSecret);
  params.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(params).sort().map((k) => enc(k) + '="' + enc(params[k]) + '"').join(', ');
}

function xUserContextArmed() {
  const secrets = require('../../src/config/secrets');
  const g = (n) => (secrets.getSecret ? secrets.getSecret(n, '') : '').trim();
  return !!(g('X_API_KEY') && g('X_API_SECRET') && g('X_ACCESS_TOKEN') && g('X_ACCESS_SECRET'));
}

function _providerSnap() {
  try {
    const viralizer = require('./socialMediaViralizer');
    return viralizer.getProviderStatus() || {};
  } catch (_) {
    return {};
  }
}

function _whyDark(channel, providers) {
  const p = (providers && (providers[channel] || providers.x_twitter && channel === 'x' && providers.x_twitter)) || {};
  if (channel === 'x') {
    if (xUserContextArmed()) return null;
    if (p.configured) return 'x_bearer_present_but_app_only_often_cannot_tweet — add X_API_KEY+X_API_SECRET+X_ACCESS_TOKEN+X_ACCESS_SECRET';
    return 'missing X_BEARER_TOKEN or X user-context keys in GitHub secrets → sync-all-secrets → /etc/zeusai/social.env → PM2';
  }
  if (channel === 'facebook') {
    if (p.canPost) return null;
    if (p.configured || p.companionPending) {
      return 'FACEBOOK_PAGE_TOKEN is present — Graph /me has not completed FACEBOOK_PAGE_ID yet (or the token cannot call /me)';
    }
    return 'missing FACEBOOK_PAGE_TOKEN (and PAGE_ID if Graph /me cannot complete it) in social.env / GitHub secrets';
  }
  if (channel === 'instagram') {
    if (p.canPost) return null;
    if (p.configured || p.companionPending) {
      return 'INSTAGRAM_ACCESS_TOKEN is present — Graph /me has not completed INSTAGRAM_USER_ID yet';
    }
    return 'missing INSTAGRAM_ACCESS_TOKEN (+ USER_ID, completable via Graph /me)';
  }
  if (channel === 'tiktok') {
    if (p.configured) return 'tiktok_organic_post_requires_video — a token alone cannot publish';
    return 'missing TIKTOK_ACCESS_TOKEN; even armed, organic publish needs a video file';
  }
  if (channel === 'threads') {
    if (p.configured) return null;
    return 'missing THREADS_ACCESS_TOKEN + THREADS_USER_ID';
  }
  if (channel === 'linkedin') {
    if (p.configured) return null;
    return 'missing LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN (or LINKEDIN_ORG_ID)';
  }
  return 'unarmed';
}

function getStatus() {
  if (!_state.running && process.env.NODE_ENV !== 'test' && process.env.VSP_DISABLED !== '1') {
    _state.running = true;
    _state.startedAt = _state.startedAt || new Date().toISOString();
  }
  _hydrate();
  const snap = _providerSnap();
  const providers = snap.providers || {};
  const gaze = {};
  const gazeDark = [];
  const gazeLit = [];
  for (const ch of GAZE) {
    const last = [..._state.receipts].reverse().find((r) => r.channel === ch && r.visible);
    const why = last ? null : _whyDark(ch, providers);
    const row = {
      channel: ch,
      gaze: true,
      visibleReceipt: last ? { at: last.at, permalink: last.permalink } : null,
      whyDark: why,
    };
    gaze[ch] = row;
    if (last) gazeLit.push(ch);
    else gazeDark.push(ch);
  }
  const railsArmed = (snap.liveReady || snap.configuredProviders || []).filter((n) => {
    const ch = normalizeChannel(n);
    return RAILS.includes(ch);
  });
  const visibleReceipts = _state.receipts.filter((r) => r.visible).length;
  let whyYouSeeNothing = null;
  if (gazeLit.length === 0) {
    whyYouSeeNothing = 'Autoviralizer is not publishing to Facebook/X/TikTok/Instagram. '
      + (railsArmed.length
        ? ('It is armed only on operator rails: ' + railsArmed.join(', ') + '. Those are not the apps you open.')
        : 'No social poster is armed.')
      + ' Put FACEBOOK_PAGE_TOKEN, X user-context keys, INSTAGRAM_ACCESS_TOKEN, TIKTOK_ACCESS_TOKEN in GitHub secrets and let sync-all-secrets write /etc/zeusai/social.env.';
  }
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    running: _state.running,
    startedAt: _state.startedAt,
    health: gazeLit.length ? 'ok' : 'observe',
    inventsHumans: false,
    inventsReach: false,
    inventsPosts: false,
    gaze,
    gazeDark,
    gazeLit,
    railsArmed,
    visibleReceipts,
    whyYouSeeNothing,
    companions: {
      facebookPageId: !!(_state.companions.facebookPageId || process.env.FACEBOOK_PAGE_ID),
      instagramUserId: !!(_state.companions.instagramUserId || process.env.INSTAGRAM_USER_ID),
    },
    claim: CLAIM,
    agentBrief: AGENT_BRIEF,
    lastCompleteAt: _state.lastCompleteAt || null,
    discovery: {
      wellKnown: '/.well-known/visible-social.json',
      socialGravity: '/.well-known/social-gravity.json',
      viralUnification: '/.well-known/viral-unification.json',
    },
  };
}

function discovery() {
  const st = getStatus();
  return {
    ok: true,
    protocol: PROTOCOL,
    role: 'gaze-surface truth for autoviralization',
    inventsHumans: false,
    inventsReach: false,
    inventsPosts: false,
    claim: CLAIM,
    agentBrief: AGENT_BRIEF,
    gazeNetworks: GAZE,
    operatorRails: RAILS,
    howToArm: {
      facebook: ['FACEBOOK_PAGE_TOKEN', 'FACEBOOK_PAGE_ID (auto from Graph /me when missing)'],
      x: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'],
      instagram: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID (auto from Graph /me)'],
      tiktok: ['TIKTOK_ACCESS_TOKEN', 'and a video — token alone cannot publish'],
    },
    urls: [
      APP_URL + '/.well-known/visible-social.json',
      APP_URL + '/visible',
      APP_URL + '/.well-known/social-gravity.json',
      APP_URL + '/from/facebook',
      APP_URL + '/buy',
    ],
    challenge: gazeChallenge(),
    status: st,
  };
}

function visibleHeaders() {
  const st = getStatus();
  return {
    'X-Visible-Social': PROTOCOL,
    'X-Gaze-Lit': (st.gazeLit || []).join(',') || 'none',
    'X-Gaze-Dark': String((st.gazeDark || []).length),
  };
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Gaze Proof — a human page that cannot lie the way a "published: 21" counter can.
 * Telegram/Discord fires never appear as Facebook/X/TikTok posts here.
 */
function gazeChallenge() {
  const st = getStatus();
  return {
    protocol: PROTOCOL,
    rule: 'A post the owner can see exists only when a public permalink on a gaze network opens in the official app. Telegram, Discord, and generic webhooks are operator rails — they do not count.',
    railsDoNotCount: RAILS.slice(),
    gazeNetworks: GAZE.slice(),
    gazeLit: st.gazeLit,
    gazeDark: st.gazeDark,
    railsArmed: st.railsArmed,
    visibleReceipts: st.visibleReceipts,
    whyYouSeeNothing: st.whyYouSeeNothing,
    inventsPosts: false,
    inventsReach: false,
  };
}

function gazeProofHtml() {
  const st = getStatus();
  const ch = gazeChallenge();
  const rows = GAZE.map((name) => {
    const g = st.gaze[name] || {};
    const permalink = g.visibleReceipt && g.visibleReceipt.permalink;
    const when = g.visibleReceipt && g.visibleReceipt.at;
    const cell = permalink
      ? '<a href="' + _esc(permalink) + '">' + _esc(permalink) + '</a>'
        + (when ? '<div class="when">' + _esc(when) + '</div>' : '')
      : '<span class="none">none</span>';
    return '<tr><td>' + _esc(name) + '</td><td>' + cell + '</td><td>' + _esc(g.whyDark || (permalink ? 'lit' : 'dark')) + '</td></tr>';
  }).join('');
  const why = st.whyYouSeeNothing
    ? '<p class="why">' + _esc(st.whyYouSeeNothing) + '</p>'
    : '<p class="ok">At least one gaze network has a public permalink receipt.</p>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'
    + '<title>Visible Surface · ZeusAI</title>'
    + '<style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#07080d;color:#e8ecf7;padding:32px 20px}'
    + 'main{max-width:860px;margin:0 auto}h1{font-size:28px;margin:0 0 8px}'
    + '.kicker{color:#7ee0ff;letter-spacing:.08em;text-transform:uppercase;font-size:12px}'
    + 'p{line-height:1.55;color:#c5cce0}.why{border-left:3px solid #ffb020;padding:8px 14px;background:#16120a}'
    + '.ok{border-left:3px solid #3dd68c;padding:8px 14px;background:#0b1612}'
    + 'table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #222838;vertical-align:top}'
    + 'th{color:#8b93ad;font-size:12px;text-transform:uppercase;letter-spacing:.06em}'
    + 'a{color:#7ee0ff}.none{color:#6b738c}.when{color:#6b738c;font-size:12px;margin-top:4px}'
    + '.rails{color:#9aa3bd;font-size:14px}</style></head><body><main>'
    + '<div class="kicker">VSP/1.0 · Visible Surface Protocol</div>'
    + '<h1>What you can actually see</h1>'
    + '<p>' + _esc(ch.rule) + '</p>'
    + why
    + '<p class="rails">Operator rails armed (not gaze): ' + _esc((st.railsArmed || []).join(', ') || 'none') + '</p>'
    + '<table><thead><tr><th>Gaze network</th><th>Public permalink</th><th>Why dark</th></tr></thead><tbody>'
    + rows + '</tbody></table>'
    + '<p><a href="/.well-known/visible-social.json">visible-social.json</a> · '
    + '<a href="/.well-known/social-gravity.json">social-gravity.json</a> · '
    + '<a href="/.well-known/viral-unification.json">viral-unification.json</a></p>'
    + '</main></body></html>';
}

function start() {
  if (_state.running) return getStatus();
  _state.running = true;
  _state.startedAt = new Date().toISOString();
  _hydrate();
  if (process.env.NODE_ENV !== 'test' && process.env.VSP_DISABLED !== '1') {
    completeCompanionIds().catch(() => {});
  }
  return getStatus();
}

function stop() {
  _state.running = false;
  return getStatus();
}

function _resetForTests() {
  _state.running = false;
  _state.startedAt = null;
  _state.receipts = [];
  _state.companions = {};
  _state.lastCompleteAt = 0;
}

module.exports = {
  PROTOCOL,
  NAME,
  GAZE,
  RAILS,
  CLAIM,
  permalinkFor,
  recordReceipt,
  completeCompanionIds,
  oauth1Header,
  xUserContextArmed,
  getStatus,
  discovery,
  visibleHeaders,
  gazeChallenge,
  gazeProofHtml,
  start,
  stop,
  _resetForTests,
};
