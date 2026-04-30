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

async function checkHostProbe(pathname) {
  const target = BASE_URL + pathname;
  const url = 'https://check-host.net/check-http?max_nodes=' + encodeURIComponent(CHECK_HOST_NODES) + '&host=' + encodeURIComponent(target);
  const request = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
  if (!request.ok) throw new Error(`check-host request failed: HTTP ${request.status}`);
  const meta = await request.json();
  if (!meta.request_id) throw new Error('check-host request_id missing');
  await sleep(7000);
  const result = await fetchWithTimeout('https://check-host.net/check-result/' + encodeURIComponent(meta.request_id), { headers: { accept: 'application/json' } });
  if (!result.ok) throw new Error(`check-host result failed: HTTP ${result.status}`);
  const rows = parseCheckHostResult(await result.json());
  const okRows = rows.filter((row) => row.ok);
  return { pathname, target, nodes: rows.length, okNodes: okRows.length, rows, ok: okRows.length >= Math.min(CHECK_HOST_MIN_OK, Math.max(1, rows.length)) };
}

async function run() {
  console.log(`[GLOBAL] Target: ${BASE_URL}`);
  let failed = false;

  console.log('\n[GLOBAL] Direct public endpoint checks (with retry: 3 attempts, 1.5s backoff)');
  for (const check of directChecks) {
    try {
      const result = await directProbeWithRetry(check);
      console.log(`${result.ok ? '✅' : '❌'} ${result.name.padEnd(20)} ${result.method} ${result.path} → HTTP ${result.status}, ${result.bytes}B, ${result.latencyMs}ms (${result.detail})`);
      if (!result.ok) failed = true;
    } catch (error) {
      failed = true;
      console.log(`❌ ${check.name.padEnd(20)} ${check.method} ${check.path} → ${error.message}`);
    }
  }

  console.log('\n[GLOBAL] External global node checks via check-host.net');
  for (const pathname of globalPaths) {
    try {
      const result = await checkHostProbe(pathname);
      console.log(`${result.ok ? '✅' : '❌'} ${pathname.padEnd(20)} ${result.okNodes}/${result.nodes} nodes reachable`);
      for (const row of result.rows.slice(0, CHECK_HOST_NODES)) {
        console.log(`   - ${row.ok ? 'ok ' : 'bad'} ${row.node}: HTTP ${row.status || 'n/a'}${row.latency != null ? `, ${row.latency}s` : ''}`);
      }
      if (!result.ok) failed = true;
    } catch (error) {
      failed = true;
      console.log(`❌ ${pathname.padEnd(20)} global probe failed: ${error.message}`);
    }
  }

  if (failed) {
    console.error('\n[GLOBAL] ❌ Worldwide availability check failed.');
    process.exit(1);
  }
  console.log('\n[GLOBAL] ✅ Site and core Unicorn services are publicly reachable from direct and external global probes.');
}

run().catch((error) => {
  console.error('[GLOBAL] ❌ Fatal:', error && error.message ? error.message : error);
  process.exit(1);
});
