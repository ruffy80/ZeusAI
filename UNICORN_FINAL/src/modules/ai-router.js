// modules/ai-router.js — fallback chain pentru providers AI (RO+EN).
// Ordine: OpenAI → Anthropic → Groq → Ollama (local). Circuit breaker per provider.
// Configurat prin env: OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, OLLAMA_BASE_URL.

const STATE = {
  openai:    { fails: 0, openUntil: 0 },
  anthropic: { fails: 0, openUntil: 0 },
  groq:      { fails: 0, openUntil: 0 },
  ollama:    { fails: 0, openUntil: 0 }
};
const BREAK_AFTER_FAILS = Number(process.env.AI_ROUTER_BREAK_AFTER || 3);
const BREAK_COOLDOWN_MS = Number(process.env.AI_ROUTER_BREAK_COOLDOWN_MS || 60000);

function isAvailable(p) {
  const s = STATE[p];
  if (!s) return false;
  return Date.now() >= s.openUntil;
}
function recordOk(p) { if (STATE[p]) { STATE[p].fails = 0; STATE[p].openUntil = 0; } }
function recordFail(p) {
  const s = STATE[p]; if (!s) return;
  s.fails += 1;
  if (s.fails >= BREAK_AFTER_FAILS) { s.openUntil = Date.now() + BREAK_COOLDOWN_MS; s.fails = 0; }
}

async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

async function callOpenAI({ prompt, system, model, maxTokens }) {
  if (!process.env.OPENAI_API_KEY) throw new Error('no_openai_key');
  const r = await withTimeout(fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [system ? { role: 'system', content: system } : null, { role: 'user', content: prompt }].filter(Boolean),
      max_tokens: maxTokens || 800
    })
  }), 20000);
  if (!r.ok) throw new Error('openai_' + r.status);
  const j = await r.json();
  return { provider: 'openai', text: j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '', usage: j.usage };
}

async function callAnthropic({ prompt, system, model, maxTokens }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('no_anthropic_key');
  const r = await withTimeout(fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: maxTokens || 800,
      system: system || undefined,
      messages: [{ role: 'user', content: prompt }]
    })
  }), 20000);
  if (!r.ok) throw new Error('anthropic_' + r.status);
  const j = await r.json();
  const text = (j.content || []).map(c => c.text).filter(Boolean).join('\n');
  return { provider: 'anthropic', text, usage: j.usage };
}

async function callGroq({ prompt, system, model, maxTokens }) {
  if (!process.env.GROQ_API_KEY) throw new Error('no_groq_key');
  const r = await withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify({
      model: model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [system ? { role: 'system', content: system } : null, { role: 'user', content: prompt }].filter(Boolean),
      max_tokens: maxTokens || 800
    })
  }), 20000);
  if (!r.ok) throw new Error('groq_' + r.status);
  const j = await r.json();
  return { provider: 'groq', text: j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '', usage: j.usage };
}

async function callOllama({ prompt, system, model }) {
  const base = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const r = await withTimeout(fetch(base + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct-q4_K_M',
      prompt: system ? `${system}\n\n${prompt}` : prompt,
      stream: false
    })
  }), 30000);
  if (!r.ok) throw new Error('ollama_' + r.status);
  const j = await r.json();
  return { provider: 'ollama', text: j.response || '', usage: null };
}

const CHAIN = [
  ['openai', callOpenAI],
  ['anthropic', callAnthropic],
  ['groq', callGroq],
  ['ollama', callOllama]
];

async function infer(opts = {}) {
  const errors = [];
  for (const [name, fn] of CHAIN) {
    if (!isAvailable(name)) { errors.push({ provider: name, error: 'circuit_open' }); continue; }
    try {
      const result = await fn(opts);
      recordOk(name);
      return result;
    } catch (e) {
      recordFail(name);
      errors.push({ provider: name, error: e.message });
    }
  }
  const err = new Error('ai_chain_exhausted');
  err.code = 'ai_chain_exhausted';
  err.providers = errors;
  throw err;
}

function status() {
  return Object.fromEntries(Object.entries(STATE).map(([k, v]) => [k, {
    fails: v.fails,
    breakerOpen: Date.now() < v.openUntil,
    cooldownMs: Math.max(0, v.openUntil - Date.now()),
    configured: !!(process.env[k.toUpperCase() + '_API_KEY'] || (k === 'ollama' && process.env.OLLAMA_BASE_URL))
  }]));
}

module.exports = { infer, status };
