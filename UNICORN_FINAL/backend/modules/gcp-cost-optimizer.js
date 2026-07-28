// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

async function status() {
  const configured = !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS
    || process.env.GCP_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
  );
  return {
    ok: true,
    provider: 'gcp',
    configured,
    estimatedSavingsUsdMonth: configured ? null : 0,
    note: configured ? 'credentials_present' : 'GCP credentials not set',
    ts: new Date().toISOString(),
  };
}

function getStatus() {
  return status();
}

module.exports = { status, getStatus };
