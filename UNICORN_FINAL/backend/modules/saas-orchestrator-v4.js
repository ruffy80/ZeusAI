// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

/**
 * Legacy public entry → IAK tenant-queue facet.
 * Former saas-orchestrator-v4 body retired into iak/tenant-queue.js.
 * Preserves historical auto-start-on-require behaviour.
 */
const iak = require('./integrated-autonomy-kernel');
const facet = require('./iak/tenant-queue');
const tenants = iak.tenants;
if (typeof tenants.start === 'function') tenants.start();
module.exports = tenants;
module.exports.SaaSOrchestratorV4 = facet.SaaSOrchestratorV4;
