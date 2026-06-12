#!/usr/bin/env zsh
set -euo pipefail

REMOTE_HOST="root@204.168.230.142"
REMOTE_ROOT="/var/www/unicorn/current"
LOCAL_ROOT="/Users/ionutvladoi/Desktop/generate-unicorn/UNICORN_FINAL"

echo "[live-sync] syncing backend + src to ${REMOTE_HOST}:${REMOTE_ROOT}"

rsync -az --delete \
  --exclude '.DS_Store' \
  --exclude 'node_modules' \
  --exclude 'logs' \
  --exclude 'data' \
  "${LOCAL_ROOT}/backend/" "${REMOTE_HOST}:${REMOTE_ROOT}/backend/"

rsync -az --delete \
  --exclude '.DS_Store' \
  --exclude 'node_modules' \
  --exclude 'logs' \
  --exclude 'data' \
  "${LOCAL_ROOT}/src/" "${REMOTE_HOST}:${REMOTE_ROOT}/src/"

ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" '
set -e
cd /var/www/unicorn/current
pm2 reload unicorn-backend --update-env
pm2 reload unicorn-site --update-env
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then break; fi
  sleep 1
done
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then break; fi
  sleep 1
done
echo "backend="$(curl -fsS http://127.0.0.1:3000/api/health | head -c 160)
echo "site="$(curl -fsS http://127.0.0.1:3001/health | head -c 160)
'

echo "[live-sync] done"
