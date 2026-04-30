/**
 * site-stability-guard.test.js — static regression guard for the two
 * stability bugs that took zeusai.pro down on 2026-04-29 / 2026-04-30.
 *
 * Strictly additive · read-only on production code paths.
 *
 * Bugs we never want to re-introduce:
 *   1. Global `app.use(express.json())` in UNICORN_FINAL/src/index.js.
 *      The express stub there falls through to `unicornHandler` (which
 *      reads raw req via `req.on('data')`/`req.on('end')`) for hundreds
 *      of /api/* routes the stub does not own. A global json() consumes
 *      the body for every POST/PUT/DELETE, so the fall-through hangs
 *      forever, the test process never exits, and CI cancels at 6h →
 *      no deploy → live stack drifts → nginx 502.
 *      Fix (PR #413): use `express.json()` per-route on the 4 POSTs that
 *      actually need parsed body. This test enforces that fix.
 *
 *   2. Production-loading tests that do NOT explicitly `process.exit(0)`
 *      after success. src/index.js starts long-lived setIntervals
 *      (predictive-scaler, orchestrators, watchdogs, mesh) — even with
 *      `.unref()`, any single forgotten unref keeps the loop alive and
 *      the test hangs forever. Same blast radius as bug #1.
 *      This test enforces that every test file under test/ that loads
 *      ../src/index calls `process.exit(0)` somewhere on the success
 *      path.
 *
 * Both checks are static (no boot, no network), so this test is fast,
 * deterministic, and safe to run in every CI lane.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO_SRC_INDEX = path.join(__dirname, '..', 'src', 'index.js');
const TEST_DIR = __dirname;

// ---------- check 1 ----------
const srcIndex = fs.readFileSync(REPO_SRC_INDEX, 'utf8');

// Match `app.use(express.json(...))` and `app.use(bodyParser.json(...))`
// at the start of a line (allowing leading whitespace). Per-route forms
// like `app.post('/x', express.json(), handler)` are intentionally not
// matched — those are the safe fix.
const GLOBAL_BODY_PARSER_RE = /^\s*app\s*\.\s*use\s*\(\s*(?:express|bodyParser)\s*\.\s*json\s*\(/m;

assert.ok(
  !GLOBAL_BODY_PARSER_RE.test(srcIndex),
  'REGRESSION: global app.use(express.json()) found in UNICORN_FINAL/src/index.js. ' +
  'This bug took the site down on 2026-04-29 (CI hung 6h on npm test → no deploy → 502). ' +
  'Use per-route express.json() on the specific POSTs that need a parsed body, ' +
  'so the express stub keeps falling through to unicornHandler for the routes it does not own.'
);

// ---------- check 2 ----------
const testFiles = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.js'));
const offenders = [];
for (const f of testFiles) {
  const full = path.join(TEST_DIR, f);
  const body = fs.readFileSync(full, 'utf8');
  // Skip this file (we explicitly assert success here, no production server).
  if (f === 'site-stability-guard.test.js') continue;
  // Only enforce on tests that actually load the production server.
  const loadsServer = /require\(\s*['"][^'"]*src\/index['"]\s*\)/.test(body)
                   || /require\(\s*['"][^'"]*\.\.\/src\/index['"]\s*\)/.test(body);
  if (!loadsServer) continue;
  // Must call process.exit(0) on the success path. We accept any literal
  // `process.exit(0)` occurrence — every existing offender today uses that
  // exact form, and stricter parsing would be brittle for marginal benefit.
  const hasExitZero = /process\.exit\s*\(\s*0\s*\)/.test(body);
  if (!hasExitZero) offenders.push(f);
}

assert.deepStrictEqual(
  offenders,
  [],
  'REGRESSION: the following test files load src/index.js but never call ' +
  'process.exit(0) on success: ' + offenders.join(', ') + '. ' +
  'src/index.js starts long-lived intervals — without an explicit exit the ' +
  'test hangs forever and the CI deploy step times out at 6h. Add ' +
  'process.exit(0) at the end of run().then(...) (see test/health.test.js).'
);

console.log('site-stability-guard.test.js passed (no global json() in src/index.js, ' + testFiles.length + ' test files scanned, all server-loading tests have process.exit(0))');
process.exit(0);
