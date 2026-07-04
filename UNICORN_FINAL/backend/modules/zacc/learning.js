// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC component 8 — Self-Learning Core.
// RO: stochează toate deciziile (prețuri, oferte, produse, rezultate) într-un
// index vectorial ușor (embeddings deterministe + similaritate cosinus, fără
// dependențe externe). Săptămânal analizează ce a funcționat și ajustează
// parametrii (praguri de conversie, marje, ponderi de surse). Spec-ul menționa
// ChromaDB/SQLite-vector; aici folosim un vector-store in-memory portabil care
// poate fi înlocuit cu ChromaDB prin același API.

'use strict';

const { now, clamp, round2, logger } = require('./util');

const log = logger('learning');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const VECTOR_DIM = 32;

// Cheap, deterministic embedding: hash tokens into a fixed-dim bag, L2-normalize.
function embed(text) {
  const v = new Array(VECTOR_DIM).fill(0);
  const tokens = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const tok of tokens) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < tok.length; i++) { h ^= tok.charCodeAt(i); h = Math.imul(h, 16777619); }
    v[h % VECTOR_DIM] += 1;
  }
  let norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map(x => x / norm);
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < VECTOR_DIM; i++) dot += a[i] * b[i];
  return dot; // already normalized
}

class SelfLearningCore {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.vectors = []; // { id, kind, text, vec, payload, outcome, ts }
    this.maxVectors = 5000;
    this.lastAnalysisAt = 0;
    this.analyses = []; // weekly insights
    this.maxAnalyses = 60;
    // Tunable parameters the loop reads back.
    this.params = {
      conversionTarget: Number(process.env.ZACC_TARGET_CONVERSION || 0.02),
      minMarginPct: Number(process.env.ZACC_MIN_MARGIN_PCT || 25),
      sourceWeightBias: 1.0,
      preferSub50InEu: false,
      discountConversionLift: {},
    };
  }

  // Store a decision/outcome as a vector record.
  record(kind, text, payload, outcome) {
    const rec = {
      id: 'vec-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind, text: String(text || ''), vec: embed(text), payload: payload || {},
      outcome: outcome || null, ts: now(),
    };
    this.vectors = [rec].concat(this.vectors).slice(0, this.maxVectors);
    return rec.id;
  }

  // Nearest-neighbour query over the vector store.
  query(text, k) {
    const q = embed(text);
    return this.vectors
      .map(r => ({ r, score: cosine(q, r.vec) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k || 5)
      .map(x => ({ id: x.r.id, kind: x.r.kind, text: x.r.text, score: round2(x.score), outcome: x.r.outcome }));
  }

  dueForAnalysis() { return Date.now() - this.lastAnalysisAt >= WEEK_MS; }

  // Weekly analysis: derive what worked, adjust params. Returns the insight.
  analyze(force) {
    if (!force && !this.dueForAnalysis()) return null;
    const week = this.vectors.filter(r => Date.now() - new Date(r.ts).getTime() < WEEK_MS);
    const sales = week.filter(r => r.kind === 'sale');
    const views = week.filter(r => r.kind === 'view').length || 1;
    const conv = sales.length / views;

    const insights = [];
    // 1) Conversion-driven margin/target adjustment.
    if (conv < this.params.conversionTarget * 0.8) {
      this.params.minMarginPct = clamp(this.params.minMarginPct - 1, 15, 60);
      insights.push('Conversion below target — lowered min margin floor to ' + this.params.minMarginPct + '% to test elasticity.');
    } else if (conv > this.params.conversionTarget * 1.5) {
      this.params.minMarginPct = clamp(this.params.minMarginPct + 1, 15, 60);
      insights.push('Conversion strong — raised min margin floor to ' + this.params.minMarginPct + '% to capture value.');
    }

    // 2) Price-band insight (sub-$50 vs above), region-aware.
    const sub50 = sales.filter(s => Number(s.payload.amountUsd) < 50).length;
    if (sales.length >= 4 && sub50 / sales.length > 0.6) {
      this.params.preferSub50InEu = true;
      insights.push('Sub-$50 products dominate sales (' + Math.round((sub50 / sales.length) * 100) + '%) — biasing synthesis toward lower price bands.');
    }

    // 3) Source-weight bias from which trend sources led to sales.
    if (sales.length >= 6) {
      this.params.sourceWeightBias = clamp(this.params.sourceWeightBias * 1.02, 0.8, 1.4);
      insights.push('Enough sales signal to reinforce high-yield trend sources (bias ×' + round2(this.params.sourceWeightBias) + ').');
    }

    if (!insights.length) insights.push('Not enough signal this week — holding current parameters.');

    const analysis = {
      id: 'analysis-' + Date.now().toString(36),
      window: '7d',
      records: week.length,
      sales: sales.length,
      conversion: round2(conv),
      insights,
      params: Object.assign({}, this.params),
      at: now(),
    };
    this.analyses = [analysis].concat(this.analyses).slice(0, this.maxAnalyses);
    this.lastAnalysisAt = Date.now();
    log.info('weekly analysis:', insights[0]);
    return analysis;
  }

  status() {
    return {
      ok: true,
      store: 'in-memory-vector (cosine, dim ' + VECTOR_DIM + ')',
      vectors: this.vectors.length,
      analysesRun: this.analyses.length,
      lastAnalysisAt: this.lastAnalysisAt ? new Date(this.lastAnalysisAt).toISOString() : null,
      params: this.params,
      latestInsight: this.analyses[0] ? this.analyses[0].insights : [],
    };
  }
}

module.exports = { SelfLearningCore, embed, cosine };
