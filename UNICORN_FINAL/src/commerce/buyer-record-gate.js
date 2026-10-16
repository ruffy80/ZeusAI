'use strict';

/**
 * BUYER RECORD GATE — BRG/1.0
 *
 * A vault, DNA strand, or personalization row is that buyer's record.
 * Anonymous ?email= is not proof. The caller may read or write the record
 * when the proven account email matches, or when a commerce/admin secret matches.
 */

const crypto = require('crypto');

function normEmail(value) {
  const clean = String(value || '').trim().toLowerCase();
  if (!clean || clean.indexOf('@') < 1) return '';
  return clean;
}

function decideBuyerRecord({ requestedEmail, provenEmail, admin } = {}) {
  const raw = String(requestedEmail || '').trim();
  const want = normEmail(raw);
  if (admin) {
    if (!raw) return { allow: false, status: 400, body: { ok: false, error: 'email_required' } };
    return { allow: true, email: want || raw };
  }
  const have = normEmail(provenEmail);
  if (!have) return { allow: false, status: 401, body: { ok: false, error: 'auth_required' } };
  if (raw && !want) return { allow: false, status: 403, body: { ok: false, error: 'email_mismatch' } };
  if (want && want !== have) return { allow: false, status: 403, body: { ok: false, error: 'email_mismatch' } };
  return { allow: true, email: have };
}

function _timingEqual(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  if (!b.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isRecordAdmin(req) {
  const headers = (req && req.headers) || {};
  const commerce = process.env.COMMERCE_ADMIN_SECRET || '';
  if (commerce && _timingEqual(headers['x-commerce-admin-secret'], commerce)) return true;
  const admin = process.env.ADMIN_SECRET || process.env.ADMIN_TOKEN || process.env.ADMIN_API_TOKEN || '';
  const presented = headers['x-admin-secret'] || headers['x-admin-token'] || '';
  if (admin && _timingEqual(presented, admin)) return true;
  return false;
}

function _cookie(req, name) {
  const raw = String((req && req.headers && req.headers.cookie) || '');
  const parts = raw.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch (_) { return ''; }
  }
  return '';
}

function provenBuyerEmail(req) {
  const headers = (req && req.headers) || {};
  const customerTok = String(headers['x-customer-token'] || _cookie(req, 'customer_session') || '').trim();
  if (customerTok) {
    try {
      const portal = require('./customer-portal');
      const cid = portal.verifyToken(customerTok);
      const customer = cid && portal.getById ? portal.getById(cid) : null;
      const email = normEmail(customer && customer.email);
      if (email) return email;
    } catch (_) { /* portal is optional on this process */ }
  }
  const auth = String(headers.authorization || headers.Authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer) return '';
  try {
    const cryptoauth = require('../../backend/modules/cryptoauth');
    const internals = cryptoauth && cryptoauth._internals;
    const decoded = internals && internals._verifyToken ? internals._verifyToken(bearer) : null;
    if (decoded && decoded.sub && internals._loadUsers) {
      const users = internals._loadUsers() || {};
      const email = normEmail(users[decoded.sub] && users[decoded.sub].email);
      if (email) return email;
    }
  } catch (_) { /* cryptoauth is optional */ }
  try {
    const secret = process.env.JWT_SECRET || '';
    if (!secret) return '';
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(bearer, secret);
    return normEmail(decoded && decoded.email);
  } catch (_) { return ''; }
}

module.exports = {
  PROTOCOL: 'BRG/1.0',
  normEmail,
  decideBuyerRecord,
  isRecordAdmin,
  provenBuyerEmail,
};
