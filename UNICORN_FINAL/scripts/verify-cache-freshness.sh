#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://zeusai.pro}"

echo "[cache-verify] target=$BASE_URL"

HEADERS=$(curl -sSI "$BASE_URL/")
echo "$HEADERS" | grep -i '^cache-control:' | grep -E 'no-cache|no-store' >/dev/null
echo "$HEADERS" | grep -i '^pragma:' | grep -i 'no-cache' >/dev/null
echo "$HEADERS" | grep -i '^expires:' | grep -E '0|Thu, 01 Jan 1970' >/dev/null

echo "[cache-verify] HTML headers OK"

HTML=$(curl -fsSL "$BASE_URL/")
CSS_ASSET=$(echo "$HTML" | grep -Eo '/assets/app\.[a-f0-9]{10}\.css' | head -n1 || true)
JS_ASSET=$(echo "$HTML" | grep -Eo '/assets/app\.[a-f0-9]{10}\.js' | head -n1 || true)

if [[ -z "$CSS_ASSET" || -z "$JS_ASSET" ]]; then
  echo "[cache-verify] missing hashed assets in HTML" >&2
  exit 1
fi

echo "[cache-verify] css=$CSS_ASSET"
echo "[cache-verify] js=$JS_ASSET"

echo "[cache-verify] all checks passed"
