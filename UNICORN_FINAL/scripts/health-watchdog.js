#!/usr/bin/env node
// UNICORN_FINAL/scripts/health-watchdog.js
//
// Watchdog autonom — verifică la fiecare 60s endpoint-urile critice și,
// dacă 3 cicluri consecutive eșuează, restartează clusterul PM2 vinovat.
//
// Rulează ca serviciu systemd (deploy/zeus-watchdog.service). Loghează la
// stdout/journal. Nu omoară niciodată backend-ul pentru CPU/memorie spikes
// (regula de aur #6) — doar pentru endpoint-uri care nu mai răspund.
//
// Romanian + English comments — păstrate.

'use strict';

const { execSync } = require('child_process');

const BASE_URL = process.env.WATCHDOG_BASE || 'https://zeusai.pro';
const POLL_MS = Number(process.env.WATCHDOG_POLL_MS || 60_000);
const FAIL_THRESHOLD = Number(process.env.WATCHDOG_FAIL_THRESHOLD || 3);
const TIMEOUT_MS = Number(process.env.WATCHDOG_TIMEOUT_MS || 10_000);

// Map endpoint → PM2 app to restart if it fails 3x in a row
const PROBES = [
  { url: '/health',           app: 'unicorn-site',    name: 'site-health' },
  { url: '/api/health',       app: 'unicorn-backend', name: 'backend-health' },
  { url: '/api/products',     app: 'unicorn-backend', name: 'catalog' },
  { url: '/api/pricing/all',  app: 'unicorn-backend', name: 'pricing' },
];

const failCounts = new Map();

async function probe(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(BASE_URL + url, { signal: controller.signal, cache: 'no-store' });
    if (!r.ok) return { ok: false, reason: 'http ' + r.status };
    // Pentru endpoint-uri JSON: parse + verifică non-empty
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await r.json();
      if (!j || (typeof j === 'object' && Object.keys(j).length === 0)) {
        return { ok: false, reason: 'empty json' };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message || String(e) };
  } finally {
    clearTimeout(t);
  }
}

function restartApp(app) {
  try {
    console.log(`[watchdog] restarting PM2 app: ${app}`);
    execSync(`pm2 restart ${app}`, { stdio: 'inherit', timeout: 30_000 });
    return true;
  } catch (e) {
    console.error(`[watchdog] pm2 restart ${app} failed:`, e.message);
    return false;
  }
}

async function tick() {
  for (const p of PROBES) {
    const res = await probe(p.url);
    const key = p.app + '|' + p.url;
    if (res.ok) {
      if (failCounts.get(key)) {
        console.log(`[watchdog] ${p.name} recovered after ${failCounts.get(key)} failures`);
      }
      failCounts.set(key, 0);
      continue;
    }
    const n = (failCounts.get(key) || 0) + 1;
    failCounts.set(key, n);
    console.warn(`[watchdog] ${p.name} FAIL (${n}/${FAIL_THRESHOLD}) — ${res.reason}`);
    if (n >= FAIL_THRESHOLD) {
      console.error(`[watchdog] ${p.name} crossed threshold → restarting ${p.app}`);
      if (restartApp(p.app)) failCounts.set(key, 0);
    }
  }
}

async function main() {
  console.log(`[watchdog] starting · base=${BASE_URL} · poll=${POLL_MS}ms · threshold=${FAIL_THRESHOLD}`);
  // Tick imediat la pornire, apoi la interval
  await tick();
  setInterval(() => { tick().catch((e) => console.error('[watchdog] tick error:', e.message)); }, POLL_MS);
}

main().catch((e) => {
  console.error('[watchdog] fatal:', e);
  process.exit(1);
});
