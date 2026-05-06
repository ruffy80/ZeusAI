'use strict';
// Site auth e2e — REVOLUTIONARY EDITION.
// Asserts that the SITE server (src/index.js) has fully retired legacy
// password/JWT/passkey auth and now exposes the Ed25519 cryptoauth contract
// at /api/cryptoauth/* with proper deprecation signaling on the old paths.
//
// Original password-based test archived as site-auth-e2e.test.js.legacy-bak.

const assert = require('assert');
const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');

// 1. Client-side guard syntax check (kept from legacy test).
execFileSync(process.execPath, ['--check', path.join(__dirname, '..', 'src', 'site', 'v2', 'client.js')]);

// 2. Boot the site server.
const { createServer } = require('../src/index');
const server = createServer();

function doRequest(port, method, urlPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', ...(extraHeaders || {}) };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ hostname: '127.0.0.1', port, method, path: urlPath, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assertRetired(res, label) {
  assert.strictEqual(res.status, 410, `${label} should return 410 Gone, got ${res.status}: ${res.body}`);
  assert.strictEqual(res.headers['deprecation'], 'true', `${label} must set Deprecation: true`);
  assert.ok(res.headers['sunset'], `${label} must set Sunset header`);
  assert.ok(res.headers['link'] && /rel="successor-version"/i.test(res.headers['link']),
    `${label} Link header must advertise successor-version`);
  assert.ok(res.headers['x-auth-retired'], `${label} must set X-Auth-Retired header`);
  const json = JSON.parse(res.body);
  assert.strictEqual(json.ok, false, `${label} body.ok must be false`);
  assert.strictEqual(json.error, 'auth_endpoint_retired', `${label} body.error must be auth_endpoint_retired`);
  assert.ok(json.successor && json.successor.includes('cryptoauth'), `${label} body.successor must point to cryptoauth`);
}

server.listen(0, '127.0.0.1', async () => {
  try {
    const port = server.address().port;

    // ── Legacy customer endpoints → all 410 with deprecation headers ───────
    const retiredPosts = [
      '/api/customer/signup',
      '/api/customer/login',
      '/api/customer/logout',
      '/api/customer/forgot-password',
      '/api/customer/reset-password',
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/logout',
    ];
    for (const p of retiredPosts) {
      const r = await doRequest(port, 'POST', p, { email: 'x@y.z', password: 'irrelevant' });
      assertRetired(r, `POST ${p}`);
    }

    // Passkey + WebAuthn + device-key namespaces also retired.
    for (const p of ['/api/auth/passkey/options', '/api/webauthn/register/begin', '/api/device-key/register']) {
      const r = await doRequest(port, 'POST', p, {});
      assertRetired(r, `POST ${p}`);
    }

    // ── Legacy GET pages → 301 redirect to /account ────────────────────────
    for (const legacyPage of ['/login', '/signup', '/forgot-password', '/reset-password', '/auth']) {
      const r = await doRequest(port, 'GET', legacyPage);
      assert.strictEqual(r.status, 301, `${legacyPage} must redirect (got ${r.status})`);
      assert.strictEqual(r.headers['location'], '/account', `${legacyPage} must redirect to /account`);
    }

    // ── New cryptoauth manifest reachable through the site server ──────────
    const manifest = await doRequest(port, 'GET', '/api/cryptoauth/manifest');
    assert.strictEqual(manifest.status, 200, `cryptoauth manifest status=${manifest.status}: ${manifest.body}`);
    const mJson = JSON.parse(manifest.body);
    assert.strictEqual(mJson.ok, true);
    assert.strictEqual(mJson.pack, 'zeus-cryptoauth');
    assert.ok(/ed25519/i.test(String(mJson.algorithm)), `manifest.algorithm must be Ed25519 (got ${mJson.algorithm})`);
    assert.ok(mJson.endpoints && typeof mJson.endpoints === 'object' && Object.keys(mJson.endpoints).length >= 6,
      'cryptoauth manifest must list >=6 endpoints');
    assert.strictEqual(manifest.headers['x-cryptoauth'], '1.0.0',
      'cryptoauth responses must advertise X-Cryptoauth version');

    // ── /account page renders the new flow markers ─────────────────────────
    const accountPage = await doRequest(port, 'GET', '/account', null, {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Zeus-E2E',
    });
    assert.strictEqual(accountPage.status, 200, `/account status=${accountPage.status}`);
    assert.ok(/cryptoauth|Ed25519|zeus-vault|Web Crypto/.test(accountPage.body),
      '/account page must render new cryptoauth UI markers');

    server.close(() => {
      console.log('site-auth-e2e (cryptoauth edition) test passed');
      process.exit(0);
    });
  } catch (err) {
    server.close();
    console.error('site-auth-e2e (cryptoauth edition) test FAILED:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
});
