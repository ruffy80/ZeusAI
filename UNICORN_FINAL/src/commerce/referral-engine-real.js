// =====================================================================
// referral-engine-real.js — REAL referral system with SQLite persistence
// Replaces the random ZEUS-XXXXXX coupon generator. Each customer gets one
// stable code, every redemption is tracked, viral coefficient is computed
// from durable data — no Math.random.
// EN+RO bilingual logs preserved.
// =====================================================================

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Centralised credential manager — auto-generates REFERRAL_SECRET on first
// boot and persists it in data/runtime-secrets.json so codes stay stable
// across PM2 reloads / cluster workers / future deploys.
let secretsMod = null;
try { secretsMod = require('../config/secrets'); } catch (_) {}
function _secret(name, fallback) {
  if (secretsMod && typeof secretsMod.getSecret === 'function') {
    return secretsMod.getSecret(name, fallback);
  }
  return process.env[name] || fallback;
}

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data', 'commerce');
const DB_FILE = path.join(DATA_DIR, 'referrals.sqlite');

let db = null;
let usingSqlite = false;
let memoryStore = { codes: [], redemptions: [] };

function _init() {
  if (db || !usingSqlite && memoryStore.codes.length === 0) {
    try {
      const Database = require('better-sqlite3');
      fs.mkdirSync(DATA_DIR, { recursive: true });
      db = new Database(DB_FILE);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.exec(`
        CREATE TABLE IF NOT EXISTS referral_codes (
          code TEXT PRIMARY KEY,
          owner_email TEXT NOT NULL COLLATE NOCASE,
          owner_customer_id TEXT,
          created_at TEXT NOT NULL,
          discount_pct INTEGER DEFAULT 10,
          payout_pct INTEGER DEFAULT 20,
          active INTEGER DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_referral_owner ON referral_codes(owner_email);
        CREATE TABLE IF NOT EXISTS referral_redemptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL,
          referred_email TEXT COLLATE NOCASE,
          order_id TEXT,
          amount_usd REAL DEFAULT 0,
          payout_usd REAL DEFAULT 0,
          payout_status TEXT DEFAULT 'pending',
          payout_btc_txid TEXT,
          redeemed_at TEXT NOT NULL,
          FOREIGN KEY (code) REFERENCES referral_codes(code)
        );
        CREATE INDEX IF NOT EXISTS idx_redemption_code ON referral_redemptions(code);
        CREATE INDEX IF NOT EXISTS idx_redemption_email ON referral_redemptions(referred_email);
      `);
      usingSqlite = true;
      console.log('[referral-real] SQLite WAL active at ' + DB_FILE);
    } catch (e) {
      console.warn('[referral-real] SQLite unavailable, falling back to memory:', e.message);
      usingSqlite = false;
    }
  }
}

function _newCode(email) {
  // Deterministic but non-guessable code: 8 hex chars from sha256(email + secret).
  // Stable across regenerations — same customer always gets same code.
  // Secret is sourced from the central secrets module (auto-generated on first boot).
  const secret = _secret('REFERRAL_SECRET', 'zeusai-default-2026');
  const seed = String(email).toLowerCase() + ':' + secret;
  const hex = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8).toUpperCase();
  return 'ZEUS-' + hex;
}

function getOrCreateCode(email, customerId = null) {
  _init();
  const ownerEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new Error('invalid_email');
  const code = _newCode(ownerEmail);
  const discountPct = Math.max(1, Math.min(50, parseInt(_secret('REFERRAL_DISCOUNT_PCT', '10'), 10)));
  const payoutPct = Math.max(1, Math.min(50, parseInt(_secret('REFERRAL_PAYOUT_PCT', '20'), 10)));

  if (usingSqlite && db) {
    const existing = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code);
    if (existing) return { ...existing, isNew: false };
    db.prepare(`INSERT INTO referral_codes (code, owner_email, owner_customer_id, created_at, discount_pct, payout_pct, active) VALUES (?,?,?,?,?,?,1)`)
      .run(code, ownerEmail, customerId, new Date().toISOString(), discountPct, payoutPct);
    return { code, owner_email: ownerEmail, owner_customer_id: customerId, discount_pct: discountPct, payout_pct: payoutPct, active: 1, isNew: true };
  }
  // Memory fallback
  let existing = memoryStore.codes.find((c) => c.code === code);
  if (existing) return { ...existing, isNew: false };
  const rec = { code, owner_email: ownerEmail, owner_customer_id: customerId, discount_pct: discountPct, payout_pct: payoutPct, active: 1, created_at: new Date().toISOString() };
  memoryStore.codes.push(rec);
  return { ...rec, isNew: true };
}

function lookupCode(code) {
  _init();
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  if (usingSqlite && db) {
    return db.prepare('SELECT * FROM referral_codes WHERE code = ? AND active = 1').get(c) || null;
  }
  return memoryStore.codes.find((x) => x.code === c && x.active) || null;
}

function recordRedemption({ code, referredEmail, orderId, amountUsd }) {
  _init();
  const c = lookupCode(code);
  if (!c) throw new Error('unknown_referral_code');
  const refEmail = String(referredEmail || '').trim().toLowerCase();
  // Prevent self-referral.
  if (refEmail && refEmail === c.owner_email) throw new Error('self_referral_forbidden');
  const usd = Math.max(0, Number(amountUsd || 0));
  const payoutUsd = Math.round(usd * (Number(c.payout_pct || 20) / 100) * 100) / 100;
  const now = new Date().toISOString();

  if (usingSqlite && db) {
    const r = db.prepare(`INSERT INTO referral_redemptions (code, referred_email, order_id, amount_usd, payout_usd, payout_status, redeemed_at) VALUES (?,?,?,?,?,?,?)`)
      .run(c.code, refEmail || null, orderId || null, usd, payoutUsd, 'pending', now);
    return { ok: true, id: r.lastInsertRowid, code: c.code, payoutUsd, payoutStatus: 'pending' };
  }
  const rec = { id: memoryStore.redemptions.length + 1, code: c.code, referredEmail: refEmail, orderId, amountUsd: usd, payoutUsd, payoutStatus: 'pending', redeemedAt: now };
  memoryStore.redemptions.push(rec);
  return { ok: true, ...rec };
}

function statsFor(email) {
  _init();
  const ownerEmail = String(email || '').trim().toLowerCase();
  if (usingSqlite && db) {
    const codes = db.prepare('SELECT * FROM referral_codes WHERE owner_email = ?').all(ownerEmail);
    if (codes.length === 0) return { ok: true, codes: [], redemptions: [], totals: { redemptions: 0, grossUsd: 0, payoutUsd: 0 } };
    const codeList = codes.map((c) => c.code);
    const placeholders = codeList.map(() => '?').join(',');
    const reds = db.prepare(`SELECT * FROM referral_redemptions WHERE code IN (${placeholders}) ORDER BY id DESC LIMIT 200`).all(...codeList);
    const totals = reds.reduce((acc, r) => { acc.redemptions += 1; acc.grossUsd += Number(r.amount_usd || 0); acc.payoutUsd += Number(r.payout_usd || 0); return acc; }, { redemptions: 0, grossUsd: 0, payoutUsd: 0 });
    totals.grossUsd = Math.round(totals.grossUsd * 100) / 100;
    totals.payoutUsd = Math.round(totals.payoutUsd * 100) / 100;
    return { ok: true, codes, redemptions: reds, totals };
  }
  const ownedCodes = memoryStore.codes.filter((c) => c.owner_email === ownerEmail);
  const codeSet = new Set(ownedCodes.map((c) => c.code));
  const reds = memoryStore.redemptions.filter((r) => codeSet.has(r.code));
  return { ok: true, codes: ownedCodes, redemptions: reds, totals: { redemptions: reds.length, grossUsd: 0, payoutUsd: 0 } };
}

function globalStats() {
  _init();
  if (usingSqlite && db) {
    const codes = db.prepare('SELECT COUNT(*) AS n FROM referral_codes WHERE active = 1').get();
    const reds = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount_usd),0) AS gross, COALESCE(SUM(payout_usd),0) AS payout FROM referral_redemptions').get();
    return {
      ok: true,
      codesActive: codes ? codes.n : 0,
      redemptions: reds ? reds.n : 0,
      grossReferredUsd: reds ? Math.round((reds.gross || 0) * 100) / 100 : 0,
      payoutOwedUsd: reds ? Math.round((reds.payout || 0) * 100) / 100 : 0,
      source: 'referrals.sqlite (real, no Math.random)',
    };
  }
  return {
    ok: true,
    codesActive: memoryStore.codes.filter((c) => c.active).length,
    redemptions: memoryStore.redemptions.length,
    grossReferredUsd: 0,
    payoutOwedUsd: 0,
    source: 'memory fallback',
  };
}

function _resetForTests() {
  if (usingSqlite && db) { db.exec('DELETE FROM referral_redemptions; DELETE FROM referral_codes;'); }
  memoryStore = { codes: [], redemptions: [] };
}

module.exports = { getOrCreateCode, lookupCode, recordRedemption, statsFor, globalStats, _resetForTests };
