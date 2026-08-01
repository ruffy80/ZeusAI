#!/usr/bin/env node
'use strict';

/**
 * Compat Truth Preflight (CTOS/1.1)
 * ---------------------------------
 * Innovation: never let a site/commerce regression masquerade as a
 * "Node 22/24 compatibility" failure in GitHub Actions.
 *
 * On SITE_CTA_REGRESSION: runs compat-truth-autofix.js INSTANTLY, re-verifies.
 * Default CTOS_INSTANT_FIX=on (set CTOS_INSTANT_FIX=0 to disable).
 *
 * Exit codes after successful autofix:
 *   - GitHub Actions: 2 (matrix stays red until compat-truth-autofix.yml
 *     commits+pushes the repair — never green while tip still has the CTA)
 *   - Local: 0 (files already rewritten; lint-staged stages them on commit)
 *
 * Classes: SITE_CTA_REGRESSION | COMMERCE_CONTRACT | NGINX_CONTRACT | ENGINE_CONTRACT
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INSTANT_FIX = process.env.CTOS_INSTANT_FIX !== '0'; // default ON

/** @type {{ file: string, class: string, title: string }[]} */
const SUITE = [
  {
    file: 'test/node-compat-contract.test.js',
    class: 'ENGINE_CONTRACT',
    title: 'engines / .nvmrc / matrix / better-sqlite3',
  },
  {
    file: 'test/no-raw-json-cta-guard.test.js',
    class: 'SITE_CTA_REGRESSION',
    title: 'no raw /api JSON CTAs in site HTML (use data-live-inspect)',
  },
  {
    file: 'test/payment-honesty.test.js',
    class: 'COMMERCE_CONTRACT',
    title: 'payment honesty / QR paths',
  },
  {
    file: 'test/checkout-payments-never-dead.test.js',
    class: 'COMMERCE_CONTRACT',
    title: 'checkout rails never-dead',
  },
  {
    file: 'test/sovereign-checkout-html.test.js',
    class: 'COMMERCE_CONTRACT',
    title: 'sovereign checkout HTML',
  },
  {
    file: 'test/nginx-contract-guard.test.js',
    class: 'NGINX_CONTRACT',
    title: 'nginx routing contract',
  },
];

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      NODE_ENV: 'test',
      DISABLE_SELF_MUTATION: '1',
    }),
    encoding: 'utf8',
  });
}

function runOne(item) {
  const r = runNode([path.join(ROOT, item.file)]);
  return {
    item,
    code: r.status == null ? 1 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function instantFixSiteCta() {
  console.log('\n[compat-truth] ⚡ INSTANT FIX · SITE_CTA_REGRESSION → compat-truth-autofix.js');
  const fix = runNode([path.join(ROOT, 'scripts/compat-truth-autofix.js')]);
  if (fix.stdout) process.stdout.write(fix.stdout);
  if (fix.stderr) process.stderr.write(fix.stderr);
  const recheck = runOne(SUITE.find((s) => s.class === 'SITE_CTA_REGRESSION'));
  return { fixCode: fix.status == null ? 1 : fix.status, recheck };
}

function main() {
  const matrix = process.env.NODE_COMPAT_MATRIX || process.versions.node.split('.')[0];
  console.log('[compat-truth] CTOS/1.1 preflight · node=' + process.versions.node
    + ' · matrix=' + matrix + ' · instant_fix=' + (INSTANT_FIX ? 'on' : 'off'));
  console.log('[compat-truth] Failures are classified contracts — NOT Node ABI breaks.\n');

  const failures = [];
  let autofixed = false;

  for (const item of SUITE) {
    process.stdout.write('[compat-truth] → ' + item.class + ' · ' + item.file + ' … ');
    let out = runOne(item);
    if (out.code === 0) {
      console.log('ok');
      continue;
    }
    console.log('FAIL');

    if (item.class === 'SITE_CTA_REGRESSION' && INSTANT_FIX) {
      const { recheck } = instantFixSiteCta();
      if (recheck.code === 0) {
        console.log('[compat-truth] ✅ SITE_CTA_REGRESSION auto-repaired instantly');
        console.error('::notice title=COMPAT_TRUTH AUTOFIXED SITE_CTA::'
          + 'Raw JSON CTAs rewritten to data-live-inspect — commit autofix and re-run');
        autofixed = true;
        // Do not keep as failure — but CI must still commit the patch.
        continue;
      }
      console.log('[compat-truth] autofix did not clear SITE_CTA — leaving as failure');
      out = recheck;
    }

    failures.push(out);
    if (out.stdout) process.stdout.write(out.stdout);
    if (out.stderr) process.stderr.write(out.stderr);
  }

  if (!failures.length && !autofixed) {
    console.log('\n[compat-truth] ✅ all classified contracts green — safe to run full suite');
    process.exit(0);
  }

  if (!failures.length && autofixed) {
    console.error('\n[compat-truth] ✅ contracts green AFTER instant autofix');
    console.error('[compat-truth] ACTION REQUIRED: commit files touched by compat-truth-autofix.js');
    if (process.env.GITHUB_ACTIONS && process.env.CTOS_AUTOFIX_EXIT_OK !== '1') {
      console.error('::error title=COMPAT_TRUTH AUTOFIX_PENDING_COMMIT::'
        + 'SITE_CTA was auto-repaired — compat-truth-autofix.yml will commit+push');
      // Exit 2 = autofixed pending commit (never mark PR green on dirty tip).
      process.exit(2);
    }
    process.exit(0);
  }

  console.error('\n════════════════════════════════════════════════════════════');
  console.error('COMPAT_TRUTH FAILURE — not a Node ' + matrix + ' ABI / runtime break');
  console.error('════════════════════════════════════════════════════════════');
  for (const f of failures) {
    console.error('  class=' + f.item.class);
    console.error('  title=' + f.item.title);
    console.error('  file=' + f.item.file);
    console.error('');
    console.error('::error title=COMPAT_TRUTH ' + f.item.class + '::'
      + f.item.title + ' (' + f.item.file + ') — NOT a Node '
      + matrix + ' compatibility/ABI failure');
  }
  process.exit(1);
}

main();
