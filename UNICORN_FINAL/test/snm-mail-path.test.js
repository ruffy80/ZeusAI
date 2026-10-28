'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.SNM_ENABLED = 'true';
delete process.env.RESEND_API_KEY;
delete process.env.BREVO_API_KEY;
delete process.env.SENDINBLUE_API_KEY;
delete process.env.MAILERSEND_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const ROOT = path.join(__dirname, '..');
const calls = [];
const indexPath = require.resolve('../modules/notificationMesh/index.js');
require(indexPath);
require.cache[indexPath].exports = {
  enabled() { return true; },
  boot() { return false; },
  deliver: async (note) => {
    calls.push(note);
    if (note && note.type === 'miss') {
      return { delivered: false, channel: null, receipt: 'r-miss', attempts: [{ channel: 'smtp-fallback', ok: false }] };
    }
    return { delivered: true, channel: 'websocket', receipt: 'r-ws', attempts: [{ channel: 'websocket', ok: true }] };
  },
};

function fresh(rel) {
  const abs = require.resolve(rel);
  delete require.cache[abs];
  return require(rel);
}

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log('  ✓ ' + name);
    });
}

(async function main() {
  const tx = fresh('../src/commerce/transactional-email');
  const email = fresh('../backend/email');

  await check('site sendTransactional uses SNM and does not report email_unconfigured', async () => {
    calls.length = 0;
    const r = await tx.sendTransactional({
      to: 'buyer@example.com',
      template: 'order_receipt',
      data: { orderId: 'ord_snm' },
    });
    assert.equal(r.ok, true);
    assert.equal(r.provider, 'snm:websocket');
    assert.equal(r.channel, 'websocket');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, 'order_receipt');
    assert.equal(calls[0].orderId, 'ord_snm');
    assert.equal(calls[0].email, 'buyer@example.com');
    assert.ok(calls[0].subject);
    assert.ok(calls[0].text);
  });

  await check('password reset is private so Nostr cannot finish the chain', async () => {
    calls.length = 0;
    const r = await tx.sendTransactional({
      to: 'buyer@example.com',
      template: 'password_reset',
      data: { resetUrl: 'https://zeusai.pro/reset-password?token=abc' },
    });
    assert.equal(r.ok, true);
    assert.equal(calls[0].type, 'password_reset');
    assert.equal(calls[0].private, true);
    assert.ok(String(calls[0].text).includes('token=abc'));
  });

  await check('direct sendRaw skips the mesh and stays fail-honest', async () => {
    calls.length = 0;
    const r = await tx.sendRaw({ to: 'buyer@example.com', subject: 's', text: 't', direct: true });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'email_unconfigured');
    assert.equal(calls.length, 0);
  });

  await check('backend sendMail uses SNM before SMTP', async () => {
    calls.length = 0;
    const r = await email.sendMail({
      to: 'buyer@example.com',
      subject: 'Hello',
      text: 'body',
      type: 'welcome',
      userId: 'user-1',
    });
    assert.equal(r.ok, true);
    assert.equal(r.channel, 'websocket');
    assert.equal(calls[0].userId, 'user-1');
    assert.equal(calls[0].type, 'welcome');
  });

  await check('backend direct mail does not enter the mesh', async () => {
    calls.length = 0;
    const r = await email.sendMail({ to: 'buyer@example.com', subject: 's', text: 't', direct: true });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'email_unconfigured');
    assert.equal(calls.length, 0);
  });

  await check('a missed mesh reports snm_undelivered', async () => {
    calls.length = 0;
    const r = await email.sendMail({ to: 'buyer@example.com', subject: 's', text: 't', type: 'miss' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'snm_undelivered');
    assert.equal(calls.length, 1);
  });

  await check('paid delivery does not send a second SMTP mail while SNM is on', async () => {
    const delivery = fresh('../backend/modules/paid-delivery');
    const r = await delivery.queueDeliveryEmail({
      id: 'inv_1',
      customerEmail: 'buyer@example.com',
      service: 'instant-website-audit',
    });
    assert.equal(r.reason, 'mesh_owns_delivery');
    assert.equal(r.skipped, 'snm');
  });

  await check('Nostr refuses a private payload without opening a relay', async () => {
    const nostr = require('../modules/notificationMesh/channels/nostr');
    const content = nostr.publicContent({
      payload: { type: 'order_created', orderId: 'ord_1', email: 'secret@example.com', text: 'hidden' },
      signature: 'sig',
      pubkey: 'pk',
      timestamp: 1,
      nonce: 'n',
    });
    assert.equal(content.includes('secret@example.com'), false);
    assert.equal(content.includes('hidden'), false);
    assert.equal(nostr.isPublicSafe({ payload: { type: 'password_reset', private: true } }), false);
    const ok = await nostr.send({ payload: { type: 'password_reset', private: true, text: 'token' } });
    assert.equal(ok, false);
  });

  await check('SMTP fallback calls the direct mailer, and both apps enter through the bridge', () => {
    const smtp = fs.readFileSync(path.join(ROOT, 'modules/notificationMesh/channels/smtp-fallback.js'), 'utf8');
    const site = fs.readFileSync(path.join(ROOT, 'src/commerce/transactional-email.js'), 'utf8');
    const backend = fs.readFileSync(path.join(ROOT, 'backend/email.js'), 'utf8');
    const page = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');
    assert.ok(smtp.includes('direct: true'));
    assert.ok(site.includes('deliverMail'));
    assert.ok(backend.includes('deliverMail'));
    assert.ok(backend.includes('function sendDirect'));
    assert.ok(page.includes("type: 'enterprise_lead'"));
    assert.ok(page.includes('snm.boot'));
  });

  console.log('\n✅ snm-mail-path: ' + passed + ' tests passed');
})().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
