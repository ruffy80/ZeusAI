'use strict';

/**
 * Merchant Trust Standard — MTS/1.0
 * ---------------------------------
 * World-standard signed envelope: "is this AI merchant safe to pay right now?"
 * Aggregates real armed rails, buyable catalog floor, bond/continuity pointers,
 * and checkout paths. Never invents GMV, uptime %, or payment rails.
 *
 * Discovery: GET /.well-known/merchant.json + GET /api/merchant/standard
 * Human desk: /standard
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'MTS/1.0';
const NAME = 'merchant-trust-standard';

function isoNow() {
  return new Date().toISOString();
}

function sha256(input) {
  return crypto.createHash('sha256')
    .update(typeof input === 'string' ? input : JSON.stringify(input))
    .digest('hex');
}

function loadSigning() {
  let cfg = null;
  let publicKeyInfoFn = null;
  try {
    const eop = require('./earth-outcome-protocol');
    if (eop && typeof eop.getSigningConfig === 'function') {
      cfg = eop.getSigningConfig();
      if (typeof eop.publicKeyInfo === 'function') publicKeyInfoFn = eop.publicKeyInfo;
    }
  } catch (_) { /* fall through */ }

  if (!cfg) {
    const candidates = [
      process.env.SITE_SIGN_PEM,
      process.env.SITE_SIGN_KEY,
      '/var/www/unicorn/shared/site-sign.pem',
    ].filter(Boolean);
    let pem = null;
    for (const p of candidates) {
      try {
        if (String(p).includes('BEGIN')) { pem = p; break; }
        if (fs.existsSync(p)) { pem = fs.readFileSync(p, 'utf8'); break; }
      } catch (_) { /* next */ }
    }
    if (global.__SITE_SIGN_KEY__) pem = global.__SITE_SIGN_KEY__;
    if (pem) {
      try {
        const privateKey = crypto.createPrivateKey(pem);
        const publicKey = crypto.createPublicKey(privateKey);
        const keyId = 'ed25519:' + sha256(publicKey.export({ type: 'spki', format: 'pem' })).slice(0, 16);
        cfg = { mode: 'ed25519', privateKey, publicKey, keyId, fallback: false };
      } catch (_) { /* hmac */ }
    }
  }

  if (cfg && cfg.mode === 'ed25519' && cfg.privateKey) {
    return {
      cfg,
      signBody: (body) => ({
        algorithm: 'ed25519',
        keyId: cfg.keyId,
        signature: crypto.sign(null, Buffer.from(body), cfg.privateKey).toString('base64'),
      }),
      publicKeyInfo: publicKeyInfoFn || (() => ({
        algorithm: 'ed25519',
        keyId: cfg.keyId,
        publicKeyPem: cfg.publicKey.export({ type: 'spki', format: 'pem' }),
      })),
    };
  }

  const secret = (cfg && cfg.secret)
    || process.env.MTS_HMAC_SECRET
    || process.env.JWT_SECRET
    || 'zeusai-mts-dev-fallback';
  const keyId = (cfg && cfg.keyId) || 'hmac:mts';
  return {
    cfg: { mode: 'hmac-sha256', secret, keyId, fallback: secret === 'zeusai-mts-dev-fallback' },
    signBody: (body) => ({
      algorithm: 'hmac-sha256',
      keyId,
      signature: crypto.createHmac('sha256', secret).update(body).digest('base64'),
    }),
    publicKeyInfo: publicKeyInfoFn || (() => ({ algorithm: 'hmac-sha256', keyId, publicKeyPem: null })),
  };
}

function _safe(fn, fallback) {
  try {
    const v = fn();
    return v == null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function _buyableFloor() {
  return _safe(() => {
    const buy = require('../../src/commerce/commerce-buyability');
    const unified = require('../../src/commerce/unified-catalog');
    const items = (unified.all && unified.all()) || [];
    const buyable = [];
    for (const item of items) {
      const a = buy.assessBuyability(item);
      if (a && a.buyable) {
        buyable.push({
          id: item.id,
          name: item.name || item.title || item.id,
          priceUsd: item.priceUsd != null ? item.priceUsd : item.price,
          mode: a.mode,
          ctaHref: a.ctaHref,
        });
      }
    }
    const btc = buyable.filter((b) => b.mode === 'btc');
    const reserve = buyable.filter((b) => b.mode === 'reserve');
    return {
      totalCatalog: items.length,
      buyableCount: buyable.length,
      btcSelfServeCount: btc.length,
      reserveCount: reserve.length,
      sample: buyable.slice(0, 8),
      floorOk: btc.length > 0,
    };
  }, {
    totalCatalog: 0,
    buyableCount: 0,
    btcSelfServeCount: 0,
    reserveCount: 0,
    sample: [],
    floorOk: false,
  });
}

function _rails() {
  return _safe(() => {
    const ark = require('./world-standard/armed-rails-continuum');
    const s = ark.getStatus();
    return {
      protocol: s.protocol || 'ARK/1.0',
      readinessScore: s.readinessScore,
      armedCount: s.armedCount,
      totalRails: s.totalRails,
      billionPathBlockedBy: s.billionPathBlockedBy || [],
      neverClaimsReadyWithoutKeys: !!(s.honesty && s.honesty.neverClaimsReadyWithoutKeys),
    };
  }, {
    protocol: 'ARK/1.0',
    readinessScore: null,
    armedCount: 0,
    totalRails: 0,
    billionPathBlockedBy: ['module_unavailable'],
    neverClaimsReadyWithoutKeys: true,
  });
}

function _bond() {
  const subos = _safe(() => {
    const m = require('./site-unicorn-bond-os');
    return m.getScore ? m.getScore() : m.getStatus();
  }, null);
  const tbos = _safe(() => {
    const m = require('./triad-bond-os');
    return m.getScore ? m.getScore() : m.getStatus();
  }, null);
  return {
    siteUnicorn: subos ? {
      protocol: subos.protocol || 'SUBOS/1.0',
      score: subos.score,
      grade: subos.grade,
      bonded: !!subos.bonded,
      pending: !!subos.pending,
    } : { protocol: 'SUBOS/1.0', available: false },
    triad: tbos ? {
      protocol: tbos.protocol || 'TBOS/1.0',
      score: tbos.score,
      grade: tbos.grade,
      bonded: !!tbos.bonded,
      pending: !!tbos.pending,
    } : { protocol: 'TBOS/1.0', available: false },
  };
}

function _continuity() {
  return _safe(() => {
    const cac = require('./immortality/continuity-attestation-chain');
    const s = cac.getStatus();
    return {
      protocol: s.protocol || 'CAC/1.0',
      tipHash: s.tipHash,
      seq: s.seq,
      beatCount: s.beatCount,
      lastVerdictHint: s.lastVerdictHint,
    };
  }, { protocol: 'CAC/1.0', available: false });
}

function _immortality() {
  return _safe(() => {
    const icp = require('./immortality-continuum-protocol');
    const e = icp.healthEnvelope();
    return {
      protocol: e.protocol || 'ICP/1.0',
      neverKill: !!e.neverKill,
      claimsAbsoluteUptime: !!e.claimsAbsoluteUptime,
      commerceBlocked: !!e.commerceBlocked,
      ndkHealth: e.ndkHealth,
      continuityTip: e.continuityTip,
    };
  }, { protocol: 'ICP/1.0', available: false });
}

function buildEnvelope() {
  const floor = _buyableFloor();
  const rails = _rails();
  const bonds = _bond();
  const continuity = _continuity();
  const immortality = _immortality();

  const ownerBtc = process.env.BTC_WALLET_ADDRESS
    || process.env.OWNER_BTC_ADDRESS
    || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
  const site = process.env.PUBLIC_APP_URL || 'https://zeusai.pro';

  // Fail-closed commerceReady: need BTC self-serve SKUs + not commerce-blocked
  const commerceBlocked = !!(immortality.commerceBlocked);
  const commerceReady = floor.floorOk && !commerceBlocked;

  const body = {
    protocol: PROTOCOL,
    invention: 'Merchant Trust Standard',
    module: NAME,
    version: '1.0',
    merchant: {
      name: 'ZeusAI',
      site,
      owner: process.env.OWNER_NAME || 'Vladoi Ionut',
      contact: process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com',
      btcWallet: ownerBtc,
    },
    commerceReady,
    buyableFloor: floor,
    rails,
    bonds,
    continuity,
    immortality,
    paths: {
      buy: '/buy',
      standard: '/standard',
      trust: '/trust',
      continuity: '/continuity',
      rails: '/rails',
      checkout: '/checkout',
      catalog: '/api/catalog',
      agents: '/agents.json',
      cacStatus: '/api/cac/status',
      cacBind: '/api/cac/bind',
    },
    honesty: {
      inventsGmv: false,
      inventsUptime: false,
      inventsPaymentRails: false,
      commerceReadyMeans: 'At least one BTC self-serve buyable SKU exists and commerce is not pressure-blocked',
      note: 'Agents and wallets should verify this envelope before paying. Idle rails stay idle until keys are present.',
    },
    issuedAt: isoNow(),
  };

  const signing = loadSigning();
  const canonical = JSON.stringify(body);
  const hash = sha256(canonical);
  const signature = signing.signBody(canonical + '|' + hash);

  return {
    ...body,
    hash,
    signature,
    publicKey: signing.publicKeyInfo(),
  };
}

function getStatus() {
  const env = buildEnvelope();
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Merchant Trust Standard',
    commerceReady: env.commerceReady,
    buyableCount: env.buyableFloor && env.buyableFloor.buyableCount,
    btcSelfServeCount: env.buyableFloor && env.buyableFloor.btcSelfServeCount,
    hash: env.hash,
    honesty: env.honesty,
    timestamp: isoNow(),
  };
}

function discovery() {
  return buildEnvelope();
}

function mountRoutes(app) {
  if (!app || typeof app.get !== 'function') return { ok: false };
  app.get('/api/merchant/standard', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(buildEnvelope());
  });
  app.get('/api/merchant/status', (req, res) => res.json(getStatus()));
  app.get('/.well-known/merchant.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(discovery());
  });
  return { ok: true, mounted: true };
}

module.exports = {
  PROTOCOL,
  NAME,
  getStatus,
  discovery,
  buildEnvelope,
  mountRoutes,
};
