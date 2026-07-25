#!/usr/bin/env bash
# cloud-agent-finish-deploy.sh
# ---------------------------------------------------------------------------
# Polls for a working SSH path, then runs deploy-local.sh for the current HEAD.
# Use after the owner authorizes the ephemeral key / injects HETZNER_SSH_PRIVATE_KEY.
#
#   bash UNICORN_FINAL/scripts/cloud-agent-finish-deploy.sh [max-minutes]
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")"/../.. && pwd)"
MAX_MIN="${1:-20}"
HOST="${HETZNER_HOST:-204.168.230.142}"
USER="${HETZNER_DEPLOY_USER:-root}"
DEADLINE=$(( $(date +%s) + MAX_MIN * 60 ))

materialize_secret() {
  if [ -n "${HETZNER_SSH_PRIVATE_KEY:-${SSH_PRIVATE_KEY:-}}" ] && [ ! -f "$HOME/.ssh/deploy_key" ]; then
    mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
    printf '%s\n' "${HETZNER_SSH_PRIVATE_KEY:-$SSH_PRIVATE_KEY}" > "$HOME/.ssh/deploy_key"
    chmod 600 "$HOME/.ssh/deploy_key"
    echo "[finish-deploy] materialized ~/.ssh/deploy_key from runtime secret"
  fi
}

probe() {
  materialize_secret
  if [ -f "$HOME/.ssh/zeus_ephemeral" ]; then
    if ssh -i "$HOME/.ssh/zeus_ephemeral" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=8 \
         -o StrictHostKeyChecking=accept-new "${USER}@${HOST}" 'echo ok' >/dev/null 2>&1; then
      export ZEUS_SSH_KEY="$HOME/.ssh/zeus_ephemeral"
      return 0
    fi
  fi
  if [ -f "$HOME/.ssh/deploy_key" ]; then
    if ssh -i "$HOME/.ssh/deploy_key" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=8 \
         -o StrictHostKeyChecking=accept-new "${USER}@${HOST}" 'echo ok' >/dev/null 2>&1; then
      export ZEUS_SSH_KEY="$HOME/.ssh/deploy_key"
      return 0
    fi
  fi
  return 1
}

echo "[finish-deploy] waiting up to ${MAX_MIN}m for SSH to ${USER}@${HOST}…"
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  if probe; then
    echo "[finish-deploy] SSH ready via ${ZEUS_SSH_KEY:-agent}"
    cd "$ROOT"
    ZEUS_SSH_KEY="${ZEUS_SSH_KEY:-}" bash UNICORN_FINAL/scripts/deploy-local.sh HEAD
    exit $?
  fi
  sleep 20
done

echo "[finish-deploy] timed out — owner action still required:"
echo "  1) Cursor Dashboard → Secrets → Personal HETZNER_SSH_PRIVATE_KEY (restart agent)"
echo "  2) OR: bash UNICORN_FINAL/scripts/owner-authorize-cloud-agent.sh  (from a machine with VPS SSH)"
echo "  3) OR: GitHub Actions → install-ssh-pubkey.yml with ~/.ssh/zeus_ephemeral.pub"
exit 1
