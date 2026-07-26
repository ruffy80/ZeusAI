#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${LIVE_SMOKE_DOMAIN:-zeusai.pro}"
HOST="${LIVE_SMOKE_HOST:-$DOMAIN}"
MAX_ATTEMPTS="${LIVE_SMOKE_RETRIES:-3}"
CURL_MAX_TIME="${LIVE_SMOKE_CURL_MAX_TIME:-20}"

# Capture only the HTTP status code. Never concatenate a fallback onto a
# partial code (the old `|| echo 000` pattern produced "000000" when curl
# printed 000 on timeout AND the shell also appended 000).
http_code() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 --max-time "$CURL_MAX_TIME" "$url" 2>/dev/null || true)"
  code="$(printf '%s' "$code" | tr -cd '0-9' | head -c 3)"
  if [ -z "$code" ]; then
    code="000"
  fi
  printf '%s' "$code"
}

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local attempt=1
  local code="000"
  local sleep_s=2

  while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    code="$(http_code "$url")"
    if [ "$code" = "$expected" ]; then
      echo "✅ $label → HTTP $code"
      return 0
    fi
    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      echo "⏳ $label → HTTP $code (attempt $attempt/$MAX_ATTEMPTS) — retry in ${sleep_s}s"
      sleep "$sleep_s"
      sleep_s=$((sleep_s * 2))
    fi
    attempt=$((attempt + 1))
  done

  echo "❌ $label → HTTP $code (expected $expected after ${MAX_ATTEMPTS} attempts)"
  exit 1
}

echo "[live-smoke] probing $DOMAIN (retries=$MAX_ATTEMPTS, curl-max=${CURL_MAX_TIME}s)"
check "health" "https://${HOST}/health" 200
check "api health" "https://${HOST}/api/health" 200
# Reject rescue topology even when it returns HTTP 200.
api_body="$(curl -fsS --connect-timeout 8 --max-time 20 "https://${HOST}/api/health" || true)"
if printf '%s' "$api_body" | grep -Eq '"mode"[[:space:]]*:[[:space:]]*"rescue"|zeus-rescue-api'; then
  echo "❌ api health identifies as RESCUE — refusing green smoke"
  exit 1
fi
echo "✅ api health is canonical (not rescue)"
check "pricing" "https://${HOST}/api/pricing/all" 200
check "catalog" "https://${HOST}/api/catalog" 200
check "services" "https://${HOST}/services" 200
# /pricing is SSR-heavier; give it the same retry budget as other checks.
check "pricing page" "https://${HOST}/pricing" 200
echo "[live-smoke] all live checks passed"
