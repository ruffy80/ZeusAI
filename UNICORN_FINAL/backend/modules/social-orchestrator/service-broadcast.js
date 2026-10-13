'use strict';

/**
 * Unicorn publishes every buyable public-shelf service on ZeusAI Social.
 * Outbound networks are listed as armed only when their keys are present.
 * This module does not invent reach, followers, or cash.
 */

const surface = require('./social-surface');

const ORIGIN = String(process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');
const CHANNELS = [
  { id: 'x', label: 'X', keys: ['X_BEARER_TOKEN'], alt: [['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET']] },
  { id: 'facebook', label: 'Facebook', keys: ['FACEBOOK_PAGE_TOKEN', 'FACEBOOK_PAGE_ID'] },
  { id: 'instagram', label: 'Instagram', keys: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID'] },
  { id: 'threads', label: 'Threads', keys: ['THREADS_ACCESS_TOKEN', 'THREADS_USER_ID'] },
  { id: 'tiktok', label: 'TikTok', keys: ['TIKTOK_ACCESS_TOKEN'], note: 'A token alone cannot upload a video.' },
  { id: 'linkedin', label: 'LinkedIn', keys: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AUTHOR_URN'], alt: [['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_ORG_ID']] },
  { id: 'telegram', label: 'Telegram', keys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'], alt: [['TELEGRAM_BOT_TOKEN', 'TELEGRAM_GROUP_CHAT_ID'], ['TELEGRAM_BOT_TOKEN', 'ZEUS_TG_GROUP_CHAT_ID']] },
  { id: 'discord', label: 'Discord', keys: ['DISCORD_WEBHOOK_URL'] },
  { id: 'mastodon', label: 'Mastodon', keys: ['MASTODON_TOKEN'] },
  { id: 'bluesky', label: 'Bluesky', keys: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'] },
  { id: 'reddit', label: 'Reddit', keys: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD', 'REDDIT_SUBREDDIT'] },
];

let _cache = null;
let _cacheAt = 0;

function _present(name) {
  return String(process.env[name] || '').trim().length >= 8;
}

function _armed(spec) {
  const sets = [spec.keys].concat(spec.alt || []);
  return sets.some((names) => Array.isArray(names) && names.length && names.every(_present));
}

function worldChannels() {
  return CHANNELS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    armed: _armed(spec),
    posted: false,
    note: spec.note || null,
  }));
}

function _shelf() {
  try { return require('../../../src/commerce/public-shelf'); } catch (_) { return null; }
}

function _abs(href) {
  const h = String(href || '');
  if (/^https?:/i.test(h)) return h;
  return ORIGIN + (h.startsWith('/') ? h : '/' + h);
}

function cardText(item, shelf) {
  const price = shelf && typeof shelf.money === 'function' ? shelf.money(item.priceUsd) : ('$' + item.priceUsd);
  return [
    item.title,
    price + '. ' + String(item.when || ''),
    'Checkout: ' + _abs(item.ctaHref),
    'Guide: ' + ORIGIN + '/guides/' + encodeURIComponent(item.id),
    'Same offer on ZeusAI Social and on the public shelf.',
  ].join('\n').slice(0, 2000);
}

function broadcastShelf() {
  const now = Date.now();
  if (_cache && (now - _cacheAt) < 60000) return _cache;
  const shelf = _shelf();
  const rows = shelf && typeof shelf.publicShelf === 'function'
    ? shelf.publicShelf().filter((p) => p && p.buyable === true && p.ctaHref)
    : [];
  let published = 0;
  let already = 0;
  const items = [];
  for (const item of rows) {
    const made = surface.publishOfficial({ offerId: item.id, text: cardText(item, shelf) });
    if (!made || !made.ok) continue;
    if (made.already) already += 1;
    else published += 1;
    const offer = made.post && made.post.offer;
    items.push({
      id: item.id,
      title: item.title,
      priceUsd: offer ? offer.priceUsd : item.priceUsd,
      priceLabel: offer ? offer.priceLabel : null,
      ctaHref: offer ? offer.ctaHref : item.ctaHref,
      ctaLabel: offer ? offer.ctaLabel : item.ctaLabel,
      postId: made.post && made.post.id,
    });
  }
  const report = {
    ok: true,
    authorId: 'zid_unicorn_official',
    published,
    already,
    count: items.length,
    items,
    channels: worldChannels(),
    inventsReach: false,
    note: 'Every buyable service is a signed post on ZeusAI Social. Other networks receive one service per cycle, and only when that network\'s keys are present.',
  };
  _cache = report;
  _cacheAt = now;
  return report;
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function deskHtml(report) {
  const r = report || { items: [], channels: worldChannels(), note: '' };
  const services = (r.items || []).map((item) => (
    `<li class="za-service-row" data-product-id="${_esc(item.id)}" data-price-usd="${_esc(item.priceUsd)}">`
    + `<strong>${_esc(item.title)}</strong>`
    + `<span>${_esc(item.priceLabel || '')}</span>`
    + `<a href="${_esc(item.ctaHref)}" data-sovereign-buy="${_esc(item.id)}">${_esc(item.ctaLabel || 'Buy')}</a>`
    + `</li>`
  )).join('');
  const channels = (r.channels || []).map((ch) => (
    `<li data-channel="${_esc(ch.id)}" data-armed="${ch.armed ? '1' : '0'}">`
    + `${_esc(ch.label)} · ${ch.armed ? 'Armed' : 'Waiting for keys'}`
    + (ch.note ? ` · ${_esc(ch.note)}` : '')
    + `</li>`
  )).join('');
  return `<section class="card" id="zaWorldDesk" style="margin:24px 0;padding:20px">
    <span class="kicker">Unicorn · this network</span>
    <h2 style="margin:8px 0 6px;font-size:22px">Every buyable service is posted here</h2>
    <p style="color:var(--ink-dim);margin:0 0 12px;font-size:14px">${_esc(r.note)}</p>
    <ul class="za-service-list">${services}</ul>
    <h3 style="margin:16px 0 6px;font-size:16px">Other networks</h3>
    <ul class="za-channel-list">${channels}</ul>
  </section>`;
}

module.exports = {
  broadcastShelf,
  worldChannels,
  deskHtml,
  cardText,
  ORIGIN,
};
