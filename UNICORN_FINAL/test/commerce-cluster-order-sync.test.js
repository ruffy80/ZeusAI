'use strict';

// Regression test for the sovereign-commerce cross-cluster order split-brain.
//
// `unicorn-site` runs as a PM2 cluster: each worker holds its own in-memory
// ORDERS map, while writes are appended to a single shared JSONL log
// (data/commerce/orders.jsonl). Before the fix, reads only ever consulted the
// local map, so an order created on worker A returned HTTP 404 `order_not_found`
// when the buyer's status/checkout poll round-robined to worker B. This test
// simulates worker A by appending records directly to the durable log (exactly
// as persistOrder does) and asserts that the loaded module (worker B) converges
// on them via syncOrdersFromLog().

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commerce-cluster-'));
process.env.COMMERCE_DATA_DIR = tmpRoot;
process.env.BTC_WALLET_ADDRESS = process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

const ORDERS_FILE = path.join(tmpRoot, 'orders.jsonl');

// worker B — loads with an empty log
const commerce = require('../src/site/sovereign-commerce');

function appendOrder(order) {
  // Mirror persistOrder(): one JSON object per line, newline-terminated.
  fs.appendFileSync(ORDERS_FILE, JSON.stringify(order) + '\n');
}

function makeOrder(id, overrides) {
  return Object.assign({
    orderId: id,
    serviceId: 'starter',
    serviceName: 'Starter',
    status: 'pending',
    amount_sats: 26000 + Math.floor(Math.random() * 900),
    currency: 'USD',
    subtotal_fiat: 18.42,
    receive_address: process.env.BTC_WALLET_ADDRESS,
    created_at: new Date().toISOString(),
    expires_at_ms: Date.now() + 60 * 60 * 1000,
    txids: [],
    confirmations: 0,
  }, overrides || {});
}

function run() {
  const id = 'ord_clustertest0001';

  // 1) Bug reproduction: an order created by "worker A" is invisible to the
  //    local map until we sync. (Without the fix this stays undefined forever
  //    and the status route returns 404.)
  assert.strictEqual(commerce.ORDERS.get(id), undefined, 'order should not exist before it is written');
  appendOrder(makeOrder(id, { amount_sats: 26123 }));
  assert.strictEqual(commerce.ORDERS.get(id), undefined, 'plain read must still miss (no auto-magic on the Map itself)');

  // 2) Fix: syncing the durable log makes the sibling worker converge.
  commerce.syncOrdersFromLog();
  const seen = commerce.ORDERS.get(id);
  assert.ok(seen, 'order must be visible after syncOrdersFromLog()');
  assert.strictEqual(seen.status, 'pending', 'status should be pending');
  assert.strictEqual(commerce.AMT_INDEX.get(26123), id, 'pending order should be indexed for the BTC watcher');

  // 3) Status transitions written by another worker propagate too.
  appendOrder(makeOrder(id, { amount_sats: 26123, status: 'paid', paid_at: new Date().toISOString() }));
  commerce.syncOrdersFromLog();
  assert.strictEqual(commerce.ORDERS.get(id).status, 'paid', 'paid transition should propagate');
  assert.strictEqual(commerce.AMT_INDEX.get(26123), undefined, 'settled order must release its sats slot');

  // 4) Monotonic guard: a stale/out-of-order pending line must NOT downgrade a
  //    settled order back to pending.
  appendOrder(makeOrder(id, { amount_sats: 26123, status: 'pending' }));
  commerce.syncOrdersFromLog();
  assert.strictEqual(commerce.ORDERS.get(id).status, 'paid', 'settled order must not be downgraded to pending');

  // 5) Idempotency / no-growth: calling sync again with no new bytes is a no-op
  //    and does not throw.
  const before = commerce.ORDERS.get(id).status;
  commerce.syncOrdersFromLog();
  assert.strictEqual(commerce.ORDERS.get(id).status, before, 'no-op sync must not change state');

  console.log('commerce-cluster-order-sync: OK');
}

try {
  run();
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
} catch (e) {
  console.error('commerce-cluster-order-sync: FAIL');
  console.error(e && e.stack || e);
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  process.exit(1);
}
