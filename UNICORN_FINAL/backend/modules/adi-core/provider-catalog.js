// ADI-Core Provider Catalog
// Sursa unica de adevar pentru providerii AI cunoscuti.
// - keyless: true => merge fara cheie (free/public)
// - envAliases: lista de nume variabile env in care s-ar putea afla cheia
// - signupUrl: unde se obtine o cheie (pentru auto-onboarding/operator/agent)
// - chatUrl: endpoint OpenAI-compatible (sau provider-native pentru gemini)
// - probeUrl: endpoint GET pe care il lovim pentru health-check
// - flavor: 'openai' | 'anthropic' | 'gemini' | 'pollinations' | 'hf-router' | 'ollama'

const PROVIDERS = [
  // ───────────────── KEYLESS / FREE / PUBLIC ─────────────────
  {
    id: 'pollinations',
    keyless: true,
    flavor: 'pollinations',
    probeUrl: 'https://text.pollinations.ai/models',
    chatUrl: 'https://text.pollinations.ai/openai',
    defaultModel: 'openai',
    tags: ['llm', 'chat', 'free', 'public'],
    signupUrl: null,
    notes: 'Pollinations.AI – text + image gratuit, fara cheie.',
  },
  {
    id: 'ollama-local',
    keyless: true,
    flavor: 'ollama',
    probeUrl: (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434') + '/api/tags',
    chatUrl: (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434') + '/v1/chat/completions',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2',
    tags: ['llm', 'chat', 'local', 'free'],
    signupUrl: 'https://ollama.com/download',
    notes: 'Ollama local – ruleaza modele open-source pe acelasi host.',
  },
  {
    id: 'duckduckgo-ai',
    keyless: true,
    flavor: 'duckduckgo',
    probeUrl: 'https://duckduckgo.com/duckchat/v1/status',
    chatUrl: 'https://duckduckgo.com/duckchat/v1/chat',
    defaultModel: 'gpt-4o-mini',
    tags: ['llm', 'chat', 'free', 'privacy'],
    signupUrl: null,
    notes: 'DuckDuckGo AI Chat – proxy gratuit catre modele majore.',
  },
  {
    id: 'huggingface-public',
    keyless: true,
    flavor: 'hf-router',
    probeUrl: 'https://router.huggingface.co/v1/models',
    chatUrl: 'https://router.huggingface.co/v1/chat/completions',
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct',
    tags: ['llm', 'chat', 'free', 'open'],
    envAliases: ['HUGGINGFACE_API_KEY', 'HF_TOKEN', 'HUGGING_FACE_HUB_TOKEN'],
    signupUrl: 'https://huggingface.co/settings/tokens',
    notes: 'HuggingFace Router – rate-limited gratuit, mai bun cu token.',
  },

  // ───────────────── PAID / KEYED ─────────────────
  {
    id: 'openai',
    flavor: 'openai',
    envAliases: ['OPENAI_API_KEY', 'OPENAI_KEY', 'OPENAI_TOKEN'],
    probeUrl: 'https://api.openai.com/v1/models',
    chatUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    tags: ['llm', 'chat', 'embeddings', 'vision'],
    signupUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    flavor: 'anthropic',
    envAliases: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    probeUrl: 'https://api.anthropic.com/v1/models',
    chatUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-haiku-latest',
    tags: ['llm', 'chat'],
    signupUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'deepseek',
    flavor: 'openai',
    envAliases: ['DEEPSEEK_API_KEY'],
    probeUrl: 'https://api.deepseek.com/v1/models',
    chatUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    tags: ['llm', 'chat', 'cheap'],
    signupUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'mistral',
    flavor: 'openai',
    envAliases: ['MISTRAL_API_KEY'],
    probeUrl: 'https://api.mistral.ai/v1/models',
    chatUrl: 'https://api.mistral.ai/v1/chat/completions',
    defaultModel: 'mistral-small-latest',
    tags: ['llm', 'chat'],
    signupUrl: 'https://console.mistral.ai/api-keys/',
  },
  {
    id: 'groq',
    flavor: 'openai',
    envAliases: ['GROQ_API_KEY'],
    probeUrl: 'https://api.groq.com/openai/v1/models',
    chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    tags: ['llm', 'chat', 'fast', 'cheap'],
    signupUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'gemini',
    flavor: 'gemini',
    envAliases: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    probeUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    chatUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-2.0-flash',
    tags: ['llm', 'chat', 'vision', 'free-tier'],
    signupUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'cohere',
    flavor: 'openai',
    envAliases: ['COHERE_API_KEY'],
    probeUrl: 'https://api.cohere.ai/v1/models',
    chatUrl: 'https://api.cohere.ai/compatibility/v1/chat/completions',
    defaultModel: 'command-r-plus',
    tags: ['llm', 'embeddings'],
    signupUrl: 'https://dashboard.cohere.com/api-keys',
  },
  {
    id: 'openrouter',
    flavor: 'openai',
    envAliases: ['OPENROUTER_API_KEY'],
    probeUrl: 'https://openrouter.ai/api/v1/models',
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
    tags: ['llm', 'chat', 'router', 'free-tier'],
    signupUrl: 'https://openrouter.ai/settings/keys',
  },
  {
    id: 'perplexity',
    flavor: 'openai',
    envAliases: ['PERPLEXITY_API_KEY'],
    probeUrl: 'https://api.perplexity.ai/chat/completions',
    chatUrl: 'https://api.perplexity.ai/chat/completions',
    defaultModel: 'sonar',
    tags: ['llm', 'chat', 'search'],
    signupUrl: 'https://www.perplexity.ai/settings/api',
  },
  {
    id: 'together',
    flavor: 'openai',
    envAliases: ['TOGETHER_API_KEY'],
    probeUrl: 'https://api.together.xyz/v1/models',
    chatUrl: 'https://api.together.xyz/v1/chat/completions',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    tags: ['llm', 'open', 'free-tier'],
    signupUrl: 'https://api.together.xyz/settings/api-keys',
  },
  {
    id: 'fireworks',
    flavor: 'openai',
    envAliases: ['FIREWORKS_API_KEY'],
    probeUrl: 'https://api.fireworks.ai/inference/v1/models',
    chatUrl: 'https://api.fireworks.ai/inference/v1/chat/completions',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    tags: ['llm', 'fast'],
    signupUrl: 'https://fireworks.ai/account/api-keys',
  },
  {
    id: 'sambanova',
    flavor: 'openai',
    envAliases: ['SAMBANOVA_API_KEY'],
    probeUrl: 'https://api.sambanova.ai/v1/models',
    chatUrl: 'https://api.sambanova.ai/v1/chat/completions',
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
    tags: ['llm', 'fast'],
    signupUrl: 'https://cloud.sambanova.ai/apis',
  },
  {
    id: 'nvidia',
    flavor: 'openai',
    envAliases: ['NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY'],
    probeUrl: 'https://integrate.api.nvidia.com/v1/models',
    chatUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    tags: ['llm', 'infra'],
    signupUrl: 'https://build.nvidia.com/explore/discover',
  },
  {
    id: 'xai',
    flavor: 'openai',
    envAliases: ['XAI_API_KEY', 'GROK_API_KEY'],
    probeUrl: 'https://api.x.ai/v1/models',
    chatUrl: 'https://api.x.ai/v1/chat/completions',
    defaultModel: 'grok-2-latest',
    tags: ['llm', 'chat'],
    signupUrl: 'https://console.x.ai/team/default/api-keys',
  },
  {
    id: 'cerebras',
    flavor: 'openai',
    envAliases: ['CEREBRAS_API_KEY'],
    probeUrl: 'https://api.cerebras.ai/v1/models',
    chatUrl: 'https://api.cerebras.ai/v1/chat/completions',
    defaultModel: 'llama3.3-70b',
    tags: ['llm', 'fast', 'free-tier'],
    signupUrl: 'https://cloud.cerebras.ai/?tab=api-keys',
  },
  {
    id: 'glhf',
    flavor: 'openai',
    envAliases: ['GLHF_API_KEY'],
    probeUrl: 'https://glhf.chat/api/openai/v1/models',
    chatUrl: 'https://glhf.chat/api/openai/v1/chat/completions',
    defaultModel: 'hf:meta-llama/Llama-3.3-70B-Instruct',
    tags: ['llm', 'open', 'free-tier'],
    signupUrl: 'https://glhf.chat/users/settings/api',
  },
];

// Learned providers loaded from disk (populated by world-scanner.js).
const fs   = require('fs');
const path = require('path');
const LEARNED_FILE = path.join(__dirname, '..', '..', '..', '.data', 'learned-providers.json');

function loadLearned() {
  try {
    if (!fs.existsSync(LEARNED_FILE)) return [];
    const j = JSON.parse(fs.readFileSync(LEARNED_FILE, 'utf8'));
    return Array.isArray(j.providers) ? j.providers : [];
  } catch { return []; }
}

function all() {
  const staticIds = new Set(PROVIDERS.map(p => p.id));
  const learned = loadLearned().filter(p => p && p.id && !staticIds.has(p.id));
  return [...PROVIDERS, ...learned];
}

function learned() { return loadLearned(); }
function byId(id) { return all().find(p => p.id === id) || null; }
function paid() { return all().filter(p => !p.keyless); }
function keylessOnly() { return all().filter(p => p.keyless); }

module.exports = { PROVIDERS, all, learned, byId, paid, keyless: keylessOnly };
