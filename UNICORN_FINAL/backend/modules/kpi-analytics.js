// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:40:29.171Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/**
 * KPI Analytics Engine — SaaS Platform Metrics & Admin Breakdown
 * - Real-time KPI tracking (revenue, users, tasks, API calls)
 * - Per-tenant analytics
 * - Time-series snapshots
 * - Admin breakdown reports
 * - Health score computation
 */

const { EventEmitter } = require('events');

// ─── KPI definitions ──────────────────────────────────────────────────────────
const KPI_DEFS = {
  // Revenue KPIs
  mrr:              { label: 'Monthly Recurring Revenue (USD)', unit: 'usd',     category: 'revenue' },
  totalRevenue:     { label: 'Total Revenue (USD)',             unit: 'usd',     category: 'revenue' },
  newSubscriptions: { label: 'New Subscriptions',              unit: 'count',   category: 'revenue' },
  churnedSubs:      { label: 'Churned Subscriptions',          unit: 'count',   category: 'revenue' },
  // Growth KPIs
  totalTenants:     { label: 'Total Tenants',                  unit: 'count',   category: 'growth'  },
  activeTenants:    { label: 'Active Tenants (30d)',           unit: 'count',   category: 'growth'  },
  newTenants:       { label: 'New Tenants (30d)',              unit: 'count',   category: 'growth'  },
  // Usage KPIs
  totalApiCalls:    { label: 'Total API Calls',                unit: 'count',   category: 'usage'   },
  apiCallsToday:    { label: 'API Calls Today',                unit: 'count',   category: 'usage'   },
  aiTasksProcessed: { label: 'AI Tasks Processed',             unit: 'count',   category: 'usage'   },
  // Health KPIs
  uptime:           { label: 'Platform Uptime',                unit: 'percent', category: 'health'  },
  p99Latency:       { label: 'P99 API Latency',               unit: 'ms',      category: 'health'  },
  errorRate:        { label: 'Error Rate',                     unit: 'percent', category: 'health'  },
};

// ─── In-memory state ──────────────────────────────────────────────────────────
const kpiValues = new Map();      // kpiKey → current value
const tenantMetrics = new Map();  // tenantId → { apiCalls, aiTasks, errorCount, lastActive }
const timeSeriesBuffer = [];      // snapshots
const MAX_SERIES = 1440;          // 24h at 1-min intervals
const alertThresholds = new Map(); // kpiKey → { warn, crit }
const alerts = [];
const MAX_ALERTS = 100;

// ─── Initialize KPIs at zero ──────────────────────────────────────────────────
for (const key of Object.keys(KPI_DEFS)) kpiValues.set(key, 0);

class KPIAnalyticsEngine extends EventEmitter {
  constructor() {
    super();
    this.startTime = Date.now();
    this._snapshotTimer = setInterval(() => this._snapshot(), 60 * 1000);
    this._snapshotTimer.unref?.();

    // Default alert thresholds
    alertThresholds.set('errorRate',  { warn: 1, crit: 5 });
    alertThresholds.set('p99Latency', { warn: 500, crit: 2000 });
    alertThresholds.set('uptime',     { warn: 99, crit: 95, invertCrit: true }); // alert when BELOW
  }

  // ── Set / increment KPIs ──────────────────────────────────────────────────
  set(key, value) {
    kpiValues.set(key, value);
    this._checkAlerts(key, value);
  }

  increment(key, by = 1) {
    const current = kpiValues.get(key) || 0;
    const newVal = current + by;
    kpiValues.set(key, newVal);
    this._checkAlerts(key, newVal);
    return newVal;
  }

  get(key) {
    return kpiValues.get(key) || 0;
  }

  // ── Tenant metrics ─────────────────────────────────────────────────────────
  recordTenantActivity(tenantId, event, value = 1) {
    if (!tenantMetrics.has(tenantId)) {
      tenantMetrics.set(tenantId, { apiCalls: 0, aiTasks: 0, errorCount: 0, lastActive: null });
    }
    const m = tenantMetrics.get(tenantId);
    m.lastActive = new Date().toISOString();
    switch (event) {
      case 'api_call':  m.apiCalls  += value; this.increment('apiCallsToday', value); this.increment('totalApiCalls', value); break;
      case 'ai_task':   m.aiTasks   += value; this.increment('aiTasksProcessed', value); break;
      case 'error':     m.errorCount += value; break;
    }
  }

  getTenantMetrics(tenantId) {
    return tenantMetrics.get(tenantId) || { apiCalls: 0, aiTasks: 0, errorCount: 0, lastActive: null };
  }

  getTopTenants(metric = 'apiCalls', limit = 10) {
    return [...tenantMetrics.entries()]
      .sort((a, b) => (b[1][metric] || 0) - (a[1][metric] || 0))
      .slice(0, limit)
      .map(([id, m]) => ({ tenantId: id, ...m }));
  }

  // ── Time series ───────────────────────────────────────────────────────────
  _snapshot() {
    const snap = {
      ts: new Date().toISOString(),
      kpis: Object.fromEntries(kpiValues),
      activeTenants: tenantMetrics.size,
    };
    timeSeriesBuffer.push(snap);
    if (timeSeriesBuffer.length > MAX_SERIES) timeSeriesBuffer.shift();
    this.emit('snapshot', snap);
  }

  getTimeSeries(kpi, points = 60) {
    return timeSeriesBuffer.slice(-points).map(s => ({
      ts: s.ts,
      value: s.kpis[kpi] !== undefined ? s.kpis[kpi] : null,
    }));
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  _checkAlerts(key, value) {
    const threshold = alertThresholds.get(key);
    if (!threshold) return;

    let level = null;
    const invertCrit = threshold.invertCrit;
    if (invertCrit) {
      if (value < threshold.crit)  level = 'critical';
      else if (value < threshold.warn) level = 'warning';
    } else {
      if (value >= threshold.crit) level = 'critical';
      else if (value >= threshold.warn) level = 'warning';
    }

    if (level) {
      const alert = { ts: new Date().toISOString(), kpi: key, value, level, threshold };
      alerts.push(alert);
      if (alerts.length > MAX_ALERTS) alerts.shift();
      this.emit('alert', alert);
    }
  }

  getAlerts(level) {
    return level ? alerts.filter(a => a.level === level) : [...alerts];
  }

  setAlertThreshold(key, warn, crit, invertCrit = false) {
    alertThresholds.set(key, { warn, crit, invertCrit });
  }

  // ── Health score ──────────────────────────────────────────────────────────
  computeHealthScore() {
    let score = 100;
    const errorRate = this.get('errorRate');
    const p99 = this.get('p99Latency');
    const uptime = this.get('uptime');

    if (errorRate > 5)    score -= 30;
    else if (errorRate > 1) score -= 10;
    if (p99 > 2000)       score -= 20;
    else if (p99 > 500)   score -= 5;
    if (uptime < 95)      score -= 25;
    else if (uptime < 99) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  // ── Admin breakdown report ────────────────────────────────────────────────
  getAdminBreakdown() {
    const kpis = Object.fromEntries(kpiValues);
    const byCategory = {};
    for (const [key, def] of Object.entries(KPI_DEFS)) {
      if (!byCategory[def.category]) byCategory[def.category] = [];
      byCategory[def.category].push({ key, label: def.label, unit: def.unit, value: kpiValues.get(key) || 0 });
    }

    return {
      generatedAt: new Date().toISOString(),
      healthScore: this.computeHealthScore(),
      kpis,
      byCategory,
      activeTenants: tenantMetrics.size,
      topTenantsByApiCalls: this.getTopTenants('apiCalls', 5),
      topTenantsByAiTasks:  this.getTopTenants('aiTasks', 5),
      recentAlerts: this.getAlerts().slice(-10),
      timeSeriesPoints: timeSeriesBuffer.length,
    };
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  getStatus() {
    return {
      module: 'KPIAnalyticsEngine',
      version: '1.0.0',
      kpiCount: kpiValues.size,
      trackedTenants: tenantMetrics.size,
      timeSeriesPoints: timeSeriesBuffer.length,
      activeAlerts: alerts.filter(a => a.level === 'critical').length,
      healthScore: this.computeHealthScore(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

module.exports = new KPIAnalyticsEngine();
module.exports.KPIAnalyticsEngine = KPIAnalyticsEngine;
module.exports.KPI_DEFS = KPI_DEFS;
