'use strict';
/**
 * Site → Unicorn backend liveness monitor.
 *
 * Live 2026-09-09: site /health was degraded with lastCode=200, lastBodyOk=true,
 * reason=timeout. Node http.get timeout can fire AFTER a successful 200 JSON
 * body if the socket timeout is not cleared. Five such false timeouts flipped
 * the site to degraded while the backend was still serving /api/health.
 *
 * Rules:
 *   - Clear request timeout as soon as headers arrive
 *   - Ignore timeout once this ping already succeeded
 *   - Real timeouts still count toward the fail threshold
 */
function createBackendMonitor(opts) {
  const http2 = (opts && opts.http) || require('http');
  const timeoutMs = Math.max(3000, Number((opts && opts.timeoutMs) || process.env.UNICORN_BACKEND_MONITOR_TIMEOUT_MS || 8000));
  const failThreshold = Math.max(3, Number((opts && opts.failThreshold) || process.env.UNICORN_BACKEND_MONITOR_FAILS || 5));
  const target = (opts && opts.target) || process.env.UNICORN_SITE_INTERNAL_BACKEND || 'http://127.0.0.1:3000/api/health/live';
  const onDegraded = opts && opts.onDegraded;
  const onRecovered = opts && opts.onRecovered;

  const monitor = {
    fails: 0,
    ok: true,
    lastTs: 0,
    target,
    lastCode: null,
    lastBodyOk: null,
    reason: null,
  };

  function markFail(reason, code, bodyOk) {
    monitor.fails += 1;
    monitor.lastTs = Date.now();
    monitor.reason = reason || 'failure';
    if (Number.isFinite(code)) monitor.lastCode = code;
    if (typeof bodyOk === 'boolean') monitor.lastBodyOk = bodyOk;
    if (monitor.fails >= failThreshold && monitor.ok) {
      monitor.ok = false;
      if (typeof onDegraded === 'function') onDegraded(monitor);
    }
  }

  function ping() {
    let settled = false;
    let succeeded = false;

    function succeed(code, bodyOk) {
      if (settled && succeeded) return;
      settled = true;
      succeeded = true;
      monitor.fails = 0;
      monitor.reason = null;
      monitor.lastTs = Date.now();
      monitor.lastCode = Number.isFinite(code) ? code : monitor.lastCode;
      monitor.lastBodyOk = !!bodyOk;
      if (!monitor.ok && typeof onRecovered === 'function') onRecovered(monitor);
      monitor.ok = true;
    }

    function failOnce(reason, code, bodyOk) {
      if (succeeded) return; // late timeout after 200 JSON — not a failure
      if (settled) return;
      settled = true;
      markFail(reason, code, bodyOk);
    }

    let req;
    try {
      req = http2.get(target, { timeout: timeoutMs }, (r) => {
        try { if (req && typeof req.setTimeout === 'function') req.setTimeout(0); } catch (_) { /* ignore */ }
        monitor.lastTs = Date.now();
        monitor.lastCode = Number.isFinite(r.statusCode) ? r.statusCode : null;
        let chunks = '';
        r.setEncoding('utf8');
        r.on('data', (d) => {
          if (chunks.length < 2048) chunks += String(d || '');
        });
        r.on('end', () => {
          let bodyOk = false;
          try {
            const j = JSON.parse(chunks || '{}');
            bodyOk = !!(j && (j.ok === true || j.status === 'ok' || j.ready === true || j.live === true));
          } catch (_) { bodyOk = false; }
          monitor.lastBodyOk = bodyOk;
          const statusOk = r.statusCode >= 200 && r.statusCode < 400;
          if (statusOk && bodyOk) succeed(r.statusCode, true);
          else failOnce('status/body mismatch', r.statusCode, bodyOk);
        });
      });
      req.on('error', () => failOnce('request error'));
      req.on('timeout', () => {
        try { req.destroy(); } catch (_) { /* ignore */ }
        failOnce('timeout');
      });
    } catch (_) {
      markFail('exception');
    }
  }

  return { monitor, ping, timeoutMs, failThreshold };
}

function backendOkFromMonitor(mon) {
  const m = mon || {};
  if (m.ok) return true;
  // Race: timeout after a healthy 200 body must not paint the site degraded.
  if (m.lastBodyOk === true && Number(m.lastCode) >= 200 && Number(m.lastCode) < 400 && m.reason === 'timeout') {
    return true;
  }
  return false;
}

module.exports = { createBackendMonitor, backendOkFromMonitor };
