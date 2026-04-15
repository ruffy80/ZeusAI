#!/usr/bin/env node
'use strict';
// =====================================================================
// ai-predeploy-review.js — AI Pre‑Deploy Code Analysis & Optimization
// Rulează pe CI runner ÎNAINTE de build.
// Analizează diff-ul față de ultimul commit, trimite la AI și loghează.
// Exit 0 = OK/warn, Exit 1 = bloc critic detectat.
// =====================================================================

const { execSync } = require('child_process');
const https = require('https');

// ── Helpers ──────────────────────────────────────────────────────────

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
        try { resolve(JSON.parse(raw)); } catch { reject(new Error(`[${baseUrl}] JSON parse error: ` + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('AI request timeout')); });
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
        { role: 'system', content: 'You are a senior code reviewer. Analyze the provided git diff for critical issues (security vulnerabilities, broken logic, missing error handling). Reply with JSON: {"verdict":"ok"|"warn"|"block","issues":["..."],"summary":"..."}. Be concise.' },
        { role: 'user',   content: prompt },
      ]);
      const text = res.choices?.[0]?.message?.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      return { verdict: 'warn', issues: [], summary: text.slice(0, 300) };
    } catch (err) {
      console.warn(`[AI-PREDEPLOY] Provider ${p.url} failed: ${err.message}`);
    }
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────

async function run() {
  console.log('[AI-PREDEPLOY] 🤖 Pornire analiză pre-deploy...');

  let diff = '';
  try {
    diff = execSync('git diff HEAD~1 HEAD --stat --diff-filter=ACMR', { encoding: 'utf8', timeout: 10000 }).slice(0, 4000);
  } catch {
    diff = execSync('git diff --cached --stat', { encoding: 'utf8', timeout: 10000 }).slice(0, 4000);
  }

  if (!diff.trim()) {
    console.log('[AI-PREDEPLOY] ℹ️  Nu există modificări detectabile. Skip.');
    process.exit(0);
  }

  console.log('[AI-PREDEPLOY] Diff trimis la AI:\n' + diff.slice(0, 800) + (diff.length > 800 ? '\n...(trunchiat)' : ''));

  const result = await askAI(`Analizează acest git diff și identifică probleme critice:\n\n${diff}`);

  if (!result) {
    console.warn('[AI-PREDEPLOY] ⚠️  Niciun provider AI disponibil — continuăm fără analiză AI.');
    process.exit(0);
  }

  console.log(`[AI-PREDEPLOY] Verdict: ${result.verdict}`);
  console.log(`[AI-PREDEPLOY] Summary: ${result.summary}`);
  if (result.issues && result.issues.length) {
    result.issues.forEach((issue) => console.log(`[AI-PREDEPLOY]   ⚠️  ${issue}`));
  }

  if (result.verdict === 'block') {
    console.error('[AI-PREDEPLOY] ❌ AI a blocat deploy-ul — probleme critice detectate!');
    process.exit(1);
  }

  console.log('[AI-PREDEPLOY] ✅ Analiză completă — continuăm deploy-ul.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[AI-PREDEPLOY] Eroare neașteptată:', err.message);
  process.exit(0); // non-blocking — nu oprim deploy-ul dacă scriptul crăpă
});
