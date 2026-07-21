// C11: Lightning integration (forward-only)
// Integrates with LND node for invoice creation and payment status.
// Only enabled when LND_REST_URL + LND_MACAROON are set (optionally LIGHTNING_ENABLED=1).
// Never invents a node or fake invoices when unconfigured.
// RO: Lightning doar dacă există nod LND real — altfel status honest + 503.

'use strict';

const axios = require('axios');

function _envArmed(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) return false;
  return !/^(your|skip|changeme|todo|placeholder|xxx+|none|null|undefined|tbd|n\/a)/i.test(v);
}

function isConfigured() {
  const enabledFlag = String(process.env.LIGHTNING_ENABLED || '').trim();
  // Explicit disable wins; otherwise presence of LND credentials arms the rail.
  if (enabledFlag === '0' || /^false$/i.test(enabledFlag)) return false;
  return _envArmed('LND_REST_URL') && _envArmed('LND_MACAROON');
}

function getStatus() {
  const configured = isConfigured();
  return {
    ok: true,
    module: 'lightning',
    configured,
    enabled: configured,
    restUrlSet: _envArmed('LND_REST_URL'),
    macaroonSet: _envArmed('LND_MACAROON'),
    lightEnabledFlag: String(process.env.LIGHTNING_ENABLED || '').trim() || null,
    endpoints: {
      status: '/api/lightning/status',
      invoice: 'POST /api/lightning/invoice',
    },
    note: configured
      ? 'LND credentials present — invoice creation available.'
      : 'Lightning dormant until LND_REST_URL + LND_MACAROON are set. No fake node.',
  };
}

async function createInvoice(amountSats, memo = '') {
  if (!isConfigured()) throw new Error('Lightning not configured');
  const LND_REST_URL = String(process.env.LND_REST_URL || '').replace(/\/$/, '');
  const LND_MACAROON = process.env.LND_MACAROON || '';
  const res = await axios.post(LND_REST_URL + '/v1/invoices', {
    value: amountSats,
    memo,
  }, {
    headers: { 'Grpc-Metadata-macaroon': LND_MACAROON },
    timeout: 15000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error('LND invoice failed: HTTP ' + res.status);
  }
  return res.data;
}

async function checkInvoice(rHash) {
  if (!isConfigured()) throw new Error('Lightning not configured');
  const LND_REST_URL = String(process.env.LND_REST_URL || '').replace(/\/$/, '');
  const LND_MACAROON = process.env.LND_MACAROON || '';
  const res = await axios.get(LND_REST_URL + '/v1/invoice/' + rHash, {
    headers: { 'Grpc-Metadata-macaroon': LND_MACAROON },
    timeout: 15000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error('LND check failed: HTTP ' + res.status);
  }
  return res.data;
}

module.exports = { createInvoice, checkInvoice, getStatus, isConfigured };
