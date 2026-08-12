'use strict';
/**
 * TTS heuristic contract — standalone raw-http ECONNRESET must retry;
 * AssertionError + incidental ECONNRESET log must not.
 */
const assert = require('assert');
const { isTransientFailure } = require('../scripts/run-tests-resilient');

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`✓ ${name}`);
  passed += 1;
}

check('standalone Error: read ECONNRESET is transient (raw http flake)', () => {
  const out = [
    '[zacc] loaded',
    'Error: read ECONNRESET',
    '    at TCP.onStreamRead (node:internal/stream_base_commons:216:20)',
    '{',
    "  errno: -104,",
    "  code: 'ECONNRESET',",
    "  syscall: 'read'",
    '}',
  ].join('\n');
  assert.strictEqual(isTransientFailure(out), true);
});

check('undici [cause] ECONNRESET is still transient', () => {
  const out = [
    'TypeError: fetch failed',
    '    at async run (test/public-surface-guard.test.js:48:18) {',
    '  [cause]: Error: read ECONNRESET',
    '      at TCP.onStreamRead (node:internal/stream_base_commons:216:20) {',
    "    code: 'ECONNRESET',",
    '  }',
    '}',
  ].join('\n');
  assert.strictEqual(isTransientFailure(out), true);
});

check('AssertionError with incidental ECONNRESET log is NOT transient', () => {
  const out = [
    '[btcPaymentVerifier] fetchJSON network error: socket hang up',
    'AssertionError [ERR_ASSERTION]: /api/services count must match',
    '    at Object.<anonymous> (test/api-aliases.test.js:91:12)',
    'Error: read ECONNRESET',
  ].join('\n');
  assert.strictEqual(isTransientFailure(out), false);
});

check('background log alone without uncaught error is NOT transient', () => {
  const out = '[btcPaymentVerifier] fetchJSON network error: ECONNRESET\n';
  assert.strictEqual(isTransientFailure(out), false);
});

console.log(`\n✅ run-tests-resilient: ${passed} tests passed\n`);
process.exit(0);
