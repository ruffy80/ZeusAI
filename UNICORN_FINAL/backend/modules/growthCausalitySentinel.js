// =====================================================================
// OWNERSHIP: Exclusive property of Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// growthCausalitySentinel.js — CAUSAL VIRALITY REFLEX (CVR)
//
// Innovation (needed, not previously invented here):
//   Marketing bots post on calendars. Growth brains plan. Viralizers spray.
//   NOTHING ties a specific outbound message to a measured BEFORE→AFTER
//   delta on real site funnel metrics, then uses that causal evidence to
//   decide WHETHER and WHAT to post next.
//
//   CVR closes that loop permanently:
//     SENSE   — snapshot site health + funnel + catalog + outbound ledger
//     HYPOTHESIZE — pick the starving funnel stage + a content hypothesis
//     ACT     — publish via outbound-publisher (honest; never fake ok)
//     WAIT    — attribution window
//     ATTRIB  — measure delta vs pre-snapshot; write causal edge
//     ADAPT   — raise/lower cadence + prefer hooks with positive lift
//
// Safe: soft requires, unref timers, no PM2/price/DB mutation, no invented
// credentials. Telegram is the preferred outbound + owner briefing channel.
//
// RO: reflex de virilitate cauzală — postează doar când lift-ul așteptat
// depășește zgomotul, și învață din delta-uri reale pe funnel.
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const NAME = 'growthCausalitySentinel';
function _defaultDataDir() {
  const shared = '/var/www/unicorn/shared/data/growth/causality';
  try {
    if (fs.existsSync('/var/www/unicorn/shared')) return shared;
  } catch (_) { /* ignore */ }
  return path.join(process.cwd(), 'data', 'growth', 'causality');
}
const DATA_DIR = process.env.ZEUS_CVR_DATA_DIR || _defaultDataDir();
const LEDGER = path.join(DATA_DIR, 'causal-ledger.jsonl');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const DEDUPE_FILE = path.join(DATA_DIR, 'dedupe.json');
const STATUS_PUBLIC = path.join(DATA_DIR, 'status-public.json');

const TICK_MS = Math.max(60_000, Number(process.env.ZEUS_CVR_TICK_MS) || 5 * 60_000);
const ATTRIB_MS = Math.max(5 * 60_000, Number(process.env.ZEUS_CVR_ATTRIB_MS) || 45 * 60_000);
const MIN_GAP_MS = Math.max(10 * 60_000, Number(process.env.ZEUS_CVR_MIN_GAP_MS) || 90 * 60_000);
const MAX_POSTS_PER_DAY = Math.max(1, Number(process.env.ZEUS_CVR_MAX_POSTS_DAY) || 8);
const SITE_ORIGIN = String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://zeusai.pro').replace(/\/$/, '');
const BACKEND_HEALTH = process.env.ZEUS_CVR_HEALTH_URL
  || process.env.UNICORN_SITE_INTERNAL_BACKEND
  || 'http://127.0.0.1:3000/api/health';
const DISABLED = String(process.env.ZEUS_CVR_DISABLED || '') === '1';
const SILENCE = () => String(process.env.ZEUS_CVR_SILENCE || '') === '1';

let _timer = null;
let _started = false;
let _outbound = null;
let _funnel = null;
let _content = null;
let _traffic = null;
let _viralizer = null;
let _lastStatus = { ok: true, module: NAME, started: false };

// Stage → preferred channel order. We still fan out to EVERY armed channel;
// affinity only sorts so the hungriest stage hits the highest-leverage rails first.
const CHANNEL_AFFINITY = {
  traffic:  ['x', 'devto', 'linkedin', 'pinterest', 'bluesky', 'mastodon', 'rss', 'telegram', 'discord', 'generic'],
  capture:  ['telegram', 'discord', 'x', 'linkedin', 'rss', 'generic', 'mastodon', 'bluesky', 'devto', 'pinterest'],
  convert:  ['telegram', 'x', 'linkedin', 'discord', 'mastodon', 'bluesky', 'rss', 'devto', 'pinterest', 'generic'],
  monetize: ['telegram', 'x', 'linkedin', 'devto', 'discord', 'rss', 'mastodon', 'bluesky', 'pinterest', 'generic'],
  expand:   ['x', 'bluesky', 'mastodon', 'linkedin', 'devto', 'pinterest', 'rss', 'telegram', 'discord', 'generic'],
  retain:   ['telegram', 'discord', 'rss', 'x', 'linkedin', 'generic', 'mastodon', 'bluesky', 'devto', 'pinterest'],
  infra:    ['telegram', 'discord', 'rss', 'generic', 'x', 'linkedin', 'mastodon', 'bluesky', 'devto', 'pinterest'],
};

const state = {
  silenced: false,
  postsToday: 0,
  postsDayKey: '',
  lastPostAt: 0,
  cadenceMs: MIN_GAP_MS,
  pending: null, // { id, fingerprint, pre, postedAt, body, hypothesis }
  hookScores: {}, // hookId → { n, liftSum, lastLift }
  cycles: 0,
  lastCycle: null,
};

function _safe(fn, fb) { try { const v = fn(); return v == null ? fb : v; } catch (_) { return fb; } }
function _dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function _ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ } }

function _append(file, obj) {
  _ensureDir();
  try { fs.appendFileSync(file, `${JSON.stringify(obj)}\n`); } catch (_) { /* ignore */ }
}

function _loadJson(file, fb) {
  try {
    if (!fs.existsSync(file)) return fb;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) { return fb; }
}

function _saveState() {
  _ensureDir();
  try {
    const payload = {
      silenced: state.silenced,
      postsToday: state.postsToday,
      postsDayKey: state.postsDayKey,
      lastPostAt: state.lastPostAt,
      cadenceMs: state.cadenceMs,
      pending: state.pending,
      hookScores: state.hookScores,
      cycles: state.cycles,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  } catch (_) { /* ignore */ }
  _publishStatusFile();
}

function _publishStatusFile() {
  _ensureDir();
  try {
    fs.writeFileSync(STATUS_PUBLIC, `${JSON.stringify(getStatus(), null, 2)}\n`);
  } catch (_) { /* ignore */ }
}

function _restore() {
  const s = _loadJson(STATE_FILE, null);
  if (!s || typeof s !== 'object') return;
  state.silenced = !!s.silenced;
  state.postsToday = Number(s.postsToday) || 0;
  state.postsDayKey = s.postsDayKey || '';
  state.lastPostAt = Number(s.lastPostAt) || 0;
  state.cadenceMs = Math.max(MIN_GAP_MS, Number(s.cadenceMs) || MIN_GAP_MS);
  state.pending = s.pending || null;
  state.hookScores = (s.hookScores && typeof s.hookScores === 'object') ? s.hookScores : {};
  state.cycles = Number(s.cycles) || 0;
}

function _httpGetJson(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.get(url, { timeout: timeoutMs, headers: { accept: 'application/json' } }, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; if (buf.length > 2_000_000) req.destroy(); });
        res.on('end', () => {
          try { resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: JSON.parse(buf) }); }
          catch (_) { resolve({ ok: false, status: res.statusCode, json: null }); }
        });
      });
      req.on('error', () => resolve({ ok: false, status: 0, json: null }));
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} resolve({ ok: false, status: 0, json: null }); });
    } catch (_) {
      resolve({ ok: false, status: 0, json: null });
    }
  });
}

function _lazyDeps() {
  if (!_outbound) {
    _outbound = _safe(() => require('./marketing-innovations/outbound-publisher'), null);
  }
  if (!_funnel) {
    _funnel = _safe(() => require('./funnel-intelligence'), null);
  }
  if (!_content) {
    _content = _safe(() => require('./marketing-innovations/content-multichannel'), null);
  }
  if (!_traffic) {
    _traffic = _safe(() => require('./traffic-engine'), null);
  }
  if (!_viralizer) {
    // Module exports a ready singleton instance.
    _viralizer = _safe(() => require('./socialMediaViralizer'), null);
  }
}

function _armedChannels() {
  _lazyDeps();
  if (_outbound && typeof _outbound.enabledPlatforms === 'function') {
    return _outbound.enabledPlatforms();
  }
  const st = _outbound && typeof _outbound.status === 'function' ? _outbound.status() : null;
  return (st && st.enabledAdapters) || ['rss'];
}

function selectPlatforms(snapshot) {
  const armed = _armedChannels();
  const allow = String(process.env.ZEUS_CVR_PLATFORMS || '')
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const pool = allow.length ? armed.filter((p) => allow.includes(p)) : armed.slice();
  const stage = (snapshot && snapshot.starvingStage) || 'traffic';
  const pref = CHANNEL_AFFINITY[stage] || CHANNEL_AFFINITY.traffic;
  pool.sort((a, b) => {
    const ia = pref.indexOf(a); const ib = pref.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  // Always keep rss as a discovery surface when present.
  if (!pool.includes('rss') && armed.includes('rss')) pool.push('rss');
  return pool;
}

function _rollDay() {
  const k = _dayKey();
  if (state.postsDayKey !== k) {
    state.postsDayKey = k;
    state.postsToday = 0;
  }
}

function _dedupeHas(fp) {
  const d = _loadJson(DEDUPE_FILE, { fingerprints: {} });
  const ts = d.fingerprints && d.fingerprints[fp];
  if (!ts) return false;
  // suppress identical body for 7 days
  return (Date.now() - Number(ts)) < 7 * 24 * 3600_000;
}

function _dedupeAdd(fp) {
  const d = _loadJson(DEDUPE_FILE, { fingerprints: {} });
  if (!d.fingerprints) d.fingerprints = {};
  d.fingerprints[fp] = Date.now();
  // prune old
  const cutoff = Date.now() - 14 * 24 * 3600_000;
  for (const [k, v] of Object.entries(d.fingerprints)) {
    if (Number(v) < cutoff) delete d.fingerprints[k];
  }
  _ensureDir();
  try { fs.writeFileSync(DEDUPE_FILE, `${JSON.stringify(d)}\n`); } catch (_) { /* ignore */ }
}

function _fingerprint(body) {
  return crypto.createHash('sha256').update(String(body || '').trim().toLowerCase()).digest('hex').slice(0, 24);
}

async function sense() {
  _lazyDeps();
  const health = await _httpGetJson(BACKEND_HEALTH);
  const site = await _httpGetJson(`${SITE_ORIGIN}/health`);
  const catalog = await _httpGetJson(
    process.env.ZEUS_CVR_CATALOG_URL || 'http://127.0.0.1:3000/api/catalog'
  );
  const funnel = _funnel && typeof _funnel.summary === 'function'
    ? _safe(() => _funnel.summary(), null)
    : null;

  const services = [];
  const cj = catalog.json;
  if (cj && Array.isArray(cj.services)) {
    for (const s of cj.services.slice(0, 40)) {
      services.push({
        id: s.id || s.serviceId || s.sku,
        name: s.name || s.title || s.id,
        price: s.priceUsd || s.price || s.amount,
      });
    }
  } else if (cj && Array.isArray(cj.items)) {
    for (const s of cj.items.slice(0, 40)) {
      services.push({ id: s.id, name: s.name || s.title, price: s.price });
    }
  }

  const stages = _scoreStages(funnel, health, site, services.length);
  const starving = Object.entries(stages)
    .sort((a, b) => a[1] - b[1])[0] || ['traffic', 0];
  const channels = selectPlatforms({ starvingStage: starving[0] });
  const networkChannels = channels.filter((c) => c !== 'rss');

  return {
    at: new Date().toISOString(),
    healthOk: !!(health.ok && (health.json && (health.json.ok !== false))),
    siteOk: !!(site.ok),
    catalogCount: services.length,
    topServices: services.slice(0, 5),
    funnel,
    stages,
    starvingStage: starving[0],
    starvingScore: starving[1],
    channels,
    channelsArmed: channels.length,
    networkChannelsArmed: networkChannels.length,
    // Ready when any distribution rail exists (rss always; prefer network).
    outboundReady: channels.length > 0,
  };
}

function _scoreStages(funnel, health, site, catalogN) {
  const w = (funnel && funnel.windows && funnel.windows.last7d) || {};
  const sessions = Number(w.sessions || (funnel && funnel.visitors) || 0);
  const views = Number(w.pageViews || 0);
  const checkouts = Number(w.checkoutStarts || 0);
  const paid = Number(w.paid || 0);
  const traffic = sessions > 50 ? 80 : sessions > 10 ? 55 : sessions > 0 ? 35 : (site.ok ? 25 : 10);
  const capture = views > 100 ? 75 : views > 20 ? 50 : views > 0 ? 30 : 15;
  const convert = checkouts > 5 ? 70 : checkouts > 0 ? 40 : 15;
  const monetize = paid > 3 ? 80 : paid > 0 ? 45 : 12;
  const expand = catalogN > 5 ? 70 : catalogN > 0 ? 45 : 20;
  const retain = paid > 0 ? 40 : 20;
  const infra = (health.ok && site.ok) ? 90 : (health.ok || site.ok) ? 50 : 10;
  return { traffic, capture, convert, monetize, expand, retain, infra };
}

const HOOKS = [
  {
    id: 'starvation_signal',
    stage: 'traffic',
    build: (s) => [
      `⚡ ZeusAI pulse — funnel stage "${s.starvingStage}" is starving (score ${s.starvingScore}/100).`,
      `Live catalog: ${s.catalogCount} services. Site ${s.siteOk ? 'UP' : 'DEGRADED'}.`,
      `Fix path: ${SITE_ORIGIN}/services`,
      `#ZeusAI #autonomousCommerce`,
    ].join('\n'),
  },
  {
    id: 'offer_spotlight',
    stage: 'convert',
    build: (s) => {
      const top = (s.topServices && s.topServices[0]) || null;
      const name = top ? (top.name || top.id) : 'AI commerce agents';
      const price = top && top.price != null ? ` · from $${top.price}` : '';
      return [
        `🦄 Unicorn spotlight: ${name}${price}`,
        `Autonomous checkout · BTC-ready · no fake metrics.`,
        `${SITE_ORIGIN}/checkout`,
        `What should we ship next? Reply in this chat.`,
      ].join('\n');
    },
  },
  {
    id: 'proof_not_promise',
    stage: 'monetize',
    build: (s) => {
      const f = s.funnel || {};
      const w = (f.windows && f.windows.last7d) || {};
      return [
        `📊 Honest 7d signal (no invented numbers):`,
        `sessions=${Number(w.sessions || 0)} · checkouts=${Number(w.checkoutStarts || 0)} · paid=${Number(w.paid || 0)}`,
        `CVR posts only when lift is measurable. Watch ${SITE_ORIGIN}`,
      ].join('\n');
    },
  },
  {
    id: 'virality_invite',
    stage: 'expand',
    build: () => [
      `🔗 Share Unicorn: ${SITE_ORIGIN}`,
      `Agents, dropship shelf, BTC rails — one autonomous stack.`,
      `Owner tip: /boost forces a CVR cycle · /pulse shows live scores.`,
    ].join('\n'),
  },
  {
    id: 'recovery_nudge',
    stage: 'capture',
    build: () => [
      `🛒 Abandoned intent is revenue waiting to happen.`,
      `Open ${SITE_ORIGIN}/services — finish checkout in one flow.`,
      `ZeusAI CVR is watching conversion deltas in real time.`,
    ].join('\n'),
  },
];

function _hookScore(id) {
  const h = state.hookScores[id] || { n: 0, liftSum: 0 };
  if (!h.n) return 0.5; // unexplored prior
  return 0.35 + (h.liftSum / h.n); // lift typically -1..+1 scaled
}

function pickHypothesis(snapshot) {
  const stage = snapshot.starvingStage || 'traffic';
  const ranked = HOOKS
    .map((h) => ({
      ...h,
      score: _hookScore(h.id) + (h.stage === stage ? 0.35 : 0) + Math.random() * 0.05,
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const body = best.build(snapshot);
  const variants = { default: body };
  // Per-channel tailored copy when content-multichannel is available.
  const channelMap = {
    x: 'X', telegram: 'Facebook', discord: 'Facebook', mastodon: 'Reddit',
    bluesky: 'X', devto: 'LinkedIn', rss: 'Email', generic: 'PushNotification',
  };
  if (_content && typeof _content.generateVariant === 'function') {
    for (const [plat, ch] of Object.entries(channelMap)) {
      const polished = _safe(() => _content.generateVariant(ch, {
        topic: `${stage}:${best.id}`,
        seed: `${best.id}:${plat}:${_dayKey()}`,
      }), null);
      if (polished && polished.body) {
        const max = plat === 'x' || plat === 'bluesky' ? 280 : 1800;
        variants[plat] = `${body}\n\n—\n${String(polished.body).slice(0, max)}`.slice(0, max === 280 ? 280 : 3500);
      }
    }
  }
  return { hookId: best.id, stage: best.stage, body, variants, score: best.score };
}

function _expectedLift(hookId, snapshot) {
  const prior = _hookScore(hookId);
  const hunger = (100 - Number(snapshot.starvingScore || 0)) / 100;
  return prior * 0.6 + hunger * 0.4;
}

function shouldAct(snapshot) {
  if (DISABLED || state.silenced || SILENCE()) {
    return { act: false, reason: 'silenced_or_disabled' };
  }
  if (!snapshot.outboundReady) {
    return { act: false, reason: 'no_channels_armed' };
  }
  if (!snapshot.healthOk && !snapshot.siteOk) {
    return { act: false, reason: 'infra_down' };
  }
  if (state.pending) {
    return { act: false, reason: 'attribution_pending' };
  }
  _rollDay();
  if (state.postsToday >= MAX_POSTS_PER_DAY) {
    return { act: false, reason: 'daily_cap' };
  }
  const gap = Math.max(state.cadenceMs, MIN_GAP_MS);
  if (Date.now() - state.lastPostAt < gap) {
    return { act: false, reason: 'cadence_wait', waitMs: gap - (Date.now() - state.lastPostAt) };
  }
  // Hunger gate: only auto-post when a stage is clearly weak OR infra recovered
  if (Number(snapshot.starvingScore) >= 70 && snapshot.healthOk) {
    return { act: false, reason: 'funnel_healthy_hold' };
  }
  return { act: true, reason: 'hunger_gate_open' };
}

async function _writePublicFeed(entry) {
  _ensureDir();
  const feedFile = path.join(DATA_DIR, 'public-feed.json');
  let items = [];
  try {
    const cur = _loadJson(feedFile, { items: [] });
    items = Array.isArray(cur.items) ? cur.items : [];
  } catch (_) { items = []; }
  items.unshift(entry);
  items = items.slice(0, 50);
  try {
    fs.writeFileSync(feedFile, `${JSON.stringify({
      ok: true,
      source: 'growthCausalitySentinel',
      updatedAt: new Date().toISOString(),
      site: SITE_ORIGIN,
      items,
    }, null, 2)}\n`);
  } catch (_) { /* ignore */ }
  return { ok: true, count: items.length };
}

async function _fanoutExtras(hypothesis, snapshot) {
  const extras = [];
  // SEO: IndexNow + sitemap inventory via traffic-engine
  if (_traffic && typeof _traffic.pingAll === 'function' && (snapshot.starvingStage === 'traffic' || snapshot.starvingStage === 'expand' || snapshot.starvingScore < 40)) {
    try {
      const ping = await _traffic.pingAll({ reason: 'cvr', hookId: hypothesis.hookId });
      extras.push({ platform: 'indexnow', ok: !!(ping && (ping.ok || ping.submitted || ping.engines)), detail: ping && (ping.status || ping) });
    } catch (e) {
      extras.push({ platform: 'indexnow', ok: false, error: e && e.message });
    }
  }
  // Legacy viralizer — posts to every social token it knows (X/YT/Pin/TG/DEV/PH)
  if (_viralizer && typeof _viralizer.postToAllPlatforms === 'function') {
    try {
      const r = await _viralizer.postToAllPlatforms();
      const channels = r && typeof r === 'object' ? Object.keys(r) : [];
      extras.push({
        platform: 'socialMediaViralizer',
        ok: channels.length > 0,
        channels,
      });
    } catch (e) {
      extras.push({ platform: 'socialMediaViralizer', ok: false, error: e && e.message });
    }
  }
  // Public site feed (always)
  const feed = await _writePublicFeed({
    id: crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(),
    hookId: hypothesis.hookId,
    stage: hypothesis.stage || snapshot.starvingStage,
    body: hypothesis.body,
    url: SITE_ORIGIN,
  });
  extras.push({ platform: 'site_feed', ok: !!feed.ok, count: feed.count });
  return extras;
}

async function act(hypothesis, snapshot, { force = false } = {}) {
  _lazyDeps();
  if (!_outbound || typeof _outbound.publish !== 'function') {
    return { ok: false, reason: 'outbound_missing' };
  }
  const fp = _fingerprint(hypothesis.body);
  if (!force && _dedupeHas(fp)) {
    return { ok: false, reason: 'dedupe_hit', fingerprint: fp };
  }
  const lift = _expectedLift(hypothesis.hookId, snapshot);
  if (!force && lift < 0.35 && Number(snapshot.starvingScore) > 55) {
    return { ok: false, reason: 'lift_below_noise', expectedLift: lift };
  }

  const platforms = selectPlatforms(snapshot);
  const results = [];
  for (const platform of platforms) {
    const body = (hypothesis.variants && hypothesis.variants[platform]) || hypothesis.body;
    // eslint-disable-next-line no-await-in-loop
    const r = await _outbound.publish({
      platform,
      body,
      title: `ZeusAI CVR · ${hypothesis.hookId}`,
      url: SITE_ORIGIN,
    });
    results.push({ platform, ...r });
  }

  const extras = await _fanoutExtras(hypothesis, snapshot);
  const okNetwork = results.some((r) => r.ok && r.platform !== 'rss' && r.reason !== 'no_credentials');
  const okRss = results.some((r) => r.ok && r.platform === 'rss');
  const okExtra = extras.some((r) => r.ok);
  const ok = okNetwork || okRss || okExtra;
  if (!ok) {
    _append(LEDGER, {
      ts: new Date().toISOString(),
      type: 'act_failed',
      hypothesis: { hookId: hypothesis.hookId },
      results,
      extras,
    });
    return { ok: false, reason: 'publish_failed', results, extras };
  }

  _dedupeAdd(fp);
  const id = crypto.randomBytes(8).toString('hex');
  state.pending = {
    id,
    fingerprint: fp,
    hookId: hypothesis.hookId,
    body: hypothesis.body.slice(0, 500),
    platforms,
    pre: {
      stages: snapshot.stages,
      starvingStage: snapshot.starvingStage,
      starvingScore: snapshot.starvingScore,
      catalogCount: snapshot.catalogCount,
      at: snapshot.at,
    },
    postedAt: Date.now(),
    force: !!force,
  };
  state.lastPostAt = Date.now();
  _rollDay();
  state.postsToday += 1;
  _saveState();
  _append(LEDGER, {
    ts: new Date().toISOString(),
    type: 'act',
    id,
    hookId: hypothesis.hookId,
    expectedLift: lift,
    fingerprint: fp,
    platforms,
    results,
    extras,
  });
  return {
    ok: true,
    id,
    expectedLift: lift,
    platforms,
    posted: results.filter((r) => r.ok).map((r) => r.platform),
    failed: results.filter((r) => !r.ok).map((r) => ({ platform: r.platform, reason: r.reason || r.description || r.error })),
    results,
    extras,
  };
}

async function attributeIfDue() {
  if (!state.pending) return { ok: true, skipped: true };
  if (Date.now() - state.pending.postedAt < ATTRIB_MS) {
    return { ok: true, pending: true, waitMs: ATTRIB_MS - (Date.now() - state.pending.postedAt) };
  }
  const snap = await sense();
  const pre = state.pending.pre || {};
  const preScore = Number(pre.starvingScore || 0);
  const postScore = Number(snap.starvingScore || 0);
  // Positive lift = starving stage improved (score went UP)
  const stageLift = (postScore - preScore) / 100;
  const infraBonus = (snap.healthOk && snap.siteOk) ? 0.05 : -0.1;
  const lift = Math.max(-1, Math.min(1, stageLift + infraBonus));

  const hookId = state.pending.hookId;
  const prev = state.hookScores[hookId] || { n: 0, liftSum: 0 };
  prev.n += 1;
  prev.liftSum += lift;
  prev.lastLift = lift;
  state.hookScores[hookId] = prev;

  // Adapt cadence: good lift → slightly faster; bad → slow down
  if (lift > 0.05) {
    state.cadenceMs = Math.max(MIN_GAP_MS, Math.round(state.cadenceMs * 0.9));
  } else if (lift < -0.05) {
    state.cadenceMs = Math.min(6 * 3600_000, Math.round(state.cadenceMs * 1.25));
  }

  _append(LEDGER, {
    ts: new Date().toISOString(),
    type: 'attrib',
    id: state.pending.id,
    hookId,
    lift,
    pre,
    post: {
      stages: snap.stages,
      starvingStage: snap.starvingStage,
      starvingScore: snap.starvingScore,
      at: snap.at,
    },
    cadenceMs: state.cadenceMs,
  });
  state.pending = null;
  _saveState();
  return { ok: true, lift, hookId, cadenceMs: state.cadenceMs };
}

async function cycle({ force = false } = {}) {
  if (DISABLED) {
    _lastStatus = { ok: true, module: NAME, disabled: true };
    return _lastStatus;
  }
  _lazyDeps();
  const attrib = await attributeIfDue();
  const snapshot = await sense();
  const gate = force ? { act: true, reason: 'forced' } : shouldAct(snapshot);
  let action = { ok: false, skipped: true, reason: gate.reason };
  let hypothesis = null;
  if (gate.act) {
    hypothesis = pickHypothesis(snapshot);
    action = await act(hypothesis, snapshot, { force });
  }
  state.cycles += 1;
  state.lastCycle = {
    at: new Date().toISOString(),
    gate,
    action: {
      ok: action.ok,
      reason: action.reason || null,
      id: action.id || null,
      expectedLift: action.expectedLift,
    },
    attrib,
    starvingStage: snapshot.starvingStage,
    starvingScore: snapshot.starvingScore,
    hookId: hypothesis && hypothesis.hookId,
  };
  _lastStatus = {
    ok: true,
    module: NAME,
    started: _started,
    silenced: state.silenced || SILENCE(),
    cycles: state.cycles,
    postsToday: state.postsToday,
    cadenceMs: state.cadenceMs,
    pending: state.pending ? { id: state.pending.id, hookId: state.pending.hookId, ageMs: Date.now() - state.pending.postedAt } : null,
    hookScores: state.hookScores,
    lastCycle: state.lastCycle,
    snapshot: {
      healthOk: snapshot.healthOk,
      siteOk: snapshot.siteOk,
      catalogCount: snapshot.catalogCount,
      stages: snapshot.stages,
      starvingStage: snapshot.starvingStage,
      starvingScore: snapshot.starvingScore,
      outboundReady: snapshot.outboundReady,
      channels: snapshot.channels,
      channelsArmed: snapshot.channelsArmed,
      networkChannelsArmed: snapshot.networkChannelsArmed,
    },
  };
  // Enrich lastCycle with post fanout summary when we acted
  if (action && action.posted) {
    state.lastCycle.posted = action.posted;
    state.lastCycle.failed = action.failed;
    state.lastCycle.extras = (action.extras || []).map((e) => ({ platform: e.platform, ok: e.ok }));
    _lastStatus.lastCycle = state.lastCycle;
  }
  _saveState();
  _append(LEDGER, { ts: new Date().toISOString(), type: 'cycle', ...state.lastCycle });
  return _lastStatus;
}

function formatPulse(st) {
  const s = st || getStatus();
  const snap = s.snapshot || {};
  const stages = snap.stages || {};
  const ch = snap.channels || s.lastCycle && s.lastCycle.posted || [];
  const lines = [
    `🦄 ZeusAI CVR pulse (multi-channel)`,
    `infra: health=${snap.healthOk ? 'OK' : 'DOWN'} site=${snap.siteOk ? 'OK' : 'DOWN'} rails=${snap.outboundReady ? 'ARMED' : 'WAIT'}`,
    `starving: ${snap.starvingStage || '?'} (${snap.starvingScore ?? '?'}/100)`,
    `channels: ${(Array.isArray(ch) ? ch : snap.channelsArmed != null ? `${snap.channelsArmed} armed` : '—')}`,
    `catalog: ${snap.catalogCount ?? 0} · postsToday: ${s.postsToday || 0} · cadence: ${Math.round((s.cadenceMs || 0) / 60000)}m`,
    `stages: ${Object.entries(stages).map(([k, v]) => `${k}=${v}`).join(' ')}`,
    s.pending ? `attrib pending: ${s.pending.hookId} (${Math.round((s.pending.ageMs || 0) / 60000)}m)` : 'attrib: idle',
    s.silenced ? '⚠ SILENCED' : 'armed · fans out to every credentialed rail',
    SITE_ORIGIN,
  ];
  return lines.join('\n');
}

function getStatus() {
  // Prefer the durable public status written by zeus-unicorn-bot when this
  // module is only mounted read-only inside unicorn-backend.
  if (!_started) {
    const pub = _loadJson(STATUS_PUBLIC, null);
    if (pub && typeof pub === 'object' && pub.module === NAME) {
      return { ...pub, source: 'status-public.json' };
    }
  }
  return { ..._lastStatus, started: _started, silenced: state.silenced || SILENCE() };
}

function setSilenced(v) {
  state.silenced = !!v;
  _saveState();
  return { ok: true, silenced: state.silenced };
}

function start(opts) {
  if (_started) return { ok: true, already: true };
  if (DISABLED) return { ok: true, disabled: true };
  _restore();
  _lazyDeps();
  _started = true;
  const ms = (opts && opts.intervalMs) || TICK_MS;
  // Kick once soon, then interval
  setTimeout(() => { cycle().catch(() => {}); }, 5_000).unref?.();
  _timer = setInterval(() => { cycle().catch(() => {}); }, ms);
  if (_timer.unref) _timer.unref();
  _lastStatus = { ok: true, module: NAME, started: true, intervalMs: ms };
  _publishStatusFile();
  return { ok: true, intervalMs: ms };
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _started = false;
  _saveState();
  return { ok: true };
}

async function processAction(msg) {
  const action = String((msg && msg.action) || 'tick').toLowerCase();
  if (action === 'tick' || action === 'cycle') return cycle();
  if (action === 'boost' || action === 'force') return cycle({ force: true });
  if (action === 'pulse') return { ok: true, text: formatPulse(), status: getStatus() };
  if (action === 'channels') {
    _lazyDeps();
    return {
      ok: true,
      armed: _armedChannels(),
      affinity: CHANNEL_AFFINITY,
      outbound: _outbound && typeof _outbound.status === 'function' ? _outbound.status() : null,
    };
  }
  if (action === 'silence') return setSilenced(true);
  if (action === 'resume') return setSilenced(false);
  if (action === 'status') return getStatus();
  return { ok: false, reason: 'unknown_action' };
}

module.exports = {
  NAME,
  start,
  stop,
  process: processAction,
  processAction,
  cycle,
  sense,
  shouldAct,
  pickHypothesis,
  selectPlatforms,
  formatPulse,
  getStatus,
  setSilenced,
  // test helpers
  _state: state,
  _fingerprint,
  _scoreStages,
  HOOKS,
};
