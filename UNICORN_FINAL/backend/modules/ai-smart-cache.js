// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

// ==================== AI SMART CACHE MODULE ====================
// Cache inteligent pentru răspunsuri AI cu:
//  - TTL configurabil per tip task
//  - Deduplicare semantică (normalizare cheie)
//  - Tracking cost economisit
//  - LRU eviction la limita de memorie
//  - Stats detaliate (hit rate, cost saved, latency)
//  - Fallback graceful (niciodată nu blochează)

const crypto = require('crypto');

const DEFAULT_TTL_MS = parseInt(process.env.AI_CACHE_TTL_MS        || '120000', 10); // 2 min
const MAX_ENTRIES    = parseInt(process.env.AI_CACHE_MAX_ENTRIES    || '1000',   10);
const MAX_SIZE_BYTES = parseInt(process.env.AI_CACHE_MAX_BYTES      || '52428800', 10); // 50MB

// TTL pe tip task
const TTL_BY_TASK = {
  embedding:  parseInt(process.env.AI_CACHE_TTL_EMBEDDING  || '3600000', 10), // 1h
  reasoning:  parseInt(process.env.AI_CACHE_TTL_REASONING  || '300000',  10), // 5m
  search:     parseInt(process.env.AI_CACHE_TTL_SEARCH     || '60000',   10), // 1m
  chat:       parseInt(process.env.AI_CACHE_TTL_CHAT       || '120000',  10), // 2m
  code:       parseInt(process.env.AI_CACHE_TTL_CODE       || '600000',  10), // 10m
  simple:     parseInt(process.env.AI_CACHE_TTL_SIMPLE     || '300000',  10), // 5m
};

const _stats = {
  hits:         0,
  misses:       0,
  evictions:    0,
  costSaved:    0, // USD
  latencySaved: 0, // ms
  totalBytes:   0,
  entries:      0,
};

// Map<key, { value, ts, ttl, bytes, task, costUsd, latencyMs }>
const _cache = new Map();

// ── Generare cheie normalizată ─────────────────────────────────────────────
function _normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,?!]/g, '');
}

function _makeKey(message, opts = {}) {
  const normalized = _normalizeText(message);
  const relevant   = JSON.stringify({
    m: normalized.slice(0, 500), // primele 500 caractere
    t: opts.taskType || 'chat',
    p: opts.provider || '',      // dacă se specifică providerul explicit
  });
  return crypto.createHash('sha256').update(relevant).digest('hex');
}

// ── Eviction LRU ─────────────────────────────────────────────────────────────
function _evictOldest(count = 1) {
  let evicted = 0;
  for (const [key, entry] of _cache) {
    if (evicted >= count) break;
    _stats.totalBytes -= entry.bytes || 0;
    _cache.delete(key);
    evicted++;
    _stats.evictions++;
  }
}

function _evictExpired() {
  const now = Date.now();
  for (const [key, entry] of _cache) {
    if (now - entry.ts > entry.ttl) {
      _stats.totalBytes -= entry.bytes || 0;
      _cache.delete(key);
    }
  }
  _stats.entries = _cache.size;
}

// ── GET ───────────────────────────────────────────────────────────────────────
function get(message, opts = {}) {
  try {
    const key = _makeKey(message, opts);
    const entry = _cache.get(key);
    if (!entry) { _stats.misses++; return null; }

    const now = Date.now();
    if (now - entry.ts > entry.ttl) {
      _cache.delete(key);
      _stats.totalBytes -= entry.bytes || 0;
      _stats.entries = _cache.size;
      _stats.misses++;
      return null;
    }

    // Hit — mutăm la finalul Map-ului (LRU trick)
    _cache.delete(key);
    _cache.set(key, { ...entry, lastAccess: now });

    _stats.hits++;
    _stats.costSaved    += entry.costUsd    || 0;
    _stats.latencySaved += entry.latencyMs  || 0;
    return entry.value;
  } catch {
    return null;
  }
}

// ── SET ───────────────────────────────────────────────────────────────────────
function set(message, opts = {}, value, meta = {}) {
  try {
    if (!value) return;
    const key     = _makeKey(message, opts);
    const task    = opts.taskType || 'chat';
    const ttl     = TTL_BY_TASK[task] || DEFAULT_TTL_MS;
    const strVal  = JSON.stringify(value);
    const bytes   = Buffer.byteLength(strVal, 'utf8');

    // Evict dacă depășim limita de size
    while (_stats.totalBytes + bytes > MAX_SIZE_BYTES && _cache.size > 0) {
      _evictOldest(5);
    }
    // Evict dacă depășim numărul de intrări
    while (_cache.size >= MAX_ENTRIES) {
      _evictOldest(10);
    }

    _cache.set(key, {
      value,
      ts:         Date.now(),
      lastAccess: Date.now(),
      ttl,
      bytes,
      task,
      costUsd:    meta.costUsd    || 0,
      latencyMs:  meta.latencyMs  || 0,
    });
    _stats.totalBytes += bytes;
    _stats.entries     = _cache.size;
  } catch {
    // Niciodată nu blocăm pentru cache
  }
}

// ── Invalidare manuală ────────────────────────────────────────────────────────
function invalidate(message, opts = {}) {
  try {
    const key = _makeKey(message, opts);
    if (_cache.has(key)) {
      _stats.totalBytes -= _cache.get(key).bytes || 0;
      _cache.delete(key);
      _stats.entries = _cache.size;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function clear() {
  _cache.clear();
  _stats.totalBytes = 0;
  _stats.entries    = 0;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function getStats() {
  const total = _stats.hits + _stats.misses;
  return {
    hits:          _stats.hits,
    misses:        _stats.misses,
    hitRate:       total > 0 ? (_stats.hits / total * 100).toFixed(2) + '%' : '0%',
    evictions:     _stats.evictions,
    entries:       _stats.entries,
    totalKB:       (_stats.totalBytes / 1024).toFixed(2),
    costSavedUSD:  _stats.costSaved.toFixed(6),
    latencySavedMs: _stats.latencySaved,
    ttlsByTask:    TTL_BY_TASK,
    maxEntries:    MAX_ENTRIES,
    maxSizeMB:     (MAX_SIZE_BYTES / 1048576).toFixed(1),
  };
}


// ── Self-tuning: auto-optimizare TTL și dimensiune cache ────────────────────
function _autoTune() {
  const stats = getStats();
  const hitRate = parseFloat(stats.hitRate);
  // Dacă hit rate < 60% și entries aproape de max, crește TTL și mărimea
  if (hitRate < 60 && _stats.entries > MAX_ENTRIES * 0.8) {
    for (const t in TTL_BY_TASK) TTL_BY_TASK[t] = Math.min(TTL_BY_TASK[t] * 1.2, 3600000 * 6); // max 6h
    global.AI_CACHE_MAX_ENTRIES = (global.AI_CACHE_MAX_ENTRIES || MAX_ENTRIES) + 200;
    global.AI_CACHE_MAX_BYTES = (global.AI_CACHE_MAX_BYTES || MAX_SIZE_BYTES) + 10485760; // +10MB
  }
  // Dacă hit rate > 90% și costSaved mare, scade TTL și mărimea (optimizare cost)
  if (hitRate > 90 && _stats.costSaved > 10) {
    for (const t in TTL_BY_TASK) TTL_BY_TASK[t] = Math.max(TTL_BY_TASK[t] * 0.8, 60000); // min 1m
    global.AI_CACHE_MAX_ENTRIES = Math.max((global.AI_CACHE_MAX_ENTRIES || MAX_ENTRIES) - 100, 200);
    global.AI_CACHE_MAX_BYTES = Math.max((global.AI_CACHE_MAX_BYTES || MAX_SIZE_BYTES) - 5242880, 1048576); // -5MB
  }
}

// Curățare periodică a entărilor expirate (la fiecare 5 min)
const _cleanupHandle = setInterval(_evictExpired, 300000);
if (_cleanupHandle.unref) _cleanupHandle.unref();

// Self-tuning periodic (la fiecare 10 min)
const _tuneHandle = setInterval(_autoTune, 600000);
if (_tuneHandle.unref) _tuneHandle.unref();

module.exports = { get, set, invalidate, clear, getStats };
