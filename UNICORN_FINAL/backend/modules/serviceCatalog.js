// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

/**
 * serviceCatalog — canonical, single-interface catalog facade.
 * RO: fațada canonică a catalogului — o singură interfață pentru toate
 * modulele (salesOrchestrator, ZAC, teste) ca să nu mai existe N surse.
 *
 * Two resolution paths, in order:
 *   1. In-process source attached by backend/index.js via attachSource()
 *      (zero-copy view over the live `_unicornServices` array).
 *   2. HTTP pull from the local backend (http://127.0.0.1:3000/api/services)
 *      — used by standalone processes (ZAC systemd, test scripts) so the
 *      SAME module works cross-process. Cached 60s, never throws.
 *
 * Contract: every item exposes { id, title, group?, priceUsd?, ... } as
 * emitted by /api/services. list() always returns an Array (possibly []).
 */
'use strict';

const http = require('http');

const BACKEND_BASE = process.env.ZAC_BACKEND_BASE || process.env.BACKEND_API_URL || 'http://127.0.0.1:3000';
const HTTP_CACHE_TTL_MS = Math.max(5000, Number(process.env.SERVICE_CATALOG_TTL_MS || 60000));

let _source = null;            // () => Array — attached in-process by backend
let _httpCache = { items: [], at: 0, ok: false, error: null };

function attachSource(fn) {
  if (typeof fn === 'function') _source = fn;
  return !!_source;
}

function _fetchHttp() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const url = BACKEND_BASE.replace(/\/$/, '') + '/api/services';
      const req = http.get(url, { timeout: 4000 }, (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { buf += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(buf);
            const items = Array.isArray(j) ? j : (Array.isArray(j.services) ? j.services : []);
            done({ ok: true, items });
          } catch (e) { done({ ok: false, items: [], error: 'parse: ' + e.message }); }
        });
      });
      req.on('timeout', () => { req.destroy(); done({ ok: false, items: [], error: 'timeout' }); });
      req.on('error', (e) => done({ ok: false, items: [], error: e.message }));
    } catch (e) { done({ ok: false, items: [], error: e.message }); }
  });
}

async function _resolveItems() {
  // 1) In-process live view — always freshest, no network.
  if (_source) {
    try {
      const arr = _source();
      if (Array.isArray(arr)) return { items: arr, source: 'in-process' };
    } catch (_) { /* fall through */ }
  }
  // 2) HTTP pull with cache (standalone mode).
  const now = Date.now();
  if (now - _httpCache.at < HTTP_CACHE_TTL_MS && _httpCache.ok) {
    return { items: _httpCache.items, source: 'http-cache' };
  }
  const r = await _fetchHttp();
  _httpCache = { items: r.items, at: now, ok: r.ok, error: r.error || null };
  return { items: r.items, source: r.ok ? 'http-live' : 'http-failed' };
}

async function list({ limit = 0, group = null } = {}) {
  const { items } = await _resolveItems();
  let out = items;
  if (group) out = out.filter((s) => s && (s.group === group || s.segment === group || s.tier === group));
  if (limit > 0) out = out.slice(0, limit);
  return out;
}

// listSync — synchronous, in-process-only view of the catalog. Returns the
// attached live array (or []) with no network. Used by upsell-engine and the
// growth-brain, which run in-process and must never await on a request path.
// RO: vedere sincronă a catalogului — doar sursa in-process, fără rețea.
function listSync() {
  if (_source) {
    try { const arr = _source(); if (Array.isArray(arr)) return arr; } catch (_) { /* noop */ }
  }
  return Array.isArray(_httpCache.items) ? _httpCache.items : [];
}

async function byId(id) {
  const target = String(id || '').trim();
  if (!target) return null;
  const { items } = await _resolveItems();
  return items.find((s) => s && String(s.id) === target) || null;
}

async function count() {
  const { items } = await _resolveItems();
  return items.length;
}

function getStatus() {
  return {
    module: 'serviceCatalog',
    inProcessSource: !!_source,
    backendBase: BACKEND_BASE,
    httpCache: { ageMs: _httpCache.at ? Date.now() - _httpCache.at : null, ok: _httpCache.ok, count: _httpCache.items.length, error: _httpCache.error },
  };
}

module.exports = { attachSource, list, listSync, byId, count, getStatus };
