// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// autonomous-intelligence-core.js — Agent Intelligence Loop
// Nucleul de inteligență autonomă pentru agenți Unicorn
// =============================================================================
// Implements the TPEORIM cycle for every agent:
//   Think → Plan → Execute → Observe → Reflect → Improve → Memorize
//
// Features:
//   1. Confidence scoring per decision
//   2. Adaptive retry with exponential backoff + jitter
//   3. Success/failure memory (persistent, vector-searchable)
//   4. Task prioritization queue (priority + deadline scoring)
//   5. Context reconstruction from memory
//   6. Self-correction from failure patterns
//   7. Performance improvement over time
// =============================================================================

'use strict';

const fs           = require('fs');
const path         = require('path');
const EventEmitter = require('events');
const express      = require('express');
const crypto       = require('crypto');

// ── Storage ───────────────────────────────────────────────────────────────
const DATA_DIR        = path.join(__dirname, '../../data/agent-intelligence');
const MEMORY_FILE     = path.join(DATA_DIR, 'agent-memory.json');
const TASK_QUEUE_FILE = path.join(DATA_DIR, 'task-queue.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

const bus = new EventEmitter();
bus.setMaxListeners(50);

// ── Memory Store ──────────────────────────────────────────────────────────
/** @type {Map<string, AgentMemory>} agentId → memories */
const _memories = new Map();

/** @type {Array<TaskQueueItem>} priority task queue */
let _taskQueue = _loadJson(TASK_QUEUE_FILE, []);

/** @type {Map<string, PerformanceProfile>} agentId → running stats */
const _performance = new Map();

// ── §1  MEMORY ENGINE ─────────────────────────────────────────────────────

/**
 * memorize — store a task result in agent memory (success or failure)
 * Memorează rezultatul unei sarcini (succes sau eșec)
 */
function memorize(agentId, { taskType, context, outcome, success, confidenceScore, durationMs = 0, metadata = {} }) {
  if (!agentId || !taskType) return;
  let mem = _memories.get(agentId);
  if (!mem) {
    mem = { agentId, successes: [], failures: [], patterns: {}, totalTasks: 0, createdAt: new Date().toISOString() };
    _memories.set(agentId, mem);
  }

  const record = {
    id:             crypto.randomBytes(4).toString('hex'),
    ts:             new Date().toISOString(),
    taskType,
    context:        _truncate(context, 500),
    outcome:        _truncate(outcome, 200),
    success,
    confidenceScore: confidenceScore || 0.5,
    durationMs,
    metadata,
  };

  if (success) {
    mem.successes.push(record);
    if (mem.successes.length > 200) mem.successes.shift();
  } else {
    mem.failures.push(record);
    if (mem.failures.length > 200) mem.failures.shift();
  }
  mem.totalTasks += 1;

  // Update pattern recognition
  mem.patterns[taskType] = mem.patterns[taskType] || { successCount: 0, failCount: 0, avgConfidence: 0 };
  const p = mem.patterns[taskType];
  if (success) p.successCount++; else p.failCount++;
  p.avgConfidence = (p.avgConfidence * (p.successCount + p.failCount - 1) + (confidenceScore || 0.5)) / (p.successCount + p.failCount);

  _persistMemory();
}

/**
 * recallContext — retrieve relevant memories for a task type
 * Recuperează amintiri relevante pentru un tip de sarcină
 */
function recallContext(agentId, taskType, limit = 5) {
  const mem = _memories.get(agentId);
  if (!mem) return { successes: [], failures: [], pattern: null };

  const successes = mem.successes
    .filter(m => m.taskType === taskType)
    .slice(-limit);
  const failures = mem.failures
    .filter(m => m.taskType === taskType)
    .slice(-limit);

  return {
    successes,
    failures,
    pattern:        mem.patterns[taskType] || null,
    reconstructedContext: _reconstructContext(successes, failures),
  };
}

function _reconstructContext(successes, failures) {
  if (!successes.length && !failures.length) return 'No prior context available.';
  const successRateText = successes.length > 0
    ? `Last ${successes.length} attempts succeeded. Best approach: ${successes[successes.length - 1]?.context || 'unknown'}`
    : 'No recent successes.';
  const failureText = failures.length > 0
    ? `Last failure: ${failures[failures.length - 1]?.outcome || 'unknown'}`
    : 'No recent failures.';
  return `${successRateText} ${failureText}`;
}

// ── §2  CONFIDENCE SCORING ────────────────────────────────────────────────

/**
 * computeConfidence — estimate probability of success for a task
 * Estimează probabilitatea de succes pentru o sarcină
 */
function computeConfidence(agentId, taskType, { contextSimilarity = 0.5, resourceAvailability = 1.0 } = {}) {
  const mem = _memories.get(agentId);
  const pattern = mem?.patterns?.[taskType];

  if (!pattern || (pattern.successCount + pattern.failCount) < 3) {
    // Not enough data — use moderate confidence
    return { score: 0.55, basis: 'insufficient-history', recommendation: 'proceed-with-monitoring' };
  }

  const total       = pattern.successCount + pattern.failCount;
  const baseRate    = pattern.successCount / total;
  // Bayesian-smooth with Beta(2,2) prior
  const smoothed    = (pattern.successCount + 2) / (total + 4);
  const confidence  = smoothed * contextSimilarity * resourceAvailability;

  return {
    score:          +Math.min(0.99, Math.max(0.01, confidence)).toFixed(3),
    basis:          'historical-pattern',
    successRate:    +(baseRate * 100).toFixed(1),
    sampleSize:     total,
    recommendation: confidence >= 0.7 ? 'proceed' : confidence >= 0.4 ? 'proceed-with-caution' : 'escalate-or-skip',
  };
}

// ── §3  ADAPTIVE RETRY ────────────────────────────────────────────────────

/**
 * withAdaptiveRetry — wraps an async fn with intelligent retry logic
 * Învelește o funcție asincronă cu logică de reîncercare inteligentă
 */
async function withAdaptiveRetry(agentId, taskType, fn, {
  maxRetries     = 3,
  baseDelayMs    = 500,
  maxDelayMs     = 30_000,
  confidenceMin  = 0.2,
  onRetry        = null,
} = {}) {
  const context = recallContext(agentId, taskType);
  const confidence = computeConfidence(agentId, taskType);

  if (confidence.score < confidenceMin) {
    const err = new Error(`Confidence ${confidence.score} below minimum ${confidenceMin} for task ${taskType}`);
    memorize(agentId, { taskType, context: 'pre-flight confidence check', outcome: err.message, success: false, confidenceScore: confidence.score });
    throw err;
  }

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const result = await fn({ attempt, context, confidence });
      const dur = Date.now() - start;
      memorize(agentId, { taskType, context: `attempt ${attempt + 1}`, outcome: 'success', success: true, confidenceScore: confidence.score, durationMs: dur });
      _updatePerformance(agentId, true, dur, attempt);
      return result;
    } catch (e) {
      lastError = e;
      const dur = Date.now() - start;
      memorize(agentId, { taskType, context: `attempt ${attempt + 1}`, outcome: e.message, success: false, confidenceScore: confidence.score, durationMs: dur });
      _updatePerformance(agentId, false, dur, attempt);

      if (attempt < maxRetries) {
        const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt) + Math.random() * 200);
        if (onRetry) try { onRetry({ attempt, error: e, delay }); } catch (_) {}
        await _sleep(delay);
      }
    }
  }
  throw lastError;
}

// ── §4  TASK PRIORITY QUEUE ───────────────────────────────────────────────

/**
 * enqueue — add a task to the priority queue
 * Adaugă o sarcină în coada de priorități
 */
function enqueue({ taskId, agentId, taskType, priority = 5, deadline = null, payload = {}, metadata = {} }) {
  const item = {
    taskId:    taskId || `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    agentId,
    taskType,
    priority:  Math.max(1, Math.min(10, priority)),
    deadline,
    payload,
    metadata,
    enqueuedAt: new Date().toISOString(),
    status:    'queued',
  };
  _taskQueue.push(item);
  _taskQueue.sort(_taskComparator);
  if (_taskQueue.length > 10000) _taskQueue = _taskQueue.slice(0, 10000);
  _persistQueue();
  bus.emit('taskEnqueued', item);
  return item;
}

/**
 * dequeue — get highest priority task that can be run
 */
function dequeue(agentId = null) {
  const idx = _taskQueue.findIndex(t => t.status === 'queued' && (!agentId || t.agentId === agentId));
  if (idx === -1) return null;
  const task = _taskQueue[idx];
  _taskQueue[idx].status = 'running';
  _taskQueue[idx].startedAt = new Date().toISOString();
  _persistQueue();
  return task;
}

/**
 * completeTask — mark task done in queue
 */
function completeTask(taskId, { success = true, result = null } = {}) {
  const task = _taskQueue.find(t => t.taskId === taskId);
  if (!task) return false;
  task.status      = success ? 'completed' : 'failed';
  task.completedAt = new Date().toISOString();
  task.result      = result;
  _persistQueue();
  return true;
}

function _taskComparator(a, b) {
  // Higher priority first; break ties by deadline proximity; then FIFO
  if (b.priority !== a.priority) return b.priority - a.priority;
  if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
  if (a.deadline)  return -1;
  if (b.deadline)  return  1;
  return new Date(a.enqueuedAt) - new Date(b.enqueuedAt);
}

// ── §5  PERFORMANCE PROFILES ──────────────────────────────────────────────

function _updatePerformance(agentId, success, durationMs, retries) {
  let p = _performance.get(agentId);
  if (!p) { p = { agentId, tasks: 0, successes: 0, totalDuration: 0, totalRetries: 0 }; _performance.set(agentId, p); }
  p.tasks         += 1;
  p.successes     += success ? 1 : 0;
  p.totalDuration += durationMs;
  p.totalRetries  += retries;
}

function getAgentPerformance(agentId) {
  const p = _performance.get(agentId);
  const mem = _memories.get(agentId);
  if (!p) return null;
  return {
    agentId,
    tasks:          p.tasks,
    successRate:    p.tasks > 0 ? +((p.successes / p.tasks) * 100).toFixed(1) : 0,
    avgDurationMs:  p.tasks > 0 ? +(p.totalDuration / p.tasks).toFixed(1) : 0,
    avgRetries:     p.tasks > 0 ? +(p.totalRetries / p.tasks).toFixed(2) : 0,
    memorySize:     mem ? mem.successes.length + mem.failures.length : 0,
    patterns:       Object.keys(mem?.patterns || {}),
  };
}

function getAllPerformances() {
  return [..._performance.keys()].map(getAgentPerformance).filter(Boolean);
}

// ── §6  REFLECT & IMPROVE ─────────────────────────────────────────────────

/**
 * reflectAndImprove — analyze patterns, return actionable improvements
 * Analizează tipare și returnează îmbunătățiri acționabile
 */
function reflectAndImprove(agentId) {
  const mem = _memories.get(agentId);
  const perf = getAgentPerformance(agentId);
  if (!mem || !perf) return { suggestions: [], confidence: 0 };

  const suggestions = [];

  // Find worst-performing task types
  for (const [taskType, pattern] of Object.entries(mem.patterns || {})) {
    const total = pattern.successCount + pattern.failCount;
    if (total < 3) continue;
    const failRate = pattern.failCount / total;
    if (failRate > 0.5) {
      suggestions.push({
        type:       'reduce-failure-rate',
        taskType,
        failRate:   +(failRate * 100).toFixed(1),
        action:     `Review logic for ${taskType} — ${+(failRate * 100).toFixed(1)}% fail rate`,
        priority:   failRate > 0.8 ? 'critical' : 'high',
      });
    }
  }

  // High retry rate
  if (perf.avgRetries > 1.5) {
    suggestions.push({
      type:   'reduce-retries',
      action: `Average ${perf.avgRetries} retries per task — optimize pre-flight checks or timeouts`,
      priority: 'medium',
    });
  }

  // Slow tasks
  if (perf.avgDurationMs > 10000) {
    suggestions.push({
      type:   'optimize-speed',
      action: `Average task duration ${perf.avgDurationMs}ms — add caching or parallelize sub-tasks`,
      priority: 'medium',
    });
  }

  return {
    agentId,
    suggestions,
    overallHealth:  perf.successRate >= 80 ? 'good' : perf.successRate >= 50 ? 'degraded' : 'critical',
    reflectedAt:    new Date().toISOString(),
  };
}

// ── §7  HELPERS ───────────────────────────────────────────────────────────

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function _truncate(s, n) { const str = String(s || ''); return str.length > n ? str.slice(0, n) + '…' : str; }

let _persistTimer = null;
function _persistMemory() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    try {
      const data = {};
      for (const [k, v] of _memories) data[k] = v;
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
    } catch (_) {}
  }, 3000);
}

function _persistQueue() {
  try { fs.writeFileSync(TASK_QUEUE_FILE, JSON.stringify(_taskQueue.slice(0, 5000), null, 2)); } catch (_) {}
}

function _loadJson(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  return def;
}

// Load memory on boot
(function _bootLoad() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
      for (const [k, v] of Object.entries(data)) _memories.set(k, v);
    }
  } catch (_) {}
})();

// ── §8  REST ROUTER ───────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/performance',          (_req, res) => res.json({ ok: true, agents: getAllPerformances() }));
  r.get('/performance/:agentId', (req, res) => {
    const p = getAgentPerformance(req.params.agentId);
    if (!p) return res.status(404).json({ ok: false, error: 'Agent not found' });
    res.json({ ok: true, performance: p });
  });

  r.get('/reflect/:agentId', (req, res) => {
    res.json({ ok: true, ...reflectAndImprove(req.params.agentId) });
  });

  r.get('/memory/:agentId', (req, res) => {
    const mem = _memories.get(req.params.agentId);
    if (!mem) return res.status(404).json({ ok: false, error: 'No memory for agent' });
    res.json({ ok: true, memory: { ...mem, successes: mem.successes.slice(-20), failures: mem.failures.slice(-20) } });
  });

  r.get('/queue', (req, res) => {
    const status = req.query.status || null;
    let q = _taskQueue;
    if (status) q = q.filter(t => t.status === status);
    res.json({ ok: true, queue: q.slice(0, 100), total: q.length });
  });

  r.post('/queue', express.json(), (req, res) => {
    const task = enqueue(req.body || {});
    res.json({ ok: true, task });
  });

  r.post('/confidence', express.json(), (req, res) => {
    const { agentId, taskType, contextSimilarity, resourceAvailability } = req.body || {};
    res.json({ ok: true, ...computeConfidence(agentId, taskType, { contextSimilarity, resourceAvailability }) });
  });

  r.post('/memorize', express.json(), (req, res) => {
    const { agentId, ...rest } = req.body || {};
    memorize(agentId, rest);
    res.json({ ok: true });
  });

  return r;
}

function getStatus() {
  const all = getAllPerformances();
  const avgSuccess = all.length > 0 ? all.reduce((s, a) => s + a.successRate, 0) / all.length : 0;
  // Cold start (no tracked agents / no performance data yet) is a healthy idle
  // state — NOT 'critical'. Only report degraded/critical once there is real
  // performance data to judge against.
  const health = all.length === 0
    ? 'idle'
    : (avgSuccess >= 70 ? 'good' : avgSuccess >= 40 ? 'degraded' : 'critical');
  return {
    name:           'autonomous-intelligence-core',
    label:          'Autonomous Intelligence Core (TPEORIM)',
    health,
    trackedAgents:  _memories.size,
    queueSize:      _taskQueue.filter(t => t.status === 'queued').length,
    avgSuccessRate: +avgSuccess.toFixed(1),
  };
}

module.exports = {
  memorize,
  recallContext,
  computeConfidence,
  withAdaptiveRetry,
  enqueue,
  dequeue,
  completeTask,
  getAgentPerformance,
  getAllPerformances,
  reflectAndImprove,
  getStatus,
  router,
  bus,
};
