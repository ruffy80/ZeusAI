// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-11-03
// =====================================================================

'use strict';

let express = null;
try { express = require('express'); } catch (_) {}
const router = express && typeof express.Router === 'function' ? express.Router() : { get: () => {}, post: () => {}, use: () => {} };
const jsonParser = express && typeof express.json === 'function' ? express.json() : (req, res, next) => { if (next) next(); };
const crypto = require('crypto');
const db = require('../db');

/**
 * Modular Auth Router
 * Handles user authentication, token issuance, and passkey registration.
 */

// POST /api/auth/register
router.post('/register', jsonParser, (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !name) {
    return res.status(400).json({ ok: false, error: 'Email and name are required' });
  }

  const existing = db.users.findByEmail(email);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'User already exists' });
  }

  const id = 'usr_' + crypto.randomUUID();
  const passwordHash = crypto.createHash('sha256').update(password || 'guest').digest('hex');
  const user = db.users.create({
    id,
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  const sessionToken = crypto.randomBytes(32).toString('hex');
  db.adminSessions.create(sessionToken, user.email, 86400 * 7);

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email },
    token: sessionToken,
  });
});

// POST /api/auth/login
router.post('/login', jsonParser, (req, res) => {
  const { email, password } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: 'Email required' });

  const user = db.users.findByEmail(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  const hash = crypto.createHash('sha256').update(password || '').digest('hex');
  if (user.passwordHash && user.passwordHash !== hash && user.passwordHash !== 'guest') {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  db.adminSessions.create(sessionToken, user.email, 86400 * 7);

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email },
    token: sessionToken,
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthenticated' });
  }

  const session = db.adminSessions.find(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: 'Session expired' });
  }

  const user = db.users.findByEmail(session.email);
  res.json({
    ok: true,
    user: user ? { id: user.id, name: user.name, email: user.email } : { email: session.email },
    session: { active: true, expiresAt: session.expiresAt },
  });
});

module.exports = router;
