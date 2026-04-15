#!/usr/bin/env node
'use strict';
// =====================================================================
// ai-deploy-decision.js — AI Go/No‑Go pentru deploy GREEN → LIVE
// Rulează pe CI după smoke tests.
// Colectează context (build logs, env, timp) și cere AI decizie.
// Exit 0 = deploy aprobat, Exit 1 = deploy respins (rollback).
// =====================================================================

const https = require('https');

function aiRequest(apiKey, baseUrl, model, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, messages, max_tokens: 256, temperature: 0.2 });
    const url  = new URL(baseUrl);
    const opts = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(body) },
      timeout:  20000,
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (d) => { raw += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error(`[${baseUrl}] JSON parse error: ` + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function askAI(prompt) {
  const providers = [
    { key: process.env.GROQ_API_KEY,     url: 'https://api.groq.com/openai/v1/chat/completions',       model: 'llama-3.3-70b-versatile' },
    { key: process.env.DEEPSEEK_API_KEY, url: 'https://api.deepseek.com/v1/chat/completions',           model: 'deepseek-chat' },
    { key: process.env.MISTRAL_API_KEY,  url: 'https://api.mistral.ai/v1/chat/completions',             model: 'mistral-small-latest' },
    { key: process.env.GEMINI_API_KEY,   url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.0-flash' },
    { key: process.env.OPENAI_API_KEY,   url: 'https://api.openai.com/v1/chat/completions',             model: 'gpt-4o-mini' },
  ];

  for (const p of providers) {
    if (!p.key || p.key.startsWith('your_') || p.key.length < 10) continue;
    try {
      const res = await aiRequest(p.key, p.url, p.model, [
        { role: 'system', content: 'You are a deployment gatekeeper AI. Based on deployment context, decide if it is safe to proceed. Reply ONLY with JSON: {"decision":"deploy"|"abort","confidence":0-100,"reason":"..."}' },
        { role: 'user',   content: prompt },
      ]);
      const text = res.choices?.[0]?.message?.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (err) {
      console.warn(`[AI-DECISION] Provider ${p.url} failed: ${err.message}`);
    }
  }
  return null;
}

async function run() {
  console.log('[AI-DECISION] 🤖 Evaluare decizie deploy GREEN...');

  const context = {
    repo:      process.env.GITHUB_REPOSITORY  || 'unknown',
    commit:    process.env.GITHUB_SHA         || 'unknown',
    branch:    process.env.GITHUB_REF_NAME    || 'main',
    actor:     process.env.GITHUB_ACTOR       || 'unknown',
    runId:     process.env.GITHUB_RUN_ID      || 'unknown',
    timestamp: new Date().toISOString(),
    nodeEnv:   'production',
    smoked:    true,
    lintPassed: true,
    testPassed: true,
  };

  const prompt = `Deployment context:
- Repo: ${context.repo}
- Commit: ${context.commit}
- Branch: ${context.branch}
- Actor: ${context.actor}
- Run ID: ${context.runId}
- Timestamp: ${context.timestamp}
- Lint: PASSED
- Tests: PASSED
- Smoke tests on GREEN slot: PASSED

Should we proceed with full canary deployment to production?`;

  const result = await askAI(prompt);

  if (!result) {
    console.warn('[AI-DECISION] ⚠️  Niciun provider AI disponibil — aprobăm implicit (smoke tests au trecut).');
    process.exit(0);
  }

  console.log(`[AI-DECISION] Decizie: ${result.decision} | Confidence: ${result.confidence}% | Motiv: ${result.reason}`);

  if (result.decision === 'abort') {
    console.error('[AI-DECISION] ❌ AI a respins deploy-ul. Rollback la BLUE.');
    process.exit(1);
  }

  console.log('[AI-DECISION] ✅ AI a aprobat deploy-ul GREEN → continuăm cu CANARY.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[AI-DECISION] Eroare neașteptată:', err.message);
  process.exit(1); // blocking — eșec la decizie = abort
});
