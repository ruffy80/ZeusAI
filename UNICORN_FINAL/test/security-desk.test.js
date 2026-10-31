'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const shelf = require('../src/commerce/public-shelf');
const engine = require('../src/site/v2/fulfillment-engine');
const desk = require('../src/commerce/security-desk');
const finished = require('../src/commerce/finished-delivery');
const integrity = require('../src/commerce/service-integrity');

const IDS = [
  'instant-endpoint-ledger',
  'instant-control-evidence',
  'instant-network-partition',
  'instant-security-test-brief',
  'instant-operations-watch',
  'instant-incident-clock',
  'instant-security-program',
];

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('each security offer is on the shelf and the file passes the gate', () => {
  IDS.forEach((id) => {
    const item = shelf.byId(id);
    assert.ok(item, id);
    assert.strictEqual(item.buyable, true, id);
    assert.strictEqual(item.clock, 'minutes', id);
    assert.ok(item.deliveryMinutes > 0 && item.deliveryMinutes <= 60, id);
    const file = engine.buyerFile(item);
    assert.strictEqual(finished.review(item, file).pass, true, id);
    const proof = integrity.proofFor(item);
    assert.strictEqual(proof.pass, true, id + ' ' + (proof.failures || []).join(','));
    assert.ok(!/\b(nmap|sqlmap|metasploit)\b/i.test(file), id);
  });
});

check('the program file contains every desk and stays under the sum of the six', () => {
  const program = shelf.byId('instant-security-program');
  const parts = IDS.filter((id) => id !== 'instant-security-program');
  const sum = parts.reduce((total, id) => total + shelf.byId(id).priceUsd, 0);
  assert.ok(program.priceUsd < sum, program.priceUsd + ' vs ' + sum);
  const file = desk.deliver('instant-security-program', [
    'orgName: North Clinic',
    'estate: ward-pc; imaging',
    'frameworks: HIPAA',
  ]);
  assert.ok(file.includes('Endpoint ledger'));
  assert.ok(file.includes('Control evidence'));
  assert.ok(file.includes('Network partition'));
  assert.ok(file.includes('Security test brief'));
  assert.ok(file.includes('Operations watch'));
  assert.ok(file.includes('Incident clock'));
  assert.ok(file.includes('ward-pc'));
  assert.ok(file.includes('HIPAA'));
  assert.ok(file.includes('does not certify HIPAA'));
  assert.ok(file.includes('does not include an exploit step'));
});

check('a security ask routes to the matching file', () => {
  assert.strictEqual(shelf.advise('We need penetration testing for the hospital').primary.id, 'instant-security-test-brief');
  assert.strictEqual(shelf.advise('NIS2 and DORA evidence').primary.id, 'instant-control-evidence');
  assert.strictEqual(shelf.advise('endpoint patch management').primary.id, 'instant-endpoint-ledger');
  assert.strictEqual(shelf.advise('We need a cybersecurity program').primary.id, 'instant-security-program');
});

check('an empty brief invents no asset and no breach', () => {
  const ledger = desk.deliver('instant-endpoint-ledger', []);
  const clock = desk.deliver('instant-incident-clock', []);
  assert.ok(ledger.includes('No machine was invented'));
  assert.ok(clock.includes('No breach was invented'));
});

console.log('✅ security-desk: ' + passed + ' tests passed');
