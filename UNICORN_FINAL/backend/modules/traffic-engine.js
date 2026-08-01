// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-12
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// traffic-engine.js — Autonomous traffic acquisition (REAL protocols).
//
// Audit 2026-06-12 verdict: the platform sells (25 SSR products, BTC
// checkout, signed receipts) but NOBODY VISITS. This module is the organ
// that pushes every sellable URL into search-engine discovery pipelines —
// automatically, on a schedule, with honest per-engine result records.
//
// What it actually does (no fake claims):
//   • IndexNow protocol (api.indexnow.org → Bing, Seznam, Naver, Yandex):
//     deterministic key, served by the site at /indexnow-<key>.txt.
//   • Google: sitemap discovery only (Google retired the ping endpoint in
//     2023 — we record that honestly instead of pretending to ping).
//   • Builds the canonical URL inventory: core pages + every /services/:id
//     + every /vertical/:id landing page.
//   • Outreach: ranks the sales-leads ledger via ai-sdr-agent into a
//     persisted outreach queue (sending stays SMTP-gated — honest status).
//
// Bounded: one unref()'d interval (6h), capped URL list, single JSON state
// file. Never mutates prices, never touches PM2 (golden rules 6/7).
// RO: motor de trafic autonom — împinge URL-urile spre motoare de căutare
// și pregătește coada de outreach din lead-uri reale.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'traffic-engine';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');
const HOST = (() => { try { return new URL(APP_URL).host; } catch (_) { return 'zeusai.pro'; } })();
const STATE_FILE = process.env.TRAFFIC_ENGINE_FILE
  || path.resolve(__dirname, '..', '..', 'data', 'traffic', 'traffic-engine.json');
const OUTREACH_FILE = process.env.TRAFFIC_OUTREACH_FILE
  || path.resolve(__dirname, '..', '..', 'data', 'traffic', 'outreach-queue.json');
const INTERVAL_MS = Math.max(30 * 60 * 1000, Number(process.env.TRAFFIC_ENGINE_INTERVAL_MS || 6 * 3600 * 1000));
const MAX_URLS = 200; // IndexNow allows 10k/post; we stay far below
const FETCH_TIMEOUT_MS = 8000;

// Deterministic IndexNow key — same derivation on site (which serves the
// key file) and backend (which submits). 32 hex chars, stable per domain.
// RO: cheia e derivată determinist ca site-ul și backend-ul să coincidă.
function indexNowKey() {
  if (process.env.INDEXNOW_KEY) return String(process.env.INDEXNOW_KEY).slice(0, 64);
  if (process.env.MARKETING_INDEXNOW_KEY) return String(process.env.MARKETING_INDEXNOW_KEY).slice(0, 64);
  return crypto.createHash('sha256').update('zeusai-indexnow:' + HOST).digest('hex').slice(0, 32);
}

const state = {
  startedAt: null,
  lastRunAt: null,
  runs: 0,
  lastSubmission: null,   // { at, urlCount, engines: [{engine, status, ok}] }
  history: [],            // last 20 submissions (bounded)
  outreach: null,         // { builtAt, queued, topLeads }
};

function _loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') Object.assign(state, raw);
    if (!Array.isArray(state.history)) state.history = [];
  } catch (_) {}
}

function _saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  } catch (_) {}
}

// ── URL inventory ────────────────────────────────────────────────────
function _catalogIds() {
  const ids = [];
  const tryMod = (p) => { try { return require(p); } catch (_) { return null; } };
  const uni = tryMod('../../src/commerce/unified-catalog');
  try {
    const items = uni && typeof uni.all === 'function' ? uni.all() : [];
    for (const it of items || []) if (it && it.id) ids.push(String(it.id));
  } catch (_) {}
  return ids;
}

function _verticalIds() {
  try {
    const seo = require('./programmatic-seo-engine');
    return (seo.listVerticals() || []).map((v) => v.id);
  } catch (_) { return []; }
}

/** Canonical list of every URL worth indexing. Deterministic, capped. */
function urlsToSubmit() {
  const core = ['/', '/buy', '/services', '/pricing', '/store', '/checkout', '/status', '/proof', '/trust', '/verticals',
    '/contact', '/faq', '/blog', '/affiliate', '/partners', '/roadmap', '/careers', '/press',
    '/enterprise', '/wizard', '/dropship', '/zacc', '/marketplace', '/tg'];
  const urls = new Set(core.map((p) => APP_URL + p));
  for (const id of _catalogIds()) urls.add(APP_URL + '/services/' + encodeURIComponent(id));
  for (const id of _verticalIds()) urls.add(APP_URL + '/vertical/' + encodeURIComponent(id));
  // Billion Autonomy Loop — prioritize instant digital money pages when catalog is large
  try {
    const instant = require('../../src/commerce/instant-catalog');
    const all = instant && typeof instant.all === 'function' ? instant.all() : [];
    for (const p of all || []) {
      if (p && p.id) {
        urls.add(APP_URL + '/services/' + encodeURIComponent(p.id));
        urls.add(APP_URL + '/checkout/?plan=' + encodeURIComponent(p.id));
      }
    }
  } catch (_) { /* optional */ }
  return Array.from(urls).slice(0, MAX_URLS);
}

// ── Search-engine submission (IndexNow) ─────────────────────────────
async function _postJson(url, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return { status: res.status, ok: res.status >= 200 && res.status < 300 };
  } finally { clearTimeout(t); }
}

/**
 * Submit the URL inventory to real discovery endpoints.
 * opts.urls: custom URL subset (e.g. flywheel top-yield resubmission).
 * opts.dryRun: build + return the plan without network calls (tests/CI).
 */
async function pingAll(opts) {
  const dryRun = !!(opts && opts.dryRun);
  const key = indexNowKey();
  const urlList = (opts && Array.isArray(opts.urls) && opts.urls.length > 0)
    ? opts.urls.slice(0, MAX_URLS)
    : urlsToSubmit();
  const submission = {
    at: new Date().toISOString(),
    urlCount: urlList.length,
    keyLocation: APP_URL + '/indexnow-' + key + '.txt',
    engines: [],
    dryRun,
  };
  const payload = { host: HOST, key, keyLocation: submission.keyLocation, urlList };
  const endpoints = [
    ['indexnow.org', 'https://api.indexnow.org/indexnow'],
    ['bing', 'https://www.bing.com/indexnow'],
  ];
  for (const [engine, url] of endpoints) {
    if (dryRun) { submission.engines.push({ engine, status: 'dry-run', ok: null }); continue; }
    try {
      const r = await _postJson(url, payload);
      submission.engines.push({ engine, status: r.status, ok: r.ok });
    } catch (e) {
      submission.engines.push({ engine, status: 'error', ok: false, error: e && e.message });
    }
  }
  // Google: no ping API anymore — discovery happens via robots.txt sitemap.
  submission.engines.push({ engine: 'google', status: 'sitemap-discovery', ok: null, note: 'ping API retired 2023; sitemap.xml + sitemap-services.xml referenced in robots.txt' });
  state.lastSubmission = submission;
  state.history.unshift({ at: submission.at, urlCount: submission.urlCount, ok: submission.engines.filter((e) => e.ok).length, dryRun });
  state.history = state.history.slice(0, 20);
  _saveState();
  return submission;
}

// ── Outreach queue (from real leads ledger) ──────────────────────────
function buildOutreachQueue(opts) {
  let queue = [];
  try {
    const sdr = require('./ai-sdr-agent');
    const out = sdr.buildQueue({ limit: (opts && opts.limit) || 50 });
    queue = Array.isArray(out) ? out : (out && Array.isArray(out.queue) ? out.queue : []);
  } catch (_) {}
  const smtpReady = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  const snapshot = {
    builtAt: new Date().toISOString(),
    queued: queue.length,
    sending: smtpReady ? 'smtp-configured' : 'blocked: SMTP credentials not configured — queue persisted, nothing fabricated',
    topLeads: queue.slice(0, 10),
  };
  state.outreach = { builtAt: snapshot.builtAt, queued: snapshot.queued, sending: snapshot.sending };
  try {
    fs.mkdirSync(path.dirname(OUTREACH_FILE), { recursive: true });
    fs.writeFileSync(OUTREACH_FILE, JSON.stringify(snapshot, null, 2));
  } catch (_) {}
  _saveState();
  return snapshot;
}

// ── Lifecycle ────────────────────────────────────────────────────────
let _interval = null;

async function runCycle(opts) {
  state.runs += 1;
  state.lastRunAt = new Date().toISOString();
  const submission = await pingAll(opts);
  const outreach = buildOutreachQueue(opts);
  _saveState();
  return { ok: true, submission, outreach };
}

function start() {
  if (_interval) return { ok: true, alreadyRunning: true };
  state.startedAt = new Date().toISOString();
  // First run after 90s (let the box settle post-deploy), then every 6h.
  const kick = setTimeout(() => { runCycle().catch((e) => console.warn('[' + NAME + '] cycle failed:', e && e.message)); }, 90 * 1000);
  if (kick.unref) kick.unref();
  _interval = setInterval(() => {
    runCycle().catch((e) => console.warn('[' + NAME + '] cycle failed:', e && e.message));
  }, INTERVAL_MS);
  if (_interval.unref) _interval.unref();
  console.log('🚦 [' + NAME + '] started — IndexNow host=' + HOST + ' every ' + Math.round(INTERVAL_MS / 60000) + 'min, ' + urlsToSubmit().length + ' URLs in inventory');
  return { ok: true };
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
  return { ok: true };
}

function getStatus() {
  return {
    module: NAME,
    running: !!_interval,
    startedAt: state.startedAt,
    lastRunAt: state.lastRunAt,
    runs: state.runs,
    intervalMinutes: Math.round(INTERVAL_MS / 60000),
    host: HOST,
    indexNowKeyLocation: APP_URL + '/indexnow-' + indexNowKey() + '.txt',
    urlInventory: urlsToSubmit().length,
    lastSubmission: state.lastSubmission,
    outreach: state.outreach,
    history: state.history,
  };
}

function _resetForTests() {
  stop();
  state.startedAt = null; state.lastRunAt = null; state.runs = 0;
  state.lastSubmission = null; state.history = []; state.outreach = null;
  try { fs.rmSync(STATE_FILE, { force: true }); fs.rmSync(OUTREACH_FILE, { force: true }); } catch (_) {}
}

_loadState();

module.exports = { name: NAME, start, stop, runCycle, pingAll, buildOutreachQueue, urlsToSubmit, indexNowKey, getStatus, _resetForTests };
