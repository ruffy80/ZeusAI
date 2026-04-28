// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/attribution.js
//
// Multi-touch attribution + LTV/CAC + viral coefficient (k-factor).
//
// Models:
//   - first_touch     : 100% credit to first channel
//   - last_touch      : 100% credit to last channel before conversion
//   - linear          : equal split across all touches
//   - time_decay      : exponential decay weighted by recency (half-life cfg)
//   - position        : 40% first, 40% last, 20% split among middle (U-shape)
//
// State is in-memory; events also appended to JSONL for durability.
// Pure additive · zero deps.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const TOUCH_FILE = process.env.MARKETING_TOUCH_FILE || path.join(DATA_DIR, 'touchpoints.jsonl');

const _sessions = new Map(); // sessionId → array<touch>
const _conversions = []; // {sessionId, value, ts, channel?}

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(TOUCH_FILE), { recursive: true }); } catch (_) {}
}

function _persist(evt) {
  try {
    _ensureDir();
    fs.appendFileSync(TOUCH_FILE, JSON.stringify(evt) + '\n');
  } catch (_) {}
}

/** Record a touchpoint. */
function recordTouch(opts) {
  const o = opts || {};
  const sessionId = String(o.sessionId || '').slice(0, 128);
  if (!sessionId) return { ok: false, error: 'sessionId_required' };
  const ts = o.ts ? new Date(o.ts).toISOString() : new Date().toISOString();
  const touch = {
    sessionId,
    channel: String(o.channel || 'direct').slice(0, 64),
    campaign: String(o.campaign || '').slice(0, 64) || null,
    medium: String(o.medium || '').slice(0, 32) || null,
    source: String(o.source || '').slice(0, 64) || null,
    ts,
  };
  if (!_sessions.has(sessionId)) _sessions.set(sessionId, []);
  _sessions.get(sessionId).push(touch);
  _persist({ type: 'touch', ...touch });
  return { ok: true, touch };
}

/** Record a conversion. Returns attribution under all models. */
function recordConversion(opts) {
  const o = opts || {};
  const sessionId = String(o.sessionId || '').slice(0, 128);
  if (!sessionId) return { ok: false, error: 'sessionId_required' };
  const value = Math.max(0, Number(o.value || o.amountUsd || 0));
  const ts = o.ts ? new Date(o.ts).toISOString() : new Date().toISOString();
  const conv = { sessionId, value, ts };
  _conversions.push(conv);
  _persist({ type: 'conversion', ...conv });
  return { ok: true, conversion: conv, attribution: attributeOne(sessionId, value) };
}

function _models() { return ['first_touch', 'last_touch', 'linear', 'time_decay', 'position']; }

/** Compute weights for a list of touches under all models. */
function _weights(touches, conversionTs, halfLifeMs) {
  const n = touches.length;
  if (!n) return {};
  const weights = {
    first_touch: new Array(n).fill(0),
    last_touch:  new Array(n).fill(0),
    linear:      new Array(n).fill(1 / n),
    time_decay:  new Array(n).fill(0),
    position:    new Array(n).fill(0),
  };
  weights.first_touch[0] = 1;
  weights.last_touch[n - 1] = 1;

  const hl = Math.max(60_000, halfLifeMs || 7 * 24 * 3600 * 1000);
  const tConv = new Date(conversionTs).getTime();
  let sumDecay = 0;
  const decay = touches.map((t) => {
    const dt = Math.max(0, tConv - new Date(t.ts).getTime());
    return Math.pow(0.5, dt / hl);
  });
  for (const w of decay) sumDecay += w;
  for (let i = 0; i < n; i++) weights.time_decay[i] = sumDecay > 0 ? decay[i] / sumDecay : 1 / n;

  if (n === 1) { weights.position[0] = 1; }
  else if (n === 2) { weights.position[0] = 0.5; weights.position[1] = 0.5; }
  else {
    weights.position[0] = 0.4;
    weights.position[n - 1] = 0.4;
    const mid = 0.2 / (n - 2);
    for (let i = 1; i < n - 1; i++) weights.position[i] = mid;
  }
  return weights;
}

/** Per-session attribution. */
function attributeOne(sessionId, value, opts) {
  const touches = _sessions.get(String(sessionId)) || [];
  if (!touches.length) return { sessionId, models: {}, touches: [] };
  const conversionTs = (opts && opts.conversionTs) || new Date().toISOString();
  const halfLife = (opts && opts.halfLifeMs) || undefined;
  const w = _weights(touches, conversionTs, halfLife);
  const models = {};
  for (const m of _models()) {
    const dist = {};
    for (let i = 0; i < touches.length; i++) {
      const ch = touches[i].channel;
      dist[ch] = (dist[ch] || 0) + (w[m][i] * value);
    }
    models[m] = dist;
  }
  return { sessionId, value, touches, models };
}

/** Aggregate attribution across all conversions for a single model. */
function summary(opts) {
  const o = opts || {};
  const model = _models().includes(o.model) ? o.model : 'time_decay';
  const halfLife = o.halfLifeMs;
  const sinceMs = Number(o.sinceMs) || 0;
  const channels = {};
  let totalValue = 0;
  let convCount = 0;
  for (const c of _conversions) {
    if (sinceMs && new Date(c.ts).getTime() < sinceMs) continue;
    const a = attributeOne(c.sessionId, c.value, { conversionTs: c.ts, halfLifeMs: halfLife });
    const dist = (a.models && a.models[model]) || {};
    for (const ch of Object.keys(dist)) channels[ch] = (channels[ch] || 0) + dist[ch];
    totalValue += c.value;
    convCount += 1;
  }
  const ranked = Object.keys(channels)
    .map((ch) => ({ channel: ch, attributedRevenue: channels[ch], share: totalValue > 0 ? channels[ch] / totalValue : 0 }))
    .sort((a, b) => b.attributedRevenue - a.attributedRevenue);
  return {
    model,
    conversions: convCount,
    totalValue,
    channels: ranked,
    availableModels: _models(),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * LTV/CAC calculator.
 *  - LTV = ARPA * grossMargin * (1 / monthlyChurn)
 *  - CAC = totalSpend / customersAcquired
 *  - paybackMonths = CAC / (ARPA * grossMargin)
 */
function ltvCac(opts) {
  const o = opts || {};
  const arpaMonthly = Math.max(0, Number(o.arpaMonthly || 0));
  const grossMargin = Math.min(1, Math.max(0, Number(o.grossMargin == null ? 0.8 : o.grossMargin)));
  const monthlyChurn = Math.max(0.001, Math.min(1, Number(o.monthlyChurn || 0.03)));
  const totalSpend = Math.max(0, Number(o.totalSpend || 0));
  const customersAcquired = Math.max(0, Number(o.customersAcquired || 0));
  const ltv = arpaMonthly * grossMargin * (1 / monthlyChurn);
  const cac = customersAcquired > 0 ? totalSpend / customersAcquired : 0;
  const paybackMonths = (arpaMonthly * grossMargin) > 0 ? cac / (arpaMonthly * grossMargin) : null;
  const ratio = cac > 0 ? ltv / cac : null;
  let verdict = 'unknown';
  if (ratio != null) {
    if (ratio >= 3) verdict = 'healthy';
    else if (ratio >= 1.5) verdict = 'borderline';
    else verdict = 'unsustainable';
  }
  return {
    inputs: { arpaMonthly, grossMargin, monthlyChurn, totalSpend, customersAcquired },
    ltv, cac, paybackMonths, ratio, verdict,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Viral coefficient (k-factor) from referral metrics.
 *  k = invitesPerUser * conversionRate
 *  selfSustaining when k >= 1
 */
function kFactor(opts) {
  const o = opts || {};
  const users = Math.max(1, Number(o.users || 1));
  const invitesSent = Math.max(0, Number(o.invitesSent || 0));
  const invitesAccepted = Math.max(0, Number(o.invitesAccepted || 0));
  const invitesPerUser = invitesSent / users;
  const conversionRate = invitesSent > 0 ? invitesAccepted / invitesSent : 0;
  const k = invitesPerUser * conversionRate;
  const cycleDays = Math.max(0.1, Number(o.cycleDays || 7));
  // 90-day projection assuming geometric growth.
  const cycles = 90 / cycleDays;
  let projected;
  if (Math.abs(k - 1) < 1e-9) projected = users * (1 + cycles);
  else projected = users * (Math.pow(k, cycles + 1) - 1) / (k - 1);
  return {
    users, invitesSent, invitesAccepted,
    invitesPerUser, conversionRate, kFactor: k,
    selfSustaining: k >= 1,
    projected90d: Math.round(projected),
    generatedAt: new Date().toISOString(),
  };
}

function _resetForTests() {
  _sessions.clear();
  _conversions.length = 0;
}

module.exports = {
  recordTouch,
  recordConversion,
  attributeOne,
  summary,
  ltvCac,
  kFactor,
  _resetForTests,
};
