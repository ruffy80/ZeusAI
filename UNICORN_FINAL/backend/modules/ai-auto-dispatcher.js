// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T11:30:00.000Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// AI AUTO DISPATCHER — Zeus AI Unicorn
// Dispatcher universal care conectează automat toate modulele unicornului
// la providerii AI potriviți, în funcție de tipul sarcinii.
//
// Fiecare AI face task-ul la care e cel mai bun:
//   - DeepSeek / Groq   → coding, optimization, fast responses
//   - Anthropic / OpenAI → reasoning, complex analysis
//   - Perplexity         → search, news, web queries
//   - Gemini             → tool use, search, complex reasoning
//   - Cohere             → embeddings, search
//   - Mistral            → text generation, chat
//   - HuggingFace/Together/Fireworks/SambaNova/NVIDIA → open-source tasks
//   - xAI (Grok)        → premium chat
// =====================================================================
'use strict';

let _orchestrator = null;
let _multiRouter  = null;

function _loadDeps() {
  if (!_orchestrator) {
    try { _orchestrator = require('./ai-orchestrator'); } catch { _orchestrator = null; }
  }
  if (!_multiRouter) {
    try { _multiRouter = require('./multi-model-router'); } catch { _multiRouter = null; }
  }
}

// ─── Statistics ────────────────────────────────────────────────────────────
const _stats = {
  total: 0,
  byTaskType: {},
  byProvider: {},
  failures: 0,
  lastDispatchedAt: null,
};

function _recordStat(taskType, provider) {
  _stats.total++;
  _stats.byTaskType[taskType] = (_stats.byTaskType[taskType] || 0) + 1;
  if (provider) _stats.byProvider[provider] = (_stats.byProvider[provider] || 0) + 1;
  _stats.lastDispatchedAt = new Date().toISOString();
}

// ─── Module capability map ─────────────────────────────────────────────────
// Maps a module context/purpose to the preferred task type.
// Modules can pass their `context` to get best-fit AI routing.
const MODULE_CONTEXT_MAP = {
  // AdaptiveModules — general intelligence adaptation
  adaptive:         'reasoning',
  // Engines — processing pipelines
  engine:           'analysis',
  // Business modules
  revenue:          'analysis',
  profit:           'analysis',
  payment:          'tool_use',
  sales:            'text_generation',
  marketing:        'text_generation',
  content:          'text_generation',
  seo:              'text_generation',
  legal:            'reasoning',
  compliance:       'reasoning',
  risk:             'analysis',
  // Tech modules
  code:             'coding',
  optimize:         'optimization',
  repair:           'coding',
  security:         'reasoning',
  deploy:           'coding',
  // Data modules
  analytics:        'analysis',
  sentiment:        'analysis',
  prediction:       'reasoning',
  // Search / intelligence
  search:           'search_reasoning',
  competitor:       'search_reasoning',
  market:           'search_reasoning',
  innovation:       'reasoning',
  // Fast / lightweight
  fast:             'fast',
  chat:             'chat',
  default:          'chat',
};

/**
 * Resolve best task type for a module context + input message combo.
 * Orchestrator auto-detection always wins if message is rich enough.
 *
 * @param {string} context  - module name/purpose hint (e.g. 'revenue', 'engine', 'seo')
 * @param {string} message  - the actual input text
 * @returns {string} taskType
 */
function resolveTaskType(context, message) {
  _loadDeps();
  // AI orchestrator auto-detection (keyword-based) takes priority
  if (_orchestrator && typeof _orchestrator.autoDetectTaskType === 'function') {
    const detected = _orchestrator.autoDetectTaskType(message);
    // Only override with module context if auto-detection returned generic 'chat'
    if (detected && detected !== 'chat') return detected;
  }
  // Fall back to module context map
  const ctx = String(context || '').toLowerCase();
  for (const [key, type] of Object.entries(MODULE_CONTEXT_MAP)) {
    if (ctx.includes(key)) return type;
  }
  return 'chat';
}

// ─── Core dispatch function ────────────────────────────────────────────────
/**
 * Dispatch a message to the best available AI provider, automatically
 * routing based on message content and optional module context.
 *
 * @param {string} message          - the message/task to process
 * @param {object} [opts={}]
 * @param {string}  [opts.context]  - module context hint ('revenue', 'coding', 'search', …)
 * @param {string}  [opts.taskType] - explicit override (skips auto-detection)
 * @param {Array}   [opts.history]  - conversation history
 * @param {string}  [opts.systemPrompt] - custom system prompt
 * @param {boolean} [opts.useCache] - enable/disable cache (default: true)
 * @param {string}  [opts.preferProvider] - force a specific provider
 * @returns {Promise<{reply:string, model:string, provider:string, taskType:string, latencyMs:number}>}
 */
async function dispatch(message, opts = {}) {
  _loadDeps();
  const {
    context        = 'default',
    taskType       = null,
    history        = [],
    systemPrompt   = null,
    useCache       = true,
    preferProvider = null,
  } = opts;

  const resolvedType = taskType || resolveTaskType(context, message);

  console.info(`[AIAutoDispatcher] dispatch context=${context} taskType=${resolvedType}`);

  // 1️⃣ AI Orchestrator — routing inteligent (15 providers)
  if (_orchestrator) {
    try {
      const result = await _orchestrator.ask(message, {
        taskType: resolvedType,
        history,
        useCache,
        preferProvider,
      });
      if (result && result.reply) {
        const finalTaskType = result.detectedTaskType || resolvedType;
        _recordStat(finalTaskType, result.provider);
        return {
          reply:    result.reply,
          model:    result.model,
          provider: result.provider,
          taskType: finalTaskType,
          latencyMs: result.latencyMs,
          cached:   result.cached,
          source:   'orchestrator',
        };
      }
    } catch (err) {
      console.warn('[AIAutoDispatcher] Orchestrator failed:', err.message);
    }
  }

  // 2️⃣ Multi-Model Router — fallback (14 providers)
  if (_multiRouter) {
    try {
      const result = await _multiRouter.ask(message, {
        taskType: resolvedType,
        systemPrompt,
        history,
      });
      if (result && result.reply) {
        _recordStat(resolvedType, result.provider);
        return {
          reply:    result.reply,
          model:    result.model,
          provider: result.provider,
          taskType: resolvedType,
          latencyMs: result.latencyMs,
          source:   'multi-router',
        };
      }
    } catch (err) {
      console.warn('[AIAutoDispatcher] MultiRouter failed:', err.message);
    }
  }

  _stats.failures++;
  return null;
}

// ─── Batch dispatch ────────────────────────────────────────────────────────
/**
 * Dispatch multiple tasks in parallel.
 * Each task is automatically routed to the best AI for its type.
 *
 * @param {Array<{message:string, context?:string, taskType?:string}>} tasks
 * @returns {Promise<Array>}
 */
async function dispatchBatch(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  return Promise.allSettled(
    tasks.map(t => dispatch(t.message, { context: t.context, taskType: t.taskType, history: t.history || [] }))
  ).then(results => results.map((r, i) => ({
    index:   i,
    success: r.status === 'fulfilled' && r.value !== null,
    result:  r.status === 'fulfilled' ? r.value : null,
    error:   r.status === 'rejected'  ? r.reason?.message : null,
  })));
}

// ─── Status ────────────────────────────────────────────────────────────────
function getStatus() {
  _loadDeps();
  return {
    active:           true,
    module:           'ai-auto-dispatcher',
    version:          '1.0.0',
    orchestratorLoaded: Boolean(_orchestrator),
    multiRouterLoaded:  Boolean(_multiRouter),
    stats:            { ..._stats },
    availableTaskTypes: _orchestrator ? Object.keys(_orchestrator.TASK_ROUTING) : [],
    moduleContextMap:   MODULE_CONTEXT_MAP,
    timestamp:          new Date().toISOString(),
  };
}

module.exports = { dispatch, dispatchBatch, resolveTaskType, getStatus };
