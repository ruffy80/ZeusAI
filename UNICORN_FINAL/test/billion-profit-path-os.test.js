'use strict';

/**
 * Billion Profit Path OS — honesty + readiness (never invents GMV).
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

const bppos = require('../src/commerce/billion-profit-path-os');
const econ = require('../src/modules/billionScaleRevenueEngine');
const upr = require('../src/commerce/universal-payment-rails');
const buyability = require('../src/commerce/commerce-buyability');

check('protocol + assessPaths structure', () => {
  assert.equal(bppos.PROTOCOL, 'BPPOS/1.0');
  const a = bppos.assessPaths({ observedGmvUsd: 0, observedPaidOrders: 0 });
  assert.equal(a.ok, true);
  assert.ok(a.paths.length >= 5);
  assert.ok(a.summary.criticalBlockers.includes('zero_confirmed_paid_settlements'));
  assert.ok(/never invents|≠ live GMV|Infrastructure/i.test(a.honesty));
});

check('scenario pathToBillion is opt-in only', () => {
  const obs = bppos.pathToBillionScenario({});
  assert.equal(obs.mode, 'observed');
  assert.ok(/never_invents_gmv/i.test(obs.honesty));
  const sc = bppos.pathToBillionScenario({ scenario: 1, gmvUsd: 5e9, takeRate: 0.2 });
  assert.equal(sc.mode, 'scenario');
  assert.ok(sc.annualRevenueUsd >= 1e9);
});

check('marketplaceEconomics default is zero / non-scenario', () => {
  const d = econ.marketplaceEconomics({});
  assert.equal(d.scenario, false);
  assert.equal(Number(d.annualRevenueUsd), 0);
  const s = econ.marketplaceEconomics({ scenario: '1', gmvUsd: 5e9, takeRate: 0.2 });
  assert.equal(s.scenario, true);
  assert.ok(s.annualRevenueUsd >= 1e9);
});

check('owner dashboard exposes observed block', () => {
  const d = econ.ownerRevenueDashboard({ observedGmvUsd: 12.5, observedPaidOrders: 2 });
  assert.equal(d.observed.gmvUsd, 12.5);
  assert.equal(d.observed.paidOrders, 2);
  assert.ok(d.profitPath.includes('profit-path'));
});

check('dropship virtual SKU honesty — no bypass for desk/demo', () => {
  const blocked = upr.assessVirtualBuyability('dropship:desk-1', {
    dispatchable: false, demoOnly: false, type: 'physical',
  });
  assert.equal(blocked.buyable, false);
  const demo = upr.assessVirtualBuyability('dropship:demo-1', { demoOnly: true, dispatchable: true });
  assert.equal(demo.buyable, false);
  const ok = upr.assessVirtualBuyability('dropship:ok-1', { dispatchable: true, demoOnly: false });
  assert.equal(ok.buyable, true);
});

check('buyability maps dispatchable dropship to self-serve chooser', () => {
  const a = buyability.assessBuyability({
    id: 'dropship:ok-2', dispatchable: true, demoOnly: false, type: 'physical', niche: 'dropship',
  });
  assert.equal(a.buyable, true);
  assert.ok(a.mode === 'btc' || a.mode === 'checkout');
});

check('source wiring: profit-path route + luxury shelf filter', () => {
  const idx = read('src/index.js');
  assert.ok(idx.includes('/api/billion-scale/profit-path'));
  assert.ok(idx.includes('billion-profit-path-os'));
  const be = read('backend/index.js');
  assert.ok(be.includes('/api/billion-scale/profit-path'));
  const pub = read('backend/modules/zacc/publisher.js');
  assert.ok(pub.includes('includeLuxuryPreview') || pub.includes('LUXRE'));
});

console.log('\n' + passed + ' checks passed (billion-profit-path-os)');
// ZACC/world-feed timers may keep the event loop alive after assertions.
process.exit(0);
