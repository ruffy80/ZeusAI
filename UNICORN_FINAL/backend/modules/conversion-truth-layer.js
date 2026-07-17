'use strict';

const NAME = 'conversion-truth-layer';

const state = {
  sanitizeCalls: 0,
  auditCalls: 0,
  lastViolations: [],
  lastSanitizedAt: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? {} : value));
}

function isEthConfigured() {
  return Boolean(process.env.ETH_WALLET_ADDRESS || process.env.USDC_WALLET_ADDRESS || process.env.ETH_RECEIVE_ADDRESS);
}

function isBankConfigured() {
  return process.env.BANK_TRANSFER_ENABLED === '1'
    || Boolean(process.env.BANK_ACCOUNT_IBAN || process.env.BANK_ACCOUNT_NUMBER || process.env.BANK_ROUTING_NUMBER || process.env.BANK_BENEFICIARY);
}

function pathLabel(parts) {
  return parts.join('.');
}

function shouldZeroField(key) {
  const lower = String(key || '').toLowerCase();
  if (lower === 'simulated') return false;
  return lower.includes('simulated') || lower.includes('projected') || lower.includes('forecast') || lower.includes('estimated');
}

function zeroValue(value) {
  if (Array.isArray(value)) return [];
  if (typeof value === 'number') return 0;
  if (typeof value === 'string') return '0';
  if (typeof value === 'boolean') return false;
  if (value && typeof value === 'object') return {};
  return 0;
}

function zeroSimulatedFields(target, trail, changed) {
  if (!target || typeof target !== 'object') return;
  for (const [key, value] of Object.entries(target)) {
    const nextTrail = trail.concat(key);
    if (shouldZeroField(key) && value !== 0 && value !== '0' && value !== false) {
      target[key] = zeroValue(value);
      changed.push(pathLabel(nextTrail));
      continue;
    }
    if (value && typeof value === 'object') zeroSimulatedFields(value, nextTrail, changed);
  }
}

function classifyPaymentMethod(entry) {
  const value = typeof entry === 'string'
    ? entry
    : (entry && (entry.id || entry.kind || entry.method || entry.name || entry.provider)) || '';
  const lowered = String(value).trim().toLowerCase();
  if (lowered.includes('eth')) return 'eth';
  if (lowered === 'bank' || lowered.includes('bank') || lowered.includes('wire') || lowered.includes('sepa') || lowered.includes('ach')) return 'bank';
  return 'other';
}

function filterMethodsList(input, removed, fieldName) {
  if (!Array.isArray(input)) return input;
  return input.filter((entry) => {
    const type = classifyPaymentMethod(entry);
    if (type === 'eth' && !isEthConfigured()) {
      removed.push(fieldName + ':' + (typeof entry === 'string' ? entry : (entry.id || entry.name || 'eth')));
      return false;
    }
    if (type === 'bank' && !isBankConfigured()) {
      removed.push(fieldName + ':' + (typeof entry === 'string' ? entry : (entry.id || entry.name || 'bank')));
      return false;
    }
    return true;
  });
}

function stripUnavailablePaymentMethods(metrics) {
  const removed = [];
  for (const fieldName of ['paymentMethods', 'methods', 'supportedPaymentMethods', 'paymentOptions']) {
    if (fieldName in metrics) metrics[fieldName] = filterMethodsList(metrics[fieldName], removed, fieldName);
  }
  return removed;
}

function collectDishonestFields(value, trail, out) {
  if (!value || typeof value !== 'object') return;
  for (const [key, current] of Object.entries(value)) {
    const nextTrail = trail.concat(key);
    if (shouldZeroField(key) && current && current !== '0' && current !== false) {
      out.push({ field: pathLabel(nextTrail), value: current });
      continue;
    }
    if (current && typeof current === 'object') collectDishonestFields(current, nextTrail, out);
  }
}

function sanitizePublicMetrics(metrics) {
  const sanitized = clone(metrics);
  const zeroedFields = [];
  const removedPaymentMethods = stripUnavailablePaymentMethods(sanitized);

  if (sanitized.simulated !== true) zeroSimulatedFields(sanitized, [], zeroedFields);

  sanitized.truthLayer = {
    sanitizedBy: NAME,
    zeroedFields,
    removedPaymentMethods,
    ethConfigured: isEthConfigured(),
    bankConfigured: isBankConfigured(),
  };

  state.sanitizeCalls += 1;
  state.lastSanitizedAt = new Date().toISOString();
  return sanitized;
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function assertRevenueHonesty(report) {
  const violations = [];
  const source = clone(report);
  const dishonestFields = [];

  if (source.simulated !== true) {
    collectDishonestFields(source, [], dishonestFields);
    for (const entry of dishonestFields) {
      violations.push({
        code: 'dishonest_simulation_field',
        field: entry.field,
        message: 'Non-zero simulated/projection field exposed while simulated!==true',
        value: entry.value,
      });
    }
  }

  const removedMethods = stripUnavailablePaymentMethods(source);
  for (const field of removedMethods) {
    violations.push({
      code: 'unsupported_payment_method',
      field,
      message: 'Public metrics exposed a payment method that is not configured',
    });
  }

  const realRevenue = numeric(source.realRevenueUsd)
    ?? numeric(source.revenue && source.revenue.paidUsd)
    ?? numeric(source.actualRevenueUsd);
  const claimedRevenue = numeric(source.revenueUsd)
    ?? numeric(source.reportedRevenueUsd)
    ?? numeric(source.publicRevenueUsd)
    ?? numeric(source.totalRevenueUsd);
  if (realRevenue != null && claimedRevenue != null && claimedRevenue - realRevenue > 0.009) {
    violations.push({
      code: 'revenue_overclaim',
      field: 'revenueUsd',
      message: 'Claimed revenue exceeds real settled revenue',
      realRevenueUsd: realRevenue,
      claimedRevenueUsd: claimedRevenue,
    });
  }

  const realPaidOrders = numeric(source.realPaidOrders)
    ?? numeric(source.orders && source.orders.paid)
    ?? numeric(source.actualPaidOrders);
  const claimedPaidOrders = numeric(source.paidOrders)
    ?? numeric(source.reportedPaidOrders)
    ?? numeric(source.orders && source.orders.totalPaid);
  if (realPaidOrders != null && claimedPaidOrders != null && claimedPaidOrders > realPaidOrders) {
    violations.push({
      code: 'paid_orders_overclaim',
      field: 'paidOrders',
      message: 'Claimed paid orders exceeds real paid orders',
      realPaidOrders,
      claimedPaidOrders,
    });
  }

  state.auditCalls += 1;
  state.lastViolations = violations.slice(0, 20);
  return { ok: violations.length === 0, violations };
}

function getStatus() {
  return {
    module: NAME,
    sanitizeCalls: state.sanitizeCalls,
    auditCalls: state.auditCalls,
    lastSanitizedAt: state.lastSanitizedAt,
    lastViolations: state.lastViolations,
    paymentConfig: {
      ethConfigured: isEthConfigured(),
      bankConfigured: isBankConfigured(),
    },
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : input;
  if (action === 'sanitize') return { ok: true, action, metrics: sanitizePublicMetrics(payload.metrics || payload) };
  if (action === 'assert') return { action, ...assertRevenueHonesty(payload.report || payload) };
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  state.sanitizeCalls = 0;
  state.auditCalls = 0;
  state.lastViolations = [];
  state.lastSanitizedAt = null;
}

module.exports = {
  name: NAME,
  sanitizePublicMetrics,
  assertRevenueHonesty,
  getStatus,
  process: processInput,
  _resetForTests,
};
