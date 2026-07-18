// =====================================================================
// zacc-dropship-os.test.js
// Contract test for the ZACC autonomous dropship OS backbone:
//   • curated physical catalogue (>= 20 SKUs, well-shaped);
//   • zone-based shipping quote engine (NA / EU / UK / OC / WORLD);
//   • OrderStore lifecycle: create → markPaid → markShipped + timeline;
//   • BtcPayments.createInvoice attaches order meta (email/shipping/token).
// Self-contained; uses only Node's built-in assert. No network, no framework.
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZACC_ENABLED = '0'; // do not start the autonomous loop in tests
// Keep order persistence off disk during the suite (avoid data/ churn).
const os = require('os');
const path = require('path');
process.env.ZACC_ORDERS_FILE = path.join(os.tmpdir(), 'zacc-orders-test-' + process.pid + '.json');

const assert = require('assert');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713 ' + name);
}

(async () => {
  // --- 1) Curated catalogue: >= 20 SKUs, correctly shaped ---------------
  const { CURATED_PRODUCTS, getCuratedCatalog } = require('../backend/modules/zacc/catalog-curated');
  check('curated catalogue carries >= 20 premium SKUs', () => {
    assert.ok(Array.isArray(CURATED_PRODUCTS), 'CURATED_PRODUCTS must be an array');
    assert.ok(CURATED_PRODUCTS.length >= 20, 'need at least 20 curated products, got ' + CURATED_PRODUCTS.length);
    for (const p of CURATED_PRODUCTS) {
      assert.ok(p.name && p.category, 'product needs name + category');
      assert.ok(Number(p.costUsd) > 0, 'product needs a positive cost');
      assert.ok(Number(p.shippingUsd) >= 0, 'product needs shipping cost');
      assert.ok(/^https:\/\/picsum\.photos\/seed\//.test(p.image), 'product image must be a picsum seed url');
      assert.equal(p.source, 'zeus-curated', 'source must be zeus-curated');
      assert.equal(p.supplier, 'manual', 'supplier must be manual');
      assert.equal(p.supplierRef, null, 'curated SKUs must have no supplierRef');
      assert.equal(p.demoOnly, true, 'curated SKUs must be demoOnly');
      assert.ok(Number(p.weightKg) > 0, 'product needs a weight');
      assert.equal(p.originCountry, 'CN', 'origin country must be CN');
    }
    const cats = new Set(CURATED_PRODUCTS.map(p => p.category));
    for (const c of ['electronics', 'home', 'fitness', 'beauty', 'pets', 'outdoor']) {
      assert.ok(cats.has(c), 'catalogue must cover the ' + c + ' category');
    }
    // getCuratedCatalog returns mutable clones (not the frozen originals).
    const clone = getCuratedCatalog();
    assert.equal(clone.length, CURATED_PRODUCTS.length, 'getCuratedCatalog must return all products');
    clone[0].costUsd = 999;
    assert.notEqual(CURATED_PRODUCTS[0].costUsd, 999, 'clones must not mutate the source list');
  });

  // --- 2) Shipping quote zones ------------------------------------------
  const shipping = require('../backend/modules/zacc/shipping');
  check('shipping quote resolves zones + never throws', () => {
    const args = { costUsd: 10, shippingUsdBase: 5, qty: 1, weightKg: 0.3 };
    const us = shipping.quote(Object.assign({ country: 'US' }, args));
    const de = shipping.quote(Object.assign({ country: 'DE' }, args));
    const gb = shipping.quote(Object.assign({ country: 'GB' }, args));
    const au = shipping.quote(Object.assign({ country: 'AU' }, args));
    const zz = shipping.quote(Object.assign({ country: 'ZZ' }, args));

    assert.equal(us.zone, 'NA', 'US must map to NA zone');
    assert.equal(de.zone, 'EU', 'DE must map to EU zone');
    assert.equal(gb.zone, 'UK', 'GB must map to UK zone');
    assert.equal(au.zone, 'OC', 'AU must map to OC zone');
    assert.equal(zz.zone, 'WORLD', 'unknown country falls back to WORLD');

    // Multipliers: NA is base (cheapest), WORLD is most expensive.
    assert.ok(us.shippingUsd <= de.shippingUsd, 'EU must cost >= NA');
    assert.ok(de.shippingUsd <= au.shippingUsd, 'OC must cost >= EU');
    assert.ok(au.shippingUsd <= zz.shippingUsd, 'WORLD must cost >= OC');

    // ETA windows present + totalUsd = item*qty + shipping.
    assert.ok(/\d+-\d+/.test(us.etaDays), 'etaDays must be a range');
    assert.equal(us.totalUsd, Math.round((10 * 1 + us.shippingUsd) * 100) / 100, 'totalUsd = item + shipping');

    // qty > 1 raises shipping but consolidates (< linear).
    const q3 = shipping.quote(Object.assign({ country: 'US', qty: 3 }, { costUsd: 10, shippingUsdBase: 5, weightKg: 0.3 }));
    assert.ok(q3.shippingUsd > us.shippingUsd, 'more units cost more to ship');
    assert.ok(q3.shippingUsd < us.shippingUsd * 3, 'consolidated shipping is sub-linear');

    // Garbage input never throws.
    const bad = shipping.quote(null);
    assert.equal(bad.zone, 'WORLD', 'null input falls back to WORLD without throwing');
    assert.equal(bad.shippingUsd, 0, 'null input yields 0 shipping');
  });

  // --- 3) OrderStore lifecycle: create → paid → shipped + timeline ------
  const { OrderStore } = require('../backend/modules/zacc/orders');
  check('order create → markPaid → markShipped drives a timeline', () => {
    const store = new OrderStore({ autoPersist: false });
    const order = store.create({
      productId: 'dropship-widget-abc123',
      productTitle: 'Test Widget',
      email: 'buyer@example.com',
      shipping: { name: 'A Buyer', address: '1 Test St', country: 'US' },
      qty: 2,
      amountUsd: 59.98,
      shippingUsd: 6.5,
      marginUsd: 20,
      invoiceId: 'inv-xyz',
      demoOnly: true,
    });
    assert.ok(/^ord_/.test(order.token), 'token must be prefixed ord_');
    assert.equal(order.status, 'created', 'new order status is created');
    assert.equal(store.getByToken(order.token).token, order.token, 'lookup by token');
    assert.equal(store.getByInvoiceId('inv-xyz').token, order.token, 'lookup by invoice id');

    store.linkInvoice(order.token, 'inv-xyz'); // idempotent link → awaiting_payment
    assert.equal(store.getByToken(order.token).status, 'awaiting_payment', 'link moves to awaiting_payment');

    const paid = store.markPaid('inv-xyz', { txid: 'deadbeef' });
    assert.equal(paid.status, 'paid', 'markPaid sets paid status');
    assert.equal(paid.txid, 'deadbeef', 'markPaid records txid');
    assert.ok(paid.paidAt, 'paidAt timestamp set');

    store.markRouted(order.token, { provider: 'manual-queue' });
    assert.equal(store.getByToken(order.token).status, 'fulfillment_queued', 'manual routing → queued');

    const shipped = store.markShipped(order.token, { carrier: 'DHL', number: 'TRACK123', note: 'left porch' });
    assert.equal(shipped.status, 'shipped', 'markShipped sets shipped status');
    assert.equal(shipped.carrier, 'DHL', 'carrier recorded');
    assert.equal(shipped.trackingNumber, 'TRACK123', 'tracking recorded');

    const events = shipped.timeline.map(t => t.event);
    for (const e of ['created', 'invoice_linked', 'paid', 'fulfillment_queued', 'shipped']) {
      assert.ok(events.includes(e), 'timeline must include ' + e);
    }

    store.appendTimeline(order.token, 'note', { text: 'hi' });
    assert.equal(store.getByToken(order.token).timeline.slice(-1)[0].event, 'note', 'appendTimeline adds custom events');

    const st = store.status();
    assert.equal(st.counts.shipped, 1, 'status counts one shipped order');
    assert.ok(st.revenuePaidUsd >= 59.98, 'status sums paid revenue');

    // Public view masks PII.
    const pub = store.publicView(order.token);
    assert.ok(pub.email && pub.email.includes('***'), 'public view masks email');

    // Persistence round-trip via toState/fromState.
    const store2 = new OrderStore({ autoPersist: false });
    store2.fromState(store.toState());
    assert.equal(store2.getByToken(order.token).status, 'shipped', 'fromState restores orders');
  });

  // --- 4) createInvoice accepts + attaches order meta -------------------
  const { BtcPayments } = require('../backend/modules/zacc/payments');
  await (async () => {
    const pay = new BtcPayments({});
    const inv = await pay.createInvoice('dropship-widget-abc123', 42.5, {
      email: 'buyer@example.com',
      shipping: { name: 'A Buyer', country: 'US' },
      qty: 2,
      orderToken: 'ord_test123',
      shippingUsd: 6.5,
    });
    check('createInvoice attaches email/shipping/qty/orderToken meta', () => {
      assert.equal(inv.email, 'buyer@example.com', 'invoice carries buyer email');
      assert.ok(inv.shipping && inv.shipping.country === 'US', 'invoice carries shipping');
      assert.equal(inv.qty, 2, 'invoice carries qty');
      assert.equal(inv.orderToken, 'ord_test123', 'invoice carries order token');
      assert.equal(inv.shippingUsd, 6.5, 'invoice carries shippingUsd');
      assert.equal(inv.amountUsd, 42.5, 'invoice amount preserved');
      assert.ok(inv.btcAddress, 'invoice carries a BTC address');
    });
    // Backward-compat: createInvoice still works with no meta arg.
    const bare = await pay.createInvoice('p2', 10);
    check('createInvoice remains backward-compatible without meta', () => {
      assert.equal(bare.email, null, 'no meta → null email');
      assert.equal(bare.qty, 1, 'no meta → qty defaults to 1');
    });
  })();

  console.log('\n\u2705 zacc-dropship-os: ' + passed + ' tests passed');
  process.exit(0);
})().catch((e) => {
  console.error('zacc-dropship-os test FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
