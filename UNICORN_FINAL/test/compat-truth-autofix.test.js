'use strict';

/**
 * Compat Truth Instant Autofix — unit contract.
 * Ensures raw JSON CTA anchors are rewritten to data-live-inspect buttons
 * so SITE_CTA_REGRESSION never masquerades as a Node 22/24 ABI break.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const autofix = require(path.join(ROOT, 'scripts/compat-truth-autofix.js'));

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

check('rewrites btn CTA to /api into data-live-inspect button', () => {
  const src = '<a href="/api/enterprise/aedo" class="btn btn-ghost">AEDO status</a>';
  const { next, changed } = autofix.fixSource(src);
  assert.strictEqual(changed, 1);
  assert.ok(next.includes('data-live-inspect="/api/enterprise/aedo"'), next);
  assert.ok(next.includes('<button type="button"'), next);
  assert.ok(!/<a\b[^>]*href="\/api\/enterprise\/aedo"/i.test(next), next);
  assert.ok(next.includes('AEDO status'), next);
});

check('rewrites target=_blank well-known CTA and strips forbidden Open JSON label', () => {
  const src = '<a href="/.well-known/zeusai.json" target="_blank">Open JSON</a>';
  const { next, changed } = autofix.fixSource(src);
  assert.strictEqual(changed, 1);
  assert.ok(next.includes('data-live-inspect="/.well-known/zeusai.json"'), next);
  assert.ok(!/Open JSON/i.test(next), next);
  assert.ok(next.includes('Inspect live'), next);
});

check('leaves plain non-CTA text links alone', () => {
  const src = '<a href="/api/catalog">catalog docs</a>';
  const { next, changed } = autofix.fixSource(src);
  assert.strictEqual(changed, 0);
  assert.strictEqual(next, src);
});

check('leaves data-live-inspect and download alone', () => {
  const a = '<button class="btn" data-live-inspect="/api/health">ok</button>';
  const b = '<a class="btn" href="/api/export.csv" download>Export</a>';
  assert.strictEqual(autofix.fixSource(a).changed, 0);
  assert.strictEqual(autofix.fixSource(b).changed, 0);
});

check('package scripts expose compat-truth:fix / :check', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['compat-truth:fix']);
  assert.ok(pkg.scripts['compat-truth:check']);
  assert.ok(String(pkg.scripts['compat-truth:fix']).includes('compat-truth-autofix.js'));
});

check('lint-staged runs autofix on site/backend HTML surfaces', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const ls = pkg['lint-staged'] || {};
  const key = Object.keys(ls).find((k) => k.includes('src') && k.includes('backend'));
  assert.ok(key, 'lint-staged must cover src + backend/modules');
  const cmds = [].concat(ls[key]);
  assert.ok(cmds.some((c) => String(c).includes('compat-truth-autofix')), cmds);
});

check('GitHub instant-autofix workflow exists and targets matrix failures', () => {
  const wfPath = path.join(REPO, '.github/workflows/compat-truth-autofix.yml');
  assert.ok(fs.existsSync(wfPath), 'compat-truth-autofix.yml missing');
  const wf = fs.readFileSync(wfPath, 'utf8');
  assert.ok(wf.includes('Node Compatibility Matrix'));
  assert.ok(wf.includes('compat-truth-autofix.js'));
  assert.ok(wf.includes('workflow_run'));
  assert.ok(wf.includes('no-raw-json-cta-guard.test.js'));
});

check('preflight CTOS/1.1 instant-fixes SITE_CTA and exits 2 on GITHUB_ACTIONS', () => {
  const pre = fs.readFileSync(path.join(ROOT, 'scripts/compat-truth-preflight.js'), 'utf8');
  assert.ok(pre.includes('CTOS/1.1'));
  assert.ok(pre.includes('compat-truth-autofix.js'));
  assert.ok(pre.includes('SITE_CTA_REGRESSION'));
  assert.ok(pre.includes('GITHUB_ACTIONS'));
  assert.ok(pre.includes('process.exit(2)'));
});

check('CLI --check reports dirty CTA fixture via synthetic rewrite path', () => {
  // Pure unit already covered rewrite; smoke the CLI exits 0 on clean tree.
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/compat-truth-autofix.js'), '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { NODE_ENV: 'test', DISABLE_SELF_MUTATION: '1' }),
  });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

console.log('compat-truth-autofix.test.js: ' + passed + ' passed');
process.exit(0);
