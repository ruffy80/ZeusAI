/**
 * PM2 Ecosystem Config — UNICORN_FINAL
 * Used by Hetzner deploy and local process management.
 * Start all:    pm2 start ecosystem.config.js
 * Restart all:  pm2 restart all
 * Save startup: pm2 save && pm2 startup
 */

// ── Shared constants (single source of truth) ──────────────────────────────
const SITE_DOMAIN    = process.env.SITE_DOMAIN    || 'zeusai.pro';
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || `https://${SITE_DOMAIN}`;
const EDGE_HEALTH_URL = process.env.EDGE_HEALTH_URL || `${PUBLIC_APP_URL}/health`;
const GH_OWNER       = process.env.GITHUB_REPO_OWNER || 'ruffy80';
const GH_REPO        = process.env.GITHUB_REPO_NAME  || 'ZeusAI';
const ECOSYSTEM_PATH = __filename; // absolute path to this config file

module.exports = {
  apps: [
    // ── 1. Backend API server ─────────────────────────────────────────────────
    {
      name: 'unicorn',
      script: 'backend/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DOMAIN: SITE_DOMAIN,
        SITE_DOMAIN,
        PUBLIC_APP_URL,
        CORS_ORIGINS: `https://${SITE_DOMAIN},https://www.${SITE_DOMAIN}`,
        BTC_WALLET_ADDRESS: 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
        OWNER_NAME: 'Vladoi Ionut',
        OWNER_EMAIL: 'vladoi_ionut@yahoo.com',
        ADMIN_EMAIL: 'vladoi_ionut@yahoo.com',
        HETZNER_BACKEND_URL: 'http://127.0.0.1:3000'
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 2. Autonomous Orchestrator (innovation / revenue / viral / deploy) ────
    {
      name: 'unicorn-orchestrator',
      script: 'autonomous-orchestrator.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        INNOVATION_INTERVAL: '30',
        REVENUE_INTERVAL: '15',
        VIRAL_INTERVAL: '20',
        DEPLOYMENT_INTERVAL: '120',
        BACKEND_HEAL_CMD: 'pm2 restart unicorn',
        BACKEND_BASE_URL: 'http://127.0.0.1:3000',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL
      },
      error_file: 'logs/orchestrator-error.log',
      out_file: 'logs/orchestrator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 3. Health Guardian (auto-heal backend if it becomes unhealthy) ────────
    {
      name: 'unicorn-health-guardian',
      script: 'scripts/health-guardian.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        HEALTH_GUARDIAN_URL: 'http://127.0.0.1:3000/api/health',
        HEALTH_GUARDIAN_SHIELD_URL: 'http://127.0.0.1:3000/api/quantum-integrity/status',
        HEALTH_GUARDIAN_INTERVAL_MS: '30000',
        HEALTH_GUARDIAN_FAIL_THRESHOLD: '3',
        HEALTH_GUARDIAN_HEAL_CMD: `pm2 startOrRestart "${ECOSYSTEM_PATH}" --only unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog`,
        HEALTH_GUARDIAN_ROLLBACK_CMD: 'bash scripts/rollback-last-backup.sh'
      },
      error_file: 'logs/health-guardian-error.log',
      out_file: 'logs/health-guardian-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 3b. Quantum Integrity Shield Watchdog ───────────────────────────────
    {
      name: 'unicorn-quantum-watchdog',
      script: 'scripts/quantum-shield-watchdog.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        QIS_WATCHDOG_URL: 'http://127.0.0.1:3000/api/quantum-integrity/status',
        QIS_WATCHDOG_INTERVAL_MS: '45000',
        QIS_WATCHDOG_FAIL_THRESHOLD: '2',
        QIS_WATCHDOG_REPAIR_CMD: 'pm2 restart unicorn unicorn-orchestrator unicorn-health-guardian',
        QIS_WATCHDOG_ROLLBACK_CMD: 'bash scripts/rollback-last-backup.sh'
      },
      error_file: 'logs/quantum-watchdog-error.log',
      out_file: 'logs/quantum-watchdog-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 4. Platform Connector (keeps GitHub ↔ Vercel ↔ Hetzner link alive) ───
    {
      name: 'unicorn-platform-connector',
      script: 'scripts/platform-connector.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        PLATFORM_CHECK_INTERVAL_MS: '300000',
        EDGE_HEALTH_URL,
        HETZNER_HEALTH_URL: 'http://127.0.0.1:3000/api/health',
        GITHUB_REPO_OWNER: GH_OWNER,
        GITHUB_REPO_NAME: GH_REPO,
        GITHUB_WORKFLOW_ID: 'deploy-hetzner.yml',
        GITHUB_BRANCH: 'main'
      },
      error_file: 'logs/platform-connector-error.log',
      out_file: 'logs/platform-connector-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 5. Main Orchestrator (checkRepo / validateCode / deploy / rollback / notify) ─
    {
      name: 'unicorn-main-orchestrator',
      script: 'scripts/unicorn-main-orchestrator.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '15s',
      restart_delay: 10000,
      exp_backoff_restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        ORCH_POLL_MS: '120000',
        ORCH_HEALTH_URL: 'http://127.0.0.1:3000/api/health',
        ORCH_SHIELD_URL: 'http://127.0.0.1:3000/api/quantum-integrity/status',
        ORCH_INNOVATION_URL: 'http://127.0.0.1:3000/api/innovation-loop/status',
        ORCH_DEPLOY_CMD: 'bash scripts/deploy-hetzner.js 2>&1 || bash deploy.sh 2>&1',
        ORCH_ROLLBACK_CMD: 'bash scripts/rollback-last-backup.sh',
        ORCH_LINT_CMD: 'npm run lint --if-present',
        ORCH_TEST_CMD: 'npm test --if-present',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/main-orchestrator-error.log',
      out_file: 'logs/main-orchestrator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 6. Shield (watchFiles / watchProcesses / autoRepair / emergencyRollback) ─
    {
      name: 'unicorn-shield',
      script: 'scripts/unicorn-shield.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        SHIELD_INTERVAL_MS: '30000',
        SHIELD_PROC_MS: '20000',
        SHIELD_FAIL_THRESHOLD: '3',
        SHIELD_HEALTH_URL: 'http://127.0.0.1:3000/api/health',
        SHIELD_ORCH_URL: 'http://127.0.0.1:3000/api/orchestrator/notify',
        SHIELD_ROLLBACK_CMD: 'bash scripts/rollback-last-backup.sh',
        SHIELD_REPAIR_CMD: `pm2 startOrRestart "${ECOSYSTEM_PATH}" --only unicorn,unicorn-main-orchestrator,unicorn-health-daemon,unicorn-shield,unicorn-quantum-watchdog`,
      },
      error_file: 'logs/shield-error.log',
      out_file: 'logs/shield-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 7. Health Daemon (checkBackend / checkFrontend / checkSSL / checkNginx / checkResources) ─
    {
      name: 'unicorn-health-daemon',
      script: 'scripts/unicorn-health-daemon.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        HEALTH_DAEMON_INTERVAL_MS: '60000',
        HEALTH_BACKEND_URL: 'http://127.0.0.1:3000/api/health',
        HEALTH_FRONTEND_URL: PUBLIC_APP_URL,
        SITE_DOMAIN,
        PUBLIC_APP_URL,
        HEALTH_REPORT_URL: 'http://127.0.0.1:3000/api/health-daemon/report',
        HEALTH_ORCH_URL: 'http://127.0.0.1:3000/api/orchestrator/notify',
        HEALTH_SSL_WARN_DAYS: '14',
        HEALTH_CPU_WARN: '85',
        HEALTH_RAM_WARN: '90',
        HEALTH_DISK_WARN: '85',
      },
      error_file: 'logs/health-daemon-error.log',
      out_file: 'logs/health-daemon-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 8. Auto-Innovation Agent (analyzeCodebase / proposeImprovements / createPR / innovationLoop) ─
    {
      name: 'unicorn-innovation-agent',
      script: 'backend/modules/auto-innovation-loop.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '15s',
      restart_delay: 15000,
      exp_backoff_restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        INNOV_CYCLE_MS: '3600000',
        INNOV_PR_POLL_MS: '300000',
        INNOV_MAX_PENDING: '3',
        INNOV_BASE_BRANCH: 'main',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
        GITHUB_REPO_OWNER: GH_OWNER,
        GITHUB_REPO_NAME: GH_REPO,
      },
      error_file: 'logs/innovation-agent-error.log',
      out_file: 'logs/innovation-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 9. Universal AI Connector — UAIC (model discovery & routing daemon) ──
    // Runs independently to keep the AI model registry fresh.
    // The backend also loads UAIC inline; this process handles cron discovery.
    {
      name: 'unicorn-uaic',
      script: 'backend/modules/universal-ai-connector/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 10000,
      exp_backoff_restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/uaic-error.log',
      out_file: 'logs/uaic-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 10. Llama Bridge (starts Ollama serve at P4 / nice +10) ───────────────
    // Prerequisite: `ollama` must be installed on the server.
    // Install: curl -fsSL https://ollama.ai/install.sh | sh
    // Pull model: ollama pull llama3.1:8b-instruct-q4_K_M
    {
      name: 'unicorn-llama-bridge',
      script: 'sh',
      args: '-c "nice -n 10 ollama serve"',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 15000,
      exp_backoff_restart_delay: 5000,
      env: {
        OLLAMA_HOST: '127.0.0.1:11434',
        OLLAMA_NUM_PARALLEL: '1',
        OLLAMA_MAX_LOADED_MODELS: '1'
      },
      error_file: 'logs/llama-bridge-error.log',
      out_file: 'logs/llama-bridge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
