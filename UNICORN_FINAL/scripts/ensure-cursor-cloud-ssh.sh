#!/usr/bin/env bash
# ensure-cursor-cloud-ssh.sh
# ---------------------------------------------------------------------------
# Install Cursor Cloud agent SSH public keys into root authorized_keys so
# agents can deploy via SSH when GitHub Actions is billing-locked.
# Safe / idempotent. Called from deploy-atomic-forward.sh on every promote.
# ---------------------------------------------------------------------------
set -euo pipefail

AUTH_KEYS="${HOME:-/root}/.ssh/authorized_keys"
mkdir -p "$(dirname "$AUTH_KEYS")"
chmod 700 "$(dirname "$AUTH_KEYS")"
touch "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"

# Cursor Cloud agent ED25519 keys authorized for zeusai.pro deploys.
# Add new agent fingerprints here when rotating.
CURSOR_CLOUD_PUBKEYS=(
  # Host ssh-agent key (often present but refuses outbound signing on Cursor VMs)
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPqiJsBjAsv4KymedFcUR891X1lgC90DW8yMtjcHJ/p0 cursor-cloud-agent'
  # File-based deploy key for Cursor Cloud agents (materialize via HETZNER_SSH_PRIVATE_KEY
  # Runtime Secret, or generate locally as ~/.ssh/deploy_key). Fingerprint:
  # SHA256:M4MGpP8CSN3/9A14SShW+jVjZQD7G/Gux6A1H/Q+dbI
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC3ls7I4Y9XlmpIBjCF30qpQt2z89FYIPhg+gzhsYGM5 cursor-cloud-zeus-deploy'
  # c3b6 full-autonomy activation agent key.
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHA7c/ZKX3ZBpNC9vmgiUcKMhogxZFw6Hfg5LhH6QTm0 cursor-cloud-zeus-deploy-c3b6'
  # Ephemeral Cloud Agent key (this VM). Owner can also install via GitHub
  # Actions → "Install local SSH pubkey on server" when agent signing is refused.
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIq+uCeIYtCITbLBmKTtELMMlggITZPAkxVdbp51y4PW zeus-cloud-agent-ephemeral'
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQdeHHTLRraxxanahITSWXxtbQ5CnR6ya3G40TXkR7Q cursor-cloud-zeus-deploy-recover'
)

# Secrets-module path: derive pubkey from HETZNER_SSH_PRIVATE_KEY / deploy_key when present.
# This keeps authorized_keys aligned with whatever the central secrets registry materializes.
TMP_KEY=""
if [ -n "${HETZNER_SSH_PRIVATE_KEY:-${SSH_PRIVATE_KEY:-}}" ]; then
  TMP_KEY="$(mktemp)"
  printf '%s\n' "${HETZNER_SSH_PRIVATE_KEY:-$SSH_PRIVATE_KEY}" > "$TMP_KEY"
  chmod 600 "$TMP_KEY"
elif [ -f "${HETZNER_KEY_PATH:-}" ]; then
  TMP_KEY="${HETZNER_KEY_PATH}"
elif [ -f "${HOME:-/root}/.ssh/deploy_key" ]; then
  TMP_KEY="${HOME:-/root}/.ssh/deploy_key"
fi
if [ -n "$TMP_KEY" ] && [ -f "$TMP_KEY" ]; then
  DERIVED="$(ssh-keygen -y -f "$TMP_KEY" 2>/dev/null || true)"
  if [ -n "$DERIVED" ]; then
    CURSOR_CLOUD_PUBKEYS+=("${DERIVED} unicorn-secrets-deploy")
  fi
  case "$TMP_KEY" in
    /tmp/*) rm -f "$TMP_KEY" ;;
  esac
fi

added=0
for line in "${CURSOR_CLOUD_PUBKEYS[@]}"; do
  body="$(printf '%s' "$line" | awk '{print $1" "$2}')"
  [ -n "$body" ] || continue
  if grep -F -q "$body" "$AUTH_KEYS" 2>/dev/null; then
    continue
  fi
  printf '%s\n' "$line" >> "$AUTH_KEYS"
  added=$((added + 1))
  echo "[cursor-ssh] installed pubkey: $(printf '%s\n' "$line" | ssh-keygen -lf - 2>/dev/null | awk '{print $2}' || echo unknown)"
done

if [ "$added" -eq 0 ]; then
  echo "[cursor-ssh] authorized_keys already up to date"
else
  echo "[cursor-ssh] appended $added Cursor Cloud agent key(s)"
fi
exit 0
