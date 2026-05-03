#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/ionutvladoi/Desktop/generate-unicorn"
BRANCH="${AUTO_SYNC_BRANCH:-main}"
INTERVAL="${AUTO_SYNC_INTERVAL:-3}"
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
      # 30Y-LTS — destructive-change guard. See live-sync-hetzner-github.sh
      # for context. Refuse to commit when staged diff removes more than
      # AUTO_SYNC_MAX_DELETIONS lines (default 200). Override with
      # AUTO_SYNC_FORCE=1.
      _max_deletions="${AUTO_SYNC_MAX_DELETIONS:-200}"
      _deletions="$(git diff --cached --numstat \
        | awk '$2 ~ /^[0-9]+$/ { sum += $2 } END { print sum + 0 }')"
      if [[ "${AUTO_SYNC_FORCE:-0}" != "1" && "$_deletions" -gt "$_max_deletions" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] REFUSING auto-commit: staged deletions=$_deletions exceed AUTO_SYNC_MAX_DELETIONS=$_max_deletions" | tee -a "$LOG_FILE"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Override with AUTO_SYNC_FORCE=1 if intentional." | tee -a "$LOG_FILE"
        git reset | tee -a "$LOG_FILE" || true
        sleep "$INTERVAL"
        continue
      fi
      git commit -m "auto-sync: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
      git push origin "$BRANCH" | tee -a "$LOG_FILE"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Push done." | tee -a "$LOG_FILE"
    fi
  fi

  sleep "$INTERVAL"
done
