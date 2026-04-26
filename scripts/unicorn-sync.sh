#!/usr/bin/env bash
# unicorn-sync.sh — one-shot sync: local → GitHub → Hetzner → PM2 reload
# Usage:
#   ./scripts/unicorn-sync.sh "commit message"
#   ./scripts/unicorn-sync.sh --no-commit       # only rsync + pm2 reload
#   ./scripts/unicorn-sync.sh --no-restart      # skip pm2 reload
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${UNICORN_SSH_HOST:-hetzner-unicorn}"
REMOTE_PATH="${UNICORN_REMOTE_PATH:-/var/www/unicorn/UNICORN_FINAL}"
LOCAL_PATH="${REPO_ROOT}/UNICORN_FINAL"

COMMIT_MSG=""
DO_COMMIT=1
DO_RESTART=1

for arg in "$@"; do
  case "$arg" in
    --no-commit)  DO_COMMIT=0 ;;
    --no-restart) DO_RESTART=0 ;;
    *)            COMMIT_MSG="$arg" ;;
  esac
done

cd "$REPO_ROOT"

# 1) Local commit + push to GitHub
if [[ "$DO_COMMIT" == "1" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    : "${COMMIT_MSG:=chore(unicorn): sync $(date -u +%Y-%m-%dT%H:%M:%SZ)}"
    echo "==> git add/commit"
    git add -A
    git commit -m "$COMMIT_MSG" || true
  else
    echo "==> nothing to commit"
  fi
  echo "==> git push origin"
  git push origin "$(git branch --show-current)" || echo "[warn] push failed"
fi

# 2) Rsync UNICORN_FINAL → server
echo "==> rsync ${LOCAL_PATH}/ → ${SSH_HOST}:${REMOTE_PATH}/"
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.env' \
  --exclude 'data/' \
  --exclude 'db/' \
  --exclude 'backups/' \
  --exclude 'snapshots/' \
  --exclude '.archive/' \
  --exclude 'logs/' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude '._*' \
  "${LOCAL_PATH}/" "${SSH_HOST}:${REMOTE_PATH}/"

# 3) Install deps if package.json changed (cheap heuristic) + reload PM2
if [[ "$DO_RESTART" == "1" ]]; then
  echo "==> remote: npm install (if needed) + pm2 reload"
  ssh "$SSH_HOST" "cd ${REMOTE_PATH} && \
    if [ package.json -nt node_modules/.package-stamp ] 2>/dev/null || [ ! -d node_modules ]; then \
      HUSKY=0 npm install --omit=dev --ignore-scripts --no-audit --no-fund && mkdir -p node_modules && touch node_modules/.package-stamp; \
    fi; \
    pm2 reload ecosystem.config.js --update-env || pm2 reload all"
fi

echo "==> done. health:"
ssh "$SSH_HOST" "curl -fsS http://localhost:3000/health 2>/dev/null || curl -fsS http://localhost:3001/health 2>/dev/null || echo '[health unreachable]'; echo"
