#!/usr/bin/env bash
# zeus-ssh-deploy.sh — deploy to Hetzner via SSH (no GitHub Actions required)
# ---------------------------------------------------------------------------
# Prefers SSH agent at /run/host-services/ssh-auth.sock (Cursor Cloud), then
# ZEUS_SSH_KEY / ~/.ssh/deploy_key / ~/.ssh/hetzner_rsa.
#
# Usage:
#   bash UNICORN_FINAL/scripts/zeus-ssh-deploy.sh [git-ref]
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF="${1:-HEAD}"
HOST="${ZEUS_HOST:-204.168.230.142}"
USER="${ZEUS_USER:-root}"
PUBLIC_URL="${ZEUS_PUBLIC_URL:-https://zeusai.pro}"

if [ -z "${SSH_AUTH_SOCK:-}" ] && [ -S /run/host-services/ssh-auth.sock ]; then
  export SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock
fi

# Central secrets module: materialize HETZNER_SSH_PRIVATE_KEY → ~/.ssh/deploy_key
if [ -f "$ROOT/UNICORN_FINAL/src/config/secrets.js" ]; then
  node -e "
    const s=require('$ROOT/UNICORN_FINAL/src/config/secrets');
    s.bootstrap({log:false,persistGenerated:false});
    const m=s.materializeDeployKey();
    if (m.HETZNER_KEY_PATH) console.log('[zeus-ssh-deploy] secrets materialize:', m.HETZNER_KEY_PATH);
  " 2>/dev/null || true
fi

KEY=""
for cand in "${ZEUS_SSH_KEY:-}" "${HETZNER_KEY_PATH:-}" "$HOME/.ssh/deploy_key" "$HOME/.ssh/hetzner_rsa" "$HOME/.ssh/id_ed25519"; do
  [ -n "$cand" ] && [ -f "$cand" ] && KEY="$cand" && break
done

SSHK=( -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -o ConnectTimeout=20 -o BatchMode=yes )
if [ -n "$KEY" ]; then
  SSHK=( -i "$KEY" "${SSHK[@]}" )
fi

echo "[zeus-ssh-deploy] probing ${USER}@${HOST}…"
if ! ssh "${SSHK[@]}" "${USER}@${HOST}" 'echo ok' >/dev/null 2>&1; then
  echo "[zeus-ssh-deploy][FAIL] SSH denied. On the server run once:" >&2
  echo "  mkdir -p ~/.ssh && chmod 700 ~/.ssh" >&2
  if [ -n "${SSH_AUTH_SOCK:-}" ] && command -v ssh-add >/dev/null; then
    echo "  echo '$(ssh-add -L | head -1) cursor-cloud-agent' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys" >&2
  else
    echo "  # append the Cursor Cloud agent pubkey from ensure-cursor-cloud-ssh.sh" >&2
  fi
  exit 1
fi

# Reuse deploy-local.sh logic with env overrides
export ZEUS_HOST="$HOST" ZEUS_USER="$USER" ZEUS_PUBLIC_URL="$PUBLIC_URL"
if [ -n "$KEY" ]; then
  export ZEUS_SSH_KEY="$KEY"
else
  # Agent-only auth: write a dummy key path workaround by inlining ssh wrapper
  # deploy-local requires a key file — synthesize from agent if needed.
  if [ ! -f "${ZEUS_SSH_KEY:-$HOME/.ssh/deploy_key}" ]; then
    mkdir -p "$HOME/.ssh"
    # Prefer IdentityAgent; create a stub private key file is not possible from agent.
    # Instead, patch invoke: call deploy steps directly with agent SSH.
    echo "[zeus-ssh-deploy] using SSH agent (no key file) — inline deploy"
    cd "$ROOT"
    SHA="$(git rev-parse "$REF")"
    echo "[zeus-ssh-deploy] deploying $REF ($SHA) -> ${USER}@${HOST}"
    STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
    git archive "$SHA" | tar -x -C "$STAGE"
    ( cd "$STAGE" && rm -rf \
        UNICORN_FINAL/data UNICORN_FINAL/db UNICORN_FINAL/logs UNICORN_FINAL/backups \
        UNICORN_FINAL/snapshots UNICORN_FINAL/generated UNICORN_FINAL/public \
        UNICORN_FINAL/.archive UNICORN_FINAL/.unicorn-backups UNICORN_FINAL/node_modules \
        logs backups snapshots .archive node_modules 2>/dev/null || true )
    find "$STAGE" -maxdepth 2 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | { grep -v example || true; } | xargs -r rm -f || true
    REL="/var/www/unicorn/releases/${SHA}-$(date +%s)"
    DEPLOY_LINK="/var/www/unicorn/UNICORN_FINAL"
    ssh "${SSHK[@]}" "${USER}@${HOST}" "mkdir -p '$REL'"
    tar czf - -C "$STAGE" . | ssh "${SSHK[@]}" "${USER}@${HOST}" "tar xzf - -C '$REL'"
    ssh "${SSHK[@]}" "${USER}@${HOST}" "export HOME=/root; chmod +x '$REL/UNICORN_FINAL/scripts/'*.sh 2>/dev/null || true; GITHUB_SHA='$SHA' PUBLIC_URL='$PUBLIC_URL' bash '$REL/UNICORN_FINAL/scripts/deploy-atomic-forward.sh' '$REL/UNICORN_FINAL' '$DEPLOY_LINK'"
    echo -n "[zeus-ssh-deploy] live health: "
    curl -sk -o /dev/null -w "https %{http_code}\n" --max-time 20 "$PUBLIC_URL/health" || true
    echo "[zeus-ssh-deploy] done — $SHA"
    exit 0
  fi
fi

exec bash "$ROOT/UNICORN_FINAL/scripts/deploy-local.sh" "$REF"
