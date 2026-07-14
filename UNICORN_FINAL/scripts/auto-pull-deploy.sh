#!/usr/bin/env bash
# auto-pull-deploy.sh
# ---------------------------------------------------------------------------
# Billing-independent, forward-only self-deploy for the ZeusAI / Unicorn box.
#
# WHY: production deploy normally runs from GitHub Actions. When the GitHub
# account is billing-locked (jobs refuse to start) or Actions is otherwise
# unavailable, main can advance but the live server never updates. This poller
# closes that gap: it runs on the server itself (systemd timer), checks
# origin/main over plain HTTPS (the repo is public — no token needed), and if a
# NEW, strictly-forward commit is available it builds a clean release and hands
# it to the existing, canary-gated `deploy-atomic-forward.sh`.
#
# SAFETY ENVELOPE (defense in depth):
#   * forward-only        — refuses anything that is not a descendant of the
#                           currently-deployed commit (no downgrade / no divergent)
#   * AutoInnovation gate  — refuses unreviewed [AutoInnovation] commits, mirroring
#                            .github/workflows/deploy.yml
#   * canary + smoke       — deploy-atomic-forward.sh boots a canary on :3100 and
#                            only promotes the symlink after health/QIS/smoke pass
#   * kill-switch          — `touch /etc/zeus-autodeploy.disabled` stops all deploys
#   * single-flight lock   — flock prevents overlapping runs
#
# Idempotent: when live == origin/main it exits 0 without touching anything.
# ---------------------------------------------------------------------------
set -uo pipefail

REPO_URL="${ZEUS_REPO_URL:-https://github.com/ruffy80/ZeusAI.git}"
BRANCH="${ZEUS_DEPLOY_BRANCH:-main}"
MIRROR_DIR="${ZEUS_MIRROR_DIR:-/opt/zeus-autodeploy/repo}"
DEPLOY_LINK="${ZEUS_DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
RELEASE_ROOT="${ZEUS_RELEASE_ROOT:-/var/www/unicorn/releases}"
PUBLIC_URL="${ZEUS_PUBLIC_URL:-https://zeusai.pro}"
LOG_FILE="${ZEUS_AUTODEPLOY_LOG:-/var/log/zeus-autodeploy.log}"
DISABLE_FLAG="${ZEUS_AUTODEPLOY_DISABLE_FLAG:-/etc/zeus-autodeploy.disabled}"
LOCK_FILE="${ZEUS_AUTODEPLOY_LOCK:-/var/run/zeus-autodeploy.lock}"
KEEP_RELEASES="${ZEUS_KEEP_RELEASES:-5}"

log() { printf '%s [auto-pull-deploy] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE" >&2; }

# ── Single-flight lock ──────────────────────────────────────────────────────
exec 9>"$LOCK_FILE" 2>/dev/null || true
if command -v flock >/dev/null 2>&1; then
  flock -n 9 || { log "another run holds the lock — skipping"; exit 0; }
fi

# ── Kill-switch ─────────────────────────────────────────────────────────────
if [ -f "$DISABLE_FLAG" ]; then
  log "disabled via $DISABLE_FLAG — skipping"
  exit 0
fi

command -v git >/dev/null 2>&1 || { log "git not installed — abort"; exit 1; }

# ── Ensure mirror clone exists and is fresh ─────────────────────────────────
if [ ! -d "$MIRROR_DIR/.git" ]; then
  log "cloning mirror → $MIRROR_DIR"
  mkdir -p "$(dirname "$MIRROR_DIR")"
  git clone --no-tags "$REPO_URL" "$MIRROR_DIR" >>"$LOG_FILE" 2>&1 || { log "clone failed"; exit 1; }
fi
cd "$MIRROR_DIR" || { log "cannot cd $MIRROR_DIR"; exit 1; }
git remote set-url origin "$REPO_URL" 2>/dev/null || true
if ! git fetch --no-tags --prune origin "$BRANCH" >>"$LOG_FILE" 2>&1; then
  log "git fetch failed (network?) — will retry next tick"
  exit 0
fi

NEW="$(git rev-parse "origin/${BRANCH}" 2>/dev/null || true)"
[ -n "$NEW" ] || { log "cannot resolve origin/${BRANCH}"; exit 1; }

CUR="$(cat "$DEPLOY_LINK/.deployed-commit" 2>/dev/null | head -c 64 | tr -d '[:space:]' || true)"

if [ "$NEW" = "$CUR" ]; then
  log "up-to-date (live=$NEW) — nothing to deploy"
  exit 0
fi

log "candidate NEW=$NEW  current live=${CUR:-none}"

# ── Quarantine guard: skip a SHA the deploy-sentinel rolled back as unhealthy ─
# Prevents an auto-forward-deploy vs auto-rollback fight; a newer commit that is
# not quarantined supersedes it normally.
QUARANTINE_FILE="${ZEUS_QUARANTINE_FILE:-/opt/zeus-autodeploy/quarantine.txt}"
if [ -f "$QUARANTINE_FILE" ] && grep -qxF "$NEW" "$QUARANTINE_FILE" 2>/dev/null; then
  log "candidate $NEW is quarantined (rolled back as unhealthy) — skipping"
  exit 0
fi

# ── Forward-only guard: NEW must be a descendant of the live commit ─────────
if [ -n "$CUR" ] && git cat-file -e "${CUR}^{commit}" 2>/dev/null; then
  if ! git merge-base --is-ancestor "$CUR" "$NEW"; then
    log "REFUSED: $NEW is not a descendant of live $CUR (downgrade/divergent) — no deploy"
    exit 1
  fi
fi

# ── AutoInnovation approval gate (mirrors deploy.yml) ───────────────────────
APPROVED_FILE="$MIRROR_DIR/.github/baselines/innovation-approved-shas.txt"
is_approved_sha() {
  local sha_lc; sha_lc="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [ -f "$APPROVED_FILE" ] || return 1
  grep -Eiq "^${sha_lc}([[:space:]]*(#.*)?)?$" "$APPROVED_FILE"
}
if [ -n "$CUR" ] && git cat-file -e "${CUR}^{commit}" 2>/dev/null; then
  RANGE="${CUR}..${NEW}"
else
  RANGE="$NEW"
fi
UNAPPROVED=""
while IFS= read -r SHA; do
  [ -z "$SHA" ] && continue
  SUBJECT="$(git log -1 --format=%s "$SHA" 2>/dev/null)"
  BODY="$(git log -1 --format=%B "$SHA" 2>/dev/null)"
  case "$SUBJECT" in
    *\[AutoInnovation\]*)
      if printf '%s' "$BODY" | grep -qiF '[innovation-approved]'; then :;
      elif is_approved_sha "$SHA"; then :;
      else UNAPPROVED="${UNAPPROVED}${SHA} ${SUBJECT}"$'\n'; fi
      ;;
  esac
done < <(git rev-list "$RANGE" 2>/dev/null || true)
if [ -n "$UNAPPROVED" ]; then
  log "REFUSED: unreviewed [AutoInnovation] commit(s) in range — no deploy:"
  printf '%s' "$UNAPPROVED" | while IFS= read -r L; do [ -n "$L" ] && log "  $L"; done
  exit 1
fi

# ── Build a clean, pruned release tree from the exact NEW commit ────────────
STAGE="$(mktemp -d /tmp/zeus-autodeploy.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
log "export clean tree for $NEW"
git archive "$NEW" | tar -x -C "$STAGE" || { log "git archive failed"; exit 1; }

# Mirror deploy.yml rsync excludes: live mutable state lives in the shared root
# and is symlinked in by deploy-atomic-forward.sh — never ship snapshots of it.
( cd "$STAGE" && rm -rf \
    UNICORN_FINAL/data UNICORN_FINAL/db UNICORN_FINAL/logs UNICORN_FINAL/backups \
    UNICORN_FINAL/snapshots UNICORN_FINAL/generated UNICORN_FINAL/public \
    UNICORN_FINAL/.archive UNICORN_FINAL/.unicorn-backups UNICORN_FINAL/node_modules \
    logs backups snapshots .archive node_modules 2>/dev/null || true )
find "$STAGE" -maxdepth 2 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | grep -v example | xargs -r rm -f

RELEASE_PATH="$RELEASE_ROOT/${NEW}-$(date +%s)"
mkdir -p "$RELEASE_PATH"
cp -a "$STAGE/." "$RELEASE_PATH/"

CANDIDATE="$RELEASE_PATH/UNICORN_FINAL"
[ -d "$CANDIDATE" ] || { log "candidate missing: $CANDIDATE"; exit 1; }
chmod +x "$CANDIDATE/scripts/"*.sh 2>/dev/null || true

# ── Hand off to the canary-gated atomic deployer ────────────────────────────
log "invoking deploy-atomic-forward.sh for $NEW"
if GITHUB_SHA="$NEW" PUBLIC_URL="$PUBLIC_URL" bash "$CANDIDATE/scripts/deploy-atomic-forward.sh" "$CANDIDATE" "$DEPLOY_LINK" >>"$LOG_FILE" 2>&1; then
  log "✅ deployed $NEW live"
else
  log "❌ deploy-atomic-forward.sh failed for $NEW (live symlink unchanged if canary failed)"
  exit 1
fi

# ── Best-effort prune of old release dirs (keep newest N + live target) ─────
CURRENT_TARGET="$(readlink -f "$DEPLOY_LINK" 2>/dev/null || true)"
if [ -d "$RELEASE_ROOT" ]; then
  ( cd "$RELEASE_ROOT" && ls -1dt */ 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | while read -r d; do
      full="$RELEASE_ROOT/${d%/}"
      [ "$full" = "$CURRENT_TARGET" ] && continue
      rm -rf -- "$full" 2>/dev/null || true
    done )
fi

log "run complete"
