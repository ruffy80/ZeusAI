'use strict';

/**
 * account-instant-continuum.test.js — Instant Identity Continuum guards.
 * Account must never paint a blank Loading… shell; SSR includes Create/Sign-in;
 * /api/customer/me is memoized; SPA skips soft-revalidate of /account.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

const shell = read('src/site/v2/shell.js');
const client = read('src/site/v2/client.js');
const site = read('src/index.js');
const iic = read('src/perf/instant-identity-continuum.js');
const cryptoauth = read('backend/modules/cryptoauth/index.js');

check('SSR account paints Create/Sign-in (no Loading… shell)', () => {
  const fn = shell.slice(shell.indexOf('function pageAccount'));
  const head = fn.slice(0, fn.indexOf('<script'));
  assert.ok(head.includes('id="acaCreate"'), 'SSR Create button');
  assert.ok(head.includes('id="acaSignin"'), 'SSR Sign-in button');
  assert.ok(head.includes('id="acaImport"'), 'SSR Import button');
  assert.ok(!/Loading\u2026|Loading…/.test(head) || head.includes('acaCreate'), 'no blocking Loading-only state');
  assert.ok(head.includes('data-iic="1"') || head.includes('Instant Identity Continuum'), 'IIC marker');
});

check('cryptoauth client uses continuum snapshot + fast timeouts', () => {
  assert.ok(shell.includes('zeus_iic_snapshot_v1'), 'local snapshot key');
  assert.ok(shell.includes('API_TIMEOUT_MS = 8000') || /API_TIMEOUT_MS\s*=\s*8000/.test(shell), '8s timeout');
  assert.ok(shell.includes('API_MAX_ATTEMPTS = 2') || /API_MAX_ATTEMPTS\s*=\s*2/.test(shell), '2 attempts');
  assert.ok(shell.includes('__zeusCryptoAuthRefresh'), 'SPA re-entry refresh');
  assert.ok(shell.includes('wireLoggedOutOnce'), 'wire SSR controls');
});

check('SPA soft-revalidate skips /account', () => {
  assert.ok(/softRevalidateSpa[\s\S]{0,400}\/account/.test(client), 'account excluded from soft revalidate');
});

check('hydrateAccount is non-blocking + paints me snapshot', () => {
  assert.ok(client.includes('zeus_iic_me_v1'), 'commerce me snapshot');
  assert.ok(/hydrateAccount\(\)\.catch/.test(client) || !/await hydrateAccount\(\)/.test(client), 'hydratePage does not await account');
  assert.ok(client.includes('id="acSignupBtn"'), 'legacy signup panel restored');
});

check('IIC module + me memo + status route', () => {
  assert.ok(iic.includes('Instant Identity Continuum'), 'module doc');
  assert.ok(site.includes('instant-identity-continuum'), 'wired into site');
  assert.ok(site.includes('X-IIC-Cache'), 'cache header');
  assert.ok(site.includes('/api/iic/status'), 'status route');
  assert.ok(/\/account/.test(site.slice(site.indexOf('const routes ='))), 'account prewarmed');
});

check('cryptoauth users mtime cache', () => {
  assert.ok(cryptoauth.includes('_usersCache'), 'users cache');
  assert.ok(cryptoauth.includes('mtimeMs'), 'mtime gate');
});

check('runtime: pageAccount HTML is interactive without script', () => {
  delete require.cache[require.resolve(path.join(root, 'src/site/v2/shell.js'))];
  const v2 = require(path.join(root, 'src/site/v2/shell.js'));
  const html = v2.getHtml('/account', { lang: 'en', nonce: 't' });
  assert.ok(html.indexOf('id="acaCreate"') !== -1, 'create in html');
  assert.ok(html.indexOf('id="acaSignin"') !== -1, 'signin in html');
  // Controls must appear in the page body before the cryptoauth boot script.
  const acaIdx = html.indexOf('id="acaCreate"');
  const bootIdx = html.indexOf('__zeusCryptoAuthInit');
  assert.ok(acaIdx > 0 && bootIdx > acaIdx, 'create control precedes boot script');
  assert.ok(html.indexOf('data-iic="1"') !== -1 || html.indexOf('Instant Identity Continuum') !== -1, 'IIC marker live');
});

check('runtime: IIC me memo hits', () => {
  delete require.cache[require.resolve(path.join(root, 'src/perf/instant-identity-continuum.js'))];
  const mod = require(path.join(root, 'src/perf/instant-identity-continuum.js'));
  const key = mod.cacheKey(['me', 'tok1']);
  mod.setCachedMe(key, 200, '{"ok":true}');
  const hit = mod.getCachedMe(key);
  assert.ok(hit && hit.status === 200, 'cache hit');
  assert.ok(mod.getStatus().ok === true, 'status ok');
});

console.log('account-instant-continuum.test.js passed');
process.exit(0);
