// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-11-03
// =====================================================================

'use strict';

let express = null;
try { express = require('express'); } catch (_) {}
const router = express && typeof express.Router === 'function' ? express.Router() : { get: () => {}, post: () => {}, use: () => {} };
const db = require('../db');
const { clockwork } = require('../modules/swissClockworkOrchestrator');

/**
 * Modular Health & Diagnostic Router
 */

// GET /api/health/live
router.get('/live', (req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
});

// GET /api/health/clockwork
router.get('/clockwork', (req, res) => {
  res.json(clockwork.getStatus());
});

// GET /api/health/db
router.get('/db', (req, res) => {
  res.json({ ok: true, meta: db.meta() });
});

module.exports = router;
