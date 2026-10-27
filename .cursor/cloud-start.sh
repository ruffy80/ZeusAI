#!/usr/bin/env bash
# Runs on every Cloud Agent boot. Does not install packages and does not
# start the backend: that process rewrites source unless DISABLE_SELF_MUTATION=1.
set -euo pipefail

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

key_body=""
if [ -n "${HETZNER_SSH_PRIVATE_KEY:-}" ]; then
  key_body="$HETZNER_SSH_PRIVATE_KEY"
elif [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  key_body="$SSH_PRIVATE_KEY"
fi

if [ -n "$key_body" ]; then
  printf '%s\n' "$key_body" > "$HOME/.ssh/deploy_key"
  chmod 600 "$HOME/.ssh/deploy_key"
  ssh-keygen -y -f "$HOME/.ssh/deploy_key" > "$HOME/.ssh/deploy_key.pub" 2>/dev/null || true
  echo "[cursor-env] deploy key materialized"
else
  echo "[cursor-env] no deploy key secret; local work does not need one"
fi

export ZEUS_SSH_KEY="${ZEUS_SSH_KEY:-$HOME/.ssh/deploy_key}"
export ZEUS_HOST="${ZEUS_HOST:-${HETZNER_HOST:-204.168.230.142}}"
export ZEUS_USER="${ZEUS_USER:-${HETZNER_DEPLOY_USER:-root}}"
echo "[cursor-env] ZEUS_HOST=$ZEUS_HOST ZEUS_USER=$ZEUS_USER"
echo "[cursor-env] servers stay down until an agent starts them with DISABLE_SELF_MUTATION=1"
exit 0
