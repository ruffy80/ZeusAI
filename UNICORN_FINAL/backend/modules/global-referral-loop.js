'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const NAME = 'global-referral-loop';
const REWARD_RATE = 0.10;

function statePath() {
  return process.env.GLOBAL_REFERRAL_LOOP_STATE_PATH
    || path.resolve(__dirname, '..', '..', 'data', 'referrals', 'state.json');
}

function nowIso() {
  return new Date().toISOString();
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function emptyState() {
  const now = nowIso();
  return {
    module: NAME,
    rewardRate: REWARD_RATE,
    createdAt: now,
    updatedAt: now,
    codes: {},
    userCodes: {},
    referrals: [],
    paidOrders: {},
    userCredits: {},
    creditLedger: []
  };
}

function normalizeState(state) {
  const base = emptyState();
  if (!state || typeof state !== 'object') return base;
  return {
    ...base,
    ...state,
    codes: state.codes && typeof state.codes === 'object' ? state.codes : {},
    userCodes: state.userCodes && typeof state.userCodes === 'object' ? state.userCodes : {},
    referrals: Array.isArray(state.referrals) ? state.referrals : [],
    paidOrders: state.paidOrders && typeof state.paidOrders === 'object' ? state.paidOrders : {},
    userCredits: state.userCredits && typeof state.userCredits === 'object' ? state.userCredits : {},
    creditLedger: Array.isArray(state.creditLedger) ? state.creditLedger : []
  };
}

function readState() {
  try {
    if (!fs.existsSync(statePath())) return emptyState();
    return normalizeState(JSON.parse(fs.readFileSync(statePath(), 'utf8')));
  } catch (_) {
    return emptyState();
  }
}

function writeState(state) {
  const next = normalizeState(state);
  next.updatedAt = nowIso();
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(next, null, 2));
  return next;
}

function safeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function safeUserId(userId) {
  return String(userId || '').trim();
}

function buildReferralCode(userId) {
  return 'REF-' + crypto
    .createHash('sha256')
    .update(`${safeUserId(userId)}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
}

function ensureCreditAccount(state, userId) {
  const safeUser = safeUserId(userId);
  if (!state.userCredits[safeUser]) {
    state.userCredits[safeUser] = {
      userId: safeUser,
      unit: 'USD_CREDIT',
      balance: 0,
      lifetimeIssued: 0,
      updatedAt: nowIso()
    };
  }
  return state.userCredits[safeUser];
}

function createCode(userId) {
  const safeUser = safeUserId(userId);
  if (!safeUser) throw new Error('userId_required');

  const state = readState();
  const existing = safeCode(state.userCodes[safeUser]);
  if (existing && state.codes[existing]) return state.codes[existing];

  const code = buildReferralCode(safeUser);
  const createdAt = nowIso();
  const entry = {
    code,
    userId: safeUser,
    createdAt,
    trackedUsers: 0,
    attributedOrders: 0,
    attributedAmountUsd: 0,
    totalCreditIssued: 0,
    lastTrackedAt: null,
    lastAttributedAt: null
  };
  state.codes[code] = entry;
  state.userCodes[safeUser] = code;
  ensureCreditAccount(state, safeUser);
  writeState(state);
  return entry;
}

function trackReferral(code, newUserId) {
  const referralCode = safeCode(code);
  const safeNewUserId = safeUserId(newUserId);
  if (!referralCode) throw new Error('code_required');
  if (!safeNewUserId) throw new Error('newUserId_required');

  const state = readState();
  const codeEntry = state.codes[referralCode];
  if (!codeEntry) throw new Error('code_not_found');
  if (codeEntry.userId === safeNewUserId) throw new Error('self_referral_not_allowed');

  const existing = state.referrals.find((item) => item.code === referralCode && item.newUserId === safeNewUserId);
  if (existing) return existing;

  const trackedAt = nowIso();
  const referral = {
    id: 'ref_' + crypto.randomBytes(8).toString('hex'),
    code: referralCode,
    referrerUserId: codeEntry.userId,
    newUserId: safeNewUserId,
    status: 'tracked',
    trackedAt,
    convertedAt: null,
    paidOrders: [],
    rewardCredits: 0
  };
  state.referrals.push(referral);
  codeEntry.trackedUsers = state.referrals.filter((item) => item.code === referralCode).length;
  codeEntry.lastTrackedAt = trackedAt;
  writeState(state);
  return referral;
}

function attributePaidOrder(orderId, amountUsd, code) {
  const safeOrderId = String(orderId || '').trim();
  const referralCode = safeCode(code);
  const safeAmountUsd = round2(amountUsd);
  if (!safeOrderId) throw new Error('orderId_required');
  if (!referralCode) throw new Error('code_required');
  if (!(safeAmountUsd > 0)) throw new Error('amountUsd_required');

  const state = readState();
  const existing = state.paidOrders[safeOrderId];
  if (existing) return existing;

  const codeEntry = state.codes[referralCode];
  if (!codeEntry) throw new Error('code_not_found');

  const rewardCredit = round2(safeAmountUsd * REWARD_RATE);
  const attributedAt = nowIso();
  const orderAttribution = {
    orderId: safeOrderId,
    code: referralCode,
    referrerUserId: codeEntry.userId,
    amountUsd: safeAmountUsd,
    rewardCredit,
    rewardUnit: 'USD_CREDIT',
    attributedAt
  };
  state.paidOrders[safeOrderId] = orderAttribution;

  const account = ensureCreditAccount(state, codeEntry.userId);
  account.balance = round2(Number(account.balance || 0) + rewardCredit);
  account.lifetimeIssued = round2(Number(account.lifetimeIssued || 0) + rewardCredit);
  account.updatedAt = attributedAt;

  state.creditLedger.push({
    id: 'cred_' + crypto.randomBytes(8).toString('hex'),
    type: 'referral_credit',
    orderId: safeOrderId,
    code: referralCode,
    referrerUserId: codeEntry.userId,
    amountUsd: safeAmountUsd,
    rewardCredit,
    rewardUnit: 'USD_CREDIT',
    createdAt: attributedAt
  });

  codeEntry.attributedOrders = Number(codeEntry.attributedOrders || 0) + 1;
  codeEntry.attributedAmountUsd = round2(Number(codeEntry.attributedAmountUsd || 0) + safeAmountUsd);
  codeEntry.totalCreditIssued = round2(Number(codeEntry.totalCreditIssued || 0) + rewardCredit);
  codeEntry.lastAttributedAt = attributedAt;

  const trackedReferral = state.referrals.find((item) => item.code === referralCode && item.status !== 'converted');
  if (trackedReferral) {
    trackedReferral.status = 'converted';
    trackedReferral.convertedAt = attributedAt;
    trackedReferral.paidOrders = Array.isArray(trackedReferral.paidOrders) ? trackedReferral.paidOrders.concat(safeOrderId) : [safeOrderId];
    trackedReferral.rewardCredits = round2(Number(trackedReferral.rewardCredits || 0) + rewardCredit);
  }

  writeState(state);
  return orderAttribution;
}

function getStatus() {
  const state = readState();
  const creditAccounts = Object.values(state.userCredits || {});
  return {
    module: NAME,
    statePath: statePath(),
    rewardRate: REWARD_RATE,
    codes: Object.keys(state.codes || {}).length,
    trackedReferrals: state.referrals.length,
    attributedOrders: Object.keys(state.paidOrders || {}).length,
    creditLedgerEntries: state.creditLedger.length,
    totalCreditIssued: round2(creditAccounts.reduce((sum, account) => sum + Number(account.lifetimeIssued || 0), 0)),
    activeReferrers: creditAccounts.filter((account) => Number(account.balance || 0) > 0).length
  };
}

async function processInput(input = {}) {
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : input;
  const action = String(input.action || 'status');
  if (action === 'createCode') return { ok: true, action, code: createCode(payload.userId) };
  if (action === 'trackReferral') return { ok: true, action, referral: trackReferral(payload.code, payload.newUserId) };
  if (action === 'attributePaidOrder') return { ok: true, action, attribution: attributePaidOrder(payload.orderId, payload.amountUsd, payload.code) };
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  try { fs.unlinkSync(statePath()); } catch (_) {}
}

module.exports = {
  name: NAME,
  createCode,
  trackReferral,
  attributePaidOrder,
  getStatus,
  process: processInput,
  _resetForTests
};
