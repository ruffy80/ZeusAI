'use strict';

/**
 * swiss-watch-harden.test.js — live harden assertions
 * event_loop_lag / health timeout / IAK mesh false-red / stuck checkout remediation
 */

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.QIS_PM2_CHECK_DISABLED = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

check('QIS freshen skips when QIS_PM2_CHECK_DISABLED=1', () => {
  const prev = process.env.QIS_PM2_CHECK_DISABLED;
  process.env.QIS_PM2_CHECK_DISABLED = '1';
  delete process.env.OPS_PM2_CHECK_DISABLED;
  // Fresh require after env set — shield is a singleton; call method directly.
  const { QuantumIntegrityShield } = require('../backend/modules/quantumIntegrityShield');
  const q = new QuantumIntegrityShield();
  const poisoned = {
    status: 'compromised',
    issues: [{ type: 'pm2_process_missing', severity: 'critical', detail: 'unicorn-backend' }],
    pm2: { ok: false, missing: ['unicorn-backend'] },
  };
  q.lastScan = poisoned;
  const out = q._freshenPm2OnlyLastScan();
  assert.strictEqual(out, poisoned, 'must return lastScan unchanged (no pm2 exec)');
  assert.strictEqual(out.status, 'compromised');
  const st = q.getStatus();
  assert.strictEqual(st.lastScan, poisoned, 'getStatus must not freshen when disabled');
  process.env.QIS_PM2_CHECK_DISABLED = prev;
});

check('QIS freshen also skips when OPS_PM2_CHECK_DISABLED=1', () => {
  const prevQ = process.env.QIS_PM2_CHECK_DISABLED;
  const prevO = process.env.OPS_PM2_CHECK_DISABLED;
  delete process.env.QIS_PM2_CHECK_DISABLED;
  process.env.OPS_PM2_CHECK_DISABLED = '1';
  const { QuantumIntegrityShield } = require('../backend/modules/quantumIntegrityShield');
  const q = new QuantumIntegrityShield();
  const poisoned = {
    status: 'degraded',
    issues: [{ type: 'pm2_process_missing', severity: 'warn' }],
  };
  q.lastScan = poisoned;
  assert.strictEqual(q._freshenPm2OnlyLastScan(), poisoned);
  process.env.QIS_PM2_CHECK_DISABLED = prevQ;
  process.env.OPS_PM2_CHECK_DISABLED = prevO;
});

check('IAK _isHealthy treats neverKill+event_loop_lag critical as healthy', () => {
  const iak = require('../backend/modules/integrated-autonomy-kernel');
  assert.ok(typeof iak._isHealthy === 'function', '_isHealthy should be on kernel instance');
  const okLag = iak._isHealthy({
    neverKill: true,
    health: 'critical',
    reasons: ['event_loop_lag'],
    protocol: 'NDK/1.0',
  });
  assert.strictEqual(okLag, true);
  const okHealer = iak._isHealthy({
    neverKill: true,
    health: 'critical',
    healerFail: true,
    reasons: [],
  });
  assert.strictEqual(okHealer, true);
  const stillBad = iak._isHealthy({
    health: 'critical',
    reasons: ['disk_full'],
  });
  assert.strictEqual(stillBad, false);
});

check('IAK getStatus exposes unhealthy + unhealthyCount', () => {
  const iak = require('../backend/modules/integrated-autonomy-kernel');
  const st = iak.getStatus();
  assert.ok(typeof st.unhealthyCount === 'number');
  assert.ok(Array.isArray(st.unhealthy));
});

check('live-pricing-broker skips marketplace walk under NODE_ENV=test', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../backend/modules/live-pricing-broker.js'),
    'utf8'
  );
  assert.ok(/LIVE_PRICING_LOAD_MARKETPLACE/.test(src), 'must gate marketplace load');
  assert.ok(/LIVE_PRICING_AUTOSTART/.test(src), 'must gate test autostart');
  assert.ok(/Promise\.race/.test(src), 'BTC rate await must be bounded');
});

check('unicornBrain has unref / stable slower interval', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../backend/modules/unicornBrain.js'),
    'utf8'
  );
  assert.ok(/\.unref\s*\(/.test(src), 'brain timer must .unref()');
  assert.ok(/30000/.test(src), 'stable profile must use 30000ms interval');
  assert.ok(/UNICORN_RUNTIME_PROFILE|DISABLE_SELF_MUTATION/.test(src));
  assert.ok(
    /NODE_ENV\s*!==\s*['"]test['"]/.test(src),
    'stable slowdown must skip NODE_ENV=test so tick tests still pass'
  );
  assert.ok(/function\s+forceTick\s*\(/.test(src), 'forceTick must exist for sync tests');
});

check('node-compatibility workflow has supersede gate', () => {
  const wf = fs.readFileSync(
    path.join(__dirname, '../../.github/workflows/node-compatibility.yml'),
    'utf8'
  );
  assert.ok(/supersede-gate/.test(wf), 'must define supersede-gate job');
  assert.ok(/run_attempt/.test(wf), 'must inspect github.run_attempt');
  assert.ok(/run_compat/.test(wf), 'must gate compat jobs on run_compat');
});

check('selfConstruction getStatus prefers lastReport when fresh', () => {
  const sc = require('../backend/modules/selfConstruction');
  const fakeTotals = {
    modules: 42,
    empty: 0,
    noExports: 0,
    placeholders: 0,
    duplicateOwnership: 0,
  };
  sc.lastReport = {
    generatedAt: new Date().toISOString(),
    totals: fakeTotals,
  };
  let scanned = false;
  const origScan = sc.scan.bind(sc);
  sc.scan = function () {
    scanned = true;
    return origScan();
  };
  const st = sc.getStatus();
  assert.strictEqual(scanned, false, 'must not scan when lastReport is fresh');
  assert.deepStrictEqual(st.totals, fakeTotals);
  sc.scan = origScan;
  // Stale report → scan
  sc.lastReport = {
    generatedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    totals: fakeTotals,
  };
  scanned = false;
  sc.scan = function () {
    scanned = true;
    return {
      total: 1,
      empty: [],
      noExports: [],
      placeholders: [],
      duplicateOwnership: [],
    };
  };
  const st2 = sc.getStatus();
  assert.strictEqual(scanned, true, 'stale lastReport must trigger scan');
  assert.strictEqual(st2.totals.modules, 1);
  sc.scan = origScan;
  sc.lastReport = null;
});

check('ROCS has checkout_recovery_tick remediation', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../backend/modules/reality-ops-continuum.js'),
    'utf8'
  );
  assert.ok(src.includes("autoRemediation: 'checkout_recovery_tick'"));
  assert.ok(src.includes("kind === 'checkout_recovery_tick'"));
  assert.ok(src.includes('checkout-recovery-agent'));
  assert.ok(/customer-portal/.test(src), 'portal soft sense expected');
});

check('site monitor timeout >= 8000', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(/UNICORN_BACKEND_MONITOR_TIMEOUT_MS\s*\|\|\s*8000/.test(src)
    || /timeout:\s*8000/.test(src)
    || /MONITOR_TIMEOUT_MS[^\n]*8000/.test(src));
  assert.ok(/UNICORN_BACKEND_MONITOR_FAILS\s*\|\|\s*5/.test(src)
    || /fails\s*>=\s*5/.test(src)
    || /MONITOR_FAIL_THRESHOLD[^\n]*5/.test(src));
});

check('public health cache exists (3–5s TTL)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
  assert.ok(/_publicHealthCache/.test(src) || /PUBLIC_HEALTH_CACHE/.test(src));
  assert.ok(/_PUBLIC_HEALTH_CACHE_TTL_MS|UNICORN_PUBLIC_HEALTH_CACHE_MS/.test(src));
  assert.ok(/3000/.test(src) && /5000/.test(src));
  // Full path must remain uncached admin
  assert.ok(/\/api\/health\/full/.test(src));
});

check('TAAC emailReady checks Brevo/MailerSend/SMTP triplet', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../backend/modules/total-autonomy-activation-continuum.js'),
    'utf8'
  );
  assert.ok(/BREVO_API_KEY/.test(src));
  assert.ok(/MAILERSEND_API_KEY/.test(src));
  assert.ok(/SMTP_HOST/.test(src) && /SMTP_USER/.test(src));
});

check('ecosystem.config sets QIS_PM2_CHECK_DISABLED default 1', () => {
  const src = fs.readFileSync(path.join(__dirname, '../ecosystem.config.js'), 'utf8');
  assert.ok(/QIS_PM2_CHECK_DISABLED:\s*process\.env\.QIS_PM2_CHECK_DISABLED\s*\|\|\s*'1'/.test(src));
});

console.log(`✅ swiss-watch-harden: ${passed} tests passed`);
process.exit(0);
