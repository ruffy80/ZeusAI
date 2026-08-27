// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// RIVOS/1.0 — Revenue Invention Continuum OS
//
// Three inventions nobody else in this repo had as a closed loop:
//
//   1) PECG — Paid-Evidence Catalog Gravity
//      Re-ranks money-surface / IndexNow SKUs from ATTESTED paid vs
//      expired/abandoned orders. Never invents GMV.
//
//   2) OAUR — Owner-Auth Unblock Reflex
//      One briefing of every awaiting_owner_auth rail (USCF + pre-keys +
//      SMTP/PayPal). When a key newly appears, pulses BALOS/ZACC honestly.
//
//   3) PRL — Pending→Recovery Lattice
//      Scans sovereign pending/expired checkouts and queues recovery
//      intents (Telegram / email) with the SAME BIP-21 invoice — never
//      invents payment rails.
//
// Plus CYM — Causal Yield Mirror: hash-chained invention ledger that only
// advances on real paid events or real key-arm events.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'RIVOS/1.0';
const INVENTION = 'Revenue Invention Continuum';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

const DATA_DIR = process.env.RIVOS_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'rivos');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LEDGER_FILE = path.join(DATA_DIR, 'cym-ledger.jsonl');

const TICK_MS = Math.max(60_000, Number(process.env.RIVOS_TICK_MS || 15 * 60 * 1000));
const ENABLED = process.env.RIVOS_DISABLED !== '1';

const _counts = {
  ticks: 0,
  paidEvents: 0,
  expiredEvents: 0,
  gravityWrites: 0,
  ownerBriefings: 0,
  keyArmDetections: 0,
  recoveryQueued: 0,
  cymLinks: 0,
  errors: 0,
};

let _timer = null;
let _state = {
  protocol: PROTOCOL,
  gravity: {},          // serviceId → { paid, expired, revenueUsd, score, lastPaidAt }
  lastAuthFingerprint: null,
  lastBriefingAt: 0,
  recovery: {},         // orderId → { queuedAt, status, reason }
  lastTickAt: null,
  lastTick: null,
};

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _load() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      _state.gravity = raw.gravity && typeof raw.gravity === 'object' ? raw.gravity : {};
      _state.lastAuthFingerprint = raw.lastAuthFingerprint || null;
      _state.lastBriefingAt = Number(raw.lastBriefingAt) || 0;
      _state.recovery = raw.recovery && typeof raw.recovery === 'object' ? raw.recovery : {};
      _state.lastTickAt = raw.lastTickAt || null;
    }
  } catch (_) { /* ignore */ }
}

function _persist() {
  _ensureDir();
  try {
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({
      protocol: PROTOCOL,
      updatedAt: new Date().toISOString(),
      gravity: _state.gravity,
      lastAuthFingerprint: _state.lastAuthFingerprint,
      lastBriefingAt: _state.lastBriefingAt,
      recovery: _state.recovery,
      lastTickAt: _state.lastTickAt,
      lastTick: _state.lastTick,
      counts: _counts,
    }, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  } catch (_) { /* ignore */ }
}

function _hash(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 24);
}

function _cymAppend(kind, payload) {
  _ensureDir();
  let prev = 'genesis';
  try {
    if (fs.existsSync(LEDGER_FILE)) {
      const lines = fs.readFileSync(LEDGER_FILE, 'utf8').trim().split('\n').filter(Boolean);
      if (lines.length) {
        const last = JSON.parse(lines[lines.length - 1]);
        prev = last.hash || prev;
      }
    }
  } catch (_) { /* ignore */ }
  const entry = {
    at: new Date().toISOString(),
    kind,
    payload: payload || {},
    prev,
  };
  entry.hash = _hash(JSON.stringify(entry));
  try {
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(entry) + '\n');
    _counts.cymLinks += 1;
  } catch (_) { /* ignore */ }
  return entry;
}

function _skuKey(order) {
  return String((order && (order.serviceId || order.productId || order.plan || order.id)) || '').trim() || null;
}

function _amountUsd(order) {
  const n = Number(
    order && (order.subtotal_fiat != null ? order.subtotal_fiat
      : order.amountUsd != null ? order.amountUsd
        : order.amount_usd != null ? order.amount_usd : 0)
  );
  return Number.isFinite(n) ? n : 0;
}

/** PECG — record attested paid evidence. */
function onPaid(order) {
  const id = _skuKey(order);
  if (!id) return { ok: false, reason: 'no_sku' };
  _counts.paidEvents += 1;
  const g = _state.gravity[id] || { paid: 0, expired: 0, revenueUsd: 0, score: 0, lastPaidAt: null };
  g.paid += 1;
  g.revenueUsd = Math.round((g.revenueUsd + _amountUsd(order)) * 100) / 100;
  g.lastPaidAt = (order && order.paid_at) || new Date().toISOString();
  g.score = _score(g);
  _state.gravity[id] = g;
  _counts.gravityWrites += 1;
  const cym = _cymAppend('paid', {
    sku: id,
    orderId: order && (order.orderId || order.id) || null,
    amountUsd: _amountUsd(order),
    score: g.score,
  });
  _persist();
  return { ok: true, invention: 'PECG', sku: id, gravity: g, cym };
}

/** PECG — record expired / abandoned checkout (negative gravity). */
function onExpired(order) {
  const id = _skuKey(order);
  if (!id) return { ok: false, reason: 'no_sku' };
  _counts.expiredEvents += 1;
  const g = _state.gravity[id] || { paid: 0, expired: 0, revenueUsd: 0, score: 0, lastPaidAt: null };
  g.expired += 1;
  g.score = _score(g);
  _state.gravity[id] = g;
  _counts.gravityWrites += 1;
  _cymAppend('expired', { sku: id, orderId: order && (order.orderId || order.id) || null, score: g.score });
  _persist();
  return { ok: true, invention: 'PECG', sku: id, gravity: g };
}

function _score(g) {
  // Paid revenue weighs heavily; each expire soft-penalizes. Floor at 0.
  const base = (Number(g.revenueUsd) || 0) * 10 + (Number(g.paid) || 0) * 25;
  const pen = (Number(g.expired) || 0) * 8;
  return Math.max(0, Math.round(base - pen));
}

/** Reorder AMOS/BALOS SKUs by paid-evidence gravity (stable for unknowns). */
function reorderSkus(skus) {
  const list = Array.isArray(skus) ? skus.slice() : [];
  list.sort((a, b) => {
    const aid = String((a && a.id) || '');
    const bid = String((b && b.id) || '');
    const as = (_state.gravity[aid] && _state.gravity[aid].score) || 0;
    const bs = (_state.gravity[bid] && _state.gravity[bid].score) || 0;
    if (bs !== as) return bs - as;
    return (Number(b && b.priceUsd) || 0) - (Number(a && a.priceUsd) || 0);
  });
  return list.map((s, i) => Object.assign({}, s, {
    gravityRank: i + 1,
    gravityScore: (_state.gravity[String(s && s.id)] && _state.gravity[String(s && s.id)].score) || 0,
  }));
}

function gravitySnapshot(limit) {
  const rows = Object.entries(_state.gravity).map(([id, g]) => ({
    id,
    paid: g.paid || 0,
    expired: g.expired || 0,
    revenueUsd: g.revenueUsd || 0,
    score: g.score || 0,
    lastPaidAt: g.lastPaidAt || null,
  }));
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, Math.max(1, Math.min(50, Number(limit) || 12)));
}

/** OAUR — fingerprint of what still awaits owner authorization. */
function authAwaitingMap() {
  const awaiting = [];
  try {
    const uscf = require('../../backend/modules/zacc/suppliers');
    const d = uscf.discovery();
    for (const s of (d.awaitingOwnerAuth || [])) {
      awaiting.push({
        kind: 'uscf',
        id: s.id,
        name: s.name,
        envVars: s.envVars || [],
        armEndpoint: s.armEndpoint || '/api/dropship/suppliers/arm',
        docsUrl: s.docsUrl || null,
      });
    }
  } catch (_) { /* ignore */ }
  try {
    const pre = require('../../backend/modules/pre-keys-activation');
    const st = typeof pre.getStatus === 'function' ? pre.getStatus()
      : (typeof pre.status === 'function' ? pre.status() : null);
    const tomorrow = (st && (st.awaitingOwner || st.tomorrow || st.awaitingKeys)) || [];
    if (Array.isArray(tomorrow)) {
      for (const t of tomorrow) {
        const id = typeof t === 'string' ? t : (t && (t.id || t.name || t.key));
        if (!id) continue;
        awaiting.push({
          kind: 'pre-keys',
          id: String(id),
          name: (t && t.name) || String(id),
          envVars: (t && t.envVars) || [String(id)],
          armEndpoint: null,
        });
      }
    }
    // Common rails if status shape differs
    const rails = [
      { id: 'RESEND_API_KEY', name: 'Transactional email (Resend)' },
      { id: 'PAYPAL_CLIENT_ID', name: 'PayPal' },
      { id: 'NOWPAYMENTS_API_KEY', name: 'NOWPayments' },
      { id: 'STRIPE_SECRET_KEY', name: 'Stripe' },
    ];
    for (const r of rails) {
      const v = String(process.env[r.id] || '').trim();
      const armed = v && !/your_|changeme|xxx|placeholder/i.test(v);
      if (!armed) {
        awaiting.push({
          kind: 'payment-email',
          id: r.id,
          name: r.name,
          envVars: [r.id],
          armEndpoint: null,
        });
      }
    }
  } catch (_) { /* ignore */ }

  // Deduplicate by id
  const seen = new Set();
  const uniq = [];
  for (const a of awaiting) {
    const k = a.kind + ':' + a.id;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(a);
  }
  const fingerprint = _hash(uniq.map((a) => a.kind + ':' + a.id).sort().join('|'));
  return { awaiting: uniq, fingerprint, count: uniq.length };
}

async function briefOwnerAuth(opts) {
  const o = opts || {};
  const map = authAwaitingMap();
  if (!map.count) {
    return { ok: true, invention: 'OAUR', awaiting: 0, note: 'All known rails armed — no owner briefing needed.' };
  }
  const lines = [
    '🔓 ZeusAI Owner-Auth Unblock Reflex (OAUR)',
    map.count + ' rail(s) still await YOUR authorization (agents cannot invent keys):',
    ...map.awaiting.slice(0, 12).map((a) => {
      const envs = (a.envVars || []).join(', ');
      const arm = a.armEndpoint ? ` · arm ${a.armEndpoint}` : '';
      return `• [${a.kind}] ${a.name} — ${envs}${arm}`;
    }),
    'CJ: POST /api/dropship/fulfillment/arm-cj  or  bash UNICORN_FINAL/scripts/arm-zacc-cj-key.sh',
    'USCF: POST /api/dropship/suppliers/arm { supplier, apiKey, shopId? }',
    'RIVOS: ' + APP_URL + '/.well-known/rivos.json',
  ];
  const text = lines.join('\n');
  if (o.dryRun) return { ok: true, dryRun: true, preview: text, awaiting: map.count, fingerprint: map.fingerprint };

  let sent = false;
  try {
    const zac = require('../../backend/modules/zacAlertChannel');
    if (zac && typeof zac.sendTelegram === 'function') {
      await Promise.resolve(zac.sendTelegram(text));
      sent = true;
    }
  } catch (_) { /* ignore */ }
  _counts.ownerBriefings += 1;
  _state.lastBriefingAt = Date.now();
  _cymAppend('owner_briefing', { awaiting: map.count, fingerprint: map.fingerprint, sent });
  _persist();
  return { ok: true, invention: 'OAUR', sent, awaiting: map.count, fingerprint: map.fingerprint };
}

/** Detect newly armed keys vs last fingerprint → pulse BALOS. */
async function detectKeyArmsAndPulse() {
  const map = authAwaitingMap();
  const prev = _state.lastAuthFingerprint;
  const changed = prev && prev !== map.fingerprint;
  const first = !prev;
  _state.lastAuthFingerprint = map.fingerprint;
  if (!changed && !first) {
    _persist();
    return { ok: true, changed: false, fingerprint: map.fingerprint, awaiting: map.count };
  }
  if (changed) {
    _counts.keyArmDetections += 1;
    _cymAppend('key_arm_detected', {
      prev,
      next: map.fingerprint,
      awaiting: map.count,
    });
  }
  let balos = null;
  try {
    const loop = require('./billion-autonomy-loop-os');
    if (loop && typeof loop.tick === 'function' && process.env.DISABLE_BILLION_AUTONOMY_LOOP !== '1') {
      balos = await loop.tick({ source: 'rivos-oaur', dryRun: false });
    } else {
      balos = { ok: false, reason: 'balos_parked_or_unavailable' };
    }
  } catch (e) {
    balos = { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
  _persist();
  return {
    ok: true,
    invention: 'OAUR',
    changed: !!changed,
    first,
    fingerprint: map.fingerprint,
    awaiting: map.count,
    balosPulse: balos,
  };
}

/** PRL — queue recovery for pending/expired sovereign orders. */
function scanRecovery(opts) {
  const o = opts || {};
  const limit = Math.max(1, Math.min(40, Number(o.limit) || 12));
  let orders = [];
  try {
    const sc = require('../site/sovereign-commerce');
    if (sc && sc.ORDERS) {
      orders = Array.from(sc.ORDERS.values());
    }
  } catch (_) { /* ignore */ }

  const now = Date.now();
  const candidates = [];
  for (const ord of orders) {
    if (!ord || !ord.orderId) continue;
    const status = String(ord.status || '');
    const expired = status === 'expired' || (status === 'pending' && Number(ord.expires_at_ms || 0) > 0 && now >= Number(ord.expires_at_ms));
    const pending = status === 'pending' && !expired;
    if (!expired && !pending) continue;
    // Only recover if invoice is still useful (pending) or recently expired (< 48h)
    if (expired) {
      const age = now - Number(ord.expires_at_ms || 0);
      if (age > 48 * 3600 * 1000) continue;
    }
    if (_state.recovery[ord.orderId] && _state.recovery[ord.orderId].status === 'queued') continue;
    candidates.push({
      orderId: ord.orderId,
      serviceId: ord.serviceId,
      serviceName: ord.serviceName,
      status: expired ? 'expired' : 'pending',
      amountUsd: _amountUsd(ord),
      email: (ord.buyer && ord.buyer.email) || ord.email || null,
      checkoutUrl: APP_URL + '/checkout/' + encodeURIComponent(ord.orderId),
      bip21: ord.bip21 || ord.payment_uri || null,
    });
  }
  candidates.sort((a, b) => b.amountUsd - a.amountUsd);
  const picked = candidates.slice(0, limit);
  const queued = [];
  for (const c of picked) {
    _state.recovery[c.orderId] = {
      queuedAt: new Date().toISOString(),
      status: 'queued',
      reason: c.status === 'expired' ? 'checkout_expired' : 'checkout_pending',
      amountUsd: c.amountUsd,
      serviceId: c.serviceId,
    };
    _counts.recoveryQueued += 1;
    queued.push(c);
    // Negative gravity for expired
    if (c.status === 'expired') {
      try { onExpired({ serviceId: c.serviceId, orderId: c.orderId, amountUsd: c.amountUsd }); } catch (_) { /* ignore */ }
    }
  }
  _persist();
  return {
    ok: true,
    invention: 'PRL',
    scanned: orders.length,
    queued: queued.length,
    items: queued,
    note: 'Recovery intents hold the same checkout URL / BIP-21 — never invent rails.',
  };
}

async function notifyRecovery(batch) {
  const items = (batch && batch.items) || [];
  if (!items.length) return { ok: true, sent: false, reason: 'empty' };
  const lines = [
    '♻️ ZeusAI Pending→Recovery Lattice (PRL)',
    items.length + ' checkout(s) need a nudge (same invoice — no new rails):',
    ...items.slice(0, 8).map((c) => `• ${c.serviceName || c.serviceId} · $${c.amountUsd} · ${c.status} → ${c.checkoutUrl}`),
  ];
  const text = lines.join('\n');
  try {
    const zac = require('../../backend/modules/zacAlertChannel');
    if (zac && typeof zac.sendTelegram === 'function') {
      await Promise.resolve(zac.sendTelegram(text));
      _cymAppend('recovery_notify', { count: items.length });
      return { ok: true, sent: true };
    }
  } catch (_) { /* ignore */ }
  return { ok: false, sent: false, reason: 'telegram_unavailable', preview: text };
}

async function tick(opts) {
  const o = opts || {};
  if (!ENABLED && !o.force) {
    return { ok: true, skipped: true, reason: 'rivos_disabled' };
  }
  _counts.ticks += 1;
  _state.lastTickAt = new Date().toISOString();
  const result = {
    protocol: PROTOCOL,
    invention: INVENTION,
    at: _state.lastTickAt,
    gravityTop: gravitySnapshot(5),
    oaur: null,
    prl: null,
    recoveryNotify: null,
  };
  try {
    result.oaur = await detectKeyArmsAndPulse();
    // Brief owner at most once per 6h when awaiting > 0
    const map = authAwaitingMap();
    const due = Date.now() - (_state.lastBriefingAt || 0) > 6 * 3600 * 1000;
    if (map.count > 0 && (due || o.forceBriefing) && !o.dryRun) {
      result.briefing = await briefOwnerAuth({});
    } else if (o.dryRun) {
      result.briefing = await briefOwnerAuth({ dryRun: true });
    }
  } catch (e) {
    _counts.errors += 1;
    result.oaur = { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
  try {
    result.prl = scanRecovery({ limit: o.recoveryLimit || 8 });
    if (!o.dryRun && result.prl.queued > 0) {
      result.recoveryNotify = await notifyRecovery(result.prl);
    }
  } catch (e) {
    _counts.errors += 1;
    result.prl = { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
  _state.lastTick = {
    at: result.at,
    gravityTop: result.gravityTop,
    awaiting: (result.oaur && result.oaur.awaiting) || null,
    recoveryQueued: (result.prl && result.prl.queued) || 0,
  };
  _cymAppend('tick', {
    gravityTop: result.gravityTop.map((g) => g.id),
    awaiting: result.oaur && result.oaur.awaiting,
    recoveryQueued: result.prl && result.prl.queued,
  });
  _persist();
  return result;
}

function start() {
  if (!ENABLED || _timer) return { ok: true, started: !_timer, enabled: ENABLED };
  _load();
  _timer = setInterval(() => {
    Promise.resolve(tick({ source: 'interval' })).catch(() => {});
  }, TICK_MS);
  if (typeof _timer.unref === 'function') _timer.unref();
  // Warm fingerprint without briefing on boot
  try {
    const map = authAwaitingMap();
    if (!_state.lastAuthFingerprint) _state.lastAuthFingerprint = map.fingerprint;
    _persist();
  } catch (_) { /* ignore */ }
  return { ok: true, started: true, intervalMs: TICK_MS };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  return { ok: true, stopped: true };
}

function discovery() {
  _load();
  const map = authAwaitingMap();
  return {
    ok: true,
    protocol: PROTOCOL,
    invention: INVENTION,
    inventions: {
      PECG: 'Paid-Evidence Catalog Gravity — shelf rank from attested paid/expired only',
      OAUR: 'Owner-Auth Unblock Reflex — one briefing + key-arrival pulse',
      PRL: 'Pending→Recovery Lattice — same-invoice recovery intents',
      CYM: 'Causal Yield Mirror — hash ledger of paid/key/tick events only',
    },
    enabled: ENABLED,
    gravityTop: gravitySnapshot(8),
    awaitingOwnerAuth: map.awaiting.slice(0, 16),
    awaitingCount: map.count,
    recoveryQueued: Object.values(_state.recovery).filter((r) => r && r.status === 'queued').length,
    lastTick: _state.lastTick,
    counts: Object.assign({}, _counts),
    endpoints: {
      status: '/api/rivos/status',
      wellKnown: '/.well-known/rivos.json',
      tick: '/api/rivos/tick',
      gravity: '/api/rivos/gravity',
    },
    honesty: 'Never invents GMV, SERP, or supplier keys. Gravity uses attested paid/expired only. Recovery never invents payment rails.',
  };
}

function status() { return discovery(); }

_load();

module.exports = {
  PROTOCOL,
  INVENTION,
  onPaid,
  onExpired,
  reorderSkus,
  gravitySnapshot,
  authAwaitingMap,
  briefOwnerAuth,
  detectKeyArmsAndPulse,
  scanRecovery,
  notifyRecovery,
  tick,
  start,
  stop,
  discovery,
  status,
  _counts,
  _state,
};
