// =====================================================================
// pre-keys-activation.test.js — PKA/1.0 honest readiness map
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.FUNNEL_INTEL_FILE = require('os').tmpdir() + '/pka-funnel-' + process.pid + '.json';
process.env.DR_BACKEND = 'local';
process.env.DR_AUTOPILOT_ENABLED = '0';
process.env.DR_LOCAL_DIR = require('os').tmpdir() + '/pka-dr-' + process.pid;
process.env.TELEGRAM_BOT_TOKEN = '123456:TESTTOKEN';
process.env.TELEGRAM_CHAT_ID = '7844765937';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { privateKey } = crypto.generateKeyPairSync('ed25519');
const pemPath = path.join(os.tmpdir(), 'pka-site-sign-' + process.pid + '.pem');
fs.writeFileSync(pemPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
process.env.SITE_SIGN_KEY_FILE = pemPath;
process.env.WACP_DATA_DIR = path.join(os.tmpdir(), 'pka-wacp-' + process.pid);

delete require.cache[require.resolve('../backend/modules/funnel-intelligence')];
delete require.cache[require.resolve('../backend/modules/world-ai-commerce-protocol')];
delete require.cache[require.resolve('../backend/modules/pre-keys-activation')];

const funnel = require('../backend/modules/funnel-intelligence');
funnel._resetForTests();
require('../backend/modules/world-ai-commerce-protocol');
const preKeys = require('../backend/modules/pre-keys-activation');
const lightning = require('../src/lightning/lightning');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('discovery advertises PKA/1.0', () => {
  const d = preKeys.discovery();
  assert.equal(d.protocol, 'PKA/1.0');
  assert.ok(d.endpoints.status.includes('/api/pre-keys/status'));
});

check('telegram bind status never leaks token', () => {
  const st = preKeys.telegramBindStatus();
  assert.equal(st.tokenArmed, true);
  assert.equal(st.chatArmed, true);
  assert.equal(st.bound, true);
  const json = JSON.stringify(st);
  assert.ok(!json.includes('TESTTOKEN'));
  assert.ok(!json.includes('123456:'));
});

check('getStatus separates agent rails from owner-tomorrow keys', () => {
  const s = preKeys.getStatus();
  assert.ok(s.ok);
  assert.ok(Array.isArray(s.agentArmed) && s.agentArmed.length >= 5);
  assert.ok(Array.isArray(s.ownerTomorrow) && s.ownerTomorrow.length === 4);
  const ids = s.ownerTomorrow.map((c) => c.id).sort();
  assert.deepEqual(ids, ['email', 'nowpayments', 'paypal', 'stripe']);
  // Without real payment keys, owner packs must be waiting
  assert.ok(s.waitingOwner.length >= 3);
  const funnelCap = s.agentArmed.find((c) => c.id === 'funnel_instrumentation');
  assert.ok(funnelCap && funnelCap.armed);
  const wacpCap = s.agentArmed.find((c) => c.id === 'wacp_ed25519');
  assert.ok(wacpCap && wacpCap.armed);
});

check('lightning stays unconfigured without LND secrets', () => {
  const st = lightning.getStatus();
  assert.equal(st.configured, false);
  assert.equal(lightning.isConfigured(), false);
});

check('ownerTomorrowChecklist is honest about missing keys', () => {
  const list = preKeys.ownerTomorrowChecklist();
  assert.ok(list.every((c) => typeof c.armed === 'boolean'));
  assert.ok(list.some((c) => c.id === 'nowpayments' && c.armed === false));
});

try { fs.unlinkSync(pemPath); } catch (_) {}
console.log('\n✅ pre-keys-activation:', passed, 'tests passed');
process.exit(0);
