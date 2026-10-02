'use strict';

/**
 * Model Lease OS — MLO/1.0
 *
 * UAIC and the multi-model router pin model ids in source. A model that
 * ships tomorrow never gets called until someone edits the file.
 *
 * This lease reads the public OpenRouter catalog (no key required) and
 * keeps the single id the next call should use: the newest row that fits
 * a prompt-price ceiling. OPENROUTER_MODEL still wins when the owner pins
 * one id. A call is sent only when OPENROUTER_API_KEY is a real secret.
 *
 * inventsModels and inventsCalls stay false. An empty catalog is not a model.
 */

const PROTOCOL = 'MLO/1.0';
const NAME = 'model-lease-os';
const CATALOG_URL = 'https://openrouter.ai/api/v1/models';
const COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

const state = {
  refreshedAt: null,
  catalogCount: 0,
  models: [],
  lease: null,
  lastError: null,
  calls: 0,
  lastCallAt: null,
};

function keyArmed() {
  const k = String(process.env.OPENROUTER_API_KEY || '').trim();
  if (k.length < 20) return false;
  if (/your_|changeme|placeholder|example|xxxx/i.test(k)) return false;
  return true;
}

function maxPromptUsdPerMillion() {
  const n = Number(process.env.MODEL_LEASE_MAX_PROMPT_USD);
  if (Number.isFinite(n) && n > 0) return n;
  return 1;
}

function _perMillion(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * 1e6;
}

function pickFrom(models) {
  const list = Array.isArray(models) ? models : [];
  const cap = maxPromptUsdPerMillion();
  const lane = String(process.env.MODEL_LEASE_LANE || 'current').toLowerCase();
  const pinned = String(process.env.OPENROUTER_MODEL || '').trim();
  if (pinned) {
    const hit = list.find((m) => m.id === pinned);
    if (hit) {
      return {
        id: hit.id,
        lane: 'pinned',
        why: 'OPENROUTER_MODEL is set. The lease uses that id and does not outrank it.',
        promptPerM: hit.promptPerM,
        context: hit.context,
      };
    }
  }
  let pool = list.filter((m) => m.context >= 32000 && m.promptPerM != null && m.promptPerM <= cap);
  if (!pool.length) pool = list.filter((m) => m.promptPerM != null && m.promptPerM <= cap);
  if (!pool.length) return null;
  if (lane === 'value') {
    pool.sort((a, b) => (a.promptPerM - b.promptPerM) || (b.context - a.context) || (b.created - a.created));
  } else {
    pool.sort((a, b) => (b.created - a.created) || (b.context - a.context) || (a.promptPerM - b.promptPerM));
  }
  const best = pool[0];
  return {
    id: best.id,
    lane: lane === 'value' ? 'value' : 'current',
    why: lane === 'value'
      ? 'Lowest published prompt price under the ceiling.'
      : 'Newest catalog row under the price ceiling. A model that did not exist at deploy time can win the next call.',
    promptPerM: Math.round(best.promptPerM * 1000) / 1000,
    context: best.context,
    created: best.created,
  };
}

function ingest(list) {
  const out = [];
  for (const m of list || []) {
    if (!m || !m.id) continue;
    const pricing = m.pricing || {};
    out.push({
      id: String(m.id),
      name: m.name || m.id,
      created: Number(m.created) || 0,
      context: Number(m.context_length) || 0,
      promptPerM: _perMillion(pricing.prompt),
    });
  }
  state.models = out;
  state.catalogCount = out.length;
  state.refreshedAt = new Date().toISOString();
  state.lease = pickFrom(out);
  state.lastError = null;
  return discovery();
}

async function refresh(fetchImpl) {
  const fetchFn = fetchImpl || global.fetch;
  if (typeof fetchFn !== 'function') {
    state.lastError = 'fetch_unavailable';
    return discovery();
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetchFn(CATALOG_URL, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'ZeusAI-ModelLease/1.0' },
    });
    if (!res.ok) {
      state.lastError = 'catalog_http_' + res.status;
      return discovery();
    }
    const body = await res.json();
    return ingest(body && (body.data || body.models) || []);
  } catch (e) {
    state.lastError = (e && e.name === 'AbortError') ? 'timeout' : ((e && e.message) || 'catalog_failed');
    return discovery();
  } finally {
    clearTimeout(timer);
  }
}

function currentModelId() {
  return state.lease && state.lease.id ? state.lease.id : null;
}

function discovery() {
  const armed = keyArmed();
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    inventsModels: false,
    inventsCalls: false,
    callsUnarmed: false,
    armed,
    secret: armed ? null : 'OPENROUTER_API_KEY',
    catalogUrl: CATALOG_URL,
    catalogCount: state.catalogCount,
    refreshedAt: state.refreshedAt,
    lastError: state.lastError,
    lease: state.lease,
    maxPromptUsdPerMillion: maxPromptUsdPerMillion(),
    calls: state.calls,
    lastCallAt: state.lastCallAt,
    note: armed
      ? 'UAIC, the multi-model router, and the OpenRouter provider call the leased id. A catalog refresh adopts models that appear after this deploy, inside the price ceiling.'
      : 'The public catalog can be read with no key. No completion is sent until OPENROUTER_API_KEY is real. One key reaches every model that catalog lists.',
    generatedAt: new Date().toISOString(),
  };
}

async function complete(opts) {
  const o = opts || {};
  if (!keyArmed()) {
    return {
      ok: false,
      armed: false,
      called: false,
      reason: 'missing OPENROUTER_API_KEY',
      lease: state.lease,
      protocol: PROTOCOL,
    };
  }
  if (!state.lease) await refresh(o.fetchImpl);
  const model = currentModelId();
  if (!model) {
    return { ok: false, armed: true, called: false, reason: 'no_model_under_ceiling', protocol: PROTOCOL };
  }
  const fetchFn = o.fetchImpl || global.fetch;
  if (typeof fetchFn !== 'function') {
    return { ok: false, armed: true, called: false, reason: 'fetch_unavailable', model, protocol: PROTOCOL };
  }
  const messages = Array.isArray(o.messages) && o.messages.length
    ? o.messages
    : [{ role: 'user', content: String(o.prompt || '') }];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.min(30000, Number(o.timeoutMs) || 25000));
  try {
    const res = await fetchFn(COMPLETIONS_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zeusai.pro',
        'X-Title': 'ZeusAI Model Lease',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: Math.min(2000, Number(o.maxTokens) || 500),
        temperature: 0.4,
      }),
    });
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    state.calls += 1;
    state.lastCallAt = new Date().toISOString();
    if (!res.ok) {
      return { ok: false, armed: true, called: true, model, status: res.status, protocol: PROTOCOL };
    }
    const text = json && json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content
      : '';
    return { ok: true, armed: true, called: true, model: (json && json.model) || model, text: text || '', protocol: PROTOCOL };
  } catch (e) {
    return { ok: false, armed: true, called: false, model, reason: (e && e.message) || 'call_failed', protocol: PROTOCOL };
  } finally {
    clearTimeout(timer);
  }
}

function start() {
  if (process.env.NODE_ENV === 'test' || process.env.MODEL_LEASE_DISABLED === '1') return { started: false };
  const tick = () => { refresh().catch(() => {}); };
  tick();
  const every = Math.max(15 * 60 * 1000, Number(process.env.MODEL_LEASE_INTERVAL_MS) || 6 * 3600 * 1000);
  const timer = setInterval(tick, every);
  if (timer.unref) timer.unref();
  return { started: true, everyMs: every };
}

module.exports = {
  PROTOCOL,
  NAME,
  CATALOG_URL,
  keyArmed,
  maxPromptUsdPerMillion,
  pickFrom,
  ingest,
  refresh,
  currentModelId,
  discovery,
  complete,
  start,
};
