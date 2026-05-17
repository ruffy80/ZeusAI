/**
 * DeepSeek Autopilot Tick — unit tests.
 *
 * Exercises the CI-side single-tick runner in `scripts/deepseek-autopilot-tick.js`
 * without ever hitting an external LLM endpoint. All recommendations come from
 * the DEEPSEEK_AUTOPILOT_MOCK_RESPONSE env hook so the test is deterministic.
 *
 * Verifies:
 *   1. Missing provider key → graceful skip (no throw, no diff).
 *   2. `code_proposal` mock → envelope JSON written under PROPOSALS_DIR.
 *   3. `roadmap_update` mock → objective status flipped + roadmap.updatedAt bumped.
 *   4. Path-deny mock (targeting .github/) → governor rejects, no envelope.
 *   5. `none` action → no diff, summary skipped=true.
 *   6. Non-allowlisted action → skipped with reason='action_not_allowed'.
 */
'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

process.env.NODE_ENV = 'test';

// Isolate governor state to a per-run tmp dir so we never touch real repo data.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-autopilot-tick-'));
process.env.DEEPSEEK_GOVERNOR_PROPOSALS_DIR    = path.join(tmpRoot, 'proposals');
process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH     = path.join(tmpRoot, 'roadmap.json');
process.env.DEEPSEEK_GOVERNOR_COMMAND_QUEUE_PATH = path.join(tmpRoot, 'commands.jsonl');
process.env.DEEPSEEK_GOVERNOR_LOG_PATH         = path.join(tmpRoot, 'governor.log');
process.env.DEEPSEEK_AUTOPILOT_ERROR_LOG       = path.join(tmpRoot, 'no-such-error-log.log');

// Seed a minimal roadmap so the digest builder has something to read.
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

// Strip any inherited provider keys so the no-key branch is deterministic.
delete process.env.DEEPSEEK_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.GROQ_API_KEY;

const { runTick } = require('../scripts/deepseek-autopilot-tick');

function setMock(obj) {
  process.env.DEEPSEEK_AUTOPILOT_MOCK_RESPONSE = JSON.stringify(obj);
}
function clearMock() { delete process.env.DEEPSEEK_AUTOPILOT_MOCK_RESPONSE; }

function listProposals() {
  try {
    return fs.readdirSync(process.env.DEEPSEEK_GOVERNOR_PROPOSALS_DIR)
      .filter(f => f.endsWith('.json'));
  } catch (_) { return []; }
}

async function runTests() {
  let passed = 0;

  // ---- Test 1: no provider key + no mock → graceful skip --------------
  clearMock();
  let r = await runTick();
  assert.strictEqual(r.skipped, true, 'no-key should skip');
  assert.strictEqual(r.reason, 'no_provider_key', 'no-key reason should match');
  assert.strictEqual(listProposals().length, 0, 'no envelope written on no-key');
  passed++;

  // ---- Test 2: code_proposal mock → envelope written ------------------
  setMock({
    action: 'code_proposal',
    params: {
      targetPath: 'UNICORN_FINAL/src/site/example-page.js',
      proposedContent: '// example proposed content for unit test\nmodule.exports = {};\n',
      rationale: 'Unit test fixture proposal — verifies envelope flow end-to-end.',
      objectiveId: 'obj-a',
      riskLevel: 'low',
    },
    reason: 'fixture: code_proposal path',
  });
  r = await runTick();
  assert.strictEqual(r.skipped, false, 'code_proposal should not skip');
  assert.strictEqual(r.action, 'code_proposal');
  assert.strictEqual(r.governorStatus, 200, 'governor must accept valid proposal');
  assert.strictEqual(r.governorBody && r.governorBody.ok, true);
  const props = listProposals();
  assert.strictEqual(props.length, 1, 'exactly one envelope on disk');
  const env = JSON.parse(fs.readFileSync(
    path.join(process.env.DEEPSEEK_GOVERNOR_PROPOSALS_DIR, props[0]), 'utf8'));
  assert.strictEqual(env.targetPath, 'UNICORN_FINAL/src/site/example-page.js');
  assert.strictEqual(env.objectiveId, 'obj-a');
  assert.strictEqual(env.status, 'pending-review');
  passed++;

  // ---- Test 3: roadmap_update mock → status flipped -------------------
  setMock({
    action: 'roadmap_update',
    params: { objectiveId: 'obj-b', status: 'in-progress', note: 'auto-promoted by autopilot' },
    reason: 'fixture: roadmap_update path',
  });
  r = await runTick();
  assert.strictEqual(r.skipped, false);
  assert.strictEqual(r.governorStatus, 200);
  const rmap = JSON.parse(fs.readFileSync(process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH, 'utf8'));
  const objB = rmap.objectives.find(o => o.id === 'obj-b');
  assert.strictEqual(objB.status, 'in-progress', 'obj-b status flipped');
  assert.strictEqual(objB.lastNote, 'auto-promoted by autopilot', 'lastNote persisted');
  passed++;

  // ---- Test 4: deny-listed target path → governor rejects -------------
  const proposalsBefore = listProposals().length;
  setMock({
    action: 'code_proposal',
    params: {
      targetPath: '.github/workflows/deploy.yml',
      proposedContent: 'name: malicious\n',
      rationale: 'attempt to write into .github/',
      objectiveId: 'obj-a',
      riskLevel: 'low',
    },
    reason: 'fixture: deny-prefix test',
  });
  r = await runTick();
  assert.strictEqual(r.skipped, false, 'should reach dispatch');
  assert.strictEqual(r.governorStatus, 422, 'governor rejects deny-prefix with 422');
  assert.strictEqual(r.governorBody && r.governorBody.ok, false);
  assert.strictEqual(listProposals().length, proposalsBefore, 'no new envelope written');
  passed++;

  // ---- Test 5: `none` action → skipped (non-write) --------------------
  setMock({ action: 'none', reason: 'all green' });
  r = await runTick();
  assert.strictEqual(r.skipped, true);
  assert.strictEqual(r.reason, 'non_write_action');
  assert.strictEqual(r.action, 'none');
  passed++;

  // ---- Test 6: action outside allowlist → skipped with reason ---------
  setMock({ action: 'arbitrary_unsafe_exec', params: { cmd: 'rm -rf /' }, reason: 'should not run' });
  r = await runTick();
  assert.strictEqual(r.skipped, true);
  assert.strictEqual(r.reason, 'action_not_allowed');
  passed++;

  // ---- Test 7: malformed mock JSON → skipped without throwing ---------
  process.env.DEEPSEEK_AUTOPILOT_MOCK_RESPONSE = '{"action":';
  r = await runTick();
  assert.strictEqual(r.skipped, true);
  assert.strictEqual(r.reason, 'recommendation_failed');
  passed++;

  clearMock();
  console.log('✅ deepseek-autopilot-tick: ' + passed + ' tests passed');
}

runTests().catch((e) => {
  console.error('❌ deepseek-autopilot-tick test failure:', e);
  process.exit(1);
});
