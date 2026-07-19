#!/usr/bin/env bash
# zeus-deploy-sentinel.sh
# ---------------------------------------------------------------------------
# Post-deploy health sentinel with known-good tracking.
#
# WHY: deploy-atomic-forward.sh canaries a release BEFORE promoting the live
# symlink, which catches boot-time failures. But a release can still regress
# AFTER promotion. Healers (autoheal-min, module-mesh-guardian) RESTART the
# current release. This sentinel remembers the last release that stayed healthy
# and, on sustained unhealth, quarantines the bad SHA so auto-pull will not
# keep redeploying it.
#
# UPGRADE-ONLY CONTRACT (2026-07):
#   This sentinel NEVER rolls the live symlink backwards. Downgrades are
#   forbidden forever. Recovery is always a forward-fix commit on main
#   (optionally with [force-deploy]) promoted through canary+smoke.
#
# SAFETY:
#   * MODE=monitor (default) only LOGS — zero action.
#   * MODE=act quarantines the bad SHA and leaves healers to restart in place.
#     It does NOT move the live symlink to an older release.
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
BAD_SHA="$(printf '%s' "$CURRENT" | grep -oE '/releases/[0-9a-f]{40}-' | head -1 | grep -oE '[0-9a-f]{40}' || true)"

if [ "$MODE" != "act" ]; then
  log "[monitor] sustained unhealthy — WOULD quarantine SHA=${BAD_SHA:-unknown} (last-good=${GOOD:-none}). NEVER rollback symlink (upgrade-only). Set ZEUS_SENTINEL_MODE=act to quarantine."
  exit 0
fi

# ── ACT: quarantine bad SHA only — NEVER move live symlink backwards ────────
if [ -n "$BAD_SHA" ]; then
  touch "$QUARANTINE_FILE"
  if ! grep -qxF "$BAD_SHA" "$QUARANTINE_FILE" 2>/dev/null; then
    printf '%s\n' "$BAD_SHA" >> "$QUARANTINE_FILE"
    log "quarantined bad SHA $BAD_SHA (upgrade-only: no symlink rollback)"
  else
    log "bad SHA $BAD_SHA already quarantined"
  fi
else
  log "could not derive bad SHA from $CURRENT — leaving to in-process healers"
fi

log "UPGRADE-ONLY: refusing symlink rollback (would be a downgrade). Heal in place; ship a forward-fix on main."
echo 0 > "$FAILS_FILE"
exit 0
