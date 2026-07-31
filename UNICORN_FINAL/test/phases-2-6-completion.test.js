/**
 * Phases 2–6 completion — rails honesty, settle bridge, payouts, perf, referral SoT.
 */
'use strict';

process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failed = 0;
function check(label, fn) {
  try {
    fn();
    console.log('  ok  ' + label);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + label + ' — ' + (e && e.message ? e.message : e));
  }
}

check('phase2: sovereign recovery is async and awaits send ok', () => {
  const src = read('src/site/sovereign-commerce.js');
  assert.ok(/async function recoverStuckPending/.test(src));
  assert.ok(src.includes('emailed = !!(r && r.ok)'));
  assert.ok(src.includes('Armed Rails Continuum'));
  assert.ok(src.includes('emailConfigured'));
});

check('phase2: checkout-recovery awaits sendRaw and only marks on ok', () => {
  const src = read('backend/modules/checkout-recovery-agent.js');
  assert.ok(/async function recover/.test(src));
  assert.ok(src.includes('await mailer.sendRaw'));
  assert.ok(src.includes('if (r && r.ok)'));
});

check('phase2: payment methods expose emailConfigured', () => {
  const site = read('src/index.js');
  const backend = read('backend/index.js');
  assert.ok(site.includes('emailConfigured'));
  assert.ok(backend.includes('emailConfigured'));
  const gw = read('backend/modules/paymentGateway.js');
  assert.ok(gw.includes('sk_(test|live)_'));
});

check('phase3: canonical settle bridge dual-write + paid mirror', () => {
  const bridge = require('../src/commerce/canonical-settle-bridge');
  assert.equal(bridge.PROTOCOL, 'CSB/1.0');
  assert.ok(typeof bridge.bridgeCreate === 'function');
  assert.ok(typeof bridge.bridgePaid === 'function');
  const src = read('src/site/sovereign-commerce.js');
  assert.ok(src.includes('canonical-settle-bridge'));
  assert.ok(src.includes('bridgeCreate'));
  assert.ok(src.includes('bridgePaid'));
  assert.ok(src.includes('portalOrderId'));
});

check('phase4: referral payout ledger listPending + markPaid', () => {
  const referral = require('../src/commerce/referral-engine-real');
  if (typeof referral._resetForTests === 'function') referral._resetForTests();
  const code = 'P4TEST' + Date.now().toString(36).toUpperCase().slice(-6);
  referral.ensureTrackedCode(code, { ownerEmail: 'partner-p4@example.com' });
  const orderId = 'ord_p4_' + Date.now();
  const red = referral.recordRedemption({
    code,
    referredEmail: 'buyer-p4@example.com',
    orderId,
    amountUsd: 200,
  });
  assert.ok(red.ok);
  const pending = referral.listPendingPayouts(50);
  assert.ok(pending.ok && pending.count >= 1);
  const hit = (pending.pending || []).find((r) => (r.order_id || r.orderId) === orderId || r.id === red.id);
  assert.ok(hit, 'pending payout should include new redemption');
  const paid = referral.markPaid(hit.id || red.id, { txid: 'deadbeefcafebabe01' });
  assert.ok(paid.ok && paid.payoutStatus === 'paid');
  assert.ok(/ledger_only/.test(paid.honesty || ''));
  const paid2 = referral.markPaid(hit.id || red.id, { txid: 'deadbeefcafebabe01' });
  assert.ok(paid2.duplicate, 'second markPaid must be duplicate');
});

check('phase4: admin payout routes exist on site', () => {
  const src = read('src/index.js');
  assert.ok(src.includes('/api/referral/payouts/pending'));
  assert.ok(src.includes('/api/referral/payouts/mark-paid'));
  assert.ok(src.includes('listPendingPayouts'));
  assert.ok(src.includes('markPaid'));
});

check('phase4: lead hunter outreach metrics + await honesty', () => {
  const src = read('backend/modules/autonomous-lead-hunter.js');
  assert.ok(src.includes('outreach'));
  assert.ok(src.includes("outreachDelivery === 'sent'"));
  assert.ok(src.includes('await mailer.sendRaw'));
  assert.ok(src.includes("lead.outreachDelivery = 'sent'"));
});

check('phase5: lead hunter gated under stable; three.js home-only', () => {
  const idx = read('backend/index.js');
  assert.ok(idx.includes('LEAD_HUNTER_FORCE'));
  assert.ok(idx.includes('_stableRuntime'));
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes("route !== '/'"));
  assert.ok(shell.includes('loadThree'));
});

check('phase6: referralEngine + global-referral-loop deprecate to SoT', () => {
  const eng = require('../backend/modules/referralEngine');
  assert.ok(eng.DEPRECATED && eng.DEPRECATED.sot.includes('referral-engine-real'));
  const loopSrc = read('backend/modules/global-referral-loop.js');
  assert.ok(loopSrc.includes('DEPRECATED'));
  assert.ok(loopSrc.includes('referral-engine-real'));
  assert.ok(loopSrc.includes('recordRedemption'));
  const created = eng.createReferral('user_p6', 'affiliate-p6@example.com');
  assert.ok(created && created.code);
  assert.ok(created.deprecated);
});

check('roadmap doc marks phases 2-6 done', () => {
  const doc = read('docs/architecture-audit-roadmap.md');
  assert.ok(doc.includes('CSB/1.0'));
  assert.ok(/Phase 2[\s\S]*\*\*DONE\*\*/.test(doc) || doc.includes('| **2**') && doc.includes('**DONE**'));
  assert.ok(doc.includes('listPendingPayouts') || doc.includes('Affiliate payout'));
  assert.ok(doc.includes('LEAD_HUNTER_FORCE'));
});

check('client hydratePaymentRails surfaces email + hides unarmed card', () => {
  const client = read('src/site/v2/client.js');
  assert.ok(client.includes('emailConfigured'));
  assert.ok(client.includes('cardArmed'));
  assert.ok(client.includes('arkEmail'));
});

if (failed) {
  console.error('phases-2-6-completion.test.js: ' + failed + ' assertion(s) failed.');
  process.exit(1);
}
console.log('phases-2-6-completion.test.js: all assertions passed');
