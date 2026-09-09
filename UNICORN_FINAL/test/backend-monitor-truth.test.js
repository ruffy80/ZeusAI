'use strict';

/**
 * backend-monitor-truth.test.js
 * Site must not paint degraded when Unicorn answered 200 JSON and a late
 * socket timeout races the same ping (live 2026-09-09: lastCode=200,
 * lastBodyOk=true, reason=timeout, site /health ok:false).
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { createBackendMonitor, backendOkFromMonitor } = require('../src/lib/backend-monitor');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

function mockIncoming(statusCode, body) {
  const incoming = new EventEmitter();
  incoming.statusCode = statusCode;
  incoming.setEncoding = function () {};
  incoming._body = body;
  return incoming;
}

function mockReq() {
  const req = new EventEmitter();
  req.setTimeout = function () {};
  req.destroy = function () { req.destroyed = true; };
  return req;
}

check('healthy 200 JSON keeps monitor.ok and clears fails', () => {
  const incoming = mockIncoming(200, '{"ok":true,"status":"ok","live":true}');
  const req = mockReq();
  const http = {
    get(_url, _opts, cb) {
      cb(incoming);
      incoming.emit('data', incoming._body);
      incoming.emit('end');
      return req;
    },
  };
  const { monitor, ping } = createBackendMonitor({
    http,
    timeoutMs: 8000,
    failThreshold: 5,
    target: 'http://127.0.0.1:3000/api/health/live',
  });
  ping();
  assert.strictEqual(monitor.ok, true);
  assert.strictEqual(monitor.fails, 0);
  assert.strictEqual(monitor.lastCode, 200);
  assert.strictEqual(monitor.lastBodyOk, true);
  assert.strictEqual(monitor.reason, null);
  assert.strictEqual(backendOkFromMonitor(monitor), true);
});

check('timeout after successful 200 does not increment fails', () => {
  const incoming = mockIncoming(200, '{"ok":true,"ready":true}');
  const req = mockReq();
  const http = {
    get(_url, _opts, cb) {
      cb(incoming);
      incoming.emit('data', incoming._body);
      incoming.emit('end');
      req.emit('timeout');
      return req;
    },
  };
  const { monitor, ping } = createBackendMonitor({
    http,
    timeoutMs: 8000,
    failThreshold: 5,
    target: 'http://127.0.0.1:3000/api/health/live',
  });
  ping();
  assert.strictEqual(monitor.ok, true);
  assert.strictEqual(monitor.fails, 0);
  assert.strictEqual(monitor.lastBodyOk, true);
  assert.strictEqual(backendOkFromMonitor(monitor), true);
});

check('backendOkFromMonitor treats live false-timeout shape as ok', () => {
  assert.strictEqual(backendOkFromMonitor({
    ok: false,
    fails: 5,
    lastCode: 200,
    lastBodyOk: true,
    reason: 'timeout',
  }), true);
  assert.strictEqual(backendOkFromMonitor({
    ok: false,
    lastCode: 503,
    lastBodyOk: false,
    reason: 'timeout',
  }), false);
  assert.strictEqual(backendOkFromMonitor({ ok: true }), true);
  assert.strictEqual(backendOkFromMonitor({ ok: false, lastCode: 500, lastBodyOk: false, reason: 'status/body mismatch' }), false);
});

check('real timeout without a body counts toward the fail threshold', () => {
  let captured = null;
  const http = {
    get() {
      captured = mockReq();
      return captured;
    },
  };
  const { monitor, ping } = createBackendMonitor({
    http,
    timeoutMs: 8000,
    failThreshold: 5,
    target: 'http://127.0.0.1:3000/api/health/live',
  });
  for (let i = 0; i < 5; i += 1) {
    ping();
    captured.emit('timeout');
  }
  assert.strictEqual(monitor.fails, 5);
  assert.strictEqual(monitor.ok, false);
  assert.strictEqual(monitor.reason, 'timeout');
  assert.strictEqual(backendOkFromMonitor(monitor), false);
});

check('site still pins monitor timeout 8000 / fails 5 and live URL', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
  assert.ok(/UNICORN_BACKEND_MONITOR_TIMEOUT_MS\s*\|\|\s*8000/.test(src));
  assert.ok(/UNICORN_BACKEND_MONITOR_FAILS\s*\|\|\s*5/.test(src));
  assert.ok(src.includes('http://127.0.0.1:3000/api/health/live'));
  assert.ok(/ok:\s*backendOk/.test(src) || src.includes('ok: backendOk'));
  assert.ok(src.includes("require('./lib/backend-monitor')"));
});

check('backend registers /api/health/live before helmet', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
  const liveIdx = src.indexOf("app.get('/api/health/live'");
  const helmetIdx = src.indexOf('app.use(helmet');
  assert.ok(liveIdx > 0, 'expected early /api/health/live');
  assert.ok(helmetIdx > 0, 'expected helmet');
  assert.ok(liveIdx < helmetIdx, 'liveness must be registered before helmet');
  assert.ok(src.includes("app.get('/health/live'"));
  assert.ok(src.includes('UNICORN_LIVENESS/1.0'));
});

check('nginx live probe timeouts are 8s not 2s', () => {
  const conf = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
  const liveIdx = conf.indexOf('location = /api/health/live');
  assert.ok(liveIdx > 0);
  const liveWin = conf.slice(liveIdx, liveIdx + 700);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_backend\b/.test(liveWin));
  assert.ok(/proxy_read_timeout\s+8s/.test(liveWin), 'live read timeout must be 8s');
  assert.ok(!/proxy_read_timeout\s+2s/.test(liveWin), '2s live timeout hung probes under lag');
});

check('IAK health tick is time-sliced and skips IAK-started getStatus', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'backend', 'modules', 'integrated-autonomy-kernel.js'),
    'utf8'
  );
  assert.ok(/IAK_HEALTH_SLICE_MS/.test(src));
  assert.ok(/_healthSliceEnabled/.test(src));
  const startedIdx = src.indexOf('this._startedByIak.has(name)');
  const alreadyRunning = src.indexOf('Already running?');
  assert.ok(startedIdx > 0 && alreadyRunning > startedIdx, 'IAK-started skip must precede getStatus');
});

check('IAK looksLikeModuleSource caches by mtimeMs', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'iak', 'module-discovery.js'), 'utf8');
  assert.ok(src.includes('_looksLikeCache'));
  assert.ok(src.includes('mtimeMs'));
  assert.ok(/function looksLikeModuleSource/.test(src));
});

console.log(`✅ backend-monitor-truth: ${passed} tests passed`);
process.exit(0);
