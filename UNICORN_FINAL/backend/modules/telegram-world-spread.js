'use strict';

/**
 * Telegram world spread.
 *
 * Posts the live shelf into the bound channel and answers inline queries so
 * a person can drop the same card into any chat they choose. Prices come
 * from priceNegotiator. Member count is whatever Telegram returns for the
 * bound chat. The copy does not estimate an audience and does not message
 * people who did not ask.
 */
const SITE = String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://zeusai.pro').replace(/\/$/, '');

const OFFERS = [
  { id: 'instant-website-audit', title: 'Instant Website Audit' },
  { id: 'instant-resume-makeover', title: 'Instant Resume + LinkedIn Makeover' },
  { id: 'instant-logo-kit', title: 'Instant Brand Logo Kit' },
];

let _cache = { at: 0, offers: [] };
const CACHE_MS = 5 * 60 * 1000;

function money(usd) {
  const n = Number(usd);
  if (!(n > 0)) return null;
  return '$' + n.toFixed(2);
}

function offerUrl(id) {
  const u = new URL(SITE + '/checkout');
  u.searchParams.set('serviceId', id);
  u.searchParams.set('utm_source', 'telegram');
  u.searchParams.set('utm_medium', 'channel');
  u.searchParams.set('utm_campaign', 'world-spread');
  return u.toString();
}

function shareUrl(pageUrl, text) {
  const u = new URL('https://t.me/share/url');
  u.searchParams.set('url', pageUrl);
  u.searchParams.set('text', String(text || '').slice(0, 180));
  return u.toString();
}

async function liveOffers() {
  if (_cache.offers.length && (Date.now() - _cache.at) < CACHE_MS) return _cache.offers;
  let priceNegotiator = null;
  try { priceNegotiator = require('./priceNegotiator'); } catch (_) { priceNegotiator = null; }
  const offers = [];
  for (const item of OFFERS) {
    if (!priceNegotiator || typeof priceNegotiator.getPrice !== 'function') break;
    try {
      const quote = await priceNegotiator.getPrice(item.id, {});
      const usd = quote && Number(quote.usd);
      if (!(usd > 0)) continue;
      offers.push({
        id: quote.serviceId || item.id,
        title: item.title,
        usd,
        source: quote.source || 'priceNegotiator',
      });
    } catch (_) { /* skip this offer */ }
  }
  _cache = { at: Date.now(), offers };
  return offers;
}

function buildPost(input) {
  const opts = input || {};
  const offers = Array.isArray(opts.offers) ? opts.offers : [];
  const priced = offers.filter((row) => row && money(row.usd));
  const members = opts.members;
  const hasMembers = typeof members === 'number' && Number.isFinite(members) && members >= 0;
  const lines = priced.map((row) => '• ' + row.title + ' — ' + money(row.usd));
  const page = opts.cta || (SITE + '/services');
  const text = [
    'ZeusAI · zeusai.pro',
    '',
    priced.length
      ? 'Live shelf. The dollar amount is the same pricer checkout uses.'
      : 'The shelf pricer did not answer. Open the site for the current list.',
    '',
    ...(lines.length ? lines : ['Catalog → ' + page]),
    '',
    hasMembers
      ? ('Telegram reports ' + members + ' members in this chat.')
      : 'Member count is read from Telegram when this bot is an admin. It is not estimated.',
    '',
    'Share this card into a chat you choose. The bot does not message strangers.',
  ].join('\n');
  const buttons = [[
    { text: 'Open zeusai.pro', url: page },
    { text: 'Share', url: shareUrl(page, 'ZeusAI live shelf') },
  ]];
  if (opts.invite) buttons.push([{ text: 'Join the channel', url: String(opts.invite) }]);
  if (priced[0]) buttons.push([{ text: priced[0].title, url: offerUrl(priced[0].id) }]);
  return { ok: true, text, buttons, offers: priced };
}

async function buildLivePost(input) {
  const offers = (input && input.offers) || await liveOffers();
  return buildPost(Object.assign({}, input, { offers }));
}

function inlineResults(offers) {
  const priced = (offers || []).filter((row) => row && money(row.usd)).slice(0, 3);
  if (!priced.length) {
    return [{
      type: 'article',
      id: 'zeusai-site',
      title: 'ZeusAI',
      description: 'Open zeusai.pro',
      input_message_content: { message_text: 'ZeusAI\n' + SITE },
    }];
  }
  return priced.map((row) => ({
    type: 'article',
    id: row.id,
    title: row.title + ' — ' + money(row.usd),
    description: 'ZeusAI · zeusai.pro',
    input_message_content: {
      message_text: row.title + '\n' + money(row.usd) + '\n' + offerUrl(row.id),
    },
  }));
}

async function answerInline(tg, query) {
  if (!query || !query.id || typeof tg !== 'function') return { ok: false, reason: 'query_required' };
  const offers = await liveOffers();
  return tg('answerInlineQuery', {
    inline_query_id: query.id,
    results: inlineResults(offers),
    cache_time: 300,
    is_personal: false,
  });
}

async function measureMembers(tg, chatId) {
  if (typeof tg !== 'function' || !chatId) return { ok: false, reason: 'not_configured' };
  const r = await tg('getChatMemberCount', { chat_id: chatId });
  const members = r && r.ok ? Number(r.result) : NaN;
  if (!Number.isFinite(members)) return { ok: false, reason: 'no_count' };
  return { ok: true, members };
}

function _resetCache() { _cache = { at: 0, offers: [] }; }

module.exports = {
  OFFERS,
  offerUrl,
  shareUrl,
  buildPost,
  buildLivePost,
  inlineResults,
  answerInline,
  liveOffers,
  measureMembers,
  _resetCache,
};
