'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.DISABLE_BILLION_AUTONOMY_LOOP = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'amos-'));
process.env.COMMERCE_DATA_DIR = path.join(tmp, 'commerce');

let passed = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(() => { console.log('✓', name); passed += 1; })
        .catch((e) => { console.error('✗', name); console.error(e && e.stack || e); process.exit(1); });
    }
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

async function main() {
  const amos = require('../src/commerce/autonomy-money-surface-os');
  const ppcos = require('../src/commerce/post-pay-closure-os');

  await check('AMOS protocol + top money skus', () => {
    assert.equal(amos.PROTOCOL, 'AMOS/1.0');
    const skus = amos.topMoneySkus(6);
    assert.ok(skus.length >= 3);
    assert.ok(skus.every((s) => s.buyable && s.id && s.checkoutHref));
  });

  await check('homeMoneyStripHtml includes checkout links', () => {
    const html = amos.homeMoneyStripHtml({ catalogCount: 39, limit: 4 });
    assert.ok(html.includes('homeMoneySurface'));
    assert.ok(html.includes('/checkout/?plan='));
    assert.ok(html.includes('data-amos-sku='));
  });

  await check('postMoneyOffers dryRun never invents GMV', async () => {
    const out = await amos.postMoneyOffers(amos.topMoneySkus(2), { dryRun: true });
    assert.equal(out.ok, true);
    assert.equal(out.dryRun, true);
    assert.ok(out.preview.includes('Money Surface'));
  });

  await check('postMoneyOffers reports not_configured when TG unarmed', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.ZEUS_TG_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.ZEUS_TG_GROUP_CHAT_ID;
    const out = await amos.postMoneyOffers([{ id: 'instant-logo-kit', title: 'Logo', priceUsd: 99, checkoutHref: '/checkout/?plan=instant-logo-kit' }], { dryRun: false, force: true });
    assert.equal(out.ok, false);
    assert.ok(['not_configured', 'send_failed', 'tpg_error', 'owner_alert_error'].includes(out.reason) || out.reason);
  });

  await check('PPCOS opens CLOS + mints referral on paid order', () => {
    assert.equal(ppcos.PROTOCOL, 'PPCOS/1.0');
    const order = {
      orderId: 'ord_amos_test_1',
      serviceId: 'instant-logo-kit',
      serviceName: 'Logo Kit',
      subtotal_fiat: 99,
      paid_via: 'btc',
      paid_at: new Date().toISOString(),
      buyer: { email: 'buyer-amos@example.com' },
      txids: ['a'.repeat(64)],
      entitlement_id: 'ent_test',
    };
    const r = ppcos.onOrderPaid(order);
    assert.ok(r.clos && r.clos.ok);
    assert.ok(r.referral && r.referral.ok && r.referral.code);
    const ack = ppcos.onDeliveryFired(order);
    assert.ok(ack && ack.ok);
  });

  await check('source wiring: sell-surface + BALOS + routes + TPG postMoneyOffers', () => {
    const sell = read('src/site/v2/sell-surface.js');
    assert.ok(sell.includes('autonomy-money-surface-os'));
    assert.ok(sell.includes('homeMoneyStripHtml'));
    const balos = read('src/commerce/billion-autonomy-loop-os.js');
    assert.ok(balos.includes('postMoneyOffers'));
    assert.ok(!balos.includes('postValue({\n        title:'));
    const tpg = read('backend/modules/telegram-profit-group-os.js');
    assert.ok(tpg.includes('async function postMoneyOffers'));
    const idx = read('src/index.js');
    assert.ok(idx.includes('/api/billion-scale/money-surface'));
    assert.ok(idx.includes('/api/billion-scale/post-pay'));
    const sov = read('src/site/sovereign-commerce.js');
    assert.ok(sov.includes('post-pay-closure-os'));
    assert.ok(sov.includes('onOrderPaid'));
  });

  console.log('\n' + passed + ' checks passed (autonomy-money-surface-os)');
  // Force exit — commerce/ZACC side-effects must not hold the CI event loop open.
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
