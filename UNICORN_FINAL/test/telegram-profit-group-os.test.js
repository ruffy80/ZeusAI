// =====================================================================
// telegram-profit-group-os.test.js — TPG/1.0 Profit Group OS
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUS_TG_GROUP_OS_DIR = require('os').tmpdir() + '/tpg-' + process.pid;
process.env.ZEUS_TG_GROUP_OS_DISABLED = '0';
process.env.TELEGRAM_BOT_TOKEN = '123456:TEST';
process.env.TELEGRAM_CHAT_ID = '111';
process.env.ZEUS_TG_GROUP_CHAT_ID = '222';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';

const assert = require('assert');

delete require.cache[require.resolve('../backend/modules/telegram-profit-group-os')];
const tpg = require('../backend/modules/telegram-profit-group-os');
tpg._resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('discovery advertises TPG/1.1', () => {
  const d = tpg.discovery();
  assert.equal(d.protocol, 'TPG/1.1');
  assert.ok(d.endpoints.status.includes('/api/telegram/group-os'));
});

check('dual-rail prefers group chat for profit posts', () => {
  assert.equal(tpg.groupChatId(), '222');
  const st = tpg.getStatus();
  assert.equal(st.dualRail, true);
  assert.equal(st.ownerChatId, '111');
});

check('CTA is trackable with utm + ref', () => {
  const cta = tpg.buildCta('welcome');
  assert.ok(cta.includes('utm_source=telegram'));
  assert.ok(cta.includes('utm_medium=group'));
  assert.ok(cta.includes('profit-group-os') || cta.includes('ref=tg-group'));
});

check('bindGroupChat updates env + status', () => {
  const r = tpg.bindGroupChat({ id: -100999, username: 'unicorn_profit', type: 'supergroup', title: 'ZeusAI Profit' });
  assert.ok(r.ok);
  assert.equal(tpg.groupChatId(), '-100999');
});

check('captureLead validates email', () => {
  assert.equal(tpg.captureLead('not-an-email').ok, false);
  const ok = tpg.captureLead('buyer@example.com', { id: 1, username: 'buyer' });
  assert.ok(ok.ok);
  assert.equal(tpg.getStatus().leads, 1);
});

check('getStatus exposes profit score without secrets', () => {
  const st = tpg.getStatus();
  assert.equal(st.protocol, 'TPG/1.1');
  assert.ok(typeof st.profitScore === 'number');
  const json = JSON.stringify(st);
  assert.ok(!json.includes('123456:TEST'));
});

Promise.resolve()
  .then(() => tpg.welcomeMember({ is_bot: true, id: 9 }, { id: -100999 }))
  .then((r) => {
    assert.equal(r.reason, 'bot');
    passed += 1;
    console.log('\u2713 welcome skips bots');
  })
  .then(() => tpg.handleUpdate({
    message: {
      message_id: 1,
      chat: { id: -100999 },
      from: { id: 42, is_bot: false },
      text: 'see https://a.com https://b.com https://c.com spam',
    },
  }))
  .then((r) => {
    assert.ok(r.ok);
    passed += 1;
    console.log('\u2713 moderation handles link spam');
    console.log('\n✅ telegram-profit-group-os:', passed, 'tests passed');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
