#!/usr/bin/env node
'use strict';

const BASE_URL = (process.env.GLOBAL_HEALTH_BASE_URL || 'https://zeusai.pro').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.GLOBAL_HEALTH_TIMEOUT_MS || 15000);
const CHECK_HOST_NODES = Number(process.env.GLOBAL_HEALTH_CHECK_HOST_NODES || 10);
const CHECK_HOST_MIN_OK = Number(process.env.GLOBAL_HEALTH_CHECK_HOST_MIN_OK || 3);

const directChecks = [
  { name: 'home', method: 'GET', path: '/', expect: [200], minBytes: 5000 },
  { name: 'services', method: 'GET', path: '/services', expect: [200], minBytes: 5000 },
  { name: 'health', method: 'GET', path: '/health', expect: [200], minBytes: 20 },
  { name: 'catalog', method: 'GET', path: '/api/instant/catalog', expect: [200], minBytes: 500 },
  { name: 'customer-auth-guard', method: 'GET', path: '/api/customer/me', expect: [401], minBytes: 10 },
  {
    name: 'concierge',
    method: 'POST',
    path: '/api/concierge',
    expect: [200],
    minBytes: 100,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'global health ping' })
  }
];

const globalPaths = ['/', '/services', '/api/instant/catalog'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function directProbe(check) {
  const started = Date.now();
  const response = await fetchWithTimeout(BASE_URL + check.path, {
    method: check.method,
    headers: check.headers || {},
    body: check.body
  });
  const text = await response.text();
  const latencyMs = Date.now() - started;
  const okStatus = check.expect.includes(response.status);
  const okSize = Buffer.byteLength(text) >= check.minBytes;
  return {
    ...check,
    status: response.status,
    bytes: Buffer.byteLength(text),
    latencyMs,
    ok: okStatus && okSize,
    detail: okStatus ? (okSize ? 'ok' : `body_too_small:${Buffer.byteLength(text)}<${check.minBytes}`) : `unexpected_status:${response.status}`
  };
}

// Wrapper that retries each direct check with backoff before declaring
// failure. A single transient blip (nginx reload, PM2 worker rolling,
// cloud network jitter) used to mark the whole site as down; now we
// require N consecutive failures spaced by short backoffs. Real outages
// — which by definition persist for many seconds — still fail the probe.
async function directProbeWithRetry(check, { attempts = 3, baseDelayMs = 1500 } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await directProbe(check);
      if (r.ok) return r;
      last = r;
    } catch (err) {
      last = { ...check, status: 0, bytes: 0, latencyMs: 0, ok: false, detail: `error:${err.message}` };
    }
    if (i < attempts - 1) await sleep(baseDelayMs * (i + 1));
  }
  return last;
}

function parseCheckHostResult(payload) {
  const rows = [];
  for (const [node, entries] of Object.entries(payload || {})) {
    const first = Array.isArray(entries) ? entries[0] : null;
    if (!Array.isArray(first)) {
      rows.push({ node, ok: false, status: 0, latency: null, detail: 'missing_result' });
      continue;
    }
    const rawStatus = first.find((value) => /^\d{3}$/.test(String(value || '')));
    const status = rawStatus ? Number(rawStatus) : 0;
    const latency = first.find((value) => typeof value === 'number') ?? null;
    const okFlag = first[0] === 1 || first[0] === true;
    rows.push({ node, ok: okFlag && status >= 200 && status < 400, status, latency, detail: JSON.stringify(first).slice(0, 180) });
  }
  return rows;
}

// Spacing between consecutive check-host.net requests. Their free public
// API throttles aggressive callers (HTTP 429), and a 429 here was
// previously interpreted as "site down" — a false positive that woke up
// the owner with bogus outage emails while zeusai.pro itself was 100% up.
const CHECK_HOST_SPACING_MS = Number(process.env.GLOBAL_HEALTH_CHECK_HOST_SPACING_MS || 9000);
const CHECK_HOST_RETRY_ATTEMPTS = Number(process.env.GLOBAL_HEALTH_CHECK_HOST_RETRY_ATTEMPTS || process.env.GLOBAL_HEALTH_CHECK_HOST_RETRY || 3);
const CHECK_HOST_RETRY_BASE_MS = Number(process.env.GLOBAL_HEALTH_CHECK_HOST_RETRY_BASE_MS || 5000);

async function checkHostFetchJson(url, label) {
  // Retry on HTTP 429 / 5xx / network errors with exponential backoff,
  // because check-host.net rate-limits anonymous callers and returns 429
  // during normal operation.
  let lastErr;
  for (let attempt = 0; attempt < CHECK_HOST_RETRY_ATTEMPTS; attempt++) {
    try {
      const r = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) {
        throw new Error(`check-host ${label} failed: HTTP ${r.status}`);
      }
      lastErr = new Error(`check-host ${label} failed: HTTP ${r.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < CHECK_HOST_RETRY_ATTEMPTS - 1) {
      await sleep(CHECK_HOST_RETRY_BASE_MS * Math.pow(2, attempt));
    }
  }
  throw lastErr || new Error(`check-host ${label} failed: unknown`);
}

async function checkHostProbe(pathname) {
  const target = BASE_URL + pathname;
  const url = 'https://check-host.net/check-http?max_nodes=' + encodeURIComponent(CHECK_HOST_NODES) + '&host=' + encodeURIComponent(target);
  const meta = await checkHostFetchJson(url, 'request');
  if (!meta.request_id) throw new Error('check-host request_id missing');
  await sleep(7000);
  const payload = await checkHostFetchJson('https://check-host.net/check-result/' + encodeURIComponent(meta.request_id), 'result');
  const rows = parseCheckHostResult(payload);
  const okRows = rows.filter((row) => row.ok);
  // Inconclusive când niciun nod nu a putut returna un status HTTP real (toate `n/a`)
  // Inconclusive when no node returned an actual HTTP status — that's check-host failing,
  // not the site. Direct probes from this runner already confirmed the site is up.
  const allUnknown = rows.length > 0 && rows.every((row) => !row.status);
  return {
    pathname,
    target,
    nodes: rows.length,
    okNodes: okRows.length,
    rows,
    inconclusive: allUnknown,
    ok: !allUnknown && okRows.length >= Math.min(CHECK_HOST_MIN_OK, Math.max(1, rows.length))
  };
}

async function run() {
  console.log(`[GLOBAL] Target: ${BASE_URL}`);
  let directFailed = false;
  let globalRealFailures = 0;   // genuine "majority of nodes can't reach the site" signals
  let globalInconclusive = 0;   // throttling / network errors talking to check-host.net itself

  console.log('\n[GLOBAL] Direct public endpoint checks (with retry: 3 attempts, 1.5s backoff)');
  for (const check of directChecks) {
    try {
      const result = await directProbeWithRetry(check);
      console.log(`${result.ok ? '✅' : '❌'} ${result.name.padEnd(20)} ${result.method} ${result.path} → HTTP ${result.status}, ${result.bytes}B, ${result.latencyMs}ms (${result.detail})`);
      if (!result.ok) directFailed = true;
    } catch (error) {
      directFailed = true;
      console.log(`❌ ${check.name.padEnd(20)} ${check.method} ${check.path} → ${error.message}`);
    }
  }

  console.log('\n[GLOBAL] External global node checks via check-host.net (best-effort)');
  for (let i = 0; i < globalPaths.length; i++) {
    const pathname = globalPaths[i];
    if (i > 0) await sleep(CHECK_HOST_SPACING_MS);
    try {
      const result = await checkHostProbe(pathname);
      const icon = result.inconclusive ? '⚠️ ' : (result.ok ? '✅' : '❌');
      const suffix = result.inconclusive ? ' (inconclusive — check-host nodes returned no HTTP status)' : '';
      console.log(`${icon} ${pathname.padEnd(20)} ${result.okNodes}/${result.nodes} nodes reachable${suffix}`);
      for (const row of result.rows.slice(0, CHECK_HOST_NODES)) {
        console.log(`   - ${row.ok ? 'ok ' : 'bad'} ${row.node}: HTTP ${row.status || 'n/a'}${row.latency != null ? `, ${row.latency}s` : ''}`);
      }
      if (result.inconclusive) globalInconclusive += 1;
      else if (!result.ok) globalRealFailures += 1;
    } catch (error) {
      // check-host.net itself failed (HTTP 429, network blip, timeout).
      // This tells us nothing about the site — treat as inconclusive.
      globalInconclusive += 1;
      console.log(`⚠️  ${pathname.padEnd(20)} external probe inconclusive: ${error.message}`);
    }
  }

  // Decision matrix:
  //  - Direct checks failed         → real outage from the runner's POV → fail.
  //  - check-host reports majority of nodes can't reach the site for a path → fail.
  //  - Only check-host *itself* hiccupped (429/timeout) but direct succeeded → site IS up, warn only.
  if (directFailed || globalRealFailures > 0) {
    console.error('\n[GLOBAL] ❌ Worldwide availability check failed.');
    process.exit(1);
  }
  if (globalInconclusive > 0) {
    console.warn(`\n[GLOBAL] ⚠️  ${globalInconclusive}/${globalPaths.length} external probes inconclusive (check-host.net throttled or unreachable). Direct checks all passed — site is up.`);
  }
  console.log('\n[GLOBAL] ✅ Site and core Unicorn services are publicly reachable.');
}

run().catch((error) => {
  console.error('[GLOBAL] ❌ Fatal:', error && error.message ? error.message : error);
  process.exit(1);
});
