'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const unified = require('../src/commerce/unified-catalog');
const instant = require('../src/commerce/instant-catalog');
const enterprise = require('../src/commerce/enterprise-catalog');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('the public cap is the curated seed and keeps the enterprise license', () => {
  const curated = (instant.all() || []).length + (enterprise.all() || []).length;
  assert.ok(curated > 25, 'the shelf outgrew the old frozen cap');
  assert.equal(unified.MAX_PRODUCTS, curated);
  const rows = unified.all();
  assert.equal(rows.length, curated);
  const license = rows.find((row) => row.id === 'ent-platform-license');
  assert.ok(license, 'ent-platform-license');
  assert.equal(license.billing, 'annual');
  assert.equal(license.tier, 'enterprise');
});

check('no test freezes the public catalog at 25', () => {
  const dir = __dirname;
  const offenders = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.test.js')) continue;
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const frozen = 'caps the public shelf at ' + '25';
    if (text.includes(frozen)) offenders.push(name);
  }
  assert.deepStrictEqual(offenders, []);
});

console.log('catalog-cap-contract.test.js: ' + passed + ' passed');
