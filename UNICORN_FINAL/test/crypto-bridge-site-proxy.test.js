'use strict';

const assert = require('assert');
const http = require('http');

async function run() {
  const backendApp = require('../backend/index');
  const backendServer = http.createServer(backendApp);
  await new Promise((resolve) => backendServer.listen(0, '127.0.0.1', resolve));
  const backendPort = backendServer.address().port;
  process.env.BACKEND_API_URL = 'http://127.0.0.1:' + backendPort;

  const siteModule = require('../src/index');
  const createSite = typeof siteModule.createServer === 'function' ? siteModule.createServer : null;
  assert.ok(createSite, 'src/index.js must export createServer');
  const siteServer = createSite();
  await new Promise((resolve) => siteServer.listen(0, '127.0.0.1', resolve));
  const sitePort = siteServer.address().port;
  const siteBase = 'http://127.0.0.1:' + sitePort;

  try {
    const pageRes = await fetch(siteBase + '/crypto-fiat-bridge');
    const pageHtml = await pageRes.text();
    assert.equal(pageRes.status, 200, 'crypto bridge page should return 200');
    assert.ok(pageHtml.includes('Crypto Bridge'), 'page should contain Crypto Bridge heading');
    assert.ok(pageHtml.includes('Best-path calculator'), 'page should contain smart routing calculator');

    const aliasRes = await fetch(siteBase + '/crypto-bridge', { redirect: 'manual' });
    assert.equal(aliasRes.status, 302, 'legacy alias should redirect');
    assert.equal(aliasRes.headers.get('location'), '/crypto-fiat-bridge', 'legacy alias should redirect to canonical route');

    const servicesRes = await fetch(siteBase + '/api/crypto-bridge/services');
    const services = await servicesRes.json();
    assert.equal(servicesRes.status, 200, 'site proxy should expose crypto bridge services');
    assert.ok(Array.isArray(services.services), 'services payload should contain array');
    assert.equal(services.services.length, 8, 'services payload should expose 8 services');

    const rateRes = await fetch(siteBase + '/api/crypto-bridge/btc-rate');
    const rateBody = await rateRes.json();
    assert.equal(rateRes.status, 200, 'site proxy should expose btc-rate');
    assert.ok(Number(rateBody.rate || rateBody.btcUsd) > 0, 'btc-rate should be positive');

    const smartRes = await fetch(siteBase + '/api/crypto-bridge/smart-routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        amount: 0.01,
        currency: 'BTC'
      })
    });
    const smartBody = await smartRes.json();
    assert.equal(smartRes.status, 200, 'site proxy should expose smart-routing');
    assert.equal(smartBody.ok, true, 'smart-routing should return ok:true');
    assert.ok(smartBody.cards && smartBody.cards.feeLock, 'smart-routing should include feeLock card');

    console.log('✓ crypto-bridge-site-proxy.test.js — page route, alias, GET/POST site proxy: OK');
  } finally {
    await new Promise((resolve) => siteServer.close(() => resolve()));
    await new Promise((resolve) => backendServer.close(() => resolve()));
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('✗ crypto-bridge-site-proxy.test.js failed:', err);
  process.exit(1);
});
