'use strict';

// Enterprise Standard OS (ESOS/1.0) pack — focused regression tests.
// Covers:
//   A) src/site/commerce-integrity.js money-path verifier (Ed25519 + invariants,
//      no buyer PII in issues)
//   B) src/monitoring/commerce-metrics.js real counters + prom text
//   C) src/lib/rate-limiter.js token bucket (429 + Retry-After semantics)
//   D) site-pinned nginx paths reachable as strings (see nginx-contract-guard)
//   E) backend/modules/enterprise-standard-os.js getStatus() ESOS/1.0 shape +
//      route mounts present in backend/index.js
//   F) backend/modules/ai-cost-ledger.js public rollup is redacted (no keys,
//      prompts, models, or costs)

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Isolate the commerce data dir (and the Ed25519 signing key) so requiring the
// module never touches repo data/.
const keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esos-key-'));
process.env.COMMERCE_DATA_DIR = keyDir;

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('  \u2714', name); passed++; }
  catch (e) { console.error('  \u2717', name, '\n   ', (e && e.stack) || e); process.exit(1); }
}
async function checkAsync(name, fn) {
  try { await fn(); console.log('  \u2714', name); passed++; }
  catch (e) { console.error('  \u2717', name, '\n   ', (e && e.stack) || e); process.exit(1); }
}

console.log('enterprise-standard-os tests');

// ─── shared helpers ─────────────────────────────────────────────────────────
const commerce = require('../src/site/sovereign-commerce');

function writeLedger(dir, orders, ents) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'orders.jsonl'),
    orders.map((o) => JSON.stringify(o)).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'entitlements.jsonl'),
    ents.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

// Build a signed entitlement exactly the way scanIncoming() does: sign the
// object body first, then append the `.signature` field.
function signEntitlement(ent) {
  const copy = { ...ent };
  const sig = commerce.sign(copy);
  copy.signature = sig;
  return copy;
}

// ─── A) commerce-integrity: exports + happy path ────────────────────────────
const integrity = require('../src/site/commerce-integrity');

check('commerce-integrity exports verify()', () => {
  assert.strictEqual(typeof integrity.verify, 'function');
});

check('sovereign-commerce exports sign/verify/verifyEntitlement', () => {
  assert.strictEqual(typeof commerce.sign, 'function');
  assert.strictEqual(typeof commerce.verify, 'function');
  assert.strictEqual(typeof commerce.verifyEntitlement, 'function');
});

check('verifyEntitlement round-trips a freshly signed entitlement', () => {
  const ent = signEntitlement({
    entitlement_id: 'ent_rt', orderId: 'o_rt', serviceId: 'svc',
    buyer: 'roundtrip@example.com', amount_sats: 4242,
  });
  assert.strictEqual(commerce.verifyEntitlement(ent), true);
  // Tampering with any signed field must invalidate the signature.
  const tampered = { ...ent, amount_sats: 9999 };
  assert.strictEqual(commerce.verifyEntitlement(tampered), false);
});

check('verify() clean ledger → ok:true, score 100, zero issues', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esos-ok-'));
  const e1 = signEntitlement({
    entitlement_id: 'ent_1', orderId: 'o1', serviceId: 'svc-a',
    buyer: 'ok@example.com', amount_sats: 5000,
  });
  writeLedger(dir,
    [{ orderId: 'o1', status: 'paid', amount_sats: 5000, entitlement_id: 'ent_1' },
      { orderId: 'o2', status: 'pending', amount_sats: 6000 }],
    [e1]);
  const r = integrity.verify({ dataDir: dir });
  assert.strictEqual(r.protocol, 'ESOS/1.0');
  assert.strictEqual(r.ok, true, 'expected ok:true, issues=' + JSON.stringify(r.issues));
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.counts.issues, 0);
  assert.strictEqual(r.counts.paid_orders, 1);
  assert.strictEqual(r.counts.signatures_checked, 1);
  assert.strictEqual(r.counts.signature_failures, 0);
});

// ─── A) commerce-integrity: detects every class of money-path defect ────────
check('verify() flags missing entitlement, orphan, dup-amount, bad signature', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esos-bad-'));
  const good = signEntitlement({
    entitlement_id: 'ent_good', orderId: 'p1', serviceId: 'svc',
    buyer: 'good@example.com', amount_sats: 1111,
  });
  // Forged entitlement: sign then mutate a signed field.
  const forged = signEntitlement({
    entitlement_id: 'ent_forged', orderId: 'p2', serviceId: 'svc',
    buyer: 'forged@example.com', amount_sats: 2222,
  });
  forged.amount_sats = 3333; // breaks the signature
  // Orphan entitlement references a non-existent order.
  const orphan = signEntitlement({
    entitlement_id: 'ent_orphan', orderId: 'does_not_exist', serviceId: 'svc',
    buyer: 'orphan@example.com', amount_sats: 4444,
  });
  writeLedger(dir,
    [
      { orderId: 'p1', status: 'paid', amount_sats: 1111, entitlement_id: 'ent_good' },
      { orderId: 'p2', status: 'paid', amount_sats: 3333, entitlement_id: 'ent_forged' },
      { orderId: 'p3', status: 'paid', amount_sats: 5555 }, // paid, no entitlement
      { orderId: 'pend_a', status: 'pending', amount_sats: 7000 },
      { orderId: 'pend_b', status: 'pending', amount_sats: 7000 }, // dup pending amount
    ],
    [good, forged, orphan]);

  const r = integrity.verify({ dataDir: dir });
  assert.strictEqual(r.ok, false);
  const types = r.issues.map((i) => i.type);
  assert.ok(types.includes('paid_order_missing_entitlement'), 'missing entitlement not flagged');
  assert.ok(types.includes('orphan_entitlement'), 'orphan not flagged');
  assert.ok(types.includes('duplicate_pending_amount'), 'dup amount not flagged');
  assert.ok(types.includes('signature_verification_failed'), 'bad signature not flagged');
  assert.ok(r.score < 100 && r.score >= 0, 'score should drop below 100');
});

check('verify() issues NEVER carry buyer PII', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esos-pii-'));
  const forged = signEntitlement({
    entitlement_id: 'ent_pii', orderId: 'pii1', serviceId: 'svc',
    buyer: 'secret-buyer@example.com', amount_sats: 8888,
  });
  forged.amount_sats = 9; // break signature so it becomes an issue
  writeLedger(dir,
    [{ orderId: 'pii1', status: 'paid', amount_sats: 9, entitlement_id: 'ent_pii' }],
    [forged]);
  const r = integrity.verify({ dataDir: dir });
  const blob = JSON.stringify(r.issues);
  assert.ok(!blob.includes('secret-buyer@example.com'), 'buyer email leaked into issues');
  assert.ok(!/buyer/i.test(blob), 'buyer field leaked into issues');
});

// ─── B) commerce-metrics: real counters + prom exposition ───────────────────
const metrics = require('../src/monitoring/commerce-metrics');

check('commerce-metrics counts real events, ignores unknown, exposes prom text', () => {
  metrics.reset();
  metrics.inc('orders_created');
  metrics.inc('orders_created');
  metrics.inc('orders_paid');
  assert.strictEqual(metrics.inc('not_a_real_counter'), undefined, 'unknown counter must be ignored');
  const snap = metrics.snapshot();
  assert.strictEqual(snap.orders_created, 2);
  assert.strictEqual(snap.orders_paid, 1);
  assert.strictEqual(snap.checkout_open, 0);

  const j = metrics.json();
  assert.strictEqual(j.ok, true);
  assert.strictEqual(j.protocol, 'ESOS/1.0');
  assert.strictEqual(j.counters.orders_created, 2);

  const prom = metrics.promText();
  assert.ok(/unicorn_commerce_orders_created_total 2/.test(prom), 'prom counter missing');
  assert.ok(/# TYPE unicorn_commerce_orders_created_total counter/.test(prom), 'prom TYPE line missing');
  metrics.reset();
});

// ─── B) site routes serve integrity + metrics (end-to-end via handle) ───────
function callHandle(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const captured = { body: '', status: 0, headers: {} };
    const req = { method, url, headers: {}, socket: { remoteAddress: '127.0.0.1' }, on() {} };
    const res = {
      headersSent: false,
      writeHead(code, headers) { captured.status = code; captured.headers = headers || {}; this.headersSent = true; },
      setHeader() {},
      getHeader() { return null; },
      end(chunk) { if (chunk != null) captured.body += String(chunk); },
    };
    Promise.resolve(commerce.handle(req, res, {}))
      .then((handled) => {
        if (handled !== true) return reject(new Error('route not handled: ' + url));
        resolve(captured);
      })
      .catch(reject);
  });
}

// (integrity/metrics/prom route checks run inside run() so they are awaited)

// ─── C) rate limiter: token bucket → 429 + Retry-After semantics ────────────
const { createLimiter } = require('../src/lib/rate-limiter');

check('createLimiter allows up to max then denies with retryAfter', () => {
  const limit = createLimiter({ max: 3, windowMs: 60 * 1000 });
  assert.strictEqual(limit('1.2.3.4').ok, true);
  assert.strictEqual(limit('1.2.3.4').ok, true);
  const third = limit('1.2.3.4');
  assert.strictEqual(third.ok, true);
  const denied = limit('1.2.3.4');
  assert.strictEqual(denied.ok, false, 'fourth request must be denied');
  assert.ok(denied.retryAfter >= 1, 'retryAfter should be >= 1 second');
  assert.strictEqual(denied.remaining, 0);
  assert.strictEqual(denied.limit, 3);
  // Independent key is unaffected.
  assert.strictEqual(limit('9.9.9.9').ok, true);
});

// ─── E) enterprise-standard-os module: getStatus() shape + route mounts ─────
const esos = require('../backend/modules/enterprise-standard-os');

check('enterprise-standard-os exports getStatus()', () => {
  assert.strictEqual(typeof esos.getStatus, 'function');
});

check('getStatus() returns the ESOS/1.0 shape with expected pillars', () => {
  const s = esos.getStatus();
  assert.strictEqual(s.ok, true);
  assert.strictEqual(s.protocol, 'ESOS/1.0');
  assert.strictEqual(s.name, 'enterprise-standard-os');
  assert.ok(Array.isArray(s.pillars) && s.pillars.length >= 6, 'expected >=6 pillars');
  assert.ok(typeof s.score === 'number' && s.score >= 0 && s.score <= 100, 'score 0..100');
  assert.ok(typeof s.grade === 'string' && s.grade.length >= 1, 'grade present');
  assert.ok(typeof s.ts === 'string', 'ts present');
  assert.ok(s.links && s.links.integrity === '/api/commerce/integrity', 'integrity link');
  for (const p of s.pillars) {
    assert.ok(typeof p.id === 'string' && p.id, 'pillar id');
    assert.strictEqual(typeof p.ok, 'boolean', 'pillar ok boolean');
    assert.ok(typeof p.detail === 'string' && p.detail, 'pillar detail');
  }
  const ids = s.pillars.map((p) => p.id);
  for (const req of ['money_integrity', 'commerce_metrics', 'nginx_contract',
    'rate_limit', 'mutator_safety', 'pfos_present', 'ai_cost_visible']) {
    assert.ok(ids.includes(req), 'missing pillar ' + req);
  }
});

check('mutator_safety pillar ok when DISABLE_SELF_MUTATION=1 (high score)', () => {
  const s = esos.getStatus();
  const p = s.pillars.find((x) => x.id === 'mutator_safety');
  assert.strictEqual(p.ok, true);
  assert.ok(s.score >= 80, 'expected score >= 80 in safe test env, got ' + s.score);
});

check('backend/index.js mounts /api/enterprise/standard + /.well-known/enterprise.json', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
  assert.ok(src.includes("require('./modules/enterprise-standard-os')"), 'ESOS module required');
  assert.ok(src.includes("app.get('/api/enterprise/standard'"), '/api/enterprise/standard route');
  assert.ok(src.includes("app.get('/.well-known/enterprise.json'"), '/.well-known/enterprise.json route');
});

// ─── D) nginx contract: site-pinned commerce paths present as strings ───────
check('nginx-unicorn.conf pins new commerce paths to unicorn_site', () => {
  const conf = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'nginx-unicorn.conf'), 'utf8');
  for (const p of ['/api/checkout/create', '/api/commerce/integrity',
    '/api/commerce/metrics', '/api/order/', '/api/entitlements/']) {
    const re = new RegExp('location\\s+(?:=|\\^~)?\\s*' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    assert.ok(re.test(conf), 'missing nginx pin for ' + p);
  }
});

// ─── F) ai-cost-ledger public rollup is redacted (no keys/prompts/costs) ─────
run();
async function run() {
  // ─── B) site routes serve integrity + metrics (end-to-end via handle) ─────
  await checkAsync('GET /api/commerce/integrity returns ESOS verifier body', async () => {
    const cap = await callHandle('/api/commerce/integrity');
    assert.strictEqual(cap.status, 200);
    const j = JSON.parse(cap.body);
    assert.strictEqual(j.protocol, 'ESOS/1.0');
    assert.ok(typeof j.ok === 'boolean');
    assert.ok(j.counts && typeof j.counts.issues === 'number');
  });

  await checkAsync('GET /api/commerce/metrics returns real counters json', async () => {
    const cap = await callHandle('/api/commerce/metrics');
    assert.strictEqual(cap.status, 200);
    const j = JSON.parse(cap.body);
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.protocol, 'ESOS/1.0');
    assert.ok(j.counters && typeof j.counters.orders_created === 'number');
  });

  await checkAsync('GET /metrics/commerce returns Prometheus text', async () => {
    const cap = await callHandle('/metrics/commerce');
    assert.strictEqual(cap.status, 200);
    assert.ok(/unicorn_commerce_orders_created_total/.test(cap.body), 'prom body missing');
  });

  const ledger = require('../backend/modules/ai-cost-ledger');
  let express;
  try { express = require('express'); } catch (_) { express = null; }

  await checkAsync('ai-cost /public exposes only aggregate calls + provider names', async () => {
    if (!express) { console.log('    (express unavailable — skipping live route mount)'); return; }
    ledger.clear();
    ledger.record({ provider: 'openai', model: 'gpt-4o', tokens: 1000, task: 'copy' });
    ledger.record({ provider: 'anthropic', model: 'claude-3', tokens: 500, task: 'copy' });

    const app = express();
    app.use('/api/ai/cost', ledger.router(express));
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
      const port = server.address().port;
      const body = await new Promise((resolve, reject) => {
        require('http').get({ host: '127.0.0.1', port, path: '/api/ai/cost/public' }, (res) => {
          let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve(d));
        }).on('error', reject);
      });
      const j = JSON.parse(body);
      assert.strictEqual(j.ok, true);
      assert.strictEqual(typeof j.calls, 'number');
      assert.ok(Array.isArray(j.providers), 'providers must be an array');
      assert.ok(j.providers.includes('openai') && j.providers.includes('anthropic'), 'provider names present');
      // Redaction: no secrets, prompts, costs, models, or token counts.
      assert.strictEqual(j.costUsd, undefined);
      assert.strictEqual(j.totalCostUsd, undefined);
      assert.strictEqual(j.byProvider, undefined);
      assert.ok(!/apiKey|api_key|prompt|sk-|gpt-4o|claude-3/i.test(body), 'public rollup leaked secret/model');
    } finally {
      server.close();
    }
    ledger.clear();
  });

  console.log('enterprise-standard-os: ' + passed + ' checks passed');
  process.exit(0);
}
