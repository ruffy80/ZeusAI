'use strict';
// =====================================================================================
// OWNERSHIP: Proprietatea lui Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================================
//
// subscription-engine.js
// ──────────────────────
// Recurring billing + subscription management layer.
//
// Supports:
//  - Free / Starter / Pro / Enterprise tiers
//  - BTC periodic billing (manual confirmation + auto-prompt)
//  - Stripe subscription checkout (when STRIPE_SECRET_KEY configured)
//  - NOWPayments recurring (USDT/ETH/SOL → settled to BTC)
//  - Trial periods, grace periods, dunning
//  - Split payments (multi-party revenue share)
//
// In-memory by default; persists to data/subscriptions/ when SUBS_PERSIST=1.

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'subscriptions');
const PERSIST = process.env.SUBS_PERSIST !== '0'; // on by default

const PLANS = {
  free:       { id: 'free',       name: 'Free',       priceUsd: 0,      interval: 'monthly', trialDays: 0,  features: ['basic_ai', 'marketplace_read'] },
  starter:    { id: 'starter',    name: 'Starter',    priceUsd: 29,     interval: 'monthly', trialDays: 7,  features: ['basic_ai', 'marketplace', 'api_100_calls'] },
  pro:        { id: 'pro',        name: 'Pro',         priceUsd: 99,     interval: 'monthly', trialDays: 14, features: ['full_ai', 'marketplace', 'api_1000_calls', 'analytics', 'white_label'] },
  enterprise: { id: 'enterprise', name: 'Enterprise', priceUsd: 499,    interval: 'monthly', trialDays: 30, features: ['full_ai', 'marketplace', 'api_unlimited', 'analytics', 'white_label', 'sla_99_99', 'dedicated_support'] },
  // Annual variants (2 months free)
  starter_annual:    { id: 'starter_annual',    name: 'Starter Annual',    priceUsd: 290,   interval: 'annual', trialDays: 7  },
  pro_annual:        { id: 'pro_annual',        name: 'Pro Annual',        priceUsd: 990,   interval: 'annual', trialDays: 14 },
  enterprise_annual: { id: 'enterprise_annual', name: 'Enterprise Annual', priceUsd: 4990,  interval: 'annual', trialDays: 30 },
};

// ── In-memory store ────────────────────────────────────────────────────────────
const subscriptions = new Map(); // subId -> sub object

function _ensureDir() {
  if (PERSIST) try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}
function _save() {
  if (!PERSIST) return;
  try {
    _ensureDir();
    fs.writeFileSync(
      path.join(DATA_DIR, 'subscriptions.json'),
      JSON.stringify([...subscriptions.values()], null, 2)
    );
  } catch (_) {}
}
function _load() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'subscriptions.json'), 'utf8'));
    for (const s of raw) subscriptions.set(s.id, s);
    return subscriptions.size;
  } catch (_) { return 0; }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function _nextRenewal(interval) {
  const now = new Date();
  if (interval === 'annual') {
    now.setFullYear(now.getFullYear() + 1);
  } else {
    now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString();
}

// ── Core API ───────────────────────────────────────────────────────────────────

/**
 * Create a new subscription.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.planId
 * @param {string} opts.paymentMethod  - 'btc' | 'stripe' | 'nowpayments'
 * @param {string} [opts.email]
 * @param {object} [opts.split]        - { partners: [{id, sharePercent}] }
 */
function create({ userId, planId, paymentMethod = 'btc', email, split } = {}) {
  const plan = PLANS[planId];
  if (!plan) return { ok: false, error: `Unknown plan: ${planId}` };

  const id = `sub_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();
  const trialEndsAt = plan.trialDays > 0
    ? new Date(Date.now() + plan.trialDays * 86400_000).toISOString()
    : null;

  const sub = {
    id,
    userId,
    email: email || null,
    planId,
    planName: plan.name,
    priceUsd: plan.priceUsd,
    interval: plan.interval,
    paymentMethod,
    status: plan.priceUsd === 0 ? 'active' : (trialEndsAt ? 'trialing' : 'pending_payment'),
    trialEndsAt,
    currentPeriodStart: now,
    currentPeriodEnd: _nextRenewal(plan.interval),
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
    invoices: [],
    features: plan.features || [],
    // Split payment config
    split: split || null,
    // Dunning
    dunning: { attempts: 0, lastAttemptAt: null, nextAttemptAt: null },
  };

  subscriptions.set(id, sub);
  _save();
  return { ok: true, subscription: sub };
}

/**
 * Record a payment and activate/renew the subscription.
 */
function recordPayment(subId, { amountUsd, txId, currency = 'BTC', confirmedAt } = {}) {
  const sub = subscriptions.get(subId);
  if (!sub) return { ok: false, error: 'not_found' };

  const invoice = {
    id: `inv_${crypto.randomBytes(6).toString('hex')}`,
    subId,
    amountUsd,
    currency,
    txId: txId || null,
    confirmedAt: confirmedAt || new Date().toISOString(),
  };
  sub.invoices.push(invoice);
  sub.status = 'active';
  sub.currentPeriodStart = new Date().toISOString();
  sub.currentPeriodEnd = _nextRenewal(sub.interval);
  sub.dunning = { attempts: 0, lastAttemptAt: null, nextAttemptAt: null };
  sub.updatedAt = new Date().toISOString();
  subscriptions.set(subId, sub);
  _save();
  return { ok: true, subscription: sub, invoice };
}

/**
 * Upgrade or downgrade a subscription plan.
 */
function changePlan(subId, newPlanId) {
  const sub = subscriptions.get(subId);
  if (!sub) return { ok: false, error: 'not_found' };
  const plan = PLANS[newPlanId];
  if (!plan) return { ok: false, error: `Unknown plan: ${newPlanId}` };

  sub.planId = newPlanId;
  sub.planName = plan.name;
  sub.priceUsd = plan.priceUsd;
  sub.interval = plan.interval;
  sub.features = plan.features || [];
  sub.updatedAt = new Date().toISOString();
  subscriptions.set(subId, sub);
  _save();
  return { ok: true, subscription: sub };
}

function cancel(subId, { immediately = false } = {}) {
  const sub = subscriptions.get(subId);
  if (!sub) return { ok: false, error: 'not_found' };
  if (immediately) {
    sub.status = 'cancelled';
  } else {
    sub.cancelAtPeriodEnd = true;
  }
  sub.updatedAt = new Date().toISOString();
  subscriptions.set(subId, sub);
  _save();
  return { ok: true, subscription: sub };
}

function getByUser(userId) {
  return [...subscriptions.values()].filter(s => s.userId === userId);
}

function getById(subId) {
  return subscriptions.get(subId) || null;
}

/**
 * Dunning: find subscriptions due for renewal and flag them.
 * Returns list of subs needing payment retry.
 */
function getDueSubs() {
  const now = Date.now();
  return [...subscriptions.values()].filter(s => {
    if (s.status !== 'active' && s.status !== 'past_due') return false;
    if (s.priceUsd <= 0) return false;
    if (s.cancelAtPeriodEnd) return false;
    return new Date(s.currentPeriodEnd).getTime() <= now + 3 * 86400_000; // due within 3 days
  });
}

/**
 * Calculate split payment amounts for a transaction.
 */
function calcSplit(subId, totalAmountUsd) {
  const sub = subscriptions.get(subId);
  if (!sub || !sub.split || !Array.isArray(sub.split.partners)) {
    return [{ id: 'owner', sharePercent: 100, amountUsd: totalAmountUsd }];
  }
  const shares = [];
  let allocated = 0;
  for (const p of sub.split.partners) {
    const amt = Number(((p.sharePercent / 100) * totalAmountUsd).toFixed(2));
    shares.push({ id: p.id, sharePercent: p.sharePercent, amountUsd: amt });
    allocated += amt;
  }
  // Remainder to owner
  const remainder = Number((totalAmountUsd - allocated).toFixed(2));
  if (remainder > 0) shares.push({ id: 'owner', sharePercent: 0, amountUsd: remainder, note: 'remainder' });
  return shares;
}

function getPlans() { return Object.values(PLANS); }
function getAllSubs() { return [...subscriptions.values()]; }
function getStatus() {
  const all = [...subscriptions.values()];
  return {
    ok: true,
    name: 'subscription-engine',
    total: all.length,
    active: all.filter(s => s.status === 'active').length,
    trialing: all.filter(s => s.status === 'trialing').length,
    cancelled: all.filter(s => s.status === 'cancelled').length,
    mrr: all.filter(s => s.status === 'active' && s.interval === 'monthly')
          .reduce((s, x) => s + (x.priceUsd || 0), 0),
    arr: all.filter(s => s.status === 'active')
          .reduce((s, x) => s + (x.interval === 'annual' ? (x.priceUsd || 0) : (x.priceUsd || 0) * 12), 0),
  };
}

// Load on startup
_load();

module.exports = {
  create, recordPayment, changePlan, cancel,
  getByUser, getById, getDueSubs, calcSplit,
  getPlans, getAllSubs, getStatus,
  PLANS,
  name: 'subscription-engine',
};
