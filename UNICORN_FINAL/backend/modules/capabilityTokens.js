// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.334Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const actors = new Map();
const revoked = new Set();

function _id() {
  return 'cap_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function issue(actor = 'system', scopes = ['read']) {
  const tokenId = _id();
  const rec = { tokenId, actor, scopes: Array.isArray(scopes) ? scopes : [String(scopes)], issuedAt: new Date().toISOString() };
  actors.set(tokenId, rec);
  return { ok: true, tokenId, actor, scopes: rec.scopes };
}

function revoke(tokenId) {
  if (!tokenId) return { ok: false, error: 'tokenId_required' };
  revoked.add(String(tokenId));
  return { ok: true, revoked: true, tokenId: String(tokenId) };
}

function listActors() {
  return Array.from(actors.values()).map((x) => Object.assign({}, x, { revoked: revoked.has(x.tokenId) }));
}

function verify(tokenId, scope) {
  const rec = actors.get(String(tokenId));
  if (!rec) return { ok: false, valid: false, reason: 'unknown' };
  if (revoked.has(rec.tokenId)) return { ok: false, valid: false, reason: 'revoked' };
  if (scope && !rec.scopes.includes(scope)) return { ok: false, valid: false, reason: 'scope_denied' };
  return { ok: true, valid: true, actor: rec.actor, scopes: rec.scopes };
}

issue('bootstrap', ['read', 'write']);

module.exports = { issue, revoke, listActors, verify };
