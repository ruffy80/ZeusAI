// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// =====================================================================
//
// ops-watchdog — periodic poll of ops-aggregator + deduplicated Discord
// notifications when status leaves 'green'. Designed to be the only
// outbound-alert path so we never spam during an incident.
//
// Behaviour:
//   • Polls collect() every WATCHDOG_INTERVAL_MS (default 60s).
//   • Sends a Discord webhook only when:
//       (a) status transitions green -> amber/red, OR
//       (b) status stays non-green and the dedup window has elapsed
//           (default 10 min), OR
//       (c) status returns to green from amber/red (recovery notice).
//   • Refuses to start if process.env.DISCORD_WEBHOOK is empty (silent).
//
// Toggle off with WATCHDOG_DISABLED=1.
'use strict';

const https = require('https');
const url = require('url');

const POLL_MS    = Number(process.env.WATCHDOG_INTERVAL_MS || 60000);
const DEDUP_MS   = Number(process.env.WATCHDOG_DEDUP_MS    || 600000);
const HOOK       = process.env.DISCORD_WEBHOOK || process.env.WATCHDOG_DISCORD_WEBHOOK || '';
const DISABLED   = String(process.env.WATCHDOG_DISABLED || '0') === '1';

let _state = {
  lastStatus: 'green',
  lastNotifiedAt: 0,
  lastSummary: null,
  active: false,
  timer: null,
  ticks: 0,
  notifications: 0,
};

function _postDiscord(payload) {
  return new Promise((resolve) => {
    if (!HOOK) return resolve({ ok: false, error: 'no_hook' });
    try {
      const u = url.parse(HOOK);
      const body = JSON.stringify(payload);
      const req = https.request({
        method: 'POST',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.path,
        timeout: 4000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, (res) => {
        res.resume();
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode });
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message }));
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} resolve({ ok: false, error: 'timeout' }); });
      req.write(body); req.end();
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

function _summarize(snapshot) {
  const heap = snapshot.heap || {};
  const pm2 = snapshot.pm2 || {};
  const qis = snapshot.qis || {};
  const lines = [];
  lines.push(`**ZeusAI ops watchdog** · status=**${snapshot.status}**`);
  if (snapshot.verdicts && snapshot.verdicts.length) lines.push(`verdicts: \`${snapshot.verdicts.join(', ')}\``);
  if (qis && qis.integrity) lines.push(`QIS integrity: \`${qis.integrity}\` · issues=${(qis.issues||[]).length}`);
  if (pm2 && pm2.available) {
    if (pm2.drifted && pm2.drifted.length) lines.push(`PM2 drift: \`${pm2.drifted.join(', ')}\``);
    if (pm2.offline && pm2.offline.length) lines.push(`PM2 offline: \`${pm2.offline.join(', ')}\``);
  }
  if (heap && heap.heapUsedMb) lines.push(`heap: ${heap.heapUsedMb}MB / ${heap.heapTotalMb}MB (${Math.round((heap.heapPct||0)*100)}%)`);
  if (snapshot.deploy && snapshot.deploy.buildSha) lines.push(`build: \`${String(snapshot.deploy.buildSha).slice(0,12)}\``);
  return lines.join('\n');
}

async function _tick() {
  _state.ticks++;
  let snapshot;
  try {
    const opsAggregator = require('../../src/modules/ops-aggregator');
    snapshot = await opsAggregator.collect();
  } catch (e) {
    snapshot = { status: 'unknown', verdicts: ['aggregator_error'], error: e.message };
  }

  const prev = _state.lastStatus;
  const now = Date.now();
  const summary = _summarize(snapshot);
  _state.lastSummary = summary;

  const transitionedToBad = prev === 'green' && snapshot.status !== 'green';
  const recovered          = prev !== 'green' && snapshot.status === 'green';
  const dedupElapsed       = (now - _state.lastNotifiedAt) >= DEDUP_MS;

  let shouldNotify = false;
  let title = '';
  if (transitionedToBad)             { shouldNotify = true; title = '⚠️ ZeusAI status degraded'; }
  else if (recovered)                { shouldNotify = true; title = '✅ ZeusAI status recovered'; }
  else if (snapshot.status !== 'green' && dedupElapsed) {
                                       shouldNotify = true; title = '⏱️ ZeusAI status still degraded'; }

  if (shouldNotify && HOOK) {
    const r = await _postDiscord({ content: `${title}\n${summary}` });
    if (r.ok) { _state.lastNotifiedAt = now; _state.notifications++; }
  }
  _state.lastStatus = snapshot.status;
}

function start() {
  if (DISABLED) { console.log('[ops-watchdog] disabled via WATCHDOG_DISABLED=1'); return; }
  if (!HOOK)    { console.log('[ops-watchdog] no DISCORD_WEBHOOK configured · running in passive mode'); }
  if (_state.active) return;
  _state.active = true;
  // Stagger initial tick to avoid thundering-herd at boot.
  setTimeout(() => { _tick().catch(() => {}); _state.timer = setInterval(() => _tick().catch(() => {}), POLL_MS); }, 15000);
  console.log(`[ops-watchdog] active · poll=${POLL_MS}ms dedup=${DEDUP_MS}ms hook=${HOOK ? 'set' : 'none'}`);
}

function stop() {
  if (_state.timer) clearInterval(_state.timer);
  _state.active = false;
  _state.timer = null;
}

function getStatus() {
  return {
    name: 'ops-watchdog',
    active: _state.active,
    ticks: _state.ticks,
    notifications: _state.notifications,
    lastStatus: _state.lastStatus,
    lastNotifiedAt: _state.lastNotifiedAt ? new Date(_state.lastNotifiedAt).toISOString() : null,
    pollMs: POLL_MS,
    dedupMs: DEDUP_MS,
    webhookConfigured: !!HOOK,
  };
}

module.exports = { start, stop, getStatus, _summarize };
