#!/bin/zsh
# 🛡️ NEUTRALIZED — DO NOT RE-ENABLE
#
# This script (auto-commit + push to main from the local Hetzner mirror)
# was the proven downgrade vector that took the live site offline on
# 2026-05-03 — see commit 0dacd1c (live-sync: 2026-05-03 00:47:25, -1216
# lines) and LIVE_BASELINE.md.
#
# It is intentionally disabled in-tree.  Re-enabling it would require
# removing this guard, which the no-downgrade-guard.yml workflow blocks
# without an [upgrade-approved] commit trailer signed off by a human.
echo "[$(date '+%Y-%m-%d %H:%M:%S')] auto-sync-push.sh is permanently disabled. See LIVE_BASELINE.md."
exit 0
###############################################################################
# Original implementation kept below for historical reference only.
###############################################################################
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
      git commit -m "auto-sync: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
      git push origin "$BRANCH" | tee -a "$LOG_FILE"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Push done." | tee -a "$LOG_FILE"
    fi
  fi

  sleep "$INTERVAL"
done
