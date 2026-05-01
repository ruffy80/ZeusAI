// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T17:06:23.818Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * ai-sdr-agent (REAL)
 * -------------------
 * Reads inbound leads (data/marketing/leads.jsonl when present) and
 * produces a prioritized SDR queue with next-step recommendations.
 * Pull-based, no timers. RO+EN comments preserved.
 */
const fs = require('fs');
const path = require('path');
const NAME = 'ai-sdr-agent';

const LEADS_FILE = path.join(__dirname, '..', '..', 'data', 'marketing', 'leads.jsonl');

function _readLeads() {
  try {
    if (!fs.existsSync(LEADS_FILE)) return [];
    const raw = fs.readFileSync(LEADS_FILE, 'utf8');
    return raw.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
  } catch (_) { return []; }
}

function _scoreLead(lead) {
  let score = 30;
  const email = String(lead.email || '').toLowerCase();
  if (email && !/(gmail|yahoo|hotmail|outlook|icloud)\./i.test(email)) score += 25;
  if (lead.company) score += 20;
  if (lead.vertical) score += 15;
  if (lead.source === 'vertical-growth-page') score += 10;
  return Math.min(100, score);
}

function buildQueue(opts) {
  const leads = _readLeads();
  const enriched = leads.map((l) => ({
    email: l.email, name: l.name || null, company: l.company || null, vertical: l.vertical || null,
    source: l.source || 'unknown', receivedAt: l.ts || l.receivedAt || null,
    score: _scoreLead(l),
    nextStep: _scoreLead(l) >= 70 ? 'book_call_24h' : _scoreLead(l) >= 50 ? 'send_case_study' : 'nurture_sequence'
  })).sort((a, b) => b.score - a.score);
  return { queue: enriched.slice(0, Number((opts && opts.limit) || 100)), totalLeads: enriched.length };
}

function getStatus(opts) {
  const q = buildQueue(opts);
  return {
    ok: true, name: NAME, title: 'AI SDR Agent', domain: 'sdr',
    summary: 'Scores inbound leads from /api/lead and produces a prioritized SDR queue.',
    leadsFile: LEADS_FILE, totals: { totalLeads: q.totalLeads }, top: q.queue.slice(0, 5),
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return buildQueue(input); }
module.exports = { name: NAME, buildQueue, getStatus, run };
