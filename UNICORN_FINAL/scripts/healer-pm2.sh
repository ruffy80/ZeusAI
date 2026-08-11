#!/usr/bin/env bash
# =============================================================================
# healer-pm2.sh — ZeusAI / Unicorn Self-Healer (PM2 edition)
#
# Verifică /health la fiecare tick; dacă pică 3× în 5min → restart PM2 apps.
# NU folosește docker. Sigur pentru deploy-ul actual (cluster + fork).
# Variabile env (override):
#   HEALTH_URL         (default http://127.0.0.1:3000/api/health)
#   SITE_HEALTH_URL    (default http://127.0.0.1:3001/health)
#   PM2_BIN            (default detect via npm root -g)
#   PM2_APPS           (default "unicorn-backend unicorn-site")
#   STATE_DIR          (default /var/lib/unicorn-healer, fallback /tmp/...)
#   APP_DIR            (default /var/www/unicorn/UNICORN_FINAL)
#   ECOSYSTEM_CFG      (default $APP_DIR/ecosystem.config.js)
#   FAIL_THRESHOLD     (default 5)
#   FAIL_WINDOW_SEC    (default 600)
#   CHECK_TIMEOUT_SEC  (default 20)
#   BOOT_GRACE_SEC     (default 180 — skip restarts during cold boot)
#   POST_RESTART_WAIT_SEC (default 6 — settle time before re-check)
#   LOG_FILE           (default /var/log/healer.log)
#   WEBHOOK_URL        (Discord webhook opțional)
#
# RECOVERY ESCALATION (why this is more than `pm2 restart`):
#   `pm2 restart <app>` is a no-op that EXITS NON-ZERO when the app is absent
#   from PM2's process list — which is exactly what happens after PM2 exhausts
#   max_restarts on a crash-loop (app goes `errored`/removed), after a `pm2
#   kill`, or after a reboot where the saved dump was never resurrected. In
#   those states a plain restart can never bring the service back and the box
#   stays down behind nginx's maintenance page. This healer therefore:
#     1. `pm2 resurrect`s the saved dump when the daemon has no processes, then
#     2. escalates any failed `pm2 restart` to `pm2 startOrRestart
#        ecosystem.config.js --only <app>`, which RECREATES the process from
#        source-of-truth config instead of assuming it already exists.
# =============================================================================
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
SITE_HEALTH_URL="${SITE_HEALTH_URL:-http://127.0.0.1:3001/health}"
# App names mapped to each probe so recovery targets ONLY the service that is
# actually down (a site-only outage must not pointlessly bounce the backend,
# and — critically — a site-only outage MUST restart the site, not the backend).
BACKEND_APP="${BACKEND_APP:-unicorn-backend}"
SITE_APP="${SITE_APP:-unicorn-site}"
# Fallback restart set when the failed-app mapping is empty (e.g. custom probes).
PM2_APPS="${PM2_APPS:-unicorn-backend unicorn-site}"
APP_DIR="${APP_DIR:-/var/www/unicorn/UNICORN_FINAL}"
ECOSYSTEM_CFG="${ECOSYSTEM_CFG:-$APP_DIR/ecosystem.config.js}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-5}"
FAIL_WINDOW_SEC="${FAIL_WINDOW_SEC:-600}"
CHECK_TIMEOUT_SEC="${CHECK_TIMEOUT_SEC:-20}"
BOOT_GRACE_SEC="${BOOT_GRACE_SEC:-180}"
POST_RESTART_WAIT_SEC="${POST_RESTART_WAIT_SEC:-6}"
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

STATE_DIR="${STATE_DIR:-/var/lib/unicorn-healer}"
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

check_one() {
  local url="$1"
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" \
    --max-time "$CHECK_TIMEOUT_SEC" "$url" 2>/dev/null || echo "000")
  [ "$code" = "200" ]
}

# Print the space-separated set of PM2 apps whose health probe is currently
# failing. Empty output means everything is healthy. Deduped, order-stable.
unhealthy_apps() {
  local out=""
  check_one "$HEALTH_URL"      || out="$out $BACKEND_APP"
  check_one "$SITE_HEALTH_URL" || out="$out $SITE_APP"
  # trim + dedupe (backend and site apps could be configured the same)
  printf '%s\n' $out | awk 'NF && !seen[$0]++' | tr '\n' ' ' | sed 's/ *$//'
}

check_health() {
  # Healthy iff no app's probe is failing (autoscaler/guardian PM2 apps retired).
  [ -z "$(unhealthy_apps)" ]
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

# True when the PM2 daemon is reachable AND has at least one process in its
# list. An empty list means the daemon was just (re)spawned with no dump loaded
# (post-reboot, post-`pm2 kill`), so `pm2 restart <app>` would fail for every
# app — resurrect the saved dump first.
pm2_daemon_has_procs() {
  local out
  out="$("$PM2_BIN" jlist 2>/dev/null || echo '')"
  printf '%s' "$out" | node -e '
    let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
      try { const l = JSON.parse(b || "[]"); process.exit(Array.isArray(l) && l.length > 0 ? 0 : 1); }
      catch (_) { process.exit(1); }
    });
  ' >/dev/null 2>&1
}

# Recreate one app from the ecosystem config (source of truth). Works even when
# the app is absent/errored in PM2, which a plain `pm2 restart` cannot handle.
start_or_restart_from_ecosystem() {
  local app="$1"
  if [ ! -f "$ECOSYSTEM_CFG" ]; then
    log "ERROR" "ecosystem config not found ($ECOSYSTEM_CFG) — cannot recreate $app"
    return 1
  fi
  ( cd "$APP_DIR" 2>/dev/null && "$PM2_BIN" startOrRestart "$ECOSYSTEM_CFG" --only "$app" --update-env >/dev/null 2>&1 )
}

restart_pm2_apps() {
  # Restart the apps passed as args; fall back to the full PM2_APPS set when
  # called without a specific target list.
  local apps="$*"
  [ -n "$apps" ] || apps="$PM2_APPS"
  log "ACTION" "Restart PM2 apps: $apps"

  # Step 0: if the daemon has no processes at all, restore the saved dump so
  # subsequent per-app operations have something to act on.
  if ! pm2_daemon_has_procs; then
    log "WARN" "PM2 process list empty/unreachable — attempting pm2 resurrect"
    "$PM2_BIN" resurrect >/dev/null 2>&1 || log "WARN" "pm2 resurrect eșuat (continuing to recreate from ecosystem)"
  fi

  # Step 1: restart each app; on any failure, escalate to recreating it from
  # the ecosystem config instead of giving up (the historical bug).
  for app in $apps; do
    if "$PM2_BIN" restart "$app" --update-env >/dev/null 2>&1; then
      continue
    fi
    log "WARN" "pm2 restart $app eșuat — escalating to startOrRestart from ecosystem"
    if start_or_restart_from_ecosystem "$app"; then
      log "OK" "recreated $app from $ECOSYSTEM_CFG"
    else
      log "ERROR" "could not recreate $app from ecosystem config"
    fi
  done

  "$PM2_BIN" save >/dev/null 2>&1 || true
  send_webhook "🩺 unicorn-healer: PM2 apps restartate ($apps)"
}

pm2_min_uptime_s() {
  # Youngest required app uptime (seconds). Empty if PM2 unavailable.
  command -v "$PM2_BIN" >/dev/null 2>&1 || { command -v pm2 >/dev/null 2>&1 || return 0; }
  local bin="${PM2_BIN:-pm2}"
  "$bin" jlist 2>/dev/null | node -e '
    let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
      try {
        const want = new Set(String(process.argv[1]||"").split(/\s+/).filter(Boolean));
        const list = JSON.parse(b || "[]");
        let min = Infinity;
        for (const p of list) {
          if (!p || !want.has(p.name) || !p.pm2_env || !p.pm2_env.created_at) continue;
          const up = Math.max(0, Math.floor((Date.now() - Number(p.pm2_env.created_at)) / 1000));
          if (up < min) min = up;
        }
        process.stdout.write(min === Infinity ? "" : String(min));
      } catch (_) { process.stdout.write(""); }
    });
  ' "$PM2_APPS" 2>/dev/null || true
}

main() {
  local uptime_s
  uptime_s="$(pm2_min_uptime_s)"
  if [ -n "$uptime_s" ] && [ "$uptime_s" -lt "$BOOT_GRACE_SEC" ] 2>/dev/null; then
    log "OK" "Boot grace active (min uptime=${uptime_s}s/${BOOT_GRACE_SEC}s) — skip heal"
    exit 0
  fi

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
  local down; down="$(unhealthy_apps)"
  log "WARN" "Health KO ($fails/$FAIL_THRESHOLD în ultimele ${FAIL_WINDOW_SEC}s) — down: ${down:-unknown}"

  if [ "$fails" -ge "$FAIL_THRESHOLD" ]; then
    # Recompute the failed set at restart time and heal ONLY those apps.
    down="$(unhealthy_apps)"
    restart_pm2_apps $down
    sleep "$POST_RESTART_WAIT_SEC"
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
