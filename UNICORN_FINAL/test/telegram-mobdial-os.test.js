// =====================================================================
// telegram-mobdial-os.test.js — MobDial MDB/1.0
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUS_TG_MOBDIAL_DIR = require('os').tmpdir() + '/mobdial-' + process.pid;
process.env.ZEUS_TG_GROUP_OS_DIR = require('os').tmpdir() + '/tpg-md-' + process.pid;
process.env.ZEUS_TG_MOBDIAL_DISABLED = '0';
process.env.ZEUS_TG_GROUP_OS_DISABLED = '0';
process.env.TELEGRAM_BOT_TOKEN = '123456:TEST';
process.env.TELEGRAM_CHAT_ID = '111';
process.env.ZEUS_TG_GROUP_CHAT_ID = '222';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';
process.env.ZEUS_TG_MOBDIAL_GOV_MAX = '2';
process.env.ZEUS_TG_MOBDIAL_GOV_WINDOW_MS = '600000';

const assert = require('assert');

delete require.cache[require.resolve('../backend/modules/telegram-mobdial-os')];
delete require.cache[require.resolve('../backend/modules/telegram-profit-group-os')];
const md = require('../backend/modules/telegram-mobdial-os');
md._resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('discovery advertises MDB/1.0 inventions', () => {
  const d = md.discovery();
  assert.equal(d.protocol, 'MDB/1.0');
  assert.ok(Array.isArray(d.inventions) && d.inventions.length >= 4);
  assert.ok(d.endpoints.status.includes('/api/telegram/mobdial'));
});

check('issueDial creates stable UDIAL code', () => {
  const a = md.issueDial({ id: 42, username: 'alice', first_name: 'Alice' });
  assert.ok(a.ok);
  assert.ok(String(a.member.code).startsWith('UDIAL-'));
  const b = md.issueDial({ id: 42, username: 'alice' });
  assert.equal(a.member.code, b.member.code);
  assert.equal(md.getStatus().dialsIssued, 1);
});

check('buildDialUrl carries dial + utm', () => {
  const issued = md.issueDial({ id: 7, username: 'bob' });
  const url = md.buildDialUrl(issued.member.code, 'welcome');
  assert.ok(url.includes('dial=UDIAL-'));
  assert.ok(url.includes('utm_medium=mobdial'));
  assert.ok(url.includes('utm_source=telegram'));
});

check('recordDialClick + attributeCheckout close the loop', () => {
  const issued = md.issueDial({ id: 99, username: 'carol' });
  const code = issued.member.code;
  assert.ok(md.recordDialClick(code, { templateId: 'btc_rail' }).ok);
  assert.ok(md.attributeCheckout({ dial: code, orderId: 'ord_test', serviceId: 'starter' }).ok);
  assert.ok(md.attributeCheckout({ dial: code, orderId: 'ord_paid', paid: true }).ok);
  const st = md.getStatus();
  assert.ok(st.dialClicks >= 1);
  assert.ok(st.attributedCheckouts >= 2);
  assert.ok(st.attributedPaid >= 1);
  assert.ok(st.swarmScore > 0);
});

check('swarm governor blocks after max sends', () => {
  md._resetForTests();
  assert.ok(md.governorAllow('t1').ok);
  md.governorCommit('t1');
  assert.ok(md.governorAllow('t2').ok);
  md.governorCommit('t2');
  const blocked = md.governorAllow('t3');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'swarm_governor');
});

check('getStatus never leaks bot token', () => {
  const st = md.getStatus();
  const json = JSON.stringify(st);
  assert.ok(!json.includes('123456:TEST'));
  assert.equal(st.protocol, 'MDB/1.0');
});

check('TPG/1.1 surfaces mobdial substatus', () => {
  delete require.cache[require.resolve('../backend/modules/telegram-profit-group-os')];
  const tpg = require('../backend/modules/telegram-profit-group-os');
  tpg._resetForTests();
  const st = tpg.getStatus();
  assert.equal(st.protocol, 'TPG/1.1');
  assert.ok(st.mobdial);
  assert.equal(st.mobdial.protocol, 'MDB/1.0');
});

console.log('\n✅ telegram-mobdial-os:', passed, 'tests passed');
process.exit(0);
