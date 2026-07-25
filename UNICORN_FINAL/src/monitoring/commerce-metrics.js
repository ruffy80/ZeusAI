// =============================================================================
// OWNERSHIP: Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =============================================================================
/**
 * commerce-metrics.js — real commerce counters for the SITE process (ESOS/1.0).
 * ----------------------------------------------------------------------------
 * Replaces fabricated Math.random observability values on the commerce path
 * with honest, monotonically-increasing counters incremented from real events
 * in sovereign-commerce (order created, order paid, checkout opened, price
 * oracle failure, integrity check outcome).
 *
 * Public-safe by construction: counters are aggregate integers only — no buyer
 * data, amounts, or identifiers are ever stored here.
 */
'use strict';

const COUNTERS = [
  'orders_created',
  'orders_paid',
  'checkout_open',
  'price_oracle_fail',
  'integrity_ok',
  'integrity_fail',
];

const _counts = Object.create(null);
for (const c of COUNTERS) _counts[c] = 0;
const _startedAt = Date.now();

function inc(name, by = 1) {
  if (!Object.prototype.hasOwnProperty.call(_counts, name)) return undefined;
  const n = Number(by);
  _counts[name] += Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return _counts[name];
}

function snapshot() {
  const out = {};
  for (const c of COUNTERS) out[c] = _counts[c];
  return out;
}

function json() {
  return {
    ok: true,
    protocol: 'ESOS/1.0',
    counters: snapshot(),
    since: new Date(_startedAt).toISOString(),
    ts: new Date().toISOString(),
  };
}

function promText() {
  const lines = [];
  for (const c of COUNTERS) {
    const metric = 'unicorn_commerce_' + c + '_total';
    lines.push('# HELP ' + metric + ' Commerce counter ' + c + '.');
    lines.push('# TYPE ' + metric + ' counter');
    lines.push(metric + ' ' + _counts[c]);
  }
  return lines.join('\n') + '\n';
}

function reset() {
  for (const c of COUNTERS) _counts[c] = 0;
}

module.exports = { inc, snapshot, json, promText, reset, COUNTERS };
