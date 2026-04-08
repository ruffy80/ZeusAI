#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/ionutvladoi/Desktop/generate-unicorn"
PID_FILE="$REPO_DIR/logs/auto-sync.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Auto-sync is not running (no PID file)."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped auto-sync PID $PID"
else
  echo "Process $PID was not running."
fi

rm -f "$PID_FILE"
