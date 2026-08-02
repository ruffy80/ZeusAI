// =====================================================================
// pre-keys-activation.js — Pre-keys commerce bridge (owner keys tomorrow)
//
// Honest readiness map of everything that can be live WITHOUT payment/
// email provider secrets. Surfaces what agents already armed vs what
// waits for NOWPayments / Stripe / PayPal / Resend tomorrow.
// RO: harta de activare pre-chei — ce e gata acum vs ce așteaptă mâine.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const NAME = 'pre-keys-activation';
const VERSION = 'PKA/1.0';

function _envArmed(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) return false;
  return !/^(your|skip|changeme|todo|placeholder|xxx+|none|null|undefined|tbd|n\/a)/i.test(v);
}

function _telegramBindStatus() {
  const statusFile = process.env.ZEUS_TG_STATUS_FILE
    || '/var/www/unicorn/shared/data/telegram/bind-status.json';
  let file = null;
  try {
    if (fs.existsSync(statusFile)) file = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  } catch (_) { file = null; }
  const tokenArmed = _envArmed('TELEGRAM_BOT_TOKEN') || _envArmed('TG_BOT_TOKEN');
  const chatArmed = _envArmed('TELEGRAM_CHAT_ID') || _envArmed('TG_CHAT_ID');
  const bound = !!(file && file.bound) || (tokenArmed && chatArmed);
  return {
    ok: true,
    bound,
    tokenArmed,
    chatArmed,
    chatId: file && file.chatId ? String(file.chatId) : (chatArmed ? '(env)' : null),
    chatRef: file && file.chatRef ? String(file.chatRef) : (process.env.TELEGRAM_CHAT_REF || null),
    type: (file && file.type) || null,
    username: (file && file.username) || null,
    updatedAt: (file && file.updatedAt) || null,
    // Never expose bot token or secrets
  };
}

function _wacpSigningMode() {
  try {
    const wacp = require('./world-ai-commerce-protocol');
    const st = wacp && typeof wacp.getStatus === 'function' ? wacp.getStatus() : null;
    return {
      mode: (st && st.signingMode) || 'unknown',
      ed25519: !!(st && st.signingMode === 'ed25519'),
      fallback: !!(st && st.fallbackSecretInUse),
    };
  } catch (e) {
    return { mode: 'unavailable', ed25519: false, error: e && e.message };
  }
}

function _neverDown() {
  try {
    const ndk = require('./never-down-kernel');
    if (ndk && typeof ndk.getStatus === 'function') return { ok: true, ...(ndk.getStatus() || {}) };
    if (ndk && typeof ndk.enrichHealth === 'function') return { ok: true, module: 'never-down-kernel' };
    return { ok: !!ndk, module: 'never-down-kernel' };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

function _disasterRecovery() {
  try {
    const dr = require('./disaster-recovery');
    const st = dr && typeof dr.getStatus === 'function' ? dr.getStatus() : null;
    return {
      ok: !!st,
      backend: st && st.backend,
      credentialsConfigured: !!(st && st.credentialsConfigured),
      localBackupsCount: st && st.localBackupsCount,
    };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

function _lightning() {
  try {
    const ln = require(path.join(__dirname, '..', '..', 'src', 'lightning', 'lightning'));
    return ln && typeof ln.getStatus === 'function' ? ln.getStatus() : { configured: false };
  } catch (_) {
    return { configured: false, ok: false };
  }
}

function _funnelReady() {
  try {
    const funnel = require('./funnel-intelligence');
    const s = funnel && typeof funnel.summary === 'function' ? funnel.summary() : null;
    return {
      ok: !!(s && s.ok),
      hasDeliveredStage: !!(s && s.conversion30d && Object.prototype.hasOwnProperty.call(s.conversion30d, 'paidToDelivered')),
      totalEvents: s && s.totalEvents,
    };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

/**
 * Owner money / channel packs.
 * Primary live rails = BTC (baseline) + PayPal + NOWPayments.
 * Stripe is intentionally optional/deferred — not required for Buy.
 * Email/SMTP and social (X/Meta) are later add-ons.
 */
function ownerTomorrowChecklist() {
  const paypalArmed = _envArmed('PAYPAL_CLIENT_ID')
    && (_envArmed('PAYPAL_CLIENT_SECRET') || _envArmed('PAYPAL_SECRET'))
    && _envArmed('PAYPAL_WEBHOOK_ID');
  const nowArmed = _envArmed('NOWPAYMENTS_API_KEY') && _envArmed('NOWPAYMENTS_IPN_SECRET');
  const emailArmed = _envArmed('RESEND_API_KEY') || _envArmed('BREVO_API_KEY')
    || _envArmed('MAILERSEND_API_KEY')
    || (_envArmed('SMTP_HOST') && _envArmed('SMTP_USER') && _envArmed('SMTP_PASS'));
  return [
    {
      id: 'nowpayments',
      title: 'NOWPayments API + IPN',
      armed: nowArmed,
      primary: true,
      optional: false,
      envVars: ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_IPN_SECRET'],
    },
    {
      id: 'paypal',
      title: 'PayPal client + webhook',
      armed: paypalArmed,
      primary: true,
      optional: false,
      envVars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    },
    {
      id: 'stripe',
      title: 'Stripe card rail (optional — not required for Buy)',
      armed: _envArmed('STRIPE_SECRET_KEY'),
      primary: false,
      optional: true,
      deferred: true,
      envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    },
    {
      id: 'email',
      title: 'Transactional email (SMTP / Resend / Brevo) — later',
      armed: emailArmed,
      primary: false,
      optional: true,
      deferred: true,
      envVars: ['SMTP_PASS', 'RESEND_API_KEY', 'BREVO_API_KEY', 'MAILERSEND_API_KEY'],
    },
  ];
}

function getStatus() {
  const telegram = _telegramBindStatus();
  const wacp = _wacpSigningMode();
  const ndk = _neverDown();
  const dr = _disasterRecovery();
  const lightning = _lightning();
  const funnel = _funnelReady();
  const ownerTomorrow = ownerTomorrowChecklist();

  const agentArmed = [
    { id: 'telegram', title: 'Telegram outbound + CVR', armed: !!(telegram.bound && telegram.tokenArmed), detail: telegram },
    { id: 'funnel_instrumentation', title: 'Buy→paid→delivered funnel', armed: !!(funnel.ok && funnel.hasDeliveredStage), detail: funnel },
    { id: 'wacp_ed25519', title: 'WACP Ed25519 forever-key', armed: !!wacp.ed25519, detail: wacp },
    { id: 'never_down', title: 'Never-Down Kernel', armed: !!ndk.ok, detail: { ok: ndk.ok, neverKill: ndk.neverKill } },
    { id: 'dr_local', title: 'Local disaster recovery', armed: !!(dr.ok && (dr.backend === 'local' || dr.credentialsConfigured)), detail: dr },
    { id: 'lightning', title: 'Lightning Network (LND)', armed: !!(lightning && lightning.configured), detail: lightning, optional: true },
    { id: 'btc_baseline', title: 'Native BTC checkout (owner wallet)', armed: !!(process.env.BTC_OWNER_WALLET || process.env.BTC_WALLET_ADDRESS || process.env.LEGAL_OWNER_BTC), optional: false },
  ];

  const green = agentArmed.filter((c) => c.armed);
  const waitingAgents = agentArmed.filter((c) => !c.armed && !c.optional);
  // Only primary money packs block "payment ready" — Stripe/email are deferred.
  const primaryOwner = ownerTomorrow.filter((c) => c.primary);
  const waitingOwnerPrimary = primaryOwner.filter((c) => !c.armed);
  const waitingOwner = ownerTomorrow.filter((c) => !c.armed && !c.optional);
  const deferredOwner = ownerTomorrow.filter((c) => !c.armed && c.optional);
  const moneyReady = !!(
    agentArmed.find((c) => c.id === 'btc_baseline' && c.armed)
    && primaryOwner.every((c) => c.armed)
  );

  return {
    ok: true,
    module: NAME,
    protocol: VERSION,
    generatedAt: new Date().toISOString(),
    moneyRails: {
      primary: ['btc', 'paypal', 'nowpayments'],
      stripeRequired: false,
      ready: moneyReady,
    },
    summary: moneyReady
      ? `${green.length}/${agentArmed.length} agent rails green. Primary money rails armed (BTC + PayPal + NOWPayments). Stripe/email deferred.`
      : waitingOwnerPrimary.length
        ? `${green.length}/${agentArmed.length} agent rails green. Waiting primary money packs: ${waitingOwnerPrimary.map((c) => c.id).join('/')}.`
        : `${green.length}/${agentArmed.length} agent rails green.`,
    agentArmed: agentArmed.map((c) => ({
      id: c.id, title: c.title, armed: c.armed, optional: !!c.optional,
    })),
    ownerTomorrow: ownerTomorrow.map((c) => ({
      id: c.id, title: c.title, armed: c.armed, optional: !!c.optional,
      primary: !!c.primary, deferred: !!c.deferred, envVars: c.envVars,
    })),
    waitingOwner,
    waitingOwnerPrimary,
    deferredOwner,
    waitingAgents,
    telegram,
    wacp,
    funnel,
    neverDown: { ok: ndk.ok },
    disasterRecovery: dr,
    lightning,
    endpoints: {
      status: '/api/pre-keys/status',
      activation: '/api/activation/readiness',
      telegramBind: '/api/telegram/bind-status',
      funnel: '/api/analytics/funnel',
      lightning: '/api/lightning/status',
      dr: '/api/dr/status',
    },
  };
}

function discovery() {
  return {
    protocol: VERSION,
    name: 'Pre-Keys Activation',
    purpose: 'Honest map of agent-armed rails vs owner payment/email keys due tomorrow.',
    endpoints: {
      status: '/api/pre-keys/status',
      wellKnown: '/.well-known/pre-keys.json',
    },
  };
}

module.exports = {
  name: NAME,
  getStatus,
  discovery,
  ownerTomorrowChecklist,
  telegramBindStatus: _telegramBindStatus,
};
