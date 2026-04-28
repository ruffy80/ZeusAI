// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:34:15.684Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// billing-engine.js — Billing & Subscription Engine for Unicorn multi-tenant SaaS
// Motor de facturare și abonamente pentru platforma Unicorn SaaS multi-tenant
// =============================================================================
// Responsibilities / Responsabilități:
//   1. Plans Engine        — plan discovery and comparison
//   2. Subscription Engine — lifecycle (trial, upgrade, downgrade, cancel, reactivate)
//   3. Usage Tracking      — per-cycle metric recording, overage detection
//   4. Billing Cycle       — monthly invoice generation and payment processing
//   5. Invoice Engine      — CRUD for invoices, global stats
//   6. Payment Gateway     — Stripe-first, PayPal fallback (env-key stubs)
//   7. Limit Enforcement   — hard-limit suspension, warning emissions
//   8. Auto-suspend logic  — periodic sweep for failed payments / extreme overages
//   9. Express Router      — REST surface for all billing operations
// =============================================================================

'use strict';

const crypto      = require('crypto');
const EventEmitter = require('events');
const axios       = require('axios');
const cron        = require('node-cron');
const express     = require('express');

const tenantEngine = require('./tenant-engine');

// ---------------------------------------------------------------------------
// Internal event bus / Bus de evenimente intern
// ---------------------------------------------------------------------------
const billingEvents = new EventEmitter();
billingEvents.setMaxListeners(50);

// ---------------------------------------------------------------------------
// Constants / Constante
// ---------------------------------------------------------------------------

const GRACE_PERIOD_DAYS    = 7;    // Reactivate window after cancellation / Fereastră de reactivare
const TRIAL_DAYS           = 14;   // Default trial length / Durata implicită a probei
const MAX_PAYMENT_FAILURES = 3;    // Failures before auto-suspend / Eșecuri înainte de suspendare automată
const FAILURE_SUSPEND_DAYS = 3;    // Days of unpaid invoice before suspend / Zile factură neachitată
const OVERAGE_SUSPEND_PCT  = 150;  // % of limit that triggers suspend / % din limită care declanșează suspendare
const OVERAGE_WARN_PCT     = 80;   // % that triggers warning / % care declanșează avertizare

// ---------------------------------------------------------------------------
// In-memory overage tracking (augments tenant-engine data)
// Urmărire depășire în memorie (completează datele tenant-engine)
// ---------------------------------------------------------------------------

/** @type {Map<string, { metric: string, since: string }[]>} tenantId → hard-limit breach records */
const _hardLimitBreaches = new Map();

/** @type {Map<string, number>} subscriptionId → payment failure count */
const _paymentFailures = new Map();

// ---------------------------------------------------------------------------
// §1  PLANS ENGINE
// Motor de planuri
// ---------------------------------------------------------------------------

/**
 * getPlans — returns all available plans from tenant-engine
 * Returnează toate planurile disponibile din tenant-engine
 * @returns {object[]}
 */
function getPlans() {
  return [...tenantEngine.plans.values()];
}

/**
 * getPlan — returns a single plan by id
 * Returnează un singur plan după id
 * @param {string} planId
 * @returns {object|null}
 */
function getPlan(planId) {
  return tenantEngine.plans.get(planId) || null;
}

/**
 * comparePlans — diff two plans for upgrade/downgrade guidance
 * Compară două planuri pentru îndrumarea upgrade/downgrade
 * @param {string} fromPlanId
 * @param {string} toPlanId
 * @returns {{ isUpgrade: boolean, priceDiff: number, featureDiff: { added: string[], removed: string[] } }}
 */
function comparePlans(fromPlanId, toPlanId) {
  const from = getPlan(fromPlanId);
  const to   = getPlan(toPlanId);
  if (!from) throw new Error(`Plan not found: ${fromPlanId}`);
  if (!to)   throw new Error(`Plan not found: ${toPlanId}`);

  const fromFeatures = new Set(from.features || []);
  const toFeatures   = new Set(to.features   || []);

  return {
    isUpgrade : (to.price > from.price) || (to.price === -1 && from.price !== -1),
    priceDiff : to.price === -1 || from.price === -1 ? null : to.price - from.price,
    featureDiff: {
      added  : [...toFeatures].filter(f => !fromFeatures.has(f)),
      removed: [...fromFeatures].filter(f => !toFeatures.has(f)),
    },
  };
}

// ---------------------------------------------------------------------------
// §2  SUBSCRIPTION ENGINE
// Motor de abonamente
// ---------------------------------------------------------------------------

/** Helper — find active subscription for a tenant / Găsește abonamentul activ al unui tenant */
function _findSubscription(tenantId) {
  for (const sub of tenantEngine.subscriptions.values()) {
    if (sub.tenantId === tenantId) return sub;
  }
  return null;
}

/**
 * startTrial — start a 14-day free trial for a tenant
 * Pornește o perioadă de probă de 14 zile pentru un tenant
 * @param {string} tenantId
 * @returns {object} subscription
 */
function startTrial(tenantId) {
  const tenant = tenantEngine.getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  const now      = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let sub = _findSubscription(tenantId);
  if (sub) {
    // Refresh existing subscription to trial state / Reîmprospătează abonamentul existent la starea de probă
    sub.planId     = 'plan_free';
    sub.status     = 'trial';
    sub.trialEnd   = trialEnd;
    sub.startDate  = now.toISOString();
    sub.endDate    = null;
    sub.pendingDowngradePlanId = undefined;
  } else {
    sub = {
      id           : crypto.randomUUID(),
      tenantId,
      planId       : 'plan_free',
      status       : 'trial',
      startDate    : now.toISOString(),
      endDate      : null,
      trialEnd,
      billingCycle : 'monthly',
      nextBillingDate: trialEnd,
    };
    tenantEngine.subscriptions.set(sub.id, sub);
  }

  tenantEngine.logEvent(tenantId, 'subscription.trial.started', { trialEnd });
  return { ...sub };
}

/**
 * upgradePlan — immediately switch tenant to a higher-tier plan
 * Comută imediat tenantul la un plan de nivel superior
 * @param {string} tenantId
 * @param {string} newPlanId
 * @returns {object} updated subscription
 */
function upgradePlan(tenantId, newPlanId) {
  const tenant = tenantEngine.getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  if (!getPlan(newPlanId)) throw new Error(`Plan not found: ${newPlanId}`);

  const sub = _findSubscription(tenantId);
  if (!sub) throw new Error(`No subscription found for tenant: ${tenantId}`);

  const oldPlanId = sub.planId;
  const diff      = comparePlans(oldPlanId, newPlanId);
  if (!diff.isUpgrade) {
    throw new Error('upgradePlan requires a higher-tier plan; use downgradePlan for lower tiers');
  }

  sub.planId  = newPlanId;
  sub.status  = 'active';
  sub.endDate = null;
  sub.pendingDowngradePlanId = undefined;

  // Update tenant's planId reference / Actualizează referința planId a tenantului
  const tenantRecord = tenantEngine.tenants.get(tenantId);
  if (tenantRecord) tenantRecord.planId = newPlanId;

  tenantEngine.logEvent(tenantId, 'subscription.upgraded', { from: oldPlanId, to: newPlanId, priceDiff: diff.priceDiff });
  billingEvents.emit('subscription.upgraded', { tenantId, oldPlanId, newPlanId });
  return { ...sub };
}

/**
 * downgradePlan — schedule a downgrade at end of current billing period
 * Programează o reducere la sfârșitul perioadei de facturare curente
 * @param {string} tenantId
 * @param {string} newPlanId
 * @returns {object} updated subscription
 */
function downgradePlan(tenantId, newPlanId) {
  const tenant = tenantEngine.getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  if (!getPlan(newPlanId)) throw new Error(`Plan not found: ${newPlanId}`);

  const sub = _findSubscription(tenantId);
  if (!sub) throw new Error(`No subscription found for tenant: ${tenantId}`);

  const diff = comparePlans(sub.planId, newPlanId);
  if (diff.isUpgrade) {
    throw new Error('downgradePlan requires a lower-tier plan; use upgradePlan for higher tiers');
  }

  sub.pendingDowngradePlanId = newPlanId;

  tenantEngine.logEvent(tenantId, 'subscription.downgrade.scheduled', {
    currentPlan: sub.planId,
    pendingPlan: newPlanId,
    effectiveAt: sub.nextBillingDate || 'end of period',
  });
  billingEvents.emit('subscription.downgrade.scheduled', { tenantId, currentPlanId: sub.planId, newPlanId });
  return { ...sub };
}

/**
 * cancelSubscription — mark subscription as cancelled; service ends at period end
 * Marchează abonamentul ca anulat; serviciul se încheie la sfârșitul perioadei
 * @param {string} tenantId
 * @returns {object} updated subscription
 */
function cancelSubscription(tenantId) {
  const sub = _findSubscription(tenantId);
  if (!sub) throw new Error(`No subscription found for tenant: ${tenantId}`);

  sub.status  = 'cancelled';
  sub.endDate = sub.nextBillingDate || new Date().toISOString();

  tenantEngine.logEvent(tenantId, 'subscription.cancelled', { endDate: sub.endDate });
  billingEvents.emit('subscription.cancelled', { tenantId, endDate: sub.endDate });
  return { ...sub };
}

/**
 * reactivateSubscription — reactivate if within grace period
 * Reactivează dacă se află în perioada de grație
 * @param {string} tenantId
 * @returns {object} updated subscription
 */
function reactivateSubscription(tenantId) {
  const sub = _findSubscription(tenantId);
  if (!sub) throw new Error(`No subscription found for tenant: ${tenantId}`);
  if (sub.status !== 'cancelled') throw new Error('Subscription is not in cancelled state');

  const endDate    = sub.endDate ? new Date(sub.endDate) : null;
  const graceCutoff = endDate
    ? new Date(endDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    : null;

  if (graceCutoff && new Date() > graceCutoff) {
    throw new Error('Grace period expired; cannot reactivate subscription');
  }

  sub.status  = 'active';
  sub.endDate = null;
  sub.pendingDowngradePlanId = undefined;

  tenantEngine.reactivateTenant(tenantId);
  tenantEngine.logEvent(tenantId, 'subscription.reactivated', {});
  billingEvents.emit('subscription.reactivated', { tenantId });
  return { ...sub };
}

/**
 * suspendForNonPayment — suspend tenant due to payment failure
 * Suspendă tenantul din cauza eșecului la plată
 * @param {string} tenantId
 * @returns {object} updated subscription
 */
function suspendForNonPayment(tenantId) {
  const sub = _findSubscription(tenantId);
  if (sub) sub.status = 'suspended';

  tenantEngine.suspendTenant(tenantId, 'non_payment');
  tenantEngine.logEvent(tenantId, 'subscription.suspended.non_payment', {});
  billingEvents.emit('subscription.suspended', { tenantId, reason: 'non_payment' });
  return sub ? { ...sub } : null;
}

/**
 * getSubscription — returns current subscription enriched with plan details
 * Returnează abonamentul curent îmbogățit cu detaliile planului
 * @param {string} tenantId
 * @returns {object|null}
 */
function getSubscription(tenantId) {
  const sub  = _findSubscription(tenantId);
  if (!sub) return null;
  const plan = getPlan(sub.planId) || null;
  return { ...sub, plan };
}

// ---------------------------------------------------------------------------
// §3  USAGE TRACKING
// Urmărire utilizare
// ---------------------------------------------------------------------------

/**
 * recordUsage — increment a usage metric for the current billing cycle
 * Incrementează o metrică de utilizare pentru ciclul de facturare curent
 * @param {string} tenantId
 * @param {string} metric
 * @param {number} [amount=1]
 */
function recordUsage(tenantId, metric, amount = 1) {
  tenantEngine.incrementUsage(tenantId, metric, amount);
}

/**
 * getUsageReport — full usage report with limits, percentages, and overages
 * Raport complet de utilizare cu limite, procente și depășiri
 * @param {string} tenantId
 * @returns {{ current: object, limits: object, percentages: object, overages: object }}
 */
function getUsageReport(tenantId) {
  const tenant = tenantEngine.getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  const plan    = getPlan(tenant.planId);
  const usage   = tenantEngine.getUsage(tenantId) || {};
  const limits  = plan ? plan.limits : {};

  const percentages = {};
  const overages    = {};

  for (const [metric, limit] of Object.entries(limits)) {
    const current = usage[metric] ?? 0;
    if (limit === -1) {
      // Unlimited plan / Plan nelimitat
      percentages[metric] = 0;
      overages[metric]    = 0;
    } else {
      const pct = limit > 0 ? Math.round((current / limit) * 100) : 0;
      percentages[metric] = pct;
      overages[metric]    = Math.max(0, current - limit);
    }
  }

  return { current: usage, limits, percentages, overages };
}

/**
 * checkOverage — quick check for any metrics exceeding their limits
 * Verificare rapidă pentru orice metrici care depășesc limitele
 * @param {string} tenantId
 * @returns {{ hasOverage: boolean, metrics: Array<{ metric, current, limit, percent }> }}
 */
function checkOverage(tenantId) {
  const report  = getUsageReport(tenantId);
  const metrics = [];

  for (const [metric, overage] of Object.entries(report.overages)) {
    if (overage > 0) {
      metrics.push({
        metric,
        current  : report.current[metric] ?? 0,
        limit    : report.limits[metric],
        percent  : report.percentages[metric],
        overage,
      });
    }
  }

  return { hasOverage: metrics.length > 0, metrics };
}

/**
 * resetMonthlyUsage — reset usage counters for all tenants (billing cycle start)
 * Resetează contoarele de utilizare pentru toți tenanții (la începutul ciclului de facturare)
 */
function resetMonthlyUsage() {
  let count = 0;
  for (const tenant of tenantEngine.getAllTenants()) {
    tenantEngine.resetUsage(tenant.id);
    count++;
  }
  tenantEngine.logEvent('system', 'billing.monthly_usage_reset', { tenantsReset: count });
}

// ---------------------------------------------------------------------------
// §4  BILLING CYCLE ENGINE
// Motor ciclu de facturare
// ---------------------------------------------------------------------------

/**
 * runBillingCycle — generate invoices and process payments for all active subscriptions
 * Generează facturi și procesează plăți pentru toate abonamentele active
 */
async function runBillingCycle() {
  const now    = new Date();
  let processed = 0;
  let failures  = 0;

  for (const sub of tenantEngine.subscriptions.values()) {
    if (!['active', 'trial'].includes(sub.status)) continue;

    const plan = getPlan(sub.planId);
    if (!plan || plan.price <= 0) continue; // Free / trial / enterprise custom — skip

    // Only bill if at or past nextBillingDate / Facturează numai dacă este la sau după nextBillingDate
    if (sub.nextBillingDate && new Date(sub.nextBillingDate) > now) continue;

    // Apply pending downgrade before billing / Aplică downgrade-ul în așteptare înainte de facturare
    if (sub.pendingDowngradePlanId) {
      sub.planId = sub.pendingDowngradePlanId;
      delete sub.pendingDowngradePlanId;
      const tenantRecord = tenantEngine.tenants.get(sub.tenantId);
      if (tenantRecord) tenantRecord.planId = sub.planId;
    }

    try {
      const overageCharges = await detectOverageBilling(sub.tenantId);
      const items = [
        { description: `${plan.name} — monthly subscription`, amount: plan.price, type: 'subscription' },
        ...overageCharges,
      ];

      const invoice = generateInvoice(sub.tenantId, items);
      const total   = items.reduce((s, i) => s + i.amount, 0);

      const result  = await processPayment(sub.tenantId, invoice.id, total, 'USD');

      if (result.success) {
        markInvoicePaid(invoice.id);
        _paymentFailures.delete(sub.id);
        scheduleNextBilling(sub.id);
        processed++;
      } else {
        markInvoiceFailed(invoice.id, result.error || 'payment_declined');
        const fails = (_paymentFailures.get(sub.id) || 0) + 1;
        _paymentFailures.set(sub.id, fails);
        tenantEngine.logEvent(sub.tenantId, 'billing.payment_failed', {
          invoiceId: invoice.id,
          attempt: fails,
          error: result.error,
        });
        failures++;
      }
    } catch (err) {
      tenantEngine.logTenantLog(sub.tenantId, 'error', 'Billing cycle error', { err: err.message });
      failures++;
    }
  }

  tenantEngine.logEvent('system', 'billing.cycle_complete', { processed, failures, at: now.toISOString() });
  billingEvents.emit('billing.cycle_complete', { processed, failures });
  return { processed, failures };
}

/**
 * scheduleNextBilling — advance nextBillingDate by one month
 * Avansează nextBillingDate cu o lună
 * @param {string} subscriptionId
 */
function scheduleNextBilling(subscriptionId) {
  const sub = tenantEngine.subscriptions.get(subscriptionId);
  if (!sub) return;

  const base     = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date();
  const next     = new Date(base);
  next.setMonth(next.getMonth() + 1);
  sub.nextBillingDate = next.toISOString();
}

/**
 * detectOverageBilling — calculate line items for metered overages
 * Calculează elementele rând pentru depășiri măsurate
 * @param {string} tenantId
 * @returns {Promise<Array<{ description, amount, type }>>}
 */
async function detectOverageBilling(tenantId) {
  const { hasOverage, metrics } = checkOverage(tenantId);
  if (!hasOverage) return [];

  const tenant = tenantEngine.getTenant(tenantId);
  const plan   = getPlan(tenant.planId);

  // Overage rate table (USD per unit over limit) / Tabel de tarife depășire (USD per unitate peste limită)
  const OVERAGE_RATES = {
    requests_per_month : 0.000_10,  // $0.10 per 1000 requests
    tokens_per_month   : 0.000_02,  // $0.02 per 1000 tokens
    storage_mb         : 0.000_10,  // $0.10 per MB
    jobs               : 0.50,
    modules            : 1.00,
  };

  return metrics.map(({ metric, overage }) => ({
    description: `Overage: ${metric} (${overage} units over limit)`,
    amount     : Math.round((overage * (OVERAGE_RATES[metric] || 0)) * 100) / 100,
    type       : 'overage',
    metric,
    overage,
  })).filter(item => item.amount > 0);
}

// ---------------------------------------------------------------------------
// §5  INVOICE ENGINE
// Motor de facturi
// ---------------------------------------------------------------------------

/**
 * generateInvoice — create and store an invoice record
 * Creează și stochează o înregistrare de factură
 * @param {string} tenantId
 * @param {Array<{ description, amount, type }>} items
 * @returns {object} invoice
 */
function generateInvoice(tenantId, items) {
  const tenant = tenantEngine.getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  const invoiceId = `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const now       = new Date().toISOString();
  const subtotal  = items.reduce((s, i) => s + (i.amount || 0), 0);
  const tax       = Math.round(subtotal * 0.0 * 100) / 100; // Configurable tax / Tax configurabil
  const total     = Math.round((subtotal + tax) * 100) / 100;

  const invoice = {
    id        : invoiceId,
    tenantId,
    items     : items.map(i => ({ ...i })),
    subtotal,
    tax,
    total,
    currency  : 'USD',
    status    : 'pending',
    createdAt : now,
    updatedAt : now,
    paidAt    : null,
    failReason: null,
  };

  tenantEngine.invoices.set(invoiceId, invoice);
  tenantEngine.logEvent(tenantId, 'invoice.generated', { invoiceId, total });
  return { ...invoice };
}

/**
 * getInvoices — retrieve invoice history for a tenant (most recent first)
 * Preia istoricul facturilor pentru un tenant (cele mai recente primele)
 * @param {string} tenantId
 * @param {number} [limit=50]
 * @returns {object[]}
 */
function getInvoices(tenantId, limit = 50) {
  return [...tenantEngine.invoices.values()]
    .filter(inv => inv.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map(inv => ({ ...inv }));
}

/**
 * getInvoice — retrieve a single invoice by id
 * Preia o singură factură după id
 * @param {string} invoiceId
 * @returns {object|null}
 */
function getInvoice(invoiceId) {
  const inv = tenantEngine.invoices.get(invoiceId);
  return inv ? { ...inv } : null;
}

/**
 * markInvoicePaid — transition invoice to paid state
 * Tranzitează factura în starea plătită
 * @param {string} invoiceId
 * @returns {object}
 */
function markInvoicePaid(invoiceId) {
  const inv = tenantEngine.invoices.get(invoiceId);
  if (!inv) throw new Error(`Invoice not found: ${invoiceId}`);
  inv.status    = 'paid';
  inv.paidAt    = new Date().toISOString();
  inv.updatedAt = inv.paidAt;
  tenantEngine.logEvent(inv.tenantId, 'invoice.paid', { invoiceId, total: inv.total });
  billingEvents.emit('invoice.paid', { tenantId: inv.tenantId, invoiceId, total: inv.total });
  return { ...inv };
}

/**
 * markInvoiceFailed — transition invoice to failed state with reason
 * Tranzitează factura în starea eșuată cu motiv
 * @param {string} invoiceId
 * @param {string} reason
 * @returns {object}
 */
function markInvoiceFailed(invoiceId, reason) {
  const inv = tenantEngine.invoices.get(invoiceId);
  if (!inv) throw new Error(`Invoice not found: ${invoiceId}`);
  inv.status     = 'failed';
  inv.failReason = reason;
  inv.updatedAt  = new Date().toISOString();
  tenantEngine.logEvent(inv.tenantId, 'invoice.failed', { invoiceId, reason });
  billingEvents.emit('invoice.failed', { tenantId: inv.tenantId, invoiceId, reason });
  return { ...inv };
}

/**
 * getInvoiceStats — global invoice statistics for admin dashboard
 * Statistici globale pentru tabloul de bord administrativ
 * @returns {object}
 */
function getInvoiceStats() {
  const all = [...tenantEngine.invoices.values()];
  const totalRevenue = all
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + (i.total || 0), 0);

  return {
    total       : all.length,
    paid        : all.filter(i => i.status === 'paid').length,
    pending     : all.filter(i => i.status === 'pending').length,
    failed      : all.filter(i => i.status === 'failed').length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// §6  PAYMENT GATEWAY INTEGRATION
// Integrare gateway de plată
// ---------------------------------------------------------------------------

/**
 * processPayment — attempt Stripe, fall back to PayPal
 * Încearcă Stripe, recurge la PayPal ca rezervă
 * @param {string} tenantId
 * @param {string} invoiceId
 * @param {number} amount   USD
 * @param {string} currency
 * @returns {Promise<{ success: boolean, transactionId: string|null, provider: string, error: string|null }>}
 */
async function processPayment(tenantId, invoiceId, amount, currency = 'USD') {
  const tenant = tenantEngine.getTenant(tenantId);

  // Attempt Stripe / Încearcă Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripeResult = await _stripeCharge(tenant, amount, currency, invoiceId);
      if (stripeResult.success) {
        tenantEngine.logEvent(tenantId, 'payment.success', { provider: 'stripe', invoiceId, amount, transactionId: stripeResult.transactionId });
        return { success: true, transactionId: stripeResult.transactionId, provider: 'stripe', error: null };
      }
    } catch (err) {
      tenantEngine.logTenantLog(tenantId, 'warn', 'Stripe charge failed; trying PayPal', { err: err.message });
    }
  }

  // Attempt PayPal / Încearcă PayPal
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    try {
      const ppResult = await _paypalCharge(tenant, amount, currency, invoiceId);
      if (ppResult.success) {
        tenantEngine.logEvent(tenantId, 'payment.success', { provider: 'paypal', invoiceId, amount, transactionId: ppResult.transactionId });
        return { success: true, transactionId: ppResult.transactionId, provider: 'paypal', error: null };
      }
    } catch (err) {
      tenantEngine.logTenantLog(tenantId, 'warn', 'PayPal charge failed', { err: err.message });
    }
  }

  return { success: false, transactionId: null, provider: 'none', error: 'all_payment_methods_failed' };
}

/** Internal — Stripe charge via REST API */
async function _stripeCharge(tenant, amount, currency, invoiceId) {
  const amountCents = Math.round(amount * 100);
  const customerId  = tenantEngine.getConfig(tenant.id, 'stripe_customer_id');

  if (!customerId) {
    // Charge without saved customer (demo path) / Plată fără client salvat (cale demonstrativă)
    const response = await axios.post(
      'https://api.stripe.com/v1/charges',
      new URLSearchParams({
        amount  : String(amountCents),
        currency: currency.toLowerCase(),
        description: `Invoice ${invoiceId} for tenant ${tenant.id}`,
        // In production: add source/customer / În producție: adăugați source/customer
      }).toString(),
      {
        headers: {
          Authorization  : `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type' : 'application/x-www-form-urlencoded',
        },
        timeout: 10_000,
      }
    );
    return { success: response.data.status === 'succeeded', transactionId: response.data.id };
  }

  const response = await axios.post(
    'https://api.stripe.com/v1/payment_intents',
    new URLSearchParams({
      amount          : String(amountCents),
      currency        : currency.toLowerCase(),
      customer        : customerId,
      confirm         : 'true',
      description     : `Invoice ${invoiceId}`,
      'metadata[invoiceId]': invoiceId,
    }).toString(),
    {
      headers: {
        Authorization : `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10_000,
    }
  );
  return {
    success      : response.data.status === 'succeeded',
    transactionId: response.data.id,
  };
}

/** Internal — PayPal charge via Orders v2 */
async function _paypalCharge(tenant, amount, currency, invoiceId) {
  // Get access token / Obține token de acces
  const tokenRes = await axios.post(
    'https://api-m.paypal.com/v1/oauth2/token',
    'grant_type=client_credentials',
    {
      auth   : { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    }
  );
  const accessToken = tokenRes.data.access_token;

  const orderRes = await axios.post(
    'https://api-m.paypal.com/v2/checkout/orders',
    {
      intent            : 'CAPTURE',
      purchase_units    : [{
        reference_id  : invoiceId,
        amount        : { currency_code: currency, value: amount.toFixed(2) },
        description   : `Invoice ${invoiceId}`,
      }],
    },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 10_000 }
  );

  return {
    success      : ['CREATED', 'APPROVED', 'COMPLETED'].includes(orderRes.data.status),
    transactionId: orderRes.data.id,
  };
}

/**
 * handleStripeWebhook — process incoming Stripe webhook events
 * Procesează evenimentele de webhook Stripe primite
 * @param {object} event  Stripe event object (already parsed)
 * @returns {{ handled: boolean, action: string }}
 */
function handleStripeWebhook(event) {
  switch (event.type) {
    case 'invoice.paid': {
      const stripeInvoiceId = event.data?.object?.metadata?.invoiceId;
      if (stripeInvoiceId && tenantEngine.invoices.has(stripeInvoiceId)) {
        markInvoicePaid(stripeInvoiceId);
      }
      return { handled: true, action: 'invoice_paid' };
    }
    case 'invoice.payment_failed': {
      const stripeInvoiceId = event.data?.object?.metadata?.invoiceId;
      if (stripeInvoiceId && tenantEngine.invoices.has(stripeInvoiceId)) {
        markInvoiceFailed(stripeInvoiceId, 'stripe_payment_failed');
      }
      return { handled: true, action: 'invoice_failed' };
    }
    case 'customer.subscription.deleted': {
      const customerId = event.data?.object?.customer;
      // Find tenant by stripe customer id / Găsește tenantul după stripe customer id
      for (const tenant of tenantEngine.getAllTenants()) {
        const savedCustomerId = tenantEngine.getConfig(tenant.id, 'stripe_customer_id');
        if (savedCustomerId === customerId) {
          cancelSubscription(tenant.id);
          break;
        }
      }
      return { handled: true, action: 'subscription_deleted' };
    }
    default:
      return { handled: false, action: 'unhandled_event' };
  }
}

/**
 * handlePaypalWebhook — process incoming PayPal webhook events
 * Procesează evenimentele de webhook PayPal primite
 * @param {object} event  PayPal webhook event object (already parsed)
 * @returns {{ handled: boolean, action: string }}
 */
function handlePaypalWebhook(event) {
  switch (event.event_type) {
    case 'PAYMENT.SALE.COMPLETED': {
      const invoiceId = event.resource?.invoice_id || event.resource?.custom_id;
      if (invoiceId && tenantEngine.invoices.has(invoiceId)) {
        markInvoicePaid(invoiceId);
      }
      return { handled: true, action: 'payment_completed' };
    }
    case 'BILLING.SUBSCRIPTION.CANCELLED': {
      const subId = event.resource?.id;
      // Find tenant by paypal subscription id / Găsește tenantul după id abonament paypal
      for (const tenant of tenantEngine.getAllTenants()) {
        const savedSubId = tenantEngine.getConfig(tenant.id, 'paypal_subscription_id');
        if (savedSubId === subId) {
          cancelSubscription(tenant.id);
          break;
        }
      }
      return { handled: true, action: 'subscription_cancelled' };
    }
    default:
      return { handled: false, action: 'unhandled_event' };
  }
}

// ---------------------------------------------------------------------------
// §7  LIMIT ENFORCEMENT
// Aplicarea limitelor
// ---------------------------------------------------------------------------

/**
 * enforceLimits — check all metrics, suspend if hard limit exceeded for >24h
 * Verifică toate metricile, suspendă dacă limita strictă este depășită de >24h
 * @param {string} tenantId
 */
function enforceLimits(tenantId) {
  const { hasOverage, metrics } = checkOverage(tenantId);
  if (!hasOverage) {
    _hardLimitBreaches.delete(tenantId);
    return;
  }

  const now     = Date.now();
  const breaches = _hardLimitBreaches.get(tenantId) || [];

  for (const m of metrics) {
    const pct = m.percent;

    // Warning threshold / Prag de avertizare
    if (pct >= OVERAGE_WARN_PCT) {
      sendLimitWarning(tenantId, m.metric, pct);
    }

    // Record first breach time for hard limit / Înregistrează prima dată de depășire pentru limita strictă
    const existing = breaches.find(b => b.metric === m.metric);
    if (!existing) {
      breaches.push({ metric: m.metric, since: new Date().toISOString() });
    } else {
      const hoursSince = (now - new Date(existing.since).getTime()) / (1000 * 60 * 60);
      if (hoursSince >= 24) {
        tenantEngine.logTenantLog(tenantId, 'warn',
          `Hard limit breach for ${m.metric} exceeded 24h — suspending tenant`,
          { metric: m.metric, percent: pct });
        suspendForNonPayment(tenantId);
      }
    }
  }

  _hardLimitBreaches.set(tenantId, breaches);
}

/**
 * sendLimitWarning — emit billing event and log usage warning
 * Emite eveniment de facturare și înregistrează avertizare de utilizare
 * @param {string} tenantId
 * @param {string} metric
 * @param {number} percent
 */
function sendLimitWarning(tenantId, metric, percent) {
  tenantEngine.logTenantLog(tenantId, 'warn',
    `Usage warning: ${metric} at ${percent}% of limit`,
    { metric, percent });
  billingEvents.emit('limit.warning', { tenantId, metric, percent });
}

// ---------------------------------------------------------------------------
// §8  AUTO-SUSPEND LOGIC
// Logică de suspendare automată
// ---------------------------------------------------------------------------

/**
 * autoSuspendCheck — suspend tenants with ≥3 failed payments or usage >150% of limit
 * Suspendă tenanții cu ≥3 plăți eșuate sau utilizare >150% din limită
 */
async function autoSuspendCheck() {
  const now = new Date();

  for (const sub of tenantEngine.subscriptions.values()) {
    if (sub.status === 'suspended') continue;

    // Check payment failure count / Verifică numărul de eșecuri la plată
    const failures = _paymentFailures.get(sub.id) || 0;
    if (failures >= MAX_PAYMENT_FAILURES) {
      // Check oldest failed invoice age / Verifică vârsta celei mai vechi facturi eșuate
      const failedInvoices = [...tenantEngine.invoices.values()]
        .filter(i => i.tenantId === sub.tenantId && i.status === 'failed')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      if (failedInvoices.length > 0) {
        const oldestFail    = new Date(failedInvoices[0].createdAt);
        const daysSinceFail = (now - oldestFail) / (1000 * 60 * 60 * 24);
        if (daysSinceFail >= FAILURE_SUSPEND_DAYS) {
          suspendForNonPayment(sub.tenantId);
          continue;
        }
      }
    }

    // Check extreme overage / Verifică depășire extremă
    try {
      const report = getUsageReport(sub.tenantId);
      for (const [metric, pct] of Object.entries(report.percentages)) {
        if (pct >= OVERAGE_SUSPEND_PCT) {
          tenantEngine.logTenantLog(sub.tenantId, 'warn',
            `Auto-suspend: ${metric} at ${pct}% of limit`,
            { metric, pct });
          suspendForNonPayment(sub.tenantId);
          break;
        }
      }
    } catch {
      // Non-fatal: skip this tenant / Non-fatal: sari peste acest tenant
    }
  }
}

// ---------------------------------------------------------------------------
// §9  CRON SCHEDULING
// Programare cron
// ---------------------------------------------------------------------------

// Billing cycle: 1st of each month at 00:05 / Ciclu de facturare: 1 din fiecare lună la 00:05
cron.schedule('5 0 1 * *', () => {
  runBillingCycle().catch(err =>
    tenantEngine.logTenantLog('system', 'error', 'Billing cycle cron error', { err: err.message })
  );
}, { timezone: 'UTC' });

// Overage check: daily at 02:00 / Verificare depășire: zilnic la 02:00
cron.schedule('0 2 * * *', () => {
  for (const tenant of tenantEngine.getAllTenants()) {
    try { enforceLimits(tenant.id); } catch { /* non-fatal */ }
  }
}, { timezone: 'UTC' });

// Auto-suspend: every 6 hours / Suspendare automată: la fiecare 6 ore
cron.schedule('0 */6 * * *', () => {
  autoSuspendCheck().catch(err =>
    tenantEngine.logTenantLog('system', 'error', 'Auto-suspend cron error', { err: err.message })
  );
}, { timezone: 'UTC' });

// ---------------------------------------------------------------------------
// §10  EXPRESS ROUTER
// Router Express
// ---------------------------------------------------------------------------

/**
 * createExpressRouter — returns a configured Express Router
 * Returnează un Router Express configurat
 * @returns {express.Router}
 */
function createExpressRouter() {
  const router = express.Router();

  // GET /plans
  router.get('/plans', (_req, res) => {
    res.json({ plans: getPlans() });
  });

  // GET /subscription/:tenantId
  router.get('/subscription/:tenantId', (req, res) => {
    const sub = getSubscription(req.params.tenantId);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ subscription: sub });
  });

  // POST /subscription/:tenantId/upgrade  { planId }
  router.post('/subscription/:tenantId/upgrade', (req, res) => {
    try {
      const updated = upgradePlan(req.params.tenantId, req.body.planId);
      res.json({ subscription: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /subscription/:tenantId/cancel
  router.post('/subscription/:tenantId/cancel', (req, res) => {
    try {
      const updated = cancelSubscription(req.params.tenantId);
      res.json({ subscription: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /subscription/:tenantId/reactivate
  router.post('/subscription/:tenantId/reactivate', (req, res) => {
    try {
      const updated = reactivateSubscription(req.params.tenantId);
      res.json({ subscription: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /invoices/:tenantId?limit=50
  router.get('/invoices/:tenantId', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    res.json({ invoices: getInvoices(req.params.tenantId, limit) });
  });

  // GET /usage/:tenantId
  router.get('/usage/:tenantId', (req, res) => {
    try {
      res.json(getUsageReport(req.params.tenantId));
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // POST /webhook/stripe  (raw body — mounted with express.raw in parent app)
  router.post('/webhook/stripe', (req, res) => {
    try {
      const sig     = req.headers['stripe-signature'];
      const secret  = process.env.STRIPE_WEBHOOK_SECRET;
      let event;

      if (secret && sig) {
        // Verify signature when secret is configured / Verifică semnătura când secretul este configurat
        const payload = req.body; // Buffer when express.raw is used
        const hmac = crypto
          .createHmac('sha256', secret)
          .update(Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload)))
          .digest('hex');
        const expectedSig = `v1=${hmac}`;
        const sigV1Part   = (sig || '').split(',').find(p => p.startsWith('v1='));
        if (sigV1Part && !crypto.timingSafeEqual(Buffer.from(sigV1Part), Buffer.from(expectedSig))) {
          return res.status(400).json({ error: 'Invalid Stripe signature' });
        }
      }

      const body  = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
      event       = body;
      const result = handleStripeWebhook(event);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /webhook/paypal  (raw body)
  router.post('/webhook/paypal', (req, res) => {
    try {
      const body   = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
      const result = handlePaypalWebhook(body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Module exports / Export modul
// ---------------------------------------------------------------------------

module.exports = {
  // Plans / Planuri
  getPlans,
  getPlan,
  comparePlans,

  // Subscriptions / Abonamente
  startTrial,
  upgradePlan,
  downgradePlan,
  cancelSubscription,
  reactivateSubscription,
  suspendForNonPayment,
  getSubscription,

  // Usage / Utilizare
  recordUsage,
  getUsageReport,
  checkOverage,
  resetMonthlyUsage,

  // Billing cycle / Ciclu de facturare
  runBillingCycle,
  scheduleNextBilling,
  detectOverageBilling,

  // Invoices / Facturi
  generateInvoice,
  getInvoices,
  getInvoice,
  markInvoicePaid,
  markInvoiceFailed,
  getInvoiceStats,

  // Payment gateway / Gateway de plată
  processPayment,
  handleStripeWebhook,
  handlePaypalWebhook,

  // Limits / Limite
  enforceLimits,
  sendLimitWarning,

  // Auto-suspend / Suspendare automată
  autoSuspendCheck,

  // Event bus / Bus de evenimente
  billingEvents,

  // Express router factory / Fabrică de router Express
  createExpressRouter,
};
'use strict';
/**
 * Billing Engine — SaaS Subscription & Usage Billing
 * - Plan management (free/starter/pro/enterprise)
 * - Subscription lifecycle (create, upgrade, downgrade, cancel)
 * - Usage-based metering
 * - Invoice generation
 * - Webhook notifications
 * - Stripe-compatible payment intent abstraction
 */

// crypto and EventEmitter already required at top of file; avoid duplicate declarations

// ─── Plans ───────────────────────────────────────────────────────────────────
const PLANS = {
  free:       { name: 'Free',       price: 0,    currency: 'usd', interval: 'month', trialDays: 0  },
  starter:    { name: 'Starter',    price: 4900, currency: 'usd', interval: 'month', trialDays: 14 },
  pro:        { name: 'Pro',        price: 19900,currency: 'usd', interval: 'month', trialDays: 14 },
  enterprise: { name: 'Enterprise', price: 99900,currency: 'usd', interval: 'month', trialDays: 30 },
};

// ─── In-memory stores ─────────────────────────────────────────────────────────
const subscriptions = new Map(); // subId → subscription
const invoices      = new Map(); // invoiceId → invoice
const usageRecords  = new Map(); // tenantId → usage[]
const tenantSub     = new Map(); // tenantId → subId

// ─── Billing Engine ───────────────────────────────────────────────────────────
class BillingEngine extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.cacheTTL = 60000;
    this.startTime = Date.now();
    // Renewal check every hour
    this._renewalTimer = setInterval(() => this._processDueRenewals(), 60 * 60 * 1000);
    this._renewalTimer.unref?.();
  }

  // ── Subscription management ───────────────────────────────────────────────
  createSubscription(tenantId, plan, opts = {}) {
    if (!PLANS[plan]) throw new Error(`Unknown plan: ${plan}`);
    if (tenantSub.has(tenantId)) {
      // upgrade/downgrade existing
      return this.changePlan(tenantId, plan);
    }
    const subId = 'sub_' + crypto.randomBytes(8).toString('hex');
    const now = Date.now();
    const trialDays = opts.trialDays !== undefined ? opts.trialDays : PLANS[plan].trialDays;
    const trialEnd  = trialDays > 0 ? new Date(now + trialDays * 86400000).toISOString() : null;
    const periodEnd = new Date(now + 30 * 86400000).toISOString();

    const sub = {
      id: subId,
      tenantId,
      plan,
      status: trialEnd ? 'trialing' : 'active',
      trialEnd,
      currentPeriodStart: new Date(now).toISOString(),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      metadata: opts.metadata || {},
    };

    subscriptions.set(subId, sub);
    tenantSub.set(tenantId, subId);

    if (!usageRecords.has(tenantId)) usageRecords.set(tenantId, []);

    this.emit('subscription:created', { subId, tenantId, plan });
    return sub;
  }

  getSubscription(tenantId) {
    const subId = tenantSub.get(tenantId);
    return subId ? subscriptions.get(subId) : null;
  }

  changePlan(tenantId, newPlan) {
    if (!PLANS[newPlan]) throw new Error(`Unknown plan: ${newPlan}`);
    const subId = tenantSub.get(tenantId);
    if (!subId) return this.createSubscription(tenantId, newPlan);
    const sub = subscriptions.get(subId);
    const oldPlan = sub.plan;
    sub.plan = newPlan;
    sub.status = 'active';
    sub.updatedAt = new Date().toISOString();
    this.emit('subscription:plan_changed', { subId, tenantId, oldPlan, newPlan });
    return sub;
  }

  cancelSubscription(tenantId, atPeriodEnd = true) {
    const subId = tenantSub.get(tenantId);
    if (!subId) throw new Error('No subscription found for tenant');
    const sub = subscriptions.get(subId);
    if (atPeriodEnd) {
      sub.cancelAtPeriodEnd = true;
    } else {
      sub.status = 'canceled';
      sub.canceledAt = new Date().toISOString();
    }
    sub.updatedAt = new Date().toISOString();
    this.emit('subscription:canceled', { subId, tenantId, atPeriodEnd });
    return sub;
  }

  // ── Usage metering ─────────────────────────────────────────────────────────
  recordUsage(tenantId, metric, quantity = 1, metadata = {}) {
    if (!usageRecords.has(tenantId)) usageRecords.set(tenantId, []);
    const record = {
      id: 'usg_' + crypto.randomBytes(6).toString('hex'),
      tenantId,
      metric,
      quantity,
      metadata,
      recordedAt: new Date().toISOString(),
    };
    usageRecords.get(tenantId).push(record);
    // Keep last 10000 per tenant
    const recs = usageRecords.get(tenantId);
    if (recs.length > 10000) recs.splice(0, recs.length - 10000);
    return record;
  }

  getUsageSummary(tenantId, sinceMs = 30 * 24 * 60 * 60 * 1000) {
    const recs = usageRecords.get(tenantId) || [];
    const since = new Date(Date.now() - sinceMs).toISOString();
    const filtered = recs.filter(r => r.recordedAt >= since);
    const summary = {};
    for (const r of filtered) {
      summary[r.metric] = (summary[r.metric] || 0) + r.quantity;
    }
    return { tenantId, since, summary, recordCount: filtered.length };
  }

  // ── Invoice generation ─────────────────────────────────────────────────────
  generateInvoice(tenantId, opts = {}) {
    const sub = this.getSubscription(tenantId);
    const planInfo = sub ? PLANS[sub.plan] : PLANS.free;
    const usage = this.getUsageSummary(tenantId);
    const invoiceId = 'inv_' + crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();

    const lineItems = [
      { description: `${planInfo.name} plan subscription`, amount: planInfo.price, quantity: 1 },
    ];

    // Add usage overages
    for (const [metric, qty] of Object.entries(usage.summary)) {
      if (qty > 0 && opts.chargeUsage) {
        lineItems.push({ description: `Usage: ${metric}`, amount: 0, quantity: qty, note: 'included' });
      }
    }

    const total = lineItems.reduce((s, l) => s + (l.amount * l.quantity), 0);

    const invoice = {
      id: invoiceId,
      tenantId,
      subscriptionId: sub ? sub.id : null,
      plan: planInfo.name,
      lineItems,
      total,
      currency: planInfo.currency,
      status: 'draft',
      periodStart: sub ? sub.currentPeriodStart : now,
      periodEnd: sub ? sub.currentPeriodEnd : now,
      createdAt: now,
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    };

    invoices.set(invoiceId, invoice);
    this.emit('invoice:created', { invoiceId, tenantId, total });
    return invoice;
  }

  getInvoice(invoiceId) {
    return invoices.get(invoiceId) || null;
  }

  listInvoices(tenantId, limit = 20) {
    const list = [...invoices.values()].filter(i => i.tenantId === tenantId);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list.slice(0, limit);
  }

  // ── Renewal processing ─────────────────────────────────────────────────────
  _processDueRenewals() {
    const now = new Date().toISOString();
    for (const sub of subscriptions.values()) {
      if (sub.status === 'active' && sub.currentPeriodEnd <= now) {
        if (sub.cancelAtPeriodEnd) {
          sub.status = 'canceled';
          sub.canceledAt = now;
          this.emit('subscription:expired', { subId: sub.id, tenantId: sub.tenantId });
        } else {
          // Renew period
          const newStart = sub.currentPeriodEnd;
          sub.currentPeriodStart = newStart;
          sub.currentPeriodEnd = new Date(Date.parse(newStart) + 30 * 86400000).toISOString();
          sub.updatedAt = now;
          this.generateInvoice(sub.tenantId);
          this.emit('subscription:renewed', { subId: sub.id, tenantId: sub.tenantId });
        }
      }
      if (sub.status === 'trialing' && sub.trialEnd && sub.trialEnd <= now) {
        sub.status = 'active';
        sub.updatedAt = now;
        this.emit('subscription:trial_ended', { subId: sub.id, tenantId: sub.tenantId });
      }
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  getStatus() {
    const subs = [...subscriptions.values()];
    const byStatus = {}, byPlan = {};
    for (const s of subs) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      byPlan[s.plan]     = (byPlan[s.plan] || 0) + 1;
    }
    const mrr = subs
      .filter(s => s.status === 'active' || s.status === 'trialing')
      .reduce((sum, s) => sum + (PLANS[s.plan] ? PLANS[s.plan].price : 0), 0);

    return {
      module: 'BillingEngine',
      version: '1.0.0',
      totalSubscriptions: subs.length,
      byStatus,
      byPlan,
      totalInvoices: invoices.size,
      mrrCents: mrr,
      mrrUsd: (mrr / 100).toFixed(2),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  getPlans() { return PLANS; }
}

module.exports = new BillingEngine();
module.exports.BillingEngine = BillingEngine;
module.exports.PLANS = PLANS;
// Attach legacy createExpressRouter from first implementation so index.js routes work
module.exports.createExpressRouter = createExpressRouter;
