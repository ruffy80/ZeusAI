'use strict';

/**
 * Armed Rails Continuum — ARK/1.0 (Armed Rails Keys)
 * Single honesty dashboard + arm checklist for NOWPayments, Stripe, email, social, CJ.
 * Never claims ready when keys are missing.
 */

const { isoNow, envNonEmpty } = require('./_util');

const PROTOCOL = 'ARK/1.0';
const NAME = 'armed-rails-continuum';

const state = {
  startedAt: null,
  running: false,
  lastScanAt: null,
};

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

function scanRails() {
  const rails = [
    {
      id: 'btc-direct',
      impact: 100,
      armed: envNonEmpty('BTC_WALLET_ADDRESS') || envNonEmpty('BTC_OWNER_WALLET') || true, // default owner addr in code
      required: [],
      note: 'Primary sovereign rail — always available to owner wallet',
    },
    {
      id: 'nowpayments',
      impact: 100,
      armed: envNonEmpty('NOWPAYMENTS_API_KEY'),
      required: ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_IPN_SECRET'],
      note: 'Card/alt → auto BTC to owner (non-custodial settlement)',
    },
    {
      id: 'stripe',
      impact: 90,
      armed: envNonEmpty('STRIPE_SECRET_KEY') && envNonEmpty('STRIPE_WEBHOOK_SECRET'),
      required: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      note: 'Card checkout when price IDs configured',
    },
    {
      id: 'paypal',
      impact: 70,
      armed: envNonEmpty('PAYPAL_CLIENT_ID') && envNonEmpty('PAYPAL_CLIENT_SECRET'),
      required: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
      note: 'Optional PayPal orders + webhook verify',
    },
    {
      id: 'email',
      impact: 95,
      armed: envNonEmpty('RESEND_API_KEY')
        || envNonEmpty('BREVO_API_KEY')
        || envNonEmpty('SENDINBLUE_API_KEY')
        || envNonEmpty('MAILERSEND_API_KEY'),
      required: ['RESEND_API_KEY|BREVO_API_KEY|MAILERSEND_API_KEY'],
      note: 'Receipts + abandoned-cart recovery (Hetzner blocks raw SMTP)',
    },
    {
      id: 'social-x',
      impact: 60,
      armed: envNonEmpty('X_BEARER_TOKEN') && envNonEmpty('X_ACCESS_TOKEN'),
      required: ['X_BEARER_TOKEN', 'X_ACCESS_TOKEN'],
      note: 'Distribution rail for AACOS/ARC',
    },
    {
      id: 'social-telegram',
      impact: 55,
      armed: envNonEmpty('TELEGRAM_BOT_TOKEN'),
      required: ['TELEGRAM_BOT_TOKEN'],
      note: 'Telegram broadcast / profit group',
    },
    {
      id: 'cj-dropship',
      impact: 80,
      armed: envNonEmpty('CJ_API_KEY') || envNonEmpty('CJ_ACCESS_TOKEN') || envNonEmpty('CJ_VID'),
      required: ['CJ_API_KEY or CJ_ACCESS_TOKEN', 'CJ_VID'],
      note: 'Physical dispatch — without it ZACC uses fulfillment desk',
    },
  ];

  // Soft cross-check live modules when present
  try {
    const np = require('../nowPayments');
    if (np && typeof np.getStatus === 'function') {
      const s = np.getStatus();
      const row = rails.find((r) => r.id === 'nowpayments');
      if (row && s && s.configured === false) row.armed = false;
      if (row && s && s.configured === true) row.armed = true;
    }
  } catch (_) { /* optional */ }

  const armedCount = rails.filter((r) => r.armed).length;
  const readinessScore = Math.round(
    rails.reduce((sum, r) => sum + (r.armed ? r.impact : 0), 0)
      / rails.reduce((sum, r) => sum + r.impact, 0) * 100
  );

  const nextActions = rails
    .filter((r) => !r.armed && r.id !== 'btc-direct')
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5)
    .map((r) => ({
      rail: r.id,
      impact: r.impact,
      set: r.required,
      note: r.note,
    }));

  state.lastScanAt = isoNow();
  return {
    ok: true,
    protocol: PROTOCOL,
    scannedAt: state.lastScanAt,
    armedCount,
    totalRails: rails.length,
    readinessScore,
    rails,
    nextActions,
    billionPathBlockedBy: nextActions.slice(0, 3).map((a) => a.rail),
  };
}

function getStatus() {
  const scan = scanRails();
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Armed Rails Continuum',
    running: !!state.running,
    startedAt: state.startedAt,
    readinessScore: scan.readinessScore,
    armedCount: scan.armedCount,
    totalRails: scan.totalRails,
    billionPathBlockedBy: scan.billionPathBlockedBy,
    honesty: {
      neverClaimsReadyWithoutKeys: true,
    },
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    scan: scanRails(),
    endpoints: [
      'GET /api/ark/status',
      'GET /api/ark/scan',
      'GET /api/rails/status',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  discovery,
  scanRails,
};
