# 🤖 AI Provider Router - Quick Reference

## Setup (2 minutes)

```bash
# 1. Add your API keys to .env
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza-...
GROQ_API_KEY=gsk-...
DEEPSEEK_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...

# 2. Start backend (any profile)
cd UNICORN_FINAL/backend
PORT=3000 ADMIN_SECRET=secret node index.js

# 3. Test it
curl http://localhost:3000/api/ai/providers
```

## API Endpoints

### Get Active Providers
```bash
curl http://localhost:3000/api/ai/providers | jq '.active'
```

### Select Best Model for Task
```bash
# Coding
curl http://localhost:3000/api/ai/select-model?task=coding

# Reasoning (math, logic, complex thinking)
curl http://localhost:3000/api/ai/select-model?task=reasoning

# Chat (general conversation)
curl http://localhost:3000/api/ai/select-model?task=chat

# Long Context (up to 1M tokens)
curl http://localhost:3000/api/ai/select-model?task=longContext

# Default (fallback)
curl http://localhost:3000/api/ai/select-model?task=default
```

### Get All Available Models
```bash
curl http://localhost:3000/api/ai/models?task=coding
```

### Check Health
```bash
curl http://localhost:3000/api/ai/health
```

### View Configuration
```bash
curl http://localhost:3000/api/ai/config
```

## Task → Best Provider Ranking

| Task | 1st Choice | 2nd | 3rd | 4th |
|------|-----------|-----|-----|-----|
| **coding** | DeepSeek | OpenAI | Anthropic | Google |
| **reasoning** | DeepSeek | Anthropic | OpenAI | Groq |
| **chat** | Google | DeepSeek | Groq | OpenAI |
| **longContext** | Google | Anthropic | OpenAI | DeepSeek |
| **default** | Groq | Google | DeepSeek | OpenAI |

## Response Format

```json
{
  "provider": "google",
  "providerName": "Google",
  "model": "gemini-1.5-flash",
  "apiKey": "AIza-...",
  "available": true
}
```

## Provider Models

| Provider | Default | Fast/Cheap | Reasoning | Coding | LongContext |
|----------|---------|-----------|-----------|--------|-------------|
| OpenAI | gpt-4o | o mini | gpt-4.1 | gpt-4o | gpt-4o |
| Anthropic | claude-3.5-sonnet | - | claude-3.5-sonnet | claude-3.5-sonnet | claude-3.5-sonnet |
| Google | gemini-1.5-flash | flash | flash | flash | gemini-1.5-pro |
| Groq | llama-3-70b | llama-3-70b | llama-3-70b | llama-3-70b | - |
| DeepSeek | deepseek-v3 | v3 | deepseek-r1 | deepseek-coder | v3 |
| OpenRouter | openrouter/auto | auto | deepseek-r1 | deepseek-coder | - |

## Credential Validation

The router **automatically detects and filters** invalid credentials:
- ✅ Valid: `sk-proj-abc123...` real API keys
- ❌ Invalid: `...`, `***`, `YOUR_KEY`, `sk-...` (placeholder format)

Only valid keys activate providers!

## Extension Pattern

To add a new provider later:

### Step 1: Add env var
```bash
MYNEWPROVIDER_API_KEY=sk-my-key-here
```

### Step 2: Edit `aiProviderRouter.js`
```javascript
mynewprovider: {
  name: 'MyNewProvider',
  apiKey: process.env.MYNEWPROVIDER_API_KEY || '',
  models: {
    default: 'model-x',
    coding: 'model-coder',
    reasoning: 'model-reason',
    chat: 'model-x',
    longContext: 'model-x'
  }
}
```

### Step 3: Add to rankings
```javascript
this.taskPreferences = {
  coding: ['mynewprovider', 'deepseek', ...],
  ...
}
```

✅ Done! Router auto-validates and activates.

## Troubleshooting

**No providers activated?**
- Check `.env` has real API keys (not `sk-...` or `YOUR_KEY`)
- View `/api/ai/config` to see which are detected

**Task returns "No AI providers configured"?**
- Add at least one real API key
- Run `/api/ai/health` to check status

**Want to use only specific providers?**
- Leave other `*_API_KEY` env vars empty or remove them
- Router only uses configured keys

## Files Modified

```
✅ backend/modules/aiProviderRouter.js      (NEW)
✅ backend/index.js                         (+ 5 endpoints, + init)
✅ .env                                     (+ 6 API key variables)
✅ .env.ai-providers.example               (NEW)
✅ unicornConfigurationManager.js           (+ ai config section)
✅ scripts/setup-hetzner-auto.js           (+ whitelist 6 keys)
✅ README.md                                (+ AI Router docs)
```

## Deploy to Hetzner

```bash
# Script will automatically:
# 1. SSH into server
# 2. Clone/pull repository
# 3. Create .env with your API keys
# 4. Setup systemd services
# 5. Enable auto-restart

node scripts/setup-hetzner-auto.js

# Verify on server:
systemctl status unicorn-backend
curl http://your-domain/api/ai/providers
```

## Current Status

- ✅ 6 providers configured (Google + Groq active with your keys)
- ✅ All endpoints working
- ✅ Tests passing
- ✅ Ready for production

**Next**: Start using the `/api/ai/*` endpoints in your app!
