#!/bin/zsh
# PERMANENTLY DISABLED — golden rule #4.
# Auto-commit/push loops corrupt feature work and trigger CI storms.
# Use explicit `git add/commit/push` from your editor or the agent flow instead.
echo "[$(date '+%Y-%m-%d %H:%M:%S')] UNICORN_FINAL/scripts/start-auto-sync.sh is permanently disabled."
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
