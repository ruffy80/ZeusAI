#!/usr/bin/env bash
# zeus-deploy-sentinel.sh
# ---------------------------------------------------------------------------
# Post-deploy health sentinel with known-good tracking + auto-rollback.
#
# WHY: deploy-atomic-forward.sh canaries a release BEFORE promoting the live
# symlink, which catches boot-time failures. But a release can still regress
# AFTER promotion (memory leak, a route that only fails under real traffic, a
# dependency that dies minutes later). The existing healers (autoheal-min,
# module-mesh-guardian) RESTART the current release — they never roll BACK to
# the last release that was actually proven healthy. This sentinel closes that
# gap: it remembers the last release that stayed healthy for a sustained
# window and, if the current release becomes sustainedly unhealthy, rolls the
# live symlink back to that known-good release.
#
# SAFETY:
#   * MODE=monitor (default) only LOGS what it would do — zero action, safe to
#     run on production from day one. Set ZEUS_SENTINEL_MODE=act to enable
#     actual rollback.
#   * On rollback (act mode) it QUARANTINES the bad SHA (writes it to
#     $QUARANTINE_FILE) so auto-pull-deploy.sh will NOT immediately redeploy the
#     same broken commit — preventing a rollback/redeploy fight.
#   * single-flight flock; never touches .env/data/db (those live in shared/).
# ---------------------------------------------------------------------------
set -uo pipefail

DEPLOY_LINK="${ZEUS_DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
STATE_DIR="${ZEUS_STATE_DIR:-/opt/zeus-autodeploy}"
GOOD_FILE="${ZEUS_GOOD_FILE:-$STATE_DIR/last-good-release}"
FAILS_FILE="${ZEUS_FAILS_FILE:-$STATE_DIR/sentinel-fails}"
STREAK_FILE="${ZEUS_STREAK_FILE:-$STATE_DIR/sentinel-good-streak}"
QUARANTINE_FILE="${ZEUS_QUARANTINE_FILE:-$STATE_DIR/quarantine.txt}"
LOG_FILE="${ZEUS_SENTINEL_LOG:-/var/log/zeus-deploy-sentinel.log}"
LOCK_FILE="${ZEUS_SENTINEL_LOCK:-/var/run/zeus-deploy-sentinel.lock}"
MODE="${ZEUS_SENTINEL_MODE:-monitor}"           # monitor | act
LOCAL_HEALTH="${ZEUS_LOCAL_HEALTH:-http://127.0.0.1:3000/health}"
SITE_HEALTH="${ZEUS_SITE_HEALTH:-http://127.0.0.1:3001/health}"
FAIL_THRESHOLD="${ZEUS_SENTINEL_FAIL_THRESHOLD:-3}"
STABLE_RUNS="${ZEUS_SENTINEL_STABLE_RUNS:-3}"

log() { printf '%s [deploy-sentinel] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE" >&2; }

mkdir -p "$STATE_DIR" 2>/dev/null || true
exec 9>"$LOCK_FILE" 2>/dev/null || true
if command -v flock >/dev/null 2>&1; then
  flock -n 9 || { log "another run holds the lock — skipping"; exit 0; }
fi

CURRENT="$(readlink -f "$DEPLOY_LINK" 2>/dev/null || true)"
[ -n "$CURRENT" ] || { log "cannot resolve $DEPLOY_LINK"; exit 1; }

read_int() { local v; v="$(cat "$1" 2>/dev/null || echo 0)"; case "$v" in ''|*[!0-9]*) echo 0;; *) echo "$v";; esac; }

# ── Health probe: both backend (:3000) and site (:3001) must be ok ──────────
healthy() {
  curl -fsS --max-time 8 "$LOCAL_HEALTH" 2>/dev/null | grep -q '"status":"ok"' || return 1
  curl -fsS --max-time 8 "$SITE_HEALTH"  2>/dev/null | grep -q '"ok":true'     || return 1
  return 0
}

if healthy; then
  echo 0 > "$FAILS_FILE"
  STREAK=$(( $(read_int "$STREAK_FILE") + 1 ))
  echo "$STREAK" > "$STREAK_FILE"
  RECORDED="$(cat "$GOOD_FILE" 2>/dev/null || true)"
  if [ "$STREAK" -ge "$STABLE_RUNS" ] && [ "$RECORDED" != "$CURRENT" ]; then
    printf '%s\n' "$CURRENT" > "$GOOD_FILE"
    log "marked known-good after ${STREAK} healthy checks: $CURRENT"
  fi
  exit 0
fi

# ── Unhealthy path ──────────────────────────────────────────────────────────
echo 0 > "$STREAK_FILE"
FAILS=$(( $(read_int "$FAILS_FILE") + 1 ))
echo "$FAILS" > "$FAILS_FILE"
log "UNHEALTHY check ${FAILS}/${FAIL_THRESHOLD} (current=$CURRENT)"
[ "$FAILS" -ge "$FAIL_THRESHOLD" ] || exit 0

GOOD="$(cat "$GOOD_FILE" 2>/dev/null || true)"
if [ -z "$GOOD" ] || [ ! -d "$GOOD" ] || [ "$GOOD" = "$CURRENT" ]; then
  log "sustained unhealthy but no distinct known-good release to roll back to (good='${GOOD:-none}') — leaving to in-process healers"
  exit 0
fi

# Derive the bad SHA (release dir is …/releases/<sha>-<ts>/UNICORN_FINAL) to quarantine it.
BAD_SHA="$(printf '%s' "$CURRENT" | grep -oE '/releases/[0-9a-f]{40}-' | head -1 | grep -oE '[0-9a-f]{40}' || true)"

if [ "$MODE" != "act" ]; then
  log "[monitor] WOULD roll back: $CURRENT -> $GOOD (quarantine SHA=${BAD_SHA:-unknown}). Set ZEUS_SENTINEL_MODE=act to enable."
  exit 0
fi

# ── ACT: atomic rollback to known-good + quarantine bad SHA ─────────────────
[ -n "$BAD_SHA" ] && { touch "$QUARANTINE_FILE"; grep -qxF "$BAD_SHA" "$QUARANTINE_FILE" 2>/dev/null || printf '%s\n' "$BAD_SHA" >> "$QUARANTINE_FILE"; log "quarantined bad SHA $BAD_SHA"; }

DEPLOY_PARENT="$(dirname "$DEPLOY_LINK")"
TMP_LINK="${DEPLOY_LINK}.rollback.$$"
ln -sfn "$GOOD" "$TMP_LINK"
mv -Tf "$TMP_LINK" "$DEPLOY_LINK"
ln -sfn "$GOOD" "$DEPLOY_PARENT/current" 2>/dev/null || true
log "ROLLED BACK live symlink -> $GOOD; restarting PM2"

export HOME="${HOME:-/root}" PM2_HOME="${PM2_HOME:-/root/.pm2}"
( cd "$DEPLOY_LINK" && env NODE_ENV=production BIND_HOST=127.0.0.1 UNICORN_RUNTIME_PROFILE=safe \
    pm2 startOrReload ecosystem.config.js --only unicorn-backend,unicorn-site --update-env >>"$LOG_FILE" 2>&1 ) || \
  ( cd "$DEPLOY_LINK" && pm2 restart unicorn-backend unicorn-site --update-env >>"$LOG_FILE" 2>&1 ) || true
pm2 save --force >>"$LOG_FILE" 2>&1 || true
echo 0 > "$FAILS_FILE"

sleep 12
if healthy; then
  log "✅ rollback healthy — live restored on known-good release"
else
  log "⚠️ still unhealthy after rollback — escalating to in-process healers"
fi
