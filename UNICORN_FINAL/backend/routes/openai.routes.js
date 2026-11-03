// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-11-03
// =====================================================================

'use strict';

const express = require('express');
const router = express.Router();
const proxy = require('../modules/sovereignOpenAiProxy');

// GET /v1/models or /api/v1/models
router.get('/models', (req, res) => {
  return proxy.handleListModels(req, res);
});

// POST /v1/chat/completions or /api/v1/chat/completions
router.post('/chat/completions', express.json({ limit: '512kb' }), (req, res) => {
  return proxy.handleChatCompletions(req, res);
});

// GET /v1/status
router.get('/status', (req, res) => {
  return res.json(proxy.getStatus());
});

module.exports = router;
