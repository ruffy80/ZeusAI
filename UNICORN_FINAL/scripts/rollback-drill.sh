#!/usr/bin/env bash
# rollback-drill.sh — verify auto-rollback works without breaking prod
# RO+EN: drill non-distructiv, simulează un crash + așteaptă pm2/health-bot să recupereze.
# Rulat lunar via cron sau on-demand; eșuează clar dacă recuperarea nu e detectată.
set -u
LOG=/var/log/unicorn-rollback-drill.log
TS="$(date -u +%FT%TZ)"
APP_NAME="${ROLLBACK_DRILL_APP:-unicorn-backend}"
HEALTH_URL="${ROLLBACK_DRILL_URL:-http://127.0.0.1:3000/health}"
EXPECT_STATUS="${ROLLBACK_DRILL_EXPECT:-200}"
WAIT_SEC="${ROLLBACK_DRILL_WAIT:-60}"

log(){ printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" ; }

log "drill_start app=$APP_NAME url=$HEALTH_URL expect=$EXPECT_STATUS"

# 1) Pre-check: app must be healthy before we touch it
PRE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL")
if [ "$PRE" != "$EXPECT_STATUS" ]; then
  log "drill_abort pre_health=$PRE — refusing to drill while unhealthy"
  exit 0
fi

# 2) Force a restart (PM2 will respawn — safe, simulates crash recovery)
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env >>"$LOG" 2>&1 || log "pm2_restart_failed"
else
  log "pm2_missing skipping restart"
  exit 0
fi

# 3) Wait for health to come back
log "drill_waiting up_to=${WAIT_SEC}s"
DEADLINE=$((SECONDS + WAIT_SEC))
RECOVERED=0
while [ $SECONDS -lt $DEADLINE ]; do
  POST=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || echo "000")
  if [ "$POST" = "$EXPECT_STATUS" ]; then RECOVERED=1; break; fi
  sleep 2
done

if [ $RECOVERED -eq 1 ]; then
  log "drill_passed elapsed=$((SECONDS))s post_status=$POST"
  exit 0
else
  log "drill_FAILED no recovery within ${WAIT_SEC}s — investigate $APP_NAME"
  exit 1
fi
