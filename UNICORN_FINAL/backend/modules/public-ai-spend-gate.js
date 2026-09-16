'use strict';

/**
 * PUBLIC AI SPEND GATE — PASG/1.0
 *
 * When billable cloud LLM keys are armed, anonymous callers cannot drive the
 * paid provider cascade. Unauthenticated traffic still gets local/keyword
 * fail-soft when no billable key exists.
 *
 * Escape hatch: PUBLIC_AI_ANON=1 (strict IP limit still applies in production).
 */

function hasBillableLlm() {
  try {
    const eternal = require('./fulfillment-ai-os');
    if (eternal && typeof eternal.configuredProviderSnapshot === 'function') {
      const snap = eternal.configuredProviderSnapshot();
      return Number(snap && snap.configured) >= 1;
    }
  } catch (_) { /* fall through */ }
  return false;
}

function hasAuth(req) {
  if (!req || !req.headers) return false;
  const auth = String(req.headers.authorization || '');
  if (/^Bearer\s+\S+/i.test(auth)) return true;
  if (String(req.headers['x-api-key'] || '').trim()) return true;
  if (String(req.headers['x-customer-token'] || '').trim()) return true;
  return false;
}

function publicAiSpendGate(req, res, next) {
  if (String(process.env.PUBLIC_AI_ANON || '') === '1') return next();
  if (!hasBillableLlm()) return next();
  if (hasAuth(req)) return next();
  return res.status(401).json({
    error: 'ai_auth_required',
    protocol: 'PASG/1.0',
    billableProvidersConfigured: true,
    honesty: 'Cloud LLM spend requires a session, API key, or PUBLIC_AI_ANON=1.',
  });
}

module.exports = {
  hasBillableLlm,
  hasAuth,
  publicAiSpendGate,
};
