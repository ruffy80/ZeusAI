// ADI-Core Discovery Module — REAL
// Discovers AI providers/models from env (keys present) and local sibling modules.
// No external deps. Safe to fail at every step.

const fs = require('fs');
const path = require('path');

const KNOWN_PROVIDERS = [
  { id: 'openai',      env: 'OPENAI_API_KEY',      probe: 'https://api.openai.com/v1/models',                          tags: ['llm','chat','embeddings'] },
  { id: 'anthropic',   env: 'ANTHROPIC_API_KEY',   probe: 'https://api.anthropic.com/v1/models',                       tags: ['llm','chat'] },
  { id: 'deepseek',    env: 'DEEPSEEK_API_KEY',    probe: 'https://api.deepseek.com/v1/models',                        tags: ['llm','chat','cheap'] },
  { id: 'mistral',     env: 'MISTRAL_API_KEY',     probe: 'https://api.mistral.ai/v1/models',                          tags: ['llm','chat'] },
  { id: 'groq',        env: 'GROQ_API_KEY',        probe: 'https://api.groq.com/openai/v1/models',                     tags: ['llm','chat','fast'] },
  { id: 'gemini',      env: 'GEMINI_API_KEY',      probe: 'https://generativelanguage.googleapis.com/v1beta/models',   tags: ['llm','chat','vision'] },
  { id: 'cohere',      env: 'COHERE_API_KEY',      probe: 'https://api.cohere.ai/v1/models',                           tags: ['llm','embeddings'] },
  { id: 'openrouter',  env: 'OPENROUTER_API_KEY',  probe: 'https://openrouter.ai/api/v1/models',                       tags: ['llm','chat','router'] },
  { id: 'perplexity',  env: 'PERPLEXITY_API_KEY',  probe: 'https://api.perplexity.ai/chat/completions',                tags: ['llm','search'] },
  { id: 'huggingface', env: 'HUGGINGFACE_API_KEY', probe: 'https://huggingface.co/api/models',                         tags: ['llm','open'] },
  { id: 'together',    env: 'TOGETHER_API_KEY',    probe: 'https://api.together.xyz/v1/models',                        tags: ['llm','open'] },
  { id: 'fireworks',   env: 'FIREWORKS_API_KEY',   probe: 'https://api.fireworks.ai/inference/v1/models',              tags: ['llm','fast'] },
  { id: 'sambanova',   env: 'SAMBANOVA_API_KEY',   probe: 'https://api.sambanova.ai/v1/models',                        tags: ['llm','fast'] },
  { id: 'nvidia',      env: 'NVIDIA_API_KEY',      probe: 'https://integrate.api.nvidia.com/v1/models',                tags: ['llm','infra'] },
  { id: 'xai',         env: 'XAI_API_KEY',         probe: 'https://api.x.ai/v1/models',                                tags: ['llm','chat'] },
];

function discoverLocalModules() {
  const out = [];
  const modulesDir = path.join(__dirname, '..');
  try {
    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    for (const e of entries) {
      const name = e.name.toLowerCase();
      if (name === 'adi-core') continue;
      if (/ai|llm|provider|router|model|gpt|claude|gemini/.test(name)) {
        out.push({
          id: `local:${e.name}`,
          type: 'local-module',
          path: path.join(modulesDir, e.name),
          meta: { tags: ['local','module'] }
        });
      }
    }
  } catch (_) {}
  return out;
}

function discoverFromEnv() {
  const out = [];
  for (const p of KNOWN_PROVIDERS) {
    const key = process.env[p.env];
    if (key && String(key).length > 8) {
      out.push({
        id: p.id,
        type: 'remote-api',
        url: p.probe,
        envVar: p.env,
        meta: { tags: p.tags, hasKey: true }
      });
    }
  }
  return out;
}

async function discover() {
  return [...discoverFromEnv(), ...discoverLocalModules()];
}

module.exports = { discover, KNOWN_PROVIDERS };
