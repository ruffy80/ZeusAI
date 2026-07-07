'use strict';

const assert = require('assert');
const pnl = require('../backend/modules/pnl-time-machine');

pnl.configure({
  profitAutopilot: {
    getStatus: () => ({ ok: true, profitPotentialUsd: { low: 148000, high: 355200 } }),
  },
  subscriptionEngine: {
    getStatus: () => ({ ok: true, mrr: 3200, arr: 38400 }),
  },
  zacc: {
    status: () => ({ publisher: { published: 15 }, fulfillment: { pending: 0 } }),
  },
  tenantBilling: {},
  dynamicPricing: {},
  marketplace: {},
});

const status = pnl.getStatus();
assert.equal(status.ok, true);
assert.ok(status.baselineMonthlyRevenueUsd > 0);

Promise.resolve(pnl.process({
  action: 'simulate',
  trials: 600,
  monthlyGrowthRate: 0.07,
  volatility: 0.18,
  grossMargin: 0.6,
  fixedCostsMonthly: 10000,
  seed: 'test-seed-2026',
})).then((out) => {
  assert.equal(out.ok, true);
  assert.ok(out.horizons && out.horizons.next30 && out.horizons.next365);
  assert.ok(Number.isFinite(out.horizons.next90.base.meanProfitUsd));
  assert.ok(out.horizons.next30.base.p50ProfitUsd <= out.horizons.next30.base.p90ProfitUsd);
  console.log('✅ pnl-time-machine.test.js: passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
