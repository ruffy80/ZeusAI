#!/usr/bin/env bash
# =============================================================================
# install-deepseek-unified.sh
# Instalează DeepSeek Unified Daemon pe serverul Hetzner.
# Oprește deepseek-loop.service (înlocuit), instalează noul serviciu.
#
# Usage (run via SSH or CI):
#   bash scripts/install-deepseek-unified.sh
#
# Requires:
#   - Running as root or with sudo
#   - /var/www/unicorn/UNICORN_FINAL/ already deployed
#   - .env file at /var/www/unicorn/UNICORN_FINAL/.env with:
#       DEEPSEEK_API_KEY=...  (and/or OPENROUTER_API_KEY / GROQ_API_KEY)
#       DEEPSEEK_LOOP_ADMIN_TOKEN=...
#       DEEPSEEK_LOOP_EXECUTE=1         (optional: enables execution)
#       DEEPSEEK_UNIFIED_GIT_PUSH=1     (optional: enables git push proposals)
#       DEEPSEEK_UNIFIED_GITHUB_REPO=owner/repo
#       GITHUB_TOKEN=ghp_...
# =============================================================================
set -euo pipefail

DEPLOY_ROOT="/var/www/unicorn/UNICORN_FINAL"
SERVICE_SRC="${DEPLOY_ROOT}/scripts/deepseek-unified.service"
SERVICE_DST="/etc/systemd/system/deepseek-unified.service"
OLD_SERVICE="deepseek-loop.service"
NEW_SERVICE="deepseek-unified.service"

echo "==> [1/6] Checking deployment root..."
if [[ ! -d "$DEPLOY_ROOT" ]]; then
  echo "ERROR: $DEPLOY_ROOT not found. Deploy UNICORN_FINAL first." >&2
  exit 1
fi

echo "==> [2/6] Syntax check..."
node --check "${DEPLOY_ROOT}/scripts/deepseek-unified.js"
echo "    Syntax OK."

echo "==> [3/6] Stopping old deepseek-loop service (if running)..."
systemctl stop "${OLD_SERVICE}" 2>/dev/null || true
systemctl disable "${OLD_SERVICE}" 2>/dev/null || true
echo "    deepseek-loop.service stopped and disabled."

echo "==> [4/6] Installing new systemd unit..."
cp -f "$SERVICE_SRC" "$SERVICE_DST"
systemctl daemon-reload
echo "    Unit installed: $SERVICE_DST"

echo "==> [5/6] Enabling and starting deepseek-unified..."
systemctl enable "${NEW_SERVICE}"
systemctl start  "${NEW_SERVICE}"

sleep 3
STATUS=$(systemctl is-active "${NEW_SERVICE}" 2>/dev/null || true)
echo "    Service status: $STATUS"
if [[ "$STATUS" != "active" ]]; then
  echo "ERROR: Service is not active. Checking logs..." >&2
  journalctl -u "${NEW_SERVICE}" --no-pager -n 30 >&2
  exit 1
fi

echo "==> [6/6] Boot log preview:"
journalctl -u "${NEW_SERVICE}" --no-pager -n 10

echo ""
echo "✅  deepseek-unified is LIVE."
echo "    Monitor: journalctl -u deepseek-unified -f"
echo "    Stop:    systemctl stop deepseek-unified"
echo "    Disable: systemctl disable deepseek-unified && systemctl stop deepseek-unified"
