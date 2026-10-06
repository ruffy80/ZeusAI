'use strict';

/**
 * unicorn-vertical-demand-engine — counts inquiries the caller actually records.
 * Unknown verticals are rejected. The count starts at zero.
 */

const VERTICALS = [
  'fintech', 'ecommerce', 'legaltech', 'healthtech', 'manufacturing', 'real-estate',
  'cybersecurity', 'logistics', 'education', 'energy', 'government', 'creator-economy',
];

const counts = Object.create(null);

function record(vertical) {
  const id = String(vertical || '').trim().toLowerCase();
  if (!VERTICALS.includes(id)) return { ok: false, reason: 'unknown_vertical', id };
  counts[id] = (counts[id] || 0) + 1;
  return { ok: true, vertical: id, inquiries: counts[id] };
}

function getStatus() {
  return {
    ok: true,
    name: 'unicorn-vertical-demand-engine',
    inventsDemand: false,
    verticals: VERTICALS.map((id) => ({ id, inquiries: counts[id] || 0 })),
  };
}

module.exports = { VERTICALS, record, getStatus, name: 'unicorn-vertical-demand-engine' };
