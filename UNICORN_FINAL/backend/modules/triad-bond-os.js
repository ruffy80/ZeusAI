'use strict';

/**
 * triad-bond-os.js — Triad Never-Down Bond OS (TBOS/1.0)
 * =====================================================
 * Site (:3001) + Unicorn (:3000) + Server edge (nginx forever-key / integrity)
 * scored as ONE organism that must never silently split.
 *
 * Innovations:
 *   1. Triple-peer never-down bond — site · unicorn · server edge
 *   2. Forever-key edge attestation — 403 = server plane failed (not site code)
 *   3. Soft-heal observe-only — suggest nginx self-heal / autoheal-min, never PM2
 *
 * Hard safety:
 *   - Observe / score only — no armSafe, no process.exit, no PM2 from this module
 *   - Respect DISABLE_SELF_MUTATION=1 + Boot Immortal stable idle
 *   - Never invent payment rails
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PROTOCOL = 'TBOS/1.0';
const NAME = 'triad-bond-os';

const CACHE_MS = Math.max(2000, parseInt(process.env.TBOS_CACHE_MS || '8000', 10) || 8000);
const PROBE_MS = Math.max(400, parseInt(process.env.TBOS_PROBE_MS || '2000', 10) || 2000);

let _cache = { ts: 0, status: null };

function safeRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function gradeFor(score) {
  if (score >= 92) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function siteHealthUrl() {
  return String(process.env.SITE_HEALTH_URL || process.env.UNICORN_SITE_HEALTH || 'http://127.0.0.1:3001/health').trim();
}

function unicornHealthUrl() {
  const fromEnv = process.env.UNICORN_HEALTH_URL || process.env.BACKEND_HEALTH_URL || '';
  if (fromEnv) return String(fromEnv).trim();
  const origin = String(process.env.BACKEND_API_URL || process.env.BACKEND_ORIGIN || 'http://127.0.0.1:3000')
    .replace(/\/$/, '')
    .replace(/\/api$/i, '');
  return `${origin}/api/health`;
}

function foreverKeyUrl() {
  if (process.env.FOREVER_KEY_URL) return String(process.env.FOREVER_KEY_URL).trim();
  const pub = String(process.env.PUBLIC_URL || process.env.APP_URL || 'https://zeusai.pro').replace(/\/$/, '');
  return `${pub}/.well-known/zeusai-key.pub`;
}

function integrityUrl() {
  if (process.env.INTEGRITY_URL) return String(process.env.INTEGRITY_URL).trim();
  const pub = String(process.env.PUBLIC_URL || process.env.APP_URL || 'https://zeusai.pro').replace(/\/$/, '');
  return `${pub}/integrity.json`;
}

function probeRaw(url, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const t0 = Date.now();
    const done = (payload) => {
      if (settled) return;
      settled = true;
      if (payload.latencyMs == null) payload.latencyMs = Date.now() - t0;
      resolve(payload);
    };
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search || ''}`,
        method: 'GET',
        timeout: timeoutMs,
        headers: { Accept: '*/*', 'Cache-Control': 'no-store', Connection: 'close' },
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let body = null;
          try { body = raw ? JSON.parse(raw) : null; } catch (_) { body = null; }
          done({
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            code: res.statusCode || 0,
            raw: raw.slice(0, 400),
            body,
            error: null,
          });
        });
      });
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} done({ ok: false, code: 0, raw: '', body: null, error: 'timeout' }); });
      req.on('error', (e) => done({ ok: false, code: 0, raw: '', body: null, error: String(e && e.message || e).slice(0, 120) }));
      req.end();
    } catch (e) {
      done({ ok: false, code: 0, latencyMs: 0, raw: '', body: null, error: String(e && e.message || e).slice(0, 120) });
    }
  });
}

function probeJsonSyncCached(url, timeoutMs) {
  if (!global.__TBOS_PEER_CACHE) global.__TBOS_PEER_CACHE = Object.create(null);
  const bag = global.__TBOS_PEER_CACHE;
  const now = Date.now();
  const hit = bag[url];
  if (hit && (now - hit.ts) < CACHE_MS) return hit.result;
  if (!hit || !hit.inFlight) {
    const entry = hit || { ts: 0, result: { ok: false, code: 0, latencyMs: 0, raw: '', body: null, error: 'cold' }, inFlight: false };
    entry.inFlight = true;
    bag[url] = entry;
    const t0 = Date.now();
    probeRaw(url, timeoutMs).then((result) => {
      result.latencyMs = result.latencyMs != null ? result.latencyMs : (Date.now() - t0);
      bag[url] = { ts: Date.now(), result, inFlight: false };
    }).catch((e) => {
      bag[url] = {
        ts: Date.now(),
        result: { ok: false, code: 0, latencyMs: Date.now() - t0, raw: '', body: null, error: String(e && e.message || e).slice(0, 120) },
        inFlight: false,
      };
    });
  }
  return bag[url].result;
}

function isHealthBodyOk(body) {
  return !!(body && (body.ok === true || body.status === 'ok' || body.status === 'healthy'));
}

function isForeverKeyOk(probe) {
  if (!probe || !probe.ok) return false;
  const raw = String(probe.raw || '');
  if (/BEGIN PUBLIC KEY/.test(raw)) return true;
  if (probe.body && (probe.body.publicKeyPem || probe.body.alg === 'Ed25519')) return true;
  return false;
}

function isIntegrityOk(probe) {
  if (!probe || !probe.ok) return false;
  const p = probe.body && (probe.body.payload || probe.body);
  return !!(p && (p.version || p.site || probe.body.signature));
}

function composeStatus(siteP, uniP, keyP, integP, urls) {
  const boot = safeRequire('./boot-immortal-os');
  const stable = boot && typeof boot.isStableProfile === 'function' ? boot.isStableProfile() : false;
  const mutatorsOff = String(process.env.ENABLE_FILE_MUTATORS || '0') !== '1'
    && String(process.env.DISABLE_SELF_MUTATION || '') === '1';

  const siteOk = !!(siteP && siteP.ok && isHealthBodyOk(siteP.body));
  const uniOk = !!(uniP && uniP.ok && isHealthBodyOk(uniP.body));
  const keyOk = isForeverKeyOk(keyP);
  const integOk = isIntegrityOk(integP);
  // Edge plane is green if forever-key OR integrity responds — but BONDED
  // requires forever-key specifically (known nginx 403 regression class).
  const serverOk = keyOk || integOk;

  // Prefer SUBOS bond when available for sync detail
  let syncScore = 50;
  let syncDetail = 'sync unknown';
  try {
    const subos = safeRequire('./site-unicorn-bond-os');
    const st = subos && typeof subos.getStatus === 'function' ? subos.getStatus() : null;
    if (st && st.sync) {
      syncScore = Number(st.sync.score) || syncScore;
      syncDetail = st.sync.detail || syncDetail;
    }
  } catch (_) { /* optional */ }
  if (siteP && siteP.body && siteP.body.unicornSync) {
    const m = siteP.body.unicornSync.modulesMirror || {};
    const bridge = siteP.body.unicornSync.eventBridge === true;
    const upstream = m.upstreamConnected === true;
    syncScore = (upstream ? 50 : 0) + (bridge ? 30 : 0) + ((Number(m.count) || 0) > 0 ? 20 : 0);
    syncDetail = `mirror=${upstream ? 'up' : 'down'}·bridge=${bridge ? 'on' : 'off'}`;
  }

  const liveCount = (siteOk ? 1 : 0) + (uniOk ? 1 : 0) + (serverOk ? 1 : 0);
  let triadScore = Math.round((liveCount / 3) * 100);
  // Soft penalty if forever-key specifically 403 (known nginx deny regression)
  if (!keyOk && integOk) triadScore = Math.min(triadScore, 78);
  if (keyP && keyP.code === 403) triadScore = Math.min(triadScore, 72);

  const blend = clamp(Math.round(triadScore * 0.75 + syncScore * 0.25), 0, 100);
  const grade = gradeFor(blend);
  // Forever-key is mandatory for bonded — integrity alone must not hide nginx 403.
  const bonded = siteOk && uniOk && keyOk;
  const stableIdleOk = !!(stable && mutatorsOff && bonded);

  const next = [];
  if (!uniOk) next.push('Unicorn peer dark — restore backend /api/health (autoheal-min owns PM2)');
  if (!siteOk) next.push('Site peer dark — restore SSR /health on :3001');
  if (!keyOk && keyP && keyP.code === 403) {
    next.push('Forever-key 403 — nginx deny; ensure exact location = /.well-known/zeusai-key.pub → :3001');
  } else if (!serverOk) {
    next.push('Server edge dark — forever-key / integrity unreachable through nginx');
  }
  if (bonded && stableIdleOk) next.push('Triad green under stable — keep DISABLE_SELF_MUTATION=1; leave restarts to autoheal-min');
  if (!next.length) next.push('Hold triad · observe-only · never thrash PM2 from TBOS');

  return {
    ok: bonded && blend >= 55,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'triad-bond-os',
    score: blend,
    grade,
    bonded,
    stableIdleOk,
    profile: boot && typeof boot.runtimeProfile === 'function'
      ? boot.runtimeProfile()
      : String(process.env.UNICORN_RUNTIME_PROFILE || ''),
    peers: {
      site: {
        ok: siteOk,
        url: urls.site,
        code: siteP && siteP.code,
        latencyMs: siteP && siteP.latencyMs,
        error: siteP && siteP.error,
        degraded: !!(siteP && siteP.body && (siteP.body.degraded === true || (siteP.body.backend && siteP.body.backend.ok === false))),
      },
      unicorn: {
        ok: uniOk,
        url: urls.unicorn,
        code: uniP && uniP.code,
        latencyMs: uniP && uniP.latencyMs,
        error: uniP && uniP.error,
        neverDown: uniP && uniP.body && uniP.body.neverDown ? uniP.body.neverDown : null,
      },
      server: {
        ok: serverOk,
        foreverKeyOk: keyOk,
        foreverKeyUrl: urls.foreverKey,
        foreverKeyCode: keyP && keyP.code,
        integrityOk: integOk,
        integrityUrl: urls.integrity,
        integrityCode: integP && integP.code,
        error: (!keyOk && keyP && keyP.error) || (!serverOk ? 'edge_dark' : null),
      },
    },
    sync: { score: syncScore, detail: syncDetail },
    continuum: {
      live: liveCount,
      degraded: 3 - liveCount,
    },
    pillars: [
      {
        id: 'site_peer', name: 'site_peer', pass: siteOk, ok: siteOk, weight: 34,
        score: siteOk ? 100 : 0,
        detail: siteOk ? 'site /health breathing' : `site down: ${(siteP && (siteP.error || siteP.code)) || '?'}`,
      },
      {
        id: 'unicorn_peer', name: 'unicorn_peer', pass: uniOk, ok: uniOk, weight: 34,
        score: uniOk ? 100 : 0,
        detail: uniOk ? 'unicorn /api/health breathing' : `unicorn down: ${(uniP && (uniP.error || uniP.code)) || '?'}`,
      },
      {
        id: 'server_edge', name: 'server_edge', pass: serverOk, ok: serverOk, weight: 32,
        score: serverOk ? (keyOk ? 100 : 80) : 0,
        detail: keyOk
          ? 'forever-key PEM served through nginx'
          : (integOk ? 'integrity ok · forever-key still dark' : `edge down key=${(keyP && keyP.code) || '?'} integ=${(integP && integP.code) || '?'}`),
      },
    ],
    innovations: [
      'triple_peer_never_down_bond',
      'forever_key_edge_attestation',
      'soft_heal_observe_only',
    ],
    doctrine: {
      line: 'Site · Unicorn · Server must all breathe — one dark peer fails the triad',
      heal: 'Observe/attest only — nginx self-heal + autoheal-min own restarts; TBOS never PM2',
      mutators: 'DISABLE_SELF_MUTATION=1 under stable is success, not failure',
    },
    softHeal: bonded
      ? { action: 'none', note: 'Triad intact' }
      : {
          action: !keyOk && keyP && keyP.code === 403
            ? 'nginx_append_forever_key_location'
            : 'reprobe_triad_peers',
          note: 'Run nginx-patch-public-discovery self-heal; autoheal-min for PM2; never thrash from TBOS',
        },
    next,
    links: {
      triad: '/api/autonomy/triad',
      score: '/api/autonomy/triad/score',
      wellKnown: '/.well-known/triad-bond.json',
      bond: '/api/autonomy/bond',
      neural: '/api/autonomy/neural',
      foreverKey: '/.well-known/zeusai-key.pub',
      statusPage: '/status',
    },
    timestamp: new Date().toISOString(),
  };
}

async function senseAsync() {
  const urls = {
    site: siteHealthUrl(),
    unicorn: unicornHealthUrl(),
    foreverKey: foreverKeyUrl(),
    integrity: integrityUrl(),
  };
  const [site, unicorn, key, integ] = await Promise.all([
    probeRaw(urls.site, PROBE_MS),
    probeRaw(urls.unicorn, PROBE_MS),
    probeRaw(urls.foreverKey, PROBE_MS),
    probeRaw(urls.integrity, PROBE_MS),
  ]);
  if (!global.__TBOS_PEER_CACHE) global.__TBOS_PEER_CACHE = Object.create(null);
  const now = Date.now();
  for (const [u, r] of [[urls.site, site], [urls.unicorn, unicorn], [urls.foreverKey, key], [urls.integrity, integ]]) {
    global.__TBOS_PEER_CACHE[u] = { ts: now, result: r, inFlight: false };
  }
  return composeStatus(site, unicorn, key, integ, urls);
}

function getStatus() {
  const now = Date.now();
  if (_cache.status && (now - _cache.ts) < CACHE_MS) return _cache.status;

  const urls = {
    site: siteHealthUrl(),
    unicorn: unicornHealthUrl(),
    foreverKey: foreverKeyUrl(),
    integrity: integrityUrl(),
  };

  if (process.env.NODE_ENV === 'test' && process.env.TBOS_FORCE_LIVE !== '1') {
    const st = composeStatus(
      {
        ok: true, code: 200, latencyMs: 1,
        body: { ok: true, status: 'healthy', backend: { ok: true }, unicornSync: { modulesMirror: { upstreamConnected: true, count: 10 }, eventBridge: true } },
        raw: '', error: null,
      },
      {
        ok: true, code: 200, latencyMs: 1,
        body: { ok: true, status: 'ok', neverDown: { protocol: 'NDK/1.0', health: 'good', neverKill: true } },
        raw: '', error: null,
      },
      { ok: true, code: 200, latencyMs: 1, raw: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----', body: null, error: null },
      { ok: true, code: 200, latencyMs: 1, body: { payload: { version: 'test', site: 'unicorn-v2' }, signature: 'x' }, raw: '', error: null },
      urls
    );
    st.testSynthetic = true;
    _cache = { ts: now, status: st };
    return st;
  }

  const site = probeJsonSyncCached(urls.site, PROBE_MS);
  const unicorn = probeJsonSyncCached(urls.unicorn, PROBE_MS);
  const key = probeJsonSyncCached(urls.foreverKey, PROBE_MS);
  const integ = probeJsonSyncCached(urls.integrity, PROBE_MS);
  const st = composeStatus(site, unicorn, key, integ, urls);
  _cache = { ts: now, status: st };
  return st;
}

function getScore() {
  const st = getStatus();
  return {
    ok: st.ok,
    protocol: PROTOCOL,
    score: st.score,
    grade: st.grade,
    bonded: st.bonded,
    stableIdleOk: st.stableIdleOk,
    continuum: st.continuum,
  };
}

function sense() {
  return getStatus();
}

module.exports = {
  PROTOCOL,
  NAME,
  getStatus,
  getScore,
  sense,
  senseAsync,
  gradeFor,
  composeStatus,
  foreverKeyUrl,
  siteHealthUrl,
  unicornHealthUrl,
};
