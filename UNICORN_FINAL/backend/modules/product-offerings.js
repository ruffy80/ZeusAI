'use strict';

/**
 * Product packaging for the four sellable surfaces.
 * Prices come from priceNegotiator. Signatures reuse the existing Ed25519 key.
 * PostgreSQL and Redis stay unused: rows live in the commercial SQLite file.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const commercial = require('./commercial-layer');

const TIERS = Object.freeze({
  witness: [
    { id: 'free', name: 'Free', quotedUsd: null, quota: 100, interval: 'month' },
    { id: 'pro', name: 'Pro', quotedUsd: 49, quota: 5000, interval: 'month' },
    { id: 'enterprise', name: 'Enterprise', quotedUsd: 299, quota: null, interval: 'month' },
  ],
  orchestrator: [
    { id: 'free', name: 'Free', quotedUsd: null, quota: null, interval: 'month', note: 'Self-hosted. Community.' },
    { id: 'pro', name: 'Pro', quotedUsd: 199, quota: 10, interval: 'month', note: 'Hosted. 10 capabilities. Email support.' },
    { id: 'enterprise', name: 'Enterprise', quotedUsd: 999, quota: null, interval: 'month', note: 'Hosted. Unlimited capabilities. Slack support.' },
  ],
  snm: [
    { id: 'free', name: 'Free', quotedUsd: null, quota: 500, interval: 'month' },
    { id: 'pro', name: 'Pro', quotedUsd: 99, quota: 50000, interval: 'month' },
    { id: 'enterprise', name: 'Enterprise', quotedUsd: 499, quota: null, interval: 'month' },
  ],
});

function stateDir() {
  return process.env.ZEUS_STATE_DIR || process.env.SNM_STATE_DIR || '/opt/zeusai/state';
}

let dbHandle = null;

function db() {
  if (dbHandle) return dbHandle;
  const Database = require('better-sqlite3');
  const file = path.join(stateDir(), 'commercial.sqlite');
  fs.mkdirSync(stateDir(), { recursive: true });
  const handle = new Database(file);
  handle.exec(`
    CREATE TABLE IF NOT EXISTS demo_hits (
      ip_hash TEXT NOT NULL,
      hour_bucket TEXT NOT NULL,
      hits INTEGER DEFAULT 0,
      PRIMARY KEY (ip_hash, hour_bucket)
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key_hash TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL,
      email TEXT NOT NULL,
      product TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      requests_count INTEGER DEFAULT 0,
      last_reset TEXT
    );
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      product TEXT NOT NULL,
      intent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      source_url TEXT,
      opt_in INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS api_receipts (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      body_json TEXT NOT NULL,
      signature TEXT,
      pubkey TEXT,
      demo INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  dbHandle = handle;
  return handle;
}

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

function quoteTier(product, tier) {
  if (!tier.quotedUsd) {
    return { usd: 0, btc: null, source: 'free', contact: false };
  }
  const quote = commercial.quoteSync(product + '-' + tier.id, { quotedUsd: tier.quotedUsd });
  return { usd: quote.usd, btc: quote.btc, btcUri: quote.btcUri, source: quote.source, contact: false };
}

function tiersFor(product) {
  return (TIERS[product] || []).map((tier) => Object.assign({ product }, tier, quoteTier(product, tier)));
}

function allTiers() {
  return {
    ok: true,
    witness: tiersFor('witness'),
    orchestrator: tiersFor('orchestrator'),
    snm: tiersFor('snm'),
    services: commercial.plansPayload().plans,
  };
}

function shelfProducts() {
  const shelf = require('../../src/commerce/public-shelf');
  return shelf.publicShelf().map((item) => {
    const quote = commercial.quoteSync(item.id);
    const description = String(item.description || '').split('\n')[0];
    return {
      id: item.id,
      name: item.title || item.id,
      description,
      category: item.tier || item.clock || 'service',
      usd: quote.usd,
      btc: quote.btc,
      btcUri: quote.btcUri,
      source: quote.source,
    };
  });
}

function productById(id) {
  return shelfProducts().find((item) => item.id === id) || null;
}

function relatedProducts(id, category) {
  return shelfProducts().filter((item) => item.id !== id && item.category === category).slice(0, 3);
}

function sampleFor(id) {
  const dir = path.join(__dirname, '..', '..', 'samples', String(id || ''));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const files = fs.readdirSync(dir).filter((name) => fs.statSync(path.join(dir, name)).isFile());
  if (!files.length) return null;
  const file = files[0];
  const text = fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 2000);
  return { file, text };
}

function proof() {
  let witnessCount = 0;
  let witnessError = null;
  try {
    const rows = require('../../modules/witness/contracts').listWitnesses({ limit: 1000, offset: 0 });
    witnessCount = Array.isArray(rows) ? rows.length : 0;
  } catch (err) {
    witnessError = String(err && err.message || err);
  }
  const trust = commercial.trustLine();
  let ledgerCount = 0;
  let paidHumans = 0;
  let ledgerError = null;
  try {
    const ledger = require('./origin-gravity-os').publicLedger(50);
    ledgerCount = Array.isArray(ledger.publicDeliveries) ? ledger.publicDeliveries.length : 0;
    paidHumans = Number(ledger.paidHumans) || 0;
  } catch (err) {
    ledgerError = String(err && err.message || err);
  }
  let snm = null;
  try { snm = require('../../modules/notificationMesh').getStatus(); } catch (err) {
    snm = { error: String(err && err.message || err) };
  }
  return {
    ok: true,
    signedDeliveries: trust.count,
    trustLabel: trust.label,
    witnessCount,
    witnessError,
    ledgerCount,
    paidHumans,
    ledgerError,
    snmDelivered24h: snm && snm.delivered_last_24h != null ? snm.delivered_last_24h : 0,
    snm,
  };
}

function ledgerJson() {
  const snap = proof();
  let deliveries = [];
  try {
    deliveries = require('./origin-gravity-os').publicLedger(50).publicDeliveries || [];
  } catch (_) { deliveries = []; }
  return {
    ok: true,
    count: deliveries.length,
    paidHumans: snap.paidHumans,
    signedDeliveries: snap.signedDeliveries,
    deliveries,
    ledgerError: snap.ledgerError,
  };
}

function pubkey() {
  const key = require('../../modules/witness/signer').publicKeyBase64();
  return { ok: true, pubkey: key, alg: 'Ed25519' };
}

function monthBucket() {
  return new Date().toISOString().slice(0, 7);
}

function readKey(header) {
  const raw = String(header || '');
  const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : '';
  if (!token) return null;
  return db().prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(hashKey(token)) || null;
}

function chargeKey(row) {
  const bucket = monthBucket();
  if (row.last_reset !== bucket) {
    db().prepare('UPDATE api_keys SET requests_count = 0, last_reset = ? WHERE id = ?').run(bucket, row.id);
    row.requests_count = 0;
    row.last_reset = bucket;
  }
  const tier = (TIERS[row.product] || TIERS.witness).find((item) => item.id === row.tier) || TIERS.witness[0];
  if (tier.quota != null && Number(row.requests_count) >= tier.quota) {
    return { ok: false, error: 'rate_limited', tier: row.tier, quota: tier.quota };
  }
  db().prepare('UPDATE api_keys SET requests_count = requests_count + 1, last_reset = ? WHERE id = ?').run(bucket, row.id);
  return { ok: true, tier: row.tier };
}

function signup(input) {
  const email = String((input && input.email) || '').trim().toLowerCase();
  const product = String((input && input.product) || 'witness').trim().toLowerCase();
  if (!TIERS[product]) return { ok: false, error: 'unknown_product', status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email_required', status: 400 };
  const optIn = input && (input.optIn === true || input.opt_in === true || input.optIn === 'true' || input.opt_in === 'on');
  const plain = 'zk_' + crypto.randomBytes(18).toString('hex');
  const id = crypto.randomUUID();
  db().prepare(`
    INSERT INTO api_keys (id, key_hash, tier, email, product, requests_count, last_reset)
    VALUES (?, ?, 'free', ?, ?, 0, ?)
  `).run(id, hashKey(plain), email, product, monthBucket());
  db().prepare(`
    INSERT INTO leads (id, email, product, intent, source_url, opt_in)
    VALUES (?, ?, ?, 'api_key', ?, ?)
  `).run(crypto.randomUUID(), email, product, String((input && input.sourceUrl) || '').slice(0, 300), optIn ? 1 : 0);
  return {
    ok: true,
    product,
    tier: 'free',
    apiKey: plain,
    email,
    optIn: optIn === true,
    marketingEmail: false,
    note: 'The key is shown once. No marketing email is sent unless opt-in was checked, and none is sent from this endpoint.',
  };
}

function saveLead(input) {
  const email = String((input && input.email) || '').trim().toLowerCase();
  const product = String((input && input.product) || '').trim().slice(0, 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email_required', status: 400 };
  if (!product) return { ok: false, error: 'product_required', status: 400 };
  const optIn = input && (input.optIn === true || input.opt_in === true || input.optIn === 'true' || input.opt_in === 'on');
  db().prepare(`
    INSERT INTO leads (id, email, product, intent, source_url, opt_in)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    email,
    product,
    String((input && input.intent) || 'request').slice(0, 80),
    String((input && input.sourceUrl) || '').slice(0, 300),
    optIn ? 1 : 0
  );
  return { ok: true, stored: true, optIn: optIn === true, marketingEmail: false };
}

function signWitness(body, demo) {
  const signer = require('../../modules/witness/signer');
  const id = crypto.randomUUID();
  const payload = {
    type: 'witness_delivery',
    id,
    demo: demo === true,
    delivery: body && body.delivery ? body.delivery : body,
    at: new Date().toISOString(),
  };
  const signed = signer.signContract(payload);
  db().prepare(`
    INSERT INTO api_receipts (id, kind, body_json, signature, pubkey, demo)
    VALUES (?, 'witness', ?, ?, ?, ?)
  `).run(id, JSON.stringify(signed), signed.signature, signed.pubkey, demo ? 1 : 0);
  return {
    ok: true,
    id,
    demo: demo === true,
    signed,
    valid: signer.verifyContract(signed),
    verifyUrl: '/api/v1/verify/' + id,
  };
}

function getReceipt(id) {
  const row = db().prepare('SELECT * FROM api_receipts WHERE id = ?').get(String(id || ''));
  if (!row) return null;
  const signed = JSON.parse(row.body_json);
  let valid = false;
  try {
    if (row.kind === 'witness') valid = require('../../modules/witness/signer').verifyContract(signed);
    else valid = require('../../modules/notificationMesh/signing').verifyNotification(signed);
  } catch (_) { valid = false; }
  return { ok: true, id: row.id, kind: row.kind, demo: Number(row.demo) === 1, signed, valid };
}

async function notifyChannels(payload, simulate) {
  const mesh = require('../../modules/notificationMesh');
  const note = {
    type: 'snm_product',
    text: String((payload && (payload.text || payload.payload)) || 'SNM signature check').slice(0, 280),
    userId: String((payload && payload.userId) || 'product-demo').slice(0, 80),
    private: true,
  };
  const signed = mesh.signNotification(note);
  const attempts = [];
  if (simulate) {
    for (const channel of mesh.CHAIN) {
      attempts.push({
        channel,
        ok: false,
        simulated: true,
        error: 'not contacted',
      });
    }
  } else {
    for (const channel of mesh.CHAIN) {
      try {
        const mod = require('../../modules/notificationMesh/channels/' + channel);
        const ok = await Promise.race([
          Promise.resolve(mod.send(signed, note.userId)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
        ]);
        attempts.push({ channel, ok: ok === true, simulated: false });
      } catch (err) {
        attempts.push({ channel, ok: false, simulated: false, error: String(err && err.message || err) });
      }
    }
  }
  const id = crypto.randomUUID();
  db().prepare(`
    INSERT INTO api_receipts (id, kind, body_json, signature, pubkey, demo)
    VALUES (?, 'snm', ?, ?, ?, 1)
  `).run(id, JSON.stringify({ signed, attempts }), signed.signature, signed.pubkey);
  return {
    ok: true,
    id,
    simulated: simulate === true,
    valid: mesh.verifyNotification(signed) === true,
    signed,
    attempts,
    verifyUrl: '/snm/verify',
    note: simulate
      ? 'Channels were not contacted. The Ed25519 signature is real.'
      : 'Each channel reports its own result. A failure is not rewritten as success.',
  };
}

function verifyPosted(body) {
  if (body && typeof body.signed === 'string') {
    try { body = JSON.parse(body.signed); } catch (_) { return { ok: false, valid: false, error: 'bad_json' }; }
  }
  if (!body || typeof body !== 'object') return { ok: false, valid: false, error: 'json_required' };
  const mesh = require('../../modules/notificationMesh');
  const witness = require('../../modules/witness/signer');
  if (body.nonce && body.timestamp) {
    return { ok: true, valid: mesh.verifyNotification(body) === true, kind: 'snm' };
  }
  if (body.payload && body.signature && body.pubkey) {
    const asWitness = witness.verifyContract(body) === true;
    const asSnm = mesh.verifyNotification(body) === true;
    return { ok: true, valid: asWitness || asSnm, kind: asWitness ? 'witness' : 'snm' };
  }
  return { ok: false, valid: false, error: 'unrecognized_signature' };
}

function clientIp(req) {
  const forwarded = req && req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return (req && (req.ip || (req.socket && req.socket.remoteAddress))) || 'unknown';
}

function ipHash(ip) {
  return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 16);
}

function demoAllowed(ip, bucketName) {
  const hash = ipHash(ip);
  const bucket = String(Math.floor(Date.now() / 3600000)) + ':' + bucketName;
  const row = db().prepare('SELECT hits FROM demo_hits WHERE ip_hash = ? AND hour_bucket = ?').get(hash, bucket);
  if (row && Number(row.hits) >= 5) return false;
  db().prepare(`
    INSERT INTO demo_hits (ip_hash, hour_bucket, hits) VALUES (?, ?, 1)
    ON CONFLICT(ip_hash, hour_bucket) DO UPDATE SET hits = hits + 1
  `).run(hash, bucket);
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) { resolve({}); return; }
      try { resolve(JSON.parse(text)); return; } catch (_) { /* form body */ }
      const params = new URLSearchParams(text);
      const out = {};
      for (const [key, value] of params.entries()) out[key] = value;
      if (!Object.keys(out).length) { resolve({ __badJson: true }); return; }
      resolve(out);
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, body, cache) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.set('Cache-Control', cache || 'no-store');
    res.status(statusCode).json(body);
    return;
  }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache || 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function dispatch(req, urlPath) {
  const method = String(req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET' && urlPath === '/ledger.json') {
      return { status: 200, body: ledgerJson(), cache: 'public, max-age=60' };
    }
    if (method === 'GET' && urlPath === '/api/v1/pubkey') {
      return { status: 200, body: pubkey(), cache: 'public, max-age=60' };
    }
    if (method === 'GET' && urlPath === '/api/v1/products') {
      const products = shelfProducts();
      return { status: 200, body: { ok: true, count: products.length, products }, cache: 'public, max-age=60' };
    }
    if (method === 'GET' && urlPath === '/api/v1/tiers') {
      return { status: 200, body: allTiers(), cache: 'public, max-age=60' };
    }
    const witnessGet = urlPath.match(/^\/api\/v1\/witness\/([0-9a-f-]{36})$/i);
    const verifyGet = urlPath.match(/^\/api\/v1\/verify\/([0-9a-f-]{36})$/i);
    const notifyGet = urlPath.match(/^\/api\/v1\/notify\/([0-9a-f-]{36})$/i);
    const receiptId = (witnessGet || verifyGet || notifyGet || [])[1];
    if (method === 'GET' && receiptId) {
      const found = getReceipt(receiptId);
      if (!found) return { status: 404, body: { ok: false, error: 'not_found' } };
      return { status: 200, body: found, cache: 'public, max-age=60' };
    }
    if (method === 'POST' && (urlPath === '/api-product/signup' || urlPath === '/api/v1/signup')) {
      const body = await readJsonBody(req);
      if (body.__badJson) return { status: 400, body: { ok: false, error: 'bad_json' } };
      const result = signup(body);
      return { status: result.status || 201, body: result };
    }
    if (method === 'POST' && urlPath === '/api/v1/leads') {
      const body = await readJsonBody(req);
      if (body.__badJson) return { status: 400, body: { ok: false, error: 'bad_json' } };
      const result = saveLead(body);
      return { status: result.status || 201, body: result };
    }
    if (method === 'POST' && urlPath === '/api/v1/witness') {
      const row = readKey(req.headers && req.headers.authorization);
      if (!row) return { status: 401, body: { ok: false, error: 'api_key_required' } };
      const gate = chargeKey(row);
      if (!gate.ok) return { status: 429, body: gate };
      const body = await readJsonBody(req);
      if (body.__badJson) return { status: 400, body: { ok: false, error: 'bad_json' } };
      return { status: 201, body: signWitness(body, false) };
    }
    if (method === 'POST' && urlPath === '/api/v1/witness/demo') {
      if (!demoAllowed(clientIp(req), 'witness')) return { status: 429, body: { ok: false, error: 'rate_limited' } };
      const body = await readJsonBody(req);
      if (body.__badJson) return { status: 400, body: { ok: false, error: 'bad_json' } };
      return { status: 201, body: signWitness(body, true) };
    }
    if (method === 'POST' && urlPath === '/api/v1/notify') {
      const row = readKey(req.headers && req.headers.authorization);
      if (!row) return { status: 401, body: { ok: false, error: 'api_key_required' } };
      const gate = chargeKey(row);
      if (!gate.ok) return { status: 429, body: gate };
      const body = await readJsonBody(req);
      if (body.__badJson) return { status: 400, body: { ok: false, error: 'bad_json' } };
      const result = await notifyChannels(body, true);
      return { status: 201, body: result };
    }
    if (method === 'POST' && urlPath === '/api/v1/notify/channels') {
      if (!demoAllowed(clientIp(req), 'snm')) return { status: 429, body: { ok: false, error: 'rate_limited' } };
      const body = await readJsonBody(req);
      const result = await notifyChannels(body, false);
      return { status: 201, body: result };
    }
    if (method === 'POST' && urlPath === '/api/v1/notify/verify') {
      const body = await readJsonBody(req);
      if (body.__badJson) return { status: 400, body: { ok: false, error: 'bad_json' } };
      return { status: 200, body: verifyPosted(body) };
    }
    if (method === 'POST' && urlPath === '/api/v1/orchestrator/sandbox') {
      if (!demoAllowed(clientIp(req), 'orch')) return { status: 429, body: { ok: false, error: 'rate_limited' } };
      const result = await require('./orchestrator').runSandbox(800);
      return { status: 200, body: Object.assign({ ok: result.ok, note: 'Short sandbox. The SDK example runs 60 seconds.' }, result) };
    }
    return null;
  } catch (err) {
    return { status: 500, body: { ok: false, error: String(err && err.message || err) } };
  }
}

async function handleHttp(req, res, urlPath) {
  const hit = await dispatch(req, urlPath);
  if (!hit) return false;
  sendJson(res, hit.status, hit.body, hit.cache);
  return true;
}

function mount(app) {
  const routes = [
    ['get', '/ledger.json'],
    ['get', '/api/v1/pubkey'],
    ['get', '/api/v1/products'],
    ['get', '/api/v1/tiers'],
    ['get', '/api/v1/witness/:id'],
    ['get', '/api/v1/verify/:id'],
    ['get', '/api/v1/notify/:id'],
    ['post', '/api-product/signup'],
    ['post', '/api/v1/signup'],
    ['post', '/api/v1/leads'],
    ['post', '/api/v1/witness'],
    ['post', '/api/v1/witness/demo'],
    ['post', '/api/v1/notify'],
    ['post', '/api/v1/notify/channels'],
    ['post', '/api/v1/notify/verify'],
    ['post', '/api/v1/orchestrator/sandbox'],
  ];
  for (const [method, route] of routes) {
    app[method](route, async (req, res) => {
      const urlPath = String(req.originalUrl || req.url || route).split('?')[0];
      try {
        const handled = await handleHttp(req, res, urlPath);
        if (!handled) sendJson(res, 404, { ok: false, error: 'not_found' });
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String(err && err.message || err) });
      }
    });
  }
}

module.exports = {
  shelfProducts,
  productById,
  relatedProducts,
  sampleFor,
  proof,
  ledgerJson,
  tiersFor,
  allTiers,
  signup,
  saveLead,
  signWitness,
  getReceipt,
  notifyChannels,
  verifyPosted,
  pubkey,
  handleHttp,
  mount,
};
