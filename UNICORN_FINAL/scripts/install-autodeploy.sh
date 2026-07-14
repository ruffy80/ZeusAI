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

# Post-deploy health sentinel (known-good tracking + rollback; monitor-mode default)
if [ -f "$SCRIPT_DIR/zeus-deploy-sentinel.sh" ]; then
  echo "[install-autodeploy] installing deploy sentinel → /usr/local/bin/zeus-deploy-sentinel.sh"
  install -m 0755 "$SCRIPT_DIR/zeus-deploy-sentinel.sh" /usr/local/bin/zeus-deploy-sentinel.sh
  install -m 0644 "$SCRIPT_DIR/zeus-deploy-sentinel.service" "$UNIT_DIR/zeus-deploy-sentinel.service"
  install -m 0644 "$SCRIPT_DIR/zeus-deploy-sentinel.timer"   "$UNIT_DIR/zeus-deploy-sentinel.timer"
  touch /var/log/zeus-deploy-sentinel.log 2>/dev/null || true
fi

# Consistent SQLite DB backups (unicorn.db, tenants.db) — hourly
if [ -f "$SCRIPT_DIR/zeus-db-backup.sh" ]; then
  echo "[install-autodeploy] installing DB backup → /usr/local/bin/zeus-db-backup.sh"
  install -m 0755 "$SCRIPT_DIR/zeus-db-backup.sh" /usr/local/bin/zeus-db-backup.sh
  install -m 0644 "$SCRIPT_DIR/zeus-db-backup.service" "$UNIT_DIR/zeus-db-backup.service"
  install -m 0644 "$SCRIPT_DIR/zeus-db-backup.timer"   "$UNIT_DIR/zeus-db-backup.timer"
  touch /var/log/zeus-db-backup.log 2>/dev/null || true
fi

mkdir -p /opt/zeus-autodeploy
touch /var/log/zeus-autodeploy.log 2>/dev/null || true

echo "[install-autodeploy] reload + enable timers"
systemctl daemon-reload
systemctl enable --now zeus-autodeploy.timer
if [ -f "$UNIT_DIR/zeus-deploy-sentinel.timer" ]; then
  systemctl enable --now zeus-deploy-sentinel.timer
fi
if [ -f "$UNIT_DIR/zeus-db-backup.timer" ]; then
  systemctl enable --now zeus-db-backup.timer
fi

echo "[install-autodeploy] status:"
systemctl status zeus-autodeploy.timer --no-pager -l 2>&1 | head -6 || true
systemctl status zeus-deploy-sentinel.timer --no-pager -l 2>&1 | head -6 || true
echo "[install-autodeploy] done."
echo "  Kill-switch (autodeploy): touch /etc/zeus-autodeploy.disabled"
echo "  Sentinel rollback (opt-in): systemctl edit zeus-deploy-sentinel.service -> Environment=ZEUS_SENTINEL_MODE=act"
