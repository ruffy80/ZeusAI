'use strict';

/**
 * brand-spectrum-os.js — Chromatic Identity Continuum (CIC/1.0)
 * ============================================================
 * World-standard invention sites still lack: a cryptographically anchored
 * brand chromatics + letterform genome that survives redesigns for 40+ years.
 *
 * Why it matters:
 *   Visual identity is usually CSS folklore — spoofable, unversioned, unsigned.
 *   CIC publishes a forever Brand Spectrum bound to the site forever-key so
 *   agents, archives, and browsers can verify "this is the real ZeusAI look"
 *   through 2066 and beyond.
 *
 * Hard safety:
 *   - Read-only attestation — no mutators, no PM2, no payment rails
 *   - Additive public discovery only
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'CIC/1.0';
const NAME = 'brand-spectrum-os';
const HORIZON_YEAR = 2066;

/** Volt Aurora — vibrant site-name continuum (not purple-default AI kitsch). */
const SPECTRUM = Object.freeze({
  id: 'volt-aurora',
  name: 'Volt Aurora',
  wordmark: {
    zeus: ['#FF3B5C', '#FF9F1C', '#FFEE32', '#FF6B35'],
    ai: ['#00E8A0', '#2DE2E6', '#E8FFF8', '#7CF7C0'],
    bolt: ['#FFFFFF', '#7CF7C0', '#00E8A0', '#2DE2E6'],
  },
  frame: ['#FF3B5C', '#FF9F1C', '#FFEE32', '#00E8A0', '#2DE2E6', '#FF3B5C'],
  cssVars: {
    '--cic-zeus-a': '#FF3B5C',
    '--cic-zeus-b': '#FF9F1C',
    '--cic-zeus-c': '#FFEE32',
    '--cic-zeus-d': '#FF6B35',
    '--cic-ai-a': '#00E8A0',
    '--cic-ai-b': '#2DE2E6',
    '--cic-ai-c': '#E8FFF8',
    '--cic-ai-d': '#7CF7C0',
    '--cic-bolt': '#00E8A0',
    '--cic-frame-glow': 'rgba(255,159,28,.48)',
  },
});

const LETTERFORM = Object.freeze({
  id: 'blade-condensed-v1',
  genome: 'geometric-condensed-blade',
  family: '"Segoe UI Variable Display","Avenir Next Condensed","Futura","Century Gothic",system-ui,sans-serif',
  weight: 800,
  trackingEm: -0.038,
  stretch: 'condensed',
  optical: {
    skewZeusDeg: -2.2,
    skewAiDeg: 1.6,
    bladeCut: true,
  },
  features: '"kern" 1, "liga" 1',
});

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function gradeFor(score) {
  if (score >= 92) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function loadSignKey() {
  if (global.__SITE_SIGN_KEY__) return global.__SITE_SIGN_KEY__;
  const candidates = [
    process.env.SITE_SIGN_KEY_PATH,
    '/var/www/unicorn/shared/site-sign.pem',
    path.join(__dirname, '..', '..', 'data', 'site-sign.pem'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) {
        const pem = fs.readFileSync(p, 'utf8');
        const key = crypto.createPrivateKey(pem);
        global.__SITE_SIGN_KEY__ = key;
        return key;
      }
    } catch (_) { /* continue */ }
  }
  if (process.env.SITE_SIGN_KEY) {
    try {
      const key = crypto.createPrivateKey(process.env.SITE_SIGN_KEY);
      global.__SITE_SIGN_KEY__ = key;
      return key;
    } catch (_) { /* fall through */ }
  }
  return null;
}

function keyFingerprint(key) {
  try {
    const pubDer = crypto.createPublicKey(key).export({ format: 'der', type: 'spki' });
    return crypto.createHash('sha256').update(pubDer).digest('hex').slice(0, 16);
  } catch (_) {
    return null;
  }
}

function continuumPayload() {
  const key = loadSignKey();
  const kid = key ? keyFingerprint(key) : null;
  const continuum = {
    protocol: PROTOCOL,
    invention: NAME,
    brand: 'ZeusAI',
    spectrum: SPECTRUM,
    letterform: LETTERFORM,
    mark: {
      role: 'zeus-bust-left-of-wordmark',
      frame: 'aurora-conic-ring',
      targetPx: { desktop: 72, tablet: 58, phone: 50 },
      asset: '/assets/zeus/brand-176.jpg',
    },
    horizonYear: HORIZON_YEAR,
    durabilityYears: HORIZON_YEAR - new Date().getUTCFullYear(),
    foreverKey: {
      url: '/.well-known/zeusai-key.pub',
      kid,
      bound: !!kid,
    },
    discovery: {
      wellKnown: '/.well-known/brand-spectrum.json',
      api: '/api/brand/spectrum',
      score: '/api/brand/spectrum/score',
    },
    pledge: [
      'Brand spectrum tokens remain additive for 40+ years',
      'Breaking chromatic changes require a successor continuum id + 5y deprecation',
      'Letterform genome may evolve forward-only; spoof detection via kid binding',
      'Agents SHOULD verify continuum.signature against forever-key',
    ],
    generatedAt: new Date().toISOString(),
  };

  let signature = null;
  let alg = null;
  if (key) {
    try {
      const body = Buffer.from(JSON.stringify({
        protocol: continuum.protocol,
        brand: continuum.brand,
        spectrumId: continuum.spectrum.id,
        letterformId: continuum.letterform.id,
        horizonYear: continuum.horizonYear,
        kid: continuum.foreverKey.kid,
      }));
      signature = crypto.sign(null, body, key).toString('base64');
      alg = 'Ed25519';
    } catch (_) {
      signature = null;
    }
  }

  return { ...continuum, signature, alg, ok: true };
}

function getStatus() {
  const c = continuumPayload();
  const bound = !!(c.foreverKey && c.foreverKey.bound && c.signature);
  const horizonOk = c.horizonYear >= 2066;
  const spectrumOk = !!(c.spectrum && c.spectrum.id && c.spectrum.cssVars);
  const letterOk = !!(c.letterform && c.letterform.genome);
  let score = 40;
  if (spectrumOk) score += 20;
  if (letterOk) score += 15;
  if (horizonOk) score += 10;
  if (bound) score += 15;
  score = clamp(score, 0, 100);
  return {
    ok: spectrumOk && letterOk,
    protocol: PROTOCOL,
    module: NAME,
    invention: NAME,
    score,
    grade: gradeFor(score),
    continuumId: c.spectrum.id,
    letterformId: c.letterform.id,
    horizonYear: c.horizonYear,
    signed: !!c.signature,
    kid: c.foreverKey.kid,
    spectrum: c.spectrum,
    letterform: c.letterform,
    mark: c.mark,
    cssVars: c.spectrum.cssVars,
    discovery: c.discovery,
    pledge: c.pledge,
    signature: c.signature,
    alg: c.alg,
    foreverKey: c.foreverKey,
    generatedAt: c.generatedAt,
  };
}

function getScore() {
  const s = getStatus();
  return {
    ok: s.ok,
    protocol: PROTOCOL,
    score: s.score,
    grade: s.grade,
    continuumId: s.continuumId,
    horizonYear: s.horizonYear,
    signed: s.signed,
  };
}

function getWellKnown() {
  return continuumPayload();
}

module.exports = {
  PROTOCOL,
  NAME,
  HORIZON_YEAR,
  SPECTRUM,
  LETTERFORM,
  getStatus,
  getScore,
  getWellKnown,
  continuumPayload,
};
