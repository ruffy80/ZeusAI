// test/transactional-email-templates.test.js
// Covers the new order_receipt + delivery_artifact templates, the SENDINBLUE_API_KEY
// alias for Brevo, and the fail-honest contract when no provider is configured.

'use strict';

const assert = require('assert');

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); process.exit(1); }
}

async function main() {
  // Strip any ambient email config so we exercise the "unconfigured" branch.
  for (const k of ['RESEND_API_KEY', 'BREVO_API_KEY', 'SENDINBLUE_API_KEY', 'MAILERSEND_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) {
    delete process.env[k];
  }
  const modulePath = require.resolve('../src/commerce/transactional-email');
  delete require.cache[modulePath];
  const mod = require('../src/commerce/transactional-email');

  check('exports order_receipt template', () => {
    assert.equal(typeof mod.TEMPLATES.order_receipt, 'function');
  });
  check('exports delivery_artifact template', () => {
    assert.equal(typeof mod.TEMPLATES.delivery_artifact, 'function');
  });
  check('exports isConfigured()', () => {
    assert.equal(typeof mod.isConfigured, 'function');
    assert.equal(mod.isConfigured(), false, 'no providers → isConfigured must be false');
  });

  check('order_receipt renders orderId + service + txid + amount', () => {
    const out = mod.TEMPLATES.order_receipt({
      orderId: 'ord_abc123',
      serviceId: 'starter',
      serviceName: 'Starter Plan',
      priceUSD: 199,
      amount_btc: '0.00123456',
      txid: 'deadbeef1234',
      paid_at: '2026-07-20T10:00:00Z'
    });
    assert.ok(out && out.subject && out.text && out.html);
    assert.ok(out.subject.includes('ord_abc123'), 'subject includes orderId');
    assert.ok(out.text.includes('ord_abc123'), 'text includes orderId');
    assert.ok(out.text.includes('Starter Plan'), 'text includes service name');
    assert.ok(out.text.includes('$199'), 'text includes USD amount');
    assert.ok(out.text.includes('0.00123456'), 'text includes BTC amount');
    assert.ok(out.text.includes('deadbeef1234'), 'text includes txid');
    assert.ok(out.html.includes('deadbeef1234'), 'html includes txid');
    assert.ok(/mempool\.space\/tx\//.test(out.html), 'html links to mempool.space proof');
  });

  check('order_receipt is safe with minimal data', () => {
    const out = mod.TEMPLATES.order_receipt({ orderId: 'ord_min' });
    assert.ok(out && out.subject && out.text && out.html);
    assert.ok(out.text.includes('ord_min'));
  });

  check('delivery_artifact renders order + count + link', () => {
    const out = mod.TEMPLATES.delivery_artifact({
      orderId: 'ord_del_1',
      serviceName: 'Growth Plan',
      artifactCount: 3,
      artifacts: [
        { filename: 'growth-plan.json', kind: 'report' },
        { filename: 'license.txt', kind: 'license' },
        { filename: 'api-key.json', kind: 'api-key' }
      ],
      deliveryUrl: 'https://zeusai.pro/account?order=ord_del_1&token=xyz'
    });
    assert.ok(out.subject.includes('Growth Plan'), 'subject includes service name');
    assert.ok(out.text.includes('ord_del_1'), 'text includes orderId');
    assert.ok(out.text.includes('growth-plan.json'), 'text lists artifact filenames');
    assert.ok(out.text.includes('https://zeusai.pro/account?order=ord_del_1'), 'text includes delivery URL');
    assert.ok(out.html.includes('growth-plan.json'), 'html lists artifact filenames');
  });

  check('delivery_artifact falls back to APP_URL when deliveryUrl missing', () => {
    const out = mod.TEMPLATES.delivery_artifact({ orderId: 'ord_x', artifactCount: 1 });
    assert.ok(/\/account\?order=ord_x/.test(out.text), 'default URL points at /account?order=…');
  });

  // Fail-honest contract: unconfigured must NOT pretend a send happened.
  check('sendTransactional returns ok:false + reason when unconfigured', async () => {
    const r = await mod.sendTransactional({ to: 'buyer@example.com', template: 'order_receipt', data: { orderId: 'ord_1' } });
    assert.equal(r.ok, false, 'ok must be false when nothing was sent');
    assert.equal(r.reason, 'email_unconfigured', 'reason must be email_unconfigured');
  });
  check('sendRaw returns ok:false + reason when unconfigured', async () => {
    const r = await mod.sendRaw({ to: 'buyer@example.com', subject: 's', text: 't' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'email_unconfigured');
  });

  // SENDINBLUE_API_KEY (legacy) must register the brevo provider.
  check('SENDINBLUE_API_KEY registers brevo as an alias', () => {
    process.env.SENDINBLUE_API_KEY = 'test-sib-key';
    delete require.cache[modulePath];
    const mod2 = require('../src/commerce/transactional-email');
    const provs = mod2.configuredProviders();
    assert.ok(provs.includes('brevo'), 'SENDINBLUE_API_KEY must appear as brevo');
    assert.equal(mod2.isConfigured(), true);
    delete process.env.SENDINBLUE_API_KEY;
  });

  check('BREVO_API_KEY (canonical) still registers brevo', () => {
    process.env.BREVO_API_KEY = 'test-brevo-key';
    delete require.cache[modulePath];
    const mod3 = require('../src/commerce/transactional-email');
    assert.ok(mod3.configuredProviders().includes('brevo'));
    delete process.env.BREVO_API_KEY;
  });

  console.log('\n✅ transactional-email-templates: ' + passed + ' tests passed');
}

main().catch((e) => { console.error('transactional-email-templates FAILED:', e && e.stack || e); process.exit(1); });
