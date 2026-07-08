// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-08T18:04:07.243Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

require('dotenv').config();

const orchestrator = require('./orchestrator');

function safeRequire(p) {
  try { return require(p); } catch (_) { return null; }
}

const deps = {
  socialViralizer: safeRequire('../socialMediaViralizer'),
  profitAutopilot: safeRequire('../profit-autopilot'),
  pnlTimeMachine: safeRequire('../pnl-time-machine'),
  zkRevenueProof: safeRequire('../zk-revenue-proof'),
  zacc: safeRequire('../zacc'),
  subscriptionEngine: safeRequire('../subscription-engine'),
};

orchestrator.configure(deps);
orchestrator.start();

console.log('[social-orchestrator-service] started', new Date().toISOString());

setInterval(() => {
  const s = orchestrator.getStatus();
  console.log('[social-orchestrator-service] heartbeat', JSON.stringify({ ts: new Date().toISOString(), mode: s.mode, healthRuns: s.healthRuns }));
}, 60_000).unref();
