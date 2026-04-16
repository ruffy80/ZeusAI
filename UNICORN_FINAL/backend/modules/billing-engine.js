// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:34:15.684Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

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

const crypto = require('crypto');
const { EventEmitter } = require('events');

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
