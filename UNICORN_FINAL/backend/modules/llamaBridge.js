// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:57:33.655Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:53:50.308Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:49:07.882Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:43:56.572Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:34:58.216Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * 🦙 LLAMA BRIDGE — Ollama Priority Queue
 * Routes requests from Unicorn engines to a local Ollama instance.
 *
 * Priority levels (lower number = higher priority):
 *   P2 — Revenue / Viral engines  (business-critical background work)
 *   P3 — Innovation engine        (important, but not urgent)
 *   P4 — Generic / user-chat      (best-effort)
 *
 * Design constraints:
 *   - Max 1 concurrent Ollama request to avoid CPU saturation
 *   - Each request has a configurable timeout (default 60 s)
 *   - Always resolves — never throws; returns null on failure so callers
 *     can gracefully fall back to their built-in heuristics
 *   - Ollama availability is probed once on startup and cached for
 *     PROBE_INTERVAL_MS; no flood of pings when Ollama is down
 */

'use strict';

const OLLAMA_BASE    = process.env.OLLAMA_URL      || 'http://127.0.0.1:11434';
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL    || 'llama3.1:8b-instruct-q4_K_M';
const REQ_TIMEOUT_MS = parseInt(process.env.LLAMA_TIMEOUT_MS  || '60000', 10);
const PROBE_INTERVAL = parseInt(process.env.LLAMA_PROBE_MS    || '120000', 10); // 2 min
const MAX_QUEUE      = parseInt(process.env.LLAMA_MAX_QUEUE   || '20', 10);

// ─── State ───────────────────────────────────────────────────────────────────
let ollamaAvailable  = false;
let lastProbeTime    = 0;
let busy             = false;
const queue          = []; // { priority, prompt, context, resolve, reject, addedAt }

const stats = {
  requested: 0,
  completed: 0,
  dropped:   0,
  errors:    0,
  probeOk:   0,
  probeFail: 0,
};

// ─── Probe Ollama ─────────────────────────────────────────────────────────────
async function probeOllama() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    ollamaAvailable = res.ok;
    if (res.ok) stats.probeOk++; else stats.probeFail++;
  } catch {
    ollamaAvailable = false;
    stats.probeFail++;
  }
  lastProbeTime = Date.now();
  return ollamaAvailable;
}

async function ensureAvailable() {
  if (Date.now() - lastProbeTime > PROBE_INTERVAL) {
    await probeOllama();
  }
  return ollamaAvailable;
}

// ─── Core generate call ───────────────────────────────────────────────────────
async function callOllama(prompt, context) {
  const body = {
    model:  OLLAMA_MODEL,
    prompt: context ? `${context}\n\n${prompt}` : prompt,
    stream: false,
    options: {
      num_ctx:     parseInt(process.env.LLAMA_CTX || '2048', 10),
      temperature: parseFloat(process.env.LLAMA_TEMP || '0.7'),
    },
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    clearTimeout(t);

    if (!res.ok) {
      stats.errors++;
      return null;
    }

    const data = await res.json();
    stats.completed++;
    return (data.response || '').trim() || null;
  } catch (err) {
    clearTimeout(t);
    stats.errors++;
    // If Ollama disappeared, mark unavailable so next probe re-checks
    if (err.name === 'AbortError' || err.code === 'ECONNREFUSED') {
      ollamaAvailable = false;
      lastProbeTime = 0;
    }
    return null;
  }
}

// ─── Queue processor ─────────────────────────────────────────────────────────
async function processNext() {
  if (busy || queue.length === 0) return;

  // Sort by priority (ascending), then by age (ascending = FIFO within same priority)
  queue.sort((a, b) => a.priority !== b.priority
    ? a.priority - b.priority
    : a.addedAt - b.addedAt
  );

  const task = queue.shift();
  busy = true;

  try {
    const result = await callOllama(task.prompt, task.context);
    task.resolve(result);
  } catch (err) {
    stats.errors++;
    task.resolve(null); // never reject — callers use null as "no AI result"
  } finally {
    busy = false;
    // Yield to event loop before processing next item
    setImmediate(processNext);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Request a Llama generation.
 *
 * @param {string} prompt    The instruction / question
 * @param {number} priority  P2=2 (highest), P3=3, P4=4 (lowest)
 * @param {string} [context] Optional system-level context prepended to prompt
 * @returns {Promise<string|null>}  Generated text, or null if unavailable/error
 */
async function generate(prompt, priority = 4, context = '') {
  stats.requested++;

  const available = await ensureAvailable();
  if (!available) return null;

  if (queue.length >= MAX_QUEUE) {
    // Drop lowest-priority tail items to make room
    const dropped = queue
      .filter(t => t.priority >= priority)
      .sort((a, b) => b.priority - a.priority);
    if (dropped.length > 0) {
      const victim = dropped[0];
      queue.splice(queue.indexOf(victim), 1);
      victim.resolve(null);
      stats.dropped++;
    } else {
      // Queue full with higher-priority items; skip this request
      stats.dropped++;
      return null;
    }
  }

  return new Promise(resolve => {
    queue.push({ priority, prompt, context, resolve, addedAt: Date.now() });
    processNext();
  });
}

/** Returns current bridge status (used by /api/llama/status endpoint) */
function getStatus() {
  return {
    ollamaUrl:       OLLAMA_BASE,
    model:           OLLAMA_MODEL,
    available:       ollamaAvailable,
    lastProbeAt:     lastProbeTime ? new Date(lastProbeTime).toISOString() : null,
    busy,
    queueDepth:      queue.length,
    stats:           { ...stats },
  };
}

// ─── Init: probe on load ──────────────────────────────────────────────────────
probeOllama().then(ok => {
  console.log(`[LlamaBridge] Ollama ${ok ? '✅ available' : '⚠️  not available'} at ${OLLAMA_BASE} (model: ${OLLAMA_MODEL})`);
});

module.exports = { generate, getStatus, probeOllama, PRIORITY: { REVENUE: 2, VIRAL: 2, INNOVATION: 3, CHAT: 4 } };
