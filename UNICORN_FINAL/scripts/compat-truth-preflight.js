#!/usr/bin/env node
'use strict';

/**
 * Compat Truth Preflight (CTOS/1.0)
 * ---------------------------------
 * Innovation: never let a site/commerce regression masquerade as a
 * "Node 22/24 compatibility" failure in GitHub Actions.
 *
 * Runs a classified contract suite BEFORE `npm test`. On failure, exits with
 * a machine-readable class so humans (and bots) see the real cause:
 *   SITE_CTA_REGRESSION | COMMERCE_CONTRACT | NGINX_CONTRACT | ENGINE_CONTRACT
 *
 * Wire: .github/workflows/node-compatibility.yml → this script.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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

function runOne(item) {
  const r = spawnSync(process.execPath, [path.join(ROOT, item.file)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      NODE_ENV: 'test',
      DISABLE_SELF_MUTATION: '1',
    }),
    encoding: 'utf8',
  });
  return {
    item,
    code: r.status == null ? 1 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function main() {
  const matrix = process.env.NODE_COMPAT_MATRIX || process.versions.node.split('.')[0];
  console.log('[compat-truth] CTOS/1.0 preflight · node=' + process.versions.node
    + ' · matrix=' + matrix);
  console.log('[compat-truth] These failures are NOT Node ABI breaks — they are named contracts.\n');

  const failures = [];
  for (const item of SUITE) {
    process.stdout.write('[compat-truth] → ' + item.class + ' · ' + item.file + ' … ');
    const out = runOne(item);
    if (out.code === 0) {
      console.log('ok');
      continue;
    }
    console.log('FAIL');
    failures.push(out);
    if (out.stdout) process.stdout.write(out.stdout);
    if (out.stderr) process.stderr.write(out.stderr);
  }

  if (!failures.length) {
    console.log('\n[compat-truth] ✅ all classified contracts green — safe to run full suite');
    process.exit(0);
  }

  console.error('\n════════════════════════════════════════════════════════════');
  console.error('COMPAT_TRUTH FAILURE — not a Node ' + matrix + ' ABI / runtime break');
  console.error('════════════════════════════════════════════════════════════');
  for (const f of failures) {
    console.error('  class=' + f.item.class);
    console.error('  title=' + f.item.title);
    console.error('  file=' + f.item.file);
    console.error('  fix: resolve the contract above, then re-run Node Compatibility Matrix');
    console.error('');
    // GitHub Actions annotation (shows on the job summary / PR checks UI).
    console.error('::error title=COMPAT_TRUTH ' + f.item.class + '::'
      + f.item.title + ' (' + f.item.file + ') — NOT a Node '
      + matrix + ' compatibility/ABI failure');
  }
  process.exit(1);
}

main();
