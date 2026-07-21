'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.NDK_SAMPLE_MS = '60000';
process.env.NDK_ACTION_COOLDOWN_MS = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ndk = require('../backend/modules/never-down-kernel');
const { createSiteProxyCircuitBreaker } = require('../src/site-proxy-circuit-breaker');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

async function main() {
  check('NDK status neverKill=true', () => {
    const s = ndk.getStatus();
    assert.strictEqual(s.protocol, 'NDK/1.0');
    assert.strictEqual(s.neverKill, true);
    assert.ok(s.lagFailMs >= s.lagWarnMs);
  });

  check('healthEnvelope exposes healerFail', () => {
    const e = ndk.healthEnvelope();
    assert.strictEqual(typeof e.healerFail, 'boolean');
    assert.strictEqual(e.neverKill, true);
  });

  let called = 0;
  ndk.registerCleaner('test-cleaner', () => { called += 1; return { freed: 1 }; });
  const cleaned = await ndk.runCleaners('unit-test');
  check('registerCleaner + runCleaners cooperative', () => {
    assert.ok(cleaned.ok);
    assert.ok(called >= 1);
  });

  const sampled = await ndk.sampleOnce();
  check('sampleOnce updates lagMs', () => {
    assert.ok(typeof sampled.lagMs === 'number');
    assert.ok(sampled.samples >= 1);
  });

  check('site proxy CB opens after threshold failures', () => {
    const cb = createSiteProxyCircuitBreaker({ threshold: 3, cooldownMs: 1000 });
    assert.strictEqual(cb.shouldAllow(), true);
    cb.recordFailure();
    cb.recordFailure();
    assert.strictEqual(cb.snapshot().state, 'CLOSED');
    cb.recordFailure();
    assert.strictEqual(cb.snapshot().state, 'OPEN');
    assert.strictEqual(cb.shouldAllow(), false);
    cb._state.lastFailTs = Date.now() - 2000;
    assert.strictEqual(cb.shouldAllow(), true);
    assert.strictEqual(cb.snapshot().state, 'HALF_OPEN');
    cb.recordSuccess();
    assert.strictEqual(cb.snapshot().state, 'CLOSED');
  });

  check('autoheal-min probes /api/health not bare /health', () => {
    const sh = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'autoheal-min.sh'), 'utf8');
    assert.ok(sh.includes('http://127.0.0.1:3000/api/health'));
    assert.ok(!/BACKEND_HEALTH_URL:-\$\{BACKEND_HEALTH_URL:-http:\/\/127\.0\.0\.1:3000\/health\}/.test(sh));
    assert.ok(!sh.includes(':-http://127.0.0.1:3000/health}'));
    assert.ok(sh.includes('healerFail'));
    assert.ok(sh.includes('AUTOHEAL_MIN_COOLDOWN_S:-600'));
  });

  check('health-watch honors healerFail', () => {
    const sh = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'unicorn-health-watch.sh'), 'utf8');
    assert.ok(sh.includes('healerFail'));
    assert.ok(sh.includes('/api/health'));
  });

  check('never-down-watch script exists and is safe', () => {
    const sh = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'never-down-watch.sh'), 'utf8');
    assert.ok(sh.includes('zeus-never-down-watch.disabled'));
    assert.ok(sh.includes('healerFail'));
    assert.ok(sh.includes('pm2 reload') || sh.includes('pm2 restart'));
  });

  console.log('\n✅ never-down-resilience: ' + passed + ' tests passed');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
