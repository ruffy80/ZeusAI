#!/usr/bin/env bash
# =============================================================================
# unicorn-autoheal-pm2.sh — ZeusAI / Unicorn Auto-Healing (PM2)
#
# Verifică starea procesului PM2 "unicorn" și endpoint-ul /api/health.
# Repornește procesul dacă nu rulează sau dacă health check eșuează.
#
# Instalare (cron la fiecare 2 minute):
#   chmod +x /var/www/unicorn/UNICORN_FINAL/scripts/unicorn-autoheal-pm2.sh
#   crontab -e
#   */2 * * * * /var/www/unicorn/UNICORN_FINAL/scripts/unicorn-autoheal-pm2.sh
#
# Sau ca systemd timer — copiați healer.service și healer.timer din același
# director și adaptați ExecStart să pointeze spre acest script.
# =============================================================================
set -euo pipefail

# ── Configurare ───────────────────────────────────────────────────────────────
PM2_APP="${PM2_APP:-unicorn}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
APP_DIR="${APP_DIR:-/var/www/unicorn/UNICORN_FINAL}"
ECOSYSTEM_CFG="${ECOSYSTEM_CFG:-$APP_DIR/ecosystem.config.js}"
LOG="${LOG:-/var/log/unicorn-autoheal.log}"
CHECK_TIMEOUT="${CHECK_TIMEOUT:-8}"    # secunde timeout health check
WEBHOOK_URL="${WEBHOOK_URL:-}"         # opțional: URL pentru notificări

# ── Funcții ───────────────────────────────────────────────────────────────────
log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  local msg="[$ts] $*"
  echo "$msg" | tee -a "$LOG" 2>/dev/null || echo "$msg"
}

send_webhook() {
  [ -z "$WEBHOOK_URL" ] && return 0
  local event="$1" detail="$2"
  curl -sf -X POST -H "Content-Type: application/json" \
    -d "{\"event\":\"$event\",\"detail\":\"$detail\",\"app\":\"$PM2_APP\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    "$WEBHOOK_URL" --max-time 10 >/dev/null 2>&1 || true
}

pm2_is_running() {
  pm2 list 2>/dev/null | grep -qE "^\s*│?\s*$PM2_APP\s*│?\s*.*online"
}

health_ok() {
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" \
    --max-time "$CHECK_TIMEOUT" "$HEALTH_URL" 2>/dev/null || echo "000")
  [ "$code" = "200" ]
}

restart_pm2() {
  local reason="$1"
  log "[Autoheal] $reason — restarting PM2 app: $PM2_APP"
  send_webhook "restart" "$reason"
  if pm2 restart "$PM2_APP" 2>&1 | tee -a "$LOG"; then
    log "[Autoheal] PM2 restart OK."
    send_webhook "restart_ok" "pm2 restart $PM2_APP succeeded"
  else
    log "[Autoheal] PM2 restart failed — trying startOrRestart from ecosystem..."
    cd "$APP_DIR"
    pm2 startOrRestart "$ECOSYSTEM_CFG" --only "$PM2_APP" 2>&1 | tee -a "$LOG" || true
    send_webhook "restart_fallback" "pm2 startOrRestart used as fallback"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  touch "$LOG" 2>/dev/null || LOG="/tmp/unicorn-autoheal.log"

  log "[Autoheal] $(date)"

  # 1. Verifică dacă PM2 rulează aplicația
  if ! pm2_is_running; then
    log "[Autoheal] '$PM2_APP' not running in PM2."
    restart_pm2 "PM2 process not online"
    return
  fi

  # 2. Verifică health endpoint
  if ! health_ok; then
    local code
    code=$(curl -sf -o /dev/null -w "%{http_code}" \
      --max-time "$CHECK_TIMEOUT" "$HEALTH_URL" 2>/dev/null || echo "000")
    log "[Autoheal] Health check failed (HTTP $code) for $HEALTH_URL."
    restart_pm2 "Health check failed (HTTP $code)"
    return
  fi

  log "[Autoheal] All OK — PM2 running, health check passed."
}

main "$@"
