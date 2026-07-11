'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicorn-money-machine-'));
const moneyMachineDataDir = path.join(tempDir, 'data', 'money-machine');
process.env.NODE_ENV = 'test';
process.env.MONEY_MACHINE_DATA_DIR = moneyMachineDataDir;

async function run() {
  const moneyMachine = require('../backend/modules/autonomousMoneyMachine');
  const offersFile = path.join(moneyMachineDataDir, 'offers.jsonl');

  const preview = moneyMachine.offerFactory({ industry: 'audit', persist: false });
  assert.equal(preview.ok, true);
  assert.equal(fs.existsSync(offersFile), false, 'preview generation must not mutate offers.jsonl');

  const persisted = moneyMachine.offerFactory({ industry: 'audit', persist: true });
  assert.equal(persisted.ok, true);
  assert.ok(fs.statSync(offersFile).size > 0, 'explicit persistence must append offers');

  const filler = JSON.stringify({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }) + '\n';
  const handle = fs.openSync(offersFile, 'a');
  try {
    const chunk = filler.repeat(10000);
    for (let index = 0; index < 20; index += 1) fs.writeSync(handle, chunk);
  } finally {
    fs.closeSync(handle);
  }

  const started = Date.now();
  const commander = moneyMachine.revenueCommander();
  const elapsedMs = Date.now() - started;
  assert.equal(commander.ok, true);
  assert.ok(commander.kpis.offers > 0, 'bounded reader must return valid offers');
  assert.ok(commander.kpis.offers <= 20, 'commander must bound retained offers in memory');
  assert.ok(elapsedMs < 2000, `bounded tail read took too long: ${elapsedMs}ms`);

  const newest = moneyMachine.offerFactory({ industry: 'newest-valid', persist: true });
  fs.appendFileSync(offersFile, '{"partial":');
  const afterMalformedRow = moneyMachine.revenueCommander();
  assert.equal(afterMalformedRow.decision.topOffer, newest.offers[newest.offers.length - 1].id,
    'a malformed final row must not hide the newest valid offer');

  const lockDir = `${offersFile}.lock.d`;
  fs.mkdirSync(lockDir);
  const retention = spawn('bash', [path.join(__dirname, '..', 'scripts', 'shared-data-retention.sh')], {
    env: {
      ...process.env,
      UNICORN_SHARED_ROOT: tempDir,
      UNICORN_RETENTION_STATE_DIR: path.join(tempDir, 'retention-state'),
      UNICORN_JSONL_MAX_BYTES: '512',
      UNICORN_JSONL_KEEP_LINES: '5',
      UNICORN_LEDGER_LOCK_WAIT_S: '10',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(retention.exitCode, null, 'retention must wait while a ledger writer owns the lock');
  const concurrentOffer = { id: 'concurrent-newest', createdAt: new Date().toISOString() };
  fs.appendFileSync(offersFile, `${JSON.stringify(concurrentOffer)}\n`);
  fs.rmSync(lockDir, { recursive: true, force: true });
  const stderr = [];
  retention.stderr.on('data', (chunk) => stderr.push(chunk));
  const exitCode = await new Promise((resolve) => retention.on('close', resolve));
  assert.equal(exitCode, 0, `retention failed: ${Buffer.concat(stderr).toString('utf8')}`);
  const retainedRows = fs.readFileSync(offersFile, 'utf8').split('\n').filter(Boolean);
  assert.ok(retainedRows.length <= 5, 'retention must enforce the configured row limit');
  assert.ok(retainedRows.some((line) => line.includes(concurrentOffer.id)),
    'retention must preserve data appended before the writer releases its lock');

  console.log(`money-machine-bounded-io: passed (${elapsedMs}ms)`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});
