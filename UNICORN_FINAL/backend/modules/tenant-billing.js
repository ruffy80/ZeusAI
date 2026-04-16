'use strict';

/**
 * TENANT BILLING ENGINE — Zeus AI Unicorn Multi-Tenant SaaS Platform
 *
 * Subscription + billing management:
 *   1. Plan catalog (free / starter / pro / enterprise)
 *   2. Subscription lifecycle (create / upgrade / downgrade / cancel)
 *   3. Usage-based metering (API calls, storage)
 *   4. Invoice generation (monthly cycle)
 *   5. Payment status tracking
 *   6. Dunning logic (retry failed payments)
 *   7. Self-healing: auto-suspend tenants with overdue invoices
 */

const crypto = require('crypto');
const tenantManager = require('./tenant-manager');

// ── Plan catalog (mirrors tenant-manager, extended with billing) ──────────────
const PLAN_CATALOG = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    priceCurrency: 'USD',
    trialDays: 0,
    overagePerThousandCalls: 0,     // no overage on free
  },
  starter: {
    name: 'Starter',
    priceMonthly: 29,
    priceCurrency: 'USD',
    trialDays: 14,
    overagePerThousandCalls: 0.50,
  },
  pro: {
    name: 'Pro',
    priceMonthly: 99,
    priceCurrency: 'USD',
    trialDays: 14,
    overagePerThousandCalls: 0.25,
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: 499,
    priceCurrency: 'USD',
    trialDays: 30,
    overagePerThousandCalls: 0.10,
  },
};

// ── In-memory stores ──────────────────────────────────────────────────────────
// Map<tenantId, subscription>
const _subscriptions = new Map();
// Map<invoiceId, invoice>
const _invoices = new Map();

function _genId(prefix) {
  return prefix + '_' + crypto.randomBytes(6).toString('hex');
}

function _monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function _nextMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString().slice(0, 10);
}

// ── Subscription management ───────────────────────────────────────────────────

function createSubscription(tenantId, { plan = 'starter', paymentMethod = null, trialOverride = null } = {}) {
  const planDef = PLAN_CATALOG[plan];
  if (!planDef) throw new Error(`Unknown plan: ${plan}`);
  const tenant = tenantManager.getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  const trialDays = trialOverride !== null ? trialOverride : planDef.trialDays;
  const now = new Date();
  const trialEnd = trialDays > 0
    ? new Date(now.getTime() + trialDays * 86400_000).toISOString().slice(0, 10)
    : null;

  const sub = {
    id: _genId('sub'),
    tenantId,
    plan,
    status: trialDays > 0 ? 'trial' : 'active',  // trial | active | past_due | canceled | paused
    paymentMethod,
    currentPeriodStart: _monthStart(now),
    currentPeriodEnd: _nextMonthStart(now),
    trialEnd,
    cancelAtPeriodEnd: false,
    usageThisPeriod: { apiCalls: 0, storageBytes: 0 },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  _subscriptions.set(tenantId, sub);

  // Upgrade tenant plan record
  try { tenantManager.updateTenant(tenantId, { plan }); } catch { /* ignore */ }

  return sub;
}

function getSubscription(tenantId) {
  return _subscriptions.get(tenantId) || null;
}

function upgradeSubscription(tenantId, newPlan) {
  if (!PLAN_CATALOG[newPlan]) throw new Error(`Unknown plan: ${newPlan}`);
  let sub = _subscriptions.get(tenantId);
  if (!sub) sub = createSubscription(tenantId, { plan: newPlan });
  else {
    sub.plan = newPlan;
    sub.status = 'active';
    sub.updatedAt = new Date().toISOString();
    try { tenantManager.updateTenant(tenantId, { plan: newPlan }); } catch { /* ignore */ }
  }
  return sub;
}

function cancelSubscription(tenantId, { immediate = false } = {}) {
  const sub = _subscriptions.get(tenantId);
  if (!sub) throw new Error(`No subscription for tenant: ${tenantId}`);
  if (immediate) {
    sub.status = 'canceled';
    sub.canceledAt = new Date().toISOString();
  } else {
    sub.cancelAtPeriodEnd = true;
  }
  sub.updatedAt = new Date().toISOString();
  return sub;
}

// ── Usage metering ────────────────────────────────────────────────────────────

function recordUsage(tenantId, { apiCalls = 0, storageBytes = 0 } = {}) {
  const sub = _subscriptions.get(tenantId);
  if (!sub) return;
  sub.usageThisPeriod.apiCalls += apiCalls;
  sub.usageThisPeriod.storageBytes += storageBytes;
}

// ── Invoice generation ────────────────────────────────────────────────────────

function generateInvoice(tenantId) {
  const sub = _subscriptions.get(tenantId);
  if (!sub) throw new Error(`No subscription for tenant: ${tenantId}`);
  const planDef = PLAN_CATALOG[sub.plan];
  const tenant = tenantManager.getTenant(tenantId);

  const planLimit = tenantManager.PLANS[sub.plan]?.limits?.apiCallsPerDay ?? 1000;
  // Monthly included calls = daily limit × 30 (approximation)
  const includedCalls = planLimit === -1 ? Infinity : planLimit * 30;
  const overage = Math.max(0, sub.usageThisPeriod.apiCalls - includedCalls);
  const overageCharge = Math.ceil(overage / 1000) * planDef.overagePerThousandCalls;

  const baseCharge = planDef.priceMonthly;
  const totalCharge = baseCharge + overageCharge;

  const invoice = {
    id: _genId('inv'),
    tenantId,
    tenantName: tenant ? tenant.name : 'Unknown',
    plan: sub.plan,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    usage: { ...sub.usageThisPeriod },
    lineItems: [
      { description: `${planDef.name} plan (monthly)`, amount: baseCharge, currency: 'USD' },
      ...(overageCharge > 0 ? [{ description: `API overage (${overage.toLocaleString()} calls)`, amount: overageCharge, currency: 'USD' }] : []),
    ],
    subtotal: totalCharge,
    total: totalCharge,
    currency: 'USD',
    status: 'open',   // open | paid | void | uncollectible
    dueDate: sub.currentPeriodEnd,
    paidAt: null,
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  _invoices.set(invoice.id, invoice);

  // Reset period usage
  sub.usageThisPeriod = { apiCalls: 0, storageBytes: 0 };
  sub.currentPeriodStart = sub.currentPeriodEnd;
  sub.currentPeriodEnd = _nextMonthStart(new Date(sub.currentPeriodEnd));
  sub.updatedAt = new Date().toISOString();

  // Honor cancel-at-period-end
  if (sub.cancelAtPeriodEnd) {
    sub.status = 'canceled';
    sub.canceledAt = new Date().toISOString();
  }

  return invoice;
}

function getInvoice(invoiceId) {
  return _invoices.get(invoiceId) || null;
}

function listInvoices(tenantId) {
  const out = [];
  for (const inv of _invoices.values()) {
    if (inv.tenantId === tenantId) out.push(inv);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function markInvoicePaid(invoiceId) {
  const inv = _invoices.get(invoiceId);
  if (!inv) throw new Error(`Invoice not found: ${invoiceId}`);
  inv.status = 'paid';
  inv.paidAt = new Date().toISOString();
  inv.updatedAt = inv.paidAt;

  // Re-activate subscription if it was past_due
  const sub = _subscriptions.get(inv.tenantId);
  if (sub && sub.status === 'past_due') {
    sub.status = 'active';
    sub.updatedAt = inv.paidAt;
  }

  return inv;
}

// ── Dunning: auto-suspend overdue tenants (called periodically) ───────────────

const DUNNING_GRACE_DAYS = 7;

function runDunning() {
  const now = Date.now();
  let actioned = 0;
  for (const inv of _invoices.values()) {
    if (inv.status !== 'open') continue;
    const due = new Date(inv.dueDate).getTime();
    const overdueDays = (now - due) / 86400_000;
    if (overdueDays < DUNNING_GRACE_DAYS) continue;

    // Retry payment (simulate — in production integrate Stripe)
    inv.attempts++;
    inv.updatedAt = new Date().toISOString();

    if (inv.attempts >= 3) {
      inv.status = 'uncollectible';
      inv.updatedAt = new Date().toISOString();
      // Suspend tenant
      try {
        tenantManager.suspendTenant(inv.tenantId, 'Invoice uncollectible after 3 attempts');
        actioned++;
      } catch { /* default tenant cannot be suspended */ }
    } else {
      // Mark sub as past_due
      const sub = _subscriptions.get(inv.tenantId);
      if (sub) { sub.status = 'past_due'; sub.updatedAt = new Date().toISOString(); }
    }
  }
  return { actioned, checked: _invoices.size };
}

// Run dunning daily
setInterval(runDunning, 24 * 60 * 60 * 1000).unref();

// ── Utilities ─────────────────────────────────────────────────────────────────

function getPlanCatalog() {
  return PLAN_CATALOG;
}

function getStatus() {
  const subs = [..._subscriptions.values()];
  const invs = [..._invoices.values()];
  return {
    module: 'TenantBilling',
    status: 'active',
    subscriptions: {
      total: subs.length,
      active: subs.filter(s => s.status === 'active').length,
      trial: subs.filter(s => s.status === 'trial').length,
      past_due: subs.filter(s => s.status === 'past_due').length,
      canceled: subs.filter(s => s.status === 'canceled').length,
    },
    invoices: {
      total: invs.length,
      open: invs.filter(i => i.status === 'open').length,
      paid: invs.filter(i => i.status === 'paid').length,
      uncollectible: invs.filter(i => i.status === 'uncollectible').length,
    },
    plans: Object.keys(PLAN_CATALOG),
  };
}

// Auto-init: create free subscriptions for existing tenants that have none
function initBilling() {
  const tenants = tenantManager.listTenants();
  for (const t of tenants) {
    if (!_subscriptions.has(t.id)) {
      createSubscription(t.id, { plan: t.plan || 'free', trialOverride: 0 });
    }
  }
}
setImmediate(initBilling);

module.exports = {
  PLAN_CATALOG,
  createSubscription,
  getSubscription,
  upgradeSubscription,
  cancelSubscription,
  recordUsage,
  generateInvoice,
  getInvoice,
  listInvoices,
  markInvoicePaid,
  runDunning,
  getPlanCatalog,
  getStatus,
};
