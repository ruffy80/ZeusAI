// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-29T16:15:58.684Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// observability.js
// Modul pentru colectare metrici, alertare și dashboard live

'use strict';

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const METRICS_FILE = path.join(__dirname, '../../data/metrics-log.json');
const ALERT_EMAIL = process.env.OWNER_EMAIL || 'vladoi_ionut@yahoo.com';

let lastAlert = 0;

function logMetric(type, value) {
  let metrics = [];
  try { if (fs.existsSync(METRICS_FILE)) metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')); } catch {}
  metrics.push({ ts: Date.now(), type, value });
  if (metrics.length > 1000) metrics = metrics.slice(-1000);
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
}

function getMetrics() {
  try { if (fs.existsSync(METRICS_FILE)) return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')); } catch {}
  return [];
}

function checkAnomalies() {
  const metrics = getMetrics();
  const recent = metrics.slice(-20);
  // Exemplu: alertă dacă latency > 2s sau error rate > 5 în ultimele 20
  const highLatency = recent.filter(m => m.type === 'latency' && m.value > 2000).length;
  const errors = recent.filter(m => m.type === 'error').length;
  if ((highLatency > 5 || errors > 5) && Date.now() - lastAlert > 600000) {
    sendAlert(`ALERT: High latency (${highLatency}) or errors (${errors}) detected!`);
    lastAlert = Date.now();
  }
}

function sendAlert(msg) {
  // Email alert (poate fi extins cu Telegram)
  const transporter = nodemailer.createTransport({ sendmail: true });
  transporter.sendMail({ from: ALERT_EMAIL, to: ALERT_EMAIL, subject: '[UNICORN] Observability Alert', text: msg }, (err) => {
    if (err) console.warn('[observability] alert email failed:', err.message);
  });
}

setInterval(checkAnomalies, 120000); // verifică la 2 min

module.exports = { logMetric, getMetrics };
