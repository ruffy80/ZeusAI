#!/bin/bash
# scripts/restart-if-down.sh — Unicorn SaaS auto-recovery
# Checks /api/health, restarts PM2 if backend is down. Logs all actions.
# Usage: bash scripts/restart-if-down.sh

API_URL="http://127.0.0.1:3000/api/health"
LOG_FILE="logs/autonomous.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "[Auto-Recovery] Checking $API_URL ..."

if curl -fs --max-time 5 "$API_URL" > /dev/null; then
  log "[Auto-Recovery] Backend healthy. No action needed."
  exit 0
else
  log "[Auto-Recovery] Backend DOWN. Restarting canonical PM2 stack ..."
  cd /var/www/unicorn/UNICORN_FINAL 2>/dev/null || cd "$(dirname "$0")/.."
  pm2 restart unicorn-backend unicorn-site autoscaler --update-env 2>/dev/null || pm2 start ecosystem.config.js --update-env
  sleep 5
  if curl -fs --max-time 5 "$API_URL" > /dev/null; then
    log "[Auto-Recovery] Backend recovered after PM2 restart."
    exit 0
  else
    log "[Auto-Recovery] Backend still DOWN after PM2 restart. Manual intervention required."
    exit 1
  fi
fi
