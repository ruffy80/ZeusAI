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
CURRENT_BRANCH="$(git branch --show-current)"

require_current_source() {
  local head_sha origin_sha deployed_sha
  head_sha="$(git rev-parse HEAD)"
  git fetch origin "$CURRENT_BRANCH" --quiet || true
  if git rev-parse --verify "origin/${CURRENT_BRANCH}" >/dev/null 2>&1; then
    origin_sha="$(git rev-parse "origin/${CURRENT_BRANCH}")"
    if [[ "$head_sha" != "$origin_sha" ]]; then
      echo "[error] Refuz deploy stale: HEAD=$head_sha, origin/${CURRENT_BRANCH}=$origin_sha" >&2
      echo "        Rulează git pull --ff-only sau împinge commitul curent înainte de sync." >&2
      exit 1
    fi
  fi
  deployed_sha="$(ssh "$SSH_HOST" "cat '${REMOTE_PATH}/.deployed-commit' 2>/dev/null || true" | tr -d '[:space:]')"
  if [[ -n "$deployed_sha" ]] && git cat-file -e "${deployed_sha}^{commit}" 2>/dev/null; then
    if ! git merge-base --is-ancestor "$deployed_sha" "$head_sha"; then
      echo "[error] Refuz posibil downgrade: server=$deployed_sha nu este ancestor pentru local=$head_sha" >&2
      exit 1
    fi
  fi
}

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
  git push origin "$CURRENT_BRANCH" || echo "[warn] push failed"
else
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "[error] Refuz --no-commit cu modificări locale necommitate; commit/push întâi ca GitHub să fie sursa la zi." >&2
    exit 1
  fi
fi

require_current_source

# 2) Rsync UNICORN_FINAL → server
echo "==> rsync ${LOCAL_PATH}/ → ${SSH_HOST}:${REMOTE_PATH}/"
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.env.auto-connector' \
  --exclude '.deployed-commit' \
  --exclude '.unicorn-backups/' \
  --exclude '.vercel/' \
  --exclude 'client/build/' \
  --exclude 'client/build_mirror/' \
  --exclude 'generated/' \
  --exclude 'public/' \
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

DEPLOY_COMMIT="$(git rev-parse HEAD)"
ssh "$SSH_HOST" "printf '%s\n' '${DEPLOY_COMMIT}' > '${REMOTE_PATH}/.deployed-commit'"

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
echo "==> deployed commit: ${DEPLOY_COMMIT}"
