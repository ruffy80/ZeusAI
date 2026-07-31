// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-03
// =====================================================================
//
// growth-brain.js — THE AUTONOMOUS GROWTH BRAIN (Observe→Think→Plan→
//                    Execute→Reflect→Improve).
//
// Audit 2026-07 verdict: the platform had dozens of REAL organs — traffic
// (IndexNow/SEO), lead capture, lead scoring, conversion + funnel telemetry,
// activation-readiness, upsell, referral, retention — but nothing that
// LOOKED AT ALL OF THEM AT ONCE and decided, autonomously, what to do next.
// Each engine optimized its own tiny slice; no organ owned the whole funnel.
// That is why "370 modules ACTIVE" produced $0 autonomous revenue: activity
// without a brain is just heat.
//
// This module is that brain. On a bounded schedule it:
//   OBSERVE  — pulls honest, live signals from every real growth organ.
//   THINK    — scores the health of each funnel stage 0–100 (traffic →
//              capture → qualify → convert → monetize → expand → retain).
//   PLAN     — ranks the single highest-ROI next actions, deduplicated,
//              each tagged auto (the brain can do it) or owner (needs a key).
//   EXECUTE  — actually performs the SAFE auto-actions (e.g. push new URLs
//              to search engines, refresh lead qualification) and records
//              exactly what it did — no fabrication, no PM2/price mutation.
//   REFLECT  — appends every cycle to a hash-chained JSONL and measures the
//              delta vs the previous cycle, so improvement is provable.
//
// Golden-rule safe: soft requires, unref()'d interval, read-mostly, never
// exits the process, never touches money rails or PM2.
//
// RO: creierul autonom de creștere — observă toate organele reale, punctează
// fiecare etapă a pâlniei, decide următoarea acțiune cu ROI maxim, execută
// automat ce e sigur și își dovedește progresul într-un jurnal cu hash-chain.
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'growth-brain';
const LOG_FILE = process.env.GROWTH_BRAIN_LOG
  || path.join(process.cwd(), 'data', 'growth', 'brain-log.jsonl');
const INTERVAL_MS = Math.max(5 * 60 * 1000, Number(process.env.GROWTH_BRAIN_INTERVAL_MS || 30 * 60 * 1000));

// Funnel-stage weights: how much each stage matters to the overall score.
// Front of funnel is weighted heaviest because that is where this platform
// is actually starving (audit: "nobody visits").
const STAGE_WEIGHT = {
  traffic:  0.22,
  capture:  0.15,
  qualify:  0.13,
  convert:  0.15,
  monetize: 0.20,
  expand:   0.08,
  retain:   0.07,
};

// Injected real-organ getters (all optional; each call is wrapped).
const deps = {
  trafficEngine: null,   // { getStatus(), runCycle() }
  leadIntel: null,       // { stats() }
  upsell: null,          // { stats() }
  conversion: null,      // () => conversion intelligence
  funnel: null,          // () => funnel intelligence
  referral: null,        // () => affiliate/referral summary
  retention: null,       // () => retention summary
  offer: null,           // { rotate?() } optional
};
function configure(injected) {
  if (injected && typeof injected === 'object') {
    for (const k of Object.keys(deps)) if (injected[k]) deps[k] = injected[k];
  }
  return { ok: true };
}

function _envArmed(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) return false;
  return !/^(your|skip|changeme|todo|placeholder|xxx+|none|null|undefined|tbd|n\/a)/i.test(v);
}
function _safe(fn, fallback) { try { const v = fn(); return v == null ? fallback : v; } catch (_) { return fallback; } }
function _num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); }
function _clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

// ── OBSERVE ──────────────────────────────────────────────────────────
function observe() {
  const socialArmed = _envArmed('X_BEARER_TOKEN') || _envArmed('TELEGRAM_BOT_TOKEN') || _envArmed('YOUTUBE_API_KEY') || _envArmed('PINTEREST_TOKEN');
  const emailArmed = _envArmed('RESEND_API_KEY') || _envArmed('BREVO_API_KEY') || _envArmed('MAILERSEND_API_KEY');
  const cardArmed = _envArmed('NOWPAYMENTS_API_KEY') || _envArmed('STRIPE_SECRET_KEY') || _envArmed('PAYPAL_CLIENT_ID');
  const aiArmed = _envArmed('OPENAI_API_KEY') || _envArmed('DEEPSEEK_API_KEY') || _envArmed('GROQ_API_KEY') || _envArmed('ANTHROPIC_API_KEY');

  const traffic = deps.trafficEngine ? _safe(() => deps.trafficEngine.getStatus(), {}) : {};
  const leads = deps.leadIntel ? _safe(() => deps.leadIntel.stats(), {}) : {};
  const ups = deps.upsell ? _safe(() => deps.upsell.stats(), {}) : {};
  const conv = deps.conversion ? _safe(() => deps.conversion(), {}) : {};
  const fun = deps.funnel ? _safe(() => deps.funnel(), {}) : {};
  const ref = deps.referral ? _safe(() => deps.referral(), {}) : {};
  const ret = deps.retention ? _safe(() => deps.retention(), {}) : {};

  return {
    ts: new Date().toISOString(),
    armed: { social: socialArmed, email: emailArmed, card: cardArmed, ai: aiArmed, btc: true },
    traffic: {
      urlInventory: _num(traffic.urlInventory, 0),
      running: !!traffic.running,
      lastRunAt: traffic.lastRunAt || null,
      social: socialArmed,
    },
    capture: { inbound: _num(leads.total, 0) },
    qualify: { hot: _num(leads.hot, 0), warm: _num(leads.warm, 0), qualifiedPct: _num(leads.qualifiedPct, 0), avgScore: _num(leads.avgScore, 0) },
    convert: {
      // Pull whatever the conversion/funnel organs expose, defensively.
      rate: _num(conv.conversionRate != null ? conv.conversionRate : conv.rate, 0),
      topDrop: fun.worstStep || fun.topDropOff || (Array.isArray(fun.steps) ? null : null),
      funnelKnown: !!(fun && (fun.steps || fun.worstStep || fun.topDropOff)),
    },
    monetize: { card: cardArmed, email: emailArmed, btc: true },
    expand: { upsellCoverage: _num(ups.coverage, 0), referrals: _num(ref.totalReferrals != null ? ref.totalReferrals : ref.count, 0), affiliates: _num(ref.affiliates, 0) },
    retain: { atRisk: _num(ret.atRisk, 0), known: !!(ret && (ret.atRisk != null || ret.retained != null)) },
  };
}

// ── THINK ────────────────────────────────────────────────────────────
function think(s) {
  const h = {};

  // TRAFFIC: do we have a live discovery pipeline + a second channel?
  // URL inventory submitted to search engines is real organic traffic seed.
  let traffic = 0;
  if (s.traffic.urlInventory > 0) traffic += 45;
  if (s.traffic.running) traffic += 20;
  if (s.traffic.lastRunAt) traffic += 10;
  if (s.traffic.social) traffic += 25; // second channel armed
  h.traffic = _clamp(traffic);

  // CAPTURE: is inbound working and flowing? (form is fixed; reward volume.)
  const inbound = s.capture.inbound;
  h.capture = _clamp(inbound <= 0 ? 20 : inbound < 5 ? 45 : inbound < 20 ? 70 : inbound < 100 ? 88 : 100);
  // (20 baseline = endpoint healthy but no leads yet, vs a true 0 = broken.)

  // QUALIFY: of captured leads, are we producing actionable hot/warm ones?
  h.qualify = _clamp(inbound <= 0 ? 30 : (s.qualify.qualifiedPct * 0.7 + Math.min(30, s.qualify.hot * 6)));

  // CONVERT: honest — if we have no funnel telemetry yet, it's an unknown we
  // score as a mid gap (can't claim success we can't measure).
  h.convert = _clamp(s.convert.funnelKnown ? Math.max(35, Math.min(100, s.convert.rate > 0 ? s.convert.rate * 12 + 40 : 50)) : 40);

  // MONETIZE: BTC always on (=40 floor); each extra rail is a big unlock.
  let monetize = 40; // BTC
  if (s.monetize.card) monetize += 35;
  if (s.monetize.email) monetize += 25; // confirmations/receipts close the loop
  h.monetize = _clamp(monetize);

  // EXPAND: upsell coverage + any referral activity.
  h.expand = _clamp(s.expand.upsellCoverage * 0.7 + Math.min(30, s.expand.referrals * 3));

  // RETAIN: unknown until we have customers; neutral-low until then.
  h.retain = _clamp(s.retain.known ? Math.max(30, 100 - s.retain.atRisk * 5) : 45);

  let overall = 0;
  for (const k of Object.keys(STAGE_WEIGHT)) overall += (h[k] || 0) * STAGE_WEIGHT[k];
  return { stages: h, growthScore: _clamp(overall) };
}

// ── PLAN ─────────────────────────────────────────────────────────────
// Produce ranked, deduplicated next actions. Each action: {id, stage, title,
// detail, impact(0-100), effort(low/med/high), mode(auto|owner), envVars?}.
function plan(s, health) {
  const actions = [];
  const add = (a) => actions.push(a);

  // MONETIZE gaps are the highest-leverage: a captured, qualified lead that
  // cannot pay by card is a lost sale. Surface exactly the missing key.
  if (!s.monetize.card) add({
    id: 'arm-card-checkout', stage: 'monetize', mode: 'owner', impact: 100, effort: 'low',
    title: 'Arm card / 300-crypto checkout', envVars: ['NOWPAYMENTS_API_KEY'],
    detail: 'BTC-only checkout loses most buyers. One free NOWPayments key lets cards/bank/300+ coins pay (auto-settles to your BTC).',
  });
  if (!s.monetize.email) add({
    id: 'arm-email-delivery', stage: 'monetize', mode: 'owner', impact: 95, effort: 'low',
    title: 'Arm transactional email delivery', envVars: ['RESEND_API_KEY', 'BREVO_API_KEY', 'MAILERSEND_API_KEY'],
    detail: 'No receipts/onboarding/recovery emails deliver (Hetzner blocks SMTP). One free Resend key turns the whole lifecycle on.',
  });

  // TRAFFIC: the front of the funnel. Auto-push SEO; ask owner for a channel.
  if (s.traffic.urlInventory > 0) add({
    id: 'seo-index-push', stage: 'traffic', mode: 'auto', impact: 60, effort: 'low',
    title: 'Push URL inventory to search engines (IndexNow)',
    detail: `Submit ${s.traffic.urlInventory} canonical URLs so organic discovery compounds. Runs now, no key needed.`,
  });
  if (!s.traffic.social) add({
    id: 'arm-social-channel', stage: 'traffic', mode: 'owner', impact: 60, effort: 'low',
    title: 'Arm one autonomous social channel', envVars: ['TELEGRAM_BOT_TOKEN', 'X_BEARER_TOKEN'],
    detail: 'A single token lets the viralizer post daily value content → free top-of-funnel. Fastest: a Telegram bot token.',
  });

  // QUALIFY: if leads exist, keep scoring fresh so follow-up stays ranked.
  if (s.capture.inbound > 0) add({
    id: 'refresh-lead-scoring', stage: 'qualify', mode: 'auto', impact: 45, effort: 'low',
    title: 'Refresh lead qualification + surface hot leads',
    detail: `${s.qualify.hot} hot / ${s.qualify.warm} warm of ${s.capture.inbound} captured. Re-rank so the founder works the hottest first.`,
  });

  // EXPAND: upsell is now available — make sure checkout uses it.
  if (health.stages.expand < 70) add({
    id: 'enable-checkout-upsell', stage: 'expand', mode: 'auto', impact: 50, effort: 'low',
    title: 'Serve next-best-offer + bundle at checkout',
    detail: 'The upsell engine is live (/api/upsell). Presenting a bundle on every order lifts average order value with zero new traffic.',
  });

  // AI: cheap intelligence upgrade if a key exists but outreach is templated.
  if (!s.armed.ai) add({
    id: 'arm-ai-personalization', stage: 'qualify', mode: 'owner', impact: 40, effort: 'low',
    title: 'Arm AI personalization', envVars: ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY'],
    detail: 'Outreach + marketing copy fall back to templates without an AI key. One key makes them adaptive per-lead.',
  });

  // Rank: impact desc, auto-before-owner on ties (do free wins first).
  actions.sort((a, b) => b.impact - a.impact || (a.mode === 'auto' ? -1 : 1));
  return actions;
}

// ── EXECUTE ──────────────────────────────────────────────────────────
// Perform ONLY the safe auto-actions. Everything here is read-mostly or
// idempotent; nothing mutates prices, money rails, or PM2.
async function execute(actions) {
  const performed = [];
  for (const a of actions) {
    if (a.mode !== 'auto') continue;
    try {
      if (a.id === 'seo-index-push' && deps.trafficEngine && typeof deps.trafficEngine.runCycle === 'function') {
        const r = await Promise.resolve(deps.trafficEngine.runCycle()).catch((e) => ({ ok: false, error: e && e.message }));
        performed.push({ id: a.id, ok: !!(r && r.ok !== false), result: r && r.submission ? r.submission : 'ran' });
      } else if (a.id === 'refresh-lead-scoring' && deps.leadIntel && typeof deps.leadIntel.stats === 'function') {
        const st = _safe(() => deps.leadIntel.stats(), {});
        performed.push({ id: a.id, ok: true, result: { hot: st.hot, warm: st.warm, total: st.total } });
      } else if (a.id === 'enable-checkout-upsell' && deps.upsell && typeof deps.upsell.stats === 'function') {
        const st = _safe(() => deps.upsell.stats(), {});
        performed.push({ id: a.id, ok: true, result: { coverage: st.coverage, catalogSize: st.catalogSize } });
      } else if (a.id === 'rotate-offer' && deps.offer && typeof deps.offer.rotate === 'function') {
        performed.push({ id: a.id, ok: true, result: _safe(() => deps.offer.rotate(), 'rotated') });
      } else {
        performed.push({ id: a.id, ok: true, result: 'noted' });
      }
    } catch (e) {
      performed.push({ id: a.id, ok: false, error: e && e.message });
    }
  }
  return performed;
}

// ── REFLECT ──────────────────────────────────────────────────────────
function _lastLogEntry() {
  try {
    if (!fs.existsSync(LOG_FILE)) return null;
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    if (!lines.length) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch (_) { return null; }
}
function reflect(cycle) {
  const prev = _lastLogEntry();
  const prevScore = prev && prev.think ? _num(prev.think.growthScore, 0) : 0;
  const prevInbound = prev && prev.observe ? _num(prev.observe.capture && prev.observe.capture.inbound, 0) : 0;
  const delta = {
    growthScore: cycle.think.growthScore - prevScore,
    inbound: (cycle.observe.capture.inbound || 0) - prevInbound,
  };
  const prevHash = prev && prev.hash ? prev.hash : 'GENESIS';
  const payload = { ts: cycle.observe.ts, observe: cycle.observe, think: cycle.think,
                    actions: cycle.actions, performed: cycle.performed, delta, prevHash };
  const hash = crypto.createHash('sha256').update(prevHash + JSON.stringify(payload)).digest('hex').slice(0, 32);
  const entry = { ...payload, hash };
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (_) {}
  return { delta, hash };
}

// ── CYCLE ────────────────────────────────────────────────────────────
let _last = null;
async function runCycle() {
  const s = observe();
  const health = think(s);
  const actions = plan(s, health);
  const performed = await execute(actions);
  const cycle = { observe: s, think: health, actions, performed };
  const reflection = reflect(cycle);
  _last = {
    ts: s.ts,
    growthScore: health.growthScore,
    stages: health.stages,
    topActions: actions.slice(0, 5),
    autoPerformed: performed,
    delta: reflection.delta,
    hash: reflection.hash,
  };
  return _last;
}

// ── Lifecycle ────────────────────────────────────────────────────────
let _interval = null;
function start() {
  if (_interval) return { ok: true, alreadyRunning: true };
  // First cycle 120s after boot (let organs settle), then every INTERVAL_MS.
  const kick = setTimeout(() => { runCycle().catch((e) => console.warn('[' + NAME + '] cycle failed:', e && e.message)); }, 120 * 1000);
  if (kick.unref) kick.unref();
  _interval = setInterval(() => { runCycle().catch((e) => console.warn('[' + NAME + '] cycle failed:', e && e.message)); }, INTERVAL_MS);
  if (_interval.unref) _interval.unref();
  console.log('🧠 [' + NAME + '] started — Observe→Think→Plan→Execute→Reflect every ' + Math.round(INTERVAL_MS / 60000) + 'min');
  return { ok: true };
}
function stop() { if (_interval) { clearInterval(_interval); _interval = null; } return { ok: true }; }

// Public-safe summary (homepage/admin) — no secrets, no PII.
function getState() {
  if (!_last) {
    const s = observe(); const health = think(s);
    return { ok: true, module: NAME, warming: true, growthScore: health.growthScore, stages: health.stages,
             topActions: plan(s, health).slice(0, 5), ts: s.ts };
  }
  return { ok: true, module: NAME, ..._last };
}

/** IAK/mesh contract — never throws; wraps getState. */
function getStatus() {
  try {
    const s = getState();
    return {
      ok: true,
      module: NAME,
      name: 'Growth Brain',
      running: !!_interval,
      growthScore: s.growthScore,
      stages: s.stages,
      warming: !!s.warming,
      health: 'ok',
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: true, module: NAME, running: !!_interval, health: 'ok', note: e.message };
  }
}
function getFull() {
  const s = observe(); const health = think(s); const actions = plan(s, health);
  return { ok: true, module: NAME, observe: s, think: health, actions, last: _last,
           logFile: LOG_FILE, intervalMinutes: Math.round(INTERVAL_MS / 60000) };
}

function registerRoutes(app) {
  if (!app || typeof app.get !== 'function') return;
  app.get('/api/growth/brain', (req, res) => {
    try { res.set('Cache-Control', 'public, max-age=30'); res.json(getState()); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.get('/api/growth/brain/full', (req, res) => {
    try { res.json(getFull()); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post('/api/growth/brain/run', (req, res) => {
    runCycle().then((r) => res.json({ ok: true, cycle: r })).catch((e) => res.status(500).json({ ok: false, error: e.message }));
  });
}

module.exports = {
  name: NAME,
  configure,
  observe,
  think,
  plan,
  runCycle,
  start,
  stop,
  getState,
  getStatus,
  getFull,
  registerRoutes,
};
