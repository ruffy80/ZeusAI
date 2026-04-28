// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.366Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * schema-registry.js — Innovations 50Y · Pillar I
 *
 * Loads JSON Schema (Draft 2020-12) documents from UNICORN_FINAL/schemas/ and
 * exposes a tiny dispatcher to:
 *   - return a header value `X-Schema-Version: <name>@<semver>`
 *   - list registered schemas
 *   - serve any schema by id
 *
 * Pure additive · no validation library required (schemas are documentation +
 * contract artefacts; future PRs may add ajv-based runtime checks under a
 * feature flag without breaking existing payloads).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', '..', '..', 'schemas');

let _cache = null;
function _load() {
  if (_cache) return _cache;
  const out = { schemas: {}, list: [] };
  try {
    if (fs.existsSync(SCHEMA_DIR) && fs.statSync(SCHEMA_DIR).isDirectory()) {
      for (const fname of fs.readdirSync(SCHEMA_DIR)) {
        if (!fname.endsWith('.schema.json')) continue;
        try {
          const doc = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, fname), 'utf8'));
          const id = doc.$id || fname.replace(/\.schema\.json$/, '');
          const version = doc['x-schema-version'] || '1.0.0';
          out.schemas[id] = doc;
          out.list.push({ id, version, file: fname, title: doc.title || id });
        } catch (_) { /* skip bad schema */ }
      }
    }
  } catch (_) {}
  out.list.sort((a, b) => a.id.localeCompare(b.id));
  _cache = out;
  return out;
}

function list() { return _load().list.slice(); }

function get(id) {
  const c = _load();
  return c.schemas[id] || null;
}

/**
 * Returns a stable header value identifying the schema bundle.
 * Format: "<count>schemas;<sha-prefix>" — clients can check it changed.
 */
function bundleHeader() {
  const c = _load();
  const summary = c.list.map(s => s.id + '@' + s.version).join('|');
  let h = 0;
  for (let i = 0; i < summary.length; i++) { h = ((h << 5) - h + summary.charCodeAt(i)) | 0; }
  const tag = (h >>> 0).toString(16).padStart(8, '0');
  return c.list.length + 'schemas;' + tag;
}

function status() {
  const c = _load();
  return {
    count: c.list.length,
    schemas: c.list,
    standardsRef: ['JSON-Schema-2020-12', 'IETF-RFC-8927-JCT-EQUIV'],
    dir: SCHEMA_DIR
  };
}

function _resetForTests() { _cache = null; }

module.exports = { list, get, bundleHeader, status, _resetForTests };
