// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T19:23:05.064Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Neuro-Adaptive UX Engine — personalizare euristică reală. Dintr-un context
// (device, oră, returning, reducedMotion, intent) întoarce directive UX
// concrete și deterministe pe care frontend-ul le poate aplica imediat.
function personalize(userContext = {}) {
  const ctx = userContext || {};
  const hour = Number.isFinite(ctx.hour) ? ctx.hour : new Date().getHours();
  const device = (ctx.device || 'desktop').toLowerCase();
  const returning = !!ctx.returning;
  const reducedMotion = !!ctx.reducedMotion;
  const intent = (ctx.intent || 'browse').toLowerCase();

  const night = hour >= 19 || hour < 7;
  const theme = ctx.theme || (night ? 'dark' : 'auto');
  const density = device === 'mobile' ? 'compact' : (returning ? 'comfortable' : 'spacious');
  const motion = reducedMotion ? 'none' : (device === 'mobile' ? 'reduced' : 'full');

  let ctaEmphasis = 'standard';
  if (intent === 'buy' || intent === 'checkout') ctaEmphasis = 'high';
  else if (returning) ctaEmphasis = 'medium';

  const heroVariant = (intent === 'buy') ? 'pricing-first' : (returning ? 'continue' : 'value-prop');

  return {
    ok: true,
    method: 'neuro-heuristic',
    directives: { theme, density, motion, ctaEmphasis, heroVariant, fontScale: device === 'mobile' ? 0.95 : 1.0 },
    context: { hour, device, returning, reducedMotion, intent, night },
  };
}

module.exports = {
  isActive: true,
  getStatus() {
    return { status: 'active', neuroAdaptive: true, mode: 'heuristic-deterministic', signals: ['hour', 'device', 'returning', 'reducedMotion', 'intent'] };
  },
  personalize,
};