#!/usr/bin/env bash
# =====================================================================
# ZEUS SAFE CHAOS DRILL (non-destructive)
#
# EN: Validates self-healing every day by restarting the non-critical cortex
# service and verifying both hemispheres + backend health recover quickly.
# RO: Validează auto-vindecarea zilnic, fără impact critic.
# =====================================================================
set -euo pipefail

ROOT="${ZEUS_ROOT:-/var/www/unicorn/UNICORN_FINAL}"
LOG_PATH="${ZEUS_CHAOS_LOG_PATH:-${ROOT}/data/logs/chaos-drill.log}"
TARGET_SERVICE="${ZEUS_CHAOS_TARGET_SERVICE:-zeus-cortex.service}"
WAIT_SEC="${ZEUS_CHAOS_WAIT_SEC:-18}"

mkdir -p "$(dirname "$LOG_PATH")"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

json_log() {
  local level="$1" msg="$2" extra="${3:-{}}"
  printf '{"ts":"%s","level":"%s","msg":"%s","extra":%s}\n' "$(ts)" "$level" "$msg" "$extra" >> "$LOG_PATH"
}

health_ok() {
  curl -fsS --max-time 8 http://127.0.0.1:3000/health >/dev/null \
    && curl -fsS --max-time 8 http://127.0.0.1:3001/health >/dev/null
}

json_log "info" "chaos_drill_start" "{\"target\":\"${TARGET_SERVICE}\"}"

if ! health_ok; then
  json_log "error" "chaos_drill_precheck_failed" "{\"reason\":\"backend_or_site_unhealthy\"}"
  exit 1
fi

# Non-destructive verification: if legacy cortex/brainstem units are inactive/retired,
# verify active sovereign production stack (backend, site, orchestrator, zac, immunity, evolution chain).
state_target_init="$(systemctl is-active "$TARGET_SERVICE" 2>/dev/null || true)"
state_brainstem_init="$(systemctl is-active zeus-brainstem.service 2>/dev/null || true)"

if [ "$state_target_init" = "active" ] && [ "$state_brainstem_init" = "active" ]; then
  systemctl restart "$TARGET_SERVICE"
  sleep "$WAIT_SEC"
  state_target="$(systemctl is-active "$TARGET_SERVICE" 2>/dev/null || true)"
  state_brainstem="$(systemctl is-active zeus-brainstem.service 2>/dev/null || true)"
  if [ "$state_target" != "active" ] || [ "$state_brainstem" != "active" ] || ! health_ok; then
    json_log "error" "chaos_drill_failed" "{\"targetState\":\"${state_target}\",\"brainstem\":\"${state_brainstem}\"}"
    exit 1
  fi
  json_log "info" "chaos_drill_ok" "{\"mode\":\"hemisphere_restart\",\"targetState\":\"${state_target}\",\"brainstem\":\"${state_brainstem}\"}"
  exit 0
fi

# Active production resilience drill (zero downtime): verify orchestrator, zac, Ed25519 evolution chain, & ASRI immunity
state_orch="$(systemctl is-active zeus-orchestrator.service 2>/dev/null || true)"
state_zac="$(systemctl is-active zac.service 2>/dev/null || true)"
evo_ok="$(curl -fsS --max-time 8 http://127.0.0.1:3000/api/evolution/verify 2>/dev/null | grep -c '"ok":true' || true)"
imm_ok="$(curl -fsS --max-time 8 http://127.0.0.1:3001/.well-known/runtime-immunity.json 2>/dev/null | grep -c '"SOVEREIGN_A+"' || true)"

if [ "$state_orch" != "active" ] || [ "$state_zac" != "active" ] || [ "$evo_ok" -lt 1 ] || [ "$imm_ok" -lt 1 ] || ! health_ok; then
  json_log "error" "chaos_drill_failed" "{\"mode\":\"sovereign_probe\",\"orchestrator\":\"${state_orch}\",\"zac\":\"${state_zac}\",\"evoOk\":${evo_ok},\"immOk\":${imm_ok}}"
  exit 1
fi

json_log "info" "chaos_drill_ok" "{\"mode\":\"sovereign_probe\",\"orchestrator\":\"${state_orch}\",\"zac\":\"${state_zac}\",\"evoOk\":${evo_ok},\"immOk\":${imm_ok}}"
exit 0
