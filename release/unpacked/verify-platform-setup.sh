#!/bin/bash

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

ok() { echo -e "${GREEN}✅ $1${NC}"; PASS=$((PASS+1)); }
ko() { echo -e "${RED}❌ $1${NC}"; FAIL=$((FAIL+1)); }

echo -e "${BLUE}Platform setup verification${NC}\n"

if [ ! -f .env.auto-connector ]; then
  ko "Missing .env.auto-connector"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./.env.auto-connector
set +a

SSH_DEPLOY_USER="${HETZNER_DEPLOY_USER:-${HETZNER_USER:-root}}"
SSH_DEPLOY_PORT="${HETZNER_DEPLOY_PORT:-22}"
GITHUB_WEBHOOK_URL="${GITHUB_WEBHOOK_URL:-}"
HETZNER_WEBHOOK_URL="${HETZNER_WEBHOOK_URL:-}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-${HETZNER_WEBHOOK_SECRET:-}}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
HETZNER_API_VALUE="${HETZNER_API_KEY:-${HETZNER_API_TOKEN:-}}"
HETZNER_KEY_FILE="${HETZNER_KEY_PATH:-${HETZNER_SSH_KEY_PATH:-}}"

echo "1) GitHub"
if curl -s -H "Authorization: Bearer ${GITHUB_TOKEN:-}" https://api.github.com/user | grep -q '"login"'; then
  ok "GitHub token valid"
else
  ko "GitHub token invalid"
fi

if [ -n "${GITHUB_OWNER:-}" ] && [ -n "${GITHUB_REPO:-}" ] && \
  curl -s -H "Authorization: Bearer ${GITHUB_TOKEN:-}" "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}" | grep -q '"full_name"'; then
  ok "GitHub repository reachable"
else
  ko "GitHub repository not reachable"
fi

echo "\n2) Vercel"
if curl -s -H "Authorization: Bearer ${VERCEL_TOKEN:-}" https://api.vercel.com/v2/user | grep -q '"email"'; then
  ok "Vercel token valid"
else
  ko "Vercel token invalid"
fi

VERCEL_SCOPE_QUERY=""
if [ -n "${VERCEL_TEAM_ID:-}" ]; then
  VERCEL_SCOPE_QUERY="?teamId=${VERCEL_TEAM_ID}"
elif [ -n "${VERCEL_ORG_ID:-}" ]; then
  VERCEL_SCOPE_QUERY="?teamId=${VERCEL_ORG_ID}"
fi

if [ -n "${VERCEL_PROJECT_ID:-}" ] && \
  curl -s -H "Authorization: Bearer ${VERCEL_TOKEN:-}" "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}${VERCEL_SCOPE_QUERY}" | grep -q '"id"'; then
  ok "Vercel project reachable"
else
  ko "Vercel project not reachable"
fi

echo "\n3) Hetzner"
if curl -s -H "Authorization: Bearer ${HETZNER_API_VALUE:-}" https://api.hetzner.cloud/v1/servers | grep -q '"servers"'; then
  ok "Hetzner API key valid"
else
  ko "Hetzner API key invalid"
fi

if [ -n "${HETZNER_KEY_FILE:-}" ] && [ -f "${HETZNER_KEY_FILE:-}" ]; then
  if ssh -i "${HETZNER_KEY_FILE}" -p "${SSH_DEPLOY_PORT}" -o BatchMode=yes -o ConnectTimeout=8 "${SSH_DEPLOY_USER}@${HETZNER_HOST}" "echo ok" >/dev/null 2>&1; then
    ok "SSH connectivity OK"
  else
    ko "SSH connectivity failed"
  fi
else
  ko "HETZNER_KEY_PATH/HETZNER_SSH_KEY_PATH is missing or file not found"
fi

if ssh -i "${HETZNER_KEY_FILE:-/dev/null}" -p "${SSH_DEPLOY_PORT}" -o BatchMode=yes -o ConnectTimeout=8 "${SSH_DEPLOY_USER}@${HETZNER_HOST:-127.0.0.1}" "test -d '${HETZNER_DEPLOY_PATH:-/tmp}'" >/dev/null 2>&1; then
  ok "Hetzner deploy directory exists"
else
  ko "Hetzner deploy directory missing"
fi

if [ -n "${HETZNER_WEBHOOK_URL}" ]; then
  if curl -sS -m 8 "${HETZNER_WEBHOOK_URL%/webhook/*}/health" >/dev/null 2>&1 || curl -sS -m 8 "${HETZNER_WEBHOOK_URL}" >/dev/null 2>&1; then
    ok "Hetzner webhook endpoint reachable"
  else
    ko "Hetzner webhook endpoint unreachable"
  fi
fi

echo "\n4) Webhooks"
if [ -n "${GITHUB_WEBHOOK_URL}" ]; then
  ok "GITHUB_WEBHOOK_URL configured"
else
  ko "GITHUB_WEBHOOK_URL missing"
fi

if [ -n "${HETZNER_WEBHOOK_URL}" ]; then
  ok "HETZNER_WEBHOOK_URL configured"
else
  ko "HETZNER_WEBHOOK_URL missing"
fi

if [ -n "${WEBHOOK_SECRET}" ]; then
  ok "Webhook secret configured"
else
  ko "WEBHOOK_SECRET/HETZNER_WEBHOOK_SECRET missing"
fi

if [ -n "${ADMIN_SECRET}" ]; then
  ok "ADMIN_SECRET configured"
else
  ko "ADMIN_SECRET missing"
fi

echo "\n5) Workflow files"
for f in \
  .github/workflows/vercel-deploy.yml \
  setup-platform-auto-connect.sh \
  verify-platform-setup.sh \
  .env.auto-connector.example
do
  if [ -f "$f" ]; then
    ok "$f exists"
  else
    ko "$f missing"
  fi
done

echo "\nSummary"
echo -e "${GREEN}Passed: ${PASS}${NC}"
echo -e "${RED}Failed: ${FAIL}${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${YELLOW}Fix the failed checks, then run:${NC} bash verify-platform-setup.sh"
  exit 1
fi

echo -e "\n${GREEN}All checks passed. Git push to main can trigger Vercel + Hetzner deploy.${NC}"
