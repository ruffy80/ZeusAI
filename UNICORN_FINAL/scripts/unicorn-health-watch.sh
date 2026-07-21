#!/usr/bin/env bash
# unicorn-health-watch.sh
# ---------------------------------------------------------------------------
# SAFE periodic health watch for ZeusAI / Unicorn Platform. Intended to be run
# by cron every ~5 min (installed by unicorn-full-activate.sh).
#
# It checks backend + site health. On failure it increments a simple counter
# file; only after 3 consecutive failures does it `pm2 restart` the two
# canonical apps (unicorn-backend, unicorn-site) and reset the counter. On
# success it resets the counter. It NEVER mutates source files and NEVER runs
# any self-construction / file-mutator job.
# ---------------------------------------------------------------------------
set -euo pipefail

DEPLOY_LINK="${DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
SITE_PORT="${SITE_PORT:-3001}"
PUBLIC_URL="${PUBLIC_URL:-https://zeusai.pro}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-3}"

LOG_FILE="${HEALTH_WATCH_LOG:-/var/log/zeus-health-watch.log}"
STATE_DIR="${HEALTH_WATCH_STATE_DIR:-/var/www/unicorn/shared}"
COUNTER_FILE="${HEALTH_WATCH_COUNTER_FILE:-$STATE_DIR/health-watch.count}"

# Fall back to a writable location if the preferred log/state paths are not
# writable (e.g. running as a non-root user during testing). Use touch, not a
# truncating redirect, so an existing log is never wiped on each run.
if ! touch "$LOG_FILE" 2>/dev/null; then
  LOG_FILE="/tmp/zeus-health-watch.log"
fi
if ! mkdir -p "$STATE_DIR" 2>/dev/null || ! touch "$COUNTER_FILE" 2>/dev/null; then
  STATE_DIR="/tmp"
  COUNTER_FILE="/tmp/zeus-health-watch.count"
fi

log() {
  printf '%s [health-watch] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE" >/dev/null
}

read_counter() {
  local c
  c="$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)"
  case "$c" in
    ''|*[!0-9]*) echo 0 ;;
    *) echo "$c" ;;
  esac
}

healthy() {
  local body
  body="$(curl -fsS --max-time 8 "http://127.0.0.1:${BACKEND_PORT}/api/health" 2>/dev/null || true)"
  [ -n "$body" ] || return 1
  # Never-down kernel: event-loop hang → treat as unhealthy even if process answers
  if printf '%s' "$body" | grep -q '"healerFail"[[:space:]]*:[[:space:]]*true'; then
    return 1
  fi
  curl -fsS --max-time 8 "http://127.0.0.1:${SITE_PORT}/health" >/dev/null 2>&1
}

if healthy; then
  prev="$(read_counter)"
  if [ "$prev" != "0" ]; then
    log "health recovered — resetting failure counter (was $prev)"
  fi
  echo 0 > "$COUNTER_FILE"
  log "health OK (backend:${BACKEND_PORT}, site:${SITE_PORT})"
  exit 0
fi

count="$(read_counter)"
count=$((count + 1))
echo "$count" > "$COUNTER_FILE"
log "health FAIL ($count/$FAIL_THRESHOLD)"

if [ "$count" -ge "$FAIL_THRESHOLD" ]; then
  log "failure threshold reached — restarting unicorn-backend + unicorn-site via pm2"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart unicorn-backend >/dev/null 2>&1 || log "pm2 restart unicorn-backend failed"
    pm2 restart unicorn-site >/dev/null 2>&1 || log "pm2 restart unicorn-site failed"
  else
    log "pm2 not found — cannot restart"
  fi
  echo 0 > "$COUNTER_FILE"
  log "restart issued; failure counter reset"
fi
exit 0
