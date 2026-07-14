'use strict';

// Fulfillment engine test — proves the real AI-backed delivery pipeline works
// end-to-end using a STUBBED provider (no live API key needed), plus recipe
// selection, feature-flag gating, and graceful no-key fallback.

const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

process.env.NODE_ENV = 'test';
// Isolate the deliveries store to a temp dir BEFORE requiring the registry
// (it resolves the data dir at module load).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-fulfil-'));
process.env.UNICORN_DATA_DIR = TMP;

const aiProviders = require('../backend/modules/aiProviders');
const registry = require('../src/site/v2/delivery-registry');
const engine = require('../src/site/v2/fulfillment-engine');

let pass = 0;
function check(name, fn) { fn(); pass++; console.log('  \u2713 ' + name); }

(async () => {
  // ── Recipe selection covers many service classes, not just a few ──────────
  check('picks code-scaffold recipe for a SaaS/MVP service', () => {
    assert.strictEqual(engine.pickRecipe('professional-saas-mvp').id, 'code-scaffold');
  });
  check('picks seo-content-pack for content services', () => {
    assert.strictEqual(engine.pickRecipe('instant-seo-content-pack').id, 'seo-content-pack');
  });
  check('picks landing-page for website services', () => {
    assert.strictEqual(engine.pickRecipe('instant-landing-page').id, 'landing-page');
  });
  check('unmatched service still gets a real generic consulting brief', () => {
    assert.strictEqual(engine.pickRecipe('some-exotic-enterprise-thing-xyz').id, 'consulting-brief');
  });

  // ── Feature flag OFF => no behavior change to the live money path ─────────
  check('fulfillReceipt is a no-op when FULFILLMENT_AI_ENABLED != 1', () => {
    delete process.env.FULFILLMENT_AI_ENABLED;
  });
  {
    const out = await engine.fulfillReceipt({ id: 'r_off', services: ['instant-seo-content-pack'] });
    check('flag-off returns skipped=disabled', () => assert.strictEqual(out.skipped, 'disabled'));
  }

  // ── Enable + stub the LLM layer => REAL artifact produced & attached ──────
  process.env.FULFILLMENT_AI_ENABLED = '1';
  aiProviders.chat = async () => ({ reply: '# SEO Content Pack\n\nKeywords: alpha, beta\n\nReal generated article body...', provider: 'stub-model' });

  registry.deliver({ id: 'r1', email: 't@example.com', services: ['instant-seo-content-pack'] });
  const out = await engine.fulfillReceipt({ id: 'r1', email: 't@example.com', services: ['instant-seo-content-pack'] });

  check('fulfillReceipt succeeds and marks ai_delivered', () => {
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.fulfillmentStatus, 'ai_delivered');
    assert.strictEqual(out.delivered, 1);
  });
  check('artifact has real generated content + correct recipe/format', () => {
    const a = out.artifacts[0];
    assert.strictEqual(a.recipe, 'seo-content-pack');
    assert.strictEqual(a.format, 'markdown');
    assert.ok(/Real generated article body/.test(a.content), 'content should be the model reply');
    assert.ok(a.bytes > 0);
  });
  check('artifacts are attached to the delivery record + downloadable via registry', () => {
    const d = registry.get('r1');
    assert.ok(Array.isArray(d.artifacts) && d.artifacts.length === 1);
    assert.strictEqual(d.fulfillmentStatus, 'ai_delivered');
    const one = registry.renderArtifacts(d, 'artifact', 'instant-seo-content-pack');
    assert.ok(one && /Real generated article body/.test(one.content));
    const list = registry.renderArtifacts(d, 'artifacts');
    assert.strictEqual(list.artifacts.length, 1);
    assert.ok(!('content' in list.artifacts[0]), 'list view must not leak bulky content');
  });

  // ── No provider key (chat returns null) => graceful pending, no fake deliver
  aiProviders.chat = async () => null;
  const out2 = await engine.fulfillReceipt({ id: 'r2', services: ['instant-landing-page'] }, { force: true });
  check('no-key path yields pending_ai_key (never a fake "delivered")', () => {
    assert.strictEqual(out2.fulfillmentStatus, 'pending_ai_key');
    assert.strictEqual(out2.delivered, 0);
  });

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  console.log('\n\u2705 fulfillment-engine: ' + pass + ' tests passed');
  process.exit(0);
})().catch(e => { console.error('\u274c fulfillment-engine test failed:', e && e.stack || e); process.exit(1); });
