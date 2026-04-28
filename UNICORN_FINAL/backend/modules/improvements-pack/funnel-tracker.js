// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:57.379Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/funnel-tracker.js · #18
//
// Lightweight pre-order conversion funnel:
//   stages: view → click → checkout_init → checkout_confirm → paid
//
// Events are persisted to data/funnel-events.jsonl as one event per line.
// Aggregates are computed lazily on demand (no in-process timers, no daemons).
//
// Pure additive · zero deps · safe to call from any handler.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const STAGES = ['view', 'click', 'checkout_init', 'checkout_confirm', 'paid'];
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const FUNNEL_FILE = process.env.FUNNEL_FILE || path.join(DATA_DIR, 'funnel-events.jsonl');

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(FUNNEL_FILE), { recursive: true }); } catch (_) {}
}

/** Track a single funnel event. */
function track(stage, ctx) {
  const s = String(stage || '').toLowerCase();
  if (!STAGES.includes(s)) return { ok: false, error: 'unknown_stage', stage };
  const evt = {
    ts: new Date().toISOString(),
    stage: s,
    productId: ctx && ctx.productId ? String(ctx.productId) : null,
    sessionId: ctx && ctx.sessionId ? String(ctx.sessionId) : null,
    tenantId: ctx && ctx.tenantId ? String(ctx.tenantId) : null,
    amountUsd: ctx && Number.isFinite(Number(ctx.amountUsd)) ? Number(ctx.amountUsd) : null
  };
  try {
    _ensureDir();
    fs.appendFileSync(FUNNEL_FILE, JSON.stringify(evt) + '\n', 'utf8');
  } catch (_) {}
  return { ok: true, evt };
}

function _readAll() {
  let text = '';
  try { text = fs.readFileSync(FUNNEL_FILE, 'utf8'); } catch (_) { text = ''; }
  if (!text) return [];
  const out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch (_) {}
  }
  return out;
}

/**
 * Aggregate stage counts and conversion rates over an optional time window.
 * @param {object} [opts] { sinceMs }
 */
function summary(opts) {
  const sinceMs = opts && Number.isFinite(Number(opts.sinceMs)) ? Number(opts.sinceMs) : 0;
  const cutoff = sinceMs ? (Date.now() - sinceMs) : 0;
  const events = _readAll();
  const counts = Object.fromEntries(STAGES.map(s => [s, 0]));
  for (const e of events) {
    const t = Date.parse(e.ts || '') || 0;
    if (cutoff && t < cutoff) continue;
    if (counts[e.stage] !== undefined) counts[e.stage]++;
  }
  const conv = {};
  for (let i = 1; i < STAGES.length; i++) {
    const prev = counts[STAGES[i - 1]];
    const cur = counts[STAGES[i]];
    conv[STAGES[i - 1] + '_to_' + STAGES[i]] = prev > 0 ? Number((cur / prev).toFixed(4)) : 0;
  }
  return { stages: STAGES, counts, conversion: conv, totalEvents: events.length, sinceMs };
}

module.exports = { track, summary, STAGES, FUNNEL_FILE };
