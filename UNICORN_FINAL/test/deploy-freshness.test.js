'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'deploy-freshness-decision.sh');
const WORKFLOW = path.join(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml');

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`✓ ${name}`);
  passed += 1;
}

function sh(cwd, cmd) {
  const r = spawnSync('bash', ['-lc', cmd], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });
  if (r.status !== 0) {
    throw new Error(`cmd failed (${r.status}): ${cmd}\n${r.stdout}\n${r.stderr}`);
  }
  return (r.stdout || '').trim();
}

function decide(repo, candidate, latest) {
  return spawnSync('bash', [SCRIPT, candidate, latest], { cwd: repo, encoding: 'utf8' });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-fresh-'));
sh(tmp, 'git init -q && git config user.email t@t && git config user.name t');
sh(tmp, 'echo a > f && git add f && git commit -q -m a');
const A = sh(tmp, 'git rev-parse HEAD');
sh(tmp, 'echo b > f && git add f && git commit -q -m b');
const B = sh(tmp, 'git rev-parse HEAD');
sh(tmp, 'echo c > f && git add f && git commit -q -m c');
const C = sh(tmp, 'git rev-parse HEAD');
sh(tmp, 'git checkout -q --orphan side && git rm -q -rf . && echo z > z && git add z && git commit -q -m side');
const SIDE = sh(tmp, 'git rev-parse HEAD');
sh(tmp, `git checkout -q ${C}`);

check('the tip proceeds', () => {
  const r = decide(tmp, C, C);
  assert.strictEqual(r.status, 0);
  assert.strictEqual((r.stdout || '').trim(), 'PROCEED');
});

check('an ancestor already on main is superseded, not a failure', () => {
  const r = decide(tmp, B, C);
  assert.strictEqual(r.status, 0);
  assert.strictEqual((r.stdout || '').trim(), 'SUPERSEDED');
  const older = decide(tmp, A, C);
  assert.strictEqual(older.status, 0);
  assert.strictEqual((older.stdout || '').trim(), 'SUPERSEDED');
});

check('an unrelated history is refused', () => {
  const r = decide(tmp, SIDE, C);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr || '', /REFUSE/);
  assert.doesNotMatch(r.stdout || '', /PROCEED|SUPERSEDED/);
});

check('a missing sha is refused', () => {
  const r = decide(tmp, '', C);
  assert.strictEqual(r.status, 1);
  const missing = decide(tmp, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', C);
  assert.strictEqual(missing.status, 1);
});

check('deploy.yml skips SSH when a newer main commit contains this SHA', () => {
  const wf = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(wf, /id: queue-freshness/);
  assert.match(wf, /id: deploy-freshness/);
  assert.match(wf, /deploy-freshness-decision\.sh/);
  assert.match(wf, /steps\.queue-freshness\.outputs\.proceed == 'true'/);
  assert.match(wf, /steps\.deploy-freshness\.outputs\.proceed == 'true'/);
  assert.match(wf, /cancel-in-progress: false/);
  assert.doesNotMatch(wf, /Refuz deploy stale: acest workflow nu mai este ultimul commit/);
  const cleanup = wf.split('Final PM2 topology cleanup')[1] || '';
  assert.match(cleanup, /always\(\) && steps\.queue-freshness\.outputs\.proceed == 'true' && steps\.deploy-freshness\.outputs\.proceed == 'true'/);
  const steps = wf.split('\n      - name:').slice(1);
  const queueAt = steps.findIndex((s) => s.includes('id: queue-freshness'));
  const freshAt = steps.findIndex((s) => s.includes('id: deploy-freshness'));
  assert.ok(queueAt >= 0 && freshAt > queueAt);
  steps.slice(queueAt + 1).forEach((step) => {
    assert.match(step, /steps\.queue-freshness\.outputs\.proceed == 'true'/);
  });
  steps.slice(freshAt + 1).forEach((step) => {
    assert.match(step, /steps\.deploy-freshness\.outputs\.proceed == 'true'/);
  });
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n✅ deploy-freshness: ${passed} tests passed\n`);
