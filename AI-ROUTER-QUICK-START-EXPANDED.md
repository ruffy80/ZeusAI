# 🤖 AI ROUTER EXPANDED - QUICK START GUIDE

## 10 Providers at Your Fingertips

```
✅ OpenAI          (gpt-4o, o-mini)
✅ Anthropic       (Claude 3.5 Sonnet)
✅ Google          (Gemini 1.5 Pro/Flash)
✅ Groq            (Llama 70B - super fast)
✅ DeepSeek        (V3, R1, Coder)
✅ OpenRouter      (50+ models)
🆕 Cohere          (Command R, Embeddings)
🆕 Mistral AI      (Large, Medium, Small)
🆕 Fireworks       (Qwen, Mixtral - ultra fast)
🆕 Replicate       (Llama, Flux, Video)
```

## One-Liner API Usage

```bash
# Best cheap model for coding
curl "http://localhost:3000/api/ai/select-by-budget?task=coding&budget=cheap" | jq '.model'

# Cost to run 10K tokens through chat
curl "http://localhost:3000/api/ai/estimate-cost?task=chat&tokens=10000" | jq '.estimatedCost'

# All available models for your task
curl "http://localhost:3000/api/ai/models?task=embedding" | jq

# Health check (see how many providers active)
curl http://localhost:3000/api/ai/health | jq
```

## Task Types Available

| Task | Best For | Example |
|------|----------|---------|
| `coding` | Write/fix code | API generation, debugging |
| `reasoning` | Math, logic, complex thinking | Problem solving, analysis |
| `chat` | Natural conversation | Customer support, chatbots |
| `longContext` | Process 100K+ tokens | Document analysis, RAG |
| `multimodal` | Text + images/video | Image understanding |
| `embedding` | Convert text → vectors | RAG, semantic search |
| `moderation` | Detect toxic content | Safety checks |
| `imageGeneration` | Create images | DALL-E alternative |
| `videoGeneration` | Create videos | Video synthesis |
| `default` | General purpose | Fallback for unknown |

## Budget Modes

| Mode | Speed | Cost | Best For |
|------|-------|------|----------|
| `free` | ⚡⚡⚡ | 💰 | Learning, high volume |
| `cheap` | ⚡⚡ | 💰💰 | Production, cost-sensitive |
| `balanced` | ⚡ | 💰💰💰 | Most use cases |
| `best` | 🐢 | 💰💰💰💰 | Complex reasoning, quality |

## Setup (2 minutes)

### 1. Add API Keys to `.env`
```bash
COHERE_API_KEY=your-cohere-key
MISTRAL_API_KEY=your-mistral-key
FIREWORKS_API_KEY=your-fireworks-key
REPLICATE_API_KEY=your-replicate-key
```

### 2. Start Backend
```bash
cd UNICORN_FINAL/backend
PORT=3000 ADMIN_SECRET=secret node index.js
```

### 3. Query APIs
```bash
# See active providers
curl http://localhost:3000/api/ai/providers | jq '.active | keys'

# Get best cheap model for any task
curl "http://localhost:3000/api/ai/select-by-budget?task=CODE&budget=cheap"

# Estimate costs before running
curl "http://localhost:3000/api/ai/estimate-cost?task=CODE&tokens=1000"
```

## Cost Reference (per 1M tokens)

| Model | Cost | Speed | Quality |
|-------|------|-------|---------|
| **Gemini 1.5 Flash** | $0.075 | ⚡⚡⚡ | Good |
| **Qwen 2.5 72B** | $0.30 | ⚡⚡⚡ | Very Good |
| **Mistral Small** | $0.14 | ⚡⚡⚡ | Good |
| **Groq Llama 70B** | $0.27 | ⚡⚡⚡ | Good |
| **Cohere Command R** | $0.50 | ⚡⚡ | Very Good |
| **DeepSeek Chat** | $0.14 | ⚡⚡⚡ | Good |
| **DeepSeek R1** | $0.55 | ⚡ | Excellent |
| **Mistral Large** | $2.70 | ⚡⚡ | Excellent |
| **Gemini 1.5 Pro** | $7.50 | ⚡ | Excellent |
| **GPT-4o** | $5.00 | ⚡ | Excellent |
| **Claude 3.5** | $3.00 | ⚡ | Excellent |

## Real Examples

### Example 1: Chat App (Budget: $100/month)
```bash
# Use cheap models by default
curl "http://localhost:3000/api/ai/select-by-budget?task=chat&budget=cheap"
# Returns: Groq Llama 70B (~$0.27/M tokens)

# Estimate cost for user message (500 tokens)
curl "http://localhost:3000/api/ai/estimate-cost?task=chat&tokens=500"
# Response: $0.000135 = ~3.6¢ per user per month if 1000 users
```

### Example 2: RAG System (Semantic Search)
```bash
# Get best embeddings provider
curl "http://localhost:3000/api/ai/select-model?task=embedding"
# Returns: cohere-embed-english-v3

# Cost for embedding 100K documents (avg 100 tokens each)
curl "http://localhost:3000/api/ai/estimate-cost?task=embedding&tokens=10000000"
# Response: $0.75 (once, then reuse embeddings)
```

### Example 3: Code Generation (Quality First)
```bash
# Get best coding model
curl "http://localhost:3000/api/ai/select-by-budget?task=coding&budget=best"
# Returns: gpt-4o (~$5/M tokens)

# Cost for 8K context window (input) + 2K output
curl "http://localhost:3000/api/ai/estimate-cost?task=coding&tokens=10000"
# Response: $0.05 per code generation
```

### Example 4: Long Document Analysis (200K tokens)
```bash
# Need long context (Gemini Pro handles 1M tokens)
curl "http://localhost:3000/api/ai/select-model?task=longContext"
# Returns: gemini-1.5-pro

# Check cost for large doc
curl "http://localhost:3000/api/ai/estimate-cost?task=longContext&tokens=200000"
# Response: $1.50
```

## Application Integration Pattern

```javascript
// Example: Auto-select model based on budget
async function aiRequest(task, budget, prompt) {
  // 1. Select model
  const response = await fetch(`/api/ai/select-by-budget?task=${task}&budget=${budget}`);
  const { provider, model } = await response.json();
  
  // 2. Estimate cost
  const costRes = await fetch(`/api/ai/estimate-cost?task=${task}&tokens=1000`);
  const { estimatedCost } = await costRes.json();
  
  // 3. Check budget
  if (estimatedCost > MY_BUDGET_LIMIT) {
    return downgradeToFreeModel();
  }
  
  // 4. Call LLM API with selected provider
  return callLLM(provider, model, prompt);
}
```

## Troubleshooting

**Q: All requests return "No AI providers configured"**  
A: Add at least one real API key to `.env` (Google or Groq are free/cheap to start)

**Q: Cost estimate returns null**  
A: Model not in cost database. Add manual estimate to `aiProviderRouter.js` costDataor use default $0.50/M estimate

**Q: Want to force use specific provider?**  
A: Use `/api/ai/providers` to check active providers, then adjust budget mode to favor them

**Q: How to deploy with all 10 providers?**  
A: Run `scripts/setup-hetzner-auto.js` - it automatically whitelists all 10 API keys

## Files & Docs

- 📄 [AI-ROUTER-EXPANDED-SUMMARY.md](AI-ROUTER-EXPANDED-SUMMARY.md) - Full technical details
- 📄 [AI-PROVIDER-ROUTER-SUMMARY.md](AI-PROVIDER-ROUTER-SUMMARY.md) - Original 6 providers
- 📄 [.env.ai-providers.example](.env.ai-providers.example) - Setup instructions

## Status

✅ **Production Ready**
- 10 providers configured
- 10 task types supported
- Cost tracking enabled
- Budget modes working
- All endpoints tested

🚀 **Next**: Add your API keys and start building with the best models for each task!
