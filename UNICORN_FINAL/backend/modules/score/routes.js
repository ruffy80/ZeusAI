'use strict';

const score = require('./index');
const render = require('./render');
const ogImage = require('./ogImage');
const priceBridge = require('./priceBridge');

function send(res, status, type, body) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  if (typeof res.status === 'function' && typeof res.type === 'function') {
    res.status(status);
    res.set('Cache-Control', 'no-store');
    res.type(type);
    if (Buffer.isBuffer(body)) return res.send(body);
    if (type.indexOf('json') >= 0) return res.json(body);
    return res.send(body);
  }
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(payload);
}

function clientIp(req) {
  const fwd = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || '';
}

async function createFromRequest(req, body) {
  const url = body && (body.url || body.domain);
  return score.createScore(url, {
    ip: clientIp(req),
    user_agent: req.headers && req.headers['user-agent'],
    referrer: req.headers && req.headers.referer,
    ref: body && body.ref,
    opt_in: body && (body.opt_in === true || body.opt_in === '1'),
  });
}

function mount(app) {
  app.post('/api/score', async (req, res) => {
    const result = await createFromRequest(req, req.body || {});
    return send(res, result.status || (result.ok ? 201 : 400), 'application/json; charset=utf-8', result.ok ? result.pack : result);
  });
  app.get('/api/score/stats', (req, res) => send(res, 200, 'application/json; charset=utf-8', score.stats()));
  app.get('/score', (req, res) => send(res, 200, 'text/html; charset=utf-8', render.landing(score.stats(), score.leaderboard())));
  app.get('/score/leaderboard', (req, res) => send(res, 200, 'application/json; charset=utf-8', { opt_in_only: true, rows: score.leaderboard() }));
  app.get('/score/:slug.json', (req, res) => {
    const row = score.getBySlug(req.params.slug);
    if (!row) return send(res, 404, 'application/json; charset=utf-8', { error: 'not_found' });
    return send(res, 200, 'application/json; charset=utf-8', row);
  });
  app.get('/score/:slug/badge.svg', (req, res) => {
    const row = score.getBySlug(req.params.slug);
    if (!row) return send(res, 404, 'image/svg+xml; charset=utf-8', '');
    score.noteView(req.params.slug, { referrer: req.headers.referer, ip: clientIp(req), user_agent: req.headers['user-agent'] });
    return send(res, 200, 'image/svg+xml; charset=utf-8', score.badgeSvg(row));
  });
  app.get('/score/:slug/og.png', (req, res) => {
    const png = ogImage.readPng(req.params.slug);
    if (!png) return send(res, 404, 'text/plain; charset=utf-8', 'not found');
    return send(res, 200, 'image/png', png);
  });
  app.get('/score/:slug/upgrade', async (req, res) => {
    const id = score.noteUpgradeClick(req.params.slug);
    if (!id) return send(res, 404, 'text/plain; charset=utf-8', 'not found');
    const tier = req.query.tier === 'report' ? 'score-full-report' : 'instant-website-audit';
    res.redirect(302, '/services/' + encodeURIComponent(tier));
  });
  app.get('/score/:slug', async (req, res) => {
    const row = score.getBySlug(req.params.slug);
    if (!row) return send(res, 404, 'text/html; charset=utf-8', render.landing(score.stats(), []));
    score.noteView(req.params.slug, {
      ref: req.query.ref,
      referrer: req.headers.referer,
      ip: clientIp(req),
      user_agent: req.headers['user-agent'],
    });
    const prices = await priceBridgePrices(row.domain);
    return send(res, 200, 'text/html; charset=utf-8', render.report(row, score.sharePack(row, prices)));
  });
  app.get('/ledger/:id', (req, res) => {
    send(res, 200, 'text/html; charset=utf-8', '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ledger</title></head><body><h1>Ledger entry</h1><p>' + String(req.params.id).replace(/[<>&]/g, '') + '</p><p><a href="/ledger">All entries</a></p></body></html>');
  });
  app.get('/ledger', (req, res) => {
    let rows = [];
    try { rows = require('../../backend/modules/origin-gravity-os').publicLedger(50).deliveries || []; } catch (_) { rows = []; }
    const list = rows.length
      ? rows.map((row) => '<li>' + String(row.offerId || '') + ' · ' + String(row.id) + '</li>').join('')
      : '<p>No public delivery has been recorded.</p>';
    send(res, 200, 'text/html; charset=utf-8', '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ledger</title></head><body><h1>Public ledger</h1>' + list + '</body></html>');
  });
}

async function priceBridgePrices(domain) {
  const priceBridge = require('./priceBridge');
  return priceBridge.upgradePrices(domain);
}

function handleSite(req, res, urlPath) {
  const method = String(req.method || 'GET').toUpperCase();
  if (urlPath === '/api/score' && method === 'POST') return false;
  if (urlPath === '/score' && method === 'GET') {
    send(res, 200, 'text/html; charset=utf-8', render.landing(score.stats(), score.leaderboard()));
    return true;
  }
  if (urlPath === '/api/score/stats' && method === 'GET') {
    send(res, 200, 'application/json; charset=utf-8', score.stats());
    return true;
  }
  if (urlPath === '/score/leaderboard' && method === 'GET') {
    send(res, 200, 'application/json; charset=utf-8', { opt_in_only: true, rows: score.leaderboard() });
    return true;
  }
  const badge = urlPath.match(/^\/score\/([^/]+)\/badge\.svg$/);
  if (badge && method === 'GET') {
    const row = score.getBySlug(badge[1]);
    if (!row) { send(res, 404, 'image/svg+xml; charset=utf-8', ''); return true; }
    send(res, 200, 'image/svg+xml; charset=utf-8', score.badgeSvg(row));
    return true;
  }
  const og = urlPath.match(/^\/score\/([^/]+)\/og\.png$/);
  if (og && method === 'GET') {
    const png = ogImage.readPng(og[1]);
    if (!png) { send(res, 404, 'text/plain; charset=utf-8', 'not found'); return true; }
    send(res, 200, 'image/png', png);
    return true;
  }
  const json = urlPath.match(/^\/score\/([^/]+)\.json$/);
  if (json && method === 'GET') {
    const row = score.getBySlug(json[1]);
    send(res, row ? 200 : 404, 'application/json; charset=utf-8', row || { error: 'not_found' });
    return true;
  }
  const page = urlPath.match(/^\/score\/([^/]+)$/);
  if (page && method === 'GET') {
    const row = score.getBySlug(page[1]);
    if (!row) { send(res, 404, 'text/html; charset=utf-8', '<h1>No such score</h1>'); return true; }
    priceBridgePrices(row.domain).then((prices) => {
      send(res, 200, 'text/html; charset=utf-8', render.report(row, score.sharePack(row, prices)));
    });
    return true;
  }
  if (urlPath === '/ledger' && method === 'GET') {
    let rows = [];
    try { rows = require('../../backend/modules/origin-gravity-os').publicLedger(50).deliveries || []; } catch (_) { rows = []; }
    const list = rows.length ? '<ul>' + rows.map((row) => '<li>' + String(row.id) + '</li>').join('') + '</ul>' : '<p>No public delivery has been recorded.</p>';
    send(res, 200, 'text/html; charset=utf-8', '<!doctype html><title>Ledger</title><h1>Public ledger</h1>' + list);
    return true;
  }
  const ledgerOne = urlPath.match(/^\/ledger\/([^/]+)$/);
  if (ledgerOne && method === 'GET') {
    send(res, 200, 'text/html; charset=utf-8', '<!doctype html><title>Ledger</title><h1>Ledger entry</h1><p>' + ledgerOne[1].replace(/[<>&]/g, '') + '</p>');
    return true;
  }
  return false;
}

module.exports = { mount, handleSite, createFromRequest };
