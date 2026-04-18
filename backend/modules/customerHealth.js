// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T20:56:24.790Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

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
// Data: 2026-04-11T10:50:35.962Z
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
// ==================== CUSTOMER HEALTH SCORE ENGINE ====================

const PLAN_SCORES = { free: 0, starter: 5, pro: 10, enterprise: 15 };

const _healthCache = new Map();

let _db = null;
function getDb() {
  if (!_db) _db = require('../db');
  return _db;
}

function computeLoginScore(user) {
  if (!user.lastLoginAt) return 0;
  const daysSinceLogin = (Date.now() - new Date(user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLogin < 1) return 25;
  if (daysSinceLogin < 7) return 20;
  if (daysSinceLogin < 14) return 15;
  if (daysSinceLogin < 30) return 10;
  if (daysSinceLogin < 60) return 5;
  return 0;
}

function computeApiUsageScore(userId, planId) {
  try {
    const cs = require('./creditSystem');
    const summary = cs.getUsageSummary(userId, planId);
    const pct = summary.percentUsed || 0;
    if (pct >= 60 && pct <= 80) return 20;
    if (pct >= 30 && pct < 60) return 15;
    if (pct > 80 && pct < 100) return 12;
    if (pct >= 100) return 5;
    if (pct < 10) return 2;
    return 8;
  } catch { return 10; }
}

function computeAccountAgeScore(createdAt) {
  if (!createdAt) return 0;
  const ageMonths = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (ageMonths >= 12) return 10;
  if (ageMonths >= 6) return 8;
  if (ageMonths >= 3) return 6;
  if (ageMonths >= 1) return 4;
  return 2;
}

function getRecommendations(risk, planId) {
  const recs = [];
  if (risk === 'churning') {
    recs.push('Trimite email de re-engagement cu discount 20%');
    recs.push('Oferă sesiune de onboarding gratuită');
    if (planId === 'free') recs.push('Oferă trial extins pentru plan Starter');
  } else if (risk === 'at-risk') {
    recs.push('Trimite newsletter cu funcționalități noi');
    recs.push('Verifică dacă utilizatorul a întâmpinat probleme tehnice');
  } else {
    if (planId !== 'enterprise') recs.push('Candidat ideal pentru upgrade de plan');
    recs.push('Solicită review/testimonial');
    recs.push('Invită în programul de referral');
  }
  return recs;
}

function computeHealthScore(userId) {
  const db = getDb();
  const user = db.users ? db.users.findById(userId) : null;
  if (!user) return { score: 0, risk: 'unknown', factors: {} };

  const planId = user.planId || 'free';
  const loginScore = computeLoginScore(user);
  const apiScore = computeApiUsageScore(userId, planId);
  const planScore = PLAN_SCORES[planId] || 0;
  const ageScore = computeAccountAgeScore(user.createdAt);
  const featureScore = Math.min(25, Math.round((planScore / 15) * 25));
  const paymentScore = 5;

  const total = loginScore + featureScore + apiScore + planScore + ageScore + paymentScore;
  const score = Math.min(100, Math.max(0, total));
  const risk = score >= 70 ? 'healthy' : score >= 40 ? 'at-risk' : 'churning';

  const result = {
    userId,
    score,
    risk,
    planId,
    factors: {
      loginFrequency: loginScore,
      featureAdoption: featureScore,
      apiUsage: apiScore,
      planLevel: planScore,
      accountAge: ageScore,
      paymentHistory: paymentScore,
    },
    recommendations: getRecommendations(risk, planId),
    computedAt: new Date().toISOString(),
  };

  _healthCache.set(userId, result);
  return result;
}

function getBulkHealthScores(limit = 100) {
  const db = getDb();
  try {
    const users = db.users ? db.users.listAll({ page: 1, limit }).users : [];
    return users.map(u => computeHealthScore(u.id));
  } catch { return []; }
}

function getChurnRiskUsers(limit = 50) {
  const scores = getBulkHealthScores(200);
  return scores
    .filter(s => s.risk === 'churning' || s.risk === 'at-risk')
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

module.exports = {
  computeHealthScore,
  getBulkHealthScores,
  getChurnRiskUsers,
  getRecommendations,
};
