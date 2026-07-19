#!/usr/bin/env bash
set -euo pipefail

# UPGRADE-ONLY CONTRACT: rollback / downgrade paths are permanently disabled.
# Recover by shipping a forward-fix commit on main and promoting it through
# scripts/deploy-atomic-forward.sh (canary + smoke gated).

echo "Rollback is permanently disabled by the upgrade-only deploy contract."
echo "Create a new forward-fix commit and deploy it through scripts/deploy-atomic-forward.sh."
echo "Downgrades are never allowed — not even with environment overrides."
exit 2
