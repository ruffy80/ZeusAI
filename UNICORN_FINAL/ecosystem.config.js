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
    // ── 1. Backend API server — cluster mode pentru Zero Downtime ────────────
    {
      name: 'unicorn',
      script: 'backend/index.js',
      cwd: __dirname,
      // Cluster mode: fork-uri multiple partajează port-ul 3000 fără downtime la reload
      exec_mode: 'cluster',
      instances: process.env.UNICORN_INSTANCES || 'max',
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1G',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '15s',
      restart_delay: 2000,
      kill_timeout: 8000,        // ms să așteptăm SIGTERM înainte de SIGKILL
      listen_timeout: 10000,     // ms să așteptăm portul disponibil
      wait_ready: false,         // backend nu trimite process.send('ready')
      exp_backoff_restart_delay: 1500,
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
        HETZNER_BACKEND_URL: 'http://127.0.0.1:3000',
        // ── AI Provider API Keys ────────────────────────────────────────────
        OPENAI_API_KEY:       process.env.OPENAI_API_KEY       || '',
        DEEPSEEK_API_KEY:     process.env.DEEPSEEK_API_KEY     || '',
        ANTHROPIC_API_KEY:    process.env.ANTHROPIC_API_KEY    || '',
        GEMINI_API_KEY:       process.env.GEMINI_API_KEY       || '',
        MISTRAL_API_KEY:      process.env.MISTRAL_API_KEY      || '',
        COHERE_API_KEY:       process.env.COHERE_API_KEY       || '',
        XAI_API_KEY:          process.env.XAI_API_KEY          || '',
        GROQ_API_KEY:         process.env.GROQ_API_KEY         || '',
        OPENROUTER_API_KEY:   process.env.OPENROUTER_API_KEY   || '',
        HF_API_KEY:           process.env.HF_API_KEY           || '',
        HUGGINGFACE_API_KEY:  process.env.HUGGINGFACE_API_KEY  || process.env.HF_API_KEY || '',
        PERPLEXITY_API_KEY:   process.env.PERPLEXITY_API_KEY   || '',
        TOGETHER_API_KEY:     process.env.TOGETHER_API_KEY     || '',
        FIREWORKS_API_KEY:    process.env.FIREWORKS_API_KEY    || '',
        SAMBANOVA_API_KEY:    process.env.SAMBANOVA_API_KEY    || '',
        NVIDIA_NIM_API_KEY:   process.env.NVIDIA_NIM_API_KEY   || '',
        // ── AI Smart Cache ──────────────────────────────────────────────────
        AI_CACHE_TTL_MS:         process.env.AI_CACHE_TTL_MS         || '120000',
        AI_CACHE_MAX_ENTRIES:    process.env.AI_CACHE_MAX_ENTRIES     || '1000',
        AI_CACHE_MAX_BYTES:      process.env.AI_CACHE_MAX_BYTES       || '52428800',
        AI_CACHE_TTL_EMBEDDING:  process.env.AI_CACHE_TTL_EMBEDDING   || '3600000',
        AI_CACHE_TTL_REASONING:  process.env.AI_CACHE_TTL_REASONING   || '300000',
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
        GH_PULL_INTERVAL: '600',
        GH_AUTO_ROLLBACK: 'false',
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
        HEALTH_GUARDIAN_EXTERNAL_URL: `${PUBLIC_APP_URL}/health`,
        HEALTH_GUARDIAN_ORCHESTRATOR_URL: 'http://127.0.0.1:3000/api/orchestrator/check',
        HEALTH_GUARDIAN_INTERVAL_MS: '30000',
        HEALTH_GUARDIAN_EXTERNAL_MS: '120000',
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
        // ── AI Provider API Keys ────────────────────────────────────────────
        OPENAI_API_KEY:       process.env.OPENAI_API_KEY       || '',
        DEEPSEEK_API_KEY:     process.env.DEEPSEEK_API_KEY     || '',
        ANTHROPIC_API_KEY:    process.env.ANTHROPIC_API_KEY    || '',
        GEMINI_API_KEY:       process.env.GEMINI_API_KEY       || '',
        MISTRAL_API_KEY:      process.env.MISTRAL_API_KEY      || '',
        COHERE_API_KEY:       process.env.COHERE_API_KEY       || '',
        XAI_API_KEY:          process.env.XAI_API_KEY          || '',
        GROQ_API_KEY:         process.env.GROQ_API_KEY         || '',
        OPENROUTER_API_KEY:   process.env.OPENROUTER_API_KEY   || '',
        HF_API_KEY:           process.env.HF_API_KEY           || '',
        HUGGINGFACE_API_KEY:  process.env.HUGGINGFACE_API_KEY  || process.env.HF_API_KEY || '',
        PERPLEXITY_API_KEY:   process.env.PERPLEXITY_API_KEY   || '',
        TOGETHER_API_KEY:     process.env.TOGETHER_API_KEY     || '',
        FIREWORKS_API_KEY:    process.env.FIREWORKS_API_KEY    || '',
        SAMBANOVA_API_KEY:    process.env.SAMBANOVA_API_KEY    || '',
        NVIDIA_NIM_API_KEY:   process.env.NVIDIA_NIM_API_KEY   || '',
      },
      out_file: 'logs/uaic-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 5b. System Shield (real-time file watch + process monitor + deploy lock) ─
    {
      name: 'unicorn-system-shield',
      script: 'scripts/system-shield.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        SHIELD_PORT: '3099',
        SHIELD_PROCESS_POLL: '30000',
        SHIELD_FILE_RESTORE: 'true',
        SHIELD_HEAL_COOLDOWN_MS: '60000',
        SHIELD_REQUIRED_PROCS: 'unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog,unicorn-platform-connector,unicorn-uaic',
        SHIELD_NOTIFY_URL: 'http://127.0.0.1:3000/api/orchestrator/check',
        SHIELD_LOCK_FILE: '/tmp/unicorn-deploy.lock',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL
      },
      error_file: 'logs/system-shield-error.log',
      out_file: 'logs/system-shield-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 6. Llama Bridge (starts Ollama serve at P4 / nice +10) ────────────────    // Prerequisite: `ollama` must be installed on the server.
    // ── 10. Llama Bridge (starts Ollama serve at P4 / nice +10) ───────────────
    // Prerequisite: `ollama` must be installed on the server.
    // Install: curl -fsSL https://ollama.ai/install.sh | sh
    // Pull model: ollama pull llama3.1:8b-instruct-q4_K_M
    {
      name: 'unicorn-llama-bridge',
      script: 'sh',
      // Wrapper: only start ollama if the binary exists; exit 0 cleanly otherwise.
      // stop_exit_codes: [0] prevents PM2 from restarting on a clean (0) exit,
      // avoiding the restart loop when ollama is not installed on the server.
      args: '-c "command -v ollama >/dev/null 2>&1 && exec nice -n 10 ollama serve || { echo \'[llama-bridge] ollama not installed — skipping\'; exit 0; }"',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 5,
      stop_exit_codes: [0],
      restart_delay: 30000,
      exp_backoff_restart_delay: 10000,
      env: {
        OLLAMA_HOST: '127.0.0.1:11434',
        OLLAMA_NUM_PARALLEL: '1',
        OLLAMA_MAX_LOADED_MODELS: '1'
      },
      error_file: 'logs/llama-bridge-error.log',
      out_file: 'logs/llama-bridge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 11. Auto-Repair — reparații automate sistem ───────────────────────────
    {
      name: 'unicorn-auto-repair',
      script: 'backend/modules/auto-repair.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        AUTO_REPAIR_INTERVAL_MS: '60000',
        SHIELD_REQUIRED_PROCS: 'unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog,unicorn-shield,unicorn-health-daemon',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/auto-repair-error.log',
      out_file: 'logs/auto-repair-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 12. Auto-Restart — repornire automată procese critice ─────────────────
    {
      name: 'unicorn-auto-restart',
      script: 'backend/modules/auto-restart.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        AUTO_RESTART_INTERVAL_MS: '30000',
        SHIELD_REQUIRED_PROCS: 'unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog,unicorn-shield,unicorn-health-daemon',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/auto-restart-error.log',
      out_file: 'logs/auto-restart-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 13. Auto-Optimize — optimizare automată performanță ───────────────────
    {
      name: 'unicorn-auto-optimize',
      script: 'backend/modules/auto-optimize.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        AUTO_OPTIMIZE_INTERVAL_MS: '300000',
        AUTO_OPTIMIZE_LOG_MAX_MB:  '50',
        AUTO_OPTIMIZE_LOG_AGE_DAYS: '7',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/auto-optimize-error.log',
      out_file: 'logs/auto-optimize-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 14. Auto-Evolve — evoluție autonomă sistem ────────────────────────────
    {
      name: 'unicorn-auto-evolve',
      script: 'backend/modules/auto-evolve.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 15000,
      env: {
        NODE_ENV: 'production',
        AUTO_EVOLVE_INTERVAL_MS: '600000',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
        BACKEND_BASE_URL: 'http://127.0.0.1:3000',
      },
      error_file: 'logs/auto-evolve-error.log',
      out_file: 'logs/auto-evolve-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 15. Log Monitor — monitorizare log-uri sistem ─────────────────────────
    {
      name: 'unicorn-log-monitor',
      script: 'backend/modules/log-monitor.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        LOG_MONITOR_INTERVAL_MS: '30000',
        LOG_MONITOR_ERROR_THRESH: '10',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/log-monitor-error.log',
      out_file: 'logs/log-monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 16. Resource Monitor — monitorizare CPU/RAM/Disk ─────────────────────
    {
      name: 'unicorn-resource-monitor',
      script: 'backend/modules/resource-monitor.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        RESOURCE_MONITOR_INTERVAL_MS: '15000',
        HEALTH_CPU_WARN:  '85',
        HEALTH_RAM_WARN:  '90',
        HEALTH_DISK_WARN: '85',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/resource-monitor-error.log',
      out_file: 'logs/resource-monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 17. Error Pattern Detector — detectare tipare erori ──────────────────
    {
      name: 'unicorn-error-pattern',
      script: 'backend/modules/error-pattern-detector.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        ERROR_PATTERN_INTERVAL_MS: '60000',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/error-pattern-error.log',
      out_file: 'logs/error-pattern-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 18. Recovery Engine — motor central recuperare sistem ─────────────────
    {
      name: 'unicorn-recovery-engine',
      script: 'backend/modules/recovery-engine.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        RECOVERY_COOLDOWN_MS: '120000',
        RECOVERY_MAX: '50',
        ORCH_HEALTH_URL: 'http://127.0.0.1:3000/api/health',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/recovery-engine-error.log',
      out_file: 'logs/recovery-engine-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 19. AI Self-Healing — monitorizare și auto-reparare provideri AI ─────
    {
      name: 'unicorn-ai-self-healing',
      script: 'backend/modules/ai-self-healing.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        AI_HEAL_PROBE_MS:          '60000',
        AI_HEAL_MODULE_WATCH_MS:   '120000',
        AI_UNSTABLE_COOLDOWN_MS:   '300000',
        AI_UNSTABLE_FAIL_THRESH:   '3',
        AI_HEAL_MAX_RETRIES:       '3',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/ai-self-healing-error.log',
      out_file: 'logs/ai-self-healing-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 20. Zero-Downtime Controller — graceful reload fără întreruperi ───────
    {
      name: 'unicorn-zero-downtime',
      script: 'scripts/zero-downtime-controller.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        ZDT_HEALTH_URL:      'http://127.0.0.1:3000/api/health',
        ZDT_INTERVAL_MS:     '20000',
        ZDT_RELOAD_TIMEOUT:  '30000',
        ZDT_FAIL_THRESHOLD:  '3',
        ZDT_HEALTH_OK_AFTER: '3',
        ZDT_CRITICAL_PROCS:  'unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/zero-downtime-error.log',
      out_file: 'logs/zero-downtime-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 21. Service Watchdog — health-check + exponential backoff (Reliability #11 & #14) ──
    {
      name: 'unicorn-service-watchdog',
      script: 'backend/modules/service-watchdog.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        WATCHDOG_INTERVAL_MS:    '30000',
        WATCHDOG_FAIL_THRESHOLD: '3',
        WATCHDOG_BASE_BACKOFF_MS:'2000',
        WATCHDOG_MAX_BACKOFF_MS: '300000',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/service-watchdog-error.log',
      out_file: 'logs/service-watchdog-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 22. Orchestrator V4 — per-tenant execution + scaling ──────────────────
    {
      name: 'unicorn-orchestrator-v4',
      script: 'backend/modules/orchestrator-v4.js',
    // ── 22. SaaS Orchestrator v4 — multi-tenant AI & workflow orchestration ──
    {
      name: 'unicorn-saas-orchestrator-v4',
      script: 'backend/modules/saas-orchestrator-v4.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        ORCH_V4_STALL_MS:  '30000',
        ORCH_V4_HEALTH_MS: '15000',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/orchestrator-v4-error.log',
      out_file: 'logs/orchestrator-v4-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 23. Global Load Balancer — multi-region failover + circuit breaker ────
    {
      name: 'unicorn-global-lb',
      script: 'backend/modules/global-load-balancer.js',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        ORCHESTRATOR_MAX_CONCURRENT: '20',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/saas-orchestrator-v4-error.log',
      out_file: 'logs/saas-orchestrator-v4-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 23. Global Failover Controller — multi-region health + auto-scaling ──
    {
      name: 'unicorn-global-failover',
      script: 'backend/modules/global-failover.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        GLB_PROBE_MS:        '30000',
        GLB_CIRCUIT_OPEN_MS: '60000',
        GLB_FAIL_THRESHOLD:  '3',
        GLB_SUCCESS_THRESH:  '2',
        GLB_STRATEGY:        'latency',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/global-lb-error.log',
      out_file: 'logs/global-lb-out.log',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        MAX_INSTANCES: '20',
        DOMAIN: SITE_DOMAIN,
        PUBLIC_APP_URL,
      },
      error_file: 'logs/global-failover-error.log',
      out_file: 'logs/global-failover-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
