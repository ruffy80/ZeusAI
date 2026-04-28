// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/dashboard.js
//
// Server-rendered HTML dashboard for the marketing pack. Single inline
// HTML string (no frontend framework), styled inline. Token-gated by
// callers (the dispatcher checks AUDIT_50Y_TOKEN before invoking).
// =====================================================================

'use strict';

const metrics = require('./metrics');

const DISABLED = process.env.MARKETING_DASHBOARD_DISABLED === '1';

function _esc(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;' })[c]);
}

function render() {
  if (DISABLED) return '<!doctype html><meta charset="utf-8"><title>Disabled</title><p>Dashboard disabled.</p>';
  const snap = metrics.snapshot();
  const m = snap.metrics || {};
  const rows = Object.entries(m).map(([k, v]) =>
    `<tr><td style="padding:8px 16px;border-bottom:1px solid #2a2540;">${_esc(k)}</td>`
    + `<td style="padding:8px 16px;border-bottom:1px solid #2a2540;color:#ffd700;font-family:monospace;text-align:right;">${_esc(String(v))}</td></tr>`
  ).join('\n');
  const ts = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unicorn Marketing Dashboard</title>
  <style>
    body { background:#0b0b1a;color:#fff;font-family:Inter,system-ui,-apple-system,sans-serif;margin:0;padding:32px;}
    h1 { color:#ff5dff;margin:0 0 8px;}
    .ts { color:#aaa;font-size:13px;margin-bottom:24px;}
    table { border-collapse:collapse;background:#161228;border-radius:8px;overflow:hidden;}
    th { text-align:left;padding:12px 16px;background:#1f1838;color:#ddd;font-weight:600;}
    .footer { margin-top:24px;font-size:12px;color:#666; }
  </style>
</head>
<body>
  <h1>Unicorn Marketing Dashboard</h1>
  <div class="ts">Snapshot @ ${_esc(ts)}</div>
  <table>
    <thead><tr><th>Metric</th><th style="text-align:right;">Value</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <div class="footer">Server-rendered. Auto-refresh: <a href="?" style="color:#ff5dff;">reload</a>.</div>
</body>
</html>`;
}

function status() { return { disabled: DISABLED }; }

module.exports = { render, status };
