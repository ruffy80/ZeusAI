'use strict';

/**
 * module-runtime-load-contract.test.js
 *
 * Verifies every runtime-classified backend module can be required in a clean
 * test process without crashing, with self-mutation disabled.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const coverage = require('../backend/modules/iak/module-coverage');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('runtime catalog contains the expected module surface', () => {
  const runtime = coverage.runtimeCandidates();
  assert.ok(runtime.length >= 300, 'expected >=300 runtime candidates, got ' + runtime.length);
  assert.ok(runtime.every((row) => row && row.file && row.kind === 'runtime'));
});

check('every runtime candidate can be required in isolation', () => {
  const runtime = coverage.runtimeCandidates();
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DISABLE_SELF_MUTATION: '1',
    UNICORN_RUNTIME_PROFILE: 'stable',
  };
  const failures = [];
  for (const row of runtime) {
    const abs = path.resolve(process.cwd(), 'backend/modules', row.file);
    const code = [
      "process.env.NODE_ENV='test';",
      "process.env.DISABLE_SELF_MUTATION='1';",
      "process.env.UNICORN_RUNTIME_PROFILE='stable';",
      `require(${JSON.stringify(abs)});`,
      'process.exit(0);',
    ].join('');
    const run = spawnSync(process.execPath, ['-e', code], {
      encoding: 'utf8',
      env,
      timeout: 8000,
    });
    if (run.status !== 0) {
      failures.push({
        file: row.file,
        status: run.status,
        signal: run.signal,
        stderr: String(run.stderr || '').split('\n').slice(0, 3).join(' | '),
      });
      if (failures.length >= 20) break;
    }
  }
  assert.strictEqual(
    failures.length,
    0,
    'runtime load failures: ' + JSON.stringify(failures, null, 2)
  );
});

console.log(`\n✅ module-runtime-load-contract: ${passed} tests passed`);
process.exit(0);
