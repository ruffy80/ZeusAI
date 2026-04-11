#!/usr/bin/env bash
# ============================================================
# UNICORN — Generare .env pe server din variabile de mediu CI
# Folosit de hetzner-bootstrap.yml și vercel-deploy.yml
#
# Utilizare:
#   DEPLOY_PATH=/opt/unicorn bash scripts/create-env.sh
#   sau
#   bash scripts/create-env.sh /opt/unicorn
# ============================================================
set -euo pipefail

DEPLOY_PATH="${1:-${DEPLOY_PATH:-/opt/unicorn}}"
ENV_FILE="$DEPLOY_PATH/.env"

if [ -f "$ENV_FILE" ]; then
  echo "ℹ️  .env există deja la $ENV_FILE — actualizare variabile noi fără a șterge valorile existente"
fi

# Funcție pentru upsert: adaugă sau actualizează o variabilă în .env
upsert() {
  local key="$1"
  local value="$2"
  [ -z "$value" ] && return 0   # nu suprascrie cu gol
  if [ -f "$ENV_FILE" ] && grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
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

# ── Secrets (generează dacă lipsesc) ──────────────────────────────────────────
if ! grep -q "^JWT_SECRET=" "$ENV_FILE" 2>/dev/null || grep -q "^JWT_SECRET=$" "$ENV_FILE" 2>/dev/null; then
  JWT_GEN="${JWT_SECRET:-$(openssl rand -hex 32)}"
  upsert JWT_SECRET "$JWT_GEN"
fi
if ! grep -q "^ADMIN_SECRET=" "$ENV_FILE" 2>/dev/null || grep -q "^ADMIN_SECRET=$" "$ENV_FILE" 2>/dev/null; then
  ADM_GEN="${ADMIN_SECRET:-$(openssl rand -hex 24)}"
  upsert ADMIN_SECRET "$ADM_GEN"
fi
upsert ADMIN_MASTER_PASSWORD "${ADMIN_MASTER_PASSWORD:-UnicornAdmin2026!}"
upsert ADMIN_2FA_CODE         "${ADMIN_2FA_CODE:-123456}"

# ── GitHub ─────────────────────────────────────────────────────────────────────
upsert GITHUB_OWNER       "${GITHUB_OWNER:-ruffy80}"
upsert GITHUB_REPO        "${GITHUB_REPO:-ZeusAI}"
upsert GIT_REMOTE_URL     "${GIT_REMOTE_URL:-https://github.com/ruffy80/ZeusAI.git}"
upsert GITHUB_TOKEN       "${GITHUB_TOKEN:-}"

# ── Vercel ─────────────────────────────────────────────────────────────────────
upsert VERCEL_TOKEN       "${VERCEL_TOKEN:-}"
upsert VERCEL_ORG_ID      "${VERCEL_ORG_ID:-}"
upsert VERCEL_PROJECT_ID  "${VERCEL_PROJECT_ID:-}"

# ── AI Providers ───────────────────────────────────────────────────────────────
upsert OPENAI_API_KEY     "${OPENAI_API_KEY:-}"
upsert DEEPSEEK_API_KEY   "${DEEPSEEK_API_KEY:-}"
upsert ANTHROPIC_API_KEY  "${ANTHROPIC_API_KEY:-}"
upsert GEMINI_API_KEY     "${GEMINI_API_KEY:-}"
upsert MISTRAL_API_KEY    "${MISTRAL_API_KEY:-}"
upsert COHERE_API_KEY     "${COHERE_API_KEY:-}"
upsert XAI_API_KEY        "${XAI_API_KEY:-}"

# ── Payments ───────────────────────────────────────────────────────────────────
upsert STRIPE_SECRET_KEY      "${STRIPE_SECRET_KEY:-}"
upsert STRIPE_PUBLISHABLE_KEY "${STRIPE_PUBLISHABLE_KEY:-}"
upsert STRIPE_WEBHOOK_SECRET  "${STRIPE_WEBHOOK_SECRET:-}"
upsert PAYPAL_CLIENT_ID       "${PAYPAL_CLIENT_ID:-}"
upsert PAYPAL_CLIENT_SECRET   "${PAYPAL_CLIENT_SECRET:-}"

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

echo "✅ .env configurat la $ENV_FILE"
echo "   Linii active: $(grep -c '.' "$ENV_FILE" 2>/dev/null || echo '?')"
