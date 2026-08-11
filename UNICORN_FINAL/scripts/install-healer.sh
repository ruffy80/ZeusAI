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

# ── Hang watchdog (accept-but-HTTP-hang detector) ────────────────────────────
# Installed alongside the general healer. It runs the repo copy of
# scripts/hang-watchdog.js directly (ExecStart references $REPO_DIR) so a code
# deploy updates the logic without re-copying a binary.
if [ -f "$SCRIPTS/hang-watchdog.service" ] && [ -f "$SCRIPTS/hang-watchdog.timer" ]; then
  install -m 0644 "$SCRIPTS/hang-watchdog.service" /etc/systemd/system/hang-watchdog.service
  install -m 0644 "$SCRIPTS/hang-watchdog.timer"   /etc/systemd/system/hang-watchdog.timer
fi

systemctl daemon-reload
# Kill-switch: when present, install units but do NOT arm the timer.
# Used during OOB deploys while GitHub Actions is blocked / healers thrash.
if [ -f /etc/zeus-healer.disabled ]; then
  systemctl disable --now unicorn-healer.timer >/dev/null 2>&1 || true
  systemctl stop unicorn-healer.service >/dev/null 2>&1 || true
  systemctl disable --now hang-watchdog.timer >/dev/null 2>&1 || true
  echo "✓ healer + hang-watchdog units installed; timers LEFT DISABLED (/etc/zeus-healer.disabled)"
  exit 0
fi
systemctl enable --now unicorn-healer.timer
if [ -f /etc/systemd/system/hang-watchdog.timer ]; then
  systemctl enable --now hang-watchdog.timer >/dev/null 2>&1 \
    && echo "✓ hang-watchdog.timer installed and active" \
    || echo "⚠ hang-watchdog.timer install skipped (systemd unavailable?)"
fi
systemctl --no-pager status unicorn-healer.timer | head -20 || true
echo "✓ unicorn-healer.timer installed and active"
