// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-14T18:12:01.137Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// AI ORCHESTRATOR — Zeus AI Unicorn
// Modul central de orchestrare AI cu:
//   - Routing inteligent per tip task
//   - Fallback multi-model automat
//   - Cost optimizer (model ieftin pentru task-uri simple)
//   - Performance tracker (latență, erori, stabilitate)
//   - Health monitor per provider
//   - Load balancer adaptiv
//   - Cache inteligent (TTL-based)
//   - AI Auto-Repair (reactivare provideri după erori)
//   - Raport de performanță
// =====================================================================
'use strict';

const axios = require('axios');

// ─── Configurare globală ──────────────────────────────────────────────────
const RETRY_MAX     = parseInt(process.env.AI_RETRY_MAX     || '2', 10);
const RETRY_BASE_MS = parseInt(process.env.AI_RETRY_BASE_MS || '400', 10);
const CACHE_TTL_MS  = parseInt(process.env.AI_CACHE_TTL_MS  || '300000', 10); // 5 min
const CIRCUIT_OPEN_MS  = parseInt(process.env.AI_CIRCUIT_OPEN_MS  || '60000', 10);  // 1 min
const ERROR_THRESHOLD  = parseInt(process.env.AI_ERROR_THRESHOLD  || '3', 10);

const SYSTEM_PROMPT =
  'You are Zeus AI Assistant, an expert in business automation, AI, blockchain, ' +
  'payments, and enterprise solutions. Be concise and helpful. ' +
  'You can also respond in Romanian if the user writes in Romanian.';

// ─── Cost per 1M tokens (USD) ─────────────────────────────────────────────
const COST_PER_1M = {
  deepseek:    0.55,
  groq:        0.05,
  together:    0.10,
  fireworks:   0.20,
  sambanova:   0.10,
  nvidia_nim:  0.20,
  huggingface: 0.00,
  mistral:     1.00,
  cohere:      0.50,
  gemini:      0.35,
  openrouter:  0.20,
  perplexity:  1.00,
  anthropic:   3.00,
  openai:      0.60,
  xai:         5.00,
};

// ─── Task-type → ordered provider list ────────────────────────────────────
const TASK_ROUTING = {
  coding:          ['deepseek', 'groq', 'anthropic', 'openai', 'gemini', 'mistral'],
  reasoning:       ['anthropic', 'deepseek', 'gemini', 'openai', 'mistral', 'groq'],
  embeddings:      ['cohere', 'openai', 'fireworks', 'together', 'huggingface'],
  search_reasoning:['perplexity', 'gemini', 'anthropic', 'openai', 'deepseek'],
  tool_use:        ['gemini', 'anthropic', 'openai', 'deepseek', 'mistral'],
  text_generation: ['deepseek', 'mistral', 'groq', 'cohere', 'together', 'fireworks'],
  analysis:        ['deepseek', 'anthropic', 'gemini', 'mistral', 'openai'],
  optimization:    ['deepseek', 'groq', 'mistral', 'openai', 'anthropic'],
  chat:            ['deepseek', 'mistral', 'groq', 'gemini', 'anthropic', 'cohere', 'openai'],
  fast:            ['groq', 'fireworks', 'sambanova', 'nvidia_nim', 'together', 'deepseek'],
  cheap:           ['groq', 'together', 'fireworks', 'sambanova', 'huggingface', 'nvidia_nim', 'deepseek'],
  premium:         ['anthropic', 'openai', 'gemini', 'xai', 'mistral'],
  open_source:     ['groq', 'together', 'fireworks', 'sambanova', 'nvidia_nim', 'huggingface'],
  default:         ['deepseek', 'mistral', 'groq', 'gemini', 'anthropic', 'cohere', 'openai',
                    'openrouter', 'perplexity', 'huggingface', 'together', 'fireworks',
                    'sambanova', 'nvidia_nim', 'xai'],
};

// ─── Per-provider state (circuit breaker + stats) ─────────────────────────
// Use Map to prevent prototype pollution via malicious provider name strings
const providerState = new Map();
function getState(name) {
  if (!providerState.has(name)) {
    providerState.set(name, {
      errors: 0, lastError: 0, circuitOpen: false,
      totalRequests: 0, totalErrors: 0, totalLatencyMs: 0,
      lastLatencyMs: 0, consecutiveSuccesses: 0,
    });
  }
  return providerState.get(name);
}

function recordSuccess(name, latencyMs) {
  const s = getState(name);
  s.errors = 0;
  s.circuitOpen = false;
  s.totalRequests++;
  s.totalLatencyMs += latencyMs;
  s.lastLatencyMs   = latencyMs;
  s.consecutiveSuccesses++;
}

function recordError(name) {
  const s = getState(name);
  s.errors++;
  s.totalErrors++;
  s.totalRequests++;
  s.consecutiveSuccesses = 0;
  s.lastError = Date.now();
  if (s.errors >= ERROR_THRESHOLD) {
    s.circuitOpen = true;
    console.warn(`[AIOrchestrator] Circuit OPEN for ${name} after ${s.errors} errors`);
  }
}

function isAvailable(name) {
  const s = getState(name);
  if (!s.circuitOpen) return true;
  // Auto-heal: try again after CIRCUIT_OPEN_MS
  if (Date.now() - s.lastError > CIRCUIT_OPEN_MS) {
    s.circuitOpen = false;
    s.errors = 0;
    console.info(`[AIOrchestrator] Circuit RESET for ${name} — retrying`);
    return true;
  }
  return false;
}

// ─── Simple in-memory cache ────────────────────────────────────────────────
const _cache = new Map();

function cacheKey(provider, message) {
  return `${provider}::${message.slice(0, 120)}`;
}

function fromCache(provider, message) {
  const k = cacheKey(provider, message);
  const entry = _cache.get(k);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(k); return null; }
  return entry.value;
}

function toCache(provider, message, value) {
  if (_cache.size > 500) {
    // evict oldest
    const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
    oldest.forEach(([k]) => _cache.delete(k));
  }
  _cache.set(cacheKey(provider, message), { value, ts: Date.now() });
}

// ─── Retry with exponential back-off ─────────────────────────────────────
async function withBackoff(fn, maxAttempts, baseMs) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) throw err;
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, baseMs * Math.pow(2, attempt) + Math.random() * 100));
      }
    }
  }
  throw lastErr;
}

// ─── Provider call functions ──────────────────────────────────────────────
function buildMessages(message, history) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6).map(m => ({ role: m.role, content: String(m.content) })),
    { role: 'user', content: String(message) },
  ];
}

const PROVIDER_FNS = {
  deepseek: async (message, history) => {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key || key === 'your_deepseek_api_key_here') return null;
    const resp = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      { model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'deepseek-chat' };
  },

  mistral: async (message, history) => {
    const key = process.env.MISTRAL_API_KEY;
    if (!key || key === 'your_mistral_api_key_here') return null;
    const resp = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      { model: process.env.MISTRAL_MODEL || 'mistral-small-latest', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'mistral-small' };
  },

  groq: async (message, history) => {
    const key = process.env.GROQ_API_KEY;
    if (!key || key === 'your_groq_api_key_here') return null;
    const resp = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'groq-llama3.3-70b' };
  },

  gemini: async (message, history) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'your_gemini_api_key_here') return null;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const contents = [
      ...history.slice(-6).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content) }],
      })),
      { role: 'user', parts: [{ text: String(message) }] },
    ];
    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { system_instruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig: { maxOutputTokens: 800, temperature: 0.7 } },
      { headers: { 'Content-Type': 'application/json' }, timeout: 25000 }
    );
    return { reply: resp.data.candidates?.[0]?.content?.parts?.[0]?.text || '', model: `gemini-${model}` };
  },

  anthropic: async (message, history) => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key || key === 'your_anthropic_api_key_here') return null;
    const userMessages = [
      ...history.slice(-6).map(m => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content: String(message) },
    ];
    const resp = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022', system: SYSTEM_PROMPT, messages: userMessages, max_tokens: 800 },
      { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    return { reply: resp.data.content?.[0]?.text || '', model: 'claude-3-5-haiku' };
  },

  cohere: async (message, history) => {
    const key = process.env.COHERE_API_KEY;
    if (!key || key === 'your_cohere_api_key_here') return null;
    const chatHistory = history.slice(-6).map(m => ({
      role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
      message: String(m.content),
    }));
    const resp = await axios.post(
      'https://api.cohere.com/v1/chat',
      { model: process.env.COHERE_MODEL || 'command-r', message: String(message), chat_history: chatHistory, preamble: SYSTEM_PROMPT, max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
    );
    return { reply: resp.data.text || '', model: 'cohere-command-r' };
  },

  openai: async (message, history) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === 'your_openai_api_key_here') return null;
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'gpt-4o-mini' };
  },

  openrouter: async (message, history) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key || key === 'your_openrouter_api_key_here') return null;
    const resp = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model: process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.SITE_URL || 'https://zeus-ai.app', 'X-Title': 'Zeus AI Unicorn' }, timeout: 30000 }
    );
    return { reply: resp.data.choices[0].message.content, model: `openrouter-${resp.data.model || 'default'}` };
  },

  perplexity: async (message, history) => {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key || key === 'your_perplexity_api_key_here') return null;
    const resp = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      { model: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-small-128k-online', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'perplexity-sonar' };
  },

  huggingface: async (message, history) => {
    const key = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;
    if (!key || key.startsWith('your_')) return null;
    const model = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';
    const resp = await axios.post(
      `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
      { model, messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    return { reply: resp.data.choices[0].message.content, model: `hf-${model.split('/').pop()}` };
  },

  together: async (message, history) => {
    const key = process.env.TOGETHER_API_KEY;
    if (!key || key === 'your_together_api_key_here') return null;
    const resp = await axios.post(
      'https://api.together.xyz/v1/chat/completions',
      { model: process.env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'together-llama3.1-8b' };
  },

  fireworks: async (message, history) => {
    const key = process.env.FIREWORKS_API_KEY;
    if (!key || key === 'your_fireworks_api_key_here') return null;
    const resp = await axios.post(
      'https://api.fireworks.ai/inference/v1/chat/completions',
      { model: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/llama-v3p1-8b-instruct', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'fireworks-llama3.1-8b' };
  },

  sambanova: async (message, history) => {
    const key = process.env.SAMBANOVA_API_KEY;
    if (!key || key === 'your_sambanova_api_key_here') return null;
    const resp = await axios.post(
      'https://api.sambanova.ai/v1/chat/completions',
      { model: process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.1-8B-Instruct', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'sambanova-llama3.1-8b' };
  },

  nvidia_nim: async (message, history) => {
    const key = process.env.NVIDIA_NIM_API_KEY;
    if (!key || key === 'your_nvidia_nim_api_key_here') return null;
    const resp = await axios.post(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      { model: process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.1-8b-instruct', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'nvidia-nim-llama3.1-8b' };
  },

  xai: async (message, history) => {
    const key = process.env.XAI_API_KEY;
    if (!key || key === 'your_xai_api_key_here') return null;
    const resp = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      { model: process.env.GROK_MODEL || 'grok-3-mini', messages: buildMessages(message, history), max_tokens: 800, temperature: 0.7 },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
    );
    return { reply: resp.data.choices[0].message.content, model: 'grok-3-mini' };
  },
};

// ─── Env-key map per provider ─────────────────────────────────────────────
const PROVIDER_ENV = {
  deepseek:    { key: 'DEEPSEEK_API_KEY',    placeholder: 'your_deepseek_api_key_here' },
  mistral:     { key: 'MISTRAL_API_KEY',     placeholder: 'your_mistral_api_key_here' },
  groq:        { key: 'GROQ_API_KEY',        placeholder: 'your_groq_api_key_here' },
  gemini:      { key: 'GEMINI_API_KEY',      placeholder: 'your_gemini_api_key_here' },
  anthropic:   { key: 'ANTHROPIC_API_KEY',   placeholder: 'your_anthropic_api_key_here' },
  cohere:      { key: 'COHERE_API_KEY',      placeholder: 'your_cohere_api_key_here' },
  openai:      { key: 'OPENAI_API_KEY',      placeholder: 'your_openai_api_key_here' },
  openrouter:  { key: 'OPENROUTER_API_KEY',  placeholder: 'your_openrouter_api_key_here' },
  perplexity:  { key: 'PERPLEXITY_API_KEY',  placeholder: 'your_perplexity_api_key_here' },
  huggingface: { key: 'HUGGINGFACE_API_KEY',  placeholder: 'your_huggingface_api_key_here' },
  together:    { key: 'TOGETHER_API_KEY',    placeholder: 'your_together_api_key_here' },
  fireworks:   { key: 'FIREWORKS_API_KEY',   placeholder: 'your_fireworks_api_key_here' },
  sambanova:   { key: 'SAMBANOVA_API_KEY',   placeholder: 'your_sambanova_api_key_here' },
  nvidia_nim:  { key: 'NVIDIA_NIM_API_KEY',  placeholder: 'your_nvidia_nim_api_key_here' },
  xai:         { key: 'XAI_API_KEY',         placeholder: 'your_xai_api_key_here' },
};

function isConfigured(name) {
  const e = PROVIDER_ENV[name];
  if (!e) return false;
  const v = process.env[e.key];
  return Boolean(v && v !== e.placeholder);
}

// ─── Validated set of known provider names ────────────────────────────────
const KNOWN_PROVIDERS = new Set(Object.keys(PROVIDER_ENV));

// ─── Auto task-type detection ──────────────────────────────────────────────
/**
 * Automatically detect the best task type from message content.
 * Returns a key from TASK_ROUTING.
 */
function autoDetectTaskType(message) {
  const m = String(message || '').toLowerCase();

  // Coding / programming
  if (/\b(code|coding|program|function|bug|debug|script|python|javascript|typescript|java|c\+\+|rust|golang|sql|html|css|api|implement|refactor|test|unit test)\b/.test(m)) return 'coding';

  // Embeddings / vector search
  if (/\b(embed|embedding|vector|similarity|semantic search|nearest neighbor|cosine)\b/.test(m)) return 'embeddings';

  // Search / web / news
  if (/\b(search|find|latest|news|current|today|2024|2025|2026|trending|what happened|who is|where is)\b/.test(m)) return 'search_reasoning';

  // Tool use / actions / automation
  if (/\b(automate|run|execute|schedule|trigger|workflow|action|tool|agent|task)\b/.test(m)) return 'tool_use';

  // Deep analysis
  if (/\b(analy[sz]e|analiz[aă]|report|raport|audit|review|evaluat|assess|compare|compar|benchmark|breakdown)\b/.test(m)) return 'analysis';

  // Reasoning / complex questions
  if (/\b(explain|why|how does|reason|logic|think|deduce|infer|proov|proof|math|calculate|formula|strateg)\b/.test(m)) return 'reasoning';

  // Optimization
  if (/\b(optimi[sz]e|optimi[sz]ă|improve|improv|reduc|cresc|boost|enhance|efficient|performance|speed up)\b/.test(m)) return 'optimization';

  // Fast / simple
  if (m.length < 60) return 'fast';

  // Default: text generation / chat
  return 'chat';
}

// ─── Core: ask() with intelligent routing ─────────────────────────────────
/**
 * Route a request to the best available AI provider.
 * taskType is auto-detected from message content when set to 'auto', 'default', or 'chat'.
 *
 * @param {string} message
 * @param {object} opts
 * @param {string}  [opts.taskType='auto']       - auto|coding|reasoning|embeddings|search_reasoning|tool_use|text_generation|analysis|optimization|chat|fast|cheap|premium|open_source|default
 * @param {string}  [opts.preferProvider]        - force a specific provider first
 * @param {boolean} [opts.useCache=true]
 * @param {Array}   [opts.history=[]]
 * @returns {Promise<{reply:string, model:string, provider:string, latencyMs:number, cached:boolean, detectedTaskType:string}>}
 */
async function ask(message, opts = {}) {
  const {
    taskType     = 'auto',
    preferProvider = null,
    useCache     = true,
    history      = [],
  } = opts;

  // Auto-detect task type when not explicitly specified
  const resolvedTaskType = (taskType === 'auto' || taskType === 'default' || taskType === 'chat')
    ? autoDetectTaskType(message)
    : taskType;

  // Validate preferProvider to prevent prototype pollution / unvalidated dispatch
  const safePrefer = (preferProvider && KNOWN_PROVIDERS.has(preferProvider)) ? preferProvider : null;

  // Build ordered provider list for this task
  const baseList  = TASK_ROUTING[resolvedTaskType] || TASK_ROUTING.default;
  const orderList = safePrefer
    ? [safePrefer, ...baseList.filter(p => p !== safePrefer)]
    : baseList;

  console.info(`[AIOrchestrator] taskType=${resolvedTaskType} (requested=${taskType}) — providers: ${orderList.slice(0,4).join(', ')}...`);

  for (const name of orderList) {
    // Only dispatch to known, validated provider names
    if (!KNOWN_PROVIDERS.has(name)) continue;
    if (!isConfigured(name))  continue;
    if (!isAvailable(name))   continue;
    // Safe: name is validated against KNOWN_PROVIDERS set
    const fn = PROVIDER_FNS[name];
    if (typeof fn !== 'function') continue;

    // Cache lookup
    if (useCache) {
      const cached = fromCache(name, message);
      if (cached) {
        console.info(`[AIOrchestrator] Cache hit — ${name}`);
        return { ...cached, provider: name, cached: true, detectedTaskType: resolvedTaskType };
      }
    }

    const t0 = Date.now();
    try {
      const result = await withBackoff(() => fn(message, history), RETRY_MAX, RETRY_BASE_MS);
      if (!result || !result.reply) continue;

      const latencyMs = Date.now() - t0;
      recordSuccess(name, latencyMs);
      if (useCache) toCache(name, message, { reply: result.reply, model: result.model, latencyMs });

      console.info(`[AIOrchestrator] OK — ${name} / ${result.model} — ${latencyMs}ms [task=${resolvedTaskType}]`);
      return { reply: result.reply, model: result.model, provider: name, latencyMs, cached: false, detectedTaskType: resolvedTaskType };
    } catch (err) {
      recordError(name);
      console.error(`[AIOrchestrator] FAIL — ${name}: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  return null; // all providers failed
}

// ─── Health report ─────────────────────────────────────────────────────────
function getHealthReport() {
  const report = [];
  for (const [name, env] of Object.entries(PROVIDER_ENV)) {
    const configured = isConfigured(name);
    const s = getState(name);
    const avgLatency = s.totalRequests > 0
      ? Math.round(s.totalLatencyMs / (s.totalRequests - s.totalErrors || 1))
      : null;
    const errorRate = s.totalRequests > 0
      ? Math.round((s.totalErrors / s.totalRequests) * 100)
      : 0;
    report.push({
      provider:        name,
      envKey:          env.key,
      configured,
      circuitOpen:     s.circuitOpen,
      available:       configured && !s.circuitOpen,
      totalRequests:   s.totalRequests,
      totalErrors:     s.totalErrors,
      errorRatePct:    errorRate,
      avgLatencyMs:    avgLatency,
      lastLatencyMs:   s.lastLatencyMs || null,
      costPer1MTokens: COST_PER_1M[name] ?? null,
    });
  }
  return report;
}

// ─── Performance report ────────────────────────────────────────────────────
function getPerformanceReport() {
  const health = getHealthReport();
  const configured = health.filter(h => h.configured);
  const available  = health.filter(h => h.available);

  const recommendations = [];
  for (const h of health) {
    if (!h.configured) {
      recommendations.push(`❌ ${h.provider}: not configured — set ${h.envKey}`);
    } else if (h.circuitOpen) {
      recommendations.push(`⚠️  ${h.provider}: circuit open (too many errors) — will auto-reset after ${CIRCUIT_OPEN_MS / 1000}s`);
    } else if (h.errorRatePct > 20) {
      recommendations.push(`⚠️  ${h.provider}: high error rate ${h.errorRatePct}% — investigate`);
    } else if (h.avgLatencyMs && h.avgLatencyMs > 10000) {
      recommendations.push(`🐢 ${h.provider}: high latency ${h.avgLatencyMs}ms — consider deprioritizing`);
    }
  }

  const cheapest = configured
    .filter(h => h.available && h.costPer1MTokens !== null)
    .sort((a, b) => a.costPer1MTokens - b.costPer1MTokens)
    .slice(0, 3)
    .map(h => `${h.provider} ($${h.costPer1MTokens}/1M tokens)`);

  const fastest = configured
    .filter(h => h.available && h.avgLatencyMs)
    .sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
    .slice(0, 3)
    .map(h => `${h.provider} (${h.avgLatencyMs}ms avg)`);

  return {
    summary: {
      total:      health.length,
      configured: configured.length,
      available:  available.length,
      cacheSize:  _cache.size,
    },
    providers:       health,
    cheapestProviders: cheapest,
    fastestProviders:  fastest,
    recommendations,
    taskRouting:     TASK_ROUTING,
    generatedAt:     new Date().toISOString(),
  };
}

// ─── Status (lightweight) ──────────────────────────────────────────────────
function getStatus() {
  return {
    active:          true,
    module:          'ai-orchestrator',
    version:         '2.0.0',
    providers:       getHealthReport().map(h => ({
      provider:    h.provider,
      configured:  h.configured,
      available:   h.available,
      circuitOpen: h.circuitOpen,
      lastLatencyMs: h.lastLatencyMs,
    })),
    configuredCount: getHealthReport().filter(h => h.configured).length,
    taskTypes:       Object.keys(TASK_ROUTING),
    cacheSize:       _cache.size,
    timestamp:       new Date().toISOString(),
  };
}

// ─── Auto-repair: reset circuits for providers that have been silent ───────
function autoRepair() {
  let repaired = 0;
  for (const [name] of Object.entries(PROVIDER_ENV)) {
    const s = getState(name);
    if (s.circuitOpen && Date.now() - s.lastError > CIRCUIT_OPEN_MS) {
      s.circuitOpen = false;
      s.errors = 0;
      repaired++;
      console.info(`[AIOrchestrator] AutoRepair: circuit reset for ${name}`);
    }
  }
  return repaired;
}

// Run auto-repair every minute
setInterval(autoRepair, 60_000);

module.exports = { ask, autoDetectTaskType, getStatus, getHealthReport, getPerformanceReport, autoRepair, TASK_ROUTING, PROVIDER_ENV };
