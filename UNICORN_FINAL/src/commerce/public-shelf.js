'use strict';

/**
 * Public shelf — the one commercial contract for SSR and /api/shelf.
 * Curated instant, professional, and enterprise offers only.
 * Prices, delivery clocks, and buy/reserve/proposal buttons come from
 * the same record the checkout page reads.
 */

const LANES = [
  { keys: ['resume', 'cv', 'linkedin', 'curriculum', 'job hunt', 'angajare', 'loc de munca', 'loc de muncă'], ids: ['instant-resume-makeover'], also: ['instant-brand-voice', 'professional-investor-package'] },
  { keys: ['logo', 'brand', 'naming', 'nume de produs', 'identitate'], ids: ['instant-logo-kit', 'instant-product-naming', 'instant-brand-voice'], also: ['instant-social-media-kit'] },
  { keys: ['seo', 'audit', 'keywords', 'cuvinte cheie'], ids: ['instant-website-audit', 'instant-seo-content-pack'], also: ['instant-landing-page'] },
  { keys: ['landing', 'homepage', 'website', 'site web', 'pagina', 'pagină', 'site'], ids: ['instant-landing-page', 'instant-website-audit'], also: ['instant-seo-content-pack', 'professional-ai-chatbot'] },
  { keys: ['social', 'instagram', 'postari', 'postări', 'posts'], ids: ['instant-social-media-kit'], also: ['professional-ai-marketing', 'instant-email-sequence'] },
  { keys: ['email', 'newsletter', 'onboarding'], ids: ['instant-email-sequence'], also: ['professional-ai-marketing'] },
  { keys: ['pitch', 'investor', 'investitor', 'deck', 'funding', 'seed round'], ids: ['instant-pitch-deck', 'professional-investor-package'], also: ['instant-product-naming'] },
  { keys: ['saas', 'mvp', 'startup'], ids: ['professional-saas-mvp'], also: ['instant-landing-page', 'professional-ai-agent'] },
  { keys: ['mobile', 'ios', 'android'], ids: ['professional-mobile-app'], also: ['professional-saas-mvp'] },
  { keys: ['chatbot', 'rag', 'agent ai', 'ai agent', 'asistent', 'clinic', 'clinica', 'clinică', 'patient', 'pacient', 'questions', 'întrebări', 'intrebari'], ids: ['professional-ai-chatbot', 'professional-ai-agent'], also: ['instant-landing-page', 'instant-website-audit'] },
  { keys: ['magazin', 'ecommerce', 'e-commerce', 'shopify', 'store', 'shop'], ids: ['professional-ecommerce-store'], also: ['instant-landing-page', 'instant-seo-content-pack', 'professional-ai-chatbot'] },
  { keys: ['pipeline', 'dashboard', 'warehouse', 'kpi'], ids: ['professional-data-pipeline'], also: ['instant-website-audit'] },
  { keys: ['marketing', 'leads', 'campanie', 'clienți', 'clienti'], ids: ['professional-ai-marketing', 'instant-email-sequence'], also: ['instant-landing-page', 'instant-social-media-kit'] },
  { keys: ['enterprise', 'licen', 'license', 'acquisition', 'achiziti', 'achiziți', 'source code', 'white-label', 'white label', 'on-prem', 'sovereign', 'suveran', 'private cloud', 'transformare'], ids: ['ent-engagement-kickoff'], also: ['ent-platform-license', 'ent-private-cloud', 'ent-acquisition-pack', 'ent-sovereign-deployment'] },
];

function spotUsd() {
  try {
    const cache = global.__btcSpotCache || global._btcSpotCache;
    if (cache && Number(cache.usdPerBtc) > 0) return Number(cache.usdPerBtc);
  } catch (_) { /* fallback */ }
  return 95000;
}

function money(n) {
  const price = Number(n) || 0;
  const frac = Number.isFinite(price) && Math.abs(price - Math.round(price)) > 0.0049;
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 });
}

function clockOf(raw) {
  const id = String((raw && raw.id) || '');
  const tier = String((raw && raw.tier) || '');
  if (tier === 'enterprise' || /^ent-/i.test(id)) return 'contract';
  if (tier === 'professional' || /^professional-/i.test(id) || Number(raw && raw.deliveryDays) > 0) return 'days';
  return 'minutes';
}

function whenOf(raw) {
  const id = String((raw && raw.id) || '');
  if (id === 'ent-engagement-kickoff') return 'Proposal pack after payment · credited toward a signed engagement';
  const clock = clockOf(raw);
  if (clock === 'contract') return 'Request a proposal · not an instant download';
  const mins = Number(raw && raw.deliveryMinutes);
  if (mins > 0) return 'About ' + mins + ' min after payment settles';
  const days = Number(raw && raw.deliveryDays);
  if (days > 0) return 'Kickoff pack now · team delivery about ' + days + ' days · not an instant download';
  if (clock === 'days') return 'Kickoff pack now · human delivery on the stated window · not an instant download';
  return 'After payment settles';
}

function livePrice(id, floor) {
  try {
    const dp = require('../../backend/modules/dynamic-pricing');
    if (dp && typeof dp.registerService === 'function' && floor > 0) {
      try { dp.registerService(id, floor, { force: false }); } catch (_) {}
    }
    if (dp && typeof dp.getPrice === 'function') {
      const got = dp.getPrice(id, floor > 0 ? { basePrice: floor } : {});
      if (got && Number(got.finalPrice) > 0 && got.baseSource !== 'fallback-default') {
        return { priceUsd: Number(got.finalPrice), livePrice: true };
      }
    }
  } catch (_) { /* seed price */ }
  return { priceUsd: floor, livePrice: false };
}

function toRecord(raw) {
  const floor = Number(raw.priceUSD != null ? raw.priceUSD : raw.priceUsd || 0);
  const priced = livePrice(String(raw.id), floor);
  const record = {
    id: String(raw.id),
    title: String(raw.title || raw.id),
    description: String(raw.description || ''),
    tier: String(raw.tier || 'instant'),
    clock: clockOf(raw),
    when: whenOf(raw),
    priceUsd: priced.priceUsd,
    priceFloorUsd: floor,
    billing: raw.billing || null,
    revenueShare: raw.revenueShare != null ? Number(raw.revenueShare) : null,
    deliveryMinutes: raw.deliveryMinutes != null ? Number(raw.deliveryMinutes) : null,
    deliveryDays: raw.deliveryDays != null ? Number(raw.deliveryDays) : null,
    livePrice: priced.livePrice,
    priceBtc: priced.priceUsd > 0 ? Number((priced.priceUsd / spotUsd()).toFixed(8)) : 0,
  };
  let assessed = { mode: 'unavailable', buyable: false, ctaLabel: 'Unavailable', ctaHref: null };
  try {
    assessed = require('./commerce-buyability').assessBuyability(record);
  } catch (_) { /* keep unavailable */ }
  record.mode = assessed.mode;
  record.buyable = assessed.buyable === true;
  record.ctaHref = assessed.ctaHref || null;
  record.ctaLabel = assessed.mode === 'contact' ? 'Request a proposal →' : (assessed.ctaLabel || 'Buy → choose payment');
  return record;
}

function publicShelf() {
  const seen = new Set();
  const rows = [];
  let instant = [];
  let enterprise = [];
  try { instant = require('./instant-catalog').all() || []; } catch (_) { instant = []; }
  try { enterprise = require('./enterprise-catalog').all() || []; } catch (_) { enterprise = []; }
  for (const raw of instant.concat(enterprise)) {
    if (!raw || !raw.id || seen.has(String(raw.id))) continue;
    seen.add(String(raw.id));
    rows.push(toRecord(raw));
  }
  const rank = { minutes: 0, days: 1, contract: 2 };
  rows.sort((a, b) => {
    const c = (rank[a.clock] || 0) - (rank[b.clock] || 0);
    if (c) return c;
    if (a.id === 'ent-engagement-kickoff') return -1;
    if (b.id === 'ent-engagement-kickoff') return 1;
    return Number(a.priceUsd || 0) - Number(b.priceUsd || 0);
  });
  return rows;
}

function byId(id) {
  const key = String(id || '');
  return publicShelf().find((p) => p.id === key) || null;
}

function langOf(text) {
  return /[ăâîșțĂÂÎȘȚ]|\b(vreau|vrea|fac|faci|pentru|companie|clinica|clinică|am nevoie|ajuta|ajută|oferă|pret|preț|magazin)\b/i.test(text) ? 'ro' : 'en';
}

function strategy(item, lang) {
  const price = money(item.priceUsd);
  const per = item.billing === 'annual' ? (lang === 'ro' ? '/an' : '/yr') : '';
  if (item.id === 'ent-engagement-kickoff') {
    return lang === 'ro'
      ? `Plătești ${price}. Primești brief-ul, propunerea comercială și draftul de contract. Suma se creditează la un angajament semnat. Nu livrează licența, sursa sau cloud-ul.`
      : `Pay ${price}. You receive the discovery brief, the commercial proposal, and a draft statement of work. The amount is credited toward a signed engagement. It does not deliver the license, the source, or a private cloud.`;
  }
  if (item.mode === 'contact') {
    return lang === 'ro'
      ? `Cifra listată este ${price}${per}. Nu este un coș. Butonul cere o propunere. ${item.when}.`
      : `The listed figure is ${price}${per}. It is not a cart. The button requests a proposal. ${item.when}.`;
  }
  if (item.clock === 'days') {
    return lang === 'ro'
      ? `Rezervi ${price}. Pachetul de kickoff se deblochează acum. Echipa livrează sistemul finit. ${item.when}.`
      : `Reserve ${price}. The kickoff pack unlocks now. The team delivers the finished system. ${item.when}.`;
  }
  return lang === 'ro'
    ? `Plătești ${price}. După confirmarea plății primești: ${item.description} ${item.when}. Bitcoin este calea deschisă. Cardul și PayPal apar la checkout când sunt configurate.`
    : `Pay ${price}. After payment settles you receive: ${item.description} ${item.when}. Bitcoin is the live rail. Card and PayPal appear on checkout when they are configured.`;
}

function roleLabel(role, lang) {
  if (role === 'unasked') return lang === 'ro' ? 'Nu ai cerut asta' : 'You did not ask for this';
  if (role === 'start') return lang === 'ro' ? 'O ușă reală' : 'A real door';
  return lang === 'ro' ? 'Potrivit cu ce ai spus' : 'Matched to what you said';
}

function offerView(item, lang, role) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    clock: item.clock,
    when: item.when,
    priceUsd: item.priceUsd,
    priceLabel: money(item.priceUsd),
    priceBtc: item.priceBtc,
    billing: item.billing,
    mode: item.mode,
    buyable: item.buyable,
    ctaLabel: item.ctaLabel,
    ctaHref: item.ctaHref,
    strategy: strategy(item, lang),
    role,
    roleLabel: roleLabel(role, lang),
  };
}

function scoreLane(text, lane) {
  const hay = text.toLowerCase();
  let score = 0;
  for (const key of lane.keys) {
    if (hay.includes(key)) score += key.length;
  }
  return score;
}

function advise(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  const lang = langOf(raw);
  const shelf = publicShelf();
  const by = new Map(shelf.map((p) => [p.id, p]));
  const question = lang === 'ro'
    ? 'Dacă nu asta e treaba, spune cine cumpără și ce trebuie să existe în ziua plății.'
    : 'If that is the wrong job, say who is buying and what must exist on the day you pay.';
  const emptyQuestion = lang === 'ro'
    ? 'Spune ce faci și ce vrei să existe după plată. Răspunsul vine doar din raftul public.'
    : 'Say what you do and what you want to exist after you pay. The answer comes only from the public shelf.';
  if (!raw) {
    return { ok: true, lang, heard: '', primary: null, also: [], question: emptyQuestion };
  }
  let best = null;
  let bestScore = 0;
  for (const lane of LANES) {
    const score = scoreLane(raw, lane);
    if (score > bestScore) { best = lane; bestScore = score; }
  }
  if (!best) {
    const starters = ['instant-website-audit', 'professional-ai-chatbot', 'ent-engagement-kickoff']
      .map((id) => by.get(id)).filter(Boolean).map((item) => offerView(item, lang, 'start'));
    return {
      ok: true,
      lang,
      heard: raw.slice(0, 180),
      primary: starters[0] || null,
      also: starters.slice(1),
      question: lang === 'ro'
        ? 'Nu am potrivit o cerere precisă. Astea sunt trei intrări reale: un fișier, o rezervare și kickoff-ul de contract. Spune mai concret ce livrezi clienților tăi.'
        : 'No precise match. These three are real doors: a file, a reservation, and the contract kickoff. Say more concretely what you deliver to your own customers.',
    };
  }
  const primary = best.ids.map((id) => by.get(id)).find(Boolean) || null;
  const scored = LANES
    .map((lane) => ({ lane, score: scoreLane(raw, lane) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const also = [];
  const pushAlso = (id, role) => {
    if (!primary || id === primary.id || also.some((x) => x.id === id)) return;
    const item = by.get(id);
    if (!item) return;
    also.push(offerView(item, lang, role));
  };
  const named = [];
  for (const row of scored.slice(1)) {
    for (const id of row.lane.ids) {
      if (primary && id !== primary.id && by.has(id) && !named.includes(id)) named.push(id);
    }
  }
  if (named[0]) pushAlso(named[0], 'match');
  const surprise = best.also.find((id) => !named.includes(id) && !scored.some((row) => row.lane.ids.includes(id)));
  if (surprise) pushAlso(surprise, 'unasked');
  else {
    for (const id of best.also) {
      pushAlso(id, 'unasked');
      if (also.some((x) => x.role === 'unasked')) break;
    }
  }
  return {
    ok: true,
    lang,
    heard: raw.slice(0, 180),
    primary: primary ? offerView(primary, lang, 'match') : null,
    also,
    question,
  };
}

module.exports = { publicShelf, byId, advise, money, PROTOCOL: 'SHELF/1.0' };
