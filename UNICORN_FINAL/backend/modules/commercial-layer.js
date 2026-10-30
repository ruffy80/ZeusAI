'use strict';

/**
 * Commercial layer: one priceNegotiator quote, the public shelf, and the
 * buyer features that sit on top of it.
 *
 * PostgreSQL on 127.0.0.1:5432 and Redis on 127.0.0.1:6379 were closed
 * (ECONNREFUSED) when this module was written. Tables use the SQLite file
 * this process can actually open. Price locks use that same file with a
 * 900 second TTL. The status payload keeps the probe error.
 */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const priceNegotiator = require('./priceNegotiator');

const PLAN_DEFS = Object.freeze([
  {
    id: 'starter',
    name: 'Starter',
    quotedUsd: 29,
    includes: '5 audits + 5 logos per month',
    contact: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    quotedUsd: 99,
    includes: '20 audits + 20 logos + 1 landing page per month',
    contact: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    quotedUsd: null,
    includes: 'Manual plan. Contact the operator.',
    contact: true,
  },
]);

const BUNDLE_SEED = Object.freeze([
  {
    id: 'startup-launch',
    name: 'Startup Launch Pack',
    service_ids: ['website-audit', 'brand-logo-kit', 'landing-page'],
    discount_pct: 15,
  },
  {
    id: 'seo-domination',
    name: 'SEO Domination Pack',
    service_ids: ['seo-content-pack', 'website-audit', 'landing-page'],
    discount_pct: 20,
  },
  {
    id: 'enterprise-kickoff',
    name: 'Enterprise Kickoff Pack',
    service_ids: ['pitch-deck', 'business-launch', 'brand-logo-kit'],
    discount_pct: 25,
  },
]);

const probes = { postgres: null, redis: null };
let spotError = null;
let dbHandle = null;
let timersStarted = false;
let lastReportWeek = null;

function stateDir() {
  return process.env.ZEUS_STATE_DIR || process.env.SNM_STATE_DIR || '/opt/zeusai/state';
}

function probePort(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port, timeout: 400 });
    const finish = (value) => {
      try { socket.destroy(); } catch (_) { /* closed */ }
      resolve(value);
    };
    socket.on('connect', () => finish(null));
    socket.on('timeout', () => finish('timeout 127.0.0.1:' + port));
    socket.on('error', (err) => finish(String(err && err.message || err)));
  });
}

async function probeStores() {
  if (!probes.postgres) probes.postgres = await probePort(5432);
  if (!probes.redis) probes.redis = await probePort(6379);
  return { postgres: probes.postgres, redis: probes.redis };
}

function db() {
  if (dbHandle) return dbHandle;
  const Database = require('better-sqlite3');
  const dir = stateDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'commercial.sqlite');
  const handle = new Database(file);
  handle.pragma('journal_mode = WAL');
  handle.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      btc_address TEXT,
      amount_btc TEXT,
      amount_usd REAL,
      invoice_id TEXT,
      started_at TEXT,
      expires_at TEXT,
      pay_expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bundles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      service_ids TEXT NOT NULL,
      discount_pct REAL DEFAULT 15,
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      owner_email TEXT NOT NULL,
      uses INTEGER DEFAULT 0,
      credit_usd REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS price_locks (
      lock_key TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      locked_price_btc TEXT NOT NULL,
      locked_price_usd REAL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS delivery_previews (
      id TEXT PRIMARY KEY,
      service_name TEXT,
      delivered_at TEXT,
      sha256 TEXT,
      teaser TEXT,
      signature TEXT,
      pubkey TEXT,
      consent INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      week_key TEXT,
      body_json TEXT NOT NULL,
      signature TEXT,
      pubkey TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS commercial_orders (
      id TEXT PRIMARY KEY,
      email TEXT,
      offer_id TEXT,
      amount_usd REAL,
      amount_btc TEXT,
      status TEXT,
      ref_code TEXT,
      referral_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS demo_hits (
      ip_hash TEXT NOT NULL,
      hour_bucket TEXT NOT NULL,
      hits INTEGER DEFAULT 0,
      PRIMARY KEY (ip_hash, hour_bucket)
    );
  `);
  const insert = handle.prepare(`
    INSERT OR IGNORE INTO bundles (id, name, service_ids, discount_pct, active)
    VALUES (@id, @name, @service_ids, @discount_pct, 1)
  `);
  for (const row of BUNDLE_SEED) {
    insert.run({
      id: row.id,
      name: row.name,
      service_ids: JSON.stringify(row.service_ids),
      discount_pct: row.discount_pct,
    });
  }
  dbHandle = handle;
  return handle;
}

function ownerBtc() {
  return process.env.BTC_WALLET_ADDRESS
    || process.env.ADMIN_OWNER_BTC
    || process.env.OWNER_BTC_ADDRESS
    || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
}

function btcUri(offerId, btc) {
  const amount = String(btc || '');
  if (!amount || Number(amount) <= 0) return null;
  return 'bitcoin:' + ownerBtc()
    + '?amount=' + amount
    + '&label=' + encodeURIComponent('ZeusAI-' + String(offerId || 'offer'));
}

function readSpot() {
  try {
    const raw = fs.readFileSync(path.join(stateDir(), 'commercial-btc-spot.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Number(parsed.usdPerBtc) > 0) return parsed;
  } catch (_) { /* no shared spot yet */ }
  return null;
}

function writeSpot(usdPerBtc) {
  const dir = stateDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'commercial-btc-spot.json'),
    JSON.stringify({ usdPerBtc, fetchedAt: Date.now() })
  );
}

function sharedRateSync() {
  const forced = Number(process.env.COMMERCIAL_BTC_RATE);
  if (forced > 0) return forced;
  if (process.env.NODE_ENV === 'test') return 0;
  const now = Date.now();
  const cached = readSpot();
  if (cached && now - Number(cached.fetchedAt) < 60000) return Number(cached.usdPerBtc);
  try {
    const { execFileSync } = require('child_process');
    const raw = execFileSync('curl', [
      '-fsS', '--max-time', '2',
      'https://api.coinbase.com/v2/prices/BTC-USD/spot',
    ], { encoding: 'utf8', timeout: 3500 });
    const amount = Number(JSON.parse(raw).data.amount);
    if (amount > 0) {
      writeSpot(amount);
      spotError = null;
      return amount;
    }
  } catch (err) {
    spotError = String(err && err.message || err);
  }
  if (cached && Number(cached.usdPerBtc) > 0) return Number(cached.usdPerBtc);
  return 0;
}

function quoteSync(offerId, context) {
  const extra = context || {};
  const rate = Number(extra.btcRate) > 0 ? Number(extra.btcRate) : sharedRateSync();
  const ctx = {
    userId: extra.userId || null,
    coupon: extra.coupon || null,
    btcRate: rate,
  };
  if (Number(extra.basePrice) > 0) ctx.basePrice = Number(extra.basePrice);
  if (Number(extra.quotedUsd) > 0) ctx.quotedUsd = Number(extra.quotedUsd);
  const quote = priceNegotiator.getPriceSync(offerId, ctx);
  return Object.assign({}, quote, { btcUri: btcUri(quote.productId, quote.btc) });
}

function priceServices(services) {
  const list = Array.isArray(services) ? services.slice() : [];
  const priced = list.map((service) => {
    const rawList = service.priceUsd == null && service.priceUSD == null ? Number(service.price) : 0;
    const quote = quoteSync(service.id, rawList > 0 ? { basePrice: rawList } : {});
    return Object.assign({}, service, {
      priceUsd: quote.usd,
      priceUSD: quote.usd,
      price: quote.usd,
      priceBtc: quote.btc,
      btcUri: quote.btcUri,
      category: service.category || service.tier || service.group || service.segment || 'service',
      priceSource: quote.source,
    });
  });
  if (!priced.some((row) => row.id === 'website-audit')) {
    const source = priced.find((row) => row.id === 'instant-website-audit');
    const quote = quoteSync('website-audit');
    priced.push({
      id: 'website-audit',
      title: (source && source.title) || 'Website audit',
      description: source && source.description ? String(source.description).split('\n')[0] : 'Website audit file.',
      aliasOf: 'instant-website-audit',
      category: 'instant',
      tier: 'instant',
      group: 'instant',
      priceUsd: quote.usd,
      priceUSD: quote.usd,
      price: quote.usd,
      priceBtc: quote.btc,
      btcUri: quote.btcUri,
      priceSource: quote.source,
    });
  }
  return priced;
}

function plansPayload() {
  const plans = PLAN_DEFS.map((plan) => {
    if (plan.contact) {
      return {
        id: plan.id,
        name: plan.name,
        includes: plan.includes,
        contact: true,
        usd: null,
        btc: null,
        btcUri: null,
        href: '/contact',
      };
    }
    const quote = quoteSync('sub-' + plan.id, { quotedUsd: plan.quotedUsd });
    return {
      id: plan.id,
      name: plan.name,
      includes: plan.includes,
      contact: false,
      usd: quote.usd,
      btc: quote.btc,
      btcUri: quote.btcUri,
      source: quote.source,
      interval: 'month',
    };
  });
  return { ok: true, count: plans.length, plans, storage: storageNote() };
}

function bundleRows() {
  return db().prepare('SELECT * FROM bundles WHERE active = 1 ORDER BY id').all().map((row) => {
    const ids = JSON.parse(row.service_ids);
    const parts = ids.map((id) => {
      const quote = quoteSync(id);
      return { id, usd: quote.usd, btc: quote.btc };
    });
    const sumUsd = Math.round(parts.reduce((sum, part) => sum + Number(part.usd || 0), 0) * 100) / 100;
    const sumBtc = parts.reduce((sum, part) => sum + Number(part.btc || 0), 0);
    const factor = 1 - (Number(row.discount_pct) / 100);
    const usd = Math.round(sumUsd * factor * 100) / 100;
    const rate = sharedRateSync();
    const btc = rate > 0 ? (usd / rate).toFixed(8) : (sumBtc * factor).toFixed(8);
    return {
      id: row.id,
      name: row.name,
      serviceIds: ids,
      discountPct: Number(row.discount_pct),
      parts,
      sumUsd,
      sumBtc: sumBtc.toFixed(8),
      usd,
      btc,
      btcUri: btcUri(row.id, btc),
      belowSum: Number(btc) < Number(sumBtc.toFixed(8)) - 1e-12,
    };
  });
}

function bundlesPayload() {
  const bundles = bundleRows();
  return { ok: true, count: bundles.length, bundles, storage: storageNote() };
}

function ipHash(ip) {
  return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 16);
}

function lockKey(ip, offerId) {
  return 'price_lock:' + ipHash(ip) + ':' + String(offerId || '');
}

function priceLock(ip, offerId) {
  const id = String(offerId || '').trim();
  if (!id) return { ok: false, error: 'offer_required' };
  const key = lockKey(ip, id);
  const now = Date.now();
  const existing = db().prepare('SELECT * FROM price_locks WHERE lock_key = ?').get(key);
  if (existing && Number(existing.expires_at) > now) {
    return {
      ok: true,
      offerId: id,
      locked_price_btc: existing.locked_price_btc,
      locked_price_usd: existing.locked_price_usd,
      expires_at: new Date(Number(existing.expires_at)).toISOString(),
      storage: 'sqlite',
      redisError: probes.redis,
    };
  }
  const quote = quoteSync(id);
  const expires = now + 900000;
  db().prepare(`
    INSERT INTO price_locks (lock_key, offer_id, locked_price_btc, locked_price_usd, expires_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(lock_key) DO UPDATE SET
      locked_price_btc = excluded.locked_price_btc,
      locked_price_usd = excluded.locked_price_usd,
      expires_at = excluded.expires_at
  `).run(key, id, quote.btc, quote.usd, expires);
  return {
    ok: true,
    offerId: id,
    locked_price_btc: quote.btc,
    locked_price_usd: quote.usd,
    expires_at: new Date(expires).toISOString(),
    storage: 'sqlite',
    redisError: probes.redis,
  };
}

function validLock(ip, offerId) {
  const key = lockKey(ip, offerId);
  const row = db().prepare('SELECT * FROM price_locks WHERE lock_key = ?').get(key);
  if (!row || Number(row.expires_at) <= Date.now()) return null;
  return {
    locked_price_btc: row.locked_price_btc,
    locked_price_usd: Number(row.locked_price_usd),
    expires_at: new Date(Number(row.expires_at)).toISOString(),
  };
}

function referralByCode(code) {
  const key = String(code || '').trim().toLowerCase();
  if (!key) return null;
  return db().prepare('SELECT * FROM referrals WHERE code = ?').get(key) || null;
}

function referralPayload(code) {
  const row = referralByCode(code);
  if (!row) return { ok: true, valid: false, discount_pct: 0 };
  return { ok: true, valid: true, discount_pct: 10, code: row.code };
}

function previewReferral(code, amountUsd) {
  const row = referralByCode(code);
  const usd = Number(amountUsd);
  if (!row || !(usd > 0)) return { ok: false, valid: false, discountedUsd: usd };
  const discountedUsd = Math.round(usd * 90) / 100;
  return { ok: true, valid: true, code: row.code, discount_pct: 10, discountedUsd };
}

function issueReferral(email) {
  const owner = String(email || '').trim().toLowerCase();
  if (!owner || !owner.includes('@')) return null;
  const existing = db().prepare('SELECT * FROM referrals WHERE owner_email = ?').get(owner);
  if (existing) return existing;
  const row = {
    id: crypto.randomUUID(),
    code: crypto.randomBytes(6).toString('hex'),
    owner_email: owner,
  };
  db().prepare('INSERT INTO referrals (id, code, owner_email, uses, credit_usd) VALUES (?, ?, ?, 0, 0)')
    .run(row.id, row.code, row.owner_email);
  return db().prepare('SELECT * FROM referrals WHERE code = ?').get(row.code);
}

function onConfirmedPayment(input) {
  const body = input || {};
  if (body.mock === true || String(body.txid || '').startsWith('simulated-')) {
    return { ok: true, skipped: 'mock' };
  }
  const email = String(body.email || '').trim().toLowerCase();
  const issued = email ? issueReferral(email) : null;
  const orderId = String(body.orderId || crypto.randomUUID());
  const existing = db().prepare('SELECT ref_code FROM commercial_orders WHERE id = ?').get(orderId);
  if (!existing) {
    db().prepare(`
      INSERT INTO commercial_orders
        (id, email, offer_id, amount_usd, amount_btc, status, ref_code, referral_code)
      VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)
    `).run(
      orderId,
      email || null,
      body.offerId || null,
      Number(body.amountUsd) || 0,
      body.amountBtc != null ? String(body.amountBtc) : null,
      body.refCode || null,
      issued ? issued.code : null
    );
  }
  const creditedAlready = existing && existing.ref_code;
  if (body.refCode && !creditedAlready) {
    const ref = referralByCode(body.refCode);
    const credit = Math.round((Number(body.amountUsd) || 0) * 10) / 100;
    if (ref && credit > 0) {
      db().prepare('UPDATE referrals SET uses = uses + 1, credit_usd = credit_usd + ? WHERE code = ?')
        .run(credit, ref.code);
      if (existing) {
        db().prepare('UPDATE commercial_orders SET ref_code = ? WHERE id = ?').run(body.refCode, orderId);
      }
    }
  }
  if (body.subscriptionId) {
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 3600 * 1000);
    db().prepare(`
      UPDATE subscriptions
      SET status = 'active', started_at = ?, expires_at = ?
      WHERE id = ?
    `).run(start.toISOString(), end.toISOString(), String(body.subscriptionId));
  }
  return {
    ok: true,
    referralCode: issued ? issued.code : null,
    referralUrl: issued ? ('/?ref=' + issued.code) : null,
  };
}

function signedDeliveryCount() {
  const ids = new Set();
  try {
    const dir = require('./paid-delivery').deliveryDir();
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const body = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        if (body && body.mock !== true && body.status === 'delivered' && body.orderId) ids.add(String(body.orderId));
      } catch (_) { /* unreadable file is not a delivery */ }
    }
  } catch (_) { /* delivery dir absent */ }
  const previews = db().prepare('SELECT id FROM delivery_previews WHERE consent = 1').all();
  for (const row of previews) ids.add('preview:' + row.id);
  return ids.size;
}

function trustLine() {
  const count = signedDeliveryCount();
  return {
    count,
    label: count > 0 ? (count + ' deliveries signed') : 'Be the first — founding delivery',
    href: '/witness.json',
  };
}

function ledgerStats() {
  return {
    ok: true,
    signedDeliveries: signedDeliveryCount(),
    publicPreviews: listPublicDeliveries().length,
    trust: trustLine(),
  };
}

async function subscribe(input) {
  const planId = String((input && input.plan) || '').trim().toLowerCase();
  const email = String((input && input.email) || '').trim().toLowerCase();
  const plan = PLAN_DEFS.find((row) => row.id === planId);
  if (!plan) return { ok: false, error: 'unknown_plan', status: 400 };
  if (plan.contact) return { ok: false, error: 'enterprise_contact', href: '/contact', status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email_required', status: 400 };
  const quote = quoteSync('sub-' + plan.id, { quotedUsd: plan.quotedUsd });
  const id = crypto.randomUUID();
  let invoice;
  try {
    invoice = await require('./btcInvoiceLedger').createInvoice({
      service: 'sub-' + plan.id,
      priceUsd: quote.usd,
      customerEmail: email,
      metadata: { subscriptionId: id, plan: plan.id },
    });
  } catch (err) {
    return { ok: false, error: String(err && err.message || err), status: 500 };
  }
  const payExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  db().prepare(`
    INSERT INTO subscriptions
      (id, user_email, plan, status, btc_address, amount_btc, amount_usd, invoice_id, pay_expires_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
  `).run(id, email, plan.id, invoice.payoutAddress, invoice.amountBtc, quote.usd, String(invoice.id), payExpires);
  let qr = null;
  const bip21 = 'bitcoin:' + invoice.payoutAddress + '?amount=' + invoice.amountBtc;
  try {
    qr = await require('qrcode').toDataURL(bip21);
  } catch (err) {
    qr = null;
    spotError = spotError || String(err && err.message || err);
  }
  return {
    ok: true,
    id,
    plan: plan.id,
    email,
    usd: quote.usd,
    quote_btc: quote.btc,
    amount_btc: invoice.amountBtc,
    btc_address: invoice.payoutAddress,
    bip21,
    qr,
    expires_at: payExpires,
    status: 'pending',
  };
}

function subscriptionStatus(email) {
  const key = decodeURIComponent(String(email || '')).trim().toLowerCase();
  if (!key) return { ok: false, error: 'email_required' };
  const rows = db().prepare('SELECT id, user_email, plan, status, amount_btc, amount_usd, started_at, expires_at, pay_expires_at, created_at FROM subscriptions WHERE user_email = ? ORDER BY created_at DESC').all(key);
  return { ok: true, email: key, subscriptions: rows };
}

function publishPreview(input) {
  const body = input || {};
  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'id_required' };
  const consent = body.consent === true || body.consent === 'true' || body.consent === 1;
  const content = String(body.content || '');
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const teaser = content.slice(0, 200);
  const deliveredAt = body.deliveredAt || new Date().toISOString();
  let signature = null;
  let pubkey = null;
  if (consent) {
    const signer = require('../../modules/witness/signer');
    const signed = signer.signContract({
      type: 'delivery_preview',
      id,
      service: body.serviceName || null,
      sha256,
      teaser,
      delivered_at: deliveredAt,
    });
    signature = signed.signature;
    pubkey = signed.pubkey;
  }
  db().prepare(`
    INSERT INTO delivery_previews
      (id, service_name, delivered_at, sha256, teaser, signature, pubkey, consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      service_name = excluded.service_name,
      delivered_at = excluded.delivered_at,
      sha256 = excluded.sha256,
      teaser = excluded.teaser,
      signature = excluded.signature,
      pubkey = excluded.pubkey,
      consent = excluded.consent
  `).run(id, body.serviceName || null, deliveredAt, sha256, consent ? teaser : '', signature, pubkey, consent ? 1 : 0);
  return { ok: true, id, public: consent, url: consent ? ('/delivery/' + encodeURIComponent(id)) : null };
}

function publicPreview(id) {
  const row = db().prepare('SELECT * FROM delivery_previews WHERE id = ?').get(String(id || ''));
  if (!row || Number(row.consent) !== 1) return null;
  return {
    id: row.id,
    serviceName: row.service_name,
    deliveredAt: row.delivered_at,
    sha256: row.sha256,
    teaser: row.teaser,
    signature: row.signature,
    pubkey: row.pubkey,
    witness: '/witness.json',
  };
}

function listPublicDeliveries() {
  return db().prepare('SELECT id, service_name, delivered_at FROM delivery_previews WHERE consent = 1 ORDER BY delivered_at DESC LIMIT 50').all()
    .map((row) => ({
      id: row.id,
      offerId: row.service_name,
      url: '/delivery/' + encodeURIComponent(row.id),
      at: row.delivered_at,
    }));
}

function bucharestParts(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  return bag;
}

function weekKey(date) {
  const parts = bucharestParts(date);
  const utc = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return utc.toISOString().slice(0, 10);
}

function buildReport() {
  const now = new Date();
  const key = weekKey(now);
  const since = key + 'T00:00:00.000Z';
  const orders = db().prepare(`
    SELECT offer_id, amount_btc, amount_usd, created_at
    FROM commercial_orders
    WHERE status = 'paid' AND created_at >= ?
  `).all(since);
  let ledgerBtc = 0;
  let ledgerCount = 0;
  try {
    const ledger = require('./btcInvoiceLedger');
    const paid = typeof ledger.listInvoices === 'function' ? ledger.listInvoices({ status: 'paid', limit: 5000 }) : [];
    for (const invoice of paid) {
      if (!invoice || invoice.mock === true) continue;
      if (String(invoice.txid || '').startsWith('simulated-')) continue;
      const at = String(invoice.paidAt || '');
      if (at && at < since) continue;
      if (!at) continue;
      ledgerCount += 1;
      ledgerBtc += Number(invoice.amountBtc) || 0;
    }
  } catch (err) {
    spotError = spotError || String(err && err.message || err);
  }
  const counts = new Map();
  let orderBtc = 0;
  for (const order of orders) {
    orderBtc += Number(order.amount_btc) || 0;
    const id = order.offer_id || 'unknown';
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, sold]) => ({ id, sold }));
  const payload = {
    type: 'weekly_public_report',
    week: key,
    generated_at: now.toISOString(),
    services_sold: orders.length + ledgerCount,
    btc_received: (orderBtc + ledgerBtc).toFixed(8),
    signed_deliveries: signedDeliveryCount(),
    scores_generated: 0,
    top_services: top,
    new_services: 0,
    notes: {
      scores_generated: '0 this week — be the first',
      new_services: 'The catalog has no created_at column. New services this week: 0.',
      empty: orders.length + ledgerCount === 0 ? '0 this week — be the first' : null,
    },
  };
  let signature = null;
  let pubkey = null;
  try {
    const signed = require('../../modules/witness/signer').signContract(payload);
    signature = signed.signature;
    pubkey = signed.pubkey;
  } catch (err) {
    payload.signError = String(err && err.message || err);
  }
  const id = crypto.randomUUID();
  db().prepare('INSERT INTO reports (id, week_key, body_json, signature, pubkey) VALUES (?, ?, ?, ?, ?)')
    .run(id, key, JSON.stringify(payload), signature, pubkey);
  return { ok: true, id, payload, signature, pubkey, witness: '/witness.json' };
}

function latestReport() {
  const row = db().prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 1').get();
  if (row) {
    return {
      ok: true,
      id: row.id,
      payload: JSON.parse(row.body_json),
      signature: row.signature,
      pubkey: row.pubkey,
      witness: '/witness.json',
    };
  }
  return buildReport();
}

async function announceReport(report) {
  try {
    const snm = require('../../modules/notificationMesh');
    if (typeof snm.deliver !== 'function') return { ok: false, error: 'snm_unavailable' };
    return await snm.deliver({
      type: 'weekly_report',
      userId: 'public-report',
      private: false,
      subject: 'ZeusAI weekly report',
      text: 'Weekly public report ' + (report.payload && report.payload.week) + ' is at /report',
    });
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function expireSubscriptions() {
  const now = new Date().toISOString();
  const info = db().prepare(`
    UPDATE subscriptions SET status = 'expired'
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?
  `).run(now);
  return { ok: true, expired: info.changes };
}

async function maybePublishWeekly() {
  const parts = bucharestParts(new Date());
  if (parts.weekday !== 'Mon' || parts.hour !== '09') return { ok: true, skipped: 'not_monday_09_bucharest' };
  const key = weekKey(new Date());
  if (lastReportWeek === key) return { ok: true, skipped: 'already_published' };
  const existing = db().prepare('SELECT id FROM reports WHERE week_key = ? LIMIT 1').get(key);
  if (existing) {
    lastReportWeek = key;
    return { ok: true, skipped: 'stored' };
  }
  const report = buildReport();
  lastReportWeek = key;
  const announced = await announceReport(report);
  return { ok: true, published: report.id, announced };
}

function storageNote() {
  return {
    engine: 'sqlite',
    postgresError: probes.postgres,
    redisError: probes.redis,
    spotError,
  };
}

function status() {
  return {
    ok: true,
    monitoringOnly: true,
    repaired: false,
    plans: PLAN_DEFS.length,
    bundles: bundleRows().length,
    signedDeliveries: signedDeliveryCount(),
    storage: storageNote(),
  };
}

function clientIp(req) {
  const forwarded = req && req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return (req && (req.ip || (req.socket && req.socket.remoteAddress))) || 'unknown';
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
      try { resolve(JSON.parse(text)); }
      catch (_) {
        const params = new URLSearchParams(text);
        const out = {};
        for (const [key, value] of params.entries()) out[key] = value;
        resolve(out);
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, body, headers) {
  const payload = JSON.stringify(body);
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    if (headers) {
      for (const [key, value] of Object.entries(headers)) res.set(key, value);
    }
    res.status(statusCode).json(body);
    return;
  }
  res.writeHead(statusCode, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
  }, headers || {}));
  res.end(payload);
}

async function demoRoute(prompt, ip) {
  const text = String(prompt == null ? '' : prompt).trim();
  if (!text) return { status: 400, body: { ok: false, error: 'prompt_required' } };
  if (text.length > 4000) return { status: 400, body: { ok: false, error: 'prompt_too_long' } };
  const limit = Math.max(1, Number(process.env.DEMO_RATE_LIMIT || 5));
  const bucket = String(Math.floor(Date.now() / 3600000));
  const hash = ipHash(ip);
  const current = db().prepare('SELECT hits FROM demo_hits WHERE ip_hash = ? AND hour_bucket = ?').get(hash, bucket);
  if (current && Number(current.hits) >= limit) {
    return { status: 429, body: { ok: false, error: 'rate_limited' } };
  }
  db().prepare(`
    INSERT INTO demo_hits (ip_hash, hour_bucket, hits) VALUES (?, ?, 1)
    ON CONFLICT(ip_hash, hour_bucket) DO UPDATE SET hits = hits + 1
  `).run(hash, bucket);
  const key = String(process.env.DEMO_API_KEY || '').trim();
  if (!key) {
    const simulated = require('../../src/site/demo-router').optimizePrompt(text);
    return {
      status: simulated.ok ? 200 : 400,
      body: {
        ok: simulated.ok === true,
        simulated: true,
        providerCalled: false,
        stored: false,
        label: 'Simulated route. No model provider is called.',
        model: null,
        response: simulated.ok ? simulated.analyzed : null,
        error: simulated.ok ? undefined : simulated.error,
        latencyMs: simulated.latencyMs || null,
      },
    };
  }
  const provider = String(process.env.DEMO_PROVIDER || 'groq').toLowerCase();
  const model = process.env.DEMO_MODEL || 'llama-3.1-8b-instant';
  const maxTokens = Math.max(1, Math.min(200, Number(process.env.DEMO_MAX_TOKENS || 200)));
  const endpoint = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: text }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { status: 502, body: { ok: false, error: 'provider_error', simulated: false } };
    }
    const message = json && json.choices && json.choices[0] && json.choices[0].message;
    return {
      status: 200,
      body: {
        ok: true,
        simulated: false,
        providerCalled: true,
        stored: false,
        provider,
        model,
        response: message && message.content ? String(message.content) : '',
        latencyMs: Date.now() - started,
        label: 'Live demo — real model, real response',
      },
    };
  } catch (err) {
    return { status: 502, body: { ok: false, error: String(err && err.message || err), simulated: false } };
  }
}

async function dispatch(req, urlPath) {
  await probeStores();
  try {
    if (req.method === 'GET' && (urlPath === '/api/plans')) {
      return { status: 200, body: plansPayload(), cache: 'public, max-age=60' };
    }
    if (req.method === 'GET' && urlPath === '/api/bundles') {
      return { status: 200, body: bundlesPayload(), cache: 'public, max-age=60' };
    }
    if (req.method === 'GET' && urlPath === '/api/ledger/stats') {
      return { status: 200, body: ledgerStats(), cache: 'public, max-age=60' };
    }
    if (req.method === 'GET' && urlPath === '/report.json') {
      return { status: 200, body: latestReport(), cache: 'public, max-age=60' };
    }
    const lock = urlPath.match(/^\/api\/price-lock\/([a-zA-Z0-9_.:-]{1,128})$/);
    if (req.method === 'GET' && lock) {
      return { status: 200, body: priceLock(clientIp(req), decodeURIComponent(lock[1])), cache: 'private, max-age=60' };
    }
    const referral = urlPath.match(/^\/api\/referral\/([a-zA-Z0-9_-]{4,32})$/);
    if (req.method === 'GET' && referral) {
      return { status: 200, body: referralPayload(referral[1]), cache: 'public, max-age=60' };
    }
    const sub = urlPath.match(/^\/api\/subscription\/([^/]+)$/);
    if (req.method === 'GET' && sub) {
      return { status: 200, body: subscriptionStatus(sub[1]), cache: 'no-store' };
    }
    if (req.method === 'POST' && urlPath === '/api/subscribe') {
      const body = await readJsonBody(req);
      const result = await subscribe(body);
      return { status: result.status || (result.ok ? 201 : 400), body: result, cache: 'no-store' };
    }
    if (req.method === 'POST' && urlPath === '/api/demo/route') {
      const body = await readJsonBody(req);
      const result = await demoRoute(body && body.prompt, clientIp(req));
      return { status: result.status, body: result.body, cache: 'no-store' };
    }
    const bundleBuy = urlPath.match(/^\/api\/bundles\/([a-z0-9-]{3,64})\/checkout$/);
    if (req.method === 'POST' && bundleBuy) {
      const found = bundleRows().find((row) => row.id === bundleBuy[1]);
      if (!found) return { status: 404, body: { ok: false, error: 'bundle_not_found' }, cache: 'no-store' };
      const body = await readJsonBody(req);
      const email = String((body && body.email) || '').trim().toLowerCase();
      let invoice;
      try {
        invoice = await require('./btcInvoiceLedger').createInvoice({
          service: 'bundle-' + found.id,
          priceUsd: found.usd,
          customerEmail: email || null,
          metadata: { bundleId: found.id },
        });
      } catch (err) {
        return { status: 500, body: { ok: false, error: String(err && err.message || err) }, cache: 'no-store' };
      }
      return {
        status: 201,
        cache: 'no-store',
        body: {
          ok: true,
          bundle: found.id,
          quote_btc: found.btc,
          amount_btc: invoice.amountBtc,
          usd: found.usd,
          btc_address: invoice.payoutAddress,
          bip21: 'bitcoin:' + invoice.payoutAddress + '?amount=' + invoice.amountBtc,
          expires_at: invoice.expiresAt,
        },
      };
    }
    return null;
  } catch (err) {
    return { status: 500, body: { ok: false, error: String(err && err.message || err) }, cache: 'no-store' };
  }
}

async function handleHttp(req, res, urlPath) {
  const hit = await dispatch(req, urlPath);
  if (!hit) return false;
  sendJson(res, hit.status, hit.body, { 'Cache-Control': hit.cache || 'no-store' });
  return true;
}

function mount(app) {
  const paths = [
    ['get', '/api/plans'],
    ['get', '/api/bundles'],
    ['get', '/api/ledger/stats'],
    ['get', '/report.json'],
    ['get', '/api/price-lock/:id'],
    ['get', '/api/referral/:code'],
    ['get', '/api/subscription/:email'],
    ['post', '/api/subscribe'],
    ['post', '/api/demo/route'],
    ['post', '/api/bundles/:id/checkout'],
  ];
  for (const [method, route] of paths) {
    app[method](route, async (req, res) => {
      const urlPath = (req.originalUrl || req.url || route).split('?')[0];
      try {
        await handleHttp(req, res, urlPath);
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String(err && err.message || err) }, { 'Cache-Control': 'no-store' });
      }
    });
  }
}

function startTimers() {
  if (timersStarted || process.env.NODE_ENV === 'test') return;
  timersStarted = true;
  const hour = setInterval(() => {
    expireSubscriptions();
    maybePublishWeekly().catch((err) => {
      spotError = String(err && err.message || err);
    });
  }, 60 * 60 * 1000);
  if (typeof hour.unref === 'function') hour.unref();
  probeStores().catch(() => {});
}

function demoLive() {
  return !!String(process.env.DEMO_API_KEY || '').trim();
}

module.exports = {
  quoteSync,
  priceServices,
  plansPayload,
  bundlesPayload,
  priceLock,
  validLock,
  previewReferral,
  referralPayload,
  onConfirmedPayment,
  subscribe,
  subscriptionStatus,
  publishPreview,
  publicPreview,
  listPublicDeliveries,
  signedDeliveryCount,
  trustLine,
  ledgerStats,
  buildReport,
  latestReport,
  expireSubscriptions,
  maybePublishWeekly,
  status,
  handleHttp,
  mount,
  startTimers,
  demoLive,
  btcUri,
  probeStores,
  storageNote,
};
