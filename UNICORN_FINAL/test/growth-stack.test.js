'use strict';

// =====================================================================
// growth-stack.test.js — Autonomous Growth Stack (2026-06-12)
// Covers: funnel-intelligence (durable visitors), traffic-engine (IndexNow
// plan, dry-run), memory-guardian (cooperative trim, NEVER kills),
// revenue-flywheel (closed loop, hash chain, momentum), uaic smoke-receipt
// isolation (canonical ledger purity).
// RO: teste pentru stiva de creștere autonomă — totul offline, fără rețea.
// =====================================================================

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unicorn-growth-'));
process.env.FUNNEL_INTEL_FILE = path.join(tmpRoot, 'funnel-intelligence.json');
process.env.TRAFFIC_ENGINE_FILE = path.join(tmpRoot, 'traffic-engine.json');
process.env.TRAFFIC_OUTREACH_FILE = path.join(tmpRoot, 'outreach-queue.json');
process.env.FLYWHEEL_LEDGER_FILE = path.join(tmpRoot, 'flywheel-cycles.jsonl');
process.env.UNICORN_COMMERCE_DIR = path.join(tmpRoot, 'commerce');
// Force memory pressure so the guardian's trim path is exercised.
process.env.MEMORY_GUARDIAN_SYSTEM_PCT = '0.0001';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';

const funnel = require('../backend/modules/funnel-intelligence');
const traffic = require('../backend/modules/traffic-engine');
const guardian = require('../backend/modules/memory-guardian');
const flywheel = require('../backend/modules/revenue-flywheel');
const uaic = require('../src/commerce/uaic');

async function run() {
  // ── 1. funnel-intelligence: durable visitor + yield truth ───────────
  funnel._resetForTests();
  funnel.record({ event: 'page_view', sessionId: 'sess-a' });
  funnel.record({ event: 'page_view', sessionId: 'sess-b' });
  funnel.record({ event: 'page_view', sessionId: 'sess-a' }); // same session — not double counted
  funnel.record({ event: 'view_service', serviceId: 'adaptive-ai', sessionId: 'sess-a' });
  funnel.record({ event: 'checkout_start', serviceId: 'adaptive-ai', sessionId: 'sess-a' });
  funnel.record({ event: 'checkout_paid', serviceId: 'adaptive-ai', sessionId: 'sess-a', value: 299 });

  const v = funnel.visitors();
  assert.equal(v.today, 2, 'unique sessions today should be 2 (got ' + v.today + ')');
  const sum = funnel.summary();
  assert.equal(sum.windows.last30d.paid, 1, '30d paid should be 1');
  assert.equal(sum.windows.last30d.checkoutStarts, 1, '30d checkout starts should be 1');
  const top = sum.topProducts;
  assert.ok(top.length >= 1 && top[0].id === 'adaptive-ai', 'adaptive-ai should rank first by yield');
  assert.ok(top[0].yieldScore >= 111, 'yield = paid*100 + checkout*10 + views (got ' + top[0].yieldScore + ')');
  const fl = funnel.flush();
  assert.ok(fl.ok, 'flush should succeed');
  assert.ok(fs.existsSync(process.env.FUNNEL_INTEL_FILE), 'durable funnel file must exist after flush');
  console.log('[ok] funnel-intelligence: 2 unique visitors, durable flush, yield ranking');

  // ── 2. traffic-engine: deterministic IndexNow + dry-run plan ────────
  traffic._resetForTests();
  const key1 = traffic.indexNowKey();
  const key2 = traffic.indexNowKey();
  assert.equal(key1, key2, 'IndexNow key must be deterministic');
  assert.ok(/^[0-9a-f]{32}$/.test(key1), 'key must be 32 hex chars (got ' + key1 + ')');
  const urls = traffic.urlsToSubmit();
  assert.ok(urls.length >= 10, 'URL inventory should include core + services + verticals (got ' + urls.length + ')');
  assert.ok(urls.some((u) => u.endsWith('/services')), 'inventory must include /services');
  assert.ok(urls.some((u) => u.includes('/vertical/')), 'inventory must include vertical landing pages');
  const sub = await traffic.pingAll({ dryRun: true });
  assert.equal(sub.dryRun, true, 'dry-run flag must be honored');
  assert.ok(sub.engines.length >= 3, 'plan must cover indexnow + bing + google note');
  assert.ok(sub.engines.every((e) => e.status === 'dry-run' || e.engine === 'google'), 'no network calls in dry-run');
  const custom = await traffic.pingAll({ dryRun: true, urls: ['https://zeusai.pro/services/adaptive-ai'] });
  assert.equal(custom.urlCount, 1, 'custom URL subset must be respected (flywheel resubmission path)');
  const oq = traffic.buildOutreachQueue({ limit: 10 });
  assert.ok(typeof oq.queued === 'number', 'outreach queue must report honest count');
  assert.ok(String(oq.sending).length > 0, 'sending status must be explicit (smtp-configured or blocked)');
  console.log('[ok] traffic-engine: deterministic key, ' + urls.length + ' URLs, dry-run honored, outreach=' + oq.queued);

  // ── 3. memory-guardian: cooperative trim, never kills ───────────────
  guardian._resetForTests();
  let trimmed = 0;
  guardian.registerTrimmer('test-cache', () => { trimmed += 1; return { cleared: true }; });
  const t1 = guardian.tick(); // system threshold forced to 0.01% → pressure
  assert.equal(t1.pressure, true, 'forced threshold must trigger pressure');
  assert.equal(trimmed, 1, 'registered trimmer must run exactly once');
  const t2 = guardian.tick(); // cooldown — must NOT trim again immediately
  assert.equal(t2.pressure, true, 'pressure persists');
  assert.equal(trimmed, 1, 'cooldown must prevent trim storms');
  const gs = guardian.getStatus();
  assert.ok(gs.contract.includes('never'), 'contract must state it never kills');
  assert.ok(gs.current && gs.current.rssMB > 0, 'real RSS must be measured');
  console.log('[ok] memory-guardian: pressure→1 trim, cooldown enforced, process alive (golden rule 6)');

  // ── 4. revenue-flywheel: closed loop + hash chain + momentum ────────
  flywheel._resetForTests();
  flywheel.configure({ funnelIntelligence: funnel, trafficEngine: traffic });
  const c1 = await flywheel.runCycle({ dryRun: true });
  assert.ok(c1.ok, 'cycle 1 must succeed');
  assert.equal(c1.cycle.prevHash, 'genesis', 'first cycle chains from genesis');
  assert.ok(/^[0-9a-f]{64}$/.test(c1.cycle.hash), 'cycle hash must be sha256 hex');
  assert.equal(c1.cycle.momentum.trend, 'baseline', 'first cycle establishes baseline');
  const dist = c1.cycle.actions.find((a) => a.type === 'distribute_top_yield');
  assert.ok(dist && Array.isArray(dist.products) && dist.products.includes('adaptive-ai'), 'top-yield product must earn a distribution slot');
  const props = c1.cycle.actions.find((a) => a.type === 'pricing_proposals');
  assert.ok(props, 'pricing proposals action must exist');

  funnel.record({ event: 'page_view', sessionId: 'sess-c' });
  funnel.record({ event: 'checkout_start', serviceId: 'adaptive-ai', sessionId: 'sess-c' });
  const c2 = await flywheel.runCycle({ dryRun: true });
  assert.equal(c2.cycle.prevHash, c1.cycle.hash, 'cycle 2 must chain to cycle 1 (auditable forever)');
  assert.ok(c2.cycle.momentum.deltas, 'cycle 2 must compute deltas vs cycle 1');
  assert.ok(c2.cycle.momentum.score > 0, 'new visitor + checkout must yield positive momentum (got ' + c2.cycle.momentum.score + ')');
  assert.equal(c2.cycle.momentum.trend, 'compounding', 'positive momentum = compounding');
  const realCycle = await flywheel.runCycle({ dryRun: false }); // ledger write path (actions still safe: traffic pingAll may fail offline → recorded honestly)
  assert.ok(realCycle.ok && fs.existsSync(flywheel.LEDGER_FILE), 'non-dry cycle must append hash-chained ledger row');
  console.log('[ok] revenue-flywheel: genesis→chain→momentum=compounding, ledger row persisted');

  // ── 5. uaic: smoke receipts isolated from canonical ledger ──────────
  uaic._resetForTests();
  const commerceDir = process.env.UNICORN_COMMERCE_DIR;
  const canonical = path.join(commerceDir, 'uaic-receipts.jsonl');
  const smokeFile = path.join(commerceDir, 'uaic-smoke-receipts.jsonl');
  uaic.persistReceipt({ id: 'r_smoke1', status: 'paid', email: 'smoke@zeusai.pro', amount: 100, plan: 'starter' });
  uaic.persistReceipt({ id: 'r_smoke2', status: 'paid', email: 'real@example.com', txid: 'smoke-test-loopback', amount: 50, plan: 'starter' });
  uaic.persistReceipt({ id: 'r_real1', status: 'paid', email: 'customer@example.com', txid: 'a'.repeat(64), amount: 299, plan: 'pro' });
  assert.ok(uaic.isSmokeReceipt({ email: 'smoke@zeusai.pro' }), 'smoke email must be detected');
  assert.ok(uaic.isSmokeReceipt({ confirmation: { txid: 'smoke-test-loopback' } }), 'loopback txid must be detected');
  assert.ok(!uaic.isSmokeReceipt({ email: 'customer@example.com', txid: 'a'.repeat(64) }), 'real receipt must NOT be flagged');
  const canonicalRows = fs.readFileSync(canonical, 'utf8').trim().split('\n');
  const smokeRows = fs.readFileSync(smokeFile, 'utf8').trim().split('\n');
  assert.equal(canonicalRows.length, 1, 'canonical ledger must hold ONLY the real receipt (got ' + canonicalRows.length + ')');
  assert.ok(canonicalRows[0].includes('r_real1'), 'canonical row must be the real one');
  assert.equal(smokeRows.length, 2, 'both smoke receipts must land in the isolated file');
  assert.equal(uaic.getReceipts().length, 3, 'in-memory index keeps all 3 (smoke flow still verifies e2e)');
  console.log('[ok] uaic: canonical ledger pure (1 real), smoke isolated (2), in-memory complete (3)');

  // ── cleanup ──────────────────────────────────────────────────────────
  funnel._resetForTests();
  traffic._resetForTests();
  guardian._resetForTests();
  flywheel._resetForTests();
  uaic._resetForTests();
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}

  console.log('\n✅ growth-stack: ALL TESTS PASSED (funnel truth, traffic plan, memory contract, flywheel chain, ledger purity)');
}

run().then(() => process.exit(0)).catch((e) => { console.error('❌ growth-stack test failed:', e && e.message); console.error(e && e.stack); process.exit(1); });
