// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:15:50.128Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.885Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.360Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.342Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.966Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.686Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.549Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== REFERRAL & AFFILIATE ENGINE ====================
const crypto = require('crypto');

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

let _db = null;
function getDb() {
  if (!_db) _db = require('../db');
  return _db;
}

function generateCode(userId) {
  const prefix = userId.slice(0, 4).toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REF-${prefix}-${suffix}`;
}

function computeTier(referralCount) {
  if (referralCount >= TIER_CONFIG.platinum.minReferrals) return 'platinum';
  if (referralCount >= TIER_CONFIG.gold.minReferrals) return 'gold';
  return 'silver';
}

function createReferral(userId, email) {
  const db = getDb();
  const code = generateCode(userId);
  const referral = {
    id: crypto.randomBytes(8).toString('hex'),
    referrerId: userId,
    code,
    email: email || null,
    status: 'pending',
    tier: 'silver',
    commissionPct: TIER_CONFIG.silver.commissionPct,
    totalEarned: 0,
    createdAt: new Date().toISOString(),
  };
  db.referrals.create(referral);
  return referral;
}

function getReferralByCode(code) {
  return getDb().referrals.findByCode(code);
}

function getAffiliateStats(userId) {
  const db = getDb();
  const refs = db.referrals.listByReferrer(userId);
  const converted = refs.filter(r => r.status === 'converted');
  const tier = computeTier(converted.length);
  const totalEarned = refs.reduce((s, r) => s + (r.totalEarned || 0), 0);
  return {
    userId,
    tier,
    tierConfig: TIER_CONFIG[tier],
    totalReferrals: refs.length,
    convertedReferrals: converted.length,
    pendingReferrals: refs.length - converted.length,
    totalEarned,
    referrals: refs.map(r => ({
      code: r.code,
      status: r.status,
      earned: r.totalEarned || 0,
      convertedAt: r.convertedAt || null,
    })),
    nextTier: tier === 'platinum' ? null : Object.entries(TIER_CONFIG)
      .find(([, v]) => v.minReferrals > TIER_CONFIG[tier].minReferrals),
  };
}

function processConversion(code, newUserId, planId) {
  const db = getDb();
  const referral = db.referrals.findByCode(code);
  if (!referral || referral.status === 'converted') return null;

  db.referrals.convert(code, newUserId);

  const planValue = PLAN_VALUES[planId] || 0;
  const refs = db.referrals.listByReferrer(referral.referrerId);
  const converted = refs.filter(r => r.status === 'converted');
  const tier = computeTier(converted.length);
  const commissionPct = TIER_CONFIG[tier].commissionPct;
  const commission = planValue * commissionPct;

  if (commission > 0) {
    db.referrals.addEarnings(referral.referrerId, commission);
  }

  return {
    referrerId: referral.referrerId,
    code,
    planId,
    commission,
    tier,
  };
}

function listUserReferrals(userId) {
  return getDb().referrals.listByReferrer(userId);
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
};
