'use strict';

// Platform Foundation OS pack — focused regression tests.
// Covers: platform-foundation getStatus shape/score, selfConstruction hard
// mutator gate, sovereign-commerce createOrder validation + funnel counters,
// and static invariants in backend/index.js (timing-safe /deploy webhook,
// redacted public health, admin-gated /api/health/full, no-store health).

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Isolate commerce data dir so requiring the module never dirties repo data/.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfos-'));
process.env.COMMERCE_DATA_DIR = tmpDir;

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('  ✔', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e && e.stack || e); process.exit(1); }
}
async function checkAsync(name, fn) {
  try { await fn(); console.log('  ✔', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e && e.stack || e); process.exit(1); }
}

console.log('platform-foundation-os tests');

// ─── 1) platform-foundation module ─────────────────────────────────────────
const platform = require('../backend/modules/platform-foundation');

check('platform-foundation exports getStatus', () => {
  assert.strictEqual(typeof platform.getStatus, 'function');
});

check('getStatus returns the PFOS/1.0 shape', () => {
  const s = platform.getStatus();
  assert.strictEqual(s.ok, true);
  assert.strictEqual(s.protocol, 'PFOS/1.0');
  assert.strictEqual(s.name, 'platform-foundation-os');
  assert.ok(Array.isArray(s.pillars) && s.pillars.length >= 6, 'expected >=6 pillars');
  assert.ok(typeof s.score === 'number' && s.score >= 0 && s.score <= 100, 'score 0..100');
  assert.ok(typeof s.grade === 'string' && s.grade.length >= 1, 'grade present');
  assert.ok(typeof s.ts === 'string', 'ts present');
  for (const p of s.pillars) {
    assert.ok(typeof p.id === 'string' && p.id, 'pillar id');
    assert.strictEqual(typeof p.ok, 'boolean', 'pillar ok boolean');
    assert.ok(typeof p.detail === 'string' && p.detail, 'pillar detail');
  }
  const ids = s.pillars.map((p) => p.id);
  for (const req of ['mutator_safety', 'health_hygiene', 'commerce_validation',
    'funnel_visibility', 'timing_safe_deploy_webhook', 'runtime_stable']) {
    assert.ok(ids.includes(req), 'missing pillar ' + req);
  }
});

check('mutator_safety pillar is ok when DISABLE_SELF_MUTATION=1', () => {
  const s = platform.getStatus();
  const p = s.pillars.find((x) => x.id === 'mutator_safety');
  assert.strictEqual(p.ok, true);
  // With every pillar honest in a stable test env the score should be high.
  assert.ok(s.score >= 80, 'expected score >= 80 in safe test env, got ' + s.score);
});

// ─── 2) selfConstruction hard mutator gate ─────────────────────────────────
const selfConstruction = require('../backend/modules/selfConstruction');

run();
async function run() {
  await checkAsync('selfConstruction.start refuses when DISABLE_SELF_MUTATION=1', async () => {
    process.env.DISABLE_SELF_MUTATION = '1';
    const r = await selfConstruction.start({ apply: true });
    assert.strictEqual(r.applied, false);
    assert.strictEqual(r.refused, true);
    assert.strictEqual(r.reason, 'DISABLE_SELF_MUTATION=1');
  });

  await checkAsync('selfConstruction.start refuses when ENABLE_FILE_MUTATORS unset', async () => {
    const prev = process.env.DISABLE_SELF_MUTATION;
    delete process.env.DISABLE_SELF_MUTATION;
    delete process.env.ENABLE_FILE_MUTATORS;
    try {
      const r = await selfConstruction.start({ apply: true });
      assert.strictEqual(r.applied, false);
      assert.strictEqual(r.refused, true);
      assert.strictEqual(r.reason, 'ENABLE_FILE_MUTATORS not set');
    } finally {
      process.env.DISABLE_SELF_MUTATION = prev;
    }
  });

  // ─── 3) sovereign-commerce createOrder validation + funnel ───────────────
  const commerce = require('../src/site/sovereign-commerce');

  await checkAsync('createOrder rejects invalid email', async () => {
    const out = await commerce.createOrder({}, { serviceId: 'x', email: 'not-an-email' });
    assert.strictEqual(out.error, 'invalid_email');
    assert.strictEqual(out.status, 400);
  });

  await checkAsync('createOrder sanitizes serviceId to empty → serviceId_required', async () => {
    const out = await commerce.createOrder({}, { serviceId: '  !!!@@@  ' });
    assert.strictEqual(out.error, 'serviceId_required');
    assert.strictEqual(out.status, 400);
  });

  await checkAsync('createOrder increments checkout_create funnel counter', async () => {
    const before = await funnelCounts(commerce);
    const ctx = {
      buildSnapshot: () => ({
        marketplace: [],
        services: [{ id: 'pfos-sku', name: 'PFOS SKU', title: 'PFOS SKU', price: 42 }],
      }),
    };
    const created = await commerce.createOrder(ctx, {
      serviceId: 'pfos-sku', qty: 1, currency: 'USD', email: 'pfos@example.com',
    });
    assert.ok(created && created.order, 'expected a created order: ' + JSON.stringify(created && created.error));
    const after = await funnelCounts(commerce);
    assert.strictEqual(after.create, before.create + 1, 'create counter should increment by 1');
  });

  await checkAsync('/api/commerce/funnel route returns ok + counters', async () => {
    const j = await funnelCounts(commerce);
    assert.strictEqual(j.ok, true);
    assert.strictEqual(typeof j.create, 'number');
    assert.strictEqual(typeof j.open, 'number');
    assert.strictEqual(typeof j.paid, 'number');
    assert.ok(typeof j.ts === 'string');
  });

  // ─── 4/5) static invariants in backend/index.js ──────────────────────────
  check('backend/index.js has timing-safe /deploy webhook', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
    const deployIdx = src.indexOf("app.post('/deploy'");
    assert.ok(deployIdx > 0, "/deploy route present");
    const region = src.slice(deployIdx, deployIdx + 800);
    assert.ok(region.includes('timingSafeEqual'), 'timingSafeEqual near /deploy handler');
    assert.ok(!region.includes('incomingSecret !== expectedSecret'), 'plain string compare removed');
  });

  check('backend/index.js exposes buildPublicHealthResponse + /api/health/full', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
    assert.ok(src.includes('function buildPublicHealthResponse'), 'buildPublicHealthResponse present');
    assert.ok(src.includes("'/api/health/full'"), '/api/health/full route present');
    assert.ok(src.includes('/api/platform/foundation'), 'platform foundation route present');
  });

  check('public health handlers set Cache-Control no-store', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
    assert.ok(src.includes("app.get('/health'"), "app.get('/health' registration present");
    assert.ok(src.includes("app.get('/api/health'"), "app.get('/api/health' registration present");
    const hIdx = src.indexOf('function _publicHealthHandler');
    assert.ok(hIdx > 0, '_publicHealthHandler present');
    const region = src.slice(hIdx, hIdx + 350);
    assert.ok(/no-store/.test(region), 'no-store on health handler');
    assert.ok(region.includes('buildPublicHealthResponse'), 'health handler uses redacted builder');
  });

  console.log('platform-foundation-os: ' + passed + ' checks passed');
  process.exit(0);
}

// Invoke commerce.handle for GET /api/commerce/funnel and parse the JSON body.
function funnelCounts(commerce) {
  return new Promise((resolve, reject) => {
    const captured = { body: '' };
    const req = { method: 'GET', url: '/api/commerce/funnel', headers: {}, on() {} };
    const res = {
      headersSent: false,
      writeHead() { this.headersSent = true; },
      setHeader() {},
      getHeader() { return null; },
      end(chunk) { if (chunk != null) captured.body += String(chunk); },
    };
    Promise.resolve(commerce.handle(req, res, {}))
      .then((handled) => {
        if (handled !== true) return reject(new Error('funnel route not handled'));
        try { resolve(JSON.parse(captured.body)); }
        catch (e) { reject(e); }
      })
      .catch(reject);
  });
}
