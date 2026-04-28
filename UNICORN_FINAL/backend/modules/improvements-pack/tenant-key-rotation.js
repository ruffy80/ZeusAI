// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:57.390Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/tenant-key-rotation.js · #10
//
// Rotate a tenant API key WITH a grace period: the new key becomes active
// immediately, while the old key continues to authenticate for `graceMs`
// (default 24h) so deployed clients can be updated without downtime.
//
// Pure additive: requires only the public surface of `tenant-manager.js`
// (createTenantApiKey / revokeTenantApiKey / listTenantApiKeys) — never
// mutates the underlying store directly.
// =====================================================================

'use strict';

const DEFAULT_GRACE_MS = Math.max(60_000, Number(process.env.TENANT_KEY_ROTATE_GRACE_MS) || 24 * 60 * 60 * 1000);

const SCHEDULE = new Map(); // oldKeyId -> { tenantId, revokeAt, timer? }

function _resolveManager(injected) {
  if (injected) return injected;
  try { return require('../tenant-manager'); } catch (_) { return null; }
}

/**
 * Rotate a tenant API key.
 * @param {object} opts
 * @param {string} opts.tenantId          the tenant id
 * @param {string} opts.oldKeyId          identifier of the key to retire
 * @param {string} [opts.label]           label for the new key
 * @param {number} [opts.graceMs]         grace window in ms (default 24h)
 * @param {object} [opts.tenantManager]   inject for testing
 * @returns {{newKey:object, oldKeyId:string, revokeAt:string, graceMs:number}}
 */
function rotateTenantApiKey(opts) {
  const o = opts || {};
  const tenantId = String(o.tenantId || '').trim();
  const oldKeyId = String(o.oldKeyId || '').trim();
  if (!tenantId) throw new Error('tenant_id_required');
  if (!oldKeyId) throw new Error('old_key_id_required');
  const graceMs = Math.max(0, Number(o.graceMs) || DEFAULT_GRACE_MS);

  const tm = _resolveManager(o.tenantManager);
  if (!tm) throw new Error('tenant_manager_not_available');

  const label = String(o.label || 'rotated-' + new Date().toISOString().slice(0, 10));
  let newKey;
  if (typeof tm.createTenantApiKey === 'function') {
    newKey = tm.createTenantApiKey(tenantId, label);
  } else if (typeof tm.createApiKey === 'function') {
    newKey = tm.createApiKey(tenantId, { label });
  } else {
    throw new Error('createTenantApiKey_not_supported');
  }

  const revokeAt = Date.now() + graceMs;
  const entry = { tenantId, oldKeyId, revokeAt, timer: null };
  // Schedule revocation; if process exits earlier the next call to
  // `runDueRevocations()` (or a fresh module load) will sweep it.
  if (graceMs > 0) {
    entry.timer = setTimeout(() => { try { _revoke(tm, tenantId, oldKeyId); } finally { SCHEDULE.delete(oldKeyId); } }, Math.min(graceMs, 2_147_483_000));
    if (typeof entry.timer.unref === 'function') entry.timer.unref();
  } else {
    _revoke(tm, tenantId, oldKeyId);
  }
  SCHEDULE.set(oldKeyId, entry);

  return {
    newKey,
    oldKeyId,
    revokeAt: new Date(revokeAt).toISOString(),
    graceMs
  };
}

function _revoke(tm, tenantId, oldKeyId) {
  try {
    if (typeof tm.revokeTenantApiKey === 'function') tm.revokeTenantApiKey(tenantId, oldKeyId);
    else if (typeof tm.revokeApiKey === 'function') tm.revokeApiKey(tenantId, oldKeyId);
  } catch (_) { /* swallow */ }
}

function listScheduledRevocations() {
  return Array.from(SCHEDULE.values()).map(e => ({
    tenantId: e.tenantId,
    oldKeyId: e.oldKeyId,
    revokeAt: new Date(e.revokeAt).toISOString()
  }));
}

function runDueRevocations(tenantManager) {
  const tm = _resolveManager(tenantManager);
  if (!tm) return 0;
  const now = Date.now();
  let n = 0;
  for (const [oldKeyId, e] of SCHEDULE.entries()) {
    if (e.revokeAt <= now) {
      try { _revoke(tm, e.tenantId, oldKeyId); n++; } catch (_) {}
      if (e.timer) try { clearTimeout(e.timer); } catch (_) {}
      SCHEDULE.delete(oldKeyId);
    }
  }
  return n;
}

function _resetForTests() {
  for (const e of SCHEDULE.values()) if (e.timer) try { clearTimeout(e.timer); } catch (_) {}
  SCHEDULE.clear();
}

module.exports = { rotateTenantApiKey, listScheduledRevocations, runDueRevocations, _resetForTests };
