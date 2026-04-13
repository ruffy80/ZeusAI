#!/usr/bin/env bash
# ============================================================
# UNICORN — Generare .env pe server din variabile de mediu CI
# Folosit de hetzner-bootstrap.yml și vercel-deploy.yml
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
upsert CORS_ORIGINS     "${CORS_ORIGINS:-https://${_DOMAIN},https://www.${_DOMAIN}}"

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

# ── Vercel ─────────────────────────────────────────────────────────────────────
upsert VERCEL_TOKEN       "${VERCEL_TOKEN:-}"
upsert VERCEL_ORG_ID      "${VERCEL_ORG_ID:-team_wes3fQvKjdfOMKXe7f4fFQoL}"
upsert VERCEL_PROJECT_ID  "${VERCEL_PROJECT_ID:-}"

# ── AI Providers ───────────────────────────────────────────────────────────────
upsert OPENAI_API_KEY     "${OPENAI_API_KEY:-}"
upsert DEEPSEEK_API_KEY   "${DEEPSEEK_API_KEY:-}"
upsert ANTHROPIC_API_KEY  "${ANTHROPIC_API_KEY:-}"
upsert GEMINI_API_KEY     "${GEMINI_API_KEY:-}"
upsert MISTRAL_API_KEY    "${MISTRAL_API_KEY:-}"
upsert COHERE_API_KEY     "${COHERE_API_KEY:-}"
upsert XAI_API_KEY        "${XAI_API_KEY:-}"

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

echo "✅ .env configurat la $ENV_FILE"
echo "   Linii active: $(grep -c '.' "$ENV_FILE" 2>/dev/null || echo '?')"
