#!/usr/bin/env bash
set -euo pipefail

# scripts/healthcheck-unicorn.sh — SaaS healthcheck for deploy workflow
# Usage: bash scripts/healthcheck-unicorn.sh <base_url>

BASE_URL="${1:-http://localhost:3000}"

fail() {
  echo "[FAIL] $1"
  exit 1
}

curl -fs --max-time 5 "$BASE_URL/api/health" || fail "/api/health endpoint failed"
curl -fs --max-time 5 "$BASE_URL/api/catalog" || fail "/api/catalog endpoint failed"
curl -fs --max-time 5 "$BASE_URL" || fail "Homepage failed"

echo "OK"
exit 0
