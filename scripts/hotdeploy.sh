#!/usr/bin/env bash
# scripts/hotdeploy.sh — instant rsync UNICORN_FINAL → Hetzner + pm2 reload.
#
# Folosire:
#   scripts/hotdeploy.sh                # rsync întreg UNICORN_FINAL/{src,backend,client}
#   scripts/hotdeploy.sh src/site       # rsync doar UNICORN_FINAL/src/site
#   scripts/hotdeploy.sh backend/index.js
#
# Acesta NU comite și NU push-uiește în git — e doar pentru iterație rapidă.
# Pentru deploy oficial (cu baseline + CI), folosește scripts/ship.sh.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

HOST="${HETZNER_HOST:-204.168.230.142}"
USER="${HETZNER_USER:-root}"
KEY="${HETZNER_SSH_KEY:-$HOME/.ssh/hetzner_rsa}"
# /var/www/unicorn/UNICORN_FINAL este symlink-ul live spre release-ul curent
# (gestionat de scripts/deploy-atomic-forward.sh).
REMOTE_DIR="${HETZNER_DEPLOY_PATH:-/var/www/unicorn/UNICORN_FINAL}"

SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

if [ ! -f "$KEY" ]; then
  echo "[hotdeploy][FAIL] cheia SSH lipsă: $KEY" >&2
  exit 1
fi

# Test rapid de conectivitate.
"${SSH[@]}" "$USER@$HOST" "true" >/dev/null 2>&1 || {
  echo "[hotdeploy][FAIL] nu pot face SSH la $USER@$HOST cu $KEY" >&2
  exit 1
}

# Decide ce să sincronizeze.
if [ "$#" -eq 0 ]; then
  TARGETS=(src backend client package.json package-lock.json ecosystem.config.js)
else
  TARGETS=("$@")
fi

echo "[hotdeploy] host=$USER@$HOST"
echo "[hotdeploy] remote=$REMOTE_DIR"
echo "[hotdeploy] targets: ${TARGETS[*]}"

cd UNICORN_FINAL
for t in "${TARGETS[@]}"; do
  if [ ! -e "$t" ]; then
    echo "[hotdeploy] skip (lipsă local): $t"
    continue
  fi
  rsync -az --delete \
    --exclude 'node_modules' --exclude '.env' --exclude 'data' \
    --exclude 'db' --exclude 'logs' --exclude 'backups' \
    -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" \
    "$t" "$USER@$HOST:$REMOTE_DIR/"
  echo "[hotdeploy]   ✓ $t"
done
cd "$REPO"

echo "[hotdeploy] reload PM2 (unicorn-site, unicorn-backend)"
"${SSH[@]}" "$USER@$HOST" "cd $REMOTE_DIR && pm2 reload unicorn-site unicorn-backend --update-env >/dev/null && pm2 list | grep -E 'unicorn|autoscaler'"

echo "[hotdeploy] healthcheck"
"${SSH[@]}" "$USER@$HOST" "curl -fsS -m 5 http://127.0.0.1:3000/health | head -c 200; echo"

echo "[hotdeploy] ✅ live pe https://zeusai.pro"
