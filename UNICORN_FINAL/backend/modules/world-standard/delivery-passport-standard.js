'use strict';

/**
 * Delivery Passport Standard — DPS/1.0
 * Signed delivery passport per fulfillment: artifact hash, provider, SLA, receipt link.
 */

const path = require('path');
const {
  isoNow, sha256, moduleDir, readJson, writeJson, ringPush, ownerBtc,
} = require('./_util');

const PROTOCOL = 'DPS/1.0';
const NAME = 'delivery-passport-standard';

const state = {
  startedAt: null,
  running: false,
  issued: 0,
  verified: 0,
};

/** @type {Map<string, object>} */
const _passports = new Map();

function storeFile() {
  return path.join(moduleDir(NAME), 'passports.json');
}

function persist() {
  writeJson(storeFile(), {
    state,
    passports: [..._passports.values()].slice(-400),
  });
}

function load() {
  const data = readJson(storeFile(), null);
  if (!data) return;
  if (data.state) Object.assign(state, data.state);
  for (const p of data.passports || []) {
    if (p && p.passportId) _passports.set(p.passportId, p);
  }
}

load();

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

function issuePassport(input = {}) {
  start();
  const orderId = String(input.orderId || '').trim();
  if (!orderId) return { ok: false, reason: 'missing_orderId' };

  const artifact = input.artifact || input.delivery || null;
  const artifactHash = String(input.artifactHash || (artifact ? sha256(artifact) : '')).trim();
  if (!artifactHash) return { ok: false, reason: 'missing_artifactHash' };

  const passportId = 'dps_' + sha256(orderId + '|' + artifactHash).slice(0, 16);
  if (_passports.has(passportId)) {
    return { ok: true, duplicate: true, passport: _passports.get(passportId) };
  }

  const body = {
    protocol: PROTOCOL,
    passportId,
    orderId,
    serviceId: input.serviceId || null,
    artifactHash,
    artifactType: input.artifactType || 'digital-pack',
    provider: input.provider || input.model || 'deterministic-or-llm',
    slaHours: Number(input.slaHours || 72),
    deliveredAt: input.deliveredAt || isoNow(),
    ownerBtc: ownerBtc(),
    closReceiptHash: input.closReceiptHash || null,
    poopEscrowId: input.poopEscrowId || null,
    carbonEstimateKg: input.carbonEstimateKg != null ? Number(input.carbonEstimateKg) : null,
    note: 'Publicly verifiable delivery passport — not a chain NFT',
  };
  body.contentHash = sha256(body);
  body.issuedAt = isoNow();

  _passports.set(passportId, body);
  state.issued += 1;
  persist();
  return { ok: true, passport: body };
}

function verifyPassport(input = {}) {
  const passportId = String(input.passportId || (input.passport && input.passport.passportId) || '').trim();
  const passport = input.passport || _passports.get(passportId);
  if (!passport) return { ok: false, reason: 'passport_not_found' };
  const { contentHash, issuedAt, ...rest } = passport;
  void issuedAt;
  const expected = sha256(rest);
  // body was hashed before issuedAt — recompute from stored fields excluding issuedAt/contentHash
  const core = { ...passport };
  delete core.contentHash;
  delete core.issuedAt;
  const expected2 = sha256(core);
  const ok = contentHash === expected2 || contentHash === expected;
  if (ok) state.verified += 1;
  persist();
  return { ok, passportId: passport.passportId, expected: expected2, actual: contentHash };
}

function getPassport(id) {
  return _passports.get(String(id || '')) || null;
}

function listPassports(limit = 50) {
  return [..._passports.values()]
    .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))
    .slice(0, Math.min(200, Number(limit) || 50));
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Delivery Passport Standard',
    running: !!state.running,
    startedAt: state.startedAt,
    counts: { issued: state.issued, verified: state.verified, stored: _passports.size },
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/dps/status',
      'GET /api/dps/passports',
      'POST /api/dps/issue',
      'POST /api/dps/verify',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  discovery,
  issuePassport,
  verifyPassport,
  getPassport,
  listPassports,
};
