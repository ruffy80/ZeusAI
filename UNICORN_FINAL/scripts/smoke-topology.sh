#!/usr/bin/env bash
# scripts/smoke-topology.sh
# -----------------------------------------------------------------------------
# Verifies the two-server topology contract on a running deployment:
#
#   - Backend (3000) responds with X-Unicorn-Role: backend on /api/* and /health
#   - Site (3001)    responds with X-Unicorn-Role: site    on / and /snapshot
#   - Both expose /internal/topology with role + sourceOfTruth flag
#
# When PUBLIC_BASE is set (e.g. https://zeusai.pro) we additionally verify the
# nginx split: /api/health → backend, /snapshot → site (the nginx config in
# scripts/nginx-unicorn.conf must route accordingly). This catches nginx
# routing drift before it leaks to users.
#
# Usage:
#   bash scripts/smoke-topology.sh                    # local: 3000 + 3001
#   BACKEND_BASE=http://127.0.0.1:3000 SITE_BASE=http://127.0.0.1:3001 \
#     bash scripts/smoke-topology.sh
#   PUBLIC_BASE=https://zeusai.pro bash scripts/smoke-topology.sh
# -----------------------------------------------------------------------------
set -euo pipefail

BACKEND_BASE="${BACKEND_BASE:-http://127.0.0.1:3000}"
SITE_BASE="${SITE_BASE:-http://127.0.0.1:3001}"
PUBLIC_BASE="${PUBLIC_BASE:-}"
PASS=0
FAIL=0

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

# header_value <url> <header-name>
# Prints the lowercased header value. Returns "" if the request fails (so the
# caller's assertion fails cleanly with a helpful diff instead of `set -e`
# aborting before we can report context).
header_value() {
  local url="$1" name="$2"
  local raw
  # Use a subshell with set +e to neutralise pipefail/-e for the curl|awk
  # pipeline — we want missing/failed responses to produce "" so the caller
  # can render a friendly error instead of aborting the whole script.
  raw="$(set +eo pipefail; curl -fsSI --max-time 10 "$url" 2>/dev/null || true)"
  printf '%s\n' "$raw" \
    | awk -v IGNORECASE=1 -v h="$name:" 'tolower($1)==tolower(h){sub(/^[^:]*:[ \t]*/,""); sub(/\r$/,""); print; exit}'
}

assert_role() {
  local label="$1" url="$2" expected="$3"
  local actual
  actual="$(header_value "$url" 'X-Unicorn-Role')"
  if [ "$actual" = "$expected" ]; then
    green "  ✓ $label → X-Unicorn-Role: $actual"
    PASS=$((PASS+1))
  else
    red "  ✗ $label → expected X-Unicorn-Role: $expected, got '${actual:-<missing>}' (url=$url)"
    FAIL=$((FAIL+1))
  fi
}

assert_topology() {
  local label="$1" url="$2" expected_role="$3" expected_sot="$4"
  local body
  body="$(curl -fsS --max-time 10 "$url" 2>/dev/null || true)"
  local role sot
  role="$(printf '%s' "$body" | grep -o '"role"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
  sot="$(printf '%s' "$body"  | grep -o '"sourceOfTruth"[[:space:]]*:[[:space:]]*\(true\|false\)' | head -n1 | sed 's/.*: *//')"
  if [ "$role" = "$expected_role" ] && [ "$sot" = "$expected_sot" ]; then
    green "  ✓ $label → role=$role sourceOfTruth=$sot"
    PASS=$((PASS+1))
  else
    red "  ✗ $label → expected role=$expected_role sourceOfTruth=$expected_sot, got role='${role:-?}' sourceOfTruth='${sot:-?}' (url=$url)"
    FAIL=$((FAIL+1))
  fi
}

echo "[smoke-topology] direct-port checks"
echo "[smoke-topology]   BACKEND_BASE=$BACKEND_BASE"
echo "[smoke-topology]   SITE_BASE=$SITE_BASE"

# --- Backend (3000) ---------------------------------------------------------
assert_role     "backend /api/health"            "$BACKEND_BASE/api/health"          "backend"
assert_topology "backend /internal/topology"     "$BACKEND_BASE/internal/topology"   "backend" "true"

# --- Site (3001) ------------------------------------------------------------
assert_role     "site /"                         "$SITE_BASE/"                       "site"
assert_role     "site /health"                   "$SITE_BASE/health"                 "site"
assert_topology "site /internal/topology"        "$SITE_BASE/internal/topology"      "site"    "false"

# --- Public domain (nginx split) — optional --------------------------------
if [ -n "$PUBLIC_BASE" ]; then
  echo
  echo "[smoke-topology] public-domain checks via nginx (PUBLIC_BASE=$PUBLIC_BASE)"
  assert_role     "public /api/health (must hit backend)" "$PUBLIC_BASE/api/health"        "backend"
  assert_role     "public /snapshot (must hit site)"      "$PUBLIC_BASE/snapshot"          "site"
  # Validate the FULL topology JSON (role + sourceOfTruth) on the public path
  # too — catches the case where some other server is responding on /internal/
  # but with the wrong identity (e.g. a stale upstream still serving traffic).
  assert_topology "public /internal/topology (backend)"   "$PUBLIC_BASE/internal/topology" "backend" "true"
fi

echo
if [ "$FAIL" -gt 0 ]; then
  red "[smoke-topology] FAIL · pass=$PASS fail=$FAIL"
  exit 1
fi
green "[smoke-topology] OK · pass=$PASS fail=$FAIL"
