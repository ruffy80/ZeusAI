// PM2 Ecosystem Config — UNICORN_FINAL (LEAN, AUTO-PATH)
// -----------------------------------------------------------------------------
// Paths are ALWAYS relative to this file (`__dirname`). Never hard-code absolute
// paths — deployments land under /var/www/unicorn/UNICORN_FINAL on Hetzner but
// may run from anywhere locally. Hard-coded paths caused the crash-loop from
// /root/.unicorn_temp/ historically; never again.
// -----------------------------------------------------------------------------
// Start all:    pm2 start ecosystem.config.js --update-env
// Restart all:  pm2 restart all
// Save startup: pm2 save && pm2 startup

'use strict';

const path = require('path');
const APP_DIR = __dirname;
const SNAP_DIR = path.join(APP_DIR, 'snapshots');

// Backend runs in FORK mode with 1 instance. SQLite (data/unicorn.db) and
// many in-memory singletons (orchestrator, cron, sidecars) are NOT safe under
// PM2 cluster — two workers silently deadlock on sqlite file locks and exit
// without writing to stderr. Keep fork/1 until the backend is cluster-safe.
const BACKEND_INSTANCES = Number(process.env.UNICORN_INSTANCES || 1);
const BACKEND_MEM = process.env.PM2_MAX_MEMORY || '1024M';

module.exports = {
  apps: [
    // ── 1. Backend API — fork mode, single instance ──────────────────────────
    {
      name: 'unicorn-backend',
      script: 'backend/index.js',
      cwd: APP_DIR,
      exec_mode: 'fork',
      instances: BACKEND_INSTANCES,
      max_memory_restart: BACKEND_MEM,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '30s',
      restart_delay: 3000,
      kill_timeout: 8000,
      listen_timeout: 10000,
      wait_ready: false,
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        UNICORN_RUNTIME_PROFILE: 'safe',
        // ── SELF-MUTATORS — DISABLED PERMANENTLY ────────────────────────────
        // These used to rewrite backend source files on the fly (auto-repair,
        // self-construction, ui-autobuilder, code-optimizer). They corrupted
        // JS syntax → crash-loop → more mutations → worse corruption. Never.
        ENABLE_FILE_MUTATORS: '0',
        ENABLE_AUTO_DEPLOY: '0',
        ENABLE_UI_AUTOBUILDER: '0',
        ENABLE_AUTO_REPAIR: '0',
        ENABLE_SELF_CONSTRUCTION: '0',
        ENABLE_CODE_OPTIMIZER: '0',
        ENABLE_AUTO_EVOLVE: '0',
        ENABLE_AUTO_RESTART: '0',
        DISABLE_SELF_MUTATION: '1',
        QIS_AUTO_HEAL_ENABLED: 'false',
        PORT: 3000,
        DOMAIN: 'zeusai.pro',
        SITE_DOMAIN: 'zeusai.pro',
        PUBLIC_APP_URL: 'https://zeusai.pro',
        CORS_ORIGINS: 'https://zeusai.pro,https://www.zeusai.pro',
        BTC_WALLET_ADDRESS: 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
        OWNER_NAME: 'Vladoi Ionut',
        OWNER_EMAIL: 'vladoi_ionut@yahoo.com',
        ADMIN_EMAIL: 'vladoi_ionut@yahoo.com',
        HETZNER_BACKEND_URL: 'http://127.0.0.1:3000',
        // ── AI Provider API Keys (read from system env at spawn time) ──────
        OPENAI_API_KEY:      process.env.OPENAI_API_KEY      || '',
        DEEPSEEK_API_KEY:    process.env.DEEPSEEK_API_KEY    || '',
        ANTHROPIC_API_KEY:   process.env.ANTHROPIC_API_KEY   || '',
        GEMINI_API_KEY:      process.env.GEMINI_API_KEY      || '',
        MISTRAL_API_KEY:     process.env.MISTRAL_API_KEY     || '',
        COHERE_API_KEY:      process.env.COHERE_API_KEY      || '',
        XAI_API_KEY:         process.env.XAI_API_KEY         || '',
        GROQ_API_KEY:        process.env.GROQ_API_KEY        || '',
        OPENROUTER_API_KEY:  process.env.OPENROUTER_API_KEY  || '',
        HF_API_KEY:          process.env.HF_API_KEY          || '',
        HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || '',
        PERPLEXITY_API_KEY:  process.env.PERPLEXITY_API_KEY  || '',
        TOGETHER_API_KEY:    process.env.TOGETHER_API_KEY    || '',
        FIREWORKS_API_KEY:   process.env.FIREWORKS_API_KEY   || '',
        SAMBANOVA_API_KEY:   process.env.SAMBANOVA_API_KEY   || '',
        NVIDIA_NIM_API_KEY:  process.env.NVIDIA_NIM_API_KEY  || '',
        // ── AI Smart Cache ─────────────────────────────────────────────────
        AI_CACHE_TTL_MS:        '120000',
        AI_CACHE_MAX_ENTRIES:   '1000',
        AI_CACHE_MAX_BYTES:     '52428800',
        AI_CACHE_TTL_EMBEDDING: '3600000',
        AI_CACHE_TTL_REASONING: '300000',
        // ── Payment — PayPal + BTC ─────────────────────────────────────────
        PAYPAL_CLIENT_ID:     process.env.PAYPAL_CLIENT_ID     || '',
        PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
        PAYPAL_ENV:           process.env.PAYPAL_ENV           || 'sandbox',
        PAYPAL_WEBHOOK_ID:    process.env.PAYPAL_WEBHOOK_ID    || '',
        LEGAL_OWNER_BTC:      'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
      },
      error_file: 'logs/pm2-error.log',
      out_file:   'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── 2. Static/SSR site (serves HTML portal + SSE, CLUSTER MODE) ────────────
    {
      name: 'unicorn-site',
      script: 'src/index.js',
      cwd: APP_DIR,
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '384M',
      // Match the resilience profile of unicorn-backend: PM2 must not give
      // up on the site after a transient flap. The site has its own
      // uncaughtException/unhandledRejection guards in src/index.js so true
      // crashes are rare; what we want here is enough headroom that a noisy
      // upstream (e.g. backend boot in progress, AI provider 5xx) cannot
      // exhaust the restart budget and leave the worker permanently stopped.
      max_restarts: 30,
      restart_delay: 5000,
      exp_backoff_restart_delay: 2000,
      watch: false,
      min_uptime: '30s',
      kill_timeout: 8000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        BACKEND_API_URL: 'http://127.0.0.1:3000',
        DOMAIN: 'zeusai.pro',
        SITE_DOMAIN: 'zeusai.pro',
        PUBLIC_APP_URL: 'https://zeusai.pro',
        // ── AI Provider API Keys — site needs them too because /api/ai/registry
        // and /api/ai/use have local fallbacks in src/index.js when the backend
        // is unreachable, and because some site-layer modules (UAIC, USE) read
        // process.env.<PROVIDER>_API_KEY directly. Mirror everything from the
        // backend block so site has full 24/7 access to the same providers.
        OPENAI_API_KEY:      process.env.OPENAI_API_KEY      || '',
        DEEPSEEK_API_KEY:    process.env.DEEPSEEK_API_KEY    || '',
        ANTHROPIC_API_KEY:   process.env.ANTHROPIC_API_KEY   || '',
        GEMINI_API_KEY:      process.env.GEMINI_API_KEY      || '',
        MISTRAL_API_KEY:     process.env.MISTRAL_API_KEY     || '',
        COHERE_API_KEY:      process.env.COHERE_API_KEY      || '',
        XAI_API_KEY:         process.env.XAI_API_KEY         || '',
        GROQ_API_KEY:        process.env.GROQ_API_KEY        || '',
        OPENROUTER_API_KEY:  process.env.OPENROUTER_API_KEY  || '',
        HF_API_KEY:          process.env.HF_API_KEY          || '',
        HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || '',
        PERPLEXITY_API_KEY:  process.env.PERPLEXITY_API_KEY  || '',
        TOGETHER_API_KEY:    process.env.TOGETHER_API_KEY    || '',
        FIREWORKS_API_KEY:   process.env.FIREWORKS_API_KEY   || '',
        SAMBANOVA_API_KEY:   process.env.SAMBANOVA_API_KEY   || '',
        NVIDIA_NIM_API_KEY:  process.env.NVIDIA_NIM_API_KEY  || '',
      },
      error_file: 'logs/site-error.log',
      out_file:   'logs/site-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── 4. Autoscaler (auto-restart, log scaling) ─────────────────────────────
    {
      name: 'autoscaler',
      script: 'scripts/autoscale.js',
      cwd: APP_DIR,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/autoscale-error.log',
      out_file:   'logs/autoscale-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── 3. Guardian — DISABLED (set UNICORN_GUARDIAN=1 to enable) ────────────
    // Guardian keeps tar snapshots and performs auto-rollback by extracting
    // the last "known-good" tarball over the app dir. If the baseline snapshot
    // was taken while sources were incomplete (e.g. mid-deploy), every tick
    // wipes freshly-deployed files → infinite rollback loop. It MUST NOT be
    // started until backend+site have been stable for ≥ 5 min with a full
    // source tree so the baseline tarball is valid.
    ...((process.env.UNICORN_GUARDIAN || '0') === '1' ? [{
      name: 'unicorn-guardian',
      script: 'scripts/unicorn-guardian.js',
      cwd: APP_DIR,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '60s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        APP_DIR,
        SNAP_DIR,
        CHECK_MS: '60000',
        BACKEND: 'http://127.0.0.1:3000/api/health',
        SITE: 'http://127.0.0.1:3001/',
        SITE_HEAL: 'http://127.0.0.1:3001/health',
        MIN_RATIO: '0.98',
        PM2_APPS: 'unicorn-backend unicorn-site',
      },
      error_file: 'logs/guardian-error.log',
      out_file:   'logs/guardian-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }] : []),
  ],
};
