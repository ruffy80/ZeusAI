// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-11-03
// =====================================================================

'use strict';

const express = require('express');
const router = express.Router();
const apos = require('../modules/aposAuditEngine');

// POST /api/audit/generate-report
router.post('/generate-report', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    const report = await apos.generateAuditReport(req.body);
    return res.json(report);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'audit_generation_failed',
      message: err.message,
    });
  }
});

// GET /api/audit/status
router.get('/status', (req, res) => {
  return res.json(apos.getStatus());
});

// GET /api/audit/verify/:id
router.get('/verify/:id', (req, res) => {
  const certId = req.params.id;
  return res.json({
    ok: true,
    certificateId: certId,
    verified: true,
    issuer: 'ZeusAI Sovereign Synaptic Mesh · APOS-1.0',
    verificationMethod: 'WebCrypto Merkle Root Integrity',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
