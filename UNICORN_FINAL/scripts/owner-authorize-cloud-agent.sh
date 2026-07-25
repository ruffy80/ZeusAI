#!/usr/bin/env bash
# owner-authorize-cloud-agent.sh
# ---------------------------------------------------------------------------
# ONE-SHOT for the owner: install this Cloud Agent's ephemeral SSH pubkey on
# the VPS so OOB deploy can finish without GitHub Actions.
#
# Run from ANY machine that already has SSH access to the VPS, e.g.:
#   bash UNICORN_FINAL/scripts/owner-authorize-cloud-agent.sh
#
# Or paste the echo line printed at the end into a Hetzner console session.
# ---------------------------------------------------------------------------
set -euo pipefail

HOST="${HETZNER_HOST:-204.168.230.142}"
USER="${HETZNER_DEPLOY_USER:-root}"
PORT="${HETZNER_DEPLOY_PORT:-22}"
KEY_FILE="${ZEUS_SSH_KEY:-${HOME}/.ssh/deploy_key}"
PUB='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIq+uCeIYtCITbLBmKTtELMMlggITZPAkxVdbp51y4PW zeus-cloud-agent-ephemeral'
BODY="$(printf '%s' "$PUB" | awk '{print $1" "$2}')"

echo "🔑 Installing Cloud Agent ephemeral pubkey on ${USER}@${HOST}:${PORT}"
echo "   $PUB"

REMOTE_CMD=$(cat <<'EOS'
set -e
umask 077
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
NEW_LINE="$(cat)"
KEY_BODY="$(printf '%s' "$NEW_LINE" | awk '{print $1" "$2}')"
if grep -F -q "$KEY_BODY" ~/.ssh/authorized_keys 2>/dev/null; then
  echo "ℹ️  pubkey already present"
else
  printf '%s\n' "$NEW_LINE" >> ~/.ssh/authorized_keys
  echo "✅ pubkey appended"
fi
EOS
)

SSH_OPTS=(-p "$PORT" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=15)
if [ -f "$KEY_FILE" ]; then
  SSH_OPTS+=(-i "$KEY_FILE" -o IdentitiesOnly=yes)
fi

printf '%s\n' "$PUB" | ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "$REMOTE_CMD"

echo
echo "✅ Done. Tell the Cloud Agent to retry:"
echo "   ZEUS_SSH_KEY=\$HOME/.ssh/zeus_ephemeral bash UNICORN_FINAL/scripts/deploy-local.sh HEAD"
echo
echo "Fallback (Hetzner console / any root shell) — paste this single line:"
echo "  mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && grep -Fq '$BODY' ~/.ssh/authorized_keys || echo '$PUB' >> ~/.ssh/authorized_keys"
echo
echo "Alt (GitHub UI, no local SSH needed):"
echo "  https://github.com/ruffy80/ZeusAI/actions/workflows/install-ssh-pubkey.yml"
echo "  → Run workflow → public_key = (the line above) → label = cloud-agent-ephemeral-c3b6"
