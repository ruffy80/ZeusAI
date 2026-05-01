'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let ALL_SECRET_KEYS = [];
try {
  ({ ALL_SECRET_KEYS } = require('../../backend/constants/secretKeys'));
} catch (_) {
  ALL_SECRET_KEYS = [];
}

const PLACEHOLDER_RE = /^(your_|replace_with_|change[-_]?me$|changeme$|placeholder$|skip$|xxx+$|todo$|example$|default$|generate[-_]?random)/i;
const SHELL_TEMPLATE_RE = /^\$\{([A-Z0-9_]+)(?::-(.*))?\}$/;

const ROOT = path.join(__dirname, '..', '..');
const REPO_ROOT = path.join(ROOT, '..');
const RUNTIME_SECRETS_FILE = process.env.UNICORN_RUNTIME_SECRETS_FILE || path.join(ROOT, 'data', 'runtime-secrets.json');

const ENV_FILES = [
  path.join(REPO_ROOT, '.env.auto-connector'),
  path.join(ROOT, '.env.auto-connector'),
  path.join(REPO_ROOT, '.env.local'),
  path.join(ROOT, '.env.local'),
  path.join(REPO_ROOT, '.env'),
  path.join(ROOT, '.env'),
];

const ALIASES = {
  ADMIN_SECRET: ['ADMIN_TOKEN'],
  ADMIN_TOKEN: ['ADMIN_SECRET'],
  WEBHOOK_SECRET: ['HETZNER_WEBHOOK_SECRET'],
  HETZNER_WEBHOOK_SECRET: ['WEBHOOK_SECRET'],
  COMMERCE_ADMIN_SECRET: ['ADMIN_SECRET', 'ADMIN_TOKEN'],
  ANCHOR_WEBHOOK_TOKEN: ['WEBHOOK_SECRET', 'HETZNER_WEBHOOK_SECRET'],
  BTC_WALLET_ADDRESS: ['OWNER_BTC_ADDRESS', 'LEGAL_OWNER_BTC'],
  OWNER_BTC_ADDRESS: ['BTC_WALLET_ADDRESS', 'LEGAL_OWNER_BTC'],
  LEGAL_OWNER_BTC: ['BTC_WALLET_ADDRESS', 'OWNER_BTC_ADDRESS'],
  OWNER_EMAIL: ['ADMIN_EMAIL', 'LEGAL_OWNER_EMAIL', 'SMTP_USER'],
  LEGAL_OWNER_EMAIL: ['OWNER_EMAIL', 'ADMIN_EMAIL', 'SMTP_USER'],
  OWNER_NAME: ['LEGAL_OWNER_NAME'],
  LEGAL_OWNER_NAME: ['OWNER_NAME'],
  PUBLIC_APP_URL: ['APP_BASE_URL', 'FRONTEND_URL'],
  APP_BASE_URL: ['PUBLIC_APP_URL', 'FRONTEND_URL'],
  FRONTEND_URL: ['PUBLIC_APP_URL', 'APP_BASE_URL'],
  HETZNER_DEPLOY_USER: ['HETZNER_USER', 'SSH_USER'],
  HETZNER_USER: ['HETZNER_DEPLOY_USER', 'SSH_USER'],
  SSH_USER: ['HETZNER_DEPLOY_USER', 'HETZNER_USER'],
  HETZNER_HOST: ['SSH_HOST'],
  SSH_HOST: ['HETZNER_HOST'],
  HETZNER_SSH_PRIVATE_KEY: ['SSH_PRIVATE_KEY'],
  SSH_PRIVATE_KEY: ['HETZNER_SSH_PRIVATE_KEY'],
  HETZNER_DEPLOY_PATH: ['DEPLOY_PATH'],
  DEPLOY_PATH: ['HETZNER_DEPLOY_PATH'],
  GITHUB_TOKEN: ['GH_PAT', 'GITHUB_TOKEN_SYNC'],
  GH_PAT: ['GITHUB_TOKEN', 'GITHUB_TOKEN_SYNC'],
  HF_API_KEY: ['HUGGINGFACE_API_KEY'],
  HUGGINGFACE_API_KEY: ['HF_API_KEY'],
  ANTHROPIC_API_KEY: ['CLAUDE_API_KEY'],
  CLAUDE_API_KEY: ['ANTHROPIC_API_KEY'],
  GEMINI_API_KEY: ['GOOGLE_API_KEY'],
  GOOGLE_API_KEY: ['GEMINI_API_KEY'],
  BTCPAY_API_KEY: ['BTCPAY_TOKEN'],
  BTCPAY_TOKEN: ['BTCPAY_API_KEY'],
};

const DEFAULT_VALUES = {
  BTC_WALLET_ADDRESS: 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
  OWNER_EMAIL: 'vladoi_ionut@yahoo.com',
  OWNER_NAME: 'Vladoi Ionut',
  PUBLIC_APP_URL: 'https://zeusai.pro',
  DOMAIN: 'zeusai.pro',
  PAYPAL_ENV: 'live',
};

const GENERATED_INTERNAL_SECRETS = {
  JWT_SECRET: () => token('jwt'),
  ADMIN_SECRET: () => token('admin'),
  ADMIN_MASTER_PASSWORD: () => `Unicorn-${token('pwd', 18)}!`,
  ADMIN_2FA_CODE: () => String(crypto.randomInt(100000, 999999)),
  WEBHOOK_SECRET: () => token('webhook'),
  VAULT_MASTER_SECRET: () => token('vault'),
  VAULT_EMERGENCY_CODE: () => token('unlock'),
  MASTER_CONFIG_SECRET: () => token('config'),
  REFERRAL_SECRET: () => token('referral', 40),
};

const FEATURE_GROUPS = {
  coreRuntime: ['JWT_SECRET', 'ADMIN_SECRET', 'ADMIN_MASTER_PASSWORD'],
  btcDirectRevenue: ['BTC_WALLET_ADDRESS'],
  deploySync: ['HETZNER_HOST', 'HETZNER_DEPLOY_USER', 'HETZNER_SSH_PRIVATE_KEY'],
  aiRouter: ['GROQ_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'DEEPSEEK_API_KEY'],
  optionalPayments: ['NOWPAYMENTS_API_KEY', 'NOWPAYMENTS_IPN_SECRET', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'BTCPAY_SERVER_URL', 'BTCPAY_API_KEY', 'BTCPAY_STORE_ID'],
  email: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
  observability: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
  vault: ['VAULT_MASTER_SECRET', 'VAULT_EMERGENCY_CODE', 'MASTER_CONFIG_SECRET'],
  socialDistribution: ['X_BEARER_TOKEN', 'TELEGRAM_BOT_TOKEN', 'PINTEREST_TOKEN', 'DEV_API_KEY', 'YOUTUBE_API_KEY', 'PRODUCTHUNT_DEVELOPER_TOKEN'],
  referralEngine: ['REFERRAL_SECRET'],
  jwtRotation: ['JWT_SECRET', 'JWT_SECRET_PREVIOUS'],
};

function configured(name) {
  const value = String(process.env[name] || '').trim();
  return !!(value && !PLACEHOLDER_RE.test(value) && !SHELL_TEMPLATE_RE.test(value));
}

function token(prefix, length = 36) {
  return `${prefix}_${crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64url').slice(0, length)}`;
}

function expandShellTemplate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(SHELL_TEMPLATE_RE);
  if (!match) return raw;
  const [, sourceName, fallback = ''] = match;
  return configured(sourceName) ? process.env[sourceName] : fallback;
}

function materializeEnvTemplates() {
  const resolved = {};
  const names = new Set([...ALL_SECRET_KEYS, ...Object.keys(ALIASES), ...Object.values(ALIASES).flat()]);
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (!SHELL_TEMPLATE_RE.test(value)) continue;
    const expanded = expandShellTemplate(value);
    if (expanded !== value) {
      process.env[name] = expanded;
      resolved[name] = 'shell-template';
    }
  }
  return resolved;
}

function applyDefaults() {
  const resolved = {};
  for (const [name, value] of Object.entries(DEFAULT_VALUES)) {
    if (!configured(name)) {
      process.env[name] = value;
      resolved[name] = 'default';
    }
  }
  return resolved;
}

function loadGeneratedSecrets() {
  if (!fs.existsSync(RUNTIME_SECRETS_FILE)) return {};
  try {
    const generated = JSON.parse(fs.readFileSync(RUNTIME_SECRETS_FILE, 'utf8'));
    const resolved = {};
    for (const [name, value] of Object.entries(generated)) {
      if (GENERATED_INTERNAL_SECRETS[name] && !configured(name) && value) {
        process.env[name] = String(value);
        resolved[name] = 'runtime-store';
      }
    }
    return resolved;
  } catch (_) {
    return {};
  }
}

function saveGeneratedSecrets(values) {
  try {
    fs.mkdirSync(path.dirname(RUNTIME_SECRETS_FILE), { recursive: true });
    fs.writeFileSync(RUNTIME_SECRETS_FILE, JSON.stringify(values, null, 2) + '\n', { mode: 0o600 });
  } catch (_) {
    // Runtime can still continue with process-local generated secrets.
  }
}

function generateMissingInternalSecrets(options = {}) {
  const resolved = {};
  const persist = options.persistGenerated ?? process.env.NODE_ENV === 'production';
  const stored = fs.existsSync(RUNTIME_SECRETS_FILE)
    ? (() => { try { return JSON.parse(fs.readFileSync(RUNTIME_SECRETS_FILE, 'utf8')); } catch (_) { return {}; } })()
    : {};
  let changed = false;
  for (const [name, factory] of Object.entries(GENERATED_INTERNAL_SECRETS)) {
    if (configured(name)) continue;
    const value = stored[name] || factory();
    process.env[name] = value;
    stored[name] = value;
    resolved[name] = stored[name] === value ? 'generated' : 'runtime-store';
    changed = true;
  }
  if (persist && changed) saveGeneratedSecrets(stored);
  return resolved;
}

function composeDerivedValues() {
  const resolved = {};
  if (!configured('DOMAIN') && configured('PUBLIC_APP_URL')) {
    process.env.DOMAIN = String(process.env.PUBLIC_APP_URL).replace(/^https?:\/\//, '').replace(/\/+$/, '');
    resolved.DOMAIN = 'PUBLIC_APP_URL';
  }
  if (!configured('BACKEND_API_URL') && process.env.NODE_ENV === 'production') {
    process.env.BACKEND_API_URL = 'http://127.0.0.1:3000';
    resolved.BACKEND_API_URL = 'production-default';
  }
  if (!configured('SMTP_FROM') && configured('OWNER_EMAIL')) {
    process.env.SMTP_FROM = process.env.OWNER_EMAIL;
    resolved.SMTP_FROM = 'OWNER_EMAIL';
  }
  if (!configured('EMAIL_FROM_NAME') && configured('OWNER_NAME')) {
    process.env.EMAIL_FROM_NAME = process.env.OWNER_NAME;
    resolved.EMAIL_FROM_NAME = 'OWNER_NAME';
  }
  if (!configured('SMTP_URL') && configured('SMTP_HOST') && configured('SMTP_USER') && configured('SMTP_PASS')) {
    const port = process.env.SMTP_PORT || '587';
    process.env.SMTP_URL = `smtp://${encodeURIComponent(process.env.SMTP_USER)}:${encodeURIComponent(process.env.SMTP_PASS)}@${process.env.SMTP_HOST}:${port}`;
    resolved.SMTP_URL = 'smtp-parts';
  }
  if (configured('GITHUB_REPOSITORY')) {
    const [owner, repo] = String(process.env.GITHUB_REPOSITORY).split('/');
    if (owner && repo) {
      if (!configured('GITHUB_OWNER')) { process.env.GITHUB_OWNER = owner; resolved.GITHUB_OWNER = 'GITHUB_REPOSITORY'; }
      if (!configured('GITHUB_REPO')) { process.env.GITHUB_REPO = repo; resolved.GITHUB_REPO = 'GITHUB_REPOSITORY'; }
      if (!configured('GITHUB_REPO_FULL')) { process.env.GITHUB_REPO_FULL = process.env.GITHUB_REPOSITORY; resolved.GITHUB_REPO_FULL = 'GITHUB_REPOSITORY'; }
    }
  }
  return resolved;
}

function loadDotenvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    require('dotenv').config({ path: filePath, override: false });
    return path.relative(ROOT, filePath) || filePath;
  } catch (_) {
    return null;
  }
}

function normalizeAliases() {
  const resolved = {};
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (!configured(canonical)) {
      const source = aliases.find(configured);
      if (source) {
        process.env[canonical] = process.env[source];
        resolved[canonical] = source;
      }
    }
    if (configured(canonical)) {
      for (const alias of aliases) {
        if (!configured(alias)) {
          process.env[alias] = process.env[canonical];
          resolved[alias] = canonical;
        }
      }
    }
  }
  return resolved;
}

function groupStatus(names) {
  const items = names.map((name) => ({ name, configured: configured(name) }));
  const configuredCount = items.filter((item) => item.configured).length;
  return {
    configured: configuredCount,
    total: names.length,
    ready: configuredCount === names.length,
    items,
    missing: items.filter((item) => !item.configured).map((item) => item.name),
  };
}

function bootstrap(options = {}) {
  const loaded = ENV_FILES.map(loadDotenvFile).filter(Boolean);
  const resolved = {
    ...materializeEnvTemplates(),
    ...applyDefaults(),
    ...normalizeAliases(),
    ...composeDerivedValues(),
    ...loadGeneratedSecrets(),
    ...normalizeAliases(),
    ...generateMissingInternalSecrets(options),
    ...normalizeAliases(),
    ...composeDerivedValues(),
  };
  const features = Object.fromEntries(Object.entries(FEATURE_GROUPS).map(([name, keys]) => [name, groupStatus(keys)]));
  const knownConfigured = ALL_SECRET_KEYS.filter(configured);
  const summary = {
    totalKnownSecrets: ALL_SECRET_KEYS.length,
    configuredKnownSecrets: knownConfigured.length,
    btcDirectReady: features.btcDirectRevenue.ready,
    deploySyncReady: features.deploySync.ready,
    coreRuntimeReady: features.coreRuntime.configured >= 2,
    optionalPaymentProvidersReady: features.optionalPayments.configured,
  };
  if (options.log) {
    console.log('[secrets] bootstrap loaded', loaded.length, 'env files · resolved aliases', Object.keys(resolved).length, '· configured known', `${knownConfigured.length}/${ALL_SECRET_KEYS.length}`);
  }
  return { loaded, resolved, features, summary };
}

function features() {
  return Object.fromEntries(Object.entries(FEATURE_GROUPS).map(([name, keys]) => [name, groupStatus(keys)]));
}

function getSecret(name, fallback = '') {
  if (configured(name)) return String(process.env[name]);
  // Try aliases.
  const aliases = ALIASES[name] || [];
  for (const alias of aliases) {
    if (configured(alias)) return String(process.env[alias]);
  }
  return fallback;
}

function requireSecret(name) {
  const v = getSecret(name);
  if (!v) throw new Error(`secret_missing:${name}`);
  return v;
}

module.exports = { bootstrap, configured, features, getSecret, requireSecret, FEATURE_GROUPS, ALIASES, DEFAULT_VALUES };