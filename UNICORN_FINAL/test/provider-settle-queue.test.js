'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-settle-queue-'));
process.env.COMMERCE_DATA_DIR = dataDir;
process.env.UNICORN_SITE_INTERNAL_URL = 'http://127.0.0.1:3001';

const queueFile = path.join(dataDir, 'settle-queue.jsonl');
const legacy = {
  id: 'psq_legacy12345678',
  orderId: 'ord_legacy01',
  provider: 'paypal',
  providerRef: 'capture_legacy',
  amountUsd: 49,
  attempts: 8,
  createdAt: new Date(Date.now() - 60000).toISOString(),
  discardedAt: new Date().toISOString(),
  error: 'legacy_settle_failure',
  event: 'discarded',
};
const cappedRetry = {
  id: 'psq_cappedfailure1234',
  orderId: 'ord_capfail01',
  provider: 'nowpayments',
  providerRef: 'payment_capped',
  amountUsd: 59,
  attempts: 7,
  totalAttempts: 7,
  retryCount: 0,
  nextAttemptAt: Date.now() - 1000,
  createdAt: new Date(Date.now() - 60000).toISOString(),
  event: 'retry_scheduled',
};
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(queueFile, JSON.stringify(legacy) + '\n' + JSON.stringify(cappedRetry) + '\n');

const originalFetch = global.fetch;
global.fetch = async () => new Response(JSON.stringify({ error: 'temporary_settle_failure' }), {
  status: 503,
  headers: { 'content-type': 'application/json' },
});
const queue = require('../src/commerce/provider-settle-queue');
queue.start();
assert.equal(queue.getStatus().deadLettered, 1, 'legacy discarded records must remain recoverable');
assert.equal(queue.getDeadLetters()[0].orderId, legacy.orderId);

function waitFor(predicate, timeoutMs) {
  const end = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) return resolve();
      if (Date.now() >= end) return reject(new Error('settlement queue condition timed out'));
      setTimeout(poll, 5);
    };
    poll();
  });
}

async function run() {
  try {
    await waitFor(() => queue.getStatus().deadLettered === 2, 2000);
    assert.equal(queue.getDeadLetters().find((item) => item.id === cappedRetry.id).attempts, 8,
      'the eighth failed attempt must be preserved for recovery');
    global.fetch = async () => new Response(JSON.stringify({ error: 'settle_auth_invalid' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
    const enqueued = queue.enqueue({
      orderId: 'ord_failed01',
      provider: 'nowpayments',
      providerRef: 'payment_failed',
      amountUsd: 29,
      meta: { sensitivePayload: 'must-not-be-listed' },
    });
    await queue.processQueue();

    let status = queue.getStatus();
    assert.equal(status.pending, 0);
    assert.equal(status.deadLettered, 3, 'permanent settlement errors must remain recoverable');
    assert.ok(status.oldestDeadLetterAgeMs >= 0);

    const failed = queue.getDeadLetters().find((item) => item.id === enqueued.id);
    assert.equal(failed.lastError, 'settle_auth_invalid');
    assert.equal('meta' in failed, false, 'operator summary must not return provider payloads');
    assert.equal(queue.retryDeadLetter('not-a-queue-id').reason, 'invalid_id');

    const retried = queue.retryDeadLetter(enqueued.id);
    assert.equal(retried.ok, true);
    assert.equal(retried.retryCount, 1);
    assert.equal(queue.getStatus().pending, 1);

    global.fetch = async () => new Response(JSON.stringify({ ok: true, settled: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    await queue.processQueue();

    status = queue.getStatus();
    assert.equal(status.pending, 0);
    assert.equal(status.deadLettered, 2, 'successful retry should resolve only its dead letter');
    const events = fs.readFileSync(queueFile, 'utf8');
    assert.match(events, /"event":"dead_lettered"/);
    assert.match(events, /"event":"retry_requeued"/);
    assert.match(events, /"event":"settled"/);
    const restored = spawnSync(process.execPath, ['-e',
      "const q=require('./src/commerce/provider-settle-queue');q.start();process.stdout.write(String(q.getStatus().deadLettered));"
    ], { cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8' });
    assert.equal(restored.status, 0);
    assert.equal(restored.stdout, '2', 'dead letters must remain visible after restart');
    console.log('provider-settle-queue.test.js: all assertions passed');
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
