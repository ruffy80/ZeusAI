'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZACC_SHELF_CAP = '3';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { AutonomousShelfProtocol, fitness, PROTOCOL } = require('../backend/modules/zacc/shelf-protocol');
const { AutoPublisher } = require('../backend/modules/zacc/publisher');

function run(name, fn) {
  fn();
  console.log('✓', name);
}

let n = 0;
function check(name, fn) { run(name, fn); n += 1; }

check('fitness ranks higher margin + profit above weak SKUs', () => {
  const hi = fitness({
    marginPct: 50, netProfitUsd: 40, profitPotential: 90,
    metrics: { views: 20, sales: 3, carts: 5 },
    delivery: { automated: true }, publishedAt: new Date().toISOString(),
  });
  const lo = fitness({
    marginPct: 10, netProfitUsd: 1, profitPotential: 5,
    metrics: { views: 0, sales: 0, carts: 0 },
    demoOnly: true, delivery: { automated: false },
    publishedAt: new Date(Date.now() - 40 * 86400000).toISOString(),
  });
  assert.ok(hi > lo, 'expected hi fitness > lo');
});

check('tournament reorders shelf and hash-chains ledger', () => {
  const shelf = new AutonomousShelfProtocol();
  const pub = new AutoPublisher();
  pub.published = [
    { id: 'a', title: 'A', marginPct: 20, netProfitUsd: 5, profitPotential: 10, metrics: { views: 0, sales: 0, carts: 0 }, publishedAt: new Date().toISOString() },
    { id: 'b', title: 'B', marginPct: 55, netProfitUsd: 30, profitPotential: 80, metrics: { views: 10, sales: 2, carts: 4 }, delivery: { automated: true }, publishedAt: new Date().toISOString() },
    { id: 'c', title: 'C', marginPct: 35, netProfitUsd: 12, profitPotential: 40, metrics: { views: 2, sales: 0, carts: 1 }, publishedAt: new Date().toISOString() },
    { id: 'd', title: 'D', marginPct: 15, netProfitUsd: 2, profitPotential: 8, metrics: { views: 0, sales: 0, carts: 0 }, demoOnly: true, publishedAt: new Date().toISOString() },
  ];
  pub.byId = new Map(pub.published.map((p) => [p.id, p]));
  const r1 = shelf.runTournament(pub);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(pub.published[0].id, 'b');
  assert.strictEqual(pub.published[0].shelf.rank, 1);
  assert.ok(pub.published[3].shelfHidden === true, '4th SKU hidden under SHELF_CAP=3');
  assert.ok(shelf.entries.length >= 1);
  assert.strictEqual(shelf.entries[0].type, 'shelf_tournament');
  assert.strictEqual(shelf.verifyChain().ok, true);

  // Second tournament still keeps chain intact
  pub.published[0].metrics.sales = 9;
  const r2 = shelf.runTournament(pub);
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(shelf.verifyChain().ok, true);
  assert.ok(shelf.tournaments >= 2);
});

check('margin seal commits Proof-of-Margin into ledger', () => {
  const shelf = new AutonomousShelfProtocol();
  const seal = shelf.sealMargin({
    id: 'dropship-x',
    title: 'X',
    priceUsd: 49,
    proofOfMargin: { costUsd: 18, shippingUsd: 4, feeUsd: 2, netProfitUsd: 20, marginPct: 40 },
    shelf: { rank: 1, fitness: 77 },
  }, { country: 'RO' });
  assert.strictEqual(seal.ok, true);
  assert.ok(seal.seal && seal.seal.length >= 32);
  assert.strictEqual(shelf.entries[0].type, 'margin_seal');
  assert.strictEqual(shelf.verifyChain().ok, true);
  const pulse = shelf.pulse(5);
  assert.strictEqual(pulse.protocol, PROTOCOL);
  assert.ok(pulse.invention.includes('Shelf'));
  const view = shelf.getLedger(5);
  assert.strictEqual(view.ok, true);
  assert.ok(view.count >= 1);
  assert.strictEqual(view.intact, true);
});

check('publisher list sorts by shelf and hides soft-archived', () => {
  const pub = new AutoPublisher();
  pub.published = [
    { id: '1', title: '1', priceUsd: 1, profitPotential: 1, shelf: { rank: 2, fitness: 50 }, shelfHidden: false, metrics: { sales: 0 }, category: 'a', description: '' },
    { id: '2', title: '2', priceUsd: 2, profitPotential: 9, shelf: { rank: 1, fitness: 90 }, shelfHidden: false, metrics: { sales: 0 }, category: 'a', description: '' },
    { id: '3', title: '3', priceUsd: 3, profitPotential: 5, shelf: { rank: 3, fitness: 10 }, shelfHidden: true, metrics: { sales: 0 }, category: 'a', description: '' },
  ];
  const visible = pub.list({ sort: 'shelf', limit: 10 });
  assert.strictEqual(visible.length, 2);
  assert.strictEqual(visible[0].id, '2');
  const all = pub.list({ sort: 'shelf', limit: 10, includeHidden: true });
  assert.strictEqual(all.length, 3);
});

check('source wires ASP routes + pulse UX', () => {
  const be = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
  assert.ok(be.includes("/api/dropship/pulse"));
  assert.ok(be.includes("/api/dropship/ledger"));
  assert.ok(be.includes('sealMargin'));
  const core = fs.readFileSync(path.join(__dirname, '..', 'backend', 'modules', 'zacc', 'index.js'), 'utf8');
  assert.ok(core.includes('AutonomousShelfProtocol'));
  assert.ok(core.includes('stages.shelf'));
  const site = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  assert.ok(site.includes('id="pulse"'));
  assert.ok(site.includes('refreshPulse'));
  assert.ok(site.includes('Shelf fitness (ASP)'));
});

console.log('\n✅ autonomous-shelf-protocol:', n, 'tests passed');
process.exit(0);
