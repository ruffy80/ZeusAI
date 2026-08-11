'use strict';

/**
 * Phoenix Continuity OS — Heartbeat Lease (PCOS/1.0)
 * -------------------------------------------------
 * Cross-process immortality signal. The heavy Node event loop (backend/site)
 * writes a monotonic tick every ~500ms into a shared file under /dev/shm
 * (fallback: data/phoenix/). The phoenix-edge process reads the tick age and
 * ALWAYS answers HTTP — even when the main loop is frozen — so operators and
 * healers can tell "process alive but frozen" from "process dead".
 *
 * Innovation: healers no longer confuse rate-limits / cold-boot / freeze.
 * The edge is the witness; the brain is the worker.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROTOCOL = 'PCOS/1.0';
const DEFAULT_INTERVAL_MS = Math.max(200, Number(process.env.PHOENIX_HB_INTERVAL_MS || 500));
const DEFAULT_FROZEN_MS = Math.max(1500, Number(process.env.PHOENIX_FROZEN_MS || 4000));

function resolveHbPath(role) {
  const name = `zeus-phoenix-${String(role || 'backend')}.hb`;
  const shm = path.join('/dev/shm', name);
  try {
    fs.accessSync('/dev/shm', fs.constants.W_OK);
    return shm;
  } catch (_) {
    const dir = process.env.PHOENIX_HB_DIR
      || path.join(process.cwd(), 'data', 'phoenix');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) { /* best-effort */ }
    return path.join(dir, name);
  }
}

function writeBeat(filePath, payload) {
  const body = JSON.stringify(Object.assign({
    protocol: PROTOCOL,
    ts: Date.now(),
    pid: process.pid,
  }, payload || {}));
  const tmp = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, filePath);
  } catch (_) {
    try { fs.writeFileSync(filePath, body); } catch (_e) { /* best-effort */ }
  }
}

function readBeat(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const j = JSON.parse(raw);
    const ts = Number(j && j.ts) || 0;
    const ageMs = ts > 0 ? Math.max(0, Date.now() - ts) : Number.POSITIVE_INFINITY;
    return {
      ok: true,
      protocol: (j && j.protocol) || PROTOCOL,
      ts,
      ageMs,
      pid: j && j.pid,
      role: j && j.role,
      uptime: j && j.uptime,
      frozen: ageMs > DEFAULT_FROZEN_MS,
      frozenMs: DEFAULT_FROZEN_MS,
    };
  } catch (_) {
    return {
      ok: false,
      protocol: PROTOCOL,
      ts: 0,
      ageMs: Number.POSITIVE_INFINITY,
      frozen: true,
      frozenMs: DEFAULT_FROZEN_MS,
      missing: true,
    };
  }
}

/**
 * Start writing heartbeats from the current process. Returns a stop() fn.
 * Interval is unref'd so it never keeps the process alive alone.
 */
function startWriter(opts) {
  const role = (opts && opts.role) || process.env.PHOENIX_ROLE || 'backend';
  const filePath = (opts && opts.path) || resolveHbPath(role);
  const intervalMs = Number((opts && opts.intervalMs) || DEFAULT_INTERVAL_MS);
  let stopped = false;

  const beat = () => {
    if (stopped) return;
    writeBeat(filePath, {
      role,
      uptime: Math.floor(process.uptime()),
      rss: (process.memoryUsage() || {}).rss || 0,
    });
  };
  beat();
  const timer = setInterval(beat, intervalMs);
  if (timer.unref) timer.unref();

  return {
    path: filePath,
    role,
    stop() {
      stopped = true;
      try { clearInterval(timer); } catch (_) { /* ignore */ }
    },
  };
}

module.exports = {
  PROTOCOL,
  DEFAULT_INTERVAL_MS,
  DEFAULT_FROZEN_MS,
  resolveHbPath,
  writeBeat,
  readBeat,
  startWriter,
  tmpdir: () => os.tmpdir(),
};
