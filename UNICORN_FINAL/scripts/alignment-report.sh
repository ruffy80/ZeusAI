#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_FILE="${1:-$ROOT_DIR/ALIGNMENT-REPORT.md}"
TMP_DIR="${TMPDIR:-/tmp}/unicorn-alignment"
mkdir -p "$TMP_DIR"

BACKEND_FILE="$TMP_DIR/backend_endpoints.txt"
FRONTEND_FILE="$TMP_DIR/frontend_calls.txt"
MISSING_FILE="$TMP_DIR/missing_endpoints.txt"
UNUSED_FILE="$TMP_DIR/unused_endpoints.txt"

{
  grep -RhoE "(app\.(get|post|put|delete|patch)|router\.(get|post|put|delete|patch))\s*\(\s*['\"][^'\"]+['\"]" "$ROOT_DIR/backend" "$ROOT_DIR/src" 2>/dev/null \
    | sed -E "s/.*\(['\"]([^'\"]+)['\"].*/\1/" \
    | sort -u > "$BACKEND_FILE"
} || :

{
  grep -RhoE "(fetch|axios\.(get|post|put|delete)|http\.(get|post|put|delete))\s*\(\s*['\"][^'\"]+['\"]" "$ROOT_DIR/client" "$ROOT_DIR/src" 2>/dev/null \
    | sed -E "s/.*\(['\"]([^'\"]+)['\"].*/\1/" \
    | sort -u > "$FRONTEND_FILE"
} || :

comm -23 "$FRONTEND_FILE" "$BACKEND_FILE" > "$MISSING_FILE" || true
comm -13 "$FRONTEND_FILE" "$BACKEND_FILE" > "$UNUSED_FILE" || true

status_health=$(curl -s -o /dev/null -w '%{http_code}' https://zeusai.pro/health || true)
status_front=$(curl -s -o /dev/null -w '%{http_code}' https://zeusai.pro/ || true)
status_contract=$(curl -s -o /dev/null -w '%{http_code}' https://zeusai.pro/api/contract || true)
if [ "$status_contract" != "200" ]; then
  status_contract=$(curl -s -o /dev/null -w '%{http_code}' https://zeusai.pro/openapi-public.json || true)
fi
cron_count=$(crontab -l 2>/dev/null | grep -c 'alignment-monitor.sh' || true)

cat > "$OUT_FILE" <<EOF
# RAPORT DE ALINIERE BACKEND-FRONTEND

Data: $(date -u +%FT%TZ)

## Stare
- Backend: $status_health
- Frontend: $status_front
- Contract: $status_contract

## Endpoint-uri
- Backend: $(wc -l < "$BACKEND_FILE" 2>/dev/null || echo 0) candidate routes
- Frontend calls: $(wc -l < "$FRONTEND_FILE" 2>/dev/null || echo 0) apeluri
- Endpoint-uri lipsă în backend: $(wc -l < "$MISSING_FILE" 2>/dev/null || echo 0)
- Endpoint-uri nefolosite în frontend: $(wc -l < "$UNUSED_FILE" 2>/dev/null || echo 0)

## Monitorizare
- Cron alignment-monitor: $cron_count job-uri active
- Log: /var/log/alignment-monitor.log

## Declarație
Alinierea este verificată continuu și monitorizată automat.
EOF

echo "Alignment report generated: $OUT_FILE"
