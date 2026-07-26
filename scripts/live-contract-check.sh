#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${LIVE_SMOKE_BASE_URL:-https://zeusai.pro}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "[live-contract] base: $BASE_URL"

http_code_only() {
  # Never append a fallback onto a partial curl status (avoids "000000").
  local raw
  raw="$(curl -sS -o "$1" -w '%{http_code}' --connect-timeout 8 --max-time 25 "$2" 2>/dev/null || true)"
  raw="$(printf '%s' "$raw" | tr -cd '0-9' | head -c 3)"
  if [ -z "$raw" ]; then
    raw="000"
  fi
  printf '%s' "$raw"
}

is_json_body() {
  case "$(head -c 1 "$1" 2>/dev/null || true)" in
    '{'|'[') return 0 ;;
    *) return 1 ;;
  esac
}

fetch() {
  local url="$1" out="$2" label="$3"
  local attempts="${LIVE_CONTRACT_RETRIES:-5}"
  local attempt=1
  local code="000"
  local sleep_s=2
  local wants_json=1
  if [[ "$label" == *page* ]]; then
    wants_json=0
  fi

  while [ "$attempt" -le "$attempts" ]; do
    code="$(http_code_only "$out" "$url")"
    if [ "$code" = "200" ] && [ -s "$out" ]; then
      if [ "$wants_json" -eq 0 ] || is_json_body "$out"; then
        break
      fi
      echo "⏳ ${label}: HTTP 200 but non-JSON body (deploy window?) — retry in ${sleep_s}s"
    elif [ "$attempt" -lt "$attempts" ]; then
      echo "⏳ ${label}: HTTP $code (attempt $attempt/$attempts) — retry in ${sleep_s}s"
    fi
    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$sleep_s"
      sleep_s=$((sleep_s * 2))
      if [ "$sleep_s" -gt 16 ]; then sleep_s=16; fi
    fi
    attempt=$((attempt + 1))
  done

  if [ "$code" != "200" ]; then
    echo "❌ ${label}: HTTP $code from $url"
    head -c 160 "$out" 2>/dev/null || true
    echo
    exit 1
  fi
  if [ ! -s "$out" ]; then
    echo "❌ ${label}: empty body from $url"
    exit 1
  fi
  if [ "$wants_json" -eq 1 ] && ! is_json_body "$out"; then
    echo "❌ ${label}: non-JSON body from $url after ${attempts} attempts"
    head -c 120 "$out" || true
    echo
    exit 1
  fi
}

fetch "${BASE_URL}/health" "${tmp_dir}/health.json" "site health"
fetch "${BASE_URL}/api/health" "${tmp_dir}/api-health.json" "api health"
fetch "${BASE_URL}/snapshot" "${tmp_dir}/snapshot.json" "snapshot"
fetch "${BASE_URL}/api/pricing/all" "${tmp_dir}/pricing.json" "pricing"
fetch "${BASE_URL}/api/catalog" "${tmp_dir}/catalog.json" "catalog"
curl -fsS --max-time 20 "${BASE_URL}/services" -o "${tmp_dir}/services.html"
curl -fsS --max-time 20 "${BASE_URL}/pricing" -o "${tmp_dir}/pricing.html"

python3 - "${tmp_dir}/health.json" "${tmp_dir}/snapshot.json" "${tmp_dir}/pricing.json" "${tmp_dir}/api-health.json" "${tmp_dir}/catalog.json" <<'PY'
import json
import sys

health_path, snapshot_path, pricing_path, api_health_path, catalog_path = sys.argv[1:6]

def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read().strip()
    if not raw:
        raise ValueError(f'empty json file: {path}')
    return json.loads(raw)

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

api_health = read_json(api_health_path)
must(isinstance(api_health, dict), 'api health is not an object')
must(api_health.get('mode') != 'rescue', 'api health is RESCUE mode')
must(api_health.get('service') != 'zeus-rescue-api', 'api health is zeus-rescue-api')
must(
    api_health.get('ok') is True or api_health.get('status') in ('ok', 'healthy'),
    'api health does not indicate OK',
)

catalog = read_json(catalog_path)
if isinstance(catalog, list):
    catalog_n = len(catalog)
elif isinstance(catalog, dict):
    catalog_n = int(catalog.get('count') or len(catalog.get('items') or catalog.get('services') or []) or 0)
else:
    catalog_n = 0
must(catalog.get('mode') != 'rescue' if isinstance(catalog, dict) else True, 'catalog is rescue mode')
must(catalog_n > 3, f'catalog too small for production ({catalog_n})')

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

print(f"✅ health ok, api canonical, catalog={catalog_n}, snapshot services={len(snapshot_services)}, pricing entries={pricing_count}")
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
