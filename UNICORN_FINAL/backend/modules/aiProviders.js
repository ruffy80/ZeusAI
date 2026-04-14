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

// ─── 8. Groq (LLaMA ultra-rapid) ─────────────────────────────────────────
async function tryGroq(message, history) {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.startsWith('your_')) return null;

  const resp = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'groq-llama3.1-70b' };
}

// ─── 9. Together AI (OpenAI-compatible) ──────────────────────────────────
async function tryTogether(message, history) {
  const key = process.env.TOGETHER_API_KEY;
  if (!key || key.startsWith('your_')) return null;

  const resp = await axios.post(
    'https://api.together.xyz/v1/chat/completions',
    { model: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3-8b-chat-hf', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'together-llama3-8b' };
}

// ─── 10. Fireworks AI (OpenAI-compatible) ────────────────────────────────
async function tryFireworks(message, history) {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key || key.startsWith('your_')) return null;

  const resp = await axios.post(
    'https://api.fireworks.ai/inference/v1/chat/completions',
    { model: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/llama-v3p1-8b-instruct', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 20000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'fireworks-llama3.1-8b' };
}

// ─── 11. SambaNova (OpenAI-compatible) ───────────────────────────────────
async function trySambaNova(message, history) {
  const key = process.env.SAMBANOVA_API_KEY;
  if (!key || key.startsWith('your_')) return null;

  const resp = await axios.post(
    'https://api.sambanova.ai/v1/chat/completions',
    { model: process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.1-8B-Instruct', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 20000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'sambanova-llama3.1-8b' };
}

// ─── 12. NVIDIA NIM (OpenAI-compatible) ──────────────────────────────────
async function tryNvidiaNim(message, history) {
  const key = process.env.NVIDIA_NIM_API_KEY;
  if (!key || key.startsWith('your_')) return null;

  const resp = await axios.post(
    'https://integrate.api.nvidia.com/v1/chat/completions',
    { model: process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.1-8b-instruct', messages: buildMessages(message, history), max_tokens: 500, temperature: 0.7 },
    { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 20000 }
  );
  return { reply: resp.data.choices[0].message.content, model: 'nvidia-nim-llama3.1-8b' };
}

// ─── Provider registry ────────────────────────────────────────────────────
// Ordine fallback: DeepSeek → Groq → Mistral → Gemini → Claude → Cohere → OpenAI
//                 → xAI → Together → Fireworks → SambaNova → NVIDIA NIM
const PROVIDERS = [
  { name: 'deepseek',   envKey: 'DEEPSEEK_API_KEY',   placeholder: 'your_deepseek_api_key_here',   fn: tryDeepSeek },
  { name: 'groq',       envKey: 'GROQ_API_KEY',        placeholder: 'your_groq_api_key_here',       fn: tryGroq },
  { name: 'mistral',    envKey: 'MISTRAL_API_KEY',     placeholder: 'your_mistral_api_key_here',    fn: tryMistral },
  { name: 'gemini',     envKey: 'GEMINI_API_KEY',      placeholder: 'your_gemini_api_key_here',     fn: tryGemini },
  { name: 'anthropic',  envKey: 'ANTHROPIC_API_KEY',   placeholder: 'your_anthropic_api_key_here',  fn: tryAnthropic },
  { name: 'cohere',     envKey: 'COHERE_API_KEY',      placeholder: 'your_cohere_api_key_here',     fn: tryCohere },
  { name: 'openai',     envKey: 'OPENAI_API_KEY',      placeholder: 'your_openai_api_key_here',     fn: tryOpenAI },
  { name: 'xai',        envKey: 'XAI_API_KEY',         placeholder: 'your_xai_api_key_here',        fn: tryGrok },
  { name: 'together',   envKey: 'TOGETHER_API_KEY',    placeholder: 'your_together_api_key_here',   fn: tryTogether },
  { name: 'fireworks',  envKey: 'FIREWORKS_API_KEY',   placeholder: 'your_fireworks_api_key_here',  fn: tryFireworks },
  { name: 'sambanova',  envKey: 'SAMBANOVA_API_KEY',   placeholder: 'your_sambanova_api_key_here',  fn: trySambaNova },
  { name: 'nvidia-nim', envKey: 'NVIDIA_NIM_API_KEY',  placeholder: 'your_nvidia_nim_api_key_here', fn: tryNvidiaNim },
];

/**
 * Cascade through all configured providers and return the first successful response.
 * @param {string} message
 * @param {Array}  history  [{ role, content }, ...]
 * @returns {Promise<{reply: string, model: string}|null>}
 */
async function chat(message, history = []) {
  for (const provider of PROVIDERS) {
    const val = process.env[provider.envKey];
    if (!val || val === provider.placeholder) continue; // not configured
    try {
      const result = await withBackoff(() => provider.fn(message, history), RETRY_MAX, RETRY_BASE_MS);
      if (result && result.reply) {
        return result;
      }
    } catch (err) {
      console.error(`[AIProviders] ${provider.name} error:`, err.response?.data?.error?.message || err.message);
    }
  }
  return null; // all providers failed or unconfigured
}

/**
 * Returns status of every provider (configured, active).
 */
function getStatus() {
  return PROVIDERS.map(p => {
    const val = process.env[p.envKey];
    const configured = Boolean(val && val !== p.placeholder);
    return { provider: p.name, envKey: p.envKey, configured };
  });
}

module.exports = { chat, getStatus, PROVIDERS };
