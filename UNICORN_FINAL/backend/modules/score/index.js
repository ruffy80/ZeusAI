'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { analyze, reportHash } = require('./analyzer');
const witnessBridge = require('./witnessBridge');
const ledgerBridge = require('./ledgerBridge');
const snmBridge = require('./snmBridge');
const priceBridge = require('./priceBridge');
const ogImage = require('./ogImage');
const { badgeSvg, embedCode } = require('./badge');
const { hashIp, allow } = require('./rateLimit');
const { verifyContract } = require('../witness/signer');

function dbPath() {
  return process.env.SCORE_DB || path.join(process.env.SNM_STATE_DIR || '/opt/zeusai/state', 'business_scores.sqlite');
}

function baseUrl() {
  return (process.env.SCORE_PUBLIC_BASE_URL || process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/$/, '');
}

function openDb() {
  const Database = require('better-sqlite3');
  fs.mkdirSync(path.dirname(dbPath()), { recursive: true });
  const db = new Database(dbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS business_scores (
    id TEXT PRIMARY KEY,
    public_slug TEXT UNIQUE,
    domain TEXT NOT NULL,
    url TEXT NOT NULL,
    score_total INTEGER NOT NULL,
    sub_scores TEXT NOT NULL,
    report_json TEXT NOT NULL,
    witness_id TEXT,
    ledger_id TEXT,
    og_image_url TEXT,
    share_count INTEGER DEFAULT 0,
    upgrade_clicked INTEGER DEFAULT 0,
    upgraded INTEGER DEFAULT 0,
    opt_in INTEGER DEFAULT 0,
    founding INTEGER DEFAULT 0,
    ip_hash TEXT,
    report_hash TEXT,
    created_at TEXT NOT NULL,
    cache_until TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS viral_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    score_id TEXT,
    referrer TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_viral_events_type_created ON viral_events(event_type, created_at);`);
  return db;
}

function rowToScore(row) {
  if (!row) return null;
  const report = JSON.parse(row.report_json);
  return Object.assign({}, report, {
    id: row.id,
    public_slug: row.public_slug,
    witness_id: row.witness_id,
    ledger_id: row.ledger_id,
    og_image_url: row.og_image_url,
    share_count: row.share_count,
    upgrade_clicked: row.upgrade_clicked === 1,
    upgraded: row.upgraded === 1,
    founding: row.founding === 1,
    created_at: row.created_at,
  });
}

function logEvent(db, event) {
  db.prepare('INSERT INTO viral_events (id, event_type, score_id, referrer, ip_hash, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    event.event_type,
    event.score_id || null,
    event.referrer || null,
    event.ip_hash || null,
    event.user_agent ? String(event.user_agent).slice(0, 180) : null,
    new Date().toISOString()
  );
}

function sharePack(score, prices) {
  const base = baseUrl();
  const report = base + '/score/' + score.public_slug + '?ref=' + encodeURIComponent(score.public_slug);
  const n = score.score_total;
  return {
    twitter: 'My business just scored ' + n + '/100 on @ZeusAI. Check yours free: ' + report,
    linkedin: 'Just got a verifiable business score from ZeusAI — ' + n + '/100. Signed cryptographically. Try it free. ' + report,
    whatsapp: 'Check this out — free business score, real analysis, signed: ' + report,
    copy_text: score.domain + ' scored ' + n + '/100. ' + report,
    report_url: report,
    report_usd: prices && prices.report ? prices.report.usd : null,
    audit_usd: prices && prices.audit ? prices.audit.usd : null,
    locked_until: prices && prices.locked_until,
    og_image_url: base + '/score/' + score.public_slug + '/og.png',
    witness_url: score.witness_id ? base + '/witness/' + score.witness_id : null,
    ledger_url: score.ledger_id ? base + '/ledger/' + score.ledger_id : null,
    badge_embed_code: embedCode(base, score.public_slug),
  };
}

function pack(score, prices) {
  const base = baseUrl();
  const share = sharePack(score, prices);
  return {
    public_slug: score.public_slug,
    score_total: score.score_total,
    sub_scores: score.sub_scores,
    report_url: base + '/score/' + score.public_slug,
    badge_url: base + '/score/' + score.public_slug + '/badge.svg',
    badge_embed_code: share.badge_embed_code,
    og_image_url: share.og_image_url,
    witness_url: share.witness_url,
    ledger_url: share.ledger_url,
    share_pack: {
      twitter: share.twitter,
      linkedin: share.linkedin,
      whatsapp: share.whatsapp,
      copy_text: share.copy_text,
    },
    upgrade_price_btc: prices && prices.audit ? prices.audit.btc : null,
    upgrade_price_usd: prices && prices.audit ? prices.audit.usd : null,
    report_price_usd: prices && prices.report ? prices.report.usd : null,
    report_price_btc: prices && prices.report ? prices.report.btc : null,
    price_locked_until: prices && prices.locked_until,
    founding: score.founding === true,
    cached: score.cached === true,
  };
}

async function createScore(rawUrl, meta) {
  const info = meta || {};
  const db = openDb();
  try {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (_) { return { ok: false, status: 400, error: 'url_required' }; }
    const domain = parsed.hostname;
    const cached = db.prepare('SELECT * FROM business_scores WHERE domain = ? AND cache_until > ?').get(domain, new Date().toISOString());
    if (cached) {
      const score = rowToScore(cached);
      score.cached = true;
      const prices = await priceBridge.upgradePrices(domain);
      return { ok: true, status: 200, pack: pack(score, prices), score };
    }
    const ipHash = hashIp(info.ip);
    const gate = allow(db, ipHash);
    if (!gate.ok) return { ok: false, status: 429, error: 'rate_limited', used: gate.used, max: gate.max };
    const analysis = await analyze(parsed.href);
    if (!analysis.ok) return { ok: false, status: 502, error: analysis.error, detail: analysis.detail };
    const prices = await priceBridge.upgradePrices(domain);
    const id = crypto.randomUUID();
    const ledgerId = crypto.randomUUID();
    const slug = domain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
      + '-' + crypto.createHash('sha256').update(parsed.href).digest('hex').slice(0, 6);
    const created_at = new Date().toISOString();
    const count = db.prepare('SELECT COUNT(*) AS n FROM business_scores').get().n;
    const founding = count < Number(process.env.SCORE_FOUNDING_LIMIT || 100);
    const report = {
      domain,
      url: analysis.url,
      score_total: analysis.score_total,
      sub_scores: analysis.sub_scores,
      summary: analysis.summary,
      summary_source: analysis.summary_source,
      recommendations: analysis.recommendations,
      elapsed_ms: analysis.elapsed_ms,
      http_status: analysis.status,
    };
    const hash = reportHash(report);
    const score = {
      id,
      public_slug: slug,
      domain,
      url: analysis.url,
      score_total: analysis.score_total,
      sub_scores: analysis.sub_scores,
      summary: analysis.summary,
      recommendations: analysis.recommendations,
      created_at,
      report_hash: hash,
      founding,
      opt_in: info.opt_in === true,
      ledger_id: ledgerId,
    };
    const witness = witnessBridge.attach(score);
    score.witness_id = witness.witness_id;
    const ledger = ledgerBridge.record(score);
    if (!ledger.ok) score.ledger_id = null;
    const image = await ogImage.writePng(score, baseUrl());
    const og = image.ok ? image.url : null;
    const days = Number(process.env.SCORE_CACHE_DAYS || 7);
    db.prepare(`INSERT INTO business_scores (
      id, public_slug, domain, url, score_total, sub_scores, report_json, witness_id, ledger_id,
      og_image_url, share_count, upgrade_clicked, upgraded, opt_in, founding, ip_hash, report_hash, created_at, cache_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?)`).run(
      id, slug, domain, analysis.url, analysis.score_total, JSON.stringify(analysis.sub_scores), JSON.stringify(report),
      score.witness_id, score.ledger_id, og, info.opt_in === true ? 1 : 0, founding ? 1 : 0, ipHash, hash, created_at,
      new Date(Date.now() + days * 86400000).toISOString()
    );
    logEvent(db, {
      event_type: 'score_created',
      score_id: id,
      referrer: info.ref || info.referrer || null,
      ip_hash: ipHash,
      user_agent: info.user_agent,
    });
    snmBridge.publishNostr(score).catch((err) => console.warn('[score] nostr', err && err.message));
    if (score.opt_in) snmBridge.notify(score).catch((err) => console.warn('[score] snm', err && err.message));
    return { ok: true, status: 201, pack: pack(score, prices), score };
  } finally {
    db.close();
  }
}

function getBySlug(slug) {
  const db = openDb();
  try { return rowToScore(db.prepare('SELECT * FROM business_scores WHERE public_slug = ?').get(String(slug || ''))); }
  finally { db.close(); }
}

function noteView(slug, meta) {
  const db = openDb();
  try {
    const row = db.prepare('SELECT id FROM business_scores WHERE public_slug = ?').get(String(slug || ''));
    if (!row) return;
    const ref = meta && meta.ref;
    logEvent(db, {
      event_type: ref ? 'share_clicked' : 'report_viewed',
      score_id: row.id,
      referrer: (meta && meta.referrer) || null,
      ip_hash: hashIp(meta && meta.ip),
      user_agent: meta && meta.user_agent,
    });
    if (meta && meta.referrer && !/zeusai\.pro/i.test(meta.referrer)) {
      logEvent(db, { event_type: 'badge_embedded', score_id: row.id, referrer: meta.referrer, ip_hash: hashIp(meta.ip), user_agent: meta.user_agent });
    }
    if (ref) db.prepare('UPDATE business_scores SET share_count = share_count + 1 WHERE id = ?').run(row.id);
  } finally { db.close(); }
}

function noteUpgradeClick(slug) {
  const db = openDb();
  try {
    const row = db.prepare('SELECT id FROM business_scores WHERE public_slug = ?').get(String(slug || ''));
    if (!row) return null;
    db.prepare('UPDATE business_scores SET upgrade_clicked = 1 WHERE id = ?').run(row.id);
    logEvent(db, { event_type: 'upgrade_clicked', score_id: row.id });
    return row.id;
  } finally { db.close(); }
}

function stats() {
  const db = openDb();
  try {
    const total = db.prepare('SELECT COUNT(*) AS n FROM business_scores').get().n;
    const shares = db.prepare('SELECT COALESCE(SUM(share_count), 0) AS n FROM business_scores').get().n;
    const upgrades = db.prepare('SELECT COUNT(*) AS n FROM business_scores WHERE upgraded = 1').get().n;
    const referred = db.prepare("SELECT COUNT(*) AS n FROM viral_events WHERE event_type = 'score_created' AND referrer IS NOT NULL AND referrer != ''").get().n;
    return {
      total_scores: total,
      total_shares: shares,
      total_upgrades: upgrades,
      viral_coefficient: total > 0 ? referred / total : 0,
    };
  } finally { db.close(); }
}

function leaderboard() {
  const db = openDb();
  try {
    return db.prepare('SELECT public_slug, domain, score_total FROM business_scores WHERE opt_in = 1 ORDER BY score_total DESC LIMIT 20').all();
  } finally { db.close(); }
}

function repair() {
  const db = openDb();
  let repaired = 0;
  try {
    const rows = db.prepare('SELECT * FROM business_scores WHERE witness_id IS NULL OR ledger_id IS NULL').all();
    for (const row of rows) {
      const score = rowToScore(row);
      if (!score.witness_id) {
        const witness = witnessBridge.attach(score);
        if (witness.witness_id) {
          db.prepare('UPDATE business_scores SET witness_id = ? WHERE id = ?').run(witness.witness_id, score.id);
          repaired += 1;
        }
      }
      if (!score.ledger_id) {
        score.ledger_id = crypto.randomUUID();
        const ledger = ledgerBridge.record(score);
        if (ledger.ok) {
          db.prepare('UPDATE business_scores SET ledger_id = ? WHERE id = ?').run(score.ledger_id, score.id);
          repaired += 1;
        }
      }
    }
    return { ok: true, repaired, inventsScores: false };
  } catch (err) {
    console.warn('[score] repair failed:', err && err.message);
    return { ok: false, error: err && err.message, inventsScores: false };
  } finally { db.close(); }
}

module.exports = {
  createScore,
  getBySlug,
  noteView,
  noteUpgradeClick,
  stats,
  leaderboard,
  repair,
  pack,
  sharePack,
  badgeSvg,
  verifyContract,
  dbPath,
};
