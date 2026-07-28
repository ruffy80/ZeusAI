// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

/**
 * Honest AWS auto-healer status. Never reports healthy:true when credentials
 * are absent — that lied to any consumer of the health signal.
 */
async function status() {
  // Region alone is not credentials — require key/profile.
  const configured = !!(
    process.env.AWS_ACCESS_KEY_ID
    || process.env.AWS_SECRET_ACCESS_KEY
    || process.env.AWS_PROFILE
  );
  if (!configured) {
    return {
      ok: true,
      provider: 'aws',
      configured: false,
      healthy: null,
      note: 'AWS credentials not set',
      ts: new Date().toISOString(),
    };
  }
  // Credentials present — report configured without inventing EC2 health.
  // Live describeRegions requires network; keep fail-soft here.
  return {
    ok: true,
    provider: 'aws',
    configured: true,
    healthy: null,
    note: 'credentials_present_probe_deferred',
    region: process.env.AWS_REGION || null,
    ts: new Date().toISOString(),
  };
}

function getStatus() {
  return status();
}

module.exports = { status, getStatus };
