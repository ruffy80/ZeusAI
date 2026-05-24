#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://zeusai.pro}"

echo "[cache-verify] target=$BASE_URL"

# Retry helper: 10 attempts, 3s between, tolerates 502/503 during PM2 reload
fetch_with_retry() {
  local mode="$1" # "headers" or "body"
  local attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    local ok=0
    if [[ "$mode" == "headers" ]]; then
      curl -sSI --max-time 15 "$BASE_URL/" > /tmp/cv.out 2> /tmp/cv.err && ok=1 || ok=0
    else
      curl -fsSL --max-time 20 "$BASE_URL/" > /tmp/cv.out 2> /tmp/cv.err && ok=1 || ok=0
    fi
    if [[ $ok -eq 1 ]]; then
      cat /tmp/cv.out 2>/dev/null || true
      return 0
    fi
    local err_msg="unknown error"
    if [[ -f /tmp/cv.err ]]; then
      err_msg=$(cat /tmp/cv.err | tr -d '\n' || echo "no error details")
    fi
    echo "[cache-verify] attempt $attempt/10 failed ($err_msg), retrying in 3s..." >&2
    sleep 3
  done
  echo "[cache-verify] giving up after 10 attempts" >&2
  return 1
}

# Temporarily disable exit on error for the fetch to handle failures gracefully
set +e
HEADERS=$(fetch_with_retry headers)
set -e
if [[ -z "$HEADERS" ]]; then
  echo "[cache-verify] failed to get headers" >&2
  exit 1
fi
echo "$HEADERS" | grep -i '^cache-control:' | grep -E 'no-cache|no-store' >/dev/null
echo "$HEADERS" | grep -i '^pragma:' | grep -i 'no-cache' >/dev/null
echo "$HEADERS" | grep -i '^expires:' | grep -E '0|Thu, 01 Jan 1970' >/dev/null

echo "[cache-verify] HTML headers OK"

set +e
HTML=$(fetch_with_retry body)
set -e
if [[ -z "$HTML" ]]; then
  echo "[cache-verify] failed to get HTML body" >&2
  exit 1
fi
CSS_ASSET=$(echo "$HTML" | grep -Eo '/assets/app\.[a-f0-9]{10}\.css' | head -n1 || true)
JS_ASSET=$(echo "$HTML" | grep -Eo '/assets/app\.[a-f0-9]{10}\.js' | head -n1 || true)

if [[ -z "$CSS_ASSET" || -z "$JS_ASSET" ]]; then
  echo "[cache-verify] missing hashed assets in HTML" >&2
  exit 1
fi

echo "[cache-verify] css=$CSS_ASSET"
echo "[cache-verify] js=$JS_ASSET"

echo "[cache-verify] all checks passed"
