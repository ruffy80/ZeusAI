'use strict';

/**
 * External Immortality Quorum — EIQ/1.0
 * Multi-peer health quorum. Never invents peers — only env-configured URLs.
 * Does NOT pm2-restart from inside the probed process (Boot Immortal doctrine).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const path = require('path');
const {
  isoNow, moduleDir, readJson, writeJson, ringPush,
} = require('./_util');

const PROTOCOL = 'EIQ/1.0';
const NAME = 'external-immortality-quorum';

const state = {
  startedAt: null,
  running: false,
  checks: 0,
  quorumOk: 0,
  quorumFail: 0,
  lastQuorum: null,
  lastCheckAt: null,
};

/** @type {object[]} */
const _history = [];
let _timer = null;

function storeFile() {
  return path.join(moduleDir(NAME), 'quorum.json');
}

function persist() {
  writeJson(storeFile(), { state, history: _history.slice(-100) });
}

function load() {
  const data = readJson(storeFile(), null);
  if (!data) return;
  if (data.state) Object.assign(state, data.state, { running: false });
  for (const h of data.history || []) _history.push(h);
}

load();

function configuredPeers() {
  const raw = String(process.env.EIQ_PEERS || process.env.IMMORTALITY_PEERS || '').trim();
  const peers = [];
  // Always include local self-check
  peers.push({
    id: 'local-backend',
    url: process.env.EIQ_LOCAL_URL || 'http://127.0.0.1:3000/api/health',
    role: 'primary',
  });
  if (raw) {
    raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((url, i) => {
      peers.push({ id: 'peer-' + (i + 1), url, role: 'standby' });
    });
  }
  return peers;
}

function fetchJson(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      resolve(result);
    };
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        timeout: timeoutMs,
        headers: { Accept: 'application/json' },
      }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; if (body.length > 200000) body = body.slice(0, 200000); });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            const ok = !!(json && (json.ok === true || json.status === 'ok' || json.status === 'healthy'));
            finish({ ok, statusCode: res.statusCode, json });
          } catch (_) {
            finish({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, json: null });
          }
        });
      });
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} finish({ ok: false, error: 'timeout' }); });
      req.on('error', (e) => finish({ ok: false, error: e.message }));
      req.end();
    } catch (e) {
      finish({ ok: false, error: e.message });
    }
  });
}

async function checkQuorum() {
  start();
  const peers = configuredPeers();
  const need = Math.max(1, Number(process.env.EIQ_QUORUM || 1));
  const results = [];
  for (const peer of peers) {
    // eslint-disable-next-line no-await-in-loop
    const r = await fetchJson(peer.url);
    results.push({
      id: peer.id,
      url: peer.url,
      role: peer.role,
      ok: !!r.ok,
      error: r.error || null,
      statusCode: r.statusCode || null,
    });
  }
  const okCount = results.filter((r) => r.ok).length;
  const quorum = okCount >= need;
  state.checks += 1;
  state.lastCheckAt = isoNow();
  state.lastQuorum = quorum;
  if (quorum) state.quorumOk += 1;
  else state.quorumFail += 1;

  const snapshot = {
    at: state.lastCheckAt,
    quorum,
    okCount,
    need,
    peers: results,
    action: quorum ? 'hold_primary' : 'alert_only',
    note: 'EIQ never pm2-restarts the probed process from inside; external autoheal owns restarts.',
  };
  ringPush(_history, snapshot, 100);
  persist();
  return snapshot;
}

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  const interval = Math.max(15000, Number(process.env.EIQ_INTERVAL_MS || 60000));
  if (process.env.NODE_ENV !== 'test' && String(process.env.EIQ_DISABLED || '') !== '1') {
    _timer = setInterval(() => {
      checkQuorum().catch(() => {});
    }, interval);
    if (_timer.unref) _timer.unref();
    // deferred first check
    setTimeout(() => { checkQuorum().catch(() => {}); }, 3000).unref?.();
  }
  return getStatus();
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  state.running = false;
}

function getStatus() {
  const peers = configuredPeers();
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'External Immortality Quorum',
    running: !!state.running,
    startedAt: state.startedAt,
    peersConfigured: peers.length,
    peers: peers.map((p) => ({ id: p.id, role: p.role, url: p.url })),
    lastQuorum: state.lastQuorum,
    lastCheckAt: state.lastCheckAt,
    counts: {
      checks: state.checks,
      quorumOk: state.quorumOk,
      quorumFail: state.quorumFail,
    },
    honesty: {
      inventsPeers: false,
      inProcessRestart: false,
      note: 'Add standby URLs via EIQ_PEERS=https://standby/api/health,...',
    },
    recent: _history.slice(-5),
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/eiq/status',
      'POST /api/eiq/check',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  stop,
  getStatus,
  discovery,
  checkQuorum,
  configuredPeers,
};
