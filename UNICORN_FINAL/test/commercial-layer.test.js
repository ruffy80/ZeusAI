'use strict';

process.env.DISABLE_SELF_MUTATION = '1';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ZEUS_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-'));

const layer = require('../backend/modules/commercial-layer');
const shell = require('../src/site/v2/shell');

(async () => {
  const storage = await layer.probeStores();
  assert.ok(storage.postgres, 'postgres probe should record the closed port');
  assert.match(storage.postgres, /ECONNREFUSED|timeout|connect/);
  assert.ok(storage.redis, 'redis probe should record the closed port');
  assert.match(storage.redis, /ECONNREFUSED|timeout|connect/);

  const audit = layer.quoteSync('website-audit');
  const priced = layer.priceServices([{ id: 'instant-website-audit', title: 'Instant Website Audit', description: 'File.' }]);
  const alias = priced.find((row) => row.id === 'website-audit');
  assert.equal(alias.priceBtc, audit.btc);
  assert.equal(alias.priceUsd, audit.usd);
  assert.ok(alias.btcUri.includes(audit.btc));

  const plans = layer.plansPayload();
  assert.equal(plans.plans.length, 3);
  assert.equal(plans.plans[0].id, 'starter');
  assert.equal(plans.plans[0].usd, 29);
  assert.equal(plans.plans[1].usd, 99);
  assert.equal(plans.plans[2].contact, true);
  assert.equal(plans.plans[2].btc, null);

  const bundles = layer.bundlesPayload();
  assert.equal(bundles.bundles.length, 3);
  for (const bundle of bundles.bundles) {
    assert.ok(bundle.usd < bundle.sumUsd, bundle.id);
    assert.equal(bundle.belowSum, true);
  }

  const firstLock = layer.priceLock('203.0.113.5', 'website-audit');
  const secondLock = layer.priceLock('203.0.113.5', 'website-audit');
  assert.equal(secondLock.locked_price_btc, firstLock.locked_price_btc);
  assert.equal(secondLock.expires_at, firstLock.expires_at);
  assert.match(String(storage.redis), /ECONNREFUSED|timeout|connect/);

  const paid = layer.onConfirmedPayment({
    email: 'buyer@example.com',
    offerId: 'website-audit',
    amountUsd: 44.1,
    amountBtc: audit.btc,
    orderId: 'test-order-1',
    mock: false,
  });
  assert.ok(paid.referralCode);
  const lookup = layer.referralPayload(paid.referralCode);
  assert.equal(lookup.valid, true);
  assert.equal(lookup.discount_pct, 10);
  const preview = layer.previewReferral(paid.referralCode, 44.1);
  assert.equal(preview.discountedUsd, 39.69);
  layer.onConfirmedPayment({
    email: 'friend@example.com',
    offerId: 'website-audit',
    amountUsd: 39.69,
    amountBtc: audit.btc,
    orderId: 'test-order-2',
    refCode: paid.referralCode,
    mock: false,
  });
  const Database = require('better-sqlite3');
  const db = new Database(path.join(process.env.ZEUS_STATE_DIR, 'commercial.sqlite'));
  const credit = db.prepare('SELECT uses, credit_usd FROM referrals WHERE code = ?').get(paid.referralCode);
  assert.equal(credit.uses, 1);
  assert.equal(Number(credit.credit_usd), 3.97);

  const hidden = layer.publishPreview({ id: 'private-1', serviceName: 'Website audit', content: 'secret body', consent: false });
  assert.equal(hidden.public, false);
  assert.equal(layer.publicPreview('private-1'), null);
  const shown = layer.publishPreview({ id: 'public-1', serviceName: 'Website audit', content: 'A'.repeat(240), consent: true });
  assert.equal(shown.public, true);
  const page = layer.publicPreview('public-1');
  assert.equal(page.teaser.length, 200);
  assert.ok(page.signature);
  assert.equal(page.sha256.length, 64);

  const report = layer.buildReport();
  assert.equal(report.payload.scores_generated, 0);
  assert.equal(report.payload.new_services, 0);
  assert.ok(report.signature);
  assert.match(report.payload.notes.scores_generated, /0 this week/);

  const demo = await layer.handleHttp({
    method: 'POST',
    headers: {},
    socket: { remoteAddress: '203.0.113.9' },
    on(event, fn) {
      if (event === 'data') return;
      if (event === 'end') fn();
    },
    body: { prompt: 'Say hello' },
  }, {
    writeHead() {},
    end(payload) { this.payload = payload; },
    set() {},
    status() { return this; },
    json(body) { this.payload = JSON.stringify(body); },
  }, '/api/demo/route');
  assert.equal(demo, true);

  const shelfCount = require('../src/commerce/public-shelf').publicShelf().length;
  const home = shell.getHtml('/');
  const btcHits = home.match(/0\.[0-9]+ BTC/g) || [];
  assert.ok(btcHits.length >= 3, 'homepage should render the audit BTC');
  assert.equal(btcHits[0], btcHits[1]);
  assert.equal(btcHits[1], btcHits[2]);
  assert.equal(btcHits[0], audit.btc + ' BTC');
  assert.match(home, new RegExp('See all ' + shelfCount + ' services'));
  assert.match(home, /Simulated route/);
  assert.match(home, /Buy the website audit/);
  assert.match(home, /Buy the website audit · \$[0-9,]+\.[0-9]{2} · /);
  assert.match(home, /PayPal, card, and NOWPayments pay this list\. Bitcoin pays 10% under it\./);
  assert.doesNotMatch(home, /Bitcoin checkout/i);

  const services = shell.getHtml('/services');
  const cards = services.match(/service-card/g) || [];
  assert.equal(cards.length, shelfCount);
  assert.match(services, /id="serviceSearch"/);
  assert.match(services, /Save 15-25% with bundles/);

  const pricing = shell.getHtml('/pricing');
  assert.match(pricing, /Subscribe with BTC/);
  assert.doesNotMatch(pricing, /\/checkout\/\?plan=starter(?![a-z0-9_-])/i);
  assert.doesNotMatch(pricing, /\/checkout\/\?plan=pro(?![a-z0-9_-])/i);
  assert.match(pricing, /Signed delivery/);

  const missing = layer.publicPreview('missing');
  assert.equal(missing, null);
  const privateHtml = shell.getHtml('/delivery/private-1');
  assert.match(privateHtml, /This delivery is private/);
  const publicHtml = shell.getHtml('/delivery/public-1');
  assert.match(publicHtml, /This is a real, signed delivery/);

  console.log('commercial-layer.test.js: ok');
  console.log(JSON.stringify({
    auditBtc: audit.btc,
    postgres: storage.postgres,
    redis: storage.redis,
    plans: plans.plans.map((plan) => ({ id: plan.id, usd: plan.usd, btc: plan.btc })),
    bundles: bundles.bundles.map((bundle) => ({ id: bundle.id, usd: bundle.usd, sumUsd: bundle.sumUsd, btc: bundle.btc, sumBtc: bundle.sumBtc })),
  }));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
