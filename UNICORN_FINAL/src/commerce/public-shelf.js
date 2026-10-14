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

const LIMITS = [
  {
    keys: ['dropship', 'printful', 'cj dropshipping', 'supplier feed', 'furnizor'],
    href: '/zacc',
    titleEn: 'Dropship is paused',
    titleRo: 'Dropship este în pauză',
    noteEn: 'Supplier connectors stay off until credentials exist. This is not a product and it has no price.',
    noteRo: 'Conectorii de furnizori rămân opriți până există credențiale. Nu este un produs și nu are preț.',
    ctaEn: 'Read the paused cockpit',
    ctaRo: 'Vezi cabina în pauză',
  },
  {
    keys: ['quantum', 'orbital', 'implant', 'neural', 'frontier', 'cuantic', 'cuantică'],
    href: '/frontier',
    titleEn: 'Frontier is research',
    titleRo: 'Frontier este cercetare',
    noteEn: 'You can read the frontier desk. It does not sell orbital compute, a neural implant, or a quantum channel, and it has no price.',
    noteRo: 'Poți citi biroul frontier. Nu vinde calcul orbital, un implant neural sau un canal cuantic și nu are preț.',
    ctaEn: 'Read the research',
    ctaRo: 'Citește cercetarea',
  },
  {
    keys: ['vertical', 'industrie', 'industry os', 'pharma', 'vom', 'architecture pack', 'pachet de industrie'],
    href: '/vom',
    titleEn: 'Industry packs are a kickoff',
    titleRo: 'Pachetele de industrie sunt un kickoff',
    noteEn: 'An industry architecture pack is an engagement kickoff, not a finished system delivered on payment. The list is on /vom. It is not a separate priced product here.',
    noteRo: 'Un pachet de arhitectură pe industrie este un kickoff de angajament, nu un sistem finit livrat la plată. Lista este pe /vom. Nu este un produs cu preț separat aici.',
    ctaEn: 'See the kickoff list',
    ctaRo: 'Vezi lista de kickoff',
  },
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

function whenLang(item, lang) {
  if (lang !== 'ro') return item.when;
  if (item.id === 'ent-engagement-kickoff') return 'Pachetul de propunere după plată · se creditează la un angajament semnat';
  if (item.clock === 'contract') return 'Cere o propunere · nu este o descărcare instant';
  const mins = Number(item.deliveryMinutes);
  if (mins > 0) return 'Cam ' + mins + ' min după confirmarea plății';
  const days = Number(item.deliveryDays);
  if (days > 0) return 'Pachetul de kickoff acum · echipa livrează în cam ' + days + ' zile · nu este o descărcare instant';
  if (item.clock === 'days') return 'Pachetul de kickoff acum · livrare umană în fereastra anunțată · nu este o descărcare instant';
  return 'După confirmarea plății';
}

function strategy(item, lang) {
  const price = money(item.priceUsd);
  const per = item.billing === 'annual' ? (lang === 'ro' ? '/an' : '/yr') : '';
  const when = whenLang(item, lang);
  if (item.id === 'ent-engagement-kickoff') {
    return lang === 'ro'
      ? `Plătești ${price}. Primești brief-ul, propunerea comercială și draftul de contract. Suma se creditează la un angajament semnat. Nu livrează licența, sursa sau cloud-ul.`
      : `Pay ${price}. You receive the discovery brief, the commercial proposal, and a draft statement of work. The amount is credited toward a signed engagement. It does not deliver the license, the source, or a private cloud.`;
  }
  if (item.mode === 'contact') {
    return lang === 'ro'
      ? `Cifra listată este ${price}${per}. Nu este un coș. Butonul cere o propunere. ${when}.`
      : `The listed figure is ${price}${per}. It is not a cart. The button requests a proposal. ${when}.`;
  }
  if (item.clock === 'days') {
    const days = Number(item.deliveryDays) || 0;
    return lang === 'ro'
      ? `Rezervi ${price}. Primești pachetul de kickoff acum. Sistemul finit ajunge${days ? ' în cam ' + days + ' zile' : ''}. Nu este o descărcare instant.`
      : `Reserve ${price}. The kickoff pack unlocks now. The finished system arrives${days ? ' in about ' + days + ' days' : ''}. It is not an instant download.`;
  }
  return lang === 'ro'
    ? `Plătești ${price}. Primești ${item.title}. ${when}. Bitcoin este calea deschisă. Cardul și PayPal apar la checkout când sunt configurate.`
    : `Pay ${price}. You receive ${item.title}. ${item.when}. Bitcoin is the live rail. Card and PayPal appear on checkout when they are configured.`;
}

function roleLabel(role, lang) {
  if (role === 'aside') return lang === 'ro' ? 'Nu este de vânzare' : 'Not for sale';
  if (role === 'unasked') return lang === 'ro' ? 'Nu ai cerut asta' : 'You did not ask for this';
  if (role === 'start') return lang === 'ro' ? 'O ușă reală' : 'A real door';
  return lang === 'ro' ? 'Potrivit cu ce ai spus' : 'Matched to what you said';
}

function limitView(limit, lang) {
  const ro = lang === 'ro';
  return {
    id: null,
    title: ro ? limit.titleRo : limit.titleEn,
    description: ro ? limit.noteRo : limit.noteEn,
    strategy: ro ? limit.noteRo : limit.noteEn,
    role: 'aside',
    roleLabel: roleLabel('aside', lang),
    priced: false,
    priceUsd: null,
    priceLabel: '',
    priceBtc: 0,
    mode: 'unavailable',
    buyable: false,
    ctaLabel: ro ? limit.ctaRo : limit.ctaEn,
    ctaHref: limit.href,
  };
}

function matchedLimits(text, lang) {
  const hay = String(text || '').toLowerCase();
  const out = [];
  for (const limit of LIMITS) {
    if (!limit.keys.some((key) => hay.includes(key))) continue;
    out.push(limitView(limit, lang));
  }
  return out;
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

function scopeOf(lane) {
  const id = String((lane && lane.ids && lane.ids[0]) || '');
  if (id.startsWith('ent-')) return 'platform';
  if (id.startsWith('professional-')) return 'build';
  return 'file';
}

function fold(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ă/g, 'a')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't');
}

function hasTerm(hay, term) {
  if (term.includes(' ')) return hay.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)').test(hay);
}

const ORGS = [
  { org: 'AWS', keys: ['amazon web services', 'aws'] },
  { org: 'Google', keys: ['google cloud', 'gcp', 'alphabet', 'google'] },
  { org: 'Microsoft', keys: ['azure', 'microsoft'] },
  { org: 'Meta', keys: ['facebook', 'meta'] },
];

const COMPANY_TERMS = ['company', 'companie', 'firma', 'startup', 'enterprise', 'business', 'afacere', 'clinic', 'clinica', 'echipa', 'organization', 'organisation', 'corporatie'];
const PERSON_TERMS = ['resume', 'cv', 'personal', 'freelancer', 'angajare', 'persoana', 'pentru mine', 'for me', 'i am', 'eu sunt'];
const PLATFORM_TERMS = [
  'private cloud', 'cloud privat', 'platform license', 'enterprise license', 'the license', 'o licenta',
  'source code', 'codul sursa', 'white-label', 'white label', 'on-prem', 'on prem', 'sovereign', 'suveran',
  'acquisition', 'achizitie', 'multi-tenant', 'dedicated tenant', 'whole platform', 'entire platform',
  'the platform', 'replace aws', 'replace google', 'landing zone', 'control tower',
];
const SHELF_STOP = new Set([
  'this', 'that', 'with', 'from', 'your', 'have', 'need', 'want', 'help', 'what', 'when', 'where',
  'which', 'about', 'just', 'please', 'pentru', 'vreau', 'vrea', 'nostru', 'noastra', 'suntem',
  'este', 'sunt', 'care', 'ceva', 'something', 'anything', 'customer', 'customers', 'client',
  'clients', 'company', 'google', 'amazon', 'microsoft', 'azure', 'facebook', 'their', 'them',
  'they', 'ours', 'mai', 'dupa', 'unei', 'unui', 'work', 'works', 'make', 'made',
]);

function readBuyer(text) {
  const hay = fold(text);
  let org = null;
  for (const row of ORGS) {
    if (row.keys.some((key) => hasTerm(hay, key))) { org = row.org; break; }
  }
  const company = COMPANY_TERMS.some((term) => hasTerm(hay, term));
  const person = PERSON_TERMS.some((term) => hasTerm(hay, term)) || hasTerm(hay, 'i') || hasTerm(hay, 'eu');
  let kind = 'unknown';
  if (org && person && !company) kind = 'person';
  else if (org) kind = 'hyperscale';
  else if (company) kind = 'company';
  else if (person) kind = 'person';
  return { kind, org };
}

function explicitPlatform(text) {
  const hay = fold(text);
  return PLATFORM_TERMS.some((term) => hay.includes(term)) || hasTerm(hay, 'licenta');
}

function doorOf(item) {
  if (!item) return 'explore';
  if (item.id === 'ent-engagement-kickoff' || item.clock === 'contract') return 'platform';
  if (item.clock === 'days') return 'build';
  return 'file';
}

function fitQuestion(buyer, door, lang, count, limitNote) {
  const n = count;
  const org = buyer && buyer.org;
  const kind = buyer && buyer.kind;
  const replace = org
    ? (lang === 'ro' ? (' Unicorn nu înlocuiește ' + org + '.') : (' Unicorn does not replace ' + org + '.'))
    : '';
  let who = lang === 'ro' ? 'Te-am auzit.' : 'Heard the request.';
  if (org && kind === 'person') who = lang === 'ro' ? ('Te-am auzit ca persoană de la ' + org + '.') : ('Heard as a person at ' + org + '.');
  else if (org) who = lang === 'ro' ? ('Te-am auzit ca ' + org + '.') : ('Heard as ' + org + '.');
  else if (kind === 'company') who = lang === 'ro' ? 'Te-am auzit ca o companie.' : 'Heard as a company.';
  else if (kind === 'person') who = lang === 'ro' ? 'Te-am auzit ca om.' : 'Heard as a person.';
  let doorLine;
  if (door === 'platform') {
    doorLine = lang === 'ro'
      ? ('Am citit toate cele ' + n + ' oferte publice.' + (org ? '' : ' Unicorn nu înlocuiește un cloud mare.') + ' Ușa care se plătește acum este kickoff-ul. Licența, sursa și cloud-ul privat rămân propuneri.')
      : ('I read all ' + n + ' public offers.' + (org ? '' : ' Unicorn does not replace that cloud.') + ' The payable start is the engagement kickoff. The license, the source, and a private cloud stay proposals.');
  } else if (door === 'build') {
    doorLine = lang === 'ro'
      ? ('Am citit toate cele ' + n + ' oferte publice. Cererea este o construcție, așa că ușa este rezervarea pe zile, nu un fișier de minute și nu licența.')
      : ('I read all ' + n + ' public offers. The request is a build, so the door is the day-clock reservation, not a minute file and not the license.');
  } else if (door === 'file') {
    doorLine = lang === 'ro'
      ? ('Am citit toate cele ' + n + ' oferte publice. Cererea este un fișier, așa că ușa este fișierul potrivit, nu platforma.')
      : ('I read all ' + n + ' public offers. The request is a file, so the door is that file, not the platform.');
  } else {
    doorLine = lang === 'ro'
      ? ('Nu am potrivit o cerere precisă. Am citit toate cele ' + n + ' oferte publice. Astea sunt trei intrări reale: un fișier, o rezervare și kickoff-ul de contract.')
      : ('No precise match. I read all ' + n + ' public offers. These three are real doors: a file, a reservation, and the contract kickoff.');
  }
  return (who + replace + ' ' + doorLine + (limitNote || '')).replace(/\s+/g, ' ').trim();
}

function rankShelf(text, shelf) {
  const tokens = fold(text).split(/[^a-z0-9]+/).filter((tok) => tok.length >= 4 && !SHELF_STOP.has(tok));
  const ranked = [];
  for (const item of shelf) {
    const hay = fold(item.title + ' ' + String(item.id || '').replace(/-/g, ' '));
    const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
    let score = 0;
    for (const tok of tokens) {
      const stem = tok.endsWith('s') && tok.length >= 5 ? tok.slice(0, -1) : tok;
      const hit = hay.includes(tok) || (stem.length >= 4 && words.some((word) => word.startsWith(stem) && word.length - stem.length <= 4));
      if (hit) score += tok.length;
    }
    if (score >= 8) ranked.push({ item, score });
  }
  ranked.sort((a, b) => b.score - a.score || Number(a.item.priceUsd || 0) - Number(b.item.priceUsd || 0));
  return ranked;
}

function advise(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  const lang = langOf(raw);
  const shelf = publicShelf();
  const by = new Map(shelf.map((p) => [p.id, p]));
  const buyer = readBuyer(raw);
  const emptyQuestion = lang === 'ro'
    ? 'Spune ce faci și ce vrei să existe după plată. Răspunsul vine doar din raftul public.'
    : 'Say what you do and what you want to exist after you pay. The answer comes only from the public shelf.';
  const limits = matchedLimits(raw, lang);
  const base = { ok: true, lang, buyer, knownOffers: shelf.length, limits };
  if (!raw) {
    return Object.assign({}, base, { heard: '', primary: null, also: [], question: emptyQuestion });
  }
  const limitNote = limits[0] ? (' ' + limits[0].strategy) : '';
  const platformLane = LANES.find((lane) => scopeOf(lane) === 'platform') || null;
  const platformAsk = explicitPlatform(raw);
  let best = null;
  let bestScore = 0;
  for (const lane of LANES) {
    const score = scoreLane(raw, lane);
    if (score > bestScore) { best = lane; bestScore = score; }
  }
  if (platformAsk && platformLane) best = platformLane;
  const heard = raw.slice(0, 180);
  if (!best) {
    const ranked = rankShelf(raw, shelf);
    if (ranked.length) {
      let top = ranked[0].item;
      const also = [];
      if (top.clock === 'contract' && top.id !== 'ent-engagement-kickoff') {
        const kick = by.get('ent-engagement-kickoff');
        if (kick) {
          also.push(offerView(top, lang, 'match'));
          top = kick;
        }
      }
      const second = ranked.find((row) => row.item.id !== top.id && !also.some((x) => x.id === row.item.id));
      if (second) also.push(offerView(second.item, lang, 'match'));
      if (!also.some((x) => x.role === 'unasked')) {
        const neighbor = shelf.find((item) => item.id !== top.id && item.clock !== top.clock && !also.some((x) => x.id === item.id));
        if (neighbor) also.push(offerView(neighbor, lang, 'unasked'));
      }
      const primary = offerView(top, lang, 'match');
      return Object.assign({}, base, {
        heard,
        primary,
        also,
        question: fitQuestion(buyer, doorOf(top), lang, shelf.length, limitNote),
      });
    }
    if (buyer.kind === 'hyperscale' && platformLane) best = platformLane;
  }
  if (!best) {
    const starters = ['instant-website-audit', 'professional-ai-chatbot', 'ent-engagement-kickoff']
      .map((id) => by.get(id)).filter(Boolean).map((item) => offerView(item, lang, 'start'));
    return Object.assign({}, base, {
      heard,
      primary: starters[0] || null,
      also: starters.slice(1),
      question: fitQuestion(buyer, 'explore', lang, shelf.length, limitNote),
    });
  }
  const primaryItem = best.ids.map((id) => by.get(id)).find(Boolean) || null;
  const scored = LANES
    .map((lane) => ({ lane, score: scoreLane(raw, lane) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const also = [];
  const pushAlso = (id, role) => {
    if (!primaryItem || id === primaryItem.id || also.some((x) => x.id === id)) return;
    const item = by.get(id);
    if (!item) return;
    also.push(offerView(item, lang, role));
  };
  const named = [];
  for (const row of scored.slice(1)) {
    for (const id of row.lane.ids) {
      if (primaryItem && id !== primaryItem.id && by.has(id) && !named.includes(id)) named.push(id);
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
  if (platformAsk) {
    for (const id of best.also) {
      pushAlso(id, 'match');
      if (also.some((x) => x.mode === 'contact')) break;
    }
  }
  const primary = primaryItem ? offerView(primaryItem, lang, 'match') : null;
  return Object.assign({}, base, {
    heard,
    primary,
    also,
    question: fitQuestion(buyer, platformAsk ? 'platform' : doorOf(primaryItem), lang, shelf.length, limitNote),
  });
}

module.exports = { publicShelf, byId, advise, money, PROTOCOL: 'SHELF/1.0' };
