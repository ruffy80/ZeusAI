#!/usr/bin/env bash
# zeus-poller-resuscitate.sh — ONE-SHOT server-console recovery.
# ---------------------------------------------------------------------------
# Run this on the Hetzner box (as root) when GitHub Actions is billing-locked
# AND the on-server auto-deploy poller is stuck, so `origin/main` never goes
# live. It is idempotent and safe to re-run.
#
# What it does, in order:
#   1. Clears the kill-switch  (rm -f /etc/zeus-autodeploy.disabled)
#   2. Clears any deploy-sentinel quarantine entries
#   3. Builds a CLEAN release of origin/main from PUBLIC GitHub HTTPS and
#      promotes it via the canary+smoke-gated deploy-atomic-forward.sh.
#      Allows divergent REUNITE (live SSH tip vs main) but NEVER a true
#      downgrade (candidate ancestor of live) — see upgrade-only-guard.sh.
#   4. Re-installs + enables the zeus-autodeploy.timer (via the freshly
#      deployed release's install-autodeploy.sh) so future merges auto-deploy.
#   5. Optionally installs an SSH public key into root authorized_keys so a
#      Cursor Cloud agent can SSH-deploy directly next time.
#
# Env / args:
#   ZEUS_DEPLOY_REF        ref to deploy            (default: origin/main)
#   ZEUS_INSTALL_PUBKEY    an ssh pubkey string to authorize (optional)
#   ZEUS_INSTALL_PUBKEY_URL raw URL to fetch a pubkey from    (optional)
#   ZEUS_REPO_URL          repo                     (default: ruffy80/ZeusAI)
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=lib/upgrade-only-guard.sh
. "$SCRIPT_DIR/lib/upgrade-only-guard.sh"

REF="${ZEUS_DEPLOY_REF:-origin/main}"
REPO_URL="${ZEUS_REPO_URL:-https://github.com/ruffy80/ZeusAI.git}"
MIRROR_DIR="${ZEUS_MIRROR_DIR:-/opt/zeus-autodeploy/repo}"
DEPLOY_LINK="${ZEUS_DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
RELEASE_ROOT="${ZEUS_RELEASE_ROOT:-/var/www/unicorn/releases}"
PUBLIC_URL="${ZEUS_PUBLIC_URL:-https://zeusai.pro}"
DISABLE_FLAG="${ZEUS_AUTODEPLOY_DISABLE_FLAG:-/etc/zeus-autodeploy.disabled}"
QUARANTINE_FILE="${ZEUS_QUARANTINE_FILE:-/opt/zeus-autodeploy/quarantine.txt}"
AUTH_KEYS="${HOME:-/root}/.ssh/authorized_keys"

log() { printf '%s [resuscitate] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

# PM2 keys its daemon off $HOME — pin to root's so we drive the live daemon.
export HOME="${HOME:-/root}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"

log "── step 1: clear kill-switch ──"
if [ -f "$DISABLE_FLAG" ]; then rm -f "$DISABLE_FLAG" && log "removed $DISABLE_FLAG"; else log "$DISABLE_FLAG not present (ok)"; fi

log "── step 2: clear quarantine ──"
[ -f "$QUARANTINE_FILE" ] && { : > "$QUARANTINE_FILE"; log "cleared $QUARANTINE_FILE"; } || log "no quarantine file (ok)"

log "── step 3: optional pubkey install ──"
install_key() {
  local key="$1"; [ -n "$key" ] || return 0
  mkdir -p "$(dirname "$AUTH_KEYS")"; chmod 700 "$(dirname "$AUTH_KEYS")"; touch "$AUTH_KEYS"; chmod 600 "$AUTH_KEYS"
  local body; body="$(printf '%s' "$key" | awk '{print $1" "$2}')"
  [ -n "$body" ] || { log "pubkey looks malformed — skipping"; return 0; }
  if grep -F -q "$body" "$AUTH_KEYS" 2>/dev/null; then log "pubkey already authorized"; else
    printf '%s\n' "$key" >> "$AUTH_KEYS"; log "authorized pubkey: $(printf '%s' "$key" | ssh-keygen -lf - 2>/dev/null | awk '{print $2}' || echo added)"
  fi
}
if [ -n "${ZEUS_INSTALL_PUBKEY:-}" ]; then install_key "$ZEUS_INSTALL_PUBKEY"; fi
if [ -n "${ZEUS_INSTALL_PUBKEY_URL:-}" ]; then
  FETCHED="$(curl -fsSL --max-time 20 "$ZEUS_INSTALL_PUBKEY_URL" 2>/dev/null | head -1 || true)"
  [ -n "$FETCHED" ] && install_key "$FETCHED" || log "could not fetch pubkey from URL (skipping)"
fi

log "── step 4: build clean release of $REF and canary-deploy ──"
command -v git >/dev/null 2>&1 || { log "git missing — abort"; exit 1; }
if [ ! -d "$MIRROR_DIR/.git" ]; then
  mkdir -p "$(dirname "$MIRROR_DIR")"
  git clone --no-tags "$REPO_URL" "$MIRROR_DIR" || { log "clone failed"; exit 1; }
fi
cd "$MIRROR_DIR" || { log "cannot cd mirror"; exit 1; }
git remote set-url origin "$REPO_URL" 2>/dev/null || true
git fetch --no-tags --prune origin '+refs/heads/*:refs/remotes/origin/*' || { log "fetch failed"; exit 1; }
SHA="$(git rev-parse --verify "${REF}^{commit}" 2>/dev/null || git rev-parse --verify "origin/${REF}^{commit}" 2>/dev/null || true)"
[ -n "$SHA" ] || { log "cannot resolve $REF — abort"; exit 1; }
log "resolved $REF → $SHA"

CUR="$(upgrade_only_live_sha "$DEPLOY_LINK")"
SUBJECT="$(git log -1 --format=%s "$SHA" 2>/dev/null || true)"
export ZEUS_ALLOW_DIVERGENT_REUNITE="${ZEUS_ALLOW_DIVERGENT_REUNITE:-1}"
DECISION="$(upgrade_only_guard "$CUR" "$SHA" "$SUBJECT" || true)"
case "$DECISION" in
  SAME)
    log "upgrade-only: SAME — already live at $SHA; continuing to re-enable poller only"
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

if [ "$DECISION" = "SAME" ]; then
  log "── step 4 skipped (already on tip) — jump to poller enable ──"
else

STAGE="$(mktemp -d /tmp/zeus-resus.XXXXXX)"; trap 'rm -rf "$STAGE"' EXIT
git archive "$SHA" | tar -x -C "$STAGE" || { log "git archive failed"; exit 1; }
( cd "$STAGE" && rm -rf \
    UNICORN_FINAL/data UNICORN_FINAL/db UNICORN_FINAL/logs UNICORN_FINAL/backups \
    UNICORN_FINAL/snapshots UNICORN_FINAL/generated UNICORN_FINAL/public \
    UNICORN_FINAL/.archive UNICORN_FINAL/.unicorn-backups UNICORN_FINAL/node_modules \
    logs backups snapshots .archive node_modules 2>/dev/null || true )
find "$STAGE" -maxdepth 2 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | { grep -v example || true; } | xargs -r rm -f

REL="$RELEASE_ROOT/${SHA}-$(date +%s)"; mkdir -p "$REL"; cp -a "$STAGE/." "$REL/"
CAND="$REL/UNICORN_FINAL"
[ -d "$CAND" ] || { log "candidate missing"; exit 1; }
chmod +x "$CAND/scripts/"*.sh 2>/dev/null || true

log "invoking deploy-atomic-forward.sh (canary+smoke gated)…"
if GITHUB_SHA="$SHA" PUBLIC_URL="$PUBLIC_URL" bash "$CAND/scripts/deploy-atomic-forward.sh" "$CAND" "$DEPLOY_LINK"; then
  log "✅ promoted $SHA live"
else
  log "❌ deploy failed — live symlink unchanged (canary gated). Inspect output above."
  exit 1
fi

fi  # end upgrade deploy (skipped when SAME)

log "── step 5: (re)install + enable the auto-deploy poller ──"
if [ -x "$DEPLOY_LINK/scripts/install-autodeploy.sh" ]; then
  bash "$DEPLOY_LINK/scripts/install-autodeploy.sh" || log "install-autodeploy.sh returned non-zero (non-fatal)"
else
  log "install-autodeploy.sh not found in release — enabling any existing timer"
fi
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload 2>/dev/null || true
  systemctl enable --now zeus-autodeploy.timer 2>/dev/null || true
  log "zeus-autodeploy.timer status:"; systemctl is-enabled zeus-autodeploy.timer 2>/dev/null || true
  systemctl status zeus-autodeploy.timer --no-pager -l 2>&1 | head -5 || true
fi

log "── DONE ── live SHA now: $SHA"
echo "$SHA"
