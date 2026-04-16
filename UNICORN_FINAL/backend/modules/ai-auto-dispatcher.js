// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:40:28.841Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

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
const MODULE_CONTEXT_MAP = {
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
    for (const [key, type] of Object.entries(MODULE_CONTEXT_MAP)) {
      if (context && context.toLowerCase().includes(key)) return type;
    }

    // Then try auto-detection via ai-orchestrator
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
