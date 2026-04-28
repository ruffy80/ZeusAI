// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.365Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * manifest-merkle.js — Innovations 50Y · Pillar I (#2)
 *
 * Content-addressable manifest builder. Walks a set of artefact paths,
 * produces a deterministic SHA-256 leaf list, computes an RFC-6962 Merkle
 * root, and writes/reads `UNICORN_FINAL/.manifest/root.json` (atomic).
 *
 * Pure additive · no external deps · safe to call repeatedly.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..', '..');
const MANIFEST_DIR = path.join(ROOT, '.manifest');
const ROOT_FILE = path.join(MANIFEST_DIR, 'root.json');

const DEFAULT_TARGETS = [
  'package.json',
  'package-lock.json',
  'ecosystem.config.js',
  'src',
  'backend/modules/innovations-50y',
  'schemas'
];

const IGNORE = new Set(['node_modules', '.git', 'logs', '.archive', '.manifest']);

function _walk(absPath, base, out, maxDepth, depth) {
  if (depth > maxDepth) return;
  let stat;
  try { stat = fs.statSync(absPath); } catch (_) { return; }
  if (stat.isDirectory()) {
    const name = path.basename(absPath);
    if (IGNORE.has(name)) return;
    let entries = [];
    try { entries = fs.readdirSync(absPath); } catch (_) { return; }
    entries.sort();
    for (const e of entries) _walk(path.join(absPath, e), base, out, maxDepth, depth + 1);
  } else if (stat.isFile()) {
    out.push(path.relative(base, absPath));
  }
}

function _sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

function _hashPair(a, b) {
  return crypto.createHash('sha256')
    .update(Buffer.concat([Buffer.from('\x01'), Buffer.from(a, 'hex'), Buffer.from(b, 'hex')]))
    .digest('hex');
}

function _merkleRoot(leafHashes) {
  if (!leafHashes.length) return '0'.repeat(64);
  let cur = leafHashes.map(h => crypto.createHash('sha256')
    .update(Buffer.concat([Buffer.from('\x00'), Buffer.from(h, 'hex')])).digest('hex'));
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      if (i + 1 < cur.length) next.push(_hashPair(cur[i], cur[i + 1]));
      else next.push(cur[i]);
    }
    cur = next;
  }
  return cur[0];
}

function build(opts) {
  const o = opts || {};
  const targets = (o.targets && o.targets.length) ? o.targets : DEFAULT_TARGETS;
  const maxDepth = Number(o.maxDepth) || 6;
  const files = [];
  for (const t of targets) {
    const abs = path.join(ROOT, t);
    _walk(abs, ROOT, files, maxDepth, 0);
  }
  files.sort();
  const leaves = files.map(rel => {
    const abs = path.join(ROOT, rel);
    let sha; try { sha = _sha256File(abs); } catch (_) { sha = null; }
    return { path: rel, sha256: sha };
  }).filter(l => l.sha256);
  const root = _merkleRoot(leaves.map(l => l.sha256));
  return {
    bomFormat: 'unicorn-50y/manifest-merkle',
    specVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    algorithm: 'rfc6962-sha256',
    root,
    leafCount: leaves.length,
    leaves,
    standardsRef: ['NIST-FIPS-180-4', 'RFC-6962']
  };
}

function persist(manifest) {
  try { fs.mkdirSync(MANIFEST_DIR, { recursive: true }); } catch (_) {}
  const tmp = ROOT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmp, ROOT_FILE);
  return ROOT_FILE;
}

function readPersisted() {
  try { return JSON.parse(fs.readFileSync(ROOT_FILE, 'utf8')); } catch (_) { return null; }
}

function status() {
  const persisted = readPersisted();
  return {
    file: ROOT_FILE,
    persisted: !!persisted,
    root: persisted && persisted.root,
    leafCount: persisted && persisted.leafCount,
    generatedAt: persisted && persisted.generatedAt,
    standardsRef: ['NIST-FIPS-180-4', 'RFC-6962']
  };
}

module.exports = { build, persist, readPersisted, status, ROOT_FILE };
