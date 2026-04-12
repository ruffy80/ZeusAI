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

function apiPatch(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'api.github.com',
      path,
      method: 'PATCH',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'unicorn-setup',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
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

// ─── Random secret generators ──────────────────────────────────────────────────
function genHex(bytes = 48) { return crypto.randomBytes(bytes).toString('hex'); }
function genBase64url(bytes = 32) { return crypto.randomBytes(bytes).toString('base64url'); }
function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const specials = '!@#$%^&*';
  let pass = 'Unicorn@';
  for (let i = 0; i < 12; i++) pass += chars[crypto.randomInt(chars.length)];
  pass += specials[crypto.randomInt(specials.length)];
  return pass;
}
function gen2FA() { return String(crypto.randomInt(100000, 1000000)); }

async function run() {
  console.log(`\n🔐 Pushing secrets to github.com/${OWNER}/${REPO}\n`);

  // Auto-resolve the zeusai Vercel project ID (replaces any stale unicorn-final ID)
  const vercelProjectId = await fetchVercelProjectId(process.env.VERCEL_TOKEN, VERCEL_ORG_ID);

  // ─── Auto-generated machine secrets (always fresh) ────────────────────────
  const jwtSecret     = genHex(48);
  const adminSecret   = genBase64url(32);
  const webhookSecret = genBase64url(32);

  // ─── Admin credentials: reuse existing if passed via env, otherwise generate new ──
  const adminPasswordIsNew = !process.env.ADMIN_MASTER_PASSWORD;
  const admin2faIsNew      = !process.env.ADMIN_2FA_CODE;
  const adminPassword = process.env.ADMIN_MASTER_PASSWORD || genPassword();
  const admin2fa      = process.env.ADMIN_2FA_CODE        || gen2FA();

  // Print newly generated admin credentials so the owner can save them
  if (adminPasswordIsNew || admin2faIsNew) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  ⚠️  SAVE THESE ADMIN CREDENTIALS — shown only once!     ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    if (adminPasswordIsNew) console.log(`║  ADMIN_MASTER_PASSWORD : ${adminPassword.padEnd(34)} ║`);
    if (admin2faIsNew)      console.log(`║  ADMIN_2FA_CODE        : ${admin2fa.padEnd(34)} ║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('  → Add them as GitHub Secrets so future runs reuse them.');
    console.log('');
  }

  const SECRETS = {
    // Generated — fully autonomous (regenerated every run for maximum security)
    JWT_SECRET:             jwtSecret,
    ADMIN_SECRET:           adminSecret,
    ADMIN_MASTER_PASSWORD:  adminPassword,
    ADMIN_2FA_CODE:         admin2fa,
    WEBHOOK_SECRET:         webhookSecret,
    HETZNER_WEBHOOK_SECRET: webhookSecret,

    // Vercel — project ID auto-resolved from Vercel API at run time
    VERCEL_ORG_ID:          VERCEL_ORG_ID,
    VERCEL_PROJECT_ID:      vercelProjectId,

    // Domain — required for SSL/HTTPS health checks and certbot
    // Can be overridden at runtime via SITE_DOMAIN / UNICORN_DOMAIN env vars
    // (e.g. when triggered from setup-secrets-and-deploy.yml with custom inputs)
    SITE_DOMAIN:    process.env.SITE_DOMAIN    || 'zeusai.pro',
    UNICORN_DOMAIN: process.env.UNICORN_DOMAIN || 'www.zeusai.pro',

    // Hetzner — known from .env.auto-connector.example
    HETZNER_HOST:           '204.168.230.142',
    HETZNER_USER:           'root',
    HETZNER_DEPLOY_USER:    'root',
    HETZNER_DEPLOY_PORT:    '22',
    HETZNER_DEPLOY_PATH:    '/root/unicorn-final',
    HETZNER_APP_PORT:       '3000',

    // SSH aliases — same values as Hetzner equivalents above (used by deploy-backend.yml, setup-ai-keys.yml)
    SSH_HOST:               '204.168.230.142',
    SSH_USER:               'root',
    SSH_PORT:               '22',

    // Vercel team alias — used by vercel-deploy.yml as VERCEL_TEAM_ID
    VERCEL_TEAM_ID:         VERCEL_ORG_ID,

    // Health check URL — used by unicorn-keepalive.yml
    VERCEL_HEALTH_URL:      'https://zeusai.pro/health',

    // Ownership — used by vercel-deploy.yml for certbot and .env injection
    OWNER_EMAIL:            'vladoi_ionut@yahoo.com',
    BTC_WALLET_ADDRESS:     'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',

    // Pass-through from environment (must be provided externally if available)
    ...(process.env.VERCEL_TOKEN            ? { VERCEL_TOKEN:            process.env.VERCEL_TOKEN }            : {}),
    ...(process.env.HETZNER_API_KEY         ? { HETZNER_API_KEY:         process.env.HETZNER_API_KEY }         : {}),
    ...(process.env.HETZNER_API_TOKEN       ? { HETZNER_API_TOKEN:       process.env.HETZNER_API_TOKEN }       : {}),
    ...(process.env.HETZNER_SSH_PRIVATE_KEY ? { HETZNER_SSH_PRIVATE_KEY: process.env.HETZNER_SSH_PRIVATE_KEY } : {}),
    // SSH_PRIVATE_KEY alias (used by deploy-backend.yml, setup-ai-keys.yml as fallback)
    ...(process.env.HETZNER_SSH_PRIVATE_KEY ? { SSH_PRIVATE_KEY:         process.env.HETZNER_SSH_PRIVATE_KEY } : {}),
    ...(process.env.SSH_PRIVATE_KEY         ? { SSH_PRIVATE_KEY:         process.env.SSH_PRIVATE_KEY }         : {}),
    // AI provider keys (pass-through — user must provide these)
    ...(process.env.OPENAI_API_KEY     ? { OPENAI_API_KEY:     process.env.OPENAI_API_KEY }     : {}),
    ...(process.env.DEEPSEEK_API_KEY   ? { DEEPSEEK_API_KEY:   process.env.DEEPSEEK_API_KEY }   : {}),
    ...(process.env.ANTHROPIC_API_KEY  ? { ANTHROPIC_API_KEY:  process.env.ANTHROPIC_API_KEY }  : {}),
    ...(process.env.GEMINI_API_KEY     ? { GEMINI_API_KEY:     process.env.GEMINI_API_KEY }     : {}),
    ...(process.env.MISTRAL_API_KEY    ? { MISTRAL_API_KEY:    process.env.MISTRAL_API_KEY }    : {}),
    ...(process.env.COHERE_API_KEY     ? { COHERE_API_KEY:     process.env.COHERE_API_KEY }     : {}),
    ...(process.env.XAI_API_KEY        ? { XAI_API_KEY:        process.env.XAI_API_KEY }        : {}),
    // Payment keys (pass-through — user must provide these)
    ...(process.env.STRIPE_SECRET_KEY       ? { STRIPE_SECRET_KEY:       process.env.STRIPE_SECRET_KEY }       : {}),
    ...(process.env.STRIPE_PUBLISHABLE_KEY  ? { STRIPE_PUBLISHABLE_KEY:  process.env.STRIPE_PUBLISHABLE_KEY }  : {}),
    ...(process.env.STRIPE_WEBHOOK_SECRET   ? { STRIPE_WEBHOOK_SECRET:   process.env.STRIPE_WEBHOOK_SECRET }   : {}),
    ...(process.env.PAYPAL_CLIENT_ID        ? { PAYPAL_CLIENT_ID:        process.env.PAYPAL_CLIENT_ID }        : {}),
    ...(process.env.PAYPAL_CLIENT_SECRET    ? { PAYPAL_CLIENT_SECRET:    process.env.PAYPAL_CLIENT_SECRET }    : {}),
    // Email credentials (pass-through — user must provide these)
    ...(process.env.SMTP_HOST  ? { SMTP_HOST:  process.env.SMTP_HOST }  : {}),
    ...(process.env.SMTP_PORT  ? { SMTP_PORT:  process.env.SMTP_PORT }  : {}),
    ...(process.env.SMTP_USER  ? { SMTP_USER:  process.env.SMTP_USER }  : {}),
    ...(process.env.SMTP_PASS  ? { SMTP_PASS:  process.env.SMTP_PASS }  : {}),
    // DNS provider credentials (optional — enables automatic DNS setup)
    ...(process.env.HETZNER_DNS_API_KEY     ? { HETZNER_DNS_API_KEY:     process.env.HETZNER_DNS_API_KEY }     : {}),
    ...(process.env.CF_TOKEN                ? { CF_TOKEN:                process.env.CF_TOKEN }                : {}),
    ...(process.env.CLOUDFLARE_API_TOKEN    ? { CF_TOKEN:                process.env.CLOUDFLARE_API_TOKEN }    : {}),
    ...(process.env.CF_ZONE_ID              ? { CF_ZONE_ID:              process.env.CF_ZONE_ID }              : {}),
    ...(process.env.CLOUDFLARE_ZONE_ID      ? { CF_ZONE_ID:              process.env.CLOUDFLARE_ZONE_ID }      : {}),
    // Webhook URLs (optional — used as deploy-webhook fallback targets)
    ...(process.env.HETZNER_WEBHOOK_URL     ? { HETZNER_WEBHOOK_URL:     process.env.HETZNER_WEBHOOK_URL }     : {}),
    ...(process.env.GH_WEBHOOK_URL          ? { GH_WEBHOOK_URL:          process.env.GH_WEBHOOK_URL }          : {}),
    ...(process.env.WEBHOOK_URL             ? { WEBHOOK_URL:             process.env.WEBHOOK_URL }             : {}),
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

  // ─── Update GitHub repo homepage to zeusai.pro ──────────────────────────────
  console.log('🏠 Updating GitHub repo homepage to https://zeusai.pro...');
  try {
    const repoRes = await apiPatch(`/repos/${OWNER}/${REPO}`, {
      homepage: 'https://zeusai.pro',
      description: 'ZeusAI – Autonomous AI Business Platform'
    });
    if (repoRes.status === 200) {
      console.log('  ✅ GitHub repo homepage set to https://zeusai.pro');
    } else {
      console.warn(`  ⚠️  Could not update repo homepage (HTTP ${repoRes.status}). GH_PAT needs repo scope.`);
    }
  } catch (err) {
    console.warn(`  ⚠️  Repo homepage update failed: ${err.message}`);
  }
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
