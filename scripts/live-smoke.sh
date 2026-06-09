#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${LIVE_SMOKE_DOMAIN:-zeusai.pro}"
HOST="${LIVE_SMOKE_HOST:-$DOMAIN}"

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local code
  code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 12 "$url" 2>/dev/null || echo 000)"
  if [ "$code" = "$expected" ]; then
    echo "✅ $label → HTTP $code"
  else
    echo "❌ $label → HTTP $code (expected $expected)"
    exit 1
  fi
}

echo "[live-smoke] probing $DOMAIN"
check "health" "https://${HOST}/health" 200
check "pricing" "https://${HOST}/api/pricing/all" 200
check "services" "https://${HOST}/services" 200
check "pricing page" "https://${HOST}/pricing" 200
echo "[live-smoke] all live checks passed"