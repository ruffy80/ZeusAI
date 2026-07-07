#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="zeus-social-orchestrator.service"
SRC_PATH="$(cd "$(dirname "$0")" && pwd)/systemd/${SERVICE_NAME}"
DST_PATH="/etc/systemd/system/${SERVICE_NAME}"

if [[ ! -f "$SRC_PATH" ]]; then
  echo "Service template missing: $SRC_PATH" >&2
  exit 1
fi

sudo cp "$SRC_PATH" "$DST_PATH"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager --full status "$SERVICE_NAME" | head -40

echo "✅ $SERVICE_NAME installed and started"
