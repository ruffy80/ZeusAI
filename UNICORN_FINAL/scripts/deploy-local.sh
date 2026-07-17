#!/usr/bin/env bash
# deploy-local.sh — SAFE manual deploy to Hetzner WITHOUT GitHub Actions.
# ---------------------------------------------------------------------------
# Ships a clean release of a git ref straight to the live server and runs the
# canary-gated, atomic deploy-atomic-forward.sh — exactly what GitHub Actions
# and the on-server poller do. Use this when GitHub is unavailable.
#
# IMPORTANT — the live app runs on **PM2 + nginx** from /var/www/unicorn (release
# symlink). It is NOT docker-compose. Docker on the box only runs sidecars
# (redis/postgres/netdata bound to 127.0.0.1). NEVER `docker-compose down/up`
# the app — it would collide with nginx+PM2 on :80/:443/:3000 and cause an
# outage. This script deliberately avoids docker entirely.
#
# Usage:
#   scripts/deploy-local.sh [git-ref]      # default: origin/main
#   ZEUS_SSH_KEY=~/.ssh/hetzner scripts/deploy-local.sh origin/main
#
# Env: ZEUS_HOST (204.168.230.142), ZEUS_USER (root), ZEUS_SSH_KEY
#      (~/.ssh/deploy_key), ZEUS_PUBLIC_URL (https://zeusai.pro)
# ---------------------------------------------------------------------------
set -euo pipefail

REF="${1:-origin/main}"
HOST="${ZEUS_HOST:-204.168.230.142}"
USER="${ZEUS_USER:-root}"
KEY="${ZEUS_SSH_KEY:-}"
PUBLIC_URL="${ZEUS_PUBLIC_URL:-https://zeusai.pro}"
DEPLOY_LINK="/var/www/unicorn/UNICORN_FINAL"
RELEASE_ROOT="/var/www/unicorn/releases"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # repo root
cd "$ROOT"

# Prefer Cursor Cloud SSH agent, then explicit key files.
if [ -z "${SSH_AUTH_SOCK:-}" ] && [ -S /run/host-services/ssh-auth.sock ]; then
  export SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock
fi
if [ -z "$KEY" ]; then
  for cand in "$HOME/.ssh/deploy_key" "$HOME/.ssh/hetzner_rsa" "$HOME/.ssh/id_ed25519"; do
    [ -f "$cand" ] && KEY="$cand" && break
  done
fi
SSHK=(-o StrictHostKeyChecking=no -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20)
if [ -n "$KEY" ] && [ -f "$KEY" ]; then
  SSHK=(-i "$KEY" "${SSHK[@]}")
elif [ -n "${SSH_AUTH_SOCK:-}" ]; then
  echo "[deploy-local] using SSH agent at $SSH_AUTH_SOCK (no key file)"
else
  echo "SSH key not found and no SSH agent (set ZEUS_SSH_KEY or start agent)"; exit 1
fi

git fetch origin --quiet 2>/dev/null || echo "[deploy-local] warn: git fetch failed (offline?) — using local objects"
SHA="$(git rev-parse "$REF")"
echo "[deploy-local] deploying $REF ($SHA) -> $USER@$HOST"

# Build a clean tree of the exact ref (never the dirty/self-mutated working tree),
# pruned the same way CI prunes so live shared state (.env/data/db) is preserved.
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
git archive "$SHA" | tar -x -C "$STAGE"
( cd "$STAGE" && rm -rf \
    UNICORN_FINAL/data UNICORN_FINAL/db UNICORN_FINAL/logs UNICORN_FINAL/backups \
    UNICORN_FINAL/snapshots UNICORN_FINAL/generated UNICORN_FINAL/public \
    UNICORN_FINAL/.archive UNICORN_FINAL/.unicorn-backups UNICORN_FINAL/node_modules \
    logs backups snapshots .archive node_modules 2>/dev/null || true )
find "$STAGE" -maxdepth 2 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | { grep -v example || true; } | xargs -r rm -f || true

REL="$RELEASE_ROOT/${SHA}-$(date +%s)"
ssh "${SSHK[@]}" "$USER@$HOST" "mkdir -p '$REL'"
tar czf - -C "$STAGE" . | ssh "${SSHK[@]}" "$USER@$HOST" "tar xzf - -C '$REL'"

# Canary-gated atomic promote + PM2 restart. HOME=/root so PM2 targets the live
# daemon (/root/.pm2), not /etc/.pm2.
ssh "${SSHK[@]}" "$USER@$HOST" "export HOME=/root; chmod +x '$REL/UNICORN_FINAL/scripts/'*.sh 2>/dev/null || true; GITHUB_SHA='$SHA' PUBLIC_URL='$PUBLIC_URL' bash '$REL/UNICORN_FINAL/scripts/deploy-atomic-forward.sh' '$REL/UNICORN_FINAL' '$DEPLOY_LINK'"

# Post-deploy health is informational only — the canary + smoke inside
# deploy-atomic-forward.sh already gated the promote, so a flaky external curl
# here must not mark the deploy as failed.
echo -n "[deploy-local] live health: "; curl -sk -o /dev/null -w "https %{http_code}\n" --max-time 20 "$PUBLIC_URL/health" || echo "(post-check curl timed out; deploy already verified by canary+smoke)"
echo "[deploy-local] done — deployed $SHA"
