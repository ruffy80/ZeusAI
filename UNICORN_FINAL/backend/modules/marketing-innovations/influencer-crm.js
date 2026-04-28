// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/influencer-crm.js
//
// Influencer CRM with deterministic scoring (audience × engagement ×
// fit) and a tiered affiliate pipeline. Outreach drafts are generated
// via the existing outreach-sentiment engine.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const outreach = require('./outreach-sentiment');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const FILE = process.env.MARKETING_INFLUENCER_FILE
  || path.join(DATA_DIR, 'influencer-crm.jsonl');

const DISABLED = process.env.MARKETING_INFLUENCER_DISABLED === '1';

const TIERS = [
  { id: 'bronze', minScore: 0,   commissionPct: 0.10 },
  { id: 'silver', minScore: 50,  commissionPct: 0.15 },
  { id: 'gold',   minScore: 75,  commissionPct: 0.20 },
  { id: 'plat',   minScore: 90,  commissionPct: 0.30 },
];

const _records = new Map(); // id → influencer

function _ensure() { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); } catch (_) {} }
function _persist(evt) { try { _ensure(); fs.appendFileSync(FILE, JSON.stringify(evt) + '\n'); } catch (_) {} }

/**
 * score: 0..100 from audience (log scale), engagement (rate 0..1), fit (0..1).
 */
function _score(p) {
  const audience = Math.min(1, Math.log10(1 + Math.max(0, Number(p.audience) || 0)) / 7); // 1e7 → 1.0
  const engagement = Math.max(0, Math.min(1, Number(p.engagement) || 0));
  const fit = Math.max(0, Math.min(1, Number(p.fit) || 0));
  return Math.round((audience * 0.4 + engagement * 0.4 + fit * 0.2) * 100);
}

function _tier(score) {
  let chosen = TIERS[0];
  for (const t of TIERS) if (score >= t.minScore) chosen = t;
  return chosen;
}

function add(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const o = opts || {};
  if (!o.handle) return { ok: false, error: 'handle_required' };
  const score = _score(o);
  const tier = _tier(score);
  const r = {
    id: 'INF-' + crypto.randomBytes(4).toString('hex'),
    handle: String(o.handle),
    platform: String(o.platform || 'X'),
    audience: Math.max(0, Number(o.audience) || 0),
    engagement: Math.max(0, Math.min(1, Number(o.engagement) || 0)),
    fit: Math.max(0, Math.min(1, Number(o.fit) || 0)),
    score, tier: tier.id,
    commissionPct: tier.commissionPct,
    status: 'prospect',
    createdAt: new Date().toISOString(),
  };
  _records.set(r.id, r);
  _persist({ type: 'add', record: r });
  return { ok: true, record: r };
}

function setStatus(id, status) {
  const r = _records.get(String(id));
  if (!r) return { ok: false, error: 'not_found' };
  const allowed = ['prospect', 'contacted', 'negotiating', 'active', 'paused', 'lost'];
  const s = String(status || '').toLowerCase();
  if (!allowed.includes(s)) return { ok: false, error: 'invalid_status' };
  r.status = s;
  r.updatedAt = new Date().toISOString();
  _persist({ type: 'status', id: r.id, status: s });
  return { ok: true, record: r };
}

function draftOutreach(id, opts) {
  const r = _records.get(String(id));
  if (!r) return { ok: false, error: 'not_found' };
  const draft = outreach.draftDM(Object.assign({
    name: r.handle,
    topic: (opts && opts.topic) || 'partnership',
    valueProp: `${(r.commissionPct * 100).toFixed(0)}% commission, BTC payouts`,
  }, opts || {}));
  return { ok: true, record: r, draft };
}

function list(filter) {
  const f = filter || {};
  return Array.from(_records.values())
    .filter((r) => !f.status || r.status === f.status)
    .filter((r) => !f.tier || r.tier === f.tier)
    .sort((a, b) => b.score - a.score);
}

function status() {
  const all = Array.from(_records.values());
  const byTier = {};
  for (const r of all) byTier[r.tier] = (byTier[r.tier] || 0) + 1;
  return {
    disabled: DISABLED,
    total: all.length,
    byTier,
    tiers: TIERS,
  };
}

function _resetForTests() { _records.clear(); }

module.exports = { add, setStatus, draftOutreach, list, status, TIERS, _resetForTests };
