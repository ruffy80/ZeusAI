/**
 * live-inspect-ctas.test.js
 * Ensures Innovations / Trust / Status / API Explorer no longer dump raw JSON
 * via Open JSON / API Explorer dead-end CTAs — they use data-live-inspect.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'client.js'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'src', 'site', 'template.js'), 'utf8');

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

check('client.js exports openLiveInspect drawer helpers', () => {
  assert.ok(client.includes('function openLiveInspect'));
  assert.ok(client.includes('zeusLiveInspect'));
  assert.ok(client.includes('data-live-inspect'));
  assert.ok(client.includes('liveInspectSummary'));
});

check('shell innovations page has no Open JSON / API Explorer dead-ends', () => {
  const invStart = shell.indexOf('function pageInnovations()');
  const invEnd = shell.indexOf('function pageWizard()', invStart);
  assert.ok(invStart > 0 && invEnd > invStart);
  const inv = shell.slice(invStart, invEnd);
  assert.strictEqual((inv.match(/Open JSON/g) || []).length, 0);
  assert.strictEqual((inv.match(/Open in API Explorer/g) || []).length, 0);
  assert.strictEqual((inv.match(/Open spectrum JSON/g) || []).length, 0);
  assert.ok((inv.match(/data-live-inspect=/g) || []).length >= 40);
  assert.ok(inv.includes('invSpectrumSwatches'));
  assert.ok(inv.includes('Jump to live panel'));
});

check('shell has many site-wide live-inspect CTAs', () => {
  assert.ok((shell.match(/data-live-inspect=/g) || []).length >= 80);
});

check('API explorer inspects live instead of dumping raw links', () => {
  const start = shell.indexOf('function pageApiExplorer()');
  const end = shell.indexOf('function pageTransparency()', start);
  const page = shell.slice(start, end);
  assert.ok(page.includes('__zeusOpenLiveInspect') || page.includes('data-live-inspect'));
  assert.ok(page.includes('apiExploreBtn'));
  assert.ok(!page.includes('target="_blank" style="color:var(--violet2)"'));
});

check('trust / status no longer open raw commerce integrity in blank tabs as primary CTA pattern', () => {
  assert.ok(shell.includes('data-live-inspect="/api/commerce/integrity"') || shell.includes("data-live-inspect=\"/api/commerce/integrity\""));
  assert.ok(shell.includes('data-live-inspect="/.well-known/keys.json"'));
});

check('legacy template ADI buttons call zeusLiveInspect', () => {
  assert.ok(template.includes('zeusLiveInspect'));
  assert.ok(template.includes("zeusLiveInspect('/api/adi-core/status'"));
  assert.ok(!template.includes('Onboarding JSON'));
});

console.log(`✅ live-inspect-ctas: ${passed} tests passed`);
process.exit(0);
