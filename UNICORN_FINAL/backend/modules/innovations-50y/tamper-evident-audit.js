// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.366Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * tamper-evident-audit.js — Innovations 50Y · Pillar II
 *
 * Append-only, hash-chained audit log (Certificate-Transparency style).
 *
 * - Each line is a JSON object with `prev_hash` referencing SHA-256 of the
 *   previous canonical line. The first line bootstraps with `prev_hash` = 64×'0'.
 * - `append(event)` is atomic per-line (single fs.appendFileSync call writing
 *   one '\n'-terminated record).
 * - `proof(id)` returns a Merkle inclusion proof relative to the latest root
 *   computed in-memory over all hashes seen so far (RFC 6962-inspired).
 * - `root()` returns the current Merkle root + tree size (for daily anchoring
 *   on Bitcoin via OpenTimestamps; the actual OTS submission is left to an
 *   external job — this module just produces the digest and proofs).
 *
 * Pure additive: writes only to UNICORN_FINAL/data/audit.log.jsonl which is a
 * NEW file. Does not touch any existing log.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const LOG_FILE = process.env.AUDIT_50Y_LOG || path.join(DATA_DIR, 'audit.log.jsonl');

const ZERO_HASH = '0'.repeat(64);

let _cache = null; // { lines: [{id,prev_hash,line_hash,record}], lastHash }

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }); } catch (_) {}
}

function _sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function _canonicalize(obj) {
  // Deterministic JSON: keys sorted lexicographically, no whitespace.
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(_canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + _canonicalize(obj[k])).join(',') + '}';
}

function _readAll() {
  if (_cache) return _cache;
  _ensureDir();
  let text = '';
  try { text = fs.readFileSync(LOG_FILE, 'utf8'); } catch (_) { text = ''; }
  const out = [];
  let lastHash = ZERO_HASH;
  if (text) {
    const lines = text.split('\n').filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      try {
        const rec = JSON.parse(lines[i]);
        const lineHash = _sha256Hex(_canonicalize(rec));
        out.push({ id: i + 1, prev_hash: rec.prev_hash, line_hash: lineHash, record: rec });
        lastHash = lineHash;
      } catch (_) { /* skip corrupt line */ }
    }
  }
  _cache = { lines: out, lastHash };
  return _cache;
}

/**
 * Append a structured event to the chain.
 * @param {object} event arbitrary JSON-serializable payload
 * @returns {{id:number, prev_hash:string, line_hash:string}}
 */
function append(event) {
  const cache = _readAll();
  const ts = new Date().toISOString();
  const record = Object.assign({ ts }, event || {}, { prev_hash: cache.lastHash });
  const canon = _canonicalize(record);
  const lineHash = _sha256Hex(canon);
  fs.appendFileSync(LOG_FILE, canon + '\n', { encoding: 'utf8' });
  const id = cache.lines.length + 1;
  cache.lines.push({ id, prev_hash: cache.lastHash, line_hash: lineHash, record });
  cache.lastHash = lineHash;
  return { id, prev_hash: record.prev_hash, line_hash: lineHash, ts };
}

function _hashPair(a, b) {
  return _sha256Hex(Buffer.concat([Buffer.from('\x01'), Buffer.from(a, 'hex'), Buffer.from(b, 'hex')]));
}

/**
 * Compute Merkle root over current line_hash list (RFC-6962 style — leaves
 * are hashed with 0x00 prefix when feeding the tree).
 */
function _merkleRoot(hashes) {
  if (!hashes.length) return { root: ZERO_HASH, levels: [[]] };
  const leaves = hashes.map(h => _sha256Hex(Buffer.concat([Buffer.from('\x00'), Buffer.from(h, 'hex')])));
  const levels = [leaves];
  let cur = leaves;
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      if (i + 1 < cur.length) next.push(_hashPair(cur[i], cur[i + 1]));
      else next.push(cur[i]); // promote unpaired
    }
    levels.push(next);
    cur = next;
  }
  return { root: cur[0], levels };
}

function root() {
  const cache = _readAll();
  const hashes = cache.lines.map(l => l.line_hash);
  const { root: r } = _merkleRoot(hashes);
  return {
    root: r,
    treeSize: hashes.length,
    lastHash: cache.lastHash,
    algorithm: 'sha256/rfc6962-inspired',
    file: LOG_FILE,
    standardsRef: ['RFC-6962', 'NIST-FIPS-180-4']
  };
}

/**
 * Inclusion proof for the entry with the given 1-based id.
 */
function proof(id) {
  const cache = _readAll();
  const idx = Number(id) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx >= cache.lines.length) return null;
  const hashes = cache.lines.map(l => l.line_hash);
  const { root: r, levels } = _merkleRoot(hashes);
  const path = [];
  let cursor = idx;
  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const layer = levels[lvl];
    const isRight = cursor % 2 === 1;
    const sibIdx = isRight ? cursor - 1 : cursor + 1;
    if (sibIdx < layer.length) {
      path.push({ position: isRight ? 'left' : 'right', hash: layer[sibIdx] });
    }
    cursor = Math.floor(cursor / 2);
  }
  return {
    id: idx + 1,
    line_hash: cache.lines[idx].line_hash,
    prev_hash: cache.lines[idx].prev_hash,
    record: cache.lines[idx].record,
    merkle_root: r,
    tree_size: hashes.length,
    audit_path: path
  };
}

/**
 * Verify a proof object returned by `proof()` against a known merkle root.
 */
function verifyProof(p, expectedRoot) {
  if (!p || !p.line_hash || !Array.isArray(p.audit_path)) return false;
  let cursor = _sha256Hex(Buffer.concat([Buffer.from('\x00'), Buffer.from(p.line_hash, 'hex')]));
  for (const step of p.audit_path) {
    if (step.position === 'left') cursor = _hashPair(step.hash, cursor);
    else cursor = _hashPair(cursor, step.hash);
  }
  return cursor === (expectedRoot || p.merkle_root);
}

/**
 * Verify the integrity of the chain: every entry's prev_hash must equal
 * the previous entry's line_hash.
 */
function verifyChain() {
  const cache = _readAll();
  let prev = ZERO_HASH;
  for (const entry of cache.lines) {
    if (entry.prev_hash !== prev) {
      return { ok: false, brokenAt: entry.id, expectedPrev: prev, gotPrev: entry.prev_hash };
    }
    prev = entry.line_hash;
  }
  return { ok: true, length: cache.lines.length };
}

function listRecent(limit) {
  const cache = _readAll();
  const n = Math.max(1, Math.min(Number(limit) || 50, 1000));
  return cache.lines.slice(-n).map(l => ({
    id: l.id,
    line_hash: l.line_hash,
    prev_hash: l.prev_hash,
    record: l.record
  }));
}

function _resetForTests() { _cache = null; }

module.exports = {
  append,
  proof,
  verifyProof,
  verifyChain,
  root,
  listRecent,
  LOG_FILE,
  _resetForTests
};
