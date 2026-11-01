'use strict';

/**
 * RMAP/1.0 — the eight public roadmap desks.
 * Shipped means a buyer can open the page. Counts stay at zero until this
 * process records them. No yield, payout, region, partner, or signature is invented.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROTOCOL = 'RMAP/1.0';
const STATEMENT = 'ZeusAI hybrid sample\nML-DSA-65 + Ed25519\nThis sample is not a paid-order receipt.';
const TRACKED = new Set([
  '/', '/services', '/pricing', '/products', '/enterprise',
  '/checkout', '/funnel', '/agents', '/agents/quote',
]);

const META = {
  '/funnel': {
    title: 'Conversion funnel',
    description: 'Yield-ranked public URLs from visits and conversions this process recorded. Nothing is promoted at zero.',
  },
  '/recovery': {
    title: 'Checkout recovery',
    description: 'Resume a checkout this process already opened. The page does not send a message and does not list another buyer.',
  },
  '/affiliate/desk': {
    title: 'Affiliate desk',
    description: 'Self-serve referral ledger. A Bitcoin txid appears only after one is stored. This page does not broadcast a transaction.',
  },
  '/agents/quote': {
    title: 'Machine quote',
    description: 'Agent quote at the catalog list price. An offer under the list is refused. No second price engine.',
  },
  '/pq': {
    title: 'Hybrid signatures',
    description: 'One public sample signed with Ed25519 and ML-DSA-65 and verified before display. Paid-order receipts stay Ed25519.',
  },
  '/replicas': {
    title: 'Sovereign replicas',
    description: 'This process, plus any replica URL named in the environment. No extra region is invented.',
  },
  '/byo': {
    title: 'BYO infrastructure',
    description: 'Download a vertical runbook. The file does not install an operating system and ZeusAI does not host that infrastructure.',
  },
  '/module-registry': {
    title: 'Module marketplace',
    description: 'Register a third-party module name and a Bitcoin payout address. Empty until someone registers. No partner is invented.',
  },
};

let db = null;
let dbReady = false;
let keysCache = null;
let sampleCache = null;
const registerStamps = [];

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function stateDir() {
  if (process.env.ROADMAP_STATE_DIR) return process.env.ROADMAP_STATE_DIR;
  if (process.env.NODE_ENV === 'test') return path.join(os.tmpdir(), 'zeus-roadmap-' + process.pid);
  const shared = process.env.ZEUS_STATE_DIR || '/opt/zeusai/state';
  try {
    fs.mkdirSync(shared, { recursive: true });
    fs.accessSync(shared, fs.constants.W_OK);
    return shared;
  } catch (_) {
    const fallback = path.join(os.tmpdir(), 'zeus-roadmap');
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function openDb() {
  if (dbReady) return db;
  dbReady = true;
  try {
    const Database = require('better-sqlite3');
    const dir = stateDir();
    fs.mkdirSync(dir, { recursive: true });
    db = new Database(path.join(dir, 'roadmap.sqlite'));
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS funnel_url (
        path TEXT PRIMARY KEY,
        visits INTEGER NOT NULL DEFAULT 0,
        conversions INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS checkout_open (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open'
      );
      CREATE TABLE IF NOT EXISTS third_party_module (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        payout TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
    `);
  } catch (_) {
    db = null;
  }
  return db;
}

function normalizePath(input) {
  let value = String(input || '').split('?')[0].trim();
  if (!value) return '';
  if (!value.startsWith('/')) value = '/' + value;
  if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1);
  if (!/^\/[a-z0-9/_-]{0,80}$/i.test(value)) return '';
  return value.slice(0, 81);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function bump(pathname, column) {
  const target = normalizePath(pathname);
  if (!target) return null;
  if (column === 'visits' && !TRACKED.has(target) && !target.startsWith('/services/')) return null;
  const database = openDb();
  if (!database) return null;
  const now = new Date().toISOString();
  database.prepare(
    'INSERT INTO funnel_url (path, visits, conversions, updated_at) VALUES (?, 0, 0, ?) ON CONFLICT(path) DO NOTHING'
  ).run(target, now);
  if (column === 'visits') {
    database.prepare('UPDATE funnel_url SET visits = visits + 1, updated_at = ? WHERE path = ?').run(now, target);
  } else {
    database.prepare('UPDATE funnel_url SET conversions = conversions + 1, updated_at = ? WHERE path = ?').run(now, target);
  }
  return target;
}

function noteVisit(pathname) {
  try { return bump(pathname, 'visits'); } catch (_) { return null; }
}

function noteConversion(pathname) {
  try { return bump(pathname, 'conversions'); } catch (_) { return null; }
}

function funnelStatus() {
  const database = openDb();
  const rows = database
    ? database.prepare('SELECT path, visits, conversions FROM funnel_url').all()
    : [];
  const ranked = rows
    .filter((row) => Number(row.visits) > 0)
    .map((row) => ({
      path: row.path,
      visits: Number(row.visits) || 0,
      conversions: Number(row.conversions) || 0,
      yield: Number(row.visits) > 0 ? Math.round((Number(row.conversions) / Number(row.visits)) * 10000) / 10000 : 0,
    }))
    .sort((a, b) => (b.yield - a.yield) || (b.conversions - a.conversions) || a.path.localeCompare(b.path));
  const conversionsWithoutVisits = rows
    .filter((row) => !(Number(row.visits) > 0))
    .reduce((sum, row) => sum + (Number(row.conversions) || 0), 0);
  const best = ranked.find((row) => row.conversions > 0) || null;
  const visits = ranked.reduce((sum, row) => sum + row.visits, 0);
  let note = 'No visits recorded.';
  if (visits > 0 && !best) note = 'Visits are recorded and no conversion is recorded. Nothing is promoted.';
  if (best) note = 'The promotion is the recorded URL with the highest yield. Yield is conversions divided by visits on this process.';
  return {
    ok: true,
    protocol: PROTOCOL,
    recordedVisits: visits,
    recordedConversions: ranked.reduce((sum, row) => sum + row.conversions, 0),
    conversionsWithoutVisits,
    ranked,
    promoted: best ? best.path : null,
    promotionUrl: '/go',
    note,
  };
}

function noteCheckoutOpen(plan) {
  try {
    const id = String(plan || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 80);
    if (id.length < 3) return null;
    const database = openDb();
    if (!database) return null;
    database.prepare('INSERT INTO checkout_open (plan, opened_at, status) VALUES (?, ?, ?)').run(id, new Date().toISOString(), 'open');
    database.prepare('DELETE FROM checkout_open WHERE id NOT IN (SELECT id FROM checkout_open ORDER BY id DESC LIMIT 500)').run();
    return id;
  } catch (_) { return null; }
}

function markCheckoutOrdered(plan) {
  try {
    const id = String(plan || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 80);
    if (!id) return 0;
    const database = openDb();
    if (!database) return 0;
    const result = database.prepare("UPDATE checkout_open SET status = 'ordered' WHERE plan = ? AND status = 'open'").run(id);
    return result.changes || 0;
  } catch (_) { return 0; }
}

function recoveryStatus() {
  const database = openDb();
  const rows = database
    ? database.prepare('SELECT status, COUNT(*) AS n FROM checkout_open GROUP BY status').all()
    : [];
  const count = (status) => {
    const hit = rows.find((row) => row.status === status);
    return hit ? Number(hit.n) || 0 : 0;
  };
  const stillOpen = count('open');
  const ordered = count('ordered');
  const resumed = count('resumed');
  return {
    ok: true,
    protocol: PROTOCOL,
    opened: stillOpen + ordered + resumed,
    stillOpen,
    ordered,
    resumed,
    note: 'This page does not send a message. Resume returns the checkout link for an order or plan you already have. No other buyer is listed.',
  };
}

function shelfId(id) {
  try {
    const shelf = require('./public-shelf');
    return shelf.byId(id) || null;
  } catch (_) { return null; }
}

function readOrder(id) {
  if (process.env.NODE_ENV === 'test' && process.env.ROADMAP_READ_ORDERS !== '1') return null;
  try {
    const commerce = require('../site/sovereign-commerce');
    return (commerce.ORDERS && commerce.ORDERS.get(id)) || null;
  } catch (_) { return null; }
}

function resume(orderId) {
  const id = String(orderId || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 80);
  if (id.length < 3) return { ok: false, error: 'not_found' };
  const database = openDb();
  const openCount = database
    ? Number(database.prepare("SELECT COUNT(*) AS n FROM checkout_open WHERE plan = ? AND status = 'open'").get(id).n) || 0
    : 0;
  if (openCount > 0 && database) {
    database.prepare("UPDATE checkout_open SET status = 'resumed' WHERE plan = ? AND status = 'open'").run(id);
    return {
      ok: true,
      kind: 'opened',
      plan: id,
      checkoutPath: '/checkout/?plan=' + encodeURIComponent(id),
      note: recoveryStatus().note,
    };
  }
  if (shelfId(id)) {
    return {
      ok: true,
      kind: 'plan',
      plan: id,
      checkoutPath: '/checkout/?plan=' + encodeURIComponent(id),
      note: recoveryStatus().note,
    };
  }
  const order = readOrder(id);
  if (order) {
    return {
      ok: true,
      kind: 'order',
      status: order.status || 'unknown',
      serviceId: order.serviceId || null,
      checkoutPath: '/checkout/' + encodeURIComponent(id),
      note: recoveryStatus().note,
    };
  }
  return { ok: false, error: 'not_found' };
}

function affiliateDesk(code) {
  const clean = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  if (clean.length < 3) {
    return {
      ok: true,
      found: false,
      code: clean,
      redemptions: 0,
      payoutOwedUsd: 0,
      proofs: [],
      note: 'Enter a ref code. No payout is invented.',
    };
  }
  let proofs;
  try {
    proofs = require('./referral-engine-real').publicProofs(clean);
  } catch (_) {
    return { ok: false, error: 'ledger_unavailable', code: clean };
  }
  return proofs;
}

function negotiate(input) {
  const serviceId = String((input && (input.serviceId || input.id)) || '').trim().slice(0, 80);
  if (!serviceId) return { ok: false, error: 'serviceId_required' };
  let quote = null;
  try {
    quote = require('../../backend/modules/priceNegotiator').getPriceSync(serviceId, {});
  } catch (_) {
    quote = null;
  }
  const listUsd = quote && Number(quote.listUsd);
  if (!(listUsd > 0)) return { ok: false, error: 'unknown_offer', serviceId };
  const qty = Math.max(1, Math.min(100, Math.floor(Number(input && input.qty) || 1)));
  const listTotalUsd = round2(listUsd * qty);
  const rawOffer = input && (input.offerUsd != null ? input.offerUsd : input.offer);
  const offerBlank = rawOffer == null || String(rawOffer).trim() === '';
  const offerRaw = offerBlank ? NaN : Number(rawOffer);
  const offerUsd = Number.isFinite(offerRaw) ? round2(offerRaw) : null;
  const accepted = offerUsd != null && offerUsd + 0.001 >= listTotalUsd;
  const payload = {
    serviceId: quote.serviceId || serviceId,
    qty,
    listUsd,
    listTotalUsd,
    offerUsd,
    accepted,
    counterUsd: listTotalUsd,
  };
  const signed = signJson(payload);
  const verified = signed ? verifyJson(payload, signed.signature, signed.publicKey) : false;
  return Object.assign({
    ok: true,
    protocol: PROTOCOL,
    signature: signed ? signed.signature : null,
    publicKey: signed ? signed.publicKey : null,
    signatureVerified: verified === true,
    checkoutPath: '/checkout/?plan=' + encodeURIComponent(payload.serviceId),
    rule: 'The machine quote is the catalog list price. An offer under the list is refused. Bitcoin checkout applies its own 10% at payment. PayPal, card, and NOWPayments charge the list price.',
  }, payload);
}

function canonical(obj) {
  const sorted = {};
  Object.keys(obj).sort().forEach((key) => { sorted[key] = obj[key]; });
  return JSON.stringify(sorted);
}

function loadKeys() {
  if (keysCache) return keysCache;
  const file = path.join(stateDir(), 'roadmap-hybrid.json');
  const mldsa = require('@noble/post-quantum/ml-dsa.js');
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const mlPublic = Buffer.from(raw.mlDsa65.publicKey, 'hex');
      const mlSecret = Buffer.from(raw.mlDsa65.secretKey, 'hex');
      if (mlPublic.length === 1952 && mlSecret.length === 4032 && raw.ed25519 && raw.ed25519.privatePem) {
        keysCache = {
          edPrivate: crypto.createPrivateKey(raw.ed25519.privatePem),
          edPublic: crypto.createPublicKey(raw.ed25519.publicPem),
          edPem: String(raw.ed25519.publicPem),
          mlPublic,
          mlSecret,
          mldsa,
        };
        return keysCache;
      }
    }
  } catch (_) { /* regenerate below */ }
  const ed = crypto.generateKeyPairSync('ed25519');
  const kp = mldsa.ml_dsa65.keygen(crypto.randomBytes(32));
  const stored = {
    ed25519: {
      publicPem: ed.publicKey.export({ type: 'spki', format: 'pem' }),
      privatePem: ed.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    },
    mlDsa65: {
      publicKey: Buffer.from(kp.publicKey).toString('hex'),
      secretKey: Buffer.from(kp.secretKey).toString('hex'),
    },
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(stored), { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch (_) {}
  keysCache = {
    edPrivate: ed.privateKey,
    edPublic: ed.publicKey,
    edPem: stored.ed25519.publicPem,
    mlPublic: Buffer.from(kp.publicKey),
    mlSecret: Buffer.from(kp.secretKey),
    mldsa,
  };
  return keysCache;
}

function signJson(payload) {
  try {
    const keys = loadKeys();
    const signature = crypto.sign(null, Buffer.from(canonical(payload)), keys.edPrivate).toString('base64');
    return { signature, publicKey: keys.edPem };
  } catch (_) { return null; }
}

function verifyJson(payload, signature, publicKeyPem) {
  try {
    const keys = loadKeys();
    if (publicKeyPem !== keys.edPem) return false;
    return crypto.verify(null, Buffer.from(canonical(payload)), keys.edPublic, Buffer.from(signature, 'base64')) === true;
  } catch (_) { return false; }
}

function verifyHybrid(statement, sample) {
  try {
    const keys = loadKeys();
    const msg = Buffer.from(String(statement || ''), 'utf8');
    const edOk = crypto.verify(
      null,
      msg,
      keys.edPublic,
      Buffer.from(sample.ed25519.signatureBase64, 'base64')
    ) === true && sample.ed25519.publicKeyPem === keys.edPem;
    const mlOk = keys.mldsa.ml_dsa65.verify(
      Buffer.from(sample.mlDsa65.signatureHex, 'hex'),
      msg,
      keys.mlPublic
    ) === true && sample.mlDsa65.publicKeyHex === keys.mlPublic.toString('hex');
    return { ed25519: edOk, mlDsa65: mlOk };
  } catch (_) {
    return { ed25519: false, mlDsa65: false };
  }
}

function publicSample() {
  if (sampleCache) {
    const again = verifyHybrid(sampleCache.statement, sampleCache);
    sampleCache.verified = again;
    sampleCache.ok = again.ed25519 === true && again.mlDsa65 === true;
    return sampleCache;
  }
  try {
    const keys = loadKeys();
    const msg = Buffer.from(STATEMENT, 'utf8');
    const edSig = crypto.sign(null, msg, keys.edPrivate).toString('base64');
    const mlSig = Buffer.from(keys.mldsa.ml_dsa65.sign(msg, keys.mlSecret));
    const sample = {
      ok: false,
      protocol: PROTOCOL,
      statement: STATEMENT,
      armed: true,
      algorithm: 'Ed25519+ML-DSA-65',
      ed25519: { publicKeyPem: keys.edPem, signatureBase64: edSig },
      mlDsa65: {
        publicKeyHex: keys.mlPublic.toString('hex'),
        signatureHex: mlSig.toString('hex'),
        signatureBytes: mlSig.length,
      },
      verified: { ed25519: false, mlDsa65: false },
      note: 'Paid-order receipts stay Ed25519. This sample is not a paid-order receipt. The simulated dilithium provider is not used.',
    };
    sample.verified = verifyHybrid(STATEMENT, sample);
    sample.ok = sample.verified.ed25519 === true && sample.verified.mlDsa65 === true && mlSig.length === 3309;
    sampleCache = sample;
    return sample;
  } catch (_) {
    return {
      ok: false,
      armed: false,
      protocol: PROTOCOL,
      statement: STATEMENT,
      note: 'ML-DSA-65 did not sign in this process. No simulated Dilithium signature is substituted.',
    };
  }
}

function replicaStatus() {
  const region = String(process.env.ZEUS_REGION || process.env.SITE_REGION || '').trim().slice(0, 64);
  const role = String(process.env.SITE_CLUSTER_WORKER_ROLE || 'primary').trim().slice(0, 32) || 'primary';
  const extras = String(process.env.ZEUS_REPLICA_URLS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((item) => {
      try {
        const url = new URL(item);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        if (url.username || url.password) return null;
        return url.origin;
      } catch (_) { return null; }
    })
    .filter(Boolean);
  const self = {
    id: 'this-process',
    region: region || 'unspecified',
    regionSource: region ? 'env' : 'absent',
    role,
    probed: true,
    ok: true,
  };
  const others = extras.map((origin, index) => ({
    id: 'configured-' + (index + 1),
    origin,
    region: 'not labeled',
    probed: false,
    ok: null,
    note: 'Listed because ZEUS_REPLICA_URLS names it. This page does not probe that URL.',
  }));
  return {
    ok: true,
    protocol: PROTOCOL,
    count: 1 + others.length,
    knownRegions: region ? [region] : [],
    replicas: [self].concat(others),
    note: region
      ? 'Only the region named in the environment is shown. No extra region is invented.'
      : 'No region is configured. This process is the only replica this host knows. No extra region is invented.',
  };
}

function byoList() {
  let rows = [];
  try { rows = require('./money-catalog').industryMasterRows() || []; } catch (_) { rows = []; }
  return rows.filter((row) => row && row.id).map((row) => ({
    id: row.id,
    title: row.title,
    priceUsd: Number(row.priceUsd) || 0,
    downloadPath: '/byo/' + row.id + '.txt',
    servicePath: '/services/' + row.id,
  }));
}

function byoFile(id) {
  const clean = String(id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
  const row = byoList().find((item) => item.id === clean);
  if (!row) return null;
  return [
    '# ' + row.title + ' — customer runbook',
    '',
    'This file does not install an operating system.',
    'ZeusAI does not host this infrastructure. You run it on machines you already own.',
    'No secret, token, or wallet key is in this file.',
    '',
    'Offer: ' + row.id,
    'List price of the architecture pack: ' + row.priceUsd + ' USD',
    'Buy the pack: ' + row.servicePath,
    '',
    '## What you run',
    '1. Keep this runbook next to the architecture pack you paid for.',
    '2. Point your own reverse proxy at your own Node process.',
    '3. Do not copy ZeusAI production secrets into that process.',
    '',
    '## Compose sketch',
    'services:',
    '  app:',
    '    image: node:22-bookworm',
    '    # You supply the image contents. This sketch does not pull a ZeusAI image.',
    '    ports:',
    '      - "3000:3000"',
    '    environment:',
    '      - NODE_ENV=production',
    '',
  ].join('\n');
}

function listModules() {
  const database = openDb();
  const rows = database
    ? database.prepare('SELECT name, payout, note, created_at FROM third_party_module ORDER BY id ASC LIMIT 100').all()
    : [];
  return {
    ok: true,
    protocol: PROTOCOL,
    empty: rows.length === 0,
    modules: rows,
    zeusEngagement: '/services/ent-revenue-share',
    note: rows.length
      ? 'These rows are names and payout addresses a caller submitted. No revenue is invented. The ZeusAI engagement pack does not put the license in the download.'
      : 'No third-party module is registered.',
  };
}

function allowRegister() {
  const now = Date.now();
  while (registerStamps.length && now - registerStamps[0] > 3600000) registerStamps.shift();
  if (registerStamps.length >= 30) return false;
  registerStamps.push(now);
  return true;
}

function registerModule(input) {
  const name = String((input && input.name) || '').trim().replace(/\s+/g, ' ').slice(0, 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,63}$/.test(name)) return { ok: false, error: 'name_invalid' };
  let payout = String((input && (input.payout || input.address)) || '').trim();
  if (payout.toLowerCase().startsWith('bc1')) payout = payout.toLowerCase();
  if (!/^(bc1[a-z0-9]{20,90}|[13][a-zA-HJ-NP-Z0-9]{24,40})$/.test(payout)) {
    return { ok: false, error: 'payout_address_invalid' };
  }
  let note = String((input && input.note) || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140);
  if (note.indexOf('@') !== -1) return { ok: false, error: 'email_not_stored' };
  const database = openDb();
  if (!database) return { ok: false, error: 'ledger_unavailable' };
  const existing = database.prepare('SELECT name, payout, note, created_at FROM third_party_module WHERE name = ?').get(name);
  if (existing) {
    if (existing.payout === payout) return { ok: true, duplicate: true, module: existing };
    return { ok: false, error: 'name_taken' };
  }
  if (!allowRegister()) return { ok: false, error: 'rate_limited' };
  const created = new Date().toISOString();
  database.prepare('INSERT INTO third_party_module (name, payout, note, created_at) VALUES (?, ?, ?, ?)').run(name, payout, note, created);
  return { ok: true, module: { name, payout, note, created_at: created } };
}

function requestPath(req) {
  const raw = (req && (req.originalUrl || req.url)) || '/';
  return new URL(raw, 'http://local').pathname;
}

function queryOf(req) {
  const raw = (req && (req.originalUrl || req.url)) || '/';
  const params = new URL(raw, 'http://local').searchParams;
  const out = {};
  params.forEach((value, key) => {
    if (out[key] == null) out[key] = String(value).slice(0, 180);
  });
  return out;
}

async function readFields(req) {
  if (req && req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  let size = 0;
  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) break;
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = String((req && req.headers && req.headers['content-type']) || '');
  if (type.indexOf('application/json') !== -1) {
    try { return JSON.parse(raw || '{}'); } catch (_) { return {}; }
  }
  const out = {};
  new URLSearchParams(raw).forEach((value, key) => { out[key] = value; });
  return out;
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Protocol': PROTOCOL,
  });
  res.end(body);
}

async function handle(req, res) {
  const urlPath = requestPath(req);
  const method = String((req && req.method) || 'GET').toUpperCase();
  if (method === 'GET' && urlPath === '/go') {
    const status = funnelStatus();
    const dest = status.promoted && status.promoted.startsWith('/') && status.promoted.indexOf('//') !== 0
      ? status.promoted
      : '/funnel';
    res.writeHead(302, { Location: dest, 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }
  if (method === 'GET' && /^\/byo\/[a-z0-9-]+\.txt$/.test(urlPath)) {
    const file = byoFile(urlPath.slice('/byo/'.length, -4));
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Unknown pack.\n');
      return true;
    }
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment',
    });
    res.end(file);
    return true;
  }
  if (!urlPath.startsWith('/api/roadmap')) return false;
  try {
    if (urlPath === '/api/roadmap/funnel' && method === 'GET') {
      sendJson(res, 200, funnelStatus());
      return true;
    }
    if (urlPath === '/api/roadmap/recovery' && method === 'GET') {
      sendJson(res, 200, recoveryStatus());
      return true;
    }
    if (urlPath === '/api/roadmap/resume' && method === 'GET') {
      const out = resume(queryOf(req).order || queryOf(req).plan || '');
      sendJson(res, out.ok ? 200 : 404, out);
      return true;
    }
    if (urlPath === '/api/roadmap/affiliate' && method === 'GET') {
      sendJson(res, 200, affiliateDesk(queryOf(req).code || ''));
      return true;
    }
    if (urlPath === '/api/roadmap/quote' && (method === 'GET' || method === 'POST')) {
      const fields = method === 'POST' ? await readFields(req) : queryOf(req);
      const out = negotiate(fields);
      sendJson(res, out.ok ? 200 : 404, out);
      return true;
    }
    if (urlPath === '/api/roadmap/pq' && method === 'GET') {
      sendJson(res, 200, publicSample());
      return true;
    }
    if (urlPath === '/api/roadmap/replicas' && method === 'GET') {
      sendJson(res, 200, replicaStatus());
      return true;
    }
    if (urlPath === '/api/roadmap/byo' && method === 'GET') {
      sendJson(res, 200, { ok: true, packs: byoList() });
      return true;
    }
    if (urlPath.startsWith('/api/roadmap/byo/') && method === 'GET') {
      const id = decodeURIComponent(urlPath.slice('/api/roadmap/byo/'.length)).replace(/\.txt$/, '');
      const file = byoFile(id);
      if (!file) {
        sendJson(res, 404, { ok: false, error: 'unknown_pack' });
        return true;
      }
      sendJson(res, 200, { ok: true, id, file });
      return true;
    }
    if (urlPath === '/api/roadmap/modules' && method === 'GET') {
      sendJson(res, 200, listModules());
      return true;
    }
    if (urlPath === '/api/roadmap/modules' && method === 'POST') {
      const out = registerModule(await readFields(req));
      sendJson(res, out.ok ? 201 : 400, out);
      return true;
    }
    sendJson(res, 404, { ok: false, error: 'not_found' });
    return true;
  } catch (_) {
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'roadmap_failed' });
    return true;
  }
}

function section(kicker, titleHtml, lead, body) {
  return `<section style="padding-top:140px;max-width:980px" data-roadmap="1">
  <span class="kicker">${esc(kicker)}</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">${titleHtml}</h1>
  <p style="color:var(--ink-dim);max-width:700px">${esc(lead)}</p>
  ${body}
  <p style="margin-top:22px"><a href="/roadmap" data-link>Back to the roadmap</a></p>
</section>`;
}

function pageFunnel() {
  const status = funnelStatus();
  const rows = status.ranked.length
    ? status.ranked.map((row) => `<tr><td><a href="${esc(row.path)}">${esc(row.path)}</a></td><td>${row.visits}</td><td>${row.conversions}</td><td>${row.yield}</td></tr>`).join('')
    : '<tr><td colspan="4">No visits recorded.</td></tr>';
  const promo = status.promoted
    ? `<p>Promoted URL: <a href="${esc(status.promoted)}">${esc(status.promoted)}</a>. Open <a href="/go">/go</a> and this process redirects there.</p>`
    : '<p>Nothing is promoted. <a href="/go">/go</a> returns to this page until a recorded conversion exists.</p>';
  return section(
    'Funnel',
    'Yield-ranked <span class="grad">URL promotion.</span>',
    status.note,
    `<div class="card" style="padding:18px;margin-top:18px">${promo}<p style="color:var(--ink-dim);font-size:13px">Visits: ${status.recordedVisits}. Conversions on visited URLs: ${status.recordedConversions}. Conversions with no matching visit: ${status.conversionsWithoutVisits}. Machine read: <code>GET /api/roadmap/funnel</code>.</p></div>
    <div class="card" style="padding:0;overflow:auto;margin-top:14px"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:10px">URL</th><th style="text-align:left;padding:10px">Visits</th><th style="text-align:left;padding:10px">Conversions</th><th style="text-align:left;padding:10px">Yield</th></tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

function pageRecovery(params) {
  const status = recoveryStatus();
  const query = (params && params.roadmapQuery) || {};
  let result = '';
  if (query.order) {
    const out = resume(query.order);
    result = out.ok
      ? `<p>Resume <a href="${esc(out.checkoutPath)}">${esc(out.checkoutPath)}</a>. Status kept on this page: ${esc(out.kind)}.</p>`
      : '<p>No open checkout matches that id.</p>';
  }
  return section(
    'Recovery',
    'Checkout <span class="grad">recovery.</span>',
    status.note,
    `<div class="card" style="padding:18px;margin-top:18px"><p>Opened on this process: ${status.opened}. Still open: ${status.stillOpen}. Ordered: ${status.ordered}. Resumed: ${status.resumed}.</p>${result}
    <form method="get" action="/recovery" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><input name="order" value="${esc(query.order || '')}" placeholder="Order id or shelf id" style="flex:1;min-width:200px;padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"><button class="btn btn-primary" type="submit">Resume</button></form>
    <p style="color:var(--ink-dim);font-size:13px">The site process already retries a pending invoice when a buyer email is on that order and the mailer reports ok. This page does not send a message. <code>GET /api/roadmap/recovery</code></p></div>`
  );
}

function pageAffiliateDesk(params) {
  const query = (params && params.roadmapQuery) || {};
  const view = affiliateDesk(query.code || '');
  const proofs = (view.proofs || []).length
    ? (view.proofs || []).map((row) => `<li><code>${esc(row.txid)}</code> — recorded payout ${esc(row.payoutUsd)} USD. This page does not query the Bitcoin network.</li>`).join('')
    : '<li>No on-chain payout proof is stored.</li>';
  return section(
    'Affiliate desk',
    'Self-serve <span class="grad">payout ledger.</span>',
    view.note || 'Enter a ref code. No payout is invented.',
    `<div class="card" style="padding:18px;margin-top:18px">
    <form method="get" action="/affiliate/desk" style="display:flex;gap:10px;flex-wrap:wrap"><input name="code" value="${esc(query.code || '')}" placeholder="Ref code" style="flex:1;min-width:200px;padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"><button class="btn btn-primary" type="submit">Look up</button></form>
    <p style="margin-top:12px">Found: ${view.found ? 'yes' : 'no'}. Redemptions: ${Number(view.redemptions) || 0}. Owed: ${Number(view.payoutOwedUsd) || 0} USD.</p>
    <ul>${proofs}</ul>
    <p style="color:var(--ink-dim);font-size:13px">Generate a link on <a href="/affiliate" data-link>/affiliate</a>. The owner records a txid after a manual Bitcoin send. This page does not broadcast a transaction. <code>GET /api/roadmap/affiliate?code=</code></p></div>`
  );
}

function pageQuote(params) {
  const query = (params && params.roadmapQuery) || {};
  let result = '';
  if (query.serviceId) {
    const out = negotiate(query);
    result = out.ok
      ? `<p>List ${esc(out.listUsd)} USD × ${esc(out.qty)} = ${esc(out.listTotalUsd)} USD. Offer ${esc(out.offerUsd == null ? 'none' : out.offerUsd)}. Accepted: ${out.accepted ? 'yes' : 'no'}. Counter: ${esc(out.counterUsd)} USD. Signature checks: ${out.signatureVerified ? 'yes' : 'no'}.</p><p><a href="${esc(out.checkoutPath)}">Open checkout</a></p><p>${esc(out.rule)}</p>`
      : '<p>This id is not on the catalog. No price is invented.</p>';
  }
  return section(
    'Agent quote',
    'Machine-negotiated <span class="grad">list price.</span>',
    'An agent offers a USD amount. The counter is the catalog list price. An offer under the list is refused.',
    `<div class="card" style="padding:18px;margin-top:18px">${result}
    <form method="get" action="/agents/quote" style="display:grid;gap:10px;margin-top:12px">
      <input name="serviceId" value="${esc(query.serviceId || '')}" placeholder="Shelf id, for example instant-website-audit" style="padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <input name="qty" value="${esc(query.qty || '1')}" placeholder="Quantity" style="padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <input name="offerUsd" value="${esc(query.offerUsd || '')}" placeholder="Offer in USD" style="padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <button class="btn btn-primary" type="submit">Ask for the quote</button>
    </form>
    <p style="color:var(--ink-dim);font-size:13px"><code>POST /api/roadmap/quote</code> with serviceId, qty, and offerUsd. The same rule is on <code>POST /api/agent/quote</code> for the existing order flow.</p></div>`
  );
}

function pagePq() {
  const sample = publicSample();
  const verified = sample.ok ? 'yes' : 'no';
  const bytes = sample.mlDsa65 ? sample.mlDsa65.signatureBytes : 0;
  return section(
    'Post-quantum',
    'Hybrid <span class="grad">Ed25519 + ML-DSA-65.</span>',
    sample.note || 'ML-DSA-65 did not sign in this process.',
    `<div class="card" style="padding:18px;margin-top:18px"><p>Verified on this request: ${verified}. ML-DSA-65 signature bytes: ${esc(bytes)}. Algorithm: ${esc(sample.algorithm || 'unarmed')}.</p>
    <pre style="white-space:pre-wrap;font-size:13px">${esc(sample.statement || STATEMENT)}</pre>
    <p style="color:var(--ink-dim);font-size:13px">Paid-order receipts stay Ed25519. This sample is not a paid-order receipt. <code>GET /api/roadmap/pq</code></p></div>`
  );
}

function pageReplicas() {
  const status = replicaStatus();
  const rows = status.replicas.map((row) => `<li>${esc(row.id)} — region ${esc(row.region)} — role ${esc(row.role || 'n/a')} — probed ${row.probed ? 'yes' : 'no'}${row.origin ? ' — ' + esc(row.origin) : ''}</li>`).join('');
  return section(
    'Replicas',
    'Sovereign <span class="grad">replicas.</span>',
    status.note,
    `<div class="card" style="padding:18px;margin-top:18px"><p>Known regions: ${status.knownRegions.length}. Replicas this process can name: ${status.count}.</p><ul>${rows}</ul><p style="color:var(--ink-dim);font-size:13px">Set ZEUS_REGION and ZEUS_REPLICA_URLS on the host. An empty list stays empty. <code>GET /api/roadmap/replicas</code></p></div>`
  );
}

function pageByo() {
  const packs = byoList();
  const rows = packs.length
    ? packs.map((row) => `<li><a href="${esc(row.downloadPath)}">${esc(row.title)}</a> — list ${esc(row.priceUsd)} USD — <a href="${esc(row.servicePath)}">shelf page</a></li>`).join('')
    : '<li>No architecture pack is loaded.</li>';
  return section(
    'BYO infra',
    'Customer-deployable <span class="grad">runbooks.</span>',
    'Each download is a runbook. It does not install an operating system. ZeusAI does not host the customer infrastructure.',
    `<div class="card" style="padding:18px;margin-top:18px"><ul>${rows}</ul><p style="color:var(--ink-dim);font-size:13px">The paid file remains the architecture pack on the shelf. This runbook has no secrets. <code>GET /api/roadmap/byo</code></p></div>`
  );
}

function pageModules(params) {
  const status = listModules();
  const result = params && params.roadmapResult;
  let flash = '';
  if (result && result.ok) flash = '<p>Registered ' + esc(result.module && result.module.name) + '.</p>';
  else if (result && result.error) flash = '<p>Not stored: ' + esc(result.error) + '.</p>';
  const rows = status.modules.length
    ? status.modules.map((row) => `<li>${esc(row.name)} — <code>${esc(row.payout)}</code></li>`).join('')
    : '<li>No third-party module is registered.</li>';
  return section(
    'Module marketplace',
    'Revenue-share <span class="grad">registry.</span>',
    status.note,
    `<div class="card" style="padding:18px;margin-top:18px">${flash}<ul>${rows}</ul>
    <form method="post" action="/module-registry" style="display:grid;gap:10px;margin-top:12px">
      <input name="name" placeholder="Module name" style="padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <input name="payout" placeholder="Bitcoin payout address" style="padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <input name="note" placeholder="Short note, no email" style="padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <button class="btn btn-primary" type="submit">Register</button>
    </form>
    <p style="color:var(--ink-dim);font-size:13px">ZeusAI's own engagement stays at <a href="${esc(status.zeusEngagement)}">${esc(status.zeusEngagement)}</a>. That pack does not deliver the license. <code>POST /api/roadmap/modules</code></p></div>`
  );
}

function page(route, params) {
  if (route === '/funnel') return pageFunnel();
  if (route === '/recovery') return pageRecovery(params);
  if (route === '/affiliate/desk') return pageAffiliateDesk(params);
  if (route === '/agents/quote') return pageQuote(params);
  if (route === '/pq') return pagePq();
  if (route === '/replicas') return pageReplicas();
  if (route === '/byo') return pageByo();
  if (route === '/module-registry') return pageModules(params);
  return null;
}

function meta(route) {
  return META[route] || null;
}

function _resetForTests() {
  if (process.env.NODE_ENV !== 'test') return;
  registerStamps.length = 0;
  sampleCache = null;
  keysCache = null;
  openDb();
  if (db) {
    try {
      db.exec('DELETE FROM funnel_url; DELETE FROM checkout_open; DELETE FROM third_party_module;');
    } catch (_) { /* fresh process */ }
  }
}

module.exports = {
  PROTOCOL,
  meta,
  page,
  handle,
  readFields,
  noteVisit,
  noteConversion,
  noteCheckoutOpen,
  markCheckoutOrdered,
  funnelStatus,
  recoveryStatus,
  resume,
  affiliateDesk,
  negotiate,
  publicSample,
  verifyHybrid,
  replicaStatus,
  byoList,
  byoFile,
  listModules,
  registerModule,
  _resetForTests,
};
