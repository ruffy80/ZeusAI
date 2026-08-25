'use strict';

/**
 * Instant Identity Continuum (IIC) — ZeusAI forever-fluent account shell.
 *
 * Invention: a local-first identity continuum that never shows a blank
 * "Loading…" account chrome. Session truth lives in three layers:
 *   L0  SSR HTML already contains Create / Sign-in / Import controls
 *   L1  browser snapshot (localStorage) paints signed-in chrome in <16ms
 *   L2  network reconcile (/api/cryptoauth/me + /api/customer/me) SWR
 *
 * Server side: short TTL response memo for /api/customer/me so ledger merges
 * do not re-scan ORDERS/UAIC on every click while the user is on /account.
 *
 * Client helpers are mirrored in shell.js pageAccount (inline, CSP-nonced).
 * This module is the shared server cache + public status surface.
 */

const TTL_MS = Math.max(1000, Number(process.env.IIC_ME_CACHE_MS || 8000));
const MAX_ENTRIES = 128;

const _meMemo = new Map(); // key → { body, ts, status }

function cacheKey(parts) {
  return parts.filter(Boolean).map(String).join('\0');
}

function getCachedMe(key) {
  if (!key) return null;
  const hit = _meMemo.get(key);
  if (!hit) return null;
  if ((Date.now() - hit.ts) > TTL_MS) {
    _meMemo.delete(key);
    return null;
  }
  return hit;
}

function setCachedMe(key, status, body) {
  if (!key || body == null) return;
  _meMemo.set(key, { status, body, ts: Date.now() });
  if (_meMemo.size > MAX_ENTRIES) {
    const oldest = _meMemo.keys().next().value;
    _meMemo.delete(oldest);
  }
}

function invalidateMe(prefix) {
  if (!prefix) {
    _meMemo.clear();
    return;
  }
  for (const k of _meMemo.keys()) {
    if (String(k).indexOf(String(prefix)) === 0) _meMemo.delete(k);
  }
}

function getStatus() {
  return {
    ok: true,
    module: 'instant-identity-continuum',
    name: 'Instant Identity Continuum',
    invention: 'local-first account chrome + SWR session snapshot + me-ledger memo',
    ttlMs: TTL_MS,
    memoSize: _meMemo.size,
    layers: ['ssr-auth-chrome', 'localStorage-snapshot', 'network-reconcile'],
    health: 'ok',
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  TTL_MS,
  cacheKey,
  getCachedMe,
  setCachedMe,
  invalidateMe,
  getStatus,
};
