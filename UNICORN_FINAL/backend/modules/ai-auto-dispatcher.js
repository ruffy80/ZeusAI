'use strict';
/**
 * AI Auto Dispatcher — Smart AI Task Distribution Across All Tenants
 * - Auto-detects task type from message content
 * - Routes to the best provider based on task type, plan, and load
 * - Tenant-aware dispatch with quota enforcement
 * - Batch dispatch support
 * - Fallback chain on provider failure
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

// ─── Module context → task type mapping ───────────────────────────────────────
const _MODULE_CONTEXT_MAP_V1 = {
  'billing':    'reasoning',
  'analytics':  'analysis',
  'code':       'coding',
  'search':     'search_reasoning',
  'embed':      'embeddings',
  'tool':       'tool_use',
  'fast':       'fast',
  'chat':       'chat',
  'optimize':   'optimization',
};

// ─── Dispatch stats ───────────────────────────────────────────────────────────
const dispatchStats = {
  total: 0,
  byTaskType: new Map(),
  byTenant: new Map(),
  failures: 0,
  startedAt: new Date().toISOString(),
};

// ─── Pending task map ─────────────────────────────────────────────────────────
const pendingTasks = new Map(); // taskId → task

class AIAutoDispatcher extends EventEmitter {
  constructor() {
    super();
    this.startTime = Date.now();
  }

  // ── Resolve task type from context & message ──────────────────────────────
  resolveTaskType(context, message) {
    // First try context map
    for (const [key, type] of Object.entries(_MODULE_CONTEXT_MAP_V1)) {
      if (context && context.toLowerCase().includes(key)) return type;
    }
    try {
      const orch = require('./ai-orchestrator');
      if (orch && typeof orch.autoDetectTaskType === 'function') {
        const detected = orch.autoDetectTaskType(message || '');
        if (detected && detected !== 'chat') return detected;
      }
    } catch (_) {}

    // Default patterns
    const msg = (message || '').toLowerCase();
    if (/\bcode\b|\bfunction\b|\bimplement\b|\bscript\b/.test(msg)) return 'coding';
    if (/\bsearch\b|\bfind\b|\blookup\b|\bquery\b/.test(msg))       return 'search_reasoning';
    if (/\banalyze\b|\breport\b|\bmetrics\b|\bdata\b/.test(msg))    return 'analysis';
    if (/\bembed\b|\bvector\b|\bsimilarity\b/.test(msg))            return 'embeddings';
    return 'chat';
  }

  // ── Single dispatch ────────────────────────────────────────────────────────
  async dispatch(message, opts = {}) {
    const taskId   = 'aidisp_' + crypto.randomBytes(6).toString('hex');
    const tenantId = opts.tenantId || 'system';
    const context  = opts.context || '';
    const taskType = opts.taskType || this.resolveTaskType(context, message);
    const plan     = opts.plan || 'free';

    const task = {
      id: taskId,
      tenantId,
      message,
      taskType,
      plan,
      context,
      status: 'pending',
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      provider: null,
      durationMs: null,
    };

    pendingTasks.set(taskId, task);
    dispatchStats.total++;
    dispatchStats.byTaskType.set(taskType, (dispatchStats.byTaskType.get(taskType) || 0) + 1);
    dispatchStats.byTenant.set(tenantId, (dispatchStats.byTenant.get(tenantId) || 0) + 1);

    const start = Date.now();
    task.status = 'running';

    try {
      const result = await this._callAI(message, taskType, opts);
      task.result = result;
      task.status = 'completed';
      task.provider = result && result._provider ? result._provider : 'unknown';
    } catch (err) {
      task.error = err.message;
      task.status = 'failed';
      dispatchStats.failures++;
      this.emit('dispatch:failed', { taskId, tenantId, taskType, error: err.message });
    }

    task.completedAt = new Date().toISOString();
    task.durationMs  = Date.now() - start;

    // Clean up after 5 min
    setTimeout(() => pendingTasks.delete(taskId), 5 * 60 * 1000);

    this.emit('dispatch:completed', { taskId, tenantId, taskType, durationMs: task.durationMs });
    return task;
  }

  async _callAI(message, taskType, opts = {}) {
    const providers = [];

    // Try ai-orchestrator (primary)
    try {
      const orch = require('./ai-orchestrator');
      if (orch && typeof orch.ask === 'function') providers.push(orch);
    } catch (_) {}

    // Try multi-model-router (secondary)
    try {
      const router = require('./multi-model-router');
      if (router && typeof router.ask === 'function') providers.push(router);
    } catch (_) {}

    // Try universalAIConnector (tertiary)
    try {
      const uac = require('./universalAIConnector');
      if (uac && typeof uac.chat === 'function') providers.push({ ask: (m, o) => uac.chat(m, o) });
    } catch (_) {}

    for (const provider of providers) {
      try {
        const result = await provider.ask(message, { taskType, ...opts });
        if (result) return result;
      } catch (_) {
        // try next provider
      }
    }

    throw new Error('All AI providers failed for dispatch');
  }

  // ── Batch dispatch ─────────────────────────────────────────────────────────
  async dispatchBatch(tasks = []) {
    const results = await Promise.allSettled(
      tasks.map(t => this.dispatch(t.message, t.opts || {}))
    );
    return results.map((r, i) => ({
      index: i,
      status: r.status,
      value: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? r.reason && r.reason.message : null,
    }));
  }

  // ── Status query ──────────────────────────────────────────────────────────
  getTask(taskId) {
    return pendingTasks.get(taskId) || null;
  }

  getStatus() {
    const topTypes = [...dispatchStats.byTaskType.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([type, count]) => ({ type, count }));

    return {
      module: 'AIAutoDispatcher',
      version: '1.0.0',
      totalDispatched: dispatchStats.total,
      failures: dispatchStats.failures,
      pendingTasks: pendingTasks.size,
      topTaskTypes: topTypes,
      activeTenants: dispatchStats.byTenant.size,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      startedAt: dispatchStats.startedAt,
    };
  }
}

module.exports = new AIAutoDispatcher();
module.exports.AIAutoDispatcher = AIAutoDispatcher;
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
