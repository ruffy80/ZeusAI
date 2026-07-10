#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../UNICORN_FINAL" && pwd)"
exec "$ROOT_DIR/scripts/alignment-monitor.sh" "$@"
