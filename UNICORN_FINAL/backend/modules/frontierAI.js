// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// frontierAI.js — Frontier AI capability router.
//
// Tracks the AI models/providers ZeusAI can reach, scores how much of the
// autonomy surface they cover, and exposes a tiny, dependency-free tick loop
// so it can be driven either in-process (registerModuleRoutes) or as a
// standalone PM2 autonomous runner (scripts/zeus-module-autonomous.js).
//
// Design constraints (intentional):
//   • NO network calls required for process({action:'tick'}). Scoring is
//     computed purely from the local provider registry so it is safe to run
//     on a 60s heartbeat without hammering third-party APIs.
//   • Lightweight state persisted to data/frontier-ai/state.json. Writes are
//     best-effort and never throw into the caller.
//   • Public surface: { getStatus, process, start, stop }.

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
const PROVIDER_REGISTRY = [
  {
    id: 'openai',
    label: 'OpenAI',
    envKeys: ['OPENAI_API_KEY'],
    models: ['gpt-4o', 'o3', 'gpt-4o-mini'],
    capabilities: ['reasoning', 'code', 'vision', 'embeddings', 'speech'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    envKeys: ['ANTHROPIC_API_KEY'],
    models: ['claude-opus', 'claude-sonnet', 'claude-haiku'],
    capabilities: ['reasoning', 'code', 'vision'],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    envKeys: ['DEEPSEEK_API_KEY'],
    models: ['deepseek-r1', 'deepseek-chat'],
    capabilities: ['reasoning', 'code', 'forecasting'],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    models: ['gemini-2.0-pro', 'gemini-2.0-flash'],
    capabilities: ['reasoning', 'code', 'vision', 'embeddings'],
  },
  {
    id: 'local',
    label: 'Local Heuristics',
    envKeys: [], // always available — deterministic, no key required
    models: ['zeus-heuristic-v1'],
    capabilities: ['negotiation', 'forecasting'],
  },
];

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
    history: [], // capped list of { ts, score, enabledProviders }
  };
}

function _loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return { ..._defaultState(), ...parsed };
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

// Compute autonomy coverage from the (offline) provider registry.
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

function _listProviders() {
  return PROVIDER_REGISTRY.map((p) => ({
    id: p.id,
    label: p.label,
    enabled: _providerEnabled(p),
    models: p.models.slice(),
    capabilities: p.capabilities.slice(),
  }));
}

function score() {
  const result = _computeScore();
  _state.lastScore = result.score;
  _state.lastCoveredDomains = result.coveredDomains;
  _state.lastGapDomains = result.gapDomains;
  _state.updatedAt = new Date().toISOString();
  return result;
}

function tick() {
  const result = score();
  _state.ticks += 1;
  _state.history.push({
    ts: _state.updatedAt,
    score: result.score,
    enabledProviders: result.enabledProviders.length,
  });
  if (_state.history.length > 200) _state.history = _state.history.slice(-200);
  _saveState(_state);
  return { ok: true, action: 'tick', ticks: _state.ticks, ...result };
}

function getStatus() {
  const live = _computeScore();
  return {
    module: 'frontierAI',
    name: 'Frontier AI Capability Router',
    status: 'active',
    ticks: _state.ticks,
    autonomyCoverage: live.score,
    coveredDomains: live.coveredDomains,
    gapDomains: live.gapDomains,
    enabledProviders: live.enabledProviders,
    totalProviders: live.totalProviders,
    domains: CAPABILITY_DOMAINS.slice(),
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
    case 'status':
      return getStatus();
    default:
      return { ok: false, error: `unknown action: ${action}`, supported: ['tick', 'score', 'list', 'status'] };
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
  start,
  stop,
  CAPABILITY_DOMAINS,
};
