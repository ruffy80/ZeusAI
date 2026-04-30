/**
 * improvements-pack.test.js — strict additive verification.
 *
 * Asserts that:
 *   1. The new module surface (snapshot-cache, rate-limit-ip, tenant-key-rotation,
 *      webhook-idempotency, funnel-tracker, revenue-dashboard, internal-health,
 *      csp-report) is loadable and its public functions behave as documented.
 *   2. The raw-http dispatcher serves the new endpoints when wired into the
 *      live src/index.js server, AND existing endpoints (/health, /snapshot)
 *      still respond with the same shape (no regressions).
 *   3. The audit log rotation produces an archive file + anchor, and the
 *      live chain stitches via prev_hash.
 *
 * Strictly additive: never mutates production data dirs. All file paths are
 * redirected to os.tmpdir() via env vars before the modules are required.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Redirect every persistent file BEFORE requiring modules.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'improvements-pack-'));
process.env.AUDIT_50Y_LOG = path.join(tmpRoot, 'audit.log.jsonl');
process.env.WEBHOOK_SEEN_FILE = path.join(tmpRoot, 'webhook-seen.jsonl');
process.env.FUNNEL_FILE = path.join(tmpRoot, 'funnel-events.jsonl');
process.env.CSP_REPORT_FILE = path.join(tmpRoot, 'csp-violations.jsonl');
process.env.SNAPSHOT_CACHE_TTL_MS = '500';
process.env.AUDIT_50Y_TOKEN = 'test-token-' + process.pid;
// Ensure pack is enabled.
delete process.env.IMPROVEMENTS_PACK_DISABLED;

const pack = require('../backend/modules/improvements-pack');
const innov50 = require('../backend/modules/innovations-50y');

async function run() {
  // ── 1. snapshot-cache TTL behavior ────────────────────────────────────
  {
    let calls = 0;
    const cache = pack.snapshotCache.createSnapshotCache(() => ({ calls: ++calls, ts: Date.now() }), { ttlMs: 200 });
    const a = await cache.get();
    const b = await cache.get();
    assert.strictEqual(a.calls, 1);
    assert.strictEqual(b.calls, 1, 'second hit within TTL must reuse cache');
    await new Promise(r => setTimeout(r, 250));
    const c = await cache.get();
    assert.strictEqual(c.calls, 2, 'after TTL the value must be recomputed');
    cache.invalidate();
    const d = await cache.get();
    assert.strictEqual(d.calls, 3);
  }

  // ── 2. rate-limit-ip: 3rd request in window blocked ───────────────────
  {
    pack.ipLimit._resetForTests();
    const limiter = pack.ipLimit.buildIpLimiter({ name: 'test', limit: 2, windowMs: 1000 });
    const fakeReq = { headers: { 'x-forwarded-for': '10.0.0.1' }, socket: {} };
    const calls = [];
    function makeRes() {
      const r = { _status: 200, _body: null, _ended: false, _headers: {} };
      r.setHeader = (k, v) => { r._headers[k] = v; };
      r.writeHead = (s, h) => { r._status = s; if (h) Object.assign(r._headers, h); };
      r.end = (b) => { r._body = b; r._ended = true; };
      return r;
    }
    const next = () => calls.push('ok');
    const r1 = makeRes(); limiter(fakeReq, r1, next);
    const r2 = makeRes(); limiter(fakeReq, r2, next);
    const r3 = makeRes(); limiter(fakeReq, r3, next);
    assert.strictEqual(calls.length, 2, 'first 2 must pass');
    assert.strictEqual(r3._status, 429, '3rd must be blocked');
    assert.ok(r3._headers['Retry-After'] !== undefined);
  }

  // ── 3. tenant-key-rotation with grace period ──────────────────────────
  {
    pack.tenantKeyRotation._resetForTests();
    const created = [];
    const revoked = [];
    const fakeManager = {
      createTenantApiKey: (tenantId, label) => { const k = { id: 'k-' + Math.random().toString(36).slice(2, 8), tenantId, label, createdAt: new Date().toISOString() }; created.push(k); return k; },
      revokeTenantApiKey: (tenantId, keyId) => { revoked.push({ tenantId, keyId }); }
    };
    const out = pack.tenantKeyRotation.rotateTenantApiKey({
      tenantId: 't-1', oldKeyId: 'old-key-1', label: 'rotated', graceMs: 25, tenantManager: fakeManager
    });
    assert.ok(out.newKey && out.newKey.id, 'new key should be created');
    assert.strictEqual(out.oldKeyId, 'old-key-1');
    assert.ok(out.revokeAt, 'revokeAt set');
    await new Promise(r => setTimeout(r, 80));
    pack.tenantKeyRotation.runDueRevocations(fakeManager);
    assert.ok(revoked.find(r => r.keyId === 'old-key-1'), 'old key should be revoked after grace');
  }

  // ── 4. webhook idempotency ────────────────────────────────────────────
  {
    pack.webhookIdem._resetForTests();
    const a = pack.webhookIdem.seenWebhook('evt_aaa', { source: 'stripe' });
    const b = pack.webhookIdem.seenWebhook('evt_aaa', { source: 'stripe' });
    assert.strictEqual(a.seen, false);
    assert.strictEqual(b.seen, true, 'second call must report duplicate');
  }

  // ── 5. funnel + revenue dashboard ─────────────────────────────────────
  {
    pack.funnel.track('view',           { productId: 'p1', sessionId: 's1' });
    pack.funnel.track('click',          { productId: 'p1', sessionId: 's1' });
    pack.funnel.track('checkout_init',  { productId: 'p1', sessionId: 's1' });
    pack.funnel.track('paid',           { productId: 'p1', sessionId: 's1', amountUsd: 49.99, tenantId: 'default' });
    const sum = pack.funnel.summary();
    assert.strictEqual(sum.counts.view, 1);
    assert.strictEqual(sum.counts.paid, 1);
    assert.ok(sum.conversion.checkout_init_to_checkout_confirm !== undefined);

    const rev = pack.revenue.buildSummary();
    assert.ok(rev.totals.count >= 1);
    assert.ok(rev.byProduct.find(p => p.productId === 'p1'));
    const csv = pack.revenue.toCsv(rev);
    assert.ok(csv.startsWith('section,key,count,'));
    assert.ok(csv.includes('product,p1,'));
  }

  // ── 6. internal health aggregate (no exception, returns object) ───────
  {
    const h = pack.internalHealth.buildHealth();
    assert.strictEqual(h.ok, true);
    assert.ok(h.pillars && h.pillars.innov50y, 'innov50y pillar present');
    assert.ok(typeof h.uptimeSeconds === 'number');
  }

  // ── 7. audit log rotation (#3) ────────────────────────────────────────
  {
    innov50.audit._resetForTests();
    innov50.audit.append({ actor: 'test', action: 'pre-rotate-1' });
    innov50.audit.append({ actor: 'test', action: 'pre-rotate-2' });
    const beforeRoot = innov50.audit.root();
    assert.strictEqual(beforeRoot.treeSize, 2);
    const r = innov50.audit.rotate({ signWith: (rootHex) => ({ signature: 'sig-' + rootHex.slice(0, 8), alg: 'ed25519' }) });
    assert.strictEqual(r.archived, true, 'rotation must archive');
    assert.ok(r.file && fs.existsSync(r.file), 'archive file must exist');
    assert.strictEqual(r.treeSize, 2);
    // After rotation the live log should be empty.
    const afterRoot = innov50.audit.root();
    assert.strictEqual(afterRoot.treeSize, 0);
    // Next append must stitch via prev_hash = archived lastHash.
    const stitched = innov50.audit.append({ actor: 'test', action: 'post-rotate' });
    assert.strictEqual(stitched.prev_hash, beforeRoot.lastHash, 'chain must stitch across rotation');
    const anchors = innov50.audit.loadAnchors();
    assert.ok(anchors.length >= 1, 'anchor recorded');
    assert.ok(anchors[anchors.length - 1].signature, 'anchor signed');
  }

  // ── 8. HTTP integration: existing endpoints + new endpoints ───────────
  {
    const { createServer } = require('../src/index');
    const server = createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const base = 'http://127.0.0.1:' + port;

    // Sanity: existing endpoints still respond as before.
    const h = await fetch(base + '/health');
    assert.strictEqual(h.status, 200);
    const hb = await h.json();
    assert.strictEqual(hb.ok, true, '/health shape preserved');

    const snap = await fetch(base + '/snapshot');
    assert.strictEqual(snap.status, 200);
    const sb = await snap.json();
    assert.ok(Array.isArray(sb.modules), '/snapshot shape preserved');

    // New: aggregated internal health
    const ih = await fetch(base + '/internal/health/aggregate');
    assert.strictEqual(ih.status, 200);
    const ihb = await ih.json();
    assert.strictEqual(ihb.ok, true);
    assert.ok(ihb.pillars && ihb.pillars.innov50y);

    // New: funnel summary + track
    const fs1 = await fetch(base + '/api/funnel/summary');
    assert.strictEqual(fs1.status, 200);
    const ft = await fetch(base + '/api/funnel/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'view', productId: 'http-test' }) });
    assert.strictEqual(ft.status, 200);

    // New: CSP report endpoint
    const csp = await fetch(base + '/api/csp-report', { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: JSON.stringify({ 'csp-report': { 'document-uri': 'https://zeusai.pro' } }) });
    assert.strictEqual(csp.status, 204);

    // New: owner revenue without token → 401
    const rev1 = await fetch(base + '/api/owner/revenue');
    assert.strictEqual(rev1.status, 401);
    // With token → 200
    const rev2 = await fetch(base + '/api/owner/revenue', { headers: { 'X-Owner-Token': process.env.AUDIT_50Y_TOKEN } });
    assert.strictEqual(rev2.status, 200);
    const revBody = await rev2.json();
    assert.ok(revBody.totals && typeof revBody.totals.count === 'number');

    // New: 50Y rotate route exists and is token-gated
    const rot1 = await fetch(base + '/api/v50/audit/rotate', { method: 'POST' });
    assert.strictEqual(rot1.status, 401);

    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }

  console.log('✅ improvements-pack.test.js passed');
  process.exit(0);
}

run().catch((err) => { console.error('test failed:', err && err.message ? err.message : err); process.exit(1); });
