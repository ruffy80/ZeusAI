#!/usr/bin/env node
/**
 * setup-github-secrets.js
 * Seteaza automat GitHub Actions Secrets pentru repo-ul ZeusAI.
 * 
 * Rulare: GITHUB_TOKEN=ghp_xxx node setup-github-secrets.js
 * 
 * Secrets generate automat (nu ai nevoie de nimic extern):
 *   JWT_SECRET, ADMIN_SECRET, ADMIN_MASTER_PASSWORD, ADMIN_2FA_CODE,
 *   WEBHOOK_SECRET, HETZNER_WEBHOOK_SECRET
 *
 * Secrets pe care TREBUIE sa le ai deja:
 *   VERCEL_TOKEN     → vercel.com/account/tokens
 *   HETZNER_*        → Hetzner Cloud Console + SSH key
 */

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'ruffy80';
const REPO  = 'ZeusAI';

const VERCEL_ORG_ID = 'team_wes3fQvKjdfOMKXe7f4fFQoL';
// Fallback project ID (unicorn-final legacy) used only when Vercel API is unavailable
const VERCEL_PROJECT_ID_FALLBACK = 'prj_YNIHsyltyZUV7HQA3VyQhhGDvKD3';

if (!GITHUB_TOKEN) {
  console.error('❌  Set GITHUB_TOKEN=ghp_... before running this script.');
  process.exit(1);
}

// ─── Auto-fetch zeusai project ID from Vercel API ─────────────────────────────
function fetchVercelProjectId(token, orgId) {
  return new Promise((resolve) => {
    if (!token) {
      console.log('  ℹ️  VERCEL_TOKEN not set – using fallback project ID');
      return resolve(VERCEL_PROJECT_ID_FALLBACK);
    }
    const path = `/v9/projects/zeusai?teamId=${orgId}`;
    const opts = {
      hostname: 'api.vercel.com',
      path,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'unicorn-setup',
        Accept: 'application/json',
      },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const project = JSON.parse(data);
          if (project.id) {
            console.log(`  🔍 Vercel zeusai project ID resolved: ${project.id}`);
            resolve(project.id);
          } else {
            console.warn(`  ⚠️  Could not resolve zeusai project ID from Vercel (response: ${data.slice(0, 120)}). Using fallback.`);
            resolve(VERCEL_PROJECT_ID_FALLBACK);
          }
        } catch {
          console.warn('  ⚠️  Failed to parse Vercel project response. Using fallback project ID.');
          resolve(VERCEL_PROJECT_ID_FALLBACK);
        }
      });
    }).on('error', (err) => {
      console.warn(`  ⚠️  Vercel API error: ${err.message}. Using fallback project ID.`);
      resolve(VERCEL_PROJECT_ID_FALLBACK);
    });
  });
}

// ─── GitHub API helpers ─────────────────────────────────────────────────────────
function apiGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path,
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'unicorn-setup',
        Accept: 'application/vnd.github+json'
      }
    };
    https.get(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function apiPut(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'api.github.com',
      path,
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'unicorn-setup',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function encryptSecret(publicKey, publicKeyId, secretValue) {
  // Load libsodium for encryption (required by GitHub API)
  let sodium;
  try {
    sodium = require('libsodium-wrappers');
    await sodium.ready;
  } catch {
    // Fallback: return base64 — works only if libsodium not available
    console.warn('  ⚠️  libsodium not found, using raw base64 (may fail for some secrets)');
    return {
      encrypted_value: Buffer.from(secretValue).toString('base64'),
      key_id: publicKeyId
    };
  }
  const binKey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const binSecret = sodium.from_string(secretValue);
  const encBytes = sodium.crypto_box_seal(binSecret, binKey);
  return {
    encrypted_value: sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL),
    key_id: publicKeyId
  };
}

async function run() {
  console.log(`\n🔐 Pushing secrets to github.com/${OWNER}/${REPO}\n`);

  // Auto-resolve the zeusai Vercel project ID (replaces any stale unicorn-final ID)
  const vercelProjectId = await fetchVercelProjectId(process.env.VERCEL_TOKEN, VERCEL_ORG_ID);

  const SECRETS = {
    // Generated — fully autonomous
    JWT_SECRET:             'c27b85435c110ee2a1ba6a34033071dcf3bd506d9b4ca83b7922b9ccb407ed1a3977618bdbb52eb85e81a7c6070a3ed0',
    ADMIN_SECRET:           'Utz0qwqFIQy9cAMHM2wdWjyDPfUC9LC1H3n7f38qiSQ',
    ADMIN_MASTER_PASSWORD:  'Unicorn@uOdy81WP2026!',
    ADMIN_2FA_CODE:         '941393',
    WEBHOOK_SECRET:         'euvoqd121ermYxT8hXQwY71PGX5ihYlQ50QEzm8FVpM',
    HETZNER_WEBHOOK_SECRET: 'euvoqd121ermYxT8hXQwY71PGX5ihYlQ50QEzm8FVpM',

    // Vercel — project ID auto-resolved from Vercel API at run time
    VERCEL_ORG_ID:          VERCEL_ORG_ID,
    VERCEL_PROJECT_ID:      vercelProjectId,

    // Domain — required for SSL/HTTPS health checks and certbot
    SITE_DOMAIN:            'zeusai.pro',
    UNICORN_DOMAIN:         'www.zeusai.pro',

    // Hetzner — known from .env.auto-connector.example
    HETZNER_HOST:           '204.168.230.142',
    HETZNER_USER:           'root',
    HETZNER_DEPLOY_USER:    'root',
    HETZNER_DEPLOY_PORT:    '22',
    HETZNER_DEPLOY_PATH:    '/root/unicorn-final',
    HETZNER_APP_PORT:       '3000',

    // Pass-through from environment (must be provided externally if available)
    ...(process.env.VERCEL_TOKEN            ? { VERCEL_TOKEN:            process.env.VERCEL_TOKEN }            : {}),
    ...(process.env.HETZNER_API_KEY         ? { HETZNER_API_KEY:         process.env.HETZNER_API_KEY }         : {}),
    ...(process.env.HETZNER_SSH_PRIVATE_KEY ? { HETZNER_SSH_PRIVATE_KEY: process.env.HETZNER_SSH_PRIVATE_KEY } : {}),
  };

  const { key, key_id } = await apiGet(`/repos/${OWNER}/${REPO}/actions/secrets/public-key`);

  const entries = Object.entries(SECRETS).filter(([, v]) => v !== '');
  for (const [name, value] of entries) {
    const encrypted = await encryptSecret(key, key_id, value);
    const res = await apiPut(`/repos/${OWNER}/${REPO}/actions/secrets/${name}`, encrypted);
    const ok = res.status === 201 || res.status === 204;
    console.log(`  ${ok ? '✅' : '❌'} ${name} (HTTP ${res.status})`);
  }

  console.log('\n✅ Done. Trigger a deploy by pushing to main.\n');
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
