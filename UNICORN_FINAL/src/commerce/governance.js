// commerce/governance.js
// Aggregates policy + audit log into a snapshot. Separate JSONL for commerce-specific
// audit so it doesn't pollute the 50Y RFC-6962 audit chain.
//
// Exports:
//   recordAudit({kind, ...}) → entry
//   listAudit(opts?) → entries
//   snapshot() → { policy, audit, summary }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const LOG_FILE = path.join(DATA_DIR, 'governance-audit.jsonl');

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

const POLICY = {
  version: '2026.04',
  ownerEmail: process.env.OWNER_EMAIL || 'owner@zeusai.pro',
  jurisdiction: process.env.GOVERNANCE_JURISDICTION || 'EU',
  refundWindowDays: Number(process.env.GOVERNANCE_REFUND_DAYS || 14),
  enterpriseRequiresOtp: true,
  whaleThresholdUSD: Number(process.env.WHALE_USD_THRESHOLD || 100000),
  notes: [
    'All enterprise deals (>$50k) require governance OTP confirmation.',
    'BTC vault uses non-custodial direct-to-owner address.',
    'GDPR-ready: customer data never leaves the data/ directory by default.',
    'Audit log is append-only JSONL with hash-chain (see hash field).'
  ]
};

const _entries = [];
let _lastHash = '0'.repeat(64);

function _hydrate() {
  ensureDir();
  if (!fs.existsSync(LOG_FILE)) return;
  try {
    const text = fs.readFileSync(LOG_FILE, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim(); if (!t) continue;
      try {
        const e = JSON.parse(t);
        _entries.push(e);
        if (e.hash) _lastHash = e.hash;
      } catch (_) {}
    }
  } catch (e) { console.warn('[governance] hydrate failed:', e.message); }
}
_hydrate();

function recordAudit(payload) {
  ensureDir();
  const entry = {
    id: 'aud_' + crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(),
    kind: String((payload && payload.kind) || 'event'),
    payload: payload || {},
    prevHash: _lastHash
  };
  const h = crypto.createHash('sha256').update(JSON.stringify({ id: entry.id, ts: entry.ts, kind: entry.kind, payload: entry.payload, prevHash: entry.prevHash })).digest('hex');
  entry.hash = h;
  _lastHash = h;
  _entries.push(entry);
  try { fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n'); }
  catch (e) { console.warn('[governance] persist failed:', e.message); }
  return entry;
}

function listAudit(opts) {
  const limit = Math.max(1, Math.min(1000, Number((opts && opts.limit) || 100)));
  return _entries.slice(-limit);
}

function snapshot() {
  const recent = listAudit({ limit: 50 });
  const counts = {};
  for (const e of _entries) counts[e.kind] = (counts[e.kind] || 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    policy: POLICY,
    audit: {
      total: _entries.length,
      lastHash: _lastHash,
      kinds: counts,
      recent
    },
    summary: {
      auditEntries: _entries.length,
      policyVersion: POLICY.version,
      enterpriseOtp: POLICY.enterpriseRequiresOtp
    }
  };
}

function _resetForTests() {
  _entries.length = 0;
  _lastHash = '0'.repeat(64);
  try { fs.rmSync(LOG_FILE, { force: true }); } catch (_) {}
}

module.exports = { recordAudit, listAudit, snapshot, _resetForTests, POLICY };
