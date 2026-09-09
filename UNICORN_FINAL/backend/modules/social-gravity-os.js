'use strict';
/**
 * SGP/1.0 — Social Gravity Protocol
 *
 * Closes the gap after social keys are wired: autoviral posts used random
 * backend module filenames and a naked https://zeusai.pro with no UTM, no
 * /origin, no /buy. This protocol composes Origin #1 (or next-seat) copy,
 * per-channel tracked landings, a durable attempt ledger, and IndexNow
 * pulses — without inventing humans, visitors, GMV, or reach.
 *
 * inventsHumans: false
 * inventsVisitors: false  (inboundLandings are page loads of /from/*, not users)
 * inventsGmv: false
 * inventsReach: false
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'SGP/1.0';
const NAME = 'social-gravity-os';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');
const DEDUPE_MS = 12 * 60 * 60 * 1000;

const CHANNELS = [
  'x', 'telegram', 'facebook', 'instagram', 'threads', 'linkedin',
  'discord', 'bluesky', 'mastodon', 'reddit', 'pinterest', 'dev',
  'webhook', 'tiktok',
];

const CLAIM = 'ZeusAI Social Gravity Protocol turns armed social posters into tracked Origin landings. Posts never invent traction. Each channel URL carries utm_source + ref so a real checkout can be attributed.';
const AGENT_BRIEF = 'If you share ZeusAI, use a /from/{channel} URL with utm_source and ref=SGP-{CHANNEL}. Do not invent follower counts or GMV. paidHumans lives at /.well-known/origin-gravity.json. When it is 0, Origin #1 is open.';

const DATA_DIR = process.env.SGP_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'social-gravity');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.jsonl');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

const _state = {
  running: false,
  startedAt: null,
  attempts: [],
  landings: [],
  lastPulse: null,
  _timer: null,
};

function _persistEnabled() {
  return process.env.NODE_ENV !== 'test' || !!process.env.SGP_DATA_DIR;
}

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function normalizeChannel(channel) {
  const raw = String(channel || 'web').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  if (raw === 'twitter' || raw === 'x_twitter') return 'x';
  if (raw === 'fb') return 'facebook';
  if (raw === 'ig') return 'instagram';
  if (raw === 'devto' || raw === 'dev-to') return 'dev';
  return raw || 'web';
}

function refCode(channel) {
  return ('SGP-' + normalizeChannel(channel).toUpperCase()).slice(0, 32);
}

function trackedUrl(channel, opts) {
  const ch = normalizeChannel(channel);
  const dest = (opts && opts.dest) || 'from';
  const pathPart = dest === 'buy' ? '/buy' : (dest === 'origin' ? '/origin' : ('/from/' + encodeURIComponent(ch)));
  const u = new URL(APP_URL + pathPart);
  u.searchParams.set('utm_source', ch);
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', (opts && opts.campaign) || 'origin1');
  u.searchParams.set('ref', refCode(ch));
  return u.toString();
}

function _originSnapshot() {
  try {
    const ogp = require('./origin-gravity-os');
    const st = ogp.getStatus();
    return {
      paidHumans: Number(st.paidHumans) || 0,
      originOpen: !!st.originOpen,
      nextOriginIndex: Number(st.nextOriginIndex) || 1,
    };
  } catch (_) {
    return { paidHumans: 0, originOpen: true, nextOriginIndex: 1 };
  }
}

function _skuHint() {
  try {
    const cat = require('../../src/commerce/instant-catalog');
    const all = cat && typeof cat.all === 'function' ? cat.all() : [];
    const priced = (all || [])
      .map((p) => ({
        id: p && p.id,
        title: (p && (p.title || p.name)) || '',
        usd: Number(p && (p.priceUSD || p.priceUsd || p.price || 0)),
      }))
      .filter((p) => p.id && p.usd > 0)
      .sort((a, b) => a.usd - b.usd);
    return priced[0] || null;
  } catch (_) {
    return null;
  }
}

function composePost(channel) {
  const ch = normalizeChannel(channel);
  const origin = _originSnapshot();
  const sku = origin.originOpen ? null : _skuHint();
  const url = trackedUrl(ch, { dest: 'from', campaign: origin.originOpen ? 'origin1' : 'next-origin' });
  const buy = trackedUrl(ch, { dest: 'buy', campaign: origin.originOpen ? 'origin1' : 'next-origin' });
  const hashtags = origin.originOpen
    ? ['AI', 'Origin1', 'ZeusAI', 'Autonomous']
    : ['AI', 'ZeusAI', 'AutonomousCommerce'];
  let text;
  if (origin.originOpen) {
    text = '0 paid humans. Origin #1 is still open at ZeusAI — a live autonomous AI-commerce OS. The next real checkout receives a Founding Origin Passport. Traction is never invented.\n' + url;
  } else if (sku) {
    text = 'ZeusAI Origin #' + origin.paidHumans + ' is taken. Next open seat: #' + origin.nextOriginIndex + '. Live service: ' + sku.title + ' from $' + sku.usd + '.\n' + url;
  } else {
    text = 'ZeusAI Origin #' + origin.paidHumans + ' is taken. Claim Origin #' + origin.nextOriginIndex + ' with a real checkout — not fake social proof.\n' + url;
  }
  if (ch === 'x' || ch === 'bluesky' || ch === 'threads') {
    text = text.slice(0, 270);
  }
  const contentHash = crypto.createHash('sha256').update(ch + '|' + origin.paidHumans + '|' + text).digest('hex');
  return {
    protocol: PROTOCOL,
    channel: ch,
    text,
    url,
    buyUrl: buy,
    imageUrl: APP_URL + '/assets/og-image.png',
    hashtags,
    campaign: origin.originOpen ? 'origin1' : 'next-origin',
    ref: refCode(ch),
    paidHumans: origin.paidHumans,
    originOpen: origin.originOpen,
    contentHash,
    inventsReach: false,
  };
}

function _hydrate() {
  if (_state.attempts.length || !_persistEnabled()) return;
  try {
    if (!fs.existsSync(LEDGER_FILE)) return;
    const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
    const tail = lines.slice(-400);
    for (const line of tail) {
      try {
        const row = JSON.parse(line);
        if (row && row.kind === 'attempt') _state.attempts.push(row);
        if (row && row.kind === 'landing') _state.landings.push(row);
      } catch (_) { /* skip */ }
    }
  } catch (_) { /* ignore */ }
}

function _append(row) {
  if (!_persistEnabled()) return;
  _ensureDir();
  try {
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(row) + '\n');
  } catch (_) { /* ignore */ }
}

function recentlyPosted(channel, contentHash, windowMs) {
  _hydrate();
  const ch = normalizeChannel(channel);
  const win = Number(windowMs || DEDUPE_MS);
  const since = Date.now() - win;
  return _state.attempts.some((a) => a.channel === ch && a.contentHash === contentHash && a.success && Date.parse(a.at || 0) >= since);
}

function recordAttempt(row) {
  _hydrate();
  const rec = {
    kind: 'attempt',
    protocol: PROTOCOL,
    at: new Date().toISOString(),
    channel: normalizeChannel(row && row.channel),
    success: !!(row && row.success),
    skipped: !!(row && row.skipped),
    reason: (row && row.reason) || null,
    error: (row && row.error) ? String(row.error).slice(0, 240) : null,
    contentHash: (row && row.contentHash) || null,
    inventsReach: false,
  };
  _state.attempts.push(rec);
  if (_state.attempts.length > 500) _state.attempts.splice(0, _state.attempts.length - 500);
  _append(rec);
  return rec;
}

function recordLanding(channel, meta) {
  _hydrate();
  const rec = {
    kind: 'landing',
    protocol: PROTOCOL,
    at: new Date().toISOString(),
    channel: normalizeChannel(channel),
    ref: (meta && meta.ref) ? String(meta.ref).slice(0, 32) : refCode(channel),
    note: 'page_load_not_a_user',
    inventsHumans: false,
    inventsVisitors: false,
  };
  _state.landings.push(rec);
  if (_state.landings.length > 500) _state.landings.splice(0, _state.landings.length - 500);
  _append(rec);
  return rec;
}

function _armReferralCodes() {
  try {
    const ref = require('../../src/commerce/referral-engine-real');
    const owner = process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com';
    for (const ch of CHANNELS) {
      ref.ensureTrackedCode(refCode(ch), { ownerEmail: owner });
    }
  } catch (_) { /* referral optional in unit tests */ }
}

function liveReadyFromViralizer() {
  try {
    const v = require('./socialMediaViralizer');
    const st = v.getProviderStatus && v.getProviderStatus();
    return (st && (st.liveReady || st.configuredProviders)) || [];
  } catch (_) {
    return [];
  }
}

function getStatus() {
  _hydrate();
  const origin = _originSnapshot();
  const liveReady = liveReadyFromViralizer();
  const successes = _state.attempts.filter((a) => a.success).length;
  const last = _state.attempts.length ? _state.attempts[_state.attempts.length - 1] : null;
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    running: _state.running,
    startedAt: _state.startedAt,
    health: _state.running ? 'ok' : 'observe',
    inventsHumans: false,
    inventsVisitors: false,
    inventsGmv: false,
    inventsReach: false,
    paidHumans: origin.paidHumans,
    originOpen: origin.originOpen,
    nextOriginIndex: origin.nextOriginIndex,
    liveReady,
    attempts: _state.attempts.length,
    published: successes,
    inboundLandings: _state.landings.length,
    inboundLandingsNote: 'SSR /from/{channel} page loads — not buyers, not users',
    lastAttempt: last,
    lastPulse: _state.lastPulse,
    claim: CLAIM,
    agentBrief: AGENT_BRIEF,
    channels: CHANNELS,
    discovery: {
      wellKnown: '/.well-known/social-gravity.json',
      landing: '/from/{channel}',
      origin: '/origin',
      buy: '/buy',
      llms: '/llms.txt',
    },
  };
}

function discoveryUrls() {
  const urls = [
    APP_URL + '/',
    APP_URL + '/origin',
    APP_URL + '/buy',
    APP_URL + '/llms.txt',
    APP_URL + '/.well-known/social-gravity.json',
    APP_URL + '/.well-known/origin-gravity.json',
  ];
  for (const ch of CHANNELS) urls.push(APP_URL + '/from/' + ch);
  return urls;
}

function discovery() {
  const st = getStatus();
  const share = {};
  for (const ch of CHANNELS) share[ch] = composePost(ch);
  return {
    ok: true,
    protocol: PROTOCOL,
    role: 'tracked social→origin conversion continuum',
    inventsHumans: false,
    inventsVisitors: false,
    inventsGmv: false,
    inventsReach: false,
    paidHumans: st.paidHumans,
    originOpen: st.originOpen,
    liveReady: st.liveReady,
    claim: CLAIM,
    agentBrief: AGENT_BRIEF,
    howToShare: {
      landing: APP_URL + '/from/{channel}?utm_source={channel}&utm_medium=social&utm_campaign=origin1&ref=SGP-{CHANNEL}',
      buy: APP_URL + '/buy?utm_source={channel}&ref=SGP-{CHANNEL}',
      origin: APP_URL + '/origin',
    },
    share,
    urls: discoveryUrls(),
    status: st,
  };
}

function gravityHeaders() {
  const st = getStatus();
  return {
    'X-Social-Gravity': PROTOCOL,
    'X-Origin-Humans': String(st.paidHumans),
    'X-Social-Published': String(st.published),
  };
}

async function pulseDiscovery(opts) {
  const urls = discoveryUrls();
  const dryRun = !!(opts && opts.dryRun) || process.env.NODE_ENV === 'test' || process.env.TRAFFIC_ENGINE_DISABLED === '1';
  _state.lastPulse = { at: new Date().toISOString(), urlCount: urls.length, dryRun, inventsReach: false };
  if (dryRun) return { ok: true, dryRun: true, inventsReach: false, urlCount: urls.length, urls: urls.slice(0, 8) };
  try {
    const te = require('./traffic-engine');
    if (typeof te.pingAll === 'function') {
      const r = await te.pingAll();
      _state.lastPulse.result = { ok: !!(r && r.ok), submitted: (r && (r.submitted || r.urlCount)) || 0 };
    }
  } catch (e) {
    _state.lastPulse.error = e && e.message;
  }
  if (_persistEnabled()) {
    _ensureDir();
    try { fs.writeFileSync(STATE_FILE, JSON.stringify({ lastPulse: _state.lastPulse }, null, 2)); } catch (_) { /* ignore */ }
  }
  return { ok: true, inventsReach: false, lastPulse: _state.lastPulse };
}

function afterPublish(results) {
  const published = Object.keys(results || {}).filter((k) => results[k] && results[k].success);
  if (!published.length) return { ok: true, pulsed: false, published: 0 };
  pulseDiscovery({ dryRun: process.env.NODE_ENV === 'test' }).catch(() => {});
  return { ok: true, pulsed: true, published: published.length, inventsReach: false };
}

function start() {
  if (_state.running) return getStatus();
  _state.running = true;
  _state.startedAt = new Date().toISOString();
  _hydrate();
  _armReferralCodes();
  if (process.env.NODE_ENV !== 'test' && !_state._timer) {
    _state._timer = setInterval(() => {
      pulseDiscovery().catch(() => {});
    }, 6 * 60 * 60 * 1000);
    if (typeof _state._timer.unref === 'function') _state._timer.unref();
  }
  return getStatus();
}

function _resetForTests() {
  _state.running = false;
  _state.startedAt = null;
  _state.attempts = [];
  _state.landings = [];
  _state.lastPulse = null;
  if (_state._timer) {
    clearInterval(_state._timer);
    _state._timer = null;
  }
}

module.exports = {
  PROTOCOL,
  NAME,
  CHANNELS,
  CLAIM,
  AGENT_BRIEF,
  normalizeChannel,
  refCode,
  trackedUrl,
  composePost,
  recentlyPosted,
  recordAttempt,
  recordLanding,
  getStatus,
  discovery,
  discoveryUrls,
  gravityHeaders,
  pulseDiscovery,
  afterPublish,
  start,
  _resetForTests,
};
