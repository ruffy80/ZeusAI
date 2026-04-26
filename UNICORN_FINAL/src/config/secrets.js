'use strict';

const fs = require('fs');
const path = require('path');

let ALL_SECRET_KEYS = [];
try {
  ({ ALL_SECRET_KEYS } = require('../../backend/constants/secretKeys'));
} catch (_) {
  ALL_SECRET_KEYS = [];
}

const PLACEHOLDER_RE = /^(your_|changeme$|placeholder$|skip$|xxx$|todo$)/i;
const SHELL_TEMPLATE_RE = /^\$\{([A-Z0-9_]+)(?::-(.*))?\}$/;

const ROOT = path.join(__dirname, '..', '..');
const REPO_ROOT = path.join(ROOT, '..');

const ENV_FILES = [
  path.join(REPO_ROOT, '.env.auto-connector'),
  path.join(ROOT, '.env.auto-connector'),
  path.join(REPO_ROOT, '.env.local'),
  path.join(ROOT, '.env.local'),
  path.join(REPO_ROOT, '.env'),
  path.join(ROOT, '.env'),
];

const ALIASES = {
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
  HETZNER_HOST: ['SSH_HOST'],
  SSH_HOST: ['HETZNER_HOST'],
  HETZNER_SSH_PRIVATE_KEY: ['SSH_PRIVATE_KEY'],
  SSH_PRIVATE_KEY: ['HETZNER_SSH_PRIVATE_KEY'],
  HF_API_KEY: ['HUGGINGFACE_API_KEY'],
  HUGGINGFACE_API_KEY: ['HF_API_KEY'],
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
};

function configured(name) {
  const value = String(process.env[name] || '').trim();
  return !!(value && value.length > 6 && !PLACEHOLDER_RE.test(value) && !SHELL_TEMPLATE_RE.test(value));
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
    if (expanded && expanded !== value) {
      process.env[name] = expanded;
      resolved[name] = 'shell-template';
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
  const resolved = { ...materializeEnvTemplates(), ...normalizeAliases() };
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

module.exports = { bootstrap, configured, FEATURE_GROUPS };