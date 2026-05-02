#!/bin/bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

need_status() {
  local path="$1"
  local expected="${2:-200}"
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL$path")
  [[ "$got" == "$expected" ]] || fail "$path returned $got (expected $expected)"
  echo "[OK] $path -> $got"
}

need_marker() {
  local path="$1"
  local marker="$2"
  local body
  body=$(curl -fsSL "$BASE_URL$path") || fail "$path could not be fetched"
  printf '%s' "$body" | grep -Fq "$marker" || fail "$path missing marker: $marker"
  echo "[OK] $path contains marker: $marker"
}

need_json_field() {
  local path="$1"
  local python_expr="$2"
  local label="$3"
  local body
  body=$(curl -fsSL "$BASE_URL$path") || fail "$path could not be fetched"
  printf '%s' "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert ($python_expr), '$label'" || fail "$path failed JSON assertion: $label"
  echo "[OK] $path JSON assertion: $label"
}

echo "[SMOKE] Core site routes"
need_status "/"
need_status "/marketplace"
need_status "/crypto-fiat-bridge"
need_status "/trust"
need_status "/frontier"
need_status "/gift"
need_status "/cancel"
need_status "/store"

echo "[SMOKE] Visible UI markers"
need_marker "/trust" "Signature verifier"
need_marker "/trust" "Revenue 24h"
need_marker "/frontier" "Top inventions"
need_marker "/gift?c=GIFT-SMOKE" "Redeem a gift code"
need_marker "/crypto-fiat-bridge" "Crypto Bridge"
need_marker "/marketplace" "Marketplace · Master Catalog"

echo "[SMOKE] APIs and contracts"
need_status "/health"
need_status "/openapi.json"
need_json_field "/api/kpi/daily" "d.get('ok') is True and 'revenue24Usd' in d" "kpi daily payload"
need_json_field "/api/probe/business-funnel" "d.get('ok') is True and d.get('pass') is True" "business funnel passes"
need_json_field "/api/frontier/status" "isinstance(d.get('inventions'), list) and len(d.get('inventions')) >= 12" "frontier inventions array"
need_json_field "/api/refund/guarantee" "bool(d.get('signature'))" "refund guarantee signed"
need_json_field "/api/pledge" "bool(d.get('signature'))" "pledge signed"

echo "[SMOKE] Crypto Bridge APIs"
need_status "/api/crypto-bridge/btc-rate"
need_status "/api/crypto-bridge/services"

echo "[OK] Production smoke tests passed."
