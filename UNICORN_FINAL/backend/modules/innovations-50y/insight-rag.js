// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.365Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * insight-rag.js — Innovations 50Y · Pillar IV
 *
 * Lightweight retrieval over guardian / audit JSONL logs using BM25 (Robertson
 * & Spärck-Jones, 1976). ZERO required dependencies: no embeddings model, no
 * SQLite extension, no network. The corpus is rebuilt on demand by tailing
 * the last N lines of any JSONL log file in UNICORN_FINAL/data/.
 *
 * BM25 has been the industry-standard sparse retrieval ranking for ~50 years
 * and remains competitive with neural retrievers on log/incident search.
 *
 * Pure additive: read-only over existing logs. The audit log written by
 * tamper-evident-audit.js is also a valid input.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');

const STOP = new Set(('the a an and or of to for in on at by is are was were be been being it this that with as from not no yes ok')
  .split(/\s+/));

function _tokenize(text) {
  return String(text || '').toLowerCase()
    .replace(/[^a-z0-9_\-/.]+/g, ' ')
    .split(/\s+/).filter(t => t && t.length >= 2 && t.length <= 64 && !STOP.has(t));
}

function _readJsonlTail(file, maxLines) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    return lines.slice(-maxLines);
  } catch (_) { return []; }
}

function _candidateFiles() {
  const out = [];
  try {
    if (!fs.existsSync(DATA_DIR)) return out;
    const walk = (dir, depth) => {
      if (depth > 3) return;
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, depth + 1);
        else if (e.isFile() && /\.jsonl$/.test(e.name)) out.push(p);
      }
    };
    walk(DATA_DIR, 0);
  } catch (_) {}
  return out;
}

function _buildCorpus(opts) {
  const o = opts || {};
  const maxPerFile = Number(o.maxPerFile) || 2000;
  const files = (o.files && o.files.length) ? o.files : _candidateFiles();
  const docs = [];
  for (const file of files) {
    const lines = _readJsonlTail(file, maxPerFile);
    for (let i = 0; i < lines.length; i++) {
      let parsed = null;
      try { parsed = JSON.parse(lines[i]); } catch (_) { parsed = { raw: lines[i] }; }
      const text = JSON.stringify(parsed);
      docs.push({
        file: path.relative(DATA_DIR, file),
        ts: parsed && parsed.ts ? parsed.ts : null,
        record: parsed,
        text,
        tokens: _tokenize(text)
      });
    }
  }
  return docs;
}

function _bm25Rank(docs, query, opts) {
  const k1 = (opts && opts.k1) || 1.5;
  const b = (opts && opts.b) || 0.75;
  const qTokens = _tokenize(query);
  if (!qTokens.length || !docs.length) return [];
  const N = docs.length;
  // Document frequencies
  const df = Object.create(null);
  let totalLen = 0;
  for (const d of docs) {
    totalLen += d.tokens.length;
    const seen = new Set();
    for (const t of d.tokens) {
      if (seen.has(t)) continue;
      seen.add(t);
      df[t] = (df[t] || 0) + 1;
    }
  }
  const avgdl = totalLen / N;
  const scores = new Array(N).fill(0);
  for (const t of qTokens) {
    const n = df[t] || 0;
    if (!n) continue;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    for (let i = 0; i < N; i++) {
      const d = docs[i];
      let f = 0;
      for (const tk of d.tokens) if (tk === t) f++;
      if (!f) continue;
      const dl = d.tokens.length || 1;
      const tf = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgdl)));
      scores[i] += idf * tf;
    }
  }
  const ranked = [];
  for (let i = 0; i < N; i++) if (scores[i] > 0) ranked.push({ idx: i, score: scores[i] });
  ranked.sort((a, b2) => b2.score - a.score);
  return ranked;
}

/**
 * Ask a natural-language question over JSONL logs in data/.
 * @returns { query, hits: [{score, file, ts, snippet, record}], total, evaluatedDocs }
 */
function ask(query, opts) {
  const o = opts || {};
  const limit = Math.max(1, Math.min(Number(o.limit) || 10, 50));
  const docs = _buildCorpus(o);
  const ranked = _bm25Rank(docs, query, o).slice(0, limit);
  return {
    query: String(query || ''),
    standardsRef: ['BM25-Okapi-1976', 'IETF-RFC-7159-JSON'],
    evaluatedDocs: docs.length,
    total: ranked.length,
    hits: ranked.map(r => {
      const d = docs[r.idx];
      const snippet = d.text.length > 240 ? d.text.slice(0, 240) + '…' : d.text;
      return { score: Number(r.score.toFixed(4)), file: d.file, ts: d.ts, snippet, record: d.record };
    })
  };
}

function status() {
  const files = _candidateFiles();
  return {
    indexable: files.length,
    files: files.map(f => path.relative(DATA_DIR, f)),
    algorithm: 'bm25-okapi',
    standardsRef: ['BM25-Okapi-1976']
  };
}

module.exports = { ask, status };
