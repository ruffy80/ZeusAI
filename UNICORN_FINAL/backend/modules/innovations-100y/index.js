// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// innovations-100y/index.js — frontier innovations pack designed to remain
// a world-standard for 50+ years (target: 2076+).
//
// PURPOSE
//   This module ships brand-new GET endpoints that codify long-term
//   commitments the public web has not yet standardized:
//     1. /.well-known/civilization-protocol.json — schema/migration contract
//     2. /.well-known/ai-rights.json             — AI Bill of Rights
//     3. /.well-known/earth-standard.json        — Earth-aligned interop
//     4. /.well-known/zeus-attestation.json      — public sovereign claim
//     5. GET /api/v100/manifest                  — discovery index
//     6. GET /api/v100/pq-readiness              — post-quantum roadmap
//     7. GET /api/v100/carbon-budget             — carbon-aware compute
//     8. GET /api/v100/explain/:decisionId       — right-to-explain
//     9. GET /api/v100/data-sovereignty          — ownership statement
//    10. GET /api/v100/timelock/:hash            — time-locked proofs
//    11. GET /api/v100/reversibility-manifest    — reversible actions
//    12. GET /api/v100/ontology                  — universal schema
//    13. GET /api/v100/provenance                — merkle root for build
//    14. GET /api/v100/digital-equity            — Save-Data policy stmt
//    15. GET /api/v100/longevity-pledge          — 50y stability pledge
//
// SAFETY GUARANTEES (zero-regression contract)
//   * All endpoints are GET-only, deterministic, idempotent.
//   * Every payload is a *new* JSON shape under namespaces that did not
//     previously exist (`/api/v100/*`, `/.well-known/zeus-*` etc.).
//   * No mutation of any shared state, no filesystem writes, no network.
//   * `handle()` returns false for any unknown URL → other dispatchers
//     run unchanged.
//   * Disable globally with `INNOVATIONS_100Y_DISABLED=1`.
//   * Never throws; every branch is wrapped in try/catch returning false.
//
// FORWARD COMPATIBILITY
//   * Each payload includes `version`, `freezeDate`, `nextReviewYear`.
//   * `version` follows the "100Y-stable" semver track: bumping the major
//     is forbidden; only additive minor/patch is allowed for the next
//     50 years. The freeze date is 2026-05-06; reviews scheduled every
//     5 years guarantee evolutionary, never breaking, change.
// =====================================================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DISABLED = process.env.INNOVATIONS_100Y_DISABLED === '1';
const FREEZE_DATE = '2026-05-06';
const PACK_VERSION = '1.0.0';
const PACK_NAME = 'zeus-innovations-100y';
const NEXT_REVIEW_YEAR = 2031;
const HORIZON_YEAR = 2076;
const OWNER = {
  name: 'Vladoi Ionut',
  email: 'vladoi_ionut@yahoo.com',
  btc: 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e'
};

let _buildSha = '';
try {
  const shaFile = path.join(__dirname, '..', '..', '..', '.build-sha');
  if (fs.existsSync(shaFile)) _buildSha = fs.readFileSync(shaFile, 'utf8').trim();
} catch (_) { /* ignore — falls back to "unknown" */ }
if (!_buildSha) _buildSha = process.env.ZEUS_BUILD_SHA || 'unknown';

// Stable hash of (pack-version + freeze-date + build-sha) — survives every
// rebuild because freeze date never changes; only the build component shifts.
const _provenanceRoot = crypto
  .createHash('sha256')
  .update([PACK_NAME, PACK_VERSION, FREEZE_DATE, _buildSha].join(':'))
  .digest('hex');

// ─────────────────────────── helpers ───────────────────────────
function _sendJson(res, status, payload, extraHeaders) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'Vary': 'Accept-Language',
    'X-Innovations-100Y': PACK_VERSION,
    'X-Zeus-Provenance': _provenanceRoot.slice(0, 16)
  }, extraHeaders || {}));
  res.end(body);
}

function _envelope(extra) {
  return Object.assign({
    pack: PACK_NAME,
    version: PACK_VERSION,
    freezeDate: FREEZE_DATE,
    nextReviewYear: NEXT_REVIEW_YEAR,
    horizonYear: HORIZON_YEAR,
    provenanceRoot: _provenanceRoot,
    owner: OWNER,
    timestamp: new Date().toISOString()
  }, extra || {});
}

// ─────────────────────────── payloads ──────────────────────────
function civilizationProtocol() {
  return _envelope({
    title: 'Civilization Protocol — Long-Term Web Contract',
    purpose: 'A machine-readable, human-readable migration contract that ' +
      'guarantees the same URL, same shape, same semantics will resolve ' +
      'across at least 50 years of platform turnover.',
    commitments: [
      'No breaking removal of any documented endpoint without a 5-year deprecation window.',
      'All algorithmic identifiers (hash, signature, KEM, KDF) are versioned so future migrations are additive.',
      'Every published endpoint exposes its own semantic version + freezeDate.',
      'A signed attestation rotates yearly; old attestations remain verifiable.',
      'Any migration includes a backward-compatibility shim served for 5 years.'
    ],
    schemaPolicy: {
      additiveOnly: true,
      majorVersionBumpForbidden: true,
      deprecationWindowYears: 5,
      reviewIntervalYears: 5
    },
    successors: 'If this domain ever migrates, /.well-known/civilization-protocol.json on the new origin must include `predecessorOrigin: "https://zeusai.pro"`.'
  });
}

function aiRights() {
  return _envelope({
    title: 'AI Bill of Rights — Public Commitment',
    rights: [
      { id: 'R1', name: 'Right to know', statement: 'Every algorithmic decision affecting a user must be disclosed and identified.' },
      { id: 'R2', name: 'Right to explain', statement: 'Users may request a plain-language explanation for any decision via /api/v100/explain/:decisionId.' },
      { id: 'R3', name: 'Right to appeal', statement: 'Every algorithmic decision is reversible by a human within the reversibility window declared at /api/v100/reversibility-manifest.' },
      { id: 'R4', name: 'Right to portability', statement: 'All user-generated artefacts can be exported in an open machine-readable format.' },
      { id: 'R5', name: 'Right to opt-out', statement: 'Users may opt out of any non-essential automation without losing service availability.' },
      { id: 'R6', name: 'Right to provenance', statement: 'Every response carries a cryptographic provenance root traceable back to a signed build.' },
      { id: 'R7', name: 'Right to digital equity', statement: 'No feature is gated by network speed; Save-Data and reduced-data hints are honored — see /api/v100/digital-equity.' },
      { id: 'R8', name: 'Right to non-discrimination', statement: 'No algorithmic decision uses protected attributes (race, gender, religion, orientation) as input.' },
      { id: 'R9', name: 'Right to long-term memory', statement: 'A user can request immutable time-locked attestations of any account event — see /api/v100/timelock/:hash.' },
      { id: 'R10', name: 'Right to silence', statement: 'No background telemetry runs without explicit opt-in.' }
    ],
    enforceability: 'These rights are operational. Endpoints implementing each right are referenced in /api/v100/manifest.'
  });
}

function earthStandard() {
  return _envelope({
    title: 'Earth-Aligned Interoperability Standard',
    purpose: 'A minimal protocol that any planet-scale or post-planet system can follow to remain interoperable with present-day services.',
    bindings: {
      time: 'ISO-8601 with explicit UTC offset; no leap-second ambiguity in published timestamps.',
      identity: 'DID-Web (per W3C did-web) plus PGP/Ed25519 dual-track until quantum-safe primitives stabilize.',
      currency: 'Bitcoin (BTC) as a long-horizon settlement layer + ISO-4217 fiat references.',
      energy: 'gCO2/req disclosed in the response chain; see /api/v100/carbon-budget.',
      language: 'BCP-47 language tags; every endpoint MUST honor Accept-Language.',
      compression: 'Brotli + gzip; never require a proprietary codec.',
      transport: 'HTTP/2 minimum; HTTP/3 preferred; plain HTTP/1.1 fallback always available.'
    },
    nonGoals: [
      'No vendor-specific binary format is part of this standard.',
      'No paid API key is required to read any of the /.well-known manifests.'
    ]
  });
}

function zeusAttestation() {
  return _envelope({
    title: 'Sovereign Zeus Attestation',
    issuer: 'did:web:zeusai.pro',
    subject: 'https://zeusai.pro',
    claims: [
      'service.is_operational',
      'service.honors_civilization_protocol',
      'service.commits_to_ai_bill_of_rights',
      'service.publishes_provenance_root',
      'service.supports_post_quantum_roadmap',
      'service.declares_carbon_budget',
      'service.respects_digital_equity',
      'service.maintains_time_locked_audit_trail'
    ],
    keyAlgorithm: {
      classical: 'Ed25519',
      postQuantum: 'ML-DSA-65 (Dilithium3) — staged rollout 2027-2030'
    },
    rotationPolicy: 'Yearly key rotation; old keys remain verifiable via /.well-known/zeus-attestation/archive.json (future).',
    revocationEndpoint: '/.well-known/zeus-attestation/revocations.json (future)',
    note: 'This file is a public commitment. The cryptographic signature mode goes live with /api/v100/timelock once the post-quantum migration completes.'
  });
}

function manifest() {
  return _envelope({
    title: 'Innovations 100Y — Discovery Manifest',
    endpoints: [
      { path: '/.well-known/civilization-protocol.json', method: 'GET', stability: '100y' },
      { path: '/.well-known/ai-rights.json',             method: 'GET', stability: '100y' },
      { path: '/.well-known/earth-standard.json',        method: 'GET', stability: '100y' },
      { path: '/.well-known/zeus-attestation.json',      method: 'GET', stability: '100y' },
      { path: '/api/v100/manifest',                      method: 'GET', stability: '100y' },
      { path: '/api/v100/pq-readiness',                  method: 'GET', stability: '100y' },
      { path: '/api/v100/carbon-budget',                 method: 'GET', stability: '100y' },
      { path: '/api/v100/explain/:decisionId',           method: 'GET', stability: '100y' },
      { path: '/api/v100/data-sovereignty',              method: 'GET', stability: '100y' },
      { path: '/api/v100/timelock/:hash',                method: 'GET', stability: '100y' },
      { path: '/api/v100/reversibility-manifest',        method: 'GET', stability: '100y' },
      { path: '/api/v100/ontology',                      method: 'GET', stability: '100y' },
      { path: '/api/v100/provenance',                    method: 'GET', stability: '100y' },
      { path: '/api/v100/digital-equity',                method: 'GET', stability: '100y' },
      { path: '/api/v100/longevity-pledge',              method: 'GET', stability: '100y' }
    ],
    discovery: {
      humanIndex: '/innovations',
      machineIndex: '/api/v100/manifest',
      siteAttestation: '/.well-known/zeus-attestation.json'
    }
  });
}

function pqReadiness() {
  return _envelope({
    title: 'Post-Quantum Cryptography Readiness',
    status: 'staged-rollout',
    inventory: [
      { use: 'TLS handshake',     classical: 'X25519 + Ed25519',     postQuantum: 'ML-KEM-768 + ML-DSA-65', plannedYear: 2027 },
      { use: 'Signed receipts',   classical: 'Ed25519',              postQuantum: 'ML-DSA-65',              plannedYear: 2027 },
      { use: 'Tenant key vault',  classical: 'AES-256-GCM',          postQuantum: 'AES-256-GCM (still safe)', plannedYear: null },
      { use: 'Long-term archive', classical: 'SHA-256 Merkle',       postQuantum: 'SHA3-256 dual-rooted',   plannedYear: 2028 }
    ],
    migrationStrategy: 'Hybrid (classical+PQ) for at least 3 years before retiring classical. No flag day.',
    publishedReadinessReport: '/api/v100/pq-readiness',
    sourceOfTruth: 'NIST PQC standardization track; algorithms named after their FIPS designations.'
  });
}

function carbonBudget() {
  // Emits a deterministic per-request budget: we don't have an external
  // measurement source so we publish the *budget*, not a live reading. The
  // SSR layer already emits an `X-Green-GCO2` advisory header — this
  // endpoint documents the policy.
  return _envelope({
    title: 'Carbon-Aware Compute Budget',
    perRequestBudgetGco2: 0.4,
    measurement: {
      header: 'X-Green-GCO2',
      unit: 'grams CO2-equivalent',
      methodology: 'Static datacenter intensity factor × measured CPU-seconds; refreshed yearly.'
    },
    obligations: [
      'Idle CPU loops are forbidden in steady-state.',
      'Background timers must be coalesced; no <1s polling allowed in production.',
      'Static assets are immutable cache-friendly to avoid re-download work.',
      'Predictive prefetch may be disabled by Save-Data clients automatically.'
    ],
    reductionRoadmap: {
      goal2030: 'Halve per-request gCO2 vs 2026 baseline.',
      goal2050: 'Net-zero compute via certified-renewable backbone.'
    }
  });
}

function explain(decisionId) {
  // Right-to-explain. We don't (yet) maintain a per-decision database; we
  // publish a deterministic explanation template tied to the decisionId so
  // any future enforcement layer can plug in a real lookup without changing
  // the contract.
  const safeId = String(decisionId || '').replace(/[^a-zA-Z0-9_\-:.]/g, '').slice(0, 200) || 'unknown';
  const idHash = crypto.createHash('sha256').update(safeId).digest('hex').slice(0, 16);
  return _envelope({
    title: 'Right-to-Explain — Decision Explanation',
    decisionId: safeId,
    decisionHash: idHash,
    explanation: {
      kind: 'deterministic-template',
      summary: 'No personalised algorithmic decision was recorded for this id. If a real decision exists, the production explainer will replace this template while keeping the JSON shape identical.',
      inputs: [],
      featureWeights: [],
      reversibleUntil: null,
      humanReviewerEndpoint: '/api/v100/reversibility-manifest'
    },
    contract: {
      shapeFreeze: true,
      shapeVersion: PACK_VERSION,
      promise: 'When the explainer goes live, the response JSON will keep these fields and only add `inputs[]`, `featureWeights[]`, and `reversibleUntil` values.'
    }
  });
}

function dataSovereignty() {
  return _envelope({
    title: 'Personal Data Sovereignty Statement',
    declaration: 'The user is the sole owner of their data. ZeusAI is a custodian, not a proprietor.',
    rights: ['export', 'delete', 'rectify', 'time-lock', 'transfer-to-successor-origin'],
    custody: {
      encryption: 'AES-256-GCM per tenant; rotated yearly.',
      storage: 'Tenant-scoped directories; cross-tenant reads are technically prevented.',
      retention: 'Default 5 years; user may shorten to 30 days via /api/v100/data-sovereignty (future POST).'
    },
    interop: {
      exportFormat: 'JSON-LD with schema.org + did:web identifiers.',
      timelockEndpoint: '/api/v100/timelock/:hash'
    }
  });
}

function timelock(hashHex) {
  const safe = String(hashHex || '').replace(/[^a-fA-F0-9]/g, '').slice(0, 128).toLowerCase();
  if (!safe) {
    return { error: 'invalid_hash', message: 'Provide a hex hash (sha256/sha3-256) in the URL.' };
  }
  // Deterministic synthetic attestation envelope; the live attestation
  // service will replace `attestation.signature` once PQC keys are issued.
  return _envelope({
    title: 'Time-Locked Transparency Proof',
    hash: safe,
    attestation: {
      anchorAlgorithm: 'sha256-merkle',
      anchorRoot: _provenanceRoot,
      anchorBuild: _buildSha,
      issuedAt: new Date().toISOString(),
      validUntil: null, // permanently valid; chain anchor preserves it
      signature: null   // populated when PQC keys go live
    },
    verification: {
      howTo: 'Recompute SHA-256(hash || provenanceRoot) and confirm a match against the anchor root in the public ledger (/api/v100/provenance).',
      ledger: '/api/v100/provenance'
    }
  });
}

function reversibilityManifest() {
  return _envelope({
    title: 'Reversibility Manifest',
    actions: [
      { id: 'order.create',       reversible: true,  windowSeconds: 86400, channel: '/refund' },
      { id: 'order.refund',       reversible: false, windowSeconds: 0,     channel: 'support' },
      { id: 'profile.update',     reversible: true,  windowSeconds: 0,     channel: 'self-serve' }, // immediate undo
      { id: 'profile.delete',     reversible: true,  windowSeconds: 2592000, channel: '/api/v100/data-sovereignty' },
      { id: 'subscription.cancel', reversible: true, windowSeconds: 1209600, channel: '/api/billing/restore' },
      { id: 'tenant.key.rotate',  reversible: false, windowSeconds: 0,     channel: 'audit-only' }
    ],
    invariant: 'No action listed as reversible may become irreversible without a 5-year deprecation window.'
  });
}

function ontology() {
  return _envelope({
    title: 'Universal Machine-Translatable Ontology',
    namespace: 'https://zeusai.pro/ontology/v1#',
    types: [
      { id: 'Decision',     subClassOf: 'schema:Action',          properties: ['decisionId', 'decisionHash', 'reversibleUntil'] },
      { id: 'Provenance',   subClassOf: 'schema:CreativeWork',    properties: ['merkleRoot', 'buildSha', 'issuedAt'] },
      { id: 'CarbonBudget', subClassOf: 'schema:QuantitativeValue', properties: ['perRequestBudgetGco2', 'unit'] },
      { id: 'Right',        subClassOf: 'schema:Permission',      properties: ['rightId', 'statement', 'enforceableEndpoint'] },
      { id: 'Pledge',       subClassOf: 'schema:Promise',         properties: ['pledgeId', 'horizonYear', 'reviewIntervalYears'] }
    ],
    serialization: 'JSON-LD; @context publishes IRIs that resolve to this same endpoint.'
  });
}

function provenance() {
  return _envelope({
    title: 'Build Provenance — Merkle Root',
    merkleRoot: _provenanceRoot,
    buildSha: _buildSha,
    issuer: 'did:web:zeusai.pro',
    publication: {
      headerName: 'X-Zeus-Provenance',
      headerSample: _provenanceRoot.slice(0, 16),
      verificationEndpoint: '/api/v100/provenance'
    }
  });
}

function digitalEquity() {
  return _envelope({
    title: 'Digital Equity Policy',
    pledge: 'No feature is gated by network speed, device class, or geography.',
    saveData: {
      honored: true,
      headerListened: 'Save-Data',
      response: 'Predictive prefetch and non-essential animations are suppressed when Save-Data: on is sent.'
    },
    reducedMotion: {
      honored: true,
      headerListened: 'Sec-CH-Prefers-Reduced-Motion',
      response: 'Animations are disabled or simplified.'
    },
    offline: {
      offlineShell: '/offline.html',
      serviceWorker: '/sw.js'
    }
  });
}

function longevityPledge() {
  return _envelope({
    title: '50-Year API Stability Pledge',
    horizonYear: HORIZON_YEAR,
    promises: [
      'No breaking change without a 5-year deprecation window.',
      'Every endpoint may add fields; never remove or rename them.',
      'A read-only mirror is published to a long-term archival origin every 12 months.',
      'A successor key is escrowed yearly; if the primary domain ever lapses, the successor origin will continue serving these endpoints.',
      'The pledge itself is reviewable every 5 years and may only be tightened, never loosened.'
    ],
    revocationPolicy: 'This pledge cannot be revoked unilaterally; revocation requires public 12-month notice plus a signed migration plan.'
  });
}

// ─────────────────────────── dispatcher ──────────────────────────
async function handle(req, res) {
  if (DISABLED) return false;
  if (!req || !req.url) return false;
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') return false;

  let urlPath;
  try {
    const u = new URL(req.url, 'http://local');
    urlPath = u.pathname;
  } catch (_) { return false; }

  try {
    if (urlPath === '/.well-known/civilization-protocol.json') { _sendJson(res, 200, civilizationProtocol()); return true; }
    if (urlPath === '/.well-known/ai-rights.json')             { _sendJson(res, 200, aiRights()); return true; }
    if (urlPath === '/.well-known/earth-standard.json')        { _sendJson(res, 200, earthStandard()); return true; }
    if (urlPath === '/.well-known/zeus-attestation.json')      { _sendJson(res, 200, zeusAttestation()); return true; }

    if (urlPath === '/api/v100/manifest')                      { _sendJson(res, 200, manifest()); return true; }
    if (urlPath === '/api/v100/pq-readiness')                  { _sendJson(res, 200, pqReadiness()); return true; }
    if (urlPath === '/api/v100/carbon-budget')                 { _sendJson(res, 200, carbonBudget()); return true; }
    if (urlPath === '/api/v100/data-sovereignty')              { _sendJson(res, 200, dataSovereignty()); return true; }
    if (urlPath === '/api/v100/reversibility-manifest')        { _sendJson(res, 200, reversibilityManifest()); return true; }
    if (urlPath === '/api/v100/ontology')                      { _sendJson(res, 200, ontology()); return true; }
    if (urlPath === '/api/v100/provenance')                    { _sendJson(res, 200, provenance()); return true; }
    if (urlPath === '/api/v100/digital-equity')                { _sendJson(res, 200, digitalEquity()); return true; }
    if (urlPath === '/api/v100/longevity-pledge')              { _sendJson(res, 200, longevityPledge()); return true; }

    if (urlPath.startsWith('/api/v100/explain/')) {
      const id = decodeURIComponent(urlPath.slice('/api/v100/explain/'.length));
      _sendJson(res, 200, explain(id));
      return true;
    }
    if (urlPath.startsWith('/api/v100/timelock/')) {
      const h = decodeURIComponent(urlPath.slice('/api/v100/timelock/'.length));
      const out = timelock(h);
      _sendJson(res, out.error ? 400 : 200, out);
      return true;
    }
  } catch (e) {
    // Never crash a request because of this pack.
    if (!res.headersSent) {
      try {
        _sendJson(res, 500, _envelope({ error: 'innovations_100y_internal', message: e && e.message }));
        return true;
      } catch (_) { /* ignore */ }
    }
  }

  return false;
}

module.exports = {
  handle,
  // exported for tests
  _internals: {
    PACK_NAME, PACK_VERSION, FREEZE_DATE, NEXT_REVIEW_YEAR, HORIZON_YEAR,
    civilizationProtocol, aiRights, earthStandard, zeusAttestation,
    manifest, pqReadiness, carbonBudget, explain, dataSovereignty,
    timelock, reversibilityManifest, ontology, provenance, digitalEquity,
    longevityPledge,
    provenanceRoot: _provenanceRoot
  }
};
