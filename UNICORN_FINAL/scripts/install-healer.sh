#!/usr/bin/env bash
# install-healer.sh — copies PM2 healer to /usr/local/bin and enables systemd timer
# Idempotent. Run on Hetzner via SSH.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/unicorn/UNICORN_FINAL}"
SCRIPTS="$REPO_DIR/scripts"

[ -f "$SCRIPTS/healer-pm2.sh" ] || { echo "missing $SCRIPTS/healer-pm2.sh"; exit 1; }

install -m 0755 "$SCRIPTS/healer-pm2.sh" /usr/local/bin/unicorn-healer.sh
install -m 0644 "$SCRIPTS/unicorn-healer.service" /etc/systemd/system/unicorn-healer.service
install -m 0644 "$SCRIPTS/unicorn-healer.timer"   /etc/systemd/system/unicorn-healer.timer

# Optional: pass DISCORD_WEBHOOK from /var/www/unicorn/.env.auto-connector if present
if [ -f /var/www/unicorn/.env.auto-connector ] && [ ! -f /var/www/unicorn/.env.healer ]; then
  WEBHOOK=$(grep -E '^DISCORD_WEBHOOK=' /var/www/unicorn/.env.auto-connector | head -n1 | cut -d= -f2-)
  if [ -n "${WEBHOOK:-}" ]; then
    printf 'WEBHOOK_URL=%s\n' "$WEBHOOK" > /var/www/unicorn/.env.healer
    chmod 600 /var/www/unicorn/.env.healer
  fi
fi

systemctl daemon-reload
systemctl enable --now unicorn-healer.timer
systemctl --no-pager status unicorn-healer.timer | head -20 || true
echo "✓ unicorn-healer.timer installed and active"
