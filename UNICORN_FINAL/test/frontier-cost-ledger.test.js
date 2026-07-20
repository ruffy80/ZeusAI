'use strict';

// frontier-cost-ledger.test.js
// Verifies the Frontier AI kill-switch + persistent cost ledger + soft
// daily cap wired into backend/modules/frontierAI.js:
//   • execute() is refused when FRONTIER_AI_EXECUTE !== '1' (default).
//   • recommend()/route()/tick()/getStatus() are unaffected by the switch.
//   • recordUsage({ costUsd }) accumulates into the persistent ledger and
//     the per-UTC-day budget.
//   • FRONTIER_AI_MAX_DAILY_USD refuses over-budget execute() calls.
//   • The persisted state file (data/frontier-ai/state.json) is real —
//     a second require() sees the accumulated numbers.
// RO: verifica kill-switch + ledger + plafon zilnic.

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const MOD_PATH = require.resolve('../backend/modules/frontierAI');
const STATE_FILE = path.join(path.dirname(MOD_PATH), '..', '..', 'data', 'frontier-ai', 'state.json');

function freshLoad() {
  delete require.cache[MOD_PATH];
  try { fs.unlinkSync(STATE_FILE); } catch (_) { /* fresh */ }
  return require(MOD_PATH);
}

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('✓', name); passed++; }
  catch (e) { console.error('✗', name, '\n  ', e && e.stack ? e.stack : e); process.exit(1); }
}

(function killSwitchDefaultOff() {
  delete process.env.FRONTIER_AI_EXECUTE;
  delete process.env.FRONTIER_AI_MAX_DAILY_USD;
  const m = freshLoad();
  check('getStatus exposes killSwitch off by default', () => {
    const st = m.getStatus();
    assert.strictEqual(st.killSwitch.executeEnabled, false, 'kill switch should be OFF by default');
    assert.strictEqual(st.killSwitch.dailyCapUsd, null, 'no cap set by default');
    assert.ok(st.ledger && typeof st.ledger.totalCostUsd === 'number');
    assert.ok(st.dailyBudget && typeof st.dailyBudget.spentUsd === 'number');
  });
  check('execute() is refused when kill-switch is off', () => {
    const r = m.execute({ provider: 'openai', model: 'gpt-4o', estCostUsd: 0.02, domain: 'reasoning' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.reason, 'FRONTIER_AI_EXECUTE_disabled');
    const st = m.getStatus();
    assert.ok(st.dailyBudget.blocked >= 1, 'blocked counter increments');
  });
  check('recommend()/tick() still work while execute is gated', () => {
    process.env.OPENAI_API_KEY = 'sk-test-frontier-' + Date.now();
    const rec = m.recommend({ domain: 'reasoning' });
    assert.strictEqual(rec.ok, true);
    assert.ok(rec.provider);
    const t = m.tick();
    assert.strictEqual(t.ok, true);
    assert.ok(typeof t.score === 'number' && t.score >= 0);
    delete process.env.OPENAI_API_KEY;
  });
})();

(function dailyCapBlocks() {
  process.env.FRONTIER_AI_EXECUTE = '1';
  process.env.FRONTIER_AI_MAX_DAILY_USD = '0.01';
  const m = freshLoad();
  check('execute() is refused when estCostUsd exceeds the daily cap', () => {
    const r = m.execute({ provider: 'openai', model: 'gpt-4o', estCostUsd: 0.02 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'daily_cap_exceeded');
    assert.strictEqual(r.dailyBudget.capUsd, 0.01);
  });
  check('execute() succeeds when within the cap', () => {
    const r2 = m.execute({ provider: 'openai', estCostUsd: 0.005 });
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.allowed, true);
  });
})();

(function ledgerAccumulates() {
  process.env.FRONTIER_AI_EXECUTE = '1';
  process.env.FRONTIER_AI_MAX_DAILY_USD = '10';
  const m = freshLoad();
  check('recordUsage() accumulates cost into the ledger + daily budget', () => {
    m.recordUsage({ provider: 'openai', costUsd: 0.019, latencyMs: 220, ok: true, domain: 'reasoning' });
    m.recordUsage({ provider: 'anthropic', costUsd: 0.048, latencyMs: 310, ok: true, domain: 'reasoning' });
    const st = m.getStatus();
    // Both providers must be recorded with their respective costs.
    assert.ok(st.ledger.byProvider.openai, 'openai present in ledger');
    assert.ok(st.ledger.byProvider.anthropic, 'anthropic present in ledger');
    assert.ok(st.ledger.byProvider.openai.costUsd >= 0.019 - 1e-6);
    assert.ok(st.ledger.byProvider.anthropic.costUsd >= 0.048 - 1e-6);
    assert.ok(st.ledger.totalCostUsd >= 0.067 - 1e-6, 'total accumulates');
    assert.strictEqual(st.dailyBudget.calls, 2);
  });
  check('ledger state is persisted to disk', () => {
    assert.ok(fs.existsSync(STATE_FILE), 'state.json must exist after recordUsage');
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    assert.ok(raw.ledger && raw.ledger.totalCostUsd >= 0.067 - 1e-6);
    assert.ok(raw.dailyBudget && raw.dailyBudget.day);
  });
  check('runAction("execute") + runAction("ledger") action dispatch', async () => {
    const p = await m.process({ action: 'ledger' });
    assert.strictEqual(p.ok, true);
    assert.ok(p.ledger && p.ledger.totalCostUsd >= 0.067 - 1e-6);
    const e = await m.process({ action: 'execute', provider: 'openai', estCostUsd: 0.001 });
    assert.strictEqual(e.ok, true);
    assert.strictEqual(e.allowed, true);
  });
})();

console.log('\n✅ frontier-cost-ledger:', passed, 'tests passed');
process.exit(0);
