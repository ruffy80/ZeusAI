#!/bin/bash

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 GitHub + Vercel + Hetzner bootstrap${NC}\n"

if [ ! -f ".env.auto-connector" ]; then
  echo -e "${RED}❌ Missing .env.auto-connector${NC}"
  echo "Copy .env.auto-connector.example then fill values."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./.env.auto-connector
set +a

required=(
  GITHUB_OWNER
  GITHUB_REPO
  ADMIN_SECRET
  HETZNER_HOST
  HETZNER_USER
  HETZNER_DEPLOY_USER
  HETZNER_DEPLOY_PORT
  HETZNER_SSH_PUBLIC_KEY
  HETZNER_DEPLOY_PATH
)

for key in "${required[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo -e "${RED}❌ Missing variable: ${key}${NC}"
    exit 1
  fi
done

HETZNER_API_KEY="${HETZNER_API_KEY:-${HETZNER_API_TOKEN:-}}"
HETZNER_KEY_PATH="${HETZNER_KEY_PATH:-${HETZNER_SSH_KEY_PATH:-}}"

if [ -z "${HETZNER_API_KEY}" ]; then
  echo -e "${RED}❌ Missing variable: HETZNER_API_KEY or HETZNER_API_TOKEN${NC}"
  exit 1
fi

if [ -z "${HETZNER_KEY_PATH}" ]; then
  echo -e "${RED}❌ Missing variable: HETZNER_KEY_PATH or HETZNER_SSH_KEY_PATH${NC}"
  exit 1
fi

if [ ! -f "${HETZNER_KEY_PATH}" ]; then
  echo -e "${RED}❌ SSH key not found: ${HETZNER_KEY_PATH}${NC}"
  exit 1
fi

chmod 600 "${HETZNER_KEY_PATH}"

SSH_DEPLOY_USER="${HETZNER_DEPLOY_USER:-${HETZNER_USER}}"
SSH_DEPLOY_PORT="${HETZNER_DEPLOY_PORT:-22}"
GITHUB_WEBHOOK_URL="${GITHUB_WEBHOOK_URL:-http://${HETZNER_HOST}:3001/webhook/github}"
HETZNER_WEBHOOK_URL="${HETZNER_WEBHOOK_URL:-http://${HETZNER_HOST}:3001/webhook/update}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-${HETZNER_WEBHOOK_SECRET:-}}"

echo -e "${YELLOW}[1/4] Testing SSH access...${NC}"
ssh -i "${HETZNER_KEY_PATH}" -p "${SSH_DEPLOY_PORT}" -o BatchMode=yes -o ConnectTimeout=8 "${SSH_DEPLOY_USER}@${HETZNER_HOST}" "echo SSH_OK" >/dev/null
echo -e "${GREEN}✅ SSH access OK${NC}"

echo -e "${YELLOW}[2/4] Bootstrapping Hetzner runtime...${NC}"
ssh -i "${HETZNER_KEY_PATH}" -p "${SSH_DEPLOY_PORT}" -o StrictHostKeyChecking=no "${SSH_DEPLOY_USER}@${HETZNER_HOST}" "
  set -e
  if [ \"\$(id -u)\" -eq 0 ]; then SUDO=''; else SUDO='sudo'; fi
  \${SUDO} apt-get update -y
  \${SUDO} apt-get install -y curl git nginx
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | \${SUDO} bash -
    \${SUDO} apt-get install -y nodejs
  fi
  \${SUDO} mkdir -p '${HETZNER_DEPLOY_PATH}'
  \${SUDO} chown -R '${SSH_DEPLOY_USER}:${SSH_DEPLOY_USER}' '${HETZNER_DEPLOY_PATH}'
"
echo -e "${GREEN}✅ Hetzner runtime ready${NC}"

echo -e "${YELLOW}[3/4] Printing GitHub Secrets to configure...${NC}"
cat <<EOF

Add these repository secrets in GitHub:

- HETZNER_HOST=${HETZNER_HOST}
- HETZNER_USER=${HETZNER_USER}
- HETZNER_DEPLOY_USER=${HETZNER_DEPLOY_USER}
- HETZNER_DEPLOY_PORT=${HETZNER_DEPLOY_PORT}
- HETZNER_API_KEY=${HETZNER_API_KEY}
- HETZNER_API_TOKEN=${HETZNER_API_KEY}
- HETZNER_DEPLOY_PATH=${HETZNER_DEPLOY_PATH}
- HETZNER_SSH_PUBLIC_KEY=${HETZNER_SSH_PUBLIC_KEY}
- HETZNER_SSH_PRIVATE_KEY=(content of ${HETZNER_KEY_PATH})
- GITHUB_WEBHOOK_URL=${GITHUB_WEBHOOK_URL}
- HETZNER_WEBHOOK_URL=${HETZNER_WEBHOOK_URL}
- WEBHOOK_SECRET=${WEBHOOK_SECRET}
- HETZNER_WEBHOOK_SECRET=${HETZNER_WEBHOOK_SECRET:-${WEBHOOK_SECRET}}
- ADMIN_SECRET=${ADMIN_SECRET}

GitHub secrets page:
https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/settings/secrets/actions

EOF

echo -e "${YELLOW}[4/4] Final checks...${NC}"
echo "- Workflow file: .github/workflows/hetzner-deploy.yml"
echo "- Deployment app path: UNICORN_FINAL"

echo -e "\n${GREEN}✅ Bootstrap complete.${NC}"
echo "Next: git add/commit/push to main, then watch GitHub Actions."
