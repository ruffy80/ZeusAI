// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:57.389Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/internal-health.js · #5 + #7
//
// Aggregated internal health endpoint. Collects status from:
//   - process / runtime (uptime, memory)
//   - innovations-50y modules (audit, otel, sbom, manifest, schemas)
//   - SaaS mesh modules (billingEngine, tenantManager, …) when available
//   - ui-auto-builder, when available
//   - snapshot-cache (this pack), when initialized
//
// Read-only · zero side effects · meant for ops/dashboards.
// =====================================================================

'use strict';

const HEALTH_KEYS = [
  'billingEngine','saasOrchestratorV4','kpiAnalytics','aiAutoDispatcher',
  'provisioningEngine','globalFailover','globalApiGateway','tenantBilling',
  'tenantAnalytics','tenantManager','globalLoadBalancer','uiAutoBuilder'
];

function _safe(fn, fallback) {
  try { return fn(); } catch (_) { return fallback; }
}

function _module50y() {
  try { return require('../innovations-50y'); } catch (_) { return null; }
}

function _meshOrchestrator() {
  // We avoid creating a hard dependency on backend/index.js wiring.
  try {
    const m = require('../meshOrchestrator');
    return m && (m.registry || m.modules || m);
  } catch (_) { return null; }
}

function buildHealth(extra) {
  const out = {
    ok: true,
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: _safe(() => {
      const m = process.memoryUsage();
      return { rssMb: Math.round(m.rss / 1048576), heapUsedMb: Math.round(m.heapUsed / 1048576) };
    }, null),
    nodeVersion: process.version,
    pid: process.pid,
    pillars: {
      innov50y: null,
      mesh: null,
      uiBuilder: null,
      snapshotCache: null
    }
  };

  const innov50 = _module50y();
  if (innov50) {
    out.pillars.innov50y = _safe(() => ({
      audit: innov50.audit && innov50.audit.root ? { treeSize: innov50.audit.root().treeSize, lastHash: innov50.audit.root().lastHash } : null,
      otel: innov50.otel && innov50.otel.status ? innov50.otel.status() : null,
      schemas: innov50.schemas && innov50.schemas.status ? innov50.schemas.status() : null,
      manifest: innov50.manifest && innov50.manifest.status ? innov50.manifest.status() : null
    }), null);
  }

  const mesh = _meshOrchestrator();
  if (mesh) {
    const map = {};
    for (const k of HEALTH_KEYS) {
      const mod = mesh[k] || (typeof mesh.get === 'function' ? mesh.get(k) : null);
      if (!mod) { map[k] = { ok: false, present: false }; continue; }
      const ok = !!(mod && (typeof mod.health === 'function' || typeof mod.getStatus === 'function' || mod.ready === true || mod.started === true));
      let info = null;
      try { info = typeof mod.health === 'function' ? mod.health() : (typeof mod.getStatus === 'function' ? mod.getStatus() : null); } catch (_) { info = null; }
      map[k] = { ok, present: true, info: info && typeof info === 'object' ? info : null };
    }
    out.pillars.mesh = map;
  }

  // ui-auto-builder
  try {
    const ui = require('../ui-auto-builder');
    out.pillars.uiBuilder = typeof ui.getStatus === 'function' ? ui.getStatus() : { present: true };
  } catch (_) { /* not present */ }

  if (extra && typeof extra === 'object') Object.assign(out, extra);
  return out;
}

module.exports = { buildHealth };
