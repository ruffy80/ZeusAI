// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-29T16:15:58.685Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// recovery-orchestrator.js
// Detectează pattern-uri de erori recurente și rulează auto-repair + raportare

'use strict';

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const METRICS_FILE = path.join(__dirname, '../../data/metrics-log.json');
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'vladoi_ionut@yahoo.com';

function detectAndRepair() {
  let metrics = [];
  try { if (fs.existsSync(METRICS_FILE)) metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')); } catch {}
  const recent = metrics.slice(-50);
  const errors = recent.filter(m => m.type === 'error' && m.value > 0);
  if (errors.length > 10) {
    // Rulează auto-repair (ex: restart unicorn, clear cache)
    try { require('child_process').execSync('pm2 restart unicorn'); } catch {}
    try { require('./ai-smart-cache').clear(); } catch {}
    sendReport(errors.length);
  }
}

function sendReport(errorCount) {
  const transporter = nodemailer.createTransport({ sendmail: true });
  transporter.sendMail({
    from: OWNER_EMAIL,
    to: OWNER_EMAIL,
    subject: '[UNICORN] Recovery Orchestration Triggered',
    text: `Au fost detectate ${errorCount} erori recurente. S-a rulat auto-repair (restart unicorn, clear cache).`
  }, (err) => {
    if (err) console.warn('[recovery-orchestrator] email failed:', err.message);
  });
}

setInterval(detectAndRepair, 180000); // verifică la 3 min

module.exports = { detectAndRepair };
