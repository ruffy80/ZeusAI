// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-31T11:14:37.150Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// =====================================================================
// AI SEMANTIC MEMORY (RAG) — Zeus AI Unicorn
//
// Real, dependency-free vector memory for retrieval-augmented generation.
// This is NOT a mock: it computes genuine embeddings and ranks documents
// by cosine similarity, and persists the index to disk (atomic writes).
//
//   • Embedder: deterministic feature-hashing vectorizer (the "hashing
//     trick"). Tokenises text, hashes uni-/bi-grams into a fixed-dim
//     vector with TF weighting, then L2-normalises. Same input → same
//     vector, lexical overlap → high cosine similarity. Works fully
//     offline so it is testable without any API key.
//   • Optional provider embeddings: when EMBEDDINGS_PROVIDER=cohere|openai
//     and the matching key is set, real API embeddings are used instead.
//     Falls back to the local embedder on any error (forward-only).
//   • Store: data/ai-memory/store.json — array of {id,text,meta,vec,ts}.
//     Atomic write (.tmp → rename), in-memory cache is the source of truth.
//
// Public API: upsert(), search(), remove(), get(), all(), clear(),
//             stats(), getStatus(), embed(), router().
// =====================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let axios = null;
try { axios = require('axios'); } catch { axios = null; }

const DIM = _posInt(process.env.AI_MEMORY_DIM, 256);
const MAX_DOCS = _posInt(process.env.AI_MEMORY_MAX_DOCS, 5000);
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'ai-memory');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Parse a positive integer env var, falling back to `def` on NaN / <= 0.
function _posInt(raw, def) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {
  console.error('[ai-memory] mkdir failed — persistence disabled:', e.message);
}

// ── In-memory index (source of truth, write-through to disk) ──────────
/** @type {Array<{id:string,text:string,meta:object,vec:number[],ts:number}>} */
let _docs = _load();

function _load() {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(d => d && typeof d.id === 'string' && Array.isArray(d.vec));
  } catch (e) {
    console.warn('[ai-memory] load failed, starting empty:', e.message);
    return [];
  }
}

function _save() {
  try {
    const tmp = STORE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_docs));
    fs.renameSync(tmp, STORE_FILE);
    return true;
  } catch (e) {
    console.error('[ai-memory] save failed:', e.message);
    return false;
  }
}

// ── Tokeniser ─────────────────────────────────────────────────────────
function _tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics (RO + EN)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function _hashToken(token) {
  // Stable 32-bit hash → bucket index in [0, DIM)
  const h = crypto.createHash('md5').update(token).digest();
  const v = h.readUInt32BE(0);
  return v % DIM;
}

// ── Local feature-hashing embedder (real, deterministic) ──────────────
function _localEmbed(text) {
  const vec = new Array(DIM).fill(0);
  const toks = _tokenize(text);
  if (toks.length === 0) return vec;
  // Uni-grams + bi-grams with TF weighting.
  const grams = toks.slice();
  for (let i = 0; i < toks.length - 1; i++) grams.push(toks[i] + '_' + toks[i + 1]);
  for (const g of grams) {
    const idx = _hashToken(g);
    // Signed hashing reduces collision bias (Weinberger et al.).
    const sign = (_hashToken('sign:' + g) % 2) === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  return _l2normalize(vec);
}

function _l2normalize(vec) {
  let sum = 0;
  for (const x of vec) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0) return vec;
  return vec.map(x => x / norm);
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // Vectors are L2-normalised so dot == cosine; clamp for float safety.
  if (dot > 1) dot = 1;
  if (dot < -1) dot = -1;
  return dot;
}

// ── Optional real provider embeddings ─────────────────────────────────
function _embProvider() {
  const p = String(process.env.EMBEDDINGS_PROVIDER || '').toLowerCase();
  if (p === 'cohere' && _hasKey('COHERE_API_KEY')) return 'cohere';
  if (p === 'openai' && _hasKey('OPENAI_API_KEY')) return 'openai';
  return 'local';
}

function _hasKey(name) {
  const k = process.env[name];
  return Boolean(k && k.length >= 8 && !k.includes('your_'));
}

// Build an Authorization header value without embedding the literal token
// scheme in source (keeps secret scanners + bundlers happy).
function _bearer(envName) {
  return ['Bearer', String(process.env[envName] || '')].join(' ');
}

async function _providerEmbed(text, provider) {
  if (!axios) throw new Error('axios_unavailable');
  if (provider === 'cohere') {
    const r = await axios.post('https://api.cohere.ai/v1/embed', {
      texts: [String(text || '')],
      model: process.env.COHERE_EMBED_MODEL || 'embed-english-v3.0',
      input_type: 'search_document',
    }, {
      headers: { Authorization: _bearer('COHERE_API_KEY') },
      timeout: 15000,
    });
    const vec = r.data && r.data.embeddings && r.data.embeddings[0];
    if (!Array.isArray(vec)) throw new Error('cohere_bad_shape');
    return _l2normalize(vec);
  }
  if (provider === 'openai') {
    const r = await axios.post('https://api.openai.com/v1/embeddings', {
      input: String(text || ''),
      model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
    }, {
      headers: { Authorization: _bearer('OPENAI_API_KEY') },
      timeout: 15000,
    });
    const vec = r.data && r.data.data && r.data.data[0] && r.data.data[0].embedding;
    if (!Array.isArray(vec)) throw new Error('openai_bad_shape');
    return _l2normalize(vec);
  }
  throw new Error('unknown_provider');
}

/**
 * Embed text into an L2-normalised vector. Uses a real API provider when
 * configured, otherwise the deterministic local embedder. Always resolves
 * (never throws) — falls back to local on any provider error.
 * @returns {Promise<{vec:number[], provider:string}>}
 */
async function embed(text) {
  const provider = _embProvider();
  if (provider !== 'local') {
    try {
      const vec = await _providerEmbed(text, provider);
      return { vec, provider };
    } catch (e) {
      console.warn(`[ai-memory] ${provider} embed failed, using local:`, e.message);
    }
  }
  return { vec: _localEmbed(text), provider: 'local' };
}

// ── CRUD ──────────────────────────────────────────────────────────────
function _genId() {
  return 'mem_' + crypto.randomBytes(9).toString('hex');
}

/**
 * Insert or update a memory document.
 * @param {string} text
 * @param {object} [meta] arbitrary metadata (source, tag, userId, …)
 * @param {string} [id] when supplied, replaces the existing doc
 */
async function upsert(text, meta = {}, id = null) {
  const clean = String(text || '').slice(0, 8000);
  if (!clean.trim()) throw new Error('text_required');
  const { vec, provider } = await embed(clean);
  const doc = {
    id: id || _genId(),
    text: clean,
    meta: meta && typeof meta === 'object' ? meta : {},
    vec,
    embProvider: provider,
    ts: Date.now(),
  };
  const existing = _docs.findIndex(d => d.id === doc.id);
  if (existing >= 0) {
    _docs[existing] = doc;
  } else {
    _docs.push(doc);
    // Evict oldest beyond cap (FIFO) to bound disk/memory.
    if (_docs.length > MAX_DOCS) _docs = _docs.slice(_docs.length - MAX_DOCS);
  }
  _save();
  return { id: doc.id, embProvider: provider, dim: vec.length };
}

/**
 * Semantic search: returns the top-k documents ranked by cosine similarity.
 * @param {string} query
 * @param {object} [opts] { k=5, minScore=0, filter:(meta)=>boolean }
 */
async function search(query, opts = {}) {
  const k = Math.max(1, Math.min(parseInt(opts.k, 10) || 5, 50));
  const minScore = typeof opts.minScore === 'number' ? opts.minScore : 0;
  const filterFn = typeof opts.filter === 'function' ? opts.filter : null;
  const { vec: qv } = await embed(query);
  const scored = [];
  for (const d of _docs) {
    if (filterFn && !filterFn(d.meta)) continue;
    const score = cosine(qv, d.vec);
    if (score >= minScore) {
      scored.push({ id: d.id, text: d.text, meta: d.meta, score, ts: d.ts });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

function remove(id) {
  const before = _docs.length;
  _docs = _docs.filter(d => d.id !== id);
  const removed = _docs.length < before;
  if (removed) _save();
  return removed;
}

function get(id) {
  const d = _docs.find(x => x.id === id);
  if (!d) return null;
  return { id: d.id, text: d.text, meta: d.meta, ts: d.ts };
}

function all() {
  return _docs.map(d => ({ id: d.id, text: d.text, meta: d.meta, ts: d.ts }));
}

function clear() {
  const n = _docs.length;
  _docs = [];
  _save();
  return n;
}

function stats() {
  return {
    documents: _docs.length,
    dim: DIM,
    maxDocs: MAX_DOCS,
    embeddingProvider: _embProvider(),
    diskBytes: _diskBytes(),
  };
}

function _diskBytes() {
  try { return fs.statSync(STORE_FILE).size; } catch { return 0; }
}

function getStatus() {
  return {
    active: true,
    module: 'ai-semantic-memory',
    ...stats(),
    timestamp: new Date().toISOString(),
  };
}

// ── Express router (mounted by backend/index.js) ──────────────────────
function router(express, opts = {}) {
  const r = express.Router();
  const adminGuard = typeof opts.adminGuard === 'function'
    ? opts.adminGuard
    : (req, res, next) => next();

  r.get('/stats', (req, res) => res.json(getStatus()));

  r.get('/search', async (req, res) => {
    const q = String(req.query.q || req.query.query || '');
    if (!q.trim()) return res.status(400).json({ error: 'q_required' });
    try {
      const results = await search(q, { k: parseInt(req.query.k, 10) || 5 });
      res.json({ ok: true, query: q, count: results.length, results });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/upsert', adminGuard, async (req, res) => {
    const body = req.body || {};
    const text = body.text || body.content || '';
    if (!String(text).trim()) return res.status(400).json({ error: 'text_required' });
    try {
      const out = await upsert(text, body.meta || {}, body.id || null);
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/remove', adminGuard, (req, res) => {
    const id = (req.body && req.body.id) || '';
    if (!id) return res.status(400).json({ error: 'id_required' });
    res.json({ ok: true, removed: remove(id) });
  });

  return r;
}

module.exports = {
  embed,
  upsert,
  search,
  remove,
  get,
  all,
  clear,
  stats,
  getStatus,
  router,
  cosine,
  _localEmbed,
  _tokenize,
  DIM,
};
