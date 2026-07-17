'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'proof-of-delivery-ledger';
const ZERO_HASH = '0'.repeat(64);

const state = {
  recordsWritten: 0,
  lastEntryHash: ZERO_HASH,
  lastVerifiedAt: null,
  lastVerificationOk: null,
};

function ledgerPath() {
  return process.env.POD_LEDGER_PATH || path.resolve(__dirname, '..', '..', 'data', 'ledgers', 'proof-of-delivery.jsonl');
}

function ensureLedger() {
  const fullPath = ledgerPath();
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, '');
  return fullPath;
}

function stableSortObject(input) {
  if (Array.isArray(input)) return input.map(stableSortObject);
  if (!input || typeof input !== 'object') return input;
  return Object.keys(input).sort().reduce((acc, key) => {
    acc[key] = stableSortObject(input[key]);
    return acc;
  }, {});
}

function stableStringify(input) {
  return JSON.stringify(stableSortObject(input));
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function normalizeHash(value) {
  return sha256(String(value || '').trim().toLowerCase());
}

function merkleishRoot(hashes) {
  const leaves = (Array.isArray(hashes) ? hashes : []).map((hash) => sha256(String(hash).trim().toLowerCase()));
  if (leaves.length === 0) return sha256('empty-artifact-set');
  let layer = leaves.slice();
  while (layer.length > 1) {
    const next = [];
    for (let index = 0; index < layer.length; index += 2) {
      const left = layer[index];
      const right = layer[index + 1] || left;
      next.push(sha256(left + right));
    }
    layer = next;
  }
  return layer[0];
}

function readEntries() {
  const fullPath = ensureLedger();
  const body = fs.readFileSync(fullPath, 'utf8');
  if (!body.trim()) return [];
  return body.split('\n').filter(Boolean).map((line, lineIndex) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error('Invalid JSONL entry at line ' + (lineIndex + 1) + ': ' + error.message);
    }
  });
}

function normalizeBuyerHash(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  if (/^[0-9a-f]{64}$/.test(text)) return text;
  return text.includes('@') ? sha256(text) : normalizeHash(text);
}

function recordDelivery({ orderId, deliveryId, artifactHashes, buyerEmailHash }) {
  const safeOrderId = String(orderId || '').trim();
  const safeDeliveryId = String(deliveryId || '').trim();
  if (!safeOrderId) throw new Error('orderId required');
  if (!safeDeliveryId) throw new Error('deliveryId required');

  const normalizedArtifacts = Array.isArray(artifactHashes)
    ? artifactHashes.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean)
    : [];
  const entries = readEntries();
  const prevHash = entries.length ? String(entries[entries.length - 1].entryHash || ZERO_HASH) : ZERO_HASH;
  const entry = {
    seq: entries.length + 1,
    orderId: safeOrderId,
    deliveryId: safeDeliveryId,
    artifactHashes: normalizedArtifacts,
    artifactsRoot: merkleishRoot(normalizedArtifacts),
    buyerEmailHash: normalizeBuyerHash(buyerEmailHash),
    recordedAt: new Date().toISOString(),
    prevHash,
  };
  entry.entryHash = sha256(stableStringify({
    seq: entry.seq,
    orderId: entry.orderId,
    deliveryId: entry.deliveryId,
    artifactHashes: entry.artifactHashes,
    artifactsRoot: entry.artifactsRoot,
    buyerEmailHash: entry.buyerEmailHash,
    recordedAt: entry.recordedAt,
    prevHash: entry.prevHash,
  }));

  fs.appendFileSync(ensureLedger(), JSON.stringify(entry) + '\n');
  state.recordsWritten += 1;
  state.lastEntryHash = entry.entryHash;
  return entry;
}

function list(limit = 20) {
  const max = Math.max(0, Number(limit || 0));
  const entries = readEntries();
  const sliced = max > 0 ? entries.slice(-max) : entries;
  return sliced.reverse();
}

function verifyChain() {
  const entries = readEntries();
  let previous = ZERO_HASH;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (String(entry.prevHash || ZERO_HASH) !== previous) {
      state.lastVerifiedAt = new Date().toISOString();
      state.lastVerificationOk = false;
      return {
        ok: false,
        count: entries.length,
        brokenAt: index + 1,
        reason: 'prev_hash_mismatch',
        expectedPrevHash: previous,
        actualPrevHash: entry.prevHash,
      };
    }
    const expectedRoot = merkleishRoot(entry.artifactHashes);
    if (entry.artifactsRoot !== expectedRoot) {
      state.lastVerifiedAt = new Date().toISOString();
      state.lastVerificationOk = false;
      return {
        ok: false,
        count: entries.length,
        brokenAt: index + 1,
        reason: 'artifacts_root_mismatch',
        expectedArtifactsRoot: expectedRoot,
        actualArtifactsRoot: entry.artifactsRoot,
      };
    }
    const expectedHash = sha256(stableStringify({
      seq: entry.seq,
      orderId: entry.orderId,
      deliveryId: entry.deliveryId,
      artifactHashes: entry.artifactHashes,
      artifactsRoot: entry.artifactsRoot,
      buyerEmailHash: entry.buyerEmailHash,
      recordedAt: entry.recordedAt,
      prevHash: entry.prevHash,
    }));
    if (entry.entryHash !== expectedHash) {
      state.lastVerifiedAt = new Date().toISOString();
      state.lastVerificationOk = false;
      return {
        ok: false,
        count: entries.length,
        brokenAt: index + 1,
        reason: 'entry_hash_mismatch',
        expectedEntryHash: expectedHash,
        actualEntryHash: entry.entryHash,
      };
    }
    previous = entry.entryHash;
  }
  state.lastVerifiedAt = new Date().toISOString();
  state.lastVerificationOk = true;
  state.lastEntryHash = previous;
  return { ok: true, count: entries.length, lastEntryHash: previous };
}

function getStatus() {
  const entries = readEntries();
  return {
    module: NAME,
    ledgerPath: ledgerPath(),
    entries: entries.length,
    recordsWritten: state.recordsWritten,
    lastEntryHash: entries.length ? entries[entries.length - 1].entryHash : state.lastEntryHash,
    lastVerifiedAt: state.lastVerifiedAt,
    lastVerificationOk: state.lastVerificationOk,
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : input;
  if (action === 'record') return { ok: true, action, entry: recordDelivery(payload) };
  if (action === 'list') return { ok: true, action, entries: list(payload.limit || input.limit || 20) };
  if (action === 'verify') return { action, ...verifyChain() };
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  state.recordsWritten = 0;
  state.lastEntryHash = ZERO_HASH;
  state.lastVerifiedAt = null;
  state.lastVerificationOk = null;
  try { fs.unlinkSync(ledgerPath()); } catch (_) {}
}

module.exports = {
  name: NAME,
  recordDelivery,
  list,
  verifyChain,
  getStatus,
  process: processInput,
  _resetForTests,
};
