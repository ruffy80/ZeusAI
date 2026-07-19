#!/usr/bin/env bash
# oob-deploy-runner.sh — worker for the Out-of-Band deploy channel.
# ---------------------------------------------------------------------------
# Builds a clean release of an exact git ref pulled over PUBLIC GitHub HTTPS
# (no token, no Actions) and hands it to the canary-gated, atomic
# `deploy-atomic-forward.sh`. Invoked (detached) by backend/modules/oob-deploy.js
# after it has verified the signed request. Can also be run by hand on the box.
#
# Upgrade-only: true downgrades (candidate ancestor of live) are ALWAYS refused.
# Divergent reunite (live SSH tip vs main) is allowed here with
# ZEUS_ALLOW_DIVERGENT_REUNITE=1 (set by default for OOB recovery). Canary+smoke
# in deploy-atomic-forward.sh still gates the promote.
#
# Usage:  oob-deploy-runner.sh [git-ref]     # default: origin/main
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=lib/upgrade-only-guard.sh
. "$SCRIPT_DIR/lib/upgrade-only-guard.sh"

REF_RAW="${1:-origin/main}"
# Re-validate the ref here too (defence in depth; the caller already checked).
if ! printf '%s' "$REF_RAW" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$' || printf '%s' "$REF_RAW" | grep -q '\.\.'; then
  echo "[oob-deploy] REFUSED: invalid ref '$REF_RAW'" >&2
  exit 2
fi
REF="$REF_RAW"

REPO_URL="${ZEUS_REPO_URL:-https://github.com/ruffy80/ZeusAI.git}"
MIRROR_DIR="${ZEUS_MIRROR_DIR:-/opt/zeus-autodeploy/repo}"
DEPLOY_LINK="${ZEUS_DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
RELEASE_ROOT="${ZEUS_RELEASE_ROOT:-/var/www/unicorn/releases}"
PUBLIC_URL="${ZEUS_PUBLIC_URL:-https://zeusai.pro}"
LOG_FILE="${OOB_DEPLOY_LOG:-/var/log/zeus-oob-deploy.log}"
LOCK_FILE="${ZEUS_OOB_LOCK:-/var/run/zeus-oob-deploy.lock}"

log() { printf '%s [oob-deploy] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE" >&2; }

log "start ref=$REF id=${OOB_DEPLOY_ID:-manual}"

# Single-flight lock so overlapping triggers can't race the promote. If the
# lock file cannot be opened (e.g. non-root, no /var/run), proceed WITHOUT the
# lock rather than falsely treating it as held.
LOCK_OK=0
if exec 9>"$LOCK_FILE" 2>/dev/null; then
  LOCK_OK=1
else
  log "warn: cannot open lock $LOCK_FILE — proceeding without single-flight lock"
fi
if [ "$LOCK_OK" = "1" ] && command -v flock >/dev/null 2>&1; then
  flock -n 9 || { log "another OOB deploy holds the lock — abort"; exit 0; }
fi

command -v git >/dev/null 2>&1 || { log "git not installed — abort"; exit 1; }

# Ensure the public mirror clone exists and is fresh.
if [ ! -d "$MIRROR_DIR/.git" ]; then
  log "cloning mirror → $MIRROR_DIR"
  mkdir -p "$(dirname "$MIRROR_DIR")"
  git clone --no-tags "$REPO_URL" "$MIRROR_DIR" >>"$LOG_FILE" 2>&1 || { log "clone failed"; exit 1; }
fi
cd "$MIRROR_DIR" || { log "cannot cd $MIRROR_DIR"; exit 1; }
git remote set-url origin "$REPO_URL" 2>/dev/null || true
# Fetch everything so both branch names and raw SHAs resolve.
git fetch --no-tags --prune origin '+refs/heads/*:refs/remotes/origin/*' >>"$LOG_FILE" 2>&1 \
  || { log "git fetch failed (network?) — abort"; exit 1; }

# Resolve the ref to a concrete commit SHA.
SHA="$(git rev-parse --verify "${REF}^{commit}" 2>/dev/null || git rev-parse --verify "origin/${REF}^{commit}" 2>/dev/null || true)"
[ -n "$SHA" ] || { log "cannot resolve ref '$REF' to a commit — abort"; exit 1; }
log "resolved $REF → $SHA"

# Upgrade-only: never walk the live symlink backwards.
CUR="$(upgrade_only_live_sha "$DEPLOY_LINK")"
SUBJECT="$(git log -1 --format=%s "$SHA" 2>/dev/null || true)"
# OOB exists to reunite divergent boxes; still NEVER allow true downgrade.
export ZEUS_ALLOW_DIVERGENT_REUNITE="${ZEUS_ALLOW_DIVERGENT_REUNITE:-1}"
DECISION="$(upgrade_only_guard "$CUR" "$SHA" "$SUBJECT" || true)"
case "$DECISION" in
  SAME)
    log "upgrade-only: SAME — already live at $SHA — nothing to do"
    exit 0
    ;;
  UPGRADE|COLD|REUNITE)
    log "upgrade-only: $DECISION (live=${CUR:-none} → $SHA)"
    ;;
  DOWNGRADE)
    log "REFUSED: DOWNGRADE blocked forever (candidate $SHA is ancestor of live $CUR)"
    exit 1
    ;;
  *)
    log "REFUSED: non-upgrade live=${CUR:-none} → $SHA"
    exit 1
    ;;
esac

# Export a clean tree (never a dirty/self-mutated working copy).
STAGE="$(mktemp -d /tmp/zeus-oob.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
git archive "$SHA" | tar -x -C "$STAGE" || { log "git archive failed"; exit 1; }

# Prune live mutable state — deploy-atomic-forward.sh symlinks it from shared.
( cd "$STAGE" && rm -rf \
    UNICORN_FINAL/data UNICORN_FINAL/db UNICORN_FINAL/logs UNICORN_FINAL/backups \
    UNICORN_FINAL/snapshots UNICORN_FINAL/generated UNICORN_FINAL/public \
    UNICORN_FINAL/.archive UNICORN_FINAL/.unicorn-backups UNICORN_FINAL/node_modules \
    logs backups snapshots .archive node_modules 2>/dev/null || true )
find "$STAGE" -maxdepth 2 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | { grep -v example || true; } | xargs -r rm -f

RELEASE_PATH="$RELEASE_ROOT/${SHA}-$(date +%s)"
mkdir -p "$RELEASE_PATH"
cp -a "$STAGE/." "$RELEASE_PATH/"

CANDIDATE="$RELEASE_PATH/UNICORN_FINAL"
[ -d "$CANDIDATE" ] || { log "candidate missing: $CANDIDATE"; exit 1; }
chmod +x "$CANDIDATE/scripts/"*.sh 2>/dev/null || true

log "invoking deploy-atomic-forward.sh (canary+smoke gated) for $SHA"
if GITHUB_SHA="$SHA" PUBLIC_URL="$PUBLIC_URL" bash "$CANDIDATE/scripts/deploy-atomic-forward.sh" "$CANDIDATE" "$DEPLOY_LINK" >>"$LOG_FILE" 2>&1; then
  log "✅ OOB deploy promoted $SHA live"
else
  rc=$?
  log "❌ deploy-atomic-forward.sh failed (rc=$rc) — live symlink unchanged (canary gated)"
  exit "$rc"
fi
log "run complete"
