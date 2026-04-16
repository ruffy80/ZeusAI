// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T20:56:24.786Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:15:50.121Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.877Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.350Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.335Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.959Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.678Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.541Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T08:29:23.998Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T07:05:35.536Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:21:48.172Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:18:03.447Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// AI PROVIDERS MODULE — Zeus AI Unicorn
// Provideri suportați: OpenAI, DeepSeek, Anthropic Claude,
//   Google Gemini, Mistral AI, Cohere, xAI Grok
// Fallback automat în ordine de prioritate configurată.
// =====================================================================
'use strict';

const axios = require('axios');

const RETRY_MAX     = parseInt(process.env.AI_RETRY_MAX     || '3',   10);
const RETRY_BASE_MS = parseInt(process.env.AI_RETRY_BASE_MS || '500', 10);

/**
 * Retry an async function with exponential back-off.
 * Retries only on transient errors: network failures, 429, 5xx.
 */
async function withBackoff(fn, maxAttempts, baseMs) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      // Don't retry on auth/client errors (4xx except 429 rate-limit)
      if (status && status >= 400 && status < 500 && status !== 429) throw err;
      if (attempt < maxAttempts - 1) {
        const delay = baseMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

const SYSTEM_PROMPT =
  'You are Zeus AI Assistant, an expert in business automation, AI, blockchain, ' +
  'payments, and enterprise solutions. Be concise and helpful. ' +
  'You can also respond in Romanian if the user writes in Romanian.';

// ─── Helper: build OpenAI-compatible messages ─────────────────────────────
function buildMessages(message, history) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6).map(m => ({ role: m.role, content: String(m.content) })),
    { role: 'user', content: String(message) },
  ];
}

// ─── 1. OpenAI (GPT-4o-mini) ──────────────────────────────────────────────
async function tryOpenAI(message, history) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === 'your_openai_api_key_here') return null;

  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'gpt-4o-mini' };
}

// ─── 2. DeepSeek (R1 — OpenAI-compatible) ────────────────────────────────
async function tryDeepSeek(message, history) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || key === 'your_deepseek_api_key_here') return null;

  const resp = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    { model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'deepseek-r1' };
}

// ─── 3. Anthropic Claude ─────────────────────────────────────────────────
async function tryAnthropic(message, history) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_anthropic_api_key_here') return null;

  const userMessages = [
    ...history.slice(-6).map(m => ({ role: m.role, content: String(m.content) })),
    { role: 'user', content: String(message) },
  ];

  const resp = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
      system: SYSTEM_PROMPT,
      messages: userMessages,
      max_tokens: 500,
    },
    {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  const content = resp.data.content?.[0]?.text || '';
  return { reply: content, model: 'claude-3-5-haiku' };
}

// ─── 4. Google Gemini ─────────────────────────────────────────────────────
async function tryGemini(message, history) {
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
    {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 25000 }
  );
  const text = resp.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { reply: text, model: `gemini-${model}` };
}

// ─── 5. Mistral AI (OpenAI-compatible) ───────────────────────────────────
async function tryMistral(message, history) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key || key === 'your_mistral_api_key_here') return null;

  const resp = await axios.post(
    'https://api.mistral.ai/v1/chat/completions',
    { model: process.env.MISTRAL_MODEL || 'mistral-small-latest', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'mistral-small' };
}

// ─── 6. Cohere ────────────────────────────────────────────────────────────
async function tryCohere(message, history) {
  const key = process.env.COHERE_API_KEY;
  if (!key || key === 'your_cohere_api_key_here') return null;

  const chatHistory = history.slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: String(m.content),
  }));

  const resp = await axios.post(
    'https://api.cohere.com/v1/chat',
    {
      model: process.env.COHERE_MODEL || 'command-r',
      message: String(message),
      chat_history: chatHistory,
      preamble: SYSTEM_PROMPT,
      max_tokens: 500,
      temperature: 0.7,
    },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
  );
  return { reply: resp.data.text || '', model: 'cohere-command-r' };
}

// ─── 7. xAI Grok (OpenAI-compatible) ─────────────────────────────────────
async function tryGrok(message, history) {
  const key = process.env.XAI_API_KEY;
  if (!key || key === 'your_xai_api_key_here') return null;

  const resp = await axios.post(
    'https://api.x.ai/v1/chat/completions',
    { model: process.env.GROK_MODEL || 'grok-3-mini', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'grok-3-mini' };
}

// ─── 8. Groq (OpenAI-compatible, ultra-fast inference) ───────────────────
async function tryGroq(message, history) {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'your_groq_api_key_here') return null;

  const resp = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: process.env.GROQ_MODEL || 'llama3-70b-8192', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 20000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'groq-llama3-70b' };
}

// ─── 9. OpenRouter (multi-model gateway) ─────────────────────────────────
async function tryOpenRouter(message, history) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === 'your_openrouter_api_key_here') return null;

  const resp = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free',
      messages: buildMessages(message, history),
      max_tokens: 500,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://zeus-ai.app',
        'X-Title': 'Zeus AI Unicorn',
      },
      timeout: 30000,
    }
  );
  const model = resp.data.model || 'openrouter';
  return { reply: resp.data.choices[0].message.content, model: `openrouter-${model}` };
}

// ─── 10. Perplexity AI (OpenAI-compatible) ───────────────────────────────
async function tryPerplexity(message, history) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key || key === 'your_perplexity_api_key_here') return null;

  const resp = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-small-128k-online',
      messages: buildMessages(message, history),
      max_tokens: 500,
      temperature: 0.7,
    },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'perplexity-sonar' };
}

// ─── 11. Together AI (OpenAI-compatible) ─────────────────────────────────
async function tryTogether(message, history) {
  const key = process.env.TOGETHER_API_KEY;
  if (!key || key === 'your_together_api_key_here') return null;

  const resp = await axios.post(
    'https://api.together.xyz/v1/chat/completions',
    {
      model: process.env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      messages: buildMessages(message, history),
      max_tokens: 500,
      temperature: 0.7,
    },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'together-llama3.1-8b' };
}

// ─── 13. Fireworks AI (OpenAI-compatible) ────────────────────────────────
async function tryFireworks(message, history) {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key || key === 'your_fireworks_api_key_here') return null;

  const resp = await axios.post(
    'https://api.fireworks.ai/inference/v1/chat/completions',
    {
      model: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/llama-v3p1-8b-instruct',
      messages: buildMessages(message, history),
      max_tokens: 500,
      temperature: 0.7,
    },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 20000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'fireworks-llama3.1-8b' };
}

// ─── 14. SambaNova Cloud (OpenAI-compatible) ─────────────────────────────
async function trySambaNova(message, history) {
  const key = process.env.SAMBANOVA_API_KEY;
  if (!key || key === 'your_sambanova_api_key_here') return null;

  const resp = await axios.post(
    'https://api.sambanova.ai/v1/chat/completions',
    {
      model: process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.1-8B-Instruct',
      messages: buildMessages(message, history),
      max_tokens: 500,
      temperature: 0.7,
    },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'sambanova-llama3.1-8b' };
}

// ─── 14. NVIDIA NIM (GPU-accelerated inference, OpenAI-compatible) ────────
async function tryNvidiaNim(message, history) {
  const key = process.env.NVIDIA_NIM_API_KEY;
  if (!key || key === 'your_nvidia_nim_api_key_here') return null;

  const resp = await axios.post(
    'https://integrate.api.nvidia.com/v1/chat/completions',
    {
      model: process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.1-8b-instruct',
      messages: buildMessages(message, history),
      max_tokens: 500,
      temperature: 0.7,
    },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 25000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'nvidia-nim-llama3.1-8b' };
}

// ─── 15. HuggingFace Inference API ────────────────────────────────────────
async function tryHuggingFace(message, history) {
  const key = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;
  if (!key || key.startsWith('your_')) return null;

  const model = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';
  // HF uses the messages API for chat models
  const resp = await axios.post(
    `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
    { model, messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  return { reply: resp.data.choices[0].message.content, model: `hf-${model.split('/').pop()}` };
}

// ─── Provider registry ────────────────────────────────────────────────────
// Priority order: DeepSeek (cheap+fast) → Mistral → Groq → Gemini → Claude →
//   Cohere → OpenAI → OpenRouter → Perplexity → HF → Together → Fireworks →
//   SambaNova → NVIDIA NIM → xAI Grok
const PROVIDERS = [
  { name: 'deepseek',   envKey: 'DEEPSEEK_API_KEY',    placeholder: 'your_deepseek_api_key_here',    fn: tryDeepSeek,   costTier: 1, speedTier: 1 },
  { name: 'mistral',    envKey: 'MISTRAL_API_KEY',      placeholder: 'your_mistral_api_key_here',     fn: tryMistral,    costTier: 2, speedTier: 1 },
  { name: 'groq',       envKey: 'GROQ_API_KEY',         placeholder: 'your_groq_api_key_here',        fn: tryGroq,       costTier: 1, speedTier: 0 },
  { name: 'gemini',     envKey: 'GEMINI_API_KEY',        placeholder: 'your_gemini_api_key_here',     fn: tryGemini,     costTier: 2, speedTier: 1 },
  { name: 'anthropic',  envKey: 'ANTHROPIC_API_KEY',    placeholder: 'your_anthropic_api_key_here',   fn: tryAnthropic,  costTier: 3, speedTier: 2 },
  { name: 'cohere',     envKey: 'COHERE_API_KEY',        placeholder: 'your_cohere_api_key_here',     fn: tryCohere,     costTier: 2, speedTier: 1 },
  { name: 'openai',     envKey: 'OPENAI_API_KEY',        placeholder: 'your_openai_api_key_here',     fn: tryOpenAI,     costTier: 3, speedTier: 2 },
  { name: 'openrouter', envKey: 'OPENROUTER_API_KEY',   placeholder: 'your_openrouter_api_key_here',  fn: tryOpenRouter, costTier: 2, speedTier: 1 },
  { name: 'perplexity', envKey: 'PERPLEXITY_API_KEY',   placeholder: 'your_perplexity_api_key_here',  fn: tryPerplexity, costTier: 2, speedTier: 1 },
  { name: 'huggingface',envKey: 'HUGGINGFACE_API_KEY',  placeholder: 'your_huggingface_api_key_here', fn: tryHuggingFace,costTier: 1, speedTier: 2 },
  { name: 'together',   envKey: 'TOGETHER_API_KEY',     placeholder: 'your_together_api_key_here',    fn: tryTogether,   costTier: 1, speedTier: 1 },
  { name: 'fireworks',  envKey: 'FIREWORKS_API_KEY',    placeholder: 'your_fireworks_api_key_here',   fn: tryFireworks,  costTier: 1, speedTier: 1 },
  { name: 'sambanova',  envKey: 'SAMBANOVA_API_KEY',    placeholder: 'your_sambanova_api_key_here',   fn: trySambaNova,  costTier: 1, speedTier: 1 },
  { name: 'nvidia_nim', envKey: 'NVIDIA_NIM_API_KEY',   placeholder: 'your_nvidia_nim_api_key_here',  fn: tryNvidiaNim,  costTier: 1, speedTier: 1 },
  { name: 'xai',        envKey: 'XAI_API_KEY',           placeholder: 'your_xai_api_key_here',        fn: tryGrok,       costTier: 3, speedTier: 2 },
];

// ─── Per-provider health state (self-healing support) ────────────────────
// Tracks consecutive failures and cooldown windows per provider.
const PROVIDER_HEALTH = new Map(); // name → { failures, unstableUntil, totalErrors, lastError }
const UNSTABLE_COOLDOWN_MS  = parseInt(process.env.AI_UNSTABLE_COOLDOWN_MS  || '300000', 10); // 5 min
const UNSTABLE_FAIL_THRESH  = parseInt(process.env.AI_UNSTABLE_FAIL_THRESH  || '3',      10); // failures before marking unstable

function _getHealth(name) {
  if (!PROVIDER_HEALTH.has(name)) {
    PROVIDER_HEALTH.set(name, { failures: 0, unstableUntil: 0, totalErrors: 0, lastError: null });
  }
  return PROVIDER_HEALTH.get(name);
}

/** Mark a successful call — reset failure counter and reintegrate if back online. */
function _recordSuccess(name) {
  const h = _getHealth(name);
  const wasUnstable = h.unstableUntil > Date.now();
  h.failures = 0;
  h.unstableUntil = 0;
  if (wasUnstable) {
    console.log(`[AIProviders] ✅ ${name} reintegrat automat după recuperare.`);
  }
}

/** Mark a failed call — increment counter, potentially mark unstable. */
function _recordFailure(name, errMsg) {
  const h = _getHealth(name);
  h.failures++;
  h.totalErrors++;
  h.lastError = errMsg;
  if (h.failures >= UNSTABLE_FAIL_THRESH) {
    h.unstableUntil = Date.now() + UNSTABLE_COOLDOWN_MS;
    console.warn(`[AIProviders] ⚠️  ${name} marcat ca instabil pentru ${UNSTABLE_COOLDOWN_MS / 1000}s (${h.failures} erori consecutive).`);
  }
}

/** Check whether a provider is currently considered unstable and should be skipped. */
function isProviderUnstable(name) {
  const h = _getHealth(name);
  if (h.unstableUntil > Date.now()) return true;
  // Auto-clear expired cooldown
  if (h.unstableUntil > 0 && h.unstableUntil <= Date.now()) {
    h.failures = 0;
    h.unstableUntil = 0;
  }
  return false;
}

/** Force-reintegrate a provider (clear its health state). */
function reintegrateProvider(name) {
  const h = _getHealth(name);
  h.failures = 0;
  h.unstableUntil = 0;
  console.log(`[AIProviders] 🔄 ${name} reintegrat manual.`);
}

/** Force-mark a provider as unstable for the configured cooldown window. */
function markProviderUnstable(name) {
  const h = _getHealth(name);
  h.unstableUntil = Date.now() + UNSTABLE_COOLDOWN_MS;
  console.warn(`[AIProviders] 🔴 ${name} marcat manual ca instabil.`);
}

/**
 * Cascade through all configured providers and return the first successful response.
 * Skips providers that are marked unstable (self-healing: auto-avoidance).
 * @param {string} message
 * @param {Array}  history  [{ role, content }, ...]
 * @param {Object} [opts]   { premiumOnly: bool, skipUnstable: bool }
 * @returns {Promise<{reply: string, model: string}|null>}
 */
async function chat(message, history = [], opts = {}) {
  const { premiumOnly = false, skipUnstable = true } = opts;
  const candidates = premiumOnly
    ? PROVIDERS.filter(p => p.tier === 'premium')
    : PROVIDERS;

  for (const provider of candidates) {
    const val = process.env[provider.envKey];
    if (!val || val === provider.placeholder) continue; // not configured

    // Self-healing: skip providers currently in unstable cooldown
    if (skipUnstable && isProviderUnstable(provider.name)) {
      console.warn(`[AIProviders] ⏭️  ${provider.name} sărit (instabil).`);
      continue;
    }

    try {
      const result = await withBackoff(() => provider.fn(message, history), RETRY_MAX, RETRY_BASE_MS);
      if (result && result.reply) {
        _recordSuccess(provider.name);
        return result;
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message;
      console.error(`[AIProviders] ${provider.name} error:`, errMsg);
      _recordFailure(provider.name, errMsg);
    }
  }

  // Last resort: retry all providers including unstable ones (ignore skipUnstable)
  if (skipUnstable) {
    return chat(message, history, { premiumOnly, skipUnstable: false });
  }

  return null; // all providers failed or unconfigured
}

/**
 * Returns status of every provider (configured, active, health).
 */
function getStatus() {
  return PROVIDERS.map(p => {
    const val = process.env[p.envKey];
    const configured = Boolean(val && val !== p.placeholder);
    const h = _getHealth(p.name);
    const unstable = isProviderUnstable(p.name);
    return {
      provider: p.name,
      envKey: p.envKey,
      tier: p.tier,
      configured,
      unstable,
      failures: h.failures,
      totalErrors: h.totalErrors,
      lastError: h.lastError,
      unstableUntil: unstable ? new Date(h.unstableUntil).toISOString() : null,
    };
  });
}

module.exports = {
  chat, getStatus, PROVIDERS,
  isProviderUnstable, reintegrateProvider, markProviderUnstable,
  _recordSuccess, _recordFailure,
};
