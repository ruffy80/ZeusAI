#!/usr/bin/env bash
set -uo pipefail

LOG_FILE="${UNICORN_HEALTH_LOG:-/var/log/unicorn-health-bot.log}"
STATE_FILE="${UNICORN_HEALTH_STATE:-/var/lib/unicorn/health-bot.state}"
BASE_URL="${UNICORN_HEALTH_BASE_URL:-http://127.0.0.1:3000}"
SITE_URL="${UNICORN_HEALTH_SITE_URL:-http://127.0.0.1:3001}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/unicorn/UNICORN_FINAL}"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$STATE_FILE")" 2>/dev/null || true
touch "$LOG_FILE" "$STATE_FILE" 2>/dev/null || true

json_log() {
  local level="$1" event="$2" target="$3" status="$4" detail="$5"
  printf '{"ts":"%s","level":"%s","event":"%s","target":"%s","status":"%s","detail":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$event" "$target" "$status" "$detail" >> "$LOG_FILE"
}

state_get() {
  local key="$1"
  grep -E "^${key}=" "$STATE_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

state_set() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -Ev "^${key}=" "$STATE_FILE" 2>/dev/null > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$STATE_FILE"
}

restart_target() {
  local app="$1"
  json_log warn restart "$app" triggered "{\"reason\":\"two_consecutive_failed_probes\"}"
  if command -v docker >/dev/null 2>&1; then
    local ids
    ids="$(docker ps --format '{{.ID}} {{.Names}}' 2>/dev/null | awk -v app="$app" 'tolower($0) ~ app {print $1}')"
    if [ -n "$ids" ]; then docker restart $ids >/dev/null 2>&1 || true; fi
  fi
  if command -v pm2 >/dev/null 2>&1; then
    case "$app" in
      backend) pm2 restart unicorn-backend --update-env >/dev/null 2>&1 || true ;;
      site)    pm2 restart unicorn-site --update-env >/dev/null 2>&1 || true ;;
      *)       (cd "$DEPLOY_PATH" && pm2 restart unicorn-backend unicorn-site autoscaler --update-env) >/dev/null 2>&1 || true ;;
    esac
    pm2 save --force >/dev/null 2>&1 || true
  fi
}

rollback_target() {
  local app="$1"
  json_log error forward_fix_required "$app" blocked "{\"reason\":\"rollback_disabled_forward_only_contract\"}"
  return 1
}

probe() {
  local app="$1" path="$2" base="$3" status key fails restarts first_restart now
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "$base$path" 2>/dev/null || echo 000)"
  key="${app}_$(echo "$path" | tr '/:.-' '____')"
  now="$(date +%s)"
  if [ "$status" = "200" ]; then
    state_set "fail_$key" 0
    json_log info probe "$path" 200 "{\"app\":\"$app\",\"base\":\"$base\"}"
    return 0
  fi
  fails="$(( $(state_get "fail_$key" || echo 0) + 1 ))"
  state_set "fail_$key" "$fails"
  json_log warn probe "$path" "$status" "{\"app\":\"$app\",\"failureCount\":$fails,\"base\":\"$base\"}"
  if [ "$fails" -ge 2 ]; then
    restart_target "$app"
    state_set "fail_$key" 0
    first_restart="$(state_get "first_restart_$app")"
    restarts="$(state_get "restarts_$app")"
    if [ -z "$first_restart" ] || [ $((now - first_restart)) -gt 1800 ]; then
      first_restart="$now"; restarts=0
    fi
    restarts="$(( ${restarts:-0} + 1 ))"
    state_set "first_restart_$app" "$first_restart"
    state_set "restarts_$app" "$restarts"
    if [ "$restarts" -ge 3 ]; then
      rollback_target "$app"
      state_set "first_restart_$app" "$now"
      state_set "restarts_$app" 0
    fi
  fi
}

probe site /health "$SITE_URL"
probe backend /health "$BASE_URL"
probe backend /api/industry/list "$BASE_URL"
probe backend /api/control/stats "$BASE_URL"
probe backend /api/evolution/snapshot "$BASE_URL"
probe backend /api/services/list "$BASE_URL"
probe backend /api/pricing/sme "$BASE_URL"
