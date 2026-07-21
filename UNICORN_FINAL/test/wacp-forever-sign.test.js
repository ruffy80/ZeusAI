// =====================================================================
// wacp-forever-sign.test.js — WACP uses forever site-sign Ed25519 like PoMX
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.WACP_DATA_DIR = require('os').tmpdir() + '/wacp-sign-' + process.pid;

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const pemPath = path.join(os.tmpdir(), 'site-sign-wacp-' + process.pid + '.pem');
  fs.writeFileSync(pemPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));

  delete process.env.WACP_ED25519_PRIVATE_KEY;
  delete process.env.SITE_SIGN_PRIVATE_KEY;
  delete process.env.WACP_HMAC_SECRET;
  process.env.SITE_SIGN_KEY_FILE = pemPath;
  process.env.JWT_SECRET = 'test-jwt-not-used-when-ed25519';

  delete require.cache[require.resolve('../backend/modules/world-ai-commerce-protocol')];
  const wacp = require('../backend/modules/world-ai-commerce-protocol');
  wacp._resetForTests();

  let passed = 0;
  function check(name, fn) {
    const r = fn();
    if (r && typeof r.then === 'function') throw new Error('use await checkAsync for ' + name);
    passed += 1;
    console.log('\u2713', name);
  }
  async function checkAsync(name, fn) {
    await fn();
    passed += 1;
    console.log('\u2713', name);
  }

  check('signing mode is ed25519 from site-sign.pem', () => {
    const st = wacp.getStatus();
    assert.equal(st.signingMode, 'ed25519');
    assert.equal(st.fallbackSecretInUse, false);
  });

  await checkAsync('delivery attestation signs and verifies with forever key', async () => {
    const env = await wacp.attestDelivery({
      orderId: 'ord-wacp-1',
      email: 'buyer@example.com',
      artifactHashes: ['a'.repeat(64)],
    });
    assert.ok(env.signature);
    assert.equal(env.signature.algorithm, 'ed25519');
    const v = wacp.verifyEnvelope(env);
    assert.ok(v.valid, JSON.stringify(v.errors));
  });

  check('public key from pem loads', () => {
    const pub = crypto.createPublicKey(fs.readFileSync(pemPath, 'utf8'));
    assert.ok(pub);
    void publicKey;
  });

  try { fs.unlinkSync(pemPath); } catch (_) {}
  console.log('\n✅ wacp-forever-sign:', passed, 'tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
