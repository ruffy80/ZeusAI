// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:38:58.451Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * 🤖 UNIVERSAL AI CONNECTOR (UAIC)
 * Orchestrează inteligent toate resursele AI disponibile.
 * Direcționează dinamic sarcinile către cel mai potrivit model
 * în funcție de complexitate, cost și latență.
 *
 * Provideri suportați:
 *   - OpenAI GPT-4o / GPT-4o-mini   (OPENAI_API_KEY)
 *   - DeepSeek Chat / R1             (DEEPSEEK_API_KEY)
 *   - Anthropic Claude               (CLAUDE_API_KEY)
 *   - Google Gemini                  (GEMINI_API_KEY)
 *   - Local Ollama via LlamaBridge   (zero-cost, fallback)
 *
 * Strategii de rutare:
 *   simple   → cel mai ieftin model disponibil
 *   complex  → cel mai precis model disponibil
 *   creative → cel mai rapid model disponibil
 *   code     → model cu capabilitate de cod
 *   chat     → OpenAI → Llama → keyword fallback
 *
 * Auto-start: require-ul inițializează și pornește UAIC automat.
 * Descopere modele noi din surse publice (cron zilnic, 00:00).
 */

'use strict';

const axios = require('axios');
const cron  = require('node-cron');
const fs    = require('fs');
const path  = require('path');

// ─── LlamaBridge (optional local fallback) ────────────────────────────────────
let _llamaBridge = null;
try { _llamaBridge = require('../llamaBridge'); } catch { /* Ollama not available */ }

// ─── Paths ────────────────────────────────────────────────────────────────────
const DATA_DIR   = path.join(__dirname, '../../../data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');

// ─── Runtime stats ────────────────────────────────────────────────────────────
const stats = {
  totalCalls: 0,
  callsByModel: {},
  errors: 0,
  fallbacks: 0,
  startedAt: new Date().toISOString(),
};

// ─── Models registry ──────────────────────────────────────────────────────────
// Map<name, { type, endpoint, apiKey?, modelName?, capabilities[], cost, performance }>
const models = new Map();

// ─── Routing rules ────────────────────────────────────────────────────────────
const ROUTING_RULES = [
  { taskType: 'simple',   strategy: 'cheapest'       },
  { taskType: 'complex',  strategy: 'best-accuracy'  },
  { taskType: 'creative', strategy: 'fastest'        },
  { taskType: 'code',     strategy: 'best-code'      },
  { taskType: 'chat',     strategy: 'cheapest'       },
];

// ─── Load known models from env ───────────────────────────────────────────────
function loadKnownModels() {
  // OpenAI
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    models.set('openai-gpt4o', {
      type: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      capabilities: ['text-generation', 'reasoning', 'code', 'chat'],
      cost: 0.00015,
      performance: { speed: 0.92, accuracy: 0.95 },
    });
  }

  // DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    models.set('deepseek-chat', {
      type: 'deepseek',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,
      modelName: 'deepseek-chat',
      capabilities: ['text-generation', 'reasoning', 'code'],
      cost: 0.00014,
      performance: { speed: 0.95, accuracy: 0.92 },
    });
  }

  // Anthropic Claude
  if (process.env.CLAUDE_API_KEY) {
    models.set('claude-3-haiku', {
      type: 'anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      apiKey: process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-haiku-20240307',
      capabilities: ['text-generation', 'reasoning', 'creative'],
      cost: 0.00025,
      performance: { speed: 0.88, accuracy: 0.94 },
    });
  }

  // Google Gemini
  if (process.env.GEMINI_API_KEY) {
    models.set('gemini-flash', {
      type: 'google',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      apiKey: process.env.GEMINI_API_KEY,
      capabilities: ['text-generation', 'reasoning', 'creative'],
      cost: 0.000075,
      performance: { speed: 0.93, accuracy: 0.91 },
    });
  }

  // Local Ollama via LlamaBridge (zero-cost)
  if (_llamaBridge) {
    models.set('llama-local', {
      type: 'local',
      capabilities: ['text-generation', 'chat'],
      cost: 0,
      performance: { speed: 0.70, accuracy: 0.80 },
    });
  }

  // Load extra models from data/models.json if present
  try {
    if (fs.existsSync(MODELS_FILE)) {
      const extra = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf8'));
      if (Array.isArray(extra)) {
        extra.forEach(m => {
          if (m.name && !models.has(m.name)) {
            const { name, ...rest } = m;
            models.set(name, rest);
          }
        });
      }
    }
  } catch { /* ignore corrupt file */ }
}

// ─── Persist discovered models ────────────────────────────────────────────────
function saveModels() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    // Only save discovered models (huggingface type) to avoid persisting secrets
    const toSave = Array.from(models.entries())
      .filter(([, m]) => m.type === 'huggingface')
      .map(([name, data]) => ({ name, ...data }));
    fs.writeFileSync(MODELS_FILE, JSON.stringify(toSave, null, 2));
  } catch { /* ignore write errors */ }
}

// ─── Model discovery (cron daily) ─────────────────────────────────────────────
async function discoverNewModels() {
  console.log('[UAIC] 🔍 Descoperire modele AI noi...');
  let discovered = 0;

  // Hugging Face top models (text-generation, by downloads)
  try {
    const res = await axios.get(
      'https://huggingface.co/api/models?sort=downloads&direction=-1&limit=10&pipeline_tag=text-generation',
      { timeout: 10000 }
    );
    if (Array.isArray(res.data)) {
      res.data.forEach(m => {
        const name = m.modelId || m.id;
        if (name && !models.has(name)) {
          models.set(name, {
            type: 'huggingface',
            modelName: name,
            capabilities: ['text-generation'],
            cost: 0,
            performance: { speed: 0.5, accuracy: 0.5 },
            requiresKey: true,
          });
          discovered++;
          console.log(`[UAIC] 🆕 Model descoperit pe HuggingFace: ${name}`);
        }
      });
    }
  } catch { /* network issues – skip */ }

  if (discovered > 0) saveModels();
  console.log(`[UAIC] ✅ Descoperire completă. ${models.size} modele active.`);
}

// ─── Model selection ──────────────────────────────────────────────────────────
function selectModel(task, exclude = null) {
  const rule = ROUTING_RULES.find(r => r.taskType === task.type) || ROUTING_RULES[0];
  const capability = task.capability || 'text-generation';

  let candidates = Array.from(models.entries())
    .filter(([name, m]) => name !== exclude)
    .filter(([, m]) => m.capabilities.includes(capability) || m.capabilities.includes('text-generation'));

  if (candidates.length === 0) return null;

  if (rule.strategy === 'cheapest') {
    candidates.sort((a, b) => a[1].cost - b[1].cost);
  } else if (rule.strategy === 'best-accuracy') {
    candidates.sort((a, b) => b[1].performance.accuracy - a[1].performance.accuracy);
  } else if (rule.strategy === 'fastest') {
    candidates.sort((a, b) => b[1].performance.speed - a[1].performance.speed);
  } else if (rule.strategy === 'best-code') {
    candidates = candidates.filter(([, m]) => m.capabilities.includes('code'));
    if (candidates.length === 0) {
      // fallback to best-accuracy if no code-capable model
      candidates = Array.from(models.entries())
        .filter(([name, m]) => name !== exclude)
        .sort((a, b) => b[1].performance.accuracy - a[1].performance.accuracy);
    } else {
      candidates.sort((a, b) => b[1].performance.accuracy - a[1].performance.accuracy);
    }
  }

  if (candidates.length === 0) return null;
  return { name: candidates[0][0], ...candidates[0][1] };
}

// ─── Call a specific model ────────────────────────────────────────────────────
async function callModel(model, task) {
  const { type, endpoint, apiKey, modelName } = model;
  const prompt    = task.prompt;
  const maxTokens = task.maxTokens || 500;
  const messages  = task.messages || [{ role: 'user', content: prompt }];
  const system    = task.system   || null;

  // ── OpenAI-compatible (OpenAI, DeepSeek) ──────────────────────────────────
  if (type === 'openai' || type === 'deepseek') {
    const payload = {
      model: modelName || (type === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat'),
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
      max_tokens: maxTokens,
      temperature: task.temperature || 0.7,
    };
    const resp = await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 25000,
    });
    return resp.data.choices[0].message.content;
  }

  // ── Anthropic Claude ──────────────────────────────────────────────────────
  if (type === 'anthropic') {
    const payload = {
      model: modelName || 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages,
    };
    if (system) payload.system = system;
    const resp = await axios.post(endpoint, payload, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      timeout: 25000,
    });
    return resp.data.content[0].text;
  }

  // ── Google Gemini ─────────────────────────────────────────────────────────
  if (type === 'google') {
    const parts = system
      ? [{ text: `${system}\n\n${prompt}` }]
      : [{ text: prompt }];
    const resp = await axios.post(`${endpoint}?key=${apiKey}`, {
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: task.temperature || 0.7 },
    }, { timeout: 25000 });
    return resp.data.candidates[0].content.parts[0].text;
  }

  // ── Local Ollama via LlamaBridge ──────────────────────────────────────────
  if (type === 'local' && _llamaBridge) {
    const priority = task.priority || _llamaBridge.PRIORITY.CHAT;
    const result = await _llamaBridge.generate(prompt, priority, system || '');
    if (result) return result;
    throw new Error('LlamaBridge returned null (Ollama unavailable)');
  }

  throw new Error(`Tip de model necunoscut sau nedisponibil: ${type}`);
}

// ─── Public ask() ─────────────────────────────────────────────────────────────
/**
 * Trimite o sarcină către cel mai potrivit model AI.
 * @param {Object} task
 * @param {string} task.type       - 'simple' | 'complex' | 'creative' | 'code' | 'chat'
 * @param {string} task.prompt     - Textul cererii
 * @param {string} [task.system]   - Mesaj de sistem (context)
 * @param {Array}  [task.messages] - Istoric conversație [{role, content}]
 * @param {number} [task.maxTokens]
 * @param {number} [task.priority] - Prioritate LlamaBridge (P2/P3/P4)
 * @returns {Promise<{ text: string, model: string }>}
 */
async function ask(task) {
  stats.totalCalls++;

  const primary = selectModel(task);
  if (!primary) {
    stats.errors++;
    throw new Error('[UAIC] Niciun model AI disponibil pentru această sarcină.');
  }

  try {
    const text = await callModel(primary, task);
    stats.callsByModel[primary.name] = (stats.callsByModel[primary.name] || 0) + 1;
    return { text, model: primary.name };
  } catch (err) {
    console.warn(`[UAIC] ⚠️ Model ${primary.name} a eșuat: ${err.message} — încerc fallback...`);
    stats.errors++;

    // Try fallback model (exclude primary)
    const fallback = selectModel(task, primary.name);
    if (fallback) {
      try {
        const text = await callModel(fallback, task);
        stats.callsByModel[fallback.name] = (stats.callsByModel[fallback.name] || 0) + 1;
        stats.fallbacks++;
        return { text, model: `${fallback.name} (fallback)` };
      } catch (err2) {
        console.warn(`[UAIC] ⚠️ Fallback ${fallback.name} a eșuat: ${err2.message}`);
        stats.errors++;
      }
    }

    throw new Error('[UAIC] Toate modelele AI au eșuat.');
  }
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function getStatus() {
  return {
    active: true,
    models: models.size,
    stats: { ...stats },
    providers: Array.from(models.keys()),
    llamaAvailable: _llamaBridge ? _llamaBridge.getStatus().available : false,
  };
}

function getModels() {
  return Array.from(models.entries()).map(([name, data]) => ({
    name,
    type: data.type,
    capabilities: data.capabilities,
    cost: data.cost,
    performance: data.performance,
    // Never expose apiKey
  }));
}

// ─── Express router (admin-protected) ─────────────────────────────────────────
function getRouter(secretMiddleware) {
  const router = require('express').Router();
  router.use(secretMiddleware);

  router.get('/models', (req, res) => res.json(getModels()));
  router.get('/stats',  (req, res) => res.json(getStatus()));

  router.post('/discover', async (req, res) => {
    await discoverNewModels();
    res.json({ success: true, models: models.size });
  });

  router.post('/ask', async (req, res) => {
    const { type = 'simple', prompt, system, maxTokens, messages } = req.body || {};
    if (!prompt && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'prompt or messages required' });
    }
    try {
      const result = await ask({ type, prompt, system, maxTokens, messages });
      res.json(result);
    } catch (err) {
      res.status(503).json({ error: err.message });
    }
  });

  return router;
}

// ─── Auto-start ───────────────────────────────────────────────────────────────
async function start() {
  console.log('[UAIC] 🤖 Pornire Universal AI Connector...');
  loadKnownModels();

  // Cron: redescoperire zilnică la miezul nopții
  cron.schedule('0 0 * * *', () => {
    discoverNewModels().catch(err => console.error('[UAIC] Discovery error:', err.message));
  });

  // Descoperire imediată la startup (non-blocking)
  discoverNewModels().catch(err => console.error('[UAIC] Initial discovery error:', err.message));

  console.log(`[UAIC] ✅ Universal AI Connector activ. Modele încărcate: ${models.size}`);
  if (models.size === 0) {
    console.warn('[UAIC] ⚠️  Nicio cheie API configurată. Setează OPENAI_API_KEY / DEEPSEEK_API_KEY / CLAUDE_API_KEY / GEMINI_API_KEY în .env');
  }
}

// Auto-start when required
start().catch(err => console.error('[UAIC] Start error:', err.message));

module.exports = { ask, getStatus, getModels, getRouter, start, discoverNewModels };
