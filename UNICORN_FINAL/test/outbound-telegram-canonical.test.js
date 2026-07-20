'use strict';

// outbound-telegram-canonical.test.js
//
// Verifies backend/modules/marketing-innovations/outbound-publisher.js:
//   • Honours the canonical TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID pair
//     used across ZeusAI (socialMediaViralizer, zacAlertChannel, …).
//   • Falls back to the legacy TG_BOT_TOKEN + TG_CHAT_ID pair so existing
//     deployments do not break.
//   • Never fakes a "posted" result — with no credentials it returns
//     {ok:false, reason:'no_credentials'} instead of a fake success.
//   • Dry-run is only forced when explicit (OUTBOUND_DRY_RUN=1, legacy
//     MARKETING_OUTBOUND_DRYRUN=1) or when NODE_ENV=test.
//   • Every publish attempt is recorded in the JSONL ledger.
// RO: telegram outbound respecta variabilele canonice si nu simuleaza.

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate persistence so the test is hermetic.
const LEDGER = path.join(os.tmpdir(), 'outbound-ledger-' + process.pid + '.jsonl');
const RSS = path.join(os.tmpdir(), 'outbound-rss-' + process.pid + '.xml');
process.env.MARKETING_OUTBOUND_LEDGER = LEDGER;
process.env.MARKETING_OUTBOUND_RSS = RSS;
try { fs.unlinkSync(LEDGER); } catch (_) {}
try { fs.unlinkSync(RSS); } catch (_) {}

// Start with no telegram creds so `no_credentials` is deterministic.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
delete process.env.TG_BOT_TOKEN;
delete process.env.TG_CHAT_ID;
delete process.env.OUTBOUND_DRY_RUN;
delete process.env.MARKETING_OUTBOUND_DRYRUN;

const outbound = require('../backend/modules/marketing-innovations/outbound-publisher');

let passed = 0;
function check(name, fn) {
  const p = Promise.resolve().then(fn);
  return p.then(() => { console.log('✓', name); passed++; })
    .catch((e) => { console.error('✗', name, '\n  ', e && e.stack ? e.stack : e); process.exit(1); });
}

(async () => {
  outbound._resetForTests();

  await check('status() reflects no_credentials + dry-run auto-on in NODE_ENV=test', () => {
    const st = outbound.status();
    assert.strictEqual(st.dryRun, true, 'NODE_ENV=test → dry-run on');
    assert.strictEqual(st.telegramEnv.hasCredentials, false);
    assert.strictEqual(st.telegramEnv.envSource, null);
    assert.ok(!st.enabledAdapters.includes('telegram'), 'telegram not enabled without creds');
    assert.ok(st.enabledAdapters.includes('rss'), 'rss is always enabled');
  });

  await check('no telegram creds → publish returns {ok:false, reason:no_credentials, hint}', async () => {
    const r = await outbound.publish({ platform: 'telegram', body: 'hello' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'no_credentials');
    assert.strictEqual(r.platform, 'telegram');
    assert.ok(typeof r.hint === 'string' && /TELEGRAM_BOT_TOKEN/.test(r.hint));
    assert.ok(!r.dryRun, 'must NOT silently degrade to dryRun success');
  });

  await check('canonical TELEGRAM_* creds enable telegram adapter', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:canonical-test-token';
    process.env.TELEGRAM_CHAT_ID = '@canonical_test';
    outbound._resetForTests();
    const st = outbound.status();
    assert.ok(st.enabledAdapters.includes('telegram'));
    assert.strictEqual(st.telegramEnv.hasCredentials, true);
    assert.strictEqual(st.telegramEnv.envSource, 'TELEGRAM_BOT_TOKEN');
    // dry-run auto-on because NODE_ENV=test → no real network call.
    const r = await outbound.publish({ platform: 'telegram', body: 'hi canonical' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.dryRun, true);
    assert.strictEqual(r.platform, 'telegram');
  });

  await check('legacy TG_* creds still enable telegram adapter as fallback', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    process.env.TG_BOT_TOKEN = 'legacy:token-fallback';
    process.env.TG_CHAT_ID = '@legacy_fallback';
    outbound._resetForTests();
    const st = outbound.status();
    assert.ok(st.enabledAdapters.includes('telegram'));
    assert.strictEqual(st.telegramEnv.hasCredentials, true);
    assert.strictEqual(st.telegramEnv.envSource, 'TG_BOT_TOKEN (legacy)');
  });

  await check('OUTBOUND_DRY_RUN=1 forces dry-run even outside NODE_ENV=test', async () => {
    // Temporarily flip NODE_ENV to production and set OUTBOUND_DRY_RUN=1.
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.OUTBOUND_DRY_RUN = '1';
    try {
      const st = outbound.status();
      assert.strictEqual(st.dryRun, true, 'OUTBOUND_DRY_RUN=1 must force dry-run');
    } finally {
      process.env.NODE_ENV = prev;
      delete process.env.OUTBOUND_DRY_RUN;
    }
  });

  await check('every publish attempt is appended to the JSONL ledger', () => {
    const raw = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean);
    assert.ok(raw.length >= 2, 'ledger has entries');
    // Each line must be a real JSON record with at least a ts + platform.
    raw.slice(0, 5).forEach((line) => {
      const rec = JSON.parse(line);
      assert.ok(rec.ts && rec.platform, 'record has ts + platform');
    });
  });

  await check('broadcast(rss) always succeeds (RSS is always available)', async () => {
    outbound._resetForTests();
    const b = await outbound.broadcast({ platforms: ['rss'], body: 'B', title: 'T' });
    assert.strictEqual(b.ok, true);
    assert.strictEqual(b.dryRun, true, 'NODE_ENV=test propagates dryRun into broadcast()');
    assert.strictEqual(b.count, 1);
    assert.ok(fs.existsSync(RSS));
  });

  console.log('\n✅ outbound-telegram-canonical:', passed, 'tests passed');
  process.exit(0);
})();
