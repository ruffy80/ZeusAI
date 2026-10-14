'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const engine = require('../src/site/v2/fulfillment-engine');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('a proposal figure has no checkout file', () => {
  const preview = engine.offerPreview('ent-platform-license', { mode: 'contact', clock: 'contract', tier: 'enterprise' });
  assert.equal(preview.kind, 'proposal');
  assert.equal(preview.fileTitle, 'No checkout file');
  assert.equal(preview.sections.length, 0);
  assert.ok(/proposal/i.test(preview.note));
});

check('a day engagement unlocks a kickoff pack, not the finished build', () => {
  const preview = engine.offerPreview('professional-saas-mvp', { mode: 'reserve', clock: 'days', tier: 'professional' });
  assert.equal(preview.kind, 'kickoff');
  assert.equal(preview.fileTitle, 'Project Kickoff Pack');
  assert.ok(preview.sections.includes('Order Summary'));
  assert.ok(/not an instant download/i.test(preview.note));
});

check('a minute offer follows the armed model, and never claims an SVG logo', () => {
  const logo = engine.offerPreview('instant-logo-kit', { mode: 'checkout', clock: 'minutes', tier: 'instant' });
  const audit = engine.offerPreview('instant-website-audit', { mode: 'checkout', clock: 'minutes', tier: 'instant' });
  assert.ok(!/svg|vector logo|html report/i.test(JSON.stringify(logo)));
  assert.ok(!/svg|vector logo/i.test(JSON.stringify(audit)));
  if (engine.shouldUseAiForSku('instant-logo-kit')) {
    assert.equal(logo.kind, 'generated');
  } else {
    assert.equal(logo.kind, 'activation');
    assert.equal(logo.fileTitle, 'Service Activation Pack');
  }
  if (engine.shouldUseAiForSku('instant-website-audit')) {
    assert.equal(audit.kind, 'generated');
    assert.ok(/audit/i.test(audit.fileTitle));
  } else {
    assert.equal(audit.kind, 'activation');
  }
});

check('the shelf names the file on every card and drops the false three-pack claims', () => {
  const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'v2', 'shell.js'), 'utf8');
  assert.ok(shell.includes('class="atlas-file"'));
  assert.ok(shell.includes('What you receive'));
  assert.ok(shell.includes('Website Audit'));
  assert.ok(shell.includes('Logo Kit'));
  assert.ok(shell.includes('SEO Pack'));
  assert.ok(!shell.includes('single self-contained HTML file'));
  assert.ok(!shell.includes('SVG + palette'));
  const checkout = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'sovereign-commerce.js'), 'utf8');
  assert.ok(checkout.includes('id="packBody"'));
  assert.ok(checkout.includes("body.textContent=text"));
  const sell = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'v2', 'sell-surface.js'), 'utf8');
  assert.ok(sell.includes('class="atlas-file"'));
  assert.ok(sell.includes('Buy what we actually deliver'));
});

console.log('\n✅ offer-preview:', passed, 'tests passed');
process.exit(0);
