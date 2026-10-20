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
// clicks, or visitors. A performance read reports those four numbers only
// when Search Console returns them. A domain property is `sc-domain:zeusai.pro`;
// a URL-prefix property is `https://zeusai.pro/`. The read tries the domain
// property first because that is how a verified "zeusai.pro" property is named.
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
  performance: null,
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
      action: 'Do not paste the JSON into chat, GitHub, or a raw .env line. Place the service-account file at /var/www/unicorn/shared/search-console-key.json and run node scripts/search-console-key-install.js. It probes Search Console, writes only GOOGLE_SERVICE_ACCOUNT_JSON_B64, and does not restart PM2.',
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

function _blankMetrics() {
  return {
    clicks: { status: 'unavailable', value: null },
    impressions: { status: 'unavailable', value: null },
    ctr: { status: 'unavailable', value: null },
    position: { status: 'unavailable', value: null },
  };
}

function propertyCandidates() {
  const list = [];
  const add = (value) => {
    const v = String(value || '').trim();
    if (v && list.indexOf(v) === -1) list.push(v);
  };
  add(process.env.SEARCH_CONSOLE_SITE_URL);
  add('sc-domain:' + HOST);
  add(SITE_URL);
  return list;
}

function _ymd(date) {
  return date.toISOString().slice(0, 10);
}

function _range() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: _ymd(start), endDate: _ymd(end) };
}

function _redact(detail) {
  return String(detail || '')
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, '[redacted]')
    .replace(/"private_key"\s*:\s*"[^"]*"/g, '"private_key":"[redacted]"')
    .replace(/ya29\.[A-Za-z0-9._-]+/g, '[redacted]')
    .slice(0, 240);
}

function _measured(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return { status: 'unavailable', value: null };
  return { status: 'measured', value };
}

/**
 * Read clicks, impressions, CTR, and average position for the verified
 * property. Empty Search Console rows are a measured zero for clicks and
 * impressions. CTR and position stay unavailable when Google returned no row,
 * because an average does not exist. This function never returns the key or
 * the access token.
 */
async function readPerformance(opts) {
  const o = opts || {};
  const report = {
    ok: false,
    protocol: PROTOCOL,
    host: HOST,
    inventsClicks: false,
    inventsImpressions: false,
    inventsCtr: false,
    inventsPosition: false,
    range: _range(),
    candidates: propertyCandidates(),
    siteUrl: null,
    metrics: _blankMetrics(),
    pages: { status: 'unavailable', value: null },
    sitemap: { status: 'unavailable', path: SITEMAP_URL, errors: null, warnings: null, pending: null },
    attempts: [],
  };
  const sa = _serviceAccount();
  if (!sa) {
    report.blocked = true;
    report.reason = 'no_service_account';
    report.secret = SECRET_HINTS.google;
    return report;
  }
  report.armed = true;
  if (o.dryRun) {
    report.ok = true;
    report.dryRun = true;
    report.reason = 'dry_run';
    return report;
  }
  const auth = await _googleAccessToken(sa);
  if (!auth.ok) {
    report.blocked = true;
    report.reason = 'token_exchange_failed';
    report.error = auth.error || 'token_exchange_failed';
    report.status = auth.status || 0;
    report.detail = _redact(auth.detail);
    return report;
  }
  const bearer = { Authorization: 'Bearer ' + auth.accessToken };
  const range = report.range;
  for (const siteUrl of report.candidates) {
    const encoded = encodeURIComponent(siteUrl);
    const analytics = await _request(
      'https://www.googleapis.com/webmasters/v3/sites/' + encoded + '/searchAnalytics/query',
      {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, bearer),
        body: JSON.stringify({ startDate: range.startDate, endDate: range.endDate, type: 'web', rowLimit: 1 }),
      }
    );
    report.attempts.push({ siteUrl, call: 'searchAnalytics', status: analytics.status, ok: analytics.ok });
    if (!analytics.ok) continue;
    const row = analytics.json && Array.isArray(analytics.json.rows) ? analytics.json.rows[0] : null;
    if (row) {
      report.metrics.clicks = _measured(row.clicks);
      report.metrics.impressions = _measured(row.impressions);
      report.metrics.ctr = _measured(row.ctr);
      report.metrics.position = _measured(row.position);
    } else {
      report.metrics.clicks = { status: 'measured', value: 0 };
      report.metrics.impressions = { status: 'measured', value: 0 };
      report.metrics.ctr = { status: 'unavailable', value: null };
      report.metrics.position = { status: 'unavailable', value: null };
    }
    const pages = await _request(
      'https://www.googleapis.com/webmasters/v3/sites/' + encoded + '/searchAnalytics/query',
      {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, bearer),
        body: JSON.stringify({
          startDate: range.startDate,
          endDate: range.endDate,
          type: 'web',
          dimensions: ['page'],
          rowLimit: 5,
        }),
      }
    );
    report.attempts.push({ siteUrl, call: 'pages', status: pages.status, ok: pages.ok });
    if (pages.ok) {
      const list = pages.json && Array.isArray(pages.json.rows) ? pages.json.rows : [];
      report.pages = {
        status: 'measured',
        value: list.map((item) => ({
          page: item && item.keys ? item.keys[0] : null,
          clicks: Number.isFinite(Number(item && item.clicks)) ? Number(item.clicks) : null,
          impressions: Number.isFinite(Number(item && item.impressions)) ? Number(item.impressions) : null,
          ctr: Number.isFinite(Number(item && item.ctr)) ? Number(item.ctr) : null,
          position: Number.isFinite(Number(item && item.position)) ? Number(item.position) : null,
        })),
      };
    }
    const maps = await _request(
      'https://www.googleapis.com/webmasters/v3/sites/' + encoded + '/sitemaps',
      { headers: bearer }
    );
    report.attempts.push({ siteUrl, call: 'sitemaps', status: maps.status, ok: maps.ok });
    if (maps.ok) {
      const all = maps.json && Array.isArray(maps.json.sitemap) ? maps.json.sitemap : [];
      const match = all.find((item) => item && item.path === SITEMAP_URL) || all[0] || null;
      if (!match) {
        report.sitemap = { status: 'missing', path: SITEMAP_URL, errors: null, warnings: null, pending: null, listed: all.length };
      } else {
        const errors = Number(match.errors);
        const warnings = Number(match.warnings);
        report.sitemap = {
          status: Number.isFinite(errors) && errors > 0 ? 'errors' : 'ok',
          path: match.path || SITEMAP_URL,
          errors: Number.isFinite(errors) ? errors : null,
          warnings: Number.isFinite(warnings) ? warnings : null,
          pending: typeof match.isPending === 'boolean' ? match.isPending : null,
          listed: all.length,
        };
      }
    } else {
      report.sitemap = {
        status: 'error',
        path: SITEMAP_URL,
        errors: null,
        warnings: null,
        pending: null,
        httpStatus: maps.status || 0,
        detail: _redact(maps.detail || maps.error),
      };
    }
    report.ok = true;
    report.siteUrl = siteUrl;
    report.reason = row ? 'search_console_row' : 'search_console_empty';
    report.blocked = false;
    return report;
  }
  report.blocked = true;
  report.reason = 'property_rejected';
  report.detail = 'Search Console did not accept a property candidate. Set SEARCH_CONSOLE_SITE_URL to the exact property id if it is neither sc-domain:' + HOST + ' nor ' + SITE_URL + '.';
  return report;
}

// ── Cycle ────────────────────────────────────────────────────────────
async function runCycle(opts) {
  const o = opts || {};
  if (disabled()) {
    return { protocol: PROTOCOL, ok: false, disabled: true, reason: 'SEO_BRIDGE_DISABLED=1' };
  }
  const bing = await runBing(o);
  const google = await runGoogle(o);
  const performance = await readPerformance(o);
  state.lastRunAt = new Date().toISOString();
  state.runs += 1;
  state.bing = bing;
  state.google = google;
  if (!o.dryRun) {
    state.performance = performance;
    _saveState();
  }
  return { protocol: PROTOCOL, ok: true, at: state.lastRunAt, bing, google, performance };
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
  if (!_serviceAccount()) out.push({ engine: 'google', secret: SECRET_HINTS.google, unlocks: 'Google ownership, sitemap submission, and Search Console reads after scripts/search-console-key-install.js writes GOOGLE_SERVICE_ACCOUNT_JSON_B64' });
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
    searchConsoleSiteUrlRequired: false,
    propertyCandidates: propertyCandidates(),
    keyInstall: 'node scripts/search-console-key-install.js',
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
    performance: state.performance || {
      ok: false,
      blocked: !_serviceAccount(),
      reason: _serviceAccount() ? 'not_read_yet' : 'no_service_account',
      secret: _serviceAccount() ? null : SECRET_HINTS.google,
      metrics: _blankMetrics(),
      sitemap: { status: 'unavailable', path: SITEMAP_URL, errors: null, warnings: null, pending: null },
      inventsClicks: false,
      inventsImpressions: false,
      inventsCtr: false,
      inventsPosition: false,
    },
    note: 'Clicks, impressions, CTR, and average position appear only after Search Console returns them. Until that read succeeds they stay unavailable. A sitemap submission is not a ranking and not a visitor.',
  };
}

function _resetForTests() {
  state.lastRunAt = null;
  state.runs = 0;
  state.bing = null;
  state.google = null;
  state.performance = null;
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
  readPerformance,
  propertyCandidates,
  runCycle,
  armedEngines,
  missingSecrets,
  persistGoogleVerification,
  readGoogleVerification,
  getStatus,
  _resetForTests,
};
