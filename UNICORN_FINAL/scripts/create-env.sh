#!/usr/bin/env bash
# ============================================================
# UNICORN — Generare .env pe server din variabile de mediu CI
# Folosit de hetzner-bootstrap.yml și hetzner-deploy.yml
#
# Utilizare:
#   DEPLOY_PATH=/root/unicorn-final bash scripts/create-env.sh
#   sau
#   bash scripts/create-env.sh /root/unicorn-final
# ============================================================
set -euo pipefail

DEPLOY_PATH="${1:-${DEPLOY_PATH:-/root/unicorn-final}}"
ENV_FILE="$DEPLOY_PATH/.env"

if [ -f "$ENV_FILE" ]; then
  echo "ℹ️  .env există deja la $ENV_FILE — actualizare variabile noi fără a șterge valorile existente"
fi

# Funcție pentru upsert: adaugă sau actualizează o variabilă în .env
# Sare dacă valoarea este goală (nu suprascrie cu gol)
upsert() {
  local key="$1"
  local value="$2"
  [ -z "$value" ] && return 0   # nu suprascrie cu gol
  if [ -f "$ENV_FILE" ] && grep -q "^${key}=" "$ENV_FILE"; then
    # Folosim python3 pentru înlocuire sigură (evită problemele cu / | & în valori la sed)
    python3 -c "
import sys, re
key, val, path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f: content = f.read()
pattern = re.compile(r'^' + re.escape(key) + r'=.*$', re.MULTILINE)
new_content = pattern.sub(key + '=' + val, content)
with open(path, 'w') as f: f.write(new_content)
" "$key" "$value" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# Creează fișierul dacă nu există
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ── Core ──────────────────────────────────────────────────────────────────────
upsert NODE_ENV         "${NODE_ENV:-production}"
upsert PORT             "${PORT:-3000}"
upsert PUBLIC_APP_URL   "${PUBLIC_APP_URL:-https://zeusai.pro}"
upsert SITE_DOMAIN      "${SITE_DOMAIN:-zeusai.pro}"
upsert UNICORN_DOMAIN   "${UNICORN_DOMAIN:-www.zeusai.pro}"
upsert DOMAIN           "${DOMAIN:-${SITE_DOMAIN:-zeusai.pro}}"
# CORS: permite cereri de la ambele variante ale domeniului
_DOMAIN="${SITE_DOMAIN:-zeusai.pro}"
upsert CORS_ORIGINS     "${CORS_ORIGINS:-https://${_DOMAIN},https://www.${_DOMAIN},https://api.${_DOMAIN},https://orchestrator.${_DOMAIN}}"

# ── Auth Secrets (CRITICE - backend nu pornește corect fără acestea) ──────────
upsert JWT_SECRET            "${JWT_SECRET:-}"
upsert ADMIN_SECRET          "${ADMIN_SECRET:-}"
upsert ADMIN_MASTER_PASSWORD "${ADMIN_MASTER_PASSWORD:-}"
upsert ADMIN_2FA_CODE        "${ADMIN_2FA_CODE:-}"
upsert WEBHOOK_SECRET        "${WEBHOOK_SECRET:-}"
upsert HETZNER_WEBHOOK_SECRET "${HETZNER_WEBHOOK_SECRET:-${WEBHOOK_SECRET:-}}"

# Generează JWT_SECRET dacă lipsește complet
if ! grep -q "^JWT_SECRET=" "$ENV_FILE" 2>/dev/null || \
   grep -q "^JWT_SECRET=$" "$ENV_FILE" 2>/dev/null; then
  JWT_GEN="$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' || echo '')"
  [ -n "$JWT_GEN" ] && upsert JWT_SECRET "$JWT_GEN"
fi

# Generează ADMIN_SECRET dacă lipsește complet
if ! grep -q "^ADMIN_SECRET=" "$ENV_FILE" 2>/dev/null || \
   grep -q "^ADMIN_SECRET=$" "$ENV_FILE" 2>/dev/null; then
  ADM_GEN="$(openssl rand -hex 24 2>/dev/null || echo '')"
  [ -n "$ADM_GEN" ] && upsert ADMIN_SECRET "$ADM_GEN"
fi

upsert ADMIN_MASTER_PASSWORD "${ADMIN_MASTER_PASSWORD:-UnicornAdmin2026!}"
upsert ADMIN_2FA_CODE         "${ADMIN_2FA_CODE:-123456}"

# ── GitHub ─────────────────────────────────────────────────────────────────────
upsert GITHUB_OWNER       "${GITHUB_OWNER:-ruffy80}"
upsert GITHUB_REPO        "${GITHUB_REPO:-ZeusAI}"
upsert GIT_REMOTE_URL     "${GIT_REMOTE_URL:-https://github.com/ruffy80/ZeusAI.git}"
upsert GITHUB_TOKEN       "${GITHUB_TOKEN:-}"
upsert GH_PAT             "${GH_PAT:-${GITHUB_TOKEN:-}}"

# ── AI Providers ───────────────────────────────────────────────────────────────
upsert OPENAI_API_KEY     "${OPENAI_API_KEY:-}"
upsert DEEPSEEK_API_KEY   "${DEEPSEEK_API_KEY:-}"
upsert ANTHROPIC_API_KEY  "${ANTHROPIC_API_KEY:-}"
upsert GEMINI_API_KEY     "${GEMINI_API_KEY:-}"
upsert MISTRAL_API_KEY    "${MISTRAL_API_KEY:-}"
upsert COHERE_API_KEY     "${COHERE_API_KEY:-}"
upsert XAI_API_KEY        "${XAI_API_KEY:-}"
upsert GROQ_API_KEY       "${GROQ_API_KEY:-}"
upsert OPENROUTER_API_KEY "${OPENROUTER_API_KEY:-}"
upsert PERPLEXITY_API_KEY "${PERPLEXITY_API_KEY:-}"
upsert TOGETHER_API_KEY   "${TOGETHER_API_KEY:-}"
upsert FIREWORKS_API_KEY  "${FIREWORKS_API_KEY:-}"
upsert SAMBANOVA_API_KEY  "${SAMBANOVA_API_KEY:-}"
upsert NVIDIA_NIM_API_KEY "${NVIDIA_NIM_API_KEY:-}"
upsert HF_API_KEY         "${HF_API_KEY:-}"

# ── Stripe ─────────────────────────────────────────────────────────────────────
upsert STRIPE_SECRET_KEY            "${STRIPE_SECRET_KEY:-}"
upsert STRIPE_PUBLISHABLE_KEY       "${STRIPE_PUBLISHABLE_KEY:-}"
upsert STRIPE_WEBHOOK_SECRET        "${STRIPE_WEBHOOK_SECRET:-}"
upsert STRIPE_PRICE_STARTER_MONTHLY   "${STRIPE_PRICE_STARTER_MONTHLY:-}"
upsert STRIPE_PRICE_STARTER_YEARLY    "${STRIPE_PRICE_STARTER_YEARLY:-}"
upsert STRIPE_PRICE_PRO_MONTHLY       "${STRIPE_PRICE_PRO_MONTHLY:-}"
upsert STRIPE_PRICE_PRO_YEARLY        "${STRIPE_PRICE_PRO_YEARLY:-}"
upsert STRIPE_PRICE_ENTERPRISE_MONTHLY "${STRIPE_PRICE_ENTERPRISE_MONTHLY:-}"
upsert STRIPE_PRICE_ENTERPRISE_YEARLY  "${STRIPE_PRICE_ENTERPRISE_YEARLY:-}"

# ── PayPal ─────────────────────────────────────────────────────────────────────
upsert PAYPAL_CLIENT_ID     "${PAYPAL_CLIENT_ID:-}"
upsert PAYPAL_CLIENT_SECRET "${PAYPAL_CLIENT_SECRET:-}"
upsert PAYPAL_ENV           "${PAYPAL_ENV:-sandbox}"
upsert PAYPAL_WEBHOOK_ID    "${PAYPAL_WEBHOOK_ID:-}"

# ── Email ──────────────────────────────────────────────────────────────────────
upsert SMTP_HOST    "${SMTP_HOST:-smtp.mail.yahoo.com}"
upsert SMTP_PORT    "${SMTP_PORT:-587}"
upsert SMTP_USER    "${SMTP_USER:-}"
upsert SMTP_PASS    "${SMTP_PASS:-}"
upsert ADMIN_EMAIL  "${ADMIN_EMAIL:-${SMTP_USER:-vladoi_ionut@yahoo.com}}"
upsert EMAIL_FROM_NAME "Zeus AI"

# ── Hetzner ─────────────────────────────────────────────────────────────────────
HETZ_VAL="${HETZNER_API_KEY:-${HETZNER_API_TOKEN:-}}"
upsert HETZNER_API_KEY   "$HETZ_VAL"
upsert HETZNER_API_TOKEN "$HETZ_VAL"

# ── Owner / BTC ────────────────────────────────────────────────────────────────
BTC="${BTC_WALLET_ADDRESS:-bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e}"
upsert BTC_WALLET_ADDRESS  "$BTC"
upsert OWNER_BTC_ADDRESS   "$BTC"
upsert LEGAL_OWNER_BTC     "$BTC"
upsert OWNER_NAME          "${OWNER_NAME:-Vladoi Ionut}"
upsert OWNER_EMAIL         "${OWNER_EMAIL:-vladoi_ionut@yahoo.com}"
upsert LEGAL_OWNER_NAME    "${OWNER_NAME:-Vladoi Ionut}"
upsert LEGAL_OWNER_EMAIL   "${OWNER_EMAIL:-vladoi_ionut@yahoo.com}"

# ── Autonomy ───────────────────────────────────────────────────────────────────
upsert AUTONOMY_LEVEL         "10"
upsert AUTO_COMMIT_ENABLED    "true"
upsert AUTO_PUSH_ENABLED      "false"
upsert INNOVATION_INTERVAL    "60"
upsert REVENUE_INTERVAL       "30"
upsert DEPLOYMENT_INTERVAL    "300"

# ── App URL aliases ────────────────────────────────────────────────────────────
_APP_DOMAIN="${SITE_DOMAIN:-zeusai.pro}"
upsert APP_BASE_URL       "${APP_BASE_URL:-https://${_APP_DOMAIN}}"
upsert FRONTEND_URL       "${FRONTEND_URL:-https://${_APP_DOMAIN}}"
upsert DOMAIN             "${DOMAIN:-${_APP_DOMAIN}}"

# ── Hetzner runtime vars ───────────────────────────────────────────────────────
upsert HETZNER_HOST           "${HETZNER_HOST:-204.168.230.142}"
upsert HETZNER_IP             "${HETZNER_IP:-${HETZNER_HOST:-204.168.230.142}}"
upsert HETZNER_USER           "${HETZNER_USER:-root}"
upsert HETZNER_DEPLOY_USER    "${HETZNER_DEPLOY_USER:-root}"
upsert HETZNER_DEPLOY_PORT    "${HETZNER_DEPLOY_PORT:-22}"
upsert HETZNER_DEPLOY_PATH    "${HETZNER_DEPLOY_PATH:-/var/www/unicorn}"
upsert HETZNER_APP_PORT       "${HETZNER_APP_PORT:-3000}"
upsert HETZNER_BACKEND_URL    "${HETZNER_BACKEND_URL:-http://127.0.0.1:3000}"
upsert HETZNER_SSH_KEY_PATH   "${HETZNER_SSH_KEY_PATH:-/root/.ssh/id_rsa}"
upsert HETZNER_PASSWORD       "${HETZNER_PASSWORD:-}"
upsert HETZNER_DNS_API_KEY    "${HETZNER_DNS_API_KEY:-}"
upsert EXEC_SERVERS           "${EXEC_SERVERS:-${HETZNER_HOST:-204.168.230.142}}"

# ── GitHub runtime vars ────────────────────────────────────────────────────────
upsert GITHUB_REPO_OWNER      "${GITHUB_REPO_OWNER:-ruffy80}"
upsert GITHUB_REPO_NAME       "${GITHUB_REPO_NAME:-ZeusAI}"
upsert GITHUB_REPO_FULL       "${GITHUB_REPO_FULL:-ruffy80/ZeusAI}"
upsert GITHUB_REPOSITORY      "${GITHUB_REPOSITORY:-ruffy80/ZeusAI}"
upsert GITHUB_DEFAULT_BRANCH  "${GITHUB_DEFAULT_BRANCH:-main}"
upsert GITHUB_BRANCH          "${GITHUB_BRANCH:-main}"
upsert BRANCH                 "${BRANCH:-main}"
upsert INNOV_BASE_BRANCH      "${INNOV_BASE_BRANCH:-main}"
upsert GIT_REPO_URL           "${GIT_REPO_URL:-https://github.com/ruffy80/ZeusAI.git}"
upsert GIT_REMOTE_URL         "${GIT_REMOTE_URL:-https://github.com/ruffy80/ZeusAI.git}"
upsert DEV_API_KEY            "${DEV_API_KEY:-}"

# ── AI model names ─────────────────────────────────────────────────────────────
upsert OPENAI_MODEL      "${OPENAI_MODEL:-gpt-4o-mini}"
upsert DEEPSEEK_MODEL    "${DEEPSEEK_MODEL:-deepseek-chat}"
upsert ANTHROPIC_MODEL   "${ANTHROPIC_MODEL:-claude-3-haiku-20240307}"
upsert GEMINI_MODEL      "${GEMINI_MODEL:-gemini-1.5-flash}"
upsert MISTRAL_MODEL     "${MISTRAL_MODEL:-mistral-small-latest}"
upsert COHERE_MODEL      "${COHERE_MODEL:-command-r}"
upsert GROK_MODEL        "${GROK_MODEL:-grok-beta}"
upsert GROQ_MODEL        "${GROQ_MODEL:-llama-3.3-70b-versatile}"
upsert OPENROUTER_MODEL  "${OPENROUTER_MODEL:-mistralai/mistral-7b-instruct:free}"
upsert PERPLEXITY_MODEL  "${PERPLEXITY_MODEL:-llama-3.1-sonar-small-128k-online}"
upsert TOGETHER_MODEL    "${TOGETHER_MODEL:-meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo}"
upsert FIREWORKS_MODEL   "${FIREWORKS_MODEL:-accounts/fireworks/models/llama-v3p1-8b-instruct}"
upsert SAMBANOVA_MODEL   "${SAMBANOVA_MODEL:-Meta-Llama-3.1-8B-Instruct}"
upsert NVIDIA_NIM_MODEL  "${NVIDIA_NIM_MODEL:-meta/llama-3.1-8b-instruct}"
upsert HF_MODEL          "${HF_MODEL:-mistralai/Mistral-7B-Instruct-v0.3}"
upsert OLLAMA_MODEL      "${OLLAMA_MODEL:-llama3.2:3b-instruct-q4_K_M}"
upsert OLLAMA_URL        "${OLLAMA_URL:-http://localhost:11434}"

# ── Crypto wallets ─────────────────────────────────────────────────────────────
upsert ETH_WALLET_ADDRESS  "${ETH_WALLET_ADDRESS:-}"
upsert USDC_WALLET_ADDRESS "${USDC_WALLET_ADDRESS:-}"

# ── Vault secrets ──────────────────────────────────────────────────────────────
upsert VAULT_MASTER_SECRET  "${VAULT_MASTER_SECRET:-}"
upsert VAULT_EMERGENCY_CODE "${VAULT_EMERGENCY_CODE:-}"
upsert MASTER_CONFIG_SECRET "${MASTER_CONFIG_SECRET:-}"

# ── Social / marketing APIs ────────────────────────────────────────────────────
upsert TELEGRAM_BOT_TOKEN         "${TELEGRAM_BOT_TOKEN:-}"
upsert TELEGRAM_CHAT_ID           "${TELEGRAM_CHAT_ID:-}"
upsert X_BEARER_TOKEN             "${X_BEARER_TOKEN:-}"
upsert X_ACCESS_TOKEN             "${X_ACCESS_TOKEN:-}"
upsert X_ACCESS_SECRET            "${X_ACCESS_SECRET:-}"
upsert YOUTUBE_API_KEY            "${YOUTUBE_API_KEY:-}"
upsert YOUTUBE_OAUTH_CLIENT_ID    "${YOUTUBE_OAUTH_CLIENT_ID:-}"
upsert PINTEREST_TOKEN            "${PINTEREST_TOKEN:-}"
upsert PINTEREST_BOARD_ID         "${PINTEREST_BOARD_ID:-}"
upsert PRODUCTHUNT_API_KEY        "${PRODUCTHUNT_API_KEY:-}"
upsert PRODUCTHUNT_API_SECRET     "${PRODUCTHUNT_API_SECRET:-}"
upsert PRODUCTHUNT_DEVELOPER_TOKEN "${PRODUCTHUNT_DEVELOPER_TOKEN:-}"
upsert META_API_KEY               "${META_API_KEY:-}"
upsert GOOGLE_API_KEY             "${GOOGLE_API_KEY:-}"
upsert MICROSOFT_API_KEY          "${MICROSOFT_API_KEY:-}"
upsert AMAZON_API_KEY             "${AMAZON_API_KEY:-}"
upsert APPLE_API_KEY              "${APPLE_API_KEY:-}"
upsert SAV_API_TOKEN              "${SAV_API_TOKEN:-}"

# ── Crypto exchanges ───────────────────────────────────────────────────────────
upsert BINANCE_API_KEY  "${BINANCE_API_KEY:-}"
upsert BINANCE_SECRET   "${BINANCE_SECRET:-}"
upsert COINBASE_API_KEY "${COINBASE_API_KEY:-}"
upsert COINBASE_SECRET  "${COINBASE_SECRET:-}"
upsert KRAKEN_API_KEY   "${KRAKEN_API_KEY:-}"
upsert KRAKEN_SECRET    "${KRAKEN_SECRET:-}"
upsert BYBIT_API_KEY    "${BYBIT_API_KEY:-}"
upsert BYBIT_SECRET     "${BYBIT_SECRET:-}"
upsert OKX_API_KEY      "${OKX_API_KEY:-}"
upsert OKX_SECRET       "${OKX_SECRET:-}"
upsert OKX_PASSWORD     "${OKX_PASSWORD:-}"

# ── System tuning defaults (modules read these at startup) ────────────────────
upsert HEALER_COOLDOWN_MS   "${HEALER_COOLDOWN_MS:-60000}"
upsert HEALER_MAX_HEAP_MB   "${HEALER_MAX_HEAP_MB:-512}"
upsert HEALER_WATCHDOG_MS   "${HEALER_WATCHDOG_MS:-30000}"
upsert HEAL_INTERVAL_MS     "${HEAL_INTERVAL_MS:-60000}"
upsert QIS_SCAN_INTERVAL_MS "${QIS_SCAN_INTERVAL_MS:-300000}"
upsert QIS_AUTO_HEAL_ENABLED "${QIS_AUTO_HEAL_ENABLED:-true}"
upsert QIS_REQUIRED_PROCESSES "${QIS_REQUIRED_PROCESSES:-unicorn,unicorn-orchestrator,unicorn-health-guardian}"
upsert CANARY_EVAL_MS        "${CANARY_EVAL_MS:-60000}"
upsert CANARY_MIN_SAMPLES    "${CANARY_MIN_SAMPLES:-50}"
upsert CANARY_RAMP_STEP_MS   "${CANARY_RAMP_STEP_MS:-300000}"
upsert CANARY_UPLIFT_THRESHOLD "${CANARY_UPLIFT_THRESHOLD:-0.05}"
upsert SLO_WINDOW_SEC        "${SLO_WINDOW_SEC:-3600}"
upsert SLO_ERROR_BUDGET      "${SLO_ERROR_BUDGET:-0.001}"
upsert SHADOW_MIN_SAMPLES    "${SHADOW_MIN_SAMPLES:-20}"
upsert SHADOW_UPLIFT_THRESH  "${SHADOW_UPLIFT_THRESH:-0.05}"
upsert INNOVATION_CYCLE_MS   "${INNOVATION_CYCLE_MS:-3600000}"
upsert INNOV_CYCLE_MS        "${INNOV_CYCLE_MS:-3600000}"
upsert INNOV_MAX_PENDING     "${INNOV_MAX_PENDING:-5}"
upsert INNOV_PR_POLL_MS      "${INNOV_PR_POLL_MS:-60000}"
upsert REVENUE_CYCLE_MS      "${REVENUE_CYCLE_MS:-1800000}"
upsert VIRAL_CYCLE_MS        "${VIRAL_CYCLE_MS:-3600000}"
upsert VIRAL_CONTENT_PER_CYCLE "${VIRAL_CONTENT_PER_CYCLE:-3}"
upsert VIRAL_REFERRALS_PER_CYCLE "${VIRAL_REFERRALS_PER_CYCLE:-5}"
upsert PROFIT_LOOP_INTERVAL_MS "${PROFIT_LOOP_INTERVAL_MS:-300000}"
upsert ORCHESTRATOR_POLL_MS  "${ORCHESTRATOR_POLL_MS:-60000}"
upsert ORCHESTRATOR_GH_MS    "${ORCHESTRATOR_GH_MS:-120000}"
upsert ORCHESTRATOR_DNS_MS   "${ORCHESTRATOR_DNS_MS:-300000}"
upsert MARKETPLACE_LISTINGS_MIN "${MARKETPLACE_LISTINGS_MIN:-3}"
upsert MARKETPLACE_LISTINGS_MAX "${MARKETPLACE_LISTINGS_MAX:-20}"
upsert AFFILIATE_DEALS_MIN   "${AFFILIATE_DEALS_MIN:-2}"
upsert AFFILIATE_DEALS_MAX   "${AFFILIATE_DEALS_MAX:-10}"
upsert LTV_DECAY             "${LTV_DECAY:-0.9}"
upsert REWARD_WINDOW_MS      "${REWARD_WINDOW_MS:-604800000}"
upsert PAYPAL_ENV            "${PAYPAL_ENV:-sandbox}"

echo "✅ .env configurat la $ENV_FILE"
echo "   Linii active: $(grep -c '.' "$ENV_FILE" 2>/dev/null || echo '?')"
