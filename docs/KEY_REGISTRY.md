# ZeusAI Unicorn — Key Registry (no-conflict contract)

Source of truth for every environment variable / GitHub Secret used by the
platform. Run-time consumers (PM2 apps, CI workflows, deploy scripts) all
agree on these canonical names. Keep this file in sync with:

- [.env.example](../.env.example) — local developer template
- [UNICORN_FINAL/.env.example](../UNICORN_FINAL/.env.example) — production template
- [UNICORN_FINAL/backend/constants/secretKeys.js](../UNICORN_FINAL/backend/constants/secretKeys.js) — runtime allowlist
- [.github/workflows/sync-all-secrets.yml](../.github/workflows/sync-all-secrets.yml) — GH Secrets → server bridge
- [UNICORN_FINAL/ecosystem.config.js](../UNICORN_FINAL/ecosystem.config.js) — PM2 env defaults

## 1. Scope rules (where each key may live)

| Scope | Where it lives | Used by |
|-------|----------------|---------|
| **server-only** | `/var/www/unicorn/UNICORN_FINAL/.env` (canonical) + symlink `/var/www/unicorn/shared/.env`. Runtime defaults in `ecosystem.config.js`. | PM2 workers at runtime |
| **CI-only** | GitHub Repository Secrets | `.github/workflows/*.yml` (SSH, rsync, build steps) |
| **shared** | Both above. `sync-all-secrets.yml` pushes GH Secret → server `.env`, then PM2 reload `--update-env`. | runtime + CI |

> **Single rule:** every shared key has **one canonical name**. Aliases are
> tolerated only as one-way fallbacks (alias → canonical) in
> `sync-all-secrets.yml` so the owner doesn't have to re-store secrets they
> already saved under a short name.

## 2. Canonical names by category

### 2.1 Runtime / network (server-only, defaulted in ecosystem.config.js)

```
NODE_ENV PORT BIND_HOST DOMAIN SITE_DOMAIN UNICORN_DOMAIN
PUBLIC_APP_URL APP_BASE_URL FRONTEND_URL CORS_ORIGINS
SW_VERSION ZEUS_BUILD_SHA
```

### 2.2 Owner / legal (shared)

```
OWNER_NAME OWNER_EMAIL
LEGAL_OWNER_NAME LEGAL_OWNER_EMAIL LEGAL_OWNER_BTC
BTC_WALLET_ADDRESS OWNER_BTC_ADDRESS  ← aliases of each other
ETH_WALLET_ADDRESS USDC_WALLET_ADDRESS
```

### 2.3 Admin / auth (shared)

```
ADMIN_EMAIL ADMIN_SECRET ADMIN_MASTER_PASSWORD ADMIN_2FA_CODE
JWT_SECRET SESSION_SECRET WEBHOOK_SECRET HETZNER_WEBHOOK_SECRET
VAULT_MASTER_SECRET VAULT_EMERGENCY_CODE MASTER_CONFIG_SECRET
```

### 2.4 GitHub (shared)

| Canonical | Purpose | Notes |
|-----------|---------|-------|
| `GH_PAT` | Long-lived PAT for cross-repo, sync workflows | Set as GH Secret |
| `GITHUB_TOKEN_SYNC` | Server-side mirror of `GH_PAT` | Written by sync-all-secrets.yml |
| `GITHUB_OWNER` | `ruffy80` | Hardcoded in workflows + .env |
| `GITHUB_REPO` | `ZeusAI` | Hardcoded |
| `GITHUB_REPOSITORY` | `ruffy80/ZeusAI` | Auto from `github.repository` |
| `GITHUB_REPO_FULL` | Same as above | Legacy alias |
| `BRANCH` / `GITHUB_BRANCH` / `GITHUB_DEFAULT_BRANCH` | `main` | Aliases |
| `GIT_REMOTE_URL` / `GIT_REPO_URL` | `https://github.com/ruffy80/ZeusAI.git` | Aliases |

> ⚠️ **Never store a custom secret named `GITHUB_TOKEN`.** GitHub Actions
> auto-provides `${{ secrets.GITHUB_TOKEN }}` per workflow (scoped to repo).
> Trying to set a custom one is silently refused by GitHub. For cross-repo
> actions, use `GH_PAT`. The server-side `GITHUB_TOKEN` env var receives
> `GH_PAT` (not the workflow token) via sync-all-secrets.yml.

### 2.5 Hetzner / SSH (shared)

| Canonical | Alias accepted | Purpose |
|-----------|---------------|---------|
| `HETZNER_HOST` | `SSH_HOST` | `204.168.230.142` |
| `HETZNER_DEPLOY_USER` | `HETZNER_USER`, `SSH_USER` | `root` |
| `HETZNER_DEPLOY_PORT` | `SSH_PORT` | `22` |
| `HETZNER_DEPLOY_PATH` | `DEPLOY_PATH` | `/var/www/unicorn/UNICORN_FINAL` |
| `HETZNER_SSH_PRIVATE_KEY` | `SSH_PRIVATE_KEY` | ed25519 PEM |
| `HETZNER_API_TOKEN` | `HETZNER_API_KEY` | Hetzner Cloud API |
| `HETZNER_BACKEND_URL` | — | `http://127.0.0.1:3000` (server-only) |
| `HETZNER_APP_PORT` | — | `3000` (server-only) |
| `HETZNER_IP` | — | Same as HETZNER_HOST (legacy) |
| `HETZNER_PASSWORD` | — | Bootstrap-only; never used after SSH key works |

### 2.6 AI providers (shared)

**Canonical = `<PROVIDER>_API_KEY` and `<PROVIDER>_MODEL`** (matches official SDK
env conventions for OpenAI, Anthropic, Mistral, Google, etc.).

| Provider | Canonical key | Tolerated alias | Note |
|----------|--------------|-----------------|------|
| OpenAI | `OPENAI_API_KEY` | `OPENAI` | Short alias falls back via sync-all-secrets.yml |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK` | same |
| Anthropic | `ANTHROPIC_API_KEY` | `CLAUDE_API_KEY` | Anthropic SDK reads ANTHROPIC_API_KEY |
| Google Gemini | `GEMINI_API_KEY` | `GOOGLE_API_KEY`, `GEMINI` | Google SDK reads GOOGLE_API_KEY |
| Mistral | `MISTRAL_API_KEY` | `MISTRAL` | |
| Cohere | `COHERE_API_KEY` | — | |
| xAI Grok | `XAI_API_KEY` | — | |
| Groq | `GROQ_API_KEY` | — | |
| OpenRouter | `OPENROUTER_API_KEY` | — | |
| Hugging Face | `HF_API_KEY` | `HUGGINGFACE_API_KEY` | Server resolves either |
| Perplexity | `PERPLEXITY_API_KEY` | — | |
| Together.ai | `TOGETHER_API_KEY` | — | |
| Fireworks | `FIREWORKS_API_KEY` | — | |
| SambaNova | `SAMBANOVA_API_KEY` | — | |
| NVIDIA NIM | `NVIDIA_NIM_API_KEY` | — | |
| Cerebras | `CEREBRAS_API_KEY` | — | |
| Codestral | `CODESTRAL_API_KEY` | — | |
| Ollama (local) | `OLLAMA_URL`, `OLLAMA_MODEL` | — | No API key needed |
| Amazon Bedrock | `AMAZON_API_KEY` | — | (reserved, unused) |
| Apple Intelligence | `APPLE_API_KEY` | — | (reserved, unused) |

### 2.7 DeepSeek autonomy loop (server-only)

```
DEEPSEEK_LOOP_ENABLED   DEEPSEEK_LOOP_EXECUTE
DEEPSEEK_LOOP_INTERVAL_MS  DEEPSEEK_LOOP_ADMIN_TOKEN
DEEPSEEK_UNIFIED_ENABLED   DEEPSEEK_UNIFIED_GITHUB_REPO
DEEPSEEK_UNIFIED_GIT_PUSH  DEEPSEEK_UNIFIED_GIT_ROOT
```

### 2.8 Payments (shared)

```
# Stripe
STRIPE_SECRET_KEY  STRIPE_PUBLISHABLE_KEY  STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER_MONTHLY    STRIPE_PRICE_STARTER_YEARLY
STRIPE_PRICE_PRO_MONTHLY        STRIPE_PRICE_PRO_YEARLY
STRIPE_PRICE_ENTERPRISE_MONTHLY STRIPE_PRICE_ENTERPRISE_YEARLY
STRIPE_PAYMENT_LINK_STARTER     STRIPE_PAYMENT_LINK_PRO   STRIPE_PAYMENT_LINK_SCALE

# PayPal
PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET PAYPAL_ENV PAYPAL_WEBHOOK_ID

# NOWPayments (BTC)
NOWPAYMENTS_API_KEY NOWPAYMENTS_IPN_SECRET NOWPAYMENTS_SANDBOX
```

### 2.9 Email / SMTP (shared)

```
SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS EMAIL_FROM_NAME
```

### 2.10 Exchanges (shared, optional)

```
BINANCE_API_KEY BINANCE_SECRET
BYBIT_API_KEY   BYBIT_SECRET
COINBASE_API_KEY COINBASE_SECRET
```

### 2.11 Social / community (shared, optional)

```
TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID  DISCORD_WEBHOOK
X_BEARER_TOKEN X_ACCESS_TOKEN X_ACCESS_SECRET
YOUTUBE_API_KEY YOUTUBE_OAUTH_CLIENT_ID
PINTEREST_TOKEN PINTEREST_BOARD_ID
PRODUCTHUNT_API_KEY PRODUCTHUNT_API_SECRET PRODUCTHUNT_DEVELOPER_TOKEN
```

### 2.12 AWS (shared, optional backup)

```
AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_BACKUP_BUCKET
```

### 2.13 Autonomy / loops (server-only, defaulted)

```
AUTONOMY_LEVEL AUTO_COMMIT_ENABLED AUTO_PUSH_ENABLED
INNOVATION_CYCLE_MS  INNOVATION_INTERVAL  INNOV_BASE_BRANCH
INNOV_CYCLE_MS INNOV_MAX_PENDING INNOV_PR_POLL_MS
REVENUE_CYCLE_MS REVENUE_INTERVAL PROFIT_LOOP_INTERVAL_MS
VIRAL_CYCLE_MS VIRAL_CONTENT_PER_CYCLE VIRAL_REFERRALS_PER_CYCLE
MARKETPLACE_LISTINGS_MIN MARKETPLACE_LISTINGS_MAX
AFFILIATE_DEALS_MIN AFFILIATE_DEALS_MAX
DEPLOYMENT_INTERVAL EXEC_SERVERS
```

### 2.14 Healer / Quantum Integrity Shield (server-only, defaulted)

```
HEALER_COOLDOWN_MS HEALER_MAX_HEAP_MB HEALER_WATCHDOG_MS HEAL_INTERVAL_MS
QIS_AUTO_HEAL_ENABLED  QIS_REQUIRED_PROCESSES  QIS_SCAN_INTERVAL_MS
ORCHESTRATOR_POLL_MS  ORCHESTRATOR_DNS_MS  ORCHESTRATOR_GH_MS
```

### 2.15 Canary / SLO (server-only, defaulted)

```
CANARY_EVAL_MS CANARY_MIN_SAMPLES CANARY_RAMP_STEP_MS CANARY_UPLIFT_THRESHOLD
SHADOW_MIN_SAMPLES SHADOW_UPLIFT_THRESH
SLO_ERROR_BUDGET   SLO_WINDOW_SEC
LTV_DECAY REWARD_WINDOW_MS
```

### 2.16 Autoscaler (server-only, defaulted, **disabled by default**)

```
AUTOSCALE_DISABLED   (default '1')
AUTOSCALE_MAX        (default '2')
AUTOSCALE_MIN_FREE_MB (default '800')
```

## 3. Conflict resolution rules

When the same logical secret has two names on the GH side (e.g. owner stored
the OpenAI key under both `OPENAI` and `OPENAI_API_KEY`), the sync workflow
resolves it as follows:

```
canonical = secrets.<NAME>_API_KEY                   # primary
fallback  = secrets.<NAME>                           # short-name alias
final = canonical if not placeholder else (fallback if not placeholder else '')
```

Placeholders treated as empty (filtered out by sync-all-secrets.yml):

```
^your_.*_here$    ^skip$       ^changeme$   ^todo$
^placeholder$     ^xxx+$       ^\*+$        sk-proj-...   sk-...   AIza...
```

## 4. Required minimal GH Secret set

For CI deploy + sync to succeed, **these GH Secrets must be set**:

- `HETZNER_HOST`
- `HETZNER_DEPLOY_USER` (or `HETZNER_USER`)
- `HETZNER_SSH_PRIVATE_KEY` (or `SSH_PRIVATE_KEY`)
- `GH_PAT`
- `JWT_SECRET`
- `ADMIN_SECRET`
- `BTC_WALLET_ADDRESS`

Everything else is optional — features simply degrade gracefully (e.g. no
Stripe key → BTC-only checkout; no AI key for a provider → that provider is
skipped in the AI router fallback chain).

## 5. Rotation procedure (no downtime)

1. Update the secret in **GitHub Settings → Secrets → Actions**.
2. Trigger `Sync ALL GitHub Secrets → Hetzner .env` workflow
   (`workflow_dispatch`) — auto-runs on every push to main and every 6h.
3. The workflow uploads `/var/www/unicorn/UNICORN_FINAL/.env.new`, atomically
   moves it to `.env`, and runs `pm2 reload ecosystem.config.js --update-env`.
4. Verify with `curl -sf http://127.0.0.1:3000/api/health` (CI does this).

## 6. Audit commands

```bash
# Server: list all populated keys
ssh root@204.168.230.142 'grep -cE "^[A-Z_][A-Z0-9_]*=." /var/www/unicorn/UNICORN_FINAL/.env'

# Server: list keys with empty values (need attention)
ssh root@204.168.230.142 'grep -E "^[A-Z_][A-Z0-9_]*=$" /var/www/unicorn/UNICORN_FINAL/.env'

# Repo: list all secrets referenced by workflows
grep -rhoE "secrets\.[A-Z_][A-Z0-9_]*" .github/workflows/ | sort -u

# Repo: list all keys declared in the runtime allowlist
node -e "console.log(require('./UNICORN_FINAL/backend/constants/secretKeys').ALL_SECRET_KEYS.join('\n'))" | sort -u
```
