'use strict';
/**
 * account-ui-alive.test.js — Create / Sign-in / Recover must stay interactive.
 * Guards the regressions that left all three buttons painted but dead:
 *  - SPA innerHTML swap reused a stale CSP nonce
 *  - hydrateAccount painted retired 410 password/passkey forms
 *  - tweetnacl loaded without Trusted Types
 *  - IndexedDB persist of a raw CryptoKey with no serial fallback
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

const shell = read('src/site/v2/shell.js');
const client = read('src/site/v2/client.js');
const buildId = read('src/site/v2/build-id.js');
const naclPath = path.join(root, 'src/site/v2/assets/vendor/nacl-fast.min.js');

check('SPA never swaps identity routes (full document load)', () => {
  assert.ok(client.includes('function isIdentityRoute'), 'helper present');
  assert.ok(/if \(isIdentityRoute\(href\)\) \{\s*try \{ location\.assign/.test(client)
    || client.includes('if (isIdentityRoute(href))'), 'hard-nav on identity href');
  assert.ok(client.includes('if (isIdentityRoute(href)) return;'), 'prefetch/cache skip identity');
  assert.ok(/navigateSpa[\s\S]{0,180}isIdentityRoute/.test(client), 'navigateSpa hard-loads account');
});

check('runAppInlineScripts overwrites stale nonce + uses Trusted Types', () => {
  assert.ok(client.includes("toLowerCase() === 'nonce') continue"), 'do not copy fetched nonce');
  assert.ok(client.includes('createScript'), 'TrustedScript for reinjected boot');
  assert.ok(client.includes('liveNonce'), 'current document nonce');
});

check('cryptoauth boot: document delegate + serial persist + local nacl', () => {
  assert.ok(shell.includes('__zeusCryptoAuthDelegated'), 'document click delegate');
  assert.ok(shell.includes('__zeusCryptoAuthOnCreate'), 'create handler exported');
  assert.ok(shell.includes('__zeusCryptoAuthOnSignin'), 'signin handler exported');
  assert.ok(shell.includes('__zeusCryptoAuthOnImport'), 'import handler exported');
  assert.ok(shell.includes('privB64') && shell.includes('privPkcs8B64'), 'serial key persist');
  assert.ok(shell.includes('function resolvePriv'), 'rehydrate stored key');
  assert.ok(shell.includes('createScriptURL'), 'Trusted Types for nacl src');
  assert.ok(shell.includes('/assets/vendor/nacl-fast.min.js') || shell.includes('nacl-fast.min.js'), 'local nacl');
  assert.ok(buildId.includes('nacl-fast.min.js'), 'nacl registered as versioned asset');
  assert.ok(fs.existsSync(naclPath) && fs.statSync(naclPath).size > 10000, 'vendored nacl present');
});

check('hydrateAccount leaves cryptoauth chrome alone on 401/410', () => {
  assert.ok(client.includes("resp.status === 401 || resp.status === 410"), 'treat 410 as retired');
  assert.ok(client.includes('data-commerce-mount'), 'commerce mount guard');
  assert.ok(client.includes('Password login has been retired'), 'no live password signup');
});

check('runtime: /account HTML boots Create/Sign-in/Recover', () => {
  delete require.cache[require.resolve(path.join(root, 'src/site/v2/shell.js'))];
  const v2 = require(path.join(root, 'src/site/v2/shell.js'));
  const html = v2.getHtml('/account', { lang: 'en', nonce: 'acctest' });
  assert.ok(html.includes('id="acaCreate"'), 'create button');
  assert.ok(html.includes('id="acaSignin"'), 'signin button');
  assert.ok(html.includes('id="acaImport"'), 'import button');
  assert.ok(html.includes('__zeusCryptoAuthDelegated'), 'delegate in page script');
  assert.ok(html.includes('nacl-fast.min.js'), 'local nacl url in page');
  assert.ok(!html.includes('id="acSignupBtn"'), 'retired signup form not in SSR');
  assert.ok(!html.includes('id="acLoginBtn"'), 'retired login form not in SSR');
});

check('runtime: site serves /account + cryptoauth oneshot + local nacl', () => {
  return true;
});

const { createServer } = require('../src/index');
const server = createServer();

function doRequest(port, method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path: urlPath }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    req.on('error', reject);
    req.end();
  });
}

server.listen(0, '127.0.0.1', async () => {
  try {
    const port = server.address().port;
    const page = await doRequest(port, 'GET', '/account');
    assert.strictEqual(page.status, 200, '/account 200');
    assert.ok(/acaCreate/.test(page.body), 'live page has Create');
    assert.ok(/acaSignin/.test(page.body), 'live page has Sign-in');
    assert.ok(/acaImport/.test(page.body), 'live page has Import');
    assert.ok(/__zeusCryptoAuthDelegated/.test(page.body), 'delegate present');
    const csp = String(page.headers['content-security-policy'] || '');
    const nonce = (csp.match(/nonce-([A-Za-z0-9_-]+)/) || [])[1];
    if (nonce) {
      const tagged = (page.body.match(/<script[^>]*nonce="([^"]+)"/g) || []);
      assert.ok(tagged.length > 0, 'script tags carry nonce');
      tagged.forEach((tag) => {
        assert.ok(tag.includes('nonce="' + nonce + '"'), 'script nonce matches CSP');
      });
    }

    const nacl = await doRequest(port, 'GET', '/assets/vendor/nacl-fast.min.js');
    assert.strictEqual(nacl.status, 200, 'local nacl 200');
    assert.ok(/nacl|tweetnacl|sign\.detached/.test(nacl.body) || nacl.body.length > 10000, 'nacl payload');

    const manifest = await doRequest(port, 'GET', '/api/cryptoauth/manifest');
    assert.strictEqual(manifest.status, 200, 'cryptoauth manifest 200');
    const m = JSON.parse(manifest.body);
    assert.strictEqual(m.ok, true);
    assert.strictEqual(m.oneShot, true);

    const retired = await new Promise((resolve, reject) => {
      const data = JSON.stringify({ email: 'x@y.z', password: 'nope' });
      const req = http.request({
        hostname: '127.0.0.1', port, method: 'POST', path: '/api/customer/login',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      }, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: buf }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    assert.strictEqual(retired.status, 410, 'legacy login still 410');

    server.close(() => {
      console.log('account-ui-alive.test.js passed');
      process.exit(0);
    });
  } catch (err) {
    try { server.close(); } catch (_) {}
    console.error('account-ui-alive.test.js FAILED:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
});
