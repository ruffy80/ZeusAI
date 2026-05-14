// ADI-Core Adapter Generator
// Construieste un client `(prompt, opts) => result` per provider.
// Suporta: openai-compatible, anthropic, gemini, pollinations, hf-router, ollama, local-module.

const DEFAULT_TIMEOUT_MS = 20000;

function authHeader(model) {
  const key = model.envVar ? (process.env[model.envVar] || '') : '';
  switch (model.flavor) {
    case 'anthropic':
      return key ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : {};
    case 'gemini':
      return {};
    default:
      return key ? { 'Authorization': `Bearer ${key}` } : {};
  }
}

async function callOpenAICompat(model, prompt, opts = {}) {
  const url = model.chatUrl;
  if (!url) return { ok: false, reason: 'no-chat-url', model: model.id };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || DEFAULT_TIMEOUT_MS);
    const headers = { 'Content-Type': 'application/json', ...authHeader(model) };
    if (model.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://zeusai.pro';
      headers['X-Title'] = 'ZeusAI ADI-Core';
    }
    const r = await fetch(url, {
      method: 'POST', headers, signal: ctrl.signal,
      body: JSON.stringify({
        model: opts.modelName || model.defaultModel || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: String(prompt || '').slice(0, 8000) }],
        max_tokens: opts.maxTokens || 256,
        temperature: opts.temperature ?? 0.7,
      }),
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, status: r.status, model: model.id, error: (await r.text().catch(() => '')).slice(0, 300) };
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || '';
    return { ok: true, model: model.id, text, usage: j?.usage || null };
  } catch (e) { return { ok: false, error: String(e && e.message || e), model: model.id }; }
}

async function callAnthropic(model, prompt, opts = {}) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || DEFAULT_TIMEOUT_MS);
    const r = await fetch(model.chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(model) },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: opts.modelName || model.defaultModel,
        max_tokens: opts.maxTokens || 256,
        messages: [{ role: 'user', content: String(prompt || '').slice(0, 8000) }],
      }),
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, status: r.status, model: model.id };
    const j = await r.json();
    const text = (j?.content || []).map(c => c.text || '').join('');
    return { ok: true, model: model.id, text };
  } catch (e) { return { ok: false, error: String(e && e.message || e), model: model.id }; }
}

async function callGemini(model, prompt, opts = {}) {
  const key = process.env[model.envVar] || '';
  if (!key) return { ok: false, reason: 'no-api-key', model: model.id };
  const modelName = opts.modelName || model.defaultModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || DEFAULT_TIMEOUT_MS);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ contents: [{ parts: [{ text: String(prompt || '').slice(0, 8000) }] }] }),
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, status: r.status, model: model.id };
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return { ok: true, model: model.id, text };
  } catch (e) { return { ok: false, error: String(e && e.message || e), model: model.id }; }
}

async function callPollinations(model, prompt, opts = {}) {
  // Pollinations e lent uneori; ridicam timeout-ul. Folosim GET pe text.pollinations.ai/<prompt>
  // ca fallback daca POST OpenAI-compat esueaza.
  const timeoutMs = opts.timeoutMs || 45000;
  // 1) Try OpenAI-compat POST first
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(model.chatUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({
        model: opts.modelName || model.defaultModel || 'openai',
        messages: [{ role: 'user', content: String(prompt || '').slice(0, 8000) }],
      }),
    });
    clearTimeout(t);
    if (r.ok) {
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        const text = j?.choices?.[0]?.message?.content || '';
        if (text) return { ok: true, model: model.id, text };
      } else {
        const text = await r.text();
        if (text) return { ok: true, model: model.id, text };
      }
    }
  } catch (_) {}
  // 2) Fallback: GET https://text.pollinations.ai/<prompt>?model=openai
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const enc = encodeURIComponent(String(prompt || '').slice(0, 1500));
    const url = `https://text.pollinations.ai/${enc}?model=${encodeURIComponent(opts.modelName || model.defaultModel || 'openai')}`;
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { ok: false, status: r.status, model: model.id };
    const text = await r.text();
    return { ok: true, model: model.id, text };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), model: model.id };
  }
}

async function callOllama(model, prompt, opts = {}) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 30000);
    const r = await fetch(model.chatUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({
        model: opts.modelName || model.defaultModel,
        messages: [{ role: 'user', content: String(prompt || '').slice(0, 8000) }],
        stream: false,
      }),
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, status: r.status, model: model.id };
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || j?.message?.content || '';
    return { ok: true, model: model.id, text };
  } catch (e) { return { ok: false, error: String(e && e.message || e), model: model.id }; }
}

function generateAdapter(model) {
  if (model.type !== 'remote-api') {
    return async (p) => ({ ok: true, model: model.id, text: `[local-module:${model.id}] received: ${String(p).slice(0, 200)}`, local: true });
  }
  switch (model.flavor) {
    case 'anthropic':    return (p, o) => callAnthropic(model, p, o);
    case 'gemini':       return (p, o) => callGemini(model, p, o);
    case 'pollinations': return (p, o) => callPollinations(model, p, o);
    case 'ollama':       return (p, o) => callOllama(model, p, o);
    case 'hf-router':
    case 'openai':
    default:             return (p, o) => callOpenAICompat(model, p, o);
  }
}

module.exports = { generateAdapter, callOpenAICompat, callAnthropic, callGemini, callPollinations, callOllama };
