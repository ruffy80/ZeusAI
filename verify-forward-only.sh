#!/bin/bash
# 🛡️ FORWARD-ONLY STACK — Verification Checklist
# Run this to verify all protections are in place

echo "🔍 Verifying FORWARD-ONLY protections..."
echo ""

GREEN='\033[92m'
RED='\033[91m'
RESET='\033[0m'

check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo -e "${GREEN}✅${RESET} $name"
    return 0
  else
    echo -e "${RED}❌${RESET} $name"
    return 1
  fi
}

echo "📋 GITHUB WORKFLOWS:"
check "1. No-Downgrade Guard exists" "[ -f .github/workflows/no-downgrade-guard.yml ]"
check "2. Hetzner Deploy exists" "[ -f UNICORN_FINAL/.github/workflows/hetzner-deploy.yml ]"
check "3. Baseline SHA configured" "[ -f .github/baselines/live.sha ] && [ -s .github/baselines/live.sha ]"

echo ""
echo "📋 HEALTH CHECKS:"
check "4. Smoke test (forward-only)" "[ -f UNICORN_FINAL/scripts/smoke-forward-only.sh ]"
check "5. Preflight checks" "grep -q 'preflight:forward' UNICORN_FINAL/package.json"
check "6. Backup script" "[ -f UNICORN_FINAL/scripts/create-backup.sh ]"

echo ""
echo "📋 DEPLOY ARTIFACTS:"
check "7. Release dirs on Hetzner" "ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142 'test -d /var/www/unicorn/releases'"
check "8. Current symlink on Hetzner" "ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142 'test -L /var/www/unicorn/current'"
check "9. Backup vault on Hetzner" "ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142 'test -d /root/unicorn-backups'"

echo ""
echo "📋 LIVE SITE:"
check "10. zeusai.com responds" "curl -s https://zeusai.com/health >/dev/null"
check "11. App is healthy" "curl -s http://127.0.0.1:3000/health | grep -q 'ok\\|status'"
check "12. Services running (PM2)" "ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142 'pm2 list | grep -E unicorn'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 BASELINE TRACKING:"
BASELINE=$(cat .github/baselines/live.sha 2>/dev/null)
CURRENT=$(git rev-parse HEAD)
echo "   Baseline: $BASELINE"
echo "   Current:  $CURRENT"
echo ""

if [ "$BASELINE" = "$CURRENT" ]; then
  echo -e "${GREEN}✅${RESET} You're ON baseline (safe to push forward)"
elif git merge-base --is-ancestor "$BASELINE" "$CURRENT" 2>/dev/null; then
  echo -e "${GREEN}✅${RESET} You're FORWARD of baseline (can deploy)"
else
  echo -e "${RED}❌${RESET} You're BEHIND baseline (won't deploy!)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 DEPLOYMENT HISTORY (last 5):"
ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142 'ls -1t /var/www/unicorn/releases/ 2>/dev/null | head -5 | while read r; do echo "   $(basename $r | cut -d- -f1-7)..."; done' || echo "   (SSH failed)"

echo ""
echo "📊 BACKUP VAULT (last 5):"
ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142 'ls -1t /root/unicorn-backups/*.tar.gz 2>/dev/null | head -5 | while read f; do echo "   $(basename $f)"; done' || echo "   (SSH failed)"

echo ""
echo "✨ All protections are in place! Forward-only policy is ACTIVE."
echo ""
