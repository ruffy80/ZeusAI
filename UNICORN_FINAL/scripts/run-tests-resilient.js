#!/usr/bin/env node
'use strict';

/**
 * Transient Test Shield (TTS/1.1)
 * --------------------------------
 * Runs the package.json `test` chain file-by-file. On the known CI flake class
 * (uncaught ECONNRESET / fetch failed / socket hang up while a heavy Express
 * app is still settling listen-callbacks), retries that single file once
 * before failing the job.
 *
 * Real assertion failures still fail immediately — incidental log lines that
 * mention ECONNRESET (e.g. background BTC rate fetch) must NOT trigger a
 * retry. Used by Node Compatibility Matrix + Stable Deploy.
 *
 * TTS/1.1: each file has a hard wall-clock budget (default 120s). Without this,
 * undici's 300s headersTimeout × retries in a single test file can burn the
 * whole 20m Node-compat job (observed on Node 24 / api.test.js).
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/** Per-file wall clock (ms). Override with TTS_FILE_TIMEOUT_MS. */
const FILE_TIMEOUT_MS = Math.max(
  30_000,
  Number(process.env.TTS_FILE_TIMEOUT_MS || 120_000) || 120_000
);

/**
 * Only retry when the process failure itself looks like an uncaught network
 * error near the end of output — not when AssertionError fired and some
 * background module also logged "fetch failed" / ECONNRESET.
 */
function isTransientFailure(out, meta = {}) {
  if (meta.timedOut) {
    // Hang / unbounded fetch under load — one retry is safe; a second hang
    // still fails the file within 2× FILE_TIMEOUT_MS.
    return true;
  }
  const tail = String(out || '').slice(-8000);
  // Explicit assertion / contract failures → never retry.
  if (/\bAssertionError\b/.test(tail)) return false;
  if (/\bERR_ASSERTION\b/.test(tail)) return false;
  // Uncaught network aborts that kill the test process.
  // Include BOTH undici-wrapped causes (`[cause]: Error: read ECONNRESET`)
  // and standalone raw-http throws (`Error: read ECONNRESET` at top of a
  // stack) — the latter is the listen-settling flake class in predictive-
  // prefetch / topology / public-surface-guard.
  return (
    /^TypeError: fetch failed/m.test(tail)
    || /^Error:\s*read ECONNRESET/m.test(tail)
    || /\[cause\]:\s*Error:\s*read ECONNRESET/.test(tail)
    || /\bcode:\s*['"]ECONNRESET['"]/.test(tail)
    || /Error:\s*connect ECONNREFUSED/.test(tail)
    || /Error:\s*socket hang up/.test(tail)
    || /\bUND_ERR_SOCKET\b/.test(tail)
    || /Error:\s*.*ETIMEDOUT/.test(tail)
    || /Error:\s*.*\bEPIPE\b/.test(tail)
    || /AbortError|TimeoutError|The operation was aborted/i.test(tail)
  );
}

module.exports = { isTransientFailure, FILE_TIMEOUT_MS };

function main() {
  const ROOT = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const script = String((pkg.scripts && pkg.scripts.test) || '');
  const files = [...script.matchAll(/node\s+(test\/[^\s'"]+\.test\.js)/g)].map((m) => m[1]);

  if (!files.length) {
    console.error('[tts] no test files found in package.json scripts.test');
    process.exit(2);
  }

  function runOne(file) {
    const r = spawnSync(process.execPath, [file], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        DISABLE_SELF_MUTATION: process.env.DISABLE_SELF_MUTATION || '1',
        NODE_ENV: process.env.NODE_ENV || 'test',
        UNICORN_RUNTIME_PROFILE: process.env.UNICORN_RUNTIME_PROFILE || 'stable',
        ZACC_ENABLE_ESCUELA: process.env.ZACC_ENABLE_ESCUELA || '0',
      },
      maxBuffer: 32 * 1024 * 1024,
      timeout: FILE_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    const timedOutStrict = Boolean(r.error && r.error.code === 'ETIMEDOUT');
    if (timedOutStrict) {
      console.warn(`[tts] TIMEOUT ${file} after ${FILE_TIMEOUT_MS}ms`);
    }
    return {
      status: timedOutStrict ? 124 : (r.status == null ? 1 : r.status),
      out: `${r.stdout || ''}\n${r.stderr || ''}\n${timedOutStrict ? 'Error: TTS_FILE_TIMEOUT\n' : ''}`,
      signal: r.signal,
      timedOut: timedOutStrict,
    };
  }

  console.log(`[tts] Transient Test Shield — ${files.length} files (per-file timeout ${FILE_TIMEOUT_MS}ms)`);
  let passed = 0;
  let retried = 0;

  for (const file of files) {
    let result = runOne(file);
    if (result.status === 0) {
      passed += 1;
      continue;
    }
    if (isTransientFailure(result.out, { timedOut: result.timedOut })) {
      console.warn(`[tts] transient failure in ${file} — retrying once`);
      retried += 1;
      result = runOne(file);
      if (result.status === 0) {
        console.log(`[tts] retry OK: ${file}`);
        passed += 1;
        continue;
      }
    }
    console.error(`[tts] FAILED ${file} (exit ${result.status}${result.signal ? ` signal=${result.signal}` : ''}${result.timedOut ? ' timedOut' : ''})`);
    process.exit(result.status || 1);
  }

  console.log(`[tts] all ${passed} tests passed (transient retries=${retried})`);
  process.exit(0);
}

if (require.main === module) {
  main();
}
