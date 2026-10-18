'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.ENABLE_AUTO_RESTART = '0';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-int-'));
process.env.UNICORN_DATA_DIR = tmp;

const healer = require('../backend/modules/unicornSelfHealer');
const registry = require('../src/site/v2/delivery-registry');
const frontier = require('../src/frontier-engine');

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

check('a repair note does not count as a healing', () => {
  const mods = healer.getModules();
  mods['not-a-module.js'] = { ok: false };
  const before = healer.getStatus().healings;
  const attempts = healer.getStatus().repairAttempts;
  const repaired = healer.repairDaemon();
  assert.strictEqual(repaired, 0);
  assert.strictEqual(healer.getStatus().healings, before);
  assert.strictEqual(healer.getStatus().repairAttempts, attempts + 1);
});

check('a failed PM2 probe is not a healing', () => {
  const before = healer.getStatus().healings;
  let saw = null;
  healer.once('healer:process-probe', (row) => { saw = row; });
  const out = healer.recordProbeResult({ health: 'unknown', probe: 'unavailable', unseen: [] }, 0);
  assert.strictEqual(out.kind, 'unknown');
  assert.strictEqual(out.healingsAdded, 0);
  assert.strictEqual(healer.getStatus().healings, before);
  assert.strictEqual(saw && saw.health, 'unknown');
});

check('an absent app is recorded and not started', () => {
  const before = healer.getStatus().healings;
  let saw = null;
  healer.once('healer:process-absent', (row) => { saw = row; });
  const out = healer.recordProbeResult({
    health: 'degraded',
    probe: 'jlist',
    unseen: ['unicorn-backend'],
  }, 0);
  assert.strictEqual(out.kind, 'absent');
  assert.strictEqual(out.healingsAdded, 0);
  assert.deepStrictEqual(saw && saw.unseen, ['unicorn-backend']);
  assert.strictEqual(healer.getStatus().healings, before);
});

check('only a real restart increments healings', () => {
  const before = healer.getStatus().healings;
  const out = healer.recordProbeResult({ health: 'degraded', probe: 'jlist', unseen: [] }, 1);
  assert.strictEqual(out.kind, 'restart');
  assert.strictEqual(out.healingsAdded, 1);
  assert.strictEqual(healer.getStatus().healings, before + 1);
});

check('a buyer email receives a key that verifies', () => {
  const item = registry.deliverableSet({
    id: 'rcpt_integrity_email',
    email: 'buyer-integrity@zeusai.pro',
  }, 'instant-website-audit');
  assert.strictEqual(item.credentialsIssued, true);
  assert.ok(String(item.apiKey).startsWith('zai_'));
  assert.strictEqual(frontier.apiKeyVerify(item.apiKey).ok, true);
  assert.strictEqual(frontier.apiKeyVerify('zai_not-a-real-key').ok, false);
  assert.strictEqual(item.webhookIssued, false);
  assert.strictEqual(item.webhookSecret, null);
  frontier.apiKeyRevoke(item.keyId);
  assert.strictEqual(frontier.apiKeyVerify(item.apiKey).ok, false);
});

check('a receipt without an email gets no key and no webhook secret', () => {
  const item = registry.deliverableSet({ id: 'rcpt_integrity_anon' }, 'instant-website-audit');
  assert.strictEqual(item.credentialsIssued, false);
  assert.strictEqual(item.apiKey, null);
  assert.strictEqual(item.webhookIssued, false);
  assert.strictEqual(item.webhookSecret, null);
  const view = registry.renderPayload({
    items: [item],
  }, 'api-key', 'instant-website-audit');
  assert.strictEqual(view.credentialsIssued, false);
  assert.strictEqual(view.apiKey, null);
});

check('a webhook secret exists only for an https callback', () => {
  const httpItem = registry.deliverableSet({
    id: 'rcpt_integrity_http',
    email: 'buyer-http@zeusai.pro',
    webhookUrl: 'http://example.com/hook',
  }, 'instant-website-audit');
  assert.strictEqual(httpItem.webhookIssued, false);
  assert.strictEqual(httpItem.webhookSecret, null);
  frontier.apiKeyRevoke(httpItem.keyId);

  const httpsItem = registry.deliverableSet({
    id: 'rcpt_integrity_https',
    email: 'buyer-https@zeusai.pro',
    webhookUrl: 'https://buyer.example/hook',
  }, 'instant-website-audit');
  assert.strictEqual(httpsItem.credentialsIssued, true);
  assert.strictEqual(httpsItem.webhookIssued, true);
  assert.ok(httpsItem.webhookSecret);
  frontier.apiKeyRevoke(httpsItem.keyId);
});

console.log(`\n✅ service-integrity-heal: ${passed} tests passed`);
process.exit(0);
