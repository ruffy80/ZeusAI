#!/usr/bin/env bash
# =============================================================================
# healer.sh — ZeusAI / Unicorn Self-Healing Script
#
# Rulează la fiecare 30 de secunde (via systemd timer sau cron).
# Verifică endpoint-ul /health pentru fiecare modul.
# Logică:
#   1. Verifică /health → dacă nu răspunde în 5s sau returnează != 200:
#      → docker restart unicorn-app
#   2. Dacă același container eșuează de 3× în 5 minute:
#      → docker-compose down && docker-compose up -d (full redeploy)
#   3. Loghează fiecare intervenție în /var/log/healer.log
#   4. Trimite webhook dacă WEBHOOK_URL este setat
#
# Instalare:
#   cp healer.sh /usr/local/bin/healer.sh
#   chmod +x /usr/local/bin/healer.sh
#   cp healer.service /etc/systemd/system/healer.service
#   systemctl daemon-reload && systemctl enable --now healer.service
# =============================================================================
set -euo pipefail

# ─── Configurare ──────────────────────────────────────────────────────────────
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
CONTAINER_NAME="${CONTAINER_NAME:-unicorn-app}"
COMPOSE_FILE="${COMPOSE_FILE:-/var/www/unicorn/docker-compose.prod.yml}"
LOG_FILE="${LOG_FILE:-/var/log/healer.log}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-3}"       # Eșecuri consecutive înainte de redeploy
FAIL_WINDOW_SEC="${FAIL_WINDOW_SEC:-300}"   # Fereastra de timp (5 minute)
CHECK_TIMEOUT_SEC="${CHECK_TIMEOUT_SEC:-5}" # Timeout pentru health check

# ─── State files ─────────────────────────────────────────────────────────────
STATE_DIR="/tmp/healer-state"
mkdir -p "$STATE_DIR"
FAIL_COUNT_FILE="$STATE_DIR/${CONTAINER_NAME}.fails"
FAIL_TIMES_FILE="$STATE_DIR/${CONTAINER_NAME}.times"

# ─── Funcții utilitar ─────────────────────────────────────────────────────────
log() {
  local level="$1"
  local msg="$2"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$ts] [$level] $msg" >> "$LOG_FILE" 2>/dev/null || true
  echo "[$ts] [$level] $msg"
}

send_webhook() {
  local event="$1"
  local detail="$2"
  if [ -z "$WEBHOOK_URL" ]; then
    return 0
  fi
  local payload
  payload=$(printf '{"event":"%s","detail":"%s","container":"%s","timestamp":"%s"}' \
    "$event" "$detail" "$CONTAINER_NAME" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
  curl -sf -X POST -H "Content-Type: application/json" \
    -d "$payload" "$WEBHOOK_URL" --max-time 10 || true
}

check_health() {
  local http_code
  http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
    --max-time "$CHECK_TIMEOUT_SEC" "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$http_code" = "200" ]; then
    return 0
  else
    log "WARN" "Health check failed: HTTP $http_code from $HEALTH_URL"
    return 1
  fi
}

get_fail_count_in_window() {
  local now
  now=$(date +%s)
  local cutoff
  cutoff=$(( now - FAIL_WINDOW_SEC ))
  local count=0
  if [ -f "$FAIL_TIMES_FILE" ]; then
    while IFS= read -r ts; do
      if [ "$ts" -gt "$cutoff" ] 2>/dev/null; then
        count=$(( count + 1 ))
      fi
    done < "$FAIL_TIMES_FILE"
  fi
  echo "$count"
}

record_failure() {
  local now
  now=$(date +%s)
  echo "$now" >> "$FAIL_TIMES_FILE"
  # Curăță timestamps vechi
  local cutoff
  cutoff=$(( now - FAIL_WINDOW_SEC ))
  local tmpfile
  tmpfile=$(mktemp)
  if [ -f "$FAIL_TIMES_FILE" ]; then
    while IFS= read -r ts; do
      if [ "$ts" -gt "$cutoff" ] 2>/dev/null; then
        echo "$ts" >> "$tmpfile"
      fi
    done < "$FAIL_TIMES_FILE"
  fi
  mv "$tmpfile" "$FAIL_TIMES_FILE"
}

reset_failures() {
  rm -f "$FAIL_TIMES_FILE" "$FAIL_COUNT_FILE"
}

restart_container() {
  log "ACTION" "Repornesc containerul: $CONTAINER_NAME"
  if docker restart "$CONTAINER_NAME" 2>&1 | tee -a "$LOG_FILE"; then
    log "OK" "Containerul $CONTAINER_NAME repornit cu succes."
    send_webhook "container_restarted" "docker restart $CONTAINER_NAME succeeded"
  else
    log "ERROR" "Eșec la repornirea containerului $CONTAINER_NAME"
    send_webhook "restart_failed" "docker restart $CONTAINER_NAME failed"
  fi
}

full_redeploy() {
  log "ACTION" "FULL REDEPLOY: $FAIL_THRESHOLD eșecuri în $FAIL_WINDOW_SEC secunde!"
  send_webhook "full_redeploy_started" "Initiating full stack redeploy"
  local compose_dir
  compose_dir=$(dirname "$COMPOSE_FILE")
  cd "$compose_dir" || {
    log "ERROR" "Nu pot accesa directorul: $compose_dir"
    return 1
  }
  if docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>&1 | tee -a "$LOG_FILE" && \
     docker compose -f "$COMPOSE_FILE" up -d 2>&1 | tee -a "$LOG_FILE"; then
    log "OK" "Full redeploy reușit."
    send_webhook "full_redeploy_succeeded" "Stack restarted successfully"
    reset_failures
  else
    log "ERROR" "Full redeploy eșuat!"
    send_webhook "full_redeploy_failed" "Stack redeploy failed - manual intervention required"
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  # Asigură existența log file
  touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/healer.log"

  if check_health; then
    # Sănătos — resetăm contorul de eșecuri
    if [ -f "$FAIL_TIMES_FILE" ] && [ -s "$FAIL_TIMES_FILE" ]; then
      log "OK" "Health OK — resetez contorul de eșecuri."
      reset_failures
    fi
    return 0
  fi

  # Health check eșuat
  record_failure
  local fails_in_window
  fails_in_window=$(get_fail_count_in_window)
  log "WARN" "Eșecuri în fereastra de ${FAIL_WINDOW_SEC}s: $fails_in_window / $FAIL_THRESHOLD"

  if [ "$fails_in_window" -ge "$FAIL_THRESHOLD" ]; then
    full_redeploy
  else
    restart_container
  fi
}

main "$@"
