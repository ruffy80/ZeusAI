'use strict';
// =============================================================================
// Enterprise layer smoke test: audit, subscriptions, metrics, orgs, activations.
// Loads enterprise.js directly (no HTTP) to verify table creation, idempotent
// inserts, weekly report, invoice text, org+API-key flow, activation issue/verify.
// =============================================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Use a unique scratch DB so this test never touches the real ledger.
process.env.DB_PATH = path.join(__dirname, '..', 'data', `enterprise-test-${Date.now()}.db`);

const enterprise = require('../backend/enterprise');

(function run() {
  // ------------------------- audit_log -------------------------
  const a1 = enterprise.audit.log({ userId: 'u_demo', action: 'login', ip: '1.2.3.4', metadata: { ua: 'curl' } });
  const a2 = enterprise.audit.log({ userId: 'u_demo', action: 'purchase.activated', metadata: { service: 'ai-site' } });
  assert.ok(a1.id && a2.id, 'audit returns id');
  const list = enterprise.audit.list({ userId: 'u_demo' });
  assert.ok(list.length >= 2, 'audit list ≥ 2 entries');
  assert.strictEqual(typeof list[0].metadata, 'object', 'metadata parsed');
  console.log(`[ok] audit.log: ${list.length} entries`);

  // ------------------------- subscriptions -------------------------
  const sub = enterprise.subscriptions.create({
    userId: 'u_demo', plan: 'pro', serviceId: 'ai-site', priceUsd: 99, durationDays: 30, autoRenew: true,
  });
  assert.ok(sub.id && sub.endDate > sub.startDate, 'subscription has end > start');
  const subs = enterprise.subscriptions.listByUser('u_demo');
  assert.strictEqual(subs.length, 1, 'one sub for user');
  // Force expiry via cancel→renew round-trip
  const renewed = enterprise.subscriptions.renew(sub.id, 7);
  assert.ok(renewed.endDate > sub.endDate || renewed.lastRenewedAt, 'renew bumped endDate or lastRenewedAt');
  const cancelled = enterprise.subscriptions.cancel(sub.id);
  assert.strictEqual(cancelled.status, 'cancelled', 'cancel transitions status');
  // Invoice text must contain ID and BTC wallet
  const invoice = enterprise.subscriptions.buildInvoiceText({ ...sub, lastRenewedAt: null });
  assert.ok(invoice.includes(sub.id) && invoice.includes('bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e'), 'invoice has id + BTC');
  console.log(`[ok] subscriptions: create/renew/cancel/invoice`);

  // ------------------------- metrics_timeseries -------------------------
  for (let i = 0; i < 5; i++) {
    enterprise.metrics.record({ reqTotal: 100 + i, reqErrors: i, latencyP50: 12, latencyP95: 80 });
  }
  const samples = enterprise.metrics.recent({ limit: 10 });
  assert.ok(samples.length >= 5, '5+ samples');
  const wr = enterprise.metrics.weeklyReport();
  assert.ok(wr.report.includes('Weekly SLA Report'), 'weekly report header');
  assert.ok(wr.samples >= 5, 'weekly report counts samples');
  console.log(`[ok] metrics: ${samples.length} samples, report=${wr.samples}`);

  // ------------------------- organizations + api keys -------------------------
  const org = enterprise.orgs.create({ name: 'Acme Co', ownerUserId: 'u_demo', plan: 'enterprise', rateLimitPerSec: 5000 });
  assert.ok(org.id && org.slug === 'acme-co', 'org slug');
  const k = enterprise.orgs.issueApiKey(org.id, 'prod');
  assert.ok(k.plaintext.startsWith('unk_') && k.plaintext.length > 30, 'api key plaintext');
  const found = enterprise.orgs.findApiKeyByPlaintext(k.plaintext);
  assert.ok(found && found.orgId === org.id, 'api key resolves to org');
  enterprise.orgs.addMember(org.id, 'u_other', 'analyst');
  const members = enterprise.orgs.listMembers(org.id);
  assert.ok(members.length >= 2, 'owner + 1 added member');
  console.log(`[ok] organizations: ${org.slug} key=${k.keyId.slice(0, 12)} members=${members.length}`);

  // ------------------------- service activations -------------------------
  const act = enterprise.activations.issue({ userId: 'u_demo', serviceId: 'ai-site', paymentTxId: 'pay_demo' });
  assert.ok(act.token.startsWith('act_'), 'activation token prefix');
  const verified = enterprise.activations.verify(act.token);
  assert.ok(verified && verified.serviceId === 'ai-site' && verified.status === 'active', 'activation verifies');
  const wrong = enterprise.activations.verify('act_nonsense');
  assert.strictEqual(wrong, null, 'bad token rejected');
  enterprise.activations.revoke(act.id);
  const after = enterprise.activations.verify(act.token);
  assert.strictEqual(after, null, 'revoked token rejected');
  console.log(`[ok] activations: issue/verify/revoke`);

  // ------------------------- meta -------------------------
  const meta = enterprise.meta();
  assert.ok(meta.counts.audit >= 2 && meta.counts.subscriptions >= 1, 'meta counts populated');
  console.log(`[ok] meta: ${JSON.stringify(meta.counts)}`);

  // cleanup test DB
  try { fs.unlinkSync(process.env.DB_PATH); fs.unlinkSync(process.env.DB_PATH + '-shm'); fs.unlinkSync(process.env.DB_PATH + '-wal'); } catch (_) {}
  console.log('\n[enterprise-ready.test.js] all assertions passed');
  process.exit(0);
})();
