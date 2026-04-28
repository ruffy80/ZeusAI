// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/engagement-bot.js
//
// Auto-engagement layer: drafts replies/likes for incoming mentions or
// DMs, scored by the existing outreach-sentiment engine. Negative-
// sentiment items are escalated (status='escalate_owner') instead of
// being auto-replied — never antagonize.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const outreach = require('./outreach-sentiment');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const LEDGER = process.env.MARKETING_ENGAGEMENT_LEDGER
  || path.join(DATA_DIR, 'engagement-ledger.jsonl');

const DISABLED = process.env.MARKETING_ENGAGEMENT_DISABLED === '1';
const NEG_THRESHOLD = Number(process.env.MARKETING_ENGAGEMENT_NEG_THRESHOLD || -0.3);
const _whitelist = new Set();
const _blacklist = new Set();

function _ensure() { try { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); } catch (_) {} }
function _persist(evt) { try { _ensure(); fs.appendFileSync(LEDGER, JSON.stringify(evt) + '\n'); } catch (_) {} }

const POSITIVE_REPLIES = [
  'Mulțumim mult! 💜 We are building this every day — orice feedback contează.',
  'Glad you noticed — there is much more coming. Stay tuned!',
  'Thank you — that means a lot. Let us know what feature would help most.',
  'Apreciem mult susținerea! Dacă ai idei, ne găsești pe DM oricând.',
];
const NEUTRAL_REPLIES = [
  'Thanks for reaching out — happy to help. Care to share more details?',
  'Salut! Spune-ne mai multe ca să-ți răspundem cât mai precis.',
  'Got it — what is the exact context? We will look into it.',
];

function _pick(arr, seed) {
  const h = crypto.createHash('sha256').update(String(seed || '')).digest();
  return arr[h[0] % arr.length];
}

function isWhitelisted(actor) { return _whitelist.has(String(actor || '').toLowerCase()); }
function isBlacklisted(actor) { return _blacklist.has(String(actor || '').toLowerCase()); }
function whitelist(actor) { _whitelist.add(String(actor || '').toLowerCase()); return { ok: true }; }
function blacklist(actor) { _blacklist.add(String(actor || '').toLowerCase()); return { ok: true }; }

/**
 * Process a single inbound interaction.
 *   inbound = { platform, actor, text, kind?: 'mention'|'dm'|'comment' }
 */
function processInbound(inbound) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const i = inbound || {};
  const actor = String(i.actor || 'unknown').toLowerCase();
  if (isBlacklisted(actor)) {
    const evt = { ts: new Date().toISOString(), action: 'ignore_blacklist', actor };
    _persist(evt);
    return { ok: true, action: 'ignore', reason: 'blacklist' };
  }
  const sent = outreach.score(i.text || '');
  const score = Number(sent && sent.score) || 0;

  let reply, action;
  if (score < NEG_THRESHOLD) {
    action = 'escalate_owner';
    reply = null;
  } else if (score > 0.2) {
    action = 'auto_reply_positive';
    reply = _pick(POSITIVE_REPLIES, actor + ':' + (i.text || ''));
  } else {
    action = 'auto_reply_neutral';
    reply = _pick(NEUTRAL_REPLIES, actor + ':' + (i.text || ''));
  }

  const id = 'ENG-' + crypto.randomBytes(4).toString('hex');
  const evt = {
    id, ts: new Date().toISOString(),
    platform: i.platform || 'unknown',
    actor, kind: i.kind || 'mention',
    sentimentScore: score, action, reply,
    inbound: String(i.text || '').slice(0, 500),
    whitelist: isWhitelisted(actor),
  };
  _persist(evt);
  return { ok: true, ...evt };
}

function recent(limit) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 50));
  try {
    if (!fs.existsSync(LEDGER)) return [];
    const lines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-lim).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
  } catch (_) { return []; }
}

function status() {
  return {
    disabled: DISABLED,
    negThreshold: NEG_THRESHOLD,
    whitelistSize: _whitelist.size,
    blacklistSize: _blacklist.size,
  };
}

function _resetForTests() { _whitelist.clear(); _blacklist.clear(); }

module.exports = { processInbound, whitelist, blacklist, isWhitelisted, isBlacklisted, recent, status, _resetForTests };
