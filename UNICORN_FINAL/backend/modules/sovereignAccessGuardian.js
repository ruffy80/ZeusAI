// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.208Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.291Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.154Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.804Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.992Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// sovereignAccessGuardian.js – Exclusive authentication: password + 2FA + optional biometrics
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// In-memory TOTP and biometric store (extend with DB in production)
const totpSecrets = new Map();   // userId → base32 secret
const biometricHashes = new Map(); // userId → hash of biometric template
const activeSessions = new Map();  // sessionToken → { userId, role, expiresAt }
const failedAttempts = new Map();  // userId → { count, lastAttempt }

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function isLockedOut(userId) {
  const rec = failedAttempts.get(userId);
  if (!rec) return false;
  if (rec.count >= MAX_FAILURES) {
    const timeSince = Date.now() - rec.lastAttempt;
    if (timeSince < LOCKOUT_MS) return true;
    // Reset after lockout period
    failedAttempts.delete(userId);
  }
  return false;
}

function recordFailure(userId) {
  const rec = failedAttempts.get(userId) || { count: 0, lastAttempt: 0 };
  rec.count++;
  rec.lastAttempt = Date.now();
  failedAttempts.set(userId, rec);
}

function clearFailures(userId) {
  failedAttempts.delete(userId);
}

// Simple TOTP implementation (compatible with Google Authenticator via base32 secret)
function generateTOTPSecret() {
  return crypto.randomBytes(20).toString('base64').replace(/[^A-Z2-7]/gi, 'A').toUpperCase().slice(0, 32);
}

function getHOTP(secret, counter) {
  const key = Buffer.from(secret, 'ascii');
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 |
    (hmac[offset + 1] & 0xff) << 16 |
    (hmac[offset + 2] & 0xff) << 8 |
    (hmac[offset + 3] & 0xff)) % 1000000;
  return String(code).padStart(6, '0');
}

function verifyTOTP(secret, token) {
  const time = Math.floor(Date.now() / 30000);
  // Check current window and ±1 for clock skew
  for (let delta = -1; delta <= 1; delta++) {
    if (getHOTP(secret, time + delta) === String(token).padStart(6, '0')) return true;
  }
  return false;
}

function setupTOTP(userId) {
  const secret = generateTOTPSecret();
  totpSecrets.set(userId, secret);
  return { secret, otpAuthUrl: `otpauth://totp/ZeusAI:${userId}?secret=${secret}&issuer=ZeusAI` };
}

function enableBiometric(userId, biometricTemplate) {
  const hash = crypto.createHash('sha256').update(biometricTemplate).digest('hex');
  biometricHashes.set(userId, hash);
  return { ok: true, enrolled: true };
}

function verifyBiometric(userId, biometricTemplate) {
  const stored = biometricHashes.get(userId);
  if (!stored) return false;
  const hash = crypto.createHash('sha256').update(biometricTemplate).digest('hex');
  return stored === hash;
}

async function authenticate({ userId, password, passwordHash, totpToken, biometricTemplate }) {
  if (isLockedOut(userId)) {
    return { ok: false, error: 'Account locked. Try again in 15 minutes.', locked: true };
  }

  // Step 1: Password verification
  let passwordOk = false;
  if (passwordHash && password) {
    passwordOk = await bcrypt.compare(password, passwordHash);
  } else if (password) {
    // Legacy plain check (should not be used in production)
    passwordOk = password === process.env.ADMIN_MASTER_PASSWORD;
  }

  if (!passwordOk) {
    recordFailure(userId);
    return { ok: false, error: 'Invalid credentials', step: 'password' };
  }

  // Step 2: 2FA (TOTP)
  const secret = totpSecrets.get(userId);
  if (secret) {
    if (!totpToken || !verifyTOTP(secret, totpToken)) {
      recordFailure(userId);
      return { ok: false, error: 'Invalid 2FA code', step: '2fa' };
    }
  }

  // Step 3: Biometric (optional)
  if (biometricTemplate && biometricHashes.has(userId)) {
    if (!verifyBiometric(userId, biometricTemplate)) {
      recordFailure(userId);
      return { ok: false, error: 'Biometric verification failed', step: 'biometric' };
    }
  }

  // All steps passed
  clearFailures(userId);
  const sessionToken = crypto.randomBytes(32).toString('hex');
  activeSessions.set(sessionToken, {
    userId,
    role: 'admin',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  return { ok: true, sessionToken, expiresIn: SESSION_TTL_MS };
}

function verifySession(sessionToken) {
  const session = activeSessions.get(sessionToken);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    activeSessions.delete(sessionToken);
    return null;
  }
  return session;
}

function revokeSession(sessionToken) {
  activeSessions.delete(sessionToken);
}

function getStatus() {
  return {
    activeSessions: activeSessions.size,
    lockedAccounts: Array.from(failedAttempts.entries())
      .filter(([, r]) => r.count >= MAX_FAILURES).length,
    totpEnabledAccounts: totpSecrets.size,
    biometricEnabledAccounts: biometricHashes.size,
  };
}

module.exports = {
  authenticate,
  verifySession,
  revokeSession,
  setupTOTP,
  enableBiometric,
  verifyBiometric,
  verifyTOTP,
  getStatus,
};
