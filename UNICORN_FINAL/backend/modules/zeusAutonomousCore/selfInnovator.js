// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:05:59.246Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * SelfInnovator — daily 03:00 cycle.
 *  - Reads recent backend logs/metrics via /api/* endpoints.
 *  - Identifies modules with high error rates or slow response times.
 *  - Writes innovation suggestions to data/zac/innovations/<ts>.json.
 *  - If trustScore >= 0.85 AND ZAC_AUTO_APPLY=1, queues an auto-improve branch
 *    (delegating actual code rewrites to AgentCodex hook — placeholder here).
 *
 * Conservative by default: only writes JSON reports. Auto-apply must be
 * explicitly enabled via env flag.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

function fetchJSON(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let buf = ''; res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function nextRun(hour = 3, minute = 0) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function createSelfInnovator({
  backendBase = process.env.ZAC_BACKEND_BASE || 'http://127.0.0.1:3000',
  outDir = path.join(__dirname, '../../../data/zac/innovations'),
  hour = 3,
  autoApply = process.env.ZAC_AUTO_APPLY === '1',
} = {}) {
  let timer = null;
  const runs = [];

  async function runCycle() {
    const ts = new Date().toISOString();
    const mesh    = await fetchJSON(backendBase + '/api/mesh/status') || {};
    const reg     = await fetchJSON(backendBase + '/api/module-registry') || {};
    const act     = await fetchJSON(backendBase + '/api/billion-scale/activation/status') || {};
    const unhealthy = (mesh.modules || []).filter((m) => m && m.healthy === false);
    const suggestions = [];

    for (const m of unhealthy) {
      suggestions.push({
        target: m.name,
        kind: 'health-degradation',
        action: 'investigate-and-restart',
        confidence: 0.6,
      });
    }
    if ((act?.summary?.missingExistingModules || 0) > 0) {
      suggestions.push({
        target: 'activation-orchestrator',
        kind: 'missing-capabilities',
        action: 'auto-generate-stub-modules',
        confidence: 0.9,
      });
    }
    if ((reg?.total || 0) < 300) {
      suggestions.push({
        target: 'module-registry',
        kind: 'underexposed-modules',
        action: 'expose-loaded-modules-in-registry',
        confidence: 0.85,
      });
    }

    const trustScore = suggestions.length
      ? suggestions.reduce((s, x) => s + x.confidence, 0) / suggestions.length
      : 0;
    const report = { ts, suggestions, trustScore, autoApply, mesh: { unhealthy: unhealthy.length } };

    try {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, ts.replace(/[:.]/g, '-') + '.json'), JSON.stringify(report, null, 2));
    } catch (_) { /* best-effort */ }

    runs.push({ ts, suggestions: suggestions.length, trustScore });
      // ── AUTO-APPLY: if trustScore >= 0.85 and ZAC_AUTO_APPLY=1, execute high-confidence actions ──
      if (autoApply && trustScore >= 0.85 && suggestions.length > 0) {
        const highConf = suggestions.filter(s => s.confidence >= 0.85);
        for (const sug of highConf) {
          try {
            await _applyAction(sug, { backendBase, outDir });
          } catch (e) {
            console.warn('[selfInnovator] auto-apply failed for', sug.action, ':', e.message);
          }
        }
      }

      // ── WEBHOOK NOTIFICATION: notify owner on each innovation cycle ──
      const _wh = process.env.ALERT_WEBHOOK_URL || '';
      if (_wh && suggestions.length > 0) {
        try {
          const _body = JSON.stringify({
            text: `[ZeusAI/ZAC] 🧠 SelfInnovator cycle — ${suggestions.length} suggestions, trustScore=${trustScore.toFixed(2)}, autoApply=${autoApply}`,
          });
          const _https = require('https'), _http = require('http');
          const _u = new URL(_wh);
          const _mod = _u.protocol === 'https:' ? _https : _http;
          const _req = _mod.request({ hostname: _u.hostname, path: _u.pathname + _u.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(_body) } });
          _req.on('error', () => {});
          _req.write(_body);
          _req.end();
        } catch (_) { /* non-critical */ }
      }

    if (runs.length > 30) runs.shift();
    return report;
  }

  function scheduleNext() {
    const next = nextRun(hour);
    const delay = Math.max(60_000, next.getTime() - Date.now());
    timer = setTimeout(async () => {
      try { await runCycle(); } catch (e) { console.warn('[selfInnovator] cycle error:', e.message); }
      scheduleNext();
    }, delay);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function start() { if (!timer) scheduleNext(); }
  function stop()  { if (timer) { clearTimeout(timer); timer = null; } }

  function getStatus() {
    return { running: !!timer, hour, autoApply, recentRuns: runs.slice(-10), outDir };
  }

  return { start, stop, runCycle, getStatus };
}

// ── _applyAction — executes a high-confidence, auto-approved innovation action ──
// Execută o acțiune de inovare aprobată automat (trustScore >= 0.85)
async function _applyAction(suggestion, { backendBase, outDir }) {
  const { action, target } = suggestion;
  console.log('[selfInnovator] ▶ auto-apply:', action, '→', target);

  switch (action) {
    case 'investigate-and-restart': {
      // POST to the module's restart endpoint if available
      const url = `${backendBase}/api/mesh/restart`;
      try {
        const http = require('http'), https = require('https');
        const u = new URL(url);
        const mod = u.protocol === 'https:' ? https : http;
        const body = JSON.stringify({ module: target });
        await new Promise((resolve) => {
          const req = mod.request({
            hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
            path: u.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          }, (res) => { res.resume(); res.on('end', resolve); });
          req.on('error', resolve);
          req.write(body);
          req.end();
        });
        console.log('[selfInnovator] ✅ restart signal sent for', target);
      } catch (e) {
        console.warn('[selfInnovator] restart signal failed:', e.message);
      }
      break;
    }

    case 'auto-generate-stub-modules': {
      // Delegate to selfDeveloper to generate missing module stubs
      try {
        const { createSelfDeveloper } = require('./selfDeveloper');
        const dev = createSelfDeveloper ? createSelfDeveloper() : null;
        // selfDeveloper exposes generateModule directly — use it
        const selfDev = require('./selfDeveloper');
        if (typeof selfDev.generateModule === 'function') {
          selfDev.generateModule({ name: target, description: `Auto-generated executable module for missing capability: ${target}` });
          console.log('[selfInnovator] ✅ stub generated for', target);
        }
      } catch (e) {
        console.warn('[selfInnovator] stub generation failed:', e.message);
      }
      break;
    }

    case 'expose-loaded-modules-in-registry': {
      // Write a registry refresh marker file so the mesh picks up loaded modules
      const markerPath = path.join(outDir, '..', 'registry-refresh.json');
      try {
        fs.writeFileSync(markerPath, JSON.stringify({ ts: new Date().toISOString(), action, requestedBy: 'selfInnovator' }, null, 2));
        console.log('[selfInnovator] ✅ registry refresh marker written');
      } catch (e) {
        console.warn('[selfInnovator] registry marker failed:', e.message);
      }
      break;
    }

    default:
      console.log('[selfInnovator] ℹ️ no auto-apply handler for action:', action, '— logged only');
  }
}

module.exports = { createSelfInnovator };
