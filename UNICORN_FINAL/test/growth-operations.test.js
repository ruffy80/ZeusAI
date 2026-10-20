'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TRAFFIC_ENGINE_DISABLED = '1';
process.env.GROWTH_STACK_DISABLED = '1';
delete process.env.GROWTH_DRAFT_DIR;
delete process.env.GROWTH_EMERGENCY_STOP;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
delete process.env.GOOGLE_SITE_VERIFICATION;
delete process.env.GOOGLE_SITE_VERIFICATION_META;
delete process.env.GOOGLE_SITE_VERIFICATION_TOKEN;
delete process.env.GSC_HTML_TOKEN;
delete process.env.BING_WEBMASTER_API_KEY;
delete process.env.RESEND_API_KEY;

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const draftLog = path.join(os.tmpdir(), 'gdo-brain-' + process.pid + '.jsonl');
process.env.GROWTH_BRAIN_LOG = draftLog;

const agent = require('../backend/modules/growth-agent');
const brain = require('../backend/modules/growth-brain');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gdo-'));
}

check('public status does not write a draft', () => {
  const dir = tempDir();
  const before = fs.readdirSync(dir);
  const out = agent.tick({ dryRun: true, source: 'manual' });
  assert.strictEqual(out.published, false);
  assert.strictEqual(out.persistsOnPublicGet, false);
  assert.strictEqual(out.scheduled, undefined);
  assert.deepStrictEqual(fs.readdirSync(dir), before);
  const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  const backend = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
  assert.ok(site.includes("g.tick({ dryRun: true, source: 'manual' })"));
  assert.ok(backend.includes("g.tick({ dryRun: true, source: 'manual' })"));
});

check('a verified page becomes an unpublished draft file', () => {
  const dir = tempDir();
  const brief = agent.briefs()[0];
  const draft = agent.draftArticle(brief);
  assert.strictEqual(draft.published, false);
  assert.strictEqual(draft.modelCalled, false);
  assert.strictEqual(draft.seo.titleOk, true);
  assert.strictEqual(draft.seo.descriptionOk, true);
  assert.strictEqual(draft.seo.internalLink, true);
  const saved = agent.record(draft, { dir });
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(saved.published, false);
  const file = path.join(dir, saved.slug + '.json');
  assert.ok(file.startsWith(dir + path.sep));
  const body = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(body.status, 'draft');
  assert.strictEqual(body.published, false);
  assert.strictEqual(body.createdNewUrl, false);
  assert.ok(body.markdown.includes('](/'));
  assert.ok(!/testimonial|5 stars|customer said/i.test(body.markdown));
});

check('seo health reports index status as unavailable', () => {
  const health = agent.seoHealth();
  assert.strictEqual(health.inventsIndexed, false);
  assert.strictEqual(health.inventsRankings, false);
  assert.strictEqual(health.inventsSearchVolume, false);
  assert.strictEqual(health.googleIndexed.status, 'unavailable');
  assert.strictEqual(health.googleIndexed.value, null);
  assert.strictEqual(health.searchConsole.status, 'blocked');
  assert.ok(String(health.searchConsole.secret).includes('GOOGLE_SERVICE_ACCOUNT_JSON'));
  assert.ok(health.points.some((p) => p.key === 'sitemap' && p.closed === true));
});

check('missing analytics stay unavailable and a recorded zero stays zero', () => {
  const empty = agent.analyticsReport(null);
  assert.strictEqual(empty.inventsVisits, false);
  assert.strictEqual(empty.inventsRevenue, false);
  assert.strictEqual(empty.metrics.visits.status, 'unavailable');
  assert.strictEqual(empty.metrics.visits.value, null);
  assert.strictEqual(empty.metrics.organicImpressions.status, 'unavailable');
  assert.strictEqual(empty.metrics.revenueUsd.value, null);
  const measured = agent.analyticsReport({
    source: 'fixture',
    measurements: { visits: 0, purchases: 2 },
  });
  assert.strictEqual(measured.metrics.visits.status, 'measured');
  assert.strictEqual(measured.metrics.visits.value, 0);
  assert.strictEqual(measured.metrics.purchases.status, 'measured');
  assert.strictEqual(measured.metrics.purchases.value, 2);
  assert.strictEqual(measured.metrics.organicClicks.status, 'unavailable');
  const status = agent.tick({ dryRun: true });
  assert.strictEqual(status.analytics.metrics.visits.status, 'unavailable');
  assert.strictEqual(status.analytics.metrics.visits.value, null);
});

check('the growth brain runs one draft task and keeps its history', () => {
  const dir = tempDir();
  process.env.GROWTH_DRAFT_DIR = dir;
  const first = agent.runScheduled({ source: 'scheduled', dir });
  const second = agent.runScheduled({ source: 'scheduled', dir });
  assert.strictEqual(first.executed, true);
  assert.strictEqual(first.published, false);
  assert.strictEqual(first.indexNowPinged, false);
  assert.strictEqual(second.executed, true);
  assert.notStrictEqual(first.id, second.id);
  const rows = agent.history({ dir });
  assert.strictEqual(rows.length, 2);
  rows.forEach((row) => {
    assert.strictEqual(row.published, false);
    assert.strictEqual(row.createdNewUrl, false);
    assert.strictEqual(row.modelCalled, false);
  });
  fs.writeFileSync(path.join(dir, 'STOP'), 'stop');
  const halted = agent.runScheduled({ source: 'scheduled', dir });
  assert.strictEqual(halted.blocked, true);
  assert.strictEqual(halted.reason, 'emergency_stop');
  assert.strictEqual(halted.published, false);
  assert.strictEqual(agent.history({ dir }).length, 2);
  delete process.env.GROWTH_DRAFT_DIR;
});

check('an unapproved or unconfigured external action is blocked', () => {
  const denied = agent.externalAction({ kind: 'search_console_submit' });
  assert.strictEqual(denied.blocked, true);
  assert.strictEqual(denied.executed, false);
  assert.strictEqual(denied.reason, 'approval_required');
  const missing = agent.externalAction({ kind: 'search_console_submit', approved: true });
  assert.strictEqual(missing.blocked, true);
  assert.strictEqual(missing.executed, false);
  assert.strictEqual(missing.reason, 'secret_missing');
  assert.strictEqual(missing.secret, 'GOOGLE_SERVICE_ACCOUNT_JSON');
  const directory = agent.externalAction({ kind: 'directory_submit', approved: true });
  assert.strictEqual(directory.reason, 'no_verified_directory_api');
  assert.strictEqual(directory.executed, false);
  const ping = agent.externalAction({ kind: 'indexnow_ping', approved: true });
  assert.strictEqual(ping.reason, 'not_authorized_for_growth_agent');
  assert.strictEqual(ping.executed, false);
});

check('operator copy no longer sends people to a single $39 offer', () => {
  const desk = require('../backend/modules/seo-viral-desk').desk();
  assert.ok(desk.nextHumanAction.includes('/pricing'));
  assert.ok(/BING_WEBMASTER_API_KEY|GOOGLE_SERVICE_ACCOUNT_JSON|\/relay/.test(desk.nextHumanAction));
  assert.ok(!desk.nextHumanAction.includes('$39'));
  const state = brain.observe();
  const actions = brain.plan(state, brain.think(state));
  const text = JSON.stringify(actions);
  assert.ok(actions.some((a) => a.id === 'record-growth-drafts' && a.mode === 'auto'));
  assert.ok(!text.includes('300+'));
  assert.ok(!text.includes('loses most buyers'));
  assert.ok(!text.includes('$39'));
  assert.ok(text.includes('Social posting stays optional'));
});

async function brainCycle() {
  const dir = tempDir();
  process.env.GROWTH_DRAFT_DIR = dir;
  const cycle = await brain.runCycle();
  const draft = cycle.autoPerformed.find((row) => row.id === 'record-growth-drafts');
  assert.ok(draft, 'growth brain performed the draft task');
  assert.strictEqual(draft.result.published, false);
  assert.strictEqual(draft.result.saved, true);
  const rows = agent.history({ dir });
  assert.ok(rows.length >= 1);
  assert.strictEqual(rows[rows.length - 1].source, 'growth-brain');
  assert.strictEqual(rows[rows.length - 1].published, false);
  delete process.env.GROWTH_DRAFT_DIR;
  passed += 1;
  console.log('  ✓', 'growth-brain cycle records the draft task');
}

brainCycle().then(() => {
  console.log('growth-operations: ' + passed + ' checks passed');
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
