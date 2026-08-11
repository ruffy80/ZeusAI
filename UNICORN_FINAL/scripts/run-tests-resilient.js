#!/usr/bin/env node
'use strict';

/**
 * Transient Test Shield (TTS/1.0)
 * --------------------------------
 * Runs the package.json `test` chain file-by-file. On the known CI flake class
 * (ECONNRESET / fetch failed / socket hang up while a heavy Express app is
 * still settling listen-callbacks), retries that single file once before
 * failing the job.
 *
 * Real assertion failures still fail immediately (no blind double-run of the
 * whole suite). Used by Node Compatibility Matrix + Stable Deploy.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const script = String((pkg.scripts && pkg.scripts.test) || '');
const files = [...script.matchAll(/node\s+(test\/[^\s'"]+\.test\.js)/g)].map((m) => m[1]);

if (!files.length) {
  console.error('[tts] no test files found in package.json scripts.test');
  process.exit(2);
}

const TRANSIENT_RE = /ECONNRESET|fetch failed|ECONNREFUSED|socket hang up|ETIMEDOUT|EPIPE|UND_ERR_SOCKET/i;

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
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return {
    status: r.status == null ? 1 : r.status,
    out: `${r.stdout || ''}\n${r.stderr || ''}`,
    signal: r.signal,
  };
}

console.log(`[tts] Transient Test Shield — ${files.length} files`);
let passed = 0;
let retried = 0;

for (const file of files) {
  let result = runOne(file);
  if (result.status === 0) {
    passed += 1;
    continue;
  }
  if (TRANSIENT_RE.test(result.out)) {
    console.warn(`[tts] transient failure in ${file} — retrying once`);
    retried += 1;
    result = runOne(file);
    if (result.status === 0) {
      console.log(`[tts] retry OK: ${file}`);
      passed += 1;
      continue;
    }
  }
  console.error(`[tts] FAILED ${file} (exit ${result.status}${result.signal ? ` signal=${result.signal}` : ''})`);
  process.exit(result.status || 1);
}

console.log(`[tts] all ${passed} tests passed (transient retries=${retried})`);
process.exit(0);
