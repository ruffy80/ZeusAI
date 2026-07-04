// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// expansion-engine.js — Global Expansion Engine for Unicorn SaaS
// Motor de expansiune globală pentru platforma Unicorn SaaS
// =============================================================================
// Features / Funcționalități:
//   1. Multi-language support (i18n) — EN, RO, DE, FR, ES, PT, ZH, HI, AR, JA
//   2. Geo-targeted pricing — PPP-adjusted prices per region
//   3. Regional strategy — which verticals to push per region
//   4. International billing config — tax rates, billing formats
//   5. Localized marketplace listings
//   6. Region-based A/B optimization
//   7. Expansion opportunity scoring — where to expand next
// =============================================================================

'use strict';

const express = require('express');

// ── §1  LANGUAGE CATALOG ──────────────────────────────────────────────────

const LANGUAGES = {
  en: { name: 'English',    code: 'en', direction: 'ltr', flag: '🇺🇸' },
  ro: { name: 'Română',    code: 'ro', direction: 'ltr', flag: '🇷🇴' },
  de: { name: 'Deutsch',   code: 'de', direction: 'ltr', flag: '🇩🇪' },
  fr: { name: 'Français',  code: 'fr', direction: 'ltr', flag: '🇫🇷' },
  es: { name: 'Español',   code: 'es', direction: 'ltr', flag: '🇪🇸' },
  pt: { name: 'Português', code: 'pt', direction: 'ltr', flag: '🇧🇷' },
  zh: { name: '中文',       code: 'zh', direction: 'ltr', flag: '🇨🇳' },
  hi: { name: 'हिन्दी',    code: 'hi', direction: 'ltr', flag: '🇮🇳' },
  ar: { name: 'العربية',   code: 'ar', direction: 'rtl', flag: '🇸🇦' },
  ja: { name: '日本語',     code: 'ja', direction: 'ltr', flag: '🇯🇵' },
};

// Core UI translations
const TRANSLATIONS = {
  en: {
    hero_title:   'The World\'s Most Autonomous AI Business Platform',
    hero_sub:     'Automate everything. Earn more. Grow faster.',
    cta_start:    'Start Free Trial',
    cta_pricing:  'View Pricing',
    pricing_title:'Choose Your Plan',
    footer_copy:  '© 2026 ZeusAI. All rights reserved.',
  },
  ro: {
    hero_title:   'Platforma AI de Afaceri Cel Mai Autonom din Lume',
    hero_sub:     'Automatizează totul. Câștigă mai mult. Crește mai repede.',
    cta_start:    'Începe Gratuit',
    cta_pricing:  'Vezi Prețuri',
    pricing_title:'Alege Planul Tău',
    footer_copy:  '© 2026 ZeusAI. Toate drepturile rezervate.',
  },
  de: {
    hero_title:   'Die Weltweit Autonomste KI-Geschäftsplattform',
    hero_sub:     'Alles automatisieren. Mehr verdienen. Schneller wachsen.',
    cta_start:    'Kostenlos starten',
    cta_pricing:  'Preise anzeigen',
    pricing_title:'Wähle deinen Plan',
    footer_copy:  '© 2026 ZeusAI. Alle Rechte vorbehalten.',
  },
  fr: {
    hero_title:   'La Plateforme IA la Plus Autonome au Monde',
    hero_sub:     'Automatisez tout. Gagnez plus. Grandissez plus vite.',
    cta_start:    'Essai Gratuit',
    cta_pricing:  'Voir les Prix',
    pricing_title:'Choisissez votre Plan',
    footer_copy:  '© 2026 ZeusAI. Tous droits réservés.',
  },
  es: {
    hero_title:   'La Plataforma de Negocios con IA Más Autónoma del Mundo',
    hero_sub:     'Automatiza todo. Gana más. Crece más rápido.',
    cta_start:    'Prueba Gratuita',
    cta_pricing:  'Ver Precios',
    pricing_title:'Elige tu Plan',
    footer_copy:  '© 2026 ZeusAI. Todos los derechos reservados.',
  },
  pt: {
    hero_title:   'A Plataforma de IA Empresarial Mais Autônoma do Mundo',
    hero_sub:     'Automatize tudo. Ganhe mais. Cresça mais rápido.',
    cta_start:    'Teste Grátis',
    cta_pricing:  'Ver Preços',
    pricing_title:'Escolha seu Plano',
    footer_copy:  '© 2026 ZeusAI. Todos os direitos reservados.',
  },
  zh: {
    hero_title:   '全球最自主的AI商业平台',
    hero_sub:     '自动化一切。赚得更多。增长更快。',
    cta_start:    '免费开始',
    cta_pricing:  '查看价格',
    pricing_title:'选择您的方案',
    footer_copy:  '© 2026 ZeusAI. 保留所有权利。',
  },
  hi: {
    hero_title:   'दुनिया का सबसे स्वायत्त AI व्यापार प्लेटफॉर्म',
    hero_sub:     'सब कुछ स्वचालित करें। अधिक कमाएं। तेजी से बढ़ें।',
    cta_start:    'मुफ्त शुरू करें',
    cta_pricing:  'मूल्य देखें',
    pricing_title:'अपनी योजना चुनें',
    footer_copy:  '© 2026 ZeusAI. सर्वाधिकार सुरक्षित।',
  },
  ar: {
    hero_title:   'منصة الأعمال بالذكاء الاصطناعي الأكثر استقلالية في العالم',
    hero_sub:     'أتمتة كل شيء. اكسب أكثر. نمو أسرع.',
    cta_start:    'ابدأ مجاناً',
    cta_pricing:  'عرض الأسعار',
    pricing_title:'اختر خطتك',
    footer_copy:  '© 2026 ZeusAI. جميع الحقوق محفوظة.',
  },
  ja: {
    hero_title:   '世界で最も自律的なAIビジネスプラットフォーム',
    hero_sub:     'すべてを自動化。より多く稼ぐ。より速く成長。',
    cta_start:    '無料で始める',
    cta_pricing:  '料金を見る',
    pricing_title:'プランを選択',
    footer_copy:  '© 2026 ZeusAI. All rights reserved.',
  },
};

// ── §2  GEO-PRICING ENGINE ────────────────────────────────────────────────

// PPP multipliers relative to USD — lower means cheaper for local market
// Factori PPP relativi față de USD
const PPP_FACTORS = {
  US: 1.00, GB: 0.95, DE: 0.90, FR: 0.90, JP: 0.85, AU: 0.92,
  CA: 0.92, CH: 1.05, SE: 0.92, NL: 0.90, SG: 0.95, AE: 0.98,
  RO: 0.35, PL: 0.40, CZ: 0.45, HU: 0.38, BG: 0.30, SK: 0.42,
  ES: 0.70, PT: 0.60, IT: 0.75, GR: 0.55, HR: 0.48, RS: 0.32,
  BR: 0.30, MX: 0.35, AR: 0.20, CO: 0.28, CL: 0.38, PE: 0.25,
  IN: 0.20, PK: 0.15, BD: 0.13, ID: 0.22, VN: 0.18, PH: 0.22,
  CN: 0.38, TH: 0.28, MY: 0.30, TW: 0.55, KR: 0.65, HK: 0.90,
  ZA: 0.25, NG: 0.12, KE: 0.14, EG: 0.16, MA: 0.20, GH: 0.13,
  TR: 0.28, SA: 0.60, IL: 0.90, UA: 0.20, RU: 0.30, KZ: 0.25,
};

// Country → currency mapping
const COUNTRY_CURRENCY = {
  US: { code: 'USD', symbol: '$',  name: 'US Dollar' },
  GB: { code: 'GBP', symbol: '£',  name: 'British Pound' },
  DE: { code: 'EUR', symbol: '€',  name: 'Euro' },
  FR: { code: 'EUR', symbol: '€',  name: 'Euro' },
  RO: { code: 'RON', symbol: 'lei',name: 'Romanian Leu' },
  IN: { code: 'INR', symbol: '₹',  name: 'Indian Rupee' },
  BR: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  CN: { code: 'CNY', symbol: '¥',  name: 'Chinese Yuan' },
  JP: { code: 'JPY', symbol: '¥',  name: 'Japanese Yen' },
  AU: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  CA: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  SA: { code: 'SAR', symbol: '﷼',  name: 'Saudi Riyal' },
};

/**
 * getRegionalPrice — compute PPP-adjusted price for a region
 * Calculează prețul ajustat PPP pentru o regiune
 */
function getRegionalPrice(basePriceUsd, countryCode) {
  const factor = PPP_FACTORS[countryCode] || 1.0;
  const adjusted = basePriceUsd * factor;
  // Round to friendly price points
  const rounded = adjusted < 1 ? +adjusted.toFixed(2)
    : adjusted < 10 ? Math.ceil(adjusted * 2) / 2
    : adjusted < 100 ? Math.ceil(adjusted / 5) * 5
    : Math.ceil(adjusted / 10) * 10;

  const currency = COUNTRY_CURRENCY[countryCode] || COUNTRY_CURRENCY.US;
  return {
    basePriceUsd,
    countryCode,
    pppFactor:   factor,
    localPrice:  rounded,
    currency:    currency.code,
    symbol:      currency.symbol,
    displayPrice: `${currency.symbol}${rounded}`,
    discount:    factor < 1 ? `${Math.round((1 - factor) * 100)}% regional discount` : null,
  };
}

/**
 * getPricingForRegion — full pricing catalog adjusted for a country
 */
function getPricingForRegion(countryCode) {
  const plans = [
    { id: 'starter',    baseUsd: 29,    name: 'Starter' },
    { id: 'pro',        baseUsd: 99,    name: 'Pro' },
    { id: 'enterprise', baseUsd: 499,   name: 'Enterprise' },
    { id: 'sme',        baseUsd: 199,   name: 'SME' },
    { id: 'mid-market', baseUsd: 1499,  name: 'Mid-Market' },
  ];
  return plans.map(p => ({
    ...p,
    pricing: getRegionalPrice(p.baseUsd, countryCode),
  }));
}

// ── §3  EXPANSION OPPORTUNITY SCORING ────────────────────────────────────

const EXPANSION_OPPORTUNITIES = [
  { country: 'IN', score: 95, market: 'India', reason: '1.4B population, high SaaS growth, PPP pricing competitive', language: 'hi', priority: 'critical' },
  { country: 'BR', score: 88, market: 'Brazil', reason: 'Largest LatAm economy, strong SaaS adoption, BRL pricing advantage', language: 'pt', priority: 'high' },
  { country: 'DE', score: 85, market: 'Germany', reason: 'High willingness-to-pay, strong enterprise market, GDPR-compliant', language: 'de', priority: 'high' },
  { country: 'ID', score: 82, market: 'Indonesia', reason: '270M population, rapid digital adoption, underserved SaaS market', language: 'en', priority: 'high' },
  { country: 'MX', score: 80, market: 'Mexico', reason: 'Growing tech sector, close to US market, Spanish content wins', language: 'es', priority: 'high' },
  { country: 'NG', score: 75, market: 'Nigeria', reason: 'Africa\'s largest economy, fintech boom, English-speaking', language: 'en', priority: 'medium' },
  { country: 'PH', score: 73, market: 'Philippines', reason: 'BPO hub, English-proficient, growing startup ecosystem', language: 'en', priority: 'medium' },
  { country: 'EG', score: 70, market: 'Egypt', reason: 'Largest Arab population, tech hub, Arabic localization wins', language: 'ar', priority: 'medium' },
  { country: 'SA', score: 78, market: 'Saudi Arabia', reason: 'Vision 2030, high GDP, enterprise SaaS demand', language: 'ar', priority: 'high' },
  { country: 'TR', score: 68, market: 'Turkey', reason: 'Large economy, digital transformation underway', language: 'en', priority: 'medium' },
];

function getExpansionOpportunities({ minScore = 0 } = {}) {
  return EXPANSION_OPPORTUNITIES
    .filter(o => o.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

// ── §4  REGIONAL STRATEGY ─────────────────────────────────────────────────

const REGIONAL_STRATEGIES = {
  EU:  { focus: ['enterprise', 'compliance', 'white-label'], paymentMethods: ['stripe', 'sepa'], gdpr: true },
  US:  { focus: ['saas', 'ai-automation', 'api'], paymentMethods: ['stripe', 'ach', 'btc'], gdpr: false },
  APAC:{ focus: ['sme', 'marketplace', 'localization'], paymentMethods: ['stripe', 'alipay', 'crypto'], gdpr: false },
  LATAM:{focus: ['sme', 'freelance', 'crypto'], paymentMethods: ['stripe', 'btc', 'usdt'], gdpr: false },
  MEA: { focus: ['enterprise', 'crypto', 'b2b'], paymentMethods: ['btc', 'usdt', 'wire'], gdpr: false },
  EE:  { focus: ['developer', 'saas', 'api'], paymentMethods: ['stripe', 'btc', 'crypto'], gdpr: true },
};

function getRegionStrategy(region) {
  return REGIONAL_STRATEGIES[region] || REGIONAL_STRATEGIES.US;
}

// ── §5  LANGUAGE DETECTION & TRANSLATION ─────────────────────────────────

function detectLanguage(req) {
  // From query, cookie, or Accept-Language header
  if (req?.query?.lang && LANGUAGES[req.query.lang]) return req.query.lang;
  const cookie = req?.cookies?.lang;
  if (cookie && LANGUAGES[cookie]) return cookie;
  const accept = req?.headers?.['accept-language'] || '';
  const primary = accept.split(',')[0].split('-')[0].toLowerCase();
  return LANGUAGES[primary] ? primary : 'en';
}

function translate(lang, key, fallback = '') {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? fallback;
}

// ── §6  REST ROUTER ───────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/languages', (_req, res) => {
    res.json({ ok: true, languages: Object.values(LANGUAGES) });
  });

  r.get('/opportunities', (req, res) => {
    const minScore = Number(req.query.minScore) || 0;
    res.json({ ok: true, opportunities: getExpansionOpportunities({ minScore }) });
  });

  r.get('/pricing/:countryCode', (req, res) => {
    const cc = req.params.countryCode.toUpperCase();
    res.json({ ok: true, country: cc, plans: getPricingForRegion(cc) });
  });

  r.get('/price-adjust', (req, res) => {
    const { price, country } = req.query;
    if (!price || !country) return res.status(400).json({ ok: false, error: 'price and country required' });
    res.json({ ok: true, ...getRegionalPrice(Number(price), country.toUpperCase()) });
  });

  r.get('/strategy/:region', (req, res) => {
    res.json({ ok: true, region: req.params.region, strategy: getRegionStrategy(req.params.region.toUpperCase()) });
  });

  r.get('/translate', (req, res) => {
    const { lang, key } = req.query;
    res.json({ ok: true, lang, key, translation: translate(lang || 'en', key || '') });
  });

  r.get('/translations/:lang', (req, res) => {
    const lang = req.params.lang;
    if (!LANGUAGES[lang]) return res.status(404).json({ ok: false, error: `Language ${lang} not supported` });
    res.json({ ok: true, lang, translations: TRANSLATIONS[lang] || TRANSLATIONS.en });
  });

  return r;
}

function getStatus() {
  return {
    name:           'expansion-engine',
    label:          'Global Expansion Engine',
    health:         'good',
    supportedLanguages: Object.keys(LANGUAGES).length,
    supportedRegions:   Object.keys(PPP_FACTORS).length,
    topOpportunity: EXPANSION_OPPORTUNITIES[0],
  };
}

module.exports = {
  getRegionalPrice,
  getPricingForRegion,
  getExpansionOpportunities,
  getRegionStrategy,
  detectLanguage,
  translate,
  LANGUAGES,
  TRANSLATIONS,
  PPP_FACTORS,
  getStatus,
  router,
};
