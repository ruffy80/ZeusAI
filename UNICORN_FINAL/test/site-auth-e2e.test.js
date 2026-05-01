'use strict';
// Regression test: site-local customer signup + login endpoints, plus
// client-side double-render guard (accountWired flag logic).
//
// Catches the bug where renderAccountAuth() never set root.dataset.accountWired,
// allowing wireExistingAccountAuth() to fire 500ms later and wipe user input.

const assert = require('assert');
const http = require('http');
const path = require('path');

// ── 1. Syntax check for client.js (catches any JS parse error) ──────────────
const { execFileSync } = require('child_process');
execFileSync(process.execPath, ['--check', path.join(__dirname, '..', 'src', 'site', 'v2', 'client.js')]);

// ── 2. Verify accountWired logic in client.js source ────────────────────────
const clientSrc = require('fs').readFileSync(
  path.join(__dirname, '..', 'src', 'site', 'v2', 'client.js'),
  'utf8'
);
// renderAccountAuth must set accountWired='1' at the end
assert.ok(
  /root\.dataset\.accountWired\s*=\s*['"]1['"]/.test(clientSrc),
  'renderAccountAuth() must set root.dataset.accountWired = "1" to prevent double-render'
);
// hydrateAccount must guard against re-rendering when already wired
assert.ok(
  /authFormWired\(\)/.test(clientSrc),
  'hydrateAccount() must use authFormWired() guard to skip re-render when form is already wired'
);

// ── 3. Boot site server + test customer API end-to-end ──────────────────────
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

server.listen(0, '127.0.0.1', async () => {
  try {
    const port = server.address().port;

    // 3a. Signup creates account and returns token + Set-Cookie
    const signupRes = await doRequest(port, 'POST', '/api/customer/signup', {
      email: 'e2e-test@zeusai.pro',
      password: 'Test1234!',
      name: 'E2E Test User',
    });
    assert.strictEqual(signupRes.status, 200, `signup status=${signupRes.status}: ${signupRes.body}`);
    const signup = JSON.parse(signupRes.body);
    assert.ok(signup.token, 'signup should return a token');
    assert.ok(signup.customer && signup.customer.email, 'signup should return customer object');
    assert.ok(signupRes.headers['set-cookie'], 'signup should set customer_session cookie');
    const token = signup.token;

    // 3b. Login with same credentials returns token
    const loginRes = await doRequest(port, 'POST', '/api/customer/login', {
      email: 'e2e-test@zeusai.pro',
      password: 'Test1234!',
    });
    assert.strictEqual(loginRes.status, 200, `login status=${loginRes.status}: ${loginRes.body}`);
    const login = JSON.parse(loginRes.body);
    assert.ok(login.token, 'login should return a token');
    assert.ok(loginRes.headers['set-cookie'], 'login should set customer_session cookie');

    // 3c. /api/customer/me with token returns profile
    const meRes = await doRequest(port, 'GET', '/api/customer/me', null, {
      'x-customer-token': token,
    });
    assert.strictEqual(meRes.status, 200, `/me status=${meRes.status}: ${meRes.body}`);
    const me = JSON.parse(meRes.body);
    assert.ok(me.customer && me.customer.email === 'e2e-test@zeusai.pro', '/me should return matching email');

    // 3d. /api/customer/me without token returns 401
    const me401 = await doRequest(port, 'GET', '/api/customer/me');
    assert.strictEqual(me401.status, 401, '/me without token should be 401');

    // 3e. Wrong password returns 401
    const badLogin = await doRequest(port, 'POST', '/api/customer/login', {
      email: 'e2e-test@zeusai.pro',
      password: 'WrongPassword!',
    });
    assert.strictEqual(badLogin.status, 401, 'wrong password should return 401');

    // 3f. Duplicate signup returns 409
    const dupSignup = await doRequest(port, 'POST', '/api/customer/signup', {
      email: 'e2e-test@zeusai.pro',
      password: 'Test1234!',
    });
    assert.strictEqual(dupSignup.status, 409, 'duplicate signup should return 409');
    const dupJson = JSON.parse(dupSignup.body);
    assert.strictEqual(dupJson.error, 'email_taken', 'duplicate signup error should be email_taken');

    // 3g. Logout clears the cookie
    const logoutRes = await doRequest(port, 'POST', '/api/customer/logout');
    assert.strictEqual(logoutRes.status, 200, `logout status=${logoutRes.status}`);
    const logoutCookie = logoutRes.headers['set-cookie'];
    assert.ok(logoutCookie, 'logout should set cookie');
    // Cookie should expire in the past (max-age=0 or expires in past)
    const cookieStr = Array.isArray(logoutCookie) ? logoutCookie.join('; ') : String(logoutCookie);
    assert.ok(
      cookieStr.includes('Max-Age=0') || cookieStr.includes('max-age=0') || cookieStr.includes('Expires=Thu, 01 Jan 1970'),
      'logout cookie should be expired'
    );

    server.close(() => {
      console.log('site-auth-e2e test passed');
      process.exit(0);
    });
  } catch (err) {
    server.close();
    console.error('site-auth-e2e test FAILED:', err.message || err);
    process.exit(1);
  }
});
