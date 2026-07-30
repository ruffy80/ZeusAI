'use strict';

/**
 * Immortality Continuum Protocol — ICP/1.0
 * Composes DCA + EBS + NDK pressure into one honest never-down surface.
 * Restarts remain outside the process (Boot Immortal / NDK doctrine).
 */

const dca = require('./immortality/deploy-continuum-attestor');
const ebs = require('./immortality/edge-bond-signal');
const cac = require('./immortality/continuity-attestation-chain');
const { isoNow, writeJson, paths } = require('./immortality/_util');

const PROTOCOL = 'ICP/1.0';
const NAME = 'immortality-continuum-protocol';

const state = {
  startedAt: null,
  running: false,
  tick: null,
};

function _ndkEnvelope() {
  try {
    const ndk = require('../never-down-kernel');
    return typeof ndk.healthEnvelope === 'function' ? ndk.healthEnvelope() : null;
  } catch (_) {
    return null;
  }
}

function _writePressureFromNdk() {
  const env = _ndkEnvelope();
  if (!env) return null;
  const reasons = Array.isArray(env.reasons) ? env.reasons : [];
  const commerceBlocked = reasons.includes('disk_critical') || reasons.includes('ram_critical');
  const payload = {
    protocol: 'CPG/1.0',
    updatedAt: isoNow(),
    commerceBlocked,
    reasons,
    health: env.health || 'unknown',
    diskUsedPct: env.diskUsedPct,
    freeMemPct: env.freeMemPct,
    source: 'never-down-kernel',
  };
  try { writeJson(paths.pressure(), payload); } catch (_) { /* ok */ }
  try { writeJson(paths.ndkEnvelope(), Object.assign({ updatedAt: isoNow() }, env)); } catch (_) { /* ok */ }
  return payload;
}

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  try { dca.start(); } catch (_) { /* isolate */ }
  try { ebs.start(); } catch (_) { /* isolate */ }
  try { cac.start(); } catch (_) { /* isolate */ }
  try { _writePressureFromNdk(); } catch (_) { /* isolate */ }
  try { ebs.probeFromTriad(); } catch (_) { /* isolate */ }
  try { cac.appendHeartbeat({ plane: { reasons: ['icp_start'] } }); } catch (_) { /* isolate */ }

  const ms = Math.max(15000, Number(process.env.ICP_TICK_MS || 60000));
  state.tick = setInterval(() => {
    try { _writePressureFromNdk(); } catch (_) { /* never throw */ }
    try { ebs.probeFromTriad(); } catch (_) { /* never throw */ }
    try { cac.appendHeartbeat(); } catch (_) { /* never throw */ }
  }, ms);
  if (state.tick.unref) state.tick.unref();
  console.log(`[icp] ${PROTOCOL} started · tick=${ms}ms · neverKill=true`);
  return getStatus();
}

function getStatus() {
  const ndk = _ndkEnvelope();
  let dcaSt = null;
  let ebsSt = null;
  let cacSt = null;
  try { dcaSt = dca.getStatus(); } catch (e) { dcaSt = { ok: false, error: e.message }; }
  try { ebsSt = ebs.getStatus(); } catch (e) { ebsSt = { ok: false, error: e.message }; }
  try { cacSt = cac.getStatus(); } catch (e) { cacSt = { ok: false, error: e.message }; }
  const pressure = _writePressureFromNdk();
  const inventions = [
    { id: 'dca', title: 'Deploy Continuum Attestor', protocol: 'DCA/1.0' },
    { id: 'cpg', title: 'Commerce Pressure Gate', protocol: 'CPG/1.0' },
    { id: 'ebs', title: 'Edge Bond Signal', protocol: 'EBS/1.0' },
    { id: 'cac', title: 'Continuity Attestation Chain', protocol: 'CAC/1.0' },
    { id: 'ccg', title: 'Client Continuum Guardian', protocol: 'CCG/1.0' },
    { id: 'pm2-resurrect', title: 'Host PM2 Resurrect Script', protocol: 'script' },
  ];
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Immortality Continuum Protocol',
    running: !!state.running,
    startedAt: state.startedAt,
    neverKill: true,
    claimsAbsoluteUptime: false,
    inventions,
    deployContinuum: dcaSt && dca.healthEnvelope ? dca.healthEnvelope() : dcaSt,
    edgeBond: ebsSt && ebsSt.signal,
    continuity: cacSt && cac.healthEnvelope ? cac.healthEnvelope() : cacSt,
    neverDown: ndk,
    commercePressure: pressure,
    honesty: {
      restartsOwnedBy: 'external healers (autoheal-min, health-watch, PM2, systemd)',
      inProcessRole: 'observe + fail-closed commerce + durable attestors + continuity passports',
      note: 'Never invents 100% uptime. Surfaces stuck-forward deploy and disk pressure honestly. CAC binds orders to observed heartbeats only.',
    },
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/icp/status',
      'GET /api/icp/dca',
      'GET /api/icp/edge-bond',
      'GET /.well-known/immortality.json',
      'GET /.well-known/continuity.json',
      'GET /api/cac/status',
      'POST /api/cac/bind',
      'POST /api/icp/dca/promote',
      'POST /api/icp/dca/canary-fail',
    ],
  };
}

function healthEnvelope() {
  const s = getStatus();
  return {
    protocol: PROTOCOL,
    neverKill: true,
    claimsAbsoluteUptime: false,
    commerceBlocked: !!(s.commercePressure && s.commercePressure.commerceBlocked),
    stuckForward: !!(s.deployContinuum && s.deployContinuum.stuckForward),
    tipQuarantined: !!(s.deployContinuum && s.deployContinuum.tipQuarantined),
    commitsBehindHint: s.deployContinuum && s.deployContinuum.commitsBehindHint,
    edgeRecommendation: s.edgeBond && s.edgeBond.recommendation,
    ndkHealth: s.neverDown && s.neverDown.health,
    continuityTip: s.continuity && s.continuity.tipHash,
    continuitySeq: s.continuity && s.continuity.seq,
  };
}

function mountRoutes(app) {
  if (!app || typeof app.get !== 'function') return { ok: false };
  app.get('/api/icp/status', (req, res) => res.json(getStatus()));
  app.get('/api/icp/dca', (req, res) => res.json(dca.getStatus()));
  app.get('/api/icp/edge-bond', (req, res) => res.json(ebs.getStatus()));
  app.get('/.well-known/immortality.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(discovery());
  });
  app.post('/api/icp/dca/promote', (req, res) => res.json(dca.recordPromote(req.body || {})));
  app.post('/api/icp/dca/canary-fail', (req, res) => res.json(dca.recordCanaryFail(req.body || {})));
  app.post('/api/icp/dca/quarantine', (req, res) => res.json(dca.recordQuarantine(req.body || {})));
  app.post('/api/icp/edge-bond/probe', (req, res) => res.json(ebs.probeFromTriad()));
  try { cac.mountRoutes(app); } catch (_) { /* isolate */ }
  return { ok: true, mounted: true };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  discovery,
  healthEnvelope,
  mountRoutes,
  dca,
  ebs,
  cac,
};
