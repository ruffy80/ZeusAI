'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const shelf = require('../src/commerce/public-shelf');
const desk = require('../backend/modules/native-capability-desk');
const http = require('../src/site/native-desk-http');

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

check('a resume request stays on the existing offer and an untested hypothesis', () => {
  const row = desk.demand('I need a resume');
  assert.strictEqual(row.offer && row.offer.id, 'instant-resume-makeover');
  assert.strictEqual(row.hypothesis.tested, false);
  assert.strictEqual(row.hypothesis.confirmed, false);
  assert.strictEqual(row.hypothesis.investment, 'none');
  assert.strictEqual(row.competition.source, 'competitor-spy-agent');
  if (!row.competition.armed) {
    assert.strictEqual(row.competition.monitored, 0);
    assert.ok(row.risks.some((line) => /unmeasured/i.test(line)));
  }
  assert.strictEqual(JSON.stringify(row).includes('paidHumans'), false);
});

check('the resume pack copies the shelf card and writes no files', () => {
  const item = shelf.byId('instant-resume-makeover');
  assert.ok(item);
  const pack = desk.productPack(item.id);
  assert.strictEqual(pack.ok, true);
  assert.strictEqual(pack.applied, false);
  assert.deepStrictEqual(pack.filesWritten, []);
  assert.strictEqual(pack.parts.backend.invoked, false);
  assert.strictEqual(pack.parts.interface.ctaHref, item.ctaHref);
  assert.strictEqual(pack.parts.interface.mode, item.mode);
  assert.ok(pack.parts.documentation.fileTitle);
  assert.strictEqual(pack.parts.documentation.kind, pack.parts.delivery.kind);
  assert.strictEqual(pack.verdict.pass, true);
  assert.strictEqual(pack.verdict.launch, false);
});

check('an unknown id fails verification and does not launch', () => {
  const pack = desk.productPack('no-such-id');
  assert.strictEqual(pack.ok, false);
  assert.deepStrictEqual(pack.filesWritten, []);
  assert.strictEqual(pack.verdict.pass, false);
  assert.ok(pack.verdict.failures.includes('no_shelf_offer'));
  assert.strictEqual(pack.verdict.launch, false);
});

check('the kickoff opens checkout and a contract figure is not a shelf offer', () => {
  assert.strictEqual(shelf.byId('ent-acquisition-pack'), null);
  const offer = shelf.byId('ent-engagement-kickoff');
  assert.ok(offer);
  assert.strictEqual(offer.mode, 'reserve');
  const pack = desk.productPack(offer.id);
  assert.ok(String(pack.parts.interface.ctaHref || '').includes('/checkout/?plan=ent-engagement-kickoff'));
  assert.strictEqual(pack.verdict.pass, true);
});

check('a factory that writes files loses to the verifier', () => {
  const verdict = desk.verifyPack({
    ok: true,
    organ: 'factory',
    filesWritten: ['src/invented-product.js'],
    parts: {
      interface: { mode: 'btc', ctaHref: '/checkout/x' },
      documentation: { fileTitle: 'Pack', kind: 'activation' },
      delivery: { kind: 'activation' },
    },
  });
  assert.strictEqual(verdict.pass, false);
  assert.ok(verdict.failures.includes('factory_wrote_files'));
  const judged = desk.assign({ text: 'build product pack', serviceId: 'no-such-id' });
  assert.strictEqual(judged.winner, 'verifier');
  assert.strictEqual(judged.externalModel, false);
  assert.strictEqual(judged.spent, false);
  assert.strictEqual(judged.applied, false);
  assert.deepStrictEqual(judged.filesWritten, []);
  assert.strictEqual(judged.orchestrator, 'integrated-autonomy-kernel');
});

check('revenue leaves unmeasured costs null and does not stop anything', () => {
  const rev = desk.revenue({
    customers: [{ id: 'row-1', lastActiveAt: new Date().toISOString() }],
  });
  assert.strictEqual(rev.conversion.measured, false);
  assert.strictEqual(rev.conversion.value, null);
  assert.strictEqual(rev.acquisitionCost.usd, null);
  assert.strictEqual(rev.acquisitionCost.measured, false);
  assert.strictEqual(rev.aiCost.usd, null);
  assert.strictEqual(rev.stop.applied, false);
  assert.strictEqual(rev.stop.recommended, false);
  assert.strictEqual(rev.stop.requiresHuman, true);
  assert.strictEqual(rev.simulated, false);
  assert.strictEqual(rev.margin.measured, false);
  assert.strictEqual(rev.margin.profit, null);
  assert.strictEqual(rev.ledger.expenses, null);
  assert.strictEqual(rev.ledger.costMeasured, false);
  assert.strictEqual(rev.retention.measured, true);
  assert.strictEqual(rev.retention.source, 'request_body');
  const blob = JSON.stringify(rev);
  assert.strictEqual(/gmv|paidHumans|testimonial/i.test(blob), false);
});

check('financial and production actions stay proposals', () => {
  const pay = desk.govern('refund the bitcoin payment');
  assert.strictEqual(pay.kind, 'financial');
  assert.strictEqual(pay.applied, false);
  assert.strictEqual(pay.requiresHuman, true);
  const prod = desk.govern('restart production');
  assert.strictEqual(prod.kind, 'production');
  assert.strictEqual(prod.applied, false);
  assert.strictEqual(prod.requiresHuman, true);
  assert.ok(String(prod.isolated).includes('3100'));
  const read = desk.govern('read status');
  assert.strictEqual(read.kind, 'read');
  assert.strictEqual(read.requiresHuman, false);
  assert.strictEqual(read.applied, false);
});

check('dropship demand opens the listing desk', () => {
  const row = desk.demand('I want dropship products');
  assert.ok(row.offer);
  assert.strictEqual(row.offer.id, 'dropship-listing-desk');
  assert.strictEqual(row.offer.buyable, true);
  assert.ok(shelf.byId(row.offer.id));
  assert.strictEqual(row.hypothesis.confirmed, false);
  assert.strictEqual(row.hypothesis.investment, 'none');
  const blocked = row.limits.find((item) => /orbital|quantum channel|neural implant/i.test(item.title));
  assert.strictEqual(blocked, undefined);
});

check('the desk source does not call a model or simulate a payment', () => {
  const src = fs.readFileSync(path.join(__dirname, '../backend/modules/native-capability-desk.js'), 'utf8');
  assert.strictEqual(src.includes('/api/chat'), false);
  assert.strictEqual(src.includes('simulate-payment'), false);
  assert.ok(src.includes("orchestrator: 'integrated-autonomy-kernel'"));
  const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(site.includes("urlPath.startsWith('/api/native-desk')"));
  assert.ok(site.includes("urlPath === '/api/native-desk/status'"));
  const backend = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
  assert.strictEqual(backend.split("app.get('/api/omega/vault'").length - 1, 1);
  assert.ok(backend.includes("app.get('/api/native-desk/status'"));
  assert.ok(backend.includes("app.post('/api/native-desk/assign'"));
  const vaultAt = backend.indexOf("app.get('/api/omega/vault'");
  const deskAt = backend.indexOf("app.get('/api/native-desk/status'");
  assert.ok(backend.indexOf('function readBuyerRecord') < vaultAt);
  assert.ok(deskAt < vaultAt);
});

check('status and assign HTTP handlers stay local and read-only', () => {
  desk.resetForTests();
  const status = http.handle({ method: 'GET' }, '/api/native-desk/status', {});
  assert.strictEqual(status.status, 200);
  assert.strictEqual(status.body.ok, true);
  assert.strictEqual(status.body.protocol, 'NCD/1.0');
  assert.strictEqual(status.body.externalModel, false);
  assert.strictEqual(status.body.applied, false);
  const assigned = http.handle({ method: 'POST' }, '/api/native-desk/assign', { text: 'build the resume pack' });
  assert.strictEqual(assigned.status, 200);
  assert.strictEqual(assigned.body.pack && assigned.body.pack.serviceId, 'instant-resume-makeover');
  assert.strictEqual(assigned.body.externalModel, false);
  assert.strictEqual(assigned.body.spent, false);
  assert.deepStrictEqual(assigned.body.filesWritten, []);
  assert.ok(assigned.body.organs.includes('factory'));
  assert.ok(assigned.body.organs.includes('governance'));
  const missing = http.handle({ method: 'POST' }, '/api/native-desk/missing', {});
  assert.strictEqual(missing.status, 404);
});

console.log('✅ native-capability-desk: ' + passed + ' tests passed');
process.exit(0);
