'use strict';

/**
 * NATIVE OPS POLICY — NOP/1.0
 *
 * Routine business replies stay on the local concierge (classifyIntent +
 * composeReply, shelf advise, fulfillment packs). An external model is
 * optional and only for open-ended language work, and only when a real
 * billable provider key exists. A missing key keeps the native reply.
 *
 * A — deterministic, always native:
 *     catalog, pricing, buy, btc_howto, paypal_howto, my_services, activate
 * B — rules, templates, and existing business logic, always native:
 *     support, greet, enterprise, compare, demo, security, growth, automation
 * C — open-ended wording, external only when billable:
 *     general, forecast, roi
 *
 * Unknown intents stay native. This module does not call a provider.
 */

const NATIVE_INTENTS = Object.freeze([
  'catalog',
  'pricing',
  'buy',
  'btc_howto',
  'paypal_howto',
  'my_services',
  'activate',
  'support',
  'greet',
  'enterprise',
  'compare',
  'demo',
  'security',
  'growth',
  'automation',
]);

const OPEN_INTENTS = Object.freeze([
  'general',
  'forecast',
  'roi',
]);

function routineIntent(intent) {
  return NATIVE_INTENTS.indexOf(String(intent || '')) !== -1;
}

function openIntent(intent) {
  return OPEN_INTENTS.indexOf(String(intent || '')) !== -1;
}

function shouldCallExternalModel(intent, opts) {
  const billable = !!(opts && opts.billable);
  if (!billable) return false;
  if (routineIntent(intent)) return false;
  return openIntent(intent);
}

module.exports = {
  PROTOCOL: 'NOP/1.0',
  NATIVE_INTENTS,
  OPEN_INTENTS,
  routineIntent,
  openIntent,
  shouldCallExternalModel,
};
