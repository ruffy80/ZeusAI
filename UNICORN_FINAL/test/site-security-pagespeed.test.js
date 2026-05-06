'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const srcIndex = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'template.js'), 'utf8');
const nginx = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'nginx-unicorn.conf'), 'utf8');

assert.ok(srcIndex.includes("Cross-Origin-Resource-Policy', 'same-origin'"), 'HTML responses must set CORP');
assert.ok(srcIndex.includes("Origin-Agent-Cluster', '?1'"), 'HTML responses must opt in to origin-keyed agent clusters');
assert.ok(srcIndex.includes('X-DNS-Prefetch-Control'), 'HTML responses must allow DNS prefetch control explicitly');
assert.ok(srcIndex.includes('X-Permitted-Cross-Domain-Policies'), 'HTML responses must disable cross-domain policy files');
assert.ok(srcIndex.includes('camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=(), interest-cohort=()'), 'Permissions-Policy must cover high-risk browser features');

assert.ok(template.includes('<meta name="theme-color" content="#05060e"/>'), 'Template must expose theme-color for mobile browser UI');
assert.ok(template.includes('rel="preconnect" href="https://fonts.googleapis.com"'), 'Template must preconnect Google Fonts CSS origin');
assert.ok(template.includes('rel="preconnect" href="https://fonts.gstatic.com" crossorigin'), 'Template must preconnect Google Fonts asset origin');
assert.ok(template.includes('width="40" height="40"'), 'Tenant logo preview must reserve layout dimensions');
assert.ok(template.includes('width="160" height="160"'), 'BTC QR image must reserve layout dimensions');
assert.ok(template.includes('decoding="async"'), 'Lazy images must decode asynchronously');

assert.ok(/\bgzip\s+on;/.test(nginx), 'nginx template must enable gzip');
assert.ok(/\bgzip_vary\s+on;/.test(nginx), 'nginx gzip must emit Vary: Accept-Encoding');
assert.ok(!/^\s*brotli\s+on;/m.test(nginx), 'nginx template must not require optional Brotli module');

console.log('site-security-pagespeed.test.js passed');
process.exit(0);
