// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// USCF/1.0 — Universal Supplier Connector Framework · contract helpers.
// Canonical commerce pipeline every connector must declare:
//   products → inventory → pricing → orders → fulfillment → tracking → returns

'use strict';

const PIPELINE_STAGES = Object.freeze([
  'products',
  'inventory',
  'pricing',
  'orders',
  'fulfillment',
  'tracking',
  'returns',
]);

const PLACEHOLDER_RE = /your_|changeme|xxx|placeholder|example|todo|insert/i;

function envArmed(name, minLen) {
  const v = String(process.env[name] || '').trim();
  if (!v) return false;
  if (PLACEHOLDER_RE.test(v)) return false;
  if (minLen && v.length < minLen) return false;
  return true;
}

function capabilityMatrix(caps) {
  const src = caps && typeof caps === 'object' ? caps : {};
  const out = {};
  for (const stage of PIPELINE_STAGES) {
    out[stage] = src[stage] === true;
  }
  return out;
}

function ownerAuthStep(opts) {
  opts = opts || {};
  return {
    needed: true,
    supplierId: opts.id || null,
    envVars: Array.isArray(opts.envVars) ? opts.envVars : [],
    docsUrl: opts.docsUrl || null,
    howTo: Array.isArray(opts.howTo) ? opts.howTo : [],
    armEndpoint: opts.armEndpoint || null,
    armScript: opts.armScript || null,
    note: opts.note || 'Owner must paste a real API credential — agents cannot invent supplier keys.',
  };
}

module.exports = {
  PIPELINE_STAGES,
  PLACEHOLDER_RE,
  envArmed,
  capabilityMatrix,
  ownerAuthStep,
};
