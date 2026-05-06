'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const m = require('../backend/modules/cryptoauth');

// Ensure data dir exists & is clean for the test.
const usersFile = m._internals.USERS_FILE;
try { if (fs.existsSync(usersFile)) fs.unlinkSync(usersFile); } catch (_) {}

// ── Static wiring assertions ──
const repoRoot = path.join(__dirname, '..');
const indexJs = fs.readFileSync(path.join(repoRoot, 'src', 'index.js'), 'utf8');
const shellJs = fs.readFileSync(path.join(repoRoot, 'src', 'site', 'v2', 'shell.js'), 'utf8');

let staticFail = 0;
function assert(cond, label) {
  if (cond) { console.log('  ✅', label); } else { staticFail++; console.error('  ❌', label); }
}
assert(indexJs.includes("require('../backend/modules/cryptoauth')"), 'src/index.js requires cryptoauth');
assert(indexJs.includes('cryptoauth.handle(req, res)'), 'src/index.js dispatches cryptoauth.handle');
assert(indexJs.includes("'/api/customer/signup'"), 'src/index.js still references /api/customer/signup (in legacy 410 trap)');
assert(indexJs.includes("'X-Auth-Retired': 'cryptoauth-1.0.0'"), 'src/index.js installs legacy 410-Gone trap');
assert(indexJs.includes("location: '/account'") || indexJs.includes("Location: '/account'"), 'src/index.js redirects legacy /login,/signup,/forgot-password to /account');
assert(shellJs.includes('cryptoauth') || shellJs.includes('Ed25519'), 'shell.js pageAccount uses new cryptoauth flow');
assert(shellJs.includes("case '/auth': return pageAccount()"), 'shell.js routes /auth → pageAccount');
assert(shellJs.includes("case '/login': return pageAccount()"), 'shell.js routes /login → pageAccount');
assert(typeof m.handle === 'function', 'cryptoauth module exports handle()');

// ── Mock req/res helpers ──
function mkRes() {
  return {
    headersSent: false,
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(s, h) { this.statusCode = s; this.headers = h; this.headersSent = true; },
    end(b) { this.body = b || ''; }
  };
}
function mkReq(method, url, jsonBody, headers) {
  const body = jsonBody ? JSON.stringify(jsonBody) : '';
  const listeners = {};
  const req = {
    method, url,
    headers: headers || {},
    on(ev, fn) { listeners[ev] = fn; return req; }
  };
  // After a tick, dispatch data + end so module's _readBody resolves.
  setImmediate(function() {
    if (listeners.data && body) listeners.data(Buffer.from(body));
    if (listeners.end) listeners.end();
  });
  return req;
}
async function call(method, url, body, headers) {
  const req = mkReq(method, url, body, headers);
  const res = mkRes();
  const handled = await m.handle(req, res);
  return { handled, status: res.statusCode, headers: res.headers, body: res.body ? JSON.parse(res.body) : null };
}

(async () => {
  let pass = 0, fail = 0;
  function ok(cond, label) { if (cond) { pass++; console.log('  ✅', label); } else { fail++; console.error('  ❌', label); } }

  // 1. manifest (GET, no auth)
  let r = await call('GET', '/api/cryptoauth/manifest');
  ok(r.handled && r.status === 200 && r.body && r.body.pack === 'zeus-cryptoauth' && r.body.algorithm === 'Ed25519', 'GET /manifest → 200 + pack/algo');

  // 2. Generate Ed25519 keypair (Node side, mimicking browser).
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  // Export raw 32-byte public key (strip 12-byte SPKI prefix).
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const pubRaw = spki.slice(spki.length - 32);
  const pubB64 = pubRaw.toString('base64');

  // 3. Register
  r = await call('POST', '/api/cryptoauth/register', { publicKey: pubB64, name: 'Vladoi Ionut', email: 'vladoi_ionut@yahoo.com' });
  ok(r.handled && r.status === 200 && r.body && r.body.ok && r.body.userId && r.body.challenge, 'POST /register → 200 + userId + challenge');
  const userId = r.body.userId;
  const ch1 = r.body.challenge;

  // 4. Sign challenge & login
  const sig1 = crypto.sign(null, Buffer.from(ch1, 'utf8'), privateKey);
  r = await call('POST', '/api/cryptoauth/login', { userId, challenge: ch1, signature: sig1.toString('base64') });
  ok(r.handled && r.status === 200 && r.body && r.body.ok && r.body.token && r.body.expiresAt, 'POST /login → 200 + JWT token');
  const token = r.body.token;

  // 5. Bad signature must fail
  r = await call('POST', '/api/cryptoauth/challenge', { userId });
  const ch2 = r.body.challenge;
  r = await call('POST', '/api/cryptoauth/login', { userId, challenge: ch2, signature: Buffer.alloc(64).toString('base64') });
  ok(r.handled && r.status === 401 && !r.body.ok, 'POST /login bad signature → 401');

  // 6. Replayed challenge must fail (consumed in step 5).
  r = await call('POST', '/api/cryptoauth/login', { userId, challenge: ch2, signature: sig1.toString('base64') });
  ok(r.handled && r.status === 400 && !r.body.ok, 'POST /login replay challenge → 400');

  // 7. /me with valid token
  r = await call('GET', '/api/cryptoauth/me', null, { authorization: 'Bearer ' + token });
  ok(r.handled && r.status === 200 && r.body && r.body.ok && r.body.userId === userId, 'GET /me → 200 + correct userId');

  // 8. /me without token
  r = await call('GET', '/api/cryptoauth/me');
  ok(r.handled && r.status === 401, 'GET /me without token → 401');

  // 9. Challenge by email
  r = await call('POST', '/api/cryptoauth/challenge', { email: 'vladoi_ionut@yahoo.com' });
  ok(r.handled && r.status === 200 && r.body && r.body.userId === userId, 'POST /challenge {email} → 200 + same userId');

  // 10. Recover (passwordless) — send fresh challenge + signature with same keypair.
  r = await call('POST', '/api/cryptoauth/challenge', { userId });
  const ch3 = r.body.challenge;
  const sig3 = crypto.sign(null, Buffer.from(ch3, 'utf8'), privateKey);
  r = await call('POST', '/api/cryptoauth/recover', { publicKey: pubB64, challenge: ch3, signature: sig3.toString('base64') });
  ok(r.handled && r.status === 200 && r.body && r.body.ok && r.body.userId === userId && r.body.token, 'POST /recover → 200 + token');

  // 11. Logout (stateless)
  r = await call('POST', '/api/cryptoauth/logout', { token });
  ok(r.handled && r.status === 200, 'POST /logout → 200');

  // 12. Dispatcher discipline: unknown subpath → false
  let req = mkReq('GET', '/api/cryptoauth/__nope__'); let res = mkRes();
  let handled = await m.handle(req, res);
  ok(handled === false, 'unknown /api/cryptoauth/* → false (passes through)');

  // 13. Unrelated path → false (fast prefix gate)
  req = mkReq('GET', '/health'); res = mkRes();
  handled = await m.handle(req, res);
  ok(handled === false, 'unrelated path /health → false');

  // 14. Wrong method on register → false
  req = mkReq('GET', '/api/cryptoauth/register'); res = mkRes();
  handled = await m.handle(req, res);
  ok(handled === false, 'GET /register → false (POST-only)');

  console.log('cryptoauth smoke:', pass, 'pass /', fail, 'fail · static:', staticFail, 'fail');
  // Cleanup test artifact
  try { if (fs.existsSync(usersFile)) fs.unlinkSync(usersFile); } catch (_) {}
  process.exit(fail === 0 && staticFail === 0 ? 0 : 1);
})();
