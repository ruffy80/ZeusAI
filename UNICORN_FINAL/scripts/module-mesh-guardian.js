#!/usr/bin/env node
'use strict';

const { execFile } = require('node:child_process');

const CFG = {
  intervalMs: Math.max(10_000, Number(process.env.MESH_GUARDIAN_INTERVAL_MS || 30_000)),
  timeoutMs: Math.max(2_000, Number(process.env.MESH_GUARDIAN_TIMEOUT_MS || 12_000)),
  failThreshold: Math.max(1, Number(process.env.MESH_GUARDIAN_FAIL_THRESHOLD || 3)),
  healCooldownMs: Math.max(30_000, Number(process.env.MESH_GUARDIAN_HEAL_COOLDOWN_MS || 300_000)),
  startupGraceMs: Math.max(0, Number(process.env.MESH_GUARDIAN_STARTUP_GRACE_MS || 45_000)),
  autoRepair: String(process.env.MESH_GUARDIAN_AUTOREPAIR || '1') !== '0',
  once: String(process.env.MESH_GUARDIAN_ONCE || '0') === '1',
};

const startedAt = Date.now();

const TARGETS = [
  {
    name: 'backend.health',
    app: 'unicorn-backend',
    critical: true,
    url: 'http://127.0.0.1:3000/health',
    validate(data) {
      return !!data && (data.status === 'ok' || data.status === 'healthy' || data.ok === true);
    },
  },
  {
    name: 'backend.apiHealth',
    app: 'unicorn-backend',
    critical: true,
    url: 'http://127.0.0.1:3000/api/health',
    validate(data) {
      if (!data || !(data.status === 'ok' || data.ok === true)) return false;
      if (data.dbConnected === false) return false;
      if (data.engines && !Object.values(data.engines).every(Boolean)) return false;
      return true;
    },
  },
  {
    name: 'backend.qis',
    app: 'unicorn-backend',
    critical: false,
    url: 'http://127.0.0.1:3000/api/quantum-integrity/status',
    validate(data) {
      return !!data && data.active === true && data.integrity === 'intact';
    },
  },
  {
    name: 'backend.commerce',
    app: 'unicorn-backend',
    critical: false,
    url: 'http://127.0.0.1:3000/api/unicorn-commerce/status',
    validate(data) {
      return !!data && data.ok === true;
    },
  },
  {
    name: 'backend.billionScale',
    app: 'unicorn-backend',
    critical: false,
    url: 'http://127.0.0.1:3000/api/billion-scale/status',
    validate(data) {
      return !!data && data.ok === true;
    },
  },
  {
    name: 'site.health',
    app: 'unicorn-site',
    critical: true,
    url: 'http://127.0.0.1:3001/health',
    validate(data) {
      return !!data && (data.status === 'ok' || data.status === 'healthy' || data.ok === true);
    },
  },
  {
    name: 'site.home',
    app: 'unicorn-site',
    critical: false,
    url: 'http://127.0.0.1:3001/',
    validate(data) {
      return !!data && typeof data === 'string' && data.includes('<!doctype html');
    },
    expectText: true,
  },
];

let failStreak = 0;
let lastHealAt = 0;

function ts() {
  return new Date().toISOString();
}

function log(level, msg, extra) {
  if (extra) {
    console.log(`[mesh-guardian][${ts()}][${level}] ${msg} :: ${JSON.stringify(extra)}`);
  } else {
    console.log(`[mesh-guardian][${ts()}][${level}] ${msg}`);
  }
}

async function fetchTarget(target) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CFG.timeoutMs);
  try {
    const res = await fetch(target.url, {
      signal: ctrl.signal,
      headers: { 'cache-control': 'no-cache' },
    });
    if (!res.ok) {
      return { ok: false, target: target.name, app: target.app, critical: !!target.critical, reason: `http_${res.status}` };
    }
    let data;
    if (target.expectText) {
      data = (await res.text()).toLowerCase();
    } else {
      data = await res.json();
    }
    const valid = !!target.validate(data);
    if (!valid) {
      return { ok: false, target: target.name, app: target.app, critical: !!target.critical, reason: 'invalid_payload' };
    }
    return { ok: true, target: target.name, app: target.app, critical: !!target.critical };
  } catch (err) {
    return { ok: false, target: target.name, app: target.app, critical: !!target.critical, reason: err && err.name === 'AbortError' ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

function pm2Restart(app) {
  return new Promise((resolve) => {
    execFile('pm2', ['restart', app, '--update-env'], { timeout: 20_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, app, out: String(stderr || stdout || err.message || 'restart_failed') });
        return;
      }
      resolve({ ok: true, app, out: String(stdout || '').trim() });
    });
  });
}

async function heal(fails) {
  const now = Date.now();
  if (!CFG.autoRepair) {
    log('WARN', 'auto-repair disabled; alert-only mode', { fails: fails.length });
    return;
  }
  if (now - lastHealAt < CFG.healCooldownMs) {
    log('WARN', 'heal cooldown active; skipping restart', { remainingMs: CFG.healCooldownMs - (now - lastHealAt) });
    return;
  }

  const apps = [...new Set(fails.map((f) => f.app).filter(Boolean))];
  if (!apps.length) return;

  lastHealAt = now;
  log('ACTION', 'starting controlled PM2 restart for failing mesh apps', { apps });
  for (const app of apps) {
    const res = await pm2Restart(app);
    log(res.ok ? 'OK' : 'ERROR', `restart ${app}`, { out: res.out });
  }
}

async function cycle() {
  const inStartupGrace = (Date.now() - startedAt) < CFG.startupGraceMs;
  const started = Date.now();
  const results = await Promise.all(TARGETS.map(fetchTarget));
  const fails = results.filter((r) => !r.ok);
  const hardFails = fails.filter((r) => r.critical);
  const softFails = fails.filter((r) => !r.critical);

  if (!hardFails.length) {
    if (failStreak > 0) log('OK', 'module mesh restored', { previousFailStreak: failStreak });
    failStreak = 0;
    if (softFails.length) {
      log('WARN', 'module mesh healthy (non-critical endpoint warnings)', {
        checks: results.length,
        softFails: softFails.map((f) => ({ target: f.target, reason: f.reason })),
        ms: Date.now() - started,
      });
    } else {
      log('OK', 'module mesh healthy', { checks: results.length, ms: Date.now() - started });
    }
    return true;
  }

  failStreak += 1;
  log('WARN', 'module mesh critical check failed', {
    failStreak,
    threshold: CFG.failThreshold,
    hardFails: hardFails.map((f) => ({ target: f.target, app: f.app, reason: f.reason })),
    softFails: softFails.map((f) => ({ target: f.target, app: f.app, reason: f.reason })),
    startupGrace: inStartupGrace,
    ms: Date.now() - started,
  });

  if (!inStartupGrace && failStreak >= CFG.failThreshold) {
    await heal(hardFails);
    failStreak = 0;
  }
  return false;
}

async function run() {
  log('START', 'module mesh guardian started', CFG);
  const first = await cycle();
  if (CFG.once) {
    process.exit(first ? 0 : 1);
    return;
  }
  setInterval(() => {
    cycle().catch((e) => log('ERROR', 'unhandled cycle error', { message: e && e.message }));
  }, CFG.intervalMs);
}

run().catch((e) => {
  log('ERROR', 'fatal', { message: e && e.message });
  process.exit(1);
});
