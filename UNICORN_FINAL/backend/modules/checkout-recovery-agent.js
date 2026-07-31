// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T16:49:42.092Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * checkout-recovery-agent (REAL implementation)
 * --------------------------------------------
 * Scans the SQLite portal for orders stuck in `awaiting_payment` past a
 * configurable cool-down (default 30 minutes) and returns the actionable
 * recovery list. If a transactional-email module is present, fires one
 * recovery email per order per 24h window (rate-limited in-process).
 *
 * Pure read-mostly; never auto-cancels or writes order status. Owner stays
 * in control. RO+EN comments preserved.
 */

const path = require('path');
const crypto = require('crypto');

const NAME = 'checkout-recovery-agent';

let portal = null;
try { portal = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'customer-portal.js')); } catch (_) {}
let mailer = null;
// Canonical mailer lives under src/commerce — never a sibling stub under backend/modules.
try { mailer = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'transactional-email.js')); } catch (_) {}

const _sentLog = new Map(); // orderId → lastTs
const RECOVERY_WINDOW_MS = 24 * 3600 * 1000;
const STUCK_AFTER_MS_DEFAULT = 30 * 60 * 1000;

function _allOrders() {
  // Use portal's internal list if available; fall back to nothing.
  if (!portal) return [];
  // Best-effort: iterate via _stats + listOrdersByCustomer is too slow.
  // Use a private query via portal._listOrders if present.
  if (typeof portal._listOrders === 'function') return portal._listOrders();
  return [];
}

function scan(opts) {
  const now = Date.now();
  const stuckAfterMs = Math.max(60 * 1000, Number((opts && opts.stuckAfterMs) || STUCK_AFTER_MS_DEFAULT));
  const orders = _allOrders();
  const stuck = [];
  for (const o of orders) {
    if (!o || o.status !== 'awaiting_payment') continue;
    const created = Date.parse(o.createdAt || '') || 0;
    const ageMs = now - created;
    if (ageMs < stuckAfterMs) continue;
    stuck.push({
      orderId: o.id,
      customerId: o.customerId,
      productId: o.productId,
      priceUSD: o.priceUSD,
      btcAmount: o.btcAmount,
      btcAddress: o.btcAddress,
      invoiceUri: o.invoiceUri,
      ageMinutes: Math.floor(ageMs / 60000),
      createdAt: o.createdAt,
      lastRecoveryAt: _sentLog.get(o.id) ? new Date(_sentLog.get(o.id)).toISOString() : null
    });
  }
  stuck.sort((a, b) => b.ageMinutes - a.ageMinutes);
  return stuck;
}

async function _telegramNudge(item) {
  try {
    const zac = require('./zacAlertChannel');
    if (!zac || typeof zac.sendTelegram !== 'function') return { ok: false, reason: 'no_telegram' };
    const payUri = item.invoiceUri || (item.btcAddress ? ('bitcoin:' + item.btcAddress) : null);
    const text = [
      '🛒 *Checkout recovery*',
      `Order \`${item.orderId}\` still awaiting payment (${item.ageMinutes}m).`,
      item.productId ? `Product: ${item.productId}` : null,
      item.priceUSD != null ? `Amount: $${item.priceUSD}` : null,
      payUri ? `Pay: ${payUri}` : null,
      'Email rail offline/failed — Telegram nudge (buyer email not confirmed sent).',
    ].filter(Boolean).join('\n');
    const r = await Promise.resolve(zac.sendTelegram(text));
    return { ok: !!(r && r.ok !== false), channel: 'telegram' };
  } catch (e) {
    return { ok: false, reason: e && e.message };
  }
}

async function recover(opts) {
  const stuck = scan(opts);
  const dryRun = !!(opts && opts.dryRun);
  const sent = [];
  const skipped = [];
  const telegramNudges = [];
  for (const item of stuck) {
    const last = _sentLog.get(item.orderId) || 0;
    if (Date.now() - last < RECOVERY_WINDOW_MS) { skipped.push({ orderId: item.orderId, reason: 'cooldown' }); continue; }
    if (dryRun) {
      skipped.push({ orderId: item.orderId, reason: 'dry_run' });
      continue;
    }
    const customer = item.customerId && portal && typeof portal.getById === 'function'
      ? portal.getById(item.customerId) : null;
    const hasEmail = !!(customer && customer.email);
    const mailArmed = !!(mailer && typeof mailer.isConfigured === 'function' ? mailer.isConfigured() : mailer);
    const canEmail = !!(mailer && hasEmail && mailArmed);

    if (canEmail) {
      try {
        const subject = `Your Unicorn order ${item.orderId} — payment still pending`;
        const body = `Hello ${customer.name || customer.email},\n\nYour order ${item.orderId} (${item.productId}) for $${item.priceUSD} (≈ ${item.btcAmount} BTC) is awaiting payment for ${item.ageMinutes} minutes.\n\nPay any time at:\n${item.invoiceUri || ('bitcoin:' + item.btcAddress)}\n\nQuestions? Reply to this email.\n\n— ZeusAI / Unicorn`;
        let r = null;
        if (typeof mailer.sendRaw === 'function') {
          r = await mailer.sendRaw({ to: customer.email, subject, text: body });
        } else if (typeof mailer.send === 'function') {
          r = await Promise.resolve(mailer.send({ to: customer.email, subject, text: body }));
        } else {
          skipped.push({ orderId: item.orderId, reason: 'no_mailer_api' });
        }
        // Phase 2 honesty: only mark sent when provider reports ok.
        if (r && r.ok) {
          _sentLog.set(item.orderId, Date.now());
          sent.push({ orderId: item.orderId, email: customer.email });
          continue;
        }
        skipped.push({
          orderId: item.orderId,
          reason: 'email_' + String((r && (r.reason || r.error || r.skipped)) || 'send_failed').slice(0, 60),
        });
      } catch (e) {
        skipped.push({ orderId: item.orderId, reason: 'send_failed:' + (e && e.message || 'unknown') });
      }
    }

    // No email rail / no buyer email / send failed → Telegram owner nudge.
    const tg = await _telegramNudge(item);
    if (tg.ok) {
      _sentLog.set(item.orderId, Date.now());
      telegramNudges.push({ orderId: item.orderId });
      skipped.push({ orderId: item.orderId, reason: hasEmail ? 'email_unavailable_telegram_nudge' : 'no_email_telegram_nudge' });
    } else if (!canEmail) {
      skipped.push({ orderId: item.orderId, reason: hasEmail ? (mailArmed ? 'no_mailer' : 'email_unconfigured') : 'no_email' });
    }
  }
  return {
    ok: true,
    scannedAt: new Date().toISOString(),
    stuck: stuck.length,
    sent: sent.length,
    skipped: skipped.length,
    telegramNudges: telegramNudges.length,
    sentList: sent,
    skippedList: skipped,
    telegramNudgeList: telegramNudges,
  };
}

function getStatus(opts) {
  const stuck = scan(opts);
  let telegramArmed = false;
  try {
    const zac = require('./zacAlertChannel');
    telegramArmed = !!(zac && zac.getStatus && zac.getStatus().telegramConfigured);
  } catch (_) { /* optional */ }
  return {
    ok: true,
    name: NAME,
    title: 'Checkout Recovery Agent',
    domain: 'checkout-recovery',
    summary: 'Detects stuck awaiting_payment orders; emails when armed, else Telegram owner nudge (24h cooldown).',
    portalAttached: !!portal,
    mailerAttached: !!mailer,
    telegramNudgeArmed: telegramArmed,
    stuckCount: stuck.length,
    recoveriesEverSent: _sentLog.size,
    sample: stuck.slice(0, 5),
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return recover(input); }

let _timer = null;
/**
 * Always-on recovery tick — independent of revenue-autopilot.
 * Portal awaiting_payment orders only (sovereign pending is recovered in
 * src/site/sovereign-commerce.js on the site process).
 */
function start(opts) {
  if (_timer) return { ok: true, already: true };
  const intervalMs = Math.max(60 * 1000, Number((opts && opts.intervalMs) || process.env.CHECKOUT_RECOVERY_INTERVAL_MS || 15 * 60 * 1000));
  const stuckAfterMs = Math.max(60 * 1000, Number((opts && opts.stuckAfterMs) || 15 * 60 * 1000));
  const tick = () => {
    Promise.resolve(recover({ stuckAfterMs, dryRun: false }))
      .catch((e) => console.warn('[checkout-recovery] tick failed:', e && e.message));
  };
  setTimeout(tick, 20 * 1000);
  _timer = setInterval(tick, intervalMs);
  if (typeof _timer.unref === 'function') _timer.unref();
  console.log('[checkout-recovery] always-on armed · interval=' + intervalMs + 'ms');
  return { ok: true, intervalMs, stuckAfterMs };
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  return { ok: true };
}

module.exports = { name: NAME, scan, recover, getStatus, run, start, stop };
