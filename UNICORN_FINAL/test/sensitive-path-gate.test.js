'use strict';

/**
 * Contract for scripts/sensitive-path-gate.sh — must never abort deploy on
 * curl timeout (exit 28), only on proven exposure.
 *
 * Fixture servers run in a CHILD process so spawnSync(bash) cannot freeze
 * the Node event loop that would otherwise accept the probe connections.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'sensitive-path-gate.sh');

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log('✓', name);
      passed += 1;
    });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function startFixture(mode, port) {
  const code = `
const http = require('http');
const mode = ${JSON.stringify(mode)};
const port = ${Number(port)};
http.createServer((req, res) => {
  if (mode === 'hang') return;
  if (mode === 'expose') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('JWT_SECRET=leaked\\nDB_PASSWORD=x\\n');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
}).listen(port, '127.0.0.1', () => process.stdout.write('ready\\n'));
`;
  const child = spawn(process.execPath, ['-e', code], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let ready = false;
    const t = setTimeout(() => {
      if (!ready) {
        child.kill('SIGKILL');
        reject(new Error('fixture start timeout mode=' + mode));
      }
    }, 5000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('ready')) {
        ready = true;
        clearTimeout(t);
        resolve(child);
      }
    });
    child.on('error', reject);
  });
}

function runGate(port, extraEnv = {}) {
  return spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      BASE_URL: `http://127.0.0.1:${port}`,
      SENSITIVE_PATH_RETRIES: '2',
      SENSITIVE_PATH_CONNECT_TIMEOUT: '2',
      SENSITIVE_PATH_MAX_TIME: '3',
      HETZNER_HOST: '',
      ...extraEnv,
    },
  });
}

async function withFixture(mode, extraEnv, fn) {
  const port = await freePort();
  const child = await startFixture(mode, port);
  try {
    return await fn(port);
  } finally {
    try { child.kill('SIGKILL'); } catch (_) { /* ignore */ }
  }
}

async function main() {
  await check('sensitive-path-gate.sh exists and never uses bare set -e', () => {
    assert.ok(fs.existsSync(SCRIPT));
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(src.includes('set -uo pipefail'));
    assert.ok(!/^set -e/m.test(src), 'bare set -e would kill deploy on curl 28');
    assert.ok(/inconclusive|soft-pass/i.test(src));
    assert.ok(src.includes('curl --path-as-is'));
  });

  await check('deploy.yml wires sensitive-path-gate.sh', () => {
    const yml = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
    assert.ok(yml.includes('Sensitive path exposure gate'));
    assert.ok(yml.includes('sensitive-path-gate.sh'));
  });

  await check('gate passes when all sensitive paths return clean 404', async () => {
    await withFixture('ok404', {}, async (port) => {
      const r = runGate(port);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /PASS/);
    });
  });

  await check('gate soft-passes when public curls time out (no exposure proof)', async () => {
    await withFixture('hang', {
      SENSITIVE_PATH_RETRIES: '1',
      SENSITIVE_PATH_CONNECT_TIMEOUT: '1',
      SENSITIVE_PATH_MAX_TIME: '1',
    }, async (port) => {
      const r = runGate(port, {
        SENSITIVE_PATH_RETRIES: '1',
        SENSITIVE_PATH_CONNECT_TIMEOUT: '1',
        SENSITIVE_PATH_MAX_TIME: '1',
      });
      assert.equal(r.status, 0, `timeout must soft-pass, got ${r.status}\n${r.stdout}\n${r.stderr}`);
      assert.match(`${r.stdout}\n${r.stderr}`, /inconclusive|PASS/i);
    });
  });

  await check('gate fails hard when /.env returns 200 with env body', async () => {
    await withFixture('expose', { SENSITIVE_PATH_RETRIES: '1' }, async (port) => {
      const r = runGate(port, { SENSITIVE_PATH_RETRIES: '1' });
      assert.notEqual(r.status, 0, 'must fail on exposed .env\n' + r.stdout + '\n' + r.stderr);
      assert.match(`${r.stdout}\n${r.stderr}`, /exposed|FAILED/i);
    });
  });

  console.log(`\n✅ sensitive-path-gate: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e && e.stack || e);
  process.exit(1);
});
