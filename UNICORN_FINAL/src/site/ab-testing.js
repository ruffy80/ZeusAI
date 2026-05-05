/**
 * C3 — A/B testing layer (sticky cohort, cookie-based, additive).
 *
 * Sticky bucket per visitor via cookie `uc_ab` (random 16-byte hex, 30d).
 * Variant assignment: hash(cookie + experimentId) % buckets.
 * Events logged append-only to data/marketing/ab-events.jsonl.
 *
 * Welch's t-test for revenue lift: pure JS, no scipy, no npm dep.
 *
 * Forward-only: existing pages render exactly the same when no
 * experiment is registered. Cookie is set only if a request hits an
 * experiment route — silent for the rest of the site.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.AB_DATA_DIR || path.join(process.cwd(), 'data', 'marketing');
const EVENTS_FILE = path.join(DATA_DIR, 'ab-events.jsonl');
const EXPERIMENTS = new Map(); // expId -> { id, variants, metric, createdAt }

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o755 }); } catch (_) {}
}

function _hash(s) {
  return crypto.createHash('sha256').update(s).digest();
}

function _getOrSetCookie(req, res) {
  const cookieHeader = String(req.headers.cookie || '');
  const m = cookieHeader.match(/(?:^|;\s*)uc_ab=([a-f0-9]{32})/);
  if (m) return m[1];
  const newId = crypto.randomBytes(16).toString('hex');
  // 30 days, HttpOnly off (we want client JS readable for analytics), Secure, SameSite=Lax.
  const cookie = `uc_ab=${newId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax; Secure`;
  // Append to existing Set-Cookie if present.
  const prev = res.getHeader('Set-Cookie');
  if (prev) {
    res.setHeader('Set-Cookie', Array.isArray(prev) ? [...prev, cookie] : [prev, cookie]);
  } else {
    res.setHeader('Set-Cookie', cookie);
  }
  return newId;
}

function registerExperiment({ id, variants, metric }) {
  if (!id) throw new Error('experiment id required');
  const v = Array.isArray(variants) && variants.length >= 2 ? variants : ['control', 'treatment'];
  EXPERIMENTS.set(id, {
    id,
    variants: v,
    metric: metric || 'revenue',
    createdAt: new Date().toISOString(),
  });
  return EXPERIMENTS.get(id);
}

function listExperiments() {
  return Array.from(EXPERIMENTS.values());
}

function assign(req, res, experimentId) {
  const exp = EXPERIMENTS.get(experimentId);
  if (!exp) return null;
  const cohort = _getOrSetCookie(req, res);
  const h = _hash(cohort + ':' + experimentId);
  const bucket = h.readUInt32BE(0) % exp.variants.length;
  const variant = exp.variants[bucket];
  return { experimentId, variant, cohort };
}

function logEvent({ experimentId, variant, cohort, event, value }) {
  if (!experimentId || !variant || !event) return false;
  _ensureDir();
  const rec = {
    expId: experimentId,
    variant,
    cohort: cohort || null,
    event,
    value: typeof value === 'number' ? value : 0,
    ts: new Date().toISOString(),
  };
  try {
    fs.appendFileSync(EVENTS_FILE, JSON.stringify(rec) + '\n', 'utf8');
    return true;
  } catch (_) { return false; }
}

// Welch's t-test (two independent samples, unequal variance).
// Returns { mean1, mean2, lift, t, df, pApprox }.
function welchT(s1, s2) {
  const n1 = s1.length, n2 = s2.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = s1.reduce((a, b) => a + b, 0) / n1;
  const m2 = s2.reduce((a, b) => a + b, 0) / n2;
  const v1 = s1.reduce((a, b) => a + (b - m1) ** 2, 0) / (n1 - 1);
  const v2 = s2.reduce((a, b) => a + (b - m2) ** 2, 0) / (n2 - 1);
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  if (se === 0) return { mean1: m1, mean2: m2, lift: 0, t: 0, df: 0, pApprox: 1 };
  const t = (m2 - m1) / se;
  const df = (v1 / n1 + v2 / n2) ** 2 /
    ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  // Two-tailed p-value approximation via normal CDF for df>30; otherwise crude.
  const z = Math.abs(t);
  const pApprox = 2 * (1 - _normCdf(z));
  return { mean1: m1, mean2: m2, lift: m1 ? (m2 - m1) / m1 : 0, t, df, pApprox };
}

function _normCdf(x) {
  // Abramowitz & Stegun 7.1.26 approximation — good to 7e-8.
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function report(experimentId) {
  if (!fs.existsSync(EVENTS_FILE)) return { experimentId, variants: [] };
  const exp = EXPERIMENTS.get(experimentId);
  if (!exp) return { experimentId, variants: [] };
  const lines = fs.readFileSync(EVENTS_FILE, 'utf8').split('\n').filter(Boolean);
  const byVariant = {};
  for (const v of exp.variants) byVariant[v] = { exposures: 0, events: {}, values: [] };
  for (const line of lines) {
    let rec; try { rec = JSON.parse(line); } catch (_) { continue; }
    if (rec.expId !== experimentId) continue;
    if (!byVariant[rec.variant]) continue;
    if (rec.event === 'exposure') byVariant[rec.variant].exposures += 1;
    byVariant[rec.variant].events[rec.event] = (byVariant[rec.variant].events[rec.event] || 0) + 1;
    if (typeof rec.value === 'number' && rec.value > 0) byVariant[rec.variant].values.push(rec.value);
  }
  const variants = exp.variants.map(v => ({
    variant: v,
    exposures: byVariant[v].exposures,
    events: byVariant[v].events,
    revenue: byVariant[v].values.reduce((a, b) => a + b, 0),
    avgValue: byVariant[v].values.length ? byVariant[v].values.reduce((a, b) => a + b, 0) / byVariant[v].values.length : 0,
  }));
  // Pairwise welch test (control vs treatment[0]).
  let stats = null;
  if (exp.variants.length >= 2) {
    const v0 = byVariant[exp.variants[0]].values;
    const v1 = byVariant[exp.variants[1]].values;
    stats = welchT(v0, v1);
  }
  return { experimentId, metric: exp.metric, variants, stats };
}

module.exports = { registerExperiment, listExperiments, assign, logEvent, report };
