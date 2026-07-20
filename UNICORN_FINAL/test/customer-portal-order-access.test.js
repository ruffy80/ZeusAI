// test/customer-portal-order-access.test.js
// Covers the customer-portal helpers added for the customer order portal:
//   * listOrdersByEmail — email → orders lookup for /account UI
//   * signOrderAccessToken / verifyOrderAccessToken — short-signed token
//     that lets buyers open their delivery/artifact page from an email link
//     without a full account login (proof-of-purchase auth).
//
// Uses a temp DATA_DIR so the test never mutates the checked-in commerce DB.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unc-portal-'));
process.env.UNICORN_COMMERCE_DIR = tmpDir;
// Stable JWT secret so signed tokens are deterministic within the test.
process.env.JWT_SECRET = 'test-portal-secret-do-not-use-in-prod';

const portal = require('../src/commerce/customer-portal');
portal._resetForTests();

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); process.exit(1); }
}

async function main() {
  // Fixture: a real customer with two orders + one order for a different buyer
  const alice = portal.signup('alice@example.com', 'password123', 'Alice');
  const bob = portal.signup('bob@example.com', 'password123', 'Bob');
  const oA1 = portal.createOrder({ customerId: alice.customer.id, productId: 'starter', priceUSD: 99 });
  const oA2 = portal.createOrder({ customerId: alice.customer.id, productId: 'growth', priceUSD: 299 });
  const oB1 = portal.createOrder({ customerId: bob.customer.id, productId: 'starter', priceUSD: 99 });

  check('listOrdersByEmail returns only that customer\'s orders', () => {
    const aliceOrders = portal.listOrdersByEmail('alice@example.com');
    assert.equal(aliceOrders.length, 2, 'alice should see 2 orders');
    const ids = aliceOrders.map((o) => o.id).sort();
    assert.deepStrictEqual(ids, [oA1.id, oA2.id].sort());
    const bobOrders = portal.listOrdersByEmail('bob@example.com');
    assert.equal(bobOrders.length, 1);
    assert.equal(bobOrders[0].id, oB1.id);
  });

  check('listOrdersByEmail returns [] for unknown email (no PII leak)', () => {
    const none = portal.listOrdersByEmail('ghost@example.com');
    assert.deepStrictEqual(none, []);
  });

  check('listOrdersByEmail is case-insensitive', () => {
    const upper = portal.listOrdersByEmail('ALICE@EXAMPLE.COM');
    assert.equal(upper.length, 2);
  });

  // signOrderAccessToken / verifyOrderAccessToken --------------------------
  const tok = portal.signOrderAccessToken(oA1.id);
  check('signOrderAccessToken returns a JWT-shaped string for a real order', () => {
    assert.ok(typeof tok === 'string' && tok.split('.').length === 3);
  });
  check('signOrderAccessToken returns null for unknown order', () => {
    assert.strictEqual(portal.signOrderAccessToken('ord_does_not_exist'), null);
  });

  check('verifyOrderAccessToken accepts a fresh token for that order', () => {
    const v = portal.verifyOrderAccessToken(tok);
    assert.ok(v && v.orderId === oA1.id);
    assert.equal(v.customerId, alice.customer.id);
  });

  check('verifyOrderAccessToken rejects a garbage token', () => {
    assert.strictEqual(portal.verifyOrderAccessToken('nonsense.string.here'), null);
    assert.strictEqual(portal.verifyOrderAccessToken(''), null);
    assert.strictEqual(portal.verifyOrderAccessToken(null), null);
  });

  check('verifyOrderAccessToken rejects a signup-session token (wrong kind)', () => {
    // alice.token is a `cid` session token; verifyOrderAccessToken must NOT
    // accept it because kind !== 'order-access' (otherwise a stolen session
    // cookie could bypass order-scoped access).
    assert.strictEqual(portal.verifyOrderAccessToken(alice.token), null);
  });

  check('verifyOrderAccessToken rejects an expired token', () => {
    const shortLived = portal.signOrderAccessToken(oA1.id, { ttlMs: 1 });
    // Sleep 5ms — token TTL is 1ms.
    return new Promise((resolve) => setTimeout(() => {
      try { assert.strictEqual(portal.verifyOrderAccessToken(shortLived), null); resolve(); }
      catch (e) { console.error('  ✗ expired-token check', e); process.exit(1); }
    }, 5));
  });

  check('signOrderAccessToken with a different order yields a different token', () => {
    const t1 = portal.signOrderAccessToken(oA1.id);
    const t2 = portal.signOrderAccessToken(oA2.id);
    assert.notEqual(t1, t2, 'two orders should produce distinct tokens');
    // Cross-verify each token only unlocks its own order.
    assert.equal(portal.verifyOrderAccessToken(t1).orderId, oA1.id);
    assert.equal(portal.verifyOrderAccessToken(t2).orderId, oA2.id);
  });

  console.log('\n✅ customer-portal-order-access: ' + passed + ' tests passed');
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  process.exit(0);
}

main().catch((e) => { console.error('customer-portal-order-access FAILED:', e && e.stack || e); process.exit(1); });
