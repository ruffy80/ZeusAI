/**
 * PM2 Ecosystem Config — UNICORN_FINAL
 * Used by Hetzner deploy and local process management.
 * Start with: pm2 start ecosystem.config.js
 * Restart with: pm2 restart unicorn
 */

module.exports = {
  apps: [
    {
      name: 'unicorn',
      script: 'backend/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
