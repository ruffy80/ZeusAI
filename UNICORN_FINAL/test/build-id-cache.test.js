'use strict';

// Verifies build-id asset-hash caching: resolveAssetPath / assetPath reuse a
// cached manifest instead of re-reading + re-hashing every asset on each call,
// and refresh() invalidates the cache.

const assert = require('assert');
const fs = require('fs');

const originalReadFileSync = fs.readFileSync;
const buildId = require('../src/site/v2/build-id');

// Counts fs.readFileSync calls performed inside fn, restoring the original
// implementation afterwards so unrelated code is never affected.
function withReadSpy(fn) {
  let reads = 0;
  fs.readFileSync = function countingReadFileSync(...args) {
    reads += 1;
    return originalReadFileSync.apply(this, args);
  };
  try {
    fn();
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
  return reads;
}

function run() {
  // Warm the cache once so we can measure steady-state reads.
  const first = buildId.assetPath('/assets/app.js');
  assert.ok(typeof first === 'string' && first.length > 0, 'assetPath returns a string');

  const manifest1 = buildId.versionedAssetEntries();
  assert.ok(manifest1 && typeof manifest1 === 'object');

  // Consistency: repeated calls return identical results.
  const second = buildId.assetPath('/assets/app.js');
  assert.equal(second, first, 'assetPath is stable across calls');

  // resolveAssetPath round-trips a versioned path back to its logical path.
  const resolved = buildId.resolveAssetPath(first);
  assert.equal(resolved, '/assets/app.js', 'resolveAssetPath maps versioned → logical');
  const resolvedAgain = buildId.resolveAssetPath(first);
  assert.equal(resolvedAgain, resolved, 'resolveAssetPath is stable');

  // Cache effectiveness: after warming, a batch of resolve/assetPath calls
  // should perform ZERO fresh filesystem reads (served from the cached manifest).
  const readsDuringCached = withReadSpy(() => {
    for (let i = 0; i < 25; i++) {
      buildId.resolveAssetPath(first);
      buildId.assetPath('/assets/app.js');
      buildId.assetPath('/assets/aeon.js');
      buildId.versionedAssetEntries();
    }
  });
  assert.equal(readsDuringCached, 0, 'cached calls perform no filesystem reads');

  // refresh() must invalidate the cache, forcing at least one fresh read.
  const readsDuringRefresh = withReadSpy(() => {
    buildId.refresh();
    buildId.assetPath('/assets/app.js');
    buildId.versionedAssetEntries();
  });
  assert.ok(readsDuringRefresh > 0, 'refresh invalidates cache (fresh reads happen)');

  // Values remain consistent after refresh (same asset content → same hash).
  const afterRefresh = buildId.assetPath('/assets/app.js');
  assert.equal(afterRefresh, first, 'hash is stable across refresh for unchanged asset');

  console.log('build-id-cache test passed');
}

try {
  run();
} finally {
  fs.readFileSync = originalReadFileSync;
}
