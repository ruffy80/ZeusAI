#!/usr/bin/env node
'use strict';
// =====================================================================
// smoke-test.js — Verificare rapidă a serviciilor după deploy în GREEN
// Rulează pe server via SSH: node scripts/smoke-test.js
// Exit 0 = OK, Exit 1 = FAIL
// =====================================================================

const http = require('http');

const HOST    = process.env.SMOKE_HOST || '127.0.0.1';
const PORT    = parseInt(process.env.SMOKE_PORT || '3000', 10);
const TIMEOUT = parseInt(process.env.SMOKE_TIMEOUT || '8000', 10);

const ENDPOINTS = [
  { path: '/health',   expectStatus: 200 },
  { path: '/api/health', expectStatus: 200 },
];

function probe(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: HOST, port: PORT, path, timeout: TIMEOUT }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout on ${path}`)); });
    req.on('error', reject);
  });
}

async function run() {
  let allOk = true;

  for (const ep of ENDPOINTS) {
    try {
      const { status } = await probe(ep.path);
      const ok = status === ep.expectStatus;
      console.log(`[SMOKE] ${ok ? '✅' : '❌'} ${ep.path} → HTTP ${status} (expected ${ep.expectStatus})`);
      if (!ok) allOk = false;
    } catch (err) {
      console.error(`[SMOKE] ❌ ${ep.path} → ERROR: ${err.message}`);
      allOk = false;
    }
  }

  if (!allOk) {
    console.error('[SMOKE] FAILED — cel puțin un endpoint nu a răspuns corect.');
    process.exit(1);
  }
  console.log('[SMOKE] ✅ Toate endpoint-urile sunt OK.');
  process.exit(0);
}

run();
