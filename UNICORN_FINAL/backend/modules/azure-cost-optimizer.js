// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

async function status() {
  const configured = !!(
    process.env.AZURE_CLIENT_ID
    || process.env.AZURE_TENANT_ID
    || process.env.AZURE_SUBSCRIPTION_ID
  );
  return {
    ok: true,
    provider: 'azure',
    configured,
    estimatedSavingsUsdMonth: configured ? null : 0,
    note: configured ? 'credentials_present' : 'Azure credentials not set',
    ts: new Date().toISOString(),
  };
}

function getStatus() {
  return status();
}

module.exports = { status, getStatus };
