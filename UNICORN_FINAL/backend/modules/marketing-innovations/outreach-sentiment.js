// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/outreach-sentiment.js
//
// Three small additive sub-engines combined:
//
//  1. outreach.draftEmail / draftDM / draftPressRelease — generate
//     ready-to-send drafts (NEVER auto-send) for influencer/PR/sales
//     outreach with personalization slots and follow-up sequences.
//
//  2. sentiment.score(text) — lexicon-based sentiment scoring that
//     prefers the locally-installed `sentiment` npm package when present
//     and falls back to a tiny built-in lexicon for tests/offline use.
//
//  3. experiments.register / list / record — a tiny growth-experiments
//     registry (hypothesis, metric, status) persisted in-memory.
//
// All operations are pure functions or in-memory state. No outbound IO.
// =====================================================================

'use strict';

let _sentimentLib = null;
try { const Sentiment = require('sentiment'); _sentimentLib = new Sentiment(); } catch (_) { _sentimentLib = null; }

// ── 1. Outreach drafts ─────────────────────────────────────────────────
function _firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || 'there';
}

function draftEmail(opts) {
  const o = opts || {};
  const persona = String(o.persona || 'founder');
  const product = String(o.product || 'Unicorn — autonomous SaaS platform');
  const yourName = String(o.fromName || 'Vladoi Ionut');
  const recipientName = _firstName(o.toName);
  const company = String(o.company || 'your team');
  const valueProp = String(o.valueProp || 'help you grow MRR autonomously without hiring');
  const cta = String(o.cta || 'Could I send a 90-second demo video?');
  const subject = `Quick idea for ${company} — ${valueProp.slice(0, 40)}`;
  const body = [
    `Hi ${recipientName},`,
    '',
    `I noticed ${company} is doing strong work in your space. I built ${product} that can ${valueProp}.`,
    '',
    `Concretely: we generate omni-channel content variants, A/B test them autonomously, attribute revenue back to channels, and run an affiliate program that pays out in BTC.`,
    '',
    cta,
    '',
    'Best,',
    yourName,
  ].join('\n');
  const followUps = [
    { offsetDays: 3, subject: `Re: ${subject}`, body: `Hi ${recipientName}, just bumping this in case it slipped. No worries either way — short demo here when you're ready.` },
    { offsetDays: 7, subject: `Last note — ${valueProp.slice(0, 30)}`, body: `Hi ${recipientName}, closing this thread out. Happy to circle back later if priorities change.` },
  ];
  return { persona, subject, body, followUps, generatedAt: new Date().toISOString() };
}

function draftDM(opts) {
  const o = opts || {};
  const handle = String(o.handle || 'there');
  const note = String(o.note || 'really enjoyed your last post.');
  const valueProp = String(o.valueProp || 'autonomous marketing for your audience');
  return {
    text: `hey @${handle.replace(/^@/, '')} — ${note} built something around ${valueProp}, would love your honest take if you've got 60 seconds. no pitch.`,
    generatedAt: new Date().toISOString(),
  };
}

function draftPressRelease(opts) {
  const o = opts || {};
  const company = String(o.company || 'Unicorn');
  const headline = String(o.headline || 'Launches Autonomous SaaS Marketing Agent');
  const city = String(o.city || 'Bucharest, Romania');
  const date = (o.date ? new Date(o.date) : new Date()).toISOString().slice(0, 10);
  const summary = String(o.summary || 'a self-running growth engine that creates, tests, attributes and monetizes content across every major channel.');
  const quote = String(o.quote || 'We are building the marketing standard for the next 50 years.');
  const quoteBy = String(o.quoteBy || 'Vladoi Ionut, Founder');
  return {
    title: `${company} ${headline}`,
    body: [
      `${city.toUpperCase()} — ${date} — ${company} today announced ${headline}, ${summary}`,
      '',
      `"${quote}" said ${quoteBy}.`,
      '',
      `About ${company}: An autonomous SaaS platform built around self-healing AI agents that generate, deploy, and monetize software 24/7.`,
      '',
      'Contact: vladoi_ionut@yahoo.com',
    ].join('\n'),
    generatedAt: new Date().toISOString(),
  };
}

// ── 2. Sentiment ────────────────────────────────────────────────────────
const _miniLex = {
  amazing: 4, awesome: 4, love: 3, great: 3, good: 2, nice: 2, helpful: 2, fast: 1, cool: 1,
  bad: -2, terrible: -4, awful: -4, hate: -3, broken: -3, slow: -1, scam: -4, spam: -3, useless: -3,
};

function score(text) {
  const t = String(text || '');
  if (_sentimentLib) {
    const r = _sentimentLib.analyze(t);
    return {
      score: r.score,
      comparative: r.comparative,
      tokens: r.tokens.length,
      positive: r.positive,
      negative: r.negative,
      label: r.score > 0 ? 'positive' : (r.score < 0 ? 'negative' : 'neutral'),
      engine: 'sentiment',
    };
  }
  const tokens = t.toLowerCase().split(/\W+/).filter(Boolean);
  let s = 0; const positive = []; const negative = [];
  for (const w of tokens) {
    if (_miniLex[w] != null) {
      s += _miniLex[w];
      (_miniLex[w] > 0 ? positive : negative).push(w);
    }
  }
  return {
    score: s,
    comparative: tokens.length ? s / tokens.length : 0,
    tokens: tokens.length,
    positive, negative,
    label: s > 0 ? 'positive' : (s < 0 ? 'negative' : 'neutral'),
    engine: 'mini',
  };
}

// ── 3. Experiments registry ─────────────────────────────────────────────
const _experiments = new Map();

function register(opts) {
  const o = opts || {};
  if (!o.name) return { ok: false, error: 'name_required' };
  const id = 'EXP-' + String(o.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32) + '-' + Date.now().toString(36);
  const exp = {
    id,
    name: String(o.name).slice(0, 128),
    hypothesis: String(o.hypothesis || '').slice(0, 1024),
    primaryMetric: String(o.primaryMetric || 'conversion_rate').slice(0, 64),
    targetLift: Number(o.targetLift || 0.1),
    status: 'running',
    createdAt: new Date().toISOString(),
    observations: [],
  };
  _experiments.set(id, exp);
  return { ok: true, experiment: exp };
}

function recordObservation(id, opts) {
  const e = _experiments.get(String(id));
  if (!e) return { ok: false, error: 'unknown_experiment' };
  const o = opts || {};
  const obs = {
    ts: new Date().toISOString(),
    variant: String(o.variant || 'control'),
    metricValue: Number(o.metricValue || 0),
    n: Math.max(1, Number(o.n || 1)),
  };
  e.observations.push(obs);
  if (e.observations.length > 1000) e.observations = e.observations.slice(-1000);
  return { ok: true, observation: obs };
}

function listExperiments() {
  return Array.from(_experiments.values()).map((e) => ({
    ...e,
    observationCount: e.observations.length,
    observations: e.observations.slice(-10),
  }));
}

function closeExperiment(id, status) {
  const e = _experiments.get(String(id));
  if (!e) return { ok: false, error: 'unknown_experiment' };
  e.status = String(status || 'completed').slice(0, 16);
  e.closedAt = new Date().toISOString();
  return { ok: true, experiment: e };
}

function _resetForTests() {
  _experiments.clear();
}

module.exports = {
  draftEmail,
  draftDM,
  draftPressRelease,
  score,
  register,
  recordObservation,
  listExperiments,
  closeExperiment,
  _resetForTests,
};
