// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Zeus Autonomic Commerce Core · shared utilities.
// RO: utilitare comune pentru toate sub-motoarele ZACC. Fără dependențe
// externe — totul determinist și sigur pentru CI + runtime live.

'use strict';

const OWNER_BTC = process.env.ZACC_BTC_ADDRESS
  || process.env.BTC_OWNER_WALLET
  || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

function now() { return new Date().toISOString(); }

function clamp(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

// Deterministic, dependency-free PRNG (mulberry32) so the autonomous loop is
// reproducible in tests yet still varies day-to-day via the seed.
function rng(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable string hash → 32-bit unsigned int. Used to seed the PRNG from labels.
function hash32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function slug(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'zacc-item';
}

function shortId(prefix) {
  return (prefix || 'zacc') + '-' + Date.now().toString(36) + '-'
    + Math.random().toString(36).slice(2, 8);
}

function pick(arr, r) {
  if (!arr || !arr.length) return undefined;
  return arr[Math.floor((typeof r === 'function' ? r() : Math.random()) * arr.length) % arr.length];
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// Bilingual, side-effect-free logger. RO: nu oprește niciodată procesul.
function logger(scope) {
  const tag = '[zacc:' + scope + ']';
  return {
    info: (...a) => { try { console.log(tag, ...a); } catch (_) { /* noop */ } },
    warn: (...a) => { try { console.warn(tag, ...a); } catch (_) { /* noop */ } },
  };
}

module.exports = { OWNER_BTC, now, clamp, rng, hash32, slug, shortId, pick, round2, logger };
