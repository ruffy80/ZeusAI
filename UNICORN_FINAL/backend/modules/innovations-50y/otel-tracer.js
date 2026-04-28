// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.365Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * otel-tracer.js — Innovations 50Y · Pillar IV
 *
 * W3C Trace Context (traceparent / tracestate) compliant tracer with an
 * optional OTLP/HTTP exporter. ZERO required dependencies — uses only Node
 * built-ins. If `OTEL_EXPORTER_OTLP_ENDPOINT` env is set, completed spans
 * are POSTed as best-effort fire-and-forget JSON in OpenTelemetry's standard
 * resource/scope/spans envelope.
 *
 * Standards: W3C Trace Context Level 1 (2020), OpenTelemetry Protocol
 * (CNCF graduated). Output format is OTLP/JSON v1.0.0.
 *
 * Pure additive: never patches global http/https. Callers explicitly call
 * `withSpan` or `wrapHandler`. Existing modules are untouched.
 */

'use strict';

const crypto = require('crypto');

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'unicorn-final';
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || (() => {
  try { return require('../../../package.json').version; } catch (_) { return '0.0.0'; }
})();
const ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';

function _hex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function newTraceId() { return _hex(16); }
function newSpanId() { return _hex(8); }

/** Parse W3C traceparent: "00-<traceId>-<spanId>-<flags>". */
function parseTraceparent(header) {
  if (!header || typeof header !== 'string') return null;
  const m = header.match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
  if (!m) return null;
  return { version: m[1], traceId: m[2].toLowerCase(), spanId: m[3].toLowerCase(), flags: m[4] };
}

function buildTraceparent(traceId, spanId, sampled) {
  return '00-' + traceId + '-' + spanId + '-' + (sampled ? '01' : '00');
}

const COMPLETED = []; // ring buffer of last N spans (in-memory)
const MAX_BUFFER = 1024;

function _record(span) {
  COMPLETED.push(span);
  if (COMPLETED.length > MAX_BUFFER) COMPLETED.shift();
  if (ENDPOINT) _exportOtlp([span]).catch(() => {});
}

async function _exportOtlp(spans) {
  if (!ENDPOINT || !spans.length) return;
  // Convert ISO ms to nanoseconds (string per OTLP/JSON spec).
  const toNs = (ms) => String(BigInt(Math.floor(ms)) * 1000000n);
  const body = {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: SERVICE_NAME } },
          { key: 'service.version', value: { stringValue: SERVICE_VERSION } }
        ]
      },
      scopeSpans: [{
        scope: { name: 'unicorn-50y/otel-tracer', version: '1.0.0' },
        spans: spans.map(s => ({
          traceId: s.traceId,
          spanId: s.spanId,
          parentSpanId: s.parentSpanId || '',
          name: s.name,
          kind: s.kind || 1,
          startTimeUnixNano: toNs(s.startMs),
          endTimeUnixNano: toNs(s.endMs),
          attributes: Object.keys(s.attributes || {}).map(k => ({
            key: k, value: { stringValue: String(s.attributes[k]) }
          })),
          status: s.error ? { code: 2, message: String(s.error).slice(0, 256) } : { code: 0 }
        }))
      }]
    }]
  };
  try {
    const url = new URL(ENDPOINT.replace(/\/$/, '') + '/v1/traces');
    const lib = url.protocol === 'https:' ? require('https') : require('http');
    const json = JSON.stringify(body);
    await new Promise((resolve) => {
      const req = lib.request({
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(json)
        },
        timeout: 2000
      }, (res) => { res.on('data', () => {}); res.on('end', resolve); });
      req.on('error', resolve);
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} resolve(); });
      req.write(json); req.end();
    });
  } catch (_) { /* never throw from exporter */ }
}

/**
 * Run an async fn within a span; returns whatever fn returns.
 *   await withSpan('db.query', { 'db.system': 'sqlite' }, async (ctx) => {...})
 * `ctx` exposes `traceparent` so callers can propagate it on outbound HTTP.
 */
async function withSpan(name, attributes, fn, parentCtx) {
  const traceId = (parentCtx && parentCtx.traceId) || newTraceId();
  const spanId = newSpanId();
  const parentSpanId = (parentCtx && parentCtx.spanId) || '';
  const startMs = Date.now();
  const span = {
    traceId, spanId, parentSpanId, name: String(name || 'span'),
    kind: 1, attributes: Object.assign({}, attributes || {}),
    startMs, endMs: startMs, error: null
  };
  const ctx = {
    traceId, spanId, parentSpanId,
    traceparent: buildTraceparent(traceId, spanId, true),
    setAttribute(k, v) { span.attributes[k] = v; }
  };
  try {
    const out = await fn(ctx);
    span.endMs = Date.now();
    _record(span);
    return out;
  } catch (e) {
    span.endMs = Date.now();
    span.error = e && e.message ? e.message : String(e);
    _record(span);
    throw e;
  }
}

/**
 * Wrap an http(req,res) handler so each request becomes a span. Reads incoming
 * `traceparent` to continue the trace; injects `X-Trace-Id` and `traceparent`
 * on the response so SSE/JSON consumers can correlate.
 */
function wrapHandler(handler) {
  return async function tracedHandler(req, res) {
    const incoming = parseTraceparent(req.headers && req.headers.traceparent);
    const parentCtx = incoming ? { traceId: incoming.traceId, spanId: incoming.spanId } : null;
    return withSpan('http.request', {
      'http.method': req.method,
      'http.target': req.url,
      'net.peer.ip': (req.socket && req.socket.remoteAddress) || ''
    }, async (ctx) => {
      try {
        if (typeof res.setHeader === 'function') {
          res.setHeader('X-Trace-Id', ctx.traceId);
          res.setHeader('traceparent', ctx.traceparent);
        }
      } catch (_) {}
      // attach for downstream usage
      req._otelCtx = ctx;
      return handler(req, res);
    }, parentCtx).catch((e) => {
      try { if (!res.headersSent) { res.writeHead(500); res.end('internal'); } } catch (_) {}
      console.error('[otel-50y] handler error:', e && e.message);
    });
  };
}

function status() {
  return {
    serviceName: SERVICE_NAME,
    serviceVersion: SERVICE_VERSION,
    exporter: ENDPOINT ? { type: 'otlp/http+json', endpoint: ENDPOINT } : { type: 'in-memory-only' },
    bufferedSpans: COMPLETED.length,
    bufferLimit: MAX_BUFFER,
    standardsRef: ['W3C-TraceContext-1.0', 'OTLP-1.0.0', 'CNCF-OpenTelemetry']
  };
}

function recent(limit) {
  const n = Math.max(1, Math.min(Number(limit) || 50, MAX_BUFFER));
  return COMPLETED.slice(-n);
}

module.exports = {
  newTraceId, newSpanId, parseTraceparent, buildTraceparent,
  withSpan, wrapHandler, status, recent
};
