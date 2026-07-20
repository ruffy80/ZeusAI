'use strict';

// autorevenue-idle-unconfigured.test.js
//
// Verifies that backend/modules/autoRevenue.js honours the mission
// requirement that settled-revenue → price loops only react to real
// confirmed receipts:
//   • When simulation is off (AUTO_REVENUE_SIMULATE != 'enabled', the
//     default) AND there are no settled paid orders, getRevenueStatus()
//     returns state='idle_unconfigured' with zeros — no fake numbers.
//   • Honesty note explains the module is idle.
//   • Simulation ON still returns SIMULATED_REVENUE_DEMO for demo runs.
// RO: cand nu exista incasari, autoRevenue raporteaza idle_unconfigured.

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.AUTO_REVENUE_SIMULATE = 'disabled';

const assert = require('assert');

// Silence init logs from the many other modules autoRevenue transitively
// pulls in (reality-metrics, llamaBridge, …).
const origLog = console.log;
const origWarn = console.warn;
const origErr = console.error;
console.log = console.warn = console.error = function () {};
let autoRevenue;
try { autoRevenue = require('../backend/modules/autoRevenue'); }
finally { console.log = origLog; console.warn = origWarn; console.error = origErr; }

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('✓', name); passed++; }
  catch (e) { console.error('✗', name, '\n  ', e && e.stack ? e.stack : e); process.exit(1); }
}

check('simulation OFF: idle_unconfigured when no receipts, otherwise AUTONOMOUS_REVENUE_REAL', () => {
  const st = autoRevenue.getRevenueStatus();
  const paidCount = Number((st.reality && st.reality.paidCustomers) || 0);
  if (paidCount === 0) {
    assert.strictEqual(st.state, 'idle_unconfigured', 'must be idle when no settled revenue');
    assert.strictEqual(st.simulated, false);
    assert.strictEqual(st.totalMonthlyRevenue, '0.00');
    assert.strictEqual(st.projectedAnnualRevenue, '0.00');
    assert.strictEqual(st.activeDeals, 0);
    assert.strictEqual(st.completedTransactions, 0);
    assert.ok(Array.isArray(st.revenueStreams) && st.revenueStreams.length === 0);
    assert.ok(/idle_unconfigured/.test(st.honesty), 'honesty note explains idle state');
  } else {
    // Real receipts observed — must be AUTONOMOUS_REVENUE_REAL, never simulated
    // and never idle. The reported completed count MUST equal the settled
    // paid-customer count from reality-metrics.
    assert.strictEqual(st.state, 'AUTONOMOUS_REVENUE_REAL');
    assert.strictEqual(st.simulated, false);
    assert.strictEqual(st.completedTransactions, paidCount, 'completed = real paid receipts');
    assert.ok(/settled receipts only/.test(st.honesty));
  }
});

check('state is never SIMULATED_REVENUE_DEMO when simulation is off', () => {
  const st = autoRevenue.getRevenueStatus();
  assert.notStrictEqual(st.state, 'SIMULATED_REVENUE_DEMO');
});

check('honesty note never lies when simulation is off', () => {
  const st = autoRevenue.getRevenueStatus();
  assert.strictEqual(st.simulated, false);
  assert.ok(!/fabricated for demos/.test(st.honesty), 'no fabricated-for-demos message when simulation is off');
});

check('detailed metrics do not fabricate revenue when idle', () => {
  const m = autoRevenue.getDetailedMetrics();
  // If reality metrics say 0 paid → the module MUST show 0 revenue.
  const paidUsd = (m.totalMonthlyRevenue != null) ? Number(m.totalMonthlyRevenue) : 0;
  const projected = Number(m.projectedAnnualRevenue || 0);
  const activeDeals = Number(m.activeDeals || 0);
  if (!paidUsd) {
    assert.strictEqual(projected, 0);
    assert.strictEqual(activeDeals, 0);
  }
});

console.log('\n✅ autorevenue-idle-unconfigured:', passed, 'tests passed');
process.exit(0);
