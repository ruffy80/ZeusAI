#!/usr/bin/env bash
# smoke-tests.sh — Real HTTP smoke tests against a running ZeusAI/Unicorn backend.
#
# Usage:
#   BASE_URL=http://127.0.0.1:3000 bash scripts/smoke-tests.sh
#   bash scripts/smoke-tests.sh https://zeusai.pro
#
# Exits 0 if all required endpoints respond with a 2xx (or 401 for auth-gated
# endpoints, which still proves the route is wired). Exits 1 on any failure.
#
# Used by:
#   - npm run smoke (local)
#   - .github/workflows/diagnose-and-repair.yml (Hetzner SSH)

set -u

BASE="${1:-${BASE_URL:-http://127.0.0.1:3000}}"
RETRIES="${SMOKE_RETRIES:-6}"
SLEEP_BETWEEN="${SMOKE_SLEEP:-3}"

# Endpoints: "PATH|allowed_status_codes_csv|label"
# /api/modules is auth-gated → 401 still proves the route exists; we also
# probe the public sibling /api/module-registry.
ROUTES=(
  "/|200,301,302|root"
  "/api/health|200|api-health"
  "/api/services|200|api-services"
  "/api/module-registry|200|api-module-registry"
  "/api/modules|200,401|api-modules"
  "/api/btc/rate|200|api-btc-rate"
)

pass=0
fail=0
fail_lines=()

probe() {
  local path="$1" allowed="$2" label="$3"
  local url="${BASE%/}${path}"
  local attempt=0
  local code=""
  while [ "$attempt" -lt "$RETRIES" ]; do
    code=$(curl -sS -o /dev/null -m 10 -w '%{http_code}' \
      -H 'Cache-Control: no-cache' -H 'Accept: application/json,*/*' \
      "$url" 2>/dev/null || echo "000")
    case ",${allowed}," in
      *",${code},"*)
        printf '  [ok]   %-26s %s -> %s\n' "$label" "$url" "$code"
        pass=$((pass+1))
        return 0
        ;;
    esac
    attempt=$((attempt+1))
    [ "$attempt" -lt "$RETRIES" ] && sleep "$SLEEP_BETWEEN"
  done
  printf '  [FAIL] %-26s %s -> %s (allowed: %s)\n' "$label" "$url" "$code" "$allowed"
  fail=$((fail+1))
  fail_lines+=("${label} ${url} got ${code} expected ${allowed}")
  return 1
}

echo "[smoke] base=${BASE} retries=${RETRIES} sleep=${SLEEP_BETWEEN}s"
for entry in "${ROUTES[@]}"; do
  IFS='|' read -r path allowed label <<<"$entry"
  probe "$path" "$allowed" "$label" || true
done

total=$((pass+fail))
echo "[smoke] result: ${pass}/${total} passed, ${fail} failed"
if [ "$fail" -gt 0 ]; then
  echo "[smoke] failures:"
  for line in "${fail_lines[@]}"; do echo "  - $line"; done
  exit 1
fi
exit 0
