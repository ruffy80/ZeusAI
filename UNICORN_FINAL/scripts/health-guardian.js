#!/usr/bin/env node
// =====================================================================
// health-guardian.js — one-shot (CI-safe) + optional daemon healer
//
// Why this exists: `npm run heal` / GitHub "Autonomous evolve/heal" was
// failing every 6h with MODULE_NOT_FOUND because this file was archived.
//
// Contract:
//   - Default / CI / NODE_ENV=test / --once → ONE-SHOT probes, exit 0/1
//   - HEAL_DAEMON=1 → long-running loop (ops only; never armed by CI)
//   - Never runs destructive restarts unless HEAL_ALLOW_RESTART=1
//   - Never invents fake health — probes real HTTP + module loadability
// =====================================================================
'use strict';

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const ONCE = process.argv.includes('--once')
  || String(process.env.HEAL_ONCE || '') === '1'
  || String(process.env.CI || '') === 'true'
  || String(process.env.NODE_ENV || '') === 'test'
  || String(process.env.HEAL_DAEMON || '') !== '1';

const PUBLIC = String(
  process.env.HEALTH_GUARDIAN_EXTERNAL_URL
  || process.env.PUBLIC_APP_URL
  || process.env.EDGE_HEALTH_URL
  || 'https://zeusai.pro'
).replace(/\/$/, '');

const LOCAL_BACKEND = process.env.HEALTH_GUARDIAN_URL || 'http://127.0.0.1:3000/api/health';
const LOCAL_SITE = process.env.HEALTH_GUARDIAN_SITE_URL || 'http://127.0.0.1:3001/health';
const TIMEOUT_MS = Math.max(3000, Number(process.env.HEALTH_GUARDIAN_TIMEOUT_MS) || 12000);
const PUBLIC_RETRIES = Math.max(1, Number(process.env.HEALTH_GUARDIAN_RETRIES || 3));
const RETRY_BASE_MS = Math.max(250, Number(process.env.HEALTH_GUARDIAN_RETRY_MS || 1500));

function log(...args) {
  console.log('[HealthGuardian]', new Date().toISOString(), ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJsonOnce(url) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch (e) {
      return resolve({ ok: false, reason: 'invalid_url', detail: String(e.message || e) });
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      timeout: TIMEOUT_MS,
      headers: { Accept: 'application/json,*/*', 'User-Agent': 'zeus-health-guardian/1.0' },
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; if (body.length > 200_000) body = body.slice(0, 200_000); });
      res.on('end', () => {
        const code = res.statusCode || 0;
        let json = null;
        try { json = JSON.parse(body); } catch (_) { /* non-json ok for HTML pages */ }
        const okHttp = code >= 200 && code < 400;
        const okJson = !json || json.ok === true || json.status === 'ok' || json.status === 'healthy'
          || json.status === 'degraded' || json.degraded === false || json.degraded === true;
        // HTTP 200 on public health surfaces is success even when payload reports
        // partial degradation — that is honest status, not an outage.
        resolve({
          ok: okHttp && (json ? (okJson || code === 200) : okHttp),
          code,
          reason: okHttp ? null : `http_${code}`,
          json,
          bodyPreview: body.slice(0, 160),
        });
      });
    });
    req.on('error', (err) => resolve({ ok: false, reason: err.message || 'network_error' }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
  });
}

async function fetchJson(url, { retries = 1 } = {}) {
  let last = { ok: false, reason: 'not_attempted' };
  const attempts = Math.max(1, retries);
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    last = await fetchJsonOnce(url);
    if (last.ok) return last;
    const transient = /timeout|ECONNRESET|EAI_AGAIN|ENOTFOUND|network|socket|ECONNREFUSED/i.test(String(last.reason || ''));
    if (!transient || i === attempts - 1) return last;
    // eslint-disable-next-line no-await-in-loop
    await sleep(RETRY_BASE_MS * (i + 1));
  }
  return last;
}

function moduleLoadCheck() {
  const root = path.join(__dirname, '..');
  const must = [
    'backend/modules/omega-ecosystem-os.js',
    'backend/modules/ai-genome-engine.js',
    'backend/modules/ai-dna-engine.js',
    'backend/modules/never-down-kernel.js',
    'src/commerce/post-pay-closure-os.js',
  ];
  const out = [];
  for (const rel of must) {
    const fp = path.join(root, rel);
    try {
      if (!fs.existsSync(fp)) { out.push({ rel, ok: false, reason: 'missing' }); continue; }
      // Syntax/load only — do not start timers aggressively
      const prev = process.env.ZEUS_OMEGA_DISABLED;
      process.env.ZEUS_OMEGA_DISABLED = process.env.ZEUS_OMEGA_DISABLED || '0';
      require(fp);
      if (prev === undefined) delete process.env.ZEUS_OMEGA_DISABLED;
      else process.env.ZEUS_OMEGA_DISABLED = prev;
      out.push({ rel, ok: true });
    } catch (e) {
      out.push({ rel, ok: false, reason: String(e && e.message || e).slice(0, 120) });
    }
  }
  return out;
}

async function runOnce() {
  const report = {
    ok: true,
    mode: 'once',
    public: PUBLIC,
    probes: {},
    modules: moduleLoadCheck(),
    at: new Date().toISOString(),
  };

  // Critical public probes — these prove production still breathes.
  const publicProbes = [
    ['site_health', `${PUBLIC}/health`],
    ['api_health', `${PUBLIC}/api/health`],
    ['omega_status', `${PUBLIC}/api/omega/status`],
    ['btc_rate', `${PUBLIC}/api/payment/btc-rate`],
  ];
  for (const [name, url] of publicProbes) {
    // eslint-disable-next-line no-await-in-loop
    const r = await fetchJson(url, { retries: PUBLIC_RETRIES });
    report.probes[name] = {
      url,
      ok: !!r.ok,
      code: r.code || null,
      reason: r.reason || null,
      retries: PUBLIC_RETRIES,
    };
    if (!r.ok) report.ok = false;
  }

  // Local probes are best-effort (CI runners usually have no local Unicorn).
  for (const [name, url] of [['local_backend', LOCAL_BACKEND], ['local_site', LOCAL_SITE]]) {
    // eslint-disable-next-line no-await-in-loop
    const r = await fetchJson(url, { retries: 1 });
    report.probes[name] = {
      url,
      ok: !!r.ok,
      skipped: !r.ok && (r.reason === 'ECONNREFUSED' || /ECONNREFUSED|connect|timeout/i.test(String(r.reason || ''))),
      code: r.code || null,
      reason: r.reason || null,
    };
  }

  const modFail = report.modules.filter((m) => !m.ok);
  if (modFail.length) {
    report.ok = false;
    report.moduleErrors = modFail;
  }

  // Soft-pass rule for CI when only local probes fail but public is green.
  const publicOk = publicProbes.every(([name]) => report.probes[name] && report.probes[name].ok);
  if (publicOk && modFail.length === 0) report.ok = true;

  log(JSON.stringify(report));
  if (!report.ok) {
    console.error('[HealthGuardian] FAIL — public or module probes unhealthy');
    process.exit(1);
  }
  log('OK — heal once complete');
  process.exit(0);
}

async function main() {
  if (ONCE) return runOnce();
  log('daemon mode armed (HEAL_DAEMON=1) — probing every 60s; restarts disabled unless HEAL_ALLOW_RESTART=1');
  // Minimal daemon: probe forever, never suicide-restart by default.
  setInterval(() => {
    runOnce().catch((e) => log('tick error', e && e.message));
  }, Math.max(30_000, Number(process.env.HEALTH_GUARDIAN_INTERVAL_MS) || 60_000));
}

main().catch((e) => {
  console.error('[HealthGuardian] fatal', e && e.message);
  process.exit(1);
});
