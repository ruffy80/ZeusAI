'use strict';

/**
 * Deploy Continuum Attestor — DCA/1.0
 * Durable facts about canary/promote/quarantine/behind-main.
 * Never invents uptime. Surfaces "forward-deploy stuck" honestly.
 */

const fs = require('fs');
const path = require('path');
const { isoNow, readJson, writeJson, paths } = require('./_util');

const PROTOCOL = 'DCA/1.0';
const NAME = 'deploy-continuum-attestor';

const state = {
  startedAt: null,
  running: false,
  liveSha: null,
  lastPromoteAt: null,
  lastCanaryFailAt: null,
  lastCanaryFailSha: null,
  lastCanaryFailReason: null,
  quarantined: [],
  knownGoodSha: null,
  commitsBehindHint: null,
  events: [],
};

function _persist() {
  writeJson(paths.dca(), {
    protocol: PROTOCOL,
    state: {
      startedAt: state.startedAt,
      liveSha: state.liveSha,
      lastPromoteAt: state.lastPromoteAt,
      lastCanaryFailAt: state.lastCanaryFailAt,
      lastCanaryFailSha: state.lastCanaryFailSha,
      lastCanaryFailReason: state.lastCanaryFailReason,
      quarantined: state.quarantined.slice(-40),
      knownGoodSha: state.knownGoodSha,
      commitsBehindHint: state.commitsBehindHint,
      events: state.events.slice(0, 30),
    },
    updatedAt: isoNow(),
  });
}

function _load() {
  const data = readJson(paths.dca(), null);
  if (!data || !data.state) return;
  Object.assign(state, data.state);
  if (!Array.isArray(state.quarantined)) state.quarantined = [];
  if (!Array.isArray(state.events)) state.events = [];
}

_load();

function _pushEvent(kind, detail) {
  state.events.unshift({
    kind,
    at: isoNow(),
    ...(detail || {}),
  });
  if (state.events.length > 40) state.events.length = 40;
}

function _readHostFiles() {
  const out = {};
  const qFile = process.env.ZEUS_QUARANTINE_FILE || '/opt/zeus-autodeploy/quarantine.txt';
  const kgFile = process.env.ZEUS_KNOWN_GOOD_FILE || '/opt/zeus-autodeploy/known-good.sha';
  try {
    if (fs.existsSync(qFile)) {
      const lines = fs.readFileSync(qFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      out.quarantineFile = lines.slice(-40);
    }
  } catch (_) { /* optional */ }
  try {
    if (fs.existsSync(kgFile)) {
      out.knownGoodSha = fs.readFileSync(kgFile, 'utf8').trim().slice(0, 64);
    }
  } catch (_) { /* optional */ }
  return out;
}

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  if (!state.liveSha) {
    state.liveSha = process.env.ZEUS_BUILD_SHA || process.env.GITHUB_SHA || process.env.SW_VERSION || null;
  }
  const host = _readHostFiles();
  if (host.knownGoodSha) state.knownGoodSha = host.knownGoodSha;
  if (Array.isArray(host.quarantineFile) && host.quarantineFile.length) {
    state.quarantined = [...new Set([...(state.quarantined || []), ...host.quarantineFile])].slice(-40);
  }
  _persist();
  return getStatus();
}

function recordPromote(input = {}) {
  start();
  const sha = String(input.sha || process.env.ZEUS_BUILD_SHA || process.env.GITHUB_SHA || '').trim().slice(0, 64);
  if (!sha) return { ok: false, reason: 'missing_sha' };
  state.liveSha = sha;
  state.lastPromoteAt = isoNow();
  state.knownGoodSha = sha;
  state.commitsBehindHint = 0;
  // Successful promote clears stuck-forward canary signal
  state.lastCanaryFailAt = null;
  state.lastCanaryFailSha = null;
  state.lastCanaryFailReason = null;
  _pushEvent('promote', { sha, note: input.note || null });
  _persist();
  return { ok: true, liveSha: sha };
}

function recordCanaryFail(input = {}) {
  start();
  const sha = String(input.sha || '').trim().slice(0, 64) || null;
  state.lastCanaryFailAt = isoNow();
  state.lastCanaryFailSha = sha;
  state.lastCanaryFailReason = String(input.reason || 'canary_failed').slice(0, 240);
  _pushEvent('canary_fail', { sha, reason: state.lastCanaryFailReason });
  _persist();
  return { ok: true };
}

function recordQuarantine(input = {}) {
  start();
  const sha = String(input.sha || '').trim().slice(0, 64);
  if (!sha) return { ok: false, reason: 'missing_sha' };
  if (!state.quarantined.includes(sha)) state.quarantined.push(sha);
  state.quarantined = state.quarantined.slice(-40);
  _pushEvent('quarantine', { sha, reason: String(input.reason || '').slice(0, 240) || null });
  _persist();
  return { ok: true, quarantined: state.quarantined.slice() };
}

function recordBehindHint(n) {
  start();
  const v = Number(n);
  state.commitsBehindHint = Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
  _persist();
  return { ok: true, commitsBehindHint: state.commitsBehindHint };
}

function getStatus() {
  const host = _readHostFiles();
  const envSha = process.env.ZEUS_BUILD_SHA || process.env.GITHUB_SHA || process.env.SW_VERSION || null;
  const liveSha = state.liveSha || envSha;
  const quarantined = [...new Set([
    ...(state.quarantined || []),
    ...(host.quarantineFile || []),
  ])].slice(-40);
  const knownGood = state.knownGoodSha || host.knownGoodSha || null;
  const tipQuarantined = !!(liveSha && quarantined.some((q) => liveSha.startsWith(q) || q.startsWith(String(liveSha).slice(0, 7))));
  const stuckForward = !!(state.lastCanaryFailAt && (!state.lastPromoteAt
    || Date.parse(state.lastCanaryFailAt) >= Date.parse(state.lastPromoteAt)));
  const behind = state.commitsBehindHint != null ? state.commitsBehindHint : null;

  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Deploy Continuum Attestor',
    running: !!state.running,
    startedAt: state.startedAt,
    liveSha,
    envSha,
    knownGoodSha: knownGood,
    lastPromoteAt: state.lastPromoteAt,
    lastCanaryFailAt: state.lastCanaryFailAt,
    lastCanaryFailSha: state.lastCanaryFailSha,
    lastCanaryFailReason: state.lastCanaryFailReason,
    quarantined,
    tipQuarantined,
    stuckForward,
    commitsBehindHint: behind,
    honesty: {
      claimsAbsoluteUptime: false,
      greenHealthCanStillBeBehindMain: true,
      note: 'Site may be healthy while commitsBehindHint>0 or stuckForward — that is deploy continuum truth, not immortality theater.',
    },
    recentEvents: (state.events || []).slice(0, 8),
    timestamp: isoNow(),
  };
}

function healthEnvelope() {
  const s = getStatus();
  return {
    protocol: PROTOCOL,
    liveSha: s.liveSha,
    stuckForward: !!s.stuckForward,
    tipQuarantined: !!s.tipQuarantined,
    commitsBehindHint: s.commitsBehindHint,
    lastCanaryFailAt: s.lastCanaryFailAt,
    knownGoodSha: s.knownGoodSha,
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  healthEnvelope,
  recordPromote,
  recordCanaryFail,
  recordQuarantine,
  recordBehindHint,
};
