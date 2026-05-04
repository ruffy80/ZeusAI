// Crypto Transfer Intelligence Suite — structural + offline-safe tests.
// All external API calls are best-effort: when the network is offline, the
// module returns degraded but well-shaped JSON. We assert on shape + rules,
// never on live numeric values.

const assert = require('assert');
const express = require('express');

// Hermetic test: cryptoBridge captures ADMIN_SECRET / OPERATOR_TOKEN at
// module-load time (see backend/modules/cryptoBridge/index.js:48). In CI the
// deploy workflow exports ADMIN_SECRET at job level, which would otherwise
// flip /admin/revenue to 401 and break the assertion at line ~109. Clear the
// env vars BEFORE require() so the in-process module sees "no secret".
delete process.env.ADMIN_SECRET;
delete process.env.OPERATOR_TOKEN;

const cb = require('../backend/modules/cryptoBridge');

async function run() {
  // 1. Pure functions never throw, always return an object with `service`
  const services = cb.listServices();
  assert.ok(Array.isArray(services.services), 'listServices.services array');
  assert.equal(services.services.length, 8, 'must expose exactly 8 services');
  assert.ok(services.ownerBtcAddress, 'ownerBtcAddress present');

  const h = cb.health();
  assert.equal(h.ok, true, 'health.ok');
  assert.equal(h.services, 8);

  // 2. Invariant: module never stores private keys / never holds balance.
  // Source-level assertion: scan the module file for forbidden tokens.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'modules', 'cryptoBridge', 'index.js'), 'utf8');
  for (const forbidden of ['privateKey', 'PRIVATE KEY', 'sendTransaction(', 'signTransaction(', 'mnemonic', 'seedPhrase']) {
    assert.ok(!src.includes(forbidden), 'crypto-bridge MUST NOT reference: ' + forbidden);
  }

  // 3. Validation paths return errors gracefully (no throw)
  const bumpBad = await cb.smartBump({ txid: 'not-a-hash' });
  assert.equal(bumpBad.error, 'invalid-or-missing-txid');

  const destBad = await cb.destinationCheck({});
  assert.equal(destBad.error, 'address-required');

  const liqBad = await cb.liquidityUnlock({ address: 'nope' });
  assert.equal(liqBad.error, 'eth-address-required');

  const batchBad = await cb.batchTx({ items: [] });
  assert.equal(batchBad.error, 'items-array-required');

  // 4. MEV protection is pure logic (no external network) — must always work
  const mev = await cb.mevProtection({ amountEth: 2 });
  assert.equal(mev.service, 'mev-protection');
  assert.equal(mev.recommended, true, '2 ETH must trigger MEV protection');
  assert.equal(mev.ourCommissionUsd, 5);
  const mevSmall = await cb.mevProtection({ amountEth: 0.1 });
  assert.equal(mevSmall.recommended, false);

  // 5. Smart routing always returns a structurally valid object even when
  //    every external call fails (offline-safe).
  const sr = await cb.smartRouting({
    address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    amount: 0.01,
    currency: 'BTC',
    maxWaitHours: 2,
  });
  assert.equal(sr.ok, true);
  assert.ok(sr.requestId);
  assert.ok(sr.cards && typeof sr.cards === 'object');
  for (const k of ['feeLock', 'smartBump', 'destinationCheck', 'liquidityUnlock', 'atomicSwap', 'mevProtection', 'batchTx', 'timeLockedRefund']) {
    assert.ok(k in sr.cards, 'card present: ' + k);
  }
  assert.ok(typeof sr.totalFeeUsd === 'number');
  assert.ok(typeof sr.ourCommissionUsd === 'number');
  assert.ok(sr.feeInvoiceTo, 'fee invoice destination set');
  assert.ok(sr.disclaimer && sr.disclaimer.includes('Non-custodial'));

  // 6. Revenue summary returns a stable shape
  const rev = cb.revenueSummary();
  assert.ok(rev.ownerBtcAddress);
  assert.ok(typeof rev.totalTransactions === 'number');
  assert.ok(rev.cardUsage && typeof rev.cardUsage === 'object');
  assert.ok(Array.isArray(rev.last7Days));
  assert.equal(rev.last7Days.length, 7);

  // 7. mount() exposes routes on a real Express app
  const app = express();
  app.use(express.json());
  cb.mount(app);
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const get = async u => {
    const r = await fetch('http://127.0.0.1:' + port + u);
    return { status: r.status, body: await r.json() };
  };
  const a = await get('/api/crypto-bridge/health');
  assert.equal(a.status, 200);
  assert.equal(a.body.ok, true);
  const b = await get('/api/crypto-bridge/services');
  assert.equal(b.status, 200);
  assert.equal((b.body.services || []).length, 8);

  // POST smart-routing
  const postRes = await fetch('http://127.0.0.1:' + port + '/api/crypto-bridge/smart-routing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', amount: 0.001, currency: 'BTC', maxWaitHours: 1 }),
  });
  assert.equal(postRes.status, 200);
  const postBody = await postRes.json();
  assert.equal(postBody.ok, true);

  // /admin/revenue (no ADMIN_SECRET in test env → open access)
  const rev2 = await get('/admin/revenue');
  assert.equal(rev2.status, 200);
  assert.ok(rev2.body.ownerBtcAddress);

  await new Promise(resolve => server.close(resolve));

  console.log('✓ crypto-bridge.test.js — all 8 services, smart routing, revenue, mount: OK');
}

run().catch(err => {
  console.error('✗ crypto-bridge.test.js failed:', err);
  process.exit(1);
});
