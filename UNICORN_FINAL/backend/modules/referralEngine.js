// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/**
 * DEPRECATED thin facade — Phase 6 consolidation.
 * Source of truth: src/commerce/referral-engine-real.js (SQLite ledger).
 * Tier helpers remain for legacy callers; money attribution delegates to SoT.
 */

const crypto = require('crypto');
const path = require('path');

const TIER_CONFIG = {
  silver:   { minReferrals: 0,  commissionPct: 0.15, label: 'Silver' },
  gold:     { minReferrals: 5,  commissionPct: 0.20, label: 'Gold' },
  platinum: { minReferrals: 15, commissionPct: 0.25, label: 'Platinum' },
};

const PLAN_VALUES = {
  starter:    29,
  pro:        99,
  enterprise: 499,
};

const DEPRECATED = {
  deprecated: true,
  sot: 'src/commerce/referral-engine-real.js',
  note: 'Use referral-engine-real for new code. This facade thin-delegates.',
};

function _real() {
  return require(path.join(__dirname, '..', '..', 'src', 'commerce', 'referral-engine-real.js'));
}

function generateCode(userId) {
  const prefix = String(userId || 'USER').slice(0, 4).toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REF-${prefix}-${suffix}`;
}

function computeTier(referralCount) {
  if (referralCount >= TIER_CONFIG.platinum.minReferrals) return 'platinum';
  if (referralCount >= TIER_CONFIG.gold.minReferrals) return 'gold';
  return 'silver';
}

function createReferral(userId, email) {
  const ownerEmail = String(email || '').trim().toLowerCase()
    || (`${String(userId || 'user').slice(0, 32)}@legacy.zeusai.pro`);
  try {
    const real = _real();
    const out = real.getOrCreateCode(ownerEmail, null);
    return {
      id: out.code,
      referrerId: userId,
      code: out.code,
      email: ownerEmail,
      status: 'pending',
      tier: 'silver',
      commissionPct: TIER_CONFIG.silver.commissionPct,
      totalEarned: 0,
      createdAt: new Date().toISOString(),
      ...DEPRECATED,
    };
  } catch (_) {
    // Last-resort local stub if SoT unloadable (should not happen in prod).
    const code = generateCode(String(userId || 'USER'));
    return {
      id: crypto.randomBytes(8).toString('hex'),
      referrerId: userId,
      code,
      email: email || null,
      status: 'pending',
      tier: 'silver',
      commissionPct: TIER_CONFIG.silver.commissionPct,
      totalEarned: 0,
      createdAt: new Date().toISOString(),
      ...DEPRECATED,
      fallback: true,
    };
  }
}

function getReferralByCode(code) {
  try {
    const c = _real().lookupCode(code);
    if (!c) return null;
    return {
      code: c.code,
      email: c.owner_email,
      status: c.active ? 'active' : 'inactive',
      discount_pct: c.discount_pct,
      payout_pct: c.payout_pct,
      ...DEPRECATED,
    };
  } catch (_) {
    return null;
  }
}

function getAffiliateStats(userId) {
  const email = String(userId || '').includes('@')
    ? String(userId).trim().toLowerCase()
    : `${String(userId || '').slice(0, 32)}@legacy.zeusai.pro`;
  try {
    const stats = _real().statsFor(email);
    const converted = (stats.redemptions || []).length;
    const tier = computeTier(converted);
    return {
      userId,
      tier,
      tierConfig: TIER_CONFIG[tier],
      totalReferrals: (stats.codes || []).length,
      convertedReferrals: converted,
      pendingReferrals: 0,
      totalEarned: (stats.totals && stats.totals.payoutUsd) || 0,
      referrals: (stats.redemptions || []).slice(0, 50).map((r) => ({
        code: r.code,
        status: r.payout_status || r.payoutStatus || 'pending',
        earned: r.payout_usd || r.payoutUsd || 0,
        convertedAt: r.redeemed_at || r.redeemedAt || null,
      })),
      nextTier: tier === 'platinum' ? null : Object.entries(TIER_CONFIG)
        .find(([, v]) => v.minReferrals > TIER_CONFIG[tier].minReferrals),
      ...DEPRECATED,
    };
  } catch (_) {
    return {
      userId,
      tier: 'silver',
      tierConfig: TIER_CONFIG.silver,
      totalReferrals: 0,
      convertedReferrals: 0,
      pendingReferrals: 0,
      totalEarned: 0,
      referrals: [],
      nextTier: ['gold', TIER_CONFIG.gold],
      ...DEPRECATED,
    };
  }
}

function processConversion(code, newUserId, planId) {
  const planValue = PLAN_VALUES[planId] || 0;
  try {
    const real = _real();
    const red = real.recordRedemption({
      code,
      referredEmail: String(newUserId || '').includes('@') ? String(newUserId).toLowerCase() : null,
      orderId: 'legacy_conv_' + String(code || '').slice(0, 16) + '_' + String(planId || 'plan'),
      amountUsd: planValue,
    });
    const tier = computeTier(1);
    return {
      referrerId: null,
      code: (red && red.code) || code,
      planId,
      commission: (red && red.payoutUsd) || 0,
      tier,
      ...DEPRECATED,
      sotRedemption: red,
    };
  } catch (e) {
    return null;
  }
}

function listUserReferrals(userId) {
  const stats = getAffiliateStats(userId);
  return stats.referrals || [];
}

module.exports = {
  TIER_CONFIG,
  PLAN_VALUES,
  createReferral,
  getReferralByCode,
  getAffiliateStats,
  processConversion,
  listUserReferrals,
  computeTier,
  DEPRECATED,
};
