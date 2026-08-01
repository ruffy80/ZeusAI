'use strict';

/**
 * Autonomous Enterprise Closure OS (AECOS) — kickoff cash-close + UI DTO bridge.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aecos-'));
process.env.UNICORN_COMMERCE_DIR = tmp;

const aecos = require('../src/commerce/autonomous-enterprise-closure-os');
const buyability = require('../src/commerce/commerce-buyability');
const catalog = require('../src/commerce/enterprise-catalog');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
}

console.log('AECOS autonomous enterprise closure tests');

check('kickoff SKU is defined at $2500', () => {
  assert.equal(aecos.KICKOFF_ID, 'ent-engagement-kickoff');
  assert.equal(aecos.KICKOFF_PRICE_USD, 2500);
  const sku = aecos.kickoffSku();
  assert.equal(sku.priceUSD, 2500);
  assert.ok(/SOW|proposal/i.test(sku.honesty));
});

check('enterprise catalog includes kickoff', () => {
  const p = catalog.byId('ent-engagement-kickoff');
  assert.ok(p, 'kickoff must be in catalog');
  assert.equal(Number(p.priceUSD), 2500);
});

check('kickoff is self-serve reserve; full ACV is contact', () => {
  const kick = buyability.assessBuyability({
    id: 'ent-engagement-kickoff',
    tier: 'enterprise',
    group: 'enterprise-kickoff',
    priceUSD: 2500,
  });
  assert.equal(kick.buyable, true);
  assert.equal(kick.mode, 'reserve');

  const full = buyability.assessBuyability({
    id: 'ent-platform-license',
    tier: 'enterprise',
    priceUSD: 250000,
  });
  assert.equal(full.buyable, false);
  assert.equal(full.mode, 'contact');
  assert.ok(/autonomous deal/i.test(full.ctaLabel));
});

check('closeFromContact returns kickoff quote + checkoutHref', () => {
  const closure = aecos.closeFromContact(
    { id: 'ent-test-1', email: 'buyer@acme.com', interest: 'ent-platform-license' },
    { btcSpotUsd: 100000 }
  );
  assert.ok(closure.quote);
  assert.ok(closure.quote.netUsd >= 2500);
  assert.ok(String(closure.quote.checkoutHref || '').includes('ent-engagement-kickoff'));
  assert.ok(Array.isArray(closure.next) && closure.next.length >= 2);
});

check('normalizeNegotiateStart maps SPA body → engine buyer.email', () => {
  const p = aecos.normalizeNegotiateStart({
    productId: 'ent-platform-license',
    buyerName: 'Acme Corp',
    email: 'cfo@acme.com',
    buyerTier: 'fortune500',
    termYears: 3,
  });
  assert.equal(p.productId, 'ent-platform-license');
  assert.equal(p.buyer.email, 'cfo@acme.com');
  assert.equal(p.termYears, 3);
  assert.equal(p.buyerTier, 'fortune500');
});

check('normalizeNegotiateStart rejects missing email', () => {
  let err = null;
  try { aecos.normalizeNegotiateStart({ productId: 'ent-platform-license', buyerName: 'X' }); }
  catch (e) { err = e; }
  assert.ok(err);
  assert.match(String(err.message), /email/);
});

check('enrichDealForUi bridges state→status + Fmt fields', () => {
  const ui = aecos.enrichDealForUi({
    id: 'deal_x',
    state: 'countered',
    listPriceUSD: 250000,
    currentOfferUSD: 180000,
    counterOfferUSD: 212500,
    buyer: { legalEntity: 'Acme', email: 'cfo@acme.com' },
    buyerTier: 'fortune500',
    termYears: 5,
    history: [
      { actor: 'buyer', action: 'open', offerUSD: 180000, message: 'hi' },
      { actor: 'seller', action: 'counter', offerUSD: 212500, message: 'auto' },
    ],
  });
  assert.equal(ui.status, 'open');
  assert.ok(ui.currentOfferFmt);
  assert.ok(ui.anchorFmt);
  assert.equal(ui.buyerName, 'Acme');
  assert.equal(ui.history[1].actor, 'unicorn');
});

check('pipelineStats wraps deals for SPA', () => {
  const stats = aecos.pipelineStats([
    { state: 'open', currentOfferUSD: 100000 },
    { state: 'confirmed', acceptedPriceUSD: 200000 },
  ]);
  assert.equal(stats.open, 1);
  assert.ok(String(stats.bookedFmt).includes('200'));
  assert.equal(stats.winRate, 100);
});

check('enrichCatalogResponse includes rails + kickoff product', () => {
  const res = aecos.enrichCatalogResponse();
  assert.ok(Array.isArray(res.products) && res.products.length >= 1);
  assert.ok(res.products.some((p) => p.id === 'ent-engagement-kickoff'));
  assert.ok(Array.isArray(res.rails) && res.rails.length === 3);
  assert.ok(res.kickoff && res.kickoff.id === 'ent-engagement-kickoff');
});

check('src/index.js wires AECOS into contact + negotiate', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(src.includes('autonomous-enterprise-closure-os'));
  assert.ok(src.includes('closeFromContact'));
  assert.ok(src.includes('normalizeNegotiateStart'));
  assert.ok(src.includes('closeFromDeal'));
  assert.ok(src.includes('enrichCatalogResponse'));
});

check('backend enterprise-cloud-router exposes public AECOS routes (nginx → :3000)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../backend/modules/enterprise-cloud-router.js'), 'utf8');
  assert.ok(src.includes('autonomous-enterprise-closure-os'));
  assert.ok(src.includes("'/api/enterprise/aecos'"));
  assert.ok(src.includes("'/api/enterprise/catalog'"));
  assert.ok(src.includes('closeFromContact'));
  assert.ok(src.includes('normalizeNegotiateStart'));
});

console.log(`\n✅ autonomous-enterprise-closure-os: ${passed} tests passed`);
