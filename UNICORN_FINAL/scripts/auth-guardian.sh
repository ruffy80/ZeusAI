#!/usr/bin/env bash
# auth-guardian.sh — 5-minute auth health probe with self-repair
#
# Cron-driven companion to backend/modules/auth-guardian.js. Designed to be
# installed at /opt/unicorn/scripts/auth-guardian.sh on the Hetzner box and
# invoked every 5 minutes. Two consecutive failures trigger:
#   1) DB integrity check  (sqlite3 quick_check)
#   2) JWT_SECRET / SESSION_SECRET presence check in the backend env
#   3) Backend restart    (pm2 restart, with docker-compose fallback)
#   4) Optional webhook alert (Discord / Slack)
#
# Configuration is read from /opt/unicorn/.env (or $AUTH_GUARDIAN_ENV_FILE).
# All actions are idempotent; failures are logged but never abort the script.
#
# Required env (in /opt/unicorn/.env or process env):
#   AUTH_GUARDIAN_EMAIL        login email of the canary account
#   AUTH_GUARDIAN_PASSWORD     password of the canary account
# Optional:
#   AUTH_GUARDIAN_BASE_URL     default https://zeusai.pro
#   AUTH_GUARDIAN_DB_PATH      default /opt/unicorn/data/users.db
#   AUTH_GUARDIAN_STATE_DIR    default /var/lib/unicorn/auth-guardian
#   AUTH_GUARDIAN_LOG_FILE     default /var/log/unicorn/auth-guardian.log
#   AUTH_GUARDIAN_WEBHOOK_URL  Discord/Slack webhook for alerts
#   AUTH_GUARDIAN_FAIL_THRESHOLD  default 2
#   AUTH_GUARDIAN_BACKEND_DIR  default /opt/unicorn (docker-compose project dir)
#   AUTH_GUARDIAN_PM2_NAME     default unicorn-backend

set -u

# --- Locate and source env file (best-effort, do not fail) -------------------
ENV_FILE="${AUTH_GUARDIAN_ENV_FILE:-/opt/unicorn/.env}"
if [ -r "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

BASE_URL="${AUTH_GUARDIAN_BASE_URL:-https://zeusai.pro}"
DB_PATH="${AUTH_GUARDIAN_DB_PATH:-/opt/unicorn/data/users.db}"
STATE_DIR="${AUTH_GUARDIAN_STATE_DIR:-/var/lib/unicorn/auth-guardian}"
LOG_FILE="${AUTH_GUARDIAN_LOG_FILE:-/var/log/unicorn/auth-guardian.log}"
WEBHOOK_URL="${AUTH_GUARDIAN_WEBHOOK_URL:-}"
FAIL_THRESHOLD="${AUTH_GUARDIAN_FAIL_THRESHOLD:-2}"
BACKEND_DIR="${AUTH_GUARDIAN_BACKEND_DIR:-/opt/unicorn}"
PM2_NAME="${AUTH_GUARDIAN_PM2_NAME:-unicorn-backend}"
EMAIL="${AUTH_GUARDIAN_EMAIL:-}"
PASSWORD="${AUTH_GUARDIAN_PASSWORD:-}"

mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")" 2>/dev/null || true
FAIL_FILE="$STATE_DIR/consecutive-failures"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() {
  local line
  line="$(ts) [auth-guardian] $*"
  printf '%s\n' "$line" >> "$LOG_FILE" 2>/dev/null || true
  printf '%s\n' "$line"
}

read_failures() {
  if [ -r "$FAIL_FILE" ]; then
    cat "$FAIL_FILE" 2>/dev/null | tr -dc '0-9' | head -c 6
  else
    printf '0'
  fi
}

write_failures() {
  printf '%s' "$1" > "$FAIL_FILE" 2>/dev/null || true
}

# --- Webhook alert (Discord and Slack accept the same JSON shape: {content})
post_alert() {
  local msg="$1"
  [ -z "$WEBHOOK_URL" ] && return 0
  # Build JSON safely without escaping pitfalls
  local payload
  payload=$(printf '{"content":"🚨 AuthGuardian: %s","text":"🚨 AuthGuardian: %s"}' \
    "$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
    "$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')")
  curl -fsS -m 10 -H 'Content-Type: application/json' \
    -X POST -d "$payload" "$WEBHOOK_URL" >/dev/null 2>&1 || true
}

# --- Probe: POST login, expect HTTP 200 and JSON containing a token ----------
probe_login() {
  if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
    log "skip: AUTH_GUARDIAN_EMAIL/PASSWORD not configured"
    return 2  # inconclusive (no creds)
  fi
  local body http
  # jq-free JSON body builder (escapes backslashes and double-quotes only —
  # control chars in passwords are not supported, by policy).
  body=$(printf '{"email":"%s","password":"%s"}' \
    "$(printf '%s' "$EMAIL" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
    "$(printf '%s' "$PASSWORD" | sed 's/\\/\\\\/g; s/"/\\"/g')")
  local resp
  resp=$(curl -sS -m 15 -o /tmp/auth-guardian.body -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -X POST -d "$body" "$BASE_URL/api/auth/login" 2>/dev/null) || resp="000"
  http="$resp"
  if [ "$http" = "200" ] && grep -q '"token"' /tmp/auth-guardian.body 2>/dev/null; then
    return 0
  fi
  log "probe failed: http=$http body_head=$(head -c 200 /tmp/auth-guardian.body 2>/dev/null | tr -d '\n')"
  return 1
}

# --- Diagnostics + repair sequence -------------------------------------------
check_db() {
  if [ ! -e "$DB_PATH" ]; then
    log "DB MISSING: $DB_PATH"
    return 1
  fi
  if command -v sqlite3 >/dev/null 2>&1; then
    local out
    out=$(sqlite3 "$DB_PATH" 'PRAGMA quick_check;' 2>&1)
    if [ "$(printf '%s' "$out" | tr '[:upper:]' '[:lower:]' | head -n1)" != "ok" ]; then
      log "DB CORRUPT: quick_check=$out"
      return 1
    fi
    log "DB ok ($(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM users;' 2>/dev/null || echo '?') users)"
  else
    log "sqlite3 binary not available; skipping DB integrity check"
  fi
  return 0
}

check_secrets() {
  local missing=""
  [ -z "${JWT_SECRET:-}" ] && missing="$missing JWT_SECRET"
  [ -z "${SESSION_SECRET:-}" ] && missing="$missing SESSION_SECRET"
  if [ -n "$missing" ]; then
    log "SECRETS MISSING:$missing"
    return 1
  fi
  log "secrets ok"
  return 0
}

restart_backend() {
  if command -v pm2 >/dev/null 2>&1 && pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    log "pm2 restart $PM2_NAME"
    pm2 restart "$PM2_NAME" --update-env >/dev/null 2>&1 || log "pm2 restart returned non-zero"
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1 && [ -f "$BACKEND_DIR/docker-compose.yml" ]; then
    log "docker-compose restart backend (cwd=$BACKEND_DIR)"
    ( cd "$BACKEND_DIR" && docker-compose restart backend ) >/dev/null 2>&1 || log "docker-compose restart returned non-zero"
    return 0
  fi
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^unicorn-backend$'; then
    log "docker restart unicorn-backend"
    docker restart unicorn-backend >/dev/null 2>&1 || log "docker restart returned non-zero"
    return 0
  fi
  log "no supported restart mechanism found (pm2/docker-compose/docker)"
  return 1
}

run_repair() {
  local repair_js="$BACKEND_DIR/UNICORN_FINAL/scripts/auth-repair.js"
  [ -e "$repair_js" ] || repair_js="$BACKEND_DIR/scripts/auth-repair.js"
  if [ -e "$repair_js" ] && command -v node >/dev/null 2>&1; then
    log "running auth-repair.js"
    node "$repair_js" >> "$LOG_FILE" 2>&1 || log "auth-repair.js exited non-zero"
  fi
}

# --- Main flow ---------------------------------------------------------------
main() {
  probe_login
  rc=$?
  if [ "$rc" = "0" ]; then
    write_failures 0
    log "ok: login probe succeeded"
    return 0
  fi
  if [ "$rc" = "2" ]; then
    # No creds configured — do nothing destructive.
    return 0
  fi

  fails=$(read_failures)
  fails=$((fails + 1))
  write_failures "$fails"
  log "fail #$fails (threshold=$FAIL_THRESHOLD)"

  if [ "$fails" -lt "$FAIL_THRESHOLD" ]; then
    return 0
  fi

  log "threshold reached; running diagnostics + repair"
  db_ok=0; sec_ok=0
  check_db || db_ok=1
  check_secrets || sec_ok=1
  run_repair
  restart_backend

  # Re-probe after a brief settle window
  sleep 8
  if probe_login; then
    write_failures 0
    log "recovered after repair"
    post_alert "auth restored after $fails failures (db_issue=$db_ok secrets_issue=$sec_ok) on $BASE_URL"
    return 0
  fi

  post_alert "AUTH STILL DOWN after $fails failures + repair attempt (db_issue=$db_ok secrets_issue=$sec_ok) on $BASE_URL — manual intervention required"
  log "still failing after repair — alert dispatched"
  return 1
}

main
exit 0
