#!/bin/zsh
# 🛡️ NEUTRALIZED — DO NOT RE-ENABLE.  See LIVE_BASELINE.md.
echo "[$(date '+%Y-%m-%d %H:%M:%S')] start-auto-sync.sh is permanently disabled."
exit 0
set -euo pipefail

REPO_DIR="/Users/ionutvladoi/Desktop/generate-unicorn"
PID_FILE="$REPO_DIR/logs/auto-sync.pid"
LOG_FILE="$REPO_DIR/logs/auto-sync.log"
SCRIPT="$REPO_DIR/scripts/auto-sync-push.sh"

mkdir -p "$REPO_DIR/logs"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Auto-sync already running with PID $(cat "$PID_FILE")"
  exit 0
fi

nohup "$SCRIPT" >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "Auto-sync started with PID $!"
