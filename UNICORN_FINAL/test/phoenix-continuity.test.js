'use strict';

/**
 * phoenix-continuity.test.js — PCOS/1.0 Immortality Edge
 *
 * Proves the innovation contract:
 *   1. Heartbeat writer/reader detects frozen vs fresh ticks
 *   2. Phoenix edge ALWAYS answers /phoenix/live
 *   3. When brain is down, /api/health returns LKG (or honest 503), never hangs
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.PHOENIX_FROZEN_MS = '200';
process.env.PHOENIX_HB_DIR = require('os').tmpdir() + '/zeus-phoenix-test-' + process.pid;

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const hb = require('../backend/lib/phoenix-heartbeat');

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('\u2713', name); });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function httpGetJson(port, urlPath, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, timeout: timeoutMs || 3000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let body = null;
        try { body = JSON.parse(raw); } catch (_) { body = raw; }
        resolve({ code: res.statusCode, body, headers: res.headers });
      });
    });
    req.on('error', (e) => resolve({ code: 0, error: String(e.message || e) }));
    req.on('timeout', () => { req.destroy(); resolve({ code: 0, error: 'timeout' }); });
  });
}

async function unitHeartbeat() {
  fs.mkdirSync(process.env.PHOENIX_HB_DIR, { recursive: true });
  const file = hb.resolveHbPath('backend');
  const writer = hb.startWriter({ role: 'backend', path: file, intervalMs: 50 });
  await sleep(120);
  const fresh = hb.readBeat(file);
  assert.equal(fresh.ok, true);
  assert.equal(fresh.frozen, false, 'fresh beat must not be frozen');
  writer.stop();
  // Age the file artificially
  const stale = JSON.parse(fs.readFileSync(file, 'utf8'));
  stale.ts = Date.now() - 5000;
  fs.writeFileSync(file, JSON.stringify(stale));
  const frozen = hb.readBeat(file);
  assert.equal(frozen.frozen, true, 'old beat must be frozen');
}

async function unitEdgeLkg() {
  const edgePath = path.join(__dirname, '..', 'backend', 'phoenix-edge.js');
  assert.ok(fs.existsSync(edgePath), 'phoenix-edge.js exists');

  const port = 19000 + (process.pid % 1000);
  const lkgDir = path.join(process.env.PHOENIX_HB_DIR, 'lkg');
  fs.mkdirSync(lkgDir, { recursive: true });
  // Seed LKG
  fs.writeFileSync(path.join(lkgDir, 'api-health.json'), JSON.stringify({
    savedAt: new Date().toISOString(),
    code: 200,
    body: JSON.stringify({ ok: true, status: 'ok', from: 'lkg-seed' }),
  }));

  const child = spawn(process.execPath, [edgePath], {
    env: Object.assign({}, process.env, {
      PHOENIX_PORT: String(port),
      PHOENIX_BIND: '127.0.0.1',
      PHOENIX_BRAIN_ORIGIN: 'http://127.0.0.1:1', // guaranteed down
      PHOENIX_PROXY_TIMEOUT_MS: '400',
      PHOENIX_LKG_DIR: lkgDir,
      PHOENIX_HB_DIR: process.env.PHOENIX_HB_DIR,
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ready = false;
  for (let i = 0; i < 30; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const live = await httpGetJson(port, '/phoenix/live', 1000);
    if (live.code === 200 && live.body && live.body.ok) { ready = true; break; }
    // eslint-disable-next-line no-await-in-loop
    await sleep(100);
  }
  assert.ok(ready, 'phoenix/live must answer 200');

  const live = await httpGetJson(port, '/phoenix/live', 2000);
  assert.equal(live.code, 200);
  assert.equal(live.body.protocol, 'PCOS/1.0');
  assert.equal(typeof live.body.frozen, 'boolean');

  const health = await httpGetJson(port, '/api/health', 3000);
  assert.equal(health.code, 200, 'LKG health must be 200 when brain down');
  assert.ok(health.headers['x-phoenix'] === 'lkg' || (health.body && health.body.from === 'lkg-seed'));

  try { child.kill('SIGKILL'); } catch (_) { /* ignore */ }
  await sleep(50);
}

async function unitArtifacts() {
  const root = path.join(__dirname, '..');
  for (const rel of [
    'backend/phoenix-edge.js',
    'backend/lib/phoenix-heartbeat.js',
    'scripts/nginx-phoenix.snippet.conf',
    'scripts/install-phoenix-continuity.sh',
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
  const eco = fs.readFileSync(path.join(root, 'ecosystem.config.js'), 'utf8');
  assert.ok(eco.includes("name: 'unicorn-phoenix'"), 'ecosystem registers unicorn-phoenix');
  const deploy = fs.readFileSync(path.join(root, 'scripts/deploy-atomic-forward.sh'), 'utf8');
  assert.ok(deploy.includes('unicorn-phoenix'), 'deploy PM2_ONLY includes phoenix');
}

Promise.resolve()
  .then(() => check('heartbeat fresh vs frozen', unitHeartbeat))
  .then(() => check('edge live + LKG health when brain down', unitEdgeLkg))
  .then(() => check('ops artifacts wired', unitArtifacts))
  .then(() => {
    console.log(`\n✅ phoenix-continuity: ${passed} tests passed`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ phoenix-continuity failed:', err && err.stack || err);
    process.exit(1);
  });
