#!/usr/bin/env bash
# install-zac.sh — Install Zeus Autonomous Core as a systemd service.
# Run on the Hetzner server (as root). Idempotent — safe to re-run.

set -euo pipefail

UNICORN_DIR="${UNICORN_DIR:-/var/www/unicorn/UNICORN_FINAL}"
UNIT_SRC="$UNICORN_DIR/deploy/zac.service"
UNIT_DST="/etc/systemd/system/zac.service"

if [[ $EUID -ne 0 ]]; then
  echo "❌ This script must run as root (use sudo)." >&2
  exit 1
fi

if [[ ! -d "$UNICORN_DIR" ]]; then
  echo "❌ UNICORN_FINAL not found at: $UNICORN_DIR" >&2
  exit 1
fi

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "❌ Unit source not found: $UNIT_SRC" >&2
  exit 1
fi

echo "📦 Installing ZAC systemd unit -> $UNIT_DST"
install -m 0644 "$UNIT_SRC" "$UNIT_DST"

echo "🔄 systemctl daemon-reload"
systemctl daemon-reload

if [[ "${ZAC_ENABLE_SERVICE:-0}" != "1" ]]; then
  echo "✅ Installed zac.service but left it disabled (set ZAC_ENABLE_SERVICE=1 to enable)."
  systemctl disable zac.service >/dev/null 2>&1 || true
  systemctl stop zac.service >/dev/null 2>&1 || true
  exit 0
fi

echo "✅ Enabling zac.service (start at boot)"
systemctl enable zac.service

echo "🚀 Starting zac.service"
systemctl restart zac.service

sleep 2
echo
echo "── status ──"
systemctl --no-pager --full status zac.service | head -20 || true
echo
echo "── live logs (Ctrl+C to exit) ──"
echo "journalctl -u zac -f"
