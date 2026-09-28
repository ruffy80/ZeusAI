'use strict';

/**
 * SAOS/1.0 — Safe Apply OS
 * Consumes shipped innovation specs and writes data/docs artifacts only.
 * Canary + rollback on the artifact, never on PM2. Source patches are
 * proposals under data/patches/ and are never applied.
 *
 * Kill-switch: SAFE_APPLY=0 (SECOS still generates/ships).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'SAOS/1.0';
const NAME = 'safe-apply-os';
const SAFE_PREFIXES = [/^data\//i, /^docs\//i, /^catalog\//i, /^content\//i];
const UNSAFE_PREFIXES = [/^backend\//i, /^src\//i, /^scripts\//i, /^\.github\//i, /^UNICORN_FINAL\/backend\//i];

const state = {
  applied: 0,
  rolledBack: 0,
  skipped: 0,
  proposedPatches: 0,
  last: null,
  lastError: null,
  lastCanary: null,
};

const _receipts = [];
const _appliedHashes = new Set();

function enabled() {
  return String(process.env.SAFE_APPLY || '1') !== '0';
}

function repoRoot() {
  return process.env.SAFE_APPLY_ROOT
    || path.resolve(__dirname, '..', '..');
}

function shippedDir() {
  return process.env.INNOVATION_SHIPPED_DIR
    || path.join(repoRoot(), 'data', 'innovations', 'shipped');
}

function patchDir() {
  return process.env.SAFE_PATCH_DIR
    || path.join(repoRoot(), 'data', 'patches');
}

function changedPath() {
  return process.env.SAFE_CHANGED_PATH
    || path.join(repoRoot(), 'data', 'evolution', 'changed.jsonl');
}

function seenPath() {
  return process.env.SAFE_APPLY_SEEN
    || path.join(repoRoot(), 'data', 'evolution', 'applied-hashes.json');
}

function loadSeen() {
  try {
    const raw = JSON.parse(fs.readFileSync(seenPath(), 'utf8'));
    if (Array.isArray(raw)) raw.forEach((h) => _appliedHashes.add(String(h)));
  } catch (_) { /* first run */ }
}

function persistSeen() {
  try {
    fs.mkdirSync(path.dirname(seenPath()), { recursive: true });
    fs.writeFileSync(seenPath(), JSON.stringify([..._appliedHashes].slice(-400)));
  } catch (_) { /* fail-soft */ }
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text == null ? '' : text)).digest('hex');
}

function isSafeRel(rel) {
  const target = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!target || target.includes('..')) return { ok: false, reason: 'bad_path', target };
  if (UNSAFE_PREFIXES.some((p) => p.test(target))) return { ok: false, reason: 'unsafe_prefix', target };
  if (!SAFE_PREFIXES.some((p) => p.test(target))) return { ok: false, reason: 'outside_safe_scope', target };
  return { ok: true, target };
}

function absOf(rel) {
  return path.join(repoRoot(), rel);
}

function snapshotFile(rel) {
  const abs = absOf(rel);
  try {
    if (!fs.existsSync(abs)) return { rel, existed: false, content: null, hash: null };
    const content = fs.readFileSync(abs, 'utf8');
    return { rel, existed: true, content, hash: sha256(content) };
  } catch (e) {
    return { rel, existed: false, content: null, hash: null, error: e && e.message };
  }
}

function restoreSnap(snap) {
  const abs = absOf(snap.rel);
  try {
    if (!snap.existed) {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
      return;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, snap.content);
  } catch (_) { /* fail-soft */ }
}

function writeRel(rel, body) {
  const abs = absOf(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  fs.writeFileSync(abs, text.endsWith('\n') ? text : text + '\n');
  return { abs, hash: sha256(text), bytes: Buffer.byteLength(text) };
}

function buildDocument(spec, rel) {
  if (spec && spec.document != null) {
    if (typeof spec.document === 'string') return spec.document;
    return spec.document;
  }
  const title = String((spec && spec.title) || 'Safe evolution artifact');
  const desc = String((spec && spec.description) || '');
  const ideaId = (spec && (spec.ideaId || spec.id)) || 'unknown';
  if (/\.md$/i.test(rel)) {
    return [
      '# ' + title,
      '',
      desc,
      '',
      '## Acceptance',
      '- ' + ((spec && spec.acceptanceTest) || 'File exists, is non-empty, inventsGmv=false.'),
      '',
      '## Honesty',
      '- inventsGmv: false',
      '- mutatesSource: false',
      '- ideaId: `' + ideaId + '`',
      '',
    ].join('\n');
  }
  return {
    protocol: PROTOCOL,
    id: ideaId,
    title,
    description: desc,
    defectKind: (spec && spec.defectKind) || null,
    field: (spec && spec.field) || null,
    acceptanceTest: (spec && spec.acceptanceTest) || 'json_valid_and_honest',
    inventsGmv: false,
    inventsSku: false,
    mutatesSource: false,
    notBuyable: /next-offer|overlay|notes/i.test(rel),
    approvedAt: (spec && spec.approvedAt) || new Date().toISOString(),
    contentHash: (spec && spec.contentHash) || null,
  };
}

function canary(opts = {}) {
  const reasons = [];
  let publicCount = null;
  let buyable = null;
  const paths = [].concat(opts.paths || []).map(String);
  const catalogSensitive = !paths.length || paths.some((p) =>
    /(^|\/)(data\/)?catalog\//i.test(p) || /sku-notes|next-offer/i.test(p)
  );
  try {
    const unified = require('../../src/commerce/unified-catalog');
    const filter = require('../../src/commerce/public-catalog-filter');
    const all = typeof unified.all === 'function' ? unified.all() : [];
    const pub = filter && typeof filter.filterPublicCatalogItems === 'function'
      ? filter.filterPublicCatalogItems(all)
      : all;
    publicCount = Array.isArray(pub) ? pub.length : 0;
    if (publicCount < 1 && catalogSensitive) reasons.push('public_catalog_empty');
  } catch (_) {
    publicCount = null;
  }
  try {
    const buy = require('../../src/commerce/commerce-buyability');
    const probe = typeof buy.assessBuyability === 'function'
      ? buy.assessBuyability('starter')
      : null;
    if (probe && (probe.mode === 'unavailable' || probe.buyable === false)) {
      reasons.push('starter_unavailable');
      buyable = false;
    } else {
      buyable = true;
    }
  } catch (_) {
    buyable = null;
  }
  try {
    const qis = require('./quantumIntegrityShield');
    if (qis && typeof qis.getStatus === 'function') {
      const st = qis.getStatus();
      const integrity = String((st && (st.integrity || st.status || st.health)) || '').toLowerCase();
      if (integrity === 'critical' || integrity === 'fail' || integrity === 'unhealthy') {
        reasons.push('qis_' + integrity);
      }
    }
  } catch (_) { /* optional */ }
  const out = { ok: reasons.length === 0, reasons, publicCount, buyable, at: new Date().toISOString() };
  state.lastCanary = out;
  return out;
}

function recordReceipt(row) {
  _receipts.push(row);
  if (_receipts.length > 200) _receipts.shift();
  try {
    fs.mkdirSync(path.dirname(changedPath()), { recursive: true });
    fs.appendFileSync(changedPath(), JSON.stringify(row) + '\n');
  } catch (_) { /* fail-soft */ }
}

function proposePatch(spec) {
  const id = String((spec && spec.id) || 'patch-' + Date.now());
  const rel = 'data/patches/' + id.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) + '.json';
  const body = {
    protocol: PROTOCOL,
    kind: 'source_patch_proposal',
    applied: false,
    mutatesSource: false,
    inventsGmv: false,
    id,
    title: spec && spec.title,
    description: spec && spec.description,
    targetPaths: spec && spec.targetPaths,
    reason: (spec && spec.safety) || 'describes_source_mutation',
    proposedAt: new Date().toISOString(),
    note: 'Review-only. DISABLE_SELF_MUTATION=1 — never auto-applied.',
  };
  try {
    fs.mkdirSync(patchDir(), { recursive: true });
    writeRel(rel, body);
    state.proposedPatches += 1;
    recordReceipt({
      protocol: PROTOCOL,
      at: body.proposedAt,
      type: 'patch_proposed',
      path: rel,
      reason: body.reason,
      inventsGmv: false,
      mutatesSource: false,
    });
    return { ok: true, proposed: true, path: rel };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

function applySpec(spec, opts = {}) {
  if (!enabled() && !(opts && opts.force)) {
    state.skipped += 1;
    return { ok: false, reason: 'SAFE_APPLY=0' };
  }
  const paths = [].concat((spec && spec.targetPaths) || []).map(String).filter(Boolean);
  if (!paths.length) {
    state.skipped += 1;
    return { ok: false, reason: 'no_target_paths' };
  }

  const unsafe = paths.map(isSafeRel).filter((p) => !p.ok);
  if (unsafe.length) {
    const proposed = proposePatch(Object.assign({}, spec, { safety: unsafe[0].reason }));
    state.skipped += 1;
    return { ok: true, applied: false, patched: !!proposed.proposed, reason: unsafe[0].reason };
  }

  const contentHash = String((spec && spec.contentHash) || sha256(JSON.stringify({
    title: spec && spec.title, paths, document: spec && spec.document,
  })));
  if (_appliedHashes.has(contentHash) && !(opts && opts.force)) {
    state.skipped += 1;
    recordReceipt({
      protocol: PROTOCOL,
      at: new Date().toISOString(),
      type: 'skipped',
      reason: 'dedup_content_hash',
      contentHash,
      inventsGmv: false,
      mutatesSource: false,
    });
    return { ok: true, applied: false, reason: 'dedup_content_hash', contentHash };
  }

  const snaps = paths.map(snapshotFile);
  const writes = [];
  try {
    for (const rel of paths) {
      const safe = isSafeRel(rel);
      const doc = buildDocument(spec, safe.target);
      const wrote = writeRel(safe.target, doc);
      writes.push({
        path: safe.target,
        beforeHash: (snaps.find((s) => s.rel === rel) || {}).hash || null,
        afterHash: wrote.hash,
        bytes: wrote.bytes,
      });
    }
    const gate = canary({ paths });
    if (!gate.ok) {
      snaps.forEach(restoreSnap);
      state.rolledBack += 1;
      recordReceipt({
        protocol: PROTOCOL,
        at: new Date().toISOString(),
        type: 'rolled_back',
        reason: (gate.reasons || []).join(',') || 'canary_failed',
        paths,
        inventsGmv: false,
        mutatesSource: false,
      });
      return { ok: false, applied: false, rolledBack: true, canary: gate };
    }
    _appliedHashes.add(contentHash);
    persistSeen();
    state.applied += 1;
    try {
      const inn = require('./unicornInnovator');
      if (inn && typeof inn.markApplied === 'function') inn.markApplied(contentHash);
    } catch (_) { /* optional */ }
    const at = new Date().toISOString();
    const receipt = {
      protocol: PROTOCOL,
      at,
      type: 'applied',
      id: spec && spec.id,
      title: spec && spec.title,
      defectKind: spec && spec.defectKind,
      paths: writes,
      contentHash,
      inventsGmv: false,
      mutatesSource: false,
      expiresAt: spec && spec.expiresAt || null,
    };
    recordReceipt(receipt);
    state.last = receipt;
    return { ok: true, applied: true, writes, canary: gate, contentHash };
  } catch (e) {
    snaps.forEach(restoreSnap);
    state.rolledBack += 1;
    state.lastError = e && e.message;
    return { ok: false, applied: false, rolledBack: true, error: e && e.message };
  }
}

function specsFromShip(ship) {
  const decisions = (ship && Array.isArray(ship.decisions)) ? ship.decisions : [];
  const out = [];
  for (const dec of decisions) {
    if (!dec) continue;
    if (dec.decision === 'approved' && dec.artifactPath) {
      try {
        out.push(JSON.parse(fs.readFileSync(dec.artifactPath, 'utf8')));
      } catch (_) { /* skip unreadable */ }
    } else if (dec.decision === 'rejected' && /source|mutation|backend/i.test(String(dec.safety || ''))) {
      out.push({
        id: dec.id || ('reject-' + Date.now()),
        title: 'Source mutation held',
        description: String(dec.safety || ''),
        targetPaths: ['backend/modules/_held.js'],
        safety: dec.safety,
      });
    }
  }
  return out;
}

async function applyFromShip(ship, opts = {}) {
  if (!enabled() && !(opts && opts.force)) {
    return { ok: false, reason: 'SAFE_APPLY=0', protocol: PROTOCOL };
  }
  loadSeen();
  const specs = specsFromShip(ship);
  const results = [];
  for (const spec of specs) {
    results.push(applySpec(spec, opts));
  }
  return {
    ok: true,
    protocol: PROTOCOL,
    considered: specs.length,
    applied: results.filter((r) => r && r.applied).length,
    rolledBack: results.filter((r) => r && r.rolledBack).length,
    skipped: results.filter((r) => r && r.reason && !r.applied).length,
    results: results.slice(-20),
  };
}

function applyShippedDir(opts = {}) {
  loadSeen();
  const dir = shippedDir();
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).slice(-30);
  } catch (_) {
    return { ok: true, considered: 0, applied: 0, results: [] };
  }
  const results = [];
  for (const f of files) {
    try {
      const spec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      results.push(applySpec(spec, opts));
    } catch (e) {
      results.push({ ok: false, error: e && e.message, file: f });
    }
  }
  return { ok: true, considered: files.length, results };
}

function changedSince(ms) {
  const since = Date.now() - Math.max(60_000, Number(ms) || 3600_000);
  return _receipts.filter((r) => {
    const t = Date.parse(r && r.at);
    return Number.isFinite(t) && t >= since;
  }).slice(-40).reverse();
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    module: NAME,
    invention: 'Safe Apply Continuum',
    enabled: enabled(),
    applied: state.applied,
    rolledBack: state.rolledBack,
    skipped: state.skipped,
    proposedPatches: state.proposedPatches,
    last: state.last,
    lastError: state.lastError,
    lastCanary: state.lastCanary,
    mutatesSource: false,
    inventsGmv: false,
    changedThisHour: changedSince(3600_000),
    recent: _receipts.slice(-12).reverse(),
    pledge: [
      'Applies data/docs artifacts only',
      'Canary + rollback on the artifact, never PM2',
      'Source diffs land in data/patches/ as proposals',
      'Kill-switch SAFE_APPLY=0',
    ],
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  if (action === 'apply-ship') return applyFromShip(input.ship || input.payload);
  if (action === 'apply-dir') return applyShippedDir(input);
  if (action === 'canary') return { ok: true, canary: canary() };
  return { ok: true, action: 'status', status: getStatus() };
}

loadSeen();

module.exports = {
  PROTOCOL,
  NAME,
  name: NAME,
  enabled,
  applySpec,
  applyFromShip,
  applyShippedDir,
  proposePatch,
  canary,
  changedSince,
  getStatus,
  process: processInput,
  isSafeRel,
};
