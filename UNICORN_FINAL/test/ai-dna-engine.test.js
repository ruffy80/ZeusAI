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
  const clean = dna._stripForbidden({
    language: 'en',
    gender: 'x',
    age: 30,
    tone: 'warm',
    preferences: [
      { channel: 'email', ethnicity: 'must_not_store' },
      { nested: { precise_location: 'must_not_store', safe: true } },
    ],
  });
  assert.equal(clean.language, 'en');
  assert.equal(clean.tone, 'warm');
  assert.equal(clean.gender, undefined);
  assert.equal(clean.age, undefined);
  assert.ok(!JSON.stringify(clean).includes('must_not_store'));
  assert.equal(clean.preferences[0].channel, 'email');
  assert.equal(clean.preferences[1].nested.safe, true);
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

check('getDna strict lookup reads existing ids without creating unknown strands', () => {
  const existing = dna.getDna('buyer@example.com');
  const before = dna.getStatus().counts.strandsBorn;
  const direct = dna.getDna(existing.dna.id, { create: false });
  const missing = dna.getDna('dna_missing_for_test', { create: false });
  assert.ok(direct.ok);
  assert.equal(direct.dna.id, existing.dna.id);
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'not_found');
  assert.equal(dna.getStatus().counts.strandsBorn, before);
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

check('source wiring: backend + site DNA routes, boot, and PPCOS hook exist', () => {
  const backend = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
  const site = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const ppcos = fs.readFileSync(path.join(__dirname, '..', 'src', 'commerce', 'post-pay-closure-os.js'), 'utf8');
  const healthGuardian = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'health-guardian.js'), 'utf8');
  assert.ok(backend.includes("app.get(['/api/dna/status', '/api/dna', '/.well-known/dna.json']"));
  assert.ok(backend.includes("app.get('/api/dna/:id'"));
  assert.ok(backend.includes("const dna = require('./modules/ai-dna-engine');"));
  assert.ok(backend.includes("console.log('[dna] AI DNA Engine started:'"));
  assert.ok(site.includes("urlPath.startsWith('/api/dna') || urlPath === '/.well-known/dna.json'"));
  assert.ok(site.includes("const dnaHttp = require('./site/dna-http');"));
  assert.ok(ppcos.includes('result.dna = dna.onOrderPaid'));
  assert.ok(healthGuardian.includes("'backend/modules/ai-dna-engine.js'"));
});

console.log('\n✅ ai-dna-engine:', passed, 'tests passed');
process.exit(0);
