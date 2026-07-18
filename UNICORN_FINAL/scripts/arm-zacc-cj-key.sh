#!/usr/bin/env bash
# arm-zacc-cj-key.sh — write a REAL CJ Dropshipping API key into live shared .env
# and restart unicorn-backend so fulfillment can auto-dispatch.
#
# You obtain the key yourself (free CJ account):
#   https://cjdropshipping.com → My CJ → Authorization → API → Generate API Key
#
# Usage (on VPS as root, or via SSH from Cursor Cloud):
#   bash UNICORN_FINAL/scripts/arm-zacc-cj-key.sh 'YOUR_CJ_ACCESS_TOKEN'
#   ZEUS_SSH_KEY=~/.ssh/deploy_key bash UNICORN_FINAL/scripts/arm-zacc-cj-key.sh 'KEY' --remote
#
# This script NEVER invents a key. Placeholder values are rejected.
set -euo pipefail

KEY="${1:-}"
MODE="${2:-}"
HOST="${ZEUS_HOST:-204.168.230.142}"
USER="${ZEUS_USER:-root}"
SSH_KEY="${ZEUS_SSH_KEY:-$HOME/.ssh/deploy_key}"
ENV_FILE="${UNICORN_SHARED_ENV:-/var/www/unicorn/shared/.env}"

if [ -z "$KEY" ] || [ "$KEY" = "-h" ] || [ "$KEY" = "--help" ]; then
  cat <<'EOF'
Usage: arm-zacc-cj-key.sh <CJ_API_KEY> [--remote]

Get a key: cjdropshipping.com → My CJ → Authorization → API → Generate
Remote:    ZEUS_SSH_KEY=~/.ssh/deploy_key bash .../arm-zacc-cj-key.sh 'KEY' --remote
EOF
  exit 1
fi

if [[ "$KEY" =~ [Yy]our_|changeme|xxx|placeholder|example ]]; then
  echo "Refusing placeholder key — paste the real CJ Access Token."; exit 2
fi
if [ "${#KEY}" -lt 16 ]; then
  echo "Key too short (${#KEY} chars) — CJ tokens are longer."; exit 2
fi

arm_local() {
  mkdir -p "$(dirname "$ENV_FILE")"
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE" || true
  if grep -qE '^ZACC_CJ_API_KEY=' "$ENV_FILE" 2>/dev/null; then
    # portable in-place replace
    tmp="$(mktemp)"
    awk -v k="$KEY" 'BEGIN{done=0} /^ZACC_CJ_API_KEY=/{print "ZACC_CJ_API_KEY=" k; done=1; next} {print} END{if(!done) print "ZACC_CJ_API_KEY=" k}' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '\nZACC_CJ_API_KEY=%s\n' "$KEY" >> "$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE" || true
  echo "[arm-cj] wrote ZACC_CJ_API_KEY (len=${#KEY}) → $ENV_FILE"
  if command -v pm2 >/dev/null 2>&1; then
    export HOME="${HOME:-/root}"
    pm2 restart unicorn-backend --update-env >/dev/null
    echo "[arm-cj] pm2 restarted unicorn-backend"
  fi
  sleep 2
  curl -sS --max-time 10 http://127.0.0.1:3000/api/dropship/fulfillment/readiness || true
  echo
}

if [ "$MODE" = "--remote" ]; then
  SSHK=(-o StrictHostKeyChecking=no -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20)
  [ -f "$SSH_KEY" ] && SSHK=(-i "$SSH_KEY" "${SSHK[@]}")
  # shellcheck disable=SC2029
  ssh "${SSHK[@]}" "$USER@$HOST" "KEY=$(printf '%q' "$KEY") bash -s" <<'REMOTE'
set -euo pipefail
ENV_FILE=/var/www/unicorn/shared/.env
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE" || true
if grep -qE '^ZACC_CJ_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  tmp="$(mktemp)"
  awk -v k="$KEY" 'BEGIN{done=0} /^ZACC_CJ_API_KEY=/{print "ZACC_CJ_API_KEY=" k; done=1; next} {print} END{if(!done) print "ZACC_CJ_API_KEY=" k}' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
else
  printf '\nZACC_CJ_API_KEY=%s\n' "$KEY" >> "$ENV_FILE"
fi
chmod 600 "$ENV_FILE" || true
echo "[arm-cj] remote wrote key len=${#KEY}"
export HOME=/root
pm2 restart unicorn-backend --update-env
sleep 3
curl -sS --max-time 10 http://127.0.0.1:3000/api/dropship/fulfillment/readiness
echo
REMOTE
else
  arm_local
fi
