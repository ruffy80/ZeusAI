// commerce/notifier.js
// Owner notifier: append-only JSONL log + optional SMTP via nodemailer when configured.
// Never throws; all transports are best-effort.
//
// notifyOwner({subject, body, priority?}) → Promise<{ok, channels:[]}>

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.UNICORN_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'notifications.jsonl');

function ensureDir() { try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }); } catch (_) {} }

let _transporter = null;
function getTransporter() {
  if (_transporter !== null) return _transporter || null;
  if (!process.env.SMTP_HOST) { _transporter = false; return null; }
  try {
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === '1' || Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined
    });
    return _transporter;
  } catch (e) {
    console.warn('[notifier] SMTP transport unavailable:', e.message);
    _transporter = false;
    return null;
  }
}

async function notifyOwner(event) {
  const evt = {
    ts: new Date().toISOString(),
    subject: String((event && event.subject) || '(no subject)').slice(0, 200),
    body: String((event && event.body) || '').slice(0, 5000),
    priority: String((event && event.priority) || 'normal'),
    channels: []
  };
  ensureDir();
  try { fs.appendFileSync(LOG_FILE, JSON.stringify(evt) + '\n'); evt.channels.push('jsonl'); } catch (e) { console.warn('[notifier] jsonl append failed:', e.message); }

  const t = getTransporter();
  const to = process.env.OWNER_EMAIL || process.env.SMTP_TO;
  const from = process.env.SMTP_FROM || process.env.OWNER_EMAIL;
  if (t && to && from) {
    try {
      await t.sendMail({ from, to, subject: evt.subject, text: evt.body });
      evt.channels.push('smtp');
    } catch (e) {
      console.warn('[notifier] smtp send failed:', e.message);
    }
  }
  return { ok: true, channels: evt.channels };
}

module.exports = { notifyOwner };
