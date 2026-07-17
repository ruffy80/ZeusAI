'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateKeyPairSync } = require('crypto');

const secrets = require('../src/config/secrets');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'unicorn-secrets-'));
}

function makePem() {
  const { privateKey } = generateKeyPairSync('ed25519');
  return privateKey.export({ type: 'pkcs8', format: 'pem' });
}

function run() {
  const dir = tmpDir();
  const keyPath = path.join(dir, 'deploy_key');
  const pem = makePem();

  const prev = {
    HETZNER_SSH_PRIVATE_KEY: process.env.HETZNER_SSH_PRIVATE_KEY,
    SSH_PRIVATE_KEY: process.env.SSH_PRIVATE_KEY,
    HETZNER_KEY_PATH: process.env.HETZNER_KEY_PATH,
    HETZNER_SSH_KEY_PATH: process.env.HETZNER_SSH_KEY_PATH,
    SSH_KEY_PATH: process.env.SSH_KEY_PATH,
  };

  try {
    delete process.env.HETZNER_SSH_PRIVATE_KEY;
    delete process.env.SSH_PRIVATE_KEY;
    process.env.HETZNER_KEY_PATH = keyPath;
    process.env.HETZNER_SSH_PRIVATE_KEY = pem.replace(/\n/g, '\\n');

    const mat = secrets.materializeDeployKey();
    assert.ok(fs.existsSync(keyPath), 'deploy key file should exist');
    const written = fs.readFileSync(keyPath, 'utf8');
    assert.ok(written.includes('BEGIN PRIVATE KEY') || written.includes('BEGIN OPENSSH PRIVATE KEY'), 'pem written');
    assert.ok(written.includes('\n'), 'newlines restored from dotenv escapes');
    assert.strictEqual(process.env.HETZNER_KEY_PATH, keyPath);
    assert.ok(mat.HETZNER_KEY_PATH, 'materialize reports key path');

    // File → env when env cleared
    delete process.env.HETZNER_SSH_PRIVATE_KEY;
    delete process.env.SSH_PRIVATE_KEY;
    process.env.HETZNER_KEY_PATH = keyPath;
    const mat2 = secrets.materializeDeployKey();
    assert.ok(process.env.HETZNER_SSH_PRIVATE_KEY, 'loads key from file into env');
    assert.ok(String(mat2.HETZNER_SSH_PRIVATE_KEY || '').startsWith('file:'), 'reports file source');

    console.log('secrets-deploy-key.test.js: OK');
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
}

run();
