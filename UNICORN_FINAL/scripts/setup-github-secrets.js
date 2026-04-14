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
 *   HETZNER_*        → Hetzner Cloud Console + SSH key
 */

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'ruffy80';
const REPO  = 'ZeusAI';

if (!GITHUB_TOKEN) {
  console.error('❌  Set GITHUB_TOKEN=ghp_... before running this script.');
  process.exit(1);
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
    HETZNER_DEPLOY_PATH:    '/var/www/unicorn',
    HETZNER_APP_PORT:       '3000',

    // SSH aliases — same values as Hetzner equivalents above (used by deploy-backend.yml, setup-ai-keys.yml)
    SSH_HOST:               '204.168.230.142',
    SSH_USER:               'root',
    SSH_PORT:               '22',

    // Health check URL — used by unicorn-keepalive.yml
    SITE_HEALTH_URL:        'https://zeusai.pro/health',

    // Ownership — used by hetzner-deploy.yml for certbot and .env injection
    OWNER_EMAIL:            'vladoi_ionut@yahoo.com',
    BTC_WALLET_ADDRESS:     'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',

    // Pass-through from environment (must be provided externally if available)
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
    ...(process.env.STRIPE_PRICE_STARTER_MONTHLY   ? { STRIPE_PRICE_STARTER_MONTHLY:   process.env.STRIPE_PRICE_STARTER_MONTHLY }   : {}),
    ...(process.env.STRIPE_PRICE_STARTER_YEARLY    ? { STRIPE_PRICE_STARTER_YEARLY:    process.env.STRIPE_PRICE_STARTER_YEARLY }    : {}),
    ...(process.env.STRIPE_PRICE_PRO_MONTHLY       ? { STRIPE_PRICE_PRO_MONTHLY:       process.env.STRIPE_PRICE_PRO_MONTHLY }       : {}),
    ...(process.env.STRIPE_PRICE_PRO_YEARLY        ? { STRIPE_PRICE_PRO_YEARLY:        process.env.STRIPE_PRICE_PRO_YEARLY }        : {}),
    ...(process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ? { STRIPE_PRICE_ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY } : {}),
    ...(process.env.STRIPE_PRICE_ENTERPRISE_YEARLY  ? { STRIPE_PRICE_ENTERPRISE_YEARLY:  process.env.STRIPE_PRICE_ENTERPRISE_YEARLY }  : {}),
    ...(process.env.PAYPAL_CLIENT_ID        ? { PAYPAL_CLIENT_ID:        process.env.PAYPAL_CLIENT_ID }        : {}),
    ...(process.env.PAYPAL_CLIENT_SECRET    ? { PAYPAL_CLIENT_SECRET:    process.env.PAYPAL_CLIENT_SECRET }    : {}),
    ...(process.env.PAYPAL_WEBHOOK_ID       ? { PAYPAL_WEBHOOK_ID:       process.env.PAYPAL_WEBHOOK_ID }       : {}),
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
    // ── Static app/runtime defaults (known values — always written) ─────────────
    GITHUB_REPO_OWNER:     'ruffy80',
    GITHUB_REPO_NAME:      'ZeusAI',
    GITHUB_REPO_FULL:      'ruffy80/ZeusAI',
    GITHUB_REPOSITORY:     'ruffy80/ZeusAI',
    GITHUB_DEFAULT_BRANCH: 'main',
    GITHUB_BRANCH:         'main',
    BRANCH:                'main',
    INNOV_BASE_BRANCH:     'main',
    GIT_REPO_URL:          'https://github.com/ruffy80/ZeusAI.git',
    HETZNER_BACKEND_URL:   'http://127.0.0.1:3000',
    HETZNER_APP_PORT:      '3000',
    OLLAMA_URL:            process.env.OLLAMA_URL  || 'http://localhost:11434',
    OLLAMA_MODEL:          process.env.OLLAMA_MODEL || 'llama3.2:3b-instruct-q4_K_M',
    OPENAI_MODEL:          process.env.OPENAI_MODEL    || 'gpt-4o-mini',
    DEEPSEEK_MODEL:        process.env.DEEPSEEK_MODEL  || 'deepseek-chat',
    ANTHROPIC_MODEL:       process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
    GEMINI_MODEL:          process.env.GEMINI_MODEL    || 'gemini-1.5-flash',
    MISTRAL_MODEL:         process.env.MISTRAL_MODEL   || 'mistral-small-latest',
    COHERE_MODEL:          process.env.COHERE_MODEL    || 'command-r',
    GROK_MODEL:            process.env.GROK_MODEL      || 'grok-beta',
    PAYPAL_ENV:            process.env.PAYPAL_ENV      || 'sandbox',
    ADMIN_EMAIL:           process.env.SMTP_USER       || 'vladoi_ionut@yahoo.com',
    OWNER_EMAIL:           process.env.SMTP_USER       || 'vladoi_ionut@yahoo.com',
    SITE_HEALTH_URL:       `https://${process.env.SITE_DOMAIN || 'zeusai.pro'}/health`,
    APP_BASE_URL:          `https://${process.env.SITE_DOMAIN || 'zeusai.pro'}`,
    FRONTEND_URL:          `https://${process.env.SITE_DOMAIN || 'zeusai.pro'}`,
    DOMAIN:                process.env.SITE_DOMAIN || 'zeusai.pro',
    EXEC_SERVERS:          '204.168.230.142',
    // ── User-provided secrets (pass-through — optional, write only if present) ──
    // Vault / config
    ...(process.env.VAULT_MASTER_SECRET  ? { VAULT_MASTER_SECRET:  process.env.VAULT_MASTER_SECRET }  : {}),
    ...(process.env.VAULT_EMERGENCY_CODE ? { VAULT_EMERGENCY_CODE: process.env.VAULT_EMERGENCY_CODE } : {}),
    ...(process.env.MASTER_CONFIG_SECRET ? { MASTER_CONFIG_SECRET: process.env.MASTER_CONFIG_SECRET } : {}),
    // DNS providers
    ...(process.env.SAV_API_TOKEN ? { SAV_API_TOKEN: process.env.SAV_API_TOKEN } : {}),
    // Social / marketing
    ...(process.env.TELEGRAM_BOT_TOKEN           ? { TELEGRAM_BOT_TOKEN:           process.env.TELEGRAM_BOT_TOKEN }           : {}),
    ...(process.env.TELEGRAM_CHAT_ID             ? { TELEGRAM_CHAT_ID:             process.env.TELEGRAM_CHAT_ID }             : {}),
    ...(process.env.X_BEARER_TOKEN               ? { X_BEARER_TOKEN:               process.env.X_BEARER_TOKEN }               : {}),
    ...(process.env.X_ACCESS_TOKEN               ? { X_ACCESS_TOKEN:               process.env.X_ACCESS_TOKEN }               : {}),
    ...(process.env.X_ACCESS_SECRET              ? { X_ACCESS_SECRET:              process.env.X_ACCESS_SECRET }              : {}),
    ...(process.env.YOUTUBE_API_KEY              ? { YOUTUBE_API_KEY:              process.env.YOUTUBE_API_KEY }              : {}),
    ...(process.env.YOUTUBE_OAUTH_CLIENT_ID      ? { YOUTUBE_OAUTH_CLIENT_ID:      process.env.YOUTUBE_OAUTH_CLIENT_ID }      : {}),
    ...(process.env.PINTEREST_TOKEN              ? { PINTEREST_TOKEN:              process.env.PINTEREST_TOKEN }              : {}),
    ...(process.env.PINTEREST_BOARD_ID           ? { PINTEREST_BOARD_ID:           process.env.PINTEREST_BOARD_ID }           : {}),
    ...(process.env.PRODUCTHUNT_API_KEY          ? { PRODUCTHUNT_API_KEY:          process.env.PRODUCTHUNT_API_KEY }          : {}),
    ...(process.env.PRODUCTHUNT_API_SECRET       ? { PRODUCTHUNT_API_SECRET:       process.env.PRODUCTHUNT_API_SECRET }       : {}),
    ...(process.env.PRODUCTHUNT_DEVELOPER_TOKEN  ? { PRODUCTHUNT_DEVELOPER_TOKEN:  process.env.PRODUCTHUNT_DEVELOPER_TOKEN }  : {}),
    ...(process.env.META_API_KEY                 ? { META_API_KEY:                 process.env.META_API_KEY }                 : {}),
    ...(process.env.GOOGLE_API_KEY               ? { GOOGLE_API_KEY:               process.env.GOOGLE_API_KEY }               : {}),
    ...(process.env.MICROSOFT_API_KEY            ? { MICROSOFT_API_KEY:            process.env.MICROSOFT_API_KEY }            : {}),
    ...(process.env.AMAZON_API_KEY               ? { AMAZON_API_KEY:               process.env.AMAZON_API_KEY }               : {}),
    ...(process.env.APPLE_API_KEY                ? { APPLE_API_KEY:                process.env.APPLE_API_KEY }                : {}),
    // Crypto wallets
    ...(process.env.ETH_WALLET_ADDRESS   ? { ETH_WALLET_ADDRESS:   process.env.ETH_WALLET_ADDRESS }   : {}),
    ...(process.env.USDC_WALLET_ADDRESS  ? { USDC_WALLET_ADDRESS:  process.env.USDC_WALLET_ADDRESS }  : {}),
    // Crypto exchanges
    ...(process.env.BINANCE_API_KEY  ? { BINANCE_API_KEY:  process.env.BINANCE_API_KEY }  : {}),
    ...(process.env.BINANCE_SECRET   ? { BINANCE_SECRET:   process.env.BINANCE_SECRET }   : {}),
    ...(process.env.COINBASE_API_KEY ? { COINBASE_API_KEY: process.env.COINBASE_API_KEY } : {}),
    ...(process.env.COINBASE_SECRET  ? { COINBASE_SECRET:  process.env.COINBASE_SECRET }  : {}),
    ...(process.env.KRAKEN_API_KEY   ? { KRAKEN_API_KEY:   process.env.KRAKEN_API_KEY }   : {}),
    ...(process.env.KRAKEN_SECRET    ? { KRAKEN_SECRET:    process.env.KRAKEN_SECRET }    : {}),
    ...(process.env.BYBIT_API_KEY    ? { BYBIT_API_KEY:    process.env.BYBIT_API_KEY }    : {}),
    ...(process.env.BYBIT_SECRET     ? { BYBIT_SECRET:     process.env.BYBIT_SECRET }     : {}),
    ...(process.env.OKX_API_KEY      ? { OKX_API_KEY:      process.env.OKX_API_KEY }      : {}),
    ...(process.env.OKX_SECRET       ? { OKX_SECRET:       process.env.OKX_SECRET }       : {}),
    ...(process.env.OKX_PASSWORD     ? { OKX_PASSWORD:     process.env.OKX_PASSWORD }     : {}),
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
