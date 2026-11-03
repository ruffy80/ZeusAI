// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-11-03
// =====================================================================

'use strict';

const authRoutes = require('./auth.routes');
const commerceRoutes = require('./commerce.routes');
const aiRoutes = require('./ai.routes');
const dashboardRoutes = require('./dashboard.routes');
const healthRoutes = require('./health.routes');

/**
 * Master Modular Route Manager
 * Integrates all domain controllers into the Express app cleanly.
 */
function mount(app) {
  if (!app) return;

  app.use('/api/auth', authRoutes);
  app.use('/api/commerce', commerceRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/client/dashboard', dashboardRoutes);
  app.use('/api/portal', dashboardRoutes);
  app.use('/api/health', healthRoutes);

  return app;
}

module.exports = {
  mount,
  authRoutes,
  commerceRoutes,
  aiRoutes,
  dashboardRoutes,
  healthRoutes
};
