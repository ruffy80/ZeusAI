'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.ADMIN_SECRET;
delete process.env.ADMIN_TOKEN;
delete process.env.ADMIN_API_TOKEN;
delete process.env.COMMERCE_ADMIN_SECRET;

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.UNICORN_COMMERCE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'buyer-record-'));

const gate = require('../src/commerce/buyer-record-gate');

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

check('an anonymous email query is not a vault login', () => {
  const out = gate.decideBuyerRecord({ requestedEmail: 'buyer@example.com', provenEmail: '', admin: false });
  assert.strictEqual(out.allow, false);
  assert.strictEqual(out.status, 401);
  assert.strictEqual(out.body.error, 'auth_required');
  assert.ok(!out.body.entries);
  assert.strictEqual(JSON.stringify(out.body).includes('buyer@example.com'), false);
});

check('a signed-in buyer cannot read another email', () => {
  const out = gate.decideBuyerRecord({
    requestedEmail: 'other@example.com',
    provenEmail: 'Buyer@Example.com',
    admin: false,
  });
  assert.strictEqual(out.allow, false);
  assert.strictEqual(out.status, 403);
  assert.strictEqual(out.body.error, 'email_mismatch');
  assert.strictEqual(JSON.stringify(out.body).includes('other@example.com'), false);
});

check('a signed-in buyer reads their own record, including when the query is omitted', () => {
  const same = gate.decideBuyerRecord({
    requestedEmail: 'buyer@example.com',
    provenEmail: 'Buyer@Example.com',
    admin: false,
  });
  const omitted = gate.decideBuyerRecord({ requestedEmail: '', provenEmail: 'buyer@example.com', admin: false });
  assert.strictEqual(same.allow, true);
  assert.strictEqual(same.email, 'buyer@example.com');
  assert.strictEqual(omitted.allow, true);
  assert.strictEqual(omitted.email, 'buyer@example.com');
});

check('a strand id is not a substitute for the buyer email', () => {
  const out = gate.decideBuyerRecord({
    requestedEmail: 'dna_someone_else',
    provenEmail: 'buyer@example.com',
    admin: false,
  });
  assert.strictEqual(out.allow, false);
  assert.strictEqual(out.status, 403);
});

check('an admin secret can name the record, and a missing email is still required', () => {
  process.env.COMMERCE_ADMIN_SECRET = 'commerce-admin-test-secret';
  const req = { headers: { 'x-commerce-admin-secret': 'commerce-admin-test-secret' } };
  assert.strictEqual(gate.isRecordAdmin(req), true);
  assert.strictEqual(gate.isRecordAdmin({ headers: { 'x-commerce-admin-secret': 'nope' } }), false);
  assert.strictEqual(gate.isRecordAdmin({ headers: {} }), false);
  const missing = gate.decideBuyerRecord({ requestedEmail: '', provenEmail: '', admin: true });
  assert.strictEqual(missing.status, 400);
  assert.strictEqual(missing.body.error, 'email_required');
  const named = gate.decideBuyerRecord({ requestedEmail: 'buyer@example.com', provenEmail: '', admin: true });
  assert.strictEqual(named.allow, true);
  assert.strictEqual(named.email, 'buyer@example.com');
  delete process.env.COMMERCE_ADMIN_SECRET;
});

check('the vault and strand routes use the gate before the record lookup', () => {
  const backend = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
  const omega = fs.readFileSync(path.join(__dirname, '../src/site/omega-http.js'), 'utf8');
  const dna = fs.readFileSync(path.join(__dirname, '../src/site/dna-http.js'), 'utf8');
  assert.ok(backend.includes('readBuyerRecord(req, req.query.email)'));
  assert.ok(backend.includes('omega.getVault(proof.email)'));
  assert.ok(!backend.includes('omega.getVault(req.query.email)'));
  assert.ok(backend.includes('dna.getDna(proof.email)'));
  assert.ok(!backend.includes('dna.getDna(req.query.email'));
  assert.ok(omega.includes('omega.getVault(proof.email)'));
  assert.ok(omega.includes('Sign in at /account to open your vault.'));
  assert.ok(!omega.includes('Add ?email=buyer@example.com'));
  assert.ok(dna.includes('dna.getDna(proof.email)'));
  assert.ok(dna.includes('Sign in at /account to open your strand.'));
  assert.ok(dna.includes("if (!gate.isRecordAdmin(req)) return json(401, { ok: false, error: 'auth_required' });"));
});

async function httpDenied() {
  const omega = require('../src/site/omega-http');
  const dna = require('../src/site/dna-http');
  const capture = () => {
    const res = { writeHead(code) { this.code = code; }, end(body) { this.body = body; } };
    return res;
  };
  const vaultRes = capture();
  await omega.handleApi(
    { method: 'GET', headers: {} },
    vaultRes,
    '/api/omega/vault',
    new URL('http://local/api/omega/vault?email=buyer@example.com')
  );
  const vaultBody = JSON.parse(vaultRes.body);
  assert.strictEqual(vaultRes.code, 401);
  assert.strictEqual(vaultBody.error, 'auth_required');
  assert.ok(!vaultBody.entries);
  const dnaRes = capture();
  await dna.handleApi(
    { method: 'GET', headers: {} },
    dnaRes,
    '/api/dna/strand',
    new URL('http://local/api/dna/strand?email=buyer@example.com')
  );
  const dnaBody = JSON.parse(dnaRes.body);
  assert.strictEqual(dnaRes.code, 401);
  assert.strictEqual(dnaBody.error, 'auth_required');
  assert.ok(!dnaBody.dna);
}

httpDenied().then(() => {
  console.log('✓ anonymous vault and strand HTTP handlers refuse the email query');
  passed += 1;
  console.log('✅ buyer-record-gate: ' + passed + ' tests passed');
  process.exit(0);
}).catch((e) => {
  console.error('✗ anonymous vault and strand HTTP handlers refuse the email query');
  console.error(e && e.stack || e);
  process.exit(1);
});
