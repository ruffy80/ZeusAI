'use strict';
/**
 * oob-deploy.js — GitHub-independent Out-of-Band (OOB) deploy channel.
 * ---------------------------------------------------------------------------
 * WHY: production normally deploys via GitHub Actions. When the GitHub account
 * is billing-locked (Actions refuse to start) AND the on-server poller is
 * stuck (kill-switch set, timer dead, or the live checkout diverged from main
 * so the forward-only guard refuses), main can advance but the box never
 * updates. This channel is a *signed*, *canary-gated* HTTP trigger that lets a
 * trusted operator (or a Cursor Cloud agent) tell the running backend to build
 * and promote an exact git ref — reusing the same atomic, canary+smoke-gated
 * `deploy-atomic-forward.sh` that Actions and the poller use.
 *
 * SECURITY (defense in depth):
 *   - Disabled unless a secret/pubkey is configured (fail-closed).
 *   - Two independent auth mechanisms, either sufficient:
 *       * HMAC-SHA256 over the raw request body with ZEUS_OOB_DEPLOY_SECRET
 *         (header:  X-Zeus-Deploy-Signature: sha256=<hex>)
 *       * Ed25519 signature over the raw request body verified against a
 *         trusted public key (ZEUS_OOB_DEPLOY_ED25519_PUB or a key listed in
 *         .deploy/oob-trusted-keys.txt)
 *         (header:  X-Zeus-Deploy-Signature: ed25519=<base64>)
 *   - Constant-time comparison (crypto.timingSafeEqual) for the HMAC path.
 *   - Freshness window: body.ts must be within ±OOB_SKEW_SECONDS (default 300s).
 *   - Replay protection: body.nonce must be unused (bounded, self-pruning cache
 *     persisted best-effort under data/oob-deploy-nonces.json).
 *   - ref is sanitized to a safe git-ref charset; the runner never shells the
 *     ref unquoted.
 *   - The runner does the real work off the request thread and only promotes
 *     after the canary + smoke gates pass — a bad ref can never take the site
 *     down (the live symlink is untouched unless the canary is green).
 *
 * This module is intentionally free of Express-specific coupling in its core
 * (verifyRequest / recordNonce are pure) so it is unit-testable without a
 * server. `register(app, deps)` wires the two routes.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SKEW_SECONDS = Number(process.env.OOB_SKEW_SECONDS || 300);
const REPO_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const NONCE_FILE = path.join(DATA_DIR, 'oob-deploy-nonces.json');
const STATUS_FILE = path.join(DATA_DIR, 'oob-deploy-status.json');
const RUNNER = path.join(REPO_ROOT, 'scripts', 'oob-deploy-runner.sh');
const LOG_FILE = process.env.OOB_DEPLOY_LOG || '/var/log/zeus-oob-deploy.log';
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/\-]{0,199}$/;
const NONCE_TTL_MS = 24 * 60 * 60 * 1000; // keep nonces for a day (>> skew window)
const MAX_NONCES = 5000;

// ── nonce cache (in-memory + best-effort file persistence) ──────────────────
let nonceCache = null; // Map<nonce, expiresAtMs>

function loadNonces() {
  if (nonceCache) return nonceCache;
  nonceCache = new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(NONCE_FILE, 'utf8'));
    const now = Date.now();
    for (const [n, exp] of Object.entries(raw || {})) {
      if (typeof exp === 'number' && exp > now) nonceCache.set(n, exp);
    }
  } catch (_) { /* first run / unreadable → empty */ }
  return nonceCache;
}

function persistNonces() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const obj = {};
    for (const [n, exp] of nonceCache.entries()) obj[n] = exp;
    fs.writeFileSync(NONCE_FILE, JSON.stringify(obj));
  } catch (_) { /* non-fatal: in-memory still protects this process */ }
}

function pruneNonces() {
  const now = Date.now();
  for (const [n, exp] of nonceCache.entries()) {
    if (exp <= now) nonceCache.delete(n);
  }
  // Hard cap to bound memory even under abuse: drop soonest-expiring first.
  if (nonceCache.size > MAX_NONCES) {
    const sorted = [...nonceCache.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < sorted.length - MAX_NONCES; i++) nonceCache.delete(sorted[i][0]);
  }
}

function nonceSeen(nonce) {
  loadNonces();
  pruneNonces();
  return nonceCache.has(nonce);
}

function recordNonce(nonce, ttlMs = NONCE_TTL_MS) {
  loadNonces();
  nonceCache.set(String(nonce), Date.now() + ttlMs);
  pruneNonces();
  persistNonces();
}

// ── trusted key material ────────────────────────────────────────────────────
function getHmacSecret() {
  return (
    process.env.ZEUS_OOB_DEPLOY_SECRET ||
    process.env.OOB_DEPLOY_SECRET ||
    ''
  );
}

function getTrustedEd25519Keys() {
  const keys = [];
  const inline = process.env.ZEUS_OOB_DEPLOY_ED25519_PUB || process.env.OOB_DEPLOY_ED25519_PUB || '';
  if (inline.trim()) keys.push(inline.trim());
  const fileCandidates = [
    path.join(REPO_ROOT, '.deploy', 'oob-trusted-keys.txt'),
    path.join(REPO_ROOT, '..', '.deploy', 'oob-trusted-keys.txt'),
  ];
  for (const f of fileCandidates) {
    try {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t && !t.startsWith('#')) keys.push(t);
      }
    } catch (_) { /* optional */ }
  }
  return keys;
}

function isEnabled() {
  return Boolean(getHmacSecret()) || getTrustedEd25519Keys().length > 0;
}

// Accept an Ed25519 public key given either as an OpenSSH one-liner
// ("ssh-ed25519 AAAA... comment") or as a PEM SPKI block, and return a
// crypto.KeyObject or null.
function parseEd25519PublicKey(entry) {
  const s = String(entry || '').trim();
  if (!s) return null;
  try {
    if (s.startsWith('-----BEGIN')) {
      return crypto.createPublicKey(s);
    }
    if (s.startsWith('ssh-ed25519')) {
      // Build SPKI from the raw 32-byte key embedded in the OpenSSH blob.
      const b64 = s.split(/\s+/)[1];
      const blob = Buffer.from(b64, 'base64');
      // OpenSSH wire: uint32 len | "ssh-ed25519" | uint32 len | 32-byte key
      let off = 0;
      const readStr = () => {
        const len = blob.readUInt32BE(off); off += 4;
        const out = blob.slice(off, off + len); off += len;
        return out;
      };
      const type = readStr().toString();
      if (type !== 'ssh-ed25519') return null;
      const raw = readStr();
      if (raw.length !== 32) return null;
      const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
      const der = Buffer.concat([spkiPrefix, raw]);
      return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    }
  } catch (_) { /* fallthrough */ }
  return null;
}

// ── core verification (pure) ────────────────────────────────────────────────
// rawBody: Buffer|string of the exact request body bytes.
// signatureHeader: value of X-Zeus-Deploy-Signature.
// nowMs: injectable clock for tests.
// Returns { ok, status, error, payload }.
function verifyRequest(rawBody, signatureHeader, nowMs = Date.now(), opts = {}) {
  const hmacSecret = opts.hmacSecret !== undefined ? opts.hmacSecret : getHmacSecret();
  const ed25519Keys = opts.ed25519Keys !== undefined ? opts.ed25519Keys : getTrustedEd25519Keys();
  if (!hmacSecret && (!ed25519Keys || ed25519Keys.length === 0)) {
    return { ok: false, status: 503, error: 'oob_deploy_disabled' };
  }
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  if (body.length === 0) return { ok: false, status: 400, error: 'empty_body' };
  if (body.length > 8192) return { ok: false, status: 413, error: 'body_too_large' };

  const sig = String(signatureHeader || '').trim();
  if (!sig) return { ok: false, status: 401, error: 'missing_signature' };

  // Parse payload up-front (needed for ts/nonce/ref regardless of scheme).
  let payload;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch (_) {
    return { ok: false, status: 400, error: 'invalid_json' };
  }

  // Verify signature.
  let sigOk = false;
  if (sig.startsWith('sha256=') && hmacSecret) {
    const provided = sig.slice('sha256='.length).trim().toLowerCase();
    const expected = crypto.createHmac('sha256', hmacSecret).update(body).digest('hex');
    const a = Buffer.from(provided, 'hex');
    const b = Buffer.from(expected, 'hex');
    sigOk = a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  } else if (sig.startsWith('ed25519=') && ed25519Keys && ed25519Keys.length) {
    let sigBuf;
    try { sigBuf = Buffer.from(sig.slice('ed25519='.length).trim(), 'base64'); } catch (_) { sigBuf = null; }
    if (sigBuf && sigBuf.length === 64) {
      for (const entry of ed25519Keys) {
        const keyObj = parseEd25519PublicKey(entry);
        if (!keyObj) continue;
        try {
          if (crypto.verify(null, body, keyObj, sigBuf)) { sigOk = true; break; }
        } catch (_) { /* try next key */ }
      }
    }
  } else {
    return { ok: false, status: 401, error: 'unsupported_signature_scheme' };
  }
  if (!sigOk) return { ok: false, status: 401, error: 'bad_signature' };

  // Freshness.
  const ts = Number(payload.ts);
  if (!Number.isFinite(ts)) return { ok: false, status: 400, error: 'missing_ts' };
  const skewMs = SKEW_SECONDS * 1000;
  if (Math.abs(nowMs - ts) > skewMs) return { ok: false, status: 401, error: 'stale_or_future_ts' };

  // Nonce presence (replay check happens in the route, against the store).
  const nonce = payload.nonce;
  if (!nonce || typeof nonce !== 'string' || nonce.length < 8 || nonce.length > 128) {
    return { ok: false, status: 400, error: 'missing_or_bad_nonce' };
  }

  // Ref sanitization.
  const ref = payload.ref || 'origin/main';
  if (!REF_RE.test(ref) || ref.includes('..')) {
    return { ok: false, status: 400, error: 'invalid_ref' };
  }

  return { ok: true, status: 200, payload: { ref, ts, nonce, meta: payload.meta || null } };
}

// ── deploy status persistence ───────────────────────────────────────────────
function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); }
  catch (_) { return { lastDeploy: null }; }
}

function writeStatus(obj) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(obj, null, 2));
  } catch (_) { /* non-fatal */ }
}

// ── runner launch ───────────────────────────────────────────────────────────
function launchDeploy(ref, deployId) {
  const status = readStatus();
  status.lastDeploy = {
    deployId,
    ref,
    state: 'running',
    startedAt: new Date().toISOString(),
    log: LOG_FILE,
  };
  writeStatus(status);

  let out;
  try { out = fs.openSync(LOG_FILE, 'a'); } catch (_) { out = 'ignore'; }
  const child = spawn('bash', [RUNNER, ref], {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, OOB_DEPLOY_ID: deployId, HOME: process.env.HOME || '/root', PM2_HOME: process.env.PM2_HOME || '/root/.pm2' },
  });
  child.on('error', (err) => {
    const s = readStatus();
    if (s.lastDeploy && s.lastDeploy.deployId === deployId) {
      s.lastDeploy.state = 'error';
      s.lastDeploy.error = err.message;
      s.lastDeploy.finishedAt = new Date().toISOString();
      writeStatus(s);
    }
  });
  child.on('exit', (code) => {
    const s = readStatus();
    if (s.lastDeploy && s.lastDeploy.deployId === deployId) {
      s.lastDeploy.state = code === 0 ? 'succeeded' : 'failed';
      s.lastDeploy.exitCode = code;
      s.lastDeploy.finishedAt = new Date().toISOString();
      writeStatus(s);
    }
  });
  child.unref();
  return child;
}

// ── express wiring ──────────────────────────────────────────────────────────
function register(app, deps = {}) {
  const express = deps.express || require('express');
  const rawParser = express.raw({ type: () => true, limit: '16kb' });

  app.get('/api/oob-deploy/status', (req, res) => {
    res.json({
      enabled: isEnabled(),
      mechanisms: {
        hmac: Boolean(getHmacSecret()),
        ed25519: getTrustedEd25519Keys().length > 0,
      },
      skewSeconds: SKEW_SECONDS,
      runner: RUNNER,
      ...readStatus(),
    });
  });

  app.post('/api/oob-deploy', rawParser, (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');
    const result = verifyRequest(raw, req.headers['x-zeus-deploy-signature'], Date.now());
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }
    if (nonceSeen(result.payload.nonce)) {
      return res.status(409).json({ ok: false, error: 'nonce_replayed' });
    }
    recordNonce(result.payload.nonce);

    const deployId = crypto.randomBytes(8).toString('hex');
    try {
      launchDeploy(result.payload.ref, deployId);
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'launch_failed', detail: err.message });
    }
    console.log(`[oob-deploy] accepted ref=${result.payload.ref} deployId=${deployId}`);
    return res.status(202).json({
      ok: true,
      deployId,
      ref: result.payload.ref,
      message: 'OOB deploy accepted; canary+smoke gated. Poll /api/oob-deploy/status.',
      statusUrl: '/api/oob-deploy/status',
    });
  });

  return app;
}

module.exports = {
  register,
  verifyRequest,
  isEnabled,
  parseEd25519PublicKey,
  nonceSeen,
  recordNonce,
  getHmacSecret,
  getTrustedEd25519Keys,
  readStatus,
  _paths: { NONCE_FILE, STATUS_FILE, RUNNER, LOG_FILE },
};
