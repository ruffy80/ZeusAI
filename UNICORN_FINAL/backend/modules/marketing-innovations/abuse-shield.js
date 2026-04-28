// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/abuse-shield.js
//
// Detection of self-referral, click-farm and bot-ring patterns. Pure
// in-memory tracking with sliding window. Produces a per-key risk
// score 0..1; the dispatcher (or affiliate-revenue) can treat conv-
// versions with risk > THRESHOLD as suspect.
// =====================================================================

'use strict';

const crypto = require('crypto');

const DISABLED = process.env.MARKETING_ABUSE_SHIELD_DISABLED === '1';
const WINDOW_MS = Math.max(60_000, Number(process.env.MARKETING_ABUSE_WINDOW_MS) || 24 * 3600_000);
const SELF_THRESHOLD = Number(process.env.MARKETING_ABUSE_SELF_THRESHOLD || 0.5);

const _events = []; // {ts, code, ip, ua, fp, kind}
const _suspects = new Map();

function _now() { return Date.now(); }
function _gc() {
  const cutoff = _now() - WINDOW_MS;
  while (_events.length && _events[0].ts < cutoff) _events.shift();
}

function _fingerprint(opts) {
  const ip = String(opts.ip || '0.0.0.0');
  const ua = String(opts.ua || 'unknown');
  return crypto.createHash('sha256').update(ip + '|' + ua).digest('hex').slice(0, 16);
}

/**
 * Record an event.
 *  evt = {kind: 'click'|'conversion', code?, ip?, ua?, signupIp?, signupUa?}
 */
function record(evt) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const e = evt || {};
  _gc();
  const ev = {
    ts: _now(),
    kind: String(e.kind || 'click'),
    code: e.code || null,
    ip: e.ip || null,
    ua: e.ua || null,
    fp: _fingerprint({ ip: e.ip, ua: e.ua }),
    signupFp: e.signupIp || e.signupUa ? _fingerprint({ ip: e.signupIp, ua: e.signupUa }) : null,
  };
  _events.push(ev);

  // Self-referral: same fingerprint signs up via own affiliate link.
  if (ev.kind === 'conversion' && ev.signupFp && ev.signupFp === ev.fp) {
    _suspects.set(ev.fp, (_suspects.get(ev.fp) || 0) + 1);
    return { ok: true, suspect: true, reason: 'self_referral', fp: ev.fp };
  }
  return { ok: true, suspect: false };
}

/**
 * Compute risk for a code (or fingerprint) based on the recent window.
 * Heuristics:
 *   - many clicks from the exact same fp = bot/farm
 *   - very high click volume in short time
 *   - any self-referral in window = elevated risk
 */
function risk(opts) {
  if (DISABLED) return { score: 0, reasons: ['disabled'] };
  _gc();
  const o = opts || {};
  const code = o.code || null;
  const fp = o.fp || (o.ip || o.ua ? _fingerprint(o) : null);
  const set = _events.filter((e) => (!code || e.code === code) && (!fp || e.fp === fp));
  if (!set.length) return { score: 0, reasons: ['no_events'] };

  const fpCounts = new Map();
  let conversions = 0;
  let selfRefs = 0;
  for (const e of set) {
    fpCounts.set(e.fp, (fpCounts.get(e.fp) || 0) + 1);
    if (e.kind === 'conversion') conversions += 1;
    if (e.signupFp && e.signupFp === e.fp) selfRefs += 1;
  }
  const total = set.length;
  const topFp = Math.max(...fpCounts.values());
  const concentration = topFp / total; // 1.0 = all from same fp
  const burstiness = Math.min(1, total / 200); // 200+ events in window
  const selfRefRate = selfRefs / Math.max(1, conversions);

  let score = 0;
  const reasons = [];
  if (concentration > 0.8 && total >= 10) { score += 0.45; reasons.push('high_fp_concentration'); }
  if (burstiness > 0.5) { score += 0.25; reasons.push('high_volume'); }
  if (selfRefRate > SELF_THRESHOLD) { score += 0.5; reasons.push('self_referral'); }
  score = Math.min(1, score);
  return { score, reasons, total, concentration, conversions, selfRefs };
}

function status() {
  _gc();
  return {
    disabled: DISABLED,
    windowMs: WINDOW_MS,
    events: _events.length,
    suspects: _suspects.size,
    selfThreshold: SELF_THRESHOLD,
  };
}

function _resetForTests() { _events.length = 0; _suspects.clear(); }

module.exports = { record, risk, status, _fingerprint, _resetForTests };
