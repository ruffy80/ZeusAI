#!/usr/bin/env bash
# install-zeus-aethermail-agent.sh — PM2 install for AetherMail Continuum agent
set -euo pipefail
LIVE="${UNICORN_LIVE:-/var/www/unicorn/UNICORN_FINAL}"
SCRIPT="$LIVE/scripts/zeus-aethermail-agent.js"
NAME="zeus-aethermail"

if [[ ! -f "$SCRIPT" ]]; then
  echo "[aethermail] missing $SCRIPT — skip"
  exit 0
fi

export HOME="${HOME:-/root}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"

if pm2 describe "$NAME" >/dev/null 2>&1; then
  pm2 restart "$NAME" --update-env
else
  pm2 start "$SCRIPT" --name "$NAME" --time --cwd "$LIVE" --interpreter node
fi
pm2 save >/dev/null 2>&1 || true
echo "[aethermail] $NAME online"
