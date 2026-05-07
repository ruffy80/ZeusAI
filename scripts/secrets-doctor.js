#!/usr/bin/env node
'use strict';
// scripts/secrets-doctor.js
// Single-source diagnosis: load secrets via UNICORN_FINAL/src/config/secrets.js,
// then live-probe each critical credential and print exactly what is broken
// + the minimum fix command. No interactive prompts, safe to run anytime.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const secretsModule = path.join(ROOT, 'UNICORN_FINAL', 'src', 'config', 'secrets.js');
let bootstrap, getSecret, configured, features;
try {
  ({ bootstrap, getSecret, configured, features } = require(secretsModule));
} catch (err) {
  console.error('❌ cannot load secrets module at', secretsModule, err.message);
  process.exit(2);
}

const result = bootstrap({ log: false, persistGenerated: false });

const c = (code, s) => `\u001b[${code}m${s}\u001b[0m`;
const ok = (s) => c(32, '✅ ' + s);
const warn = (s) => c(33, '⚠️  ' + s);
const bad = (s) => c(31, '❌ ' + s);
const head = (s) => c(36, '\n=== ' + s + ' ===');

function get(name) { return getSecret(name, ''); }

function httpsJson({ host, path: p, method = 'GET', headers = {}, timeout = 8000 }) {
  return new Promise((resolve) => {
    const req = https.request({ host, path: p, method, headers, timeout }, (res) => {
      let buf = '';
      res.on('data', (d) => (buf += d));
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

async function probeGithub() {
  const tok = get('GITHUB_TOKEN') || get('GH_PAT') || get('GH_TOKEN');
  if (!tok) return { ok: false, msg: 'GITHUB_TOKEN missing', fix: 'gh auth login   # or set GH_PAT/GITHUB_TOKEN in .env.auto-connector' };
  const r = await httpsJson({
    host: 'api.github.com', path: '/user',
    headers: { Authorization: `token ${tok}`, 'User-Agent': 'unicorn-doctor', Accept: 'application/vnd.github+json' },
  });
  if (r.status === 200) return { ok: true, msg: 'GitHub PAT valid' };
  return { ok: false, msg: `GitHub PAT HTTP ${r.status}`, fix: 'rotate token at https://github.com/settings/tokens then update GITHUB_TOKEN in .env.auto-connector' };
}

async function probeHetzner() {
  const tok = get('HETZNER_API_KEY') || get('HETZNER_API_TOKEN') || get('HCLOUD_TOKEN');
  if (!tok) return { ok: false, msg: 'HETZNER_API_KEY missing', fix: 'create token at https://console.hetzner.cloud/projects then set HETZNER_API_KEY' };
  const r = await httpsJson({
    host: 'api.hetzner.cloud', path: '/v1/servers?per_page=1',
    headers: { Authorization: `Bearer ${tok}` },
  });
  if (r.status === 200) return { ok: true, msg: 'Hetzner API token valid' };
  return { ok: false, msg: `Hetzner API HTTP ${r.status}`, fix: 'rotate Hetzner Cloud API token, update HETZNER_API_KEY in .env.auto-connector' };
}

function probeSsh() {
  const host = get('HETZNER_HOST');
  const user = get('HETZNER_DEPLOY_USER') || get('HETZNER_USER') || 'root';
  const port = get('HETZNER_DEPLOY_PORT') || '22';
  const key = get('HETZNER_KEY_PATH') || get('HETZNER_SSH_KEY_PATH') || get('SSH_KEY_PATH');
  if (!host || !key) return { ok: false, msg: 'SSH host/key missing', fix: 'fill HETZNER_HOST and HETZNER_KEY_PATH in .env.auto-connector' };
  if (!fs.existsSync(key)) return { ok: false, msg: `SSH key missing on disk: ${key}`, fix: `place private key at ${key} (chmod 600)` };
  const r = spawnSync('ssh', [
    '-i', key, '-p', String(port),
    '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=8',
    '-o', 'IdentitiesOnly=yes', '-o', 'PreferredAuthentications=publickey',
    `${user}@${host}`, 'true',
  ]);
  if (r.status === 0) return { ok: true, msg: `SSH key-auth ok ${user}@${host}:${port}` };
  return {
    ok: false,
    msg: `SSH key-auth refused (${user}@${host}:${port})`,
    fix: 'run: bash UNICORN_FINAL/scripts/bootstrap-ssh-via-github.sh   # uses GH workflow with the working server key to install your local pubkey',
  };
}

function probeLiveSite() {
  return httpsJson({ host: 'zeusai.pro', path: '/health', headers: { 'User-Agent': 'unicorn-doctor' } })
    .then((r) => r.status === 200 ? { ok: true, msg: 'https://zeusai.pro/health 200' } : { ok: false, msg: `live site HTTP ${r.status}`, fix: 'check Hetzner / nginx / pm2' });
}

(async () => {
  console.log(head('Secrets bootstrap'));
  const known = `${result.summary.configuredKnownSecrets}/${result.summary.totalKnownSecrets}`;
  console.log(`loaded env files : ${result.loaded.length}`);
  console.log(`resolved aliases : ${Object.keys(result.resolved).length}`);
  console.log(`configured known : ${known}`);
  for (const [feat, st] of Object.entries(result.features)) {
    const tag = st.ready ? ok : st.configured ? warn : bad;
    console.log(tag(`${feat.padEnd(22)} ${st.configured}/${st.total}${st.missing.length ? '  missing: ' + st.missing.join(',') : ''}`));
  }

  console.log(head('Live credentials'));
  const checks = [
    ['GitHub PAT     ', await probeGithub()],
    ['Hetzner API    ', await probeHetzner()],
    ['SSH key-auth   ', probeSsh()],
    ['Live site      ', await probeLiveSite()],
  ];
  let failed = 0;
  for (const [name, r] of checks) {
    if (r.ok) console.log(`${name} ${ok(r.msg)}`);
    else { console.log(`${name} ${bad(r.msg)}`); if (r.fix) console.log('               ' + c(35, 'fix → ') + r.fix); failed++; }
  }

  console.log(head('Summary'));
  if (!failed) console.log(ok('all critical credentials valid · system fully autonomous'));
  else console.log(warn(`${failed} credential check(s) failed — apply the fixes above, then rerun: node scripts/secrets-doctor.js`));
  process.exit(failed ? 1 : 0);
})();
