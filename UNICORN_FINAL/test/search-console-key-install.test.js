'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-install-'));
process.env.SEO_BRIDGE_DIR = TMP;

const installer = require('../scripts/search-console-key-install');

const queue = [];
function check(name, fn) {
  queue.push({ name, fn });
}

function rsaPem() {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
}

function accountFile(extra) {
  const file = path.join(TMP, 'key-' + crypto.randomBytes(4).toString('hex') + '.json');
  const body = Object.assign({
    type: 'service_account',
    client_email: 'search-console-test@example.iam.gserviceaccount.com',
    private_key: rsaPem(),
  }, extra || {});
  fs.writeFileSync(file, JSON.stringify(body), { mode: 0o644 });
  return { file, body };
}

function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) };
}

check('a missing key file exits 2 and does not call Google or write an env file', () => {
  const envFile = path.join(TMP, 'missing.env');
  const script = path.join(ROOT, 'scripts', 'search-console-key-install.js');
  const child = spawnSync(process.execPath, [script], {
    env: Object.assign({}, process.env, {
      SEARCH_CONSOLE_KEY_FILE: path.join(TMP, 'absent.json'),
      SEARCH_CONSOLE_ENV_FILE: envFile,
    }),
    encoding: 'utf8',
  });
  assert.strictEqual(child.status, 2);
  const report = JSON.parse(child.stdout);
  assert.strictEqual(report.ok, false);
  assert.strictEqual(report.reason, 'key_file_missing');
  assert.strictEqual(report.calledGoogle, false);
  assert.strictEqual(report.wroteEnv, false);
  assert.strictEqual(report.restartedPm2, false);
  assert.strictEqual(report.wroteRawJson, false);
  assert.strictEqual(fs.existsSync(envFile), false);
});

check('an invalid file is refused and its contents stay out of the result', async () => {
  const file = path.join(TMP, 'bad.json');
  fs.writeFileSync(file, '{"note":"NOT_A_SECRET_CANARY","client_email":"bad@example.com","private_key":"not-a-pem"}');
  const report = await installer.installFromFile({
    keyPath: file,
    envPath: path.join(TMP, 'bad.env'),
    probe: false,
  });
  const text = JSON.stringify(report);
  assert.strictEqual(report.wroteEnv, false);
  assert.strictEqual(report.reason, 'missing_private_key');
  assert.ok(!text.includes('NOT_A_SECRET_CANARY'));
  assert.ok(!text.includes('not-a-pem'));
});

check('a repository path is refused before any write', async () => {
  const report = await installer.installFromFile({
    keyPath: path.join(ROOT, 'search-console-key.json'),
    envPath: path.join(TMP, 'repo.env'),
    probe: false,
  });
  assert.strictEqual(report.reason, 'path_inside_repository');
  assert.strictEqual(report.wroteEnv, false);
  assert.strictEqual(fs.existsSync(path.join(ROOT, 'search-console-key.json')), false);
});

check('a valid key is stored as base64 only and the result hides the key', async () => {
  const { file, body } = accountFile();
  const envFile = path.join(TMP, 'ok.env');
  const report = await installer.installFromFile({ keyPath: file, envPath: envFile, probe: false });
  const text = JSON.stringify(report);
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.reason, 'installed_b64_only');
  assert.strictEqual(report.wroteRawJson, false);
  assert.strictEqual(report.restartedPm2, false);
  assert.strictEqual(report.calledGoogle, false);
  assert.strictEqual(report.clientEmail, body.client_email);
  assert.ok(!text.includes('PRIVATE KEY'));
  assert.ok(!text.includes(body.private_key.slice(0, 40)));
  const mode = fs.statSync(envFile).mode & 0o777;
  assert.strictEqual(mode, 0o600);
  const line = fs.readFileSync(envFile, 'utf8').trim();
  assert.ok(line.startsWith('GOOGLE_SERVICE_ACCOUNT_JSON_B64='));
  assert.ok(!line.includes('PRIVATE KEY'));
  const decoded = JSON.parse(Buffer.from(line.split('=')[1], 'base64').toString('utf8'));
  assert.strictEqual(decoded.client_email, body.client_email);
  assert.ok(decoded.private_key.includes('BEGIN PRIVATE KEY'));
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
});

check('a rejected probe writes nothing and does not echo the key', async () => {
  const { file, body } = accountFile();
  const envFile = path.join(TMP, 'probe-fail.env');
  const prev = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 403,
      text: async () => '-----BEGIN PRIVATE KEY-----\nLEAK\n-----END PRIVATE KEY----- ya29.leak-token',
    };
  };
  const report = await installer.installFromFile({ keyPath: file, envPath: envFile, probe: true });
  global.fetch = prev;
  const text = JSON.stringify(report);
  assert.ok(calls > 0);
  assert.strictEqual(report.wroteEnv, false);
  assert.strictEqual(report.calledGoogle, true);
  assert.strictEqual(report.restartedPm2, false);
  assert.strictEqual(fs.existsSync(envFile), false);
  assert.ok(!text.includes('LEAK'));
  assert.ok(!text.includes('ya29.'));
  assert.ok(!text.includes('PRIVATE KEY'));
  assert.ok(!text.includes(body.private_key.slice(0, 24)));
});

check('a successful probe installs only after Search Console accepts the property', async () => {
  const { file } = accountFile();
  const envFile = path.join(TMP, 'probe-ok.env');
  const prev = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com')) return jsonResponse(200, { access_token: 'ya29.test-token' });
    if (u.includes('searchAnalytics')) {
      return jsonResponse(200, { rows: [{ clicks: 1, impressions: 4, ctr: 0.25, position: 9 }] });
    }
    if (u.includes('/sitemaps')) return jsonResponse(200, { sitemap: [] });
    throw new Error('unexpected');
  };
  const report = await installer.installFromFile({ keyPath: file, envPath: envFile, probe: true });
  global.fetch = prev;
  const text = JSON.stringify(report);
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.calledGoogle, true);
  assert.strictEqual(report.wroteEnv, true);
  assert.strictEqual(fs.existsSync(envFile), true);
  assert.ok(!text.includes('ya29.'));
  assert.ok(!text.includes('PRIVATE KEY'));
});

check('boot and secret sync keep the fragment without a hand edit of .env', () => {
  const boot = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
  assert.ok(boot.includes('/var/www/unicorn/shared/search-console.env'));
  const wf = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'sync-all-secrets.yml'), 'utf8');
  assert.ok(wf.includes('/var/www/unicorn/shared/search-console.env'));
  const bridge = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'search-console-bridge.js'), 'utf8');
  assert.ok(bridge.includes('search-console-key-install.js'));
  assert.ok(!bridge.includes('paste the whole JSON'));
  assert.ok(bridge.includes('searchConsoleSiteUrlRequired: false'));
});

async function main() {
  let passed = 0;
  for (const t of queue) {
    await t.fn();
    passed += 1;
    console.log('  ✓', t.name);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n✅ search-console-key-install: ${passed} tests passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
