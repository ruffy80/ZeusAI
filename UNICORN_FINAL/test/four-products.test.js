'use strict';

process.env.DISABLE_SELF_MUTATION = '1';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ZEUS_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'products-'));

const shell = require('../src/site/v2/shell');
const offerings = require('../backend/modules/product-offerings');

(async () => {
  const products = shell.getHtml('/products');
  const cards = products.match(/product-card/g) || [];
  assert.equal(cards.length, 55);
  assert.match(products, /55 AI services\. Pay in BTC\. Delivered in minutes\./);
  assert.match(products, /id="productSearch"/);
  assert.match(products, /Save with bundles/);
  assert.match(products, /data-product-filter=/);

  const detail = shell.getHtml('/products/instant-website-audit');
  assert.match(detail, /Buy with BTC/);
  assert.match(detail, /sample coming soon/);
  assert.match(detail, /Signed delivery/);
  assert.match(detail, /"@type":"Product"/);
  assert.match(detail, /<title>Instant Website Audit \(AI\) — ZeusAI service — ZEUSAI<\/title>/);

  const api = shell.getHtml('/api-product');
  assert.match(api, /Verifiable delivery API/);
  const docs = shell.getHtml('/api-product/docs');
  assert.ok((docs.match(/POST \/api\/v1\/witness/g) || []).length >= 1);

  const orch = shell.getHtml('/orchestrator');
  assert.match(orch, /One orchestrator/);
  const snm = shell.getHtml('/snm');
  assert.match(snm, /cryptographic proof/);
  const pricing = shell.getHtml('/pricing');
  assert.ok((pricing.match(/tier/g) || []).length >= 3);

  const home = shell.getHtml('/');
  assert.match(home, /Explore all 55 services/);
  assert.match(home, /id="dtHeroH1">Cut Your AI API Costs by 70% Automatically</);
  assert.match(home, /All deliveries are signed and verifiable at/);

  const signed = offerings.signWitness({ delivery: { order: 'example', note: 'sample' } }, true);
  assert.equal(signed.valid, true);
  assert.equal(signed.demo, true);
  const fetched = offerings.getReceipt(signed.id);
  assert.equal(fetched.valid, true);

  const key = offerings.signup({ email: 'buyer@example.com', product: 'witness', optIn: false });
  assert.ok(key.apiKey.startsWith('zk_'));
  assert.equal(key.marketingEmail, false);
  const authed = offerings.signWitness({ delivery: { order: 'paid-shape' } }, false);
  assert.equal(authed.valid, true);

  const note = await offerings.notifyChannels({ text: 'SNM signature check', userId: 'product-demo' }, true);
  assert.equal(note.valid, true);
  assert.equal(note.attempts.length, 4);
  assert.ok(note.attempts.every((row) => row.simulated === true && row.ok === false));
  const check = offerings.verifyPosted(note.signed);
  assert.equal(check.valid, true);

  const missing = shell.getHtml('/products/not-a-real-offer');
  assert.match(missing, /Service not found/);

  console.log('four-products.test.js: ok');
  console.log(JSON.stringify({
    cards: cards.length,
    witnessId: signed.id,
    valid: fetched.valid,
    channels: note.attempts.map((row) => row.channel),
  }));
  void missing;
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
