'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const srcIndex = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'template.js'), 'utf8');
const v2Shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'v2', 'shell.js'), 'utf8');
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
assert.ok(template.includes('data-view="innovations"'), 'Header must expose the Innovations view');
assert.ok(template.includes('data-view="status"'), 'Header must expose the Status view');
assert.ok(template.includes('id="view-innovations"'), 'Template must render an innovations coverage page');
assert.ok(template.includes('id="view-status"'), 'Template must render a live status page');
assert.ok(template.includes('function rateLimitMessage'), 'Template must provide friendly rate-limit messaging');
assert.ok(template.includes('r.status===429'), 'API helper must handle HTTP 429 explicitly');
assert.ok(template.includes('Checkout promise'), 'Checkout modal must explain payment delivery expectations');

assert.ok(v2Shell.includes('Live Unicorn Status'), 'Served v2 shell must render a live status page marker');
assert.ok(v2Shell.includes('Live Innovation Coverage'), 'Served v2 shell must render an innovation coverage page marker');
assert.ok(v2Shell.includes('Checkout promise'), 'Served v2 shell must explain checkout delivery expectations');
assert.ok(v2Shell.includes('Live API is protecting'), 'Served v2 shell must provide friendly rate-limit/status wording');
assert.ok(v2Shell.includes('Buy AI Service'), 'Served v2 shell must expose a clear buy CTA');
assert.ok(v2Shell.includes('Innovation map'), 'Served v2 shell must expose innovation map navigation');
assert.ok(v2Shell.includes('function zeusResilientFetch'), 'Served v2 shell must install resilient fetch');
assert.ok(v2Shell.includes('response.status===429'), 'Served v2 shell must handle HTTP 429 explicitly');

assert.ok(/\bgzip\s+on;/.test(nginx), 'nginx template must enable gzip');
assert.ok(/\bgzip_vary\s+on;/.test(nginx), 'nginx gzip must emit Vary: Accept-Encoding');
assert.ok(!/^\s*brotli\s+on;/m.test(nginx), 'nginx template must not require optional Brotli module');

console.log('site-security-pagespeed.test.js passed');
process.exit(0);
