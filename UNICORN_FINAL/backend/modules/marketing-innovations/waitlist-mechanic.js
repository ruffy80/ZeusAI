// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/waitlist-mechanic.js
//
// Referral-based skip-the-line waitlist (Robinhood/Dropbox pattern).
// Each signup gets a position. Each successful referral promotes the
// referrer by `JUMP` slots and grants the new signup a join bonus.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const FILE = process.env.MARKETING_WAITLIST_FILE
  || path.join(DATA_DIR, 'waitlist.jsonl');

const DISABLED = process.env.MARKETING_WAITLIST_DISABLED === '1';
const JUMP = Math.max(1, Number(process.env.MARKETING_WAITLIST_JUMP) || 5);
const MAX = Math.max(100, Number(process.env.MARKETING_WAITLIST_MAX) || 100_000);

const _entries = new Map(); // id → {id, email, code, position, referredBy, referrals}
const _byCode = new Map();

function _ensure() { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); } catch (_) {} }
function _persist(evt) { try { _ensure(); fs.appendFileSync(FILE, JSON.stringify(evt) + '\n'); } catch (_) {} }

function _normEmail(e) { return String(e || '').trim().slice(0, 254).toLowerCase(); }

function _isValidEmail(e) {
  // Length-bounded validation without regex (avoids polynomial-redos).
  if (typeof e !== 'string') return false;
  if (e.length < 3 || e.length > 254) return false;
  const at = e.indexOf('@');
  if (at <= 0 || at !== e.lastIndexOf('@') || at >= e.length - 3) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!local || !domain) return false;
  if (local.length > 64 || domain.length > 253) return false;
  if (/\s/.test(local) || /\s/.test(domain)) return false;
  const dot = domain.lastIndexOf('.');
  if (dot <= 0 || dot >= domain.length - 1) return false;
  return true;
}

function join(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const o = opts || {};
  const email = _normEmail(o.email);
  if (!_isValidEmail(email)) return { ok: false, error: 'invalid_email' };
  if (_entries.size >= MAX) return { ok: false, error: 'waitlist_full' };
  const existing = Array.from(_entries.values()).find((e) => e.email === email);
  if (existing) return { ok: true, entry: existing, duplicate: true };

  const id = 'WL-' + crypto.randomBytes(4).toString('hex');
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const referredBy = o.referredByCode ? _byCode.get(String(o.referredByCode).toUpperCase()) || null : null;
  const entry = {
    id, email, code,
    position: _entries.size + 1,
    referredBy: referredBy ? referredBy.id : null,
    referrals: 0,
    createdAt: new Date().toISOString(),
  };
  _entries.set(id, entry);
  _byCode.set(code, entry);
  _persist({ type: 'join', entry });

  if (referredBy) {
    referredBy.referrals = (referredBy.referrals || 0) + 1;
    referredBy.position = Math.max(1, (referredBy.position || 1) - JUMP);
    _persist({ type: 'jump', referrer: referredBy.id, by: JUMP });
  }
  return { ok: true, entry };
}

function lookup(code) {
  const c = String(code || '').toUpperCase();
  const e = _byCode.get(c);
  return e ? { ok: true, entry: { ...e } } : { ok: false, error: 'not_found' };
}

function leaderboard(limit) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 50));
  return Array.from(_entries.values())
    .sort((a, b) => (b.referrals || 0) - (a.referrals || 0))
    .slice(0, lim)
    .map((e) => ({ id: e.id, code: e.code, position: e.position, referrals: e.referrals }));
}

function summary() {
  return {
    disabled: DISABLED,
    total: _entries.size,
    referralJumpSlots: JUMP,
    capacity: MAX,
    topReferrals: leaderboard(5),
  };
}

function _resetForTests() { _entries.clear(); _byCode.clear(); }

module.exports = { join, lookup, leaderboard, summary, _resetForTests };
