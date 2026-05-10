#!/bin/zsh
# Forward-only live-sync daemon wrapper.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$REPO_DIR/UNICORN_FINAL/scripts/live-sync-forward.js"