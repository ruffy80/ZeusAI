// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:29:34.691Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * zacAlertChannel — outbound notifications to Discord and/or Telegram.
 *
 * Env:
 *   ZAC_DISCORD_WEBHOOK   — full Discord webhook URL (https://discord.com/api/webhooks/...)
 *   ZAC_TELEGRAM_TOKEN    — bot token
 *   ZAC_TELEGRAM_CHAT_ID  — destination chat id
 *
 * Designed as fire-and-forget. Never throws. Includes simple in-memory
 * rate limiting (max 30 messages/min) so bursts of alerts don't spam channels.
 */
const https = require('https');
const { URL } = require('url');

const RATE_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
let _bucket = [];

function _allow() {
  const now = Date.now();
  _bucket = _bucket.filter((t) => now - t < RATE_WINDOW_MS);
  if (_bucket.length >= MAX_PER_WINDOW) return false;
  _bucket.push(now);
  return true;
}

function postJSON(url, body) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve({ ok: false, error: 'bad-url' }); }
    const data = Buffer.from(JSON.stringify(body));
    const opts = {
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      port: u.port || 443,
      headers: { 'content-type': 'application/json', 'content-length': data.length },
      timeout: 8000,
    };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ ok: res.statusCode < 400, status: res.statusCode, body: buf.slice(0, 200) }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.write(data); req.end();
  });
}

async function sendDiscord(message) {
  const url = process.env.ZAC_DISCORD_WEBHOOK;
  if (!url) return { ok: false, skipped: 'no-webhook' };
  return postJSON(url, { content: String(message).slice(0, 1900) });
}

async function sendTelegram(message) {
  const token  = process.env.ZAC_TELEGRAM_TOKEN;
  const chatId = process.env.ZAC_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, skipped: 'no-config' };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  return postJSON(url, { chat_id: chatId, text: String(message).slice(0, 4000), parse_mode: 'Markdown' });
}

async function broadcast(message) {
  if (!_allow()) return { ok: false, error: 'rate-limited' };
  const [d, t] = await Promise.all([sendDiscord(message), sendTelegram(message)]);
  return { discord: d, telegram: t };
}

function notifyFirstSale(invoice) {
  const lines = [
    '🎉 **PRIMA VÂNZARE BTC!**',
    `Service: ${invoice.service}`,
    `Amount:  $${invoice.priceUsd}  (${invoice.amountBtc} BTC)`,
    `TXID:    ${invoice.txid}`,
    `Address: ${invoice.payoutAddress}`,
    `Time:    ${invoice.paidAt}`,
  ].join('\n');
  return broadcast(lines);
}

function notifySale(invoice) {
  const lines = [
    `💰 BTC payment confirmed`,
    `#${invoice.id}: ${invoice.service} — $${invoice.priceUsd} (${invoice.amountBtc} BTC)`,
    `TX: ${invoice.txid}`,
  ].join('\n');
  return broadcast(lines);
}

function notifyAlert(alert) {
  const text = `⚠️ ZAC alert: ${alert.kind || 'unknown'}` +
               (alert.target ? ` · ${alert.target}` : '') +
               (alert.error  ? `\nerror: ${alert.error}` : '');
  return broadcast(text);
}

function getStatus() {
  return {
    discordConfigured:  !!process.env.ZAC_DISCORD_WEBHOOK,
    telegramConfigured: !!(process.env.ZAC_TELEGRAM_TOKEN && process.env.ZAC_TELEGRAM_CHAT_ID),
    rateWindowMs: RATE_WINDOW_MS,
    maxPerWindow: MAX_PER_WINDOW,
    sentInWindow: _bucket.length,
  };
}

module.exports = {
  broadcast,
  sendDiscord,
  sendTelegram,
  notifySale,
  notifyFirstSale,
  notifyAlert,
  getStatus,
};
