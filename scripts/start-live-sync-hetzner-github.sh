#!/bin/zsh
# Forward-only live-sync launcher.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_DIR/logs"
PID_FILE="$LOG_DIR/live-sync-forward.pid"
LOG_FILE="$LOG_DIR/live-sync-forward.log"
SCRIPT="$REPO_DIR/UNICORN_FINAL/scripts/live-sync-forward.js"

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Live sync already running with PID $(cat "$PID_FILE")"
  exit 0
fi

nohup node "$SCRIPT" >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "Live sync started with PID $!"