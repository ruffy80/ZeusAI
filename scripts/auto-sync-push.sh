#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/ionutvladoi/Desktop/generate-unicorn"
BRANCH="${AUTO_SYNC_BRANCH:-main}"
INTERVAL="${AUTO_SYNC_INTERVAL:-10}"
LOG_FILE="$REPO_DIR/logs/auto-sync.log"

mkdir -p "$REPO_DIR/logs"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Auto-sync started (branch=$BRANCH, interval=${INTERVAL}s)" | tee -a "$LOG_FILE"

cd "$REPO_DIR"

while true; do
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Changes detected. Running add/commit/push..." | tee -a "$LOG_FILE"

    git add -A

    if git diff --cached --quiet; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Nothing staged after add." | tee -a "$LOG_FILE"
    else
      git commit -m "auto-sync: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
      git push origin "$BRANCH" | tee -a "$LOG_FILE"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Push done." | tee -a "$LOG_FILE"
    fi
  fi

  sleep "$INTERVAL"
done
