// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC component 6 — Revenue Autopilot (BTC-only).
// RO: toate încasările sunt direcționate către adresa BTC configurată.
// Zilnic, trimite un raport (venit, produse vândute, conversii, erori) către
// ZACC_WEBHOOK_URL (Discord/Telegram/email-webhook). GOLDEN RULE #8: BTC-only.

'use strict';

const { OWNER_BTC, now, round2, logger } = require('./util');

const log = logger('revenue');

const DAY_MS = 24 * 60 * 60 * 1000;

class RevenueAutopilot {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.btcAddress = OWNER_BTC;
    this.sales = []; // { id, productId, title, amountUsd, btcAddress, ts }
    this.maxSales = 2000;
    this.totalUsd = 0;
    this.lastReportAt = 0;
    this.reportsSent = 0;
    this.errors = [];
  }

  // Record a confirmed sale. Funds are (by construction) routed to the owner
  // BTC address — there is no other payout path.
  recordSale(productId, amountUsd, meta) {
    const amt = round2(Number(amountUsd) || 0);
    const sale = {
      id: 'sale-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      productId,
      title: (meta && meta.title) || productId,
      amountUsd: amt,
      btcAddress: this.btcAddress,
      ts: now(),
    };
    this.sales = [sale].concat(this.sales).slice(0, this.maxSales);
    this.totalUsd = round2(this.totalUsd + amt);
    return sale;
  }

  recordError(scope, message) {
    this.errors = [{ scope, message: String(message || ''), ts: now() }].concat(this.errors).slice(0, 100);
  }

  _windowSales(ms) {
    const cutoff = Date.now() - ms;
    return this.sales.filter(s => new Date(s.ts).getTime() >= cutoff);
  }

  buildDailyReport() {
    const day = this._windowSales(DAY_MS);
    const revenueUsd = round2(day.reduce((a, s) => a + s.amountUsd, 0));
    const byProduct = {};
    for (const s of day) byProduct[s.productId] = (byProduct[s.productId] || 0) + 1;
    const top = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, count]) => ({ productId: id, sales: count }));
    return {
      brand: 'ZeusAI · ZACC',
      window: '24h',
      btcAddress: this.btcAddress,
      revenueUsd,
      salesCount: day.length,
      topProducts: top,
      errors: this.errors.slice(0, 5),
      lifetimeUsd: this.totalUsd,
      generatedAt: now(),
    };
  }

  dueForReport() { return Date.now() - this.lastReportAt >= DAY_MS; }

  // Send the daily report to the configured webhook (best-effort, never throws
  // into the loop). Supports a generic JSON webhook; Discord/Telegram accept it.
  async sendDailyReport(force) {
    if (!force && !this.dueForReport()) return { sent: false, reason: 'not-due' };
    const report = this.buildDailyReport();
    this.lastReportAt = Date.now();
    const url = process.env.ZACC_WEBHOOK_URL;
    if (!url || typeof fetch !== 'function') {
      log.info('daily report ready (no webhook configured):', '$' + report.revenueUsd, report.salesCount + ' sales');
      return { sent: false, reason: 'no-webhook', report };
    }
    try {
      const content = 'ZACC daily report — $' + report.revenueUsd + ' from ' + report.salesCount
        + ' sales (lifetime $' + report.lifetimeUsd + '). BTC: ' + this.btcAddress;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, text: content, report }),
        signal: AbortSignal.timeout(4000),
      });
      this.reportsSent += 1;
      log.info('daily report delivered to webhook');
      return { sent: true, report };
    } catch (e) {
      this.recordError('webhook', e.message);
      log.warn('webhook delivery failed:', e.message);
      return { sent: false, reason: e.message, report };
    }
  }

  status() {
    const day = this._windowSales(DAY_MS);
    return {
      ok: true,
      payout: { method: 'BTC', btcAddress: this.btcAddress, stripe: false },
      lifetimeUsd: this.totalUsd,
      last24hUsd: round2(day.reduce((a, s) => a + s.amountUsd, 0)),
      last24hSales: day.length,
      totalSales: this.sales.length,
      reportsSent: this.reportsSent,
      webhookConfigured: !!process.env.ZACC_WEBHOOK_URL,
      recentSales: this.sales.slice(0, 6),
      recentErrors: this.errors.slice(0, 3),
    };
  }
}

module.exports = { RevenueAutopilot };
