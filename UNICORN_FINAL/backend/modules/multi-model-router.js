// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-14T17:36:39.248Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// MULTI-MODEL ROUTER — Zeus AI Unicorn
// Fallback automat între 14 provideri AI cu routing inteligent,
// optimizare de cost, caching și raportare de performanță.
//
// Provideri: DeepSeek, Mistral, Groq, Gemini, Claude, Cohere,
//            OpenAI, OpenRouter, Perplexity, HuggingFace, Together,
//            Fireworks, SambaNova, NVIDIA NIM
// =====================================================================
'use strict';

const axios = require('axios');

// ─── Constante ──────────────────────────────────────────────────────────────
const RETRY_MAX     = parseInt(process.env.AI_RETRY_MAX     || '2', 10);
const RETRY_BASE_MS = parseInt(process.env.AI_RETRY_BASE_MS || '400', 10);
const CACHE_TTL_MS  = parseInt(process.env.AI_CACHE_TTL_MS  || '60000', 10);
const COST_SPIKE_MULTIPLIER = 3; // dacă costul curent > 3x media → comută provider

const SYSTEM_PROMPT =
  'You are Zeus AI Assistant, an expert in business automation, AI, blockchain, ' +
  'payments, and enterprise solutions. Be concise and helpful. ' +
  'You can also respond in Romanian if the user writes in Romanian.';

// ─── Catalog provideri ──────────────────────────────────────────────────────
// cost = USD per 1K tokens (estimat); lower = mai ieftin
// taskTypes: ce task-uri suportă providerul
const PROVIDER_CATALOG = [
  // ── Tier 1: cheapest / general (ideal pentru task-uri simple) ──
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    tier: 'cheap',
    type: 'openai-compat',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama3-8b-8192',
    costPer1KTokens: 0.00007,
    speedScore: 0.99,   // ultra-fast inference
    taskTypes: ['chat', 'simple', 'code'],
    timeout: 15000,
  },
  {
    name: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    tier: 'cheap',
    type: 'openai-compat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    costPer1KTokens: 0.00027,
    speedScore: 0.90,
    taskTypes: ['chat', 'simple', 'code', 'reasoning'],
    timeout: 30000,
  },
  {
    name: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    tier: 'cheap',
    type: 'openai-compat',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    costPer1KTokens: 0.001,
    speedScore: 0.88,
    taskTypes: ['chat', 'simple', 'reasoning'],
    timeout: 25000,
  },
  {
    name: 'together',
    envKey: 'TOGETHER_API_KEY',
    tier: 'cheap',
    type: 'openai-compat',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    model: 'meta-llama/Llama-3-8b-chat-hf',
    costPer1KTokens: 0.0002,
    speedScore: 0.85,
    taskTypes: ['chat', 'simple', 'code'],
    timeout: 30000,
  },
  {
    name: 'fireworks',
    envKey: 'FIREWORKS_API_KEY',
    tier: 'cheap',
    type: 'openai-compat',
    endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
    model: 'accounts/fireworks/models/llama-v3-8b-instruct',
    costPer1KTokens: 0.0002,
    speedScore: 0.87,
    taskTypes: ['chat', 'simple', 'embedding'],
    timeout: 25000,
  },
  // ── Tier 2: mid-range (bun compromis cost/calitate) ──
  {
    name: 'gemini',
    envKey: 'GEMINI_API_KEY',
    tier: 'mid',
    type: 'google',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    model: 'gemini-1.5-flash',
    costPer1KTokens: 0.00035,
    speedScore: 0.92,
    taskTypes: ['chat', 'complex', 'reasoning', 'search'],
    timeout: 25000,
  },
  {
    name: 'cohere',
    envKey: 'COHERE_API_KEY',
    tier: 'mid',
    type: 'cohere',
    endpoint: 'https://api.cohere.com/v1/chat',
    model: 'command-r',
    costPer1KTokens: 0.0005,
    speedScore: 0.85,
    taskTypes: ['chat', 'embedding', 'search'],
    timeout: 25000,
  },
  {
    name: 'huggingface',
    envKey: 'HUGGINGFACE_API_KEY',
    tier: 'mid',
    type: 'huggingface',
    endpoint: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
    model: 'Mistral-7B-Instruct-v0.3',
    costPer1KTokens: 0.0002,
    speedScore: 0.75,
    taskTypes: ['chat', 'simple', 'embedding'],
    timeout: 30000,
  },
  {
    name: 'sambanova',
    envKey: 'SAMBANOVA_API_KEY',
    tier: 'mid',
    type: 'openai-compat',
    endpoint: 'https://fast-api.snova.ai/v1/chat/completions',
    model: 'Meta-Llama-3.1-8B-Instruct',
    costPer1KTokens: 0.0002,
    speedScore: 0.90,
    taskTypes: ['chat', 'simple', 'reasoning'],
    timeout: 25000,
  },
  {
    name: 'nvidia-nim',
    envKey: 'NVIDIA_NIM_API_KEY',
    tier: 'mid',
    type: 'openai-compat',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama3-8b-instruct',
    costPer1KTokens: 0.0002,
    speedScore: 0.92,
    taskTypes: ['chat', 'simple', 'code'],
    timeout: 25000,
  },
  // ── Tier 3: premium (task-uri complexe, search cu reasoning) ──
  {
    name: 'openai',
    envKey: 'OPENAI_API_KEY',
    tier: 'premium',
    type: 'openai-compat',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    costPer1KTokens: 0.00015,
    speedScore: 0.90,
    taskTypes: ['chat', 'complex', 'code', 'reasoning'],
    timeout: 25000,
  },
  {
    name: 'perplexity',
    envKey: 'PERPLEXITY_API_KEY',
    tier: 'premium',
    type: 'openai-compat',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    model: 'llama-3.1-sonar-small-128k-online',
    costPer1KTokens: 0.0002,
    speedScore: 0.85,
    taskTypes: ['search', 'reasoning', 'complex'],
    timeout: 30000,
  },
  {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    tier: 'premium',
    type: 'openai-compat',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    costPer1KTokens: 0.0,
    speedScore: 0.80,
    taskTypes: ['chat', 'simple', 'complex', 'reasoning'],
    timeout: 30000,
    extraHeaders: { 'HTTP-Referer': 'https://zeus-ai.app', 'X-Title': 'Zeus AI Unicorn' },
  },
  {
    name: 'claude',
    envKey: 'ANTHROPIC_API_KEY',
    tier: 'premium',
    type: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    costPer1KTokens: 0.0008,
    speedScore: 0.90,
    taskTypes: ['complex', 'reasoning', 'code', 'chat'],
    timeout: 30000,
  },
];

// ─── Routing strategy per task-type ──────────────────────────────────────────
// Definește ordinea preferată de providers pentru fiecare tip de task
const TASK_ROUTING = {
  chat:      ['groq', 'deepseek', 'mistral', 'together', 'gemini', 'openai', 'openrouter', 'claude'],
  simple:    ['groq', 'deepseek', 'mistral', 'fireworks', 'together', 'sambanova', 'nvidia-nim', 'openrouter'],
  complex:   ['claude', 'gemini', 'openai', 'perplexity', 'deepseek', 'mistral'],
  code:      ['deepseek', 'groq', 'openai', 'claude', 'nvidia-nim', 'fireworks'],
  reasoning: ['deepseek', 'perplexity', 'claude', 'gemini', 'mistral', 'sambanova'],
  search:    ['perplexity', 'gemini', 'cohere', 'openai'],
  embedding: ['cohere', 'fireworks', 'huggingface', 'openai'],
  rare:      ['openrouter', 'together', 'huggingface'],
  llama:     ['sambanova', 'nvidia-nim', 'groq', 'together'],
};

// ─── Retry cu exponential backoff ─────────────────────────────────────────────
async function withBackoff(fn, maxAttempts, baseMs) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) throw err;
      if (attempt < maxAttempts - 1) {
        const delay = baseMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Construcție mesaje OpenAI-compatibil ─────────────────────────────────────
function buildMessages(message, history, systemPrompt) {
  const sys = systemPrompt || SYSTEM_PROMPT;
  return [
    { role: 'system', content: sys },
    ...history.slice(-6).map(m => ({ role: m.role, content: String(m.content) })),
    { role: 'user', content: String(message) },
  ];
}

// ─── Apel provider specific ───────────────────────────────────────────────────
async function callProvider(provider, message, history, systemPrompt, maxTokens) {
  const key = process.env[provider.envKey];
  if (!key || key.length < 8 || key.includes('your_')) return null;

  const msgs = buildMessages(message, history, systemPrompt);
  const tokens = maxTokens || 500;

  // ── OpenAI-compatible ──
  if (provider.type === 'openai-compat') {
    const headers = {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      ...(provider.extraHeaders || {}),
    };
    const resp = await axios.post(
      provider.endpoint,
      { model: provider.model, messages: msgs, max_tokens: tokens, temperature: 0.7 },
      { headers, timeout: provider.timeout }
    );
    const text = resp.data.choices?.[0]?.message?.content || '';
    return { reply: text, model: provider.name + ':' + provider.model };
  }

  // ── Anthropic Claude ──
  if (provider.type === 'anthropic') {
    const userMessages = [
      ...history.slice(-6).map(m => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content: String(message) },
    ];
    const resp = await axios.post(
      provider.endpoint,
      { model: provider.model, system: systemPrompt || SYSTEM_PROMPT, messages: userMessages, max_tokens: tokens },
      {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        timeout: provider.timeout,
      }
    );
    return { reply: resp.data.content?.[0]?.text || '', model: provider.name + ':' + provider.model };
  }

  // ── Google Gemini ──
  if (provider.type === 'google') {
    const contents = [
      ...history.slice(-6).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content) }],
      })),
      { role: 'user', parts: [{ text: String(message) }] },
    ];
    const resp = await axios.post(
      `${provider.endpoint}?key=${key}`,
      {
        system_instruction: { parts: [{ text: systemPrompt || SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: tokens, temperature: 0.7 },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: provider.timeout }
    );
    const text = resp.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { reply: text, model: provider.name + ':' + provider.model };
  }

  // ── Cohere ──
  if (provider.type === 'cohere') {
    const chatHistory = history.slice(-6).map(m => ({
      role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
      message: String(m.content),
    }));
    const resp = await axios.post(
      provider.endpoint,
      {
        model: provider.model,
        message: String(message),
        chat_history: chatHistory,
        preamble: systemPrompt || SYSTEM_PROMPT,
        max_tokens: tokens,
        temperature: 0.7,
      },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: provider.timeout }
    );
    return { reply: resp.data.text || '', model: provider.name + ':' + provider.model };
  }

  // ── HuggingFace Inference API ──
  if (provider.type === 'huggingface') {
    const prompt = `<s>[INST] ${String(message)} [/INST]`;
    const resp = await axios.post(
      provider.endpoint,
      { inputs: prompt, parameters: { max_new_tokens: tokens, temperature: 0.7 } },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: provider.timeout }
    );
    const text = Array.isArray(resp.data) ? (resp.data[0]?.generated_text || '') : (resp.data?.generated_text || '');
    // Elimină promptul din răspuns dacă e inclus
    const clean = text.replace(prompt, '').trim();
    return { reply: clean, model: provider.name + ':' + provider.model };
  }

  return null;
}

// ─── Performance stats ────────────────────────────────────────────────────────
const _stats = {};
PROVIDER_CATALOG.forEach(p => {
  _stats[p.name] = {
    calls: 0,
    successes: 0,
    errors: 0,
    totalLatencyMs: 0,
    totalTokensCost: 0,
    lastError: null,
    lastUsed: null,
    avgLatencyMs: 0,
    errorRate: 0,
  };
});

function _recordSuccess(name, latencyMs, estimatedCost) {
  const s = _stats[name];
  if (!s) return;
  s.calls++;
  s.successes++;
  s.totalLatencyMs += latencyMs;
  s.totalTokensCost += estimatedCost || 0;
  s.lastUsed = Date.now();
  s.avgLatencyMs = Math.round(s.totalLatencyMs / s.successes);
  s.errorRate = s.errors / s.calls;
}

function _recordError(name, errMsg) {
  const s = _stats[name];
  if (!s) return;
  s.calls++;
  s.errors++;
  s.lastError = errMsg;
  s.errorRate = s.errors / s.calls;
}

// ─── Cache inteligent ──────────────────────────────────────────────────────────
const _cache = new Map();

function _cacheKey(message, taskType) {
  return taskType + ':' + String(message).slice(0, 200);
}

function _getCache(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.value;
}

function _setCache(key, value) {
  if (_cache.size > 500) {
    // Elimină cel mai vechi entry
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
  _cache.set(key, { value, ts: Date.now() });
}

// ─── Cost spike detection ─────────────────────────────────────────────────────
const _recentCosts = {}; // name → ultimele 10 costuri
function _isCostSpike(name, currentCost) {
  if (!_recentCosts[name]) _recentCosts[name] = [];
  const arr = _recentCosts[name];
  if (arr.length >= 10) arr.shift();
  arr.push(currentCost);
  if (arr.length < 3) return false;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return currentCost > avg * COST_SPIKE_MULTIPLIER;
}

// ─── Selectare providers în ordine pentru task-type ───────────────────────────
function _getOrderedProviders(taskType) {
  const order = TASK_ROUTING[taskType] || TASK_ROUTING.chat;
  const catalog = new Map(PROVIDER_CATALOG.map(p => [p.name, p]));

  // Construiește lista în ordinea definită în routing
  const ordered = order
    .map(name => catalog.get(name))
    .filter(Boolean);

  // Adaugă orice provider necatalogat în routing (safety net)
  const seen = new Set(ordered.map(p => p.name));
  PROVIDER_CATALOG.forEach(p => {
    if (!seen.has(p.name)) ordered.push(p);
  });

  return ordered;
}

// ─── API principal: ask() ──────────────────────────────────────────────────────
/**
 * Trimite un mesaj la cel mai bun provider disponibil cu fallback automat.
 *
 * @param {string} message          - Mesajul utilizatorului
 * @param {object} [options]
 * @param {string} [options.taskType='chat'] - 'chat'|'simple'|'complex'|'code'|'reasoning'|'search'|'embedding'|'rare'|'llama'
 * @param {string} [options.systemPrompt]   - Prompt sistem custom
 * @param {number} [options.maxTokens=500]  - Tokeni maximi în răspuns
 * @param {Array}  [options.history=[]]     - Istoricul conversației
 * @param {boolean}[options.useCache=true]  - Activează cache
 * @returns {Promise<{reply:string, model:string, provider:string, latencyMs:number}|null>}
 */
async function ask(message, options = {}) {
  const {
    taskType = 'chat',
    systemPrompt,
    maxTokens = 500,
    history = [],
    useCache = true,
  } = options;

  // Cache check (doar pentru răspunsuri non-history)
  if (useCache && history.length === 0) {
    const ck = _cacheKey(message, taskType);
    const cached = _getCache(ck);
    if (cached) return { ...cached, fromCache: true };
  }

  const providers = _getOrderedProviders(taskType);
  const skipped = [];

  for (const provider of providers) {
    // Verifică dacă cheia e configurată
    const key = process.env[provider.envKey];
    if (!key || key.length < 8 || key.includes('your_')) continue;

    // Evită provideri cu rata de eroare > 80% (circuit breaker simplu)
    const st = _stats[provider.name];
    if (st && st.calls >= 5 && st.errorRate > 0.8) {
      skipped.push(provider.name);
      continue;
    }

    const t0 = Date.now();
    try {
      const result = await withBackoff(
        () => callProvider(provider, message, history, systemPrompt, maxTokens),
        RETRY_MAX,
        RETRY_BASE_MS
      );

      if (!result || !result.reply) continue;

      const latencyMs = Date.now() - t0;
      const estimatedCost = (maxTokens / 1000) * provider.costPer1KTokens;

      // Cost spike → log avertisment dar continuă (deja am răspuns)
      if (_isCostSpike(provider.name, estimatedCost)) {
        console.warn(`[MultiRouter] Cost spike detectat la ${provider.name}: ${estimatedCost.toFixed(6)} USD`);
      }

      _recordSuccess(provider.name, latencyMs, estimatedCost);

      const response = {
        reply: result.reply,
        model: result.model,
        provider: provider.name,
        taskType,
        latencyMs,
        estimatedCostUSD: estimatedCost,
        fromCache: false,
      };

      // Pune în cache dacă nu are history
      if (useCache && history.length === 0) {
        _setCache(_cacheKey(message, taskType), response);
      }

      return response;

    } catch (err) {
      const latencyMs = Date.now() - t0;
      const errMsg = err.response?.data?.error?.message || err.message || 'unknown';
      _recordError(provider.name, errMsg);
      console.error(`[MultiRouter] ${provider.name} eșuat (${latencyMs}ms): ${errMsg}`);
      // Continuă cu următorul provider
    }
  }

  // Toți providerii au eșuat
  console.warn(`[MultiRouter] Toți providerii au eșuat pentru taskType=${taskType}. Skipped: ${skipped.join(', ')}`);
  return null;
}

// ─── Raport de performanță ────────────────────────────────────────────────────
/**
 * Generează un raport detaliat al performanței pentru toți providerii.
 */
function getPerformanceReport() {
  const providerReports = PROVIDER_CATALOG.map(p => {
    const key = process.env[p.envKey];
    const configured = Boolean(key && key.length >= 8 && !key.includes('your_'));
    const s = _stats[p.name] || {};

    return {
      provider: p.name,
      tier: p.tier,
      configured,
      taskTypes: p.taskTypes,
      costPer1KTokens: p.costPer1KTokens,
      costPer1MTokens: p.costPer1KTokens * 1000,
      speedScore: p.speedScore,
      // Runtime stats
      totalCalls: s.calls || 0,
      successRate: s.calls ? ((s.successes / s.calls) * 100).toFixed(1) + '%' : 'N/A',
      errorRate: s.calls ? ((s.errors / s.calls) * 100).toFixed(1) + '%' : 'N/A',
      avgLatencyMs: s.avgLatencyMs || 0,
      totalCostUSD: (s.totalTokensCost || 0).toFixed(6),
      lastError: s.lastError || null,
      lastUsed: s.lastUsed ? new Date(s.lastUsed).toISOString() : null,
      // Scor combinat (lower = better pentru routing)
      routingScore: configured
        ? (p.costPer1KTokens * 10 + (1 - p.speedScore) + (s.errorRate || 0) * 5).toFixed(4)
        : '∞',
    };
  });

  // Sortare după routing score (mai mic = prioritate mai mare)
  const sorted = [...providerReports]
    .filter(r => r.configured)
    .sort((a, b) => parseFloat(a.routingScore) - parseFloat(b.routingScore));

  const totalConfigured = providerReports.filter(r => r.configured).length;
  const cacheHits = [..._cache.values()].length;

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalProviders: PROVIDER_CATALOG.length,
      configuredProviders: totalConfigured,
      cacheEntries: cacheHits,
      cacheTTLSeconds: Math.round(CACHE_TTL_MS / 1000),
    },
    routing: {
      cheapTier: PROVIDER_CATALOG.filter(p => p.tier === 'cheap').map(p => p.name),
      midTier:   PROVIDER_CATALOG.filter(p => p.tier === 'mid').map(p => p.name),
      premiumTier: PROVIDER_CATALOG.filter(p => p.tier === 'premium').map(p => p.name),
      taskRouting: TASK_ROUTING,
    },
    recommendations: sorted.slice(0, 3).map(r => ({
      provider: r.provider,
      reason: `Cost: $${r.costPer1MTokens}/1M tokens, Latency: ${r.avgLatencyMs}ms, Errors: ${r.errorRate}`,
    })),
    providers: providerReports,
    profitOptimization: {
      enabled: true,
      simpleTaskProviders: ['groq', 'deepseek', 'mistral'],
      complexTaskProviders: ['claude', 'gemini'],
      embeddingProviders:   ['cohere', 'fireworks'],
      searchProviders:      ['perplexity'],
      rareModelProviders:   ['openrouter'],
      llamaProviders:       ['sambanova', 'nvidia-nim'],
    },
  };
}

// ─── Status rapid ─────────────────────────────────────────────────────────────
function getStatus() {
  return {
    active: true,
    totalProviders: PROVIDER_CATALOG.length,
    configuredProviders: PROVIDER_CATALOG.filter(p => {
      const k = process.env[p.envKey];
      return k && k.length >= 8 && !k.includes('your_');
    }).length,
    providers: PROVIDER_CATALOG.map(p => {
      const k = process.env[p.envKey];
      const configured = Boolean(k && k.length >= 8 && !k.includes('your_'));
      const s = _stats[p.name] || {};
      return {
        name: p.name,
        tier: p.tier,
        configured,
        taskTypes: p.taskTypes,
        costPer1MTokens: p.costPer1KTokens * 1000,
        calls: s.calls || 0,
        errorRate: s.calls ? ((s.errors / s.calls) * 100).toFixed(1) + '%' : '0%',
        avgLatencyMs: s.avgLatencyMs || 0,
      };
    }),
    cacheSize: _cache.size,
    timestamp: new Date().toISOString(),
  };
}

// ─── Resetare statistici ──────────────────────────────────────────────────────
function resetStats() {
  PROVIDER_CATALOG.forEach(p => {
    _stats[p.name] = {
      calls: 0, successes: 0, errors: 0,
      totalLatencyMs: 0, totalTokensCost: 0,
      lastError: null, lastUsed: null,
      avgLatencyMs: 0, errorRate: 0,
    };
  });
  _cache.clear();
}

// ─── Export ────────────────────────────────────────────────────────────────────
module.exports = {
  ask,
  getStatus,
  getPerformanceReport,
  resetStats,
  PROVIDER_CATALOG,
  TASK_ROUTING,
};
