'use strict';
// =====================================================================
// ai-capability-layer.test.js
//
// Pins the behaviour of the three real (non-mock) AI capability modules:
//   • ai-semantic-memory  — embeddings + cosine search + persistence
//   • ai-cost-ledger      — token/cost accounting + budget alerting
//   • ai-provider-health  — honest "how many providers are usable" count
// =====================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

(async () => {
  // ─────────────────────────────────────────────────────────────────
  console.log('AI Semantic Memory (RAG)');
  const mem = require('../backend/modules/ai-semantic-memory');
  mem.clear();

  // Local embedder is deterministic and L2-normalised → self-cosine == 1.
  const { vec: v1 } = await mem.embed('bitcoin payments and crypto invoices');
  const { vec: v2 } = await mem.embed('bitcoin payments and crypto invoices');
  check('embedder is deterministic', () => {
    assert.deepStrictEqual(v1, v2);
  });
  check('embedding is L2-normalised (self cosine ≈ 1)', () => {
    const c = mem.cosine(v1, v2);
    assert.ok(Math.abs(c - 1) < 1e-9, `expected ~1, got ${c}`);
  });
  check('embedding dimension matches DIM', () => {
    assert.strictEqual(v1.length, mem.DIM);
  });

  await mem.upsert('Zeus AI supports Bitcoin and crypto payment invoices', { tag: 'payments' });
  await mem.upsert('The compliance engine covers GDPR HIPAA and SOX standards', { tag: 'legal' });
  await mem.upsert('Quantum blockchain provides secure smart contracts', { tag: 'blockchain' });

  const results = await mem.search('how do crypto bitcoin payments work', { k: 3 });
  check('search returns results', () => {
    assert.ok(results.length >= 1, 'expected at least one result');
  });
  check('most relevant result is the payments doc', () => {
    assert.ok(/Bitcoin and crypto payment/i.test(results[0].text),
      `top result was: ${results[0].text}`);
  });
  check('scores are sorted descending', () => {
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score, 'scores not descending');
    }
  });
  const legalOnly = await mem.search('standards', { k: 5, filter: (m) => m.tag === 'legal' });
  check('filter restricts to matching meta', () => {
    assert.ok(legalOnly.every(r => r.meta.tag === 'legal'), 'filter leaked non-legal docs');
  });

  // Persistence: the store file exists and round-trips the doc count.
  check('store persists to disk', () => {
    const file = path.join(__dirname, '..', 'data', 'ai-memory', 'store.json');
    assert.ok(fs.existsSync(file), 'store.json not written');
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(onDisk.length, 3, `expected 3 docs on disk, got ${onDisk.length}`);
  });

  const st = mem.getStatus();
  check('getStatus reports document count', () => {
    assert.strictEqual(st.documents, 3);
    assert.strictEqual(st.active, true);
  });
  mem.clear();

  // ─────────────────────────────────────────────────────────────────
  console.log('AI Cost Ledger');
  const ledger = require('../backend/modules/ai-cost-ledger');
  ledger.clear();

  const est = ledger.estimateCost('gpt-4o', 1_000_000);
  check('estimateCost uses the real price table ($5/M for gpt-4o)', () => {
    assert.strictEqual(est.pricePerMillion, 5.0);
    assert.ok(Math.abs(est.costUsd - 5.0) < 1e-6, `expected ~5, got ${est.costUsd}`);
  });
  check('unknown model falls back to default price', () => {
    const e = ledger.estimateCost('some-unknown-model', 1_000_000);
    assert.ok(e.costUsd > 0, 'expected non-zero fallback cost');
  });

  ledger.record({ provider: 'deepseek', model: 'deepseek-chat', task: 'coding', tokens: 1_000_000 });
  ledger.record({ provider: 'deepseek', model: 'deepseek-chat', task: 'chat', tokens: 500_000 });
  ledger.record({ provider: 'groq', model: 'llama3-8b-8192', task: 'chat', costUsd: 0.01 });

  const sum = ledger.summary({ sinceMs: 0 });
  check('summary counts every recorded call', () => {
    assert.strictEqual(sum.calls, 3);
  });
  check('summary groups spend by provider', () => {
    assert.ok(sum.byProvider.deepseek, 'missing deepseek bucket');
    assert.strictEqual(sum.byProvider.deepseek.calls, 2);
    assert.ok(sum.byProvider.deepseek.costUsd > 0, 'deepseek cost should be > 0');
  });
  check('explicit costUsd is respected', () => {
    assert.ok(Math.abs(sum.byProvider.groq.costUsd - 0.01) < 1e-9,
      `expected 0.01, got ${sum.byProvider.groq.costUsd}`);
  });
  check('summary groups spend by task', () => {
    assert.ok(sum.byTask.coding && sum.byTask.chat, 'missing task buckets');
  });

  const b = ledger.budget();
  check('budget derives spend + alert flags from real entries', () => {
    assert.ok(b.spentUsd > 0, 'spend should be > 0');
    assert.strictEqual(typeof b.alerting, 'boolean');
    assert.strictEqual(typeof b.overBudget, 'boolean');
    assert.ok(b.monthlyBudgetUsd > 0);
  });

  check('cost ledger persists to disk', () => {
    const file = path.join(__dirname, '..', 'data', 'ai-cost', 'ledger.json');
    assert.ok(fs.existsSync(file), 'ledger.json not written');
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(onDisk.length, 3);
  });
  ledger.clear();

  // ─────────────────────────────────────────────────────────────────
  console.log('AI Provider Health');
  const health = require('../backend/modules/ai-provider-health');

  const snap = health.snapshot();
  check('snapshot enumerates the provider catalogue', () => {
    assert.ok(snap.total >= 10, `expected >= 10 providers, got ${snap.total}`);
    assert.strictEqual(snap.providers.length, snap.total);
  });
  check('configured + missing == total (honest accounting)', () => {
    assert.strictEqual(snap.configured + snap.missing, snap.total);
  });

  check('a well-formed key is counted as configured', () => {
    assert.strictEqual(health._keyConfigured('__NOPE__'), false);
    process.env.__TEST_KEY__ = 'sk-realkey1234567890abcdef';
    assert.strictEqual(health._keyConfigured('__TEST_KEY__'), true);
    delete process.env.__TEST_KEY__;
  });
  check('placeholder keys are NOT counted as configured', () => {
    process.env.__TEST_KEY__ = 'your_api_key_here_placeholder';
    assert.strictEqual(health._keyConfigured('__TEST_KEY__'), false);
    delete process.env.__TEST_KEY__;
  });
  check('short keys are NOT counted as configured', () => {
    process.env.__TEST_KEY__ = 'short';
    assert.strictEqual(health._keyConfigured('__TEST_KEY__'), false);
    delete process.env.__TEST_KEY__;
  });

  const hs = health.getStatus();
  check('getStatus exposes configured count', () => {
    assert.strictEqual(typeof hs.configured, 'number');
    assert.ok(Array.isArray(hs.configuredNames));
  });

  console.log(`\n✅ ai-capability-layer: ${passed} checks passed`);
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ ai-capability-layer test failed:', e);
  process.exit(1);
});
