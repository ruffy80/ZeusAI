#!/usr/bin/env bash
# =============================================================================
# healer-pm2.sh — ZeusAI / Unicorn Self-Healer (PM2 edition)
#
# Verifică /health la fiecare tick; dacă pică 3× în 5min → restart PM2 apps.
# NU folosește docker. Sigur pentru deploy-ul actual (cluster + fork).
# Variabile env (override):
#   HEALTH_URL         (default http://127.0.0.1:3000/health)
#   PM2_BIN            (default detect via npm root -g)
#   PM2_APPS           (default "unicorn-backend unicorn-site autoscaler")
#   FAIL_THRESHOLD     (default 3)
#   FAIL_WINDOW_SEC    (default 300)
#   CHECK_TIMEOUT_SEC  (default 5)
#   LOG_FILE           (default /var/log/healer.log)
#   WEBHOOK_URL        (Discord webhook opțional)
# =============================================================================
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
PM2_APPS="${PM2_APPS:-unicorn-backend unicorn-site autoscaler}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-3}"
FAIL_WINDOW_SEC="${FAIL_WINDOW_SEC:-300}"
CHECK_TIMEOUT_SEC="${CHECK_TIMEOUT_SEC:-5}"
LOG_FILE="${LOG_FILE:-/var/log/healer.log}"
WEBHOOK_URL="${WEBHOOK_URL:-${DISCORD_WEBHOOK:-}}"

# Detect pm2 binary (works both as root and via login shell PATH)
if [ -z "${PM2_BIN:-}" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    PM2_BIN="$(command -v pm2)"
  elif [ -x /usr/local/bin/pm2 ]; then
    PM2_BIN=/usr/local/bin/pm2
  elif [ -x /usr/bin/pm2 ]; then
    PM2_BIN=/usr/bin/pm2
  else
    PM2_BIN="$(npm root -g 2>/dev/null)/pm2/bin/pm2"
  fi
fi

STATE_DIR="/var/lib/unicorn-healer"
mkdir -p "$STATE_DIR" 2>/dev/null || STATE_DIR="/tmp/unicorn-healer"
mkdir -p "$STATE_DIR"
FAIL_TIMES_FILE="$STATE_DIR/fail_times"

ts_now() { date '+%Y-%m-%d %H:%M:%S'; }

log() {
  local level="$1"; local msg="$2"
  local line="[$(ts_now)] [$level] $msg"
  echo "$line" >> "$LOG_FILE" 2>/dev/null || true
  echo "$line"
}

send_webhook() {
  [ -z "$WEBHOOK_URL" ] && return 0
  local content="$1"
  local payload
  payload=$(printf '{"username":"unicorn-healer","content":"%s"}' "$content")
  curl -sf -X POST -H "Content-Type: application/json" \
    -d "$payload" "$WEBHOOK_URL" --max-time 8 >/dev/null 2>&1 || true
}

check_health() {
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" \
    --max-time "$CHECK_TIMEOUT_SEC" "$HEALTH_URL" 2>/dev/null || echo "000")
  [ "$code" = "200" ]
}

count_fails_window() {
  local now cutoff count=0
  now=$(date +%s); cutoff=$((now - FAIL_WINDOW_SEC))
  if [ -f "$FAIL_TIMES_FILE" ]; then
    while IFS= read -r t; do
      [ "$t" -gt "$cutoff" ] 2>/dev/null && count=$((count + 1))
    done < "$FAIL_TIMES_FILE"
  fi
  echo "$count"
}

record_fail() {
  local now cutoff tmp
  now=$(date +%s); cutoff=$((now - FAIL_WINDOW_SEC))
  echo "$now" >> "$FAIL_TIMES_FILE"
  tmp=$(mktemp)
  if [ -f "$FAIL_TIMES_FILE" ]; then
    awk -v c="$cutoff" '$1 > c' "$FAIL_TIMES_FILE" > "$tmp" || true
    mv "$tmp" "$FAIL_TIMES_FILE"
  fi
}

reset_fails() { rm -f "$FAIL_TIMES_FILE"; }

restart_pm2_apps() {
  log "ACTION" "Restart PM2 apps: $PM2_APPS"
  for app in $PM2_APPS; do
    "$PM2_BIN" restart "$app" --update-env >/dev/null 2>&1 || \
      log "WARN" "pm2 restart $app eșuat"
  done
  "$PM2_BIN" save >/dev/null 2>&1 || true
  send_webhook "🩺 unicorn-healer: PM2 apps restartate ($PM2_APPS)"
}

main() {
  if check_health; then
    if [ -f "$FAIL_TIMES_FILE" ]; then
      reset_fails
      log "OK" "Health restored"
      send_webhook "✅ unicorn-healer: /health OK, eșecuri resetate"
    fi
    exit 0
  fi

  record_fail
  local fails; fails=$(count_fails_window)
  log "WARN" "Health KO ($fails/$FAIL_THRESHOLD în ultimele ${FAIL_WINDOW_SEC}s)"

  if [ "$fails" -ge "$FAIL_THRESHOLD" ]; then
    restart_pm2_apps
    sleep 6
    if check_health; then
      log "OK" "Health restored după restart PM2"
      reset_fails
      send_webhook "🟢 unicorn-healer: recovery OK după restart"
    else
      log "ERROR" "Health încă KO după restart PM2"
      send_webhook "🔴 unicorn-healer: restart fără efect, intervenție umană"
    fi
  fi
}

main "$@"
