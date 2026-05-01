// commerce/transactional-email.js — SMTP-backed transactional email (RO+EN).
// Trimite emailuri la signup, payment_pending, payment_activated, refund.
// No-op safe dacă nu sunt configurate variabilele SMTP_HOST + SMTP_USER + SMTP_PASS;
// returnează { ok:true, skipped:'unconfigured' } în acest caz pentru a nu rupe flow-ul.

let nodemailer;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }

const FROM = process.env.SMTP_FROM || process.env.OWNER_EMAIL || 'no-reply@zeusai.pro';
const REPLY_TO = process.env.SMTP_REPLY_TO || process.env.OWNER_EMAIL || 'support@zeusai.pro';
const APP_URL = (process.env.APP_URL || 'https://zeusai.pro').replace(/\/$/, '');

let _transporter = null;
function transporter() {
  if (_transporter) return _transporter;
  if (!nodemailer || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: String(process.env.SMTP_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false' }
  });
  return _transporter;
}

const TEMPLATES = {
  welcome: ({ name }) => ({
    subject: 'Welcome to ZeusAI · Bun venit',
    text: `Hi ${name || 'there'},\n\nYour ZeusAI account is live. Manage services at ${APP_URL}/account.\n\n— ZeusAI`,
    html: `<p>Hi ${escapeHtml(name || 'there')},</p><p>Your ZeusAI account is live. Manage services at <a href="${APP_URL}/account">${APP_URL}/account</a>.</p><p>— ZeusAI · Self-custody · BTC-first</p>`
  }),
  payment_pending: ({ orderId, btcAddress, btcAmount, priceUSD }) => ({
    subject: `Payment pending · Order ${orderId}`,
    text: `Send exactly ${btcAmount} BTC ($${priceUSD}) to ${btcAddress}.\nTrack: ${APP_URL}/order/${orderId}`,
    html: `<p>Send exactly <b>${btcAmount} BTC</b> ($${priceUSD}) to:</p><p><code>${escapeHtml(btcAddress)}</code></p><p>Track live: <a href="${APP_URL}/order/${orderId}">${APP_URL}/order/${orderId}</a></p>`
  }),
  payment_activated: ({ orderId, serviceId }) => ({
    subject: `✅ Activated · ${serviceId}`,
    text: `Payment confirmed. ${serviceId} is active. Visit ${APP_URL}/account.`,
    html: `<p>Payment confirmed. <b>${escapeHtml(serviceId)}</b> is active.</p><p>Visit <a href="${APP_URL}/account">${APP_URL}/account</a> for delivery and API keys.</p>`
  })
};

function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

async function sendTransactional({ to, template, data }) {
  if (!to) return { ok: false, error: 'missing_to' };
  const tx = transporter();
  if (!tx) return { ok: true, skipped: 'unconfigured' };
  const tpl = TEMPLATES[template];
  if (!tpl) return { ok: false, error: 'unknown_template' };
  const { subject, text, html } = tpl(data || {});
  try {
    const info = await tx.sendMail({ from: FROM, to, replyTo: REPLY_TO, subject, text, html });
    return { ok: true, messageId: info && info.messageId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendTransactional, TEMPLATES };
