'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { signContract, verifyContract, publicKeyBase64 } = require('./signer');

const LANES = [
  [['audit', 'seo', 'search', 'keyword', 'google'], 'instant-website-audit'],
  [['logo', 'brand'], 'instant-logo-kit'],
  [['pitch', 'investor', 'deck'], 'instant-pitch-deck'],
  [['landing', 'homepage'], 'instant-landing-page'],
  [['resume', 'cv'], 'instant-resume-makeover'],
];

function dbPath() {
  return process.env.WITNESS_DB || path.join(process.env.SNM_STATE_DIR || '/opt/zeusai/state', 'witness_contracts.sqlite');
}

function openDb() {
  const Database = require('better-sqlite3');
  fs.mkdirSync(path.dirname(dbPath()), { recursive: true });
  const db = new Database(dbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS witness_contracts (
    id TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
    clicks INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    offer_id TEXT,
    shelf_price_btc REAL,
    shelf_price_usd REAL,
    delivery_file_hash TEXT,
    delivery_file_url TEXT,
    gsc_date TEXT NOT NULL,
    signed_at TEXT NOT NULL,
    signature TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    contract_json TEXT NOT NULL,
    UNIQUE(query_text, gsc_date)
  )`);
  return db;
}

function rowToContract(row) {
  if (!row) return null;
  const payload = JSON.parse(row.contract_json);
  return {
    id: row.id,
    payload,
    signature: row.signature,
    pubkey: row.pubkey,
    signed_at: row.signed_at,
    url: '/witness/' + row.id,
  };
}

function getOffer(offerId) {
  if (!offerId) return null;
  try {
    const item = require('../../src/commerce/public-shelf').byId(offerId);
    if (!item) return null;
    const usd = Number(item.priceUsd);
    const btc = Number(item.priceBtc);
    return {
      id: item.id,
      price_usd: Number.isFinite(usd) && usd > 0 ? Number(usd.toFixed(2)) : null,
      price_btc: Number.isFinite(btc) && btc > 0 ? btc : null,
    };
  } catch (_) {
    return null;
  }
}

function offerForQuery(query) {
  const text = String(query || '').toLowerCase();
  for (const lane of LANES) {
    if (lane[0].some((key) => text.includes(key))) return getOffer(lane[1]);
  }
  return null;
}

function deliveryRoot() {
  return process.env.ZEUS_DELIVERY_DIR || '/opt/zeusai/deliveries';
}

function findDeliveryForOffer(offerId) {
  if (!offerId) return null;
  const root = deliveryRoot();
  if (!fs.existsSync(root)) return null;
  let best = null;
  let names = [];
  try { names = fs.readdirSync(root); } catch (_) { return null; }
  for (const name of names) {
    const manifestPath = path.join(root, name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (_) { manifest = null; }
    if (!manifest || manifest.offerId !== offerId || !manifest.sha256 || !manifest.filename) continue;
    const stamp = fs.statSync(manifestPath).mtimeMs;
    if (!best || stamp > best.stamp) best = { stamp, manifest, orderId: name };
  }
  if (!best) return null;
  return {
    hash: best.manifest.sha256,
    url: '/deliveries/' + encodeURIComponent(best.orderId) + '/' + encodeURIComponent(best.manifest.filename),
  };
}

function createWitness(queryData, offerData, deliveryFile) {
  const queryText = String(queryData && queryData.query || '').trim();
  const clicks = Number(queryData && queryData.clicks);
  const impressions = Number(queryData && queryData.impressions);
  const gscDate = String(queryData && queryData.date || '');
  if (!queryText || !gscDate || !Number.isFinite(clicks) || !Number.isFinite(impressions)) {
    return { ok: false, error: 'incomplete_measured_row' };
  }
  const offer = offerData && offerData.id ? offerData : offerForQuery(queryText);
  const delivery = deliveryFile && deliveryFile.hash
    ? deliveryFile
    : findDeliveryForOffer(offer && offer.id);
  const payload = {
    query_text: queryText,
    clicks,
    impressions,
    offer_id: offer && offer.id ? offer.id : null,
    shelf_price_btc: offer && offer.price_btc != null ? offer.price_btc : null,
    shelf_price_usd: offer && offer.price_usd != null ? offer.price_usd : null,
    delivery_file_hash: delivery && delivery.hash ? delivery.hash : null,
    delivery_file_url: delivery && delivery.url ? delivery.url : null,
    gsc_date: gscDate,
  };
  const db = openDb();
  try {
    const existing = db.prepare('SELECT * FROM witness_contracts WHERE query_text = ? AND gsc_date = ?').get(queryText, gscDate);
    if (existing) return { ok: true, skipped: true, contract: rowToContract(existing) };
    const signed = signContract(payload);
    if (!verifyContract(signed)) return { ok: false, error: 'signature_failed' };
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO witness_contracts (
      id, query_text, clicks, impressions, offer_id, shelf_price_btc, shelf_price_usd,
      delivery_file_hash, delivery_file_url, gsc_date, signed_at, signature, pubkey, contract_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      queryText,
      clicks,
      impressions,
      payload.offer_id,
      payload.shelf_price_btc,
      payload.shelf_price_usd,
      payload.delivery_file_hash,
      payload.delivery_file_url,
      gscDate,
      signed.signed_at,
      signed.signature,
      signed.pubkey,
      JSON.stringify(payload)
    );
    return {
      ok: true,
      skipped: false,
      contract: {
        id,
        payload,
        signature: signed.signature,
        pubkey: signed.pubkey,
        signed_at: signed.signed_at,
        url: '/witness/' + id,
      },
    };
  } finally {
    db.close();
  }
}

function getWitness(id) {
  const db = openDb();
  try {
    return rowToContract(db.prepare('SELECT * FROM witness_contracts WHERE id = ?').get(String(id || '')));
  } finally {
    db.close();
  }
}

function listWitnesses(opts) {
  const limit = Math.max(0, Math.min(200, Number(opts && opts.limit != null ? opts.limit : 50)));
  const offset = Math.max(0, Number(opts && opts.offset != null ? opts.offset : 0));
  const db = openDb();
  try {
    return db.prepare('SELECT * FROM witness_contracts ORDER BY signed_at DESC LIMIT ? OFFSET ?').all(limit, offset).map(rowToContract);
  } finally {
    db.close();
  }
}

function findByQuery(queryText) {
  const db = openDb();
  try {
    return rowToContract(db.prepare('SELECT * FROM witness_contracts WHERE query_text = ? ORDER BY signed_at DESC LIMIT 1').get(String(queryText || '')));
  } finally {
    db.close();
  }
}

function findByOffer(offerId) {
  if (!offerId) return null;
  const db = openDb();
  try {
    return rowToContract(db.prepare('SELECT * FROM witness_contracts WHERE offer_id = ? ORDER BY signed_at DESC LIMIT 1').get(String(offerId)));
  } finally {
    db.close();
  }
}

module.exports = {
  dbPath,
  getOffer,
  offerForQuery,
  findDeliveryForOffer,
  createWitness,
  getWitness,
  listWitnesses,
  findByQuery,
  findByOffer,
  publicKeyBase64,
};
