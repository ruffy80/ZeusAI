// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// frontierAI.js — Frontier AI capability router.
//
// Tracks the AI models/providers ZeusAI can reach, scores how much of the
// autonomy surface they cover, and — crucially — decides WHICH provider+model
// should serve a given capability domain, with graceful fallbacks. It also
// records real usage outcomes (success/fail/latency) so routing improves over
// time. Drivable in-process (registerModuleRoutes) or as a standalone PM2
// autonomous runner (scripts/zeus-module-autonomous.js).
//
// Design constraints (intentional):
//   • NO network calls required for process({action:'tick'}). Scoring and
//     routing are computed purely from the local provider registry + observed
//     usage so it is safe to run on a 60s heartbeat.
//   • A tick MAY soft-probe the local `aiProviders` module (require in a
//     try/catch) to reconcile which providers are configured — this is an
//     in-process, env-only read and performs NO network I/O.
//   • Lightweight state persisted to data/frontier-ai/state.json. Writes are
//     best-effort and never throw into the caller.
//   • Public surface: { getStatus, process, start, stop } (+ helpers).

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', '..', 'data', 'frontier-ai');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// Capability domains that make up "autonomy coverage". Each provider below
// advertises which of these it can serve; the coverage score is the fraction
// of domains served by at least one enabled provider.
const CAPABILITY_DOMAINS = [
  'reasoning',
  'code',
  'vision',
  'embeddings',
  'speech',
  'negotiation',
  'forecasting',
];

// Static, offline provider registry. Availability is derived from whether the
// matching API key is present in the environment — no network probe needed.
//   • priority  — base quality/preference weight (higher = preferred).
//   • strengths — domains where the provider is class-leading (routing bonus).
const PROVIDER_REGISTRY = [
  {
    id: 'openai',
    label: 'OpenAI',
    envKeys: ['OPENAI_API_KEY'],
    models: ['gpt-4o', 'o3', 'gpt-4o-mini'],
    capabilities: ['reasoning', 'code', 'vision', 'embeddings', 'speech'],
    priority: 95,
    strengths: ['reasoning', 'speech', 'embeddings'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    envKeys: ['ANTHROPIC_API_KEY'],
    models: ['claude-opus', 'claude-sonnet', 'claude-haiku'],
    capabilities: ['reasoning', 'code', 'vision'],
    priority: 92,
    strengths: ['reasoning', 'code'],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    envKeys: ['DEEPSEEK_API_KEY'],
    models: ['deepseek-r1', 'deepseek-chat'],
    capabilities: ['reasoning', 'code', 'forecasting'],
    priority: 82,
    strengths: ['code', 'forecasting'],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    models: ['gemini-2.0-pro', 'gemini-2.0-flash'],
    capabilities: ['reasoning', 'code', 'vision', 'embeddings'],
    priority: 85,
    strengths: ['vision', 'embeddings'],
  },
  {
    id: 'local',
    label: 'Local Heuristics',
    envKeys: [], // always available — deterministic, no key required
    models: ['zeus-heuristic-v1'],
    capabilities: ['negotiation', 'forecasting'],
    priority: 40,
    strengths: ['negotiation'],
  },
];

// Extra provider ids that `aiProviders` may report as configured; map them into
// our coverage picture even if they are not first-class registry entries.
const PROBE_ID_ALIASES = {
  gemini: 'google',
  xai: 'local',
};

const USAGE_DECAY = 0.9; // per-tick multiplicative decay applied to usage tallies

function _providerEnabled(provider) {
  if (!provider.envKeys || provider.envKeys.length === 0) return true;
  return provider.envKeys.some((k) => {
    const v = process.env[k];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

function _defaultState() {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ticks: 0,
    lastScore: 0,
    lastCoveredDomains: [],
    lastGapDomains: [],
    usage: {},              // providerId → { calls, ok, fail, totalLatencyMs, lastUsedAt }
    domainUsage: {},        // domain → { calls, ok, fail }
    lastRecommendations: [], // capped list of { at, domain, provider, model, reason }
    probe: { source: null, configured: [], at: null },
    history: [],            // capped list of { ts, score, enabledProviders, health }
  };
}

function _loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const merged = { ..._defaultState(), ...parsed };
      merged.usage = { ...(parsed.usage || {}) };
      merged.domainUsage = { ...(parsed.domainUsage || {}) };
      merged.probe = { ..._defaultState().probe, ...(parsed.probe || {}) };
      return merged;
    }
  } catch (_) { /* cold start */ }
  return _defaultState();
}

function _saveState(state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (_) {
    return false; // best-effort; read-only FS should never crash a tick
  }
}

let _state = _loadState();
let _timer = null;

function _usageFor(providerId) {
  const u = _state.usage[providerId];
  if (!u) return { calls: 0, ok: 0, fail: 0, totalLatencyMs: 0, lastUsedAt: null };
  return u;
}

function _successRate(providerId) {
  const u = _usageFor(providerId);
  if (!u.calls) return null; // unknown — no observed data yet
  return u.ok / u.calls;
}

function _avgLatency(providerId) {
  const u = _usageFor(providerId);
  if (!u.calls) return null;
  return Math.round(u.totalLatencyMs / u.calls);
}

// Compute autonomy coverage from the (offline) provider registry, blended with
// any providers `aiProviders` reports as configured during a soft probe.
function _computeScore() {
  const enabled = PROVIDER_REGISTRY.filter(_providerEnabled);
  const covered = new Set();
  for (const p of enabled) {
    for (const c of p.capabilities) covered.add(c);
  }
  const coveredDomains = CAPABILITY_DOMAINS.filter((d) => covered.has(d));
  const gapDomains = CAPABILITY_DOMAINS.filter((d) => !covered.has(d));
  const score = Math.round((coveredDomains.length / CAPABILITY_DOMAINS.length) * 100);
  return {
    score,
    coveredDomains,
    gapDomains,
    enabledProviders: enabled.map((p) => p.id),
    totalProviders: PROVIDER_REGISTRY.length,
  };
}

function _health(score, enabledCount) {
  if (score >= 85 && enabledCount >= 2) return 'excellent';
  if (score >= 55 && enabledCount >= 1) return 'good';
  return 'degraded';
}

function _listProviders() {
  return PROVIDER_REGISTRY.map((p) => {
    const u = _usageFor(p.id);
    const rate = _successRate(p.id);
    return {
      id: p.id,
      label: p.label,
      enabled: _providerEnabled(p),
      priority: p.priority,
      models: p.models.slice(),
      capabilities: p.capabilities.slice(),
      strengths: p.strengths.slice(),
      usageStats: {
        calls: Math.round(u.calls * 100) / 100,
        ok: Math.round(u.ok * 100) / 100,
        fail: Math.round(u.fail * 100) / 100,
        successRate: rate == null ? null : Math.round(rate * 100) / 100,
        avgLatencyMs: _avgLatency(p.id),
        lastUsedAt: u.lastUsedAt || null,
      },
    };
  });
}

// Score a provider for a domain: base priority, strength bonus, and an
// observed-usage adjustment (reward reliable providers, penalise slow/failing).
function _scoreProviderForDomain(provider, domain) {
  let s = provider.priority;
  if (provider.strengths.includes(domain)) s += 12;
  const rate = _successRate(provider.id);
  if (rate != null) {
    s += (rate - 0.5) * 30; // ±15 based on observed reliability
    const avg = _avgLatency(provider.id);
    if (avg != null && avg > 0) s -= Math.min(10, avg / 500); // gentle latency penalty
  }
  return Math.round(s * 100) / 100;
}

function _rankedForDomain(domain) {
  return PROVIDER_REGISTRY
    .filter((p) => _providerEnabled(p) && p.capabilities.includes(domain))
    .map((p) => ({ provider: p, score: _scoreProviderForDomain(p, domain) }))
    .sort((a, b) => b.score - a.score);
}

function _normalizeDomain(domain) {
  const d = String(domain || '').trim().toLowerCase();
  return CAPABILITY_DOMAINS.includes(d) ? d : 'reasoning';
}

// Pick the best enabled provider+model for a domain, with a human reason.
function recommend(input = {}) {
  const domain = _normalizeDomain(input.domain);
  const task = input.task ? String(input.task).slice(0, 200) : null;
  const ranked = _rankedForDomain(domain);

  if (!ranked.length) {
    // No enabled provider serves this domain — fall back to local heuristics
    // (always available) so autonomy never fully stalls.
    const local = PROVIDER_REGISTRY.find((p) => p.id === 'local');
    const rec = {
      ok: true,
      action: 'recommend',
      domain,
      task,
      provider: local.id,
      model: local.models[0],
      reason: `no keyed provider covers "${domain}"; falling back to local heuristics`,
      score: local.priority,
      degraded: true,
      alternatives: [],
    };
    _recordRecommendation(rec);
    return rec;
  }

  const best = ranked[0];
  const rate = _successRate(best.provider.id);
  const reasonBits = [`highest routing score ${best.score} for "${domain}"`];
  if (best.provider.strengths.includes(domain)) reasonBits.push('class-leading in this domain');
  if (rate != null) reasonBits.push(`observed success rate ${Math.round(rate * 100)}%`);
  const rec = {
    ok: true,
    action: 'recommend',
    domain,
    task,
    provider: best.provider.id,
    model: best.provider.models[0],
    reason: reasonBits.join('; '),
    score: best.score,
    degraded: false,
    alternatives: ranked.slice(1, 4).map((r) => ({
      provider: r.provider.id,
      model: r.provider.models[0],
      score: r.score,
    })),
  };
  _recordRecommendation(rec);
  return rec;
}

function _recordRecommendation(rec) {
  _state.lastRecommendations.unshift({
    at: new Date().toISOString(),
    domain: rec.domain,
    provider: rec.provider,
    model: rec.model,
    reason: rec.reason,
  });
  if (_state.lastRecommendations.length > 20) {
    _state.lastRecommendations = _state.lastRecommendations.slice(0, 20);
  }
}

// Return a full routing plan for a domain: primary provider+model plus an
// ordered fallback chain and the current coverage picture.
function route(input = {}) {
  const domain = _normalizeDomain(input.domain);
  const promptMeta = input.promptMeta && typeof input.promptMeta === 'object' ? input.promptMeta : {};
  const ranked = _rankedForDomain(domain);
  const live = _computeScore();
  const covered = live.coveredDomains.includes(domain);

  if (!ranked.length) {
    const local = PROVIDER_REGISTRY.find((p) => p.id === 'local');
    return {
      ok: true,
      action: 'route',
      domain,
      provider: local.id,
      model: local.models[0],
      fallbacks: [],
      coverage: { domainCovered: false, autonomyCoverage: live.score },
      promptMeta,
      degraded: true,
    };
  }

  const primary = ranked[0];
  return {
    ok: true,
    action: 'route',
    domain,
    provider: primary.provider.id,
    model: primary.provider.models[0],
    fallbacks: ranked.slice(1).map((r) => ({
      provider: r.provider.id,
      model: r.provider.models[0],
      score: r.score,
    })),
    coverage: { domainCovered: covered, autonomyCoverage: live.score },
    promptMeta,
    degraded: false,
  };
}

// Record a real usage outcome so routing can adapt to observed reliability.
function recordUsage(input = {}) {
  const provider = String(input.provider || '').trim().toLowerCase();
  if (!provider) return { ok: false, error: 'provider required' };
  const ok = input.ok !== false; // default success unless explicitly false
  const latencyMs = Math.max(0, Number(input.latencyMs) || 0);
  const domain = input.domain ? _normalizeDomain(input.domain) : null;

  const u = _state.usage[provider] || { calls: 0, ok: 0, fail: 0, totalLatencyMs: 0, lastUsedAt: null };
  u.calls += 1;
  if (ok) u.ok += 1; else u.fail += 1;
  u.totalLatencyMs += latencyMs;
  u.lastUsedAt = new Date().toISOString();
  _state.usage[provider] = u;

  if (domain) {
    const d = _state.domainUsage[domain] || { calls: 0, ok: 0, fail: 0 };
    d.calls += 1;
    if (ok) d.ok += 1; else d.fail += 1;
    _state.domainUsage[domain] = d;
  }

  _state.updatedAt = new Date().toISOString();
  _saveState(_state);
  return {
    ok: true,
    action: 'usage',
    provider,
    usage: {
      calls: Math.round(u.calls * 100) / 100,
      ok: Math.round(u.ok * 100) / 100,
      fail: Math.round(u.fail * 100) / 100,
      successRate: u.calls ? Math.round((u.ok / u.calls) * 100) / 100 : null,
      avgLatencyMs: u.calls ? Math.round(u.totalLatencyMs / u.calls) : null,
    },
  };
}

function score() {
  const result = _computeScore();
  _state.lastScore = result.score;
  _state.lastCoveredDomains = result.coveredDomains;
  _state.lastGapDomains = result.gapDomains;
  _state.updatedAt = new Date().toISOString();
  return result;
}

// Soft-probe the in-process aiProviders module (env-only read, NO network) to
// reconcile which providers are configured. Fail-soft: absence is fine.
function _softProbe() {
  try {
    const ai = require('./aiProviders');
    if (ai && typeof ai.getStatus === 'function') {
      const rows = ai.getStatus() || [];
      const configured = rows
        .filter((r) => r && r.configured)
        .map((r) => PROBE_ID_ALIASES[r.provider] || r.provider);
      _state.probe = {
        source: 'aiProviders',
        configured: Array.from(new Set(configured)),
        at: new Date().toISOString(),
      };
      return _state.probe;
    }
  } catch (_) { /* module absent — fine */ }
  _state.probe = { source: null, configured: [], at: new Date().toISOString() };
  return _state.probe;
}

// Apply gentle decay to usage tallies so stale outcomes fade and recent
// behaviour dominates routing. Entries that decay to ~0 are dropped.
function _decayUsage() {
  for (const id of Object.keys(_state.usage)) {
    const u = _state.usage[id];
    u.calls *= USAGE_DECAY;
    u.ok *= USAGE_DECAY;
    u.fail *= USAGE_DECAY;
    u.totalLatencyMs *= USAGE_DECAY;
    if (u.calls < 0.05) {
      delete _state.usage[id];
    } else {
      u.calls = Math.round(u.calls * 1000) / 1000;
      u.ok = Math.round(u.ok * 1000) / 1000;
      u.fail = Math.round(u.fail * 1000) / 1000;
      u.totalLatencyMs = Math.round(u.totalLatencyMs);
    }
  }
}

function tick() {
  const result = score();
  _decayUsage();
  _softProbe();
  _state.ticks += 1;
  const health = _health(result.score, result.enabledProviders.length);
  _state.history.push({
    ts: _state.updatedAt,
    score: result.score,
    enabledProviders: result.enabledProviders.length,
    health,
  });
  if (_state.history.length > 200) _state.history = _state.history.slice(-200);
  _saveState(_state);
  return { ok: true, action: 'tick', ticks: _state.ticks, health, ...result };
}

function getStatus() {
  const live = _computeScore();
  const health = _health(live.score, live.enabledProviders.length);
  return {
    module: 'frontierAI',
    name: 'Frontier AI Capability Router',
    status: 'active',
    health,
    ticks: _state.ticks,
    autonomyCoverage: live.score,
    coveredDomains: live.coveredDomains,
    gaps: live.gapDomains,
    gapDomains: live.gapDomains, // back-compat alias
    enabledProviders: live.enabledProviders,
    totalProviders: live.totalProviders,
    domains: CAPABILITY_DOMAINS.slice(),
    providers: _listProviders(),
    lastRecommendations: _state.lastRecommendations.slice(0, 5),
    probe: _state.probe,
    createdAt: _state.createdAt,
    updatedAt: _state.updatedAt,
  };
}

// NOTE: named runAction (not `process`) to avoid shadowing Node's global
// `process` object inside this module scope. Exported below as `process`.
async function runAction(input = {}) {
  const action = (input && input.action) || 'tick';
  switch (action) {
    case 'tick':
      return tick();
    case 'score': {
      const result = score();
      _saveState(_state);
      return { ok: true, action: 'score', ...result };
    }
    case 'list':
      return { ok: true, action: 'list', providers: _listProviders(), domains: CAPABILITY_DOMAINS.slice() };
    case 'recommend':
      return recommend(input);
    case 'route':
      return route(input);
    case 'usage':
      return recordUsage(input);
    case 'status':
      return getStatus();
    default:
      return {
        ok: false,
        error: `unknown action: ${action}`,
        supported: ['tick', 'score', 'list', 'recommend', 'route', 'usage', 'status'],
      };
  }
}

// start()/stop() let a standalone runner keep the module alive without opening
// an Express server. opts.apply is accepted for interface symmetry with other
// modules but has no destructive effect here.
function start(opts = {}) {
  const intervalMs = Number(opts.intervalMs) > 0 ? Number(opts.intervalMs) : 60_000;
  tick();
  if (!_timer) {
    _timer = setInterval(() => {
      try { tick(); } catch (_) { /* keep alive */ }
    }, intervalMs);
    if (typeof _timer.unref === 'function') _timer.unref();
  }
  return { applied: false, started: true, intervalMs, status: getStatus() };
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  return { stopped: true };
}

module.exports = {
  name: 'frontierAI',
  getStatus,
  process: runAction,
  score,
  tick,
  recommend,
  route,
  recordUsage,
  start,
  stop,
  CAPABILITY_DOMAINS,
  PROVIDER_REGISTRY,
};
