#!/usr/bin/env bash
# Paste this ENTIRE block into Hetzner Cloud Console → server → Console (as root).
# No MacBook needed. Then the Cloud Agent finishes OOB deploy automatically.
set -euo pipefail
mkdir -p ~/.ssh && chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
curl -fsSL https://raw.githubusercontent.com/ruffy80/ZeusAI/main/.deploy/cursor-cloud-deploy_key.pub \
  | while read -r line; do
      body=$(printf '%s' "$line" | awk '{print $1" "$2}')
      [ -n "$body" ] || continue
      grep -Fq "$body" ~/.ssh/authorized_keys 2>/dev/null || printf '%s\n' "$line" >> ~/.ssh/authorized_keys
    done
# Also clear autodeploy kill-switch so main tip can promote
rm -f /etc/zeus-autodeploy.disabled
echo "OK — keys installed; kill-switch cleared. Agent will deploy within ~1 min."
