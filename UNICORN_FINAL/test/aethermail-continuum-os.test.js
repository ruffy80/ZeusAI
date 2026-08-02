// =====================================================================
// aethermail-continuum-os.test.js — AetherMail Continuum OS AMC/1.0
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUS_AETHERMAIL_DIR = require('os').tmpdir() + '/amc-' + process.pid;
process.env.ZEUS_AETHERMAIL_DISABLED = '0';
process.env.ZEUS_AETHERMAIL_AUTO_REPLY = '1';
process.env.ZEUS_AETHERMAIL_GRAVITY_MIN = '50';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';
delete process.env.SMTP_PASS;
delete process.env.IMAP_PASS;
process.env.SMTP_HOST = 'smtp.mail.yahoo.com';
process.env.SMTP_USER = 'vladoi_ionut@yahoo.com';

const assert = require('assert');

delete require.cache[require.resolve('../backend/modules/aethermail-continuum-os')];
const amc = require('../backend/modules/aethermail-continuum-os');
amc._resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('discovery advertises AMC/1.0 inventions', () => {
  const d = amc.discovery();
  assert.equal(d.protocol, 'AMC/1.0');
  assert.ok(d.inventions.some((i) => /Reply Gravity/i.test(i)));
  assert.ok(d.inventions.some((i) => /Epistle Dial/i.test(i)));
  assert.ok(d.inventions.some((i) => /Deferred Arming/i.test(i)));
});

check('smtp/imap unarmed without SMTP_PASS', () => {
  assert.equal(amc.smtpArmed(), false);
  assert.equal(amc.imapArmed(), false);
  const st = amc.getStatus();
  assert.ok(Array.isArray(st.waitingFor) && st.waitingFor.length >= 1);
});

check('imap host derives from Yahoo SMTP', () => {
  process.env.SMTP_PASS = 'yahoo-app-password-test-ok';
  delete require.cache[require.resolve('../backend/modules/aethermail-continuum-os')];
  const amc2 = require('../backend/modules/aethermail-continuum-os');
  amc2._resetForTests();
  const cfg = amc2.imapConfig();
  assert.equal(cfg.host, 'imap.mail.yahoo.com');
  assert.equal(cfg.user, 'vladoi_ionut@yahoo.com');
  assert.ok(amc2.imapArmed());
  delete process.env.SMTP_PASS;
});

check('Intent Lattice classifies sales vs spam', () => {
  const sales = amc.classifyIntent({
    from: 'buyer@corp.com',
    subject: 'Enterprise pricing quote',
    text: 'We want to buy your plan and need a catalog price.',
  });
  assert.equal(sales.intent, 'sales');
  const spam = amc.classifyIntent({
    from: 'noreply@bulk.example',
    subject: 'SEO backlink cheap lottery',
    text: 'unsubscribe viagra crypto airdrop',
    headers: 'List-Unsubscribe: <http://x>',
  });
  assert.equal(spam.intent, 'spam');
});

check('Reply Gravity blocks spam and clears sales', () => {
  const salesMail = { from: 'a@b.com', subject: 'Buy starter', text: 'price plan purchase' };
  const salesC = amc.classifyIntent(salesMail);
  const g1 = amc.replyGravity(salesMail, salesC);
  assert.ok(g1.score >= 50);
  assert.equal(g1.act, true);
  const spamMail = { from: 'noreply@x.com', subject: 'lottery', text: 'viagra', headers: 'List-Unsubscribe: x' };
  const spamC = amc.classifyIntent(spamMail);
  const g2 = amc.replyGravity(spamMail, spamC);
  assert.equal(g2.act, false);
});

check('Epistle Dial is stable and trackable', () => {
  const a = amc.issueEpistleDial('buyer@example.com', 'Hello');
  const b = amc.issueEpistleDial('buyer@example.com', 'Hello');
  assert.equal(a.code, b.code);
  assert.ok(a.code.startsWith('EDIAL-'));
  assert.ok(a.cta.includes('dial=EDIAL-'));
  assert.ok(a.cta.includes('utm_medium=aethermail'));
});

check('parseRfc822 extracts from/subject/body', () => {
  const raw = [
    'From: Alice <alice@example.com>',
    'Subject: Order status please',
    'Message-ID: <abc@example.com>',
    '',
    'Where is my order ord_123 payment?',
  ].join('\r\n');
  const m = amc.parseRfc822(raw);
  assert.equal(m.from, 'alice@example.com');
  assert.ok(/Order status/i.test(m.subject));
  assert.ok(/ord_123/.test(m.text));
});

Promise.resolve()
  .then(() => amc.processMessage({
    from: 'lead@example.com',
    fromName: 'Lead',
    subject: 'I want to buy Unicorn starter',
    text: 'Please send pricing for your buy plan catalog.',
    messageId: '<t1@example.com>',
  }, 1))
  .then((out) => {
    assert.ok(out.ok);
    assert.equal(out.classification.intent, 'sales');
    assert.ok(out.gravity.act);
    assert.ok(out.dial.code.startsWith('EDIAL-'));
    // Without SMTP_PASS, reply must queue honestly (not fake sent)
    assert.equal(out.replyResult.queued, true);
    assert.equal(out.replyResult.reason, 'smtp_unarmed_queued');
    const st = amc.getStatus();
    assert.ok(st.queued >= 1);
    assert.ok(st.inbound >= 1);
    const json = JSON.stringify(st);
    assert.ok(!json.includes('yahoo-app-password'));
    passed += 1;
    console.log('\u2713 simulate queues reply when SMTP unarmed (fail-honest)');
    console.log('\n✅ aethermail-continuum-os:', passed, 'tests passed');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
