#!/usr/bin/env node
'use strict';
// =====================================================================
// ai-canary-eval-10.js — AI Evaluare Canary 10%
// Rulează pe CI după health check canary 10%.
// Evaluează riscul de a extinde canary-ul la 50%.
// Exit 0 = continuă, Exit 1 = rollback.
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
        try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON parse error: ' + raw.slice(0, 200))); }
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
        { role: 'system', content: 'You are a canary deployment evaluator. Given the canary stage metrics, decide if it is safe to expand traffic. Reply ONLY with JSON: {"verdict":"proceed"|"rollback","risk":"low"|"medium"|"high","reason":"..."}' },
        { role: 'user',   content: prompt },
      ]);
      const text = res.choices?.[0]?.message?.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (err) {
      console.warn(`[AI-CANARY-10] Provider ${p.url} failed: ${err.message}`);
    }
  }
  return null;
}

async function run() {
  const stage = process.env.CANARY_STAGE || '10';
  console.log(`[AI-CANARY-10] 🤖 Evaluare canary ${stage}%...`);

  const prompt = `Canary deployment stage: ${stage}%
- Health check: PASSED (HTTP 200 on /health)
- Stage: 10% of traffic routed to new GREEN version
- Metrics: No errors detected in health probe
- Previous stage: GREEN smoke tests PASSED

Is it safe to proceed to 50% canary traffic?`;

  const result = await askAI(prompt);

  if (!result) {
    console.warn('[AI-CANARY-10] ⚠️  Niciun AI disponibil — continuăm implicit (health check a trecut).');
    process.exit(0);
  }

  console.log(`[AI-CANARY-10] Verdict: ${result.verdict} | Risk: ${result.risk} | Motiv: ${result.reason}`);

  if (result.verdict === 'rollback') {
    console.error('[AI-CANARY-10] ❌ AI recomandă rollback la canary 10%.');
    process.exit(1);
  }

  console.log('[AI-CANARY-10] ✅ AI aprobă extinderea la 50%.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[AI-CANARY-10] Eroare neașteptată:', err.message);
  process.exit(1);
});
