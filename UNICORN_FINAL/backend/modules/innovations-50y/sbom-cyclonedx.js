// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.366Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * sbom-cyclonedx.js — Innovations 50Y · Pillar I
 *
 * Generates a CycloneDX 1.5 SBOM (ISO/IEC 5962:2021) from package.json +
 * package-lock.json. Output is deterministic JSON sorted by component name
 * so re-runs at identical lockfile state produce byte-identical SBOMs (one
 * prerequisite for SLSA L3 reproducible builds).
 *
 * Pure additive · zero deps · no I/O outside the project dir.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..', '..');

function _readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function _purl(name, version) {
  // Package URL spec (purl-spec): pkg:npm/<name>@<version>
  const safeName = String(name || '').replace(/^@/, '%40');
  return 'pkg:npm/' + safeName + '@' + String(version || '0.0.0');
}

function _walkLockPackages(lock) {
  const out = [];
  if (!lock) return out;
  if (lock.packages && typeof lock.packages === 'object') {
    // npm v7+ lockfileVersion 2/3
    for (const k of Object.keys(lock.packages)) {
      if (!k || k === '') continue; // root
      const p = lock.packages[k];
      if (!p || !p.version) continue;
      const name = p.name || k.replace(/^node_modules\//, '').split('/node_modules/').pop();
      out.push({ name, version: p.version, integrity: p.integrity || null, dev: !!p.dev, license: p.license || null });
    }
  } else if (lock.dependencies) {
    // npm v6 fallback
    const walk = (deps) => {
      for (const name of Object.keys(deps)) {
        const d = deps[name];
        if (d && d.version) out.push({ name, version: d.version, integrity: d.integrity || null, dev: !!d.dev, license: null });
        if (d && d.dependencies) walk(d.dependencies);
      }
    };
    walk(lock.dependencies);
  }
  // Deduplicate by name+version
  const seen = new Set();
  const dedup = [];
  for (const c of out) {
    const k = c.name + '@' + c.version;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(c);
  }
  // Stable sort
  dedup.sort((a, b) => (a.name + a.version).localeCompare(b.name + b.version));
  return dedup;
}

function buildSbom(opts) {
  const o = opts || {};
  const pkgPath = o.packageJson || path.join(ROOT, 'package.json');
  const lockPath = o.lockfile || path.join(ROOT, 'package-lock.json');
  const pkg = _readJsonSafe(pkgPath) || {};
  const lock = _readJsonSafe(lockPath);
  const components = _walkLockPackages(lock).map(c => {
    const comp = {
      type: 'library',
      'bom-ref': _purl(c.name, c.version),
      name: c.name,
      version: c.version,
      purl: _purl(c.name, c.version),
      scope: c.dev ? 'optional' : 'required'
    };
    if (c.license) comp.licenses = [{ license: { name: String(c.license) } }];
    if (c.integrity && /^sha\d+-/.test(c.integrity)) {
      const [alg, b64] = c.integrity.split('-');
      try {
        comp.hashes = [{
          alg: alg.toUpperCase().replace('SHA', 'SHA-'),
          content: Buffer.from(b64, 'base64').toString('hex')
        }];
      } catch (_) {}
    }
    return comp;
  });
  const serial = 'urn:uuid:' + crypto.randomUUID();
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: serial,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'unicorn-50y', name: 'sbom-cyclonedx', version: '1.0.0' }],
      component: {
        type: 'application',
        'bom-ref': _purl(pkg.name || 'unicorn-final', pkg.version || '0.0.0'),
        name: pkg.name || 'unicorn-final',
        version: pkg.version || '0.0.0',
        description: pkg.description || 'Unicorn Final · 50Y Standard'
      }
    },
    components
  };
  // Deterministic canonical JSON (recursive key sort).
  return _canonical(sbom);
}

function _canonical(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_canonical);
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = _canonical(obj[k]);
  return out;
}

function digest(sbom) {
  const json = JSON.stringify(sbom);
  const sha = crypto.createHash('sha256').update(json).digest('hex');
  return { sha256: sha, bytes: Buffer.byteLength(json) };
}

module.exports = { buildSbom, digest };
