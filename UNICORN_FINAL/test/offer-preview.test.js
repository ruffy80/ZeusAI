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

check('a proposal figure downloads an engagement proposal and does not open a cart', () => {
  const preview = engine.offerPreview('ent-platform-license', { mode: 'contact', clock: 'contract', tier: 'enterprise' });
  assert.equal(preview.kind, 'proposal');
  assert.equal(preview.fileTitle, 'Engagement Proposal');
  assert.ok(preview.sections.length >= 4);
  assert.ok(/does not deliver the license/i.test(preview.note));
  assert.ok(preview.downloadHref.includes('/api/shelf/proposal/ent-platform-license'));
  const doc = engine.proposalDocument('ent-platform-license');
  assert.equal(doc, null);
  const sold = engine.offerPreview('ent-platform-license', { mode: 'reserve', clock: 'contract', tier: 'enterprise' });
  assert.equal(sold.kind, 'kickoff');
  assert.equal(sold.fileTitle, 'Engagement Pack');
  assert.ok(sold.sections.includes('MSA'));
  assert.ok(/not in this download/i.test(sold.note));
  assert.ok(!/source code is attached/i.test(sold.note));
  assert.equal(engine.proposalDocument('fintech-os'), null);
  const pack = engine.offerPreview('fintech-os', { mode: 'btc', clock: 'minutes', tier: 'industry' });
  assert.equal(pack.kind, 'activation');
  assert.equal(pack.fileTitle, 'Architecture Pack');
  assert.ok(/does not install an operating system/i.test(pack.note));
  const frontier = engine.proposalDocument('frontier-desk');
  assert.equal(frontier.kind, 'research-brief');
  assert.ok(/does not sell orbital compute/.test(frontier.content));
  assert.equal(engine.proposalDocument('instant-resume-makeover'), null);
  assert.equal(engine.proposalDocument('ent-engagement-kickoff'), null);
  assert.equal(engine.proposalDocument('../etc/passwd'), null);
  const closed = engine.offerPreview('not-for-sale', { mode: 'unavailable' });
  assert.equal(closed.kind, 'proposal');
  assert.equal(closed.downloadHref, undefined);
});

check('a day engagement unlocks a kickoff pack, not the finished build', () => {
  const preview = engine.offerPreview('professional-saas-mvp', { mode: 'reserve', clock: 'days', tier: 'professional' });
  assert.equal(preview.kind, 'kickoff');
  assert.equal(preview.fileTitle, 'Project Kickoff Pack');
  assert.ok(preview.sections.includes('Order Summary'));
  assert.ok(/not an instant download/i.test(preview.note));
});

check('a minute offer follows the armed model, and the logo kit names its SVG marks', () => {
  const logo = engine.offerPreview('instant-logo-kit', { mode: 'checkout', clock: 'minutes', tier: 'instant' });
  const audit = engine.offerPreview('instant-website-audit', { mode: 'checkout', clock: 'minutes', tier: 'instant' });
  assert.ok(!/vector logo|html report/i.test(JSON.stringify(audit)));
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

check('the public shelf does not promise a file the checkout will not write', () => {
  const shelf = require('../src/commerce/public-shelf').publicShelf();
  const byId = {};
  shelf.forEach((row) => { byId[row.id] = row; });
  function text(id) {
    const row = byId[id];
    assert.ok(row, id);
    return row.title + ' ' + row.description;
  }
  assert.ok(!/AI-generated logo \+ 5 variants/i.test(text('instant-logo-kit')));
  assert.ok(/SVG wordmark/.test(text('instant-logo-kit')));
  assert.ok(/SVG favicon/.test(text('instant-logo-kit')));
  assert.ok(/Service Activation Pack/.test(text('instant-logo-kit')));
  assert.ok(!/Thirty channel-ready|30 posts/i.test(text('instant-social-media-kit')));
  assert.ok(/not thirty finished posts/.test(text('instant-social-media-kit')));
  assert.ok(!/available \.com \/ \.ai|25 brandable/i.test(text('instant-product-naming')));
  assert.ok(/does not check whether a domain is available/.test(text('instant-product-naming')));
  assert.ok(/not a finished voice guide/.test(text('instant-brand-voice')));
  assert.ok(!/10 articles|1,500\+ words/.test(text('instant-seo-content-pack')));
  assert.ok(/Instant SEO Content Pack/.test(text('instant-seo-content-pack')));
  assert.ok(!/\(10 slides\)|seven-step|7-Email/i.test(text('instant-pitch-deck') + text('instant-email-sequence')));
  assert.ok(/not a Word file/.test(text('instant-resume-makeover')));
});

console.log('\n✅ offer-preview:', passed, 'tests passed');
process.exit(0);
