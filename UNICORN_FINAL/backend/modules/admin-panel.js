// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// admin-panel.js — Global Admin Panel for Unicorn multi-tenant SaaS
// Panou de administrare global pentru platforma Unicorn SaaS multi-tenant
// =============================================================================
// Sections / Secțiuni:
//   1. Global Dashboard       — aggregate KPIs across all tenants
//   2. Tenant Management      — full CRUD + lifecycle operations
//   3. Plans & Pricing        — plan CRUD in tenantEngine.plans
//   4. Billing & Invoices     — invoice management + billing cycle control
//   5. Usage & Analytics      — global and per-tenant analytics
//   6. Module Management      — SEE-backed module activation/repair
//   7. Orchestrator Control   — OrchestratorV4 jobs, heal, shield, GOB
//   8. System Logs & Alerts   — cross-tenant log search + alert management
//
// Provisioning:
//   createProvisioningRouter  — public unauthenticated tenant signup flow
//
// Exports:
//   createExpressRouter(adminTokenMiddleware) — protected admin router
//   createProvisioningRouter()               — public signup router
// =============================================================================

'use strict';

const express      = require('express');
const crypto       = require('crypto');

const tenantEngine  = require('./tenant-engine');
const billingEngine = require('./billing-engine');
const orchestrator  = require('./orchestrator-v4');
const seeEngine     = require('./self-evolving-engine');

// ---------------------------------------------------------------------------
// Webhook log ring buffer (last 200 events)
// Buffer circular pentru loguri webhook (ultimele 200 de evenimente)
// ---------------------------------------------------------------------------
const _webhookLogs = [];
const WEBHOOK_LOG_LIMIT = 200;

function _pushWebhookLog(entry) {
  _webhookLogs.push({ ...entry, ts: new Date().toISOString() });
  if (_webhookLogs.length > WEBHOOK_LOG_LIMIT) _webhookLogs.shift();
}

// ---------------------------------------------------------------------------
// In-memory alerts store
// Stocarea alertelor în memorie
// ---------------------------------------------------------------------------
const _alerts = new Map(); // alertId → alert object

function _addAlert(type, message, meta = {}) {
  const id = `alert_${crypto.randomBytes(6).toString('hex')}`;
  _alerts.set(id, { id, type, message, meta, active: true, createdAt: new Date().toISOString() });
  return id;
}

// ---------------------------------------------------------------------------
// Server start time for uptime calculation
// Momentul pornirii serverului pentru calculul timpului de funcționare
// ---------------------------------------------------------------------------
const _startTime = Date.now();

// =============================================================================
// §1  GLOBAL DASHBOARD HELPERS
// Funcții auxiliare pentru tabloul de bord global
// =============================================================================

function _buildDashboard() {
  const allTenants = tenantEngine.getAllTenants();

  // Tenant counts by status / Contorizare tenanți după status
  const tenantStats = {
    total    : allTenants.length,
    active   : allTenants.filter(t => t.status === 'active').length,
    suspended: allTenants.filter(t => t.status === 'suspended').length,
    trial    : allTenants.filter(t => t.status === 'trial').length,
    cancelled: allTenants.filter(t => t.status === 'cancelled').length,
  };

  // Aggregate usage across all tenants / Utilizare agregată pe toți tenanții
  let totalRequests = 0, totalTokens = 0, totalStorage = 0;
  for (const t of allTenants) {
    const u = tenantEngine.getUsage(t.id) || {};
    totalRequests += u.requests_per_month || 0;
    totalTokens   += u.tokens_per_month   || 0;
    totalStorage  += u.storage_mb         || 0;
  }

  // Error counts from tenant logs / Contorizare erori din loguri tenanți
  const now     = Date.now();
  const DAY_MS  = 86_400_000;
  const logs    = tenantEngine.tenantLogs;
  const errors24h = logs.filter(l => l.level === 'error' && (now - new Date(l.createdAt).getTime()) < DAY_MS).length;
  const errors7d  = logs.filter(l => l.level === 'error' && (now - new Date(l.createdAt).getTime()) < 7 * DAY_MS).length;

  // Orchestrator overview / Prezentare generală orchestrator
  const orchStats  = orchestrator.getGlobalStats();
  const healEvents = orchStats.optimizeEvents ? orchStats.optimizeEvents.length : 0;
  const shieldAlerts = allTenants.reduce((acc, t) => {
    const s = orchestrator.getShieldStatus(t.id);
    return acc + (s && s.blocked ? 1 : 0);
  }, 0);

  // Billing overview / Prezentare generală facturare
  const invoiceStats = billingEngine.getInvoiceStats();
  const allInvoices  = [...tenantEngine.invoices.values()];
  const mrr = allInvoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + (i.total || 0), 0);

  const uptimeSec = Math.round((Date.now() - _startTime) / 1000);
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;
  const uptimeStr = `${h}h ${m}m ${s}s`;

  return {
    tenants: tenantStats,
    usage  : { totalRequests, totalTokens, totalStorage },
    errors : { last24h: errors24h, last7d: errors7d },
    uptime : uptimeStr,
    orchestrator: {
      status       : orchStats.health ? orchStats.health.status : 'unknown',
      healEvents,
      watchdogAlerts: shieldAlerts,
    },
    billing: {
      mrr            : Math.round(mrr * 100) / 100,
      invoicesPending: invoiceStats.pending,
      invoicesFailed : invoiceStats.failed,
    },
  };
}

// =============================================================================
// §  createExpressRouter — Protected Admin Router
// Router Express protejat pentru administrare
// =============================================================================

/**
 * createExpressRouter — builds the admin Express Router
 * Construiește Router-ul Express de administrare
 * @param {Function} adminTokenMiddleware — from backend/index.js
 * @returns {express.Router}
 */
function createExpressRouter(adminTokenMiddleware) {
  const router = express.Router();

  // All routes in this router require the admin token
  // Toate rutele din acest router necesită tokenul de administrator
  router.use(adminTokenMiddleware);

  // ===========================================================================
  // §1  GLOBAL DASHBOARD
  // ===========================================================================

  // GET /dashboard — tabloul de bord global
  router.get('/dashboard', (_req, res) => {
    try {
      res.json(_buildDashboard());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===========================================================================
  // §2  TENANT MANAGEMENT
  // Gestionare tenanți
  // ===========================================================================

  // GET /tenants — list all tenants / listare toți tenanții
  router.get('/tenants', (req, res) => {
    try {
      const all = tenantEngine.getAllTenants();
      const list = all.map(t => ({
        id    : t.id,
        name  : t.name,
        email : t.email,
        slug  : t.slug,
        planId: t.planId,
        status: t.status,
        usage : tenantEngine.getUsage(t.id),
        createdAt: t.createdAt,
      }));
      res.json({ tenants: list, total: list.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /tenants/:tenantId — tenant detail / detalii tenant
  router.get('/tenants/:tenantId', (req, res) => {
    try {
      const ctx = tenantEngine.getTenantContext(req.params.tenantId);
      if (!ctx) return res.status(404).json({ error: 'Tenant not found' });
      res.json(ctx);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /tenants — create tenant / creare tenant
  router.post('/tenants', (req, res) => {
    try {
      const tenant = tenantEngine.createTenant(req.body);
      tenantEngine.logEvent(tenant.id, 'tenant_created_by_admin', { admin: req.admin && req.admin.id });
      res.status(201).json({ tenant });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /tenants/:tenantId — edit tenant name/email/planId / editare tenant
  router.put('/tenants/:tenantId', (req, res) => {
    try {
      const t = tenantEngine.getTenant(req.params.tenantId);
      if (!t) return res.status(404).json({ error: 'Tenant not found' });

      const { name, email, planId } = req.body;
      if (name)   t.name   = String(name).trim();
      if (email)  t.email  = String(email).trim().toLowerCase();
      if (planId) {
        if (!tenantEngine.plans.has(planId)) return res.status(400).json({ error: `Plan not found: ${planId}` });
        t.planId = planId;
      }
      t.updatedAt = new Date().toISOString();
      tenantEngine.logEvent(t.id, 'tenant_updated_by_admin', { name, email, planId });
      res.json({ tenant: t });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /tenants/:tenantId/suspend — suspend with reason / suspendare cu motiv
  router.post('/tenants/:tenantId/suspend', (req, res) => {
    try {
      const { reason = 'Admin action' } = req.body;
      const tenant = tenantEngine.suspendTenant(req.params.tenantId, reason);
      _addAlert('tenant_suspended', `Tenant ${req.params.tenantId} suspended`, { reason });
      res.json({ tenant, reason });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /tenants/:tenantId/reactivate — reactivate / reactivare
  router.post('/tenants/:tenantId/reactivate', (req, res) => {
    try {
      const tenant = tenantEngine.reactivateTenant(req.params.tenantId);
      res.json({ tenant });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /tenants/:tenantId — soft delete / ștergere soft
  router.delete('/tenants/:tenantId', (req, res) => {
    try {
      tenantEngine.deleteTenant(req.params.tenantId);
      res.json({ deleted: true, tenantId: req.params.tenantId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /tenants/:tenantId/usage — usage metrics / metrici utilizare
  router.get('/tenants/:tenantId/usage', (req, res) => {
    try {
      const usage = tenantEngine.getUsage(req.params.tenantId);
      if (!usage) return res.status(404).json({ error: 'Tenant not found' });
      res.json({ tenantId: req.params.tenantId, usage });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /tenants/:tenantId/logs — recent logs (limit 100) / loguri recente
  router.get('/tenants/:tenantId/logs', (req, res) => {
    try {
      const { tenantId } = req.params;
      if (!tenantEngine.getTenant(tenantId)) return res.status(404).json({ error: 'Tenant not found' });
      const logs = tenantEngine.tenantLogs
        .filter(l => l.tenantId === tenantId)
        .slice(-100)
        .reverse();
      res.json({ tenantId, logs, count: logs.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /tenants/:tenantId/events — recent events / evenimente recente
  router.get('/tenants/:tenantId/events', (req, res) => {
    try {
      const { tenantId } = req.params;
      if (!tenantEngine.getTenant(tenantId)) return res.status(404).json({ error: 'Tenant not found' });
      const events = tenantEngine.tenantEvents
        .filter(e => e.tenantId === tenantId)
        .slice(-100)
        .reverse();
      res.json({ tenantId, events, count: events.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /tenants/:tenantId/modules — active modules / module active
  router.get('/tenants/:tenantId/modules', (req, res) => {
    try {
      const { tenantId } = req.params;
      if (!tenantEngine.getTenant(tenantId)) return res.status(404).json({ error: 'Tenant not found' });
      const status = orchestrator.getModuleStatus(tenantId);
      res.json({ tenantId, modules: status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===========================================================================
  // §3  PLANS & PRICING MANAGEMENT
  // Gestionare planuri și prețuri
  // ===========================================================================

  // GET /plans — all plans / toate planurile
  router.get('/plans', (_req, res) => {
    res.json({ plans: billingEngine.getPlans() });
  });

  // POST /plans — create new plan / creare plan nou
  router.post('/plans', (req, res) => {
    try {
      const { id, name, price, features, limits } = req.body;
      if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
      if (tenantEngine.plans.has(id)) return res.status(409).json({ error: `Plan already exists: ${id}` });

      const plan = {
        id,
        name,
        price        : price || 0,
        features     : features || [],
        limits       : limits  || {},
        active       : true,
        createdAt    : new Date().toISOString(),
        updatedAt    : new Date().toISOString(),
      };
      tenantEngine.plans.set(id, plan);
      res.status(201).json({ plan });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /plans/:planId — update plan limits/features / actualizare plan
  router.put('/plans/:planId', (req, res) => {
    try {
      const plan = tenantEngine.plans.get(req.params.planId);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });

      const { name, price, features, limits } = req.body;
      if (name     !== undefined) plan.name     = name;
      if (price    !== undefined) plan.price    = price;
      if (features !== undefined) plan.features = features;
      if (limits   !== undefined) plan.limits   = { ...plan.limits, ...limits };
      plan.updatedAt = new Date().toISOString();

      res.json({ plan });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /plans/:planId — deactivate plan / dezactivare plan
  router.delete('/plans/:planId', (req, res) => {
    try {
      const plan = tenantEngine.plans.get(req.params.planId);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      plan.active    = false;
      plan.updatedAt = new Date().toISOString();
      res.json({ deactivated: true, planId: req.params.planId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ===========================================================================
  // §4  BILLING & INVOICES
  // Facturare și facturi
  // ===========================================================================

  // GET /billing/invoices — all invoices with filters / toate facturile cu filtre
  router.get('/billing/invoices', (req, res) => {
    try {
      const { status, tenantId, dateFrom, dateTo } = req.query;
      let invoices = [...tenantEngine.invoices.values()];

      if (status)   invoices = invoices.filter(i => i.status === status);
      if (tenantId) invoices = invoices.filter(i => i.tenantId === tenantId);
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        invoices = invoices.filter(i => new Date(i.createdAt).getTime() >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo).getTime();
        invoices = invoices.filter(i => new Date(i.createdAt).getTime() <= to);
      }

      invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json({ invoices, total: invoices.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /billing/invoices/:invoiceId — single invoice / factură unică
  router.get('/billing/invoices/:invoiceId', (req, res) => {
    try {
      const invoice = billingEngine.getInvoice(req.params.invoiceId);
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      res.json({ invoice });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /billing/invoices/:invoiceId/retry — retry payment / reîncercare plată
  router.post('/billing/invoices/:invoiceId/retry', async (req, res) => {
    try {
      const invoice = billingEngine.getInvoice(req.params.invoiceId);
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      if (invoice.status === 'paid') return res.status(409).json({ error: 'Invoice already paid' });

      const result = await billingEngine.processPayment(
        invoice.tenantId,
        invoice.id,
        invoice.total,
        invoice.currency || 'USD'
      );
      if (result.success) {
        billingEngine.markInvoicePaid(invoice.id);
      } else {
        billingEngine.markInvoiceFailed(invoice.id, result.error || 'retry_failed');
        _addAlert('payment_failed', `Invoice ${invoice.id} payment retry failed`, { tenantId: invoice.tenantId });
      }
      res.json({ result, invoiceId: invoice.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /billing/overview — MRR, ARR, pending/failed / prezentare generală facturare
  router.get('/billing/overview', (_req, res) => {
    try {
      const stats  = billingEngine.getInvoiceStats();
      const allInv = [...tenantEngine.invoices.values()];
      const mrr    = allInv.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
      const arr    = Math.round(mrr * 12 * 100) / 100;
      res.json({ mrr: Math.round(mrr * 100) / 100, arr, ...stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /billing/cycle/run — manually trigger billing cycle / declanșare manuală ciclu facturare
  router.post('/billing/cycle/run', async (req, res) => {
    try {
      const result = await billingEngine.runBillingCycle();
      res.json({ triggered: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /billing/webhook-logs — recent webhook events / evenimente webhook recente
  router.get('/billing/webhook-logs', (_req, res) => {
    res.json({ logs: [..._webhookLogs].reverse(), count: _webhookLogs.length });
  });

  // ===========================================================================
  // §5  USAGE & ANALYTICS
  // Utilizare și analiză
  // ===========================================================================

  // GET /analytics/global — global metrics / metrici globale
  router.get('/analytics/global', (_req, res) => {
    try {
      const allTenants = tenantEngine.getAllTenants();
      let totalRequests = 0, totalTokens = 0, totalStorage = 0, totalJobs = 0;
      for (const t of allTenants) {
        const u = tenantEngine.getUsage(t.id) || {};
        totalRequests += u.requests_per_month || 0;
        totalTokens   += u.tokens_per_month   || 0;
        totalStorage  += u.storage_mb         || 0;
        totalJobs     += u.jobs               || 0;
      }
      res.json({
        tenantCount   : allTenants.length,
        totalRequests,
        totalTokens,
        totalStorage,
        totalJobs,
        generatedAt   : new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/tenant/:tenantId — per-tenant metrics / metrici per tenant
  router.get('/analytics/tenant/:tenantId', (req, res) => {
    try {
      const { tenantId } = req.params;
      const tenant = tenantEngine.getTenant(tenantId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      const usage   = tenantEngine.getUsage(tenantId)  || {};
      const report  = billingEngine.getUsageReport(tenantId);
      const invoices = billingEngine.getInvoices(tenantId, 12);

      res.json({ tenantId, usage, billingReport: report, recentInvoices: invoices });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/topTenants — top 10 by usage / top 10 după utilizare
  router.get('/analytics/topTenants', (_req, res) => {
    try {
      const allTenants = tenantEngine.getAllTenants();
      const ranked = allTenants
        .map(t => {
          const u = tenantEngine.getUsage(t.id) || {};
          return {
            id    : t.id,
            name  : t.name,
            planId: t.planId,
            status: t.status,
            requests: u.requests_per_month || 0,
            tokens  : u.tokens_per_month   || 0,
            storage : u.storage_mb         || 0,
            score   : (u.requests_per_month || 0) + (u.tokens_per_month || 0) * 0.01,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      res.json({ topTenants: ranked });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/trends — 7-day and 30-day trend data / date de tendință
  router.get('/analytics/trends', (_req, res) => {
    try {
      const allTenants = tenantEngine.getAllTenants();
      const now = Date.now();
      const DAY_MS = 86_400_000;

      // Simulate daily snapshots from tenant events
      // Simulare instantanee zilnice din evenimentele tenantului
      function _buildDailyBuckets(days) {
        const buckets = [];
        for (let d = days - 1; d >= 0; d--) {
          const dayStart = now - (d + 1) * DAY_MS;
          const dayEnd   = now - d * DAY_MS;
          const label    = new Date(dayEnd).toISOString().slice(0, 10);

          let requests = 0, events = 0;
          for (const t of allTenants) {
            events += tenantEngine.tenantEvents.filter(e =>
              e.tenantId === t.id &&
              new Date(e.createdAt).getTime() >= dayStart &&
              new Date(e.createdAt).getTime() <  dayEnd
            ).length;
          }
          // Approximate daily requests from total / month (evenly distributed)
          // Aproximare cereri zilnice din total/lună (distribuite uniform)
          for (const t of allTenants) {
            const u = tenantEngine.getUsage(t.id) || {};
            requests += Math.round((u.requests_per_month || 0) / 30);
          }
          buckets.push({ date: label, requests, events });
        }
        return buckets;
      }

      res.json({
        last7d : _buildDailyBuckets(7),
        last30d: _buildDailyBuckets(30),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===========================================================================
  // §6  MODULE MANAGEMENT
  // Gestionare module
  // ===========================================================================

  // GET /modules — all modules with SEE status / toate modulele cu status SEE
  router.get('/modules', (_req, res) => {
    try {
      const report = seeEngine.analyzeAllModules();
      res.json({ modules: report, count: report.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /modules/:moduleName/activate/:tenantId — activate module for tenant
  // Activare modul pentru tenant
  router.post('/modules/:moduleName/activate/:tenantId', (req, res) => {
    try {
      const { moduleName, tenantId } = req.params;
      if (!tenantEngine.getTenant(tenantId)) return res.status(404).json({ error: 'Tenant not found' });
      tenantEngine.setFeatureFlag(tenantId, `module_${moduleName}`, true);
      tenantEngine.logEvent(tenantId, 'module_activated', { moduleName, by: req.admin && req.admin.id });
      res.json({ activated: true, moduleName, tenantId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /modules/:moduleName/deactivate/:tenantId — deactivate module
  // Dezactivare modul pentru tenant
  router.post('/modules/:moduleName/deactivate/:tenantId', (req, res) => {
    try {
      const { moduleName, tenantId } = req.params;
      if (!tenantEngine.getTenant(tenantId)) return res.status(404).json({ error: 'Tenant not found' });
      tenantEngine.setFeatureFlag(tenantId, `module_${moduleName}`, false);
      tenantEngine.logEvent(tenantId, 'module_deactivated', { moduleName, by: req.admin && req.admin.id });
      res.json({ deactivated: true, moduleName, tenantId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /modules/:moduleName/repair — trigger AHE repair / declanșare reparare AHE
  router.post('/modules/:moduleName/repair', (req, res) => {
    try {
      const { moduleName } = req.params;
      // Use the first active tenant as repair context, or a generic context
      // Utilizăm primul tenant activ ca context de reparare
      const tenants = tenantEngine.getAllTenants();
      const targetTenant = tenants.find(t => t.status === 'active') || tenants[0];

      if (targetTenant) {
        orchestrator.repairModule(targetTenant.id, moduleName);
      }

      // Record SEE analysis to refresh module status
      seeEngine.analyzeModule(moduleName);

      res.json({ repairTriggered: true, moduleName });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /modules/:moduleName/status — module status from SEE
  // Status modul din SEE
  router.get('/modules/:moduleName/status', (req, res) => {
    try {
      const analysis = seeEngine.analyzeModule(req.params.moduleName);
      res.json({ moduleName: req.params.moduleName, analysis });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===========================================================================
  // §7  ORCHESTRATOR CONTROL CENTER
  // Centrul de control al orchestratorului
  // ===========================================================================

  // GET /orchestrator/status — full OrchestratorV4 status / status complet
  router.get('/orchestrator/status', (_req, res) => {
    try {
      const stats  = orchestrator.getGlobalStats();
      const health = orchestrator.getSystemHealth();
      res.json({ stats, health });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /orchestrator/heal/:tenantId — trigger auto-heal / declanșare auto-vindecare
  router.post('/orchestrator/heal/:tenantId', (req, res) => {
    try {
      const { tenantId } = req.params;
      if (!tenantEngine.getTenant(tenantId)) return res.status(404).json({ error: 'Tenant not found' });
      const errors = orchestrator.detectTenantErrors(tenantId);
      orchestrator.regenerateConfigs(tenantId);
      tenantEngine.logEvent(tenantId, 'admin_heal_triggered', { errors, by: req.admin && req.admin.id });
      res.json({ healed: true, tenantId, errors });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /orchestrator/jobs — all scheduled jobs / toate sarcinile programate
  router.get('/orchestrator/jobs', (_req, res) => {
    try {
      const status = orchestrator.getSchedulerStatus();
      res.json({ jobs: status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /orchestrator/jobs/:tenantId/run/:jobName — force run job / execuție forțată sarcină
  router.post('/orchestrator/jobs/:tenantId/run/:jobName', async (req, res) => {
    try {
      const { tenantId, jobName } = req.params;
      if (!tenantEngine.getTenant(tenantId)) return res.status(404).json({ error: 'Tenant not found' });
      const result = await orchestrator.runJob(tenantId, jobName);
      res.json({ ran: true, tenantId, jobName, result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /orchestrator/shield/:tenantId — watchdog/shield status / status watchdog/shield
  router.get('/orchestrator/shield/:tenantId', (req, res) => {
    try {
      const { tenantId } = req.params;
      if (!tenantEngine.getTenant(tenantId)) return res.status(404).json({ error: 'Tenant not found' });
      const status = orchestrator.getShieldStatus(tenantId);
      res.json({ tenantId, shield: status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /orchestrator/brain — GOB stats + scaling recommendation / statistici GOB + recomandare scalare
  router.get('/orchestrator/brain', (_req, res) => {
    try {
      const health  = orchestrator.getSystemHealth();
      const scaling = orchestrator.getScalingRecommendation();
      const stats   = orchestrator.getGlobalStats();
      res.json({ health, scaling, globalStats: stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===========================================================================
  // §8  SYSTEM LOGS & ALERTS
  // Loguri de sistem și alerte
  // ===========================================================================

  // GET /logs — system-wide logs with filters / loguri la nivel de sistem cu filtre
  router.get('/logs', (req, res) => {
    try {
      const { level, tenantId, dateFrom } = req.query;
      const limit  = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
      let logs = [...tenantEngine.tenantLogs];

      if (level)    logs = logs.filter(l => l.level    === level);
      if (tenantId) logs = logs.filter(l => l.tenantId === tenantId);
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        logs = logs.filter(l => new Date(l.createdAt).getTime() >= from);
      }

      logs = logs.slice(-limit).reverse();
      res.json({ logs, count: logs.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /alerts — active alerts / alerte active
  router.get('/alerts', (_req, res) => {
    try {
      const active = [..._alerts.values()].filter(a => a.active);

      // Dynamically derive alerts from current platform state
      // Derivare dinamică a alertelor din starea curentă a platformei
      const suspended = tenantEngine.getAllTenants().filter(t => t.status === 'suspended');
      const failedInv = [...tenantEngine.invoices.values()].filter(i => i.status === 'failed');

      const derived = [
        ...suspended.map(t => ({
          id       : `derived_suspended_${t.id}`,
          type     : 'tenant_suspended',
          message  : `Tenant ${t.name || t.id} is suspended`,
          meta     : { tenantId: t.id },
          active   : true,
          createdAt: t.updatedAt || t.createdAt,
        })),
        ...failedInv.map(inv => ({
          id       : `derived_invoice_${inv.id}`,
          type     : 'billing_failure',
          message  : `Invoice ${inv.id} payment failed`,
          meta     : { invoiceId: inv.id, tenantId: inv.tenantId },
          active   : true,
          createdAt: inv.updatedAt || inv.createdAt,
        })),
      ];

      res.json({ alerts: [...active, ...derived], count: active.length + derived.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /alerts/:alertId/dismiss — dismiss alert / respingere alertă
  router.post('/alerts/:alertId/dismiss', (req, res) => {
    try {
      const alert = _alerts.get(req.params.alertId);
      if (!alert) return res.status(404).json({ error: 'Alert not found' });
      alert.active      = false;
      alert.dismissedAt = new Date().toISOString();
      alert.dismissedBy = req.admin && req.admin.id;
      res.json({ dismissed: true, alertId: req.params.alertId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

// =============================================================================
// §  createProvisioningRouter — Public Tenant Signup Flow
// Router public pentru înregistrarea tenantului
// =============================================================================

/**
 * createProvisioningRouter — unauthenticated signup + verification routes
 * Rute publice pentru înregistrare și verificare tenant
 * @returns {express.Router}
 */
function createProvisioningRouter() {
  const router = express.Router();

  // GET /tenant/signup/plans — list plans for signup page / planuri pentru pagina de înregistrare
  router.get('/tenant/signup/plans', (_req, res) => {
    try {
      const plans = billingEngine.getPlans().filter(p => p.active !== false);
      res.json({ plans });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /tenant/signup — full provisioning flow / flux complet de provizionare
  router.post('/tenant/signup', async (req, res) => {
    try {
      const { name, email, planId = 'free' } = req.body;

      // Step 1: Validate required fields / Validare câmpuri obligatorii
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name is required' });
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid email is required' });
      }
      if (!tenantEngine.plans.has(planId)) {
        return res.status(400).json({ error: `Unknown planId: ${planId}` });
      }

      // Step 2: Create tenant (creates sub + configs + flags + usage)
      // Creare tenant (creează sub + configs + flags + usage)
      const tenant = tenantEngine.createTenant({ name: name.trim(), email: email.trim().toLowerCase(), planId });

      // Step 3: Generate API key (raw, one-time display)
      // Generare cheie API (raw, afișată o singură dată)
      const keyRecord = tenantEngine.generateApiKey(tenant.id, 'default', ['read', 'write']);

      // Step 4: Start trial if plan is free / Pornire perioadă de probă dacă planul este gratuit
      let trialEnd = null;
      if (planId === 'free') {
        const sub = billingEngine.startTrial(tenant.id);
        trialEnd  = sub ? sub.trialEnd : null;
      }

      // Step 5: Log welcome event / Înregistrare eveniment de bun venit
      tenantEngine.logEvent(tenant.id, 'tenant_created', {
        name    : tenant.name,
        email   : tenant.email,
        planId,
        source  : 'signup',
      });

      // Step 6: Return provisioning summary / Returnare rezumat provizionare
      const appUrl = process.env.PUBLIC_APP_URL || 'https://app.unicorn.dev';
      res.status(201).json({
        tenantId    : tenant.id,
        slug        : tenant.slug,
        apiKey      : keyRecord.rawKey,   // raw key — one-time only / cheie raw — o singură dată
        planId,
        trialEnd,
        dashboardUrl: `${appUrl}/dashboard?tenant=${tenant.id}`,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /tenant/verify/:tenantId — verify email / verificare email
  router.post('/tenant/verify/:tenantId', (req, res) => {
    try {
      const { tenantId } = req.params;
      const tenant = tenantEngine.getTenant(tenantId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      tenantEngine.setConfig(tenantId, 'emailVerified', true);
      tenantEngine.logEvent(tenantId, 'email_verified', { at: new Date().toISOString() });

      res.json({ verified: true, tenantId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

// =============================================================================
// Exports / Exporturi
// =============================================================================

module.exports = {
  createExpressRouter,
  createProvisioningRouter,

  // Internals exposed for testing / Expuse pentru testare
  _pushWebhookLog,
  _addAlert,
};
