// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.340Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * revenue-autopilot.js — DEPRECATED ALIAS
 * 
 * This module has been consolidated into profit-autopilot.js which provides
 * superior revenue automation with multi-channel support and AI-driven pricing.
 * 
 * MIGRATION PATH:
 * - OLD: require('./revenue-autopilot').runOnce()
 * - NEW: require('./profit-autopilot').refresh()
 * 
 * DEPRECATION TIMELINE:
 * - 2026-08-06: Marked deprecated, forwarded to profit-autopilot
 * - 2026-09-06: Warning logs enabled on all calls
 * - 2026-10-06: Removal from production; developers must migrate
 */

const profitAutopilot = require('./profit-autopilot');

let callCount = 0;

function _deprecated(operation) {
  callCount++;
  if (callCount % 10 === 0) {
    console.warn('[DEPRECATION] revenue-autopilot module is deprecated. Use profit-autopilot instead.');
  }
  return {
    ok: true,
    deprecation: 'revenue-autopilot.js is deprecated; use profit-autopilot.js',
    operation,
    callCount,
    ts: new Date().toISOString(),
  };
}

/**
 * Legacy API: runOnce() — now forwarded to profit-autopilot refresh()
 */
function runOnce() {
  try {
    const result = profitAutopilot.refresh && typeof profitAutopilot.refresh === 'function'
      ? profitAutopilot.refresh()
      : { ok: false, error: 'profit-autopilot not initialized' };
    return {
      ...result,
      deprecated: true,
      deprecation: 'Use profit-autopilot.refresh() directly',
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      deprecated: true,
      callCount,
    };
  }
}

/**
 * Legacy API: status() — now forwarded to profit-autopilot status()
 */
function status() {
  try {
    const result = profitAutopilot.status && typeof profitAutopilot.status === 'function'
      ? profitAutopilot.status()
      : { ok: false, error: 'profit-autopilot not initialized' };
    return {
      ...result,
      deprecated: true,
      module: 'revenue-autopilot (DEPRECATED)',
      recommendation: 'Migrate to profit-autopilot.js for active revenue optimization',
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      deprecated: true,
    };
  }
}

/**
 * Direct access to profit-autopilot (recommended)
 */
function getProfitAutopilot() {
  return profitAutopilot;
}

module.exports = {
  runOnce,
  status,
  getProfitAutopilot,
  deprecated: true,
  deprecationNotice: 'Use profit-autopilot module directly for active revenue automation',
};
