#!/usr/bin/env bash
set -euo pipefail

LOG="${ALIGNMENT_MONITOR_LOG:-/var/log/alignment-monitor.log}"
CONTRACT_URL="${ALIGNMENT_CONTRACT_URL:-http://127.0.0.1:3001/api/contract}"
HEALTH_URL="${ALIGNMENT_HEALTH_URL:-http://127.0.0.1:3000/health}"
ROOT_DIR="${ALIGNMENT_ROOT_DIR:-/opt/unicorn/UNICORN_FINAL}"

log() {
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG"
}

restart_backend() {
  if command -v pm2 >/dev/null 2>&1; then
    pm2 reload unicorn-backend >/dev/null 2>&1 || pm2 restart unicorn-backend >/dev/null 2>&1 || true
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    (cd "$ROOT_DIR" && docker-compose restart backend >/dev/null 2>&1) || true
  fi
}

restart_site() {
  if command -v pm2 >/dev/null 2>&1; then
    pm2 reload unicorn-site >/dev/null 2>&1 || pm2 restart unicorn-site >/dev/null 2>&1 || true
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    (cd "$ROOT_DIR" && docker-compose restart frontend >/dev/null 2>&1) || true
  fi
}

if ! curl -sSf -o /dev/null "$CONTRACT_URL"; then
  log "❌ contract unavailable at $CONTRACT_URL"
  restart_backend
  sleep 8
  if curl -sSf -o /dev/null "$CONTRACT_URL"; then
    log "✅ contract restored after backend restart"
  fi
fi

if ! curl -sSf -o /dev/null "$HEALTH_URL"; then
  log "❌ site health unavailable at $HEALTH_URL"
  restart_site
  sleep 8
  if curl -sSf -o /dev/null "$HEALTH_URL"; then
    log "✅ site health restored after site restart"
  fi
fi

BACKEND_ENDPOINTS=$(grep -RhoE "app\.(get|post|put|delete|patch)|router\.(get|post|put|delete|patch)" "$ROOT_DIR/backend" 2>/dev/null | wc -l | tr -d ' ')
FRONTEND_CALLS=$(grep -RhoE "fetch|axios\.(get|post|put|delete)|http\.(get|post|put|delete)" "$ROOT_DIR/client" 2>/dev/null | wc -l | tr -d ' ')
log "ℹ alignment snapshot backend_hints=$BACKEND_ENDPOINTS frontend_hints=$FRONTEND_CALLS"
