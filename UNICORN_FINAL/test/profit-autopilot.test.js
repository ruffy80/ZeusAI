'use strict';

const assert = require('assert');
const autopilot = require('../backend/modules/profit-autopilot');

autopilot.configure({
  marketplace: { getAllServices: () => [{ id: 'starter', name: 'Starter', category: 'plan', price: 29 }] },
  dynamicPricing: { getFallbackStatus: () => ({ fallbackCount: 0 }) },
  livePricingBroker: {
    getSnapshot: () => ({
      btcRate: { source: 'coinbase' },
      items: [{ id: 'starter', name: 'Starter', category: 'plan', priceUsd: 29 }],
    }),
  },
  autoMarketing: {
    allocateBudget: (_channels, budget) => ({
      totalBudget: budget,
      allocation: [{ channel: 'telegram', allocation: budget, roas: 3, sharePct: 100 }],
      projectedRevenue: budget * 3,
      projectedRoas: 3,
    }),
  },
  tenantBilling: {},
  zacc: {
    status: () => ({ publisher: { published: 4 }, fulfillment: { pending: 1 } }),
    publisher: { list: () => [{ id: 'drop-1', title: 'Dropship Product', priceUsd: 49, marginPct: 55, category: 'electronics' }] },
  },
  socialViralizer: { getProviderStatus: () => ({ telegram: true, x: false }) },
  upsellEngine: { recommend: (input) => ({ ok: true, recommendations: [{ id: 'starter' }], input }) },
  subscriptionEngine: { getStatus: () => ({ ok: true, mrr: 499, arr: 5988 }) },
});

const status = autopilot.getStatus();
assert.equal(status.ok, true);
assert.ok(status.modulesTracked >= 8);
assert.ok(status.campaignCount >= 3);
assert.ok(status.profitPotentialUsd.low > 0);

Promise.resolve(autopilot.process({ action: 'inventory' })).then((out) => {
  assert.equal(out.ok, true);
  assert.ok(Array.isArray(out.inventory));
  assert.ok(out.inventory.some((item) => item.name === 'subscription-engine'));
  console.log('✅ profit-autopilot.test.js: passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
