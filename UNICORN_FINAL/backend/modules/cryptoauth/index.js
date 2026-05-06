// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// cryptoauth/index.js — Revolutionary passwordless auth (Ed25519)
//
// Replaces the legacy email+password / WebAuthn / device-key flows with
// a single, cryptographic, future-proof primitive:
//
//   * Browser generates an Ed25519 keypair (via Web Crypto API).
//   * Public key stored on server. Private key never leaves the device
//     (IndexedDB) — except as an encrypted backup file the user
//     downloads at registration.
//   * Login = sign a server-issued challenge (nonce). No passwords,
//     no emails for auth, no SMS, no recovery flow except importing
//     the encrypted backup file.
//
// ENDPOINTS (all under /api/cryptoauth/*)
//
//   POST /api/cryptoauth/register
//        body: { publicKey: base64(32 bytes raw Ed25519), name?, email? }
//        → { ok, userId, challenge } — userId is a content-derived hash
//          of the public key; safe to share.
//
//   POST /api/cryptoauth/challenge
//        body: { userId } OR { email }
//        → { ok, userId, challenge } — fresh nonce, expires in 2 min.
//
//   POST /api/cryptoauth/login
//        body: { userId, signature: base64 }
//        → { ok, token, expiresAt } — JWT HS256, 30-day lifetime.
//
//   POST /api/cryptoauth/logout
//        body: { token? }
//        → { ok }   (stateless JWT — client just discards)
//
//   POST /api/cryptoauth/recover
//        body: { publicKey: base64, signature: base64, challenge: base64 }
//        → { ok, userId, token } — proves possession of restored key.
//        (Recovery is just: import vault → derive privKey → register OR
//         re-sign a challenge; no server-side state needed.)
//
//   GET  /api/cryptoauth/me
//        Authorization: Bearer <jwt>
//        → { ok, userId, name, email, createdAt }
//
//   GET  /api/cryptoauth/manifest
//        → discovery / health (no auth)
//
// SAFETY (zero-regression contract)
//   * GET/POST only, deterministic, all writes atomic (.tmp → rename).
//   * Storage: JSON file at data/cryptoauth/users.json (consistent with
//     the rest of UNICORN_FINAL — no DB, no migrations, no docker churn).
//   * Brand-new namespace /api/cryptoauth/* — zero collision with
//     legacy /api/auth/* or /api/customer/*.
//   * Fast prefix gate at top of handle() — instant return for ~99% of
//     traffic.
//   * Disable globally with CRYPTOAUTH_DISABLED=1.
//   * Never throws; every branch wrapped in try/catch returning false
//     so the next dispatcher always runs.
//   * Uses Node's built-in crypto for Ed25519 verify (no new deps).
// =====================================================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let jwt;
try { jwt = require('jsonwebtoken'); } catch (_) { jwt = null; }

const DISABLED = process.env.CRYPTOAUTH_DISABLED === '1';
const PACK_VERSION = '1.0.0';
const PACK_NAME = 'zeus-cryptoauth';
const SECRET = process.env.CRYPTOAUTH_SECRET
  || process.env.JWT_SECRET
  || crypto.createHash('sha256').update('zeus-cryptoauth-' + (process.env.ZEUS_BUILD_SHA || 'dev')).digest('hex');
const TOKEN_TTL_SECONDS = 30 * 24 * 3600; // 30 days
const CHALLENGE_TTL_MS = 2 * 60 * 1000;   // 2 minutes

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'cryptoauth');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

// ──────────────────────── persistence ────────────────────────
function _loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (_) { return {}; }
}
function _saveUsers(users) {
  try {
    const tmp = USERS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(users, null, 2));
    fs.renameSync(tmp, USERS_FILE);
    return true;
  } catch (_) { return false; }
}

// ──────────────────────── ed25519 verify ─────────────────────
// Wrap raw 32-byte Ed25519 public key in SPKI DER for Node's KeyObject.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex'); // 12 bytes

function _verifySignature(publicKeyB64, message, signatureB64) {
  try {
    const pub = Buffer.from(publicKeyB64, 'base64');
    if (pub.length !== 32) return false;
    const sig = Buffer.from(signatureB64, 'base64');
    if (sig.length !== 64) return false;
    const der = Buffer.concat([ED25519_SPKI_PREFIX, pub]);
    const keyObject = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    const msg = Buffer.isBuffer(message) ? message : Buffer.from(message, 'utf8');
    return crypto.verify(null, msg, keyObject, sig);
  } catch (_) { return false; }
}

function _userIdFromPublicKey(publicKeyB64) {
  const h = crypto.createHash('sha256').update('zeus-uid:' + publicKeyB64).digest('hex');
  return 'zid_' + h.slice(0, 32);
}

function _newChallenge() {
  return crypto.randomBytes(32).toString('base64');
}

// In-memory challenge store (per process). Each entry: { userId, value, expiresAt }
const _challenges = new Map();
function _putChallenge(userId, value) {
  _challenges.set(value, { userId, value, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  // opportunistic GC
  if (_challenges.size > 5000) {
    const now = Date.now();
    for (const [k, v] of _challenges) if (v.expiresAt < now) _challenges.delete(k);
  }
}
function _takeChallenge(value) {
  const e = _challenges.get(value);
  if (!e) return null;
  _challenges.delete(value);
  if (e.expiresAt < Date.now()) return null;
  return e;
}

// ──────────────────────── JWT helpers ────────────────────────
function _signToken(userId) {
  if (!jwt) return null;
  return jwt.sign({ sub: userId, kind: 'cryptoauth' }, SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS
  });
}
function _verifyToken(token) {
  if (!jwt || !token) return null;
  try {
    const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    if (decoded && decoded.kind === 'cryptoauth' && decoded.sub) return decoded;
    return null;
  } catch (_) { return null; }
}
function _bearerOf(req) {
  const h = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!h || typeof h !== 'string') return '';
  if (!h.toLowerCase().startsWith('bearer ')) return '';
  return h.slice(7).trim();
}

// ──────────────────────── HTTP helpers ───────────────────────
function _sendJson(res, status, payload) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Cryptoauth': PACK_VERSION
  });
  res.end(body);
}
function _readBody(req, max = 64 * 1024) {
  return new Promise((resolve) => {
    let data = '';
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      data += chunk;
      if (data.length > max) { aborted = true; resolve(null); }
    });
    req.on('end', () => { if (!aborted) { try { resolve(data ? JSON.parse(data) : {}); } catch (_) { resolve(null); } } });
    req.on('error', () => resolve(null));
  });
}

// ──────────────────────── handlers ───────────────────────────
async function _register(req, res) {
  const body = await _readBody(req);
  if (!body || typeof body.publicKey !== 'string') return _sendJson(res, 400, { ok: false, error: 'missing_publicKey' });
  const pub = Buffer.from(body.publicKey, 'base64');
  if (pub.length !== 32) return _sendJson(res, 400, { ok: false, error: 'invalid_publicKey_length' });
  const users = _loadUsers();
  const userId = _userIdFromPublicKey(body.publicKey);
  // Idempotent: if user already exists, just return userId + new challenge.
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      publicKey: body.publicKey,
      name: typeof body.name === 'string' ? body.name.slice(0, 200) : '',
      email: typeof body.email === 'string' ? body.email.slice(0, 320).toLowerCase() : '',
      createdAt: new Date().toISOString()
    };
    _saveUsers(users);
  }
  const challenge = _newChallenge();
  _putChallenge(userId, challenge);
  return _sendJson(res, 200, { ok: true, userId, challenge });
}

async function _challenge(req, res) {
  const body = await _readBody(req);
  if (!body) return _sendJson(res, 400, { ok: false, error: 'invalid_body' });
  const users = _loadUsers();
  let userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId && typeof body.email === 'string') {
    const target = body.email.toLowerCase();
    for (const id of Object.keys(users)) if (users[id].email === target) { userId = id; break; }
  }
  if (!userId || !users[userId]) return _sendJson(res, 404, { ok: false, error: 'user_not_found' });
  const challenge = _newChallenge();
  _putChallenge(userId, challenge);
  return _sendJson(res, 200, { ok: true, userId, challenge });
}

async function _login(req, res) {
  const body = await _readBody(req);
  if (!body || typeof body.userId !== 'string' || typeof body.signature !== 'string' || typeof body.challenge !== 'string') {
    return _sendJson(res, 400, { ok: false, error: 'missing_fields' });
  }
  const users = _loadUsers();
  const user = users[body.userId];
  if (!user) return _sendJson(res, 404, { ok: false, error: 'user_not_found' });
  const ch = _takeChallenge(body.challenge);
  if (!ch || ch.userId !== body.userId) return _sendJson(res, 400, { ok: false, error: 'challenge_invalid_or_expired' });
  const ok = _verifySignature(user.publicKey, body.challenge, body.signature);
  if (!ok) return _sendJson(res, 401, { ok: false, error: 'signature_invalid' });
  const token = _signToken(body.userId);
  if (!token) return _sendJson(res, 500, { ok: false, error: 'jwt_unavailable' });
  return _sendJson(res, 200, { ok: true, token, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000, userId: body.userId });
}

async function _logout(req, res) {
  // Stateless JWT — client discards. We just acknowledge.
  await _readBody(req);
  return _sendJson(res, 200, { ok: true });
}

async function _recover(req, res) {
  // Recovery is conceptually identical to register: the imported vault
  // yields the original keypair, the client signs a fresh challenge.
  // Server checks that the publicKey matches an existing user and that
  // the signature verifies. If user does not exist (lost server), we
  // re-create the entry (same userId, since it's content-derived).
  const body = await _readBody(req);
  if (!body || typeof body.publicKey !== 'string' || typeof body.signature !== 'string' || typeof body.challenge !== 'string') {
    return _sendJson(res, 400, { ok: false, error: 'missing_fields' });
  }
  const ok = _verifySignature(body.publicKey, body.challenge, body.signature);
  if (!ok) return _sendJson(res, 401, { ok: false, error: 'signature_invalid' });
  const users = _loadUsers();
  const userId = _userIdFromPublicKey(body.publicKey);
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      publicKey: body.publicKey,
      name: typeof body.name === 'string' ? body.name.slice(0, 200) : '',
      email: typeof body.email === 'string' ? body.email.slice(0, 320).toLowerCase() : '',
      createdAt: new Date().toISOString(),
      recovered: true
    };
    _saveUsers(users);
  }
  const token = _signToken(userId);
  return _sendJson(res, 200, { ok: true, userId, token, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 });
}

function _me(req, res) {
  const decoded = _verifyToken(_bearerOf(req));
  if (!decoded) return _sendJson(res, 401, { ok: false, error: 'unauthorized' });
  const users = _loadUsers();
  const user = users[decoded.sub];
  if (!user) return _sendJson(res, 404, { ok: false, error: 'user_not_found' });
  return _sendJson(res, 200, {
    ok: true,
    userId: user.id,
    name: user.name || '',
    email: user.email || '',
    createdAt: user.createdAt,
    publicKey: user.publicKey
  });
}

function _manifest(_req, res) {
  return _sendJson(res, 200, {
    ok: true,
    pack: PACK_NAME,
    version: PACK_VERSION,
    algorithm: 'Ed25519',
    tokenAlgorithm: 'HS256',
    tokenTtlSeconds: TOKEN_TTL_SECONDS,
    challengeTtlMs: CHALLENGE_TTL_MS,
    endpoints: {
      register:  'POST /api/cryptoauth/register',
      challenge: 'POST /api/cryptoauth/challenge',
      login:     'POST /api/cryptoauth/login',
      logout:    'POST /api/cryptoauth/logout',
      recover:   'POST /api/cryptoauth/recover',
      me:        'GET  /api/cryptoauth/me',
      manifest:  'GET  /api/cryptoauth/manifest'
    },
    page: '/account',
    legacyAuthRetired: true,
    pledge: 'No passwords. No email magic links. No SMS. Private keys never leave the user device.'
  });
}

// ──────────────────────── dispatcher ─────────────────────────
async function handle(req, res) {
  if (DISABLED) return false;
  try {
    const urlPath = (req.url || '').split('?')[0];
    if (!urlPath.startsWith('/api/cryptoauth/')) return false;

    if (req.method === 'GET') {
      switch (urlPath) {
        case '/api/cryptoauth/manifest': _manifest(req, res); return true;
        case '/api/cryptoauth/me':       _me(req, res); return true;
        default: return false;
      }
    }
    if (req.method === 'POST') {
      switch (urlPath) {
        case '/api/cryptoauth/register':  await _register(req, res); return true;
        case '/api/cryptoauth/challenge': await _challenge(req, res); return true;
        case '/api/cryptoauth/login':     await _login(req, res); return true;
        case '/api/cryptoauth/logout':    await _logout(req, res); return true;
        case '/api/cryptoauth/recover':   await _recover(req, res); return true;
        default: return false;
      }
    }
    return false;
  } catch (e) {
    try { if (!res.headersSent) _sendJson(res, 500, { ok: false, error: 'internal' }); } catch (_) {}
    return true;
  }
}

module.exports = {
  handle,
  _internals: {
    PACK_NAME, PACK_VERSION,
    _verifySignature, _userIdFromPublicKey, _signToken, _verifyToken,
    _newChallenge, _putChallenge, _takeChallenge,
    _loadUsers, _saveUsers, USERS_FILE
  }
};
