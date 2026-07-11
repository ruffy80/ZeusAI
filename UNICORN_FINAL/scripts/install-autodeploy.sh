#!/usr/bin/env bash
# install-autodeploy.sh
# ---------------------------------------------------------------------------
# Idempotent installer for the billing-independent self-deploy poller.
# Run once on the server (re-runs are safe):
#     bash install-autodeploy.sh
#
# Installs:
#   /usr/local/bin/zeus-auto-pull-deploy.sh      (the poller)
#   /etc/systemd/system/zeus-autodeploy.service  (oneshot)
#   /etc/systemd/system/zeus-autodeploy.timer     (every 3 min)
# and enables the timer. The GitHub repo is public, so no token is required.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DST="/usr/local/bin/zeus-auto-pull-deploy.sh"
UNIT_DIR="/etc/systemd/system"

echo "[install-autodeploy] installing poller → $BIN_DST"
install -m 0755 "$SCRIPT_DIR/auto-pull-deploy.sh" "$BIN_DST"

echo "[install-autodeploy] installing systemd units"
install -m 0644 "$SCRIPT_DIR/zeus-autodeploy.service" "$UNIT_DIR/zeus-autodeploy.service"
install -m 0644 "$SCRIPT_DIR/zeus-autodeploy.timer"   "$UNIT_DIR/zeus-autodeploy.timer"

mkdir -p /opt/zeus-autodeploy
touch /var/log/zeus-autodeploy.log 2>/dev/null || true

echo "[install-autodeploy] reload + enable timer"
systemctl daemon-reload
systemctl enable --now zeus-autodeploy.timer

echo "[install-autodeploy] status:"
systemctl status zeus-autodeploy.timer --no-pager -l 2>&1 | head -8 || true
echo "[install-autodeploy] done. Kill-switch: touch /etc/zeus-autodeploy.disabled"
