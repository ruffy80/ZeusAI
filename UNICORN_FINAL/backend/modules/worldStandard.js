'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const APP_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = process.env.WORLD_STANDARD_DATA_DIR || path.join(APP_DIR, 'data', 'world-standard');
const LEDGER = path.join(DATA_DIR, 'transparency-ledger.jsonl');
const VENDORS = path.join(DATA_DIR, 'vendor-modules.jsonl');
const BACKUP_DIR = process.env.UNICORN_BACKUP_DIR || path.join(APP_DIR, 'backups');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const sha256 = (input) => crypto.createHash('sha256').update(typeof input === 'string' ? input : JSON.stringify(input)).digest('hex');
const now = () => new Date().toISOString();

function readJsonl(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch (_) {
    return [];
  }
}

function appendJsonl(file, entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', { mode: 0o600 });
}

function appendLedger(type, payload = {}) {
  const previous = readJsonl(LEDGER).slice(-1)[0] || null;
  const entry = {
    id: 'led_' + crypto.randomBytes(8).toString('hex'),
    type,
    payloadHash: sha256(payload),
    payload,
    previousHash: previous ? previous.hash : null,
    createdAt: now(),
  };
  entry.hash = sha256({ id: entry.id, type: entry.type, payloadHash: entry.payloadHash, previousHash: entry.previousHash, createdAt: entry.createdAt });
  appendJsonl(LEDGER, entry);
  return entry;
}

function ledgerStatus(limit = 25) {
  const entries = readJsonl(LEDGER);
  return {
    ok: true,
    count: entries.length,
    head: entries.slice(-1)[0] || null,
    recent: entries.slice(-Math.max(1, Math.min(100, limit))).reverse(),
    anchors: {
      localHashChain: true,
      btcAnchor: 'ready-for-periodic-anchor',
      arweaveIpfs: process.env.ARWEAVE_GATEWAY || process.env.IPFS_GATEWAY ? 'configured' : 'optional-later',
    },
  };
}

function backupStatus() {
  const files = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((name) => /\.tgz$/.test(name)).sort() : [];
  const latest = files.length ? files[files.length - 1] : null;
  const latestPath = latest ? path.join(BACKUP_DIR, latest) : null;
  return {
    ok: true,
    backupDir: BACKUP_DIR,
    total: files.length,
    latest: latest && {
      name: latest,
      bytes: fs.statSync(latestPath).size,
      sha256: sha256(fs.readFileSync(latestPath)),
    },
    protects: ['data/', 'db/', 'runtime receipts', 'user sqlite database'],
    restoreDrill: 'manual-drill-ready',
  };
}

function createBackup(reason = 'manual') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(BACKUP_DIR, `unicorn-runtime-${stamp}.tgz`);
  const result = spawnSync('tar', ['-czf', out, '--exclude=*.key', '--exclude=*.pem', 'data', 'db'], { cwd: APP_DIR, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'backup_failed');
  const stat = fs.statSync(out);
  const proof = appendLedger('backup.created', { reason, file: path.basename(out), bytes: stat.size, sha256: sha256(fs.readFileSync(out)) });
  return { ok: true, file: path.basename(out), bytes: stat.size, proof };
}

const vendorPolicy = {
  ok: true,
  status: 'foundation-live',
  onboarding: ['identity verification', 'signed module manifest', 'security scan', 'quarantine execution', 'owner approval'],
  revenueShare: { defaultVendorPct: 70, platformPct: 30, settlement: 'BTC-direct-or-invoice' },
  moderation: ['malware scan', 'prompt-injection scan', 'license review', 'abuse report SLA', 'emergency revoke'],
  sandbox: ['no filesystem write outside sandbox', 'no network by default', 'capability-scoped API access'],
};

function submitVendorModule(body = {}) {
  const module = {
    id: 'vmod_' + crypto.randomBytes(8).toString('hex'),
    name: String(body.name || 'Untitled Module').slice(0, 120),
    vendor: String(body.vendor || 'unknown').slice(0, 120),
    manifestHash: sha256(body.manifest || body),
    status: 'quarantined-pending-review',
    submittedAt: now(),
  };
  appendJsonl(VENDORS, module);
  appendLedger('vendor.module.submitted', module);
  return { ok: true, module, policy: vendorPolicy };
}

function listVendorModules() {
  return { ok: true, policy: vendorPolicy, modules: readJsonl(VENDORS).slice(-50).reverse() };
}

function complianceAutopilot() {
  return {
    ok: true,
    status: 'foundation-live',
    jurisdictions: ['EU GDPR', 'EU AI Act readiness', 'UK GDPR', 'US privacy baseline', 'Romania/EU consumer law'],
    controls: ['data minimization', 'export/delete workflow', 'subprocessor registry', 'signed policy versions', 'incident ledger', 'human approval for high-risk automation'],
    missingForCertification: ['formal legal review', 'subprocessor DPAs', 'SOC2/ISO audit evidence collection', 'data residency map'],
    endpoints: ['/api/privacy/export', '/api/privacy/delete', '/api/transparency/ledger', '/dpa', '/responsible-ai'],
  };
}

function privacyExport(user) {
  return {
    ok: true,
    exportedAt: now(),
    user: user ? { id: user.id, email: user.email, name: user.name } : null,
    dataCategories: ['account', 'orders', 'receipts', 'licenses', 'api usage', 'support/security logs'],
    format: 'json-portable',
  };
}

function startupSeal(build = {}) {
  const existing = ledgerStatus(1).head;
  if (existing && existing.type === 'runtime.startup') return existing;
  return appendLedger('runtime.startup', build);
}

module.exports = {
  appendLedger,
  ledgerStatus,
  backupStatus,
  createBackup,
  vendorPolicy,
  submitVendorModule,
  listVendorModules,
  complianceAutopilot,
  privacyExport,
  startupSeal,
};