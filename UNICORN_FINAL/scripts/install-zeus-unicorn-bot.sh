#!/usr/bin/env bash
# Install ZeusAI Unicorn Bot (Causal Virality Reflex + Telegram mission control).
# Takes over getUpdates from zeus-telegram-autobind to avoid dual pollers.
set -euo pipefail

export HOME="${HOME:-/root}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"

LIVE="${UNICORN_LIVE:-/var/www/unicorn/UNICORN_FINAL}"
SHARED="${UNICORN_SHARED_ROOT:-/var/www/unicorn/shared}"
SCRIPT="$LIVE/scripts/zeus-unicorn-bot.js"
NAME="zeus-unicorn-bot"

if [ ! -f "$SCRIPT" ]; then
  echo "[unicorn-bot] missing $SCRIPT" >&2
  exit 1
fi

mkdir -p "$SHARED/data/telegram" "$SHARED/data/growth/causality"
chmod 700 "$SHARED/data/telegram" "$SHARED/data/growth/causality" || true

# Stop competing getUpdates consumer if present
if pm2 describe zeus-telegram-autobind >/dev/null 2>&1; then
  echo "[unicorn-bot] stopping zeus-telegram-autobind (single getUpdates owner)"
  pm2 stop zeus-telegram-autobind >/dev/null 2>&1 || true
  pm2 delete zeus-telegram-autobind >/dev/null 2>&1 || true
fi

export UNICORN_SHARED_ENV="${UNICORN_SHARED_ENV:-$SHARED/.env}"
export ZEUS_TG_STATUS_FILE="${ZEUS_TG_STATUS_FILE:-$SHARED/data/telegram/bind-status.json}"
export ZEUS_CVR_DATA_DIR="${ZEUS_CVR_DATA_DIR:-$SHARED/data/growth/causality}"
export PUBLIC_APP_URL="${PUBLIC_APP_URL:-https://zeusai.pro}"

# Ensure cwd is live app so relative data/ and requires resolve
cd "$LIVE"

if pm2 describe "$NAME" >/dev/null 2>&1; then
  pm2 restart "$NAME" --update-env
else
  pm2 start "$SCRIPT" --name "$NAME" --time --cwd "$LIVE" --interpreter node
fi
pm2 save || true
echo "[unicorn-bot] $NAME online"
pm2 describe "$NAME" | head -n 20 || true
