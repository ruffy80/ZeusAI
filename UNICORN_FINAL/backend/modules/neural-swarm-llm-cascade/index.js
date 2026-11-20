// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Protocol: NSC/1.0 — Neural Swarm LLM Cascade & Adversarial Quality Critic
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const crypto = require('crypto');

const PROTOCOL = 'NSC/1.0';

// Verified live high-IQ frontier model cascade (2026) — automatically self-heals
// if any env var still holds a deprecated model ID (e.g. llama-3.3-70b-versatile or mistral-7b).
const DEPRECATED_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'mistralai/mistral-7b-instruct:free',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

const PREFERRED_MODELS = {
  groq: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
  openrouter: [
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3.5-super-vl:free',
    'openrouter/free',
  ],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini'],
  ollama: ['llama3.2:3b-instruct-q4_K_M', 'llama3:latest'],
};

function isUsableSecret(val) {
  const s = String(val || '').trim();
  if (s.length < 10) return false;
  if (/placeholder|changeme|example|your_|todo|xxx|dummy|fake/i.test(s)) return false;
  return true;
}

function normalizeModel(provider, envVal) {
  const raw = String(envVal || '').trim().replace(/^['"]|['"]$/g, '');
  if (raw && !DEPRECATED_MODELS.has(raw)) return raw;
  return (PREFERRED_MODELS[provider] && PREFERRED_MODELS[provider][0]) || raw;
}

class NeuralSwarmLLMCascade {
  constructor() {
    this.protocol = PROTOCOL;
    this.startedAt = new Date().toISOString();
    this.metrics = new Map();
    this.discoveredModels = {
      groq: [...PREFERRED_MODELS.groq],
      openrouter: [...PREFERRED_MODELS.openrouter],
      ollama: [...PREFERRED_MODELS.ollama],
    };
    this.lastDiscoveryAt = null;
    this.totalCalls = 0;
    this.totalRefinements = 0;
    this.totalFailovers = 0;
    this.recentCalls = [];
    this._initMetrics();
  }

  _initMetrics() {
    for (const id of ['groq', 'openrouter', 'deepseek', 'gemini', 'openai', 'ollama']) {
      this.metrics.set(id, {
        provider: id,
        calls: 0,
        successes: 0,
        failures: 0,
        avgLatencyMs: 0,
        lastModel: null,
        lastError: null,
        lastUsedAt: null,
        circuitOpenUntil: 0,
      });
    }
  }

  _buildRails() {
    const rails = [];
    if (isUsableSecret(process.env.GROQ_API_KEY)) {
      rails.push({
        id: 'groq',
        tier: 'tier-1-speed-frontier',
        family: 'groq-lpu',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY.trim(),
        model: normalizeModel('groq', process.env.GROQ_MODEL),
        fallbacks: this.discoveredModels.groq.slice(0, 3),
        costPer1MTokensUsd: 0.15,
      });
    }
    if (isUsableSecret(process.env.OPENROUTER_API_KEY)) {
      rails.push({
        id: 'openrouter',
        tier: 'tier-2-ultra-zero-cost',
        family: 'openrouter-frontier',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY.trim(),
        model: normalizeModel('openrouter', process.env.OPENROUTER_MODEL),
        fallbacks: this.discoveredModels.openrouter.slice(0, 4),
        costPer1MTokensUsd: 0.0,
      });
    }
    if (isUsableSecret(process.env.DEEPSEEK_API_KEY)) {
      rails.push({
        id: 'deepseek',
        tier: 'tier-2-reasoning',
        family: 'deepseek',
        endpoint: 'https://api.deepseek.com/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY.trim(),
        model: normalizeModel('deepseek', process.env.DEEPSEEK_MODEL),
        fallbacks: PREFERRED_MODELS.deepseek,
        costPer1MTokensUsd: 0.27,
      });
    }
    // Only add OpenAI if key is truly an OpenAI key (not an sk-or-v1 OpenRouter key)
    if (isUsableSecret(process.env.OPENAI_API_KEY) && !String(process.env.OPENAI_API_KEY).trim().startsWith('sk-or-')) {
      rails.push({
        id: 'openai',
        tier: 'tier-2-precision',
        family: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY.trim(),
        model: normalizeModel('openai', process.env.OPENAI_MODEL),
        fallbacks: PREFERRED_MODELS.openai,
        costPer1MTokensUsd: 0.15,
      });
    }
    // Always include Local Sovereign Ollama (zero marginal cost, zero external outage risk)
    const ollamaUrl = String(process.env.OLLAMA_URL || 'http://127.0.0.1:11434')
      .replace(/^['"]|['"]$/g, '')
      .replace('://localhost', '://127.0.0.1')
      .replace(/\/+$/, '');
    rails.push({
      id: 'ollama',
      tier: 'tier-3-sovereign-local',
      family: 'ollama-local',
      endpoint: `${ollamaUrl}/api/chat`,
      apiKey: null,
      model: normalizeModel('ollama', process.env.OLLAMA_MODEL),
      fallbacks: this.discoveredModels.ollama.slice(0, 2),
      costPer1MTokensUsd: 0.0,
    });
    return rails;
  }

  /**
   * 1. Automatic Deprecated-Model Discovery & Self-Healer
   */
  async discoverActiveModels() {
    const discovered = { groq: [], openrouter: [], ollama: [] };
    const ts = new Date().toISOString();

    if (isUsableSecret(process.env.GROQ_API_KEY)) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY.trim() },
          signal: AbortSignal.timeout(6000),
        });
        if (r.ok) {
          const j = await r.json();
          const ids = (j.data || []).map((m) => m.id).filter((id) => !/whisper|guard|orpheus/i.test(id));
          if (ids.length) {
            const ranked = [
              ...PREFERRED_MODELS.groq.filter((m) => ids.includes(m)),
              ...ids.filter((m) => !PREFERRED_MODELS.groq.includes(m)),
            ];
            discovered.groq = ranked.slice(0, 6);
            this.discoveredModels.groq = discovered.groq;
          }
        }
      } catch (_) {}
    }

    if (isUsableSecret(process.env.OPENROUTER_API_KEY)) {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY.trim() },
          signal: AbortSignal.timeout(6000),
        });
        if (r.ok) {
          const j = await r.json();
          const free = (j.data || [])
            .filter((m) => String(m.id).endsWith(':free') || (m.pricing && Number(m.pricing.prompt) === 0))
            .map((m) => m.id);
          if (free.length) {
            const ranked = [
              ...PREFERRED_MODELS.openrouter.filter((m) => m === 'openrouter/free' || free.includes(m)),
              ...free.filter((m) => !PREFERRED_MODELS.openrouter.includes(m)),
            ];
            discovered.openrouter = ranked.slice(0, 8);
            this.discoveredModels.openrouter = discovered.openrouter;
          }
        }
      } catch (_) {}
    }

    try {
      const ollamaUrl = String(process.env.OLLAMA_URL || 'http://127.0.0.1:11434')
        .replace(/^['"]|['"]$/g, '')
        .replace('://localhost', '://127.0.0.1')
        .replace(/\/+$/, '');
      const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const j = await r.json();
        const names = (j.models || []).map((m) => m.name).filter(Boolean);
        if (names.length) {
          discovered.ollama = names;
          this.discoveredModels.ollama = names;
        }
      }
    } catch (_) {}

    this.lastDiscoveryAt = ts;
    return { ok: true, protocol: PROTOCOL, discoveredAt: ts, discovered: this.discoveredModels };
  }

  /**
   * 2. Deterministic Adversarial Quality Scorer (0-100) across 5 deliverable pillars
   */
  scoreDeliverableQuality(text, { minChars = 180 } = {}) {
    const raw = String(text || '').trim();
    if (!raw) {
      return { score: 0, grade: 'EMPTY', pillars: { depth: 0, structure: 0, actionability: 0, specificity: 0, zeroFluff: 0 }, needsRefinement: true };
    }
    const len = raw.length;
    const depth = len >= minChars * 3 ? 20 : len >= minChars ? 16 : Math.round((len / minChars) * 14);
    const hasHeadingsOrBullets = /(^|\n)(#|\*|-|\d+\.)\s+/m.test(raw);
    const structure = hasHeadingsOrBullets ? 20 : (raw.includes('\n') ? 14 : 8);
    const actionHits = (raw.match(/\b(implement|configure|deploy|verify|measure|optimize|add|replace|audit|enable|fix|reduce|automate)\b/gi) || []).length;
    const actionability = Math.min(20, 8 + actionHits * 3);
    const specHits = (raw.match(/(`[^`]+`|https?:\/\/|\$\d+|\d+%|\d+\s?ms|Ed25519|HTTPS|TLS|API|SEO|AEO|GEO)/g) || []).length;
    const specificity = Math.min(20, 8 + specHits * 3);
    const fluffHits = (raw.match(/\b(game-changer|revolutionary synergy|world-shaking|in today's fast-paced digital landscape)\b/gi) || []).length;
    const zeroFluff = Math.max(4, 20 - fluffHits * 5);

    const score = Math.max(0, Math.min(100, depth + structure + actionability + specificity + zeroFluff));
    const grade = score >= 90 ? 'ELITE' : score >= 80 ? 'HIGH' : score >= 65 ? 'SOLID' : 'NEEDS_REFINEMENT';
    return {
      score,
      grade,
      pillars: { depth, structure, actionability, specificity, zeroFluff },
      needsRefinement: score < 80,
    };
  }

  async _callRail(rail, messages, { maxTokens = 900, temperature = 0.35, timeoutMs = 15000 } = {}) {
    const modelsToTry = Array.from(new Set([rail.model, ...(rail.fallbacks || [])].filter(Boolean)));
    const m = this.metrics.get(rail.id);
    let lastErr = null;

    for (const model of modelsToTry) {
      const t0 = Date.now();
      m.calls += 1;
      try {
        let content = '';
        if (rail.id === 'ollama') {
          const r = await fetch(rail.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, stream: false, options: { num_predict: maxTokens, temperature } }),
            signal: AbortSignal.timeout(timeoutMs),
          });
          const j = await r.json();
          if (!r.ok) throw new Error('ollama_' + r.status);
          content = String((j.message && j.message.content) || j.response || '').trim();
        } else {
          const headers = {
            Authorization: 'Bearer ' + rail.apiKey,
            'Content-Type': 'application/json',
          };
          if (rail.id === 'openrouter') {
            headers['HTTP-Referer'] = 'https://zeusai.pro';
            headers['X-Title'] = 'ZeusAI Neural Swarm';
          }
          const r = await fetch(rail.endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
            signal: AbortSignal.timeout(timeoutMs),
          });
          const j = await r.json();
          if (!r.ok) {
            const msg = (j.error && j.error.message) || ('http_' + r.status);
            // If payment/auth error (401/402/403), open circuit for 10 min and bail to next provider immediately
            if (r.status === 401 || r.status === 402 || r.status === 403) {
              m.circuitOpenUntil = Date.now() + 10 * 60 * 1000;
              throw new Error(r.status + ':' + msg);
            }
            throw new Error(r.status + ':' + msg);
          }
          const choice = j.choices && j.choices[0] && j.choices[0].message;
          content = String((choice && (choice.content || choice.reasoning)) || '').trim();
        }

        if (!content) throw new Error('empty_completion');
        const latencyMs = Date.now() - t0;
        m.successes += 1;
        m.avgLatencyMs = m.successes === 1 ? latencyMs : Math.round(m.avgLatencyMs * 0.7 + latencyMs * 0.3);
        m.lastModel = model;
        m.lastError = null;
        m.lastUsedAt = new Date().toISOString();
        m.circuitOpenUntil = 0;
        return { ok: true, provider: rail.id, family: rail.family, tier: rail.tier, model, latencyMs, content };
      } catch (e) {
        m.failures += 1;
        m.lastError = String(e && e.message || e).slice(0, 140);
        lastErr = m.lastError;
        if (m.circuitOpenUntil > Date.now()) break;
      }
    }
    return { ok: false, provider: rail.id, error: lastErr || 'rail_failed' };
  }

  /**
   * 3. Two-Stage Cognitive Swarm Synthesis + Cross-Family Adversarial Refinement
   */
  async synthesizeWithSwarm({
    system = 'You are ZeusAI, an elite autonomous software, security, and growth architect. Be concrete, actionable, structured, and zero-fluff.',
    prompt = '',
    refine = false,
    maxTokens = 800,
    timeoutMs = 15000,
  } = {}) {
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) return { ok: false, error: 'prompt_required' };

    this.totalCalls += 1;
    const now = Date.now();
    const rails = this._buildRails().filter((r) => {
      const m = this.metrics.get(r.id);
      return !m || m.circuitOpenUntil <= now;
    });

    let primary = null;
    const attempts = [];
    for (let i = 0; i < rails.length; i++) {
      const res = await this._callRail(rails[i], [
        { role: 'system', content: system },
        { role: 'user', content: cleanPrompt },
      ], { maxTokens, timeoutMs });
      attempts.push({ provider: rails[i].id, ok: res.ok, model: res.model || rails[i].model, latencyMs: res.latencyMs || 0, error: res.error || null });
      if (res.ok) {
        primary = res;
        if (i > 0) this.totalFailovers += 1;
        break;
      }
    }

    if (!primary) {
      return { ok: false, protocol: PROTOCOL, error: 'all_llm_rails_unavailable', attempts };
    }

    let finalContent = primary.content;
    let quality = this.scoreDeliverableQuality(finalContent);
    let refinedBy = null;

    // Cross-family adversarial critic refinement if requested or if quality < 80
    if (refine || quality.needsRefinement) {
      const criticRail = rails.find((r) => r.id !== primary.provider && r.id !== 'ollama');
      if (criticRail) {
        const refRes = await this._callRail(criticRail, [
          { role: 'system', content: 'You are an adversarial senior quality critic. Tighten, enrich with concrete steps/metrics, remove any generic fluff, and return only the improved final output.' },
          { role: 'user', content: `Original task:\n${cleanPrompt}\n\nDraft to elevate:\n${finalContent}` },
        ], { maxTokens, timeoutMs });
        if (refRes.ok && refRes.content.length >= Math.min(80, finalContent.length)) {
          const refQuality = this.scoreDeliverableQuality(refRes.content);
          if (refQuality.score >= quality.score) {
            finalContent = refRes.content;
            quality = refQuality;
            refinedBy = { provider: refRes.provider, model: refRes.model, latencyMs: refRes.latencyMs };
            this.totalRefinements += 1;
          }
        }
      }
    }

    const receipt = {
      id: 'nsc_' + crypto.randomBytes(6).toString('hex'),
      at: new Date().toISOString(),
      provider: primary.provider,
      model: primary.model,
      latencyMs: primary.latencyMs,
      refinedBy,
      qualityScore: quality.score,
      qualityGrade: quality.grade,
    };
    this.recentCalls.unshift(receipt);
    if (this.recentCalls.length > 25) this.recentCalls.length = 25;

    return {
      ok: true,
      protocol: PROTOCOL,
      content: finalContent,
      provider: primary.provider,
      model: primary.model,
      tier: primary.tier,
      latencyMs: primary.latencyMs,
      refinedBy,
      quality,
      attempts,
      receipt,
    };
  }

  getSwarmManifest() {
    const rails = this._buildRails();
    return {
      ok: true,
      protocol: PROTOCOL,
      name: 'ZeusAI Neural Swarm LLM Cascade',
      startedAt: this.startedAt,
      lastDiscoveryAt: this.lastDiscoveryAt,
      activeRailsCount: rails.length,
      rails: rails.map((r) => ({
        id: r.id,
        tier: r.tier,
        family: r.family,
        model: r.model,
        fallbacks: r.fallbacks,
        costPer1MTokensUsd: r.costPer1MTokensUsd,
        metrics: this.metrics.get(r.id),
      })),
      totals: {
        calls: this.totalCalls,
        refinements: this.totalRefinements,
        failovers: this.totalFailovers,
      },
      recentCalls: this.recentCalls.slice(0, 10),
    };
  }

  getStatus() {
    return this.getSwarmManifest();
  }

  health() {
    const rails = this._buildRails();
    return {
      ok: rails.length >= 1,
      protocol: PROTOCOL,
      activeRailsCount: rails.length,
      primaryModel: rails[0] ? `${rails[0].id}:${rails[0].model}` : 'none',
      sovereignLocalReady: rails.some((r) => r.id === 'ollama'),
      totalCalls: this.totalCalls,
    };
  }
}

const engine = new NeuralSwarmLLMCascade();
module.exports = engine;
