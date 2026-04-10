// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:53:50.313Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:49:07.887Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:43:56.577Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:34:58.223Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// universal-ai-connector.js
// Modul UAIC – conectare automată la toate AI-urile disponibile
// Rutare inteligentă: cheapest pentru sarcini simple/chat, best-accuracy pentru sarcini complexe

'use strict';

const axios = require('axios');

// Configurație provideri – toți opționali, activi doar dacă există cheia în .env
const PROVIDER_CONFIGS = [
  {
    name: 'deepseek-r1',
    type: 'openai-compat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    capabilities: ['text-generation', 'reasoning', 'code'],
    cost: 0.001,
    performance: { speed: 0.95, accuracy: 0.92 },
  },
  {
    name: 'openai-gpt4o-mini',
    type: 'openai-compat',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    capabilities: ['text-generation', 'reasoning', 'code'],
    cost: 0.015,
    performance: { speed: 0.9, accuracy: 0.95 },
  },
  {
    name: 'openai-gpt4',
    type: 'openai-compat',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4',
    apiKeyEnv: 'OPENAI_API_KEY',
    capabilities: ['text-generation', 'reasoning', 'code'],
    cost: 0.03,
    performance: { speed: 0.85, accuracy: 0.98 },
  },
  {
    name: 'mistral',
    type: 'openai-compat',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
    apiKeyEnv: 'MISTRAL_API_KEY',
    capabilities: ['text-generation', 'reasoning'],
    cost: 0.008,
    performance: { speed: 0.88, accuracy: 0.91 },
  },
  {
    name: 'claude-3',
    type: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    capabilities: ['text-generation', 'reasoning', 'code'],
    cost: 0.0025,
    performance: { speed: 0.9, accuracy: 0.94 },
  },
  {
    name: 'gemini-pro',
    type: 'google',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    model: 'gemini-1.5-flash',
    apiKeyEnv: 'GEMINI_API_KEY',
    capabilities: ['text-generation', 'reasoning'],
    cost: 0.002,
    performance: { speed: 0.92, accuracy: 0.91 },
  },
  {
    name: 'cohere',
    type: 'cohere',
    endpoint: 'https://api.cohere.com/v1/chat',
    model: 'command-r',
    apiKeyEnv: 'COHERE_API_KEY',
    capabilities: ['text-generation', 'reasoning'],
    cost: 0.003,
    performance: { speed: 0.85, accuracy: 0.88 },
  },
];

class UniversalAIConnector {
  constructor()
    this.cache = new Map(); this.cacheTTL = 60000; {
    // Lista activă de modele cu cheie API disponibilă
    this.models = [];
    this.stats = { totalCalls: 0, callsByModel: {}, errors: {} };
    this._loadActiveModels();
  }

  // Construiește lista de modele disponibile (cheie prezentă în .env)
  _loadActiveModels() {
    this.models = PROVIDER_CONFIGS.filter(cfg => {
      const key = process.env[cfg.apiKeyEnv];
      return key && key.length > 10 && !key.includes('your_');
    }).map(cfg => ({ ...cfg, apiKey: process.env[cfg.apiKeyEnv] }));

    console.log(`[UAIC] Modele active: ${this.models.map(m => m.name).join(', ') || 'niciun model – setează cheile API'}`);
  }

  // Returnează modelele disponibile (fără cheile API)
  getModels() {
    return this.models.map(({ apiKey, ...rest }) => rest); // eslint-disable-line no-unused-vars
  }

  getStats() {
    return { ...this.stats, availableModels: this.models.length };
  }

  // Selectează cel mai bun model pentru tip de sarcină
  // taskType: 'simple' (cheapest) | 'complex' (best accuracy) | 'fast' (best speed)
  selectModel(taskType = 'simple', excludeNames = []) {
    const candidates = this.models.filter(m => !excludeNames.includes(m.name));
    if (candidates.length === 0) return null;

    if (taskType === 'complex') {
      return [...candidates].sort((a, b) => b.performance.accuracy - a.performance.accuracy)[0];
    }
    if (taskType === 'fast') {
      return [...candidates].sort((a, b) => b.performance.speed - a.performance.speed)[0];
    }
    // 'simple' / default: cel mai ieftin
    return [...candidates].sort((a, b) => a.cost - b.cost)[0];
  }

  // Trimite un prompt către cel mai bun model disponibil, cu fallback automat
  // options: { taskType, systemPrompt, maxTokens, history, excludeNames }
  async ask(prompt, options = {}) {
    const {
      taskType = 'simple',
      systemPrompt = 'You are Zeus AI, a helpful assistant.',
      maxTokens = 500,
      history = [],         // array of { role, content }
      excludeNames = [],
    } = options;

    this.stats.totalCalls++;

    const model = this.selectModel(taskType, excludeNames);
    if (!model) {
      throw new Error('[UAIC] Niciun model AI disponibil. Setează cel puțin o cheie API (OPENAI_API_KEY, DEEPSEEK_API_KEY etc.)');
    }

    try {
      const result = await this._callModel(model, prompt, { systemPrompt, maxTokens, history });
      this.stats.callsByModel[model.name] = (this.stats.callsByModel[model.name] || 0) + 1;
      return { text: result, model: model.name };
    } catch (err) {
      this.stats.errors[model.name] = (this.stats.errors[model.name] || 0) + 1;
      console.warn(`[UAIC] ${model.name} a eșuat: ${err.message}. Încerc fallback...`);

      // Fallback automat la următorul model
      const newExclude = [...excludeNames, model.name];
      if (newExclude.length < this.models.length) {
        return this.ask(prompt, { ...options, excludeNames: newExclude });
      }
      throw new Error(`[UAIC] Toate modelele au eșuat. Ultima eroare: ${err.message}`);
    }
  }

  // Apelant intern per tip de provider
  async _callModel(model, prompt, { systemPrompt, maxTokens, history }) {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: prompt },
    ];

    if (model.type === 'openai-compat') {
      const res = await axios.post(model.endpoint, {
        model: model.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }, {
        headers: { Authorization: `Bearer ${model.apiKey}`, 'Content-Type': 'application/json' },
        timeout: 25000,
      });
      return res.data.choices[0].message.content;
    }

    if (model.type === 'anthropic') {
      const res = await axios.post(model.endpoint, {
        model: model.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: prompt },
        ],
      }, {
        headers: {
          'x-api-key': model.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 25000,
      });
      return res.data.content[0].text;
    }

    if (model.type === 'google') {
      const contents = [
        ...history.slice(-6).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: prompt }] },
      ];
      const res = await axios.post(`${model.endpoint}?key=${model.apiKey}`, {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000,
      });
      return res.data.candidates[0].content.parts[0].text;
    }

    if (model.type === 'cohere') {
      const chatHistory = history.slice(-6).map(m => ({
        role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: m.content,
      }));
      const res = await axios.post(model.endpoint, {
        model: model.model,
        preamble: systemPrompt,
        chat_history: chatHistory,
        message: prompt,
        max_tokens: maxTokens,
      }, {
        headers: { Authorization: `Bearer ${model.apiKey}`, 'Content-Type': 'application/json' },
        timeout: 25000,
      });
      return res.data.text;
    }

    throw new Error(`[UAIC] Tip de provider necunoscut: ${model.type}`);
  }

  // Router Express pentru rute admin /api/uaic/*
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);

    router.get('/models', (req, res) => {
      res.json({ models: this.getModels(), count: this.models.length });
    });

    router.get('/stats', (req, res) => {
      res.json(this.getStats());
    });

    router.post('/reload', (req, res) => {
      this._loadActiveModels();
      res.json({ success: true, modelsLoaded: this.models.length });
    });

    return router;
  }
}

module.exports = new UniversalAIConnector();
