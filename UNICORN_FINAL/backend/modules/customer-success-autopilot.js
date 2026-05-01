// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T16:49:42.265Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * customer-success-autopilot (REAL implementation)
 * ------------------------------------------------
 * Reads paid orders from the SQLite portal and produces, per customer,
 * a deterministic onboarding plan, health score, and renewal nudge state.
 * Optionally fires onboarding emails through transactional-email.
 *
 * No background timers. Pull-based; the dispatcher (or owner cron) calls
 * `tick()` to advance state. RO+EN comments preserved.
 */

const path = require('path');

const NAME = 'customer-success-autopilot';

let portal = null;
try { portal = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'customer-portal.js')); } catch (_) {}
let mailer = null;
try { mailer = require(path.join(__dirname, 'transactional-email.js')); } catch (_) {}

const _emailLog = new Map(); // `${customerId}:${stage}` → ts
const ONBOARDING_STAGES = [
  { id: 'welcome',   delayHours: 0,    subject: 'Welcome to ZeusAI / Unicorn',
    body: (c) => `Hello ${c.name || c.email},\n\nYour ZeusAI license is live. Get started at /me/services.\n\n— ZeusAI` },
  { id: 'activate',  delayHours: 24,   subject: 'Activate your first KPI win',
    body: (c) => `Hi ${c.name || c.email},\n\nDay 1 done. Connect your first data source today and lock the first signed KPI win in <24h. Need help? Reply.\n\n— ZeusAI` },
  { id: 'review-7d', delayHours: 168,  subject: 'Your 7-day signed KPI proof',
    body: (c) => `Hi ${c.name || c.email},\n\nA week in. Pull your signed KPI receipt at /api/uaic/receipts and share it with stakeholders.\n\n— ZeusAI` },
  { id: 'review-30d', delayHours: 720, subject: 'Your 30-day Unicorn impact report',
    body: (c) => `Hi ${c.name || c.email},\n\nMonth one. Your 30-day signed KPI summary is ready. Reply if you'd like a renewal expansion proposal.\n\n— ZeusAI` }
];

function _allOrders() {
  if (!portal || typeof portal._listOrders !== 'function') return [];
  return portal._listOrders();
}

function buildHealthFor(customerId) {
  const orders = _allOrders().filter((o) => o.customerId === customerId);
  const paid = orders.filter((o) => o.status === 'paid' || o.status === 'delivered');
  const totalSpentUsd = paid.reduce((s, o) => s + Number(o.priceUSD || 0), 0);
  const lastPaidAt = paid.map((o) => Date.parse(o.paidAt || o.createdAt || '') || 0).reduce((a, b) => Math.max(a, b), 0);
  const daysSincePaid = lastPaidAt ? Math.floor((Date.now() - lastPaidAt) / 86400000) : null;
  const stuck = orders.filter((o) => o.status === 'awaiting_payment').length;
  let health = 50;
  health += Math.min(40, paid.length * 10);
  health += totalSpentUsd >= 1000 ? 10 : 0;
  health -= stuck * 5;
  if (daysSincePaid !== null && daysSincePaid > 60) health -= 15;
  health = Math.max(0, Math.min(100, health));
  let stage = 'lead';
  if (paid.length === 1) stage = 'activated';
  else if (paid.length >= 2 && daysSincePaid !== null && daysSincePaid <= 30) stage = 'engaged';
  else if (daysSincePaid !== null && daysSincePaid > 30 && daysSincePaid <= 60) stage = 'at-risk';
  else if (daysSincePaid !== null && daysSincePaid > 60) stage = 'churning';
  return { customerId, paidCount: paid.length, totalSpentUsd: +totalSpentUsd.toFixed(2), stuck, lastPaidAt: lastPaidAt ? new Date(lastPaidAt).toISOString() : null, daysSincePaid, health, stage };
}

function snapshot() {
  const orders = _allOrders();
  const ids = Array.from(new Set(orders.map((o) => o.customerId).filter(Boolean)));
  const cohort = ids.map(buildHealthFor);
  const totals = cohort.reduce((acc, h) => {
    acc.customers += 1;
    acc.gmvUsd += h.totalSpentUsd;
    acc.activated += h.stage === 'activated' ? 1 : 0;
    acc.engaged += h.stage === 'engaged' ? 1 : 0;
    acc.atRisk += h.stage === 'at-risk' ? 1 : 0;
    acc.churning += h.stage === 'churning' ? 1 : 0;
    return acc;
  }, { customers: 0, gmvUsd: 0, activated: 0, engaged: 0, atRisk: 0, churning: 0 });
  totals.gmvUsd = +totals.gmvUsd.toFixed(2);
  return { totals, cohort };
}

function tick(opts) {
  const dryRun = !!(opts && opts.dryRun);
  const snap = snapshot();
  const fired = [];
  if (!portal) return { ok: true, fired, reason: 'no_portal', snapshot: snap };
  for (const h of snap.cohort) {
    if (h.paidCount === 0) continue;
    const cust = typeof portal.getById === 'function' ? portal.getById(h.customerId) : null;
    if (!cust || !cust.email) continue;
    const since = Date.parse(cust.createdAt || '') || (h.lastPaidAt ? Date.parse(h.lastPaidAt) : Date.now());
    const ageH = (Date.now() - since) / 3600000;
    for (const stage of ONBOARDING_STAGES) {
      if (ageH < stage.delayHours) continue;
      const key = `${h.customerId}:${stage.id}`;
      if (_emailLog.has(key)) continue;
      _emailLog.set(key, Date.now());
      if (!dryRun && mailer && typeof mailer.send === 'function') {
        try { mailer.send({ to: cust.email, subject: stage.subject, text: stage.body(cust) }); } catch (_) {}
      }
      fired.push({ customerId: h.customerId, stage: stage.id, dryRun });
    }
  }
  return { ok: true, scannedAt: new Date().toISOString(), fired, totals: snap.totals };
}

function getStatus(opts) {
  const snap = snapshot();
  return {
    ok: true,
    name: NAME,
    title: 'Customer Success Autopilot',
    domain: 'customer-success',
    summary: 'Health-scores customers, schedules onboarding emails, flags churn risk.',
    portalAttached: !!portal,
    mailerAttached: !!mailer,
    totals: snap.totals,
    sample: snap.cohort.slice(0, 5),
    emailsEverFired: _emailLog.size,
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return tick(input); }

module.exports = { name: NAME, snapshot, tick, buildHealthFor, getStatus, run };
