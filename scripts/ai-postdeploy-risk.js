#!/usr/bin/env node
'use strict';
// =====================================================================
// ai-postdeploy-risk.js — AI Post‑Deploy Risk Analysis
// Rulează pe CI după switch-ul final la 100% LIVE.
// Analizează riscul post-deploy și loghează recomandări.
// Exit 0 = OK (chiar dacă AI detectează risc — nu forțăm rollback automat).
// Exit 1 = risc critic confirmat → se poate activa rollback.
// =====================================================================

const https = require('https');

function aiRequest(apiKey, baseUrl, model, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.3 });
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
        { role: 'system', content: 'You are a post-deployment risk analyst. Evaluate the completed deployment and identify any residual risks or recommendations. Reply ONLY with JSON: {"riskLevel":"none"|"low"|"medium"|"critical","recommendations":["..."],"rollbackRecommended":true|false,"summary":"..."}' },
        { role: 'user',   content: prompt },
      ]);
      const text = res.choices?.[0]?.message?.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (err) {
      console.warn(`[AI-POSTDEPLOY] Provider ${p.url} failed: ${err.message}`);
    }
  }
  return null;
}

async function run() {
  console.log('[AI-POSTDEPLOY] 🤖 Analiză risc post-deploy...');

  const context = {
    repo:      process.env.GITHUB_REPOSITORY  || 'unknown',
    commit:    process.env.GITHUB_SHA         || 'unknown',
    branch:    process.env.GITHUB_REF_NAME    || 'main',
    actor:     process.env.GITHUB_ACTOR       || 'unknown',
    runId:     process.env.GITHUB_RUN_ID      || 'unknown',
    timestamp: new Date().toISOString(),
  };

  const prompt = `Post-deployment analysis for:
- Repo: ${context.repo}
- Commit: ${context.commit}
- Branch: ${context.branch}
- Actor: ${context.actor}
- Run ID: ${context.runId}
- Deployed at: ${context.timestamp}

Deployment pipeline results:
- Lint: PASSED
- Tests: PASSED
- GREEN smoke tests: PASSED
- Canary 10%: PASSED
- Canary 50%: PASSED
- Final health check LIVE: PASSED
- All stages completed successfully

Please evaluate residual risks and provide post-deploy recommendations.`;

  const result = await askAI(prompt);

  if (!result) {
    console.warn('[AI-POSTDEPLOY] ⚠️  Niciun AI disponibil — skip analiză post-deploy.');
    process.exit(0);
  }

  console.log(`[AI-POSTDEPLOY] Risk Level: ${result.riskLevel}`);
  console.log(`[AI-POSTDEPLOY] Summary: ${result.summary}`);
  if (result.recommendations && result.recommendations.length) {
    result.recommendations.forEach((r) => console.log(`[AI-POSTDEPLOY]   💡 ${r}`));
  }

  if (result.riskLevel === 'critical' && result.rollbackRecommended) {
    console.error('[AI-POSTDEPLOY] ❌ AI detectează risc CRITIC — rollback recomandat!');
    process.exit(1);
  }

  if (result.riskLevel === 'medium' || result.riskLevel === 'low') {
    console.warn('[AI-POSTDEPLOY] ⚠️  Risc moderat detectat — monitorizare activă recomandată.');
  }

  console.log('[AI-POSTDEPLOY] ✅ Analiză completă. Deploy-ul este stabil.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[AI-POSTDEPLOY] Eroare neașteptată:', err.message);
  process.exit(0); // non-blocking
});
