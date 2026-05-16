/**
 * DeepSeek autonomous mode regression — unit tests.
 *
 * Covers the new self-contained extensions to backend/modules/deepseek-governor.js:
 *   1. code_proposal: writes envelope to PROPOSALS_DIR, enforces deny-list on
 *      .github/, deepseek-governor.js, deepseek-loop.js, package.json, .env
 *      and substring deny (secret/token/...). Enforces extension allowlist and
 *      size cap.
 *   2. roadmap_update: rejects unknown objective IDs and invalid statuses.
 *      Persists status changes back to roadmap.json.
 *   3. Operator command queue: enqueue → list → consumeNext (FIFO with priority).
 *   4. Enriched read_status: includes roadmap.topPriorityOpen + autonomy block.
 *
 * Pure module test — does NOT boot the Express server. NODE_ENV=test disables
 * the IP rate limiter in the governor.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.NODE_ENV = 'test';

// Redirect governor state to a per-run tmp dir so we never touch the real
// data/ directory and tests are fully isolated.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-autonomy-'));
process.env.DEEPSEEK_GOVERNOR_PROPOSALS_DIR = path.join(tmpRoot, 'proposals');
process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH = path.join(tmpRoot, 'roadmap.json');
process.env.DEEPSEEK_GOVERNOR_COMMAND_QUEUE_PATH = path.join(tmpRoot, 'commands.jsonl');
process.env.DEEPSEEK_GOVERNOR_LOG_PATH = path.join(tmpRoot, 'governor.log');

// Seed a small roadmap fixture.
fs.writeFileSync(process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH, JSON.stringify({
  schemaVersion: 1,
  vision: 'test vision',
  northStarMetric: 'MRR_USD',
  currentPhase: 'bootstrap',
  objectives: [
    { id: 'obj-a', title: 'Objective A', priority: 1, status: 'in-progress' },
    { id: 'obj-b', title: 'Objective B', priority: 2, status: 'pending' },
    { id: 'obj-c', title: 'Objective C', priority: 3, status: 'done' },
  ],
}, null, 2));

const governor = require('../backend/modules/deepseek-governor');

async function runAct(action, params, requestId) {
  return governor.dispatch({
    action,
    params: params || {},
    requestId: requestId || ('test-' + Math.random().toString(36).slice(2, 8)),
    actor: 'test',
    ip: '127.0.0.1',
  });
}

async function runTests() {
  let passed = 0;
  const fail = (msg) => { throw new Error('ASSERT FAIL: ' + msg); };

  // ---- 1. ALLOWED_ACTIONS now contains code_proposal + roadmap_update ----
  assert.ok(governor.ALLOWED_ACTIONS.includes('code_proposal'), 'allowlist must contain code_proposal');
  assert.ok(governor.ALLOWED_ACTIONS.includes('roadmap_update'), 'allowlist must contain roadmap_update');
  passed++;

  // ---- 2. code_proposal happy path writes envelope ----
  governor._resetForTests();
  const happy = await runAct('code_proposal', {
    objectiveId: 'obj-a',
    targetPath: 'UNICORN_FINAL/src/site/v2/client.js',
    proposedContent: '// improved client code\n',
    rationale: 'speed up hydration of catalog cards',
    riskLevel: 'low',
  });
  assert.strictEqual(happy.status, 200, 'code_proposal happy path must succeed');
  assert.ok(happy.body.proposalId && happy.body.proposalId.endsWith('.json'), 'must return proposalId');
  const writtenPath = path.join(process.env.DEEPSEEK_GOVERNOR_PROPOSALS_DIR, happy.body.proposalId);
  assert.ok(fs.existsSync(writtenPath), 'proposal file must be written to PROPOSALS_DIR');
  const envelope = JSON.parse(fs.readFileSync(writtenPath, 'utf8'));
  assert.strictEqual(envelope.status, 'pending-review');
  assert.strictEqual(envelope.targetPath, 'UNICORN_FINAL/src/site/v2/client.js');
  assert.strictEqual(envelope.objectiveId, 'obj-a');
  assert.strictEqual(envelope.riskLevel, 'low');
  passed++;

  // ---- 3. code_proposal MUST refuse to touch .github/ workflows ----
  const denyGithub = await runAct('code_proposal', {
    targetPath: '.github/workflows/deploy.yml',
    proposedContent: 'malicious: true',
    rationale: 'attempt to weaken CI',
    riskLevel: 'high',
  });
  assert.strictEqual(denyGithub.status, 422);
  assert.strictEqual(denyGithub.body.reason, 'target_prefix_denied');
  passed++;

  // ---- 4. code_proposal MUST refuse to modify the governor itself ----
  const denyGov = await runAct('code_proposal', {
    targetPath: 'UNICORN_FINAL/backend/modules/deepseek-governor.js',
    proposedContent: '// self-modification attempt',
    rationale: 'self-modify',
    riskLevel: 'high',
  });
  assert.strictEqual(denyGov.status, 422);
  assert.strictEqual(denyGov.body.reason, 'target_suffix_denied');
  passed++;

  // ---- 5. code_proposal MUST refuse the loop script itself ----
  const denyLoop = await runAct('code_proposal', {
    targetPath: 'UNICORN_FINAL/scripts/deepseek-loop.js',
    proposedContent: '// attempt',
    rationale: 'self-modify-loop',
    riskLevel: 'high',
  });
  assert.strictEqual(denyLoop.status, 422);
  assert.strictEqual(denyLoop.body.reason, 'target_suffix_denied');
  passed++;

  // ---- 6. code_proposal MUST refuse package.json ----
  const denyPkg = await runAct('code_proposal', {
    targetPath: 'UNICORN_FINAL/package.json',
    proposedContent: '{"dependencies":{}}',
    rationale: 'add dep',
    riskLevel: 'high',
  });
  assert.strictEqual(denyPkg.status, 422);
  assert.strictEqual(denyPkg.body.reason, 'target_suffix_denied');
  passed++;

  // ---- 7. code_proposal MUST refuse path traversal ----
  const denyTrav = await runAct('code_proposal', {
    targetPath: '../../../etc/passwd',
    proposedContent: 'x',
    rationale: 'escape',
    riskLevel: 'high',
  });
  assert.strictEqual(denyTrav.status, 422);
  assert.ok(['path_traversal', 'extension_not_allowed', 'target_must_be_relative'].includes(denyTrav.body.reason),
    'must reject traversal, got: ' + denyTrav.body.reason);
  passed++;

  // ---- 8. code_proposal MUST refuse absolute paths ----
  const denyAbs = await runAct('code_proposal', {
    targetPath: '/etc/hosts',
    proposedContent: 'x',
    rationale: 'absolute path',
    riskLevel: 'high',
  });
  assert.strictEqual(denyAbs.status, 422);
  assert.strictEqual(denyAbs.body.reason, 'target_must_be_relative');
  passed++;

  // ---- 9. code_proposal MUST refuse secret-substring filenames ----
  const denySecret = await runAct('code_proposal', {
    targetPath: 'UNICORN_FINAL/src/secret-tokens.js',
    proposedContent: 'x',
    rationale: 'secret leak attempt',
    riskLevel: 'high',
  });
  assert.strictEqual(denySecret.status, 422);
  assert.strictEqual(denySecret.body.reason, 'name_denied');
  passed++;

  // ---- 10. code_proposal MUST refuse disallowed extension ----
  const denyExt = await runAct('code_proposal', {
    targetPath: 'UNICORN_FINAL/src/x.exe',
    proposedContent: 'x',
    rationale: 'binary attempt',
    riskLevel: 'high',
  });
  assert.strictEqual(denyExt.status, 422);
  assert.strictEqual(denyExt.body.reason, 'extension_not_allowed');
  passed++;

  // ---- 11. code_proposal MUST refuse oversized content ----
  const big = 'x'.repeat(40 * 1024); // > 32KB default
  const denyBig = await runAct('code_proposal', {
    targetPath: 'UNICORN_FINAL/src/big.js',
    proposedContent: big,
    rationale: 'oversized',
    riskLevel: 'low',
  });
  assert.strictEqual(denyBig.status, 422);
  assert.strictEqual(denyBig.body.reason, 'proposed_content_too_large');
  passed++;

  // ---- 12. code_proposal MUST refuse empty rationale ----
  const denyEmpty = await runAct('code_proposal', {
    targetPath: 'UNICORN_FINAL/src/y.js',
    proposedContent: 'x',
    rationale: '',
    riskLevel: 'low',
  });
  assert.strictEqual(denyEmpty.status, 422);
  assert.strictEqual(denyEmpty.body.reason, 'rationale_required');
  passed++;

  // ---- 13. code_proposal MUST refuse invalid risk level ----
  const denyRisk = await runAct('code_proposal', {
    targetPath: 'UNICORN_FINAL/src/y.js',
    proposedContent: 'x',
    rationale: 'r',
    riskLevel: 'catastrophic',
  });
  assert.strictEqual(denyRisk.status, 422);
  assert.strictEqual(denyRisk.body.reason, 'invalid_risk_level');
  passed++;

  // ---- 14. roadmap_update marks objective done ----
  const upd = await runAct('roadmap_update', {
    objectiveId: 'obj-b',
    status: 'done',
    note: 'completed via test',
  });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.body.status, 'done');
  const roadmap = JSON.parse(fs.readFileSync(process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH, 'utf8'));
  const objB = roadmap.objectives.find(o => o.id === 'obj-b');
  assert.strictEqual(objB.status, 'done');
  assert.strictEqual(objB.lastNote, 'completed via test');
  passed++;

  // ---- 15. roadmap_update rejects unknown objective ----
  const updMiss = await runAct('roadmap_update', { objectiveId: 'obj-nope', status: 'done' });
  assert.strictEqual(updMiss.status, 422);
  assert.strictEqual(updMiss.body.reason, 'objective_not_found');
  passed++;

  // ---- 16. roadmap_update rejects invalid status ----
  const updBad = await runAct('roadmap_update', { objectiveId: 'obj-a', status: 'shipped' });
  assert.strictEqual(updBad.status, 422);
  assert.strictEqual(updBad.body.reason, 'invalid_status');
  passed++;

  // ---- 17. enqueue + list + consume queue (priority order) ----
  // Ensure queue is empty first.
  try { fs.unlinkSync(process.env.DEEPSEEK_GOVERNOR_COMMAND_QUEUE_PATH); } catch (_) {}
  const e1 = governor.enqueueCommand({ instruction: 'low prio task', priority: 2, actor: 'op', ip: '127.0.0.1' });
  const e2 = governor.enqueueCommand({ instruction: 'urgent task', priority: 9, actor: 'op', ip: '127.0.0.1' });
  const e3 = governor.enqueueCommand({ instruction: 'mid task',   priority: 5, actor: 'op', ip: '127.0.0.1' });
  assert.ok(e1.ok && e2.ok && e3.ok, 'all enqueues must succeed');

  const listed = governor.listCommands({ limit: 10, includeConsumed: false });
  assert.strictEqual(listed.length, 3);
  assert.strictEqual(listed[0].priority, 9, 'list must be sorted by priority desc');

  const c1 = governor.consumeNextCommand();
  assert.strictEqual(c1.id, e2.id, 'must consume highest priority first');
  const c2 = governor.consumeNextCommand();
  assert.strictEqual(c2.id, e3.id, 'next is mid priority');
  const c3 = governor.consumeNextCommand();
  assert.strictEqual(c3.id, e1.id, 'last is low priority');
  const c4 = governor.consumeNextCommand();
  assert.strictEqual(c4, null, 'empty queue returns null');
  passed++;

  // ---- 18. enqueue rejects empty instruction ----
  const eBad = governor.enqueueCommand({ instruction: '   ', priority: 5, actor: 'op', ip: '127.0.0.1' });
  assert.strictEqual(eBad.ok, false);
  assert.strictEqual(eBad.reason, 'instruction_required');
  passed++;

  // ---- 19. read_status now surfaces roadmap + autonomy block ----
  const status = await runAct('read_status', {});
  assert.strictEqual(status.status, 200);
  assert.ok(status.body.roadmap, 'read_status must include roadmap');
  assert.strictEqual(status.body.roadmap.vision, 'test vision');
  assert.ok(Array.isArray(status.body.roadmap.topPriorityOpen));
  // obj-a is in-progress, obj-b just marked done, obj-c was already done
  // → topPriorityOpen should contain obj-a but NOT obj-b or obj-c
  const ids = status.body.roadmap.topPriorityOpen.map(o => o.id);
  assert.ok(ids.includes('obj-a'), 'obj-a (in-progress) must be in top open');
  assert.ok(!ids.includes('obj-b'), 'obj-b (now done) must NOT be in top open');
  assert.ok(!ids.includes('obj-c'), 'obj-c (done) must NOT be in top open');
  assert.ok(status.body.autonomy, 'read_status must include autonomy block');
  assert.strictEqual(typeof status.body.autonomy.proposalCount, 'number');
  passed++;

  // ---- 20. getStatus surfaces new limits + paths ----
  const gs = governor.getStatus();
  assert.ok(gs.limits.proposalMaxBytes > 0);
  assert.ok(gs.limits.commandQueueMaxEntries > 0);
  assert.ok(gs.paths.proposalsDir);
  assert.ok(gs.paths.roadmapPath);
  assert.ok(gs.paths.commandQueuePath);
  passed++;

  console.log('✔ deepseek-autonomous-mode: ' + passed + ' assertions passed');
}

runTests().catch((e) => {
  console.error('✘ deepseek-autonomous-mode failed:', e && e.stack || e);
  process.exit(1);
}).finally(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
});
