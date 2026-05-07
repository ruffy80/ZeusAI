#!/usr/bin/env bash
# bootstrap-ssh-via-github.sh
#
# Solves the chicken-and-egg "I have a new dev machine, server doesn't trust
# my key yet" problem WITHOUT needing HETZNER_PASSWORD.
#
# It dispatches the install-ssh-pubkey.yml workflow on GitHub, which uses the
# already-trusted HETZNER_SSH_PRIVATE_KEY (stored as a GH Actions secret) to
# append THIS machine's public key to ~/.ssh/authorized_keys on the server.
#
# Requirements: a valid GITHUB_TOKEN/GH_PAT in .env.auto-connector with
# `workflow` scope on the target repo.
#
# Usage:  bash UNICORN_FINAL/scripts/bootstrap-ssh-via-github.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")"/../.. && pwd)"
ENV_FILE="$ROOT/.env.auto-connector"
[ -f "$ENV_FILE" ] || { echo "❌ missing $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

OWNER="${GITHUB_OWNER:-ruffy80}"
REPO="${GITHUB_REPO:-ZeusAI}"
TOKEN="${GITHUB_TOKEN:-${GH_PAT:-${GH_TOKEN:-}}}"
KEY_PATH="${HETZNER_KEY_PATH:-${HETZNER_SSH_KEY_PATH:-$HOME/.ssh/hetzner_rsa}}"
PUB_PATH="${KEY_PATH}.pub"

if [ -z "$TOKEN" ]; then
  echo "❌ no GITHUB_TOKEN/GH_PAT/GH_TOKEN in env. Get a fine-grained PAT with 'actions:write' on $OWNER/$REPO."
  exit 1
fi
if [ ! -f "$PUB_PATH" ]; then
  if [ -f "$KEY_PATH" ]; then
    ssh-keygen -y -f "$KEY_PATH" > "$PUB_PATH"
  else
    echo "❌ no SSH keypair at $KEY_PATH — generate one first: ssh-keygen -t ed25519 -f $KEY_PATH"
    exit 1
  fi
fi

PUB_LINE="$(tr -d '\r' < "$PUB_PATH" | head -n1)"
LABEL="local-$(hostname -s)-$(whoami)"

echo "🔑 dispatching install-ssh-pubkey.yml on $OWNER/$REPO with label=$LABEL"
HTTP=$(curl -sS -o /tmp/ghd.json -w '%{http_code}' \
  -X POST \
  -H "Authorization: token $TOKEN" \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "https://api.github.com/repos/$OWNER/$REPO/actions/workflows/install-ssh-pubkey.yml/dispatches" \
  -d "$(jq -n --arg pk "$PUB_LINE" --arg lb "$LABEL" '{ref:"main",inputs:{public_key:$pk,label:$lb}}')")

if [ "$HTTP" != "204" ]; then
  echo "❌ dispatch failed HTTP=$HTTP"
  cat /tmp/ghd.json
  exit 1
fi
echo "✅ workflow dispatched. Watch progress:"
echo "   https://github.com/$OWNER/$REPO/actions/workflows/install-ssh-pubkey.yml"

# Best-effort wait for the latest run to complete (max 4 min).
DEADLINE=$(( $(date +%s) + 240 ))
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  sleep 8
  RUN_JSON=$(curl -sS -H "Authorization: token $TOKEN" -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$OWNER/$REPO/actions/workflows/install-ssh-pubkey.yml/runs?per_page=1")
  STATUS=$(printf '%s' "$RUN_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin);r=d.get("workflow_runs",[]);print(r[0]["status"] if r else "")' 2>/dev/null || echo "")
  CONCL=$(printf '%s' "$RUN_JSON" | python3 -c 'import json,sys;d=json.load(sys.stdin);r=d.get("workflow_runs",[]);print(r[0].get("conclusion") or "")' 2>/dev/null || echo "")
  printf '   status=%s conclusion=%s\n' "$STATUS" "$CONCL"
  if [ "$STATUS" = "completed" ]; then break; fi
done

# Re-probe SSH key auth
HOST="${HETZNER_HOST:-}"
USER="${HETZNER_DEPLOY_USER:-${HETZNER_USER:-root}}"
PORT="${HETZNER_DEPLOY_PORT:-22}"
echo "🔁 verifying ssh key-auth ${USER}@${HOST}:${PORT}…"
if ssh -i "$KEY_PATH" -p "$PORT" \
     -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
     -o IdentitiesOnly=yes -o PreferredAuthentications=publickey \
     "${USER}@${HOST}" 'echo ok' >/dev/null 2>&1; then
  echo "✅ SSH key-auth working — bootstrap complete."
  exit 0
fi
echo "⚠️  workflow finished but SSH key-auth still refused. Check the workflow logs."
exit 1
