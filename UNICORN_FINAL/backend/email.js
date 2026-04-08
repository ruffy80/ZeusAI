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

module.exports = {
  isConfigured,
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
