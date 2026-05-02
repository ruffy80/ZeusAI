// test/password-reset-email.test.js
// Verifies that the password_reset transactional template exists, renders with the
// reset URL embedded, and that sendTransactional dispatches via configured providers.
//
// Plain-Node test runner (matches the rest of UNICORN_FINAL/test/* style).

'use strict';

const assert = require('assert');

(async function main() {
  // Isolate from any ambient configuration on the dev box.
  delete process.env.RESEND_API_KEY;
  delete process.env.BREVO_API_KEY;
  delete process.env.MAILERSEND_API_KEY;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  // Force require fresh in case other tests already loaded the module.
  const modulePath = require.resolve('../src/commerce/transactional-email');
  delete require.cache[modulePath];
  const mod = require('../src/commerce/transactional-email');

  // 1. Template exists ------------------------------------------------------
  assert.ok(mod.TEMPLATES, 'TEMPLATES export missing');
  assert.equal(typeof mod.TEMPLATES.password_reset, 'function', 'password_reset template missing — forgot-password endpoint cannot send mail');

  // 2. Template renders with the reset URL and TTL embedded ---------------
  const url = 'https://zeusai.pro/reset-password?token=test123abc';
  const out = mod.TEMPLATES.password_reset({ resetUrl: url, expiresInMinutes: 60 });
  assert.ok(out && out.subject && out.text && out.html, 'password_reset must return {subject,text,html}');
  assert.ok(out.subject.toLowerCase().includes('reset') || out.subject.toLowerCase().includes('parola'), 'subject should mention reset/parola');
  assert.ok(out.text.includes(url), 'plain-text body must contain the reset URL');
  assert.ok(out.html.includes(url), 'HTML body must contain the reset URL');
  assert.ok(/60/.test(out.text), 'plain-text body should mention the 60 minute TTL');
  // Bilingual: contains real EN + RO phrases, not just header markers.
  assert.ok(/You requested a password reset/i.test(out.text), 'plain-text body must contain English copy');
  assert.ok(/Ai cerut resetarea parolei/i.test(out.text), 'plain-text body must contain Romanian copy');

  // 3. Defaults safely when called with empty args --------------------------
  const out2 = mod.TEMPLATES.password_reset({});
  assert.ok(out2 && out2.subject && out2.text && out2.html, 'password_reset must work with empty data');
  assert.ok(/zeusai\.pro\/reset-password/.test(out2.text), 'default URL fallback should point to /reset-password');

  // 4. configuredProviders() returns empty when nothing is set --------------
  assert.deepStrictEqual(mod.configuredProviders(), [], 'no providers should be configured in test env');

  // 5. sendTransactional() returns skipped:'unconfigured' (no providers) ----
  const r1 = await mod.sendTransactional({ to: 'test@example.com', template: 'password_reset', data: { resetUrl: url } });
  assert.equal(r1.ok, true, 'no-provider mode should return ok:true (no-op)');
  assert.equal(r1.skipped, 'unconfigured', 'no-provider mode should mark as skipped');

  // 6. Unknown template surfaces an explicit error --------------------------
  const r2 = await mod.sendTransactional({ to: 'test@example.com', template: 'no_such_template', data: {} });
  assert.equal(r2.ok, false, 'unknown template should fail');
  assert.equal(r2.error, 'unknown_template', 'unknown template error code');

  // 7. Missing recipient surfaces an explicit error -------------------------
  const r3 = await mod.sendTransactional({ to: '', template: 'password_reset', data: { resetUrl: url } });
  assert.equal(r3.ok, false, 'missing recipient should fail');
  assert.equal(r3.error, 'missing_to', 'missing_to error code');

  // 8. Resend provider chosen when RESEND_API_KEY is set --------------------
  process.env.RESEND_API_KEY = 'test-key-do-not-send';
  delete require.cache[modulePath];
  const mod2 = require('../src/commerce/transactional-email');
  const provs = mod2.configuredProviders();
  assert.ok(provs.includes('resend'), 'resend must be reported as configured when RESEND_API_KEY set');
  delete process.env.RESEND_API_KEY;

  console.log('password-reset-email test passed ✓');
  process.exit(0);
})().catch((err) => {
  console.error('password-reset-email test FAILED:', err && err.stack || err);
  process.exit(1);
});
