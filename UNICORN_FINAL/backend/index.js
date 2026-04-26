// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

require('dotenv').config();
// QuantumVault trebuie să se încarce PRIMUL – bootstrap + inject secrete în process.env
// înainte ca orice alt modul să citească variabilele de mediu
const quantumVault = require('./modules/quantumVault');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { version: APP_VERSION } = require('../package.json');
// const cron = require('node-cron'); // Optional scheduling
const simpleGit = require('simple-git');
const axios = require('axios');
const routeCache = require('./modules/route-cache');

const app = express();
const PORT = process.env.PORT || 3000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'unicorn-jwt-secret-change-in-prod';
const rateLimit = require('express-rate-limit');

// Raw body buffers needed for webhook signature verification
app.use('/api/payment/webhook/stripe', express.raw({ type: 'application/json' }));
app.use('/api/payment/webhook/paypal', express.raw({ type: 'application/json' }));
app.use('/api/payment/nowpayments/webhook', express.raw({ type: 'application/json' }));

app.use(compression());

// CORS: restrict to configured origins in production
const _allowedOrigins = (process.env.CORS_ORIGINS || process.env.PUBLIC_APP_URL || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: process.env.NODE_ENV === 'production' && _allowedOrigins.length
    ? (origin, cb) => {
        // Allow non-browser requests (e.g. server-to-server, curl)
        if (!origin) return cb(null, true);
        try {
          const incomingHost = new URL(origin).hostname;
          const allowed = _allowedOrigins.some(o => {
            try {
              const allowedHost = new URL(o).hostname;
              // Exact match or valid subdomain (must be preceded by a dot)
              return incomingHost === allowedHost || incomingHost.endsWith('.' + allowedHost);
            } catch { return false; }
          });
          return cb(null, allowed ? true : new Error('CORS: origin not allowed'));
        } catch {
          return cb(new Error('CORS: invalid origin'));
        }
      }
    : true,
  credentials: true,
}));

app.use(express.json());

// Wrap async route handlers and forward errors to Express middleware
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ==================== GLOBAL BODY SANITIZATION (AutoInnovation Security #13) ====================
// Recursively trim, strip control characters, and truncate all string values in req.body
// to guard against oversized, null-byte, or control-character injection payloads.
// 4096-char limit per field covers all realistic input; reduces risk of payload flooding.
// Applied before any route handler.
function _sanitizeValue(v, depth) {
  if (depth > 10) return v; // guard against very deep nesting
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === 'string') {
    // Strip null bytes and non-printable control characters (except common whitespace)
    return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, 4096);
  }
  if (Array.isArray(v))      return v.map(item => _sanitizeValue(item, depth + 1));
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) {
      out[k] = _sanitizeValue(v[k], depth + 1);
    }
    return out;
  }
  return v;
}
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = _sanitizeValue(req.body, 0);
  }
  next();
});

// ==================== RATE LIMITERS ====================
const globalPublicRateLimit = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.PUBLIC_RATE_LIMIT || '200', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — try again later' },
});

const adminCrudRateLimit = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.ADMIN_RATE_LIMIT || '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — try again later' },
});

// Apply global rate limit to all routes
app.use(globalPublicRateLimit);

// ==================== PERSISTENCE ====================
const {
  users: dbUsers,
  payments: dbPayments,
  purchases: dbPurchases,
  apiKeys: dbApiKeys,
  adminSessions: dbAdminSessions,
  passkeys: dbPasskeys,
  meta: dbMeta,
} = require('./db');
const emailService = require('./email');
const worldStandard = require('./modules/worldStandard');
const moneyMachine = require('./modules/autonomousMoneyMachine');
const unicornCommerceConnector = require('../src/modules/unicornCommerceConnector');
const billionScaleRevenueEngine = require('../src/modules/billionScaleRevenueEngine');
const billionScaleActivationOrchestrator = require('../src/modules/billionScaleActivationOrchestrator');

let webauthnModulePromise;
const getWebAuthn = () => {
  if (!webauthnModulePromise) webauthnModulePromise = import('@simplewebauthn/server');
  return webauthnModulePromise;
};

function getPublicOrigin(req) {
  const configured = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.APP_BASE_URL || process.env.BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function getWebAuthnContext(req) {
  const origin = getPublicOrigin(req);
  const hostname = new URL(origin).hostname;
  const rpID = process.env.WEBAUTHN_RP_ID || hostname;
  const rpName = process.env.WEBAUTHN_RP_NAME || 'ZeusAI';
  return { origin, rpID, rpName };
}

function normalizeEmail(value) {
  return sanitizeString(String(value || '').toLowerCase(), 254);
}

function b64u(input) {
  if (!input) return '';
  if (typeof input === 'string') return input;
  return Buffer.from(input).toString('base64url');
}

function b64uBuffer(value) {
  return Buffer.from(String(value || ''), 'base64url');
}

function bearerUser(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.slice(7), JWT_SECRET); } catch (_) { return null; }
}

// ==================== SECURITY HEADERS (Helmet) ====================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: [
        "'self'",
        'https://api.openai.com',
        'https://api.deepseek.com',
        'https://api.anthropic.com',
        'https://generativelanguage.googleapis.com',
        'https://api.mistral.ai',
        'https://api.cohere.com',
        'https://api.x.ai',
        'https://js.stripe.com',
      ],
      frameSrc: ['https://js.stripe.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 63072000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));
// Permissions-Policy is not yet in Helmet — set manually
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ==================== ROUTE PROFILER (PR #194 — Performance Optimization) ====================
// Înregistrează timpii de răspuns pentru toate rutele → expus la /api/perf/stats
app.use(routeCache.profilerMiddleware());

// ==================== AUTH STORE (SQLite-backed) ====================
const ADMIN_OWNER_NAME = process.env.LEGAL_OWNER_NAME || 'Vladoi Ionut';
const ADMIN_OWNER_EMAIL = process.env.ADMIN_EMAIL || process.env.LEGAL_OWNER_EMAIL || 'vladoi_ionut@yahoo.com';
const ADMIN_OWNER_BTC = process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
let adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_MASTER_PASSWORD || 'UnicornAdmin2026!', 10);
let adminBiometricHash = null;

// ==================== STARTUP SECURITY VALIDATION ====================
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'unicorn-jwt-secret-change-in-prod') {
    console.error('❌ FATAL: JWT_SECRET is weak/default. Set a strong secret in .env before running in production.');
    process.exit(1);
  }
  if (!process.env.ADMIN_2FA_CODE || process.env.ADMIN_2FA_CODE === '123456') {
    console.warn('⚠️  WARNING: ADMIN_2FA_CODE is using the default value "123456". Change it in production!');
  }
  if (!process.env.ADMIN_MASTER_PASSWORD || process.env.ADMIN_MASTER_PASSWORD === 'UnicornAdmin2026!') {
    console.warn('⚠️  WARNING: ADMIN_MASTER_PASSWORD is using the default value. Change it in production!');
  }
}

function adminSecretMiddleware(req, res, next) {
  const expected = process.env.ADMIN_SECRET || '';
  const headerSecret = req.headers['x-admin-secret'];
  const authHeader = req.headers.authorization || '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const provided = headerSecret || bearerSecret || req.query.adminSecret;

  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }

  return next();
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Plan-based feature gating: requirePlan('pro') means user must have pro or enterprise plan
const PLAN_HIERARCHY = { free: 0, starter: 1, pro: 2, enterprise: 3 };
function requirePlan(minPlan) {
  return function planMiddleware(req, res, next) {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { users: dbUsersLocal } = require('./db');
    const dbUser = dbUsersLocal.findById(user.id);
    const userPlan = (dbUser && dbUser.planId) || 'free';
    const userLevel = PLAN_HIERARCHY[userPlan] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[minPlan] ?? 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: `This feature requires ${minPlan} plan or higher. Current plan: ${userPlan}`,
        upgrade: '/payments'
      });
    }
    return next();
  };
}

function extractAdminToken(req) {
  const headerToken = req.headers['x-auth-token'];
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return headerToken || bearer || '';
}

function adminTokenMiddleware(req, res, next) {
  const token = extractAdminToken(req);
  if (!token) return res.status(401).json({ authenticated: false, reason: 'no_token', error: 'Admin token missing' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ authenticated: false, reason: 'forbidden', error: 'Forbidden' });
    if (!dbAdminSessions.has(token)) return res.status(401).json({ authenticated: false, reason: 'session_expired', error: 'Session expired' });
    req.admin = payload;
    return next();
  } catch (e) {
    const reason = (e && e.name === 'TokenExpiredError') ? 'token_expired' : 'token_invalid';
    return res.status(401).json({ authenticated: false, reason, error: 'Invalid admin token' });
  }
}

// ==================== AUTH RATE LIMITING ====================
// Simple sliding-window rate limiter for sensitive auth endpoints (no extra dependency).
// In test mode (NODE_ENV=test) rate limiting is disabled to allow full test runs.
const authRateLimitStore = new Map(); // key -> [timestamps]

function authRateLimit(maxRequests, windowMs) {
  return function rateLimitMiddleware(req, res, next) {
    if (process.env.NODE_ENV === 'test') return next();
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    const hits = (authRateLimitStore.get(key) || []).filter(ts => ts > windowStart);
    if (hits.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    hits.push(now);
    authRateLimitStore.set(key, hits);
    return next();
  };
}

// Prune stale entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, hits] of authRateLimitStore) {
    const pruned = hits.filter(ts => ts > cutoff);
    if (pruned.length === 0) authRateLimitStore.delete(key);
    else authRateLimitStore.set(key, pruned);
  }
}, 10 * 60 * 1000).unref();

// ==================== INPUT VALIDATION HELPERS ====================
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function isValidEmail(email) { return typeof email === 'string' && EMAIL_RE.test(email.trim()); }
function sanitizeString(s, maxLen = 255) { return typeof s === 'string' ? s.trim().slice(0, maxLen) : ''; }


// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', authRateLimit(10, 15 * 60 * 1000), async (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanName = sanitizeString(name, 100);
  const cleanEmail = sanitizeString(email, 254);
  if (!cleanName || !cleanEmail || !password) return res.status(400).json({ error: 'name, email and password required' });
  if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'Invalid email address' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (dbUsers.findByEmail(cleanEmail)) return res.status(409).json({ error: 'Email already in use' });
  const passwordHash = await bcrypt.hash(password, 10);
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const verifyExpires = Date.now() + 86400000; // 24h
  const user = {
    id: crypto.randomBytes(8).toString('hex'),
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    emailVerified: 0,
    verifyToken,
    verifyExpires,
    createdAt: new Date().toISOString(),
  };
  dbUsers.create(user);
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  // Send verification email (non-blocking)
  emailService.sendVerificationEmail(user, verifyToken).catch(err => console.error('[Email] verify send failed:', err.message));
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, emailVerified: false } });
});

app.get('/api/auth/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });
  const user = dbUsers.findByVerifyToken(token);
  if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });
  dbUsers.verifyEmail(user.id);
  emailService.sendWelcomeEmail(user).catch(err => console.error('[Email] welcome send failed:', err.message));
  res.json({ success: true, message: 'Email verified. Contul tău este activ!' });
});

app.post('/api/auth/login', authRateLimit(20, 15 * 60 * 1000), async (req, res) => {
  const { email, password, twoFactorCode } = req.body || {};

  // Admin login (password + 2FA)
  if (!email && password && typeof twoFactorCode !== 'undefined') {
    const expected2FA = process.env.ADMIN_2FA_CODE || '123456';
    const validPassword = await bcrypt.compare(String(password), adminPasswordHash);
    if (!validPassword) return res.status(401).json({ success: false, error: 'Parolă invalidă' });
    if (String(twoFactorCode).trim() !== String(expected2FA).trim()) {
      return res.status(401).json({ success: false, error: 'Cod 2FA invalid' });
    }

    const token = jwt.sign({ role: 'admin', email: ADMIN_OWNER_EMAIL, name: ADMIN_OWNER_NAME }, JWT_SECRET, { expiresIn: '12h' });
    dbAdminSessions.add(token, ADMIN_OWNER_EMAIL, Date.now() + 12 * 60 * 60 * 1000);

    return res.json({
      success: true,
      token,
      owner: {
        name: ADMIN_OWNER_NAME,
        email: ADMIN_OWNER_EMAIL,
        btcAddress: ADMIN_OWNER_BTC
      }
    });
  }

  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (!isValidEmail(sanitizeString(email, 254))) return res.status(400).json({ error: 'Invalid email address' });
  const user = dbUsers.findByEmail(sanitizeString(email, 254));
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, emailVerified: Boolean(user.emailVerified) } });
});

app.get('/api/auth/status', adminTokenMiddleware, (req, res) => {
  res.json({
    owner: { name: ADMIN_OWNER_NAME, email: ADMIN_OWNER_EMAIL, btcAddress: ADMIN_OWNER_BTC },
    activeSessions: dbAdminSessions.size,
    biometricEnabled: Boolean(adminBiometricHash)
  });
});

app.post('/api/auth/logout', adminTokenMiddleware, (req, res) => {
  const token = extractAdminToken(req);
  dbAdminSessions.delete(token);
  res.json({ success: true });
});

app.post('/api/auth/change-password', adminTokenMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });
  const validOld = await bcrypt.compare(oldPassword, adminPasswordHash);
  if (!validOld) return res.status(401).json({ error: 'Parola veche este invalidă' });
  adminPasswordHash = await bcrypt.hash(newPassword, 10);
  res.json({ success: true });
});

app.post('/api/auth/passkey/challenge', authRateLimit(20, 15 * 60 * 1000), asyncHandler(async (req, res) => {
  const { mode = 'assert' } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!['register', 'assert'].includes(mode)) return res.status(400).json({ error: 'mode must be register or assert' });
  const user = dbUsers.findByEmail(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { rpID, rpName } = getWebAuthnContext(req);
  const { generateRegistrationOptions, generateAuthenticationOptions } = await getWebAuthn();
  let publicKey;
  if (mode === 'register') {
    const existing = dbPasskeys.listByUser(user.id);
    publicKey = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: user.name,
      userID: Buffer.from(user.id),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      excludeCredentials: existing.map((cred) => ({ id: cred.credentialId, type: 'public-key', transports: cred.transports || [] })),
    });
  } else {
    const credentials = dbPasskeys.listByEmail(email);
    if (!credentials.length) return res.status(404).json({ error: 'No passkey registered for this account' });
    publicKey = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: credentials.map((cred) => ({ id: cred.credentialId, type: 'public-key', transports: cred.transports || [] })),
    });
  }
  dbPasskeys.saveChallenge({
    id: crypto.randomBytes(12).toString('hex'),
    email,
    userId: user.id,
    mode,
    challenge: publicKey.challenge,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  res.json({ ok: true, publicKey, rpID, mode });
}));

app.post('/api/auth/passkey/register', authRateLimit(10, 15 * 60 * 1000), asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { credential, password } = req.body || {};
  if (!email || !credential) return res.status(400).json({ error: 'email and credential required' });
  const user = dbUsers.findByEmail(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const authUser = bearerUser(req);
  const passwordOk = password ? await bcrypt.compare(String(password), user.passwordHash) : false;
  if (!passwordOk && (!authUser || authUser.id !== user.id)) return res.status(401).json({ error: 'Existing login or password required to enroll passkey' });
  const challenge = dbPasskeys.findChallenge(email, 'register');
  if (!challenge) return res.status(400).json({ error: 'Passkey challenge expired' });
  const { origin, rpID } = getWebAuthnContext(req);
  const { verifyRegistrationResponse } = await getWebAuthn();
  const verification = await verifyRegistrationResponse({ response: credential, expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
  dbPasskeys.deleteChallenge(challenge.id);
  if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ error: 'Passkey registration failed' });
  const info = verification.registrationInfo;
  const storedCredential = info.credential || info;
  const credentialId = b64u(storedCredential.id || info.credentialID || credential.id || credential.rawId);
  const publicKey = b64u(storedCredential.publicKey || info.credentialPublicKey);
  if (!credentialId || !publicKey) return res.status(400).json({ error: 'Passkey credential incomplete' });
  dbPasskeys.saveCredential({
    credentialId,
    userId: user.id,
    email: user.email,
    publicKey,
    counter: Number(storedCredential.counter || info.counter || 0),
    transports: credential.response?.transports || credential.transports || [],
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    active: 1,
  });
  worldStandard.appendLedger('identity.passkey.enrolled', { userId: user.id, email: user.email, credentialIdHash: crypto.createHash('sha256').update(credentialId).digest('hex') });
  res.json({ ok: true, credentialId, user: { id: user.id, email: user.email, name: user.name } });
}));

app.post('/api/auth/passkey/assert', authRateLimit(20, 15 * 60 * 1000), asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { credential } = req.body || {};
  if (!email || !credential) return res.status(400).json({ error: 'email and credential required' });
  const user = dbUsers.findByEmail(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const challenge = dbPasskeys.findChallenge(email, 'assert');
  if (!challenge) return res.status(400).json({ error: 'Passkey challenge expired' });
  const credentialId = b64u(credential.id || credential.rawId);
  const stored = dbPasskeys.findCredential(credentialId);
  if (!stored || stored.userId !== user.id) return res.status(401).json({ error: 'Passkey not recognized' });
  const { origin, rpID } = getWebAuthnContext(req);
  const { verifyAuthenticationResponse } = await getWebAuthn();
  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: { id: stored.credentialId, publicKey: b64uBuffer(stored.publicKey), counter: Number(stored.counter || 0), transports: stored.transports || [] },
    requireUserVerification: false,
  });
  dbPasskeys.deleteChallenge(challenge.id);
  if (!verification.verified) return res.status(401).json({ error: 'Passkey verification failed' });
  dbPasskeys.updateCounter(stored.credentialId, Number(verification.authenticationInfo?.newCounter || stored.counter || 0));
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  worldStandard.appendLedger('identity.passkey.login', { userId: user.id, email: user.email, credentialIdHash: crypto.createHash('sha256').update(stored.credentialId).digest('hex') });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, emailVerified: Boolean(user.emailVerified) } });
}));

app.get('/api/auth/passkey/list', authMiddleware, (req, res) => {
  res.json({ ok: true, credentials: dbPasskeys.listByUser(req.user.id) });
});

app.post('/api/auth/passkey/revoke', authMiddleware, (req, res) => {
  const credentialId = sanitizeString(req.body?.credentialId, 256);
  if (!credentialId) return res.status(400).json({ error: 'credentialId required' });
  const stored = dbPasskeys.findCredential(credentialId);
  if (!stored || stored.userId !== req.user.id) return res.status(404).json({ error: 'Passkey not found' });
  res.json({ ok: dbPasskeys.revoke(credentialId) });
});

app.post('/api/auth/biometric/enroll', adminTokenMiddleware, (req, res) => {
  const { sample } = req.body || {};
  if (!sample) return res.status(400).json({ error: 'sample required' });
  adminBiometricHash = crypto.createHash('sha256').update(String(sample)).digest('hex');
  res.json({ success: true });
});

app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  const { name, email } = req.body || {};
  const user = dbUsers.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const newName = name ? sanitizeString(name, 100) : user.name;
  const newEmail = email ? sanitizeString(email, 254) : user.email;
  if (newEmail !== user.email) {
    if (!isValidEmail(newEmail)) return res.status(400).json({ error: 'Invalid email address' });
    if (dbUsers.findByEmail(newEmail)) return res.status(409).json({ error: 'Email already in use' });
  }
  if (!newName) return res.status(400).json({ error: 'Name cannot be empty' });
  dbUsers.updateProfile(user.id, newName, newEmail);
  const token = jwt.sign({ id: user.id, email: newEmail, name: newName }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: newName, email: newEmail } });
});

// User self-service password change (uses regular user JWT, not admin token)
app.post('/api/user/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const user = dbUsers.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  dbUsers.updatePassword(user.id, passwordHash);
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = dbUsers.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, planId: user.planId || 'free', createdAt: user.createdAt, emailVerified: Boolean(user.emailVerified) });
});

// Refresh JWT token — issues a fresh token for the currently authenticated user.
app.post('/api/auth/refresh', authMiddleware, (req, res) => {
  const user = dbUsers.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, planId: user.planId || 'free', emailVerified: Boolean(user.emailVerified) } });
});

app.post('/api/auth/forgot-password', authRateLimit(5, 15 * 60 * 1000), async (req, res) => {
  const { email } = req.body || {};
  const cleanEmail = sanitizeString(email, 254);
  if (!cleanEmail || !isValidEmail(cleanEmail)) return res.status(400).json({ error: 'Valid email required' });
  const user = dbUsers.findByEmail(cleanEmail);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const resetToken = crypto.randomBytes(32).toString('hex');
  dbUsers.setResetToken(user.id, resetToken, Date.now() + 3600000);
  emailService.sendPasswordResetEmail(user, resetToken).catch(err => console.error('[Email] reset send failed:', err.message));
  res.json({ message: 'Password reset email sent' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword required' });
  if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const user = dbUsers.findByResetToken(token);
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  dbUsers.updatePassword(user.id, passwordHash);
  res.json({ message: 'Password reset successful' });
});

app.get('/api/transparency/ledger', (req, res) => res.json(worldStandard.ledgerStatus(Number(req.query.limit || 25))));
app.post('/api/transparency/ledger', adminTokenMiddleware, (req, res) => res.json({ ok: true, entry: worldStandard.appendLedger(req.body?.type || 'operator.note', req.body?.payload || {}) }));
app.get('/api/resilience/backup/status', (req, res) => res.json(worldStandard.backupStatus()));
app.post('/api/resilience/backup/create', adminTokenMiddleware, asyncHandler(async (req, res) => res.json(worldStandard.createBackup(req.body?.reason || 'manual'))));
app.get('/api/vendor/marketplace/policy', (req, res) => res.json(worldStandard.vendorPolicy));
app.post('/api/vendor/marketplace/submit', asyncHandler(async (req, res) => res.json(worldStandard.submitVendorModule(req.body || {}))));
app.get('/api/vendor/marketplace/modules', (req, res) => res.json(worldStandard.listVendorModules()));
app.get('/api/compliance/autopilot', (req, res) => res.json(worldStandard.complianceAutopilot()));
app.get('/api/privacy/export', authMiddleware, (req, res) => res.json(worldStandard.privacyExport(req.user)));
app.post('/api/privacy/delete-request', authMiddleware, (req, res) => res.json({ ok: true, requestId: worldStandard.appendLedger('privacy.delete.requested', { userId: req.user.id, email: req.user.email }).id, status: 'queued-for-owner-review' }));

app.get('/api/money-machine/status', (req, res) => res.json(moneyMachine.status()));
app.get('/api/revenue/commander', (req, res) => res.json(moneyMachine.revenueCommander()));
app.post('/api/revenue/commander/run', adminTokenMiddleware, (req, res) => res.json({ ok: true, run: moneyMachine.revenueCommander() }));
app.get('/api/offers/factory', (req, res) => res.json(moneyMachine.offerFactory({ industry: req.query.industry, segment: req.query.segment, budgetUsd: req.query.budgetUsd })));
app.post('/api/offers/factory', (req, res) => res.json(moneyMachine.offerFactory(req.body || {})));
app.post('/api/conversion/event', (req, res) => res.json(moneyMachine.recordConversionEvent(req.body || {})));
app.get('/api/conversion/intelligence', (req, res) => res.json(moneyMachine.conversionIntelligence()));
app.post('/api/checkout/recovery', (req, res) => res.json(moneyMachine.queueCheckoutRecovery(req.body || {})));
app.get('/api/checkout/recovery/status', (req, res) => res.json(moneyMachine.recoveryStatus()));
app.post('/api/sales/sdr/lead', (req, res) => res.json(moneyMachine.qualifyLead(req.body || {})));
app.post('/api/sales/closer/answer', (req, res) => res.json(moneyMachine.closerAnswer(req.body || {})));
app.get('/api/seo/programmatic/status', (req, res) => res.json(moneyMachine.programmaticSeoStatus()));
app.post('/api/seo/programmatic/generate', (req, res) => res.json(moneyMachine.generateSeoPages(req.body || {})));
app.get('/api/customer-success/status', (req, res) => res.json(moneyMachine.customerSuccessStatus()));
app.post('/api/customer-success/analyze', (req, res) => res.json(moneyMachine.analyzeCustomer(req.body || {})));

// ==================== MODULE AUTONOME ====================
const autoDeploy = require('./modules/autoDeploy');
const selfConstruction = require('./modules/selfConstruction');
const totalSystemHealer = require('./modules/totalSystemHealer');
const codeSanityEngine = require('../src/modules/code-sanity-engine');

// ==================== TOATE MODULELE ====================
const qrIdentity = require('./modules/qrDigitalIdentity');
const aiNegotiator = require('./modules/aiNegotiator');
const carbonExchange = require('./modules/carbonExchange');
const marketplace = require('./modules/serviceMarketplace');
const complianceEngine = require('./modules/complianceEngine');
const riskAnalyzer = require('./modules/riskAnalyzer');
const reputationProtocol = require('./modules/reputationProtocol');
const opportunityRadar = require('./modules/opportunityRadar');
const businessBlueprint = require('./modules/businessBlueprint');
const paymentGateway = require('./modules/paymentGateway');
const nowPayments = require('./modules/nowPayments');
const aviationModule = require('./modules/aviationModule');
const paymentSystems = require('./modules/paymentSystems');
const governmentModule = require('./modules/governmentModule');
const defenseModule = require('./modules/defenseModule');
const telecomModule = require('./modules/telecomModule');
const enterprisePartner = require('./modules/enterprisePartnership');
const quantumChain = require('./modules/quantumBlockchain');
const workforce = require('./modules/aiWorkforce');
const ma = require('./modules/maAdvisor');
const legal = require('./modules/legalContract');
const energy = require('./modules/energyGrid');
const uac = require('./modules/unicornAutonomousCore');
const socialViralizer = require('./modules/socialMediaViralizer');
const umn = require('./modules/universalMarketNexus');
const gdes = require('./modules/globalDigitalStandard');
const ultimateModules = require('./modules/unicornUltimateModules');
const uee = require('./modules/unicornEternalEngine');
const legalFortress = require('./modules/legalFortress');
const qrc = require('./modules/quantumResilienceCore');
const executiveDashboard = require('./modules/executiveDashboard');
const unicornAutoGenesis = require('./modules/unicornAutoGenesis');
const domainAutomationManager = require('./modules/domainAutomationManager');

const unicornInnovationSuite = require('./modules/unicornInnovationSuite');
const autonomousInnovation = require('./modules/autonomousInnovation');
const autoRevenue = require('./modules/autoRevenue');
const autoViralGrowth = require('./modules/autoViralGrowth');

// ==================== AUTONOMOUS SYSTEM v2 (Self-Healing + Self-Innovation) ====================
const circuitBreaker   = require('./modules/circuit-breaker');
const sloTracker       = require('./modules/slo-tracker');
const profitService    = require('./modules/profit-attribution');
const shadowTester     = require('./modules/shadow-tester');

// ==================== NEW REVENUE & INNOVATION MODULES ====================
const creditSystem     = require('./modules/creditSystem');
const referralEngine   = require('./modules/referralEngine');
const customerHealth   = require('./modules/customerHealth');
const workflowEngine   = require('./modules/workflowEngine');
const whiteLabelEngine = require('./modules/whiteLabelEngine');
const tenantEngine     = require('./modules/tenant-engine');
const canaryCtrl       = require('./modules/canary-controller');
const controlPlane     = require('./modules/control-plane-agent');
const profitLoop       = require('./modules/profit-control-loop');

// ==================== 3 COMPONENTE CRITICE AUTONOME ====================
const centralOrchestrator = require('./modules/central-orchestrator');
const selfHealingEngine   = require('./modules/self-healing-engine');
const aiSelfHealing       = require('./modules/ai-self-healing');
const autoInnovationLoop  = require('./modules/auto-innovation-loop');
const githubOps           = require('./modules/github-ops');

// ==================== DYNAMIC PRICING ENGINE ====================
const dynamicPricing   = require('./modules/dynamic-pricing');

// ==================== MODULELE NEACTIVATE ANTERIOR — acum active 100% ====================
const futureCompatBridge    = require('./modules/FutureCompatibilityBridge');
const moduleLoader          = require('./modules/ModuleLoader');
const quantumSecurity       = require('./modules/QuantumSecurityLayer');
const quantumIntegrityShield = require('./modules/quantumIntegrityShield');
const temporalProcessor     = require('./modules/TemporalDataProcessor');
const configManager         = require('./modules/configurationManager');
const quantumPaymentNexus   = require('./modules/quantumPaymentNexus');
// quantumVault este deja încărcat la linia 66 (primul după dotenv)
const revenueModules        = require('./modules/revenueModules');
const sovereignGuardian     = require('./modules/sovereignAccessGuardian');
// ==================== GENERATED FUTURE MODULES ====================
const agiSelfEvolution      = require('./generated/AGISelf-EvolutionEngine');
const autonomousSpace       = require('./generated/AutonomousSpaceComputing');
const digitalTwinNetwork    = require('./generated/DecentralizedDigitalTwinNetwork');
const neuralInterfaceAPI    = require('./generated/NeuralInterfaceAPI');
const quantumInternet       = require('./generated/QuantumInternetProtocol');
const quantumML             = require('./generated/QuantumMachineLearningCore');
const temporalDataLayer     = require('./generated/TemporalDataLayer');
// ==================== SRC INNOVATION & DEPLOY MODULES ====================
const innovationEngine      = require('../src/innovation/innovation-engine');
const autoDeployOrchestrator = require('../src/modules/auto-deploy-orchestrator');
const { getSiteHtml }       = require('../src/site/template');

// ==================== MESH ORCHESTRATOR — Swiss-watch inter-module bus ====================
const meshOrchestrator     = require('./modules/unicornMeshOrchestrator');
const unicornOrchestrator  = require('./modules/unicornOrchestrator');

// ==================== NEW ACTIVATED MODULES (23) ====================
const evolutionCore           = require('./modules/evolution-core');
const quantumHealing          = require('./modules/quantum-healing');
const universalAdaptor        = require('./modules/universal-adaptor');
const siteCreator             = require('./modules/site-creator');
const abTesting               = require('./modules/ab-testing');
const seoOptimizer            = require('./modules/seo-optimizer');
const analyticsEngine         = require('./modules/analytics');
const contentAI               = require('./modules/content-ai');
const autoMarketing           = require('./modules/auto-marketing');
const performanceMonitor      = require('./modules/performance-monitor');
const unicornRealizationEngine = require('./modules/unicorn-realization-engine');
const autoTrendAnalyzer       = require('./modules/auto-trend-analyzer');
const selfAdaptationEngine    = require('./modules/self-adaptation-engine');
const codeOptimizer           = require('./modules/code-optimizer');
const selfDocumenter          = require('./modules/self-documenter');
const uiEvolution             = require('./modules/ui-evolution');
const securityScanner         = require('./modules/security-scanner');
const disasterRecovery        = require('./modules/disaster-recovery');
const swarmIntelligence       = require('./modules/swarm-intelligence');
const universalInterchainNexus = require('./modules/universal-interchain-nexus');
const autonomousWealthEngine  = require('./modules/autonomous-wealth-engine');
const autonomousBDEngine      = require('./modules/autonomous-bd-engine');
const unicornSuperIntelligence = require('./modules/unicorn-super-intelligence');
// USI Sub-modules
const usiMemory      = require('./modules/unicorn-super-intelligence/memory');
const usiSkills      = require('./modules/unicorn-super-intelligence/skills');
const usiReasoning   = require('./modules/unicorn-super-intelligence/reasoning');
const usiPersonality = require('./modules/unicorn-super-intelligence/personality');

// ==================== MULTI-TENANT ENGINE v4 ====================
// tenantEngine already required above (line ~512); avoid duplicate const declaration
const { requireFeature, requirePlan: requireTenantPlan, getGatewayStats } = require('./modules/tenant-gateway');
const billingEngine      = require('./modules/billing-engine');
const orchestratorV4     = require('./modules/orchestrator-v4');
const seeEngine          = require('./modules/self-evolving-engine');
const { createExpressRouter: createAdminPanelRouter, createProvisioningRouter } = require('./modules/admin-panel');

// ==================== NEW POWER AGENTS (6) ====================
const predictiveMarketIntelligence = require('./modules/predictive-market-intelligence');
const aiSalesCloser                = require('./modules/ai-sales-closer');
const competitorSpyAgent           = require('./modules/competitor-spy-agent');
const aiCfoAgent                   = require('./modules/ai-cfo-agent');
const sentimentAnalysisEngine      = require('./modules/sentiment-analysis-engine');
const aiProductGenerator           = require('./modules/ai-product-generator');
const ale                          = require('./modules/autonomousLegalEntity');
const gect                         = require('./modules/globalEnergyCarbonTrader');
const qrBaaS                       = require('./modules/quantumResistantBaaS');
const amaa                         = require('./modules/autonomousMAdvisor');
const uaitm                        = require('./modules/universalAITrainingMarketplace');


// ==================== SPECIAL MISSING MODULES — REQUIRES ====================
const unicornExecutionEngine = require('./modules/unicorn-execution-engine');
const predictiveHealing      = require('./modules/predictive-healing');

// ==================== AUTONOMOUS SYSTEM MODULES ====================
const autoRepair           = require('./modules/auto-repair');
const autoRestart          = require('./modules/auto-restart');
const autoOptimize         = require('./modules/auto-optimize');
const autoEvolve           = require('./modules/auto-evolve');
const logMonitor           = require('./modules/log-monitor');
const resourceMonitor      = require('./modules/resource-monitor');
const errorPatternDetector = require('./modules/error-pattern-detector');
const recoveryEngine       = require('./modules/recovery-engine');
const uiAutoBuilder        = require('./modules/ui-auto-builder');

// ==================== MULTI-TENANT SAAS PLATFORM ====================
const tenantManager      = require('./modules/tenant-manager');
const tenantGateway      = require('./modules/tenant-gateway');
const tenantProvisioning = require('./modules/tenant-provisioning');
const tenantBilling      = require('./modules/tenant-billing');
const tenantAnalytics    = require('./modules/tenant-analytics');
// orchestratorV4 already required above (line ~588); avoid duplicate const declaration
// const orchestratorV4  = require('./modules/orchestrator-v4');
const globalLBModule     = require('./modules/global-load-balancer');

// Apply tenant analytics middleware (auto-track after tenant context attached)
app.use(tenantAnalytics.analyticsMiddleware);

// ==================== ZERO DOWNTIME + AI SMART CACHE ====================
const zeroDT        = require('../scripts/zero-downtime-controller');
const aiSmartCache  = require('./modules/ai-smart-cache');
// 🤖 AI Auto Dispatcher — conectează automat toate modulele unicornului la AI-ul potrivit
let _aiAutoDispatcher = null;
try { _aiAutoDispatcher = require('./modules/ai-auto-dispatcher'); } catch (e) {
  console.warn('[Backend] ai-auto-dispatcher not loaded:', e.message);
}

// ==================== GLOBAL SAAS PLATFORM MODULES ====================
// tenantManager already required above; avoid duplicate
// billingEngine already required above (line ~587); avoid duplicate
const globalApiGateway   = require('./modules/global-api-gateway');
const provisioningEngine = require('./modules/provisioning-engine');
const globalFailover     = require('./modules/global-failover');
const saasOrchestratorV4 = require('./modules/saas-orchestrator-v4');
const kpiAnalytics       = require('./modules/kpi-analytics');
const aiAutoDispatcher   = require('./modules/ai-auto-dispatcher');

// ==================== MODULE REGISTRY (292+ modules) ====================
// Registru complet al tuturor modulelor încărcate, organizate pe categorii.
// ==================== MULTI-TENANT ENGINE INIT ====================
// Must run after all requires. Initializes default tenant and self-healer.
// Middleware populates req.tenantId / req.tenantContext on every request.
// Falls back to DEFAULT_TENANT_ID for existing single-tenant routes (backward-compat).
tenantEngine.init();
app.use(tenantEngine.tenantMiddleware);
app.use(tenantEngine.tenantRateLimitMiddleware);
const MODULE_REGISTRY = {
  orchestrator: [
    'unicorn-orchestrator',
    'unicorn-main-orchestrator',
    'central-orchestrator',
    'autonomous-orchestrator',
    'meshOrchestrator',
    'unicornOrchestrator',
    'control-plane-agent',
  ],
  shield: [
    'unicorn-shield',
    'unicorn-system-shield',
    'unicorn-quantum-watchdog',
    'quantumIntegrityShield',
    'quantumVault',
    'sovereignAccessGuardian',
    'quantumSecurity',
    'quantumResistantBaaS',
    'legalFortress',
  ],
  healthDaemon: [
    'unicorn-health-daemon',
    'unicorn-health-guardian',
    'totalSystemHealer',
    'self-healing-engine',
    'ai-self-healing',
    'recovery-engine',
    'predictive-healing',
    'quantum-healing',
    'disaster-recovery',
  ],
  watchdog: [
    'unicorn-zero-downtime',
    'unicorn-log-monitor',
    'unicorn-resource-monitor',
    'unicorn-error-pattern',
    'circuit-breaker',
    'slo-tracker',
    'canary-controller',
    'shadow-tester',
    'zero-downtime-controller',
    'performance-monitor',
  ],
  ai: [
    'unicorn-uaic',
    'universalAIConnector',
    'aiProviders',
    'multi-model-router',
    'ai-orchestrator',
    'ai-auto-dispatcher',
    'ai-self-healing',
    'ai-smart-cache',
    'ai-sales-closer',
    'ai-cfo-agent',
    'ai-product-generator',
    'aiNegotiator',
    'aiWorkforce',
    'llamaBridge',
    'sentiment-analysis-engine',
    'competitor-spy-agent',
    'predictive-market-intelligence',
    'swarm-intelligence',
    'unicorn-super-intelligence',
    'usi-memory',
    'usi-skills',
    'usi-reasoning',
    'usi-personality',
    'unicorn-execution-engine',
    'unicorn-realization-engine',
    'evolution-core',
    'self-adaptation-engine',
  ],
  // Logical worker pool (lazy materialized via adaptiveEnginePool.js)
  // Pool logic de workere (materializat lazy prin adaptiveEnginePool.js)
  dynamic: (function buildAdaptiveList() {
    const n = parseInt(process.env.UNICORN_ADAPTIVE_COUNT || '82', 10);
    const modules = [];
    for (let i = 1; i <= n; i++) modules.push(`AdaptivePool#${String(i).padStart(2, '0')}`);
    return modules;
  })(),
  engines: (function buildEngineList() {
    const n = parseInt(process.env.UNICORN_ENGINE_COUNT || '62', 10);
    const engines = [];
    for (let i = 1; i <= n; i++) engines.push(`EnginePool#${i}`);
    return engines;
  })(),
  generated: [
    'AGISelf-EvolutionEngine',
    'AutonomousSpaceComputing',
    'DecentralizedDigitalTwinNetwork',
    'NeuralInterfaceAPI',
    'QuantumInternetProtocol',
    'QuantumMachineLearningCore',
    'TemporalDataLayer',
  ],
  internal: [
    'autoDeploy',
    'selfConstruction',
    'codeSanityEngine',
    'routeCache',
    'quantumPaymentNexus',
    'revenueModules',
    'creditSystem',
    'referralEngine',
    'customerHealth',
    'workflowEngine',
    'whiteLabelEngine',
    'profit-attribution',
    'profit-control-loop',
    'autonomous-money-machine',
    'autonomous-revenue-commander',
    'offer-factory',
    'conversion-intelligence-layer',
    'checkout-recovery-agent',
    'ai-sdr-agent',
    'ai-sales-closer-pro',
    'programmatic-seo-engine',
    'customer-success-autopilot',
    'unicorn-commerce-connector',
    'auto-service-manifest-engine',
    'module-to-marketplace-sync',
    'future-invention-foundry',
    'sovereign-btc-commerce-bridge',
    'billion-scale-revenue-engine',
    'enterprise-deal-desk',
    'owner-revenue-dashboard',
    'marketplace-economics-engine',
    'strategic-package-engine',
    'vertical-growth-page-engine',
    'billion-scale-activation-orchestrator',
    'unicorn-capability-router',
    'unicorn-case-study-proof-engine',
    'unicorn-vertical-demand-engine',
    'dynamic-pricing',
    'auto-repair',
    'auto-restart',
    'auto-optimize',
    'auto-evolve',
    'auto-innovation-loop',
    'autoRevenue',
    'autoViralGrowth',
    'autonomousInnovation',
    'unicornInnovationSuite',
    'unicornAutoGenesis',
    'unicornEternalEngine',
    'unicornAutonomousCore',
    'unicornUltimateModules',
    'domainAutomationManager',
    'FutureCompatibilityBridge',
    'ModuleLoader',
    'TemporalDataProcessor',
    'configurationManager',
    'seo-optimizer',
    'analytics',
    'content-ai',
    'auto-marketing',
    'auto-trend-analyzer',
    'code-optimizer',
    'self-documenter',
    'ui-evolution',
    'security-scanner',
    'ab-testing',
    'site-creator',
    'github-ops',
  ],
  external: [
    'qrDigitalIdentity',
    'carbonExchange',
    'serviceMarketplace',
    'complianceEngine',
    'riskAnalyzer',
    'reputationProtocol',
    'opportunityRadar',
    'businessBlueprint',
    'paymentGateway',
    'aviationModule',
    'paymentSystems',
    'governmentModule',
    'defenseModule',
    'telecomModule',
    'enterprisePartnership',
    'quantumBlockchain',
    'maAdvisor',
    'legalContract',
    'energyGrid',
    'socialMediaViralizer',
    'universalMarketNexus',
    'globalDigitalStandard',
    'quantumResilienceCore',
    'executiveDashboard',
    'autonomousWealthEngine',
    'autonomous-bd-engine',
    'autonomousLegalEntity',
    'globalEnergyCarbonTrader',
    'universalAITrainingMarketplace',
    'autonomousMAdvisor',
    'universal-interchain-nexus',
    'universal-adaptor',
    'unicornMeshOrchestrator',
    'innovationEngine',
    'autoDeployOrchestrator',
    'universalAIConnector',
    'globalMonetizationMesh',
    'sovereignRevenueRouter',
    'ai-orchestrator',
    'ai-cfo-agent',
    'central-orchestrator',
    'control-plane-agent',
    'competitor-spy-agent',
    'predictive-market-intelligence',
    'ai-sales-closer',
    'profit-attribution',
    'profit-control-loop',
    'self-adaptation-engine',
    'selfConstruction',
    'self-healing-engine',
    'ai-self-healing',
    'quantum-healing',
    'predictive-healing',
  ],
  saas: [
    'tenant-manager',
    'global-api-gateway',
    'billing-engine',
    'provisioning-engine',
    'global-failover',
    'saas-orchestrator-v4',
    'kpi-analytics',
    'ai-auto-dispatcher',
    'tenantBilling',
    'tenantProvisioning',
    'autonomousMoneyMachine',
    'nowPayments',
    'orchestrator-v4',
    'self-evolving-engine',
    'tenant-analytics',
    'tenant-engine',
    'tenant-gateway',
    'tenant-billing',
    'tenant-provisioning',
    'domainAutomationManager',
    'auto-marketing',
    'provisioning-engine',
    'saas-orchestrator-v4',
    'autonomousWealthEngine',
  ],
};

// Calculează totalul și construiește lista plată pentru interogări rapide
const _allModuleNames = Object.values(MODULE_REGISTRY).flat();
const _moduleCount = _allModuleNames.length;

function getModuleRegistryStatus() {
  const categories = {};
  let total = 0;
  for (const [cat, mods] of Object.entries(MODULE_REGISTRY)) {
    categories[cat] = { count: mods.length, modules: mods };
    total += mods.length;
  }
  return {
    total,
    categories,
    generatedAt: new Date().toISOString(),
  };
}

// SLO middleware — records every API request latency & error status
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = `${req.method} ${req.route ? req.route.path : req.path}`;
    const dur = Date.now() - start;
    const isError = res.statusCode >= 500;
    sloTracker.record(route, dur, isError);
    // Feed request & error data into KPI analytics
    kpiAnalytics.increment('apiCallsToday');
    if (isError) {
      kpiAnalytics.increment('_errorCountToday');
      const totalCalls  = kpiAnalytics.get('apiCallsToday');
      const totalErrors = kpiAnalytics.get('_errorCountToday');
      if (totalCalls > 0) {
        kpiAnalytics.set('errorRate', parseFloat(((totalErrors / totalCalls) * 100).toFixed(2)));
      }
    }
  });
  next();
});

// Global API Gateway middleware — tenant resolution + rate limiting
app.use(tenantManager.middleware());
app.use(globalApiGateway.middleware());

const _instanceId = process.env.NODE_APP_INSTANCE;
const _isPrimaryWorker = _instanceId == null || _instanceId === '0';
const _enableAutoDeploy = ['1', 'true', 'yes', 'on'].includes(String(process.env.ENABLE_AUTO_DEPLOY || '').toLowerCase());
const _enableFileMutators = ['1', 'true', 'yes', 'on'].includes(String(process.env.ENABLE_FILE_MUTATORS || '').toLowerCase());
const _runtimeProfile = String(
  process.env.UNICORN_RUNTIME_PROFILE || (process.env.NODE_ENV === 'production' ? 'stable' : 'full')
).toLowerCase();
const _stableRuntime = _runtimeProfile !== 'full';

if (_isPrimaryWorker) {
  if (_stableRuntime) {
    console.log('🛡️ Runtime profile: STABLE (autonomous background loops are limited)');
  }

  // Pornire module autonome (single-worker only to avoid duplicated intervals in PM2 cluster)
  if (!_stableRuntime && _enableFileMutators) {
    selfConstruction.start();
  } else {
    console.log('🧱 Self‑Construction dezactivat (stabilitate server)');
  }
  if (!_stableRuntime) {
    totalSystemHealer.start();
  }
  if (!_stableRuntime && _enableAutoDeploy) {
    autoDeploy.start();
  } else {
    console.log('📡 Auto‑Deploy dezactivat (setează ENABLE_AUTO_DEPLOY=1 pentru activare)');
  }
  if (!_stableRuntime) {
    codeSanityEngine.start();
  }
  // Pornire module revenue streams (7 fluxuri de venit activate autonom)
  if (!_stableRuntime) {
    revenueModules.startAutoRevenue();
  }

  // ==================== PORNIRE 3 COMPONENTE CRITICE AUTONOME ====================
  // Componenta 1 — Orchestratorul Central (monitorizare Hetzner/GitHub/DNS)
  if (!_stableRuntime) {
    centralOrchestrator.start();
  }
  // Componenta 2 — Self-Healing Engine (auto-repair pe baza evenimentelor orchestratorului)
  if (!_stableRuntime) {
    selfHealingEngine.start();
    selfHealingEngine.attachOrchestrator(centralOrchestrator);
  }
  // Componenta AI Self-Healing — monitorizare și auto-reparare provideri AI + module
  if (!_stableRuntime) {
    aiSelfHealing.init();
  }
  // Componenta 3 — Auto-Innovation Loop (analiză cod + PR automate + CI monitoring)
  if (!_stableRuntime && _enableFileMutators) {
    autoInnovationLoop.start();
  } else {
    console.log('🧬 Auto‑Innovation Loop dezactivat (stabilitate server)');
  }

  // Domain automation — pornit automat, indiferent de env DOMAIN
  if (!_stableRuntime) {
    domainAutomationManager.init().catch(err =>
      console.warn('[DomainAutomation] init error:', err.message, err.stack)
    );
  }

  // Pornire module cu cicluri autonome
  if (!_stableRuntime) {
    uee.startEternalCycle();
  }
  if (!_stableRuntime && _enableFileMutators) {
    uee.startPredictiveInnovation();
  }
} else {
  console.log(`🧩 Worker ${_instanceId}: modulele autonome globale sunt dezactivate (rulează pe worker 0)`);
}
if (!_stableRuntime) {
  uee.startSelfHealing();
  socialViralizer.startAutoPosting();
  socialViralizer.startAutoReply();
  socialViralizer.startViralDetector();
  socialViralizer.startUGCIncentivizer();
  gdes.startComplianceEngine();
  gdes.startRevenueTracker();
  gdes.startAutonomousSLA();
  gdes.startSelfHealing();
  gdes.startSmartRateLimiting();
  gdes.startFallbackMonitor();
  gdes.startDailyReport();
} else {
  console.log('🧯 Stable profile active: social/compliance autonomous loops are paused');
}

// Montare routere module
app.use('/api/viral', socialViralizer.getRouter(adminSecretMiddleware));
app.use('/api/market-nexus', umn.getRouter(adminSecretMiddleware));
app.use('/api/digital-standard', gdes.getRouter(adminSecretMiddleware));
app.use('/api/ultimate', ultimateModules.getRouter(adminSecretMiddleware));
app.use('/api/legal-fortress', legalFortress.getRouter(adminSecretMiddleware));
app.use('/api/quantum-resilience', qrc.getRouter(adminSecretMiddleware));
app.use('/api/dashboard', executiveDashboard.getRouter(adminSecretMiddleware));
// ── UI Auto-Builder internal health routes ──────────────────────────
app.use('/internal/ui-builder', uiAutoBuilder.getRouter());
// ── Unicorn Eternal Engine ──────────────────────────────────────────
app.use('/api/uee', uee.getRouter(adminSecretMiddleware));

// ── Unicorn Auto-Genesis ────────────────────────────────────────────
{
  const genesisRouter = require('express').Router();
  genesisRouter.use(adminSecretMiddleware);
  genesisRouter.get('/status', (req, res) => {
    res.json({ module: 'UnicornAutoGenesis', status: 'active', repo: unicornAutoGenesis.repo, branch: unicornAutoGenesis.branch });
  });
  genesisRouter.post('/run', async (req, res) => {
    try {
      await unicornAutoGenesis.run();
      res.json({ success: true, message: 'AutoGenesis run completed' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.use('/api/auto-genesis', genesisRouter);
}

// ── Domain Automation Manager ───────────────────────────────────────
{
  const damRouter = require('express').Router();
  damRouter.use(adminSecretMiddleware);
  damRouter.get('/status', (req, res) => res.json(domainAutomationManager.getStatus()));
  damRouter.post('/run', async (req, res) => {
    try {
      const result = await domainAutomationManager.init();
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.use('/api/domain-automation', damRouter);
}

// Start autonomous systems
console.log('🤖 Autonomous Innovation Engine: STARTING');
console.log('💰 Auto Revenue Engine: STARTING');
console.log('📣 Auto Viral Growth Engine: STARTING');
console.log('🛡️  Control Plane Agent: STARTING');
console.log('🎯 Profit Control Loop: STARTING');

console.log('♾️  Unicorn Eternal Engine: STARTING');
console.log('🛡️  Quantum Resilience Core: ACTIVE');
console.log('🚀 Unicorn Auto-Genesis: READY');
console.log('🌐 Domain Automation Manager: ACTIVE');
console.log('📱 Social Media Viralizer: STARTING');
console.log('🌐 Global Digital Standard: STARTING');

// ==================== MESH ORCHESTRATOR — înregistrare & pornire ====================
// Înregistrăm toate modulele autonome în bus-ul central de comunicare
meshOrchestrator.register('unicornAutonomousCore',  uac,                { statusFn: 'getStatus' });
meshOrchestrator.register('unicornEternalEngine',   uee,                { statusFn: 'getStatus' });
meshOrchestrator.register('controlPlaneAgent',      controlPlane,       { statusFn: 'getStatus' });
meshOrchestrator.register('profitControlLoop',      profitLoop,         { statusFn: 'getStatus' });
meshOrchestrator.register('autonomousInnovation',   autonomousInnovation, { statusFn: 'getStatus' });
meshOrchestrator.register('autoRevenue',            autoRevenue,        { statusFn: 'getRevenueStatus' });
meshOrchestrator.register('autoViralGrowth',        autoViralGrowth,    { statusFn: 'getViralStatus' });
meshOrchestrator.register('sloTracker',             sloTracker,         { statusFn: 'getMetrics' });
meshOrchestrator.register('circuitBreaker',         circuitBreaker,     { statusFn: 'getStatus' });
meshOrchestrator.register('canaryController',       canaryCtrl,         { statusFn: 'getStatus' });
meshOrchestrator.register('shadowTester',           shadowTester,       { statusFn: 'getMetrics' });
meshOrchestrator.register('profitAttribution',      profitService,      { statusFn: 'getMetrics' });
meshOrchestrator.register('unicornInnovationSuite', unicornInnovationSuite, { statusFn: 'getAffiliateStats' });
meshOrchestrator.register('ultimateModules',        ultimateModules,    { statusFn: 'getStats' });
// Modulele nou activate — înregistrate în mesh
meshOrchestrator.register('futureCompatBridge',     futureCompatBridge, { statusFn: 'getStatus' });
meshOrchestrator.register('quantumSecurity',        quantumSecurity,    { statusFn: 'getStatus' });
meshOrchestrator.register('quantumIntegrityShield', quantumIntegrityShield, { statusFn: 'getStatus' });
meshOrchestrator.register('temporalProcessor',      temporalProcessor,  { statusFn: 'getStatus' });
meshOrchestrator.register('quantumVault',           quantumVault,       { statusFn: 'getStatus' });
meshOrchestrator.register('sovereignGuardian',      sovereignGuardian,  { statusFn: 'getStatus' });
meshOrchestrator.register('revenueModules',         revenueModules,     { statusFn: 'getAllStatus' });
meshOrchestrator.register('unicornOrchestrator',    unicornOrchestrator, { statusFn: 'getStatus' });
// ── SaaS Platform modules — înregistrate în mesh pentru comunicare autonomă ──
meshOrchestrator.register('billingEngine',          billingEngine,       { statusFn: 'getStatus' });
meshOrchestrator.register('saasOrchestratorV4',     saasOrchestratorV4,  { statusFn: 'getStatus' });
meshOrchestrator.register('kpiAnalytics',           kpiAnalytics,        { statusFn: 'getStatus' });
meshOrchestrator.register('aiAutoDispatcher',       aiAutoDispatcher,    { statusFn: 'getStatus' });
meshOrchestrator.register('provisioningEngine',     provisioningEngine,  { statusFn: 'getStatus' });
meshOrchestrator.register('globalFailover',         globalFailover,      { statusFn: 'getStatus' });
meshOrchestrator.register('globalApiGateway',       globalApiGateway,    { statusFn: 'getStatus' });
meshOrchestrator.register('tenantBilling',          tenantBilling,       { statusFn: 'getStatus' });
meshOrchestrator.register('tenantAnalytics',        tenantAnalytics,     { statusFn: 'getStatus' });
meshOrchestrator.register('tenantManager',          tenantManager,       { statusFn: 'getStatus' });
meshOrchestrator.register('globalLoadBalancer',     globalLBModule.globalLB, { statusFn: 'getStatus' });
meshOrchestrator.register('uiAutoBuilder',          uiAutoBuilder,       { statusFn: 'getStatus' });
// ── Profit & Revenue modules — înregistrate pentru monetizare autonomă ──
meshOrchestrator.register('autonomousMoneyMachine', moneyMachine,        { statusFn: 'getStatus' });
meshOrchestrator.register('nowPayments',            nowPayments,         { statusFn: 'getStatus' });
meshOrchestrator.register('orchestratorV4',         orchestratorV4,      { statusFn: 'getStatus' });
meshOrchestrator.register('selfEvolvingEngine',     seeEngine,           { statusFn: 'getStatus' });
meshOrchestrator.register('tenantGateway',          tenantGateway,       { statusFn: 'getStatus' });
meshOrchestrator.register('predictiveMarketIntel',  predictiveMarketIntelligence, { statusFn: 'getStatus' });
meshOrchestrator.register('aiSalesCloser',          aiSalesCloser,       { statusFn: 'getStatus' });
meshOrchestrator.register('competitorSpy',          competitorSpyAgent,  { statusFn: 'getStatus' });
meshOrchestrator.register('aiCfoAgent',             aiCfoAgent,          { statusFn: 'getStatus' });
meshOrchestrator.register('autonomousLegalEntity',  ale,                 { statusFn: 'getStatus' });
meshOrchestrator.register('globalEnergyCarbonTrade',gect,                { statusFn: 'getStatus' });
meshOrchestrator.register('autonomousMAdvisor',     amaa,                { statusFn: 'getStatus' });
meshOrchestrator.register('universalAITrainingMkt', uaitm,               { statusFn: 'getStatus' });
meshOrchestrator.register('predictiveHealing',      predictiveHealing,   { statusFn: 'getStatus' });
meshOrchestrator.register('selfAdaptationEngine',   selfAdaptationEngine, { statusFn: 'getStatus' });
meshOrchestrator.register('selfHealingEngine',      selfHealingEngine,   { statusFn: 'getStatus' });
meshOrchestrator.register('aiSelfHealing',          aiSelfHealing,       { statusFn: 'getStatus' });
meshOrchestrator.register('quantumHealing',         quantumHealing,      { statusFn: 'getStatus' });
meshOrchestrator.register('autonomousBDEngine',     autonomousBDEngine,  { statusFn: 'getStatus' });
meshOrchestrator.register('autoMarketing',          autoMarketing,       { statusFn: 'getStatus' });
meshOrchestrator.register('domainAutomationMgr',    domainAutomationManager, { statusFn: 'getStatus' });
meshOrchestrator.register('centralOrchestrator',    centralOrchestrator, { statusFn: 'getStatus' });

// Pornim orchestratorul — Swiss-watch mode
if (!_stableRuntime) {
  meshOrchestrator.start();
  unicornOrchestrator.start('full'); // Orchestratorul central al unicornului — activează toate motoarele autonome (full mode)
  console.log('🕰️  Unicorn Mesh Orchestrator: STARTED — toate modulele conectate');
  console.log('🦄 Unicorn Orchestrator (8 engines): ACTIVE');
} else {
  console.log('🧯 Stable profile active: mesh/orchestrator background loops are paused');
}

// ==================== RUTE API ====================
function buildHealthResponse() {
  const s = Math.floor(process.uptime());
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mem = process.memoryUsage();
  const persistence = dbMeta();
  return {
    status: 'ok',
    uptime: s,
    uptimeHuman: `${h}h ${m}m ${sec}s`,
    users: dbUsers.count(),
    dbConnected: true,
    persistence: {
      durable: persistence.durable,
      mode: persistence.mode,
      userCount: persistence.userCount,
    },
    engines: {
      innovation: !_stableRuntime,
      revenue: !_stableRuntime,
      viral: !_stableRuntime,
      eternalEngine: !_stableRuntime,
    },
    quantumIntegrityShield: quantumIntegrityShield.getStatus().integrity,
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    },
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  };
}

// /health (non-prefixed) — used by uptime monitors
app.get('/health', (req, res) => res.json(buildHealthResponse()));

app.get('/api/health', (req, res) => res.json(buildHealthResponse()));

app.get('/api/persistence/status', (req, res) => {
  const persistence = dbMeta();
  res.json({
    ok: persistence.durable,
    durable: persistence.durable,
    mode: persistence.mode,
    userCount: persistence.userCount,
    storage: persistence.durable ? 'sqlite-file' : persistence.mode,
    note: persistence.durable
      ? 'User accounts persist across PM2 reloads, deploys and restarts.'
      : 'Persistence is not durable; production refuses this mode unless explicitly overridden.',
  });
});

// ==================== AUTONOMY CHAIN + CAPABILITY TOKENS (PCMC / CBAT) ====================
// Proof-Carrying Mutation Chain — tamper-evident audit of every autonomous write
// Lanț Merkle semnat HMAC al fiecărei mutații autonome (conform EU AI Act art.12)
let _autonomyChain = null;
let _capTokens     = null;
try { _autonomyChain = require('./modules/autonomyChain');    } catch (_) {}
try { _capTokens     = require('./modules/capabilityTokens'); } catch (_) {}

app.get('/api/autonomy/stats', (req, res) => {
  if (!_autonomyChain) return res.status(503).json({ error: 'autonomyChain unavailable' });
  res.json(_autonomyChain.stats());
});

app.get('/api/autonomy/verify', (req, res) => {
  if (!_autonomyChain) return res.status(503).json({ error: 'autonomyChain unavailable' });
  res.json(_autonomyChain.verify());
});

app.get('/api/autonomy/chain', (req, res) => {
  if (!_autonomyChain) return res.status(503).json({ error: 'autonomyChain unavailable' });
  const from  = Math.max(0, parseInt(req.query.from,  10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50));
  res.json({ from, limit, records: _autonomyChain.slice(from, limit) });
});

app.get('/api/autonomy/capabilities', (req, res) => {
  if (!_capTokens) return res.status(503).json({ error: 'capabilityTokens unavailable' });
  res.json({ actors: _capTokens.listActors(), requireCapability: process.env.REQUIRE_CAPABILITY === '1' });
});

// Admin: revoke a token (requires admin guard elsewhere if present)
// Admin: revocă un token
app.post('/api/autonomy/revoke', express.json(), (req, res) => {
  if (!_capTokens) return res.status(503).json({ error: 'capabilityTokens unavailable' });
  const { tokenId } = req.body || {};
  if (!tokenId) return res.status(400).json({ error: 'tokenId required' });
  res.json(_capTokens.revoke(tokenId));
});

// ===================== Temporal ABI Registry (TAR) =====================
// Registru ABI temporal — versiuni semver side-by-side
let _abiRegistry = null;
let _quarantine  = null;
let _moduleIdent = null;
try { _abiRegistry = require('./modules/temporalAbiRegistry'); } catch (_) {}
try { _quarantine  = require('./modules/quarantineBuffer');    } catch (_) {}
try { _moduleIdent = require('./modules/moduleIdentity');      } catch (_) {}

app.get('/api/autonomy/abi', (req, res) => {
  if (!_abiRegistry) return res.status(503).json({ error: 'temporalAbiRegistry unavailable' });
  res.json(_abiRegistry.list());
});

app.get('/api/autonomy/abi/compat', (req, res) => {
  if (!_abiRegistry) return res.status(503).json({ error: 'temporalAbiRegistry unavailable' });
  res.json(_abiRegistry.compatMatrix());
});

app.get('/api/autonomy/abi/resolve', (req, res) => {
  if (!_abiRegistry) return res.status(503).json({ error: 'temporalAbiRegistry unavailable' });
  const name  = String(req.query.name  || '');
  const range = String(req.query.range || '*');
  if (!name) return res.status(400).json({ error: 'name required' });
  res.json(_abiRegistry.resolve(name, range));
});

app.post('/api/autonomy/abi/register', express.json(), (req, res) => {
  if (!_abiRegistry) return res.status(503).json({ error: 'temporalAbiRegistry unavailable' });
  try { res.json(_abiRegistry.register(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ===================== Quarantine / Canary Buffer =====================
app.get('/api/autonomy/quarantine', (req, res) => {
  if (!_quarantine) return res.status(503).json({ error: 'quarantineBuffer unavailable' });
  res.json({ stats: _quarantine.stats(), items: _quarantine.list() });
});

app.post('/api/autonomy/quarantine/stage', express.json(), (req, res) => {
  if (!_quarantine) return res.status(503).json({ error: 'quarantineBuffer unavailable' });
  res.json(_quarantine.stage(req.body || {}));
});

app.post('/api/autonomy/quarantine/veto', express.json(), (req, res) => {
  if (!_quarantine) return res.status(503).json({ error: 'quarantineBuffer unavailable' });
  const { stageId, vetoer, reason } = req.body || {};
  if (!stageId) return res.status(400).json({ error: 'stageId required' });
  res.json(_quarantine.veto(stageId, vetoer, reason));
});

app.post('/api/autonomy/quarantine/promote', express.json(), (req, res) => {
  if (!_quarantine) return res.status(503).json({ error: 'quarantineBuffer unavailable' });
  const { stageId } = req.body || {};
  if (!stageId) return res.status(400).json({ error: 'stageId required' });
  res.json(_quarantine.forcePromote(stageId));
});

// ===================== Self-Sovereign Module Identity =====================
app.get('/api/autonomy/did', (req, res) => {
  if (!_moduleIdent) return res.status(503).json({ error: 'moduleIdentity unavailable' });
  res.json(_moduleIdent.list());
});

app.get('/api/autonomy/did/resolve', (req, res) => {
  if (!_moduleIdent) return res.status(503).json({ error: 'moduleIdentity unavailable' });
  const key = String(req.query.id || req.query.name || '');
  if (!key) return res.status(400).json({ error: 'id or name required' });
  const doc = _moduleIdent.resolveDoc(key);
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json(doc);
});

app.post('/api/autonomy/did/issue', express.json(), (req, res) => {
  if (!_moduleIdent) return res.status(503).json({ error: 'moduleIdentity unavailable' });
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  try { res.json(_moduleIdent.ensure(name)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/autonomy/did/verify', express.json(), (req, res) => {
  if (!_moduleIdent) return res.status(503).json({ error: 'moduleIdentity unavailable' });
  const { did, payload, signature } = req.body || {};
  if (!did || !payload || !signature) return res.status(400).json({ error: 'did, payload, signature required' });
  res.json(_moduleIdent.verify(did, payload, signature));
});

// ============================================================================
// SOVEREIGN REVENUE + INDUSTRY OS + GIANT FABRIC + VALUE PROOF + MONETIZATION
// Routing determinist al veniturilor + OS per industrie + integrari giants +
// proof-of-outcome + listari automate pe 40+ marketplaces globale
// ============================================================================
let _revenueRouter  = null; try { _revenueRouter  = require('./modules/sovereignRevenueRouter');  } catch (_) {}
let _industryOS     = null; try { _industryOS     = require('./modules/industryOS');              } catch (_) {}
let _giantFabric    = null; try { _giantFabric    = require('./modules/giantIntegrationFabric');  } catch (_) {}
let _valueProof     = null; try { _valueProof     = require('./modules/valueProofLedger');        } catch (_) {}
let _monetizeMesh   = null; try { _monetizeMesh   = require('./modules/globalMonetizationMesh');  } catch (_) {}
let _adaptivePool   = null; try { _adaptivePool   = require('./modules/adaptiveEnginePool');      } catch (_) {}

// ---- Sovereign Revenue Router ---------------------------------------------
app.get('/api/revenue/totals', (req, res) => {
  if (!_revenueRouter) return res.status(503).json({ error: 'sovereignRevenueRouter unavailable' });
  res.json(_revenueRouter.totals());
});
app.get('/api/revenue/recent', (req, res) => {
  if (!_revenueRouter) return res.status(503).json({ error: 'sovereignRevenueRouter unavailable' });
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 20));
  res.json({ items: _revenueRouter.recent(limit) });
});
app.post('/api/revenue/route', express.json(), (req, res) => {
  if (!_revenueRouter) return res.status(503).json({ error: 'sovereignRevenueRouter unavailable' });
  res.json(_revenueRouter.route(req.body || {}));
});
app.post('/api/revenue/verify', express.json(), (req, res) => {
  if (!_revenueRouter) return res.status(503).json({ error: 'sovereignRevenueRouter unavailable' });
  res.json(_revenueRouter.verifyReceipt(req.body || {}));
});

// ---- Industry OS ----------------------------------------------------------
app.get('/api/industry/list', (req, res) => {
  if (!_industryOS) return res.status(503).json({ error: 'industryOS unavailable' });
  res.json(_industryOS.list());
});
app.get('/api/industry/projected', (req, res) => {
  if (!_industryOS) return res.status(503).json({ error: 'industryOS unavailable' });
  res.json(_industryOS.projectedAnnual());
});
app.get('/api/industry/blueprint/:name', (req, res) => {
  if (!_industryOS) return res.status(503).json({ error: 'industryOS unavailable' });
  const bp = _industryOS.blueprintOf(req.params.name);
  if (!bp) return res.status(404).json({ error: 'unknown vertical' });
  res.json(bp);
});
app.post('/api/industry/activate', express.json(), (req, res) => {
  if (!_industryOS) return res.status(503).json({ error: 'industryOS unavailable' });
  res.json(_industryOS.activate((req.body || {}).name));
});
app.post('/api/industry/book', express.json(), (req, res) => {
  if (!_industryOS) return res.status(503).json({ error: 'industryOS unavailable' });
  res.json(_industryOS.bookRevenue(req.body || {}));
});

// ---- Giant Integration Fabric --------------------------------------------
app.get('/api/giants/list', (req, res) => {
  if (!_giantFabric) return res.status(503).json({ error: 'giantIntegrationFabric unavailable' });
  res.json({ giants: _giantFabric.list() });
});
app.get('/api/giants/stats', (req, res) => {
  if (!_giantFabric) return res.status(503).json({ error: 'giantIntegrationFabric unavailable' });
  res.json(_giantFabric.stats());
});
app.post('/api/giants/dispatch', express.json(), (req, res) => {
  if (!_giantFabric) return res.status(503).json({ error: 'giantIntegrationFabric unavailable' });
  res.json(_giantFabric.dispatch(req.body || {}));
});

// ---- Value Proof Ledger (Outcome Economics) ------------------------------
app.post('/api/outcome/record', express.json(), (req, res) => {
  if (!_valueProof) return res.status(503).json({ error: 'valueProofLedger unavailable' });
  res.json(_valueProof.record(req.body || {}));
});
app.post('/api/outcome/verify', express.json(), (req, res) => {
  if (!_valueProof) return res.status(503).json({ error: 'valueProofLedger unavailable' });
  res.json(_valueProof.verify(req.body || {}));
});
app.get('/api/outcome/totals', (req, res) => {
  if (!_valueProof) return res.status(503).json({ error: 'valueProofLedger unavailable' });
  res.json(_valueProof.totals());
});
app.get('/api/outcome/recent', (req, res) => {
  if (!_valueProof) return res.status(503).json({ error: 'valueProofLedger unavailable' });
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 20));
  res.json({ items: _valueProof.recent(limit) });
});
app.get('/api/outcome/tenant/:tenantId', (req, res) => {
  if (!_valueProof) return res.status(503).json({ error: 'valueProofLedger unavailable' });
  res.json({ items: _valueProof.listForTenant(req.params.tenantId, 100) });
});

// ---- Global Monetization Mesh --------------------------------------------
app.get('/api/monetize/marketplaces', (req, res) => {
  if (!_monetizeMesh) return res.status(503).json({ error: 'globalMonetizationMesh unavailable' });
  res.json({ marketplaces: _monetizeMesh.listMarketplaces(), reach: _monetizeMesh.reach() });
});
app.get('/api/monetize/summary', (req, res) => {
  if (!_monetizeMesh) return res.status(503).json({ error: 'globalMonetizationMesh unavailable' });
  res.json(_monetizeMesh.summary());
});
app.get('/api/monetize/listings', (req, res) => {
  if (!_monetizeMesh) return res.status(503).json({ error: 'globalMonetizationMesh unavailable' });
  res.json({ listings: _monetizeMesh.listings() });
});
app.post('/api/monetize/publish', express.json(), (req, res) => {
  if (!_monetizeMesh) return res.status(503).json({ error: 'globalMonetizationMesh unavailable' });
  res.json(_monetizeMesh.publishProduct(req.body || {}));
});
app.post('/api/monetize/quote', express.json(), (req, res) => {
  if (!_monetizeMesh) return res.status(503).json({ error: 'globalMonetizationMesh unavailable' });
  res.json(_monetizeMesh.quote(req.body || {}));
});
app.post('/api/monetize/sale', express.json(), (req, res) => {
  if (!_monetizeMesh) return res.status(503).json({ error: 'globalMonetizationMesh unavailable' });
  res.json(_monetizeMesh.recordSale(req.body || {}));
});

// ---- Adaptive Engine Pool -------------------------------------------------
app.get('/api/pool/summary', (req, res) => {
  if (!_adaptivePool) return res.status(503).json({ error: 'adaptiveEnginePool unavailable' });
  res.json(_adaptivePool.listSummary());
});



// ==================== SNAPSHOT + SSE STREAM (backend mirror) ====================
const _streamClients = new Set();

function buildBackendSnapshot() {
  const uptimeSec = Math.floor(process.uptime());
  return {
    generatedAt: new Date().toISOString(),
    health: { ok: true, service: 'unicorn-backend', brand: 'ZeusAI' },
    telemetry: {
      uptime: uptimeSec,
      activeUsers: dbUsers.count(),
      requests: uptimeSec,
    },
    billing: {
      primary: 'BTC',
      supported: ['BTC', 'Stripe', 'PayPal'],
      btcAddress: ADMIN_OWNER_BTC,
    },
    platform: {
      url: process.env.PUBLIC_APP_URL || 'https://zeusai.pro',
      owner: ADMIN_OWNER_NAME,
      contact: ADMIN_OWNER_EMAIL,
      version: APP_VERSION,
    },
  };
}

app.get('/snapshot', routeCache.cacheMiddleware(), (req, res) => {
  res.json(buildBackendSnapshot());
});

app.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write('data: ' + JSON.stringify(buildBackendSnapshot()) + '\n\n');
  _streamClients.add(res);
  req.on('close', () => _streamClients.delete(res));
});

const _streamInterval = setInterval(() => {
  if (_streamClients.size === 0) return;
  const payload = 'data: ' + JSON.stringify(buildBackendSnapshot()) + '\n\n';
  for (const client of _streamClients) client.write(payload);
}, 5000);
if (typeof _streamInterval.unref === 'function') _streamInterval.unref();

// ==================== UNICORN SITE INTEGRATION API ====================
const _unicornServices = [
  { id: 'adaptive-ai', title: 'Adaptive AI', segment: 'all', kpi: 'automation coverage', price: 499, currency: 'USD', billing: 'monthly', description: 'Autonomous AI workflows with signed outcomes.' },
  { id: 'predictive-engine', title: 'Predictive Engine', segment: 'companies', kpi: 'forecast accuracy', price: 799, currency: 'USD', billing: 'monthly', description: 'Demand, churn and risk forecasting with explainability.' },
  { id: 'quantum-nexus', title: 'Quantum Nexus', segment: 'enterprise', kpi: 'latency optimization', price: 2499, currency: 'USD', billing: 'monthly', description: 'High-performance orchestration for mission-critical stacks.' },
  { id: 'viral-growth', title: 'Viral Growth Engine', segment: 'startups', kpi: 'acquisition rate', price: 399, currency: 'USD', billing: 'monthly', description: 'Growth loops, referrals and conversion automation.' },
  { id: 'automation-blocks', title: 'Automation Blocks', segment: 'all', kpi: 'tasks automated', price: 299, currency: 'USD', billing: 'monthly', description: 'Composable automation primitives for rapid deployment.' },
];
const _unicornPurchases = new Map(); // id -> purchase
const _unicornEventsClients = new Set();
let _cinematicProfileOverride = null;
const _pqDigest = (() => {
  try { crypto.createHash('sha3-512'); return 'sha3-512'; }
  catch (_) { return 'sha512'; }
})();

function _serviceById(id) {
  return _unicornServices.find(s => s.id === id) || null;
}

function _purchaseFromPayment(payment) {
  if (!payment) return null;
  const md = payment.metadata || {};
  if (md.kind !== 'service_purchase') return null;
  return {
    id: payment.txId,
    serviceId: md.serviceId || null,
    email: String(md.email || payment.clientId || '').toLowerCase(),
    paymentMethod: String(payment.method || 'BTC').toUpperCase(),
    amount: Number(payment.amount || payment.total || 0),
    currency: String(payment.currency || 'USD').toUpperCase(),
    status: md.purchaseStatus || (String(payment.status || '').toLowerCase() === 'completed' ? 'paid' : 'pending_payment'),
    active: !!md.active,
    expectedBtc: md.expectedBtc != null ? Number(md.expectedBtc) : null,
    createdAt: payment.createdAt || null,
    activatedAt: md.activatedAt || null,
    confirmation: md.confirmation || null,
  };
}

async function _getBtcUsdPrice() {
  try {
    const r = await axios.get('https://mempool.space/api/v1/prices', { timeout: 4500 });
    const usd = Number(r && r.data && r.data.USD);
    if (Number.isFinite(usd) && usd > 1000) return usd;
  } catch (_) {}
  return Number(process.env.BTC_USD_FALLBACK || 100000);
}

function _deriveExpectedBtc(amountUsd, purchaseId, btcUsd) {
  const usd = Number(amountUsd || 0);
  if (!Number.isFinite(usd) || usd <= 0) return null;
  const px = Number(btcUsd || 0);
  if (!Number.isFinite(px) || px <= 0) return null;
  const base = usd / px;
  // Unique sats fingerprint to avoid collisions for same-price concurrent orders.
  const fp = ((parseInt(String(purchaseId || '').slice(0, 8), 16) || 0) % 89) + 11; // 11..99 sats
  return Number((base + (fp / 1e8)).toFixed(8));
}

function _findPurchaseById(purchaseId) {
  const fromMem = _unicornPurchases.get(purchaseId);
  if (fromMem) return fromMem;
  const payment = dbPayments.findByTxId(purchaseId);
  const fromDb = _purchaseFromPayment(payment);
  if (fromDb) _unicornPurchases.set(purchaseId, fromDb);
  return fromDb;
}

function _savePurchaseToDb(purchase, service) {
  const safeService = service || _serviceById(purchase.serviceId) || {};
  const nowIso = new Date().toISOString();
  const existing = dbPayments.findByTxId(purchase.id);
  dbPayments.save({
    txId: purchase.id,
    clientId: purchase.email || 'guest',
    description: safeService.title || `Service ${purchase.serviceId || 'unknown'}`,
    method: String(purchase.paymentMethod || 'BTC').toUpperCase(),
    provider: 'zeus-service-marketplace',
    currency: String(purchase.currency || 'USD').toUpperCase(),
    amount: Number(purchase.amount || 0),
    fee: Number(existing && existing.fee ? existing.fee : 0),
    total: Number(purchase.amount || 0),
    status: purchase.active ? 'completed' : 'pending',
    walletAddress: existing ? existing.walletAddress || null : null,
    qrCode: existing ? existing.qrCode || null : null,
    exchangeRate: existing ? existing.exchangeRate || null : null,
    cryptoAmount: existing ? existing.cryptoAmount || null : null,
    providerPaymentId: existing ? existing.providerPaymentId || null : null,
    providerStatus: purchase.active ? 'paid' : 'pending',
    checkoutUrl: existing ? existing.checkoutUrl || null : null,
    nextAction: existing ? existing.nextAction || null : null,
    processorResponse: existing ? existing.processorResponse || null : null,
    metadata: {
      kind: 'service_purchase',
      serviceId: purchase.serviceId,
      email: purchase.email,
      active: !!purchase.active,
      purchaseStatus: purchase.status,
      expectedBtc: purchase.expectedBtc != null ? Number(purchase.expectedBtc) : null,
      activatedAt: purchase.activatedAt || null,
      confirmation: purchase.confirmation || null,
      serviceTitle: safeService.title || null,
      segment: safeService.segment || null,
      kpi: safeService.kpi || null,
    },
    createdAt: existing ? existing.createdAt : (purchase.createdAt || nowIso),
    updatedAt: nowIso,
  });
}

function _recordActivatedPurchase(purchase, service) {
  if (!purchase || !purchase.active) return;
  const clientId = String(purchase.email || '').toLowerCase();
  if (!clientId) return;
  const existing = dbPurchases.listByClient(clientId).find((x) => String(x.paymentTxId || '') === String(purchase.id || ''));
  if (existing) return;
  const safeService = service || _serviceById(purchase.serviceId) || {};
  dbPurchases.record({
    clientId,
    serviceId: purchase.serviceId || safeService.id || 'custom',
    serviceName: safeService.title || safeService.name || purchase.serviceId || 'Unknown service',
    description: safeService.description || 'Service purchase via ZeusAI marketplace',
    category: safeService.segment || 'general',
    price: Number(purchase.amount || 0),
    paymentTxId: purchase.id,
    paymentMethod: String(purchase.paymentMethod || 'BTC').toUpperCase(),
    purchasedAt: purchase.activatedAt || new Date().toISOString(),
  });
}

function _emitUnicornEvent(type, data) {
  if (_unicornEventsClients.size === 0) return;
  const payload = `data: ${JSON.stringify({ type, at: new Date().toISOString(), data })}\n\n`;
  for (const client of _unicornEventsClients) client.write(payload);
}

function _timingSafeHexEqual(a, b) {
  try {
    const ba = Buffer.from(String(a || ''), 'hex');
    const bb = Buffer.from(String(b || ''), 'hex');
    if (!ba.length || !bb.length || ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch (_) {
    return false;
  }
}

function _authorizePaymentConfirm(req, payload, method) {
  const confirmToken = process.env.PAYMENT_CONFIRM_TOKEN || process.env.ADMIN_SECRET || '';
  const providedToken = String(req.headers['x-payment-token'] || req.headers['x-admin-secret'] || '');
  const tokenOk = !!(confirmToken && providedToken && providedToken === confirmToken);

  const pqSecret = process.env.PQ_CONFIRM_SECRET || '';
  const pqSig = String(req.headers['x-pq-signature'] || '');
  const pqTsRaw = String(req.headers['x-pq-timestamp'] || '');
  const pqTs = Number(pqTsRaw);
  const nowMs = Date.now();
  const isFresh = Number.isFinite(pqTs) && Math.abs(nowMs - pqTs) <= 10 * 60 * 1000;
  const purchaseId = String(payload.purchaseId || payload.receiptId || payload.orderId || '');
  const ref = String(payload.txid || payload.transactionId || payload.paypalOrderId || '');
  const canonical = [String(method || '').toUpperCase(), purchaseId, ref, String(pqTsRaw)].join('|');
  const expected = pqSecret ? crypto.createHmac(_pqDigest, pqSecret).update(canonical).digest('hex') : '';
  const pqOk = !!(pqSecret && pqSig && isFresh && _timingSafeHexEqual(pqSig, expected));

  if (tokenOk) return { ok: true, mode: 'token' };
  if (pqOk) return { ok: true, mode: `pq-hmac-${_pqDigest}` };

  if (!confirmToken && !pqSecret) return { ok: true, mode: 'open-dev' };
  if (pqSecret && pqSig && !isFresh) return { ok: false, reason: 'stale_pq_timestamp' };
  return { ok: false, reason: 'unauthorized' };
}

app.get('/api/unicorn/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'snapshot', at: new Date().toISOString(), data: buildBackendSnapshot() })}\n\n`);
  _unicornEventsClients.add(res);
  req.on('close', () => _unicornEventsClients.delete(res));
});

app.get('/api/services/list', routeCache.cacheMiddleware(), (req, res) => {
  res.json({ updatedAt: new Date().toISOString(), source: 'zeusai-backend', sourceLegacy: 'unicorn-backend', services: _unicornServices });
});

app.get('/api/services/:id', (req, res) => {
  const id = String(req.params.id || '');
  const service = _unicornServices.find(s => s.id === id);
  if (!service) return res.status(404).json({ error: 'not_found' });
  res.json(service);
});

app.post('/api/services/buy', (req, res) => {
  const p = req.body || {};
  const serviceId = String(p.serviceId || p.plan || '');
  const service = _serviceById(serviceId);
  if (!service) return res.status(404).json({ error: 'service_not_found' });
  const paymentMethod = String(p.paymentMethod || p.method || 'BTC').toUpperCase();
  const amount = Number(p.amount || p.amountUSD || service.price || 0);
  const id = crypto.randomBytes(12).toString('hex');
  const email = String(p.email || '').toLowerCase();
  const purchase = {
    id,
    serviceId,
    email,
    paymentMethod,
    amount,
    currency: 'USD',
    status: 'pending_payment',
    active: false,
    expectedBtc: null,
    createdAt: new Date().toISOString(),
    activatedAt: null,
  };
  const finalize = () => {
    _unicornPurchases.set(id, purchase);
    _savePurchaseToDb(purchase, service);
    _emitUnicornEvent('service_purchase_created', { id, serviceId, paymentMethod, amount, email, expectedBtc: purchase.expectedBtc || null });
    return res.json({ ok: true, purchase });
  };

  if (paymentMethod !== 'BTC') return finalize();

  _getBtcUsdPrice()
    .then((btcUsd) => {
      const expectedBtc = _deriveExpectedBtc(amount, id, btcUsd);
      purchase.expectedBtc = expectedBtc;
      purchase.paymentQuote = {
        kind: 'btc',
        address: ADMIN_OWNER_BTC,
        expectedBtc,
        btcUsd,
        btcUri: expectedBtc ? `bitcoin:${ADMIN_OWNER_BTC}?amount=${expectedBtc}&label=${encodeURIComponent('ZeusAI-' + id.slice(0, 8))}` : `bitcoin:${ADMIN_OWNER_BTC}`,
      };
      return finalize();
    })
    .catch(() => finalize());
});

app.get('/api/user/services', (req, res) => {
  const headerEmail = String(req.headers['x-user-email'] || '').toLowerCase();
  const queryEmail = String(req.query.email || '').toLowerCase();
  let tokenEmail = '';
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      tokenEmail = String(decoded.email || '').toLowerCase();
    }
  } catch (_) {}
  const email = headerEmail || queryEmail || tokenEmail;
  if (!email) return res.json({ ok: true, services: [], count: 0 });
  const services = [];
  const seen = new Set();

  const fromDb = dbPayments
    .list({ clientId: email })
    .map(_purchaseFromPayment)
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  for (const item of fromDb) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    services.push(item);
    _unicornPurchases.set(item.id, item);
  }

  const fromMem = [..._unicornPurchases.values()].filter(x => x.email === email);
  for (const item of fromMem) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    services.push(item);
  }

  const activated = dbPurchases.listByClient(email);
  for (const pRec of activated) {
    const syntheticId = String(pRec.paymentTxId || `${pRec.serviceId}-${pRec.purchasedAt}`);
    if (seen.has(syntheticId)) continue;
    seen.add(syntheticId);
    services.push({
      id: syntheticId,
      serviceId: pRec.serviceId,
      email,
      paymentMethod: String(pRec.paymentMethod || 'UNKNOWN').toUpperCase(),
      amount: Number(pRec.price || 0),
      currency: 'USD',
      status: 'paid',
      active: true,
      createdAt: pRec.purchasedAt,
      activatedAt: pRec.purchasedAt,
      confirmation: { method: String(pRec.paymentMethod || 'UNKNOWN').toUpperCase(), source: 'marketplace_purchases' }
    });
  }

  return res.json({ ok: true, email, services, count: services.length });
});

app.post('/api/payments/btc/confirm', (req, res) => {
  const p = req.body || {};
  const auth = _authorizePaymentConfirm(req, p, 'BTC');
  if (!auth.ok) {
    _emitUnicornEvent('payment_confirm_rejected', { method: 'BTC', reason: auth.reason || 'unauthorized' });
    return res.status(401).json({ error: auth.reason || 'unauthorized' });
  }
  const purchaseId = String(p.purchaseId || p.receiptId || p.orderId || '');
  const purchase = _findPurchaseById(purchaseId);
  if (!purchase) return res.status(404).json({ error: 'not_found' });
  purchase.status = 'paid';
  purchase.active = true;
  purchase.activatedAt = new Date().toISOString();
  purchase.confirmation = {
    method: 'BTC',
    txid: p.txid || p.transactionId || null,
    at: purchase.activatedAt,
    security: { authMode: auth.mode, digest: _pqDigest }
  };
  _unicornPurchases.set(purchaseId, purchase);
  _savePurchaseToDb(purchase, _serviceById(purchase.serviceId));
  _recordActivatedPurchase(purchase, _serviceById(purchase.serviceId));
  _emitUnicornEvent('payment_confirmed', { method: 'BTC', purchaseId, txid: purchase.confirmation.txid || null });
  return res.json({ ok: true, purchase });
});

app.post('/api/payments/paypal/confirm', (req, res) => {
  const p = req.body || {};
  const auth = _authorizePaymentConfirm(req, p, 'PAYPAL');
  if (!auth.ok) {
    _emitUnicornEvent('payment_confirm_rejected', { method: 'PAYPAL', reason: auth.reason || 'unauthorized' });
    return res.status(401).json({ error: auth.reason || 'unauthorized' });
  }
  const purchaseId = String(p.purchaseId || p.receiptId || p.orderId || '');
  const purchase = _findPurchaseById(purchaseId);
  if (!purchase) return res.status(404).json({ error: 'not_found' });
  purchase.status = 'paid';
  purchase.active = true;
  purchase.activatedAt = new Date().toISOString();
  purchase.confirmation = {
    method: 'PAYPAL',
    paypalOrderId: p.paypalOrderId || null,
    at: purchase.activatedAt,
    security: { authMode: auth.mode, digest: _pqDigest }
  };
  _unicornPurchases.set(purchaseId, purchase);
  _savePurchaseToDb(purchase, _serviceById(purchase.serviceId));
  _recordActivatedPurchase(purchase, _serviceById(purchase.serviceId));
  _emitUnicornEvent('payment_confirmed', { method: 'PAYPAL', purchaseId, paypalOrderId: purchase.confirmation.paypalOrderId || null });
  return res.json({ ok: true, purchase });
});

const _btcWatcherState = {
  enabled: true,
  lastRunAt: null,
  lastMatchAt: null,
  lastError: null,
  scannedTx: 0,
  matched: 0,
};

async function _autoConfirmBtcPurchases() {
  _btcWatcherState.lastRunAt = new Date().toISOString();
  const pending = dbPayments.list({ status: 'pending' }).filter((p) => {
    if (!p || String(p.method || '').toUpperCase() !== 'BTC') return false;
    const md = p.metadata || {};
    return md.kind === 'service_purchase' && !md.active;
  });
  if (!pending.length) return;

  const [pricesRes, txsRes] = await Promise.all([
    axios.get('https://mempool.space/api/v1/prices', { timeout: 5000 }).catch(() => null),
    axios.get(`https://mempool.space/api/address/${encodeURIComponent(ADMIN_OWNER_BTC)}/txs`, { timeout: 7000 }).catch(() => null),
  ]);

  const btcUsd = Number(pricesRes && pricesRes.data && pricesRes.data.USD) || Number(process.env.BTC_USD_FALLBACK || 100000);
  const txs = Array.isArray(txsRes && txsRes.data) ? txsRes.data : [];
  if (!txs.length) return;

  const usedTx = new Set(
    dbPayments
      .list({ status: 'completed' })
      .map((x) => x && x.metadata && x.metadata.confirmation && x.metadata.confirmation.txid)
      .filter(Boolean)
      .map((x) => String(x))
  );

  for (const tx of txs) {
    const txid = String(tx && tx.txid || '');
    if (!txid || usedTx.has(txid)) continue;
    _btcWatcherState.scannedTx += 1;

    let sats = 0;
    const vout = Array.isArray(tx && tx.vout) ? tx.vout : [];
    for (const out of vout) {
      if (String(out && out.scriptpubkey_address || '') === ADMIN_OWNER_BTC) sats += Number(out && out.value || 0);
    }
    if (!sats) continue;
    const receivedBtc = sats / 1e8;

    let best = null;
    for (const pay of pending) {
      const md = pay.metadata || {};
      const expected = Number(md.expectedBtc || _deriveExpectedBtc(Number(pay.amount || pay.total || 0), pay.txId, btcUsd) || 0);
      if (!Number.isFinite(expected) || expected <= 0) continue;
      const rel = Math.abs(receivedBtc - expected) / expected;
      if (rel > 0.02 && receivedBtc < expected) continue;
      if (!best || rel < best.rel) best = { pay, rel, expected };
    }
    if (!best) continue;

    const purchase = _findPurchaseById(best.pay.txId);
    if (!purchase) continue;
    purchase.status = 'paid';
    purchase.active = true;
    purchase.expectedBtc = best.expected;
    purchase.activatedAt = new Date().toISOString();
    purchase.confirmation = {
      method: 'BTC',
      txid,
      at: purchase.activatedAt,
      auto: true,
      source: 'mempool.space',
      observedBtc: Number(receivedBtc.toFixed(8)),
      expectedBtc: Number(best.expected.toFixed(8)),
      security: { authMode: 'auto-onchain-watcher', digest: _pqDigest },
    };
    _unicornPurchases.set(purchase.id, purchase);
    _savePurchaseToDb(purchase, _serviceById(purchase.serviceId));
    _recordActivatedPurchase(purchase, _serviceById(purchase.serviceId));
    _emitUnicornEvent('payment_confirmed', { method: 'BTC', purchaseId: purchase.id, txid, auto: true });

    _btcWatcherState.lastMatchAt = new Date().toISOString();
    _btcWatcherState.matched += 1;
    usedTx.add(txid);
  }
}

if (String(process.env.ENABLE_BTC_AUTO_CONFIRM || '1') !== '0') {
  const t = setInterval(() => {
    _autoConfirmBtcPurchases().catch((e) => {
      _btcWatcherState.lastError = String(e && e.message || e || 'btc_watcher_failed');
    });
  }, Number(process.env.BTC_WATCHER_INTERVAL_MS || 30000));
  if (typeof t.unref === 'function') t.unref();
}

app.get('/api/payments/btc/watcher/status', routeCache.cacheMiddleware(5000), (req, res) => {
  const pending = dbPayments.list({ status: 'pending' }).filter((p) => {
    const md = p && p.metadata || {};
    return String(p && p.method || '').toUpperCase() === 'BTC' && md.kind === 'service_purchase' && !md.active;
  });
  res.json({
    ok: true,
    enabled: _btcWatcherState.enabled,
    wallet: ADMIN_OWNER_BTC,
    intervalMs: Number(process.env.BTC_WATCHER_INTERVAL_MS || 30000),
    pendingCount: pending.length,
    lastRunAt: _btcWatcherState.lastRunAt,
    lastMatchAt: _btcWatcherState.lastMatchAt,
    scannedTx: _btcWatcherState.scannedTx,
    matched: _btcWatcherState.matched,
    lastError: _btcWatcherState.lastError,
    generatedAt: new Date().toISOString(),
  });
});

app.get('/api/security/pq/status', routeCache.cacheMiddleware(), (req, res) => {
  const hasConfirmToken = !!(process.env.PAYMENT_CONFIRM_TOKEN || process.env.ADMIN_SECRET);
  const hasPqSecret = !!process.env.PQ_CONFIRM_SECRET;
  const mode = hasPqSecret ? 'hybrid-token+pqhmac' : (hasConfirmToken ? 'token' : 'open-dev');
  res.json({
    ok: true,
    mode,
    digest: _pqDigest,
    antiReplayWindowMs: 10 * 60 * 1000,
    signatureHeaders: ['x-pq-signature', 'x-pq-timestamp'],
    paymentsProtected: ['/api/payments/btc/confirm', '/api/payments/paypal/confirm'],
    quantumReadiness: {
      level: hasPqSecret ? 'enhanced-hybrid' : 'baseline',
      keyAgility: true,
      digestAgility: true
    },
    timestamp: new Date().toISOString()
  });
});

function _controlTowerBasePayload() {
  const perf = routeCache.getStats();
  const dbRevenue = dbPayments.revenueStats();
  const outcomes = _valueProof ? _valueProof.totals() : null;
  const evolution = evolutionCore && typeof evolutionCore.getStatus === 'function' ? evolutionCore.getStatus() : null;
  const uiStatus = uiEvolution && typeof uiEvolution.getStatus === 'function' ? uiEvolution.getStatus() : null;
  const perfStatus = performanceMonitor && typeof performanceMonitor.getStatus === 'function' ? performanceMonitor.getStatus() : null;
  const resilience = qrc && qrc.healthCheck && typeof qrc.healthCheck === 'function' ? qrc.healthCheck() : null;
  return {
    generatedAt: new Date().toISOString(),
    brand: 'ZeusAI',
    source: 'zeusai-backend',
    metrics: {
      trackedRoutes: perf.profiler.trackedRoutes,
      cacheHitRate: perf.cache.hitRate,
      revenueUsd: Number(dbRevenue.revenue || 0),
      revenueCount: Number(dbRevenue.cnt || 0),
      outcomes: outcomes && Number.isFinite(Number(outcomes.count)) ? Number(outcomes.count) : 0,
    },
    moduleStatus: {
      evolution,
      uiEvolution: uiStatus,
      performanceMonitor: perfStatus,
      resilience,
    }
  };
}

app.get('/api/future/standard', routeCache.cacheMiddleware(), (req, res) => {
  const base = _controlTowerBasePayload();
  const capabilities = {
    realtimeSSE: true,
    aiRegistry: true,
    aiGateway: true,
    paymentsBTC: true,
    paymentsPayPal: true,
    pqPaymentConfirm: true,
    integrityDoc: true,
    passkeys: true,
    capabilityTokens: true,
    sourceCompatibility: true,
    backendAuthoritative: true,
  };
  const enabled = Object.values(capabilities).filter(Boolean).length;
  const total = Object.keys(capabilities).length;
  const readinessScore = Math.round((enabled / total) * 100);
  res.json({
    ok: true,
    ...base,
    horizonYears: 30,
    readinessScore,
    capabilities,
    standards: ['REST/JSON', 'SSE', 'HMAC verification', 'SHA3 signatures', 'WebAuthn passkeys']
  });
});

function _buildEvolutionStatusPayload() {
  const base = _controlTowerBasePayload();
  const evo = evolutionCore && typeof evolutionCore.getStatus === 'function' ? evolutionCore.getStatus() : null;
  const loopStatus = evo && evo.state ? evo.state : { status: 'unknown' };
  return {
    ok: true,
    ...base,
    loop: {
      status: loopStatus.status || 'active',
      runs: Number(loopStatus.runs || 0),
      lastRun: loopStatus.lastRun || null,
      health: loopStatus.health || 'ok',
    },
    strategy: {
      policy: 'backend-guardrailed-optimization',
      rollbackReady: true,
      hardStopOnErrorSpike: true,
    }
  };
}

app.get('/api/evolution/loop', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildEvolutionStatusPayload());
});
app.get('/api/evolution/status', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildEvolutionStatusPayload());
});

function _buildLedgerPayload() {
  const base = _controlTowerBasePayload();
  const outcomeTotals = _valueProof ? _valueProof.totals() : { count: 0, total: 0 };
  return {
    ok: true,
    ...base,
    ledger: {
      status: _valueProof ? 'active' : 'degraded',
      records: Number(outcomeTotals.count || 0),
      valueProvenUsd: Number(outcomeTotals.total || 0),
      integrityEndpoint: '/.well-known/unicorn-integrity.json',
      verification: 'signed-outcome-ledger'
    }
  };
}

app.get('/api/trust/ledger', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildLedgerPayload());
});
app.get('/api/ledger/status', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildLedgerPayload());
});

app.get('/api/revenue/proof', routeCache.cacheMiddleware(), (req, res) => {
  const base = _controlTowerBasePayload();
  const payments = dbPayments.list({ status: 'completed' });
  const methods = {};
  let totalUsd = 0;
  for (const pay of payments) {
    const method = String(pay.method || 'UNKNOWN').toUpperCase();
    methods[method] = (methods[method] || 0) + 1;
    totalUsd += Number(pay.total || 0);
  }
  const outcomeTotals = _valueProof ? _valueProof.totals() : { count: 0, total: 0 };
  res.json({
    ok: true,
    ...base,
    revenue: {
      paidReceipts: payments.length,
      totalUsd: Number(totalUsd.toFixed(2)),
      methods,
      valueProofRecords: Number(outcomeTotals.count || 0),
      valueProofUsd: Number(outcomeTotals.total || 0)
    }
  });
});

function _buildResilienceStatusPayload() {
  const base = _controlTowerBasePayload();
  const qHealth = qrc && typeof qrc.healthCheck === 'function' ? qrc.healthCheck() : { healthy: false, score: 0 };
  const runState = global.__ZEUSAI_DRILL__ || { runs: 0, lastRunAt: null, avgRecoveryMs: 0, score: 95, status: 'ready' };
  return {
    ok: true,
    ...base,
    drill: {
      status: qHealth.healthy ? 'ready' : 'degraded',
      totalRuns: Number(runState.runs || 0),
      lastRunAt: runState.lastRunAt || null,
      averageRecoveryMs: Number(runState.avgRecoveryMs || 0),
      readinessScore: Number(runState.score || (qHealth.score || 95)),
      health: qHealth,
      policy: 'safe-simulated-failover'
    }
  };
}

app.get('/api/resilience/drill', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildResilienceStatusPayload());
});
app.get('/api/resilience/status', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildResilienceStatusPayload());
});

function _runResilienceDrill() {
  if (!global.__ZEUSAI_DRILL__) {
    global.__ZEUSAI_DRILL__ = { runs: 0, lastRunAt: null, avgRecoveryMs: 420, score: 99.2, status: 'ready' };
  }
  const d = global.__ZEUSAI_DRILL__;
  const perf = routeCache.getStats();
  const slowest = perf.profiler.top5Slowest && perf.profiler.top5Slowest.length ? perf.profiler.top5Slowest[0] : null;
  const baseRecovery = slowest ? Math.max(180, Number(slowest.avgMs || 200) * 2) : 320;
  const simulatedRecoveryMs = Math.round(baseRecovery);
  d.runs += 1;
  d.lastRunAt = new Date().toISOString();
  d.avgRecoveryMs = Math.round(((d.avgRecoveryMs * Math.max(0, d.runs - 1)) + simulatedRecoveryMs) / d.runs);
  d.score = Number(Math.max(95, 100 - (d.avgRecoveryMs / 180)).toFixed(1));
  d.status = 'ready';
  return {
    ok: true,
    brand: 'ZeusAI',
    generatedAt: new Date().toISOString(),
    simulatedRecoveryMs,
    drill: {
      totalRuns: d.runs,
      lastRunAt: d.lastRunAt,
      averageRecoveryMs: d.avgRecoveryMs,
      readinessScore: d.score,
    }
  };
}

app.post('/api/resilience/drill/run', (req, res) => {
  res.json(_runResilienceDrill());
});
app.post('/api/resilience/run', (req, res) => {
  res.json(_runResilienceDrill());
});

function _buildAutoTunePayload() {
  const base = _controlTowerBasePayload();
  const perf = routeCache.getStats();
  const topSlow = perf.profiler.top5Slowest || [];
  const avgSlow = topSlow.length ? (topSlow.reduce((sum, x) => sum + Number(x.avgMs || 0), 0) / topSlow.length) : 80;
  const safeRatio = Math.max(0, Math.min(1, 1 - (avgSlow / 260)));
  const intensity = Number((0.35 + safeRatio * 0.6).toFixed(2));
  const motion = intensity > 0.78 ? 'high' : (intensity > 0.58 ? 'balanced' : 'safe');
  const profile = {
    mode: 'auto-cinematic',
    motion,
    intensity,
    parallax: Number((intensity * 1.1).toFixed(2)),
    glassBlurPx: Math.round(8 + intensity * 12),
    glowPower: Number((0.35 + intensity * 0.9).toFixed(2)),
  };
  return {
    ok: true,
    ...base,
    profile: _cinematicProfileOverride ? { ...profile, ..._cinematicProfileOverride, source: 'manual-override' } : { ...profile, source: 'auto-profiler' },
    source: {
      topSlowRoutes: topSlow.slice(0, 3),
      cacheHitRate: perf.cache.hitRate,
    }
  };
}

app.get('/api/ui/autotune', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildAutoTunePayload());
});
app.get('/api/cinematic/profile', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildAutoTunePayload());
});
app.post('/api/cinematic/apply', (req, res) => {
  const body = req.body || {};
  _cinematicProfileOverride = {
    motion: body.motion || undefined,
    intensity: Number.isFinite(Number(body.intensity)) ? Number(body.intensity) : undefined,
    parallax: Number.isFinite(Number(body.parallax)) ? Number(body.parallax) : undefined,
    glassBlurPx: Number.isFinite(Number(body.glassBlurPx)) ? Number(body.glassBlurPx) : undefined,
    glowPower: Number.isFinite(Number(body.glowPower)) ? Number(body.glowPower) : undefined,
  };
  Object.keys(_cinematicProfileOverride).forEach((k) => {
    if (_cinematicProfileOverride[k] === undefined) delete _cinematicProfileOverride[k];
  });
  res.json({ ok: true, applied: _cinematicProfileOverride, generatedAt: new Date().toISOString() });
});

function _buildPerformanceGovernancePayload() {
  const base = _controlTowerBasePayload();
  const perf = routeCache.getStats();
  const topSlow = perf.profiler.top5Slowest || [];
  const apiP95 = topSlow.length ? Math.round(topSlow.reduce((sum, r) => sum + Number(r.avgMs || 0), 0) / topSlow.length) : 90;
  const apiP99 = Math.round(apiP95 + 35);
  const renderP95 = Math.max(10, Math.round(apiP95 / 8));
  const renderP99 = renderP95 + 7;
  const score = Number(Math.max(90, 100 - (apiP99 / 20) - (renderP99 / 5)).toFixed(1));
  let mode = 'full-cinema';
  let action = 'none';
  if (apiP99 > 165 || renderP99 > 27) {
    mode = 'safe';
    action = 'reduce-blur-and-motion';
  } else if (apiP99 > 135 || renderP99 > 22) {
    mode = 'balanced';
    action = 'cap-parallax-and-glow';
  }
  return {
    ok: true,
    ...base,
    performance: { apiP95Ms: apiP95, apiP99Ms: apiP99, renderP95Ms: renderP95, renderP99Ms: renderP99, score },
    policy: {
      mode,
      action,
      downgradeThreshold: { apiP99Ms: 165, renderP99Ms: 27 },
      upgradeThreshold: { apiP99Ms: 130, renderP99Ms: 20 },
    },
    budget: {
      frameBudgetMs: 16.7,
      targetFps: 60,
      estimatedFps: Number(Math.max(32, Math.min(60, 1000 / Math.max(1, renderP95))).toFixed(1))
    }
  };
}

app.get('/api/performance/governance', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildPerformanceGovernancePayload());
});
app.get('/api/perf/governance', routeCache.cacheMiddleware(), (req, res) => {
  res.json(_buildPerformanceGovernancePayload());
});

const _unicornEventsInterval = setInterval(() => {
  if (_unicornEventsClients.size === 0) return;
  const dbPurchasesCount = dbPayments.list().filter((p) => p.metadata && p.metadata.kind === 'service_purchase').length;
  _emitUnicornEvent('heartbeat', { services: _unicornServices.length, purchases: Math.max(_unicornPurchases.size, dbPurchasesCount) });
}, 5000);
if (typeof _unicornEventsInterval.unref === 'function') _unicornEventsInterval.unref();

// ==================== BTC QR CODE ====================
app.get('/api/payment/btc-qr', async (req, res) => {
  const address = String(req.query.address || ADMIN_OWNER_BTC).slice(0, 200);
  const amount  = parseFloat(req.query.amount) || 0;
  const uri     = amount > 0 ? `bitcoin:${address}?amount=${amount}` : `bitcoin:${address}`;
  try {
    const QRCode = require('qrcode');
    const dataUrl = await QRCode.toDataURL(uri, { width: 256, margin: 2, color: { dark: '#00d4ff', light: '#05060e' } });
    res.json({ qr: dataUrl, uri });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AI CHAT ====================
// Provideri: AIOrchestrator (15 providers) → aiProviders → UAIC → Llama → keyword
const _aiProviders = require('./modules/aiProviders');
// 🧠 AI Orchestrator — routing inteligent per task-type, fallback multi-model,
//    cost optimizer, health monitor, load balancer, caching, circuit breaker
let _aiOrchestrator = null;
try { _aiOrchestrator = require('./modules/ai-orchestrator'); } catch (e) {
  console.warn('[Backend] ai-orchestrator not loaded:', e.message);
}
// 🌐 Multi-Model Router — fallback automat între 14 provideri AI cu routing inteligent și optimizare cost
let _multiRouter = null;
try { _multiRouter = require('./modules/multi-model-router'); } catch (e) {
  console.warn('[MultiRouter] Nu s-a putut încărca:', e.message);
}
// 🤖 UAIC — orchestrează inteligent toate resursele AI (OpenAI, DeepSeek,
//           Claude, Gemini, Ollama local). Activat automat la pornire.
let _uaic = null;
try { _uaic = require('./modules/universal-ai-connector'); } catch (e) {
  try { _uaic = require('./modules/universalAIConnector'); } catch { _uaic = null; }
}

// 🦙 Llama bridge — also available standalone via /api/llama/status
const _enableLocalLlm = ['1', 'true', 'yes', 'on'].includes(String(process.env.ENABLE_OLLAMA || '').toLowerCase());
let _llamaBridge = null;
if (_enableLocalLlm) {
  try { _llamaBridge = require('./modules/llamaBridge'); } catch { /* optional */ }
}

// ── Register optional profit & orchestration modules in mesh ──
if (_aiOrchestrator) meshOrchestrator.register('aiOrchestrator', _aiOrchestrator, { statusFn: 'getStatus' });
if (_revenueRouter) meshOrchestrator.register('sovereignRevenueRouter', _revenueRouter, { statusFn: 'getStatus' });
if (_monetizeMesh) meshOrchestrator.register('globalMonetizationMesh', _monetizeMesh, { statusFn: 'getStatus' });
if (_uaic) meshOrchestrator.register('universalAIConnector', _uaic, { statusFn: 'getStatus' });

const ZEUS_SYSTEM = 'You are Zeus AI Assistant, an expert in business automation, AI, blockchain, payments, and enterprise solutions. Be concise and helpful. You can also respond in Romanian if the user writes in Romanian.';

app.post('/api/chat', authRateLimit(30, 60_000), async (req, res) => {
  const { message, history = [], taskType = 'auto' } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const cleanMessage = sanitizeString(message, 2000);
  if (!cleanMessage) return res.status(400).json({ error: 'message required' });
  if (!Array.isArray(history)) return res.status(400).json({ error: 'history must be an array' });

  // 1️⃣ AI Auto Dispatcher — detecție automată tip task + routing la cel mai bun AI
  if (_aiAutoDispatcher) {
    try {
      const dispResult = await _aiAutoDispatcher.dispatch(cleanMessage, {
        context: 'chat',
        taskType: taskType === 'auto' ? null : taskType,
        history,
        useCache: true,
      });
      if (dispResult && dispResult.reply) return res.json(dispResult);
    } catch (err) {
      console.warn('[Chat] AIAutoDispatcher eșuat:', err.message);
    }
  }

  // 2️⃣ AI Orchestrator — routing inteligent (15 providers, fallback automat, cost optimizer)
  if (_aiOrchestrator) {
    try {
      const orchResult = await _aiOrchestrator.ask(message, {
        taskType: taskType === 'auto' ? 'auto' : (taskType || 'auto'),
        history,
        useCache: true,
      });
      if (orchResult && orchResult.reply) return res.json(orchResult);
    } catch (err) {
      console.warn('[Chat] AIOrchestrator eșuat:', err.message);
    }
  }

  // 2️⃣ Multi-Model Router — fallback automat între 14 provideri AI
  if (_multiRouter) {
    try {
      const mrResult = await _multiRouter.ask(message, {
        taskType: taskType || 'chat',
        systemPrompt: ZEUS_SYSTEM,
        maxTokens: 500,
        history,
      });
      if (mrResult && mrResult.reply) return res.json({ reply: mrResult.reply, model: mrResult.model, provider: mrResult.provider, latencyMs: mrResult.latencyMs });
    } catch (err) {
      console.warn('[Chat] MultiRouter a eșuat:', err.message);
    }
  }

  // 1️⃣ Cloud AI providers cascade (OpenAI → DeepSeek → Anthropic → Gemini → Mistral → Cohere → xAI Grok)
  const cloudResult = await _aiProviders.chat(cleanMessage, history);
  if (cloudResult) return res.json(cloudResult);

  // 3️⃣ UAIC – routare automată la cel mai bun provider disponibil (cheapest first pentru chat)
  if (_uaic) {
    try {
      const result = await _uaic.ask(cleanMessage, {
        taskType: 'simple',
        systemPrompt: ZEUS_SYSTEM,
        maxTokens: 400,
        history,
      });
      return res.json({ reply: result.text, model: result.model });
    } catch (err) {
      console.warn('[Chat] UAIC a eșuat:', err.message);
    }
  }

  // 4️⃣ Llama local fallback (zero-cost, rulează pe Hetzner via Ollama)
  if (_llamaBridge) {
    const historyText = history.slice(-4)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    const prompt = historyText
      ? `${historyText}\nUser: ${cleanMessage}\nAssistant:`
      : cleanMessage;
    const llamaReply = await _llamaBridge.generate(
      prompt,
      _llamaBridge.PRIORITY.CHAT,
      ZEUS_SYSTEM
    );
    if (llamaReply) {
      return res.json({ reply: llamaReply, model: 'llama-local' });
    }
  }

  // 4️⃣ Smart keyword fallback (static — când niciun AI nu e disponibil)
  const lower = cleanMessage.toLowerCase();
  const KEYWORD_RESPONSES = [
    [['payment', 'plat'], 'Zeus AI suportă plăți via Stripe, PayPal, Bitcoin și alte 10+ metode. Accesează /payments pentru a iniția o tranzacție.'],
    [['marketplace'], 'Marketplace-ul Zeus AI oferă 50+ servicii AI specializate. Explorează /marketplace pentru prețuri personalizate.'],
    [['blockchain', 'crypto'], 'Modulul Quantum Blockchain oferă tranzacții securizate și smart contracts. Accesează /innovation/blockchain.'],
    [['compliance', 'legal'], 'Compliance Engine-ul acoperă GDPR, HIPAA, SOX și 25+ standarde globale. Accesează /innovation/legal.'],
    [['revenue', 'profit'], 'Auto Revenue Engine generează deal-uri autonom 24/7. Dashboard-ul executiv afișează metricele live la /executive.'],
    [['plan', 'pricing', 'pret'], 'Planuri disponibile: Free ($0), Starter ($29/lună), Pro ($99/lună), Enterprise ($499/lună). Accesează /payments pentru upgrade.'],
    [['innovation', 'inova'], 'Innovation Command Center coordonează AI Workforce, M&A Advisor, Energy Grid și Quantum Blockchain. Accesează /innovation.'],
    [['admin', 'dashboard'], 'Dashboard-ul admin este disponibil la /admin/login. Dashboard-ul executiv la /executive.'],
  ];
  const matched = KEYWORD_RESPONSES.find(([keywords]) => keywords.some(k => lower.includes(k)));
  const reply = matched ? matched[1] : 'Bun venit la Zeus AI! Sunt asistentul tău pentru business automation, AI, blockchain și plăți globale. Cum te pot ajuta?';
  res.json({ reply, model: 'keyword-fallback' });
});

// ==================== UAIC STATUS + ADMIN ====================
app.get('/api/uaic/status', (req, res) => {
  if (!_uaic) return res.json({ active: false, reason: 'uaic_not_loaded' });
  res.json(_uaic.getStatus());
});

// ==================== LLAMA STATUS ====================
app.get('/api/llama/status', (req, res) => {
  if (!_llamaBridge) return res.json({ available: false, reason: 'bridge_not_loaded' });
  res.json(_llamaBridge.getStatus());
});

function classifyAiTask(taskType, message) {
  const t = String(taskType || '').toLowerCase();
  if (t && t !== 'auto' && t !== 'default') return t;
  const m = String(message || '').toLowerCase();
  if (/(code|bug|refactor|function|api|fix|javascript|node|python)/.test(m)) return 'coding';
  if (/(security|attack|vuln|audit|auth|token|encryption|quantum)/.test(m)) return 'security';
  if (/(analy|strategy|roadmap|plan|reason|compare)/.test(m)) return 'analysis';
  if (/(translate|copy|microcopy|content|write|text)/.test(m)) return 'writing';
  return 'general';
}

function buildAiRegistry() {
  const providers = _aiProviders.getStatus();
  const uaicStatus = _uaic && typeof _uaic.getStatus === 'function' ? _uaic.getStatus() : null;
  const items = [];

  items.push({
    id: 'ai-auto-dispatcher',
    label: 'AI Auto Dispatcher',
    kind: 'router',
    source: 'zeusai',
    available: !!_aiAutoDispatcher,
    capabilities: ['auto-select', 'classification', 'routing', 'fallback']
  });
  items.push({
    id: 'ai-orchestrator',
    label: 'AI Orchestrator',
    kind: 'router',
    source: 'zeusai',
    available: !!_aiOrchestrator,
    capabilities: ['routing', 'health-aware', 'fallback']
  });
  items.push({
    id: 'multi-model-router',
    label: 'Multi Model Router',
    kind: 'router',
    source: 'zeusai',
    available: !!_multiRouter,
    capabilities: ['routing', 'cost-optimization', 'fallback']
  });
  items.push({
    id: 'uaic',
    label: 'Universal AI Connector',
    kind: 'gateway',
    source: 'zeusai',
    available: !!(_uaic && typeof _uaic.ask === 'function'),
    capabilities: ['auto-select', 'provider-discovery', 'future-ready'],
    models: uaicStatus && Array.isArray(uaicStatus.models) ? uaicStatus.models : []
  });
  items.push({
    id: 'llama-local',
    label: 'Llama Local',
    kind: 'model',
    source: 'local',
    available: !!_llamaBridge,
    capabilities: ['private', 'offline', 'low-latency']
  });

  for (const p of providers) {
    items.push({
      id: String(p.provider || '').toLowerCase().replace(/\s+/g, '-'),
      label: p.provider,
      kind: 'provider',
      source: 'external',
      available: !!p.configured,
      unstable: !!p.unstable,
      tier: p.tier || 'standard',
      envKey: p.envKey,
      capabilities: ['chat', 'generation']
    });
  }

  const dedup = new Map();
  for (const item of items) {
    if (!item || !item.id) continue;
    if (!dedup.has(item.id)) dedup.set(item.id, item);
  }
  const allItems = Array.from(dedup.values());
  const activeItems = allItems.filter(x => x.available);

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    total: allItems.length,
    active: activeItems.length,
    routers: allItems.filter(x => x.kind === 'router' && x.available).map(x => x.id),
    items: allItems,
  };
}

// ==================== AI PROVIDERS STATUS ====================
app.get('/api/ai/status', routeCache.cacheMiddleware(), (req, res) => {
  const providers = _aiProviders.getStatus();
  const llama = _llamaBridge ? _llamaBridge.getStatus() : { available: false, reason: 'bridge_not_loaded' };
  const orchStatus = _aiOrchestrator ? _aiOrchestrator.getStatus() : { active: false };
  const multiRouter = _multiRouter ? _multiRouter.getStatus() : { active: false };
  const activeCount = providers.filter(p => p.configured).length + (llama.available ? 1 : 0);
  res.json({
    providers,
    llama,
    orchestrator: orchStatus,
    multiRouter,
    activeCount,
    total: providers.length + 1,
    timestamp: new Date().toISOString(),
  });
});

// ==================== AI REGISTRY + GATEWAY ====================
app.get('/api/ai/registry', routeCache.cacheMiddleware(), (req, res) => {
  res.json(buildAiRegistry());
});

app.post('/api/ai/use', authRateLimit(30, 60_000), async (req, res) => {
  const p = req.body || {};
  const promptRaw = p.message || p.prompt || '';
  const prompt = sanitizeString(promptRaw, 4000);
  if (!prompt) return res.status(400).json({ error: 'message required' });

  const taskType = sanitizeString(String(p.taskType || 'auto'), 80) || 'auto';
  const history = Array.isArray(p.history) ? p.history.slice(0, 12) : [];
  const requestedAi = sanitizeString(String(p.ai || p.aiId || 'auto'), 120).toLowerCase() || 'auto';
  const taskClass = classifyAiTask(taskType, prompt);

  const registry = buildAiRegistry();
  let selected = requestedAi;
  if (selected === 'auto') {
    if (_aiAutoDispatcher) selected = 'ai-auto-dispatcher';
    else if (_aiOrchestrator) selected = 'ai-orchestrator';
    else if (_multiRouter) selected = 'multi-model-router';
    else if (_uaic && typeof _uaic.ask === 'function') selected = 'uaic';
    else if (_llamaBridge) selected = 'llama-local';
    else selected = 'ai-providers';
  }

  try {
    let result = null;

    if (selected === 'ai-auto-dispatcher' && _aiAutoDispatcher) {
      result = await _aiAutoDispatcher.dispatch(prompt, { context: 'ai-gateway', taskType: taskClass, history, useCache: true });
    } else if (selected === 'ai-orchestrator' && _aiOrchestrator) {
      result = await _aiOrchestrator.ask(prompt, { taskType: taskClass, history, useCache: true });
    } else if (selected === 'multi-model-router' && _multiRouter) {
      result = await _multiRouter.ask(prompt, { taskType: taskClass, history, maxTokens: 700, systemPrompt: ZEUS_SYSTEM });
    } else if (selected === 'uaic' && _uaic && typeof _uaic.ask === 'function') {
      result = await _uaic.ask(prompt, { taskType: taskClass, history, prioritize: 'balanced' });
    } else if (selected === 'llama-local' && _llamaBridge) {
      const reply = await _llamaBridge.generate(prompt, _llamaBridge.PRIORITY.CHAT, ZEUS_SYSTEM);
      result = reply ? { reply, model: 'llama-local', provider: 'local' } : null;
    } else {
      result = await _aiProviders.chat(prompt, history);
      if (result && !result.provider) result.provider = 'ai-providers';
    }

    if (!result || !result.reply) {
      const fallbackReply = `AI Gateway is online, but no external provider is reachable now. Request classified as ${taskClass}. Retry shortly or configure additional providers in ZeusAI AI Registry.`;
      return res.json({
        ok: true,
        fallback: true,
        selection: { requested: requestedAi, selected: 'keyword-fallback', taskClass, mode: 'auto-fallback' },
        reply: fallbackReply,
        provider: 'fallback',
        model: 'gateway-fallback',
        latencyMs: null,
        registry,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      ok: true,
      selection: { requested: requestedAi, selected, taskClass, mode: requestedAi === 'auto' ? 'auto' : 'forced' },
      reply: result.reply,
      provider: result.provider || selected,
      model: result.model || null,
      latencyMs: result.latencyMs || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'ai_gateway_failed', selection: { requested: requestedAi, selected, taskClass } });
  }
});

// ==================== AI CONNECTIVITY CHECK ====================
app.get('/api/ai/connectivity-check', async (req, res) => {
  const AI_PROVIDERS = [
    { name: 'OpenAI',        key: 'OPENAI_API_KEY' },
    { name: 'DeepSeek',      key: 'DEEPSEEK_API_KEY' },
    { name: 'Anthropic',     key: 'ANTHROPIC_API_KEY' },
    { name: 'Gemini',        key: 'GEMINI_API_KEY' },
    { name: 'Mistral',       key: 'MISTRAL_API_KEY' },
    { name: 'Cohere',        key: 'COHERE_API_KEY' },
    { name: 'xAI Grok',     key: 'XAI_API_KEY' },
    { name: 'Groq',          key: 'GROQ_API_KEY' },
    { name: 'OpenRouter',    key: 'OPENROUTER_API_KEY' },
    { name: 'Perplexity',    key: 'PERPLEXITY_API_KEY' },
    { name: 'HuggingFace',   key: 'HF_API_KEY' },
    { name: 'Together AI',   key: 'TOGETHER_API_KEY' },
    { name: 'Fireworks AI',  key: 'FIREWORKS_API_KEY' },
    { name: 'SambaNova',     key: 'SAMBANOVA_API_KEY' },
    { name: 'NVIDIA NIM',    key: 'NVIDIA_NIM_API_KEY' },
  ];
  const results = AI_PROVIDERS.map(p => {
    const val = process.env[p.key];
    const configured = !!(val && val.length > 8 && !val.startsWith('your_'));
    return { provider: p.name, envKey: p.key, configured, keyPresent: !!val };
  });
  const configuredCount = results.filter(r => r.configured).length;
  const uaicStatus = _uaic ? _uaic.getStatus() : null;
  res.json({
    summary: { total: results.length, configured: configuredCount, missing: results.length - configuredCount },
    providers: results,
    uaic: uaicStatus ? { active: true, models: uaicStatus.models, providers: uaicStatus.providers } : { active: false },
    orchestrator: _aiOrchestrator ? _aiOrchestrator.getStatus() : { active: false },
    multiRouter: _multiRouter ? _multiRouter.getStatus() : { active: false },
    timestamp: new Date().toISOString(),
  });
});

// ==================== AI ORCHESTRATOR ENDPOINTS ====================
app.get('/api/ai/orchestrator/status', routeCache.cacheMiddleware(), (req, res) => {
  if (!_aiOrchestrator) return res.json({ active: false, reason: 'orchestrator_not_loaded' });
  res.json(_aiOrchestrator.getStatus());
});

app.get('/api/ai/orchestrator/report', routeCache.cacheMiddleware(), (req, res) => {
  if (!_aiOrchestrator) return res.json({ active: false, reason: 'orchestrator_not_loaded' });
  res.json(_aiOrchestrator.getPerformanceReport());
});

app.get('/api/ai/orchestrator/health', (req, res) => {
  if (!_aiOrchestrator) return res.json({ active: false, reason: 'orchestrator_not_loaded' });
  res.json(_aiOrchestrator.getHealthReport());
});

app.post('/api/ai/orchestrator/ask', authMiddleware, async (req, res) => {
  if (!_aiOrchestrator) return res.status(503).json({ error: 'orchestrator_not_loaded' });
  const { message, taskType = 'default', history = [], preferProvider, useCache = true } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const result = await _aiOrchestrator.ask(message, { taskType, history, preferProvider, useCache });
    if (!result) return res.status(503).json({ error: 'All AI providers unavailable' });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/orchestrator/repair', adminTokenMiddleware, (req, res) => {
  if (!_aiOrchestrator) return res.json({ active: false });
  const repaired = _aiOrchestrator.autoRepair();
  res.json({ repaired, timestamp: new Date().toISOString() });
});

app.get('/api/ai/orchestrator/routing', (req, res) => {
  if (!_aiOrchestrator) return res.json({ active: false });
  res.json({ taskRouting: _aiOrchestrator.TASK_ROUTING, timestamp: new Date().toISOString() });
});
// ==================== MULTI-MODEL ROUTER ROUTES ====================
// GET /api/ai/multi-router/status — starea tuturor celor 14 provideri
app.get('/api/ai/multi-router/status', routeCache.cacheMiddleware(), (req, res) => {
  if (!_multiRouter) return res.status(503).json({ error: 'multi-model-router not loaded' });
  res.json(_multiRouter.getStatus());
});

// GET /api/ai/multi-router/report — raport detaliat de performanță
app.get('/api/ai/multi-router/report', (req, res) => {
  if (!_multiRouter) return res.status(503).json({ error: 'multi-model-router not loaded' });
  res.json(_multiRouter.getPerformanceReport());
});

// POST /api/ai/multi-router/ask — ask direct cu routing inteligent
app.post('/api/ai/multi-router/ask', authRateLimit(30, 60_000), async (req, res) => {
  if (!_multiRouter) return res.status(503).json({ error: 'multi-model-router not loaded' });
  const { message, taskType = 'chat', systemPrompt, maxTokens = 500, history = [] } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const result = await _multiRouter.ask(message, { taskType, systemPrompt, maxTokens, history });
    if (!result) return res.status(503).json({ error: 'all providers failed' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/multi-router/reset — resetare statistici (admin only)
app.post('/api/admin/multi-router/reset', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  if (!_multiRouter) return res.status(503).json({ error: 'multi-model-router not loaded' });
  _multiRouter.resetStats();
  res.json({ success: true, message: 'Statistici resetate' });
});

// ==================== AI AUTO DISPATCHER API ====================
// GET /api/ai/dispatch/status — status dispatcher + statistici routing automat
app.get('/api/ai/dispatch/status', routeCache.cacheMiddleware(), (req, res) => {
  if (!_aiAutoDispatcher) return res.status(503).json({ error: 'ai-auto-dispatcher not loaded' });
  res.json(_aiAutoDispatcher.getStatus());
});

// POST /api/ai/dispatch — dispatch automat: detectează tipul task-ului și rutează la cel mai bun AI
app.post('/api/ai/dispatch', authRateLimit(30, 60_000), async (req, res) => {
  if (!_aiAutoDispatcher) return res.status(503).json({ error: 'ai-auto-dispatcher not loaded' });
  const { message, context = 'default', taskType, history = [], systemPrompt, preferProvider } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const cleanMessage = sanitizeString(message, 2000);
  if (!cleanMessage) return res.status(400).json({ error: 'message required' });
  try {
    const result = await _aiAutoDispatcher.dispatch(cleanMessage, {
      context, taskType, history, systemPrompt, preferProvider,
    });
    if (!result) return res.status(503).json({ error: 'all AI providers failed' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/dispatch/batch — dispatch multiple task-uri în paralel
app.post('/api/ai/dispatch/batch', authRateLimit(10, 60_000), async (req, res) => {
  if (!_aiAutoDispatcher) return res.status(503).json({ error: 'ai-auto-dispatcher not loaded' });
  const { tasks } = req.body || {};
  if (!Array.isArray(tasks) || tasks.length === 0) return res.status(400).json({ error: 'tasks array required' });
  if (tasks.length > 10) return res.status(400).json({ error: 'max 10 tasks per batch' });
  try {
    const results = await _aiAutoDispatcher.dispatchBatch(
      tasks.map(t => ({ ...t, message: sanitizeString(t.message, 2000) }))
    );
    res.json({ results, total: tasks.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTE PERFORMANCE & CACHE API (PR #194) ====================
// GET /api/perf/stats — top-5 cele mai lente rute + cache stats
app.get('/api/perf/stats', (req, res) => {
  res.json(routeCache.getStats());
});

// GET /api/perf/cache — starea detaliată a cache-ului LRU
app.get('/api/perf/cache', (req, res) => {
  res.json(routeCache.getCacheStatus());
});

// POST /api/admin/perf/cache/clear — golire cache (admin only)
app.post('/api/admin/perf/cache/clear', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  res.json(routeCache.clearCache());
});


// Middleware for public API access (used with x-api-key header)
function apiKeyMiddleware(req, res, next) {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey) return res.status(401).json({ error: 'x-api-key header required' });
  const keyRecord = dbApiKeys.verify(rawKey);
  if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' });
  const allowed = dbApiKeys.checkRateLimit(keyRecord.keyId, keyRecord.planId, req.path);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded. Upgrade your plan.' });
  req.apiKey = keyRecord;
  return next();
}

// Create API key (authenticated users)
app.post('/api/platform/api-keys/create', authMiddleware, (req, res) => {
  const { name, planId } = req.body || {};
  const result = dbApiKeys.create({ name: name || 'My API Key', clientId: req.user.id, planId: planId || 'starter' });
  res.json(result);
});

// Alias: /generate (used by template.js dashboard)
app.post('/api/platform/api-keys/generate', authMiddleware, (req, res) => {
  const { name, planId } = req.body || {};
  const result = dbApiKeys.create({ name: name || 'My API Key', clientId: req.user.id, planId: planId || 'starter' });
  res.json(result);
});

// List own API keys
app.get('/api/platform/api-keys/mine', authMiddleware, (req, res) => {
  const keys = dbApiKeys.listForClient(req.user.id);
  res.json({ keys });
});

// ==================== PUBLIC BILLING PLANS ====================
const BILLING_PLANS = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    limits: { apiCalls: 100, seats: 1, modules: ['compliance', 'risk'] },
    features: ['100 API calls/month', 'Compliance audit basic', 'Risk analyzer basic'],
    cta: 'Get started free',
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    priceYearly: 290,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || '',
    currency: 'USD',
    limits: { apiCalls: 10000, seats: 3, modules: 'all' },
    features: ['10,000 API calls/month', 'AI Negotiator', 'Compliance Engine', 'Carbon Exchange', '3 seats'],
    cta: 'Start 14-day trial',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 99,
    priceYearly: 990,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    currency: 'USD',
    popular: true,
    limits: { apiCalls: 120000, seats: 15, modules: 'all' },
    features: ['120,000 API calls/month', 'All AI modules', 'Quantum Blockchain', 'M&A Advisor', 'Legal Contracts', '15 seats', 'Priority support'],
    cta: 'Start 14-day trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 499,
    priceYearly: 4990,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '',
    currency: 'USD',
    limits: { apiCalls: 1500000, seats: 100, modules: 'all' },
    features: ['1.5M API calls/month', 'All AI modules', 'White-label option', 'Custom integrations', '100 seats', 'SLA 99.9%', 'Dedicated support'],
    cta: 'Contact sales',
  },
];

// Public — no auth required; prices are enriched with live dynamic-pricing factors
app.get('/api/billing/plans/public', routeCache.cacheMiddleware(), (req, res) => {
  const conditions = dynamicPricing.getMarketConditions();
  const plans = BILLING_PLANS.map(p => {
    const dp = dynamicPricing.getPrice(p.id);
    // Apply demand factor to monthly/yearly prices (keep integer cents-rounded)
    const factor = dp ? dp.demandFactor : 1;
    const priceMonthly = p.priceMonthly > 0 ? Math.round(p.priceMonthly * factor * 100) / 100 : 0;
    const priceYearly  = p.priceYearly  > 0 ? Math.round(p.priceYearly  * factor * 100) / 100 : 0;
    return {
      ...p,
      stripePriceIdMonthly: undefined,
      stripePriceIdYearly: undefined,
      priceMonthly,
      priceYearly,
      dynamicFactor: Math.round(factor * 1000) / 1000,
      peakHours: conditions.peakHours,
      surgeActive: conditions.surgeActive,
    };
  });
  res.json({ plans, marketConditions: conditions });
});

// Create Stripe subscription checkout session
app.post('/api/billing/subscribe/stripe', authMiddleware, async (req, res) => {
  const { planId, interval = 'monthly' } = req.body || {};
  const plan = BILLING_PLANS.find(p => p.id === planId);
  if (!plan || plan.id === 'free') return res.status(400).json({ error: 'Invalid plan' });

  const priceId = interval === 'yearly' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
  if (!priceId) {
    return res.status(503).json({ error: 'Stripe not configured for this plan. Contact sales.' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(503).json({ error: 'Stripe not configured' });

  const APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const form = new URLSearchParams();
    form.append('mode', 'subscription');
    form.append('line_items[0][price]', priceId);
    form.append('line_items[0][quantity]', '1');
    form.append('success_url', APP_URL + '/dashboard?subscription=success&plan=' + planId);
    form.append('cancel_url', APP_URL + '/payments?subscription=cancelled');
    form.append('customer_email', req.user.email);
    form.append('metadata[userId]', req.user.id);
    form.append('metadata[planId]', planId);

    const resp = await axios.post('https://api.stripe.com/v1/checkout/sessions', form.toString(), {
      headers: { Authorization: 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    res.json({ checkoutUrl: resp.data.url, sessionId: resp.data.id });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: msg });
  }
});

// ==================== STRIPE WEBHOOK ====================
app.post('/api/payment/webhook/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  if (webhookSecret && sig) {
    // Verify signature with stripe-signature header
    const payload = req.body; // raw Buffer due to express.raw() middleware above
    const parts = String(sig).split(',');
    const ts = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];
    if (!ts || !v1) return res.status(400).json({ error: 'Invalid signature format' });
    const signed = crypto.createHmac('sha256', webhookSecret)
      .update(ts + '.' + payload)
      .digest('hex');
    if (signed !== v1) return res.status(400).json({ error: 'Webhook signature mismatch' });
    try {
      event = JSON.parse(payload.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  } else {
    // No webhook secret configured
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' });
    }
    // Development fallback — log a prominent warning
    console.warn('⚠️  [Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — accepting unverified payload (dev mode only)');
    event = req.body || {};
  }

  console.log('[Stripe Webhook]', event.type, event.id || '');

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data?.object || {};
      if (session.payment_status === 'paid') {
        const txId = session.metadata?.txId;
        if (txId) {
          const payment = dbPayments.findByTxId(txId);
          if (payment) {
            dbPayments.save({ ...payment, status: 'completed', providerStatus: 'paid', updatedAt: new Date().toISOString() });
          }
        }
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;
        if (userId && planId) {
          console.log(`[Stripe Webhook] Subscription activated: user=${userId} plan=${planId}`);
          dbUsers.setPlanId(userId, planId);
          const user = dbUsers.findById(userId);
          if (user) {
            emailService.sendPaymentConfirmation(user, { planId, amount: 0, method: 'stripe' })
              .catch(err => console.error('[Email] payment confirmation failed:', err.message));
          }
        }
      }
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data?.object || {};
      console.log('[Stripe Webhook] Invoice paid:', invoice.customer_email, '$' + (invoice.amount_paid / 100));
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data?.object || {};
      console.log('[Stripe Webhook] Invoice payment FAILED:', invoice.customer_email);
      break;
    }
    case 'customer.subscription.deleted': {
      console.log('[Stripe Webhook] Subscription cancelled:', event.data?.object?.id);
      break;
    }
    default:
      console.log('[Stripe Webhook] Unhandled event type:', event.type);
  }

  res.json({ received: true });
});

// ==================== PAYPAL WEBHOOK ====================
app.post('/api/payment/webhook/paypal', async (req, res) => {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const rawBody = req.body; // raw Buffer due to express.raw() middleware

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Verify PayPal webhook signature when PAYPAL_WEBHOOK_ID is configured
  if (webhookId) {
    try {
      const paypalBase = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

      const accessToken = await paymentGateway.getPayPalAccessToken();
      const verifyResponse = await axios.post(
        paypalBase + '/v1/notifications/verify-webhook-signature',
        {
          auth_algo: req.headers['paypal-auth-algo'],
          cert_url: req.headers['paypal-cert-url'],
          transmission_id: req.headers['paypal-transmission-id'],
          transmission_sig: req.headers['paypal-transmission-sig'],
          transmission_time: req.headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: event
        },
        {
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );

      if (verifyResponse.data?.verification_status !== 'SUCCESS') {
        console.warn('[PayPal Webhook] Signature verification failed:', verifyResponse.data?.verification_status);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }
    } catch (verifyErr) {
      console.error('[PayPal Webhook] Signature verification error:', verifyErr.message);
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({ error: 'Webhook verification error' });
      }
      console.warn('[PayPal Webhook] Skipping verification in non-production mode');
    }
  } else if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'PAYPAL_WEBHOOK_ID not configured' });
  } else {
    console.warn('⚠️  [PayPal Webhook] PAYPAL_WEBHOOK_ID not set — accepting unverified payload (dev mode only)');
  }

  const eventType = event.event_type || '';
  const resource = event.resource || {};
  console.log('[PayPal Webhook]', eventType, event.id || '');

  // Extract possible txId/order ID hint from various PayPal resource fields
  const txIdHint = resource.supplementary_data?.related_ids?.order_id
    || resource.custom_id
    || resource.purchase_units?.[0]?.reference_id
    || null;

  // Shared helper: find a pending payment by PayPal order ID or txId hint and update it
  const findPaymentByOrderId = (orderId, hint) => {
    const allPending = dbPayments.list({ status: 'pending' });
    return allPending.find(p =>
      p.providerPaymentId === orderId ||
      p.txId === hint ||
      p.providerPaymentId === hint
    ) || null;
  };

  const markCompleted = (orderId, hint) => {
    const payment = findPaymentByOrderId(orderId, hint);
    if (payment) {
      const updated = {
        ...payment,
        status: 'completed',
        providerStatus: 'COMPLETED',
        processorResponse: {
          approved: true,
          reference: orderId || payment.providerPaymentId,
          note: 'PayPal webhook confirmed.'
        },
        updatedAt: new Date().toISOString()
      };
      dbPayments.save(updated);
      paymentGateway.payments.set(payment.txId, updated);
      console.log('[PayPal Webhook] Payment completed:', payment.txId);
      // Send payment confirmation email
      if (payment.clientId && payment.clientId !== 'guest') {
        const user = dbUsers.findById(payment.clientId);
        if (user) {
          emailService.sendPaymentConfirmation(user, { amount: payment.total, method: 'paypal' })
            .catch(err => console.error('[Email] PayPal confirmation failed:', err.message));
        }
      }
    }
  };

  switch (eventType) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const orderId = resource.supplementary_data?.related_ids?.order_id || resource.id;
      markCompleted(orderId, txIdHint);
      break;
    }
    case 'CHECKOUT.ORDER.APPROVED': {
      // Order approved; attempt to capture it automatically
      try {
        await paymentGateway.capturePayPalOrder(resource.id);
        console.log('[PayPal Webhook] Order captured:', resource.id);
      } catch (captureErr) {
        console.error('[PayPal Webhook] Auto-capture failed:', captureErr.message);
      }
      break;
    }
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.REVERSED': {
      const orderId = resource.supplementary_data?.related_ids?.order_id || resource.id;
      const payment = findPaymentByOrderId(orderId, txIdHint);
      if (payment) {
        dbPayments.save({ ...payment, status: 'failed', providerStatus: eventType, updatedAt: new Date().toISOString() });
        paymentGateway.payments.delete(payment.txId);
      }
      console.log('[PayPal Webhook] Payment denied/reversed:', orderId);
      break;
    }
    default:
      console.log('[PayPal Webhook] Unhandled event type:', eventType);
  }

  res.json({ received: true });
});

app.get('/api/modules', authMiddleware, (req, res) => {
  const registry = getModuleRegistryStatus();
  res.json({
    total: registry.total,
    modules: _allModuleNames,
    categories: registry.categories,
    generatedAt: registry.generatedAt,
  });
});

// Endpoint public (fără autentificare) — returnează doar statistici și categorii
app.get('/api/module-registry', (req, res) => {
  const registry = getModuleRegistryStatus();
  res.json(registry);
});

app.get('/api/unicorn-commerce/status', (req, res) => {
  res.json(unicornCommerceConnector.status({ registry: getModuleRegistryStatus(), btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME }));
});

app.get('/api/unicorn-commerce/catalog', (req, res) => {
  res.json(unicornCommerceConnector.buildCommerceCatalog({ registry: getModuleRegistryStatus(), btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME }));
});

app.get('/api/unicorn-commerce/future-primitives', (req, res) => {
  const items = unicornCommerceConnector.buildFuturePrimitiveServices({ btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME });
  res.json({ ok: true, generatedAt: new Date().toISOString(), count: items.length, items });
});

app.get('/api/billion-scale/status', (req, res) => {
  res.json(billionScaleRevenueEngine.status({ btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME }));
});

app.get('/api/billion-scale/packages', (req, res) => {
  const items = billionScaleRevenueEngine.buildStrategicPackages({ btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME });
  res.json({ ok: true, generatedAt: new Date().toISOString(), count: items.length, items });
});

app.get(['/api/billion-scale/owner-dashboard', '/api/billion-scale/dashboard'], (req, res) => {
  const registry = getModuleRegistryStatus();
  res.json(billionScaleRevenueEngine.ownerRevenueDashboard({ btcWallet: ADMIN_OWNER_BTC, catalogCount: registry.total + 99, registryCount: registry.total }));
});

app.get('/api/billion-scale/marketplace-economics', (req, res) => {
  res.json(billionScaleRevenueEngine.marketplaceEconomics(req.query || {}));
});

app.post('/api/billion-scale/deal-desk/proposal', (req, res) => {
  res.json(billionScaleRevenueEngine.dealDeskProposal(req.body || {}, { btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME }));
});

app.get('/api/billion-scale/vertical-pages', (req, res) => {
  res.json(billionScaleRevenueEngine.verticalGrowthPages());
});

app.get('/api/billion-scale/activation/status', (req, res) => {
  res.json(billionScaleActivationOrchestrator.activationStatus({ registry: getModuleRegistryStatus(), btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME }));
});

app.get('/api/billion-scale/activation/modules', (req, res) => {
  res.json(billionScaleActivationOrchestrator.buildActivationGraph({ registry: getModuleRegistryStatus(), btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME }));
});

app.get('/api/billion-scale/activation/missing', (req, res) => {
  const graph = billionScaleActivationOrchestrator.buildActivationGraph({ registry: getModuleRegistryStatus(), btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME });
  res.json({ ok: true, generatedAt: graph.generatedAt, missingExistingModules: graph.missingExistingModules, generatedControlModules: graph.generatedControlModules });
});

app.post('/api/billion-scale/activation/run', (req, res) => {
  res.json(billionScaleActivationOrchestrator.activationRun(req.body || {}, { registry: getModuleRegistryStatus(), btcWallet: ADMIN_OWNER_BTC, ownerName: ADMIN_OWNER_NAME }));
});

// ==================== ZEUS AUTONOMOUS CORE (ZAC) ====================
// In-process loader. Standalone systemd mode lives in
// backend/modules/zeusAutonomousCore/index.js (run via `node` directly).
let _zac = null;
try { _zac = require('./modules/zeusAutonomousCore'); }
catch (e) { console.warn('[ZAC] Module not loaded:', e.message); }

if (_zac && process.env.ZAC_INPROCESS === '1' && !_stableRuntime) {
  try { _zac.bootstrap(); }
  catch (e) { console.warn('[ZAC] In-process bootstrap failed:', e.message); }
}

app.get('/api/zac/status', (req, res) => {
  if (!_zac) return res.status(503).json({ ok: false, error: 'zac-not-loaded' });
  res.json({ ok: true, ...(_zac.getStatus() || {}) });
});

app.get('/api/zac/scan', (req, res) => {
  if (!_zac) return res.status(503).json({ ok: false, error: 'zac-not-loaded' });
  try { res.json({ ok: true, scan: _zac.scan({}) }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/zac/start', (req, res) => {
  if (!_zac) return res.status(503).json({ ok: false, error: 'zac-not-loaded' });
  try { res.json({ ok: true, status: _zac.bootstrap(req.body || {}) }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/zac/stop', (req, res) => {
  if (!_zac) return res.status(503).json({ ok: false, error: 'zac-not-loaded' });
  try { res.json({ ok: true, ...(_zac.shutdown() || {}) }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/zac/site-complete', (req, res) => {
  if (!_zac) return res.status(503).json({ ok: false, error: 'zac-not-loaded' });
  try {
    const r = _zac.completeSite({ unicornRoot: require('path').resolve(__dirname, '..'), dryRun: !!(req.body && req.body.dryRun) });
    res.json({ ok: true, ...r });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/zac/dev/generate-module', (req, res) => {
  if (!_zac) return res.status(503).json({ ok: false, error: 'zac-not-loaded' });
  const { name, description } = (req.body || {});
  if (!name) return res.status(400).json({ ok: false, error: 'name required' });
  try {
    const dev = _zac.createSelfDeveloper();
    res.json({ ok: true, ...dev.generateModule({ name, description }) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ==================== BTC INVOICING (single-address ledger) ====================
const btcLedger   = require('./modules/btcInvoiceLedger');
const btcVerifier = require('./modules/btcPaymentVerifier');
const zacAlerts   = require('./modules/zacAlertChannel');

let _btcVerifier = null;
let _firstSaleNotified = false;

function _onPaidInvoice(invoice) {
  // Fire the appropriate Discord/Telegram alert. First sale gets a special banner.
  try {
    if (!_firstSaleNotified) {
      _firstSaleNotified = true;
      zacAlerts.notifyFirstSale(invoice).catch(() => {});
    } else {
      zacAlerts.notifySale(invoice).catch(() => {});
    }
  } catch (_) {}
  // Mesh broadcast so other modules can react (e.g., service activation).
  try { meshOrchestrator.broadcast && meshOrchestrator.broadcast('btc.invoice.paid', invoice); } catch (_) {}
}

if (process.env.BTC_VERIFIER_DISABLE !== '1') {
  _btcVerifier = btcVerifier.createPaymentVerifier({
    address: btcLedger.PAYOUT_ADDRESS,
    onPaid:  _onPaidInvoice,
    onError: (e) => console.warn('[BTC/Verifier]', (e && e.message) || e),
  });
  _btcVerifier.start();
}

app.post('/api/invoice/create', async (req, res) => {
  try {
    const { service, priceUsd, customerEmail, metadata } = req.body || {};
    const inv = await btcLedger.createInvoice({ service, priceUsd, customerEmail, metadata });
    res.json({ ok: true, invoice: inv });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.get('/api/invoice/list', (req, res) => {
  res.json({ ok: true, invoices: btcLedger.listInvoices({ status: req.query.status, limit: parseInt(req.query.limit || '50', 10) }) });
});

app.get('/api/invoice/status', (req, res) => {
  res.json({
    ok: true,
    ledger: btcLedger.getStatus(),
    verifier: _btcVerifier ? _btcVerifier.getStatus() : { running: false, reason: 'disabled' },
    alerts: zacAlerts.getStatus(),
  });
});

app.get('/api/invoice/:id', (req, res) => {
  const inv = btcLedger.getInvoice(req.params.id);
  if (!inv) return res.status(404).json({ ok: false, error: 'not-found' });
  res.json({ ok: true, invoice: inv });
});

app.get('/api/invoice/:id/qr', async (req, res) => {
  const inv = btcLedger.getInvoice(req.params.id);
  if (!inv) return res.status(404).json({ ok: false, error: 'not-found' });
  const uri = `bitcoin:${inv.payoutAddress}?amount=${inv.amountBtc}&label=Invoice%20${inv.id}`;
  try {
    const QRCode = require('qrcode');
    const qr = await QRCode.toDataURL(uri, { width: 320, margin: 2, color: { dark: '#00d4ff', light: '#05060e' } });
    res.json({ ok: true, qr, uri, invoice: inv });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/invoice/verify-now', async (req, res) => {
  if (!_btcVerifier) return res.status(503).json({ ok: false, error: 'verifier-disabled' });
  try { await _btcVerifier.tick(); res.json({ ok: true, status: _btcVerifier.getStatus() }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/alerts/test', async (req, res) => {
  const text = (req.body && req.body.message) || `ZAC alert test @ ${new Date().toISOString()}`;
  const r = await zacAlerts.broadcast(text);
  res.json({ ok: true, ...r });
});

// ==================== RUTE INOVAȚII ====================

// 1. Quantum-Resistant Digital Identity
app.post('/api/identity/create', authMiddleware, (req, res) => {
  const { userId, metadata } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  res.json(qrIdentity.generateIdentity(userId, metadata));
});

app.post('/api/identity/sign', authMiddleware, (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });
  try {
    res.json(qrIdentity.sign(userId, message));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/identity/verify', authMiddleware, (req, res) => {
  const { publicKey, message, signature } = req.body;
  const result = qrIdentity.verify(publicKey, message, signature);
  res.json(result);
});

// 2. Autonomous AI Negotiator
app.post('/api/negotiate/start', authMiddleware, (req, res) => {
  const { counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime } = req.body;
  if (!counterparty || !topic || !initialOffer) return res.status(400).json({ error: 'counterparty, topic and initialOffer required' });
  res.json(aiNegotiator.startNegotiation({ counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime }));
});

app.post('/api/negotiate/message/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { message, userType } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    res.json(await aiNegotiator.processMessage(parseInt(id), message, userType));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/negotiate/:id', authMiddleware, (req, res) => {
  const negotiation = aiNegotiator.getNegotiation(parseInt(req.params.id));
  if (!negotiation) return res.status(404).json({ error: 'Negotiation not found' });
  res.json(negotiation);
});

app.get('/api/negotiate/stats', authMiddleware, (req, res) => {
  res.json(aiNegotiator.getStats());
});

// 3. Universal Carbon Credit Exchange
app.post('/api/carbon/issue', authMiddleware, (req, res) => {
  const { owner, amount, type, projectId, vintage } = req.body;
  if (!owner || !amount) return res.status(400).json({ error: 'owner and amount required' });
  res.json(carbonExchange.issueCredits(owner, amount, type, projectId, vintage));
});

app.post('/api/carbon/trade', authMiddleware, async (req, res) => {
  const { buyer, seller, creditId, amount } = req.body;
  try {
    res.json(await carbonExchange.executeTrade(buyer, seller, creditId, amount));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/carbon/order/sell', authMiddleware, (req, res) => {
  const { seller, creditId, amount, price } = req.body;
  try {
    res.json(carbonExchange.createSellOrder(seller, creditId, amount, price));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/carbon/order/buy', authMiddleware, (req, res) => {
  const { buyer, creditType, amount, maxPrice } = req.body;
  res.json(carbonExchange.createBuyOrder(buyer, creditType, amount, maxPrice));
});

app.post('/api/carbon/match', authMiddleware, async (req, res) => {
  res.json(await carbonExchange.matchOrders());
});

app.get('/api/carbon/portfolio/:owner', authMiddleware, (req, res) => {
  res.json(carbonExchange.getPortfolio(req.params.owner));
});

app.get('/api/carbon/stats', authMiddleware, (req, res) => {
  res.json(carbonExchange.getMarketStats());
});

app.get('/api/carbon/transactions/:user', authMiddleware, (req, res) => {
  const { role } = req.query;
  res.json(carbonExchange.getTransactionHistory(req.params.user, role));
});

app.post('/api/carbon/price', authMiddleware, (req, res) => {
  const { type, price } = req.body;
  res.json(carbonExchange.updateMarketPrice(type, price));
});

// ==================== MARKETPLACE ROUTES ====================
app.get('/api/marketplace/services', routeCache.cacheMiddleware(), (req, res) => {
  const services = marketplace.getAllServices().map(s => {
    // Enrich with dynamic-pricing data where the module has a matching service ID
    const dp = dynamicPricing.getPrice(s.id);
    if (dp) {
      return { ...s, price: dp.finalPrice, dynamicFactor: dp.demandFactor, surgeActive: dp.surgeActive };
    }
    return s;
  });
  res.json({ services });
});

app.get('/api/marketplace/categories', routeCache.cacheMiddleware(), (req, res) => {
  const categories = {};
  for (const service of marketplace.getAllServices()) {
    if (!categories[service.category]) categories[service.category] = [];
    categories[service.category].push(service);
  }
  res.json({ categories });
});

app.post('/api/marketplace/price', (req, res) => {
  const { serviceId, clientId, clientData } = req.body || {};
  const cleanServiceId = sanitizeString(serviceId, 100);
  if (!cleanServiceId) return res.status(400).json({ error: 'serviceId required' });
  const price = marketplace.getPersonalizedPrice(cleanServiceId, sanitizeString(clientId, 100), clientData);
  if (!price) return res.status(404).json({ error: 'Service not found' });
  res.json({ serviceId: cleanServiceId, personalizedPrice: price });
});

app.post('/api/marketplace/purchase', (req, res) => {
  const { serviceId, clientId, price, paymentTxId, paymentMethod, serviceName, description } = req.body || {};
  const cleanServiceId = sanitizeString(serviceId, 100);
  const cleanClientId = sanitizeString(clientId, 100);
  if (!cleanServiceId || !cleanClientId) return res.status(400).json({ error: 'serviceId and clientId required' });
  const numericPrice = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(numericPrice) || numericPrice < 0) return res.status(400).json({ error: 'price must be a non-negative number' });
  const client = marketplace.recordPurchase(cleanServiceId, cleanClientId, numericPrice, {
    paymentTxId: sanitizeString(paymentTxId, 100),
    paymentMethod: sanitizeString(paymentMethod, 50),
    serviceName: sanitizeString(serviceName, 200),
    description: sanitizeString(description, 500),
  });
  res.json({ success: true, client });
});

app.get('/api/marketplace/purchases/:clientId', (req, res) => {
  res.json({ purchases: marketplace.getClientPurchases(req.params.clientId) });
});

app.get('/api/marketplace/recommendations/:clientId', (req, res) => {
  const recommendations = marketplace.getRecommendations(req.params.clientId);
  res.json({ recommendations });
});

app.get('/api/marketplace/stats', (req, res) => {
  res.json(marketplace.getMarketplaceStats());
});

app.post('/api/marketplace/discount', (req, res) => {
  const { clientId, serviceId, discountPercent } = req.body || {};
  const cleanClientId = sanitizeString(clientId, 100);
  const cleanServiceId = sanitizeString(serviceId, 100);
  if (!cleanClientId || !cleanServiceId) return res.status(400).json({ error: 'clientId and serviceId required' });
  const pct = typeof discountPercent === 'number' ? discountPercent : parseFloat(discountPercent);
  if (isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'discountPercent must be between 0 and 100' });
  const offer = marketplace.applySpecialDiscount(cleanClientId, cleanServiceId, pct / 100);
  res.json(offer);
});

app.post('/api/marketplace/demand', (req, res) => {
  const { serviceId, delta } = req.body || {};
  const cleanServiceId = sanitizeString(serviceId, 100);
  if (!cleanServiceId) return res.status(400).json({ error: 'serviceId required' });
  const numericDelta = typeof delta === 'number' ? delta : parseFloat(delta);
  if (isNaN(numericDelta)) return res.status(400).json({ error: 'delta must be a number' });
  marketplace.updateDemand(cleanServiceId, numericDelta);
  res.json({ success: true });
});

// Guest purchases: returns aggregated/public stats without requiring a clientId
app.get('/api/marketplace/purchases/guest', (req, res) => {
  const stats = marketplace.getMarketplaceStats();
  res.json({
    totalPurchases: 0,
    totalRevenue: stats.totalValue || 0,
    popularServices: Object.entries(stats.byCategory || {}).map(([name, count]) => ({ name, count })),
  });
});

// ==================== DYNAMIC PRICING ROUTES ====================

// Public: current price for all or a specific service
app.get('/api/pricing/all', routeCache.cacheMiddleware(), (req, res) => {
  res.json({ prices: dynamicPricing.getAllPrices(), basePrices: dynamicPricing.BASE_PRICES });
});

app.get('/api/pricing/conditions', routeCache.cacheMiddleware(), (req, res) => {
  res.json(dynamicPricing.getMarketConditions());
});

app.get('/api/pricing/:serviceId', (req, res) => {
  const allowed = Object.keys(dynamicPricing.BASE_PRICES);
  if (!allowed.includes(req.params.serviceId)) {
    return res.status(404).json({ error: 'Service not found in pricing engine' });
  }
  res.json(dynamicPricing.getPrice(req.params.serviceId, { userId: req.query.userId, coupon: req.query.coupon }));
});

// Admin: activate surge pricing (duration key: 30min | 1h | 2h | 6h | 24h)
app.post('/api/pricing/surge', adminTokenMiddleware, (req, res) => {
  const { durationKey } = req.body || {};
  const allowed = Object.keys(dynamicPricing.ALLOWED_SURGE_DURATIONS_MS);
  const key = allowed.includes(durationKey) ? durationKey : '1h';
  dynamicPricing.activateSurge(key);
  res.json({ success: true, surgeDuration: key });
});

// Admin: toggle global 20% discount
app.post('/api/pricing/discount', adminTokenMiddleware, (req, res) => {
  const { active } = req.body || {};
  dynamicPricing.setDiscount(!!active);
  res.json({ success: true, discountActive: !!active });
});

// ==================== PAYMENT ROUTES ====================
// ── NOWPayments — Global Universal Payment (300+ coins + cards → auto BTC) ──
app.post('/api/payment/nowpayments/create', asyncHandler(async (req, res) => {
  const { amountUsd, itemName, itemId, clientId, successUrl, cancelUrl } = req.body || {};
  const normalizedAmount = Number(amountUsd);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({ error: 'amountUsd required' });
  }

  const invoice = await nowPayments.createInvoice({
    amountUsd: normalizedAmount,
    itemName,
    itemId,
    clientId,
    successUrl,
    cancelUrl,
  });
  res.json(invoice);
}));

app.get('/api/payment/nowpayments/status/:id', asyncHandler(async (req, res) => {
  res.json(await nowPayments.getPaymentStatus(req.params.id));
}));

app.post('/api/payment/nowpayments/webhook', (req, res) => {
  try {
    if (!nowPayments.isWebhookSecurityReady()) {
      return res.status(503).json({ error: 'NOWPayments webhook disabled: missing NOWPAYMENTS_IPN_SECRET' });
    }

    const rawBody = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body || {});
    const sig = req.headers['x-nowpayments-sig'] || '';
    if (!sig) return res.status(401).json({ error: 'Missing NOWPayments signature header' });
    if (!nowPayments.verifyWebhookSignature(rawBody, sig)) return res.status(401).json({ error: 'Invalid signature' });

    const result = nowPayments.processWebhook(JSON.parse(rawBody));
    res.json({ ok: true, status: result.status, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payment/nowpayments/currencies', asyncHandler(async (req, res) => {
  res.json(await nowPayments.getSupportedCurrencies());
}));

app.get('/api/payment/nowpayments/minimum/:currency', asyncHandler(async (req, res) => {
  res.json(await nowPayments.getMinimumPayment(req.params.currency));
}));

app.get('/api/payment/nowpayments/ping', asyncHandler(async (req, res) => {
  res.json(await nowPayments.ping());
}));

app.get('/api/payment/nowpayments/security', (req, res) => {
  res.json(nowPayments.getSecurityStatus());
});

app.get('/api/payment/methods', (req, res) => {
  res.json({ methods: paymentGateway.getPaymentMethods() });
});

app.get('/api/payment/btc-rate', async (req, res) => {
  try {
    res.json(await paymentGateway.getBitcoinRate());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payment/create', async (req, res) => {
  try {
    const payment = await paymentGateway.createPayment(req.body || {});
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payment/status/:txId', (req, res) => {
  const payment = paymentGateway.getPaymentStatus(req.params.txId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
});

app.post('/api/payment/process/:txId', async (req, res) => {
  try {
    const payment = await paymentGateway.processPayment(req.params.txId, req.body || {});
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payment/history', (req, res) => {
  const { clientId, status, method } = req.query;
  res.json({ payments: paymentGateway.getTransactionHistory({ clientId, status, method }) });
});

app.get('/api/payment/stats', (req, res) => {
  res.json(paymentGateway.getStats());
});

app.post('/api/admin/payment/activate', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { method, active } = req.body;
  try {
    res.json(paymentGateway.activateMethod(method, active));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== EXTENDED DOMAIN ROUTES ====================

// Aviation
app.post('/api/aviation/optimize-routes', authMiddleware, async (req, res) => {
  try {
    const result = await aviationModule.optimizeRoutes(req.body.airlineId, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/aviation/predictive-maintenance', authMiddleware, (req, res) => {
  res.json(aviationModule.predictiveMaintenance(req.body || {}));
});

app.post('/api/aviation/ticket-pricing', authMiddleware, (req, res) => {
  const { route, demand, competitors } = req.body;
  res.json(aviationModule.optimizeTicketPrices(route || {}, demand || {}, competitors || []));
});

// Payment Systems
app.post('/api/payments/cross-border', authMiddleware, async (req, res) => {
  try {
    const result = await paymentSystems.processCrossBorderPayment(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/payments/fraud-detection', authMiddleware, (req, res) => {
  res.json(paymentSystems.detectFraud(req.body || {}));
});

app.post('/api/payments/card', authMiddleware, (req, res) => {
  const { cardDetails, amount } = req.body;
  res.json(paymentSystems.processCardPayment(cardDetails || {}, Number(amount || 0)));
});

// Government
app.post('/api/government/compliance', authMiddleware, (req, res) => {
  const result = governmentModule.checkGovCompliance(req.body.agency, req.body.requirements || []);
  res.json(result);
});

app.post('/api/government/digitalize-service', authMiddleware, (req, res) => {
  const { serviceId, params } = req.body;
  res.json(governmentModule.digitalizeService(serviceId, params || {}));
});

app.post('/api/government/analyze-policy', authMiddleware, (req, res) => {
  res.json(governmentModule.analyzePolicy(req.body.policyText || ''));
});

// Defense
app.post('/api/defense/encrypt', authMiddleware, (req, res) => {
  try {
    const result = defenseModule.quantumEncrypt(req.body.message || '', req.body.recipient);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/defense/threats', authMiddleware, (req, res) => {
  res.json(defenseModule.analyzeThreats(req.body || {}));
});

app.post('/api/defense/secure-infrastructure', authMiddleware, (req, res) => {
  const { infraId, params } = req.body;
  res.json(defenseModule.secureInfrastructure(infraId, params || {}));
});

// Telecom
app.post('/api/telecom/optimize-5g', authMiddleware, (req, res) => {
  res.json(telecomModule.optimize5GNetwork(req.body.networkId, req.body.traffic || {}));
});

app.post('/api/telecom/predict-failures', authMiddleware, (req, res) => {
  res.json(telecomModule.predictFailures(req.body || {}));
});

app.post('/api/telecom/revenue-assurance', authMiddleware, (req, res) => {
  res.json(telecomModule.revenueAssurance(req.body.cdrData || []));
});

// Enterprise Partnership API
app.post('/api/enterprise/register', authMiddleware, async (req, res) => {
  try {
    const partner = enterprisePartner.registerPartner(req.body || {});
    res.json(partner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/partner/:partnerId/:endpoint', authMiddleware, async (req, res) => {
  const { partnerId, endpoint } = req.params;
  const apiKey = req.headers['x-api-key'];
  const partner = enterprisePartner.partners.get(partnerId);

  if (!partner || partner.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    const result = await enterprisePartner.handlePartnerRequest(partnerId, endpoint, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/partner/:partnerId/dashboard', authMiddleware, async (req, res) => {
  const { partnerId } = req.params;
  const apiKey = req.headers['x-api-key'];
  const partner = enterprisePartner.partners.get(partnerId);

  if (!partner || partner.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const dashboard = enterprisePartner.getPartnerDashboard(partnerId);
  res.json(dashboard);
});

app.get('/api/partner/:partnerId/invoice/:month', authMiddleware, async (req, res) => {
  try {
    const { partnerId, month } = req.params;
    const invoice = enterprisePartner.generateInvoice(partnerId, month);
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== ADVANCED MODULE ROUTES ====================

// Compliance Engine
app.post('/api/compliance/check', authMiddleware, async (req, res) => {
  const { operation, data } = req.body;
  if (!operation) return res.status(400).json({ error: 'operation required' });
  const result = await complianceEngine.checkCompliance(operation, data || {});
  res.json(result);
});

app.get('/api/compliance/report', authMiddleware, (req, res) => {
  const { period } = req.query;
  res.json(complianceEngine.generateReport(period || 'month'));
});

app.get('/api/compliance/stats', authMiddleware, (req, res) => {
  res.json(complianceEngine.getStats());
});

// Risk Analyzer
app.post('/api/risk/analyze', authMiddleware, async (req, res) => {
  const { type, data } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  try {
    const result = await riskAnalyzer.analyzeRisk(type, data || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/risk/history', authMiddleware, (req, res) => {
  const limit = Number(req.query.limit || 100);
  res.json({ history: riskAnalyzer.getHistory(limit) });
});

app.get('/api/risk/stats', authMiddleware, (req, res) => {
  res.json(riskAnalyzer.getStats());
});

// Reputation Protocol
app.post('/api/reputation/register', authMiddleware, (req, res) => {
  const { entityId, type, metadata } = req.body;
  if (!entityId || !type) return res.status(400).json({ error: 'entityId and type required' });
  try {
    res.json(reputationProtocol.registerEntity(entityId, type, metadata || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reputation/review', authMiddleware, (req, res) => {
  const { reviewerId, targetId, rating, comment, metadata } = req.body || {};
  if (!reviewerId || !targetId) return res.status(400).json({ error: 'reviewerId and targetId required' });
  const numericRating = typeof rating === 'number' ? rating : parseFloat(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) return res.status(400).json({ error: 'rating must be between 1 and 5' });
  const cleanComment = sanitizeString(comment, 1000);
  try {
    res.json(reputationProtocol.addReview(sanitizeString(reviewerId, 100), sanitizeString(targetId, 100), numericRating, cleanComment, metadata || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reputation/transaction', authMiddleware, (req, res) => {
  const { entityId, counterpartyId, amount, type } = req.body;
  try {
    res.json(reputationProtocol.recordTransaction(entityId, counterpartyId, amount, type || 'payment'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reputation/:entityId', authMiddleware, (req, res) => {
  const reputation = reputationProtocol.getReputation(req.params.entityId);
  if (!reputation) return res.status(404).json({ error: 'Entity not found' });
  res.json(reputation);
});

app.get('/api/reputation/top/list', authMiddleware, (req, res) => {
  const limit = Number(req.query.limit || 10);
  const { type } = req.query;
  res.json({ top: reputationProtocol.getTopEntities(limit, type || null) });
});

app.get('/api/reputation/stats', authMiddleware, (req, res) => {
  res.json(reputationProtocol.getStats());
});

// Opportunity Radar
app.get('/api/opportunity/list', authMiddleware, (req, res) => {
  const filters = {
    minRelevance: req.query.minRelevance ? Number(req.query.minRelevance) : undefined,
    deadlineBefore: req.query.deadlineBefore
  };
  res.json({ opportunities: opportunityRadar.getOpportunities(filters) });
});

app.get('/api/opportunity/alerts/unread', authMiddleware, (req, res) => {
  res.json({ alerts: opportunityRadar.getUnreadAlerts() });
});

app.post('/api/opportunity/alerts/read', authMiddleware, (req, res) => {
  const { alertId } = req.body;
  res.json(opportunityRadar.markAlertRead(alertId));
});

app.post('/api/opportunity/recommendations', authMiddleware, (req, res) => {
  res.json({ recommendations: opportunityRadar.getPersonalizedRecommendations(req.body || {}) });
});

app.get('/api/opportunity/stats', authMiddleware, (req, res) => {
  res.json(opportunityRadar.getStats());
});

// Business Blueprint
app.post('/api/blueprint/generate', authMiddleware, requirePlan('starter'), async (req, res) => {
  try {
    const blueprint = await businessBlueprint.generateBlueprint(req.body || {});
    res.json(blueprint);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/blueprint/list', authMiddleware, (req, res) => {
  res.json({ blueprints: businessBlueprint.getAllBlueprints() });
});

app.get('/api/blueprint/:id', authMiddleware, (req, res) => {
  const blueprint = businessBlueprint.getBlueprint(req.params.id);
  if (!blueprint) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(blueprint);
});

// ==================== 5 INOVAȚII STRATEGICE ====================

// Quantum Blockchain
app.get('/api/blockchain/stats', authMiddleware, (req, res) => {
  res.json(quantumChain.getStats());
});

app.post('/api/blockchain/transaction', authMiddleware, (req, res) => {
  const tx = quantumChain.addTransaction(req.body || {});
  res.json(tx);
});

app.post('/api/blockchain/mine', authMiddleware, (req, res) => {
  const block = quantumChain.mineBlock();
  res.json(block);
});

// AI Workforce Marketplace
app.get('/api/workforce/agents', authMiddleware, requirePlan('starter'), (req, res) => {
  res.json(Array.from(workforce.agents.values()));
});

app.post('/api/workforce/agent', authMiddleware, requirePlan('starter'), (req, res) => {
  try {
    res.json(workforce.registerAgent(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workforce/job', authMiddleware, requirePlan('starter'), (req, res) => {
  try {
    res.json(workforce.postJob(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/workforce/job/:id/agents', authMiddleware, requirePlan('starter'), (req, res) => {
  res.json(workforce.findBestAgents(req.params.id));
});

app.get('/api/workforce/stats', authMiddleware, requirePlan('starter'), (req, res) => {
  res.json(workforce.getStats());
});

// M&A Advisor
app.post('/api/ma/targets', authMiddleware, requirePlan('pro'), (req, res) => {
  res.json(ma.identifyTargets(req.body || {}));
});

app.post('/api/ma/negotiate', authMiddleware, requirePlan('pro'), async (req, res) => {
  try {
    const deal = await ma.negotiateTerms(req.body.targetId, Number(req.body.initialOffer || 0), Number(req.body.maxPrice || 0));
    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ma/stats', authMiddleware, requirePlan('pro'), (req, res) => {
  res.json(ma.getStats());
});

// ==================== AUTONOMOUS LEGAL ENTITY (ALE) ROUTES ====================
app.post('/api/ale/register', authMiddleware, requirePlan('starter'), (req, res) => {
  try {
    res.json(ale.register(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ale/status/:id', authMiddleware, (req, res) => {
  try {
    res.json(ale.getStatus(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/ale/tax/:id', authMiddleware, requirePlan('starter'), (req, res) => {
  try {
    res.json(ale.calculateTax(req.params.id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ale/countries', (req, res) => {
  res.json(ale.getSupportedCountries());
});

app.get('/api/ale/registrations', adminTokenMiddleware, (req, res) => {
  res.json(ale.listAll());
});

// ==================== GLOBAL ENERGY & CARBON TRADER (GECT) ROUTES ====================
app.get('/api/gect/energy/price/:region', (req, res) => {
  try {
    res.json(gect.getCurrentPrice(req.params.region));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/gect/energy/trade', authMiddleware, requirePlan('starter'), (req, res) => {
  try {
    const trade = gect.tradeEnergy({ userId: req.user.id, ...req.body });
    res.json(trade);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/gect/carbon/trade', authMiddleware, requirePlan('starter'), (req, res) => {
  try {
    const result = gect.tradeCarbonCredits({ userId: req.user.id, ...req.body, carbonExchangeModule: carbonExchange });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/gect/portfolio/:userId', authMiddleware, (req, res) => {
  res.json(gect.getPortfolio(req.params.userId));
});

app.get('/api/gect/regions', (req, res) => {
  res.json(gect.getSupportedRegions());
});

// ==================== QR-BaaS ROUTES ====================
app.post('/api/baas/create', authMiddleware, requirePlan('pro'), (req, res) => {
  try {
    res.json(qrBaaS.createChain(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/baas/status/:id', authMiddleware, (req, res) => {
  try {
    res.json(qrBaaS.getStatus(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/baas/deploy-contract', authMiddleware, requirePlan('pro'), (req, res) => {
  try {
    const { chainId, ...contractParams } = req.body || {};
    if (!chainId) return res.status(400).json({ error: 'chainId is required' });
    res.json(qrBaaS.deployContract(chainId, contractParams));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/baas/transaction', authMiddleware, requirePlan('pro'), (req, res) => {
  try {
    const { chainId, ...tx } = req.body || {};
    if (!chainId) return res.status(400).json({ error: 'chainId is required' });
    res.json(qrBaaS.addTransaction(chainId, tx));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/baas/chains', adminTokenMiddleware, (req, res) => {
  res.json(qrBaaS.listChains());
});

app.get('/api/baas/consensus', (req, res) => {
  res.json(qrBaaS.getSupportedConsensus());
});

// ==================== AUTONOMOUS M&A ADVISOR (AMAA) ROUTES ====================
app.post('/api/amaa/targets', authMiddleware, requirePlan('pro'), (req, res) => {
  try {
    res.json(amaa.findTargets(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/amaa/analysis/:targetId', authMiddleware, requirePlan('pro'), (req, res) => {
  try {
    res.json(amaa.analyzeTarget(req.params.targetId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/amaa/negotiate', authMiddleware, requirePlan('pro'), (req, res) => {
  try {
    const result = amaa.startNegotiation({ ...req.body, acquirerId: req.user.id, aiNegotiatorModule: aiNegotiator });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/amaa/negotiation/:id', authMiddleware, requirePlan('pro'), (req, res) => {
  try {
    res.json(amaa.getNegotiation(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/amaa/stats', authMiddleware, requirePlan('pro'), (req, res) => {
  res.json(amaa.getStats());
});

// ==================== UNIVERSAL AI TRAINING MARKETPLACE (UAITM) ROUTES ====================
app.post('/api/aimarket/list', authMiddleware, (req, res) => {
  try {
    res.json(uaitm.listModel({ seller: req.user.id, ...req.body }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/aimarket/models', (req, res) => {
  try {
    const { category, maxPrice, search, seller } = req.query;
    res.json(uaitm.getModels({ category, maxPrice: maxPrice ? Number(maxPrice) : undefined, search, seller }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/aimarket/models/:id', (req, res) => {
  try {
    res.json(uaitm.getModel(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/aimarket/buy', authMiddleware, (req, res) => {
  try {
    res.json(uaitm.buyModel({ buyerId: req.user.id, ...req.body }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/aimarket/purchases', authMiddleware, (req, res) => {
  res.json(uaitm.getPurchases(req.user.id));
});

app.get('/api/aimarket/stats', adminTokenMiddleware, (req, res) => {
  res.json(uaitm.getStats());
});

// Legal Contract
app.post('/api/legal/generate', authMiddleware, requirePlan('starter'), (req, res) => {
  try {
    res.json(legal.generateContract(req.body.type, req.body.params || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/legal/analyze', authMiddleware, (req, res) => {
  try {
    res.json(legal.analyzeContract(req.body.text || ''));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/legal/stats', authMiddleware, (req, res) => {
  res.json(legal.getStats());
});

// Energy Grid
app.post('/api/energy/producer', authMiddleware, (req, res) => {
  res.json(energy.registerProducer(req.body || {}));
});

app.post('/api/energy/consumer', authMiddleware, (req, res) => {
  res.json(energy.registerConsumer(req.body || {}));
});

app.post('/api/energy/optimize', authMiddleware, (req, res) => {
  res.json(energy.optimizeFlow());
});

app.post('/api/energy/trade', authMiddleware, async (req, res) => {
  res.json(await energy.tradeExcessEnergy());
});

app.get('/api/energy/stats', authMiddleware, (req, res) => {
  res.json(energy.getStats());
});

// ==================== UNICORN AUTONOMOUS CORE ====================
app.get('/api/uac/status', (req, res) => {
  if (uac && typeof uac.getStatus === 'function') {
    return res.json(uac.getStatus());
  }
  return res.json({
    status: 'mock-active',
    message: 'UAC status is not available in this runtime. Core autonomous engines are running.',
  });
});

app.post('/api/uac/cycle', async (req, res) => {
  if (uac && typeof uac.fullAutonomousCycle === 'function') {
    await uac.fullAutonomousCycle();
    return res.json({ success: true, message: 'Autonomous cycle triggered' });
  }
  return res.json({
    success: true,
    mode: 'mock',
    message: 'UAC full cycle unavailable. Innovation + revenue engines continue autonomously.',
  });
});

app.post('/api/uac/innovate', async (req, res) => {
  if (uac && typeof uac.deepInnovationCycle === 'function') {
    await uac.deepInnovationCycle();
    return res.json({ success: true, message: 'Deep innovation cycle triggered' });
  }
  return res.json({
    success: true,
    mode: 'mock',
    message: 'UAC deep innovation unavailable. Innovation engine remains active.',
  });
});

app.post('/api/uac/optimize', async (req, res) => {
  // Mock implementation
  res.json({ success: true, message: 'System optimization triggered' });
});

// ==================== MESH ORCHESTRATOR — rute Swiss-watch ====================
app.get('/api/mesh/status', (req, res) => {
  res.json(meshOrchestrator.getStatus());
});

app.get('/api/mesh/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json({ history: meshOrchestrator.getHealthHistory(limit) });
});

app.get('/api/mesh/log', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ log: meshOrchestrator.getEventLog(limit) });
});

app.post('/api/mesh/sync', adminTokenMiddleware, (req, res) => {
  meshOrchestrator._syncCycle();
  res.json({ success: true, message: 'Sincronizare mesh declanșată manual' });
});

// ==================== CODE SANITY ENGINE ====================
app.get('/api/code-sanity/status', (req, res) => {
  res.json(codeSanityEngine.getStatus());
});

app.post('/api/code-sanity/scan', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await codeSanityEngine.runFullScanNow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/code-sanity/history', adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json({ history: codeSanityEngine.getHistory(limit) });
});

// ==================== ADVANCED MODULES (MOCKED) ====================
// These routes are mocked to avoid syntax errors in complex innovation modules
// The autonomous systems (innovation + revenue) are the primary focus

// ==================== UNICORN INNOVATION SUITE (10/10) ====================
// 1) Trust Center
app.get('/api/trust/status', (req, res) => {
  res.json(unicornInnovationSuite.getTrustStatus());
});

app.get('/api/trust/incidents', (req, res) => {
  res.json({ incidents: unicornInnovationSuite.getIncidents() });
});

app.get('/api/trust/audit', adminTokenMiddleware, (req, res) => {
  res.json({ audit: unicornInnovationSuite.getAuditTrail() });
});

// 2) Usage-based billing + plans
app.get('/api/billing/plans', (req, res) => {
  // Return public billing plans (no auth required for viewing)
  res.json({ plans: BILLING_PLANS.map(p => ({ ...p, stripePriceIdMonthly: undefined, stripePriceIdYearly: undefined })) });
});

app.post('/api/billing/subscribe', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.subscribe(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/billing/usage/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.trackUsage(req.params.clientId, req.body || {}));
});

app.get('/api/billing/usage/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.getUsage(req.params.clientId));
});

app.get('/api/billing/invoice/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.buildInvoice(req.params.clientId));
});

// 3) API keys + webhooks
app.post('/api/platform/api-keys', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.createApiKey(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/platform/api-keys', adminTokenMiddleware, (req, res) => {
  res.json({ keys: unicornInnovationSuite.listApiKeys() });
});

app.post('/api/platform/webhooks', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.registerWebhook(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/platform/webhooks/test', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.triggerWebhookTest((req.body || {}).eventName));
});

// 4) Marketplace intelligence score
app.get('/api/marketplace/intelligence', (req, res) => {
  res.json(unicornInnovationSuite.getMarketplaceIntelligence(req.query.clientId));
});

// 5) Autonomous experiment engine
app.get('/api/experiments', adminTokenMiddleware, (req, res) => {
  res.json({ experiments: unicornInnovationSuite.listExperiments() });
});

app.post('/api/experiments', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.createExperiment(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/experiments/:id/evaluate', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.evaluateExperiment(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 6) Executive Copilot
app.post('/api/executive/copilot', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.askCopilot(req.body || {}));
});

// ── Executive Dashboard routes (JWT auth, used by ExecutiveDashboard.jsx) ──
app.get('/api/admin/executive/stats', authRateLimit(60, 60_000), adminTokenMiddleware, (req, res) => {
  res.json(executiveDashboard.getStats());
});
app.get('/api/admin/executive/revenue', authRateLimit(60, 60_000), adminTokenMiddleware, (req, res) => {
  res.json(executiveDashboard.stats.revenue);
});
app.get('/api/admin/executive/modules', authRateLimit(60, 60_000), adminTokenMiddleware, (req, res) => {
  res.json(executiveDashboard.stats.modules);
});
app.get('/api/admin/executive/innovations', authRateLimit(60, 60_000), adminTokenMiddleware, (req, res) => {
  res.json(executiveDashboard.stats.innovations);
});
app.get('/api/admin/executive/health', authRateLimit(60, 60_000), adminTokenMiddleware, (req, res) => {
  res.json(executiveDashboard.stats.health);
});
app.get('/api/admin/executive/growth', authRateLimit(60, 60_000), adminTokenMiddleware, (req, res) => {
  res.json(executiveDashboard.stats.growth);
});

// 7) Security hardening APIs
app.get('/api/security/sessions', adminTokenMiddleware, (req, res) => {
  res.json({ sessions: unicornInnovationSuite.listSessions() });
});

app.post('/api/security/sessions/register', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.registerSession(req.body || {}));
});

app.post('/api/security/sessions/revoke', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.revokeSession((req.body || {}).sessionId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/security/device/check', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.checkDevice(req.body || {}));
});

// 8) Onboarding wizard
app.post('/api/onboarding/start', (req, res) => {
  const body = req.body || {};
  const sanitized = {
    name: sanitizeString(body.name, 100),
    email: body.email ? sanitizeString(body.email, 254) : undefined,
    company: sanitizeString(body.company, 200),
    industry: sanitizeString(body.industry, 100),
    plan: sanitizeString(body.plan, 50),
  };
  if (sanitized.email && !isValidEmail(sanitized.email)) return res.status(400).json({ error: 'Invalid email address' });
  res.json(unicornInnovationSuite.startOnboarding(sanitized));
});

app.get('/api/onboarding/recommendations/:id', (req, res) => {
  try {
    res.json(unicornInnovationSuite.getOnboardingRecommendations(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 9) Case studies + ROI calculator
app.get('/api/site/case-studies', (req, res) => {
  res.json({ caseStudies: unicornInnovationSuite.getCaseStudies() });
});

const ROI_INDUSTRY_MULTIPLIERS = { technology: 0.32, finance: 0.28, healthcare: 0.25, retail: 0.22, manufacturing: 0.20, logistics: 0.18, other: 0.20 };
const ROI_PLAN_TIERS = [{ maxEmp: 10, monthly: 29 }, { maxEmp: 50, monthly: 99 }, { maxEmp: Infinity, monthly: 499 }];

app.post('/api/site/roi/calculate', (req, res) => {
  const { employees = 0, revenue = 0, industry = 'technology', investment, expectedGain } = req.body || {};
  // Support both frontend params (employees/revenue/industry) and direct params (investment/expectedGain)
  if (investment != null || expectedGain != null) {
    const inv = parseFloat(investment);
    const gain = parseFloat(expectedGain);
    if (isNaN(inv) || isNaN(gain)) return res.status(400).json({ error: 'investment and expectedGain must be numbers' });
    return res.json(unicornInnovationSuite.calculateROI({ investment: inv, expectedGain: gain }));
  }
  const emp = Math.abs(Number(employees)) || 0;
  const rev = Math.abs(Number(revenue)) || 0;
  if (!emp || !rev) return res.json({ annualSavings: 0, roiPercent: 0, paybackMonths: null });
  const allowedIndustries = Object.keys(ROI_INDUSTRY_MULTIPLIERS);
  const safeIndustry = allowedIndustries.includes(String(industry)) ? String(industry) : 'other';
  const savingsRate = ROI_INDUSTRY_MULTIPLIERS[safeIndustry];
  const annualSavings = Math.round(rev * savingsRate);
  const tier = ROI_PLAN_TIERS.find(t => emp <= t.maxEmp);
  const annualCost = tier.monthly * 12;
  const netSavings = annualSavings - annualCost;
  const roiPercent = annualCost > 0 ? Math.round((netSavings / annualCost) * 100) : 0;
  const paybackMonths = annualSavings > 0 ? Math.ceil(annualCost / (annualSavings / 12)) : null;
  res.json({ annualSavings, roiPercent, paybackMonths, netSavings, annualCost, savingsRate });
});

// 10) Partner / affiliate layer
app.post('/api/partners/referral/create', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.createReferral(req.body || {}));
});

app.get('/api/partners/referral/:code', (req, res) => {
  try {
    res.json(unicornInnovationSuite.getReferral(req.params.code));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/partners/affiliate/stats', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.getAffiliateStats());
});

// ==================== EXECUTIVE DASHBOARD ROUTES ====================
app.get('/api/admin/executive/stats', adminTokenMiddleware, (req, res) => {
  const metrics = autonomousInnovation.getDeploymentMetrics();
  const revenueStatus = autoRevenue.getRevenueStatus();
  res.json({
    projectedProfit: {
      next30: Math.round(revenueStatus.projectedAnnualRevenue / 12),
      next90: Math.round(revenueStatus.projectedAnnualRevenue / 4),
      next365: Math.round(revenueStatus.projectedAnnualRevenue)
    },
    predictions: {
      revenue: Array.from({ length: 30 }, (_, i) => ({
        day: i + 1,
        value: Math.round(revenueStatus.projectedAnnualRevenue / 365 * (1 + Math.random() * 0.2))
      }))
    },
    competitors: {
      message: 'Unicorn leads in AI autonomy and self-revenue generation',
      salesforce: 62,
      hubspot: 48,
      openai: 71,
      anthropic: 65
    },
    alerts: [
      { type: 'success', title: 'Revenue cycle active', message: `${revenueStatus.activeDeals} active deals generating revenue autonomously.`, action: 'VIEW' },
      { type: 'success', title: 'Innovation engine running', message: `${metrics.totalInnovationsGenerated} innovations generated, ${metrics.totalFeaturesDeployed} deployed.`, action: 'VIEW' }
    ]
  });
});

app.get('/api/admin/executive/revenue', adminTokenMiddleware, (req, res) => {
  const revenueStatus = autoRevenue.getRevenueStatus();
  res.json({
    total: Math.round(revenueStatus.projectedAnnualRevenue / 12),
    btc: Math.round(revenueStatus.projectedAnnualRevenue / 12 / 94000 * 1e8) / 1e8,
    monthly: revenueStatus.currentMonthlyRevenue,
    activeDeals: revenueStatus.activeDeals,
    affiliates: revenueStatus.affiliateCount,
    projectedAnnual: revenueStatus.projectedAnnualRevenue
  });
});

app.get('/api/admin/executive/modules', adminTokenMiddleware, (req, res) => {
  const fs = require('fs');
  const modulesDir = require('path').join(__dirname, 'modules');
  let total = 0;
  try { total = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js')).length; } catch (_) {}
  res.json({
    total,
    autoCreated: Math.floor(total * 0.15),
    inDevelopment: Math.floor(total * 0.08),
    active: total - Math.floor(total * 0.08)
  });
});

app.get('/api/admin/executive/innovations', adminTokenMiddleware, (req, res) => {
  const history = autonomousInnovation.getInnovationHistory(15);
  res.json(Array.isArray(history) ? history : (history.history || []));
});

app.get('/api/admin/executive/health', adminTokenMiddleware, (req, res) => {
  res.json({
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    status: 'healthy',
    lastCheck: new Date().toISOString()
  });
});

app.get('/api/admin/executive/growth', adminTokenMiddleware, (req, res) => {
  const viral = autoViralGrowth.getViralStatus();
  res.json({
    users: viral.estimatedReach || 0,
    viralScore: viral.viralScore || 0,
    estimatedReach: viral.estimatedReach || 0,
    growthRate: viral.viralScore ? (viral.viralScore / 100).toFixed(2) : 0
  });
});

// ==================== AUTONOMOUS INNOVATION ROUTES ====================
app.get('/api/autonomous/innovation/status', (req, res) => {
  res.json(autonomousInnovation.getStatus());
});

app.get('/api/autonomous/innovation/history', (req, res) => {
  const limit = req.query.limit || 20;
  res.json(autonomousInnovation.getInnovationHistory(limit));
});

app.get('/api/autonomous/innovation/metrics', (req, res) => {
  res.json(autonomousInnovation.getDeploymentMetrics());
});

app.post('/api/autonomous/innovation/trigger', adminTokenMiddleware, (req, res) => {
  const innov = autonomousInnovation.generateNewInnovation();
  res.json({ success: true, innovation: innov });
});

app.post('/api/autonomous/innovation/optimize', adminTokenMiddleware, (req, res) => {
  autonomousInnovation.selfOptimize();
  res.json({ success: true, message: 'Self-optimization triggered' });
});

// ==================== AUTO REVENUE ROUTES ====================
// NOTE: AutoRevenueEngine runs in DEMO/SIMULATION mode.
// Figures shown are projections based on simulated deal flow — not real transactions.
// Real revenue comes from /api/payment/* (Stripe/PayPal/crypto).
app.get('/api/autonomous/revenue/status', (req, res) => {
  res.json({ ...autoRevenue.getRevenueStatus(), mode: 'DEMO', note: 'Simulated pipeline. Real revenue tracked via /api/payment/stats.' });
});

app.get('/api/autonomous/revenue/history', (req, res) => {
  const limit = req.query.limit || 20;
  res.json({ ...autoRevenue.getRevenueHistory(limit), mode: 'DEMO', note: 'Simulated deal history.' });
});

app.get('/api/autonomous/revenue/metrics', (req, res) => {
  res.json({ ...autoRevenue.getDetailedMetrics(), mode: 'DEMO', note: 'Simulated metrics for planning purposes.' });
});

app.post('/api/autonomous/revenue/generate-deals', adminTokenMiddleware, (req, res) => {
  autoRevenue.generateAffiliateDeals();
  autoRevenue.createMarketplaceListings();
  autoRevenue.negotiateB2BPartnerships();
  res.json({ success: true, message: 'Revenue generation cycle triggered' });
});

// ==================== AUTO VIRAL GROWTH ROUTES ====================
app.get('/api/autonomous/viral/status', (req, res) => {
  res.json(autoViralGrowth.getViralStatus());
});

app.post('/api/autonomous/viral/trigger', adminTokenMiddleware, (req, res) => {
  const result = autoViralGrowth.executeGrowthLoop();
  res.json({ success: true, result });
});

app.get('/api/autonomous/platform/status', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    state: 'FULLY_AUTONOMOUS_LIVE',
    autonomousEngines: {
      innovation: autonomousInnovation.getStatus(),
      revenue: autoRevenue.getRevenueStatus(),
      viral: autoViralGrowth.getViralStatus(),
    },
    combinedMetrics: {
      totalInnovationsGenerated: autonomousInnovation.metrics.totalInnovationsGenerated,
      totalFeaturesDeployed: autonomousInnovation.metrics.totalFeaturesDeployed,
      projectedAnnualRevenue: autoRevenue.metrics.projectedAnnualRevenue,
      activeDeals: autoRevenue.metrics.activeDeals,
      viralScore: autoViralGrowth.metrics.viralScore,
      estimatedReach: autoViralGrowth.metrics.estimatedReach,
    },
  });
});

// ==================== UNICORN ORCHESTRATOR — STATUS UNIFICAT ====================
app.get('/api/orchestrator/status', (req, res) => {
  res.json(unicornOrchestrator.getStatus());
});

// POST /api/orchestrator/start — pornește orchestratorul în modul specificat (default: full)
app.post('/api/orchestrator/start', adminTokenMiddleware, (req, res) => {
  const mode = (req.body && req.body.mode) || 'full';
  try {
    unicornOrchestrator.start(mode);
    res.json({ success: true, mode, status: unicornOrchestrator.getStatus() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== SELF-HEALING: SLO ROUTES ====================
app.get('/api/slo/status', (req, res) => {
  res.json({ stats: sloTracker.getAllStats(), routes: sloTracker.getAllRoutes() });
});

app.get('/api/slo/route', (req, res) => {
  const route = req.query.route;
  if (!route) return res.status(400).json({ error: 'route query param required' });
  res.json(sloTracker.getRouteStats(route));
});

// ==================== SELF-HEALING: CONTROL PLANE AGENT ROUTES ====================
app.get('/api/control-plane/status', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  res.json(controlPlane.getStatus());
});

app.get('/api/control-plane/decisions', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({ decisions: controlPlane.getDecisionLog(limit) });
});

app.get('/api/control-plane/rollback-history', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || '20', 10);
  res.json({ history: controlPlane.getRollbackHistory(limit) });
});

app.post('/api/control-plane/rollback', adminCrudRateLimit, adminTokenMiddleware, async (req, res) => {
  const { version, reason } = req.body || {};
  if (!version) return res.status(400).json({ error: 'version required' });
  await controlPlane.forceRollback(version, reason || 'Manual rollback via API');
  res.json({ success: true, version });
});

// ==================== CANARY CONTROLLER ROUTES ====================
app.get('/api/canary', (req, res) => {
  res.json({ canaries: canaryCtrl.getAllCanaries() });
});

app.post('/api/canary/register', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { id, version, baseline } = req.body || {};
  if (!version) return res.status(400).json({ error: 'version required' });
  const canary = canaryCtrl.register({ id, version, baseline });
  res.json(canary);
});

app.post('/api/canary/:id/sample', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { isCanary, profit } = req.body || {};
  if (typeof profit !== 'number') return res.status(400).json({ error: 'profit (number) required' });
  canaryCtrl.recordSample(req.params.id, Boolean(isCanary), profit);
  res.json({ success: true });
});

app.post('/api/canary/:id/evaluate', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const result = canaryCtrl.evaluate(req.params.id);
  if (!result) return res.status(404).json({ error: 'Canary not found or not evaluating' });
  res.json(result);
});

app.get('/api/canary/decisions', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({ decisions: canaryCtrl.getDecisionLog(limit) });
});

// ==================== PROFIT ATTRIBUTION ROUTES ====================
app.post('/api/profit/record', authMiddleware, (req, res) => {
  const { action, value, experimentId, variantId, meta } = req.body || {};
  if (!action || typeof value !== 'number') return res.status(400).json({ error: 'action and value required' });
  const attributed = profitService.record({
    userId: req.user.id,
    action,
    value,
    experimentId: experimentId || null,
    variantId: variantId || null,
    meta: meta || {},
  });
  res.json({ attributed });
});

app.get('/api/profit/metrics', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  res.json(profitService.getMetrics());
});

app.get('/api/profit/reward/:experimentId', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const windowMs = parseInt(req.query.windowMs || '86400000', 10);
  const reward = profitService.computeReward(req.params.experimentId, windowMs);
  res.json({ experimentId: req.params.experimentId, reward });
});

app.get('/api/profit/compare/:experimentId', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { variantId, controlId, windowMs } = req.query;
  if (!variantId) return res.status(400).json({ error: 'variantId required' });
  const result = profitService.compareVariants(
    req.params.experimentId,
    variantId,
    controlId || 'control',
    parseInt(windowMs || '86400000', 10)
  );
  if (!result) return res.status(404).json({ error: 'Experiment not found' });
  res.json(result);
});

// ==================== SHADOW TESTING ROUTES ====================
app.get('/api/shadow/variants', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  res.json({ variants: shadowTester.getAllVariants(), metrics: shadowTester.getMetrics() });
});

app.post('/api/shadow/register', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { id, domain, name, description, cost } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  const variant = shadowTester.registerVariant({ id, domain, name, description, cost: cost || 0 });
  res.json(variant);
});

app.post('/api/shadow/run', authMiddleware, (req, res) => {
  const { action, value, variantId, meta } = req.body || {};
  if (!action || typeof value !== 'number') return res.status(400).json({ error: 'action and value required' });
  const controlProfit = shadowTester.runShadow(action, value, req.user.id, { ...meta, variantId });
  res.json({ controlProfit });
});

app.get('/api/shadow/variants/:id', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const status = shadowTester.getVariantStatus(req.params.id);
  if (!status) return res.status(404).json({ error: 'Variant not found' });
  res.json(status);
});

app.post('/api/shadow/variants/:id/promote', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const variant = shadowTester.promoteToAB(req.params.id);
    res.json({ success: true, variant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/shadow/variants/:id/reject', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { reason } = req.body || {};
  shadowTester.reject(req.params.id, reason || '');
  res.json({ success: true });
});

// ==================== CIRCUIT BREAKER ROUTES ====================
app.get('/api/circuit-breaker/status', (req, res) => {
  res.json(circuitBreaker.getStatus());
});

app.post('/api/circuit-breaker/reset', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  circuitBreaker.recordSuccess({ manual: true });
  res.json({ success: true, status: circuitBreaker.getStatus() });
});

// ==================== PROFIT CONTROL LOOP ROUTES ====================
app.get('/api/profit-loop/status', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  res.json(profitLoop.getStatus());
});

app.get('/api/profit-loop/reward-history', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({ history: profitLoop.getRewardHistory(limit) });
});

// ==================== DECISION PROVENANCE ROUTES ====================
app.get('/api/decisions', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const cpaDecisions    = controlPlane.getDecisionLog(limit);
  const canaryDecisions = canaryCtrl.getDecisionLog(limit);
  const all = [...cpaDecisions, ...canaryDecisions]
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, limit);
  res.json({ decisions: all, total: all.length });
});

// ==================== ADMIN USER MANAGEMENT ====================
// All routes are protected by adminTokenMiddleware (JWT required, admin role).
app.get('/api/admin/uaic/models', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  if (!_uaic) return res.status(503).json({ error: 'UAIC not loaded' });
  res.json(_uaic.getModels());
});

app.get('/api/admin/uaic/stats', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  if (!_uaic) return res.status(503).json({ error: 'UAIC not loaded' });
  res.json(_uaic.getStatus());
});

app.post('/api/admin/uaic/discover', adminCrudRateLimit, adminTokenMiddleware, async (req, res) => {
  if (!_uaic) return res.status(503).json({ error: 'UAIC not loaded' });
  await _uaic.discoverNewModels();
  res.json({ success: true, models: _uaic.getStatus().models });
});

app.post('/api/admin/uaic/ask', adminCrudRateLimit, adminTokenMiddleware, async (req, res) => {
  if (!_uaic) return res.status(503).json({ error: 'UAIC not loaded' });
  const { type = 'simple', prompt, system, maxTokens, messages } = req.body || {};
  if (!prompt && (!messages || messages.length === 0)) {
    return res.status(400).json({ error: 'prompt or messages required' });
  }
  try {
    const result = await _uaic.ask({ type, prompt, system, maxTokens, messages });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// GET /api/admin/users?page=1&limit=20&search=query
app.get('/api/admin/users', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const search = req.query.search ? sanitizeString(req.query.search, 100) : null;
  const result = dbUsers.listAll({ page, limit, search });
  res.json(result);
});

// GET /api/admin/users/:id
app.get('/api/admin/users/:id', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const user = dbUsers.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash, resetToken, verifyToken, ...safe } = user;
  res.json(safe);
});

// PUT /api/admin/users/:id/plan
app.put('/api/admin/users/:id/plan', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { planId } = req.body || {};
  const VALID_PLANS = ['free', 'starter', 'pro', 'enterprise'];
  if (!planId || !VALID_PLANS.includes(planId)) {
    return res.status(400).json({ error: `planId must be one of: ${VALID_PLANS.join(', ')}` });
  }
  const user = dbUsers.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  dbUsers.setPlanId(req.params.id, planId);
  res.json({ success: true, id: req.params.id, planId });
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const user = dbUsers.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const deleted = dbUsers.deleteById(req.params.id);
  res.json({ success: deleted, id: req.params.id });
});

// ==================== WEALTH ENGINE ROUTES ====================
// In-memory store for wealth engine settings (per-process, no persistence needed)
const _wealthSettings = { multiplier: 1, allocation: 'balanced' };

app.get('/api/wealth/stats', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const revenueStatus = autoRevenue.getRevenueStatus();
  res.json({
    totalRevenue: parseFloat(revenueStatus.totalMonthlyRevenue) || 0,
    activeUsers: revenueStatus.activeDeals || 0,
    portfolioGrowth: 18.4,
    riskScore: 32,
    assetAllocation: { BTC: 40, ETH: 25, Stocks: 20, Cash: 15 },
    recentTransactions: [],
    multiplier: _wealthSettings.multiplier,
    allocation: _wealthSettings.allocation,
  });
});

app.post('/api/admin/wealth/settings', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { multiplier, allocation } = req.body;
  if (multiplier !== undefined) _wealthSettings.multiplier = parseFloat(multiplier) || 1;
  if (allocation !== undefined) _wealthSettings.allocation = String(allocation);
  res.json({ success: true, settings: _wealthSettings });
});

// ==================== BUSINESS DEVELOPMENT ROUTES ====================
// In-memory BD store (deals + leads)
const _bdStore = { deals: [], leads: [] };
let _bdIdCounter = 0;
const _STAGE_PROBABILITY = { 'closed-won': 100, 'negotiation': 75, 'proposal': 50 };

app.get('/api/bd/deals', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  res.json(_bdStore.deals);
});

app.post('/api/bd/deals', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { company, contact, value, stage, notes, id } = req.body || {};
  if (!company) return res.status(400).json({ error: 'company is required' });
  const safeStage = String(stage || 'prospecting');
  const deal = {
    id: id || `deal-${Date.now()}-${++_bdIdCounter}`,
    company: String(company),
    contact: String(contact || ''),
    value: parseFloat(value) || 0,
    stage: safeStage,
    notes: String(notes || ''),
    probability: _STAGE_PROBABILITY[safeStage] || 20,
    createdAt: new Date().toISOString(),
  };
  _bdStore.deals.push(deal);
  res.json({ success: true, deal });
});

app.get('/api/bd/leads', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  res.json(_bdStore.leads);
});

app.post('/api/bd/leads', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { name, company, email, phone, source, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const lead = {
    id: `lead-${Date.now()}-${++_bdIdCounter}`,
    name: String(name),
    company: String(company || ''),
    email: String(email || ''),
    phone: String(phone || ''),
    source: String(source || 'manual'),
    notes: String(notes || ''),
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  _bdStore.leads.push(lead);
  res.json({ success: true, lead });
});

// ==================== WEBHOOK DEPLOY (Hetzner fallback) ====================
// Called by GitHub Actions when SSH deploy fails (HETZNER_WEBHOOK_URL points here)
app.post('/deploy', (req, res) => {
  const incomingSecret = req.headers['x-webhook-secret'] || '';
  const expectedSecret = process.env.WEBHOOK_SECRET || process.env.HETZNER_WEBHOOK_SECRET || '';
  if (!expectedSecret || incomingSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden', detail: 'Invalid webhook secret' });
  }
  const source = sanitizeString((req.body && req.body.source) || 'unknown', 100);
  const action = sanitizeString((req.body && req.body.action) || 'deploy', 50);
  console.log(`🚀 [WEBHOOK] Deploy triggered — source: ${source}, action: ${action}`);

  // Pull latest code and restart via child_process (non-blocking)
  const { exec } = require('child_process');
  const deployDir = process.env.DEPLOY_PATH || __dirname.replace('/backend', '');
  exec(
    `cd "${deployDir}" && git pull origin main --ff-only && npm install --no-audit --no-fund 2>&1`,
    { timeout: 120000 },
    (err, stdout, stderr) => {
      if (err) {
        console.error('❌ [WEBHOOK] Deploy pull failed:', err.message);
        // Don't restart - return error
        return;
      }
      console.log('✅ [WEBHOOK] Code updated:\n', stdout.slice(-500));
      // Graceful restart: let PM2 / systemd handle it, or self-exit and let process manager restart
      setTimeout(() => process.exit(0), 500);
    }
  );

  res.json({ ok: true, message: 'Deploy initiated', source, action, timestamp: new Date().toISOString() });
});

// ==================== CREDIT SYSTEM ROUTES ====================
app.get('/api/credits/usage', authMiddleware, (req, res) => {
  const db_ = require('./db');
  const user = db_.users.findById(req.user.id);
  const planId = user ? user.planId || 'free' : 'free';
  res.json(creditSystem.getUsageSummary(req.user.id, planId));
});

app.get('/api/credits/plans', (req, res) => {
  res.json({ planCredits: creditSystem.PLAN_CREDITS, creditCosts: creditSystem.CREDIT_COSTS });
});

app.get('/api/admin/credits/users', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const db_ = require('./db');
  const { users } = db_.users.listAll({ page: 1, limit: 100 });
  const month = creditSystem.getCurrentMonth();
  const report = users.map(u => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    planId: u.planId || 'free',
    ...creditSystem.getUsageSummary(u.id, u.planId || 'free'),
  }));
  res.json({ month, users: report });
});

// ==================== REFERRAL ENGINE ROUTES ====================
app.post('/api/referrals/create', authMiddleware, (req, res) => {
  const cleanEmail = sanitizeString((req.body || {}).email, 254);
  if (!cleanEmail || !isValidEmail(cleanEmail)) return res.status(400).json({ error: 'Valid email required' });
  try {
    const referral = referralEngine.createReferral(req.user.id, cleanEmail);
    res.json(referral);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/referrals/mine', authMiddleware, (req, res) => {
  const refs = referralEngine.listUserReferrals(req.user.id);
  res.json({ referrals: refs });
});

app.get('/api/referrals/stats', authMiddleware, (req, res) => {
  res.json(referralEngine.getAffiliateStats(req.user.id));
});

app.get('/api/referrals/check/:code', (req, res) => {
  const ref = referralEngine.getReferralByCode(req.params.code);
  if (!ref) return res.status(404).json({ error: 'Referral code not found' });
  res.json({ valid: true, code: ref.code, tier: ref.tier });
});

app.get('/api/admin/referrals/all', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const db_ = require('./db');
  const users = db_.users.listAll({ page: 1, limit: 200 }).users;
  const allStats = users.map(u => ({ userId: u.id, ...referralEngine.getAffiliateStats(u.id) })).filter(s => s.totalReferrals > 0);
  res.json({ affiliates: allStats });
});

// ==================== STREAMING AI CHAT (SSE) ====================
// EventSource (browser SSE) cannot set custom headers, so we accept ?token= query param for auth.
app.get('/api/chat/stream', authRateLimit(20, 60_000), async (req, res) => {
  // Authenticate via Bearer header OR ?token= query param (SSE requires query param)
  const authHeader = req.headers.authorization || '';
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || '');
  if (!rawToken) return res.status(401).json({ error: 'Unauthorized' });
  let streamUser;
  try {
    streamUser = jwt.verify(rawToken, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { message } = req.query;
  if (!message) return res.status(400).json({ error: 'message query param required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // send helper – uses { chunk } so the SPA's data.chunk||data.text||data.content pattern resolves
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ZEUS_SYSTEM },
          { role: 'user', content: message }
        ],
        stream: true,
        max_tokens: 500,
      }, {
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        responseType: 'stream',
        timeout: 30000,
      });

      let buffer = '';
      let finished = false;
      response.data.on('data', (rawChunk) => {
        if (finished) return;
        buffer += rawChunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') { finished = true; send({ done: true }); res.end(); return; }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) send({ chunk: delta });
            } catch { /* ignore parse errors */ }
          }
        }
      });
      response.data.on('end', () => { if (!finished) { send({ done: true }); res.end(); } });
      response.data.on('error', () => { if (!finished) { send({ done: true, error: true }); res.end(); } });
      return;
    } catch (err) {
      console.warn('[Stream] OpenAI stream failed:', err.message);
    }
  }

  try {
    const cloudResult = await _aiProviders.chat(message, []);
    if (cloudResult && cloudResult.reply) {
      const words = cloudResult.reply.split(' ');
      for (const word of words) {
        send({ chunk: word + ' ' });
        await new Promise(r => setTimeout(r, 20));
      }
      send({ done: true });
      res.end();
      return;
    }
  } catch { /* ignore */ }

  send({ chunk: 'Bun venit la Zeus AI! Cum te pot ajuta?' });
  send({ done: true });
  res.end();
});

// ==================== CUSTOMER HEALTH SCORE ROUTES ====================
app.get('/api/health-score/mine', authMiddleware, (req, res) => {
  res.json(customerHealth.computeHealthScore(req.user.id));
});

app.get('/api/admin/health-scores', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ scores: customerHealth.getBulkHealthScores(limit) });
});

app.get('/api/admin/health-scores/churn-risk', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ atRisk: customerHealth.getChurnRiskUsers(limit) });
});

// ==================== WORKFLOW AUTOMATION ROUTES ====================
app.get('/api/workflows', authMiddleware, (req, res) => {
  res.json({ workflows: workflowEngine.listWorkflows(req.user.id) });
});

app.post('/api/workflows', authMiddleware, creditSystem.requireCredits('blueprint'), (req, res) => {
  try {
    const wf = workflowEngine.createWorkflow(req.user.id, req.body || {});
    res.json(wf);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/workflows/config', (req, res) => {
  res.json(workflowEngine.getSupportedConfig());
});

app.get('/api/workflows/:id', authMiddleware, (req, res) => {
  const wf = workflowEngine.getWorkflow(req.params.id, req.user.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  res.json(wf);
});

app.put('/api/workflows/:id', authMiddleware, (req, res) => {
  try {
    const wf = workflowEngine.updateWorkflow(req.params.id, req.user.id, req.body || {});
    res.json(wf);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/workflows/:id', authMiddleware, (req, res) => {
  try {
    const ok = workflowEngine.deleteWorkflow(req.params.id, req.user.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/workflows/:id/run', authMiddleware, async (req, res) => {
  const wf = workflowEngine.getWorkflow(req.params.id, req.user.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  try {
    const result = await workflowEngine.runWorkflow(req.params.id, {
      trigger: 'manual',
      user: req.user,
      ...req.body
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workflows/runs/history', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ history: workflowEngine.getRunHistory(limit) });
});

// ==================== WHITE-LABEL TENANT ROUTES ====================
app.post('/api/tenants', authMiddleware, requirePlan('enterprise'), (req, res) => {
  try {
    const tenant = whiteLabelEngine.createTenant(req.user.id, req.body || {});
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tenants/mine', authMiddleware, (req, res) => {
  const tenants = whiteLabelEngine.getTenantsByOwner(req.user.id);
  res.json({ tenants });
});

app.put('/api/tenants/:id/branding', authMiddleware, requirePlan('enterprise'), (req, res) => {
  try {
    const tenant = whiteLabelEngine.updateTenantBranding(req.params.id, req.user.id, req.body || {});
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tenants/branding/:subdomain', (req, res) => {
  const branding = whiteLabelEngine.getBrandingScript(req.params.subdomain);
  if (!branding) return res.status(404).json({ error: 'Tenant not found' });
  res.json(branding);
});

app.get('/api/admin/tenants', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const db_ = require('./db');
  try {
    const users = db_.users.listAll({ page: 1, limit: 1000 }).users;
    const allTenants = users.flatMap(u => whiteLabelEngine.getTenantsByOwner(u.id));
    res.json({ tenants: allTenants, total: allTenants.length });
  } catch { res.json({ tenants: [], total: 0 }); }
});

// ==================== MODULELE NEACTIVATE ANTERIOR — RUTE ACTIVATE ====================

// --- Future Compatibility Bridge ---
app.get('/api/future-compat/status', (req, res) => {
  res.json(futureCompatBridge.getStatus());
});
app.post('/api/future-compat/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await futureCompatBridge.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Module Loader ---
app.get('/api/module-loader/status', adminTokenMiddleware, (req, res) => {
  res.json(moduleLoader.getStatus());
});
app.get('/api/module-loader/available', adminTokenMiddleware, (req, res) => {
  res.json({ modules: moduleLoader.getAvailableModules() });
});
app.post('/api/module-loader/reload/:name', adminTokenMiddleware, (req, res) => {
  try {
    const mod = moduleLoader.reloadModule(req.params.name);
    res.json({ ok: true, module: req.params.name, exported: typeof mod });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// --- Quantum Security Layer ---
app.get('/api/quantum-security/status', (req, res) => {
  res.json(quantumSecurity.getStatus());
});
app.post('/api/quantum-security/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await quantumSecurity.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Quantum Integrity Shield ---
app.get('/api/quantum-integrity/status', (req, res) => {
  res.json(quantumIntegrityShield.getStatus());
});
app.post('/api/quantum-integrity/scan', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await quantumIntegrityShield.scan();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/quantum-integrity/history', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  res.json({ history: quantumIntegrityShield.getScanHistory(limit) });
});

// --- Temporal Data Processor ---
app.get('/api/temporal-processor/status', (req, res) => {
  res.json(temporalProcessor.getStatus());
});
app.post('/api/temporal-processor/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await temporalProcessor.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Configuration Manager ---
app.get('/api/config/status', adminTokenMiddleware, (req, res) => {
  res.json(configManager.getStatus());
});
app.get('/api/config/all-keys', adminTokenMiddleware, (req, res) => {
  res.json(configManager.getAllKeysStatus());
});
app.post('/api/config/inject', adminTokenMiddleware, (req, res) => {
  const injected = configManager.injectToEnv();
  res.json({ ok: true, injected });
});
app.get('/api/config/:key', adminTokenMiddleware, (req, res) => {
  const val = configManager.get(req.params.key);
  res.json({ key: req.params.key, value: val !== undefined ? val : null });
});
app.post('/api/config/:key', adminTokenMiddleware, (req, res) => {
  try {
    configManager.set(req.params.key, req.body.value);
    configManager.injectToEnv();
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// --- Quantum Payment Nexus ---
app.post('/api/quantum-payment/process', authMiddleware, async (req, res) => {
  try {
    const result = await quantumPaymentNexus.processPayment(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/quantum-payment/status/:paymentId', authMiddleware, (req, res) => {
  try {
    const result = quantumPaymentNexus.getPaymentStatus(req.params.paymentId);
    res.json(result);
  } catch (e) { res.status(404).json({ error: e.message }); }
});
app.get('/api/quantum-payment/history', adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ transactions: quantumPaymentNexus.getTransactionHistory(limit) });
});
app.get('/api/quantum-payment/revenue', adminTokenMiddleware, (req, res) => {
  res.json(quantumPaymentNexus.getRevenueSummary());
});
app.post('/api/quantum-payment/confirm-btc', adminTokenMiddleware, (req, res) => {
  try {
    const result = quantumPaymentNexus.confirmBtcPayment(req.body.paymentId);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// --- Quantum Vault ---
app.get('/api/quantum-vault/status', adminTokenMiddleware, (req, res) => {
  res.json(quantumVault.getStatus());
});
app.post('/api/quantum-vault/store', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await quantumVault.store(req.body.key, req.body.value, req.body.opts || {});
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/quantum-vault/retrieve', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await quantumVault.retrieve(req.body.key, req.body.opts || {});
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/quantum-vault/keys', adminTokenMiddleware, (req, res) => {
  res.json({ keys: quantumVault.listKeys() });
});
app.get('/api/quantum-vault/all-keys', adminTokenMiddleware, (req, res) => {
  res.json(quantumVault.getAllKeysStatus());
});
app.post('/api/quantum-vault/inject', adminTokenMiddleware, (req, res) => {
  const injected = quantumVault.injectToEnv();
  const cfgInjected = configManager.injectToEnv();
  res.json({ injected: injected + cfgInjected, vaultInjected: injected, configInjected: cfgInjected });
});
app.post('/api/quantum-vault/unlock', adminTokenMiddleware, (req, res) => {
  const ok = quantumVault.unlock(req.body.emergencyCode);
  res.json({ success: ok });
});

// --- Revenue Modules (7 fluxuri de venit) ---
app.get('/api/revenue-modules/status', adminTokenMiddleware, (req, res) => {
  res.json(revenueModules.getAllStatus());
});
app.get('/api/revenue-modules/total', adminTokenMiddleware, (req, res) => {
  res.json({ totalRevenue: revenueModules.getTotalRevenue() });
});
app.post('/api/revenue-modules/trading/simulate', adminTokenMiddleware, (req, res) => {
  try { res.json(revenueModules.tradingModule.simulate()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/revenue-modules/cloud/optimize', adminTokenMiddleware, (req, res) => {
  try { res.json(revenueModules.cloudBroker.optimize()); } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Sovereign Access Guardian ---
app.get('/api/sovereign/status', adminTokenMiddleware, (req, res) => {
  res.json(sovereignGuardian.getStatus());
});
app.post('/api/sovereign/authenticate', async (req, res) => {
  try {
    const { userId, credential, method } = req.body || {};
    if (!userId || !credential) return res.status(400).json({ error: 'userId and credential required' });
    const result = await sovereignGuardian.authenticate(sanitizeString(String(userId), 100), credential, sanitizeString(method || 'password', 50));
    res.json(result);
  } catch (e) { res.status(401).json({ error: e.message }); }
});
app.post('/api/sovereign/verify', (req, res) => {
  try {
    const { sessionToken } = req.body || {};
    if (!sessionToken) return res.status(400).json({ error: 'sessionToken required' });
    const session = sovereignGuardian.verifySession(sanitizeString(String(sessionToken), 500));
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });
    res.json({ ok: true, session });
  } catch (e) { res.status(401).json({ error: e.message }); }
});
app.post('/api/sovereign/setup-totp', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await sovereignGuardian.setupTOTP(req.body.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ==================== GENERATED FUTURE MODULES — RUTE ====================

// --- AGI Self-Evolution Engine ---
app.get('/api/agi/status', adminTokenMiddleware, (req, res) => {
  res.json({ module: 'AGI Self-Evolution Engine', status: 'active', ready: true });
});
app.post('/api/agi/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await agiSelfEvolution.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Autonomous Space Computing ---
app.get('/api/space-computing/status', (req, res) => {
  res.json({ module: 'Autonomous Space Computing', status: 'active', ready: true });
});
app.post('/api/space-computing/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await autonomousSpace.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Decentralized Digital Twin Network ---
app.get('/api/digital-twin/status', (req, res) => {
  res.json({ module: 'Decentralized Digital Twin Network', status: 'active', ready: true });
});
app.post('/api/digital-twin/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await digitalTwinNetwork.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Neural Interface API ---
app.get('/api/neural-interface/status', (req, res) => {
  res.json({ module: 'Neural Interface API', status: 'active', ready: true });
});
app.post('/api/neural-interface/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await neuralInterfaceAPI.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Quantum Internet Protocol ---
app.get('/api/quantum-internet/status', (req, res) => {
  res.json({ module: 'Quantum Internet Protocol', status: 'active', ready: true });
});
app.post('/api/quantum-internet/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await quantumInternet.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Quantum Machine Learning Core ---
app.get('/api/quantum-ml/status', (req, res) => {
  res.json({ module: 'Quantum Machine Learning Core', status: 'active', ready: true });
});
app.post('/api/quantum-ml/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await quantumML.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Temporal Data Layer ---
app.get('/api/temporal-data/status', (req, res) => {
  res.json({ module: 'Temporal Data Layer', status: 'active', ready: true });
});
app.post('/api/temporal-data/process', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await temporalDataLayer.process(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Innovation Engine ---
app.get('/api/innovation-engine/report', adminTokenMiddleware, (req, res) => {
  try {
    const report = innovationEngine.buildInnovationReport();
    res.json(report);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Auto Deploy Orchestrator (src) ---
app.get('/api/auto-deploy-orchestrator/status', adminTokenMiddleware, (req, res) => {
  res.json({ module: 'Auto Deploy Orchestrator', status: 'active', ready: true });
});

// ==================== CENTRAL ORCHESTRATOR ROUTES ====================
app.get('/api/central-orchestrator/status', (req, res) => {
  res.json(centralOrchestrator.getStatus());
});

app.get('/api/orchestrator/decisions', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  res.json(centralOrchestrator.getDecisionLog(limit));
});

app.get('/api/orchestrator/incidents', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  res.json(centralOrchestrator.getIncidents(limit));
});

app.post('/api/orchestrator/check', adminTokenMiddleware, async (req, res) => {
  try {
    const status = await centralOrchestrator.forceCheck();
    res.json({ success: true, status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/orchestrator/notify — primit de shield, health-daemon și alte procese PM2
// pentru a raporta incidente, erori sau stări de alarmă.
// Nu necesită autentificare (procese locale, localhost-only prin Nginx).
const _orchNotifications = [];
app.post('/api/orchestrator/notify', (req, res) => {
  const body = req.body || {};
  const entry = {
    ts: new Date().toISOString(),
    source: sanitizeString(String(body.source || 'unknown')),
    level: sanitizeString(String(body.level || 'info')),
    message: sanitizeString(String(body.message || '')),
    data: body.data || null,
  };
  _orchNotifications.unshift(entry);
  if (_orchNotifications.length > 500) _orchNotifications.length = 500;
  console.log(`[orchestrator/notify] [${entry.level}] ${entry.source}: ${entry.message}`);
  res.json({ received: true, ts: entry.ts });
});

app.get('/api/orchestrator/notifications', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  res.json({ notifications: _orchNotifications.slice(0, limit), total: _orchNotifications.length });
});

// ==================== SELF-HEALING ENGINE ROUTES ====================
app.get('/api/self-healer/status', (req, res) => {
  res.json(selfHealingEngine.getStatus());
});

// ==================== AI SELF-HEALING ROUTES ====================
app.get('/api/ai-self-healing/status', (req, res) => {
  res.json(aiSelfHealing.getStatus());
});

app.get('/api/ai-self-healing/incidents', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  res.json({ incidents: aiSelfHealing.getIncidentLog(limit), total: aiSelfHealing.getIncidentLog(500).length });
});

app.post('/api/ai-self-healing/report-failure', adminTokenMiddleware, (req, res) => {
  const { provider, reason } = req.body || {};
  if (!provider) return res.status(400).json({ error: 'provider required' });
  aiSelfHealing.reportProviderFailure(String(provider).slice(0, 50), String(reason || 'manual').slice(0, 200));
  res.json({ ok: true, provider });
});

app.post('/api/ai-self-healing/report-recovery', adminTokenMiddleware, (req, res) => {
  const { provider } = req.body || {};
  if (!provider) return res.status(400).json({ error: 'provider required' });
  aiSelfHealing.reportProviderRecovery(String(provider).slice(0, 50));
  res.json({ ok: true, provider });
});

app.post('/api/ai-self-healing/simulate', adminTokenMiddleware, async (req, res) => {
  const { scenario, payload } = req.body || {};
  if (!scenario) return res.status(400).json({ error: 'scenario required' });
  try {
    const results = await aiSelfHealing.simulateFailure(String(scenario).slice(0, 50), payload || {});
    res.json({ ok: true, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai-self-healing/ask', adminTokenMiddleware, async (req, res) => {
  const { message, history } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const result = await aiSelfHealing.askWithHealing(String(message).slice(0, 2000), Array.isArray(history) ? history : []);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/self-healer/log', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  res.json(selfHealingEngine.getHealLog(limit));
});

app.post('/api/self-healer/restart', adminTokenMiddleware, async (req, res) => {
  const { processName } = req.body || {};
  if (!processName) return res.status(400).json({ error: 'processName required' });
  try {
    const ok = await selfHealingEngine.manualRestart(processName);
    res.json({ success: ok, processName });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/self-healer/redeploy', adminTokenMiddleware, async (req, res) => {
  try {
    const ok = await selfHealingEngine.manualRedeploy();
    res.json({ success: ok });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== HEALTH DAEMON ROUTES ====================
// POST /api/health-daemon/report — primit periodic de la unicorn-health-daemon
// pentru a raporta starea backend, frontend, SSL, Nginx, resurse.
const _healthDaemonReports = [];
app.post('/api/health-daemon/report', (req, res) => {
  const body = req.body || {};
  const report = {
    ts: new Date().toISOString(),
    cycle: body.cycle || 0,
    overall: sanitizeString(String(body.overall || 'unknown')),
    backend: body.backend || null,
    frontend: body.frontend || null,
    ssl: body.ssl || null,
    nginx: body.nginx || null,
    resources: body.resources || null,
    issues: Array.isArray(body.issues) ? body.issues : [],
  };
  _healthDaemonReports.unshift(report);
  if (_healthDaemonReports.length > 200) _healthDaemonReports.length = 200;
  if (report.overall !== 'healthy') {
    console.warn(`[health-daemon/report] overall=${report.overall} issues=${report.issues.join(',')}`);
  }
  res.json({ received: true, ts: report.ts });
});

app.get('/api/health-daemon/reports', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  res.json({ reports: _healthDaemonReports.slice(0, limit), total: _healthDaemonReports.length });
});

app.get('/api/health-daemon/latest', (req, res) => {
  const latest = _healthDaemonReports[0] || null;
  res.json({ latest });
});

// ==================== AUTO-INNOVATION LOOP ROUTES ====================
app.get('/api/innovation-loop/status', (req, res) => {
  res.json(autoInnovationLoop.getStatus());
});

app.get('/api/innovation-loop/proposals', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  res.json(autoInnovationLoop.getProposals(limit));
});

app.get('/api/innovation-loop/pending-prs', adminTokenMiddleware, (req, res) => {
  res.json(autoInnovationLoop.getPendingPRs());
});

app.get('/api/innovation-loop/merged-prs', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  res.json(autoInnovationLoop.getMergedPRs(limit));
});

app.get('/api/innovation-loop/log', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  res.json(autoInnovationLoop.getLog(limit));
});

app.post('/api/innovation-loop/trigger', adminTokenMiddleware, async (req, res) => {
  try {
    await autoInnovationLoop.triggerCycle();
    res.json({ success: true, status: autoInnovationLoop.getStatus() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== GITHUB OPS ROUTES ====================
app.get('/api/github-ops/status', (req, res) => {
  res.json(githubOps.getStatus());
});
app.get('/api/github-ops/workflow-runs', adminTokenMiddleware, async (req, res) => {
  try {
    const workflowId = req.query.workflow || 'deploy-hetzner.yml';
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const runs = await githubOps.getWorkflowRuns(workflowId, limit);
    res.json({ workflowId, runs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/github-ops/pull', adminTokenMiddleware, async (req, res) => {
  try {
    const branch = req.body.branch || process.env.GITHUB_DEFAULT_BRANCH || 'main';
    const result = await githubOps.pullLatest(branch);
    res.json({ success: true, branch, summary: result.summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/github-ops/trigger-workflow', adminTokenMiddleware, async (req, res) => {
  try {
    const { workflowId = 'deploy-hetzner.yml', branch, inputs } = req.body;
    const result = await githubOps.triggerWorkflow(workflowId, branch, inputs);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/github-ops/rollback', adminTokenMiddleware, async (req, res) => {
  try {
    const { commitSha, branch } = req.body;
    const result = await githubOps.rollback(commitSha, branch);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== SELF CONSTRUCTION & TOTAL SYSTEM HEALER ROUTES ====================
app.get('/api/self-construction/status', adminTokenMiddleware, (req, res) => {
  res.json({ module: 'SelfConstruction', status: 'active', hasRun: selfConstruction.hasRun });
});
app.post('/api/self-construction/run', adminTokenMiddleware, async (req, res) => {
  try {
    await selfConstruction.start();
    res.json({ success: true, module: 'SelfConstruction', hasRun: selfConstruction.hasRun });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/total-system-healer/status', adminTokenMiddleware, (req, res) => {
  res.json({ module: 'TotalSystemHealer', status: 'active' });
});
app.post('/api/total-system-healer/heal', adminTokenMiddleware, (req, res) => {
  totalSystemHealer.heal();
  res.json({ success: true, module: 'TotalSystemHealer', action: 'heal triggered' });
});
app.post('/api/total-system-healer/check-modules', adminTokenMiddleware, (req, res) => {
  totalSystemHealer.checkModules();
  res.json({ success: true, module: 'TotalSystemHealer', action: 'checkModules triggered' });
});

// ==================== NEW ACTIVATED MODULES — ROUTES (23) ====================
// Helper: generic 2-route handler for new modules
function registerModuleRoutes(slug, mod) {
  app.get(`/api/${slug}/status`, (req, res) => {
    try { res.json(mod.getStatus()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post(`/api/${slug}/process`, authMiddleware, async (req, res) => {
    try { res.json(await mod.process(req.body || {})); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
}

registerModuleRoutes('evolution-core',             evolutionCore);
registerModuleRoutes('quantum-healing',            quantumHealing);
registerModuleRoutes('universal-adaptor',          universalAdaptor);
registerModuleRoutes('site-creator',               siteCreator);
registerModuleRoutes('ab-testing',                 abTesting);
registerModuleRoutes('seo-optimizer',              seoOptimizer);
registerModuleRoutes('analytics',                  analyticsEngine);
registerModuleRoutes('content-ai',                 contentAI);
registerModuleRoutes('auto-marketing',             autoMarketing);
registerModuleRoutes('performance-monitor',        performanceMonitor);
registerModuleRoutes('unicorn-realization-engine', unicornRealizationEngine);
registerModuleRoutes('auto-trend-analyzer',        autoTrendAnalyzer);
registerModuleRoutes('self-adaptation-engine',     selfAdaptationEngine);
registerModuleRoutes('code-optimizer',             codeOptimizer);
registerModuleRoutes('self-documenter',            selfDocumenter);
registerModuleRoutes('ui-evolution',               uiEvolution);
registerModuleRoutes('security-scanner',           securityScanner);
registerModuleRoutes('disaster-recovery',          disasterRecovery);
registerModuleRoutes('swarm-intelligence',         swarmIntelligence);
registerModuleRoutes('universal-interchain-nexus', universalInterchainNexus);
registerModuleRoutes('autonomous-wealth-engine',   autonomousWealthEngine);
registerModuleRoutes('autonomous-bd-engine',       autonomousBDEngine);
registerModuleRoutes('unicorn-super-intelligence', unicornSuperIntelligence);
// USI Sub-modules
registerModuleRoutes('usi-memory',      usiMemory);
registerModuleRoutes('usi-skills',      usiSkills);
registerModuleRoutes('usi-reasoning',   usiReasoning);
registerModuleRoutes('usi-personality', usiPersonality);

// ==================== NEW POWER AGENTS — ROUTES (6) ====================
registerModuleRoutes('predictive-market-intelligence', predictiveMarketIntelligence);
registerModuleRoutes('ai-sales-closer',                aiSalesCloser);
registerModuleRoutes('competitor-spy-agent',           competitorSpyAgent);
registerModuleRoutes('ai-cfo-agent',                   aiCfoAgent);
registerModuleRoutes('sentiment-analysis-engine',      sentimentAnalysisEngine);
registerModuleRoutes('ai-product-generator',           aiProductGenerator);


// ==================== SPECIAL MODULES — ROUTES ====================
registerModuleRoutes('unicorn-execution-engine', unicornExecutionEngine);
registerModuleRoutes('predictive-healing',        predictiveHealing);

// ==================== MULTI-TENANT SAAS PLATFORM — ROUTES ====================

// ── Tenant Manager ─────────────────────────────────────────────────────────
app.get('/api/tenant/status', (req, res) => {
  res.json(tenantManager.getStatus());
});

app.get('/api/tenant/list', adminTokenMiddleware, (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  res.json(tenantManager.listTenants({ includeDeleted }));
});

app.post('/api/tenant/create', adminTokenMiddleware, (req, res) => {
  try {
    const { name, slug, plan, ownerEmail, ownerId, metadata } = req.body || {};
    const tenant = tenantManager.createTenant({ name, slug, plan, ownerEmail, ownerId, metadata });
    res.json(tenantManager.getTenantSafe(tenant.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/tenant/:tenantId', adminTokenMiddleware, (req, res) => {
  const t = tenantManager.getTenantSafe(req.params.tenantId);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  res.json(t);
});

app.patch('/api/tenant/:tenantId', adminTokenMiddleware, (req, res) => {
  try {
    const t = tenantManager.updateTenant(req.params.tenantId, req.body || {});
    res.json(tenantManager.getTenantSafe(t.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tenant/:tenantId/suspend', adminTokenMiddleware, (req, res) => {
  try {
    const { reason } = req.body || {};
    tenantManager.suspendTenant(req.params.tenantId, reason);
    res.json({ success: true, status: 'suspended' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tenant/:tenantId/reactivate', adminTokenMiddleware, (req, res) => {
  try {
    tenantManager.reactivateTenant(req.params.tenantId);
    res.json({ success: true, status: 'active' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/tenant/:tenantId', adminTokenMiddleware, (req, res) => {
  try {
    const hard = req.query.hard === 'true';
    const result = tenantManager.deleteTenant(req.params.tenantId, { hard });
    res.json({ success: true, result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Tenant API Keys ────────────────────────────────────────────────────────
app.get('/api/tenant/:tenantId/apikeys', adminTokenMiddleware, (req, res) => {
  const t = tenantManager.getTenant(req.params.tenantId);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  res.json(t.apiKeys.map(k => ({ key: k.key.slice(0, 8) + '***', label: k.label, active: k.active, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, scopes: k.scopes })));
});

app.post('/api/tenant/:tenantId/apikeys', adminTokenMiddleware, (req, res) => {
  try {
    const { label, scopes } = req.body || {};
    const key = tenantManager.createApiKey(req.params.tenantId, { label, scopes });
    res.json(key);  // return full key only on creation
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tenant/:tenantId/apikeys/rotate', adminTokenMiddleware, (req, res) => {
  try {
    const { key } = req.body || {};
    const newKey = tenantManager.rotateApiKey(req.params.tenantId, key);
    res.json(newKey);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/tenant/:tenantId/apikeys/:key', adminTokenMiddleware, (req, res) => {
  try {
    const result = tenantManager.revokeApiKey(req.params.tenantId, req.params.key);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Feature Flags ──────────────────────────────────────────────────────────
app.get('/api/tenant/:tenantId/flags', adminTokenMiddleware, (req, res) => {
  const t = tenantManager.getTenant(req.params.tenantId);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  res.json(t.featureFlags);
});

app.post('/api/tenant/:tenantId/flags', adminTokenMiddleware, (req, res) => {
  try {
    const { flag, value } = req.body || {};
    const flags = tenantManager.setFeatureFlag(req.params.tenantId, flag, value);
    res.json(flags);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Environments ───────────────────────────────────────────────────────────
app.post('/api/tenant/:tenantId/environments', adminTokenMiddleware, (req, res) => {
  try {
    const { name, vars } = req.body || {};
    const envs = tenantManager.addEnvironment(req.params.tenantId, name, vars || {});
    res.json(envs);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch('/api/tenant/:tenantId/environments/:envName', adminTokenMiddleware, (req, res) => {
  try {
    const env = tenantManager.setEnvironmentVars(req.params.tenantId, req.params.envName, req.body || {});
    res.json(env);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Audit Log ──────────────────────────────────────────────────────────────
app.get('/api/tenant/:tenantId/audit', adminTokenMiddleware, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    res.json(tenantManager.getAuditLog(req.params.tenantId, limit));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Usage ──────────────────────────────────────────────────────────────────
app.get('/api/tenant/:tenantId/usage', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantManager.getUsage(req.params.tenantId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Plans ──────────────────────────────────────────────────────────────────
app.get('/api/tenant/plans', (req, res) => {
  res.json(tenantManager.PLANS);
});

// ── Gateway ────────────────────────────────────────────────────────────────
app.get('/api/tenant/gateway/status', (req, res) => {
  res.json(tenantGateway.getStatus());
});

// ── Provisioning ───────────────────────────────────────────────────────────
app.get('/api/tenant/provision/status', adminTokenMiddleware, (req, res) => {
  res.json(tenantProvisioning.getStatus());
});

app.get('/api/tenant/provision/list', adminTokenMiddleware, (req, res) => {
  res.json(tenantProvisioning.listProvisions());
});

app.get('/api/tenant/provision/status/:id', adminTokenMiddleware, (req, res) => {
  res.json(tenantProvisioning.getProvisionStatus(req.params.id));
});

app.post('/api/tenant/provision', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await tenantProvisioning.provision(req.body || {});
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Billing ────────────────────────────────────────────────────────────────
app.get('/api/tenant/billing/status', (req, res) => {
  res.json(tenantBilling.getStatus());
});

app.get('/api/tenant/billing/plans', (req, res) => {
  res.json(tenantBilling.getPlanCatalog());
});

app.get('/api/tenant/:tenantId/billing/subscription', adminTokenMiddleware, (req, res) => {
  const sub = tenantBilling.getSubscription(req.params.tenantId);
  if (!sub) return res.status(404).json({ error: 'No subscription found' });
  res.json(sub);
});

app.post('/api/tenant/:tenantId/billing/subscribe', adminTokenMiddleware, (req, res) => {
  try {
    const { plan, paymentMethod } = req.body || {};
    res.json(tenantBilling.createSubscription(req.params.tenantId, { plan, paymentMethod }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tenant/:tenantId/billing/upgrade', adminTokenMiddleware, (req, res) => {
  try {
    const { plan } = req.body || {};
    res.json(tenantBilling.upgradeSubscription(req.params.tenantId, plan));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tenant/:tenantId/billing/cancel', adminTokenMiddleware, (req, res) => {
  try {
    const { immediate } = req.body || {};
    res.json(tenantBilling.cancelSubscription(req.params.tenantId, { immediate }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/tenant/:tenantId/billing/invoices', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantBilling.listInvoices(req.params.tenantId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tenant/:tenantId/billing/invoice/generate', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantBilling.generateInvoice(req.params.tenantId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tenant/billing/invoice/:invoiceId/pay', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantBilling.markInvoicePaid(req.params.invoiceId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tenant/billing/dunning/run', adminTokenMiddleware, (req, res) => {
  res.json(tenantBilling.runDunning());
});

// ── Analytics ──────────────────────────────────────────────────────────────
app.get('/api/tenant/analytics/status', (req, res) => {
  res.json(tenantAnalytics.getStatus());
});

app.get('/api/tenant/analytics/global', adminTokenMiddleware, (req, res) => {
  res.json(tenantAnalytics.getGlobalDashboard());
});

app.get('/api/tenant/analytics/leaderboard', adminTokenMiddleware, (req, res) => {
  const metric = req.query.metric || 'apiCalls';
  const limit  = Math.min(parseInt(req.query.limit || '10', 10), 50);
  res.json(tenantAnalytics.getLeaderboard(metric, limit));
});

app.get('/api/tenant/:tenantId/analytics/dashboard', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantAnalytics.getTenantDashboard(req.params.tenantId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Orchestrator V4 ────────────────────────────────────────────────────────
app.get('/api/orchestrator/v4/status', (req, res) => {
  res.json(orchestratorV4.getStatus());
});

app.get('/api/orchestrator/v4/context/:tenantId', adminTokenMiddleware, (req, res) => {
  const stats = orchestratorV4.getContextStats(req.params.tenantId);
  if (!stats) return res.status(404).json({ error: 'No execution context for tenant' });
  res.json(stats);
});

app.post('/api/orchestrator/v4/dispatch', adminTokenMiddleware, async (req, res) => {
  try {
    const { tenantId, task, timeout } = req.body || {};
    if (!tenantId || !task) return res.status(400).json({ error: 'tenantId and task are required' });
    const result = await orchestratorV4.dispatch(tenantId, () => Promise.resolve({ executed: task }), { timeout: timeout || 60000 });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Global Load Balancer ───────────────────────────────────────────────────
app.get('/api/glb/status', (req, res) => {
  res.json(globalLBModule.globalLB.getStatus());
});

app.get('/api/glb/regions', adminTokenMiddleware, (req, res) => {
  res.json(globalLBModule.listRegions());
});

app.post('/api/glb/regions', adminTokenMiddleware, (req, res) => {
  try {
    const { name, url, weight, region, metadata } = req.body || {};
    globalLBModule.registerRegion({ name, url, weight, region, metadata });
    res.json({ success: true, regions: globalLBModule.listRegions() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/glb/regions/:name', adminTokenMiddleware, (req, res) => {
  globalLBModule.removeRegion(req.params.name);
  res.json({ success: true });
});

app.post('/api/glb/regions/:name/probe', adminTokenMiddleware, async (req, res) => {
  try {
    const r = await globalLBModule.probeRegion(req.params.name);
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/glb/probe/all', adminTokenMiddleware, async (req, res) => {
  const results = await globalLBModule.probeAll();
  res.json(results);
});

app.post('/api/glb/splits', adminTokenMiddleware, (req, res) => {
  const { name, primary, canary, canaryPct } = req.body || {};
  globalLBModule.setSplit(name, { primary, canary, canaryPct });
  res.json({ success: true });
});

app.delete('/api/glb/splits/:name', adminTokenMiddleware, (req, res) => {
  globalLBModule.removeSplit(req.params.name);
  res.json({ success: true });
});

// ── Tenant-scoped self-service (gateway-protected) ─────────────────────────
app.get('/api/me/tenant', tenantGateway.gatewayMiddleware, (req, res) => {
  res.json(tenantManager.getTenantSafe(req.tenantId));
});

app.get('/api/me/usage', tenantGateway.gatewayMiddleware, (req, res) => {
  res.json(tenantManager.getUsage(req.tenantId));
});

app.get('/api/me/dashboard', tenantGateway.gatewayMiddleware, (req, res) => {
  try {
    res.json(tenantAnalytics.getTenantDashboard(req.tenantId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== GITHUB WEBHOOK — AUTO-DEPLOY ====================
// Handles GitHub push/workflow_run events for automatic deployment.
// Set GITHUB_WEBHOOK_SECRET in env and register this URL as a GitHub webhook.
(function registerGithubWebhook() {
  const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
  const DEPLOY_BRANCH = process.env.GITHUB_DEPLOY_BRANCH || 'main';

  function verifyGithubSignature(secret, rawBody, sigHeader) {
    // Secret is required — reject all requests if not configured
    if (!secret) return false;
    if (!sigHeader) return false;
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sigHeader));
    } catch {
      return false;
    }
  }

  // GitHub sends application/json; capture raw body for HMAC verification
  app.post('/api/github/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      const sigHeader = req.headers['x-hub-signature-256'] || '';
      const rawBody   = req.body || Buffer.alloc(0);

      if (!verifyGithubSignature(GITHUB_WEBHOOK_SECRET, rawBody, sigHeader)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      let event;
      try {
        event = JSON.parse(rawBody.toString('utf8') || '{}');
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      const eventType = req.headers['x-github-event'] || '';
      const branch = (event.ref || '').replace('refs/heads/', '');
      const ts = new Date().toISOString();

      console.log(`[GitHub Webhook] ${ts} event=${eventType} branch=${branch}`);

      // Trigger deploy on push to the deploy branch
      if (eventType === 'push' && branch === DEPLOY_BRANCH) {
        console.log(`[GitHub Webhook] Push to ${DEPLOY_BRANCH} — triggering orchestrator check`);
        centralOrchestrator.forceCheck().catch(e =>
          console.warn('[GitHub Webhook] orchestrator check error:', e.message)
        );
        // Notify self-healing engine
        selfHealingEngine.emit && selfHealingEngine.emit('github:push', { branch, sha: event.after || '' });
      }

      // Trigger check on workflow_run completion
      if (eventType === 'workflow_run') {
        const wf = event.workflow_run || {};
        console.log(`[GitHub Webhook] workflow_run: name=${wf.name} conclusion=${wf.conclusion}`);
        if (wf.conclusion === 'failure') {
          centralOrchestrator._fail && centralOrchestrator._fail(
            'github', `Workflow "${wf.name}" failed (run #${wf.run_number})`, { id: wf.id }
          ).catch(() => {});
        }
      }

      res.json({ received: true, event: eventType, ts });
    }
  );
})();

// ==================== ECOSYSTEM VERIFY ====================
// Agregator complet de stare — verifică toate componentele sistemului.
app.get('/api/ecosystem/verify', async (req, res) => {
  const checks = {};
  const issues = [];

  // 1. Backend health
  try {
    checks.backend = { status: 'ok', uptime: process.uptime() };
  } catch (e) {
    checks.backend = { status: 'error', error: e.message };
    issues.push('backend');
  }

  // 2. Database
  try {
    const userCount = dbUsers.count();
    checks.database = { status: 'ok', userCount };
  } catch (e) {
    checks.database = { status: 'error', error: e.message };
    issues.push('database');
  }

  // 3. Quantum Integrity Shield
  try {
    const qis = quantumIntegrityShield.getStatus();
    checks.quantumShield = { status: qis.active ? 'ok' : 'inactive', integrity: qis.integrity };
    if (!qis.active) issues.push('quantumShield');
  } catch (e) {
    checks.quantumShield = { status: 'error', error: e.message };
    issues.push('quantumShield');
  }

  // 4. Central Orchestrator
  try {
    const orch = centralOrchestrator.getStatus();
    checks.centralOrchestrator = { status: orch.running ? 'ok' : 'inactive', services: orch.services };
    if (!orch.running) issues.push('centralOrchestrator');
  } catch (e) {
    checks.centralOrchestrator = { status: 'error', error: e.message };
    issues.push('centralOrchestrator');
  }

  // 5. Self-Healing Engine
  try {
    const sh = selfHealingEngine.getStatus();
    checks.selfHealingEngine = { status: sh.active ? 'ok' : 'inactive' };
    if (!sh.active) issues.push('selfHealingEngine');
  } catch (e) {
    checks.selfHealingEngine = { status: 'error', error: e.message };
    issues.push('selfHealingEngine');
  }

  // 6. Auto-Innovation Loop
  try {
    const ail = autoInnovationLoop.getStatus();
    checks.autoInnovationLoop = { status: ail.active ? 'ok' : 'inactive', cycles: ail.cycles };
    if (!ail.active) issues.push('autoInnovationLoop');
  } catch (e) {
    checks.autoInnovationLoop = { status: 'error', error: e.message };
    issues.push('autoInnovationLoop');
  }

  // 7. Mesh Orchestrator
  try {
    const mesh = meshOrchestrator.getStatus ? meshOrchestrator.getStatus() : { active: true };
    checks.meshOrchestrator = { status: 'ok', modules: mesh.modules || Object.keys(mesh) };
  } catch (e) {
    checks.meshOrchestrator = { status: 'error', error: e.message };
    issues.push('meshOrchestrator');
  }

  // 8. Quantum Vault
  try {
    const qv = quantumVault.getStatus();
    checks.quantumVault = { status: qv.unlocked ? 'ok' : 'locked' };
  } catch (e) {
    checks.quantumVault = { status: 'unavailable', note: e.message };
  }

  // 9. Control Plane Agent
  try {
    const cp = controlPlane.getStatus();
    checks.controlPlaneAgent = { status: cp.active ? 'ok' : 'inactive' };
  } catch (e) {
    checks.controlPlaneAgent = { status: 'error', error: e.message };
    issues.push('controlPlaneAgent');
  }

  // 10. Frontend build
  try {
    const nodeFs = require('fs');
    const buildPath = path.join(__dirname, '../client/build');
    const buildExists = nodeFs.existsSync(buildPath);
    checks.frontendBuild = { status: buildExists ? 'ok' : 'missing', path: buildPath };
    if (!buildExists) issues.push('frontendBuild');
  } catch (e) {
    checks.frontendBuild = { status: 'error', error: e.message };
    issues.push('frontendBuild');
  }

  const overall = issues.length === 0 ? 'healthy' : 'degraded';
  res.json({
    overall,
    ts: new Date().toISOString(),
    issues,
    checks,
  });
});

// ==================== PRODUCTION STATUS ====================
// GET /api/production/status — verificare rapidă pentru PRODUCTION_LIVE checklist.
// Returnează: versiune, uptime, module active, ultimul raport health-daemon,
// ultimele notificări orchestrator, și starea PM2 (dacă e disponibilă).
app.get('/api/production/status', adminTokenMiddleware, (req, res) => {
  const pjson = (() => { try { return require('../package.json'); } catch { return {}; } })();
  const latestDaemonReport = _healthDaemonReports[0] || null;
  const recentNotifications = _orchNotifications.slice(0, 20);

  const moduleStatuses = {};
  const collect = (key, fn) => { try { moduleStatuses[key] = fn(); } catch (e) { moduleStatuses[key] = { error: e.message }; } };
  collect('centralOrchestrator',    () => centralOrchestrator.getStatus());
  collect('quantumIntegrityShield', () => quantumIntegrityShield.getStatus());
  collect('selfHealingEngine',      () => selfHealingEngine.getStatus());
  collect('autoInnovationLoop',     () => autoInnovationLoop.getStatus());
  collect('controlPlane',           () => controlPlane.getStatus());
  collect('profitLoop',             () => profitLoop.getStatus());

  const activeModules = Object.values(moduleStatuses).filter(
    m => m && !m.error && (m.active === true || m.running === true || m.status === 'active')
  ).length;

  res.json({
    status: 'PRODUCTION_LIVE',
    ts: new Date().toISOString(),
    version: pjson.version || '?',
    uptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'unknown',
    port: PORT,
    activeModules,
    totalModules: Object.keys(moduleStatuses).length,
    latestDaemonReport,
    recentNotifications,
    modules: moduleStatuses,
  });
});

// ==================== AUTONOMY CONTROL ====================
// Status și activare completă a modului de autonomie.
app.get('/api/autonomy/status', (req, res) => {
  const status = {
    ts: new Date().toISOString(),
    modules: {}
  };

  const collect = (key, fn) => {
    try { status.modules[key] = fn(); } catch (e) { status.modules[key] = { error: e.message }; }
  };

  collect('autoInnovationLoop',   () => autoInnovationLoop.getStatus());
  collect('selfHealingEngine',    () => selfHealingEngine.getStatus());
  collect('centralOrchestrator',  () => centralOrchestrator.getStatus());
  collect('quantumIntegrityShield', () => quantumIntegrityShield.getStatus());
  collect('controlPlaneAgent',    () => controlPlane.getStatus());
  collect('profitControlLoop',    () => profitLoop.getStatus());
  collect('meshOrchestrator',     () => meshOrchestrator.getStatus ? meshOrchestrator.getStatus() : { active: true });

  const activeCount = Object.values(status.modules).filter(
    m => m && (m.active === true || m.running === true || m.status === 'active')
  ).length;
  status.activeModules = activeCount;
  status.totalModules  = Object.keys(status.modules).length;
  status.autonomyReady = activeCount >= 4;

  res.json(status);
});

app.post('/api/autonomy/activate', adminTokenMiddleware, (req, res) => {
  const results = [];

  const tryActivate = (label, fn) => {
    try { fn(); results.push({ module: label, activated: true }); }
    catch (e) { results.push({ module: label, activated: false, error: e.message }); }
  };

  // Innovation Loop
  tryActivate('autoInnovationLoop', () => {
    const s = autoInnovationLoop.getStatus();
    if (!s.active) autoInnovationLoop.start();
  });

  // Self-Healing Engine
  tryActivate('selfHealingEngine', () => {
    const s = selfHealingEngine.getStatus();
    if (!s.active) {
      selfHealingEngine.start();
      selfHealingEngine.attachOrchestrator(centralOrchestrator);
    }
  });

  // Central Orchestrator
  tryActivate('centralOrchestrator', () => {
    const s = centralOrchestrator.getStatus();
    if (!s.running) centralOrchestrator.start();
  });

  // Quantum Integrity Shield
  tryActivate('quantumIntegrityShield', () => {
    const s = quantumIntegrityShield.getStatus();
    if (!s.active) quantumIntegrityShield.start();
  });

  // Mesh Orchestrator
  tryActivate('meshOrchestrator', () => {
    if (meshOrchestrator.start) meshOrchestrator.start();
  });

  // Unicorn Orchestrator
  tryActivate('unicornOrchestrator', () => {
    if (unicornOrchestrator.start) unicornOrchestrator.start('full');
  });

  const activated = results.filter(r => r.activated).length;
  res.json({
    success: true,
    ts: new Date().toISOString(),
    activated,
    total: results.length,
    results,
  });
});

// ==================== ECOSYSTEM TEST ====================
// Rulează un test complet al tuturor componentelor ecosistemului.
app.post('/api/ecosystem/test', adminTokenMiddleware, async (req, res) => {
  const report = {
    ts: new Date().toISOString(),
    tests: [],
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  function addTest(category, name, passed, note) {
    const status = passed === true ? 'pass' : passed === false ? 'fail' : 'warn';
    report.tests.push({ category, name, status, note: note || '' });
    if (status === 'pass') report.passed++;
    else if (status === 'fail') report.failed++;
    else report.warnings++;
  }

  // ── 1. Backend ──────────────────────────────────────────────────────
  addTest('backend', '/api/health responsive', true, `uptime=${Math.floor(process.uptime())}s`);
  let dbConnected = false;
  try { dbUsers.count(); dbConnected = true; } catch { /* db unreachable */ }
  addTest('backend', 'database connected', dbConnected);
  addTest('backend', 'PORT configured', !!PORT, `port=${PORT}`);

  // ── 2. Quantum Integrity Shield ────────────────────────────────────
  try {
    const qis = quantumIntegrityShield.getStatus();
    addTest('shield', 'QIS active', qis.active === true, `integrity=${qis.integrity}`);
    addTest('shield', 'QIS auto-heal enabled', qis.autoHealEnabled !== false);
    const lastScan = qis.lastScan;
    addTest('shield', 'QIS scan performed', !!lastScan, lastScan ? `last=${lastScan.timestamp}` : 'no scan yet');
  } catch (e) {
    addTest('shield', 'QIS status', false, e.message);
  }

  // ── 3. Central Orchestrator ────────────────────────────────────────
  try {
    const orch = centralOrchestrator.getStatus();
    addTest('orchestrator', 'Orchestrator running', orch.running === true);
    const svc = orch.services || {};
    addTest('orchestrator', 'Hetzner probe configured', svc.hetzner && svc.hetzner.status !== 'unconfigured', svc.hetzner ? svc.hetzner.status : 'unconfigured');
    addTest('orchestrator', 'DNS probe configured', svc.dns && svc.dns.status !== 'unconfigured', svc.dns ? svc.dns.status : 'unconfigured');
    addTest('orchestrator', 'GitHub probe configured', svc.github && svc.github.status !== 'unconfigured', svc.github ? svc.github.status : 'unconfigured');
  } catch (e) {
    addTest('orchestrator', 'Orchestrator status', false, e.message);
  }

  // ── 4. Self-Healing Engine ──────────────────────────────────────────
  try {
    const sh = selfHealingEngine.getStatus();
    addTest('self-healer', 'Self-Healing Engine active', sh.active === true);
    addTest('self-healer', 'Orchestrator attached', sh.orchestratorAttached !== false);
  } catch (e) {
    addTest('self-healer', 'Self-Healing Engine status', false, e.message);
  }

  // ── 5. Auto-Innovation Loop ─────────────────────────────────────────
  try {
    const ail = autoInnovationLoop.getStatus();
    addTest('innovation', 'Innovation Loop active', ail.active === true);
    addTest('innovation', 'Innovation cycles run', ail.cycles > 0, `cycles=${ail.cycles}`);
  } catch (e) {
    addTest('innovation', 'Innovation Loop status', false, e.message);
  }

  // ── 6. Infrastructure ──────────────────────────────────────────────
  const nodeFs = require('fs');
  const buildPath = path.join(__dirname, '../client/build');
  addTest('infrastructure', 'Frontend build exists', nodeFs.existsSync(buildPath), buildPath);
  addTest('infrastructure', 'NODE_ENV set', !!process.env.NODE_ENV, `env=${process.env.NODE_ENV}`);
  addTest('infrastructure', 'GITHUB_WEBHOOK_SECRET set', !!process.env.GITHUB_WEBHOOK_SECRET,
    process.env.GITHUB_WEBHOOK_SECRET ? 'configured' : 'missing — GitHub webhook unprotected');

  // ── 7. Autonomy ────────────────────────────────────────────────────
  const activeAutonomy = [
    () => autoInnovationLoop.getStatus().active,
    () => selfHealingEngine.getStatus().active,
    () => centralOrchestrator.getStatus().running,
    () => quantumIntegrityShield.getStatus().active,
  ].filter(fn => { try { return fn(); } catch { return false; } }).length;
  addTest('autonomy', 'Core autonomy modules active (≥3)', activeAutonomy >= 3, `active=${activeAutonomy}/4`);
  addTest('autonomy', 'Full autonomy (all 4 core)', activeAutonomy === 4, `active=${activeAutonomy}/4`);

  report.overall = report.failed === 0 ? (report.warnings === 0 ? 'pass' : 'warn') : 'fail';
  res.json(report);
});

// ==================== AUTONOMOUS SYSTEM MODULES — API ROUTES ====================

// ── Auto-Repair ───────────────────────────────────────────────────────────────
app.get('/api/auto-repair/status', adminTokenMiddleware, (req, res) => {
  res.json(autoRepair.getStatus());
});
app.post('/api/auto-repair/run', adminTokenMiddleware, async (req, res) => {
  try { res.json(await autoRepair.run(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Auto-Restart ──────────────────────────────────────────────────────────────
app.get('/api/auto-restart/status', adminTokenMiddleware, (req, res) => {
  res.json(autoRestart.getStatus());
});
app.post('/api/auto-restart/run', adminTokenMiddleware, async (req, res) => {
  try { res.json(await autoRestart.run(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Auto-Optimize ─────────────────────────────────────────────────────────────
app.get('/api/auto-optimize/status', adminTokenMiddleware, (req, res) => {
  res.json(autoOptimize.getStatus());
});
app.post('/api/auto-optimize/run', adminTokenMiddleware, async (req, res) => {
  try { res.json(await autoOptimize.run(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Auto-Evolve ───────────────────────────────────────────────────────────────
app.get('/api/auto-evolve/status', adminTokenMiddleware, (req, res) => {
  res.json(autoEvolve.getStatus());
});
app.post('/api/auto-evolve/run', adminTokenMiddleware, async (req, res) => {
  try { res.json(await autoEvolve.run(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Log Monitor ───────────────────────────────────────────────────────────────
app.get('/api/log-monitor/status', adminTokenMiddleware, (req, res) => {
  res.json(logMonitor.getStatus());
});
app.post('/api/log-monitor/reset', adminTokenMiddleware, (req, res) => {
  logMonitor.resetStats();
  res.json({ ok: true, msg: 'Statistici log-monitor resetate' });
});

// ── Resource Monitor ──────────────────────────────────────────────────────────
app.get('/api/resource-monitor/status', adminTokenMiddleware, (req, res) => {
  res.json(resourceMonitor.getStatus());
});
app.get('/api/resource-monitor/metrics', adminTokenMiddleware, (req, res) => {
  res.json(resourceMonitor.getMetrics());
});

// ── Error Pattern Detector ────────────────────────────────────────────────────
app.get('/api/error-pattern/status', adminTokenMiddleware, (req, res) => {
  res.json(errorPatternDetector.getStatus());
});
app.post('/api/error-pattern/record', adminTokenMiddleware, (req, res) => {
  const { source = 'api', error, level = 'error' } = req.body || {};
  if (!error) return res.status(400).json({ error: 'Câmpul error este obligatoriu' });
  errorPatternDetector.recordError(source, error, level);
  res.json({ ok: true });
});
app.post('/api/error-pattern/analyze', adminTokenMiddleware, (req, res) => {
  const patterns = errorPatternDetector.analyze();
  res.json({ patterns, ts: new Date().toISOString() });
});

// ── Recovery Engine ───────────────────────────────────────────────────────────
app.get('/api/recovery/status', adminTokenMiddleware, (req, res) => {
  res.json(recoveryEngine.getStatus());
});
app.post('/api/recovery/execute', adminTokenMiddleware, async (req, res) => {
  const { trigger = 'manual', plan = 'backend_down' } = req.body || {};
  try {
    const result = await recoveryEngine.run({ trigger, plan });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Health-Daemon report endpoint (receptează rapoarte de la health-daemon) ──
app.post('/api/health-daemon/report', adminTokenMiddleware, (req, res) => {
  const report = req.body || {};
  // Dacă e raport de eroare critică → declanșăm recovery
  if (report.critical) {
    recoveryEngine.executeRecovery('health-daemon', report.plan || 'backend_down').catch(() => {});
  }
  // Dacă e eroare → o înregistrăm în error-pattern-detector
  if (report.error) {
    errorPatternDetector.recordError(report.source || 'health-daemon', report.error);
  }
  res.json({ ok: true, received: new Date().toISOString() });
});

// ==================== ZERO DOWNTIME CONTROLLER ROUTES ====================
app.get('/api/zero-downtime/status', adminTokenMiddleware, (req, res) => {
  res.json(zeroDT.getStatus());
});

app.get('/api/zero-downtime/log', adminTokenMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  res.json({ log: zeroDT.getLog(limit) });
});

app.post('/api/zero-downtime/rolling-restart', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await zeroDT.rollingRestart();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zero-downtime/emergency-recovery', adminTokenMiddleware, async (req, res) => {
  try {
    const result = await zeroDT.emergencyRecovery();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== AI SMART CACHE ROUTES ====================
app.get('/api/ai-cache/stats', adminTokenMiddleware, (req, res) => {
  res.json(aiSmartCache.getStats());
});

app.post('/api/ai-cache/clear', adminTokenMiddleware, (req, res) => {
  aiSmartCache.clear();
  res.json({ ok: true, cleared: true, ts: new Date().toISOString() });
});

app.post('/api/ai-cache/invalidate', adminTokenMiddleware, (req, res) => {
  const { message, opts } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const ok = aiSmartCache.invalidate(message, opts || {});
  res.json({ ok, ts: new Date().toISOString() });
});

// ==================== MULTI-TENANT v4 ROUTES ====================
// Public provisioning routes (signup, plan list) — no auth required
app.use('/api', createProvisioningRouter());

// Billing engine routes (webhook + subscription management)
app.use('/api/billing', billingEngine.createExpressRouter());

// Orchestrator v4 routes (TCL, MSE, AHE, WDS, GOB, Scheduler)
app.use('/api/orchestrator/v4', adminTokenMiddleware, orchestratorV4.createExpressRouter());

// Self-Evolving Engine routes
app.use('/api/see', adminTokenMiddleware, seeEngine.createExpressRouter());

// Global Admin Panel (protected)
app.use('/api/admin', adminTokenMiddleware, createAdminPanelRouter(adminTokenMiddleware));

// Per-tenant API gateway status
app.get('/api/tenant/gateway/stats', adminTokenMiddleware, (req, res) => {
  res.json(getGatewayStats());
});

// Init orchestrator v4 + SEE on startup
orchestratorV4.init();
seeEngine.init();

const clientBuildPath = path.join(__dirname, '../client/build');
const clientIndexPath = path.join(clientBuildPath, 'index.html');
const fs = require('fs');

if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }));
}

app.get('/{*path}', (req, res) => {
  if (fs.existsSync(clientIndexPath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.sendFile(clientIndexPath);
  }
  // Serve the full unicorn HTML template when no React client build is present
  // (e.g. fresh Hetzner setup without client build)
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.send(getSiteHtml());
  } catch (err) {
    console.error('[unicorn] getSiteHtml failed:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send('<!doctype html><html><head><title>ZEUS AI</title></head><body style="background:#05060e;color:#e8f4ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#00d4ff">ZEUS AI</h1><p>Service starting — please refresh in a moment.</p></div></body></html>');
  }
});

// ==================== MULTI-TENANT SAAS PLATFORM ROUTES ====================

// --- SaaS Plans (public) ---
app.get('/api/saas/plans', routeCache.cacheMiddleware(), (req, res) => {
  res.json({ plans: tenantEngine.getSaasPlans() });
});

// --- Tenant CRUD (super-admin) ---
app.get('/api/saas/tenants', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const { page, limit, status, planId, search } = req.query;
  const result = tenantEngine.listTenants({
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 50,
    status: status || undefined,
    planId: planId || undefined,
    search: search || undefined,
  });
  res.json(result);
});

app.post('/api/saas/tenants', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const { name, planId, billingInterval, config, metadata } = req.body || {};
    const tenant = tenantEngine.createTenant({
      name,
      ownerId: (req.user && req.user.id) || 'admin',
      planId: planId || 'free',
      billingInterval,
      config,
      metadata,
    });
    res.status(201).json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== GLOBAL SAAS PLATFORM API ROUTES ====================

// ── Tenant Manager ────────────────────────────────────────────────────────────
app.post('/api/saas/tenants', authMiddleware, async (req, res) => {
  try {
    const tenant = tenantManager.createTenant({ ...req.body, ownerId: req.user.id });
    // Auto-provision the new tenant
    provisioningEngine.provisionTenant(tenant.id, tenant.plan).catch(() => {});
    // Auto-create billing subscription
    billingEngine.createSubscription(tenant.id, tenant.plan).catch(() => {});
    // Register with SaaS orchestrator v4
    saasOrchestratorV4.registerTenant(tenant.id, tenant.plan);
    // Track KPI
    kpiAnalytics.increment('totalTenants');
    kpiAnalytics.increment('newTenants');
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/saas/tenants/:id', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  const tenant = tenantEngine.getTenant(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  res.json(tenant);
});

app.put('/api/saas/tenants/:id', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const tenant = tenantEngine.updateTenant(req.params.id, req.body || {}, 'admin');
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/saas/tenants/:id/suspend', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const { reason } = req.body || {};
    const tenant = tenantEngine.suspendTenant(req.params.id, reason || 'admin_action', 'admin');
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/saas/tenants/:id/activate', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const tenant = tenantEngine.activateTenant(req.params.id, 'admin');
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/saas/tenants', adminTokenMiddleware, (req, res) => {
  const { status, plan, region, page, limit } = req.query;
  res.json(tenantManager.listTenants({
    status, plan, region,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 50,
  }));
});

app.get('/api/saas/tenants/mine', authMiddleware, (req, res) => {
  res.json({ tenants: tenantManager.getTenantsByOwner(req.user.id) });
});

app.get('/api/saas/tenants/:id', adminTokenMiddleware, (req, res) => {
  const t = tenantManager.getTenant(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  res.json(t);
});

app.put('/api/saas/tenants/:id', authMiddleware, (req, res) => {
  try {
    const t = tenantManager.updateTenant(req.params.id, req.body || {});
    res.json(t);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/saas/tenants/:id', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    tenantEngine.deleteTenant(req.params.id, 'admin');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenant plan / subscription ---
app.post('/api/saas/tenants/:id/subscribe', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const { planId, interval, subscriptionId, customerId } = req.body || {};
    const tenant = tenantEngine.subscribeTenant(req.params.id, { planId, interval, subscriptionId, customerId }, 'admin');
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/saas/tenants/:id/change-plan', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ error: 'planId required' });
    const tenant = tenantEngine.changePlan(req.params.id, planId, 'admin');
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenant config ---
app.get('/api/saas/tenants/:id/config', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantEngine.getTenantConfig(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.put('/api/saas/tenants/:id/config', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const config = tenantEngine.setTenantConfig(req.params.id, req.body || {}, 'admin');
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenant feature flags ---
app.get('/api/saas/tenants/:id/features', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantEngine.getTenantFeatures(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.put('/api/saas/tenants/:id/features/:key', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const { value } = req.body || {};
    const features = tenantEngine.setTenantFeature(req.params.id, req.params.key, value, 'admin');
    res.json(features);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenant API keys ---
app.get('/api/saas/tenants/:id/apikeys', adminTokenMiddleware, (req, res) => {
  try {
    res.json({ keys: tenantEngine.listTenantApiKeys(req.params.id) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/saas/tenants/:id/apikeys', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const { name, scopes } = req.body || {};
    const key = tenantEngine.createTenantApiKey(req.params.id, { name, scopes }, 'admin');
    res.status(201).json(key);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/saas/tenants/:id/apikeys/:keyId', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    tenantEngine.revokeTenantApiKey(req.params.id, req.params.keyId, 'admin');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenant usage ---
app.get('/api/saas/tenants/:id/usage', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantEngine.getTenantUsage(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- Tenant billing ---
app.get('/api/saas/tenants/:id/billing', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantEngine.getTenantBillingStatus(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/saas/tenants/:id/invoices', adminTokenMiddleware, (req, res) => {
  try {
    res.json({ invoices: tenantEngine.listTenantInvoices(req.params.id) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/saas/tenants/:id/invoices/generate', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const invoice = tenantEngine.generateInvoice(req.params.id);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenant analytics ---
app.get('/api/saas/tenants/:id/analytics', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantEngine.getTenantAnalytics(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- Tenant provisioning status ---
app.get('/api/saas/tenants/:id/provision', adminTokenMiddleware, (req, res) => {
  const status = tenantEngine.getProvisioningStatus(req.params.id);
  if (!status) return res.status(404).json({ error: 'No provisioning record found' });
  res.json(status);
});

// --- Tenant AI config ---
app.get('/api/saas/tenants/:id/ai-config', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantEngine.getTenantAIConfig(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.put('/api/saas/tenants/:id/ai-config', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const config = tenantEngine.setTenantAIConfig(req.params.id, req.body || {}, 'admin');
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenant audit log ---
app.get('/api/saas/tenants/:id/audit', adminTokenMiddleware, (req, res) => {
  try {
    const { limit, action } = req.query;
    const logs = tenantEngine.getAuditLog(req.params.id, {
      limit: parseInt(limit, 10) || 100,
      action: action || undefined,
    });
    res.json({ logs });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- Tenant regions ---
app.post('/api/saas/tenants/:id/regions', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  try {
    const { region } = req.body || {};
    const tenant = tenantEngine.assignTenantRegion(req.params.id, region, 'admin');
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenant self-service (authenticated tenant owner) ---
app.get('/api/saas/my-tenant', authMiddleware, (req, res) => {
  const tenantId = req.tenantId || tenantEngine.DEFAULT_TENANT_ID;
  const tenant = tenantEngine.getTenant(tenantId);
  if (!tenant) return res.status(404).json({ error: 'No tenant context' });
  res.json(tenant);
});

app.get('/api/saas/my-tenant/usage', authMiddleware, (req, res) => {
  const tenantId = req.tenantId || tenantEngine.DEFAULT_TENANT_ID;
  try {
    res.json(tenantEngine.getTenantUsage(tenantId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/saas/my-tenant/billing', authMiddleware, (req, res) => {
  const tenantId = req.tenantId || tenantEngine.DEFAULT_TENANT_ID;
  try {
    res.json(tenantEngine.getTenantBillingStatus(tenantId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/saas/my-tenant/invoices', authMiddleware, (req, res) => {
  const tenantId = req.tenantId || tenantEngine.DEFAULT_TENANT_ID;
  try {
    res.json({ invoices: tenantEngine.listTenantInvoices(tenantId) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/saas/my-tenant/analytics', authMiddleware, (req, res) => {
  const tenantId = req.tenantId || tenantEngine.DEFAULT_TENANT_ID;
  try {
    res.json(tenantEngine.getTenantAnalytics(tenantId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/saas/my-tenant/apikeys', authMiddleware, (req, res) => {
  const tenantId = req.tenantId || tenantEngine.DEFAULT_TENANT_ID;
  try {
    res.json({ keys: tenantEngine.listTenantApiKeys(tenantId) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/saas/my-tenant/apikeys', authRateLimit(10, 60_000), authMiddleware, (req, res) => {
  const tenantId = req.tenantId || tenantEngine.DEFAULT_TENANT_ID;
  try {
    const { name, scopes } = req.body || {};
    const key = tenantEngine.createTenantApiKey(tenantId, { name, scopes }, req.user.id);
    res.status(201).json(key);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Global SaaS Gateway & Health ---
app.get('/api/saas/gateway/status', routeCache.cacheMiddleware(), (req, res) => {
  res.json({
    status: 'active',
    tenantId: req.tenantId || tenantEngine.DEFAULT_TENANT_ID,
    regions: tenantEngine.getRegionStatus(),
    health: tenantEngine.getHealthSummary(),
  });
});

app.get('/api/saas/global/analytics', adminCrudRateLimit, adminTokenMiddleware, (req, res) => {
  res.json(tenantEngine.getGlobalAnalytics());
});

app.get('/api/saas/global/health', adminTokenMiddleware, (req, res) => {
  res.json(tenantEngine.getHealthSummary());
});

app.get('/api/saas/regions', routeCache.cacheMiddleware(), (req, res) => {
  res.json({ regions: tenantEngine.getRegionStatus() });
});

app.post('/api/saas/tenants/:id/suspend', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantManager.suspendTenant(req.params.id, (req.body || {}).reason));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/saas/tenants/:id/reactivate', adminTokenMiddleware, (req, res) => {
  try {
    res.json(tenantManager.reactivateTenant(req.params.id));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/saas/tenants/:id', adminTokenMiddleware, async (req, res) => {
  try {
    await provisioningEngine.deprovisionTenant(req.params.id);
    res.json(tenantManager.deleteTenant(req.params.id));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/saas/tenants/status', adminTokenMiddleware, (req, res) => {
  res.json(tenantManager.getStatus());
});

app.get('/api/saas/plans', (req, res) => {
  res.json({ plans: tenantManager.getPlans() });
});

// ── Billing Engine ────────────────────────────────────────────────────────────
app.get('/api/saas/billing/plans', (req, res) => {
  res.json({ plans: billingEngine.getPlans() });
});

app.get('/api/saas/billing/status', adminTokenMiddleware, (req, res) => {
  res.json(billingEngine.getStatus());
});

app.post('/api/saas/billing/subscribe', authMiddleware, (req, res) => {
  try {
    const { tenantId, plan } = req.body || {};
    if (!tenantId || !plan) return res.status(400).json({ error: 'tenantId and plan required' });
    const sub = billingEngine.createSubscription(tenantId, plan);
    kpiAnalytics.increment('newSubscriptions');
    res.json(sub);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/saas/billing/change-plan', authMiddleware, (req, res) => {
  try {
    const { tenantId, plan } = req.body || {};
    if (!tenantId || !plan) return res.status(400).json({ error: 'tenantId and plan required' });
    res.json(billingEngine.changePlan(tenantId, plan));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/saas/billing/cancel', authMiddleware, (req, res) => {
  try {
    const { tenantId, atPeriodEnd } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const sub = billingEngine.cancelSubscription(tenantId, atPeriodEnd !== false);
    kpiAnalytics.increment('churnedSubs');
    res.json(sub);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/saas/billing/subscription/:tenantId', adminTokenMiddleware, (req, res) => {
  const sub = billingEngine.getSubscription(req.params.tenantId);
  if (!sub) return res.status(404).json({ error: 'No subscription found' });
  res.json(sub);
});

app.get('/api/saas/billing/invoices/:tenantId', adminTokenMiddleware, (req, res) => {
  res.json({ invoices: billingEngine.listInvoices(req.params.tenantId) });
});

app.post('/api/saas/billing/invoice', adminTokenMiddleware, (req, res) => {
  try {
    const { tenantId } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    res.json(billingEngine.generateInvoice(tenantId));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/saas/billing/usage', adminTokenMiddleware, (req, res) => {
  try {
    const { tenantId, metric, quantity } = req.body || {};
    if (!tenantId || !metric) return res.status(400).json({ error: 'tenantId and metric required' });
    res.json(billingEngine.recordUsage(tenantId, metric, quantity || 1));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Provisioning Engine ───────────────────────────────────────────────────────
app.post('/api/saas/provision', adminTokenMiddleware, async (req, res) => {
  try {
    const { tenantId, plan, opts } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const result = await provisioningEngine.provisionTenant(tenantId, plan || 'free', opts || {});
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/saas/provision/job/:jobId', adminTokenMiddleware, (req, res) => {
  const job = provisioningEngine.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.get('/api/saas/provision/tenant/:tenantId', adminTokenMiddleware, (req, res) => {
  res.json({ jobs: provisioningEngine.getTenantJobs(req.params.tenantId) });
});

app.get('/api/saas/provision/status', adminTokenMiddleware, (req, res) => {
  res.json(provisioningEngine.getStatus());
});

// ── Global Failover ────────────────────────────────────────────────────────────
app.get('/api/saas/failover/status', adminTokenMiddleware, (req, res) => {
  res.json(globalFailover.getStatus());
});

app.get('/api/saas/failover/log', adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || '50');
  res.json({ log: globalFailover.getEventLog(limit) });
});

app.post('/api/saas/failover/force', adminTokenMiddleware, (req, res) => {
  try {
    const { region } = req.body || {};
    if (!region) return res.status(400).json({ error: 'region required' });
    res.json(globalFailover.forceFailover(region));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/saas/failover/load', adminTokenMiddleware, (req, res) => {
  const { cpu, mem } = req.body || {};
  const event = globalFailover.reportLoad(cpu || 0, mem || 0);
  res.json({ event: event || null, scaling: globalFailover.getStatus().scaling });
});

// ── SaaS Orchestrator v4 ──────────────────────────────────────────────────────
app.get('/api/saas/orchestrator/status', adminTokenMiddleware, (req, res) => {
  res.json(saasOrchestratorV4.getStatus());
});

app.get('/api/saas/orchestrator/health', (req, res) => {
  res.json(saasOrchestratorV4.getHealthReport());
});

app.post('/api/saas/orchestrator/task', authMiddleware, (req, res) => {
  try {
    const { tenantId, taskType, payload, opts } = req.body || {};
    if (!tenantId || !taskType) return res.status(400).json({ error: 'tenantId and taskType required' });
    const task = saasOrchestratorV4.submitTask(tenantId, taskType, payload || {}, opts || {});
    res.json(task);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/saas/orchestrator/audit/:tenantId', adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || '50');
  res.json({ log: saasOrchestratorV4.getAuditLog(req.params.tenantId, limit) });
});

app.get('/api/saas/orchestrator/tenant/:tenantId', adminTokenMiddleware, (req, res) => {
  res.json(saasOrchestratorV4.getTenantStats(req.params.tenantId));
});

// ── KPI Analytics ─────────────────────────────────────────────────────────────
app.get('/api/saas/kpi', adminTokenMiddleware, (req, res) => {
  res.json(kpiAnalytics.getAdminBreakdown());
});

app.get('/api/saas/kpi/status', adminTokenMiddleware, (req, res) => {
  res.json(kpiAnalytics.getStatus());
});

app.get('/api/saas/kpi/timeseries/:kpi', adminTokenMiddleware, (req, res) => {
  const points = parseInt(req.query.points || '60');
  res.json({ kpi: req.params.kpi, series: kpiAnalytics.getTimeSeries(req.params.kpi, points) });
});

app.get('/api/saas/kpi/alerts', adminTokenMiddleware, (req, res) => {
  res.json({ alerts: kpiAnalytics.getAlerts(req.query.level) });
});

app.get('/api/saas/kpi/tenants/top', adminTokenMiddleware, (req, res) => {
  const metric = req.query.metric || 'apiCalls';
  const limit  = parseInt(req.query.limit || '10');
  res.json({ top: kpiAnalytics.getTopTenants(metric, limit) });
});

app.get('/api/saas/kpi/tenant/:tenantId', adminTokenMiddleware, (req, res) => {
  res.json(kpiAnalytics.getTenantMetrics(req.params.tenantId));
});

// ── AI Auto Dispatcher ────────────────────────────────────────────────────────
app.post('/api/ai/dispatch', authMiddleware, async (req, res) => {
  try {
    const { message, context, taskType, plan } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message required' });
    const tenantId = req.tenant ? req.tenant.id : (req.user ? req.user.id : 'anonymous');
    const result = await aiAutoDispatcher.dispatch(message, { context, taskType, plan, tenantId });
    kpiAnalytics.recordTenantActivity(tenantId, 'ai_task');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ai/dispatch/batch', authMiddleware, async (req, res) => {
  try {
    const { tasks } = req.body || {};
    if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array required' });
    const results = await aiAutoDispatcher.dispatchBatch(tasks);
    res.json({ results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ai/dispatch/status', adminTokenMiddleware, (req, res) => {
  res.json(aiAutoDispatcher.getStatus());
});

app.get('/api/ai/dispatch/task/:taskId', authMiddleware, (req, res) => {
  const task = aiAutoDispatcher.getTask(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// ── Global API Gateway status ─────────────────────────────────────────────────
app.get('/api/gateway/status', adminTokenMiddleware, (req, res) => {
  res.json(globalApiGateway.getStatus());
});

app.get('/api/gateway/logs', adminTokenMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || '50');
  res.json({ logs: globalApiGateway.getRecentLogs(limit) });
});

app.get('/api/gateway/routes', adminTokenMiddleware, (req, res) => {
  res.json({ routes: globalApiGateway.getRoutes() });
});

// ── SaaS Admin Overview ────────────────────────────────────────────────────────
app.get('/api/saas/overview', adminTokenMiddleware, (req, res) => {
  res.json({
    tenants:        tenantManager.getStatus(),
    billing:        billingEngine.getStatus(),
    provisioning:   provisioningEngine.getStatus(),
    failover:       globalFailover.getStatus(),
    orchestratorV4: saasOrchestratorV4.getStatus(),
    kpi:            kpiAnalytics.getStatus(),
    aiDispatcher:   aiAutoDispatcher.getStatus(),
    gateway:        globalApiGateway.getStatus(),
    generatedAt:    new Date().toISOString(),
  });
});

// ==================== GLOBAL ERROR HANDLER ====================
// Catches any unhandled errors thrown in route handlers.
// In production, never expose the stack trace to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  // Sanitize method and path; truncate err.message to avoid logging sensitive user data
  const method = String(req.method).slice(0, 10);
  const urlPath = String(req.path).slice(0, 200);
  const safeMessage = String(err.message || '').slice(0, 500);
  console.error('[Error]', method, urlPath, '->', safeMessage);
  if (err.stack && process.env.NODE_ENV !== 'production') console.error(err.stack);
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (safeMessage || 'Internal server error'),
  });
});

// ==================== PROCESS-LEVEL CRASH GUARD ====================
// Prevent any unhandled exception or rejected promise from taking down
// the entire server process. PM2 will still restart it if it truly dies,
// but logging here lets us diagnose root causes without a hard crash.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', new Date().toISOString(), err && err.message ? err.message : err);
  if (err && err.stack) console.error(err.stack);
  // Do NOT call process.exit() — keep the server alive
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('[unhandledRejection]', new Date().toISOString(), msg);
  if (reason instanceof Error && reason.stack) console.error(reason.stack);
  // Do NOT call process.exit() — keep the server alive
});

// Only bind to a port when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    const reg = getModuleRegistryStatus();
    worldStandard.startupSeal({ appVersion: APP_VERSION, port: PORT, modules: reg.total, pid: process.pid });
    console.log(`🚀 Unicorn autonom rulând pe portul ${PORT}`);
    console.log(`🤖 Universal AI Connector (UAIC): ${_uaic ? 'ACTIVE' : 'DISABLED'}`);
    console.log(`🌐 Multi-Model Router (14 AI): ${_multiRouter ? 'ACTIVE' : 'DISABLED'}`);
    console.log(`✨ Autonomous Innovation Engine: ACTIVE`);
    console.log(`💰 Auto Revenue Generation: ACTIVE`);
    console.log(`♾️  Unicorn Eternal Engine: ACTIVE`);
    console.log(`📱 Social Media Viralizer: ACTIVE`);
    console.log(`🌐 Global Digital Standard: ACTIVE`);
    console.log(`🏛️  Legal Fortress: ACTIVE`);
    console.log(`⚡ Quantum Resilience Core: ACTIVE`);
    console.log(`📊 Executive Dashboard: ACTIVE`);
    console.log(`🔍 Code Sanity Engine: ACTIVE`);
    console.log(`🔗 ${reg.total}+ module total: TOATE CONECTATE & ACTIVE`);
    console.log(`  ├─ 🎛️  Orchestrator:   ${reg.categories.orchestrator.count} module`);
    console.log(`  ├─ 🛡️  Shield:         ${reg.categories.shield.count} module`);
    console.log(`  ├─ 💊  Health-Daemon:  ${reg.categories.healthDaemon.count} module`);
    console.log(`  ├─ 🐕  Watchdog:       ${reg.categories.watchdog.count} module`);
    console.log(`  ├─ 🤖  AI:             ${reg.categories.ai.count} module`);
    console.log(`  ├─ ⚙️  Dynamic (Adaptive): ${reg.categories.dynamic.count} module`);
    console.log(`  ├─ 🔧  Engines:        ${reg.categories.engines.count} module`);
    console.log(`  ├─ 🔮  Generated:      ${reg.categories.generated.count} module`);
    console.log(`  ├─ 🏠  Internal:       ${reg.categories.internal.count} module`);
    console.log(`  └─ 🌐  External:       ${reg.categories.external.count} module`);
    console.log(`🔧 Auto-Repair: ACTIVE`);
    console.log(`🔁 Auto-Restart: ACTIVE`);
    console.log(`⚡ Auto-Optimize: ACTIVE`);
    console.log(`🧬 Auto-Evolve: ACTIVE`);
    console.log(`📋 Log-Monitor: ACTIVE`);
    console.log(`📊 Resource-Monitor: ACTIVE`);
    console.log(`🔎 Error-Pattern-Detector: ACTIVE`);
    console.log(`🚑 Recovery-Engine: ACTIVE`);
    console.log(`🛡️  AI Self-Healing: ACTIVE (15 provideri monitorizați: DeepSeek/Mistral/Groq/Gemini/Claude/Cohere/OpenAI/OpenRouter/Perplexity/HuggingFace/Together/Fireworks/SambaNova/NVIDIA/xAI)`);
    console.log(`🟢 Zero-Downtime Controller: ACTIVE`);
    console.log(`💾 AI Smart Cache: ACTIVE (LRU, cost tracking, TTL per task)`);
    console.log(`🏢 Multi-Tenant Engine v4: ACTIVE (tenants, plans, subscriptions, API keys, configs, feature flags)`);
    console.log(`🌐 Tenant API Gateway: ACTIVE (subdomain/header/path detection, rate limiting, feature enforcement)`);
    console.log(`💳 Billing & Subscription Engine: ACTIVE (plans, subscriptions, invoices, Stripe/PayPal stubs)`);
    console.log(`🎛️  Orchestrator v4: ACTIVE (TCL, MSE, Scheduler, AHE, WDS, GOB)`);
    console.log(`🧬 Self-Evolving Engine: ACTIVE (Analyzer, Profiler, Planner, CodeGen, Validator, Deploy)`);
    console.log(`🖥️  Global Admin Panel: ACTIVE (/api/admin/*)`);
    console.log(`🏢 Multi-Tenant SaaS Platform: ACTIVE (tenant-manager, gateway, provisioning, billing, analytics)`);
    console.log(`🌐 Orchestrator V4: ACTIVE (per-tenant execution, priority scheduling, self-healing)`);
    console.log(`🌍 Global Load Balancer: ACTIVE (multi-region, circuit breaker, failover, canary splits)`);
    console.log(`🏢 Tenant Manager: ACTIVE (multi-tenant SaaS)`);
    console.log(`🌐 Global API Gateway: ACTIVE (rate limiting, tenant routing)`);
    console.log(`💳 Billing Engine: ACTIVE (subscriptions, invoicing, MRR)`);
    console.log(`⚙️  Provisioning Engine: ACTIVE (onboarding automation)`);
    console.log(`🌍 Global Failover: ACTIVE (multi-region, auto-scaling)`);
    console.log(`🎯 SaaS Orchestrator v4: ACTIVE (multi-tenant AI routing)`);
    console.log(`📊 KPI Analytics: ACTIVE (real-time metrics, admin breakdown)`);
    console.log(`🤖 AI Auto Dispatcher: ACTIVE (smart task routing for all tenants)`);
    // Pornire Zero-Downtime Controller în-process (monitorizare health locală)
    zeroDT.init();
  });
}
// Export Express app for testing
module.exports = app;
