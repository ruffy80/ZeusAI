/**
 * btc.test.js — smoke tests for BTC invoicing + verifier + alerts.
 * Uses BTC_FX_OVERRIDE so no network is required.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

process.env.BTC_FX_OVERRIDE = '60000';
process.env.ADMIN_OWNER_BTC = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

// Isolate ledger storage to a tmp dir so we don't pollute repo data/.
const TMP_DATA = path.join(__dirname, '..', 'data', 'invoices');
// (the ledger uses ../../data/invoices relative to backend/modules; for the
// purposes of this smoke test we just clean up after ourselves)

const ledger    = require('../backend/modules/btcInvoiceLedger');
const verifier  = require('../backend/modules/btcPaymentVerifier');
const alerts    = require('../backend/modules/zacAlertChannel');

async function run() {
  // --- ledger ---
  const a = await ledger.createInvoice({ service: 'test-a', priceUsd: 49 });
  const b = await ledger.createInvoice({ service: 'test-b', priceUsd: 49 });
  assert.strictEqual(a.payoutAddress, process.env.ADMIN_OWNER_BTC, 'payout address');
  assert.strictEqual(a.priceUsd, 49);
  assert.notStrictEqual(a.amountSats, b.amountSats, 'invoices must have unique sats');
  assert.ok(a.amountBtc.match(/^\d+\.\d{8}$/), 'btc string format');
  console.log('[ok] ledger.createInvoice unique sats:', a.amountSats, '!=', b.amountSats);

  const got = ledger.getInvoice(a.id);
  assert.strictEqual(got.id, a.id);
  console.log('[ok] ledger.getInvoice round-trip');

  const paid = ledger.markPaid(a.id, { txid: 'deadbeef', confirmations: 1 });
  assert.strictEqual(paid.status, 'paid');
  assert.strictEqual(paid.txid, 'deadbeef');
  console.log('[ok] ledger.markPaid');

  const status = ledger.getStatus();
  assert.ok(status.paid >= 1, 'at least one paid');
  assert.ok(status.invoiceCount >= 2);
  console.log('[ok] ledger.getStatus:', status);

  // --- verifier (smoke: factory shape, do not start) ---
  const v = verifier.createPaymentVerifier({ address: ledger.PAYOUT_ADDRESS });
  assert.strictEqual(typeof v.start, 'function');
  assert.strictEqual(typeof v.tick,  'function');
  const vs = v.getStatus();
  assert.strictEqual(vs.address, ledger.PAYOUT_ADDRESS);
  assert.strictEqual(vs.running, false);
  console.log('[ok] verifier factory');

  // --- alerts (no webhooks configured, must skip gracefully) ---
  const r = await alerts.broadcast('smoke-test');
  assert.ok(r && (r.discord || r.telegram || r.error), 'alerts respond');
  const ast = alerts.getStatus();
  assert.strictEqual(typeof ast.discordConfigured, 'boolean');
  console.log('[ok] alerts.broadcast skip-when-unconfigured');

  // cleanup test invoices
  try {
    for (const inv of [a, b]) {
      const f = path.join(__dirname, '..', 'data', 'invoices', `${inv.id}.json`);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  } catch (_) {}

  console.log('✅ btc.test.js passed');
}

run().catch((e) => { console.error('❌ btc.test.js failed:', e); process.exit(1); });
