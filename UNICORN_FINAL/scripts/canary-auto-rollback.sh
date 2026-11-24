#!/usr/bin/env bash
# =====================================================================
# ZeusAI / Unicorn — Canary Auto-Rollback Watchdog (< 5s recovery)
# Probes live backend/site health & AOSO homeostasisScore.
# If 3 consecutive probes fail (and not --dry-run), atomically swaps
# /var/www/unicorn/current to the previous known-good release & reloads PM2.
# =====================================================================
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

RELEASES_DIR="${UNICORN_RELEASES_DIR:-/var/www/unicorn/releases}"
CURRENT_LINK="${UNICORN_CURRENT_LINK:-/var/www/unicorn/current}"
HEALTH_URL="${UNICORN_HEALTH_URL:-http://127.0.0.1:3000/api/organism/status}"
SITE_HEALTH_URL="${UNICORN_SITE_HEALTH_URL:-http://127.0.0.1:3001/health}"
MIN_SCORE="${UNICORN_MIN_HOMEOSTASIS:-70}"
LOG_FILE="${UNICORN_ROLLBACK_LOG:-/var/log/unicorn-canary-rollback.log}"

log() {
  local msg="[canary-rollback $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
  echo "$msg"
  if [ "$DRY_RUN" -eq 0 ] && [ -w "$(dirname "$LOG_FILE")" ]; then
    echo "$msg" >> "$LOG_FILE" || true
  fi
}

probe_once() {
  local site_code
  site_code="$(curl -sS --max-time 4 -o /dev/null -w '%{http_code}' "$SITE_HEALTH_URL" 2>/dev/null || echo 000)"
  if [ "$site_code" != "200" ]; then
    return 1
  fi
  local org_json
  org_json="$(curl -sS --max-time 4 "$HEALTH_URL" 2>/dev/null || echo '')"
  if [ -z "$org_json" ]; then
    return 1
  fi
  local score
  score="$(printf '%s' "$org_json" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(Number(d.homeostasisScore||0));" 2>/dev/null || echo 0)"
  if [ "$score" -lt "$MIN_SCORE" ]; then
    return 1
  fi
  return 0
}

if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY-RUN OK: watchdog armed (min_homeostasis=${MIN_SCORE}, releases=${RELEASES_DIR})"
  exit 0
fi

FAILS=0
for i in 1 2 3; do
  if probe_once; then
    log "HEALTHY (probe $i/3 passed, homeostasis >= ${MIN_SCORE})"
    exit 0
  fi
  FAILS=$((FAILS + 1))
  log "WARN: probe $i/3 failed"
  sleep 2
done

if [ "$FAILS" -ge 3 ]; then
  if [ ! -d "$RELEASES_DIR" ] || [ ! -L "$CURRENT_LINK" ]; then
    log "ABORT rollback: releases dir or current symlink missing"
    exit 1
  fi
  CURR_TARGET="$(readlink -f "$CURRENT_LINK")"
  PREV_RELEASE="$(ls -1dt "$RELEASES_DIR"/* 2>/dev/null | grep -vF "$CURR_TARGET" | head -n 1 || true)"
  if [ -z "$PREV_RELEASE" ] || [ ! -d "$PREV_RELEASE" ]; then
    log "ABORT rollback: no previous release directory found"
    exit 1
  fi
  log "EXECUTING CANARY ROLLBACK: ${CURR_TARGET} -> ${PREV_RELEASE}"
  ln -sfn "$PREV_RELEASE" "${CURRENT_LINK}.next"
  mv -Tf "${CURRENT_LINK}.next" "$CURRENT_LINK"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 reload unicorn-backend --update-env || true
    pm2 reload unicorn-site --update-env || true
  fi
  log "CANARY ROLLBACK COMPLETE -> ${PREV_RELEASE}"
fi
