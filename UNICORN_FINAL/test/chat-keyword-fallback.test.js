'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fallback = require('../backend/modules/chat-keyword-fallback');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

check('payment names the live rail and does not invent ten more methods', () => {
  const got = fallback.replyFor('How do I pay?');
  assert.strictEqual(got.model, 'keyword-fallback');
  assert.strictEqual(got.degraded, true);
  assert.ok(got.reply.includes('Bitcoin is the live payment rail'));
  assert.ok(got.reply.includes('/pricing'));
  assert.ok(!/10\+/.test(got.reply));
});

check('platform does not match the old plat substring', () => {
  const got = fallback.replyFor('We need the platform license');
  assert.ok(got.reply.includes('public shelf'));
  assert.ok(!/10\+/.test(got.reply));
  assert.ok(!got.reply.includes('Stripe, PayPal'));
  const payload = fallback.replyFor('Inspect the payload schema');
  assert.ok(!payload.reply.includes('Bitcoin is the live payment rail'));
});

check('compliance does not claim HIPAA or SOX coverage', () => {
  const got = fallback.replyFor('Are you HIPAA and SOX compliant?');
  assert.ok(got.reply.includes('does not sell'));
  assert.ok(got.reply.includes('/refund'));
  assert.ok(!/25\+/.test(got.reply));
});

check('revenue does not claim autonomous deals', () => {
  const got = fallback.replyFor('How does revenue work?');
  assert.ok(got.reply.includes('does not generate deals'));
  assert.ok(got.reply.includes('/origin'));
  assert.ok(!/24\/7/.test(got.reply));
});

check('marketplace and pricing stay on the shelf contract', () => {
  const market = fallback.replyFor('Show me the marketplace');
  assert.ok(market.reply.includes('Dropship is paused'));
  const price = fallback.replyFor('What is the pricing?');
  assert.ok(price.reply.includes('does not deliver the license'));
});

check('blockchain and the default reply do not sell a quantum product', () => {
  const chain = fallback.replyFor('Do you sell a quantum blockchain?');
  assert.ok(chain.reply.includes('does not sell a quantum blockchain'));
  assert.ok(chain.reply.includes('/frontier'));
  const hello = fallback.replyFor('hello');
  assert.strictEqual(hello.reply, fallback.DEFAULT_REPLY);
  assert.ok(!hello.reply.toLowerCase().includes('blockchain'));
});

check('the chat route uses this table and the old claims are gone', () => {
  const src = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
  assert.ok(src.includes("require('./modules/chat-keyword-fallback')"));
  assert.ok(!src.includes('10+ metode'));
  assert.ok(!src.includes('HIPAA, SOX'));
  assert.ok(!src.includes('generează deal-uri autonom'));
});

console.log('chat-keyword-fallback: ' + passed + ' checks passed');
process.exit(0);
