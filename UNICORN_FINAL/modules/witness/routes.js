'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { fetchQueries } = require('./gsc');
const { createWitness, getWitness, listWitnesses, findByOffer, getOffer } = require('./contracts');
const { publicKeyBase64 } = require('./signer');
const { renderHTML, renderOne } = require('./render');

const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/$/, '');

function authorized(req) {
  const token = String(process.env.WITNESS_SYNC_TOKEN || '');
  const header = String((req.headers && req.headers.authorization) || '');
  if (!token || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(token);
  if (given.length !== want.length) return false;
  return crypto.timingSafeEqual(given, want);
}

async function syncNow() {
  const rows = await fetchQueries(process.env.GSC_SITE_URL, 7);
  if (!rows.length) return { created: 0, skipped: 0, errors: 0, message: 'no real data yet' };
  let created = 0;
  let skipped = 0;
  let errors = 0;
  for (const row of rows) {
    const result = createWitness(row, null, null);
    if (!result || result.ok === false) errors += 1;
    else if (result.skipped) skipped += 1;
    else created += 1;
  }
  return { created, skipped, errors };
}

function jsonList() {
  const contracts = listWitnesses({ limit: 50, offset: 0 });
  return {
    count: contracts.length,
    contracts,
    pubkey: publicKeyBase64(),
    generated_at: new Date().toISOString(),
  };
}

function send(res, status, type, body) {
  if (typeof res.status === 'function' && typeof res.type === 'function') {
    res.status(status);
    res.set('Cache-Control', 'no-store');
    res.type(type);
    if (type.indexOf('json') >= 0) return res.json(body);
    return res.send(body);
  }
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(payload);
  return true;
}

function mount(app) {
  app.get('/witness.json', (req, res) => send(res, 200, 'application/json; charset=utf-8', jsonList()));
  app.get('/witness/:id.json', (req, res) => {
    const contract = getWitness(req.params.id);
    if (!contract) return send(res, 404, 'application/json; charset=utf-8', { error: 'not_found' });
    return send(res, 200, 'application/json; charset=utf-8', contract);
  });
  app.get('/witness', (req, res) => send(res, 200, 'text/html; charset=utf-8', renderHTML(listWitnesses())));
  app.get('/witness/:id', (req, res) => {
    const contract = getWitness(req.params.id);
    if (!contract) return send(res, 404, 'text/html; charset=utf-8', renderOne(null));
    return send(res, 200, 'text/html; charset=utf-8', renderOne(contract));
  });
  app.post('/witness/sync', async (req, res) => {
    if (!authorized(req)) return send(res, 401, 'application/json; charset=utf-8', { error: 'unauthorized' });
    try {
      return send(res, 200, 'application/json; charset=utf-8', await syncNow());
    } catch (err) {
      return send(res, 500, 'application/json; charset=utf-8', { error: err && err.message });
    }
  });
  app.get('/offer/:id', (req, res) => {
    res.redirect(302, '/services/' + encodeURIComponent(req.params.id));
  });
  app.get('/deliveries/:orderId/:filename', (req, res) => {
    const file = resolveDelivery(req.params.orderId, req.params.filename);
    if (!file) return send(res, 404, 'text/plain; charset=utf-8', 'not found');
    res.set('Cache-Control', 'no-store');
    return res.sendFile(file);
  });
}

function resolveDelivery(orderId, filename) {
  const root = path.resolve(process.env.ZEUS_DELIVERY_DIR || '/opt/zeusai/deliveries');
  const order = String(orderId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const name = path.basename(String(filename || ''));
  if (!order || !name || name === 'manifest.json') return null;
  const full = path.resolve(root, order, name);
  if (!full.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}

function citationBlock(offerId) {
  const id = String(offerId || '').trim();
  if (!id) return '';
  const lines = [
    '',
    '## Verification',
    'Public offer URL: ' + APP_URL + '/offer/' + encodeURIComponent(id),
  ];
  try {
    const witness = findByOffer(id);
    if (witness && witness.id) lines.push('Witness URL: ' + APP_URL + '/witness/' + witness.id);
  } catch (_) { /* no witness yet */ }
  lines.push('Public key for verification: ' + APP_URL + '/witness.json');
  lines.push('This delivery is verifiable. Signature and receipt available at the URL above.');
  return lines.join('\n');
}

function handleSite(req, res, urlPath) {
  const method = String(req.method || 'GET').toUpperCase();
  if (urlPath === '/witness.json' && method === 'GET') {
    send(res, 200, 'application/json; charset=utf-8', jsonList());
    return true;
  }
  const jsonId = urlPath.match(/^\/witness\/([0-9a-f-]{36})\.json$/i);
  if (jsonId && method === 'GET') {
    const contract = getWitness(jsonId[1]);
    send(res, contract ? 200 : 404, 'application/json; charset=utf-8', contract || { error: 'not_found' });
    return true;
  }
  if (urlPath === '/witness' && method === 'GET') {
    send(res, 200, 'text/html; charset=utf-8', renderHTML(listWitnesses()));
    return true;
  }
  const one = urlPath.match(/^\/witness\/([0-9a-f-]{36})$/i);
  if (one && method === 'GET') {
    const contract = getWitness(one[1]);
    send(res, contract ? 200 : 404, 'text/html; charset=utf-8', renderOne(contract));
    return true;
  }
  if (urlPath === '/witness/sync' && method === 'POST') {
    if (!authorized(req)) {
      send(res, 401, 'application/json; charset=utf-8', { error: 'unauthorized' });
      return true;
    }
    syncNow().then((body) => send(res, 200, 'application/json; charset=utf-8', body)).catch((err) => {
      send(res, 500, 'application/json; charset=utf-8', { error: err && err.message });
    });
    return true;
  }
  const offer = urlPath.match(/^\/offer\/([^/]+)$/);
  if (offer && method === 'GET') {
    res.writeHead(302, { Location: '/services/' + encodeURIComponent(decodeURIComponent(offer[1])), 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }
  const fileMatch = urlPath.match(/^\/deliveries\/([^/]+)\/([^/]+)$/);
  if (fileMatch && method === 'GET') {
    const file = resolveDelivery(decodeURIComponent(fileMatch[1]), decodeURIComponent(fileMatch[2]));
    if (!file) {
      send(res, 404, 'text/plain; charset=utf-8', 'not found');
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(file));
    return true;
  }
  return false;
}

module.exports = {
  mount,
  handleSite,
  syncNow,
  jsonList,
  citationBlock,
  getOffer,
};
