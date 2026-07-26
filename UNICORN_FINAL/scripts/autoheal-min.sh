#!/usr/bin/env bash
# autoheal-min.sh — One-minute /health probe + PM2 restart escalator
# Version: 1.0.1 (forward-only retrigger after baseline-advance race)
# -----------------------------------------------------------------------------
# Forward-only safety net. Designed to run from cron every minute on Hetzner as
# the controlled health-based PM2 restart path. It probes each application
# independently and escalates only after consecutive failures and a cooldown.
#
# Install (run once on the box):
#   sudo cp UNICORN_FINAL/scripts/autoheal-min.sh /usr/local/bin/
#   sudo chmod +x /usr/local/bin/autoheal-min.sh
#   ( crontab -l 2>/dev/null; echo '* * * * * /usr/local/bin/autoheal-min.sh >>/var/log/unicorn-autoheal-min.log 2>&1' ) | crontab -
#
# Disable instantly:
#   echo 1 > /var/run/unicorn-autoheal-min.disabled
#
# Tunables (env or first arg):
#   AUTOHEAL_MIN_FAIL_STREAK   (default: 5 — i.e. 5 minutes of pain before action)
#   AUTOHEAL_MIN_COOLDOWN_S    (default: 900 — wait 15 min between restarts)
#   AUTOHEAL_MIN_BOOT_GRACE_S  (default: 180 — never restart during cold boot)
#   AUTOHEAL_MIN_CURL_TIMEOUT  (default: 8 — tolerate slow event-loop boots)
# -----------------------------------------------------------------------------
set -euo pipefail

DISABLE_FLAG="/var/run/unicorn-autoheal-min.disabled"
[ -f "$DISABLE_FLAG" ] && exit 0

STATE_DIR="${AUTOHEAL_MIN_STATE:-/var/lib/unicorn-autoheal-min}"
mkdir -p "$STATE_DIR"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$STATE_DIR/run.lock"
  flock -n 9 || exit 0
else
  LOCK_DIR="$STATE_DIR/run.lock.d"
  mkdir "$LOCK_DIR" 2>/dev/null || exit 0
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
fi

BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
SITE_HEALTH_URL="${SITE_HEALTH_URL:-http://127.0.0.1:3001/health}"
THRESHOLD="${AUTOHEAL_MIN_FAIL_STREAK:-5}"
COOLDOWN="${AUTOHEAL_MIN_COOLDOWN_S:-900}"
BOOT_GRACE="${AUTOHEAL_MIN_BOOT_GRACE_S:-180}"
CURL_TIMEOUT="${AUTOHEAL_MIN_CURL_TIMEOUT:-8}"

case "$THRESHOLD:$COOLDOWN:$BOOT_GRACE:$CURL_TIMEOUT" in
  *[!0-9:]*|:*|*:) echo "invalid autoheal threshold, cooldown, boot grace or curl timeout" >&2; exit 2 ;;
esac
[ "$THRESHOLD" -gt 0 ] || { echo "AUTOHEAL_MIN_FAIL_STREAK must be greater than zero" >&2; exit 2; }

now=$(date +%s)
ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# PM2 created_at is ms; return uptime seconds or empty if unknown.
pm2_uptime_s() {
  local app="$1"
  command -v pm2 >/dev/null 2>&1 || return 0
  pm2 jlist 2>/dev/null | node -e '
    let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
      try {
        const name = process.argv[1];
        const list = JSON.parse(b || "[]");
        const p = list.find(x => x && x.name === name);
        if (!p || !p.pm2_env || !p.pm2_env.created_at) { process.stdout.write(""); return; }
        const up = Math.max(0, Math.floor((Date.now() - Number(p.pm2_env.created_at)) / 1000));
        process.stdout.write(String(up));
      } catch (_) { process.stdout.write(""); }
    });
  ' "$app" 2>/dev/null || true
}

# Probe returns unhealthy if HTTP != 200 OR never-down kernel signals event-loop hang.
probe_ok() {
  local url="$1"
  local body code
  body=$(curl -fsS -m "$CURL_TIMEOUT" "$url" 2>/dev/null || true)
  code=$(curl -fsS -m "$CURL_TIMEOUT" -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true)
  [ "$code" = "200" ] || return 1
  # Optional NDK lag fail (backend /api/health embeds neverDown.healerFail)
  if printf '%s' "$body" | grep -q '"healerFail"[[:space:]]*:[[:space:]]*true'; then
    return 1
  fi
  return 0
}

probe_app() {
  local app="$1" url="$2"
  local streak_file="$STATE_DIR/${app}.fail-streak"
  local last_act_file="$STATE_DIR/${app}.last-action-epoch"
  local streak last_act since uptime_s
  uptime_s="$(pm2_uptime_s "$app")"
  if [ -n "$uptime_s" ] && [ "$uptime_s" -lt "$BOOT_GRACE" ] 2>/dev/null; then
    echo "$(ts) [autoheal-min] $app boot-grace active (uptime=${uptime_s}s/${BOOT_GRACE}s) — skip"
    echo 0 > "$streak_file"
    return 0
  fi
  if probe_ok "$url"; then
    echo 0 > "$streak_file"
    return 0
  fi
  streak=$(cat "$streak_file" 2>/dev/null || echo 0)
  streak=$((streak + 1))
  echo "$streak" > "$streak_file"
  echo "$(ts) [autoheal-min] $app unhealthy streak=$streak/$THRESHOLD url=$url"
  [ "$streak" -ge "$THRESHOLD" ] || return 0
  last_act=$(cat "$last_act_file" 2>/dev/null || echo 0)
  since=$((now - last_act))
  if [ "$since" -lt "$COOLDOWN" ]; then
    echo "$(ts) [autoheal-min] $app cooldown active (${since}s/${COOLDOWN}s)"
    return 0
  fi
  if command -v pm2 >/dev/null 2>&1; then
    echo "$(ts) [autoheal-min] restarting only $app"
    if pm2 reload "$app" --update-env || pm2 restart "$app" --update-env; then
      echo "$now" > "$last_act_file"
      echo 0 > "$streak_file"
    else
      echo "$(ts) [autoheal-min] failed to restart $app; preserving failure streak" >&2
    fi
  fi
}

probe_app unicorn-backend "$BACKEND_HEALTH_URL"
probe_app unicorn-site "$SITE_HEALTH_URL"
