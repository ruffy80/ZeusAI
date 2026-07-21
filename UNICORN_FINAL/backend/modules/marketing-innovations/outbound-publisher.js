// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/outbound-publisher.js
//
// Real outbound publishing layer. Wraps a small set of adapters that
// only activate when their respective credentials are present in env.
// All HTTP calls go through the Node global `fetch` (Node 18+). When a
// credential is missing, the adapter degrades to a no-op stub that
// simply records the intent in the JSONL ledger (`data/marketing/
// outbound-ledger.jsonl`).
//
// Dry-run is only forced when explicit (OUTBOUND_DRY_RUN=1 or the legacy
// MARKETING_OUTBOUND_DRYRUN=1) or when NODE_ENV=test. Otherwise the module
// attempts real network I/O when credentials are configured and returns
// {ok:false, reason:'no_credentials'} when they are missing — we NEVER
// fake a "posted" result.
//
// Adapters:
//   - telegram   (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID; legacy: TG_BOT_TOKEN + TG_CHAT_ID)
//   - discord    (DISCORD_WEBHOOK_URL)
//   - mastodon   (MASTODON_INSTANCE + MASTODON_TOKEN)
//   - bluesky    (BLUESKY_HANDLE + BLUESKY_APP_PASSWORD) — best-effort
//   - rss        (always available; appends to data/marketing/rss.xml)
//   - generic    (GENERIC_WEBHOOK_URL — JSON POST)
//
// Per-platform sliding-window rate limiter (default 30/min) and circuit
// breaker that opens for 60s after 3 consecutive failures.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const LEDGER = process.env.MARKETING_OUTBOUND_LEDGER
  || path.join(DATA_DIR, 'outbound-ledger.jsonl');
const RSS_FILE = process.env.MARKETING_OUTBOUND_RSS
  || path.join(DATA_DIR, 'rss.xml');

// Dry-run policy:
//   • `OUTBOUND_DRY_RUN=1`  — canonical, mission-mandated flag: forces dry-run
//     for EVERY outbound adapter (never touches the network).
//   • `MARKETING_OUTBOUND_DRYRUN=1` — legacy alias, kept for back-compat.
//   • `NODE_ENV=test` — always dry-run so the unit suite is hermetic.
//   • Otherwise: no dry-run — real network is attempted when credentials are
//     present, and adapters return `{ok:false, reason:'no_credentials'}`
//     when they are missing. We NEVER fake a "posted" outcome.
//
// RO: dry-run se activeaza doar explicit (OUTBOUND_DRY_RUN=1) sau in teste;
//     nu simulam niciodata trimiterea unui mesaj real.
function _isDryRun() {
  if (String(process.env.OUTBOUND_DRY_RUN || '') === '1') return true;
  if (String(process.env.MARKETING_OUTBOUND_DRYRUN || '') === '1') return true;
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'test') return true;
  return false;
}
const DISABLED = process.env.MARKETING_OUTBOUND_DISABLED === '1';
const RATE_LIMIT_PER_MIN = Math.max(1, Number(process.env.MARKETING_OUTBOUND_RATE_PER_MIN) || 30);

// Canonical Telegram credential resolver. Matches the pair used everywhere
// else in ZeusAI (socialMediaViralizer, zacAlertChannel, TG bot bridge).
// Legacy env vars `TG_BOT_TOKEN` / `TG_CHAT_ID` still work as a fallback so
// existing deployments do not break.
function _telegramCreds() {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || process.env.ZAC_TELEGRAM_TOKEN || '';
  // Prefer Profit Group rail for marketing fan-out; fall back to owner/outbound chat.
  const chat = process.env.ZEUS_TG_GROUP_CHAT_ID
    || process.env.TELEGRAM_GROUP_CHAT_ID
    || process.env.TELEGRAM_CHAT_ID
    || process.env.TG_CHAT_ID
    || '';
  return { token, chat, has: !!(token && chat) };
}

const _windows = new Map(); // platform → [timestamps]
const _breakers = new Map(); // platform → { fails, openedUntil }

function _ensureDir() { try { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); } catch (_) {} }
function _persist(evt) { try { _ensureDir(); fs.appendFileSync(LEDGER, JSON.stringify(evt) + '\n'); } catch (_) {} }

function _allow(platform) {
  const now = Date.now();
  const w = _windows.get(platform) || [];
  const fresh = w.filter((t) => now - t < 60_000);
  fresh.push(now);
  _windows.set(platform, fresh);
  return fresh.length <= RATE_LIMIT_PER_MIN;
}

function _breakerOpen(platform) {
  const b = _breakers.get(platform);
  return !!(b && b.openedUntil && Date.now() < b.openedUntil);
}
function _onSuccess(platform) { _breakers.set(platform, { fails: 0, openedUntil: 0 }); }
function _onFailure(platform) {
  const b = _breakers.get(platform) || { fails: 0, openedUntil: 0 };
  b.fails = (b.fails || 0) + 1;
  if (b.fails >= 3) { b.openedUntil = Date.now() + 60_000; b.fails = 0; }
  _breakers.set(platform, b);
}

async function _safeFetch(url, init) {
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  const timeout = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (_) {} }, 8000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl ? ctrl.signal : undefined }, init));
    let description = null;
    try {
      const ct = String(r.headers.get('content-type') || '');
      if (ct.includes('application/json')) {
        const j = await r.clone().json();
        if (j && typeof j.description === 'string') description = j.description;
      }
    } catch (_) { /* ignore */ }
    return { ok: r.ok, status: r.status, ...(description ? { description } : {}) };
  } finally { clearTimeout(timeout); }
}

function _record(platform, intent, result) {
  const evt = {
    ts: new Date().toISOString(),
    platform,
    dryRun: _isDryRun(),
    intent: { ...intent, body: typeof intent.body === 'string' ? intent.body.slice(0, 500) : intent.body },
    result,
  };
  _persist(evt);
  return evt;
}

// ── Adapters ───────────────────────────────────────────────────────────

async function _publishTelegram(intent) {
  const { token, chat, has } = _telegramCreds();
  if (!has) {
    return {
      ok: false,
      reason: 'no_credentials',
      platform: 'telegram',
      hint: 'Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (or legacy TG_BOT_TOKEN + TG_CHAT_ID) to enable real Telegram posting. We never fake a "posted" result.',
    };
  }
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'telegram' };
  const r = await _safeFetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: String(intent.body || ''), disable_web_page_preview: false }),
  });
  return { ...r, platform: 'telegram' };
}

async function _publishDiscord(intent) {
  const url = process.env.DISCORD_WEBHOOK_URL
    || process.env.DISCORD_WEBHOOK
    || process.env.ZAC_DISCORD_WEBHOOK
    || process.env.WATCHDOG_DISCORD_WEBHOOK
    || '';
  if (!url) return { ok: false, reason: 'no_credentials', platform: 'discord' };
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'discord' };
  return _safeFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: String(intent.body || '').slice(0, 1900) }),
  });
}

async function _publishMastodon(intent) {
  const inst = (process.env.MASTODON_INSTANCE || '').replace(/\/$/, '');
  const tok = process.env.MASTODON_TOKEN || '';
  if (!inst || !tok) return { ok: false, reason: 'no_credentials', platform: 'mastodon' };
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'mastodon' };
  return _safeFetch(`${inst}/api/v1/statuses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${tok}` },
    body: JSON.stringify({ status: String(intent.body || '').slice(0, 500) }),
  });
}

async function _publishBluesky(intent) {
  const handle = process.env.BLUESKY_HANDLE || '';
  const pwd = process.env.BLUESKY_APP_PASSWORD || '';
  if (!handle || !pwd) return { ok: false, reason: 'no_credentials', platform: 'bluesky' };
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'bluesky' };
  // Best-effort 2-step: createSession → createRecord.
  try {
    const session = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: handle, password: pwd }),
    }).then((r) => r.json()).catch(() => null);
    if (!session || !session.accessJwt) return { ok: false, reason: 'auth_failed' };
    const r = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${session.accessJwt}` },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post', text: String(intent.body || '').slice(0, 300), createdAt: new Date().toISOString() },
      }),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, error: 'bluesky_publish_failed' }; }
}

async function _publishGeneric(intent) {
  const url = process.env.GENERIC_WEBHOOK_URL
    || process.env.WEBHOOK_URL
    || process.env.GH_WEBHOOK_URL
    || process.env.HETZNER_WEBHOOK_URL
    || '';
  if (!url) return { ok: false, reason: 'no_credentials', platform: 'generic' };
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'generic' };
  return _safeFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...intent, source: 'zeusai-cvr', ts: new Date().toISOString() }),
  });
}

async function _publishLinkedIn(intent) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN || '';
  const author = process.env.LINKEDIN_AUTHOR_URN || '';
  if (!token || !author) return { ok: false, reason: 'no_credentials', platform: 'linkedin' };
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'linkedin' };
  const text = String(intent.body || '').slice(0, 2800);
  const r = await _safeFetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  return { ...r, platform: 'linkedin' };
}

async function _publishPinterest(intent) {
  const token = process.env.PINTEREST_TOKEN || '';
  const board = process.env.PINTEREST_BOARD_ID || '';
  if (!token || !board) return { ok: false, reason: 'no_credentials', platform: 'pinterest' };
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'pinterest' };
  const link = String(intent.url || process.env.PUBLIC_APP_URL || 'https://zeusai.pro');
  const r = await _safeFetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      board_id: board,
      title: String(intent.title || 'ZeusAI Unicorn').slice(0, 100),
      description: String(intent.body || '').slice(0, 500),
      link,
      media_source: { source_type: 'image_url', url: `${link}/og-default.png` },
    }),
  });
  return { ...r, platform: 'pinterest' };
}

async function _publishX(intent) {
  // Twitter/X API v2 — needs user-context token. Accept X_ACCESS_TOKEN (preferred)
  // or fall back to X_BEARER_TOKEN when that is a user token (legacy viralizer path).
  const bearer = process.env.X_ACCESS_TOKEN || process.env.X_BEARER_TOKEN || '';
  if (!bearer) return { ok: false, reason: 'no_credentials', platform: 'x' };
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'x' };
  const text = String(intent.body || intent.title || '').slice(0, 280);
  const r = await _safeFetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ text }),
  });
  return { ...r, platform: 'x' };
}

async function _publishDevto(intent) {
  const key = process.env.DEV_API_KEY || '';
  if (!key) return { ok: false, reason: 'no_credentials', platform: 'devto' };
  if (_isDryRun()) return { ok: true, dryRun: true, platform: 'devto' };
  const title = String(intent.title || 'ZeusAI Unicorn Update').slice(0, 120);
  const body = String(intent.body || '');
  const r = await _safeFetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'api-key': key,
    },
    body: JSON.stringify({
      article: {
        title,
        body_markdown: `${body}\n\n---\nPublished by ZeusAI Causal Virality Reflex.`,
        published: true,
        tags: ['ai', 'opensource', 'webdev', 'productivity'],
      },
    }),
  });
  return { ...r, platform: 'devto' };
}

function _publishRss(intent) {
  // Append a new <item> to a minimal RSS file. Always succeeds.
  try {
    _ensureDir();
    let header;
    let footer = '</channel></rss>';
    if (!fs.existsSync(RSS_FILE)) {
      header = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n'
        + '<title>ZeusAI / Unicorn Growth Feed</title>\n'
        + `<link>${String(process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/$/, '')}</link>\n`
        + '<description>Causal Virality Reflex + marketing publication feed</description>\n';
      fs.writeFileSync(RSS_FILE, header + footer);
    }
    const cur = fs.readFileSync(RSS_FILE, 'utf8');
    const item = `<item>\n<title>${_escapeXml(intent.title || 'Update')}</title>\n`
      + `<description>${_escapeXml(String(intent.body || '').slice(0, 1000))}</description>\n`
      + `<pubDate>${new Date().toUTCString()}</pubDate>\n`
      + `<guid isPermaLink="false">${crypto.randomBytes(8).toString('hex')}</guid>\n</item>\n`;
    const next = cur.replace('</channel></rss>', item + '</channel></rss>');
    fs.writeFileSync(RSS_FILE, next);
    return { ok: true, file: RSS_FILE };
  } catch (e) { return { ok: false, error: 'rss_write_failed' }; }
}

function _escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]);
}

const ADAPTERS = {
  telegram: _publishTelegram,
  discord: _publishDiscord,
  mastodon: _publishMastodon,
  bluesky: _publishBluesky,
  x: _publishX,
  devto: _publishDevto,
  linkedin: _publishLinkedIn,
  pinterest: _publishPinterest,
  generic: _publishGeneric,
  rss: async (i) => _publishRss(i),
};

/**
 * Publish to a single platform.
 *   intent = { platform, title?, body, url? }
 */
async function publish(intent) {
  if (DISABLED) return { ok: false, reason: 'pack_disabled' };
  const platform = String((intent && intent.platform) || '').toLowerCase();
  const adapter = ADAPTERS[platform];
  if (!adapter) return { ok: false, reason: 'unknown_platform' };
  if (_breakerOpen(platform)) {
    const evt = _record(platform, intent, { ok: false, reason: 'breaker_open' });
    return { ok: false, reason: 'breaker_open', evtTs: evt.ts };
  }
  if (!_allow(platform)) {
    const evt = _record(platform, intent, { ok: false, reason: 'rate_limited' });
    return { ok: false, reason: 'rate_limited', evtTs: evt.ts };
  }
  let result;
  try { result = await adapter(intent); } catch (e) { result = { ok: false, error: 'adapter_failed' }; }
  if (result && result.ok) _onSuccess(platform); else _onFailure(platform);
  const evt = _record(platform, intent, result || { ok: false });
  return { ...(result || {}), evtTs: evt.ts };
}

/**
 * Publish to multiple platforms in parallel.
 *   intent = { platforms: ['telegram', 'discord', ...], body, title? }
 */
async function broadcast(intent) {
  const platforms = Array.isArray(intent && intent.platforms) ? intent.platforms : Object.keys(ADAPTERS);
  const results = await Promise.all(platforms.map((p) => publish({ ...intent, platform: p })));
  return { ok: true, dryRun: _isDryRun(), count: results.length, results: platforms.map((p, i) => ({ platform: p, ...results[i] })) };
}

function status() {
  const tg = _telegramCreds();
  return {
    disabled: DISABLED,
    dryRun: _isDryRun(),
    rateLimitPerMin: RATE_LIMIT_PER_MIN,
    adapters: Object.keys(ADAPTERS),
    enabledAdapters: enabledPlatforms(),
    telegramEnv: {
      hasCredentials: tg.has,
      envSource: tg.has
        ? (process.env.TELEGRAM_BOT_TOKEN ? 'TELEGRAM_BOT_TOKEN' : 'TG_BOT_TOKEN (legacy)')
        : null,
    },
    breakers: Array.from(_breakers.entries()).map(([p, b]) => ({ platform: p, ...b })),
  };
}

function _adapterReady(k) {
  switch (k) {
    case 'telegram': return _telegramCreds().has;
    case 'discord': return !!(
      process.env.DISCORD_WEBHOOK_URL
      || process.env.DISCORD_WEBHOOK
      || process.env.ZAC_DISCORD_WEBHOOK
      || process.env.WATCHDOG_DISCORD_WEBHOOK
    );
    case 'mastodon': return !!(process.env.MASTODON_INSTANCE && process.env.MASTODON_TOKEN);
    case 'bluesky': return !!(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
    case 'x': return !!(process.env.X_ACCESS_TOKEN || process.env.X_BEARER_TOKEN);
    case 'devto': return !!process.env.DEV_API_KEY;
    case 'linkedin': return !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN);
    case 'pinterest': return !!(process.env.PINTEREST_TOKEN && process.env.PINTEREST_BOARD_ID);
    case 'generic': return !!(
      process.env.GENERIC_WEBHOOK_URL
      || process.env.WEBHOOK_URL
      || process.env.GH_WEBHOOK_URL
      || process.env.HETZNER_WEBHOOK_URL
    );
    case 'rss': return true;
    default: return false;
  }
}

function enabledPlatforms() {
  return Object.keys(ADAPTERS).filter((k) => _adapterReady(k));
}

function recent(limit) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 50));
  try {
    if (!fs.existsSync(LEDGER)) return [];
    const lines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-lim).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
  } catch (_) { return []; }
}

function _resetForTests() { _windows.clear(); _breakers.clear(); }

module.exports = { publish, broadcast, status, recent, enabledPlatforms, _resetForTests };
