/**
 * PM2 Ecosystem Config — UNICORN_FINAL
 * Used by Hetzner deploy and local process management.
 * Start all:    pm2 start ecosystem.config.js
 * Restart all:  pm2 restart all
 * Save startup: pm2 save && pm2 startup
 */

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
      max_restarts: 20,
      restart_delay: 3000,
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
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
      max_restarts: 20,
      restart_delay: 5000,
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        INNOVATION_INTERVAL: '30',
        REVENUE_INTERVAL: '15',
        VIRAL_INTERVAL: '20',
        DEPLOYMENT_INTERVAL: '120',
        BACKEND_HEAL_CMD: 'pm2 restart unicorn'
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
      max_restarts: 20,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        HEALTH_GUARDIAN_URL: 'http://127.0.0.1:3000/api/health',
        HEALTH_GUARDIAN_INTERVAL_MS: '30000',
        HEALTH_GUARDIAN_FAIL_THRESHOLD: '3',
        HEALTH_GUARDIAN_HEAL_CMD: 'pm2 restart unicorn'
      },
      error_file: 'logs/health-guardian-error.log',
      out_file: 'logs/health-guardian-out.log',
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
      max_restarts: 20,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        PLATFORM_CHECK_INTERVAL_MS: '300000'
      },
      error_file: 'logs/platform-connector-error.log',
      out_file: 'logs/platform-connector-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 5. Universal AI Connector — UAIC (model discovery & routing daemon) ──
    // Runs independently to keep the AI model registry fresh.
    // The backend also loads UAIC inline; this process handles cron discovery.
    {
      name: 'unicorn-uaic',
      script: 'backend/modules/universal-ai-connector/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      restart_delay: 10000,
      exp_backoff_restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/uaic-error.log',
      out_file: 'logs/uaic-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ── 6. Llama Bridge (starts Ollama serve at P4 / nice +10) ────────────────
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
