'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
delete process.env.BING_WEBMASTER_API_KEY;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const agent = require('../backend/modules/growth-agent');
const dto = require('../src/site/v2/discover-trust-os');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

check('drafts stay unpublished and do not ping', () => {
  const src = fs.readFileSync(path.join(__dirname, '../backend/modules/growth-agent.js'), 'utf8');
  assert.ok(!/require\('https'\)|require\('http'\)|nodemailer|fetch\(/.test(src));
  const out = agent.tick({ dryRun: true, source: 'manual' });
  assert.strictEqual(out.protocol, 'GDO/1.0');
  assert.strictEqual(out.published, false);
  assert.strictEqual(out.createdNewUrl, false);
  assert.strictEqual(out.modelCalled, false);
  assert.strictEqual(out.indexNowPinged, false);
  assert.strictEqual(out.indexNow.owner, 'traffic-engine');
  assert.strictEqual(out.searchConsole.submitted, false);
  assert.strictEqual(out.searchConsole.reason, 'no_engine_secret');
  assert.strictEqual(out.inventsReach, false);
  assert.strictEqual(out.inventsPosts, false);
  assert.strictEqual(out.inventsIndexed, false);
  assert.strictEqual(out.records.length, dto.ARTICLES.length + dto.LANDINGS.length);
  out.records.forEach((row) => {
    assert.strictEqual(row.published, false);
    assert.strictEqual(row.seo.titleOk, true);
    assert.strictEqual(row.seo.descriptionOk, true);
    assert.strictEqual(row.seo.internalLink, true);
    assert.ok(row.canonical.indexOf('/checkout') !== 0 || row.kind === 'article');
  });
});

check('outreach file lists the desk targets and does not send', () => {
  const md = fs.readFileSync(path.join(__dirname, '../docs/outreach-targets.md'), 'utf8');
  assert.strictEqual(dto.outreachTargets().length, 20);
  dto.outreachTargets().forEach((t) => assert.ok(md.includes(t.name), t.name));
  dto.socialDrafts().forEach((d) => {
    assert.strictEqual(d.sent, false);
    assert.strictEqual(d.inventsReach, false);
    assert.ok(md.includes(d.text), d.channel);
  });
  assert.ok(md.includes('scripts/outreach-draft.js'));
  assert.ok(/will not send|does not send|Nothing in this file is posted/i.test(md));
});

console.log('growth-agent: ' + passed + ' checks passed');
process.exit(0);
