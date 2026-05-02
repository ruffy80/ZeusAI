// commerce/transactional-email.js — Multi-transport transactional email (RO+EN).
// Trimite emailuri la signup, payment_pending, payment_activated, refund, password_reset.
//
// Transport priority (first one configured wins):
//   1. RESEND_API_KEY     → POST https://api.resend.com/emails  (HTTPS, recommended on Hetzner)
//   2. BREVO_API_KEY      → POST https://api.brevo.com/v3/smtp/email
//   3. MAILERSEND_API_KEY → POST https://api.mailersend.com/v1/email
//   4. SMTP_HOST + SMTP_USER + SMTP_PASS → nodemailer
//
// HTTPS providers are preferred on Hetzner because outbound SMTP ports (25/465/587)
// are often filtered. They use only Node's built-in `https` module — no extra deps.
// Returnează { ok:true, skipped:'unconfigured' } dacă niciun transport nu e configurat.

const https = require('https');

let nodemailer;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }

function envFrom() {
  // Priority for the From address: explicit SMTP_FROM > RESEND_FROM > OWNER_EMAIL > default.
  return process.env.SMTP_FROM || process.env.RESEND_FROM || process.env.OWNER_EMAIL || 'no-reply@zeusai.pro';
}
function envFromName() {
  return process.env.EMAIL_FROM_NAME || 'ZeusAI';
}
function envReplyTo() {
  return process.env.SMTP_REPLY_TO || process.env.OWNER_EMAIL || 'support@zeusai.pro';
}
function envAppUrl() {
  return (process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/$/, '');
}

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
    text: `Hi ${name || 'there'},\n\nYour ZeusAI account is live. Manage services at ${envAppUrl()}/account.\n\n— ZeusAI`,
    html: `<p>Hi ${escapeHtml(name || 'there')},</p><p>Your ZeusAI account is live. Manage services at <a href="${envAppUrl()}/account">${envAppUrl()}/account</a>.</p><p>— ZeusAI · Self-custody · BTC-first</p>`
  }),
  payment_pending: ({ orderId, btcAddress, btcAmount, priceUSD }) => ({
    subject: `Payment pending · Order ${orderId}`,
    text: `Send exactly ${btcAmount} BTC ($${priceUSD}) to ${btcAddress}.\nTrack: ${envAppUrl()}/order/${orderId}`,
    html: `<p>Send exactly <b>${btcAmount} BTC</b> ($${priceUSD}) to:</p><p><code>${escapeHtml(btcAddress)}</code></p><p>Track live: <a href="${envAppUrl()}/order/${orderId}">${envAppUrl()}/order/${orderId}</a></p>`
  }),
  payment_activated: ({ orderId, serviceId }) => ({
    subject: `✅ Activated · ${serviceId}`,
    text: `Payment confirmed. ${serviceId} is active. Visit ${envAppUrl()}/account.`,
    html: `<p>Payment confirmed. <b>${escapeHtml(serviceId)}</b> is active.</p><p>Visit <a href="${envAppUrl()}/account">${envAppUrl()}/account</a> for delivery and API keys.</p>`
  }),
  password_reset: ({ resetUrl, expiresInMinutes }) => {
    const url = String(resetUrl || envAppUrl() + '/reset-password');
    const ttl = Number(expiresInMinutes) > 0 ? Number(expiresInMinutes) : 60;
    return {
      subject: 'Reset your ZeusAI password / Resetează parola ZeusAI',
      text:
        'EN — You requested a password reset on ' + envAppUrl() + '.\n' +
        'Open this single-use link (valid ' + ttl + ' minutes):\n\n' + url + '\n\n' +
        'If you did not request this, ignore this email — your account stays safe.\n\n' +
        '— — —\n\n' +
        'RO — Ai cerut resetarea parolei pe ' + envAppUrl() + '.\n' +
        'Deschide acest link unic (valabil ' + ttl + ' de minute):\n\n' + url + '\n\n' +
        'Dacă nu tu ai cerut asta, ignoră emailul — contul rămâne în siguranță.\n\n' +
        '— ZeusAI · Self-custody · BTC-first',
      html:
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">' +
          '<h2 style="margin:0 0 12px;font-size:20px;">Reset your ZeusAI password</h2>' +
          '<p style="margin:0 0 16px;line-height:1.5;">You requested a password reset on <a href="' + escapeHtml(envAppUrl()) + '">' + escapeHtml(envAppUrl()) + '</a>. Click the button below to choose a new password. The link is single-use and valid for <b>' + ttl + ' minutes</b>.</p>' +
          '<p style="text-align:center;margin:24px 0;"><a href="' + escapeHtml(url) + '" style="background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:600;">Reset password / Resetează parola</a></p>' +
          '<p style="margin:0 0 8px;font-size:12px;color:#475569;">Or copy this link into your browser:</p>' +
          '<p style="margin:0 0 24px;font-size:12px;word-break:break-all;"><a href="' + escapeHtml(url) + '" style="color:#0369a1;">' + escapeHtml(url) + '</a></p>' +
          '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">' +
          '<p style="margin:0 0 8px;line-height:1.5;"><b>RO</b> — Ai cerut resetarea parolei pe ZeusAI. Apasă butonul de mai sus pentru a alege o parolă nouă. Linkul este de unică folosință și e valabil <b>' + ttl + ' de minute</b>.</p>' +
          '<p style="margin:16px 0 0;font-size:12px;color:#64748b;">If you did not request this, ignore this email — your account stays safe. / Dacă nu tu ai cerut asta, ignoră emailul — contul rămâne în siguranță.</p>' +
          '<p style="margin:24px 0 0;font-size:11px;color:#94a3b8;">— ZeusAI · Self-custody · BTC-first</p>' +
        '</div>'
    };
  }
};

function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

// ─── HTTPS-based providers (no extra deps; use Node core `https`) ─────────────
const MAX_RESPONSE_BYTES = 64 * 1024; // hard cap to bound memory on hostile responses

function fmtHttpError(r) {
  const detail = r.error || (r.body && r.body.message) || r.raw || '';
  return 'http ' + r.status + ' ' + String(detail).slice(0, 200);
}

function httpsJson({ host, path, headers, body, timeoutMs }) {
  return new Promise((resolve) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const opts = {
      method: 'POST',
      host,
      path,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': data ? data.length : 0,
        'User-Agent': 'ZeusAI-Mailer/1.0'
      }, headers || {})
    };
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); } };

    const req = https.request(opts, (resp) => {
      const chunks = [];
      let total = 0;
      let truncated = false;
      const finish = () => {
        const status = resp.statusCode || 0;
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null; try { json = raw ? JSON.parse(raw) : null; } catch (_) { /* keep raw */ }
        settle({ ok: status >= 200 && status < 300, status, body: json, raw });
      };
      resp.on('data', (c) => {
        if (truncated) return;
        const remaining = MAX_RESPONSE_BYTES - total;
        if (remaining <= 0) {
          truncated = true;
          try { resp.destroy(); } catch (_) { /* already ending */ }
          return;
        }
        if (c.length > remaining) {
          chunks.push(c.slice(0, remaining));
          total += remaining;
          truncated = true;
          try { resp.destroy(); } catch (_) { /* already ending */ }
        } else {
          chunks.push(c);
          total += c.length;
        }
      });
      resp.on('end', finish);
      // resp.destroy() (oversize trim) emits 'error' before 'end'; reuse `finish`
      // and rely on the `settled` guard to avoid double-resolving.
      resp.on('error', finish);
    });
    req.on('error', (e) => settle({ ok: false, status: 0, error: e.message }));
    req.setTimeout(Number(timeoutMs || 10000), () => {
      // req.destroy(Error) triggers the 'error' listener above; the try/catch is
      // defensive in case the socket is already torn down by the host.
      try { req.destroy(new Error('timeout')); } catch (_) { /* socket already gone */ }
    });
    if (data) req.write(data);
    req.end();
  });
}

async function sendViaResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const fromAddr = envFrom();
  const fromName = envFromName();
  const from = fromName ? (fromName + ' <' + fromAddr + '>') : fromAddr;
  const r = await httpsJson({
    host: 'api.resend.com',
    path: '/emails',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    body: { from, to: [to], subject, text, html, reply_to: envReplyTo() }
  });
  if (r.ok) return { ok: true, provider: 'resend', messageId: r.body && r.body.id };
  return { ok: false, provider: 'resend', error: fmtHttpError(r) };
}

async function sendViaBrevo({ to, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return null;
  const fromAddr = envFrom();
  const fromName = envFromName();
  const r = await httpsJson({
    host: 'api.brevo.com',
    path: '/v3/smtp/email',
    headers: { 'api-key': apiKey },
    body: {
      sender: { email: fromAddr, name: fromName },
      to: [{ email: to }],
      replyTo: { email: envReplyTo() },
      subject, textContent: text, htmlContent: html
    }
  });
  if (r.ok) return { ok: true, provider: 'brevo', messageId: r.body && r.body.messageId };
  return { ok: false, provider: 'brevo', error: fmtHttpError(r) };
}

async function sendViaMailerSend({ to, subject, text, html }) {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) return null;
  const fromAddr = envFrom();
  const fromName = envFromName();
  const r = await httpsJson({
    host: 'api.mailersend.com',
    path: '/v1/email',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    body: {
      from: { email: fromAddr, name: fromName },
      to: [{ email: to }],
      reply_to: { email: envReplyTo() },
      subject, text, html
    }
  });
  if (r.ok) return { ok: true, provider: 'mailersend', messageId: (r.body && r.body.message_id) || null };
  return { ok: false, provider: 'mailersend', error: fmtHttpError(r) };
}

async function sendViaSmtp({ to, subject, text, html }) {
  const tx = transporter();
  if (!tx) return null;
  try {
    const fromAddr = envFrom();
    const fromName = envFromName();
    const from = fromName ? (fromName + ' <' + fromAddr + '>') : fromAddr;
    const info = await tx.sendMail({ from, to, replyTo: envReplyTo(), subject, text, html });
    return { ok: true, provider: 'smtp', messageId: info && info.messageId };
  } catch (e) {
    return { ok: false, provider: 'smtp', error: e.message };
  }
}

function configuredProviders() {
  const out = [];
  if (process.env.RESEND_API_KEY) out.push('resend');
  if (process.env.BREVO_API_KEY) out.push('brevo');
  if (process.env.MAILERSEND_API_KEY) out.push('mailersend');
  if (nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) out.push('smtp');
  return out;
}

async function sendTransactional({ to, template, data }) {
  if (!to) return { ok: false, error: 'missing_to' };
  const tpl = TEMPLATES[template];
  if (!tpl) return { ok: false, error: 'unknown_template' };
  const { subject, text, html } = tpl(data || {});
  const providers = configuredProviders();
  if (providers.length === 0) return { ok: true, skipped: 'unconfigured' };

  // Try providers in priority order; fall through to next on failure so a single
  // misconfigured key doesn't drop a critical email (e.g. password reset).
  // Order rationale: HTTPS providers first because Hetzner blocks outbound SMTP
  // ports (25/465/587) by default; SMTP is kept as last fallback for self-hosted
  // mail relays. Within HTTPS providers, Resend is preferred for its simpler API
  // and generous free tier suitable for transactional volume.
  const order = [sendViaResend, sendViaBrevo, sendViaMailerSend, sendViaSmtp];
  const errors = [];
  for (const fn of order) {
    const r = await fn({ to, subject, text, html });
    if (r === null) continue; // not configured
    if (r.ok) return r;
    errors.push(r.provider + ': ' + (r.error || 'unknown'));
  }
  return { ok: false, error: errors.join(' | ') || 'all_providers_failed' };
}

module.exports = { sendTransactional, TEMPLATES, configuredProviders };
