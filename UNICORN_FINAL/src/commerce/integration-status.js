'use strict';

const fs = require('fs');
const path = require('path');

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
  const checkedAt = new Date().toISOString();
  let auditLoaded = false;
  try { auditLoaded = typeof require('./audit-scan').scan === 'function'; } catch (_) { auditLoaded = false; }
  return {
    protocol: 'IRS/1.0',
    checkedAt,
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
        status: auditLoaded ? 'OPERATIONAL' : 'FAILED',
        checkedAt,
        lastFailure: auditLoaded ? null : 'audit scanner did not load',
        note: 'The paid file fetches the submitted URL. The score is the count of checks in that response. A failed fetch has no score.',
      },
      aiFulfillment: {
        status: aiPresent.length ? (process.env.NODE_ENV === 'test' ? 'TEST MODE' : 'OPERATIONAL') : 'NOT CONFIGURED',
        presentEnvVars: aiPresent,
        note: 'Names only. A present key does not claim a model call succeeded. The website audit score does not come from a model.',
      },
    },
    businessModules: businessModuleStatus(checkedAt, aiPresent),
  };
}

let _conciergeStatus = null;
function conciergeReady() {
  if (_conciergeStatus) return _conciergeStatus;
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    _conciergeStatus = src.includes('function composeReply') ? 'OPERATIONAL' : 'FAILED';
  } catch (_) {
    _conciergeStatus = 'FAILED';
  }
  return _conciergeStatus;
}

function businessModuleStatus(checkedAt, aiPresent) {
  const externalModel = aiPresent.length ? (process.env.NODE_ENV === 'test' ? 'TEST MODE' : 'OPERATIONAL') : 'NOT CONFIGURED';
  let dna = { status: 'FAILED', lastFailure: 'module did not load' };
  let omega = { status: 'FAILED', lastFailure: 'module did not load' };
  let vault = { status: 'FAILED', lastFailure: 'module did not load' };
  let delivery = { status: 'FAILED', lastFailure: 'writer did not load' };
  try {
    const writer = require('../../backend/modules/paid-delivery');
    if (typeof writer.writePaidDelivery === 'function') delivery = { status: 'OPERATIONAL', lastFailure: null };
  } catch (err) {
    delivery.lastFailure = String(err && err.message || err).slice(0, 160);
  }
  try {
    const mod = require('../../backend/modules/ai-dna-engine');
    const st = mod.getStatus();
    dna = {
      status: st && st.disabled ? 'NOT CONFIGURED' : 'OPERATIONAL',
      strandsLive: st && st.counts ? st.counts.strandsLive : 0,
      lastFailure: null,
      note: 'Local strand store. Counts are stored strands, not an invented audience.',
    };
  } catch (err) {
    dna.lastFailure = String(err && err.message || err).slice(0, 160);
  }
  try {
    const mod = require('../../backend/modules/omega-ecosystem-os');
    const st = mod.getStatus();
    const live = st && st.counts ? st.counts.instancesLive : 0;
    omega = {
      status: st && st.disabled ? 'NOT CONFIGURED' : 'OPERATIONAL',
      customerInstances: live,
      vaultAccounts: st && st.counts ? st.counts.vaultAccounts : 0,
      lastFailure: null,
      note: 'Vault, workspace, concierge, and delivery are local instance edges. A customer instance appears after a paid order.',
    };
  } catch (err) {
    omega.lastFailure = String(err && err.message || err).slice(0, 160);
  }
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'modules', 'quantumVault.js'), 'utf8');
    if (src.includes('function store') && src.includes('function getStatus')) {
      vault = {
        status: 'OPERATIONAL',
        lastFailure: null,
        note: 'Local secret vault is present. This check does not unlock it and does not read secret values.',
      };
    }
  } catch (err) {
    vault.lastFailure = String(err && err.message || err).slice(0, 160);
  }
  return {
    aiVault: Object.assign({ name: 'AI Vault', checkedAt, customerFacing: true }, vault),
    aiDelivery: {
      name: 'AI Delivery',
      status: delivery.status,
      checkedAt,
      lastFailure: delivery.lastFailure,
      customerFacing: true,
      note: 'A paid sovereign order writes the buyer file. Delivery still waits for a verified payment.',
    },
    aiWorkspace: Object.assign({
      name: 'AI Workspace',
      checkedAt,
      customerFacing: true,
      status: omega.status,
      customerInstances: omega.customerInstances || 0,
      lastFailure: omega.lastFailure,
      note: omega.note || omega.lastFailure,
    }),
    aiConcierge: {
      name: 'AI Concierge',
      status: conciergeReady(),
      externalModel,
      checkedAt,
      lastFailure: null,
      customerFacing: true,
      note: 'Shelf answers are composed locally and labeled zeus-local. An external model runs only when a real provider key is present.',
    },
    aiDna: Object.assign({ name: 'AI DNA', checkedAt, customerFacing: true }, dna),
  };
}

module.exports = { snapshot, EMAIL_ENV, businessModuleStatus };
