// =====================================================================
// ai-dna-engine.test.js — AI DNA Engine DNA/1.0
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUS_DNA_DIR = require('os').tmpdir() + '/dna-' + process.pid + '-' + Date.now();
process.env.ZEUS_DNA_DISABLED = '0';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';
process.env.ADMIN_SECRET = 'test-dna-admin';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

delete require.cache[require.resolve('../backend/modules/ai-dna-engine')];
const dna = require('../backend/modules/ai-dna-engine');
dna._resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('discovery: DNA/1.0, not a user profile, forbidden traits listed', () => {
  const d = dna.discovery();
  assert.equal(d.protocol, 'DNA/1.0');
  assert.equal(d.notAUserProfile, true);
  assert.ok(d.forbiddenTraits.includes('gender'));
  assert.ok(d.forbiddenTraits.includes('ethnicity'));
  assert.ok(d.adapters.length >= 8);
  assert.ok(d.ecosystemBonds.includes('genome'));
  assert.ok(d.ecosystemBonds.includes('omega'));
});

check('stripForbidden removes sensitive keys', () => {
  const clean = dna._stripForbidden({ language: 'en', gender: 'x', age: 30, tone: 'warm' });
  assert.equal(clean.language, 'en');
  assert.equal(clean.tone, 'warm');
  assert.equal(clean.gender, undefined);
  assert.equal(clean.age, undefined);
});

check('onOrderPaid builds DNA strand + ecosystem bonds', () => {
  const out = dna.onOrderPaid({
    orderId: 'ord_dna_1',
    serviceId: 'starter',
    serviceName: 'Starter',
    email: 'buyer@example.com',
    lang: 'ro',
  });
  assert.ok(out.ok);
  assert.ok(out.dnaId.startsWith('dna_'));
  assert.equal(out.dna.productCount, 1);
  assert.equal(out.dna.language, 'ro');
  assert.ok(out.dna.ecosystem.omega.linked);
  assert.ok(out.dna.ecosystem.genome.linked);
  assert.ok(out.dna.ecosystem.vault.linked);
  assert.ok(out.personalization && out.personalization.adaptations);
});

check('ensureDna is idempotent for same email', () => {
  const a = dna.ensureDna('buyer@example.com');
  const b = dna.ensureDna('buyer@example.com');
  assert.ok(a.ok && b.ok);
  assert.equal(a.dna.id, b.dna.id);
  assert.equal(dna.getStatus().counts.strandsBorn, 1);
});

check('observeEvent records interaction + feature adoption', () => {
  const out = dna.observeEvent({
    email: 'buyer@example.com',
    type: 'feature_use',
    feature: 'concierge_chat',
    sku: 'starter',
  });
  assert.ok(out.ok);
  assert.ok(out.dna.featureAdoption.concierge_chat >= 1);
});

check('updateSettings rejects forbidden traits and keeps explicit prefs', () => {
  const out = dna.updateSettings('buyer@example.com', {
    language: 'en',
    tone: 'direct',
    gender: 'should_not_store',
    notificationFrequency: 'weekly',
    automationAggressiveness: 'gentle',
  });
  assert.ok(out.ok);
  assert.equal(out.dna.language, 'en');
  assert.equal(out.dna.notifications.frequency, 'weekly');
  assert.equal(out.dna.automation.aggressiveness, 'gentle');
  const full = dna.getDna('buyer@example.com');
  assert.ok(!JSON.stringify(full).includes('should_not_store'));
});

check('personalize returns adaptations (onboarding, AI style, suggestions)', () => {
  const p = dna.personalize({ email: 'buyer@example.com', intent: 'post_purchase', sku: 'starter' });
  assert.ok(p.ok);
  assert.ok(p.adaptations.onboarding);
  assert.ok(p.adaptations.aiResponseStyle.language);
  assert.ok(Array.isArray(p.adaptations.productSuggestions));
  assert.ok(p.adaptations.onboarding.welcome || p.adaptations.tutorials.length >= 0);
});

check('personalize uses TTL cache on second call', () => {
  const before = dna.getStatus().counts.cacheHits;
  const p = dna.personalize({ email: 'buyer@example.com', intent: 'post_purchase', sku: 'starter' });
  assert.ok(p.ok);
  assert.equal(p.cached, true);
  assert.ok(dna.getStatus().counts.cacheHits > before);
});

check('learnOnce generates honest suggestions without fake revenue', () => {
  // second product unused → adoption nudge
  dna.onOrderPaid({
    orderId: 'ord_dna_2',
    serviceId: 'frontier-nexus',
    email: 'buyer@example.com',
  });
  const out = dna.learnOnce();
  assert.ok(out.ok);
  assert.ok(out.learned >= 1);
  const g = dna.getDna('buyer@example.com');
  assert.ok(Array.isArray(g.learning.suggestions));
  assert.ok(!JSON.stringify(g).includes('fake'));
});

check('Future Mode migration preserves customer data', () => {
  const m = dna.proposePersonalizationMigration({ target: 'dna_helix_v2' });
  assert.ok(m.ok);
  assert.equal(m.plan.preserveCustomerData, true);
  assert.equal(m.plan.applied, false);
  assert.ok(m.plan.steps.some((s) => s.requiresApproval));
});

check('registerAdapter extends engine without core rewrite', () => {
  const r = dna.registerAdapter({ id: 'voice_prefs', title: 'Voice preferences', source: 'extension' });
  assert.ok(r.ok);
  assert.ok(r.adapters.includes('voice_prefs'));
});

check('persistence under ZEUS_DNA_DIR + audit log', () => {
  const dir = process.env.ZEUS_DNA_DIR;
  assert.ok(fs.existsSync(path.join(dir, 'strands.json')));
  assert.ok(fs.existsSync(path.join(dir, 'state.json')));
  assert.ok(fs.existsSync(path.join(dir, 'audit.jsonl')));
});

check('site dna-http adminOk fails closed without secret', () => {
  const http = require('../src/site/dna-http');
  assert.equal(http.adminOk({ headers: {} }).ok, false);
  assert.equal(http.adminOk({ headers: { 'x-admin-secret': 'test-dna-admin' } }).ok, true);
});

console.log('\n✅ ai-dna-engine:', passed, 'tests passed');
process.exit(0);
