// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:40:29.173Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * TENANT ANALYTICS ENGINE — Zeus AI Unicorn Multi-Tenant SaaS Platform
 *
 * Per-tenant analytics, KPIs, and admin dashboards:
 *   1. Real-time per-tenant event tracking
 *   2. KPI computation: DAU, MAU, API latency, error rate, cost
 *   3. Aggregated global SaaS dashboard
 *   4. Per-tenant time-series (hourly buckets, last 48h)
 *   5. Top-N tenant leaderboards
 *   6. Anomaly detection (spike / drop alerts)
 *   7. Export-ready snapshot
 */

const tenantManager = require('./tenant-manager');

// ── Per-tenant data model ─────────────────────────────────────────────────────
// Map<tenantId, tenantMetrics>
const _metrics = new Map();

const BUCKET_SIZE_MS = 60 * 60 * 1000; // 1-hour buckets
const MAX_BUCKETS    = 48;              // 48 hours

function _tenantMetrics(tenantId) {
  if (!_metrics.has(tenantId)) {
    _metrics.set(tenantId, {
      tenantId,
      hourly: [],         // { ts, apiCalls, errors, latencySum, latencyCount }
      totals: {
        apiCalls: 0,
        errors: 0,
        latencySum: 0,
        latencyCount: 0,
        uniqueUsers: new Set(),
      },
      kpis: {
        errorRate: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
      },
      recentLatencies: [],  // rolling 1000 sample window for percentile
      anomalies: [],
      lastUpdated: new Date().toISOString(),
    });
  }
  return _metrics.get(tenantId);
}

function _currentBucket(m) {
  const now = Date.now();
  const bucketTs = Math.floor(now / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
  let bucket = m.hourly[m.hourly.length - 1];
  if (!bucket || bucket.ts !== bucketTs) {
    bucket = { ts: bucketTs, apiCalls: 0, errors: 0, latencySum: 0, latencyCount: 0 };
    m.hourly.push(bucket);
    if (m.hourly.length > MAX_BUCKETS) m.hourly.shift();
  }
  return bucket;
}

function _computeKpis(m) {
  const totals = m.totals;
  m.kpis.errorRate = totals.apiCalls > 0
    ? ((totals.errors / totals.apiCalls) * 100).toFixed(2) + '%'
    : '0%';
  m.kpis.avgLatencyMs = totals.latencyCount > 0
    ? Math.round(totals.latencySum / totals.latencyCount)
    : 0;

  // p95 from rolling window
  if (m.recentLatencies.length > 0) {
    const sorted = [...m.recentLatencies].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    m.kpis.p95LatencyMs = sorted[Math.min(idx, sorted.length - 1)];
  }
}

// ── Track event ───────────────────────────────────────────────────────────────

function trackEvent(tenantId, { latencyMs = 0, error = false, userId = null } = {}) {
  const m = _tenantMetrics(tenantId);
  const bucket = _currentBucket(m);

  bucket.apiCalls++;
  m.totals.apiCalls++;

  if (error) {
    bucket.errors++;
    m.totals.errors++;
  }

  if (latencyMs > 0) {
    bucket.latencySum += latencyMs;
    bucket.latencyCount++;
    m.totals.latencySum += latencyMs;
    m.totals.latencyCount++;
    m.recentLatencies.push(latencyMs);
    if (m.recentLatencies.length > 1000) m.recentLatencies.shift();
  }

  if (userId) m.totals.uniqueUsers.add(String(userId));

  m.lastUpdated = new Date().toISOString();
  _computeKpis(m);
  _detectAnomalies(m);
}

// ── Anomaly detection ─────────────────────────────────────────────────────────

function _detectAnomalies(m) {
  const recent = m.hourly.slice(-3);  // last 3 hours
  const prev   = m.hourly.slice(-6, -3);
  if (recent.length < 2 || prev.length < 1) return;

  const recentAvg = recent.reduce((s, b) => s + b.apiCalls, 0) / recent.length;
  const prevAvg   = prev.reduce((s, b) => s + b.apiCalls, 0) / prev.length;

  if (prevAvg > 0) {
    const change = (recentAvg - prevAvg) / prevAvg;
    if (change > 3) { // 300% spike
      _addAnomaly(m, 'spike', { recentAvg: Math.round(recentAvg), prevAvg: Math.round(prevAvg), changePct: (change * 100).toFixed(0) });
    } else if (change < -0.8 && prevAvg > 10) { // 80% drop (only meaningful traffic)
      _addAnomaly(m, 'drop', { recentAvg: Math.round(recentAvg), prevAvg: Math.round(prevAvg), changePct: (change * 100).toFixed(0) });
    }
  }

  // High error rate anomaly
  const lastBucket = m.hourly[m.hourly.length - 1];
  if (lastBucket && lastBucket.apiCalls > 10) {
    const errRate = lastBucket.errors / lastBucket.apiCalls;
    if (errRate > 0.3) {
      _addAnomaly(m, 'high_error_rate', { rate: (errRate * 100).toFixed(1) + '%', calls: lastBucket.apiCalls });
    }
  }
}

function _addAnomaly(m, type, data) {
  m.anomalies.push({ ts: new Date().toISOString(), type, ...data });
  if (m.anomalies.length > 100) m.anomalies.shift();
}

// ── Per-tenant dashboard ──────────────────────────────────────────────────────

function getTenantDashboard(tenantId) {
  const tenant = tenantManager.getTenantSafe(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  const m = _tenantMetrics(tenantId);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
    },
    kpis: m.kpis,
    totals: {
      apiCalls: m.totals.apiCalls,
      errors: m.totals.errors,
      uniqueUsers: m.totals.uniqueUsers.size,
    },
    usage: tenant.usage,
    hourly: m.hourly.slice(-24).map(b => ({
      hour: new Date(b.ts).toISOString().slice(0, 13),
      apiCalls: b.apiCalls,
      errors: b.errors,
      avgLatencyMs: b.latencyCount > 0 ? Math.round(b.latencySum / b.latencyCount) : 0,
    })),
    anomalies: m.anomalies.slice(-10),
    lastUpdated: m.lastUpdated,
  };
}

// ── Global SaaS admin dashboard ───────────────────────────────────────────────

function getGlobalDashboard() {
  const tenants = tenantManager.listTenants();
  let totalApiCalls = 0;
  let totalErrors = 0;
  let totalUsers = 0;
  const planBreakdown = {};
  const topTenants = [];

  for (const t of tenants) {
    const m = _metrics.get(t.id);
    const calls = m ? m.totals.apiCalls : 0;
    const errs  = m ? m.totals.errors   : 0;
    const users = m ? m.totals.uniqueUsers.size : 0;

    totalApiCalls += calls;
    totalErrors   += errs;
    totalUsers    += users;

    planBreakdown[t.plan] = (planBreakdown[t.plan] || 0) + 1;
    topTenants.push({ id: t.id, name: t.name, plan: t.plan, apiCalls: calls, status: t.status });
  }

  topTenants.sort((a, b) => b.apiCalls - a.apiCalls);

  return {
    summary: {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.status === 'active').length,
      suspendedTenants: tenants.filter(t => t.status === 'suspended').length,
      totalApiCalls,
      totalErrors,
      globalErrorRate: totalApiCalls > 0 ? ((totalErrors / totalApiCalls) * 100).toFixed(2) + '%' : '0%',
      totalUniqueUsers: totalUsers,
    },
    planBreakdown,
    topTenants: topTenants.slice(0, 10),
    generatedAt: new Date().toISOString(),
  };
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

function getLeaderboard(metric = 'apiCalls', limit = 10) {
  const tenants = tenantManager.listTenants();
  const rows = tenants.map(t => {
    const m = _metrics.get(t.id);
    const val = m ? (m.totals[metric] || 0) : 0;
    return { id: t.id, name: t.name, plan: t.plan, [metric]: val };
  });
  rows.sort((a, b) => b[metric] - a[metric]);
  return rows.slice(0, limit);
}

// ── Express middleware: auto-track all requests ───────────────────────────────

function analyticsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const tenantId = req.tenantId;
    if (!tenantId) return;
    const latencyMs = Date.now() - start;
    const error = res.statusCode >= 500;
    const userId = req.user ? req.user.id : (req.admin ? 'admin' : null);
    trackEvent(tenantId, { latencyMs, error, userId });
  });
  next();
}

function getStatus() {
  return {
    module: 'TenantAnalytics',
    status: 'active',
    trackedTenants: _metrics.size,
  };
}

module.exports = {
  trackEvent,
  getTenantDashboard,
  getGlobalDashboard,
  getLeaderboard,
  analyticsMiddleware,
  getStatus,
};
