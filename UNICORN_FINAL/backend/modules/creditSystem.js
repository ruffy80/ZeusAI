// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:15:50.124Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.880Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.354Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.338Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.961Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.681Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.544Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== CREDIT SYSTEM — Usage-Based Billing ====================
// Tracks API credit consumption per user, enforces limits per plan,
// and exposes usage dashboard data.

const PLAN_CREDITS = {
  free:       100,
  starter:    10000,
  pro:        120000,
  enterprise: 1500000,
};

// Credit costs per action
const CREDIT_COSTS = {
  'chat':           1,
  'compliance':     10,
  'risk':           10,
  'negotiate':      5,
  'carbon_trade':   5,
  'carbon_issue':   2,
  'blueprint':      20,
  'ma_analyze':     50,
  'legal_generate': 15,
  'workforce_job':  10,
  'blockchain_tx':  5,
  'energy_trade':   5,
  'identity':       2,
  'payment_create': 1,
};

// In-memory usage cache (backed by DB for persistence)
const _usageCache = new Map(); // userId -> { used, resetAt }

let _db = null;
function getDb() {
  if (!_db) _db = require('../db');
  return _db;
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getUsage(userId) {
  const month = getCurrentMonth();
  const db = getDb();
  // Try DB first
  const row = db.monthlyUsage ? db.monthlyUsage.get(userId, month) : null;
  if (row) return row;
  // Fall back to in-memory cache
  const cached = _usageCache.get(userId);
  if (cached && cached.month === month) return cached;
  return { userId, month, used: 0 };
}

function addUsage(userId, amount, action) {
  const month = getCurrentMonth();
  const db = getDb();
  if (db.monthlyUsage) {
    db.monthlyUsage.add(userId, month, amount, action);
  } else {
    const current = _usageCache.get(userId) || { userId, month, used: 0 };
    if (current.month !== month) current.used = 0;
    current.month = month;
    current.used += amount;
    _usageCache.set(userId, current);
  }
}

function checkAndDeductCredits(userId, action, planId) {
  const cost = CREDIT_COSTS[action] || 1;
  const limit = PLAN_CREDITS[planId || 'free'] || 100;
  const usage = getUsage(userId);
  if ((usage.used || 0) + cost > limit) {
    return { allowed: false, cost, used: usage.used, limit, overage: true };
  }
  addUsage(userId, cost, action);
  return { allowed: true, cost, used: (usage.used || 0) + cost, limit };
}

function getUsageSummary(userId, planId) {
  const usage = getUsage(userId);
  const limit = PLAN_CREDITS[planId || 'free'] || 100;
  const used = usage.used || 0;
  return {
    userId,
    month: getCurrentMonth(),
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percentUsed: Math.round((used / limit) * 100),
    creditCosts: CREDIT_COSTS,
    planLimits: PLAN_CREDITS,
  };
}

// Middleware factory: checks and deducts credits for an action
function requireCredits(action) {
  return function creditMiddleware(req, res, next) {
    if (!req.user) return next(); // let authMiddleware handle it
    const userId = req.user.id;
    const db = getDb();
    const dbUser = db.users ? db.users.findById(userId) : null;
    const planId = (dbUser && dbUser.planId) || 'free';

    if (process.env.NODE_ENV === 'test') return next(); // skip in tests

    const result = checkAndDeductCredits(userId, action, planId);
    if (!result.allowed) {
      return res.status(402).json({
        error: `Credit limit reached. Used ${result.used}/${result.limit} credits this month.`,
        upgrade: '/payments',
        action,
        cost: result.cost,
      });
    }
    req.creditUsage = result;
    return next();
  };
}

module.exports = {
  PLAN_CREDITS,
  CREDIT_COSTS,
  getUsage,
  addUsage,
  checkAndDeductCredits,
  getUsageSummary,
  requireCredits,
  getCurrentMonth,
};
