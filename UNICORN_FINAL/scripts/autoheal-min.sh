#!/usr/bin/env bash
# autoheal-min.sh — One-minute /health probe + PM2 restart escalator
# Version: 1.0.1 (forward-only retrigger after baseline-advance race)
# -----------------------------------------------------------------------------
# Forward-only safety net. Designed to run from cron every minute on Hetzner
# AS A COMPLEMENT to the existing healer.service / unicorn-health-bot.sh.
# It does NOT replace any of them; it only adds a fast-path probe that
# escalates to `pm2 reload --update-env` when /api/health AND /health both
# fail for AUTOHEAL_MIN_FAIL_STREAK consecutive checks.
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
#   HEALTH_URLS        comma-list (default: http://127.0.0.1:3001/health,http://127.0.0.1:3000/api/health)
#   AUTOHEAL_MIN_FAIL_STREAK   (default: 3 — i.e. 3 minutes of pain before action)
#   AUTOHEAL_MIN_COOLDOWN_S    (default: 600 — wait 10 min between restarts)
# -----------------------------------------------------------------------------
set -euo pipefail

DISABLE_FLAG="/var/run/unicorn-autoheal-min.disabled"
[ -f "$DISABLE_FLAG" ] && exit 0

STATE_DIR="${AUTOHEAL_MIN_STATE:-/var/lib/unicorn-autoheal-min}"
mkdir -p "$STATE_DIR"
STREAK_FILE="$STATE_DIR/fail-streak"
LAST_ACT_FILE="$STATE_DIR/last-action-epoch"

HEALTH_URLS="${HEALTH_URLS:-http://127.0.0.1:3001/health,http://127.0.0.1:3000/api/health}"
THRESHOLD="${AUTOHEAL_MIN_FAIL_STREAK:-3}"
COOLDOWN="${AUTOHEAL_MIN_COOLDOWN_S:-600}"

now=$(date +%s)
ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Probe every URL; one OK = healthy
healthy=0
IFS=',' read -ra URLS <<< "$HEALTH_URLS"
for u in "${URLS[@]}"; do
  code=$(curl -fsS -m 5 -o /dev/null -w "%{http_code}" "$u" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    healthy=1
    break
  fi
done

if [ "$healthy" = "1" ]; then
  # reset streak
  echo "0" > "$STREAK_FILE"
  exit 0
fi

# Increment fail streak
streak=$(cat "$STREAK_FILE" 2>/dev/null || echo "0")
streak=$((streak + 1))
echo "$streak" > "$STREAK_FILE"

echo "$(ts) [autoheal-min] /health failing — streak=$streak/$THRESHOLD"

if [ "$streak" -lt "$THRESHOLD" ]; then
  exit 0
fi

# Cooldown gate — don't thrash PM2
last_act=$(cat "$LAST_ACT_FILE" 2>/dev/null || echo "0")
since=$((now - last_act))
if [ "$since" -lt "$COOLDOWN" ]; then
  echo "$(ts) [autoheal-min] cooldown active (${since}s/${COOLDOWN}s) — skipping restart"
  exit 0
fi

echo "$(ts) [autoheal-min] threshold breached — pm2 reload --update-env"
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload all --update-env || pm2 restart all --update-env || true
  echo "$now" > "$LAST_ACT_FILE"
  echo "0" > "$STREAK_FILE"
else
  echo "$(ts) [autoheal-min] pm2 not in PATH — cannot restart"
fi
