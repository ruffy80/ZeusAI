#!/usr/bin/env bash
# =============================================================================
# PASTE THIS ENTIRE BLOCK into Hetzner Cloud Console → server → Console
# Login as: root
# No MacBook. No curl required (keys are hardcoded below).
# After this, the Cloud Agent SSHes in and finishes deploy automatically.
# =============================================================================
set -euo pipefail

mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

install_pub() {
  local line="$1"
  local body
  body=$(printf '%s' "$line" | awk '{print $1" "$2}')
  [ -n "$body" ] || return 0
  grep -Fq "$body" ~/.ssh/authorized_keys 2>/dev/null || printf '%s\n' "$line" >> ~/.ssh/authorized_keys
}

# Cloud Agent recover key (matches Cursor secret HETZNER_SSH_PRIVATE_KEY on this run)
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQdeHHTLRraxxanahITSWXxtbQ5CnR6ya3G40TXkR7Q cursor-cloud-zeus-deploy-recover'
# Ephemeral agent key
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIq+uCeIYtCITbLBmKTtELMMlggITZPAkxVdbp51y4PW zeus-cloud-agent-ephemeral'
# Host agent key (listed in ensure-cursor-cloud-ssh.sh; signing often refused on Cursor VMs)
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPqiJsBjAsv4KymedFcUR891X1lgC90DW8yMtjcHJ/p0 cursor-cloud-agent'
# Historical working Cloud Agent file key
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC3ls7I4Y9XlmpIBjCF30qpQt2z89FYIPhg+gzhsYGM5 cursor-cloud-zeus-deploy'
# c3b6 activation key
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHA7c/ZKX3ZBpNC9vmgiUcKMhogxZFw6Hfg5LhH6QTm0 cursor-cloud-zeus-deploy-c3b6'

# Clear kill-switches so poller + healer can run
rm -f /etc/zeus-autodeploy.disabled /etc/zeus-healer.disabled

# Best-effort: promote origin/main via on-box resuscitator (no GitHub Actions)
if [ -x /var/www/unicorn/UNICORN_FINAL/scripts/zeus-poller-resuscitate.sh ]; then
  ZEUS_INSTALL_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQdeHHTLRraxxanahITSWXxtbQ5CnR6ya3G40TXkR7Q cursor-cloud-zeus-deploy-recover' \
    bash /var/www/unicorn/UNICORN_FINAL/scripts/zeus-poller-resuscitate.sh || true
fi

echo "OK — SSH keys installed; kill-switch cleared."
echo "Cloud Agent will deploy within ~1 minute. You can close this console."
hostname
test -f /etc/zeus-autodeploy.disabled && echo KILL=1 || echo KILL=0
wc -l ~/.ssh/authorized_keys
