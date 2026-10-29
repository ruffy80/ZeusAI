'use strict';

/**
 * Sale Search Witness — SSW/1.0
 *
 * A public page exists for a search query only when Search Console already
 * returned that query. A public page exists for a sale only when a delivery
 * file on disk is not a mock. A visitor count increases only when this
 * server renders one of those pages. Nothing here forecasts global users.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'SSW/1.0';
const NAME = 'sale-search-witness';
const MAX_PAGES = 25;

const LANES = [
  [['audit', 'seo', 'search console', 'keyword', 'google'], 'instant-website-audit'],
  [['logo', 'brand'], 'instant-logo-kit'],
  [['pitch', 'investor', 'deck'], 'instant-pitch-deck'],
  [['landing', 'homepage'], 'instant-landing-page'],
  [['resume', 'cv'], 'instant-resume-makeover'],
  [['email', 'newsletter'], 'instant-email-sequence'],
];

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slug(text) {
  const raw = String(text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return raw.slice(0, 72);
}

function viewFile() {
  return process.env.SSW_VIEW_FILE
    || path.join(__dirname, '..', '..', 'data', 'growth', 'sale-search-witness.jsonl');
}

function saleDir() {
  if (process.env.SSW_SALE_DIR) return process.env.SSW_SALE_DIR;
  try { return require('./paid-delivery').deliveryDir(); } catch (_) { return ''; }
}

function loadQueries() {
  if (process.env.SSW_QUERY_FILE) {
    try {
      const parsed = JSON.parse(fs.readFileSync(process.env.SSW_QUERY_FILE, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }
  try {
    const status = require('./search-console-bridge').getStatus();
    const bag = status && status.performance && status.performance.queries;
    if (bag && bag.status === 'measured' && Array.isArray(bag.value)) return bag.value;
  } catch (_) { /* bridge optional */ }
  return [];
}

function queryPages() {
  const seen = new Set();
  const out = [];
  for (const row of loadQueries()) {
    const query = String(row && row.query || '').trim();
    const impressions = Number(row && row.impressions);
    const clicks = Number(row && row.clicks);
    const seenByGoogle = (Number.isFinite(impressions) && impressions > 0) || (Number.isFinite(clicks) && clicks > 0);
    const id = slug(query);
    if (!seenByGoogle || query.length < 3 || !id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      slug: id,
      path: '/witness/q/' + id,
      query,
      clicks: Number.isFinite(clicks) ? clicks : null,
      impressions: Number.isFinite(impressions) ? impressions : null,
    });
    if (out.length >= MAX_PAGES) break;
  }
  return out;
}

function salePages() {
  const dir = saleDir();
  if (!dir || !fs.existsSync(dir)) return [];
  const out = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch (_) { return []; }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    let body = null;
    try { body = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch (_) { body = null; }
    if (!body || body.mock === true) continue;
    if (String(body.txid || '').startsWith('simulated-')) continue;
    const id = slug(String(body.orderId || name.replace(/\.json$/, '')));
    if (!id) continue;
    out.push({
      id,
      path: '/witness/sale/' + id,
      serviceId: String(body.serviceId || body.service || ''),
      paidAt: body.paidAt || null,
    });
    if (out.length >= MAX_PAGES) break;
  }
  return out;
}

function offerFor(query, serviceId) {
  let shelf = null;
  try { shelf = require('../../src/commerce/public-shelf'); } catch (_) { shelf = null; }
  const wanted = serviceId && shelf ? shelf.byId(serviceId) : null;
  if (wanted) return wanted;
  const text = String(query || '').toLowerCase();
  if (shelf) {
    for (const lane of LANES) {
      if (lane[0].some((key) => text.includes(key))) {
        const item = shelf.byId(lane[1]);
        if (item) return item;
      }
    }
    return shelf.byId('instant-website-audit');
  }
  return null;
}

function priceLine(item) {
  if (!item) return 'The list price is on the offer page.';
  const n = Number(item.priceUsd);
  if (Number.isFinite(n) && n > 0) return 'List price on this page: $' + n.toFixed(2) + '.';
  return 'The list price is on the offer page.';
}

function layout(title, body) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'
    + esc(title)
    + '</title></head><body><p><a href="/witness">All witnesses</a></p>'
    + body
    + '<p>This counter is how many times this server rendered the page. It is not a forecast and it is not a world ranking.</p></body></html>';
}

function pageIndex() {
  const queries = queryPages();
  const sales = salePages();
  const qLinks = queries.map((row) => '<li><a href="' + esc(row.path) + '">' + esc(row.query) + '</a></li>').join('');
  const sLinks = sales.map((row) => '<li><a href="' + esc(row.path) + '">Paid file ' + esc(row.id) + '</a></li>').join('');
  const html = layout('Search and sale witnesses', [
    '<h1>Search and sale witnesses</h1>',
    '<p>A query appears here only after Google Search Console returns it. A sale appears here only when a delivery file is not a drill. Empty lists are a measured zero.</p>',
    '<h2>Queries Google already showed</h2>',
    qLinks ? '<ul>' + qLinks + '</ul>' : '<p>No measured query yet.</p>',
    '<h2>Sales already delivered</h2>',
    sLinks ? '<ul>' + sLinks + '</ul>' : '<p>No paid delivery file yet.</p>',
    '<p><a href="/services/instant-website-audit">Buy the website audit</a></p>',
  ].join(''));
  return { status: 200, html, path: '/witness' };
}

function pageQuery(id) {
  const row = queryPages().find((item) => item.slug === id);
  if (!row) return { status: 404, html: layout('Witness not found', '<h1>No such query witness</h1>'), path: '/witness/q/' + id };
  const offer = offerFor(row.query, null);
  const href = offer ? '/services/' + encodeURIComponent(offer.id) : '/services/instant-website-audit';
  const html = layout(row.query + ' — ZeusAI', [
    '<h1>' + esc(row.query) + '</h1>',
    '<p>Search Console measured this query. Clicks: ' + esc(row.clicks == null ? 'unavailable' : row.clicks) + '. Impressions: ' + esc(row.impressions == null ? 'unavailable' : row.impressions) + '.</p>',
    '<p>' + esc(priceLine(offer)) + '</p>',
    '<p><a href="' + esc(href) + '">Open the offer</a></p>',
  ].join(''));
  return { status: 200, html, path: row.path };
}

function pageSale(id) {
  const row = salePages().find((item) => item.id === id);
  if (!row) return { status: 404, html: layout('Witness not found', '<h1>No such sale witness</h1>'), path: '/witness/sale/' + id };
  const offer = offerFor('', row.serviceId);
  const href = '/services/' + encodeURIComponent(row.serviceId || (offer && offer.id) || 'instant-website-audit');
  const html = layout('Paid file ' + row.id, [
    '<h1>A file was delivered</h1>',
    '<p>Order ' + esc(row.id) + (row.serviceId ? ' for ' + esc(row.serviceId) : '') + (row.paidAt ? ' at ' + esc(row.paidAt) : '') + '.</p>',
    '<p>The buyer email is not on this page.</p>',
    '<p>' + esc(priceLine(offer)) + '</p>',
    '<p><a href="' + esc(href) + '">Buy the same kind of file</a></p>',
  ].join(''));
  return { status: 200, html, path: row.path };
}

function render(urlPath) {
  const pathName = String(urlPath || '').replace(/\/+$/, '') || '/';
  if (pathName === '/witness') return pageIndex();
  const queryMatch = pathName.match(/^\/witness\/q\/([a-z0-9-]{1,72})$/);
  if (queryMatch) return pageQuery(queryMatch[1]);
  const saleMatch = pathName.match(/^\/witness\/sale\/([a-z0-9-]{1,72})$/);
  if (saleMatch) return pageSale(saleMatch[1]);
  return null;
}

function recordView(urlPath) {
  const file = viewFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), path: String(urlPath || '') }) + '\n');
  } catch (_) { /* the page still renders */ }
  return viewCount();
}

function viewCount() {
  try {
    const text = fs.readFileSync(viewFile(), 'utf8');
    return text.split('\n').filter(Boolean).length;
  } catch (_) { return 0; }
}

function indexablePaths() {
  return ['/witness'].concat(queryPages().map((row) => row.path), salePages().map((row) => row.path));
}

function status() {
  let search = 'unavailable';
  try {
    const bridge = require('./search-console-bridge').getStatus();
    const bag = bridge && bridge.performance && bridge.performance.queries;
    if (bag && bag.status === 'measured') search = 'measured';
    else if (bag && bag.status) search = String(bag.status);
  } catch (_) { search = 'unavailable'; }
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    inventsVisitors: false,
    inventsQueries: false,
    inventsSales: false,
    visitors: viewCount(),
    queryPages: queryPages().length,
    salePages: salePages().length,
    searchConsole: search,
    paths: indexablePaths(),
    note: 'A query page exists only when Search Console returned that query with clicks or impressions. A sale page exists only for a delivery file that is not a drill. The visitor number is a render count on this server.',
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  slug,
  queryPages,
  salePages,
  render,
  recordView,
  viewCount,
  indexablePaths,
  status,
};
