# 📚 AI ROUTER DOCUMENTATION INDEX

Complete guide to UNICORN's expanded 10-provider AI router system.

## 📖 Documentation Files

### 🚀 **START HERE**
- **[AI-ROUTER-FINAL-SUMMARY.md](AI-ROUTER-FINAL-SUMMARY.md)** ← Best overview
  - Complete feature summary (10 providers, 10 tasks, 4 budgets)
  - Usage examples for real applications
  - Cost comparisons
  - Getting started guide

- **[AI-ROUTER-QUICK-START-EXPANDED.md](AI-ROUTER-QUICK-START-EXPANDED.md)** ← 2-minute setup
  - Quick reference for common tasks
  - One-liner API examples
  - Cost reference table
  - Troubleshooting

### 📊 **DETAILED REFERENCES**

- **[AI-ROUTER-EXPANDED-SUMMARY.md](AI-ROUTER-EXPANDED-SUMMARY.md)** ← Technical deep dive
  - Architecture & provider specs
  - New model categories (multimodal, embeddings, moderation)
  - Cost strategy configuration
  - API endpoint reference
  - File changes summary

- **[AI-PROVIDER-ROUTER-SUMMARY.md](AI-PROVIDER-ROUTER-SUMMARY.md)** ← Original 6 providers
  - First iteration with OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter
  - Placeholder-safe validation
  - Admin-protected routes
  - Initial integration details

### 🔍 **QUICK REFERENCE**
- **[AI-ROUTER-QUICK-REF.md](AI-ROUTER-QUICK-REF.md)** ← Cheat sheet
  - 2-minute setup
  - All endpoints
  - Budget modes table
  - Provider models matrix
  - Extension pattern for new providers

---

## 🎯 Reading Guide

### For First-Time Users
1. Start: [AI-ROUTER-FINAL-SUMMARY.md](AI-ROUTER-FINAL-SUMMARY.md) (5 min read)
2. Quick start: [AI-ROUTER-QUICK-START-EXPANDED.md](AI-ROUTER-QUICK-START-EXPANDED.md) (2 min)
3. Set up: Add API keys to `.env` and test endpoints

### For Developers
1. Overview: [AI-ROUTER-FINAL-SUMMARY.md](AI-ROUTER-FINAL-SUMMARY.md)
2. Details: [AI-ROUTER-EXPANDED-SUMMARY.md](AI-ROUTER-EXPANDED-SUMMARY.md)
3. Implementation: Check `backend/modules/aiProviderRouter.js`

### For DevOps/Deployment
1. Files: [AI-ROUTER-EXPANDED-SUMMARY.md](AI-ROUTER-EXPANDED-SUMMARY.md#files-modified)
2. Hetzner: Use `scripts/setup-hetzner-auto.js` (auto-configures all 10 keys)
3. Verify: Run `npm test`

### For Cost Analysis
1. Reference: [AI-ROUTER-QUICK-START-EXPANDED.md](AI-ROUTER-QUICK-START-EXPANDED.md#cost-reference-per-1m-tokens)
2. Estimation: Use `/api/ai/estimate-cost` endpoint
3. Examples: [AI-ROUTER-FINAL-SUMMARY.md](AI-ROUTER-FINAL-SUMMARY.md#usage-examples)

---

## 🔑 Key Concepts

### Providers (10 total)
```
Tier 1: OpenAI, Anthropic, Google
Tier 2: DeepSeek, Mistral, Cohere
Tier 3: Groq, Fireworks, Replicate
Tier 4: OpenRouter (proxy)
```

### Tasks (10 supported)
```
coding, reasoning, chat, longContext, multimodal,
embedding, moderation, imageGeneration, videoGeneration, default
```

### Budget Modes (4 levels)
```
free (ultra cheap), cheap, balanced, best (premium)
```

### Endpoints (7 APIs)
```
/api/ai/providers              - List active providers
/api/ai/select-model           - Best for task
/api/ai/select-by-budget       - Budget-aware selection
/api/ai/models                 - All models for task
/api/ai/estimate-cost          - Cost calculation
/api/ai/health                 - Status check
/api/ai/config                 - Full configuration
```

---

## 🚀 Quick Links

### Setup
1. **Add API keys**: `UNICORN_FINAL/.env`
2. **Start backend**: `cd backend && node index.js`
3. **Test**: `curl http://localhost:3000/api/ai/health`

### APIs
1. **Get providers**: `curl http://localhost:3000/api/ai/providers`
2. **Select model**: `curl http://localhost:3000/api/ai/select-model?task=coding`
3. **Budget mode**: `curl http://localhost:3000/api/ai/select-by-budget?task=coding&budget=cheap`
4. **Cost**: `curl http://localhost:3000/api/ai/estimate-cost?task=coding&tokens=1000`

### Files to Edit
- `UNICORN_FINAL/.env` - Add API keys
- `UNICORN_FINAL/backend/modules/aiProviderRouter.js` - Custom preferences
- `UNICORN_FINAL/backend/modules/unicornConfigurationManager.js` - Cost strategy

### Deployment
- `scripts/setup-hetzner-auto.js` - Automatic Hetzner setup
- All 10 API keys auto-whitelisted
- Systemd services auto-configured

---

## ✅ Status

| Component | Status | Details |
|-----------|--------|---------|
| Syntax | ✅ PASS | All files validated |
| Tests | ✅ PASS | npm test (health + deploy) |
| Providers | ✅ 10 | OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, Cohere, Mistral, Fireworks, Replicate |
| Tasks | ✅ 10 | coding, reasoning, chat, longContext, multimodal, embedding, moderation, imageGeneration, videoGeneration, default |
| Budgets | ✅ 4 | free, cheap, balanced, best |
| Cost Tracking | ✅ YES | Monthly limits, auto-downgrade, alerts |
| Hetzner Ready | ✅ YES | All 10 keys whitelisted, auto-deploy ready |

---

## 💡 Examples

### Example 1: Cheap Chat (for startups)
```bash
curl "http://localhost:3000/api/ai/select-by-budget?task=chat&budget=cheap"
# Returns Groq Llama at $0.27/M tokens
```

### Example 2: Quality Code (for production)
```bash
curl "http://localhost:3000/api/ai/select-by-budget?task=coding&budget=best"
# Returns GPT-4o at $5/M tokens
```

### Example 3: Cost Estimation (before calling)
```bash
curl "http://localhost:3000/api/ai/estimate-cost?task=embedding&tokens=100000"
# Returns: $0.003-0.01 depending on provider
```

### Example 4: RAG System (embeddings)
```bash
curl "http://localhost:3000/api/ai/select-model?task=embedding"
# Returns: cohere-embed-english-v3
```

---

## 📞 Support

### Stuck?
1. Check: **AI-ROUTER-QUICK-START-EXPANDED.md** (Troubleshooting section)
2. Verify: `npm test` and `node --check backend/index.js`
3. Test: Try `/api/ai/health` endpoint

### Want to add a new provider?
1. Read: **AI-ROUTER-QUICK-REF.md** (Extension Pattern section)
2. Add: API key to `.env`
3. Edit: `aiProviderRouter.js` (3 steps)
4. Done: Auto-validates and activates!

### Cost concerns?
1. Use: `/api/ai/estimate-cost` before calling APIs
2. Set: `monthlyBudgetLimit` in costStrategy config
3. Budget: Start with `cheap` or `free` mode

---

## 🎓 Architecture

The router intelligently selects models based on:
1. **Task type** - coding, chat, embedding, etc.
2. **Budget mode** - free, cheap, balanced, best
3. **Provider availability** - only uses configured keys
4. **Cost estimates** - calculates per request

This ensures you always get the best model for your needs and budget!

---

**Updated**: 5 aprilie 2026  
**Version**: 2.0 (10 providers, expanded tasks, budget modes)  
**Status**: Production Ready ✅
