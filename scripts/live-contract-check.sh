#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${LIVE_SMOKE_BASE_URL:-https://zeusai.pro}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "[live-contract] base: $BASE_URL"

curl -fsS --max-time 20 "${BASE_URL}/health" -o "${tmp_dir}/health.json"
curl -fsS --max-time 20 "${BASE_URL}/snapshot" -o "${tmp_dir}/snapshot.json"
curl -fsS --max-time 20 "${BASE_URL}/api/pricing/all" -o "${tmp_dir}/pricing.json"
curl -fsS --max-time 20 "${BASE_URL}/services" -o "${tmp_dir}/services.html"
curl -fsS --max-time 20 "${BASE_URL}/pricing" -o "${tmp_dir}/pricing.html"

python3 - "${tmp_dir}/health.json" "${tmp_dir}/snapshot.json" "${tmp_dir}/pricing.json" <<'PY'
import json
import sys

health_path, snapshot_path, pricing_path = sys.argv[1:4]

def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def must(cond, message):
    if not cond:
        print(f"❌ {message}")
        sys.exit(1)

health = read_json(health_path)
must(
    isinstance(health, dict) and (
        health.get('ok') is True
        or health.get('status') in ('ok', 'healthy')
    ),
    'health endpoint does not indicate OK',
)

snapshot = read_json(snapshot_path)
snapshot_services = snapshot.get('services') if isinstance(snapshot, dict) else None
snapshot_services = snapshot_services if isinstance(snapshot_services, list) else []
must(len(snapshot_services) > 0, 'snapshot has zero services')

pricing = read_json(pricing_path)
pricing_count = 0
if isinstance(pricing, dict):
  if isinstance(pricing.get('services'), list):
    pricing_count = len(pricing.get('services'))
  elif isinstance(pricing.get('pricing'), list):
    pricing_count = len(pricing.get('pricing'))
  elif isinstance(pricing.get('prices'), dict):
    pricing_count = len(pricing.get('prices'))
  elif isinstance(pricing.get('basePrices'), dict):
    pricing_count = len(pricing.get('basePrices'))
must(pricing_count > 0, 'pricing API has zero plans/services')

print(f"✅ health ok, snapshot services={len(snapshot_services)}, pricing entries={pricing_count}")
PY

check_html_contract() {
  local file="$1"
  local label="$2"

  local cards_count
  cards_count="$( (grep -Eo '/checkout([^"[:space:]]*)?' "$file" || true) | wc -l | tr -d ' ')"

  if [ "${cards_count:-0}" -lt 1 ]; then
    echo "❌ ${label}: no service cards/checkouts detected"
    exit 1
  fi

  if ! grep -Eiq '(BTC|₿)' "$file"; then
    echo "❌ ${label}: BTC marker missing"
    exit 1
  fi

  if ! grep -Eiq '(\$[0-9]|USD)' "$file"; then
    echo "❌ ${label}: USD marker missing"
    exit 1
  fi

  echo "✅ ${label}: cards=${cards_count}, BTC+USD markers present"
}

check_html_contract "${tmp_dir}/services.html" "services page"
check_html_contract "${tmp_dir}/pricing.html" "pricing page"

echo "[live-contract] all checks passed"
