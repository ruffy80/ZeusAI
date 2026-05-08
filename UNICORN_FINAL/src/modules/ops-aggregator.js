// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// =====================================================================
//
// ops-aggregator — single read-only collector for site /api/ops/dashboard.
// Combines: QIS status (proxied from backend), PM2 cwd-drift, heap, deploy
// provenance, log-monitor latest, and SSE/stream client counts.
//
// Designed to be cheap and tolerant: every probe is wrapped in try/catch and
// missing data degrades to nulls rather than failing the response. The
// site-layer endpoint /api/ops/dashboard is the canonical surface; the
// backend-layer /api/ops/dashboard adds DB/queue introspection on top.
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:3000';
const SHARED_DIR = process.env.UNICORN_KEY_DIR || '/var/www/unicorn/shared';
const DEPLOY_LINK = process.env.DEPLOY_LINK || '/var/www/unicorn/UNICORN_FINAL';

function _httpGetJson(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.request({
        method: 'GET',
        host: u.hostname,
        port: u.port || 80,
        path: u.pathname + (u.search || ''),
        timeout: timeoutMs,
        headers: { 'accept': 'application/json' },
      }, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; });
        res.on('end', () => {
          try { resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: JSON.parse(buf || 'null') }); }
          catch (_) { resolve({ ok: false, status: res.statusCode, body: null }); }
        });
      });
      req.on('error', () => resolve({ ok: false, error: 'request_error' }));
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} resolve({ ok: false, error: 'timeout' }); });
      req.end();
    } catch (_) { resolve({ ok: false, error: 'invalid_url' }); }
  });
}

function _pm2Snapshot() {
  // Best-effort: fork-mode children CAN run pm2 jlist; cluster workers
  // cannot. Return a graceful 'unknown' instead of false-positive missing.
  try {
    const raw = execSync('pm2 jlist', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).toString('utf8');
    const list = JSON.parse(raw || '[]');
    let expectedCwd = null;
    try { expectedCwd = fs.realpathSync(DEPLOY_LINK); } catch (_) {}
    const procs = list.map((p) => {
      const env = p.pm2_env || {};
      let cwd = env.pm_cwd || null;
      try { if (cwd) cwd = fs.realpathSync(cwd); } catch (_) {}
      return {
        name: p.name,
        pid: p.pid || env.pm_pid,
        status: env.status,
        cpu: p.monit && p.monit.cpu,
        mem: p.monit && p.monit.memory,
        restarts: env.restart_time,
        uptimeMs: env.pm_uptime ? (Date.now() - env.pm_uptime) : null,
        cwd,
        cwdDrift: !!(expectedCwd && cwd && cwd !== expectedCwd),
        execPath: env.pm_exec_path,
      };
    });
    const drifted = procs.filter((p) => p.cwdDrift).map((p) => p.name);
    const offline = procs.filter((p) => p.status && p.status !== 'online').map((p) => p.name);
    return {
      available: true,
      expectedCwd,
      processes: procs,
      drifted,
      offline,
      ok: drifted.length === 0 && offline.length === 0,
    };
  } catch (e) {
    return { available: false, ok: null, reason: 'pm2_jlist_unavailable_from_worker' };
  }
}

function _heap() {
  const m = process.memoryUsage();
  return {
    heapUsedMb: Math.round(m.heapUsed / 1048576),
    heapTotalMb: Math.round(m.heapTotal / 1048576),
    heapPct: m.heapTotal ? Math.round((m.heapUsed / m.heapTotal) * 1000) / 1000 : 0,
    rssMb: Math.round(m.rss / 1048576),
    externalMb: Math.round(m.external / 1048576),
    uptimeS: Math.round(process.uptime()),
  };
}

function _deployProvenance() {
  const out = {
    buildSha: process.env.ZEUS_BUILD_SHA || null,
    swVersion: process.env.SW_VERSION || null,
    deployedAt: null,
    releaseDir: null,
    sharedDir: SHARED_DIR,
    foreverKeyPresent: false,
  };
  try { out.releaseDir = fs.realpathSync(DEPLOY_LINK); } catch (_) {}
  try {
    const stat = fs.statSync(path.join(out.releaseDir || DEPLOY_LINK, '.deployed-commit'));
    out.deployedAt = stat.mtime.toISOString();
  } catch (_) {}
  try {
    const sha = fs.readFileSync(path.join(out.releaseDir || DEPLOY_LINK, '.deployed-commit'), 'utf8').trim();
    if (sha) out.buildSha = out.buildSha || sha;
  } catch (_) {}
  try {
    out.foreverKeyPresent = fs.existsSync(path.join(SHARED_DIR, 'site-sign.pem'));
  } catch (_) {}
  return out;
}

async function collect(opts = {}) {
  const t0 = Date.now();
  const heap = _heap();
  const pm2 = _pm2Snapshot();
  const deploy = _deployProvenance();

  // QIS status from the backend (canonical source).
  const qisRes = await _httpGetJson(`${BACKEND_URL}/api/quantum-integrity/status`, 1500);
  const qis = qisRes.ok && qisRes.body ? {
    integrity: qisRes.body.integrity || null,
    active: !!qisRes.body.active,
    issues: (qisRes.body.lastScan && qisRes.body.lastScan.issues) || [],
    lastScanAt: (qisRes.body.lastScan && qisRes.body.lastScan.timestamp) || null,
    autoHealEnabled: !!qisRes.body.autoHealEnabled,
    lastSelfHealResult: qisRes.body.lastSelfHealResult || null,
  } : { available: false };

  // Compute an aggregate health verdict (additive, never blocks).
  const verdicts = [];
  if (heap.heapPct > 0.95 && heap.heapUsedMb > 512) verdicts.push('heap_pressure');
  if (pm2.available && (pm2.drifted.length || pm2.offline.length)) verdicts.push('pm2_drift');
  if (qis && qis.integrity && qis.integrity !== 'intact' && qis.integrity !== 'pending') verdicts.push('qis_' + qis.integrity);
  if (qis && qis.lastSelfHealResult && qis.lastSelfHealResult.ok === false) verdicts.push('self_heal_failed');

  const status = verdicts.length === 0 ? 'green'
               : verdicts.some((v) => v === 'qis_compromised') ? 'red'
               : 'amber';

  return {
    ok: status === 'green',
    status,
    verdicts,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    deploy,
    heap,
    pm2,
    qis,
    notes: status === 'green'
      ? 'All probes nominal.'
      : `Operator action may be required: ${verdicts.join(', ')}. See /api/quantum-integrity/status for QIS detail.`,
  };
}

module.exports = { collect, _pm2Snapshot, _heap, _deployProvenance };
