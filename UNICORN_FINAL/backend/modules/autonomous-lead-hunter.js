// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-04T11:19:48.506Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// =====================================================================================
// OWNERSHIP: Proprietatea lui Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================================
//
// autonomous-lead-hunter.js
// ─────────────────────────
// Revenue-first innovation module.
// Think → Plan → Execute → Observe → Reflect → Improve loop for lead generation.
//
// Capabilities:
//  1. Scan target industry signals (configurable via LEAD_HUNTER_INDUSTRIES env)
//  2. Qualify leads by ICP criteria (size, intent, budget signals)
//  3. Generate personalised outreach via AI provider
//  4. Track funnel state with failure/success memory
//  5. Adaptive retries with confidence scoring
//  6. Emit `lead:qualified` and `lead:converted` events on global event bus
//
// 100% in-memory by default. Persists to data/leads/ when LEAD_HUNTER_PERSIST=1.
// Never auto-starts intervals — call start() explicitly. Safe to import anywhere.

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'leads');

// ── Config ─────────────────────────────────────────────────────────────────────
const PERSIST = process.env.LEAD_HUNTER_PERSIST === '1';
const INTERVAL_MS = Number(process.env.LEAD_HUNTER_INTERVAL_MS || 3600_000); // 1 h default
const MAX_LEADS = Number(process.env.LEAD_HUNTER_MAX_LEADS || 500);
const CONFIDENCE_THRESHOLD = Number(process.env.LEAD_HUNTER_CONFIDENCE || 0.65);

// Default ICP (Ideal Customer Profile) — override via env
const ICP_SIGNALS = (process.env.LEAD_HUNTER_ICP || 'AI,automation,SaaS,e-commerce,fintech').split(',').map(s => s.trim().toLowerCase());

// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  running: false,
  cycles: 0,
  leadsDiscovered: 0,
  leadsQualified: 0,
  leadsConverted: 0,
  failures: 0,
  lastCycleAt: null,
  memory: { failures: [], successes: [], reflections: [] },
};

const leads = new Map(); // id -> lead object
const bus = new EventEmitter();
bus.setMaxListeners(50);

// ── Persistence ────────────────────────────────────────────────────────────────
function _ensureDir() {
  if (PERSIST) try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}
function _save() {
  if (!PERSIST) return;
  try {
    _ensureDir();
    const all = [...leads.values()];
    fs.writeFileSync(path.join(DATA_DIR, 'leads.json'), JSON.stringify(all, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'state.json'), JSON.stringify({ ...state, memory: { ...state.memory } }, null, 2));
  } catch (_) {}
}
function _load() {
  if (!PERSIST) return;
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'leads.json'), 'utf8');
    for (const l of JSON.parse(raw)) leads.set(l.id, l);
    const s = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf8'));
    Object.assign(state, s);
  } catch (_) {}
}

// ── ICP qualification ──────────────────────────────────────────────────────────
function _score(lead) {
  const text = `${lead.company || ''} ${lead.industry || ''} ${lead.description || ''}`.toLowerCase();
  let score = 0;
  for (const kw of ICP_SIGNALS) {
    if (text.includes(kw)) score += 1;
  }
  // Budget signal boost
  if (lead.estimatedBudgetUsd && lead.estimatedBudgetUsd >= 500) score += 2;
  if (lead.estimatedBudgetUsd && lead.estimatedBudgetUsd >= 5000) score += 3;
  // Company size signal
  if (lead.employees && lead.employees >= 10) score += 1;
  const confidence = Math.min(1, score / (ICP_SIGNALS.length + 5));
  return { score, confidence, qualified: confidence >= CONFIDENCE_THRESHOLD };
}

// ── AI-powered outreach generation ────────────────────────────────────────────
async function _generateOutreach(lead) {
  // Try to use the live AI router if available
  try {
    const dispatcher = require('./ai-auto-dispatcher');
    if (typeof dispatcher.dispatch === 'function') {
      const prompt = `Write a short (3 sentences max), professional outreach message for a B2B SaaS lead:
Company: ${lead.company}
Industry: ${lead.industry}
Context: ZeusAI autonomous commerce platform. Focus on ROI + automation. Be direct.`;
      const result = await Promise.race([
        dispatcher.dispatch({ prompt, maxTokens: 200 }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      if (result && result.text) return result.text.trim();
    }
  } catch (_) {}
  // Fallback template
  return `Hi ${lead.contact || 'there'},\n\nI noticed ${lead.company || 'your company'} is active in ${lead.industry || 'your space'}. ZeusAI can automate your entire commerce + AI workflow — 10x faster, at a fraction of cost. Worth a 15-min call?\n\nBest, ZeusAI Team`;
}

// ── Think → Plan → Execute cycle ──────────────────────────────────────────────
async function _runCycle() {
  state.cycles++;
  state.lastCycleAt = new Date().toISOString();

  // 1. THINK: reflect on past failures and successes
  const avgConfidence = state.memory.successes.length
    ? state.memory.successes.reduce((s, x) => s + (x.confidence || 0), 0) / state.memory.successes.length
    : CONFIDENCE_THRESHOLD;
  const dynamicThreshold = Math.min(0.95, avgConfidence * 0.9);

  // 2. PLAN: decide how many leads to scan this cycle (adaptive)
  const failureRate = state.failures / Math.max(1, state.cycles);
  const batchSize = failureRate > 0.3 ? 3 : (failureRate > 0.1 ? 8 : 15);

  // 3. EXECUTE: process REAL inbound leads only.
  // ─────────────────────────────────────────────────────────────────────────
  // HONESTY CONTRACT (audit fix 2026-07): this loop NO LONGER fabricates
  // synthetic companies with Math.random() budgets and null emails. Fabricated
  // leads polluted metrics and produced phantom "qualified" events that
  // converted nothing. Real leads now arrive via ingestLead() from:
  //   • /api/lead (homepage capture form + vertical growth pages)
  //   • customer signups
  //   • checkout_open telemetry (high-intent visitors)
  // Synthetic generation is available ONLY when explicitly opted-in for local
  // load-testing via LEAD_HUNTER_SYNTHETIC=1 — never in production.
  // RO: gata cu lead-uri fabricate; procesăm doar lead-uri reale de intrare.
  const discovered = [];

  // Pull any newly-ingested real leads that are still in 'discovered' state.
  for (const lead of leads.values()) {
    if (lead.status === 'discovered' && lead.source !== 'synthetic') {
      discovered.push(lead);
      if (discovered.length >= batchSize) break;
    }
  }

  // Opt-in synthetic mode (LOCAL LOAD-TEST ONLY — never in prod).
  if (process.env.LEAD_HUNTER_SYNTHETIC === '1') {
    const industries = ['e-commerce', 'fintech', 'SaaS', 'AI', 'logistics', 'healthcare', 'real estate'];
    for (let i = 0; i < batchSize && leads.size < MAX_LEADS; i++) {
      const id = `synthetic_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
      const industry = industries[Math.floor(Math.random() * industries.length)];
      const budgetTier = Math.random();
      const lead = {
        id, company: `Company_${id.slice(-5)}`, industry,
        estimatedBudgetUsd: budgetTier > 0.7 ? 10000 : budgetTier > 0.4 ? 2000 : 300,
        employees: Math.floor(Math.random() * 200) + 2,
        contact: null, email: null, source: 'synthetic',
        description: `${industry} startup (SYNTHETIC test lead)`,
        status: 'discovered', confidence: 0, score: 0, outreach: null,
        discoveredAt: new Date().toISOString(), updatedAt: new Date().toISOString(), retries: 0,
      };
      leads.set(id, lead);
      discovered.push(lead);
      state.leadsDiscovered++;
    }
  }

  // 4. OBSERVE: qualify each discovered lead
  for (const lead of discovered) {
    const { score, confidence, qualified } = _score(lead);
    lead.confidence = confidence;
    lead.score = score;
    if (qualified) {
      lead.status = 'qualified';
      state.leadsQualified++;
      // Generate outreach
      try {
        lead.outreach = await _generateOutreach(lead);
      } catch (_) {
        lead.outreach = null;
        lead.retries++;
      }
      // Godmode Completion OS: deliver outreach when a real email exists + mailer armed.
      // Synthetic / null-email leads still emit events for owner dashboards only.
      if (lead.outreach && lead.email && String(lead.email).includes('@') && lead.source !== 'synthetic') {
        try {
          const mailer = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'transactional-email.js'));
          const subject = 'ZeusAI — quick note for ' + (lead.company || 'your team');
          const text = String(lead.outreach);
          if (mailer && typeof mailer.sendRaw === 'function') {
            Promise.resolve(mailer.sendRaw({ to: lead.email, subject, text }))
              .then((r) => {
                lead.outreachSentAt = new Date().toISOString();
                lead.outreachDelivery = (r && r.ok === false) ? (r.error || 'send_failed') : 'sent';
              })
              .catch((err) => {
                lead.outreachDelivery = 'send_failed:' + String(err && err.message || 'unknown').slice(0, 80);
              });
          } else {
            lead.outreachDelivery = 'email_unconfigured';
          }
        } catch (mailErr) {
          lead.outreachDelivery = 'mailer_unavailable';
        }
        // Owner Telegram nudge so qualified leads never die silently pre-keys.
        try {
          const zac = require('./zacAlertChannel');
          if (zac && typeof zac.sendTelegram === 'function') {
            Promise.resolve(zac.sendTelegram([
              '🎯 *Lead qualified*',
              lead.company ? `Company: ${lead.company}` : null,
              `Email: ${lead.email}`,
              lead.industry ? `Industry: ${lead.industry}` : null,
              lead.score != null ? `Score: ${lead.score}` : null,
              lead.outreach ? ('Outreach drafted — delivery: ' + (lead.outreachDelivery || 'queued')) : null,
            ].filter(Boolean).join('\n'))).catch(() => {});
          }
        } catch (_) { /* optional */ }
      }
      bus.emit('lead:qualified', { ...lead });
      state.memory.successes.push({ id: lead.id, confidence, ts: Date.now() });
      if (state.memory.successes.length > 200) state.memory.successes = state.memory.successes.slice(-200);

      // Emit on global event bus if available
      try {
        if (global._unicornEventBus) {
          global._unicornEventBus.emit('lead:qualified', { ...lead });
        }
      } catch (_) {}
    } else {
      lead.status = 'rejected';
      state.failures++;
      state.memory.failures.push({ id: lead.id, confidence, reason: 'below_threshold', ts: Date.now() });
      if (state.memory.failures.length > 200) state.memory.failures = state.memory.failures.slice(-200);
    }
    lead.updatedAt = new Date().toISOString();
    leads.set(lead.id, lead);
  }

  // 5. REFLECT: log reflection
  const reflection = {
    cycle: state.cycles,
    batchSize,
    discovered: discovered.length,
    qualified: discovered.filter(l => l.status === 'qualified').length,
    dynamicThreshold: Number(dynamicThreshold.toFixed(3)),
    ts: Date.now(),
  };
  state.memory.reflections.push(reflection);
  if (state.memory.reflections.length > 50) state.memory.reflections = state.memory.reflections.slice(-50);

  // 6. IMPROVE: prune lowest-scored leads if at capacity
  if (leads.size >= MAX_LEADS) {
    const sorted = [...leads.values()].sort((a, b) => a.confidence - b.confidence);
    const prune = sorted.slice(0, Math.floor(MAX_LEADS * 0.1));
    for (const l of prune) leads.delete(l.id);
  }

  _save();
  return reflection;
}

// ── Public API ─────────────────────────────────────────────────────────────────
let _timer = null;

function start() {
  if (state.running) return { ok: true, already: true };
  _load();
  state.running = true;
  _runCycle().catch(() => {});
  _timer = setInterval(() => _runCycle().catch(() => {}), INTERVAL_MS);
  return { ok: true, started: true, intervalMs: INTERVAL_MS };
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  state.running = false;
  return { ok: true };
}

function getStatus() {
  return {
    ok: true,
    name: 'autonomous-lead-hunter',
    running: state.running,
    cycles: state.cycles,
    leadsDiscovered: state.leadsDiscovered,
    leadsQualified: state.leadsQualified,
    leadsConverted: state.leadsConverted,
    totalLeads: leads.size,
    failures: state.failures,
    lastCycleAt: state.lastCycleAt,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    lastReflection: state.memory.reflections.slice(-1)[0] || null,
  };
}

function listLeads({ status, limit = 50 } = {}) {
  let all = [...leads.values()];
  if (status) all = all.filter(l => l.status === status);
  return all.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

function markConverted(id) {
  const l = leads.get(id);
  if (!l) return { ok: false, error: 'not_found' };
  l.status = 'converted';
  l.updatedAt = new Date().toISOString();
  state.leadsConverted++;
  leads.set(id, l);
  bus.emit('lead:converted', { ...l });
  try { if (global._unicornEventBus) global._unicornEventBus.emit('lead:converted', { ...l }); } catch (_) {}
  _save();
  return { ok: true, lead: l };
}

function runOnce() { return _runCycle(); }

// ── ingestLead — accept a REAL inbound lead (audit fix 2026-07) ────────────────
// Called by /api/lead, signup hooks, and checkout_open telemetry. Deduplicates
// by email. Newly ingested leads are picked up by the next _runCycle() for
// qualification + outreach. Returns the stored lead.
// RO: primește un lead REAL de intrare (formular, signup, checkout).
function ingestLead(input = {}) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'invalid_email' };

  // Dedupe by email — update existing rather than duplicate.
  for (const l of leads.values()) {
    if (l.email === email) {
      l.updatedAt = new Date().toISOString();
      l.touches = (l.touches || 1) + 1;
      if (input.interest) l.interest = String(input.interest).slice(0, 120);
      if (input.source) l.lastSource = String(input.source).slice(0, 60);
      leads.set(l.id, l);
      _save();
      return { ok: true, deduped: true, lead: l };
    }
  }

  const id = `real_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const lead = {
    id,
    company: String(input.company || '').slice(0, 160) || null,
    industry: String(input.industry || input.interest || 'general').slice(0, 80),
    estimatedBudgetUsd: Number(input.estimatedBudgetUsd) || null,
    employees: Number(input.employees) || null,
    contact: String(input.name || '').slice(0, 120) || null,
    email,
    source: String(input.source || 'inbound').slice(0, 60),
    interest: String(input.interest || 'general').slice(0, 120),
    description: String(input.description || `Inbound lead via ${input.source || 'site'}`).slice(0, 400),
    status: 'discovered',
    confidence: 0,
    score: 0,
    outreach: null,
    touches: 1,
    discoveredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retries: 0,
  };
  leads.set(id, lead);
  state.leadsDiscovered++;
  try { if (global._unicornEventBus) global._unicornEventBus.emit('lead:captured', { ...lead }); } catch (_) {}
  _save();
  return { ok: true, deduped: false, lead };
}

module.exports = {
  start, stop, getStatus, listLeads, markConverted, runOnce, ingestLead,
  on: (ev, fn) => bus.on(ev, fn),
  name: 'autonomous-lead-hunter',
};
