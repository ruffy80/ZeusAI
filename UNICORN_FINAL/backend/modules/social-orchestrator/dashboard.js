// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-08T18:04:07.242Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function moduleColor(state) {
  if (state === 'active') return '#7cf7c0';
  if (state === 'degraded') return '#f0c674';
  return '#ff6b6b';
}

function renderAdminSocialNetwork(data = {}) {
  const modules = Array.isArray(data.modules) ? data.modules : [];
  const decisions = Array.isArray(data.decisions) ? data.decisions.slice(0, 20) : [];
  const topCreators = Array.isArray(data.topCreators) ? data.topCreators.slice(0, 10) : [];
  const viral = Array.isArray(data.topViral) ? data.topViral.slice(0, 10) : [];

  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<title>Admin · ZEUS NETWORK</title>',
    '<style>body{font-family:Inter,system-ui;background:#090d18;color:#e8eefc;margin:0;padding:24px}h1,h2{margin:0 0 10px}.muted{color:#9eb0d0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.card{background:#11192b;border:1px solid #263453;border-radius:12px;padding:14px}.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}.pill{display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;background:#1b2742}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #243454;padding:8px;text-align:left}</style>',
    '</head><body>',
    '<h1>ZEUS NETWORK · Admin Dashboard</h1>',
    '<div class="muted">Passive view only · orchestrator decisions, module states, growth and profit streams.</div>',
    '<div class="grid" style="margin-top:14px">',
    `<div class="card"><div class="muted">Mode</div><div style="font-size:22px">${esc(data.mode || 'dry-run')}</div><div class="mono">dry-run until: ${esc(data.dryRunUntil || 'n/a')}</div></div>`,
    `<div class="card"><div class="muted">Profit (BTC/day)</div><div style="font-size:22px">${esc(data.profitBtcDay == null ? '0' : data.profitBtcDay)}</div><div class="mono">USD/day: ${esc(data.profitUsdDay == null ? '0' : data.profitUsdDay)}</div></div>`,
    `<div class="card"><div class="muted">Users growth 24h</div><div style="font-size:22px">${esc(data.userGrowthPct24h == null ? '0' : data.userGrowthPct24h)}%</div><div class="mono">active users: ${esc(data.activeUsers == null ? '0' : data.activeUsers)}</div></div>`,
    `<div class="card"><div class="muted">Health checks</div><div style="font-size:22px">${esc(data.healthRuns || 0)}</div><div class="mono">last: ${esc(data.lastHealthAt || 'n/a')}</div></div>`,
    '</div>',
    '<h2 style="margin-top:20px">Modules</h2><div class="grid">',
    modules.map((m) => `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><strong>${esc(m.name)}</strong><span class="pill" style="color:${moduleColor(m.state)}">${esc(m.state)}</span></div><div class="mono">last: ${esc(m.lastUpdate || 'n/a')}</div></div>`).join(''),
    '</div>',
    '<h2 style="margin-top:20px">Recent decisions</h2>',
    '<table><thead><tr><th>Time</th><th>Decision</th><th>Result</th></tr></thead><tbody>',
    decisions.map((d) => `<tr><td>${esc(d.ts)}</td><td>${esc(d.title || d.type || 'decision')}</td><td>${esc(d.result || d.status || 'logged')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No decisions yet</td></tr>',
    '</tbody></table>',
    '<h2 style="margin-top:20px">Top creators</h2>',
    '<table><thead><tr><th>Creator</th><th>Score</th></tr></thead><tbody>',
    topCreators.map((c) => `<tr><td>${esc(c.name || c.id)}</td><td>${esc(c.score || 0)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">No data</td></tr>',
    '</tbody></table>',
    '<h2 style="margin-top:20px">Top viral content</h2>',
    '<table><thead><tr><th>Post</th><th>Engagement</th></tr></thead><tbody>',
    viral.map((v) => `<tr><td>${esc(v.title || v.id)}</td><td>${esc(v.score || v.likes || 0)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">No data</td></tr>',
    '</tbody></table>',
    '</body></html>',
  ].join('');
}

module.exports = { renderAdminSocialNetwork };
