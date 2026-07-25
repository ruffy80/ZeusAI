'use strict';

// nginx contract guard — pure string/parse test (no live nginx required).
//
// The sovereign-commerce and order/entitlement endpoints are implemented ONLY
// in the site process (src/index.js → sovereign-commerce.handle). If nginx
// routes them to the backend upstream they 404 in production. This test locks
// the routing contract so a future edit to scripts/nginx-unicorn.conf cannot
// silently drop a site pin (which historically broke Buy-with-BTC).

process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONF_PATH = path.join(__dirname, '..', 'scripts', 'nginx-unicorn.conf');
const conf = fs.readFileSync(CONF_PATH, 'utf8');

let failed = 0;
function check(label, fn) {
  try { fn(); console.log('  ok  ' + label); }
  catch (e) { failed += 1; console.log('  FAIL ' + label + ' — ' + (e && e.message ? e.message : e)); }
}

// Extract the `location <match> { ... }` block for a given exact/prefix path.
// Returns the raw block body string, or null if no such location exists.
function locationBlock(pathToken) {
  // Match `location = /x { ... }` OR `location ^~ /x { ... }` OR `location /x { ... }`
  // on a single line (the commerce/site pins in this conf are single-line).
  const lines = conf.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*location\s+(?:=|\^~)?\s*(\S+)\s*\{([\s\S]*)\}\s*$/);
    if (m && m[1] === pathToken) return m[2];
  }
  // Fall back: multi-line block scan.
  const re = new RegExp('location\\s+(?:=|\\^~)?\\s*' + pathToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{');
  const idx = conf.search(re);
  if (idx < 0) return null;
  const start = conf.indexOf('{', idx);
  let depth = 0;
  for (let i = start; i < conf.length; i++) {
    if (conf[i] === '{') depth++;
    else if (conf[i] === '}') { depth--; if (depth === 0) return conf.slice(start + 1, i); }
  }
  return null;
}

function assertSitePinned(pathToken) {
  const body = locationBlock(pathToken);
  assert.ok(body, 'expected a location block for ' + pathToken);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(body),
    pathToken + ' must proxy_pass to unicorn_site (got: ' + body.trim().slice(0, 120) + ')');
}

function assertBackendPinned(pathToken) {
  const body = locationBlock(pathToken);
  assert.ok(body, 'expected a location block for ' + pathToken);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_backend\b/.test(body),
    pathToken + ' must proxy_pass to unicorn_backend (got: ' + body.trim().slice(0, 120) + ')');
}

console.log('nginx contract guard tests');

// Upstreams must be declared.
check('upstream unicorn_site is declared', () => {
  assert.ok(/upstream\s+unicorn_site\s*\{/.test(conf), 'unicorn_site upstream missing');
});
check('upstream unicorn_backend is declared', () => {
  assert.ok(/upstream\s+unicorn_backend\s*\{/.test(conf), 'unicorn_backend upstream missing');
});

// Site-pinned commerce / order / entitlement paths.
const SITE_PINNED = [
  '/api/checkout/create',
  '/api/commerce/health',
  '/api/commerce/recent-sales',
  '/api/commerce/integrity',
  '/api/commerce/metrics',
  '/api/order/',
  '/api/entitlements/',
];
for (const p of SITE_PINNED) {
  check('site-pinned: ' + p + ' → unicorn_site', () => assertSitePinned(p));
}

// Backend-pinned public discovery docs (served by backend/index.js).
const BACKEND_PINNED = [
  '/.well-known/enterprise.json',
  '/.well-known/platform.json',
];
for (const p of BACKEND_PINNED) {
  check('backend-pinned: ' + p + ' → unicorn_backend', () => assertBackendPinned(p));
}

// Generic /api/ must go to the backend (source of truth).
check('generic /api/ → unicorn_backend', () => {
  const body = locationBlock('/api/');
  assert.ok(body, 'expected a location block for /api/');
  assert.ok(/proxy_pass\s+http:\/\/unicorn_backend\b/.test(body),
    'generic /api/ must proxy_pass to unicorn_backend');
});

if (failed > 0) {
  console.error('nginx-contract-guard.test.js: ' + failed + ' assertion(s) failed.');
  process.exit(1);
}
console.log('nginx-contract-guard.test.js: OK');
