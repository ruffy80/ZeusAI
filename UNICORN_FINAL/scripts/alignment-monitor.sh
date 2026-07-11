#!/usr/bin/env bash
set -euo pipefail

LOG="${ALIGNMENT_MONITOR_LOG:-/var/log/alignment-monitor.log}"
CONTRACT_URL="${ALIGNMENT_CONTRACT_URL:-http://127.0.0.1:3001/api/contract}"
HEALTH_URL="${ALIGNMENT_HEALTH_URL:-http://127.0.0.1:3000/health}"
ROOT_DIR="${ALIGNMENT_ROOT_DIR:-/var/www/unicorn/current}"
STATE_DIR="${ALIGNMENT_MONITOR_STATE_DIR:-/var/lib/unicorn-alignment-monitor}"

mkdir -p "$STATE_DIR"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$STATE_DIR/run.lock"
  flock -n 9 || exit 0
else
  LOCK_DIR="$STATE_DIR/run.lock.d"
  mkdir "$LOCK_DIR" 2>/dev/null || exit 0
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
fi

log() {
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG"
}

if ! curl -sSf --connect-timeout 3 --max-time 8 -o /dev/null "$CONTRACT_URL"; then
  log "❌ contract unavailable at $CONTRACT_URL"
fi

if ! curl -sSf --connect-timeout 3 --max-time 8 -o /dev/null "$HEALTH_URL"; then
  log "❌ backend health unavailable at $HEALTH_URL"
fi

BACKEND_ENDPOINTS=$({ grep -RhoE "app\.(get|post|put|delete|patch)|router\.(get|post|put|delete|patch)" "$ROOT_DIR/backend" 2>/dev/null || true; } | wc -l | tr -d ' ')
FRONTEND_CALLS=$({ grep -RhoE "fetch|axios\.(get|post|put|delete)|http\.(get|post|put|delete)" "$ROOT_DIR/client" 2>/dev/null || true; } | wc -l | tr -d ' ')
log "ℹ alignment snapshot backend_hints=$BACKEND_ENDPOINTS frontend_hints=$FRONTEND_CALLS"
