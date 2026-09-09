'use strict';
/**
 * VUK/1.0 — Viral Unification Kernel
 *
 * ZeusAI had many independent autoviral loops (socialMediaViralizer,
 * outbound-publisher, AACOS, autoViralGrowth, CVR, TPG, social-orchestrator,
 * plus overlapping IndexNow timers). They raced on the same Telegram/X/Discord
 * credentials and often posted competing copy (homepage dumps vs Origin landings).
 *
 * This kernel does not replace those organs. It is the single outbound mutex:
 *   - admit() before any HTTP social post
 *   - canonicalizeIntent() so site-viral copy carries SGP /from/{channel} + UTM
 *   - shouldRunFullCycle() so only the designated executor (viralizer) blasts
 *     every channel; AACOS/CVR/autoViralGrowth become clients, not rivals
 *   - IndexNow pulses coalesce through traffic-engine.pingAll
 *
 * inventsHumans: false
 * inventsVisitors: false
 * inventsGmv: false
 * inventsReach: false
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'VUK/1.0';
const NAME = 'viral-unification-os';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

const CHANNEL_MS = Math.max(60_000, Number(process.env.VUK_CHANNEL_MS) || 12 * 60 * 60 * 1000);
const FULL_CYCLE_MS = Math.max(60_000, Number(process.env.VUK_FULL_CYCLE_MS) || 6 * 60 * 60 * 1000);
const INDEXNOW_MS = Math.max(30_000, Number(process.env.VUK_INDEXNOW_MS) || 55 * 60 * 1000);
const GROUP_MS = Math.max(30_000, Number(process.env.VUK_GROUP_MS) || 45 * 60 * 1000);
const FAIL_MS = Math.max(15_000, Number(process.env.VUK_FAIL_MS) || 15 * 60 * 1000);
const INFLIGHT_MS = 60_000;

const EXEMPT = new Set(['rss']);
const DESIGNATED = /^(viralizer|socialmediaviralizer|admin|manual|post-now)$/i;

const ORGANS = [
  { name: 'socialMediaViralizer', role: 'designated_executor', posts: true },
  { name: 'social-gravity-os', role: 'copy_contract', posts: false },
  { name: 'outbound-publisher', role: 'gated_adapter', posts: true },
  { name: 'autonomy-action-continuum-os', role: 'client', posts: false },
  { name: 'autoViralGrowth', role: 'metrics_client', posts: false },
  { name: 'growthCausalitySentinel', role: 'gated_client', posts: true },
  { name: 'telegram-profit-group-os', role: 'group_value', posts: true },
  { name: 'social-orchestrator', role: 'dry_preview', posts: false },
  { name: 'traffic-engine', role: 'indexnow_coalesce', posts: false },
  { name: 'origin-gravity-os', role: 'origin_copy', posts: false },
];

const CLAIM = 'ZeusAI Viral Unification Kernel is the single outbound mutex for site autoviralization. Organs still exist; they cannot double-post the same channel. Copy is Social Gravity. Traction is never invented.';
const AGENT_BRIEF = 'Do not run a second social poster beside VUK. Compose via /.well-known/social-gravity.json, publish through the designated executor (socialMediaViralizer), and treat inboundLandings as page loads — not users.';

const DATA_DIR = process.env.VUK_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'viral-unification');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.jsonl');

const _state = {
  running: false,
  startedAt: null,
  posts: [],
  lastFullCycleAt: 0,
  lastFullCycleSource: null,
  lastIndexNowAt: 0,
  admitted: 0,
  skipped: 0,
  recorded: 0,
};
const _inflight = new Map(); // key → ts

function _persistEnabled() {
  return process.env.NODE_ENV !== 'test' || !!process.env.VUK_DATA_DIR;
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
  if (raw === 'generic' || raw === 'social_webhook') return 'webhook';
  return raw || 'web';
}

function _hydrate() {
  if (_state.posts.length || !_persistEnabled()) return;
  try {
    if (!fs.existsSync(LEDGER_FILE)) return;
    const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
    for (const line of lines.slice(-400)) {
      try {
        const row = JSON.parse(line);
        if (row && row.kind) _state.posts.push(row);
        if (row && row.fullCycle && row.at) {
          const ts = Date.parse(row.at);
          if (ts > _state.lastFullCycleAt) {
            _state.lastFullCycleAt = ts;
            _state.lastFullCycleSource = row.source || null;
          }
        }
      } catch (_) { /* skip */ }
    }
  } catch (_) { /* ignore */ }
}

function _append(row) {
  if (!_persistEnabled()) return;
  _ensureDir();
  try { fs.appendFileSync(LEDGER_FILE, JSON.stringify(row) + '\n'); } catch (_) { /* ignore */ }
}

function _inflightKey(channel, kind) {
  if (kind === 'indexnow') return 'indexnow';
  return String(kind || 'site-viral') + ':' + channel;
}

function _staleInflight(key) {
  const ts = _inflight.get(key);
  if (!ts) return false;
  if (Date.now() - ts > INFLIGHT_MS) {
    _inflight.delete(key);
    return false;
  }
  return true;
}

function _windowMs(kind, success) {
  if (success === false) return FAIL_MS;
  if (kind === 'indexnow') return INDEXNOW_MS;
  if (kind === 'group-value') return GROUP_MS;
  return CHANNEL_MS;
}

function _recentHit(channel, kind, contentHash) {
  _hydrate();
  const now = Date.now();
  return _state.posts.find((p) => {
    if (!p || p.reserved) return false;
    const at = Date.parse(p.at || 0);
    if (!Number.isFinite(at)) return false;
    const win = _windowMs(p.kind || kind, p.success);
    if (now - at > win) return false;
    if (kind === 'indexnow') return p.kind === 'indexnow' && p.success !== false;
    if (kind === 'group-value') {
      return p.channel === 'telegram' && p.success !== false;
    }
    if (p.channel !== channel) return false;
    if (p.kind === 'indexnow') return false;
    if (contentHash && p.contentHash && p.contentHash !== contentHash && p.success === false) return false;
    return p.success !== false;
  }) || null;
}

function admit(opts) {
  const kind = String((opts && opts.kind) || 'site-viral');
  const channel = normalizeChannel(opts && opts.channel);
  const source = String((opts && opts.source) || 'unknown').slice(0, 48);
  const force = !!(opts && opts.force);
  const contentHash = (opts && opts.contentHash) || null;

  if (force) {
    _state.admitted += 1;
    return { ok: true, reason: 'forced', channel, source, kind, protocol: PROTOCOL };
  }
  if (EXEMPT.has(channel) || kind === 'rss') {
    _state.admitted += 1;
    return { ok: true, reason: 'exempt', channel, source, kind, protocol: PROTOCOL };
  }

  const key = _inflightKey(channel, kind);
  if (_staleInflight(key)) {
    _state.skipped += 1;
    return {
      ok: false, skipped: true, reason: 'inflight', channel, source, kind, protocol: PROTOCOL,
    };
  }

  const hit = _recentHit(channel, kind, contentHash);
  if (hit) {
    _state.skipped += 1;
    return {
      ok: false,
      skipped: true,
      reason: 'unified_dedupe',
      channel,
      source,
      kind,
      previousSource: hit.source || null,
      previousAt: hit.at || null,
      protocol: PROTOCOL,
    };
  }

  _inflight.set(key, Date.now());
  _state.admitted += 1;
  return { ok: true, reason: 'admitted', channel, source, kind, inflightKey: key, protocol: PROTOCOL };
}

function record(opts) {
  const channel = normalizeChannel(opts && opts.channel);
  const kind = String((opts && opts.kind) || 'site-viral');
  const key = (opts && opts.inflightKey) || _inflightKey(channel, kind);
  _inflight.delete(key);
  const rec = {
    protocol: PROTOCOL,
    at: new Date().toISOString(),
    channel,
    source: String((opts && opts.source) || 'unknown').slice(0, 48),
    kind,
    success: !!(opts && opts.success),
    skipped: !!(opts && opts.skipped),
    reason: (opts && opts.reason) || null,
    contentHash: (opts && opts.contentHash) || null,
    inventsReach: false,
  };
  _state.posts.push(rec);
  if (_state.posts.length > 500) _state.posts.splice(0, _state.posts.length - 500);
  _state.recorded += 1;
  _append(rec);
  return rec;
}

function noteFullCycle(source) {
  _state.lastFullCycleAt = Date.now();
  _state.lastFullCycleSource = String(source || 'unknown').slice(0, 48);
  _append({
    protocol: PROTOCOL,
    at: new Date().toISOString(),
    fullCycle: true,
    source: _state.lastFullCycleSource,
    inventsReach: false,
  });
  return { ok: true, at: _state.lastFullCycleAt, source: _state.lastFullCycleSource };
}

function shouldRunFullCycle(source, opts) {
  if (opts && opts.force) return { ok: true, reason: 'forced', protocol: PROTOCOL };
  const src = String(source || 'unknown');
  const designated = DESIGNATED.test(src);
  const last = Number(_state.lastFullCycleAt) || 0;
  if (!last) return { ok: true, reason: 'first', designated, protocol: PROTOCOL };
  const age = Date.now() - last;
  if (age >= FULL_CYCLE_MS) {
    return { ok: true, reason: 'cooldown_elapsed', designated, ageMs: age, protocol: PROTOCOL };
  }
  if (designated) {
    return { ok: true, reason: 'designated_executor', designated: true, ageMs: age, protocol: PROTOCOL };
  }
  return {
    ok: false,
    reason: 'not_designated',
    designated: false,
    retryInMs: FULL_CYCLE_MS - age,
    lastExecutor: _state.lastFullCycleSource,
    protocol: PROTOCOL,
  };
}

function _sgpPost(channel) {
  try {
    const sgp = require('./social-gravity-os');
    if (sgp && typeof sgp.composePost === 'function') return sgp.composePost(channel);
  } catch (_) { /* optional at boot */ }
  const ch = normalizeChannel(channel);
  const url = APP_URL + '/from/' + encodeURIComponent(ch)
    + '?utm_source=' + encodeURIComponent(ch)
    + '&utm_medium=social&utm_campaign=origin1&ref=SGP-' + ch.toUpperCase();
  const text = '0 paid humans. Origin #1 is still open at ZeusAI.\n' + url;
  return {
    text,
    url,
    contentHash: crypto.createHash('sha256').update(ch + '|' + text).digest('hex'),
    channel: ch,
  };
}

function canonicalizeIntent(intent, channel) {
  const ch = normalizeChannel(channel || (intent && intent.platform) || 'web');
  const sgpPost = _sgpPost(ch);
  const orig = String((intent && intent.body) || '');
  const alreadyTracked = /\/from\//.test(orig) && /utm_source=/.test(orig);
  let body = orig;
  if (!alreadyTracked && sgpPost) {
    const genericDump = !orig.trim()
      || /https:\/\/zeusai\.pro\/?\s*$/i.test(orig)
      || /autonomous commerce continuum/i.test(orig)
      || /Modulul "/.test(orig);
    if (genericDump) body = sgpPost.text;
    else body = orig.slice(0, 420) + '\n' + sgpPost.url;
  }
  return {
    ...(intent || {}),
    body,
    url: (alreadyTracked ? (intent && intent.url) : null) || sgpPost.url,
    title: (intent && intent.title) || 'ZeusAI Origin',
    contentHash: sgpPost.contentHash,
    canonical: true,
    protocol: PROTOCOL,
    channel: ch,
  };
}

function liveReady() {
  try {
    const viralizer = require('./socialMediaViralizer');
    const st = viralizer && typeof viralizer.getProviderStatus === 'function'
      ? viralizer.getProviderStatus()
      : null;
    return (st && st.configuredProviders) || [];
  } catch (_) {
    return [];
  }
}

function getStatus() {
  _hydrate();
  const ready = liveReady();
  const successes = _state.posts.filter((p) => p && p.success).length;
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
    paidHumans: 0,
    designatedExecutor: 'socialMediaViralizer',
    liveReady: ready,
    organs: ORGANS,
    admitted: _state.admitted,
    skipped: _state.skipped,
    recorded: _state.recorded,
    published: successes,
    lastFullCycleAt: _state.lastFullCycleAt || null,
    lastFullCycleSource: _state.lastFullCycleSource,
    lastIndexNowAt: _state.lastIndexNowAt || null,
    claim: CLAIM,
    agentBrief: AGENT_BRIEF,
    windows: {
      channelMs: CHANNEL_MS,
      fullCycleMs: FULL_CYCLE_MS,
      indexNowMs: INDEXNOW_MS,
      groupMs: GROUP_MS,
    },
    discovery: {
      wellKnown: '/.well-known/viral-unification.json',
      socialGravity: '/.well-known/social-gravity.json',
      landing: '/from/{channel}',
      origin: '/origin',
      buy: '/buy',
    },
  };
}

function discovery() {
  const st = getStatus();
  return {
    ok: true,
    protocol: PROTOCOL,
    role: 'single outbound mutex for site autoviralization',
    inventsHumans: false,
    inventsVisitors: false,
    inventsGmv: false,
    inventsReach: false,
    claim: CLAIM,
    agentBrief: AGENT_BRIEF,
    organs: ORGANS,
    designatedExecutor: 'socialMediaViralizer',
    copyContract: 'SGP/1.0',
    howToShare: {
      landing: APP_URL + '/from/{channel}?utm_source={channel}&utm_medium=social&utm_campaign=origin1&ref=SGP-{CHANNEL}',
      buy: APP_URL + '/buy?utm_source={channel}&ref=SGP-{CHANNEL}',
    },
    urls: [
      APP_URL + '/.well-known/viral-unification.json',
      APP_URL + '/.well-known/social-gravity.json',
      APP_URL + '/from/x',
      APP_URL + '/buy',
      APP_URL + '/origin',
    ],
    status: st,
  };
}

function unificationHeaders() {
  const st = getStatus();
  return {
    'X-Viral-Unification': PROTOCOL,
    'X-Viral-Executor': 'socialMediaViralizer',
    'X-Viral-Published': String(st.published),
  };
}

function start() {
  if (_state.running) return getStatus();
  _state.running = true;
  _state.startedAt = new Date().toISOString();
  _hydrate();
  return getStatus();
}

function stop() {
  _state.running = false;
  return getStatus();
}

function _resetForTests() {
  _state.running = false;
  _state.startedAt = null;
  _state.posts = [];
  _state.lastFullCycleAt = 0;
  _state.lastFullCycleSource = null;
  _state.lastIndexNowAt = 0;
  _state.admitted = 0;
  _state.skipped = 0;
  _state.recorded = 0;
  _inflight.clear();
}

function markIndexNow() {
  _state.lastIndexNowAt = Date.now();
}

module.exports = {
  PROTOCOL,
  NAME,
  ORGANS,
  CLAIM,
  admit,
  record,
  noteFullCycle,
  shouldRunFullCycle,
  canonicalizeIntent,
  normalizeChannel,
  getStatus,
  discovery,
  unificationHeaders,
  start,
  stop,
  markIndexNow,
  _resetForTests,
};
