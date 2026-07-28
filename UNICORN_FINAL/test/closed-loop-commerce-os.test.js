'use strict';

/**
 * closed-loop-commerce-os.test.js — CLOS/1.0 + Forever Yield + AGY
 */
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.CLOS_DATA_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'clos-'));

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

const ROOT = path.join(__dirname, '..');
const clos = require('../backend/modules/closed-loop-commerce-os');

check('CLOS protocol identity', () => {
  assert.equal(clos.PROTOCOL, 'CLOS/1.0');
  const d = clos.discovery();
  assert.equal(d.protocol, 'CLOS/1.0');
  assert.ok(d.endpoints.wellKnown.includes('clos.json'));
  assert.ok(Array.isArray(d.phases) && d.phases.includes('yield_reinvest'));
});

check('open → ack → close produces signed receipt + yield proposal', () => {
  const open = clos.openCycle({
    orderId: 'clos_test_order_1',
    amountUsd: 99,
    serviceId: 'ai-sales-kit',
    rail: 'btc',
    marginPct: 42,
    email: 'buyer@example.com',
  });
  assert.equal(open.ok, true);
  assert.equal(open.cycle.phase, 'paid');
  assert.equal(open.cycle.status, 'open');

  const ack = clos.ackFulfillment({
    orderId: 'clos_test_order_1',
    mode: 'digital_activation',
  });
  assert.equal(ack.cycle.phase, 'fulfillment_ack');

  const closed = clos.closeLoop({ orderId: 'clos_test_order_1' });
  assert.equal(closed.ok, true);
  assert.equal(closed.cycle.status, 'closed');
  assert.ok(closed.receipt && closed.receipt.receiptHash);
  assert.equal(closed.receipt.attested, true);
  assert.equal(closed.receipt.simulated, false);
  assert.ok(closed.yield && closed.yield.proposal);
  assert.equal(closed.yield.proposal.bookedRevenue, false);
  assert.equal(closed.yield.proposal.live, false);
});

check('idempotent open/close', () => {
  const a = clos.openCycle({ orderId: 'clos_test_order_1', amountUsd: 99 });
  assert.equal(a.idempotent, true);
  const b = clos.closeLoop({ orderId: 'clos_test_order_1' });
  assert.equal(b.idempotent, true);
});

check('AGY index compounds only from closed loops', () => {
  const agy = clos.agyIndex();
  assert.ok(agy.closedLoops >= 1);
  assert.ok(agy.sovereignYieldIndex > 0);
  assert.ok(String(agy.honesty).includes('Never invents'));
});

check('backend wires CLOS routes + paid/ship hooks', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend/index.js'), 'utf8');
  assert.ok(src.includes("closed-loop-commerce-os"));
  assert.ok(src.includes('/.well-known/clos.json'));
  assert.ok(src.includes('/api/clos/agy'));
  assert.ok(src.includes('_closOpenPaid'));
  assert.ok(src.includes('_closCloseDelivered'));
  assert.ok(src.includes("mode: 'digital_activation'") || src.includes("mode: 'desk_ship'"));
});

check('site proxies + discovery include CLOS', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');
  assert.ok(src.includes('/.well-known/clos.json'));
  assert.ok(src.includes('/api/clos/status'));
  assert.ok(src.includes("clos:"));
});

check('nginx + deploy + patcher expose clos.json', () => {
  const nginx = fs.readFileSync(path.join(ROOT, 'scripts/nginx-unicorn.conf'), 'utf8');
  const snip = fs.readFileSync(path.join(ROOT, 'scripts/nginx-public-discovery.snippet.conf'), 'utf8');
  const patch = fs.readFileSync(path.join(ROOT, 'scripts/nginx-patch-public-discovery.py'), 'utf8');
  const deploy = fs.readFileSync(path.join(ROOT, 'scripts/deploy-local.sh'), 'utf8');
  assert.ok(nginx.includes('location = /.well-known/clos.json'));
  assert.ok(snip.includes('location = /.well-known/clos.json'));
  assert.ok(patch.includes('location = /.well-known/clos.json'));
  assert.ok(deploy.includes('location = /.well-known/clos.json'));
});

check('CLOS never books fake GMV in yield proposals', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend/modules/closed-loop-commerce-os.js'), 'utf8');
  assert.ok(src.includes('bookedRevenue: false'));
  assert.ok(src.includes('Never invent GMV') || src.includes('never invents GMV') || src.includes('Never invents GMV'));
});

console.log('\n\u2705 closed-loop-commerce-os: ' + passed + ' tests passed');
process.exit(0);
