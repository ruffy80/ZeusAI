// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/i18n-amplifier.js
//
// Lightweight i18n layer for marketing copy. Provides a small
// dictionary of common marketing phrases in EN/RO/ES/FR/DE/IT/PT, and
// a localize() helper that translates known phrases and wraps unknown
// content with a no-op (returning original) so it is always safe.
//
// Geo-IP → locale heuristic uses Accept-Language header parsing only;
// no external services.
// =====================================================================

'use strict';

const DISABLED = process.env.MARKETING_I18N_DISABLED === '1';
const SUPPORTED = ['en', 'ro', 'es', 'fr', 'de', 'it', 'pt'];
const DEFAULT_LOCALE = (process.env.MARKETING_DEFAULT_LOCALE || 'en').toLowerCase();

// Curated marketing phrases.
const DICT = {
  'sign_up_free': {
    en: 'Sign up free', ro: 'Înregistrează-te gratuit', es: 'Regístrate gratis',
    fr: 'Inscrivez-vous gratuitement', de: 'Kostenlos registrieren',
    it: 'Iscriviti gratis', pt: 'Cadastre-se grátis',
  },
  'try_now': {
    en: 'Try now', ro: 'Încearcă acum', es: 'Pruébalo ahora',
    fr: 'Essayer maintenant', de: 'Jetzt testen', it: 'Prova ora', pt: 'Experimente agora',
  },
  'learn_more': {
    en: 'Learn more', ro: 'Află mai mult', es: 'Saber más',
    fr: 'En savoir plus', de: 'Mehr erfahren', it: 'Scopri di più', pt: 'Saiba mais',
  },
  'get_started': {
    en: 'Get started', ro: 'Începe acum', es: 'Empezar',
    fr: 'Commencer', de: 'Loslegen', it: 'Inizia', pt: 'Começar',
  },
  'limited_offer': {
    en: 'Limited offer', ro: 'Ofertă limitată', es: 'Oferta limitada',
    fr: 'Offre limitée', de: 'Begrenztes Angebot', it: 'Offerta limitata', pt: 'Oferta limitada',
  },
  'btc_friendly': {
    en: 'BTC-friendly', ro: 'Acceptă BTC', es: 'Compatible con BTC',
    fr: 'Compatible BTC', de: 'BTC-freundlich', it: 'Compatibile BTC', pt: 'Aceita BTC',
  },
  'instant_setup': {
    en: 'Instant setup', ro: 'Configurare instant', es: 'Configuración instantánea',
    fr: 'Configuration instantanée', de: 'Sofort einsatzbereit',
    it: 'Configurazione istantanea', pt: 'Configuração instantânea',
  },
};

/**
 * Pick the best supported locale from an Accept-Language header.
 *  Returns one of SUPPORTED, falling back to DEFAULT_LOCALE.
 */
function pickLocale(acceptLang) {
  if (DISABLED) return DEFAULT_LOCALE;
  if (!acceptLang) return DEFAULT_LOCALE;
  const parts = String(acceptLang).split(',').map((p) => {
    const [lang, q] = p.trim().split(';q=');
    return { lang: (lang || '').toLowerCase().split('-')[0], q: q ? Number(q) : 1 };
  }).sort((a, b) => b.q - a.q);
  for (const p of parts) if (SUPPORTED.includes(p.lang)) return p.lang;
  return DEFAULT_LOCALE;
}

/**
 * Translate a known phrase key to the requested locale; unknown keys
 * pass through unchanged.
 */
function t(key, locale) {
  if (DISABLED) return String(key);
  const loc = SUPPORTED.includes(String(locale || '').toLowerCase()) ? String(locale).toLowerCase() : DEFAULT_LOCALE;
  const entry = DICT[key];
  if (!entry) return String(key);
  return entry[loc] || entry[DEFAULT_LOCALE] || entry.en || String(key);
}

/**
 * Localize a content variant: returns a clone with cta/title translated
 * if their values match a known dictionary key (case-insensitive,
 * whitespace-stripped).
 */
function localizeVariant(variant, locale) {
  if (!variant || typeof variant !== 'object') return variant;
  const v = { ...variant };
  const norm = (x) => String(x || '').trim().toLowerCase().replace(/\s+/g, '_');
  for (const f of ['cta', 'title', 'button']) {
    if (v[f] && DICT[norm(v[f])]) v[f] = t(norm(v[f]), locale);
  }
  v.locale = locale || DEFAULT_LOCALE;
  return v;
}

function listLocales() { return SUPPORTED.slice(); }
function dictKeys() { return Object.keys(DICT); }

function status() {
  return {
    disabled: DISABLED,
    defaultLocale: DEFAULT_LOCALE,
    supported: SUPPORTED,
    keys: Object.keys(DICT).length,
  };
}

module.exports = { pickLocale, t, localizeVariant, listLocales, dictKeys, status };
