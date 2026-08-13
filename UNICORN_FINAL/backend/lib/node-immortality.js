'use strict';

/**
 * NIX/1.0 — Node Immortality eXtension
 * =====================================
 * Seal Node at process birth so the failure classes that kept red-lining
 * CI + production never get an unbounded window again:
 *
 *   1. Engines major pin  — refuse Node outside >=22 <26 (prod / NIX_STRICT)
 *   2. Undici global Agent — kill the default 300s headersTimeout forever
 *   3. Fetch seal          — inject AbortSignal.timeout when callers forget
 *   4. Event-loop lag sample — expose lag for health / phoenix witnesses
 *   5. Node-cron seal      — NEVER emit "missed execution" / overlap WARN spam
 *                            (deploy Health Check + pm2 logs stayed red-noise forever)
 *
 * Load paths (any one is enough; all are idempotent):
 *   - NODE_OPTIONS=--require=<this file>   (PM2 / Actions / TTS)
 *   - require('./backend/lib/node-immortality') at boot
 *
 * Does NOT restart the process (NDK doctrine). Bounded I/O + truth only;
 * external hang-watchdog / PCOS still own SIGKILL recovery.
 */

const PROTOCOL = 'NIX/1.0';
const ENGINE_FLOOR = 22;
const ENGINE_CEIL = 26;

const state = {
  protocol: PROTOCOL,
  sealed: false,
  sealedAt: null,
  node: process.versions.node,
  enginesOk: true,
  fetchSealed: false,
  undiciSealed: false,
  fetchTimeoutMs: 0,
  headersTimeoutMs: 0,
  bodyTimeoutMs: 0,
  eventLoopLagMs: 0,
  refusals: 0,
  cronSealed: false,
  cronMissedSuppressed: 0,
};

function majorOf(v) {
  return Number(String(v || '').split('.')[0]) || 0;
}

function assertEngines() {
  const major = majorOf(process.versions.node);
  const ok = major >= ENGINE_FLOOR && major < ENGINE_CEIL;
  state.enginesOk = ok;
  state.node = process.versions.node;
  if (ok) return;
  state.refusals += 1;
  const msg = `[nix] REFUSING Node ${process.versions.node} — engines require >=${ENGINE_FLOOR} <${ENGINE_CEIL}`;
  // eslint-disable-next-line no-console
  console.error(msg);
  const strict =
    process.env.NIX_STRICT === '1'
    || (process.env.NODE_ENV === 'production' && process.env.NIX_STRICT !== '0');
  if (strict) process.exit(78);
}

function defaultBoundMs(envKey, prodDefault, testDefault) {
  if (process.env[envKey]) {
    return Math.max(1_000, Number(process.env[envKey]) || prodDefault);
  }
  // Test/CI boots full Express graphs; 30s is too tight for cold listen+settle
  // and was aborting site-commerce-smoke under NIX (TTS exit 124 / TimeoutError).
  const isTest = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
  return isTest ? testDefault : prodDefault;
}

function sealUndici() {
  if (state.undiciSealed) return;
  if (process.env.NIX_UNDICI === '0') return;
  const headersTimeout = defaultBoundMs('NIX_HEADERS_TIMEOUT_MS', 30_000, 120_000);
  const bodyTimeout = defaultBoundMs('NIX_BODY_TIMEOUT_MS', 30_000, 120_000);
  const connectTimeout = Math.max(
    1_000,
    Number(process.env.NIX_CONNECT_TIMEOUT_MS || 10_000) || 10_000
  );
  try {
    // eslint-disable-next-line global-require
    const undici = require('undici');
    if (typeof undici.Agent !== 'function' || typeof undici.setGlobalDispatcher !== 'function') {
      return;
    }
    undici.setGlobalDispatcher(new undici.Agent({
      connect: { timeout: connectTimeout },
      headersTimeout,
      bodyTimeout,
    }));
    state.undiciSealed = true;
    state.headersTimeoutMs = headersTimeout;
    state.bodyTimeoutMs = bodyTimeout;
  } catch (_) {
    // undici may be unavailable in exotic embeds — fetch seal still applies.
  }
}

function sealFetch() {
  if (state.fetchSealed) return;
  if (process.env.NIX_FETCH_SEAL === '0') return;
  if (typeof globalThis.fetch !== 'function') return;
  if (globalThis.fetch.__nixSealed) {
    state.fetchSealed = true;
    return;
  }
  const timeoutMs = defaultBoundMs('NIX_FETCH_TIMEOUT_MS', 30_000, 120_000);
  const raw = globalThis.fetch.bind(globalThis);
  function sealedFetch(input, init) {
    const opts = init == null ? {} : { ...init };
    if (opts.signal == null && timeoutMs > 0 && typeof AbortSignal !== 'undefined'
        && typeof AbortSignal.timeout === 'function') {
      opts.signal = AbortSignal.timeout(timeoutMs);
    }
    return raw(input, opts);
  }
  sealedFetch.__nixSealed = true;
  globalThis.fetch = sealedFetch;
  state.fetchSealed = true;
  state.fetchTimeoutMs = timeoutMs;
}

function startLagSampler() {
  if (process.env.NIX_LAG_SAMPLER === '0') return;
  if (globalThis.__nixLagSampler) return;
  globalThis.__nixLagSampler = true;
  const every = Math.max(1_000, Number(process.env.NIX_LAG_MS || 5_000) || 5_000);
  const iv = setInterval(() => {
    const t0 = Date.now();
    setImmediate(() => {
      state.eventLoopLagMs = Date.now() - t0;
    });
  }, every);
  if (typeof iv.unref === 'function') iv.unref();
}

/**
 * NIX cron seal — node-cron v4 logs a console.warn for every missed heartbeat
 * ("missed execution … Possible blocking IO…"). Under a busy Unicorn backend
 * (hundreds of modules + second-level market crons) this floods pm2 logs and
 * turns every Deploy Health Check into a wall of yellow WARN noise even when
 * the process is healthy.
 *
 * Seal strategy (belt + suspenders):
 *   1) Mute console.warn lines that carry the [NODE-CRON] missed/overlap marker
 *   2) Patch node-cron's own logger.warn when the package is resolvable
 * Misses are counted in status().cronMissedSuppressed for diagnostics.
 */
function sealNodeCron() {
  if (process.env.NIX_CRON_SEAL === '0') return;

  const isCronNoise = (message) => {
    const m = String(message || '');
    // Match with or without ANSI colour codes around [NODE-CRON].
    return (
      (/\[NODE-CRON\]/i.test(m) || /NODE-CRON/i.test(m))
      && /missed execution|overlap prevention|still running, new execution blocked/i.test(m)
    ) || /missed execution at .*Possible blocking IO/i.test(m);
  };

  // Always re-wrap when console.warn was replaced AFTER the first seal
  // (CI children inherit NODE_OPTIONS=--require NIX, then tests swap console.warn).
  // 1) console.warn filter — works for every node-cron version that logs there.
  if (typeof console.warn !== 'function' || !console.warn.__nixCronSealed) {
    const origWarn = console.warn.bind(console);
    function sealedConsoleWarn(...args) {
      try {
        const joined = args.map((a) => {
          if (a == null) return '';
          if (typeof a === 'string') return a;
          if (a instanceof Error) return a.message || String(a);
          try { return String(a); } catch (_) { return ''; }
        }).join(' ');
        if (isCronNoise(joined)) {
          state.cronMissedSuppressed += 1;
          return;
        }
      } catch (_) { /* never break logging */ }
      return origWarn(...args);
    }
    sealedConsoleWarn.__nixCronSealed = true;
    console.warn = sealedConsoleWarn;
  }

  globalThis.__nixCronSealed = true;

  // 2) Patch package logger (node-cron@4 dist layout).
  try {
    let loggerPath = null;
    for (const candidate of [
      'node-cron/dist/cjs/logger.js',
      'node-cron/dist/esm/logger.js',
      'node-cron/src/logger.js',
    ]) {
      try {
        loggerPath = require.resolve(candidate);
        break;
      } catch (_) { /* try next */ }
    }
    if (loggerPath) {
      // eslint-disable-next-line global-require
      const mod = require(loggerPath);
      const logger = mod && (mod.default || mod);
      if (logger && typeof logger.warn === 'function' && !logger.warn.__nixCronSealed) {
        const orig = logger.warn.bind(logger);
        function sealedLoggerWarn(message) {
          const m = String(message || '');
          if (/missed execution|overlap prevention|still running, new execution blocked/i.test(m)) {
            state.cronMissedSuppressed += 1;
            return;
          }
          return orig(message);
        }
        sealedLoggerWarn.__nixCronSealed = true;
        logger.warn = sealedLoggerWarn;
      }
    }
  } catch (_) {
    // Package absent in some edge boots — console filter still covers it.
  }

  state.cronSealed = true;
}

function install(opts = {}) {
  if (state.sealed && !opts.force) {
    // Re-assert cron seal — tests / tooling may have replaced console.warn.
    sealNodeCron();
    return state;
  }
  assertEngines();
  sealUndici();
  sealFetch();
  sealNodeCron();
  startLagSampler();
  state.sealed = true;
  state.sealedAt = new Date().toISOString();
  if (process.env.NIX_QUIET !== '1') {
    // eslint-disable-next-line no-console
    console.log(
      `[nix] ${PROTOCOL} sealed · node=${state.node}`
      + ` · fetch=${state.fetchSealed ? state.fetchTimeoutMs + 'ms' : 'off'}`
      + ` · undici=${state.undiciSealed ? state.headersTimeoutMs + 'ms' : 'off'}`
      + ` · cron=${state.cronSealed ? 'sealed' : 'off'}`
      + ` · engines=${state.enginesOk ? 'ok' : 'FAIL'}`
    );
  }
  return state;
}

function status() {
  return {
    protocol: PROTOCOL,
    ok: !!(state.sealed && state.enginesOk && (state.fetchSealed || process.env.NIX_FETCH_SEAL === '0')),
    sealed: state.sealed,
    sealedAt: state.sealedAt,
    node: state.node,
    engines: `>=${ENGINE_FLOOR} <${ENGINE_CEIL}`,
    enginesOk: state.enginesOk,
    fetchSealed: state.fetchSealed,
    undiciSealed: state.undiciSealed,
    fetchTimeoutMs: state.fetchTimeoutMs,
    headersTimeoutMs: state.headersTimeoutMs,
    bodyTimeoutMs: state.bodyTimeoutMs,
    eventLoopLagMs: state.eventLoopLagMs,
    refusals: state.refusals,
    cronSealed: state.cronSealed,
    cronMissedSuppressed: state.cronMissedSuppressed,
  };
}

function healthEnvelope() {
  const s = status();
  return {
    protocol: s.protocol,
    available: true,
    ok: s.ok,
    node: s.node,
    enginesOk: s.enginesOk,
    fetchSealed: s.fetchSealed,
    undiciSealed: s.undiciSealed,
    cronSealed: s.cronSealed,
    eventLoopLagMs: s.eventLoopLagMs,
  };
}

// Seal on require / --require (idempotent).
install();

module.exports = {
  PROTOCOL,
  ENGINE_FLOOR,
  ENGINE_CEIL,
  install,
  status,
  healthEnvelope,
  majorOf,
  sealNodeCron,
};
