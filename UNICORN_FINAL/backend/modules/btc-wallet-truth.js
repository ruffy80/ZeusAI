'use strict';

/**
 * BTC WALLET TRUTH — BWT/1.0
 *
 * Invoices must name a real owner wallet. The repo default exists so local
 * tests and documented owner-ops keep working; production can fail-closed
 * with COMMERCE_FAIL_CLOSED_BTC=1 when env is empty.
 *
 * Never mint to a silent unknown address in fail-closed mode.
 */

const REPO_DEFAULT_BTC = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const ENV_KEYS = [
  'BTC_WALLET_ADDRESS',
  'OWNER_BTC_ADDRESS',
  'LEGAL_OWNER_BTC',
  'BTC_OWNER_WALLET',
  'ZACC_BTC_ADDRESS',
];

function configuredOwnerBtc() {
  for (const k of ENV_KEYS) {
    const v = String(process.env[k] || '').trim();
    if (v) return v;
  }
  return null;
}

function failClosedRequested() {
  return String(process.env.COMMERCE_FAIL_CLOSED_BTC || '') === '1';
}

function allowRepoDefault() {
  if (String(process.env.COMMERCE_ALLOW_REPO_BTC || '') === '1') return true;
  if (failClosedRequested()) return false;
  return String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
}

function invoiceOwnerBtc() {
  const configured = configuredOwnerBtc();
  if (configured) return configured;
  if (allowRepoDefault()) return REPO_DEFAULT_BTC;
  return null;
}

function walletSource() {
  if (configuredOwnerBtc()) return 'env';
  if (invoiceOwnerBtc() === REPO_DEFAULT_BTC) return 'repo_default';
  return 'unconfigured';
}

function isInvoiceAllowed() {
  return !!invoiceOwnerBtc();
}

function refusePayload() {
  return {
    error: 'btc_wallet_unconfigured',
    status: 503,
    configured: false,
    reason: 'Set BTC_WALLET_ADDRESS (or OWNER_BTC_ADDRESS) before accepting payments, or COMMERCE_ALLOW_REPO_BTC=1 for documented owner default.',
  };
}

module.exports = {
  REPO_DEFAULT_BTC,
  ENV_KEYS,
  configuredOwnerBtc,
  invoiceOwnerBtc,
  walletSource,
  isInvoiceAllowed,
  allowRepoDefault,
  refusePayload,
};
