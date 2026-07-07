'use strict';

const assert = require('assert');
const zk = require('../backend/modules/zk-revenue-proof');

zk.configure({
  subscriptionEngine: {
    getStatus: () => ({ ok: true, mrr: 2400, arr: 28800 }),
  },
  zacc: {
    status: () => ({ publisher: { published: 12 }, fulfillment: { pending: 0 } }),
  },
  profitAutopilot: {
    getStatus: () => ({ ok: true, profitPotentialUsd: { low: 148000, high: 355200 } }),
  },
  tenantBilling: {},
});

const status = zk.getStatus();
assert.equal(status.ok, true);
assert.ok(status.monthlyRevenueFloorUsd > 0);

Promise.resolve(zk.process({ action: 'generate', minimumMonthlyRevenueUsd: 50000 })).then((issued) => {
  assert.equal(issued.ok, true);
  assert.ok(issued.proof && issued.proof.signature);
  return zk.process({ action: 'verify', proof: issued.proof, minimumMonthlyRevenueUsd: 50000 });
}).then((verified) => {
  assert.equal(verified.ok, true);
  assert.equal(verified.verified, true);
  assert.equal(verified.satisfiesMinimumRevenue, true);
  console.log('✅ zk-revenue-proof.test.js: passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
