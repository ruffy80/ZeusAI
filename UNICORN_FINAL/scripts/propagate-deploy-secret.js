#!/usr/bin/env node
/**
 * propagate-deploy-secret.js
 * ---------------------------------------------------------------------------
 * Uses the central Unicorn secrets module (src/config/secrets.js + ALL_SECRET_KEYS)
 * to place HETZNER_SSH_PRIVATE_KEY everywhere deploy needs it:
 *   1. process.env + ~/.ssh/deploy_key (materializeDeployKey)
 *   2. shared/server .env (escaped PEM) — quantumVault / configurationManager
 *   3. GitHub Actions secrets HETZNER_SSH_PRIVATE_KEY + SSH_PRIVATE_KEY (via GH_PAT)
 *   4. optional: ensure-ssh-access.sh (authorized_keys bootstrap)
 *
 * Usage:
 *   node UNICORN_FINAL/scripts/propagate-deploy-secret.js [--key-file PATH] [--env-file PATH] [--skip-github] [--skip-env] [--ensure-ssh]
 *
 * Defaults:
 *   --key-file  $HETZNER_KEY_PATH || ~/.ssh/deploy_key
 *   --env-file  /var/www/unicorn/shared/.env (if exists) else UNICORN_FINAL/.env
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const secrets = require('../src/config/secrets');

function parseArgs(argv) {
  const out = {
    keyFile: process.env.HETZNER_KEY_PATH || path.join(os.homedir(), '.ssh', 'deploy_key'),
    envFile: '',
    skipGithub: false,
    skipEnv: false,
    ensureSsh: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--key-file') out.keyFile = argv[++i];
    else if (a === '--env-file') out.envFile = argv[++i];
    else if (a === '--skip-github') out.skipGithub = true;
    else if (a === '--skip-env') out.skipEnv = true;
    else if (a === '--ensure-ssh') out.ensureSsh = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: propagate-deploy-secret.js [--key-file PATH] [--env-file PATH] [--skip-github] [--skip-env] [--ensure-ssh]');
      process.exit(0);
    }
  }
  return out;
}

function defaultEnvFile() {
  const shared = '/var/www/unicorn/shared/.env';
  if (fs.existsSync(shared)) return shared;
  const local = path.join(ROOT, '.env');
  return local;
}

function readPem(keyFile) {
  if (process.env.HETZNER_SSH_PRIVATE_KEY && String(process.env.HETZNER_SSH_PRIVATE_KEY).includes('PRIVATE KEY')) {
    return String(process.env.HETZNER_SSH_PRIVATE_KEY).replace(/\r\n/g, '\n').trim() + '\n';
  }
  if (!keyFile || !fs.existsSync(keyFile)) {
    throw new Error(`deploy key missing: ${keyFile || '(no path)'} — pass --key-file or set HETZNER_SSH_PRIVATE_KEY`);
  }
  const pem = fs.readFileSync(keyFile, 'utf8').replace(/\r\n/g, '\n').trim() + '\n';
  if (!pem.includes('PRIVATE KEY')) throw new Error(`not a private key file: ${keyFile}`);
  return pem;
}

function upsertEnvFile(envFile, updates) {
  fs.mkdirSync(path.dirname(envFile), { recursive: true });
  let text = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  if (text && !text.endsWith('\n')) text += '\n';
  for (const [name, value] of Object.entries(updates)) {
    const escaped = String(value).replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
    const line = `${name}=${escaped}`;
    const re = new RegExp(`^${name}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, line);
    else text += `${line}\n`;
  }
  fs.writeFileSync(envFile, text, { mode: 0o600 });
}

function httpJson(method, urlPath, token, body) {
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'unicorn-propagate-deploy-secret',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = data ? JSON.parse(data) : null; } catch (_) { /* raw */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function putGithubSecret(token, owner, repo, name, value) {
  const meta = await httpJson('GET', `/repos/${owner}/${repo}/actions/secrets/public-key`, token);
  if (meta.status !== 200 || !meta.body || !meta.body.key) {
    throw new Error(`public-key fetch failed HTTP ${meta.status}`);
  }
  let sodium;
  try {
    sodium = require('libsodium-wrappers');
    await sodium.ready;
  } catch (e) {
    throw new Error('libsodium-wrappers required to encrypt GitHub secrets: ' + e.message);
  }
  const binKey = sodium.from_base64(meta.body.key, sodium.base64_variants.ORIGINAL);
  const encBytes = sodium.crypto_box_seal(sodium.from_string(value), binKey);
  const encrypted_value = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
  const put = await httpJson('PUT', `/repos/${owner}/${repo}/actions/secrets/${name}`, token, {
    encrypted_value,
    key_id: meta.body.key_id,
  });
  if (put.status !== 201 && put.status !== 204) {
    throw new Error(`secret ${name} put failed HTTP ${put.status}`);
  }
  return put.status;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = args.envFile || defaultEnvFile();
  const pem = readPem(args.keyFile);

  process.env.HETZNER_SSH_PRIVATE_KEY = pem.trim();
  if (!process.env.HETZNER_HOST) process.env.HETZNER_HOST = '204.168.230.142';
  if (!process.env.HETZNER_DEPLOY_USER) process.env.HETZNER_DEPLOY_USER = 'root';

  // Load any existing env (GH_PAT etc.) without clobbering the PEM we just set
  const boot = secrets.bootstrap({ log: true, persistGenerated: false });
  // Re-assert PEM after dotenv load (dotenv override:false keeps ours if already set)
  process.env.HETZNER_SSH_PRIVATE_KEY = pem.trim();
  const mat = secrets.materializeDeployKey();
  const feat = secrets.features();

  console.log('[propagate] materialize:', mat);
  console.log('[propagate] deploySync:', feat.deploySync);

  if (!args.skipEnv) {
    upsertEnvFile(envFile, {
      HETZNER_SSH_PRIVATE_KEY: pem.trim(),
      SSH_PRIVATE_KEY: pem.trim(),
      HETZNER_HOST: process.env.HETZNER_HOST || '204.168.230.142',
      HETZNER_DEPLOY_USER: process.env.HETZNER_DEPLOY_USER || 'root',
      HETZNER_USER: process.env.HETZNER_USER || process.env.HETZNER_DEPLOY_USER || 'root',
      HETZNER_KEY_PATH: process.env.HETZNER_KEY_PATH || path.join(os.homedir(), '.ssh', 'deploy_key'),
    });
    console.log('[propagate] upserted deploy keys into', envFile, '(values redacted)');
  }

  if (!args.skipGithub) {
    const token = secrets.getSecret('GH_PAT') || secrets.getSecret('GITHUB_TOKEN') || process.env.GH_PAT || process.env.GITHUB_TOKEN;
    if (!token) {
      console.warn('[propagate] GH_PAT missing — skip GitHub Secrets push (set GH_PAT or use --skip-github)');
    } else {
      const owner = process.env.GITHUB_OWNER || 'ruffy80';
      const repo = process.env.GITHUB_REPO || 'ZeusAI';
      for (const name of ['HETZNER_SSH_PRIVATE_KEY', 'SSH_PRIVATE_KEY']) {
        const status = await putGithubSecret(token, owner, repo, name, pem.trim() + '\n');
        console.log(`[propagate] GitHub secret ${name} → HTTP ${status}`);
      }
    }
  }

  if (args.ensureSsh) {
    const script = path.join(__dirname, 'ensure-ssh-access.sh');
    const r = spawnSync('bash', [script], {
      env: { ...process.env, HETZNER_SSH_PRIVATE_KEY: pem.trim() },
      stdio: 'inherit',
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }

  console.log('[propagate] done · deploySyncReady=', secrets.features().deploySync.ready);
  console.log('[propagate] boot summary keys resolved=', Object.keys(boot.resolved || {}).length);
}

main().catch((e) => {
  console.error('[propagate] FAIL:', e.message);
  process.exit(1);
});
