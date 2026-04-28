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
// Default behavior is DRY-RUN — set MARKETING_OUTBOUND_DRYRUN=0 to
// actually emit network traffic. This is a safety net for production.
//
// Adapters:
//   - telegram   (TG_BOT_TOKEN + TG_CHAT_ID)
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

// Default-on dry-run: only emit real network when explicitly disabled.
const DRYRUN = String(process.env.MARKETING_OUTBOUND_DRYRUN || '1') !== '0';
const DISABLED = process.env.MARKETING_OUTBOUND_DISABLED === '1';
const RATE_LIMIT_PER_MIN = Math.max(1, Number(process.env.MARKETING_OUTBOUND_RATE_PER_MIN) || 30);

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
    return { ok: r.ok, status: r.status };
  } finally { clearTimeout(timeout); }
}

function _record(platform, intent, result) {
  const evt = {
    ts: new Date().toISOString(),
    platform,
    dryRun: DRYRUN,
    intent: { ...intent, body: typeof intent.body === 'string' ? intent.body.slice(0, 500) : intent.body },
    result,
  };
  _persist(evt);
  return evt;
}

// ── Adapters ───────────────────────────────────────────────────────────

async function _publishTelegram(intent) {
  const token = process.env.TG_BOT_TOKEN || '';
  const chat = process.env.TG_CHAT_ID || '';
  if (!token || !chat) return { ok: false, reason: 'no_credentials' };
  if (DRYRUN) return { ok: true, dryRun: true };
  return _safeFetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: String(intent.body || ''), disable_web_page_preview: false }),
  });
}

async function _publishDiscord(intent) {
  const url = process.env.DISCORD_WEBHOOK_URL || '';
  if (!url) return { ok: false, reason: 'no_credentials' };
  if (DRYRUN) return { ok: true, dryRun: true };
  return _safeFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: String(intent.body || '').slice(0, 1900) }),
  });
}

async function _publishMastodon(intent) {
  const inst = (process.env.MASTODON_INSTANCE || '').replace(/\/$/, '');
  const tok = process.env.MASTODON_TOKEN || '';
  if (!inst || !tok) return { ok: false, reason: 'no_credentials' };
  if (DRYRUN) return { ok: true, dryRun: true };
  return _safeFetch(`${inst}/api/v1/statuses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${tok}` },
    body: JSON.stringify({ status: String(intent.body || '').slice(0, 500) }),
  });
}

async function _publishBluesky(intent) {
  const handle = process.env.BLUESKY_HANDLE || '';
  const pwd = process.env.BLUESKY_APP_PASSWORD || '';
  if (!handle || !pwd) return { ok: false, reason: 'no_credentials' };
  if (DRYRUN) return { ok: true, dryRun: true };
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
  const url = process.env.GENERIC_WEBHOOK_URL || '';
  if (!url) return { ok: false, reason: 'no_credentials' };
  if (DRYRUN) return { ok: true, dryRun: true };
  return _safeFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...intent, ts: new Date().toISOString() }),
  });
}

function _publishRss(intent) {
  // Append a new <item> to a minimal RSS file. Always succeeds.
  try {
    _ensureDir();
    let header;
    let footer = '</channel></rss>';
    if (!fs.existsSync(RSS_FILE)) {
      header = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n'
        + '<title>Unicorn Marketing Feed</title>\n'
        + '<link>https://unicorn.local/</link>\n'
        + '<description>Additive marketing publication feed</description>\n';
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
  return { ok: true, dryRun: DRYRUN, count: results.length, results: platforms.map((p, i) => ({ platform: p, ...results[i] })) };
}

function status() {
  return {
    disabled: DISABLED,
    dryRun: DRYRUN,
    rateLimitPerMin: RATE_LIMIT_PER_MIN,
    adapters: Object.keys(ADAPTERS),
    enabledAdapters: Object.keys(ADAPTERS).filter((k) => _adapterReady(k)),
    breakers: Array.from(_breakers.entries()).map(([p, b]) => ({ platform: p, ...b })),
  };
}

function _adapterReady(k) {
  switch (k) {
    case 'telegram': return !!(process.env.TG_BOT_TOKEN && process.env.TG_CHAT_ID);
    case 'discord': return !!process.env.DISCORD_WEBHOOK_URL;
    case 'mastodon': return !!(process.env.MASTODON_INSTANCE && process.env.MASTODON_TOKEN);
    case 'bluesky': return !!(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
    case 'generic': return !!process.env.GENERIC_WEBHOOK_URL;
    case 'rss': return true;
    default: return false;
  }
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

module.exports = { publish, broadcast, status, recent, _resetForTests };
