'use strict';

/**
 * unicorn-capability-router — resolves a module id to its census sheet.
 * The sheet is the file, the alias, the virtual worker, the absence, or the refusal.
 */

function resolve(name) {
  const census = require('./module-census-os');
  const row = census.find(name);
  if (!row) return { ok: false, found: false, id: String(name || '') };
  return { ok: true, found: true, id: row.id, kind: row.kind, path: row.path, category: row.category };
}

function getStatus() {
  const census = require('./module-census-os');
  const s = census.summary();
  return { ok: true, name: 'unicorn-capability-router', files: s.files, absent: s.absent, refused: s.refused };
}

module.exports = { resolve, getStatus, name: 'unicorn-capability-router' };
