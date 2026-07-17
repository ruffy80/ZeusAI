'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.ADMIN_MASTER_PASSWORD = 'TestAdmin2026!';
process.env.ADMIN_2FA_CODE = '999999';
process.env.PORT = process.env.PORT || '31992';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';
process.env.BTC_WALLET_ADDRESS = process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
process.env.FULFILLMENT_AI_ENABLED = '1';

for (const key of [
  'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
  'MISTRAL_API_KEY', 'COHERE_API_KEY', 'XAI_API_KEY', 'GROQ_API_KEY',
  'OPENROUTER_API_KEY', 'PERPLEXITY_API_KEY', 'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY', 'SAMBANOVA_API_KEY', 'NVIDIA_NIM_API_KEY',
  'HF_API_KEY'
]) delete process.env[key];

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commerce-reality-'));
process.env.UNICORN_DATA_DIR = path.join(tmpRoot, 'site-data');
process.env.UNICORN_RECEIPTS_FILE = path.join(tmpRoot, 'site-data', 'commerce-receipts.json');
process.env.POD_LEDGER_PATH = path.join(tmpRoot, 'ledgers', 'proof-of-delivery.jsonl');
process.env.GLOBAL_REFERRAL_LOOP_STATE_PATH = path.join(tmpRoot, 'referrals', 'state.json');

const { createServer } = require('../src/index');
const proofOfDeliveryLedger = require('../backend/modules/proof-of-delivery-ledger');
const referralLoop = require('../backend/modules/global-referral-loop');

let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('  ✓', name);
}

async function request(base, requestPath, options = {}) {
  const res = await fetch(base + requestPath, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  return { status: res.status, body, text, headers: res.headers };
}

async function waitFor(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (lastError) throw lastError;
  throw new Error(`timeout waiting for ${label}`);
}

async function run() {
  referralLoop._resetForTests();
  proofOfDeliveryLedger._resetForTests();

  const app = createServer();
  const port = Number(process.env.PORT);
  const base = `http://127.0.0.1:${port}`;
  await new Promise((resolve) => app.listen(port, '127.0.0.1', resolve));

  try {
    await check('deterministic fulfillment attaches activation pack and records proof ledger without AI keys', async () => {
      const order = await request(base, '/api/uaic/order', {
        method: 'POST',
        body: JSON.stringify({ method: 'BTC', plan: 'adaptive-ai', amount_usd: 499, email: 'buyer@example.com' })
      });
      assert.strictEqual(order.status, 200);
      assert.strictEqual(order.body.ok, true);
      const receiptId = order.body.receipt.id;

      const confirm = await request(base, '/api/payments/btc/confirm', {
        method: 'POST',
        body: JSON.stringify({ receiptId, txid: 'reality-test-loopback', amount: 499 })
      });
      assert.strictEqual(confirm.status, 200);
      assert.strictEqual(confirm.body.ok, true);
      assert.strictEqual(confirm.body.receipt.status, 'paid');

      const artifacts = await waitFor(async () => {
        const delivery = await request(base, `/api/delivery/${encodeURIComponent(receiptId)}?format=artifacts`);
        if (delivery.status !== 200 || !delivery.body || !delivery.body.delivery) return null;
        if (delivery.body.delivery.fulfillmentStatus !== 'deterministic') return null;
        if (!Array.isArray(delivery.body.delivery.artifacts) || delivery.body.delivery.artifacts.length === 0) return null;
        return delivery.body.delivery;
      }, 5000, 'deterministic artifacts');

      assert.strictEqual(artifacts.fulfillmentStatus, 'deterministic');
      assert.strictEqual(artifacts.artifacts[0].generatedBy, 'deterministic-engine');
      assert.ok(String(artifacts.artifacts[0].filename || '').includes('service-activation-pack'));

      const activationPack = await request(base, `/api/delivery/${encodeURIComponent(receiptId)}?format=artifact&serviceId=adaptive-ai`);
      assert.strictEqual(activationPack.status, 200);
      assert.match(activationPack.text, /# Service Activation Pack/);
      assert.match(activationPack.text, new RegExp(receiptId));
      assert.match(activationPack.text, /Service ID: adaptive-ai/);
      assert.match(activationPack.text, /Download Instructions/);
      assert.match(activationPack.text, /Transaction IDs: reality-test-loopback/);

      const ledgerStatus = await waitFor(() => {
        const status = proofOfDeliveryLedger.getStatus();
        return status.entries > 0 ? status : null;
      }, 5000, 'proof-of-delivery ledger entry');

      assert.ok(ledgerStatus.entries >= 1);
      const latest = proofOfDeliveryLedger.list(1)[0];
      assert.strictEqual(latest.orderId, receiptId);
      assert.ok(Array.isArray(latest.artifactHashes) && latest.artifactHashes.length >= 3);
      assert.strictEqual(proofOfDeliveryLedger.verifyChain().ok, true);
    });

    await check('global referral loop creates codes, tracks referrals, and credits paid orders', async () => {
      const code = referralLoop.createCode('referrer-123');
      assert.ok(code.code.startsWith('REF-'));

      const tracked = referralLoop.trackReferral(code.code, 'buyer-456');
      assert.strictEqual(tracked.status, 'tracked');
      assert.strictEqual(tracked.referrerUserId, 'referrer-123');

      const attributed = referralLoop.attributePaidOrder('ord-ref-001', 250, code.code);
      assert.strictEqual(attributed.code, code.code);
      assert.strictEqual(attributed.amountUsd, 250);
      assert.strictEqual(attributed.rewardCredit, 25);
      assert.strictEqual(attributed.rewardUnit, 'USD_CREDIT');

      const state = JSON.parse(fs.readFileSync(process.env.GLOBAL_REFERRAL_LOOP_STATE_PATH, 'utf8'));
      assert.strictEqual(state.creditLedger.length, 1);
      assert.strictEqual(state.creditLedger[0].rewardCredit, 25);
      assert.strictEqual(state.userCredits['referrer-123'].balance, 25);
      assert.strictEqual(state.referrals[0].status, 'converted');

      const status = referralLoop.getStatus();
      assert.strictEqual(status.module, 'global-referral-loop');
      assert.strictEqual(status.codes, 1);
      assert.strictEqual(status.attributedOrders, 1);
      assert.strictEqual(status.totalCreditIssued, 25);

      const processed = await referralLoop.process({ action: 'status' });
      assert.strictEqual(processed.ok, true);
      assert.strictEqual(processed.status.module, 'global-referral-loop');
    });

    console.log(`\n✅ commerce-reality: ${passed} tests passed\n`);
  } finally {
    if (typeof app.closeAllConnections === 'function') {
      try { app.closeAllConnections(); } catch (_) {}
    }
    await new Promise((resolve) => app.close(() => resolve()));
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  }
}

run().then(() => process.exit(0)).catch((error) => {
  console.error('❌ commerce-reality.test.js failed:', error);
  process.exit(1);
});
