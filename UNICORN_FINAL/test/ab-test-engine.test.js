'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ab = require('../backend/modules/ab-test-engine');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

check('a short sample has no winner and never touches the homepage', () => {
  const src = fs.readFileSync(path.join(__dirname, '../backend/modules/ab-test-engine.js'), 'utf8');
  assert.ok(!/ssrVariant|HEADLINES/.test(src));
  const empty = ab.evaluate({ impression: { A: 0, B: 0 }, conversion: { A: 0, B: 0 } });
  assert.strictEqual(empty.winner, null);
  assert.strictEqual(empty.promoted, false);
  assert.strictEqual(empty.appliedToHomepage, false);
  assert.strictEqual(empty.inventsConversions, false);
  const small = ab.evaluate({ impression: { A: 19, B: 40 }, conversion: { A: 10, B: 1 } });
  assert.strictEqual(small.winner, null);
  assert.strictEqual(small.appliedToHomepage, false);
});

check('a real sample recommends a winner without promoting it', () => {
  const out = ab.evaluate({ impression: { A: 40, B: 40 }, conversion: { A: 2, B: 10 } });
  assert.strictEqual(out.winner, 'B');
  assert.strictEqual(out.enoughSample, true);
  assert.strictEqual(out.promoted, false);
  assert.strictEqual(out.appliedToHomepage, false);
  assert.strictEqual(out.recommendationOnly, true);
  const tie = ab.evaluate({ impression: { A: 20, B: 20 }, conversion: { A: 4, B: 4 } });
  assert.strictEqual(tie.winner, null);
  assert.strictEqual(tie.promoted, false);
});

console.log('ab-test-engine: ' + passed + ' checks passed');
process.exit(0);
