// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-08-11T04:16:23.642Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * health-status.js
 * Pure, dependency-free derivation of the backend health status/dbConnected
 * fields. Extracted so it can be unit-tested without booting the full backend
 * (backend/index.js pulls in the entire runtime just to require it).
 *
 * Contract:
 *   - dbConnected mirrors durable SQLite persistence (persistence.durable).
 *   - status is 'ok' only when durable AND not draining; otherwise 'degraded'.
 */
function deriveHealthStatus({ durable, drainMode } = {}) {
  const dbConnected = durable === true;
  const status = (dbConnected && !drainMode) ? 'ok' : 'degraded';
  return { status, dbConnected };
}

module.exports = { deriveHealthStatus };
