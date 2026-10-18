'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ENABLE_AUTO_RESTART = '0';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const restart = require('../backend/modules/auto-restart');

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

const src = fs.readFileSync(path.join(__dirname, '../backend/modules/auto-restart.js'), 'utf8');
const checkFn = src.slice(src.indexOf('async function checkAndRestart'), src.indexOf('function start'));
const early = checkFn.slice(0, checkFn.indexOf('for (const proc'));

check('jlist online and stopped map to clear and restart', () => {
  const probe = restart.probeFromCommands({
    ok: true,
    out: JSON.stringify([
      { name: 'unicorn-backend', pm2_env: { status: 'online' } },
      { name: 'unicorn-site', pm2_env: { status: 'stopped' } },
    ]),
  }, null);
  assert.strictEqual(probe.ok, true);
  assert.strictEqual(probe.source, 'jlist');
  assert.strictEqual(restart.planRestart(probe.statuses, 'unicorn-backend'), 'clear');
  assert.strictEqual(restart.planRestart(probe.statuses, 'unicorn-site'), 'restart');
});

check('a name missing from a real jlist is absent, not a restart', () => {
  const statuses = restart.parsePm2Jlist(JSON.stringify([
    { name: 'unicorn-site', pm2_env: { status: 'online' } },
  ]));
  assert.strictEqual(restart.planRestart(statuses, 'unicorn-backend'), 'absent');
});

check('a failed probe is hold and does not look healthy', () => {
  assert.strictEqual(restart.planRestart(null, 'unicorn-backend'), 'hold');
  const failed = restart.probeFromCommands({ ok: false, out: '' }, { ok: false, out: '' });
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.statuses, null);
  assert.strictEqual(restart.planRestart(failed.statuses, 'unicorn-site'), 'hold');
});

check('the PM2 table parser reads online, stopped, and waiting restart', () => {
  const table = [
    '│ 0  │ unicorn-backend  │ default │ 1.0.0 │ fork │ 123 │ 2h │ 1 │ online │ 0% │ 30.0mb │ root │ disabled │',
    '│ 1  │ unicorn-site     │ default │ 1.0.0 │ fork │ 0   │ 0  │ 3 │ waiting restart │ 0% │ 0b │ root │ disabled │',
    '│ 2  │ other-app        │ default │ 1.0.0 │ fork │ 9   │ 1m │ 0 │ stopped │ 0% │ 1.0mb │ root │ disabled │',
  ].join('\n');
  const statuses = restart.parsePm2Table(table);
  assert.strictEqual(statuses['unicorn-backend'], 'online');
  assert.strictEqual(statuses['unicorn-site'], 'waiting restart');
  assert.strictEqual(statuses['other-app'], 'stopped');
  assert.strictEqual(restart.planRestart(statuses, 'unicorn-site'), 'restart');
});

check('invalid jlist is null and an empty jlist is an empty map', () => {
  assert.strictEqual(restart.parsePm2Jlist('not-json'), null);
  assert.strictEqual(restart.parsePm2Jlist('{"error":true}'), null);
  const empty = restart.parsePm2Jlist('[]');
  assert.deepStrictEqual(empty, {});
});

check('a grid the table parser cannot read is a failed probe', () => {
  const probe = restart.probeFromCommands(
    { ok: false, out: '' },
    { ok: true, out: '│ id │ name │ status │\n│ broken row │' }
  );
  assert.strictEqual(probe.ok, false);
  assert.strictEqual(probe.source, 'table-unparsed');
  assert.strictEqual(restart.planRestart(probe.statuses, 'unicorn-backend'), 'hold');
});

check('jlist wins when the table would have been unreadable', () => {
  const probe = restart.probeFromCommands(
    { ok: true, out: JSON.stringify([{ name: 'unicorn-backend', pm2_env: { status: 'errored' } }]) },
    { ok: true, out: '│ id │ name │ status │' }
  );
  assert.strictEqual(probe.source, 'jlist');
  assert.strictEqual(restart.planRestart(probe.statuses, 'unicorn-backend'), 'restart');
  assert.strictEqual(restart.planRestart(probe.statuses, 'unicorn-site'), 'absent');
});

check('watched names stay the live PM2 apps', () => {
  assert.ok(src.includes('unicorn-backend,unicorn-site'));
  assert.ok(!src.includes('unicorn-health-guardian'));
});

check('a failed probe returns before backoff is cleared and never starts a missing app', () => {
  assert.ok(early.includes('return 0'));
  assert.ok(!early.includes('_clearBackoff'));
  assert.ok(early.includes("_state.health = 'unknown'"));
  assert.ok(checkFn.includes('_state.unseen = unseen'));
  assert.ok(checkFn.includes("['restart', proc]"));
  assert.ok(!checkFn.includes("['start'"));
  assert.ok(src.includes("String(process.env.ENABLE_AUTO_RESTART || '0') === '1'"));
  assert.strictEqual(restart.getStatus().running, false);
});

console.log(`\n✅ auto-restart-integrity: ${passed} tests passed`);
process.exit(0);
