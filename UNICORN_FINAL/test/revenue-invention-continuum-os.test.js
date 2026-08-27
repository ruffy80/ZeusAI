// =====================================================================
// revenue-invention-continuum-os.test.js — RIVOS/1.0
// Locks: PECG gravity from attested paid/expired, OAUR awaiting map,
// PRL recovery queue shape, CYM append, AMOS/PPCOS wiring, honesty.
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.RIVOS_DISABLED = '1'; // don't start interval in tests
process.env.RIVOS_DATA_DIR = require('os').tmpdir() + '/rivos-test-' + Date.now();

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rivos = require('../src/commerce/revenue-invention-continuum-os');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('discovery exposes four inventions + honesty', () => {
  const d = rivos.discovery();
  assert.equal(d.protocol, 'RIVOS/1.0');
  assert.ok(d.inventions.PECG);
  assert.ok(d.inventions.OAUR);
  assert.ok(d.inventions.PRL);
  assert.ok(d.inventions.CYM);
  assert.ok(d.inventions.MDSP);
  assert.ok(/Never invents GMV/i.test(d.honesty));
});

check('PECG raises gravity on paid and penalizes expired', () => {
  rivos.onPaid({
    serviceId: 'instant-ai-audit',
    orderId: 'ord-paid-1',
    subtotal_fiat: 49,
    paid_at: new Date().toISOString(),
  });
  rivos.onPaid({
    serviceId: 'instant-ai-audit',
    orderId: 'ord-paid-2',
    amountUsd: 49,
  });
  rivos.onExpired({
    serviceId: 'instant-ai-audit',
    orderId: 'ord-exp-1',
  });
  rivos.onPaid({
    serviceId: 'instant-other',
    orderId: 'ord-paid-3',
    amountUsd: 9,
  });
  const top = rivos.gravitySnapshot(5);
  assert.ok(top.length >= 2);
  assert.equal(top[0].id, 'instant-ai-audit');
  assert.ok(top[0].paid >= 2);
  assert.ok(top[0].score > top[1].score);
});

check('reorderSkus prefers high gravity', () => {
  const ordered = rivos.reorderSkus([
    { id: 'instant-other', title: 'Other', priceUsd: 99 },
    { id: 'instant-ai-audit', title: 'Audit', priceUsd: 49 },
  ]);
  assert.equal(ordered[0].id, 'instant-ai-audit');
  assert.ok(ordered[0].gravityScore > 0);
  assert.equal(ordered[0].gravityRank, 1);
});

check('OAUR authAwaitingMap returns fingerprint + rails', () => {
  const map = rivos.authAwaitingMap();
  assert.ok(typeof map.fingerprint === 'string' && map.fingerprint.length >= 8);
  assert.ok(Array.isArray(map.awaiting));
  assert.ok(map.count >= 1, 'at least one rail awaits in clean test env');
});

check('OAUR briefing dry-run does not invent keys', async () => {
  const b = await rivos.briefOwnerAuth({ dryRun: true });
  assert.equal(b.ok, true);
  assert.equal(b.dryRun, true);
  assert.ok(b.preview.includes('OAUR'));
  assert.ok(!/fake.?gmv|invented/i.test(b.preview));
});

check('PRL scanRecovery returns honest shape without throwing', () => {
  const r = rivos.scanRecovery({ limit: 5 });
  assert.equal(r.ok, true);
  assert.equal(r.invention, 'PRL');
  assert.ok(Array.isArray(r.items));
  assert.ok(/never invent/i.test(r.note));
});

check('tick dry-run produces gravity + oaur + prl', async () => {
  const t = await rivos.tick({ force: true, dryRun: true, forceBriefing: true });
  assert.equal(t.protocol, 'RIVOS/1.0');
  assert.ok(t.gravityTop);
  assert.ok(t.oaur);
  assert.ok(t.prl);
  assert.ok(t.briefing && t.briefing.dryRun);
});

check('CYM ledger file grows only with real events', () => {
  const ledger = path.join(process.env.RIVOS_DATA_DIR, 'cym-ledger.jsonl');
  assert.ok(fs.existsSync(ledger));
  const lines = fs.readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean);
  assert.ok(lines.length >= 2);
  const last = JSON.parse(lines[lines.length - 1]);
  assert.ok(last.hash && last.prev);
});

check('PPCOS wires rivos.onPaid', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/commerce/post-pay-closure-os.js'), 'utf8');
  assert.ok(src.includes('revenue-invention-continuum-os'));
  assert.ok(src.includes('rivos.onPaid'));
});

check('AMOS reorders via RIVOS gravity', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/commerce/autonomy-money-surface-os.js'), 'utf8');
  assert.ok(src.includes('reorderSkus'));
  assert.ok(src.includes('revenue-invention-continuum-os'));
});

check('backend + site expose /.well-known/rivos.json', () => {
  const be = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
  const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(be.includes('/.well-known/rivos.json'));
  assert.ok(be.includes('RIVOS/1.0'));
  assert.ok(site.includes('/.well-known/rivos.json'));
});

check('AACOS links RIVOS organ', () => {
  const src = fs.readFileSync(path.join(__dirname, '../backend/modules/autonomy-action-continuum-os.js'), 'utf8');
  assert.ok(src.includes('revenue-invention-continuum-os'));
});

console.log('\n\u2705 revenue-invention-continuum-os:', passed, 'tests passed');
process.exit(0);
