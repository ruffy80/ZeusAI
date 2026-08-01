'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aedo-'));
process.env.UNICORN_COMMERCE_DIR = tmp;

const aedo = require('../src/commerce/autonomous-enterprise-deal-orchestrator');
const pack = require('../src/commerce/enterprise-proposal-pack');
const negotiator = require('../src/commerce/negotiation-engine');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
}

console.log('AEDO autonomous enterprise deal orchestrator tests');

check('detectRail: ACV < 10k → instant', () => {
  const r = aedo.detectRail({ acvUsd: 5000 });
  assert.equal(r.rail, 'instant');
  assert.match(r.cta, /Buy/i);
});

check('detectRail: ACV 10–50k → professional', () => {
  const r = aedo.detectRail({ acvUsd: 25000 });
  assert.equal(r.rail, 'professional');
});

check('detectRail: ACV > 50k → enterprise', () => {
  const r = aedo.detectRail({ acvUsd: 250000, productId: 'ent-platform-license' });
  assert.equal(r.rail, 'enterprise');
  assert.match(r.cta, /Autonomous Deal/i);
});

check('computeAcv returns low/mid/high + breakdown', () => {
  const acv = aedo.computeAcv({
    productId: 'ent-platform-license',
    seats: 50,
    slaTier: 'enterprise',
    integrations: ['sso', 'salesforce'],
    compliance: ['GDPR', 'SOC2'],
    termYears: 1,
  });
  assert.ok(acv.mid > 50000);
  assert.ok(acv.low < acv.mid && acv.mid < acv.high);
  assert.ok(Array.isArray(acv.breakdown) && acv.breakdown.length >= 3);
});

check('computeKickoff is 5–10% ACV clamped $1k–$25k', () => {
  const k = aedo.computeKickoff(200000, { complexity: 0.8, risk: 0.7 });
  assert.ok(k.percentage >= 0.05 && k.percentage <= 0.10);
  assert.ok(k.kickoffUsd >= 1000 && k.kickoffUsd <= 25000);
  assert.equal(k.kickoffUsd, Math.max(1000, Math.min(25000, Math.round(200000 * k.percentage))));

  const tiny = aedo.computeKickoff(5000, { complexity: 0.2, risk: 0.2 });
  assert.equal(tiny.kickoffUsd, 1000);

  const huge = aedo.computeKickoff(5000000, { complexity: 1, risk: 1 });
  assert.equal(huge.kickoffUsd, 25000);
});

check('proposeOffer returns packages + rail', () => {
  const o = aedo.proposeOffer({ productId: 'ent-platform-license', seats: 40, slaTier: 'enterprise' });
  assert.equal(o.rail.rail, 'enterprise');
  assert.ok(o.packages.length === 3);
  assert.ok(o.kickoff.kickoffUsd >= 1000);
});

check('proposal pack generates 6 documents', () => {
  const p = pack.generatePack({
    buyer: { legalEntity: 'Acme Corp', email: 'cfo@acme.com', contactName: 'CFO' },
    product: { id: 'ent-platform-license', title: 'Platform License' },
    acv: { mid: 250000, accepted: 250000 },
    kickoffUsd: 18750,
    termYears: 2,
    requirements: { slaTier: 'enterprise', integrations: ['SSO'], compliance: ['GDPR'] },
  });
  assert.ok(p.packId);
  assert.equal(p.documents.length, 6);
  const keys = p.documents.map((d) => d.key).sort();
  assert.deepEqual(keys, [
    'msa', 'payment-schedule', 'security-compliance', 'sow', 'technical-appendix', 'timeline-milestones',
  ].sort());
  const msa = pack.readDocument(p.packId, 'msa');
  assert.ok(/Master Service Agreement/i.test(msa));
  const sow = pack.readDocument(p.packId, 'sow');
  assert.ok(/Statement of Work/i.test(sow));
});

check('confirmAutonomous closes deal without human OTP', () => {
  negotiator._resetForTests();
  const deal = negotiator.startDeal({
    productId: 'ent-platform-license',
    buyer: { email: 'ceo@acme.com', legalEntity: 'Acme', contactName: 'CEO' },
    offerUSD: 200000,
  });
  negotiator.counter(deal.id, 180000, 'volume');
  negotiator.accept(deal.id);
  const confirmed = negotiator.confirmAutonomous(deal.id);
  assert.equal(confirmed.state, 'confirmed');
  assert.equal(confirmed.autonomousConfirm, true);
  assert.ok(confirmed.contractId);
});

check('closeFromDeal mints kickoff + pack + onboarding', () => {
  negotiator._resetForTests();
  const deal = negotiator.startDeal({
    productId: 'ent-platform-license',
    buyer: { email: 'deal@acme.com', legalEntity: 'Acme Deal', contactName: 'VP' },
    offerUSD: 220000,
  });
  negotiator.accept(deal.id);
  const closure = aedo.closeFromDeal(deal, { seats: 30, slaTier: 'enterprise' });
  assert.ok(closure.kickoff && closure.kickoff.netUsd >= 1000 && closure.kickoff.netUsd <= 25000);
  assert.ok(closure.pack && closure.pack.packId);
  assert.equal(closure.pack.documents.length, 6);
  assert.ok(closure.onboarding && closure.onboarding.id);
});

check('publicStatus advertises autonomy + kickoff policy', () => {
  const s = aedo.publicStatus();
  assert.equal(s.protocol, 'AEDO/1.0');
  assert.equal(s.autonomy.humanApprovalRequired, false);
  assert.equal(s.kickoffPolicy.minUsd, 1000);
  assert.equal(s.kickoffPolicy.maxUsd, 25000);
});

check('src + backend wire AEDO routes', () => {
  const idx = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  const be = fs.readFileSync(path.join(__dirname, '../backend/modules/enterprise-cloud-router.js'), 'utf8');
  assert.ok(idx.includes('autonomous-enterprise-deal-orchestrator'));
  assert.ok(idx.includes('/api/enterprise/aedo'));
  assert.ok(idx.includes('confirmAutonomous'));
  assert.ok(be.includes('/api/enterprise/aedo'));
  assert.ok(be.includes('enterprise-proposal-pack'));
});

console.log(`\n✅ autonomous-enterprise-deal-orchestrator: ${passed} tests passed`);
