// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:53:50.298Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:49:07.872Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:43:56.555Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:34:58.197Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.205Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.065Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.578Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.109Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.414Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.168Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.260Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.121Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.771Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.951Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * Email service – wraps nodemailer with a simple helper.
 * Falls back to console logging when SMTP credentials are not configured.
 */

'use strict';

const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Zeus AI';
const FROM_EMAIL = process.env.SMTP_USER || process.env.ADMIN_EMAIL || 'noreply@zeusai.pro';
const APP_URL = process.env.PUBLIC_APP_URL || 'https://zeusai.pro';

function isConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.log(`[Email MOCK] to=${to} subject="${subject}"`);
    return { mock: true };
  }
  return getTransporter().sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });
}

async function sendVerificationEmail(user, token) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return sendMail({
    to: user.email,
    subject: 'Confirmă adresa de email – Zeus AI',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#22d3ee">Bun venit, ${user.name}! 👋</h2>
        <p>Confirmă adresa ta de email apăsând butonul de mai jos:</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#22d3ee;color:#000;text-decoration:none;border-radius:8px;font-weight:700">
          Verifică Email
        </a>
        <p style="color:#666;margin-top:24px">Linkul expiră în 24 de ore.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#999;font-size:12px">Zeus AI · zeusai.pro</p>
      </div>`,
    text: `Confirmă emailul: ${link}`,
  });
}

async function sendPasswordResetEmail(user, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return sendMail({
    to: user.email,
    subject: 'Resetare parolă – Zeus AI',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#f59e0b">Resetare parolă 🔐</h2>
        <p>Ai cerut resetarea parolei pentru contul <b>${user.email}</b>.</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#000;text-decoration:none;border-radius:8px;font-weight:700">
          Resetează Parola
        </a>
        <p style="color:#666;margin-top:24px">Linkul expiră în 1 oră. Dacă nu ai cerut resetarea, ignoră acest email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#999;font-size:12px">Zeus AI · zeusai.pro</p>
      </div>`,
    text: `Resetează parola: ${link}`,
  });
}

async function sendWelcomeEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Contul tău Zeus AI este activ 🎉',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#a855f7">Contul tău este activ! 🦄</h2>
        <p>Salut <b>${user.name}</b>,</p>
        <p>Contul tău Zeus AI a fost confirmat cu succes. Poți acum accesa platforma completă:</p>
        <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 28px;background:linear-gradient(90deg,#22d3ee,#a855f7);color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
          Deschide Dashboard
        </a>
        <p style="color:#666;margin-top:24px">Explorează marketplace-ul, modulele AI și comenzile autonome.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#999;font-size:12px">Zeus AI · zeusai.pro</p>
      </div>`,
    text: `Contul tău Zeus AI este activ. Accesează: ${APP_URL}/dashboard`,
  });
}

async function sendPaymentConfirmation(user, payment) {
  const planLabel = { free: 'Free', starter: 'Starter ($29/lună)', pro: 'Pro ($99/lună)', enterprise: 'Enterprise ($499/lună)' };
  const isSubscription = Boolean(payment.planId);
  const subject = isSubscription
    ? `Abonament ${planLabel[payment.planId] || payment.planId} activat – Zeus AI 🎉`
    : `Plată confirmată – Zeus AI ✅`;
  const body = isSubscription
    ? `<p>Abonamentul tău <b>${planLabel[payment.planId] || payment.planId}</b> a fost activat cu succes!</p>`
    : `<p>Plata ta de <b>$${Number(payment.amount || 0).toFixed(2)}</b> (${payment.method || ''}) a fost confirmată.</p>`;
  return sendMail({
    to: user.email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#22d3ee">✅ ${subject}</h2>
        <p>Salut <b>${user.name}</b>,</p>
        ${body}
        <a href="${APP_URL}/dashboard-client" style="display:inline-block;padding:12px 28px;background:linear-gradient(90deg,#22d3ee,#a855f7);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;margin-top:8px">
          Deschide Dashboard
        </a>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#999;font-size:12px">Zeus AI · zeusai.pro</p>
      </div>`,
    text: subject + ' - ' + APP_URL + '/dashboard-client',
  });
}

module.exports = {
  isConfigured,
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPaymentConfirmation,
};
