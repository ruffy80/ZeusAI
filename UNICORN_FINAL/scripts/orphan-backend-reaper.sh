#!/usr/bin/env bash
# orphan-backend-reaper.sh — kill orphaned `node backend/index.js` (PPID=1)
# ---------------------------------------------------------------------------
# Suicide-loop root cause: bare `node backend/index.js` left with PPID=1 after
# crashed wrappers / manual starts. Those orphans historically ran auto-restart
# and `pm2 restart unicorn-backend` in a thrash loop.
#
# Safe rules:
#   - Only targets processes whose cmdline contains "backend/index.js"
#   - Skips PIDs managed by PM2 (parent is PM2 / god daemon)
#   - Only kills when PPID is 1 (or 0) OR parent cmdline is not pm2
#   - Never touches unicorn-site
#   - Dry-run unless ORPHAN_REAPER_APPLY=1
#
# Usage:
#   bash scripts/orphan-backend-reaper.sh           # report only
#   ORPHAN_REAPER_APPLY=1 bash scripts/orphan-backend-reaper.sh
# ---------------------------------------------------------------------------
set -euo pipefail

APPLY="${ORPHAN_REAPER_APPLY:-0}"
killed=0
found=0

log() { printf '[orphan-reaper] %s\n' "$*"; }

is_pm2_related() {
  local pid="$1"
  local ppid cmdline pcmdline
  ppid="$(awk '{print $4}' "/proc/$pid/stat" 2>/dev/null || echo "")"
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  # PM2 god / resurrected workers usually have pm2 in parent cmdline
  if [ -n "$ppid" ] && [ -r "/proc/$ppid/cmdline" ]; then
    pcmdline="$(tr '\0' ' ' < "/proc/$ppid/cmdline" 2>/dev/null || true)"
    case "$pcmdline" in
      *pm2*|*PM2*|*God\ Daemon*) return 0 ;;
    esac
  fi
  case "$cmdline" in
    *pm2*) return 0 ;;
  esac
  return 1
}

for pid in $(pgrep -f 'node .*backend/index\.js' 2>/dev/null || true); do
  [ -d "/proc/$pid" ] || continue
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  case "$cmdline" in
    *backend/index.js*) ;;
    *) continue ;;
  esac
  ppid="$(awk '{print $4}' "/proc/$pid/stat" 2>/dev/null || echo "?")"
  found=$((found + 1))

  if is_pm2_related "$pid"; then
    log "keep pid=$pid ppid=$ppid (pm2-related) :: $cmdline"
    continue
  fi

  if [ "$ppid" != "1" ] && [ "$ppid" != "0" ]; then
    log "keep pid=$pid ppid=$ppid (has parent) :: $cmdline"
    continue
  fi

  log "ORPHAN pid=$pid ppid=$ppid :: $cmdline"
  if [ "$APPLY" = "1" ]; then
    kill -TERM "$pid" 2>/dev/null || true
    sleep 1
    if [ -d "/proc/$pid" ]; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
    killed=$((killed + 1))
    log "reaped pid=$pid"
  else
    log "dry-run — set ORPHAN_REAPER_APPLY=1 to kill"
  fi
done

log "scanned found=$found killed=$killed apply=$APPLY"
exit 0
