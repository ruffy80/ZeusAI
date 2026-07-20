#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = 'test';
process.env.ZEUS_CVR_DISABLED = '0';
process.env.ZEUS_CVR_SILENCE = '0';
process.env.OUTBOUND_DRY_RUN = '1';
process.env.ZEUS_CVR_DATA_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'cvr-'));

const assert = require('assert');
const cvr = require('../backend/modules/growthCausalitySentinel');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('✓', name);
}

(async () => {
  await check('scoreStages · infra + empty funnel', () => {
    const s = cvr._scoreStages(null, { ok: true }, { ok: true }, 3);
    assert.ok(s.infra >= 80);
    assert.ok(s.traffic < 50);
    assert.ok(s.monetize < 30);
  });

  await check('fingerprint stable', () => {
    assert.strictEqual(cvr._fingerprint('Hello'), cvr._fingerprint('hello'));
    assert.notStrictEqual(cvr._fingerprint('a'), cvr._fingerprint('b'));
  });

  await check('pickHypothesis returns hook + body', () => {
    const h = cvr.pickHypothesis({
      starvingStage: 'traffic',
      starvingScore: 20,
      catalogCount: 2,
      topServices: [{ name: 'Agent X', price: 49 }],
      siteOk: true,
      funnel: { windows: { last7d: { sessions: 1, checkoutStarts: 0, paid: 0 } } },
    });
    assert.ok(h.hookId);
    assert.ok(String(h.body).length > 20);
  });

  await check('shouldAct · silenced', () => {
    cvr.setSilenced(true);
    const g = cvr.shouldAct({ outboundReady: true, healthOk: true, siteOk: true, starvingScore: 10 });
    assert.strictEqual(g.act, false);
    cvr.setSilenced(false);
  });

  await check('shouldAct · telegram not ready', () => {
    const g = cvr.shouldAct({ outboundReady: false, healthOk: true, siteOk: true, starvingScore: 10 });
    assert.strictEqual(g.act, false);
    assert.strictEqual(g.reason, 'telegram_not_ready');
  });

  await check('shouldAct · hunger open when starving', () => {
    cvr._state.lastPostAt = 0;
    cvr._state.pending = null;
    cvr._state.postsToday = 0;
    cvr._state.postsDayKey = '';
    const g = cvr.shouldAct({
      outboundReady: true,
      healthOk: true,
      siteOk: true,
      starvingScore: 20,
    });
    assert.strictEqual(g.act, true);
  });

  await check('formatPulse readable', () => {
    const t = cvr.formatPulse({
      postsToday: 0,
      cadenceMs: 90 * 60_000,
      silenced: false,
      snapshot: {
        healthOk: true,
        siteOk: true,
        outboundReady: true,
        starvingStage: 'traffic',
        starvingScore: 22,
        catalogCount: 4,
        stages: { traffic: 22, monetize: 12 },
      },
    });
    assert.ok(/CVR pulse/.test(t));
    assert.ok(/traffic/.test(t));
  });

  await check('cycle dry-run completes', async () => {
    // No real telegram creds → gate telegram_not_ready or publish path skipped
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const st = await cvr.cycle();
    assert.strictEqual(st.ok, true);
    assert.ok(st.lastCycle);
  });

  console.log('\n✅ growth-causality-sentinel:', passed, 'tests passed');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
