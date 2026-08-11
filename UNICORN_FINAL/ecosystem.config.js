// PM2 Ecosystem Config — UNICORN_FINAL (LEAN, AUTO-PATH) — re-deploy 2026-05-19T21:11
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
const SITE_INSTANCES = Number(process.env.SITE_INSTANCES || 1);
// Golden rule #7: backend memory ceiling >= 2560M (real RSS w/ ADI-Core +
// world-scanner + 50+ in-memory modules sits around 1.4–2GB). Lowering this
// below 2560M causes SIGKILL crash-loops within minutes of boot.
const BACKEND_MEM = process.env.PM2_MAX_MEMORY || '2560M';

// Fulfillment AI Eternal OS: never pin empty-string secrets into PM2 env.
// Empty pins wipe dotenv-loaded keys (and get deleted by placeholder scrubbers),
// leaving providers "configured:false" even when shared/.env has real keys.
// Only forward a key when the parent shell already has a non-empty value;
// otherwise let process dotenv + sanctum reload fill it at boot/call-time.
function envIfSet(keys) {
  const out = {};
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== '') out[k] = v;
  }
  return out;
}

const AI_KEY_ENV_NAMES = [
  'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
  'MISTRAL_API_KEY', 'COHERE_API_KEY', 'XAI_API_KEY', 'GROQ_API_KEY',
  'OPENROUTER_API_KEY', 'HF_API_KEY', 'HUGGINGFACE_API_KEY', 'PERPLEXITY_API_KEY',
  'TOGETHER_API_KEY', 'FIREWORKS_API_KEY', 'SAMBANOVA_API_KEY', 'NVIDIA_NIM_API_KEY',
];

const FULFILLMENT_AI_ENV = {
  // auto = armed forever when ≥1 real LLM key exists (Key Continuum).
  FULFILLMENT_AI_ENABLED: process.env.FULFILLMENT_AI_ENABLED || 'auto',
  ...(process.env.FULFILLMENT_AI_SKUS
    ? { FULFILLMENT_AI_SKUS: process.env.FULFILLMENT_AI_SKUS }
    : {}),
};

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
        // ── RUNTIME PROFILE ─────────────────────────────────────────────────
        // 'safe' / 'stable' (DEFAULT): business loops paused. Growth-engine
        //   routes (/api/growth/*, /sitemap.xml, /robots.txt) stay mounted
        //   unconditionally — distribution is always live, even in safe mode.
        // 'growth': adds revenue autopilot, innovation, viral, central-
        //   orchestrator, self-healing loops. Heavy: ~1.5GB RSS, 100%+ CPU
        //   on single Hetzner node; only enable on multi-node or upgraded
        //   instance. Set on host via /etc/profile.d/zeusai.sh.
        // 'full': everything ON including file mutators (DANGEROUS, dev-only).
        // Default stable on single-node VPS — growth profile + in-process ZeroDT
        // previously suicide-looped unicorn-backend via pm2 restart-from-inside.
        UNICORN_RUNTIME_PROFILE: process.env.UNICORN_RUNTIME_PROFILE || 'stable',
        ZDT_ENABLED: process.env.ZDT_ENABLED || '0',
        // ── SELF-MUTATORS — DEFAULT VALUE DETERMINED BY PROFILE ──────────────
        ENABLE_FILE_MUTATORS: process.env.ENABLE_FILE_MUTATORS || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '1' : '0'),
        ENABLE_AUTO_DEPLOY: process.env.ENABLE_AUTO_DEPLOY || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '1' : '0'),
        ENABLE_UI_AUTOBUILDER: process.env.ENABLE_UI_AUTOBUILDER || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '1' : '0'),
        ENABLE_AUTO_REPAIR: process.env.ENABLE_AUTO_REPAIR || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '1' : '0'),
        ENABLE_SELF_CONSTRUCTION: process.env.ENABLE_SELF_CONSTRUCTION || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '1' : '0'),
        ENABLE_CODE_OPTIMIZER: process.env.ENABLE_CODE_OPTIMIZER || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '1' : '0'),
        ENABLE_AUTO_EVOLVE: process.env.ENABLE_AUTO_EVOLVE || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '1' : '0'),
        ENABLE_AUTO_RESTART: process.env.ENABLE_AUTO_RESTART || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '1' : '0'),
        DISABLE_SELF_MUTATION: process.env.DISABLE_SELF_MUTATION || ((process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase() === 'growth' ? '0' : '1'),
        // ── GROWTH ENGINE — public payment links (read-only Stripe URLs) ────
        // Generate at https://dashboard.stripe.com/payment-links and paste
        // here OR set on host via /etc/profile.d/zeusai.sh. Without these,
        // the homepage falls back to BTC-only checkout (current behavior).
        STRIPE_PAYMENT_LINK_STARTER: process.env.STRIPE_PAYMENT_LINK_STARTER || '',
        STRIPE_PAYMENT_LINK_PRO:     process.env.STRIPE_PAYMENT_LINK_PRO     || '',
        STRIPE_PAYMENT_LINK_SCALE:   process.env.STRIPE_PAYMENT_LINK_SCALE   || '',
        // Revenue-Share-as-a-Service: % of incremental revenue we take instead
        // of upfront fee. SMBs love this; enterprises don't qualify.
        REVENUE_SHARE_PCT: process.env.REVENUE_SHARE_PCT || '30',
        REVENUE_SHARE_MIN_MRR_USD: process.env.REVENUE_SHARE_MIN_MRR_USD || '0',
        // Auto-attest every approved innovation on the sovereign ed25519
        // ledger. Makes evolution publicly verifiable for 30+ years.
        GROWTH_AUTO_ATTEST_INNOVATIONS: process.env.GROWTH_AUTO_ATTEST_INNOVATIONS || '1',
        // Default OFF: QIS "auto-heal" + external healers previously suicide-
        // looped cold boots (health timeout → restart → never finish warmup).
        // Enable explicitly on the host via QIS_AUTO_HEAL_ENABLED=true only
        // after cold-boot settle is proven stable.
        QIS_AUTO_HEAL_ENABLED: process.env.QIS_AUTO_HEAL_ENABLED || 'false',
        QIS_REQUIRED_PROCESSES: 'unicorn-backend,unicorn-site',
        // Ops dashboard used to execSync('pm2 jlist') on every /api/ops/dashboard
        // poll and freeze the event loop (live outage 2026-08-11). Keep the
        // async path's boot-grace + short TTL cache on in production so cold
        // boots and healer bursts cannot re-block /api/health.
        OPS_PM2_BOOT_GRACE_MS: process.env.OPS_PM2_BOOT_GRACE_MS || '180000',
        OPS_PM2_CACHE_TTL_MS: process.env.OPS_PM2_CACHE_TTL_MS || '15000',
        // Default ON for single-node 8GB: execSync(pm2 jlist) freezes /api/health.
        OPS_PM2_CHECK_DISABLED: process.env.OPS_PM2_CHECK_DISABLED || '1',
        // Loops that still run under stable and starve the event loop on one VPS.
        AACOS_DISABLED: process.env.AACOS_DISABLED || '1',
        TAOS_DISABLED: process.env.TAOS_DISABLED || '1',
        GROWTH_STACK_DISABLED: process.env.GROWTH_STACK_DISABLED || '1',
        ADI_CORE_DISABLED: process.env.ADI_CORE_DISABLED || '1',
        DEEPSEEK_LOOP_ENABLED: process.env.DEEPSEEK_LOOP_ENABLED || '0',
        UNICORN_REVENUE_AUTOPILOT_DISABLED: process.env.UNICORN_REVENUE_AUTOPILOT_DISABLED || '1',
        WATCHDOG_DISABLED: process.env.WATCHDOG_DISABLED || '1',
        // ZACC dropship continuum is heavy at boot; keep commerce catalog via
        // existing DB/shelf. Re-arm with ZACC_ENABLED=1 after money path is green.
        ZACC_ENABLED: process.env.ZACC_ENABLED || '0',
        ZACC_ENABLE_ESCUELA: process.env.ZACC_ENABLE_ESCUELA || '0',
        ZACC_WORLD_CONTINUUM_MS: process.env.ZACC_WORLD_CONTINUUM_MS || '3600000',
        IAK_HARMONIC_MS: process.env.IAK_HARMONIC_MS || '120000',
        IAK_SYNC_EVERY: process.env.IAK_SYNC_EVERY || '30',
        IAK_CONTINUUM_EVERY: process.env.IAK_CONTINUUM_EVERY || '60',
        // PCL / BALOS — default off under stable (see profit-control-loop + index.js)
        PCL_DISABLED: process.env.PCL_DISABLED || '1',
        PROFIT_LOOP_AUTOSTART: process.env.PROFIT_LOOP_AUTOSTART || '0',
        DISABLE_BILLION_AUTONOMY_LOOP: process.env.DISABLE_BILLION_AUTONOMY_LOOP || '1',
        // Innovation generation + auto-ship OFF under safe/stable (Commercial Cycle).
        // Arm only after money path is proven: INNOVATION_GENERATE=1 + INNOVATION_AUTO_SHIP=1
        // under UNICORN_RUNTIME_PROFILE=growth.
        INNOVATION_AUTO_SHIP: process.env.INNOVATION_AUTO_SHIP || '0',
        INNOVATION_GENERATE: process.env.INNOVATION_GENERATE || '0',
        // Fulfillment AI Eternal OS — default auto (armed when keys exist).
        // Optional allowlist: FULFILLMENT_AI_SKUS=instant-seo-content-pack,...
        ...FULFILLMENT_AI_ENV,
        // ── AUTH-GUARDIAN: DISABLED PERMANENTLY ────────────────────────
        // auth-guardian probes /api/auth/test and on failure runs
        // scripts/auth-repair.js, which UNCONDITIONALLY calls
        // `pm2 restart unicorn-backend` at the end of every run. With
        // missing test credentials the probe always fails → infinite
        // restart loop (~12s cycle) → backend never stays up. Re-enable
        // only after AUTH_GUARDIAN_TEST_EMAIL + AUTH_GUARDIAN_TEST_PASSWORD
        // are configured and auth-repair.js no longer self-restarts.
        AUTH_GUARDIAN_ENABLED: '0',
        // ── SERVICE-WATCHDOG: opt-in autostart in production ──────────────
        // The watchdog module (backend/modules/service-watchdog.js) is now
        // standby-by-default to avoid require()-time spam when other modules
        // (totalSystemHealer cron) re-pull it. Production explicitly turns
        // it on here. Probe URL is auto-resolved from PORT below, but we
        // pin it for clarity. Override per-host via WATCHDOG_DISABLED=1.
        WATCHDOG_AUTOSTART: process.env.WATCHDOG_AUTOSTART || '0',
        WATCHDOG_BACKEND_URL: process.env.WATCHDOG_BACKEND_URL || 'http://127.0.0.1:3000/api/health',
        WATCHDOG_INTERVAL_MS: process.env.WATCHDOG_INTERVAL_MS || '30000',
        WATCHDOG_FAIL_THRESHOLD: process.env.WATCHDOG_FAIL_THRESHOLD || '3',
        WATCHDOG_LOG_DEDUP_AFTER: process.env.WATCHDOG_LOG_DEDUP_AFTER || '3',
        PORT: 3000,
        // Hardening: bind backend to loopback only. Nginx fronts every public
        // request via http://127.0.0.1:3000. The smoke-test step already hits
        // 127.0.0.1:3000 from inside the box (deploy.yml). Override with
        // BIND_HOST=0.0.0.0 only for ad-hoc debugging.
        BIND_HOST: process.env.BIND_HOST || '127.0.0.1',
        DOMAIN: 'zeusai.pro',
        SITE_DOMAIN: 'zeusai.pro',
        PUBLIC_APP_URL: 'https://zeusai.pro',
        CORS_ORIGINS: 'https://zeusai.pro,https://www.zeusai.pro',
        BTC_WALLET_ADDRESS: 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
        OWNER_NAME: 'Vladoi Ionut',
        OWNER_EMAIL: 'vladoi_ionut@yahoo.com',
        ADMIN_EMAIL: 'vladoi_ionut@yahoo.com',
        HETZNER_BACKEND_URL: 'http://127.0.0.1:3000',
        // ── Build identity — written by CI deploy, kept static at runtime ──
        ZEUS_BUILD_SHA: process.env.ZEUS_BUILD_SHA || '',
        SW_VERSION:     process.env.ZEUS_BUILD_SHA || process.env.SW_VERSION || '',
        // ── Forever-key: persist Ed25519 site signing key OUTSIDE the release dir
        // so /integrity.json signatures remain verifiable across deploys.
        // /var/www/unicorn/shared/ is the symlink-stable location seeded by
        // scripts/ensure-forever-key.sh on first boot. UNICORN_KEY_DIR steers
        // the same path for the persistent on-disk default lookup.
        UNICORN_KEY_DIR:    process.env.UNICORN_KEY_DIR    || '/var/www/unicorn/shared',
        SITE_SIGN_KEY_FILE: process.env.SITE_SIGN_KEY_FILE || '/var/www/unicorn/shared/site-sign.pem',
        // ── AI Provider API Keys (only if parent env already has them) ─────
        // Never pin '' — that fights dotenv/sanctum and kills fulfillment AI.
        ...envIfSet(AI_KEY_ENV_NAMES),
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
      instances: SITE_INSTANCES,
      exec_mode: 'cluster',
      autorestart: true,
      // Each cluster worker holds a full SSR template cache, the AI provider
      // adapters mirrored from backend, the SSE fan-out, and CSP/Trusted Types
      // signing keys. Real RSS sits at 90–110 MB idle but spikes to 1.2–1.5 GB
      // during template warm-up + first SSE flush. Default 384 MB caused PM2
      // to SIGKILL every worker every ~30 s in a perpetual loop, which made
      // /api/* timeouts cascade through nginx. 1536 MB matches measured peaks.
      max_memory_restart: process.env.SITE_PM2_MAX_MEMORY || '1536M',
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
        // Loopback-only; nginx is the only publicly reachable surface for the site.
        BIND_HOST: process.env.BIND_HOST || '127.0.0.1',
        BACKEND_API_URL: 'http://127.0.0.1:3000',
        // Site health monitor + proxy target (documented separately from BACKEND_API_URL).
        UNICORN_SITE_INTERNAL_BACKEND: process.env.UNICORN_SITE_INTERNAL_BACKEND || 'http://127.0.0.1:3000/api/health',
        BACKEND_ORIGIN: process.env.BACKEND_ORIGIN || 'http://127.0.0.1:3000',
        // Same ops-pm2 guards as backend — site also serves /api/ops/dashboard.
        OPS_PM2_BOOT_GRACE_MS: process.env.OPS_PM2_BOOT_GRACE_MS || '120000',
        OPS_PM2_CACHE_TTL_MS: process.env.OPS_PM2_CACHE_TTL_MS || '15000',
        OPS_PM2_CHECK_DISABLED: process.env.OPS_PM2_CHECK_DISABLED || '0',
        DOMAIN: 'zeusai.pro',
        SITE_DOMAIN: 'zeusai.pro',
        PUBLIC_APP_URL: 'https://zeusai.pro',
        // ── LEGACY BASELINE — RESTORE 2026-05-04 17:21 UTC SITE BEHAVIOR ──
        // Master switch added in PR #517 (legacyBaselineModeGuard IIFE at the
        // top of src/index.js). When set to '1', it propagates the 6 disable
        // flags for every post-PR-#515/#516 site feature so production runs
        // bit-identical to commit 89a8b7f3 (the last "site worked perfectly"
        // checkpoint owner reported on 2026-05-04). Specifically it disables:
        //   • compression (gzip/brotli at dispatcher level)
        //   • static asset memcache (60s mtime cache for /assets/*.js)
        //   • Adaptive Predictive Prefetch (HTTP 103 Early Hints + Link rel=prefetch)
        //   • W3C Speculation Rules (<script type="speculationrules">)
        //   • RUM Web Vitals beacons (collector + endpoints)
        //   • k-anon prefetch graph snapshot persistence
        // Operator override: set SITE_LEGACY_BASELINE_MODE=0 in the system
        // env BEFORE pm2 reads this file to opt back into the new features.
        // Each individual feature still has its own knob (SITE_*_DISABLED).
        SITE_LEGACY_BASELINE_MODE: process.env.SITE_LEGACY_BASELINE_MODE || '1',
        // ── Build identity — drives asset cache-busting (app.js?v=<sha>) ──
        ZEUS_BUILD_SHA: process.env.ZEUS_BUILD_SHA || '',
        SW_VERSION:     process.env.ZEUS_BUILD_SHA || process.env.SW_VERSION || '',
        // ── Forever-key (mirror of backend block) ─────────────────────────
        // Persistent Ed25519 site signing key lives outside the release dir
        // so /integrity.json + /.well-known/zeusai-key.pub remain stable
        // across deploys. See scripts/ensure-forever-key.sh.
        UNICORN_KEY_DIR:    process.env.UNICORN_KEY_DIR    || '/var/www/unicorn/shared',
        SITE_SIGN_KEY_FILE: process.env.SITE_SIGN_KEY_FILE || '/var/www/unicorn/shared/site-sign.pem',
        // Fulfillment AI runs on the SITE money path (fulfillment-engine.js).
        // Mirror Eternal OS flag so site workers stay armed across deploys.
        ...FULFILLMENT_AI_ENV,
        // ── AI Provider API Keys — site needs them for fulfillment + /api/ai/*
        // local fallbacks. Never pin empty strings (see envIfSet above).
        ...envIfSet(AI_KEY_ENV_NAMES),
      },
      error_file: 'logs/site-error.log',
      out_file:   'logs/site-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Optional side-cars (OFF by default) ─────────────────────────────────
    // Bare `pm2 start ecosystem.config.js` previously launched these and
    // competed with backend/site on the 8GB VPS (CPU starve → HTTP hang).
    // Deploy already uses `--only unicorn-backend,unicorn-site`. Gate here so
    // a naive start cannot resurrect retired processes.
    ...((process.env.AUTOSCALE_PM2 || '0') === '1' ? [{
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
        AUTOSCALE_DISABLED: process.env.AUTOSCALE_DISABLED || '1',
        AUTOSCALE_MAX: process.env.AUTOSCALE_MAX || '2',
        AUTOSCALE_MIN_FREE_MB: process.env.AUTOSCALE_MIN_FREE_MB || '800',
      },
      error_file: 'logs/autoscale-error.log',
      out_file:   'logs/autoscale-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }] : []),

    ...((process.env.MESH_GUARDIAN_PM2 || '0') === '1' ? [{
      name: 'module-mesh-guardian',
      script: 'scripts/module-mesh-guardian.js',
      cwd: APP_DIR,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '20s',
      restart_delay: 3000,
      watch: false,
      env: {
        NODE_ENV: 'production',
        MESH_GUARDIAN_INTERVAL_MS: process.env.MESH_GUARDIAN_INTERVAL_MS || '45000',
        MESH_GUARDIAN_TIMEOUT_MS: process.env.MESH_GUARDIAN_TIMEOUT_MS || '12000',
        MESH_GUARDIAN_FAIL_THRESHOLD: process.env.MESH_GUARDIAN_FAIL_THRESHOLD || '4',
        MESH_GUARDIAN_HEAL_COOLDOWN_MS: process.env.MESH_GUARDIAN_HEAL_COOLDOWN_MS || '300000',
        MESH_GUARDIAN_STARTUP_GRACE_MS: process.env.MESH_GUARDIAN_STARTUP_GRACE_MS || '45000',
        MESH_GUARDIAN_AUTOREPAIR: process.env.MESH_GUARDIAN_AUTOREPAIR || '0',
      },
      error_file: 'logs/mesh-guardian-error.log',
      out_file:   'logs/mesh-guardian-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }] : []),

    ...((process.env.LIVE_SYNC_PM2 || '0') === '1' ? [{
      name: 'unicorn-live-sync',
      script: 'scripts/live-sync-forward.js',
      cwd: APP_DIR,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '15s',
      restart_delay: 3000,
      watch: false,
      env: {
        NODE_ENV: 'production',
        LIVE_SYNC_ENABLED: process.env.LIVE_SYNC_ENABLED || '0',
        LIVE_SYNC_ROOT: APP_DIR,
        LIVE_SYNC_INTERVAL_MS: process.env.LIVE_SYNC_INTERVAL_MS || '10000',
        LIVE_SYNC_QUIET_MS: process.env.LIVE_SYNC_QUIET_MS || '2500',
        LIVE_SYNC_INSTALL_ON_MANIFEST: process.env.LIVE_SYNC_INSTALL_ON_MANIFEST || '1',
        LIVE_SYNC_PM2_CMD: process.env.LIVE_SYNC_PM2_CMD || 'pm2',
        LIVE_SYNC_PM2_ARGS: process.env.LIVE_SYNC_PM2_ARGS || 'startOrRestart ecosystem.config.js --update-env',
      },
      error_file: 'logs/live-sync-error.log',
      out_file:   'logs/live-sync-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }] : []),

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
