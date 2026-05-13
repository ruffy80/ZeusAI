#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://zeusai.pro}"
TIMEOUT="${TIMEOUT:-25}"
RETRIES="${RETRIES:-3}"

json_get() {
  local path="$1"
  local attempt=1
  while [ "$attempt" -le "$RETRIES" ]; do
    if curl -fsS --max-time "$TIMEOUT" -H 'Cache-Control: no-cache' "${BASE_URL}${path}"; then
      return 0
    fi
    if [ "$attempt" -lt "$RETRIES" ]; then
      sleep 1
    fi
    attempt=$((attempt + 1))
  done
  return 1
}

assert_json() {
  local label="$1"
  local path="$2"
  local js="$3"
  local body
  body="$(json_get "$path")"
  node -e "const data=JSON.parse(process.argv[1]); ${js}" "$body"
  echo "✅ $label"
}

assert_text() {
  local label="$1"
  local path="$2"
  local mustContain="$3"
  local body
  body="$(json_get "$path")"
  if [[ "$body" != *"$mustContain"* ]]; then
    echo "❌ $label (missing: $mustContain)" >&2
    exit 1
  fi
  echo "✅ $label"
}

echo "[live-module-mesh-audit] base=${BASE_URL}"

assert_json "core health is healthy" "/health" "if (!((data.status === 'healthy') || (data.status === 'ok') || data.ok === true)) process.exit(1);"

assert_json "backend health + engines are online" "/api/health" "if (!(data.status === 'ok' || data.ok === true)) process.exit(1); if (data.dbConnected === false) process.exit(1); if (data.engines && !Object.values(data.engines).every(Boolean)) process.exit(1);"

assert_json "quantum integrity intact" "/api/quantum-integrity/status" "if (!(data.active === true && data.integrity === 'intact' && (!data.diagnostics || (data.diagnostics.issues || []).length === 0))) process.exit(1);"

assert_json "commerce health watcher is functional" "/api/commerce/health" "if (data.status !== 'ok') process.exit(1); if (data.watch && data.watch.lastScanOk === false) process.exit(1);"

assert_json "unicorn commerce connector is live" "/api/unicorn-commerce/status" "if (data.ok !== true) process.exit(1); if (!Number.isFinite(data.sellsCurrentModules) || data.sellsCurrentModules < 1) process.exit(1);"

assert_json "billion-scale engine is live" "/api/billion-scale/status" "if (data.ok !== true) process.exit(1); if (!Number.isFinite(data.packageCount) || data.packageCount < 1) process.exit(1);"

assert_json "autonomous platform is active" "/api/autonomous/platform/status" "if (!(typeof data.state === 'string' && data.state.includes('AUTONOMOUS'))) process.exit(1);"

ai_body="$(json_get "/api/ai/orchestrator/health")"
ai_summary="$(node -e "const data=JSON.parse(process.argv[1]); if (!Array.isArray(data) || data.length < 1) process.exit(1); const total=data.length; const configured=data.filter(p=>p && p.configured===true).length; const available=data.filter(p=>p && p.available===true).length; process.stdout.write(JSON.stringify({total, configured, available}));" "$ai_body")"
ai_total="$(node -e "const x=JSON.parse(process.argv[1]); process.stdout.write(String(x.total));" "$ai_summary")"
ai_configured="$(node -e "const x=JSON.parse(process.argv[1]); process.stdout.write(String(x.configured));" "$ai_summary")"
ai_available="$(node -e "const x=JSON.parse(process.argv[1]); process.stdout.write(String(x.available));" "$ai_summary")"
if [ "$ai_available" -gt 0 ]; then
  echo "✅ AI orchestrator provider availability (${ai_available}/${ai_total})"
else
  echo "⚠️ AI orchestrator providers listed (${ai_total}) but none currently available/configured (${ai_configured} configured)"
fi

assert_json "innovation engine state is visible" "/api/innovation/status" "if (!(data && typeof data === 'object' && Object.keys(data).length > 0)) process.exit(1);"

assert_json "site snapshot bridge to unicorn backend is healthy" "/snapshot" "if (!(data && data.health && data.health.ok === true)) process.exit(1);"

assert_text "storefront services page is renderable" "/services" "<!doctype html>"

echo "✅ live module mesh audit passed"
printf '{"ok":true,"baseUrl":"%s","timestamp":"%s"}\n' "$BASE_URL" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
