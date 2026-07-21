#!/usr/bin/env bash
# never-down-watch.sh — Forever-up probe (NDK-aware)
# -----------------------------------------------------------------------------
# Complements autoheal-min / health-watch:
#   • Reads /api/health.neverDown
#   • If healerFail (event-loop hang) → escalate to pm2 reload after streak
#   • If disk/ram critical → invoke local retention script if present (no kill)
# Disable: touch /var/run/zeus-never-down-watch.disabled
# -----------------------------------------------------------------------------
set -euo pipefail
[ -f /var/run/zeus-never-down-watch.disabled ] && exit 0

STATE_DIR="${NDK_WATCH_STATE:-/var/lib/zeus-never-down-watch}"
mkdir -p "$STATE_DIR"
BACKEND_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
THRESHOLD="${NDK_FAIL_STREAK:-2}"
COOLDOWN="${NDK_COOLDOWN_S:-300}"
LOG="${NDK_WATCH_LOG:-/var/log/zeus-never-down-watch.log}"
touch "$LOG" 2>/dev/null || LOG="/tmp/zeus-never-down-watch.log"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { printf '%s [never-down-watch] %s\n' "$(ts)" "$*" | tee -a "$LOG" >/dev/null; }

body=$(curl -fsS -m 8 "$BACKEND_URL" 2>/dev/null || true)
if [ -z "$body" ]; then
  log "backend health unreachable"
  exit 0
fi

healer_fail=0
printf '%s' "$body" | grep -q '"healerFail"[[:space:]]*:[[:space:]]*true' && healer_fail=1

streak_file="$STATE_DIR/lag.fail-streak"
last_act="$STATE_DIR/lag.last-action-epoch"
now=$(date +%s)

if [ "$healer_fail" = "0" ]; then
  echo 0 > "$streak_file"
else
  streak=$(cat "$streak_file" 2>/dev/null || echo 0)
  streak=$((streak + 1))
  echo "$streak" > "$streak_file"
  log "event-loop hang signal streak=$streak/$THRESHOLD"
  if [ "$streak" -ge "$THRESHOLD" ]; then
    last=$(cat "$last_act" 2>/dev/null || echo 0)
    since=$((now - last))
    if [ "$since" -ge "$COOLDOWN" ] && command -v pm2 >/dev/null 2>&1; then
      log "reloading unicorn-backend (event-loop hang)"
      pm2 reload unicorn-backend --update-env >/dev/null 2>&1 || pm2 restart unicorn-backend --update-env >/dev/null 2>&1 || true
      echo "$now" > "$last_act"
      echo 0 > "$streak_file"
    fi
  fi
fi

# Disk soft action
if printf '%s' "$body" | grep -q '"diskUsedPct"[[:space:]]*:[[:space:]]*9[2-9]'; then
  RET="${DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}/scripts/shared-data-retention.sh"
  if [ -x "$RET" ]; then
    log "disk pressure — running shared-data-retention.sh"
    bash "$RET" >/dev/null 2>&1 || true
  fi
fi

exit 0
