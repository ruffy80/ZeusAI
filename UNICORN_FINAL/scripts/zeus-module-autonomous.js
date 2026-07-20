#!/usr/bin/env node
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// zeus-module-autonomous.js — standalone autonomous runner for a single
// backend module, designed to be started/kept alive by PM2:
//
//   node scripts/zeus-module-autonomous.js <ModuleFileBaseName> --autonomous
//   pm2 start scripts/zeus-module-autonomous.js --name zeus-<short> \
//       -- backend/modules/<File>.js --autonomous
//
// Contract (intentional, safety-first):
//   • It requires the module and drives its AUTONOMY SURFACE only:
//       - if module.start exists → start({ apply:false }) (NEVER apply:true —
//         this is what stops selfConstruction from writing skeleton stubs).
//       - else → setInterval every 60s calling process({action:'tick'}) or,
//         failing that, getStatus().
//   • It does NOT open a second Express server and does NOT write SQLite.
//     Modules persist their own lightweight JSON state (data/**) if they wish.
//   • Heartbeats are logged to stdout so `pm2 logs zeus-<short>` shows liveness.
//   • SIGINT/SIGTERM shut the tick loop down cleanly (and call module.stop()).
//
// The process is kept alive by the interval timer (or by the module's own
// timers when start() is used); it exits non-zero only if the module cannot
// be resolved/required at all.

'use strict';

const path = require('path');
const fs = require('fs');

const HEARTBEAT_MS = Number(process.env.ZEUS_HEARTBEAT_MS) > 0
  ? Number(process.env.ZEUS_HEARTBEAT_MS)
  : 60_000;

function log(...args) {
  process.stdout.write(`[zeus-autonomous] ${new Date().toISOString()} ${args.join(' ')}\n`);
}
function warn(...args) {
  process.stderr.write(`[zeus-autonomous][WARN] ${new Date().toISOString()} ${args.join(' ')}\n`);
}

// ── Parse args ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const autonomous = argv.includes('--autonomous');
const positional = argv.filter((a) => !a.startsWith('--'));
const target = positional[0];

if (!target) {
  warn('usage: node scripts/zeus-module-autonomous.js <ModuleFileBaseName> --autonomous');
  process.exit(2);
}
if (!autonomous) {
  warn('refusing to run without --autonomous flag');
  process.exit(2);
}

// ── Resolve the module file ──────────────────────────────────────────────────
// Accepts: "frontierAI", "frontierAI.js", "backend/modules/frontierAI.js",
// "frontier-ai", "frontier_ai" (camelCase / kebab / snake variants tried).
const MODULES_DIR = path.join(__dirname, '..', 'backend', 'modules');

function baseName(input) {
  let b = String(input).trim();
  b = b.replace(/^.*[\\/]/, '');      // strip any directory prefix
  b = b.replace(/\.js$/i, '');         // strip extension
  return b;
}

function variants(name) {
  const out = new Set();
  out.add(name);
  // kebab-case → camelCase
  out.add(name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
  // snake_case → camelCase
  out.add(name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
  // camelCase → kebab-case
  out.add(name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
  // camelCase → snake_case
  out.add(name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase());
  // lowercased
  out.add(name.toLowerCase());
  return [...out];
}

function resolveModulePath(input) {
  const name = baseName(input);
  for (const v of variants(name)) {
    const candidate = path.join(MODULES_DIR, `${v}.js`);
    if (fs.existsSync(candidate)) return candidate;
    // Also allow directory modules (index.js)
    const dirIndex = path.join(MODULES_DIR, v, 'index.js');
    if (fs.existsSync(dirIndex)) return dirIndex;
  }
  return null;
}

const modulePath = resolveModulePath(target);
if (!modulePath) {
  warn(`could not resolve module for "${target}" under ${MODULES_DIR}`);
  process.exit(1);
}

const shortName = baseName(modulePath);
log(`resolved "${target}" → ${modulePath} (heartbeat ${HEARTBEAT_MS}ms)`);

// ── Require the module ───────────────────────────────────────────────────────
let mod;
try {
  mod = require(modulePath);
} catch (e) {
  warn(`failed to require ${modulePath}: ${e && e.message}`);
  process.exit(1);
}

// selfConstruction MUST never apply — hard guard regardless of module name.
const isSelfConstruction = /selfconstruction/i.test(shortName);

let intervalTimer = null;
let ticks = 0;
let shuttingDown = false;

async function heartbeat() {
  ticks += 1;
  try {
    if (typeof mod.process === 'function') {
      const res = await mod.process({ action: 'tick' });
      const summary = res && (res.status || res.action || (res.ok === true ? 'ok' : JSON.stringify(res).slice(0, 80)));
      log(`tick #${ticks} ${shortName}.process → ${summary}`);
    } else if (typeof mod.getStatus === 'function') {
      const st = await mod.getStatus();
      log(`tick #${ticks} ${shortName}.getStatus → ${st && (st.status || 'ok')}`);
    } else {
      log(`tick #${ticks} ${shortName} has no process()/getStatus() — heartbeat only`);
    }
  } catch (e) {
    warn(`tick #${ticks} ${shortName} error: ${e && e.message}`);
  }
}

function startIntervalLoop() {
  // Immediate first heartbeat, then a steady cadence.
  heartbeat();
  intervalTimer = setInterval(heartbeat, HEARTBEAT_MS);
}

(async () => {
  if (typeof mod.start === 'function' && !isSelfConstruction) {
    // Prefer the module's own lifecycle. NEVER apply:true.
    try {
      const started = await mod.start({ apply: false });
      log(`${shortName}.start({apply:false}) → ${started && started.started ? 'started' : 'invoked'}`);
    } catch (e) {
      warn(`${shortName}.start() failed (${e && e.message}) — falling back to tick loop`);
    }
    // Even when start() sets up the module's own timers, run a lightweight
    // heartbeat loop so PM2 sees liveness in the logs and the process stays up.
    startIntervalLoop();
  } else {
    if (isSelfConstruction) {
      log(`${shortName}: audit-only mode (apply:false) — never writing skeletons`);
    }
    startIntervalLoop();
  }
  log(`${shortName} autonomous runner online`);
})();

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`received ${signal} — shutting down ${shortName}`);
  if (intervalTimer) clearInterval(intervalTimer);
  try { if (typeof mod.stop === 'function') mod.stop(); } catch (_) { /* best effort */ }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (e) => {
  warn(`uncaughtException in ${shortName}: ${e && e.stack ? e.stack : e}`);
  // Keep the process alive; PM2 handles restarts if it truly dies.
});
process.on('unhandledRejection', (e) => {
  warn(`unhandledRejection in ${shortName}: ${e && e.message ? e.message : e}`);
});
