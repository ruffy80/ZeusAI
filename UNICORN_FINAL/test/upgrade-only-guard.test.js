'use strict';
/**
 * upgrade-only-guard.test.js — proves the hard never-downgrade contract.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const GUARD = path.join(__dirname, '..', 'scripts', 'lib', 'upgrade-only-guard.sh');
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
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
  });
  if (r.status !== 0) {
    throw new Error(`cmd failed (${r.status}): ${cmd}\n${r.stdout}\n${r.stderr}`);
  }
  return (r.stdout || '').trim();
}

function decide(repo, cur, neu, subject = '', envExtra = {}) {
  const script = `
    set -e
    . "${GUARD}"
    export ZEUS_ALLOW_DIVERGENT_REUNITE="${envExtra.ZEUS_ALLOW_DIVERGENT_REUNITE || ''}"
    out="$(upgrade_only_guard "${cur}" "${neu}" ${JSON.stringify(subject)} || true)"
    rc=0
    upgrade_only_guard "${cur}" "${neu}" ${JSON.stringify(subject)} >/dev/null || rc=$?
    printf '%s|%s\\n' "$out" "$rc"
  `;
  const r = spawnSync('bash', ['-lc', script], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...envExtra },
  });
  const line = (r.stdout || '').trim().split('\n').pop();
  const [decision, rc] = line.split('|');
  return { decision, rc: Number(rc), status: r.status, stderr: r.stderr };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-only-'));
sh(tmp, 'git init -b main && git config user.email t@t && git config user.name t');
sh(tmp, 'echo a > a.txt && git add a.txt && git commit -m base');
const A = sh(tmp, 'git rev-parse HEAD');
sh(tmp, 'echo b > b.txt && git add b.txt && git commit -m mid');
const B = sh(tmp, 'git rev-parse HEAD');
sh(tmp, 'echo c > c.txt && git add c.txt && git commit -m tip');
const C = sh(tmp, 'git rev-parse HEAD');

// Divergent branch from A (sibling of B/C line)
sh(tmp, `git checkout -b side ${A} && echo d > d.txt && git add d.txt && git commit -m side && git checkout main`);
const SIDE = sh(tmp, 'git rev-parse side');

check('upgrade A→C allowed', () => {
  const r = decide(tmp, A, C);
  assert.strictEqual(r.decision, 'UPGRADE');
  assert.strictEqual(r.rc, 0);
});

check('same SHA allowed', () => {
  const r = decide(tmp, C, C);
  assert.strictEqual(r.decision, 'SAME');
  assert.strictEqual(r.rc, 0);
});

check('cold start (empty live) allowed', () => {
  const r = decide(tmp, '', C);
  assert.strictEqual(r.decision, 'COLD');
  assert.strictEqual(r.rc, 0);
});

check('true downgrade C→A refused forever', () => {
  const r = decide(tmp, C, A, '[force-deploy] pretend');
  assert.strictEqual(r.decision, 'DOWNGRADE');
  assert.strictEqual(r.rc, 1);
});

check('[force-deploy] cannot bypass true downgrade', () => {
  const r = decide(tmp, C, B, 'ops: [force-deploy] roll back');
  assert.strictEqual(r.decision, 'DOWNGRADE');
  assert.strictEqual(r.rc, 1);
});

check('divergent without marker refused', () => {
  const r = decide(tmp, SIDE, C, 'normal tip');
  assert.strictEqual(r.decision, 'DIVERGENT');
  assert.strictEqual(r.rc, 1);
});

check('divergent with [force-deploy] reunite allowed', () => {
  const r = decide(tmp, SIDE, C, 'ops: [force-deploy] reunite');
  assert.strictEqual(r.decision, 'REUNITE');
  assert.strictEqual(r.rc, 0);
});

check('divergent with ZEUS_ALLOW_DIVERGENT_REUNITE=1 allowed', () => {
  const r = decide(tmp, SIDE, C, 'no marker', { ZEUS_ALLOW_DIVERGENT_REUNITE: '1' });
  assert.strictEqual(r.decision, 'REUNITE');
  assert.strictEqual(r.rc, 0);
});

check('missing candidate SHA is INCOMPLETE not DIVERGENT', () => {
  const fake = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const r = decide(tmp, A, fake, 'Merge pull request #999');
  assert.strictEqual(r.decision, 'INCOMPLETE');
  assert.strictEqual(r.rc, 1);
});

check('empty candidate is INCOMPLETE not DIVERGENT', () => {
  const r = decide(tmp, A, '', 'x');
  assert.strictEqual(r.decision, 'INCOMPLETE');
  assert.strictEqual(r.rc, 1);
});

check('deploy-atomic-forward trusts ZEUS_CI_VERIFIED_UPGRADE', () => {
  const body = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'deploy-atomic-forward.sh'), 'utf8');
  assert.match(body, /ZEUS_CI_VERIFIED_UPGRADE/);
  assert.match(body, /mirror fetched|git -C "\$MIRROR" fetch/);
  assert.match(body, /INCOMPLETE/);
});

check('deploy.yml passes ZEUS_CI_VERIFIED_UPGRADE=1 into forward deploy', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(wf, /ZEUS_CI_VERIFIED_UPGRADE=1/);
});

check('rollback-last-backup.sh permanently refuses', () => {
  const script = path.join(__dirname, '..', 'scripts', 'rollback-last-backup.sh');
  const r = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: { ...process.env, ALLOW_MANUAL_DOWNGRADE: 'I_UNDERSTAND_THIS_IS_A_DOWNGRADE' },
  });
  assert.strictEqual(r.status, 2);
  assert.match(r.stdout + r.stderr, /permanently disabled|upgrade-only/i);
});

check('sentinel act mode script never contains symlink rollback', () => {
  const body = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'zeus-deploy-sentinel.sh'), 'utf8');
  assert.doesNotMatch(body, /ROLLED BACK live symlink/);
  assert.match(body, /NEVER.*rollback|refusing symlink rollback/i);
  assert.match(body, /quarantine/i);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n✅ upgrade-only-guard: ${passed} tests passed\n`);
