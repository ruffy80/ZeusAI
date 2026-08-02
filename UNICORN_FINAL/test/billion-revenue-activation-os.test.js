'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const express = require('express');
const http = require('http');

const braos = require('../backend/modules/billion-revenue-activation-os');
const catalog = require('../backend/modules/productCatalog');
const orders = require('../backend/modules/orderManager');
const enterprise = require('../backend/modules/enterpriseSales');
const wealthAlias = require('../backend/modules/autonomousWealthEngine');
const marketplace = require('../backend/modules/serviceMarketplace');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => {
      console.log('✓', name);
      passed += 1;
    }).catch((e) => {
      console.error('✗', name);
      console.error(e && e.stack || e);
      process.exit(1);
    });
  }
  console.log('✓', name);
  passed += 1;
  return Promise.resolve();
}

async function main() {
  await check('productCatalog seeds ≥10 curated SKUs', () => {
    catalog.ensureRevenueSkus();
    const items = catalog.list();
    assert.ok(items.length >= 10, 'expected ≥10 SKUs, got ' + items.length);
    for (const id of ['esim-eu-5gb', 'api-access-pro', 'enterprise-license', 'quantum-identity-shield']) {
      assert.ok(catalog.get(id), 'missing ' + id);
    }
    assert.ok(String(catalog.BTC_ADDRESS).startsWith('bc1q4f7e66'));
  });

  await check('marketplace ensureRevenueSkus injects curated ids', () => {
    if (typeof marketplace.ensureRevenueSkus === 'function') marketplace.ensureRevenueSkus();
    const ids = new Set(marketplace.getAllServices().map((s) => s.id));
    assert.ok(ids.has('esim-eu-5gb'));
    assert.ok(ids.has('enterprise-license'));
    assert.ok(marketplace.getAllServices().length >= 10);
  });

  await check('autonomousWealthEngine alias exports process/getStatus', () => {
    assert.ok(typeof wealthAlias.process === 'function');
    assert.ok(typeof wealthAlias.getStatus === 'function');
  });

  await check('orderManager full reserve → pay → confirm → fulfill', async () => {
    const reserved = orders.reserve({ skuId: 'api-access-pro', qty: 1, email: 'braos-test@zeusai.pro' });
    assert.strictEqual(reserved.status, 'reserved');
    assert.ok(String(reserved.btcAddress).startsWith('bc1q'));
    const paid = await orders.attachPayment(reserved.id, { method: 'btc' });
    assert.ok(paid.payment);
    assert.strictEqual(paid.order.status, 'awaiting_payment');
    const done = orders.confirmPaid(reserved.id, { admin: true, txid: 'test_tx' });
    assert.strictEqual(done.order.status, 'fulfilled');
    assert.ok(done.fulfillment.entitlementId);
  });

  await check('enterpriseSales lead → offer', async () => {
    const lead = enterprise.ingestLead({
      company: 'Acme Orbital',
      email: 'cfo@acme.test',
      acvUsd: 120000,
    });
    const deal = await enterprise.createOffer(lead.id);
    assert.ok(deal.id);
    assert.ok(deal.acvUsd >= 1000);
    assert.ok(deal.contract);
    assert.ok(String(deal.btcAddress).startsWith('bc1q'));
  });

  await check('BRAOS startAll arms modules + capacity model honesty', () => {
    const mods = braos.startAll();
    assert.ok(mods.qpn);
    assert.ok(mods.catalog && mods.catalog.active !== false);
    assert.ok(mods.orders);
    const model = braos.capacityModel();
    assert.ok(model.capacityUsdYear > 1e9, 'capacity ceiling should exceed $1B/yr theoretical');
    assert.ok(model.honesty && model.realisticUsdYear >= 0);
    assert.ok(model.skuCount >= 10);
    assert.ok(String(model.btcAddress).startsWith('bc1q'));
  });

  await check('BRAOS mounts public aliases on express', async () => {
    const app = express();
    app.use(express.json());
    braos.mountAliases(app, {
      adminMiddleware: (req, res, next) => next(),
      authMiddleware: (req, res, next) => next(),
    });
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const get = (path) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path }, (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => resolve({ code: res.statusCode, body: b }));
      }).on('error', reject);
    });
    const braosStatus = await get('/api/braos');
    assert.strictEqual(braosStatus.code, 200);
    assert.ok(braosStatus.body.includes('BRAOS/1.0'));
    const products = await get('/api/catalog/products');
    assert.strictEqual(products.code, 200);
    const payBtc = await get('/api/pay/btc');
    assert.strictEqual(payBtc.code, 200);
    assert.ok(payBtc.body.includes('bc1q4f7e66'));
    await new Promise((r) => server.close(r));
  });

  console.log('billion-revenue-activation-os.test.js: ' + passed + ' passed');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
