// commerce/transactional-email.js — Multi-transport transactional email (RO+EN).
// Trimite emailuri la signup, payment_pending, payment_activated, refund, password_reset,
// order_receipt, delivery_artifact.
//
// Transport priority (first one configured wins):
//   1. RESEND_API_KEY                        → POST https://api.resend.com/emails
//   2. BREVO_API_KEY / SENDINBLUE_API_KEY    → POST https://api.brevo.com/v3/smtp/email
//   3. MAILERSEND_API_KEY                    → POST https://api.mailersend.com/v1/email
//   4. SMTP_HOST + SMTP_USER + SMTP_PASS     → nodemailer
//
// HTTPS providers are preferred on Hetzner because outbound SMTP ports (25/465/587)
// are often filtered. They use only Node's built-in `https` module — no extra deps.
//
// Fail-honest contract (2026-07 upgrade):
//   When NO transport is configured, sendTransactional/sendRaw return
//     { ok:false, reason:'email_unconfigured' }
//   The previous shape { ok:true, skipped:'unconfigured' } lied about the outcome
//   (nothing was actually sent) so security-sensitive flows like password reset
//   could not tell whether an email left the box. Callers must treat ok:false
//   as "not delivered" and either surface it, retry with another provider, or
//   log for operator follow-up. NEVER pretend the mail was sent.

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
  payment_pending: ({ orderId, btcAddress, btcAmount, amount_btc, priceUSD, checkout_url, serviceName }) => {
    const amountBtc = btcAmount || amount_btc || 'pending';
    const safeService = serviceName || 'your service';
    const checkoutUrl = checkout_url || `${envAppUrl()}/checkout/${orderId}`;
    const usdNote = Number(priceUSD) > 0 ? ` ($${priceUSD})` : '';
    return {
      subject: `Payment pending · ${safeService} · Order ${orderId}`,
      text:
        `Service: ${safeService}\n` +
        `Order: ${orderId}\n` +
        `Send exactly ${amountBtc} BTC${usdNote} to ${btcAddress || 'the provided BTC address'}.\n` +
        `Checkout: ${checkoutUrl}`,
      html:
        `<p><b>Service:</b> ${escapeHtml(safeService)}</p>` +
        `<p><b>Order:</b> ${escapeHtml(orderId)}</p>` +
        `<p>Send exactly <b>${escapeHtml(String(amountBtc))} BTC</b>${usdNote} to:</p>` +
        `<p><code>${escapeHtml(btcAddress || 'the provided BTC address')}</code></p>` +
        `<p>Checkout: <a href="${escapeHtml(checkoutUrl)}">${escapeHtml(checkoutUrl)}</a></p>`
    };
  },
  payment_activated: ({ orderId, serviceId }) => ({
    subject: `✅ Activated · ${serviceId}`,
    text: `Payment confirmed. ${serviceId} is active. Visit ${envAppUrl()}/account.`,
    html: `<p>Payment confirmed. <b>${escapeHtml(serviceId)}</b> is active.</p><p>Visit <a href="${envAppUrl()}/account">${envAppUrl()}/account</a> for delivery and API keys.</p>`
  }),
  order_receipt: ({ orderId, serviceId, serviceName, priceUSD, amount_btc, btcAmount, txid, paid_at }) => {
    const svc = serviceName || serviceId || 'your ZeusAI service';
    const btc = amount_btc || btcAmount;
    const usd = Number(priceUSD) > 0 ? '$' + Number(priceUSD).toFixed(2) : null;
    const paidLine = paid_at ? ('Paid at: ' + paid_at + '\n') : '';
    const txLine = txid ? ('BTC txid: ' + txid + '\n') : '';
    const amountLine = usd ? ('Amount: ' + usd + (btc ? ' (' + btc + ' BTC)' : '') + '\n') : (btc ? ('Amount: ' + btc + ' BTC\n') : '');
    return {
      subject: 'Receipt · ' + svc + ' · Order ' + orderId,
      text:
        'Thank you for your purchase.\n\n' +
        'Order: ' + orderId + '\n' +
        'Service: ' + svc + '\n' +
        amountLine + paidLine + txLine +
        '\nYour account and any generated artifacts are available at ' + envAppUrl() + '/account.\n\n' +
        (txid ? ('On-chain proof: https://mempool.space/tx/' + txid + '\n\n') : '') +
        '— ZeusAI · Self-custody · BTC-first',
      html:
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">' +
          '<h2 style="margin:0 0 12px;font-size:20px;">✅ Receipt · ' + escapeHtml(svc) + '</h2>' +
          '<p style="margin:0 0 12px;">Thank you for your purchase. Your order is confirmed.</p>' +
          '<table style="border-collapse:collapse;font-size:14px;margin:12px 0;">' +
            '<tr><td style="padding:4px 12px 4px 0;color:#475569;">Order</td><td style="padding:4px 0;font-family:ui-monospace,SFMono-Regular,monospace;">' + escapeHtml(orderId || '—') + '</td></tr>' +
            '<tr><td style="padding:4px 12px 4px 0;color:#475569;">Service</td><td style="padding:4px 0;">' + escapeHtml(svc) + '</td></tr>' +
            (usd ? '<tr><td style="padding:4px 12px 4px 0;color:#475569;">Amount</td><td style="padding:4px 0;">' + escapeHtml(usd) + (btc ? ' <span style="color:#64748b;">(' + escapeHtml(String(btc)) + ' BTC)</span>' : '') + '</td></tr>' : '') +
            (paid_at ? '<tr><td style="padding:4px 12px 4px 0;color:#475569;">Paid</td><td style="padding:4px 0;">' + escapeHtml(paid_at) + '</td></tr>' : '') +
            (txid ? '<tr><td style="padding:4px 12px 4px 0;color:#475569;">Bitcoin TX</td><td style="padding:4px 0;"><a href="https://mempool.space/tx/' + escapeHtml(txid) + '" style="color:#0369a1;font-family:ui-monospace,SFMono-Regular,monospace;">' + escapeHtml(txid.slice(0, 12)) + '…</a></td></tr>' : '') +
          '</table>' +
          '<p style="margin:16px 0;"><a href="' + escapeHtml(envAppUrl()) + '/account" style="background:#0ea5e9;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;display:inline-block;font-weight:600;">Open your account</a></p>' +
          '<p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">— ZeusAI · Self-custody · BTC-first</p>' +
        '</div>'
    };
  },
  delivery_artifact: ({ orderId, serviceId, serviceName, artifactCount, deliveryUrl, artifacts }) => {
    const svc = serviceName || serviceId || 'your ZeusAI service';
    const url = deliveryUrl || (envAppUrl() + '/account?order=' + encodeURIComponent(orderId || ''));
    const count = Number(artifactCount) || (Array.isArray(artifacts) ? artifacts.length : 0) || 1;
    const list = Array.isArray(artifacts) ? artifacts.slice(0, 12) : [];
    const listText = list.length
      ? '\nIncluded artifacts:\n' + list.map((a) => '  - ' + (a.filename || a.title || a.kind || 'artifact')).join('\n') + '\n'
      : '';
    const listHtml = list.length
      ? '<ul style="margin:8px 0 16px;padding-left:20px;font-size:14px;">' +
          list.map((a) => '<li style="margin:2px 0;">' + escapeHtml(a.filename || a.title || a.kind || 'artifact') + '</li>').join('') +
        '</ul>'
      : '';
    return {
      subject: '📦 Delivery ready · ' + svc,
      text:
        'Your ZeusAI delivery is ready.\n\n' +
        'Order: ' + orderId + '\n' +
        'Service: ' + svc + '\n' +
        'Artifacts: ' + count + '\n' +
        listText +
        '\nDownload / open: ' + url + '\n\n' +
        'The link is bound to your account. Keep the order token safe — it is proof of purchase.\n\n' +
        '— ZeusAI · Self-custody · BTC-first',
      html:
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">' +
          '<h2 style="margin:0 0 12px;font-size:20px;">📦 Delivery ready · ' + escapeHtml(svc) + '</h2>' +
          '<p style="margin:0 0 12px;">Your delivery package for order <b>' + escapeHtml(orderId || '—') + '</b> is ready.</p>' +
          '<p style="margin:0 0 8px;">Included: <b>' + count + ' artifact' + (count === 1 ? '' : 's') + '</b>.</p>' +
          listHtml +
          '<p style="margin:16px 0;"><a href="' + escapeHtml(url) + '" style="background:#0ea5e9;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;display:inline-block;font-weight:600;">Open delivery package</a></p>' +
          '<p style="margin:16px 0 0;font-size:12px;color:#64748b;">The link is bound to your account. Keep your order token safe — it is proof of purchase.</p>' +
          '<p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">— ZeusAI · Self-custody · BTC-first</p>' +
        '</div>'
    };
  },
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
  // Brevo was formerly named Sendinblue; the SENDINBLUE_API_KEY env var is
  // still widely used in existing deployments, so accept both names.
  const apiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
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

function _realSecret(value) {
  const v = String(value || '').trim();
  if (!v || v.length < 8) return false;
  if (/^your_|^changeme$|^placeholder|^skip$|^xxx|^TODO/i.test(v)) return false;
  return true;
}

function configuredProviders() {
  const out = [];
  if (_realSecret(process.env.RESEND_API_KEY)) out.push('resend');
  if (_realSecret(process.env.BREVO_API_KEY) || _realSecret(process.env.SENDINBLUE_API_KEY)) out.push('brevo');
  if (_realSecret(process.env.MAILERSEND_API_KEY)) out.push('mailersend');
  if (nodemailer && _realSecret(process.env.SMTP_HOST) && _realSecret(process.env.SMTP_USER) && _realSecret(process.env.SMTP_PASS)) out.push('smtp');
  return out;
}

// Public helper — true when at least one transport (HTTPS or SMTP) is
// configured. Used by activation-readiness checks and by callers that want
// to short-circuit ("send if we can, otherwise skip cleanly").
function isConfigured() {
  return configuredProviders().length > 0;
}

async function sendTransactional({ to, template, data }) {
  if (!to) return { ok: false, error: 'missing_to' };
  const tpl = TEMPLATES[template];
  if (!tpl) return { ok: false, error: 'unknown_template' };
  const { subject, text, html } = tpl(data || {});
  const providers = configuredProviders();
  if (providers.length === 0) {
    // Fail-honest: nothing was sent. Callers must NOT treat this as success.
    return { ok: false, reason: 'email_unconfigured', skipped: 'unconfigured' };
  }

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

// sendRaw — send an ad-hoc subject/text/html (no template) via the same
// provider cascade. Used by owner alerts (new lead, funnel drop-off).
// Returns { ok:false, reason:'email_unconfigured' } when no transport is
// available (fail-honest — nothing was actually sent).
async function sendRaw({ to, subject, text, html }) {
  if (!to) return { ok: false, error: 'missing_to' };
  const providers = configuredProviders();
  if (providers.length === 0) {
    return { ok: false, reason: 'email_unconfigured', skipped: 'unconfigured' };
  }
  const order = [sendViaResend, sendViaBrevo, sendViaMailerSend, sendViaSmtp];
  const errors = [];
  for (const fn of order) {
    const r = await fn({ to, subject: subject || '(no subject)', text: text || '', html: html || null });
    if (r === null) continue;
    if (r.ok) return r;
    errors.push(r.provider + ': ' + (r.error || 'unknown'));
  }
  return { ok: false, error: errors.join(' | ') || 'all_providers_failed' };
}

module.exports = { sendTransactional, sendRaw, TEMPLATES, configuredProviders, isConfigured };
