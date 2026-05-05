// C10: Synthetic monitor (forward-only)
// PM2 process for endpoint health checks and alerting

module.exports = {
  apps: [
    {
      name: 'synthetic-monitor',
      script: './src/monitoring/synthetic-monitor.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
