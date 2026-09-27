'use strict';

/**
 * Safe catalog overlay — notes/SEO/trust refs from data/catalog/sku-notes.json.
 * Never invents SKUs, prices, or GMV. Fail-soft.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'SCO/1.0';

function notesPath() {
  return process.env.SAFE_SKU_NOTES
    || path.resolve(__dirname, '..', '..', 'data', 'catalog', 'sku-notes.json');
}

let _cache = { ts: 0, notes: {} };

function loadNotes() {
  const now = Date.now();
  if (_cache.notes && now - _cache.ts < 5000) return _cache.notes;
  try {
    const raw = JSON.parse(fs.readFileSync(notesPath(), 'utf8'));
    const notes = (raw && typeof raw === 'object' && raw.notes && typeof raw.notes === 'object')
      ? raw.notes
      : (raw && typeof raw === 'object' ? raw : {});
    _cache = { ts: now, notes };
    return notes;
  } catch (_) {
    _cache = { ts: now, notes: {} };
    return {};
  }
}

function enrichCatalogItem(item) {
  if (!item || typeof item !== 'object') return item;
  const id = String(item.id || '');
  if (!id) return item;
  const notes = loadNotes();
  const note = notes[id];
  if (!note || typeof note !== 'object') return item;
  const out = Object.assign({}, item);
  if (note.trustNote && !out.trustNote) out.trustNote = String(note.trustNote).slice(0, 280);
  if (note.seoSlug && !out.seoSlug) out.seoSlug = String(note.seoSlug).slice(0, 80);
  if (note.deliveryProofRef && !out.deliveryProofRef) out.deliveryProofRef = String(note.deliveryProofRef).slice(0, 200);
  out.safeOverlay = true;
  return out;
}

function getStatus() {
  const notes = loadNotes();
  return {
    ok: true,
    protocol: PROTOCOL,
    noteCount: Object.keys(notes).length,
    inventsSku: false,
    inventsGmv: false,
    inventsPrice: false,
  };
}

module.exports = { PROTOCOL, enrichCatalogItem, getStatus, loadNotes };
