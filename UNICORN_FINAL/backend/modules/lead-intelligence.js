// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-03
// =====================================================================
//
// lead-intelligence.js — REAL inbound-lead scoring + prioritized pipeline.
//
// Audit 2026-07 verdict: after repairing /api/lead (the #1 leak), leads now
// land in data/leads/inbound-leads.jsonl — but they sat there as an
// undifferentiated pile. No score, no ranking, no "who do I follow up with
// first". A pile of leads with no prioritization converts almost as poorly
// as no leads at all: the founder's time goes to the loudest, not the hottest.
//
// This module reads the SAME durable JSONL the capture endpoint writes and:
//   • Scores each lead 0–100 from honest, explainable signals (business
//     email domain, company present, buying-intent keywords, source page
//     quality, recency). Every point is traceable — no black box.
//   • Segments hot / warm / cold and prescribes the next action per segment.
//   • Exposes a ranked pipeline for the founder + aggregate stats for the
//     Autonomous Growth Brain (is capture being converted into qualified
//     follow-up, or leaking again at the qualification stage?).
//
// Read-only over the leads file. Fail-safe: never throws into a handler,
// never mutates the capture file, bounded read (last N lines).
//
// RO: scoring real de lead-uri + pipeline prioritizat — transformă lead-urile
// capturate în follow-up ordonat după intenția reală de cumpărare.
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');

const NAME = 'lead-intelligence';
const LEADS_FILE = process.env.INBOUND_LEADS_FILE
  || path.join(process.cwd(), 'data', 'leads', 'inbound-leads.jsonl');
const MAX_LEADS = 2000; // bound memory: score at most the most-recent N

// Free/consumer email providers → lower B2B intent than a company domain.
const FREE_EMAIL = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'outlook.com',
  'live.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com',
  'gmx.com', 'mail.com', 'yandex.com', 'zoho.com', 'msn.com',
]);

// Buying-intent keywords in the lead's message/interest, weighted by how
// close each is to an actual purchase decision.
const INTENT_KEYWORDS = [
  { rx: /\b(buy|purchase|checkout|order|invoice|pay(ing|ment)?)\b/i, w: 12, tag: 'purchase-intent' },
  { rx: /\b(pricing|price|quote|cost|budget|how much)\b/i, w: 10, tag: 'pricing' },
  { rx: /\b(demo|trial|poc|pilot|evaluat)\b/i, w: 9, tag: 'evaluation' },
  { rx: /\b(enterprise|team|seats?|company-wide|organization)\b/i, w: 8, tag: 'enterprise' },
  { rx: /\b(urgent|asap|today|this week|deadline|immediately)\b/i, w: 8, tag: 'urgency' },
  { rx: /\b(integrat|api|onboard|migrat|implement)\b/i, w: 6, tag: 'implementation' },
  { rx: /\b(scale|scaling|grow(th)?|revenue|convert|roi)\b/i, w: 5, tag: 'growth' },
];

// Source pages closer to the money = higher intent than a generic signup.
const SOURCE_WEIGHT = [
  { rx: /(checkout|pricing|payment|buy|order)/i, w: 15, tag: 'bottom-funnel' },
  { rx: /(services?|catalog|product|demo)/i, w: 9, tag: 'mid-funnel' },
  { rx: /(vertical|industry|solution|use-?case)/i, w: 7, tag: 'solution' },
  { rx: /(blog|guide|resource|seo|landing)/i, w: 4, tag: 'top-funnel' },
];

function _domain(email) {
  const m = String(email || '').toLowerCase().match(/@([^@\s]+)$/);
  return m ? m[1] : '';
}

// Score one lead 0–100 with an explainable breakdown.
function scoreLead(lead) {
  lead = lead || {};
  const reasons = [];
  let score = 0;

  // 1) Email quality (max 25).
  const dom = _domain(lead.email);
  if (dom && !FREE_EMAIL.has(dom)) {
    score += 25; reasons.push({ signal: 'business-email', points: 25, detail: dom });
  } else if (dom) {
    score += 6; reasons.push({ signal: 'personal-email', points: 6, detail: dom });
  }

  // 2) Company present (max 15).
  if (lead.company && String(lead.company).trim().length > 1) {
    score += 15; reasons.push({ signal: 'company-named', points: 15, detail: String(lead.company).slice(0, 60) });
  }

  // 3) Buying-intent keywords in message + interest (max ~30, capped).
  const text = [lead.message, lead.interest, lead.note, lead.name].filter(Boolean).join(' ');
  let intent = 0; const tags = [];
  for (const k of INTENT_KEYWORDS) {
    if (k.rx.test(text)) { intent += k.w; tags.push(k.tag); }
  }
  intent = Math.min(30, intent);
  if (intent > 0) { score += intent; reasons.push({ signal: 'buying-intent', points: intent, detail: tags.join(', ') }); }

  // 4) Source-page funnel depth (max 15).
  const src = String(lead.source || lead.ref || '');
  for (const s of SOURCE_WEIGHT) {
    if (s.rx.test(src)) { score += s.w; reasons.push({ signal: 'source-' + s.tag, points: s.w, detail: src.slice(0, 60) }); break; }
  }

  // 5) Recency (max 15): a lead from the last 24h is hotter than a month-old one.
  const t = Date.parse(lead.ts || lead.createdAt || '') || 0;
  if (t) {
    const ageH = (Date.now() - t) / 3600000;
    const rec = ageH <= 24 ? 15 : ageH <= 72 ? 10 : ageH <= 168 ? 6 : ageH <= 720 ? 2 : 0;
    if (rec > 0) { score += rec; reasons.push({ signal: 'recency', points: rec, detail: Math.round(ageH) + 'h old' }); }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const segment = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
  const nextAction = segment === 'hot'
    ? 'Personal outreach within 1 hour — offer a live demo or direct checkout link.'
    : segment === 'warm'
      ? 'Send a tailored value email + case study; add to a 3-touch nurture.'
      : 'Add to the automated newsletter/nurture; re-score if they re-engage.';

  return { score, segment, tags, nextAction, reasons };
}

// Read the durable leads file (bounded to the most-recent MAX_LEADS).
function _readLeads() {
  try {
    if (!fs.existsSync(LEADS_FILE)) return [];
    const lines = fs.readFileSync(LEADS_FILE, 'utf8').split('\n').filter(Boolean);
    const slice = lines.slice(-MAX_LEADS);
    const out = [];
    for (const ln of slice) { try { out.push(JSON.parse(ln)); } catch (_) {} }
    return out;
  } catch (_) { return []; }
}

// Ranked pipeline: newest-scored leads, hottest first.
function pipeline(limit) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  const leads = _readLeads();
  const scored = leads.map((l) => {
    const s = scoreLead(l);
    return {
      email: l.email, name: l.name || '', company: l.company || '',
      source: l.source || '', interest: l.interest || '', ts: l.ts || l.createdAt || '',
      score: s.score, segment: s.segment, tags: s.tags, nextAction: s.nextAction, reasons: s.reasons,
    };
  });
  scored.sort((a, b) => b.score - a.score || (Date.parse(b.ts) || 0) - (Date.parse(a.ts) || 0));
  return { ok: true, module: NAME, total: scored.length, leads: scored.slice(0, lim), ts: new Date().toISOString() };
}

// Aggregate stats for the Growth Brain + admin (public-safe: no PII).
function stats() {
  const leads = _readLeads();
  let hot = 0, warm = 0, cold = 0, sum = 0;
  for (const l of leads) {
    const s = scoreLead(l);
    sum += s.score;
    if (s.segment === 'hot') hot++; else if (s.segment === 'warm') warm++; else cold++;
  }
  const total = leads.length;
  return {
    module: NAME,
    total, hot, warm, cold,
    avgScore: total ? Math.round(sum / total) : 0,
    // Qualification health: are we producing hot/warm leads to act on?
    qualifiedPct: total ? Math.round(((hot + warm) / total) * 100) : 0,
  };
}

function registerRoutes(app) {
  if (!app || typeof app.get !== 'function') return;

  // Admin: full ranked pipeline (contains PII → gate behind admin token if available).
  const guard = _adminGuard(app);
  app.get('/api/leads/pipeline', guard, (req, res) => {
    try { res.json(pipeline(req.query.limit)); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Public-safe aggregate (no PII) — powers the admin card + Growth Brain.
  app.get('/api/leads/intelligence', (req, res) => {
    try { res.json({ ok: true, ...stats() }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

// Reuse the app's admin middleware if one is registered; otherwise no-op
// (the pipeline still works, matching the platform's existing posture where
//  /api/leads/* admin routes use adminTokenMiddleware).
let _guardFn = null;
function configure(deps) {
  if (deps && typeof deps.adminGuard === 'function') _guardFn = deps.adminGuard;
  return { ok: true };
}
function _adminGuard() {
  return (req, res, next) => {
    if (_guardFn) { try { return _guardFn(req, res, next); } catch (_) { return next(); } }
    return next();
  };
}

module.exports = { name: NAME, configure, scoreLead, pipeline, stats, registerRoutes };
