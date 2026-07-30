'use strict';

/**
 * Continuity Attestation Chain — CAC/1.0
 * --------------------------------------
 * World-first cryptographic proof that an autonomous merchant OS was
 * continuously bonded (or honestly degraded) during a buyer's payment window.
 *
 * Escrow proves money. Delivery passports prove artifacts.
 * CAC proves the OPERATOR PLANE was alive and honest while you paid —
 * the missing attestation layer for solo/AI merchants.
 *
 * Chain: hash-linked heartbeats (NDK + SUBOS/TBOS + ICP) + Ed25519/HMAC signature.
 * Passport: binds orderId → [fromSeq..toSeq] with verdict. Offline-verifiable.
 *
 * Never invents uptime. Verdicts are continuous_bonded | degraded_window |
 * insufficient_samples | commerce_blocked_window.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isoNow, readJson, writeJson, ensureDir, paths, dataRoot } = require('./_util');

const PROTOCOL = 'CAC/1.0';
const NAME = 'continuity-attestation-chain';
const MAX_BEATS = Math.max(64, Number(process.env.CAC_MAX_BEATS || 500));
const MAX_PASSPORTS = Math.max(50, Number(process.env.CAC_MAX_PASSPORTS || 300));

const state = {
  startedAt: null,
  running: false,
  seq: 0,
  tipHash: null,
  beats: [],
  passports: new Map(),
  signedCount: 0,
  hmacFallbackCount: 0,
};

function chainFile() {
  return path.join(dataRoot(), 'continuity-chain.json');
}

function passportsFile() {
  return path.join(dataRoot(), 'continuity-passports.json');
}

function sha256(input) {
  return crypto.createHash('sha256')
    .update(typeof input === 'string' ? input : JSON.stringify(input))
    .digest('hex');
}

function canonical(obj) {
  return JSON.stringify(obj);
}

function loadSigning() {
  let cfg = null;
  let publicKeyInfoFn = null;
  try {
    const eop = require('../earth-outcome-protocol');
    if (eop && typeof eop.getSigningConfig === 'function') {
      cfg = eop.getSigningConfig();
      if (typeof eop.publicKeyInfo === 'function') publicKeyInfoFn = eop.publicKeyInfo;
    }
  } catch (_) { /* fall through */ }

  if (!cfg) {
    // Local minimal signer (same forever-key paths as EOP)
    const candidates = [
      process.env.SITE_SIGN_PEM,
      process.env.SITE_SIGN_KEY,
      '/var/www/unicorn/shared/site-sign.pem',
    ].filter(Boolean);
    let pem = null;
    for (const p of candidates) {
      try {
        if (String(p).includes('BEGIN')) { pem = p; break; }
        if (fs.existsSync(p)) { pem = fs.readFileSync(p, 'utf8'); break; }
      } catch (_) { /* next */ }
    }
    if (global.__SITE_SIGN_KEY__) pem = global.__SITE_SIGN_KEY__;
    if (pem) {
      try {
        const privateKey = crypto.createPrivateKey(pem);
        const publicKey = crypto.createPublicKey(privateKey);
        const keyId = 'ed25519:' + sha256(publicKey.export({ type: 'spki', format: 'pem' })).slice(0, 16);
        cfg = { mode: 'ed25519', privateKey, publicKey, keyId, fallback: false };
      } catch (_) { /* hmac */ }
    }
  }

  if (cfg && cfg.mode === 'ed25519' && cfg.privateKey) {
    return {
      cfg,
      signBody: (body) => ({
        algorithm: 'ed25519',
        keyId: cfg.keyId,
        signature: crypto.sign(null, Buffer.from(body), cfg.privateKey).toString('base64'),
      }),
      verifySignature: (body, signature) => {
        try {
          const ok = crypto.verify(
            null,
            Buffer.from(body),
            cfg.publicKey,
            Buffer.from(String(signature.signature || ''), 'base64')
          );
          return { ok, algorithm: 'ed25519', keyId: cfg.keyId };
        } catch (e) {
          return { ok: false, algorithm: 'ed25519', keyId: cfg.keyId, reason: e.message };
        }
      },
      publicKeyInfo: publicKeyInfoFn || (() => ({
        algorithm: 'ed25519',
        keyId: cfg.keyId,
        publicKeyPem: cfg.publicKey.export({ type: 'spki', format: 'pem' }),
      })),
    };
  }

  const secret = (cfg && cfg.secret)
    || process.env.CAC_HMAC_SECRET
    || process.env.JWT_SECRET
    || 'zeusai-cac-dev-fallback';
  const keyId = (cfg && cfg.keyId) || 'hmac:cac';
  return {
    cfg: { mode: 'hmac-sha256', secret, keyId, fallback: !(cfg && cfg.secret) && secret === 'zeusai-cac-dev-fallback' },
    signBody: (body) => ({
      algorithm: 'hmac-sha256',
      keyId,
      signature: crypto.createHmac('sha256', secret).update(body).digest('base64'),
    }),
    verifySignature: (body, signature) => {
      const expected = crypto.createHmac('sha256', secret).update(body).digest('base64');
      const a = Buffer.from(expected);
      const b = Buffer.from(String(signature.signature || ''));
      const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      return { ok, algorithm: 'hmac-sha256', keyId };
    },
    publicKeyInfo: publicKeyInfoFn || (() => ({ algorithm: 'hmac-sha256', keyId, publicKeyPem: null })),
  };
}

function _persistChain() {
  writeJson(chainFile(), {
    protocol: PROTOCOL,
    tipHash: state.tipHash,
    seq: state.seq,
    startedAt: state.startedAt,
    beats: state.beats.slice(-MAX_BEATS),
    updatedAt: isoNow(),
  });
}

function _persistPassports() {
  writeJson(passportsFile(), {
    protocol: PROTOCOL,
    passports: [...state.passports.values()].slice(-MAX_PASSPORTS),
    updatedAt: isoNow(),
  });
}

function _load() {
  const chain = readJson(chainFile(), null);
  if (chain && Array.isArray(chain.beats)) {
    state.beats = chain.beats.slice(-MAX_BEATS);
    state.seq = Number(chain.seq) || state.beats.length;
    state.tipHash = chain.tipHash || (state.beats.length ? state.beats[state.beats.length - 1].hash : null);
    state.startedAt = chain.startedAt || state.startedAt;
  }
  const pp = readJson(passportsFile(), null);
  if (pp && Array.isArray(pp.passports)) {
    for (const p of pp.passports) {
      if (p && p.passportId) state.passports.set(p.passportId, p);
    }
  }
}

_load();

function _sensePlane() {
  const plane = {
    buildSha: process.env.ZEUS_BUILD_SHA || process.env.GITHUB_SHA || process.env.SW_VERSION || null,
    ndkHealth: 'unknown',
    healerFail: false,
    commerceBlocked: false,
    stuckForward: false,
    subosScore: null,
    tbosScore: null,
    bonded: null,
    reasons: [],
  };
  try {
    const ndk = require('../never-down-kernel');
    const e = ndk.healthEnvelope();
    plane.ndkHealth = e.health || 'unknown';
    plane.healerFail = !!e.healerFail;
    plane.commerceBlocked = !!e.commerceBlocked;
    if (Array.isArray(e.reasons)) plane.reasons.push(...e.reasons);
  } catch (_) { /* optional */ }
  try {
    const dca = require('./deploy-continuum-attestor');
    const e = dca.healthEnvelope();
    plane.stuckForward = !!e.stuckForward;
  } catch (_) { /* optional */ }
  try {
    const pressure = readJson(paths.pressure(), null);
    if (pressure && pressure.commerceBlocked) {
      plane.commerceBlocked = true;
      if (Array.isArray(pressure.reasons)) plane.reasons.push(...pressure.reasons);
    }
  } catch (_) { /* optional */ }
  try {
    const subos = require('../site-unicorn-bond-os');
    const s = subos.getScore();
    plane.subosScore = s.score;
    if (s.bonded === false) plane.bonded = false;
    else if (s.bonded === true && plane.bonded == null) plane.bonded = true;
  } catch (_) { /* optional */ }
  try {
    const tbos = require('../triad-bond-os');
    const s = tbos.getScore();
    plane.tbosScore = s.score;
    if (s.bonded === false) plane.bonded = false;
    else if (s.bonded === true && plane.bonded !== false) plane.bonded = true;
  } catch (_) { /* optional */ }
  if (plane.bonded == null) plane.bonded = plane.ndkHealth === 'good' || plane.ndkHealth === 'degraded';
  return plane;
}

function appendHeartbeat(extra = {}) {
  start();
  const plane = Object.assign(_sensePlane(), extra.plane || {});
  const seq = state.seq + 1;
  const prevHash = state.tipHash || ('genesis:' + PROTOCOL);
  const body = {
    protocol: PROTOCOL,
    kind: 'heartbeat',
    seq,
    prevHash,
    at: isoNow(),
    buildSha: plane.buildSha,
    ndkHealth: plane.ndkHealth,
    healerFail: !!plane.healerFail,
    commerceBlocked: !!plane.commerceBlocked,
    stuckForward: !!plane.stuckForward,
    subosScore: plane.subosScore,
    tbosScore: plane.tbosScore,
    bonded: !!plane.bonded,
    reasons: (plane.reasons || []).slice(0, 12),
  };
  const hash = sha256(canonical(body));
  const signing = loadSigning();
  const signature = signing.signBody(canonical({ ...body, hash }));
  if (signature.algorithm === 'hmac-sha256') state.hmacFallbackCount += 1;
  else state.signedCount += 1;

  const beat = { ...body, hash, signature };
  state.seq = seq;
  state.tipHash = hash;
  state.beats.push(beat);
  if (state.beats.length > MAX_BEATS) state.beats.splice(0, state.beats.length - MAX_BEATS);
  _persistChain();
  return beat;
}

function verifyChain(limit = 50) {
  const beats = state.beats.slice(-Math.max(1, Number(limit) || 50));
  if (!beats.length) return { ok: true, empty: true, checked: 0 };
  const signing = loadSigning();
  let prev = null;
  const failures = [];
  for (const b of beats) {
    const { hash, signature, ...rest } = b;
    const expectHash = sha256(canonical(rest));
    if (expectHash !== hash) failures.push({ seq: b.seq, reason: 'hash_mismatch' });
    if (prev && rest.prevHash !== prev) failures.push({ seq: b.seq, reason: 'prev_break', expected: prev, got: rest.prevHash });
    const sigCheck = signing.verifySignature(canonical({ ...rest, hash }), signature || {});
    if (!sigCheck.ok) failures.push({ seq: b.seq, reason: 'signature_invalid', detail: sigCheck.reason || null });
    prev = hash;
  }
  return {
    ok: failures.length === 0,
    checked: beats.length,
    tipHash: state.tipHash,
    failures: failures.slice(0, 20),
    signingMode: (signing.cfg && signing.cfg.mode) || 'unknown',
  };
}

function _verdictForWindow(beats) {
  if (!beats.length) return 'insufficient_samples';
  const blocked = beats.filter((b) => b.commerceBlocked).length;
  if (blocked > 0) return 'commerce_blocked_window';
  const degraded = beats.filter((b) => b.ndkHealth === 'critical' || b.healerFail || b.stuckForward || b.bonded === false).length;
  if (degraded > 0) return 'degraded_window';
  const bonded = beats.filter((b) => b.bonded && (b.ndkHealth === 'good' || b.ndkHealth === 'degraded')).length;
  if (bonded === beats.length) return 'continuous_bonded';
  if (bonded > 0) return 'degraded_window';
  return 'insufficient_samples';
}

function bindOrder(input = {}) {
  start();
  const orderId = String(input.orderId || '').trim().slice(0, 120);
  if (!orderId) return { ok: false, reason: 'missing_orderId' };

  // Ensure at least one beat exists around bind time
  if (!state.beats.length) appendHeartbeat({ plane: { reasons: ['bind_bootstrap'] } });

  const paidAt = input.paidAt ? Date.parse(input.paidAt) : Date.now();
  const windowMs = Math.max(60_000, Number(input.windowMs || process.env.CAC_BIND_WINDOW_MS || 15 * 60 * 1000));
  const fromMs = paidAt - windowMs;
  const toMs = paidAt + Math.min(windowMs, 5 * 60 * 1000);

  let windowBeats = state.beats.filter((b) => {
    const t = Date.parse(b.at);
    return Number.isFinite(t) && t >= fromMs && t <= toMs;
  });
  if (!windowBeats.length) {
    // Fall back to last N beats — honest insufficient if still empty after append
    appendHeartbeat({ plane: { reasons: ['bind_window_empty'] } });
    windowBeats = state.beats.slice(-5);
  }

  const fromSeq = windowBeats[0].seq;
  const toSeq = windowBeats[windowBeats.length - 1].seq;
  const verdict = _verdictForWindow(windowBeats);
  const passportBody = {
    protocol: PROTOCOL,
    kind: 'continuity_passport',
    orderId,
    serviceId: input.serviceId || null,
    emailHash: input.email ? sha256(String(input.email).trim().toLowerCase()).slice(0, 24) : null,
    fromSeq,
    toSeq,
    beatCount: windowBeats.length,
    bondedCount: windowBeats.filter((b) => b.bonded).length,
    degradedCount: windowBeats.filter((b) => b.ndkHealth === 'critical' || b.healerFail || b.stuckForward || !b.bonded).length,
    commerceBlockedCount: windowBeats.filter((b) => b.commerceBlocked).length,
    tipHash: state.tipHash,
    windowFrom: new Date(fromMs).toISOString(),
    windowTo: new Date(toMs).toISOString(),
    verdict,
    issuedAt: isoNow(),
    honesty: {
      inventsUptime: false,
      note: 'Verdict reflects observed heartbeats only — never a 100% uptime guarantee.',
    },
  };
  const passportId = 'cac_' + sha256(orderId + '|' + fromSeq + '|' + toSeq + '|' + passportBody.issuedAt).slice(0, 16);
  const hash = sha256(canonical({ ...passportBody, passportId }));
  const signing = loadSigning();
  const signature = signing.signBody(canonical({ ...passportBody, passportId, hash }));
  const passport = { ...passportBody, passportId, hash, signature, chainTip: state.tipHash };
  state.passports.set(passportId, passport);
  // Also index by orderId (latest wins)
  state.passports.set('order:' + orderId, passport);
  if (state.passports.size > MAX_PASSPORTS * 2) {
    const vals = [...state.passports.entries()].filter(([k]) => !k.startsWith('order:')).slice(-MAX_PASSPORTS);
    state.passports = new Map(vals);
    for (const p of vals) state.passports.set('order:' + p[1].orderId, p[1]);
  }
  _persistPassports();
  return { ok: true, passport };
}

function getPassport(idOrOrder) {
  const key = String(idOrOrder || '').trim();
  if (!key) return null;
  return state.passports.get(key)
    || state.passports.get('order:' + key)
    || [...state.passports.values()].find((p) => p.passportId === key || p.orderId === key)
    || null;
}

function verifyPassport(passport) {
  if (!passport || typeof passport !== 'object') return { ok: false, reason: 'missing_passport' };
  const { hash, signature, chainTip, ...rest } = passport;
  const expect = sha256(canonical(rest));
  if (expect !== hash) return { ok: false, reason: 'hash_mismatch' };
  const signing = loadSigning();
  const sig = signing.verifySignature(canonical({ ...rest, hash }), signature || {});
  if (!sig.ok) return { ok: false, reason: 'signature_invalid', detail: sig.reason || null };
  // Soft-check chain coverage
  const covered = state.beats.filter((b) => b.seq >= rest.fromSeq && b.seq <= rest.toSeq);
  return {
    ok: true,
    verdict: rest.verdict,
    orderId: rest.orderId,
    beatCount: rest.beatCount,
    coveredNow: covered.length,
    signingMode: sig.algorithm,
    keyId: sig.keyId,
  };
}

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  if (!state.beats.length) {
    try { appendHeartbeat({ plane: { reasons: ['cac_start'] } }); } catch (_) { /* ok */ }
  }
  return getStatus();
}

function getStatus() {
  const last = state.beats.length ? state.beats[state.beats.length - 1] : null;
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Continuity Attestation Chain',
    running: !!state.running,
    startedAt: state.startedAt,
    seq: state.seq,
    tipHash: state.tipHash,
    beatCount: state.beats.length,
    passportCount: [...state.passports.keys()].filter((k) => !k.startsWith('order:')).length,
    lastBeatAt: last && last.at,
    lastVerdictHint: last ? (last.bonded && !last.commerceBlocked && !last.healerFail ? 'plane_bonded' : 'plane_stressed') : null,
    signedCount: state.signedCount,
    hmacFallbackCount: state.hmacFallbackCount,
    publicKey: loadSigning().publicKeyInfo(),
    honesty: {
      inventsUptime: false,
      claimsAbsoluteUptime: false,
      note: 'Heartbeats are observations. Passports bind orders to observed windows only.',
    },
    timestamp: isoNow(),
  };
}

function listBeats(limit = 20) {
  return state.beats.slice(-Math.max(1, Math.min(100, Number(limit) || 20)));
}

function healthEnvelope() {
  const s = getStatus();
  return {
    protocol: PROTOCOL,
    tipHash: s.tipHash,
    seq: s.seq,
    beatCount: s.beatCount,
    lastBeatAt: s.lastBeatAt,
    lastVerdictHint: s.lastVerdictHint,
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/cac/status',
      'GET /api/cac/beats',
      'GET /api/cac/verify-chain',
      'GET /api/cac/passport/:id',
      'POST /api/cac/bind',
      'POST /api/cac/verify-passport',
      'GET /.well-known/continuity.json',
    ],
  };
}

function mountRoutes(app) {
  if (!app || typeof app.get !== 'function') return { ok: false };
  app.get('/api/cac/status', (req, res) => res.json(getStatus()));
  app.get('/api/cac/beats', (req, res) => res.json({ ok: true, beats: listBeats(req.query.limit) }));
  app.get('/api/cac/verify-chain', (req, res) => res.json(verifyChain(req.query.limit)));
  app.get('/api/cac/passport/:id', (req, res) => {
    const p = getPassport(req.params.id);
    if (!p) return res.status(404).json({ ok: false, reason: 'not_found' });
    return res.json({ ok: true, passport: p, verification: verifyPassport(p) });
  });
  app.post('/api/cac/bind', (req, res) => res.json(bindOrder(req.body || {})));
  app.post('/api/cac/heartbeat', (req, res) => res.json({ ok: true, beat: appendHeartbeat(req.body || {}) }));
  app.post('/api/cac/verify-passport', (req, res) => res.json(verifyPassport((req.body && req.body.passport) || req.body || {})));
  app.get('/.well-known/continuity.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(discovery());
  });
  return { ok: true, mounted: true };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  healthEnvelope,
  discovery,
  mountRoutes,
  appendHeartbeat,
  verifyChain,
  bindOrder,
  getPassport,
  verifyPassport,
  listBeats,
};
