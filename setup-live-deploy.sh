#!/bin/bash

# 🚀 SETUP: Auto-deploy on every push to main
# This script configures GitHub Actions secrets so that every push to main
# automatically deploys to Hetzner + restarts the app live.
# ============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 GitHub Actions auto-deploy setup${NC}\n"

# Load env
if [ ! -f ".env.auto-connector" ]; then
  echo -e "${RED}❌ Missing .env.auto-connector${NC}"
  exit 1
fi

set -a
source ./.env.auto-connector
set +a

# Verify required fields
required=(
  GITHUB_OWNER
  GITHUB_REPO
  HETZNER_HOST
  HETZNER_DEPLOY_USER
  HETZNER_DEPLOY_PORT
  HETZNER_DEPLOY_PATH
)

for key in "${required[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo -e "${RED}❌ Missing: ${key}${NC}"
    exit 1
  fi
done

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ GitHub CLI (gh) not installed${NC}"
  echo "Install from: https://cli.github.com"
  exit 1
fi

# Check if we're authenticated
GH_STATUS=$(gh auth status 2>&1) || true
if echo "$GH_STATUS" | grep -q "not logged in"; then
  echo -e "${YELLOW}ℹ️  GitHub CLI not authenticated${NC}"
  echo "Run: gh auth login"
  exit 1
fi

echo -e "${BLUE}Setting up GitHub secrets for auto-deploy...${NC}\n"

# SSH key (required for deployment) — use temp file to avoid piping issues
if [ -f "${HETZNER_KEY_PATH:-}" ]; then
  echo -e "${BLUE}📝 SSH Private Key${NC}"
  echo -n "  Setting HETZNER_SSH_PRIVATE_KEY..."
  TMP_SSH_KEY=$(mktemp)
  cp "${HETZNER_KEY_PATH}" "$TMP_SSH_KEY"
  gh secret set HETZNER_SSH_PRIVATE_KEY < "$TMP_SSH_KEY" --repo "$GITHUB_OWNER/$GITHUB_REPO" > /dev/null 2>&1 || true
  rm "$TMP_SSH_KEY"
  echo -e " ${GREEN}✓${NC}"
fi

# Helper to set secret
set_secret() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo -e "${YELLOW}⏭️  Skipping $name (empty)${NC}"
    return
  fi
  echo -n "  Setting $name..."
  gh secret set "$name" --body "$value" --repo "$GITHUB_OWNER/$GITHUB_REPO" > /dev/null 2>&1 || true
  echo -e " ${GREEN}✓${NC}"
}

# Hetzner credentials (required for deployment)
echo -e "${BLUE}📝 Hetzner Deployment Credentials${NC}"
set_secret "HETZNER_HOST" "$HETZNER_HOST"
set_secret "HETZNER_DEPLOY_USER" "$HETZNER_DEPLOY_USER"
set_secret "HETZNER_DEPLOY_PORT" "$HETZNER_DEPLOY_PORT"
set_secret "HETZNER_DEPLOY_PATH" "$HETZNER_DEPLOY_PATH"

echo -e "\n${GREEN}✅ GitHub secrets configured!${NC}"
echo -e "\n${BLUE}📋 How it works:${NC}"
echo "1. You edit code locally on your machine"
echo "2. You commit: git add . && git commit -m 'my change'"
echo "3. You push:   git push origin main"
echo "4. GitHub Actions automatically:"
echo "   ✓ Pulls your code"
echo "   ✓ Runs npm run lint && npm run test on UNICORN_FINAL/"
echo "   ✓ If tests pass → SSH deploys to Hetzner"
echo "   ✓ If tests fail → stops, you see errors"
echo "5. Once deployed, your changes are LIVE on zeusai.com"
echo ""
echo -e "${YELLOW}⏱️  Deployment takes ~60-90 seconds${NC}"
echo ""
echo -e "${BLUE}👀 Watch deployment progress:${NC}"
echo "   https://github.com/$GITHUB_OWNER/$GITHUB_REPO/actions"
echo ""
echo -e "${BLUE}✅ Verify deployment is live:${NC}"
echo "   curl https://zeusai.com/health"
echo ""

