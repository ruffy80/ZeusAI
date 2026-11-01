'use strict';

// Fulfillment engine test — deterministic activation packs always ship;
// AI path remains optional when FULFILLMENT_AI_ENABLED=1 + provider stub.

const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

process.env.NODE_ENV = 'test';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-fulfill-'));
process.env.UNICORN_DATA_DIR = TMP;
delete process.env.FULFILLMENT_AI_ENABLED;

const aiProviders = require('../backend/modules/aiProviders');
const registry = require('../src/site/v2/delivery-registry');
const engine = require('../src/site/v2/fulfillment-engine');

let pass = 0;
function check(name, fn) { fn(); pass++; console.log('  \u2713 ' + name); }

(async () => {
  check('picks code-scaffold recipe for a SaaS/MVP service', () => {
    assert.strictEqual(engine.pickRecipe('professional-saas-mvp').id, 'code-scaffold');
  });
  check('picks seo-content-pack for content services', () => {
    assert.strictEqual(engine.pickRecipe('instant-seo-content-pack').id, 'seo-content-pack');
  });
  check('picks landing-page for website services', () => {
    assert.strictEqual(engine.pickRecipe('instant-landing-page').id, 'landing-page');
  });
  check('unmatched service still gets a real generic consulting brief', () => {
    assert.strictEqual(engine.pickRecipe('some-exotic-enterprise-thing-xyz').id, 'consulting-brief');
  });

  registry.deliver({ id: 'r_det', email: 't@example.com', services: ['instant-seo-content-pack'] });
  const det = await engine.fulfillReceipt({ id: 'r_det', email: 't@example.com', services: ['instant-seo-content-pack'] });
  check('flag-off still delivers deterministic activation pack', () => {
    assert.strictEqual(det.ok, true);
    assert.strictEqual(det.fulfillmentStatus, 'deterministic');
    assert.strictEqual(det.delivered, 1);
    assert.ok(/Service Activation Pack/.test(det.artifacts[0].content));
    assert.ok(/## Article/.test(det.artifacts[0].content));
    assert.strictEqual(det.artifacts[0].fulfillmentMode, 'deterministic');
  });

  const logo = await engine.fulfillReceipt({
    id: 'r_logo',
    email: 't@example.com',
    services: ['instant-logo-kit'],
    meta: { inputs: { brandName: 'Northwind', industry: 'tools' } },
  });
  check('a logo order writes the brand kit and the SVG marks for the brand', () => {
    const text = logo.artifacts[0].content;
    assert.ok(/Service Activation Pack/.test(text));
    assert.ok(/Name candidates/.test(text));
    assert.ok(/Northwind/.test(text));
    assert.ok(/<svg/.test(text));
    assert.ok(/does not check whether a domain is available/.test(text));
  });

  const mail = await engine.fulfillReceipt({
    id: 'r_mail',
    email: 't@example.com',
    services: ['instant-email-sequence'],
    meta: { inputs: { product: 'A shelf audit', goal: 'activation' } },
  });
  check('an email order writes five emails', () => {
    const text = mail.artifacts[0].content;
    assert.ok(/## Email 1/.test(text));
    assert.ok(/## Email 5/.test(text));
  });

  const kick = await engine.fulfillReceipt({
    id: 'r_kick',
    email: 't@example.com',
    services: ['professional-saas-mvp'],
    amount: 1999,
  });
  check('a professional order writes the kickoff and not the finished build', () => {
    const text = kick.artifacts[0].content;
    assert.ok(/# Project Kickoff Pack/.test(text));
    assert.ok(/The finished build is not in this file/.test(text));
    assert.strictEqual(kick.requiresHumanFulfillment, true);
  });

  process.env.FULFILLMENT_AI_ENABLED = '1';
  aiProviders.chat = async () => ({ reply: '# SEO Content Pack\n\nKeywords: alpha, beta\n\nReal generated article body...', provider: 'stub-model' });

  registry.deliver({ id: 'r1', email: 't@example.com', services: ['instant-seo-content-pack'] });
  const out = await engine.fulfillReceipt({ id: 'r1', email: 't@example.com', services: ['instant-seo-content-pack'] });

  check('fulfillReceipt succeeds and marks ai fulfillment', () => {
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.fulfillmentStatus, 'ai');
    assert.strictEqual(out.delivered, 1);
  });
  check('artifact has real generated content + correct recipe/format', () => {
    const a = out.artifacts[0];
    assert.strictEqual(a.recipe, 'seo-content-pack');
    assert.strictEqual(a.format, 'markdown');
    assert.ok(/Real generated article body/.test(a.content), 'content should be the model reply');
    assert.ok(a.bytes > 0);
    assert.strictEqual(a.fulfillmentMode, 'ai');
  });
  check('artifacts are attached to the delivery record + downloadable via registry', () => {
    const d = registry.get('r1');
    assert.ok(Array.isArray(d.artifacts) && d.artifacts.length === 1);
    assert.strictEqual(d.fulfillmentStatus, 'ai');
    const one = registry.renderArtifacts(d, 'artifact', 'instant-seo-content-pack');
    assert.ok(one && /Real generated article body/.test(one.content));
    const list = registry.renderArtifacts(d, 'artifacts');
    assert.strictEqual(list.artifacts.length, 1);
    assert.ok(!('content' in list.artifacts[0]), 'list view must not leak bulky content');
  });

  check('detects enterprise by service id ($4M sovereign)', () => {
    assert.strictEqual(engine.isEnterprise({ amount: 10 }, 'sovereign-private-deployment'), true);
  });
  check('detects enterprise by amount threshold', () => {
    assert.strictEqual(engine.isEnterprise({ amount: 6000 }, 'starter'), true);
  });

  registry.deliver({ id: 'r_ent', email: 'ceo@corp.com', services: ['enterprise-tier'], amount: 9999 });
  const ent = await engine.fulfillReceipt({ id: 'r_ent', email: 'ceo@corp.com', services: ['enterprise-tier'], amount: 9999 });
  check('enterprise path delivers engagement pack and flags human fulfillment', () => {
    assert.strictEqual(ent.ok, true);
    assert.strictEqual(ent.requiresHumanFulfillment, true);
    assert.ok(ent.artifacts[0].requiresHumanFulfillment);
  });

  const prevCommerce = process.env.UNICORN_COMMERCE_DIR;
  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ent-pack-'));
  process.env.UNICORN_COMMERCE_DIR = packDir;
  const packed = await engine.fulfillReceipt({
    id: 'r_acq', email: 'buyer@corp.com', services: ['ent-acquisition-pack'], amount: 4000000,
  });
  if (prevCommerce == null) delete process.env.UNICORN_COMMERCE_DIR;
  else process.env.UNICORN_COMMERCE_DIR = prevCommerce;
  check('a paid acquisition issues the six documents and does not attach source', () => {
    assert.strictEqual(packed.ok, true);
    const file = packed.artifacts[0];
    assert.ok(/not in this download/i.test(file.content));
    assert.ok(!/source code is attached/i.test(file.content));
    assert.ok(file.engagementDocuments.includes('msa'));
    assert.ok(file.engagementDocuments.includes('sow'));
    assert.ok(file.engagementDocuments.includes('technical-appendix'));
    assert.ok(file.engagementDocuments.includes('security-compliance'));
    assert.ok(file.engagementDocuments.includes('timeline-milestones'));
    assert.ok(file.engagementDocuments.includes('payment-schedule'));
    const sow = fs.readFileSync(path.join(packDir, 'proposal-packs', file.engagementPackId + '-sow.md'), 'utf8');
    assert.ok(/not in this download/i.test(sow));
  });

  console.log('\u2705 fulfillment-engine: ' + pass + ' tests passed');
})().catch((e) => {
  console.error('fulfillment-engine test failed:', e);
  process.exit(1);
});
