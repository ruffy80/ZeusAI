// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

/**
 * NEGOTIATION CHATBOT (complementary)
 *
 * Provides an /api/negotiate endpoint that talks to customers and uses
 * the existing dynamic-pricing module as the source of truth. Applies
 * deterministic discount tiers — never modifies the pricing engine.
 *
 * Tiers (max per session):
 *  - opening counter: 0% off (anchored at engine price)
 *  - 2nd offer: up to 7%
 *  - 3rd offer: up to 12%
 *  - final:     up to 18% (floor)
 */

const TIERS = [0, 0.07, 0.12, 0.18];
const MAX_DISCOUNT = 0.18;

const _sessions = new Map(); // sessionId -> { round, history, serviceId }
const _state = {
  name: 'negotiation-chatbot',
  startedAt: null,
  totalSessions: 0,
};

function _enginePrice(serviceId) {
  try {
    const pricing = require('../dynamic-pricing');
    if (pricing && typeof pricing.getPrice === 'function') {
      const p = pricing.getPrice(serviceId);
      if (p && typeof p.amount === 'number') return p;
      if (typeof p === 'number') return { amount: p, currency: 'USD' };
    }
  } catch (_) { /* fallback below */ }
  return { amount: 99, currency: 'USD', source: 'fallback' };
}

function _quote(session, requestedDiscount) {
  const base = _enginePrice(session.serviceId);
  const tierMax = TIERS[Math.min(session.round, TIERS.length - 1)];
  const requested = Math.max(0, Math.min(Number(requestedDiscount) || 0, MAX_DISCOUNT));
  const granted = Math.min(requested, tierMax);
  const amount = Math.round(base.amount * (1 - granted) * 100) / 100;
  return { base: base.amount, currency: base.currency || 'USD', discount: granted, amount, tierMax };
}

function negotiate({ sessionId, serviceId, message, requestedDiscount } = {}) {
  if (!sessionId) sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let s = _sessions.get(sessionId);
  if (!s) {
    s = { id: sessionId, serviceId: serviceId || 'default', round: 0, history: [] };
    _sessions.set(sessionId, s);
    _state.totalSessions += 1;
  }
  s.round = Math.min(s.round + 1, TIERS.length - 1);
  const quote = _quote(s, requestedDiscount);
  const reply = quote.discount > 0
    ? `I can offer ${(quote.discount * 100).toFixed(0)}% off — that's ${quote.amount} ${quote.currency}.`
    : `Our best engine price is ${quote.amount} ${quote.currency}. Make me an offer.`;
  s.history.push({ at: new Date().toISOString(), message: String(message || ''), quote, reply });
  return { ok: true, sessionId, round: s.round, quote, reply };
}

function init({ app } = {}) {
  if (_state.startedAt) return;
  _state.startedAt = new Date().toISOString();
  if (app && typeof app.post === 'function') {
    app.post('/api/negotiate', (req, res) => {
      const out = negotiate(req.body || {});
      res.json(out);
    });
    app.get('/api/negotiate/:sessionId', (req, res) => {
      const s = _sessions.get(req.params.sessionId);
      if (!s) return res.status(404).json({ ok: false, error: 'session not found' });
      res.json({ ok: true, session: s });
    });
  }
}

function getStatus() {
  return { name: _state.name, startedAt: _state.startedAt, totalSessions: _state.totalSessions, active: _sessions.size };
}

module.exports = { name: 'negotiation-chatbot', init, getStatus, negotiate };
