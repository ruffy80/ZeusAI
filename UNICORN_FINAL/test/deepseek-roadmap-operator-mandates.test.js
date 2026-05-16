/* =====================================================================
 * deepseek-roadmap-operator-mandates.test.js
 *
 * Pins the 9 operator-mandated objectives added on 2026-05-16 so the
 * DeepSeek autonomous loop keeps working toward them. These were
 * encoded into the roadmap on direct operator request ("execută ce am
 * zis în agentul DeepSeek din unicorn").
 *
 * If you intentionally retire any of these objectives (e.g. status:done
 * and removed), update this test in the SAME commit so the operator
 * intent contract stays explicit.
 *
 * EN: Roadmap-level regression guard for operator-mandated objectives.
 * RO: Contract de regresie pentru obiectivele cerute explicit de
 *     proprietar — DeepSeek le citește la fiecare tick.
 * ===================================================================== */
'use strict';

const assert = require('assert');
const roadmap = require('../data/roadmap.json');

const REQUIRED_OPERATOR_OBJECTIVES = [
  'scale-100m-users-architecture',
  'i18n-mandarin-chinese',
  'referral-network-effect',
  'auth-ed25519-passwordless',
  'dropshipping-end-to-end',
  'weekly-progress-report-autogen',
  'daily-innovation-proposal',
  'marketplace-thousands-of-products',
  'btc-auto-settlement-watchdog',
];

assert.ok(Array.isArray(roadmap.objectives), 'roadmap must have objectives[]');

const idsPresent = new Set(roadmap.objectives.map(o => o && o.id));
const missing = REQUIRED_OPERATOR_OBJECTIVES.filter(id => !idsPresent.has(id));
assert.strictEqual(missing.length, 0,
  'roadmap missing operator-mandated objectives: ' + missing.join(', '));

// Innovation flags must be preserved on the two innovation-flagged mandates.
const referral = roadmap.objectives.find(o => o.id === 'referral-network-effect');
assert.strictEqual(referral.innovation, true,
  'referral-network-effect must remain innovation: true');

const dailyInnov = roadmap.objectives.find(o => o.id === 'daily-innovation-proposal');
assert.strictEqual(dailyInnov.innovation, true,
  'daily-innovation-proposal must remain innovation: true');

// BTC settlement watchdog must keep the owner address pinned (no silent rewrite).
const btcWatchdog = roadmap.objectives.find(o => o.id === 'btc-auto-settlement-watchdog');
assert.strictEqual(btcWatchdog.settlementAddress, roadmap.ownerBtcSettlementAddress,
  'btc-auto-settlement-watchdog.settlementAddress must equal roadmap.ownerBtcSettlementAddress');
assert.strictEqual(btcWatchdog.priority, 1,
  'btc-auto-settlement-watchdog must stay priority 1 — settlement integrity is non-negotiable');

// Marketplace target must remain ambitious (>=1000 products).
const mkt = roadmap.objectives.find(o => o.id === 'marketplace-thousands-of-products');
assert.ok(typeof mkt.target === 'number' && mkt.target >= 1000,
  'marketplace-thousands-of-products.target must be >=1000');

console.log('deepseek-roadmap-operator-mandates.test.js: OK ('
  + REQUIRED_OPERATOR_OBJECTIVES.length + ' operator mandates pinned)');
