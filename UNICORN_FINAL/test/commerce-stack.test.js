// test/commerce-stack.test.js
// Smoke tests for the freshly-restored commerce subsystems:
//   customer-portal, uaic, product-engine, provisioner.
// Bilingual tags (EN/RO) preserved.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Reset persistent state so the test is hermetic.
const DATA_DIR = path.join(__dirname, '..', 'data', 'commerce');
const DELIV_DIR = path.join(__dirname, '..', 'logs', 'deliverables');
for (const f of ['portal.json','portal.sqlite','portal.sqlite-wal','portal.sqlite-shm','uaic-receipts.jsonl','uaic-entitlements.jsonl']) {
  try { fs.rmSync(path.join(DATA_DIR, f), { force: true }); } catch (_) {}
}
try { fs.rmSync(DELIV_DIR, { recursive: true, force: true }); } catch (_) {}

const portal = require('../src/commerce/customer-portal');
const uaic = require('../src/commerce/uaic');
const productEngine = require('../src/commerce/product-engine');
const provisioner = require('../src/commerce/provisioner');

async function run() {
  // ── customer-portal ─────────────────────────────────────────────────
  portal._resetForTests();
  const sign = portal.signup('alice@example.com', 'hunter1234', 'Alice');
  assert.equal(sign.ok, true);
  assert.ok(sign.token && sign.token.split('.').length === 3, 'token has JWT-like 3 parts');
  assert.ok(sign.customer.id.startsWith('cust_'));

  // duplicate signup blocked
  assert.throws(() => portal.signup('alice@example.com', 'hunter1234'), /email_taken/);

  // login + verify token
  const log1 = portal.login('alice@example.com', 'hunter1234');
  assert.equal(log1.ok, true);
  const cid = portal.verifyToken(log1.token);
  assert.equal(cid, log1.customer.id);

  // PM2 cluster regression: another worker can write a customer row directly
  // into the SQLite portal database while this process has stale in-memory
  // cache; login must read from the canonical store. With the WAL backend the
  // cross-worker visibility comes for free; we still assert the contract.
  let externalLoginVerified = false;
  try {
    const Database = require('better-sqlite3');
    const sqlitePath = path.join(DATA_DIR, 'portal.sqlite');
    const db = new Database(sqlitePath);
    const aliceRow = db.prepare("SELECT password_hash FROM customers WHERE email = ?").get('alice@example.com');
    if (aliceRow && aliceRow.password_hash) {
      db.prepare("INSERT INTO customers (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)")
        .run('cust_external_worker','external-worker@example.com','External Worker', aliceRow.password_hash, new Date().toISOString());
      db.close();
      const externalLogin = portal.login('external-worker@example.com', 'hunter1234');
      assert.equal(externalLogin.customer.id, 'cust_external_worker');
      externalLoginVerified = true;
    } else {
      db.close();
    }
  } catch (e) {
    // SQLite backend not active (rare fallback path); fall back to JSON tampering.
    const portalFile = path.join(DATA_DIR, 'portal.json');
    if (fs.existsSync(portalFile)) {
      const diskState = JSON.parse(fs.readFileSync(portalFile, 'utf8'));
      const aliceRaw = diskState.customers.find(c => c.email === 'alice@example.com');
      diskState.customers.push({
        id: 'cust_external_worker',
        email: 'external-worker@example.com',
        name: 'External Worker',
        passwordHash: aliceRaw.passwordHash,
        createdAt: new Date().toISOString(),
        apiKeys: []
      });
      fs.writeFileSync(portalFile, JSON.stringify(diskState, null, 2));
      const externalLogin = portal.login('external-worker@example.com', 'hunter1234');
      assert.equal(externalLogin.customer.id, 'cust_external_worker');
      externalLoginVerified = true;
    }
  }
  assert.equal(externalLoginVerified, true, 'cross-worker login must succeed via SQLite or JSON fallback');

  // wrong password / unknown email
  assert.throws(() => portal.login('alice@example.com', 'wrong'), /wrong_password/);
  assert.throws(() => portal.login('nobody@example.com', 'hunter1234'), /email_not_found/);

  // verifyToken rejects forged tokens
  assert.equal(portal.verifyToken('bad.token.here'), null);
  assert.equal(portal.verifyToken(log1.token + 'x'), null);

  // orders
  const o1 = portal.createOrder({ customerId: cid, productId: 'starter', priceUSD: 49, btcAmount: 0.0005, btcAddress: 'bc1qtest', invoiceUri: 'bitcoin:bc1qtest?amount=0.0005' });
  assert.ok(o1.id.startsWith('ord_'));
  assert.equal(o1.status, 'awaiting_payment');
  assert.equal(portal.getOrder(o1.id).id, o1.id);
  portal.updateOrder(o1.id, { status: 'pending' });
  assert.equal(portal.getOrder(o1.id).status, 'pending');
  const list = portal.listOrdersByCustomer(cid);
  assert.equal(list.length, 1);

  // API keys
  const k = portal.issueApiKey(cid, 'starter', o1.id);
  assert.ok(k && k.key.startsWith('unc_'));
  const found = portal.findByApiKey(k.key);
  assert.equal(found && found.customer.id, cid);

  // backend bridge
  const bridged = portal.upsertFromBackend({ email: 'bob@example.com', name: 'Bob', password: 'hunter1234' });
  assert.equal(bridged.customer.email, 'bob@example.com');
  // Re-bridging same email should not create duplicate.
  const bridged2 = portal.upsertFromBackend({ email: 'bob@example.com', password: 'hunter1234' });
  assert.equal(bridged2.customer.id, bridged.customer.id);

  // public view never leaks the password hash
  const pub = portal.publicCustomer(portal.getById(cid));
  assert.ok(!('passwordHash' in pub));

  console.log('[ok] customer-portal');

  // ── uaic ────────────────────────────────────────────────────────────
  uaic._resetForTests();
  // convert
  const btc = uaic.convert(95000, 'BTC');
  assert.ok(btc > 0 && btc < 5, 'convert returns plausible BTC at 95k spot');
  assert.equal(uaic.convert(100, 'USD'), 100);

  // Persist a paid receipt → entitlement is auto-issued.
  const receipt = {
    id: 'rcpt_test_1',
    method: 'BTC',
    plan: 'pro',
    amount: 199,
    currency: 'USD',
    email: 'alice@example.com',
    customerId: cid,
    services: ['svc-a', 'svc-b'],
    createdAt: new Date().toISOString(),
    status: 'paid',
    paidAt: new Date().toISOString()
  };
  uaic.persistReceipt(receipt);
  const reps = uaic.getReceipts();
  assert.equal(reps.length, 1);
  assert.equal(reps[0].id, 'rcpt_test_1');

  const byEmail = uaic.listEntitlementsByEmail('alice@example.com');
  assert.equal(byEmail.length, 1);
  assert.deepEqual(byEmail[0].serviceIds, ['svc-a','svc-b']);
  const byCust = uaic.listEntitlementsByCustomer(cid);
  assert.equal(byCust.length, 1);

  // Re-persisting same receipt does NOT issue a duplicate entitlement.
  uaic.persistReceipt(receipt);
  assert.equal(uaic.listEntitlementsByEmail('alice@example.com').length, 1);

  // license issuance
  const lic = uaic.issueLicense(receipt);
  assert.ok(lic.token && lic.token.includes('.'));
  assert.ok(['Ed25519','HS256','sha256'].includes(lic.alg));

  // catalog builder
  const cat = uaic.buildCatalog({ marketplace: [{ id:'m1', title:'Module 1', priceUSD: 10 }], industries: [{ id:'i1', title:'Industry 1', priceUSD: 20 }] });
  assert.equal(cat.length, 2);
  assert.equal(cat[0].group, 'marketplace');

  // matches / handle
  assert.equal(uaic.matches('/api/uaic/order'), true);
  assert.equal(uaic.matches('/api/random'), false);

  console.log('[ok] uaic');

  // ── product-engine sandbox ──────────────────────────────────────────
  productEngine.writeDeliverable(o1.id, 'license.json', JSON.stringify({ ok:true }));
  const buf = productEngine.readDeliverable(o1.id, 'license.json');
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(JSON.parse(buf.toString()).ok, true);
  // path traversal blocked
  assert.throws(() => productEngine.readDeliverable(o1.id, '../../etc/passwd'), /forbidden_filename/);
  assert.throws(() => productEngine.readDeliverable(o1.id, 'sub/file'), /forbidden_filename/);
  assert.throws(() => productEngine.readDeliverable('../traversal', 'license.json'), /forbidden_orderId/);
  // missing file
  assert.throws(() => productEngine.readDeliverable(o1.id, 'missing.json'), /deliverable_not_found/);

  console.log('[ok] product-engine');

  // ── provisioner end-to-end ──────────────────────────────────────────
  // Fresh order to settle.
  const o2 = portal.createOrder({ customerId: cid, productId: 'starter', priceUSD: 49 });
  const settled = await provisioner.handleWebhookSettle({ orderId: o2.id, txRef: 'btc:tx123' });
  assert.equal(settled.status, 'delivered');
  assert.equal(settled.paidAt && typeof settled.paidAt, 'string');
  assert.ok(Array.isArray(settled.deliverables) && settled.deliverables.length >= 1);
  // Deliverable readable by product-engine.
  const recBuf = productEngine.readDeliverable(o2.id, settled.deliverables[0].name);
  const recJson = JSON.parse(recBuf.toString());
  assert.equal(recJson.orderId, o2.id);
  assert.equal(recJson.txRef, 'btc:tx123');

  // Idempotency: settling again does not duplicate deliverables or change paidAt.
  const firstPaidAt = settled.paidAt;
  const settled2 = await provisioner.handleWebhookSettle({ orderId: o2.id, txRef: 'btc:tx123' });
  assert.equal(settled2.paidAt, firstPaidAt);
  assert.equal(settled2.deliverables.length, settled.deliverables.length);

  // Manual fulfill on a third order.
  const o3 = portal.createOrder({ customerId: cid, productId: 'starter', priceUSD: 49 });
  const m = await provisioner.markPaidManual(o3.id, 'admin-test');
  assert.equal(m.status, 'delivered');

  // Unknown order rejected.
  await assert.rejects(provisioner.handleWebhookSettle({ orderId: 'ord_does_not_exist', txRef: 'x' }), /order_not_found/);

  console.log('[ok] provisioner');

  console.log('commerce-stack test passed');
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
