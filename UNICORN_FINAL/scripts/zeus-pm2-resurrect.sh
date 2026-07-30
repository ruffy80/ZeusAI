#!/usr/bin/env bash
# zeus-pm2-resurrect.sh — Host-only last-resort PM2 daemon resurrect
# -------------------------------------------------------------------
# Doctrine: Node processes NEVER pm2-restart themselves (Boot Immortal / NDK).
# This script is for systemd/cron OUTSIDE the app when BOTH apps are dark AND
# `pm2 ping` fails. Cooldown + kill-switch prevent thrash.
#
# Install (optional, root):
#   install -m 0755 scripts/zeus-pm2-resurrect.sh /usr/local/bin/zeus-pm2-resurrect.sh
#   # cron every 2 min, or a oneshot timer
#
# Kill-switch: touch /etc/zeus-pm2-resurrect.disabled

set -euo pipefail

DISABLED_FILE="${ZEUS_PM2_RESURRECT_DISABLED:-/etc/zeus-pm2-resurrect.disabled}"
COOLDOWN_FILE="${ZEUS_PM2_RESURRECT_COOLDOWN:-/tmp/zeus-pm2-resurrect.cooldown}"
COOLDOWN_S="${ZEUS_PM2_RESURRECT_COOLDOWN_S:-900}"
BACKEND_HEALTH="${BACKEND_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
SITE_HEALTH="${SITE_HEALTH_URL:-http://127.0.0.1:3001/health}"
ECOSYSTEM="${ZEUS_ECOSYSTEM:-/var/www/unicorn/UNICORN_FINAL/ecosystem.config.js}"
LOG_TAG='[zeus-pm2-resurrect]'

log() { printf '%s %s\n' "$LOG_TAG" "$*"; }

if [ -f "$DISABLED_FILE" ]; then
  log "disabled via $DISABLED_FILE"
  exit 0
fi

if [ -f "$COOLDOWN_FILE" ]; then
  age=$(( $(date +%s) - $(stat -c %Y "$COOLDOWN_FILE" 2>/dev/null || echo 0) ))
  if [ "$age" -lt "$COOLDOWN_S" ]; then
    log "cooldown ${age}s/${COOLDOWN_S}s — skip"
    exit 0
  fi
fi

backend_ok=0
site_ok=0
curl -fsS --max-time 3 "$BACKEND_HEALTH" >/dev/null 2>&1 && backend_ok=1 || true
curl -fsS --max-time 3 "$SITE_HEALTH" >/dev/null 2>&1 && site_ok=1 || true

if [ "$backend_ok" = "1" ] || [ "$site_ok" = "1" ]; then
  # At least one plane answers — leave to autoheal-min / health-watch
  exit 0
fi

pm2_ok=0
if command -v pm2 >/dev/null 2>&1; then
  if pm2 ping >/dev/null 2>&1; then
    pm2_ok=1
  fi
fi

if [ "$pm2_ok" = "1" ]; then
  # PM2 alive but apps dark — restart apps once (still outside Node process)
  log "pm2 alive, both healths dark — restart unicorn-backend + unicorn-site"
  touch "$COOLDOWN_FILE"
  pm2 restart unicorn-backend unicorn-site --update-env >/dev/null 2>&1 || \
    pm2 startOrReload "$ECOSYSTEM" --only unicorn-backend,unicorn-site --update-env || true
  pm2 save --force >/dev/null 2>&1 || true
  exit 0
fi

# PM2 daemon itself is down
log "pm2 ping failed + both healths dark — resurrect"
touch "$COOLDOWN_FILE"
if command -v pm2 >/dev/null 2>&1; then
  pm2 resurrect >/dev/null 2>&1 || true
  sleep 2
  if ! pm2 ping >/dev/null 2>&1; then
    if [ -f "$ECOSYSTEM" ]; then
      pm2 start "$ECOSYSTEM" --only unicorn-backend,unicorn-site --update-env || true
    fi
  else
    pm2 restart unicorn-backend unicorn-site --update-env >/dev/null 2>&1 || true
  fi
  pm2 save --force >/dev/null 2>&1 || true
else
  log "pm2 binary missing — human/SSH required"
  exit 1
fi

exit 0
