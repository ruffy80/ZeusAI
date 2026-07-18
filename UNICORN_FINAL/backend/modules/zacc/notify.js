// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Owner notifications (best-effort).
// RO: trimite alerte operaționale (comandă plătită, fulfillment manual necesar,
// comandă expediată) către owner. Trei canale, toate opționale + fail-soft:
//   1) console.log structurat (întotdeauna);
//   2) Telegram sendMessage (dacă ZAC_TELEGRAM_TOKEN+CHAT_ID sau
//      TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID sunt setate);
//   3) POST webhook (dacă ZACC_FULFILL_WEBHOOK_URL e setat).
// Nu aruncă NICIODATĂ — notificarea nu trebuie să blocheze comerțul.

'use strict';

const { now, logger } = require('./util');

const log = logger('notify');

const FETCH_TIMEOUT_MS = 5000;

function _telegramCreds() {
  const token = process.env.ZAC_TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.ZAC_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';
  if (token && chatId) return { token, chatId };
  return null;
}

function _format(event, payload) {
  const lines = ['[ZACC] ' + String(event).toUpperCase()];
  const p = payload || {};
  if (p.orderToken) lines.push('order: ' + p.orderToken);
  if (p.productTitle) lines.push('product: ' + p.productTitle);
  if (p.qty) lines.push('qty: ' + p.qty);
  if (typeof p.amountUsd === 'number') lines.push('amount: $' + p.amountUsd);
  if (p.email) lines.push('email: ' + p.email);
  if (p.carrier || p.trackingNumber) lines.push('shipment: ' + [p.carrier, p.trackingNumber].filter(Boolean).join(' '));
  if (p.reason) lines.push('reason: ' + p.reason);
  return lines.join('\n');
}

async function _sendTelegram(text) {
  const creds = _telegramCreds();
  if (!creds || typeof fetch !== 'function') return { ok: false, reason: 'telegram_not_configured' };
  try {
    const url = 'https://api.telegram.org/bot' + creds.token + '/sendMessage';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: creds.chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return { ok: r.ok, reason: r.ok ? null : 'telegram_status_' + r.status };
  } catch (e) { return { ok: false, reason: 'telegram_exception', message: e.message }; }
}

async function _sendWebhook(event, payload) {
  const url = process.env.ZACC_FULFILL_WEBHOOK_URL || '';
  if (!url || typeof fetch !== 'function') return { ok: false, reason: 'webhook_not_configured' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'zacc.notify', event, at: now(), payload: payload || {} }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return { ok: r.ok, reason: r.ok ? null : 'webhook_status_' + r.status };
  } catch (e) { return { ok: false, reason: 'webhook_exception', message: e.message }; }
}

// Fire all configured channels. Returns a per-channel result but never rejects.
async function notify(event, payload) {
  const channels = { console: true, telegram: false, webhook: false };
  try {
    log.info(_format(event, payload).replace(/\n/g, ' · '));
  } catch (_) { /* noop */ }
  const text = _format(event, payload);
  const [tg, wh] = await Promise.all([
    _sendTelegram(text).catch((e) => ({ ok: false, reason: 'telegram_error', message: e && e.message })),
    _sendWebhook(event, payload).catch((e) => ({ ok: false, reason: 'webhook_error', message: e && e.message })),
  ]);
  channels.telegram = tg;
  channels.webhook = wh;
  return { ok: true, event, channels };
}

// ---- Semantic helpers -------------------------------------------------
function orderPaid(payload) { return notify('order_paid', payload); }
function orderManualNeeded(payload) { return notify('order_manual_needed', payload); }
function orderShipped(payload) { return notify('order_shipped', payload); }

module.exports = { notify, orderPaid, orderManualNeeded, orderShipped };
