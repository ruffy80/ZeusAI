// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:40:29.172Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * ORCHESTRATOR V4 — Zeus AI Unicorn Multi-Tenant SaaS Platform
 *
 * Per-tenant execution engine and scaling controller:
 *   1. Per-tenant task queues (isolated from other tenants)
 *   2. Priority scheduling (enterprise > pro > starter > free)
 *   3. Per-tenant concurrency limits based on plan
 *   4. Automatic back-pressure and queue overflow protection
 *   5. Health monitoring of all tenant execution contexts
 *   6. Self-healing: detect and recover stalled tenant queues
 *   7. Global load balancing across worker slots
 *   8. Backward compat: single-tenant (default) always present
 */

const EventEmitter = require('events');
const tenantManager = require('./tenant-manager');

// ── Config ────────────────────────────────────────────────────────────────────
const PLAN_CONCURRENCY = {
  free:       1,
  starter:    3,
  pro:        10,
  enterprise: 50,
};

const PLAN_QUEUE_SIZE = {
  free:       20,
  starter:    100,
  pro:        500,
  enterprise: 5_000,
};

const PLAN_PRIORITY = {
  enterprise: 0,
  pro:        1,
  starter:    2,
  free:       3,
};

const STALL_DETECT_MS   = parseInt(process.env.ORCH_V4_STALL_MS   || '30000', 10);
const HEALTH_INTERVAL_MS = parseInt(process.env.ORCH_V4_HEALTH_MS || '15000', 10);

// ── Per-tenant execution context ──────────────────────────────────────────────

class TenantExecutionContext {
  constructor(tenantId, plan) {
    this.tenantId   = tenantId;
    this.plan       = plan;
    this.concurrency = PLAN_CONCURRENCY[plan] || 1;
    this.maxQueue    = PLAN_QUEUE_SIZE[plan]   || 20;
    this.priority    = PLAN_PRIORITY[plan]     || 3;

    this._queue      = [];
    this._running    = 0;
    this._stats      = { enqueued: 0, completed: 0, failed: 0, overflows: 0, stalls: 0 };
    this._lastActivity = Date.now();
    this._status     = 'idle';
  }

  canAccept() {
    return this._queue.length < this.maxQueue;
  }

  enqueue(task) {
    if (!this.canAccept()) {
      this._stats.overflows++;
      throw new Error(`[OrchestratorV4] Queue full for tenant ${this.tenantId} (plan: ${this.plan})`);
    }
    this._queue.push(task);
    this._stats.enqueued++;
    this._lastActivity = Date.now();
    this._drain();
  }

  _drain() {
    while (this._running < this.concurrency && this._queue.length > 0) {
      const task = this._queue.shift();
      this._running++;
      this._status = 'running';
      this._execute(task);
    }
    if (this._running === 0 && this._queue.length === 0) this._status = 'idle';
  }

  async _execute(task) {
    const startTs = Date.now();
    try {
      const result = await task.fn();
      this._stats.completed++;
      task.resolve(result);
    } catch (err) {
      this._stats.failed++;
      task.reject(err);
    } finally {
      this._running--;
      this._lastActivity = Date.now();
      this._drain();
    }
  }

  getStats() {
    return {
      tenantId: this.tenantId,
      plan: this.plan,
      status: this._status,
      running: this._running,
      queued: this._queue.length,
      concurrency: this.concurrency,
      maxQueue: this.maxQueue,
      priority: this.priority,
      ...this._stats,
      lastActivity: new Date(this._lastActivity).toISOString(),
    };
  }

  isStalled() {
    return this._running > 0 && (Date.now() - this._lastActivity) > STALL_DETECT_MS;
  }

  heal() {
    if (this.isStalled()) {
      this._stats.stalls++;
      this._running = 0;
      this._status = 'idle';
      this._drain();
      console.warn(`[OrchestratorV4] Healed stalled context for tenant ${this.tenantId}`);
    }
  }
}

// ── Orchestrator V4 ───────────────────────────────────────────────────────────

class OrchestratorV4 extends EventEmitter {
  constructor() {
    super();
    this._contexts = new Map(); // Map<tenantId, TenantExecutionContext>
    this._running  = false;
    this._healthTimer = null;
    this._globalStats = {
      totalTasksDispatched: 0,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
    };
  }

  _getContext(tenantId) {
    if (!this._contexts.has(tenantId)) {
      const tenant = tenantManager.getTenant(tenantId);
      const plan   = tenant ? tenant.plan : 'free';
      this._contexts.set(tenantId, new TenantExecutionContext(tenantId, plan));
    }
    return this._contexts.get(tenantId);
  }

  /**
   * dispatch(tenantId, fn, opts)
   * fn must be an async function returning a result.
   * Returns a Promise that resolves/rejects when fn completes.
   */
  dispatch(tenantId, fn, { timeout = 60_000 } = {}) {
    const ctx = this._getContext(tenantId);
    this._globalStats.totalTasksDispatched++;

    // Clamp timeout to prevent resource exhaustion from caller-controlled durations
    const safeTimeout = Math.min(Math.max(parseInt(timeout, 10) || 60_000, 1_000), 300_000);

    return new Promise((resolve, reject) => {
      const wrappedFn = () => {
        const timer = setTimeout(() => {
          reject(new Error(`[OrchestratorV4] Task timeout (${safeTimeout}ms) for tenant ${tenantId}`));
        }, safeTimeout);

        return Promise.resolve()
          .then(() => fn())
          .then(r => { clearTimeout(timer); return r; })
          .catch(e => { clearTimeout(timer); throw e; });
      };

      try {
        ctx.enqueue({ fn: wrappedFn, resolve: (r) => { this._globalStats.totalTasksCompleted++; resolve(r); }, reject: (e) => { this._globalStats.totalTasksFailed++; reject(e); } });
      } catch (err) {
        this._globalStats.totalTasksFailed++;
        reject(err);
      }
    });
  }

  /**
   * dispatchBatch(tasks)
   * tasks = [{ tenantId, fn, opts }]
   * Tasks are sorted by tenant priority before dispatch.
   */
  async dispatchBatch(tasks = []) {
    const sorted = [...tasks].sort((a, b) => {
      const ctxA = this._getContext(a.tenantId);
      const ctxB = this._getContext(b.tenantId);
      return ctxA.priority - ctxB.priority;
    });

    const results = await Promise.allSettled(
      sorted.map(t => this.dispatch(t.tenantId, t.fn, t.opts || {}))
    );

    return results.map((r, i) => ({
      tenantId: sorted[i].tenantId,
      status: r.status,
      value: r.value,
      reason: r.reason ? r.reason.message : undefined,
    }));
  }

  start() {
    if (this._running) return;
    this._running = true;
    // Init default tenant context
    this._getContext(tenantManager.DEFAULT_TENANT_ID);

    this._healthTimer = setInterval(() => this._healthCheck(), HEALTH_INTERVAL_MS);
    this._healthTimer.unref();
    console.log('[OrchestratorV4] Started');
  }

  stop() {
    this._running = false;
    if (this._healthTimer) { clearInterval(this._healthTimer); this._healthTimer = null; }
    console.log('[OrchestratorV4] Stopped');
  }

  _healthCheck() {
    for (const ctx of this._contexts.values()) {
      // Sync plan if tenant plan changed
      const tenant = tenantManager.getTenant(ctx.tenantId);
      if (tenant && tenant.plan !== ctx.plan) {
        ctx.plan        = tenant.plan;
        ctx.concurrency = PLAN_CONCURRENCY[tenant.plan] || 1;
        ctx.maxQueue    = PLAN_QUEUE_SIZE[tenant.plan]   || 20;
        ctx.priority    = PLAN_PRIORITY[tenant.plan]     || 3;
      }
      ctx.heal();
    }
    this.emit('health', this.getStatus());
  }

  getContextStats(tenantId) {
    if (!this._contexts.has(tenantId)) return null;
    return this._contexts.get(tenantId).getStats();
  }

  getAllContextStats() {
    const out = [];
    for (const ctx of this._contexts.values()) {
      out.push(ctx.getStats());
    }
    return out;
  }

  getStatus() {
    const contexts = this.getAllContextStats();
    return {
      module: 'OrchestratorV4',
      status: this._running ? 'active' : 'stopped',
      tenantContexts: contexts.length,
      globalStats: this._globalStats,
      contexts,
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
const orchestratorV4 = new OrchestratorV4();
orchestratorV4.start();

module.exports = orchestratorV4;
