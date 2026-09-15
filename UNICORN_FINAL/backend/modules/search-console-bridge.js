'use strict';

// =====================================================================
// search-console-bridge.js — SEBP/1.0 Search Engine Bridge Protocol
//
// Removes the two manual steps that kept zeusai.pro invisible:
//   1. "Bing Webmaster Tools → add site + verify"  → Bing Webmaster API
//   2. "Google Search Console → submit sitemap.xml" → siteVerification +
//      Search Console (webmasters v3) API
//
// Both run only when the owner supplies ONE secret per engine. Without the
// secret this module reports `blocked` with the exact secret name — it never
// claims a submission happened, never invents crawl counts, impressions,
// clicks, or visitors.
//
// Google chain (fully automatic once GOOGLE_SERVICE_ACCOUNT_JSON exists):
//   getToken(FILE) → persist token so the site serves /google<hash>.html
//   → webResource.insert (ownership verified) → sites.add → sitemaps.submit
//
// Zero npm dependencies: the RS256 service-account JWT is signed with the
// built-in crypto module.
//
// RO: pod către motoarele de căutare — verifică proprietatea și trimite
// sitemap-ul automat când există secretul, altfel spune cinstit ce lipsește.
// =====================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'SEBP/1.0';
const NAME = 'search-console-bridge';

const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');
const SITE_URL = APP_URL + '/';
const HOST = (() => { try { return new URL(APP_URL).host; } catch (_) { return 'zeusai.pro'; } })();
const SITEMAP_URL = APP_URL + '/sitemap.xml';

const DATA_DIR = process.env.SEO_BRIDGE_DIR
  || path.resolve(__dirname, '..', '..', 'data', 'seo');
const STATE_FILE = path.join(DATA_DIR, 'search-console-bridge.json');
const GOOGLE_VERIFY_FILE = path.join(DATA_DIR, 'google-verification.json');

const FETCH_TIMEOUT_MS = Math.max(3000, Number(process.env.SEO_BRIDGE_TIMEOUT_MS || 10000));
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/siteverification',
  'https://www.googleapis.com/auth/webmasters',
].join(' ');

const BING_API = 'https://ssl.bing.com/webmaster/api.svc/json';

const SECRET_HINTS = {
  bing: 'BING_WEBMASTER_API_KEY',
  google: 'GOOGLE_SERVICE_ACCOUNT_JSON',
};

const state = {
  lastRunAt: null,
  runs: 0,
  bing: null,
  google: null,
};

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') Object.assign(state, raw);
  } catch (_) { /* ignore */ }
}

function _saveState() {
  try {
    _ensureDir();
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  } catch (_) { /* ignore */ }
}

function disabled() {
  return process.env.SEO_BRIDGE_DISABLED === '1';
}

// ── HTTP helpers ─────────────────────────────────────────────────────
async function _request(url, opts) {
  const o = opts || {};
  if (typeof fetch !== 'function') {
    return { ok: false, status: 0, error: 'fetch_unavailable' };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: o.method || 'GET',
      headers: Object.assign(
        { 'User-Agent': 'ZeusAI-SearchConsoleBridge/1.0 (+' + APP_URL + ')' },
        o.headers || {}
      ),
      body: o.body,
      signal: ctrl.signal,
    });
    let text = '';
    try { text = await res.text(); } catch (_) { /* body optional */ }
    let json = null;
    if (text) { try { json = JSON.parse(text); } catch (_) { /* not json */ } }
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json,
      detail: res.status >= 200 && res.status < 300 ? undefined : String(text || '').slice(0, 240),
    };
  } catch (e) {
    return { ok: false, status: 0, error: (e && e.name === 'AbortError') ? 'timeout' : (e && e.message) || 'request_failed' };
  } finally {
    clearTimeout(timer);
  }
}

function _postJson(url, body, headers) {
  return _request(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}),
    body: JSON.stringify(body),
  });
}

// ── Bing Webmaster ───────────────────────────────────────────────────
function bingApiKey() {
  return String(process.env.BING_WEBMASTER_API_KEY || process.env.BING_API_KEY || '').trim();
}

/**
 * Add the site to Bing Webmaster Tools and submit the sitemap + URL batch.
 * Bing verifies ownership via the IndexNow key file we already serve, so a
 * single API key is enough to end the 403 UserForbiddedToAccessSite loop.
 */
async function runBing(opts) {
  const o = opts || {};
  const key = bingApiKey();
  if (!key) {
    return {
      engine: 'bing',
      armed: false,
      blocked: 'no_api_key',
      secret: SECRET_HINTS.bing,
      action: 'Bing Webmaster Tools → Settings → API Access → generate key → add it as the GitHub secret BING_WEBMASTER_API_KEY. Then this bridge adds the site and submits the sitemap on its own.',
      invented: false,
    };
  }
  const urlList = Array.isArray(o.urls) && o.urls.length > 0
    ? o.urls.slice(0, 100)
    : [APP_URL + '/', APP_URL + '/buy', APP_URL + '/first-dollar', APP_URL + '/visible-world'];
  if (o.dryRun) {
    return {
      engine: 'bing',
      armed: true,
      dryRun: true,
      steps: ['AddSite', 'SubmitFeed', 'SubmitUrlbatch'],
      siteUrl: SITE_URL,
      feedUrl: SITEMAP_URL,
      urlCount: urlList.length,
      invented: false,
    };
  }

  const steps = [];
  const addSite = await _postJson(BING_API + '/AddSite?apikey=' + encodeURIComponent(key), { siteUrl: SITE_URL });
  steps.push({
    step: 'AddSite',
    status: addSite.status,
    ok: addSite.ok,
    // Bing answers 400 when the site is already present — that is success for us.
    alreadyPresent: !addSite.ok && /already/i.test(String(addSite.detail || '')),
    detail: addSite.detail,
    error: addSite.error,
  });

  const feed = await _postJson(BING_API + '/SubmitFeed?apikey=' + encodeURIComponent(key), {
    siteUrl: SITE_URL,
    feedUrl: SITEMAP_URL,
  });
  steps.push({ step: 'SubmitFeed', status: feed.status, ok: feed.ok, detail: feed.detail, error: feed.error });

  const batch = await _postJson(BING_API + '/SubmitUrlbatch?apikey=' + encodeURIComponent(key), {
    siteUrl: SITE_URL,
    urlList,
  });
  steps.push({ step: 'SubmitUrlbatch', status: batch.status, ok: batch.ok, urlCount: urlList.length, detail: batch.detail, error: batch.error });

  return {
    engine: 'bing',
    armed: true,
    at: new Date().toISOString(),
    ok: steps.some((s) => s.ok),
    steps,
    note: 'Submitting URLs is not traffic. Bing decides whether and when to crawl.',
    invented: false,
  };
}

// ── Google service account ───────────────────────────────────────────
/**
 * A service-account key is multi-line, which a raw .env line cannot carry
 * losslessly, so the base64 form is tried first and is what sync-all-secrets
 * ships. Either form is accepted.
 */
function _serviceAccount() {
  const candidates = [];
  const b64 = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 || '').trim();
  if (b64) {
    try { candidates.push(Buffer.from(b64, 'base64').toString('utf8')); } catch (_) { /* not base64 */ }
  }
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim();
  if (raw) candidates.push(raw);
  for (const text of candidates) {
    if (!text) continue;
    try {
      const sa = JSON.parse(text);
      if (sa && sa.client_email && sa.private_key) return sa;
    } catch (_) { /* try the next form */ }
  }
  return null;
}

function _b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RS256 service-account assertion → OAuth2 access token. No npm deps. */
async function _googleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = _b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = _b64url(JSON.stringify({
    iss: sa.client_email,
    scope: GOOGLE_SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + '.' + claims;
  let signature;
  try {
    signature = _b64url(crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key));
  } catch (e) {
    return { ok: false, error: 'jwt_sign_failed' };
  }
  const res = await _request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(unsigned + '.' + signature),
  });
  if (!res.ok || !res.json || !res.json.access_token) {
    return { ok: false, status: res.status, error: res.error || 'token_exchange_failed', detail: res.detail };
  }
  return { ok: true, accessToken: res.json.access_token };
}

/**
 * Persist the Google FILE verification token so the site process can serve
 * /google<hash>.html. Backend and site share the data directory.
 */
function persistGoogleVerification(fileName) {
  const clean = String(fileName || '').trim();
  if (!/^google[A-Za-z0-9_-]+\.html$/.test(clean)) return { ok: false, error: 'bad_token' };
  const record = {
    protocol: PROTOCOL,
    fileName: clean,
    path: '/' + clean,
    body: 'google-site-verification: ' + clean,
    persistedAt: new Date().toISOString(),
  };
  try {
    _ensureDir();
    const tmp = GOOGLE_VERIFY_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2));
    fs.renameSync(tmp, GOOGLE_VERIFY_FILE);
    return { ok: true, record };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'persist_failed' };
  }
}

function readGoogleVerification() {
  try {
    if (!fs.existsSync(GOOGLE_VERIFY_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(GOOGLE_VERIFY_FILE, 'utf8'));
    if (raw && raw.fileName && raw.path && raw.body) return raw;
  } catch (_) { /* ignore */ }
  return null;
}

/**
 * Full Google chain. Each stage is recorded honestly; a failure at any stage
 * stops the chain and names what the owner must check.
 */
async function runGoogle(opts) {
  const o = opts || {};
  const sa = _serviceAccount();
  if (!sa) {
    return {
      engine: 'google',
      armed: false,
      blocked: 'no_service_account',
      secret: SECRET_HINTS.google,
      action: 'Google Cloud → IAM → Service Accounts → create key (JSON) → enable "Site Verification API" + "Search Console API" → paste the whole JSON as the GitHub secret GOOGLE_SERVICE_ACCOUNT_JSON. Then this bridge verifies ownership and submits the sitemap on its own.',
      manualFallback: 'Until then: Search Console → add https://zeusai.pro → verify → submit https://zeusai.pro/sitemap.xml (Google retired the ping API in 2023).',
      invented: false,
    };
  }
  if (o.dryRun) {
    return {
      engine: 'google',
      armed: true,
      dryRun: true,
      clientEmail: sa.client_email,
      steps: ['token', 'getToken(FILE)', 'persistFile', 'webResource.insert', 'sites.add', 'sitemaps.submit'],
      siteUrl: SITE_URL,
      sitemap: SITEMAP_URL,
      invented: false,
    };
  }

  const steps = [];
  const auth = await _googleAccessToken(sa);
  steps.push({ step: 'token', ok: auth.ok, status: auth.status, error: auth.error, detail: auth.detail });
  if (!auth.ok) {
    return { engine: 'google', armed: true, at: new Date().toISOString(), ok: false, steps, invented: false };
  }
  const bearer = { Authorization: 'Bearer ' + auth.accessToken };

  // 1. Ask Google for a FILE verification token.
  const tok = await _postJson('https://www.googleapis.com/siteVerification/v1/token', {
    verificationMethod: 'FILE',
    site: { type: 'SITE', identifier: SITE_URL },
  }, bearer);
  const fileName = tok.json && tok.json.token ? String(tok.json.token) : '';
  steps.push({ step: 'getToken', ok: tok.ok && !!fileName, status: tok.status, fileName: fileName || undefined, detail: tok.detail, error: tok.error });
  if (!tok.ok || !fileName) {
    return { engine: 'google', armed: true, at: new Date().toISOString(), ok: false, steps, invented: false };
  }

  // 2. Serve it from the site root before asking Google to look.
  const persisted = persistGoogleVerification(fileName);
  steps.push({ step: 'persistFile', ok: persisted.ok, path: persisted.record ? persisted.record.path : undefined, error: persisted.error });
  if (!persisted.ok) {
    return { engine: 'google', armed: true, at: new Date().toISOString(), ok: false, steps, invented: false };
  }
  // Deliberately not unref'd: a 1.5s wait must survive an otherwise-idle
  // event loop, or the chain would abandon itself in a short-lived process.
  await new Promise((resolve) => { setTimeout(resolve, 1500); });

  // 3. Claim ownership.
  const insert = await _postJson(
    'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE',
    { site: { type: 'SITE', identifier: SITE_URL } },
    bearer
  );
  steps.push({
    step: 'webResource.insert',
    ok: insert.ok,
    status: insert.status,
    detail: insert.detail,
    error: insert.error,
    note: insert.ok ? undefined : 'Google could not read ' + APP_URL + persisted.record.path + ' — check that the site process serves it.',
  });
  if (!insert.ok) {
    return { engine: 'google', armed: true, at: new Date().toISOString(), ok: false, steps, invented: false };
  }

  // 4. Add the Search Console property, then submit the sitemap.
  const encodedSite = encodeURIComponent(SITE_URL);
  const addSite = await _request('https://www.googleapis.com/webmasters/v3/sites/' + encodedSite, {
    method: 'PUT',
    headers: bearer,
  });
  steps.push({ step: 'sites.add', ok: addSite.ok, status: addSite.status, detail: addSite.detail, error: addSite.error });

  const submit = await _request(
    'https://www.googleapis.com/webmasters/v3/sites/' + encodedSite + '/sitemaps/' + encodeURIComponent(SITEMAP_URL),
    { method: 'PUT', headers: bearer }
  );
  steps.push({ step: 'sitemaps.submit', ok: submit.ok, status: submit.status, sitemap: SITEMAP_URL, detail: submit.detail, error: submit.error });

  return {
    engine: 'google',
    armed: true,
    at: new Date().toISOString(),
    ok: submit.ok,
    verified: insert.ok,
    steps,
    note: 'A submitted sitemap is not a ranking and not a visitor. Google decides if and when to crawl and rank.',
    invented: false,
  };
}

// ── Cycle ────────────────────────────────────────────────────────────
async function runCycle(opts) {
  const o = opts || {};
  if (disabled()) {
    return { protocol: PROTOCOL, ok: false, disabled: true, reason: 'SEO_BRIDGE_DISABLED=1' };
  }
  const bing = await runBing(o);
  const google = await runGoogle(o);
  state.lastRunAt = new Date().toISOString();
  state.runs += 1;
  state.bing = bing;
  state.google = google;
  if (!o.dryRun) _saveState();
  return { protocol: PROTOCOL, ok: true, at: state.lastRunAt, bing, google };
}

function armedEngines() {
  const out = [];
  if (bingApiKey()) out.push('bing');
  if (_serviceAccount()) out.push('google');
  return out;
}

function missingSecrets() {
  const out = [];
  if (!bingApiKey()) out.push({ engine: 'bing', secret: SECRET_HINTS.bing, unlocks: 'Bing/Yandex site ownership + sitemap + URL batch submission' });
  if (!_serviceAccount()) out.push({ engine: 'google', secret: SECRET_HINTS.google, unlocks: 'Google ownership verification + Search Console property + sitemap submission' });
  return out;
}

function getStatus() {
  const armed = armedEngines();
  return {
    protocol: PROTOCOL,
    module: NAME,
    disabled: disabled(),
    host: HOST,
    siteUrl: SITE_URL,
    sitemap: SITEMAP_URL,
    armedEngines: armed,
    missingSecrets: missingSecrets(),
    googleVerificationFile: (() => { const v = readGoogleVerification(); return v ? v.path : null; })(),
    lastRunAt: state.lastRunAt,
    runs: state.runs,
    bing: state.bing,
    google: state.google,
    inventsVisitors: false,
    inventsCrawlCounts: false,
    inventsRankings: false,
    note: 'Ownership + sitemap submission only. This module never reports impressions, clicks, or visitors.',
  };
}

function _resetForTests() {
  state.lastRunAt = null;
  state.runs = 0;
  state.bing = null;
  state.google = null;
  try { fs.rmSync(STATE_FILE, { force: true }); } catch (_) { /* ignore */ }
  try { fs.rmSync(GOOGLE_VERIFY_FILE, { force: true }); } catch (_) { /* ignore */ }
}

_loadState();

module.exports = {
  PROTOCOL,
  name: NAME,
  SECRET_HINTS,
  disabled,
  bingApiKey,
  runBing,
  runGoogle,
  runCycle,
  armedEngines,
  missingSecrets,
  persistGoogleVerification,
  readGoogleVerification,
  getStatus,
  _resetForTests,
};
