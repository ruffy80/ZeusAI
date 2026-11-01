'use strict';

const AI_KEYS = [
  'GROQ_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'MISTRAL_API_KEY',
  'COHERE_API_KEY',
  'OPENROUTER_API_KEY',
  'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY',
];

const EMAIL_ENV = ['RESEND_API_KEY', 'BREVO_API_KEY', 'SENDINBLUE_API_KEY', 'MAILERSEND_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

function real(value) {
  const text = String(value || '').trim();
  if (text.length < 8) return false;
  if (/^your_|^changeme$|^placeholder|^skip$|^xxx|^TODO/i.test(text)) return false;
  return true;
}

function label({ configured, ready, sandbox, failed }) {
  if (!configured) return 'NOT CONFIGURED';
  if (failed) return 'FAILED';
  if (sandbox || process.env.NODE_ENV === 'test') return 'TEST MODE';
  if (ready) return 'OPERATIONAL';
  return 'DEGRADED';
}

function snapshot() {
  const paypalId = real(process.env.PAYPAL_CLIENT_ID);
  const paypalSecret = real(process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET);
  const paypalWebhook = real(process.env.PAYPAL_WEBHOOK_ID);
  const paypalSandbox = String(process.env.PAYPAL_ENV || '').toLowerCase() === 'sandbox';
  const nowKey = real(process.env.NOWPAYMENTS_API_KEY);
  const nowIpn = real(process.env.NOWPAYMENTS_IPN_SECRET);
  const nowSandbox = process.env.NOWPAYMENTS_SANDBOX === '1';
  const stripeKey = real(process.env.STRIPE_SECRET_KEY);
  const stripeWebhook = real(process.env.STRIPE_WEBHOOK_SECRET);
  const stripeTest = /^sk_test_|^rk_test_/i.test(String(process.env.STRIPE_SECRET_KEY || ''));
  let emailReady = false;
  try {
    const mailer = require('./transactional-email');
    emailReady = !!(mailer && typeof mailer.isConfigured === 'function' && mailer.isConfigured());
  } catch (_) { emailReady = false; }
  const aiPresent = AI_KEYS.filter((name) => real(process.env[name]));
  return {
    protocol: 'IRS/1.0',
    rails: {
      bitcoin: {
        status: 'OPERATIONAL',
        note: 'The owner wallet is configured in the commerce process. This status does not claim a payment was seen.',
      },
      paypal: {
        status: label({ configured: paypalId && paypalSecret, ready: paypalId && paypalSecret && paypalWebhook, sandbox: paypalSandbox }),
        requiredEnv: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
      },
      nowpayments: {
        status: label({ configured: nowKey, ready: nowKey && nowIpn, sandbox: nowSandbox }),
        requiredEnv: ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_IPN_SECRET'],
      },
      stripe: {
        status: label({ configured: stripeKey, ready: stripeKey && stripeWebhook, sandbox: stripeTest }),
        requiredEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        note: 'Without STRIPE_SECRET_KEY the card button opens a NOWPayments invoice. No Stripe session is invented.',
      },
      email: {
        status: emailReady ? (process.env.NODE_ENV === 'test' ? 'TEST MODE' : 'OPERATIONAL') : 'NOT CONFIGURED',
        requiredEnv: EMAIL_ENV,
        note: 'A pending invoice is emailed only when one of these variables holds a real secret. Nothing is marked sent before that.',
      },
      websiteAudit: {
        status: 'OPERATIONAL',
        note: 'The paid file fetches the submitted URL. The score is the count of checks in that response. A failed fetch has no score.',
      },
      aiFulfillment: {
        status: aiPresent.length ? (process.env.NODE_ENV === 'test' ? 'TEST MODE' : 'OPERATIONAL') : 'NOT CONFIGURED',
        presentEnvVars: aiPresent,
        note: 'Names only. A present key does not claim a model call succeeded. The website audit score does not come from a model.',
      },
    },
  };
}

module.exports = { snapshot, EMAIL_ENV };
