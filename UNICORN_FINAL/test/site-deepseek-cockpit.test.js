/**
 * site-deepseek-cockpit.test.js — static regression guard for the
 * /deepseek-cockpit operator console.
 *
 * Pins the contract that:
 *   1. The route /deepseek-cockpit renders an SSR HTML page (not 404).
 *   2. The page references the three admin endpoints the cockpit must show:
 *        - /api/admin/roadmap
 *        - /api/admin/deepseek/commands
 *        - /api/admin/deepseek/proposals
 *      plus the status endpoint /api/admin/deepseek/status and the
 *      command-queue POST /api/admin/deepseek/command.
 *   3. The token field is type=password and never embedded server-side
 *      (the SSR HTML must not contain a literal admin token value).
 *   4. A title and meta description exist for the route (SEO + UX).
 *   5. The page uses textContent for API-sourced strings (no string
 *      concatenation into innerHTML for proposal rationale / instruction
 *      / objective.title) — defensive against malicious envelope content.
 *   6. The roadmap.json keeps the `deepseek-autonomy-cockpit` objective
 *      and it is no longer `pending` (work has started).
 *
 * This is a static test — no server boot, no network — same shape as
 * test/site-filter-chips.test.js and test/site-stability-guard.test.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const shell = require('../src/site/v2/shell');
const roadmap = require('../data/roadmap.json');

(function testRouteRenders() {
  const html = shell.getHtml('/deepseek-cockpit');
  assert.ok(typeof html === 'string' && html.length > 500,
    '/deepseek-cockpit must render a non-trivial SSR HTML string');
  assert.ok(/DeepSeek Autonomy Cockpit/i.test(html),
    'cockpit must include its kicker/title');
  // Not a 404
  assert.ok(!/Page not found/i.test(html),
    '/deepseek-cockpit must not fall through to pageNotFound');
})();

(function testEndpointsReferenced() {
  const html = shell.getHtml('/deepseek-cockpit');
  const required = [
    '/api/admin/roadmap',
    '/api/admin/deepseek/status',
    '/api/admin/deepseek/commands',
    '/api/admin/deepseek/proposals',
    '/api/admin/deepseek/command'
  ];
  for (const url of required) {
    assert.ok(html.indexOf(url) !== -1,
      'cockpit SSR must reference ' + url);
  }
})();

(function testTokenIsPasswordAndNotEmbedded() {
  const html = shell.getHtml('/deepseek-cockpit');
  assert.ok(/id="dsToken"[^>]*type="password"/.test(html),
    'admin token field must be type=password');
  // Defensive — SSR HTML must never contain a literal admin token value.
  // (No env vars are read at render time, but we still pin the invariant.)
  assert.ok(!/DEEPSEEK_LOOP_ADMIN_TOKEN["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{8,}/.test(html),
    'SSR HTML must not embed a literal admin token');
})();

(function testRouteMetadata() {
  const html = shell.getHtml('/deepseek-cockpit');
  // <title>…DeepSeek Autonomy Cockpit…</title>
  assert.ok(/<title>[^<]*DeepSeek Autonomy Cockpit[^<]*<\/title>/i.test(html),
    'route title for /deepseek-cockpit must be set in routeTitle()');
  // Meta description present (the cockpit description we added)
  assert.ok(/admin-only DeepSeek autonomy cockpit/i.test(html),
    'meta description for /deepseek-cockpit must be set in routeDescription()');
})();

(function testSafeRenderingForApiData() {
  // We expect the cockpit script to build DOM with createElement+textContent
  // for fields sourced from the governor (rationale, instruction, titles).
  // Heuristic: the page must call createElement and must NOT concatenate
  // those fields into innerHTML.
  const file = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'v2', 'shell.js'), 'utf8');
  const start = file.indexOf('function pageDeepseekCockpit');
  const end = file.indexOf('function renderRoute', start);
  assert.ok(start > 0 && end > start, 'pageDeepseekCockpit must exist');
  const body = file.slice(start, end);
  assert.ok(body.indexOf('document.createElement') !== -1
    || body.indexOf("el('") !== -1
    || body.indexOf('el("') !== -1,
    'cockpit must build DOM via createElement helper for safety');
  // No innerHTML concatenation that mixes API-derived field names.
  const dangerousPatterns = [
    /innerHTML\s*=\s*[`'"][^`'"]*\$\{[^}]*\.rationale/,
    /innerHTML\s*=\s*[`'"][^`'"]*\$\{[^}]*\.instruction/,
    /innerHTML\s*\+=\s*[^;]*\.rationale/,
    /innerHTML\s*\+=\s*[^;]*\.instruction/
  ];
  for (const re of dangerousPatterns) {
    assert.ok(!re.test(body),
      'cockpit must not concat API-sourced fields (rationale/instruction) into innerHTML: ' + re);
  }
})();

(function testRoadmapObjectiveAdvanced() {
  assert.ok(Array.isArray(roadmap.objectives), 'roadmap must have objectives[]');
  const obj = roadmap.objectives.find(o => o && o.id === 'deepseek-autonomy-cockpit');
  assert.ok(obj, 'roadmap must keep the deepseek-autonomy-cockpit objective');
  assert.notStrictEqual(obj.status, 'pending',
    'deepseek-autonomy-cockpit must no longer be pending once the cockpit ships');
})();

console.log('site-deepseek-cockpit.test.js: OK');
