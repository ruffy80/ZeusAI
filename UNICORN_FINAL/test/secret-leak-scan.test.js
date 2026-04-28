/**
 * secret-leak-scan.test.js — sanity-check that high-value owner secrets
 * never appear in process logs produced by booting the site server.
 *
 * Strictly additive · read-only on production code paths.
 *
 * The test plants tagged "canary" values in environment variables that the
 * server is known to read (Stripe / PayPal / generic). It then captures
 * everything written to console.log / console.warn / console.error during
 * boot and asserts that none of the canary values appear verbatim. This
 * catches accidental `console.log(process.env.STRIPE_SECRET_KEY)` style
 * regressions before they hit production logs.
 */

'use strict';

const assert = require('assert');

const CANARIES = {
  STRIPE_SECRET_KEY: 'sk_test_CANARY_STRIPE_' + Math.random().toString(36).slice(2, 12),
  PAYPAL_CLIENT_SECRET: 'PAYPAL_CANARY_' + Math.random().toString(36).slice(2, 12),
  ADMIN_MASTER_PASSWORD: 'ADMIN_CANARY_' + Math.random().toString(36).slice(2, 12),
  JWT_SECRET: 'JWT_CANARY_' + Math.random().toString(36).slice(2, 12),
  HUGGINGFACE_API_KEY: 'HF_CANARY_' + Math.random().toString(36).slice(2, 12),
  OPENAI_API_KEY: 'sk-CANARY_OPENAI_' + Math.random().toString(36).slice(2, 12)
};

for (const [k, v] of Object.entries(CANARIES)) process.env[k] = v;

// Capture all console output.
const captured = [];
const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
function cap(level) {
  return function () {
    try {
      const parts = [];
      for (const a of arguments) {
        try { parts.push(typeof a === 'string' ? a : JSON.stringify(a)); }
        catch (_) { parts.push(String(a)); }
      }
      captured.push('[' + level + '] ' + parts.join(' '));
    } catch (_) {}
    orig[level].apply(console, arguments);
  };
}
console.log = cap('log');
console.warn = cap('warn');
console.error = cap('error');
console.info = cap('info');

// Boot the server (this is what production does on startup).
const server = require('../src/index');

async function run() {
  await new Promise((resolve) => server.listen(0, resolve));
  // Hit a couple of endpoints to make sure we capture any per-request logs.
  const { port } = server.address();
  await fetch('http://127.0.0.1:' + port + '/health').catch(() => {});
  await fetch('http://127.0.0.1:' + port + '/snapshot').catch(() => {});

  // Restore console for clean output afterwards.
  console.log = orig.log;
  console.warn = orig.warn;
  console.error = orig.error;
  console.info = orig.info;

  const blob = captured.join('\n');
  const leaks = [];
  for (const [k, v] of Object.entries(CANARIES)) {
    if (blob.indexOf(v) !== -1) leaks.push(k);
  }
  if (leaks.length) {
    console.error('Captured log sample (last 20 lines):');
    for (const l of captured.slice(-20)) console.error('  ' + l);
  }
  assert.deepStrictEqual(leaks, [], 'No secret canary value should appear in boot logs (leaks=' + leaks.join(',') + ')');

  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  console.log('✅ secret-leak-scan.test.js passed');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
