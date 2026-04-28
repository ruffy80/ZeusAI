// commerce/outreach-engine.js
// Consent-first outreach: campaigns are stored and "scheduled" but tick() never
// auto-sends to avoid sending without explicit human review (per plan).
//
// Exports:
//   createCampaign({name, audience, subject, body, channel?})  → campaign
//   listCampaigns() → campaign[]
//   tick() → { processed, scheduled }
//   snapshot() → { generatedAt, total, byStatus, recent }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const LOG_FILE = path.join(DATA_DIR, 'outreach.jsonl');

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

const _campaigns = new Map();
function _hydrate() {
  ensureDir();
  if (!fs.existsSync(LOG_FILE)) return;
  try {
    const text = fs.readFileSync(LOG_FILE, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim(); if (!t) continue;
      try {
        const evt = JSON.parse(t);
        if (evt.type === 'snapshot' && evt.campaign) _campaigns.set(evt.campaign.id, evt.campaign);
      } catch (_) {}
    }
  } catch (e) { console.warn('[outreach] hydrate failed:', e.message); }
}
function _persist(c) {
  ensureDir();
  try { fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), type: 'snapshot', campaign: c }) + '\n'); }
  catch (e) { console.warn('[outreach] persist failed:', e.message); }
}

function createCampaign(p) {
  if (!p || typeof p !== 'object') throw new Error('payload_required');
  const name = String(p.name || '').slice(0, 200);
  if (!name) throw new Error('name_required');
  const audience = Array.isArray(p.audience) ? p.audience.slice(0, 1000) : [];
  const c = {
    id: 'camp_' + crypto.randomBytes(6).toString('hex'),
    name,
    channel: String(p.channel || 'email'),
    subject: String(p.subject || '').slice(0, 200),
    body: String(p.body || '').slice(0, 8000),
    audience,
    audienceSize: audience.length,
    status: 'draft',
    createdAt: new Date().toISOString(),
    scheduledAt: null,
    consentVerified: !!p.consentVerified,
    notes: 'Outreach engine NEVER auto-sends. Human review + explicit dispatch required.'
  };
  _campaigns.set(c.id, c);
  _persist(c);
  return c;
}

function listCampaigns() {
  return Array.from(_campaigns.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function tick() {
  // Mark draft campaigns with verified consent as "scheduled" — never sends.
  let processed = 0, scheduled = 0;
  for (const c of _campaigns.values()) {
    processed += 1;
    if (c.status === 'draft' && c.consentVerified) {
      c.status = 'scheduled';
      c.scheduledAt = new Date().toISOString();
      scheduled += 1;
      _persist(c);
    }
  }
  return { processed, scheduled };
}

function snapshot() {
  const all = listCampaigns();
  const byStatus = {};
  for (const c of all) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    total: all.length,
    byStatus,
    recent: all.slice(0, 20).map(c => ({
      id: c.id, name: c.name, channel: c.channel, status: c.status,
      audienceSize: c.audienceSize, createdAt: c.createdAt, scheduledAt: c.scheduledAt
    }))
  };
}

function _resetForTests() {
  _campaigns.clear();
  try { fs.rmSync(LOG_FILE, { force: true }); } catch (_) {}
}

_hydrate();

module.exports = { createCampaign, listCampaigns, tick, snapshot, _resetForTests };
