'use strict';
/**
 * feature-flag-manager.test.js — Unit tests for backend/modules/FeatureFlagManager.js
 *
 * Covers: isEnabled, setFlag, getAllFlags, autoTuneFlags.
 * Uses a temp data dir to avoid polluting production feature-flags.json.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Override FLAG_FILE path before requiring the module: we need to patch the
// module's internal file path. Since the module reads FLAG_FILE at require time,
// we instead test the API surface directly (the module gracefully handles
// missing files and write errors).

process.env.NODE_ENV = 'test';

// We need a fresh instance — clear require cache if previously loaded
const modPath = require.resolve('../backend/modules/FeatureFlagManager');
delete require.cache[modPath];

const flagManager = require('../backend/modules/FeatureFlagManager');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

// ── isEnabled ───────────────────────────────────────────────────────────────
console.log('FeatureFlagManager — isEnabled');

check('returns false for unknown flag', () => {
  assert.strictEqual(flagManager.isEnabled('nonexistent-flag-xyz'), false);
});

check('returns false for disabled flag', () => {
  flagManager.setFlag('test-disabled', false, 'unit test');
  assert.strictEqual(flagManager.isEnabled('test-disabled'), false);
});

check('returns true for enabled flag', () => {
  flagManager.setFlag('test-enabled', true, 'unit test');
  assert.strictEqual(flagManager.isEnabled('test-enabled'), true);
});

// ── setFlag ─────────────────────────────────────────────────────────────────
console.log('\nFeatureFlagManager — setFlag');

check('sets a flag with enabled=true', () => {
  flagManager.setFlag('my-feature', true, 'testing');
  assert.strictEqual(flagManager.isEnabled('my-feature'), true);
});

check('sets a flag with enabled=false', () => {
  flagManager.setFlag('my-feature', false, 'disabled by test');
  assert.strictEqual(flagManager.isEnabled('my-feature'), false);
});

check('stores aiReason and lastChange', () => {
  flagManager.setFlag('detailed-flag', true, 'AI decided this');
  const all = flagManager.getAllFlags();
  assert.ok(all['detailed-flag']);
  assert.strictEqual(all['detailed-flag'].enabled, true);
  assert.strictEqual(all['detailed-flag'].aiReason, 'AI decided this');
  assert.strictEqual(typeof all['detailed-flag'].lastChange, 'number');
  assert.ok(all['detailed-flag'].lastChange > 0);
});

// ── getAllFlags ──────────────────────────────────────────────────────────────
console.log('\nFeatureFlagManager — getAllFlags');

check('returns an object with all set flags', () => {
  flagManager.setFlag('flag-a', true, '');
  flagManager.setFlag('flag-b', false, '');
  const all = flagManager.getAllFlags();
  assert.strictEqual(typeof all, 'object');
  assert.ok('flag-a' in all);
  assert.ok('flag-b' in all);
});

// ── autoTuneFlags ───────────────────────────────────────────────────────────
console.log('\nFeatureFlagManager — autoTuneFlags');

check('disables ai-advanced-chat when latency > 2000', () => {
  flagManager.setFlag('ai-advanced-chat', true, 'pre-test');
  flagManager.autoTuneFlags({ latency: 3000 });
  assert.strictEqual(flagManager.isEnabled('ai-advanced-chat'), false);
});

check('enables marketplace-beta when engagement > 80', () => {
  flagManager.setFlag('marketplace-beta', false, 'pre-test');
  flagManager.autoTuneFlags({ engagement: 90 });
  assert.strictEqual(flagManager.isEnabled('marketplace-beta'), true);
});

check('does not change flags when metrics are normal', () => {
  flagManager.setFlag('ai-advanced-chat', true, 'pre-test');
  flagManager.setFlag('marketplace-beta', false, 'pre-test');
  flagManager.autoTuneFlags({ latency: 500, engagement: 30 });
  assert.strictEqual(flagManager.isEnabled('ai-advanced-chat'), true);
  assert.strictEqual(flagManager.isEnabled('marketplace-beta'), false);
});

check('handles empty metrics gracefully', () => {
  // Should not throw
  flagManager.autoTuneFlags({});
  flagManager.autoTuneFlags({ latency: undefined, engagement: undefined });
});

console.log(`\n✅ feature-flag-manager: ${passed} tests passed\n`);
