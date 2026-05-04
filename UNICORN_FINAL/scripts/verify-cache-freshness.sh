#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://zeusai.pro}"

echo "[cache-verify] target=$BASE_URL"

# Retry helper: 5 attempts, 3s between, tolerates 502/503 during PM2 reload
fetch_with_retry() {
  local mode="$1" # "headers" or "body"
  local attempt
  for attempt in 1 2 3 4 5; do
    if [[ "$mode" == "headers" ]]; then
      if curl -sSI --max-time 15 "$BASE_URL/" 2>/tmp/cv.err; then
        return 0
      fi
    else
      if curl -fsSL --max-time 20 "$BASE_URL/" 2>/tmp/cv.err; then
        return 0
      fi
    fi
    echo "[cache-verify] attempt $attempt/5 failed ($(cat /tmp/cv.err 2>/dev/null | tr -d '\n')), retrying in 3s..." >&2
    sleep 3
  done
  echo "[cache-verify] giving up after 5 attempts" >&2
  return 1
}

HEADERS=$(fetch_with_retry headers)
echo "$HEADERS" | grep -i '^cache-control:' | grep -E 'no-cache|no-store' >/dev/null
echo "$HEADERS" | grep -i '^pragma:' | grep -i 'no-cache' >/dev/null
echo "$HEADERS" | grep -i '^expires:' | grep -E '0|Thu, 01 Jan 1970' >/dev/null

echo "[cache-verify] HTML headers OK"

HTML=$(fetch_with_retry body)
CSS_ASSET=$(echo "$HTML" | grep -Eo '/assets/app\.[a-f0-9]{10}\.css' | head -n1 || true)
JS_ASSET=$(echo "$HTML" | grep -Eo '/assets/app\.[a-f0-9]{10}\.js' | head -n1 || true)

if [[ -z "$CSS_ASSET" || -z "$JS_ASSET" ]]; then
  echo "[cache-verify] missing hashed assets in HTML" >&2
  exit 1
fi

echo "[cache-verify] css=$CSS_ASSET"
echo "[cache-verify] js=$JS_ASSET"

echo "[cache-verify] all checks passed"
