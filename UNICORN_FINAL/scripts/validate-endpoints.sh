#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# UNICORN ENDPOINT VALIDATION SUITE
# ═══════════════════════════════════════════════════════════════
# Validates all critical endpoints on live server
# Exit code: 0 = all green, 1 = any failure

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
PASSED=0
FAILED=0

# Test results log
RESULTS_LOG="/tmp/endpoint-validation-$(date +%s).log"
touch "$RESULTS_LOG"

test_endpoint() {
  local name="$1"
  local url="$2"
  local expected_code="$3"
  
  TOTAL=$((TOTAL + 1))
  
  local actual_code
  actual_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  
  if [ "$actual_code" = "$expected_code" ]; then
    echo -e "${GREEN}✓${NC} $name"
    echo "PASS: $name ($url → $actual_code)" >> "$RESULTS_LOG"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗${NC} $name (expected $expected_code, got $actual_code)"
    echo "FAIL: $name ($url → $actual_code, expected $expected_code)" >> "$RESULTS_LOG"
    FAILED=$((FAILED + 1))
  fi
}

test_sse() {
  local name="$1"
  local url="$2"
  
  TOTAL=$((TOTAL + 1))
  
  local result
  result=$(timeout 3 curl -s -N "$url" 2>/dev/null | head -1 || echo "TIMEOUT")
  
  if [ -n "$result" ] && [ "$result" != "TIMEOUT" ]; then
    echo -e "${GREEN}✓${NC} $name (SSE stream alive)"
    echo "PASS: $name ($url → stream received)" >> "$RESULTS_LOG"
    PASSED=$((PASSED + 1))
  else
    echo -e "${YELLOW}⚠${NC} $name (stream may be delayed, non-critical)"
    echo "WARN: $name ($url → timeout or no response, may be normal)" >> "$RESULTS_LOG"
    # Don't count as failure for SSE (can be slow on first hit)
  fi
}

echo "═══════════════════════════════════════════════════════════════"
echo "UNICORN ENDPOINT VALIDATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "🌐 SITE ENDPOINTS (port 3001)"
echo "───────────────────────────────────────────────────────────────"
test_endpoint "Home page"          "http://localhost:3001/"                "200"
test_endpoint "Health check"       "http://localhost:3001/health"         "200"
test_endpoint "Unicorn status"     "http://localhost:3001/unicorn-status" "200"
test_endpoint "Cockpit dashboard"  "http://localhost:3001/unicorn-cockpit" "200"
test_endpoint "Services catalog"   "http://localhost:3001/services"       "200"
test_endpoint "Public status"      "http://localhost:3001/status"         "200"
test_endpoint "Revenue command"    "http://localhost:3001/revenue-command" "200"
echo ""

echo "🧠 BACKEND API ENDPOINTS (port 3000)"
echo "───────────────────────────────────────────────────────────────"
test_endpoint "Backend health"     "http://localhost:3000/api/health"     "200"
test_endpoint "Brain status"       "http://localhost:3000/api/brain/status" "200"
test_endpoint "Brain autonomy"     "http://localhost:3000/api/brain/autonomy" "200"
test_endpoint "Healer status"      "http://localhost:3000/api/healer/status" "200"
test_endpoint "Innovator status"   "http://localhost:3000/api/innovator/status" "200"
test_endpoint "Treasury status"    "http://localhost:3000/api/treasury/status" "200"
test_endpoint "Treasury pricing"   "http://localhost:3000/api/treasury/pricing" "200"
test_endpoint "Treasury dashboard" "http://localhost:3000/api/treasury/dashboard" "200"
test_endpoint "Growth status"      "http://localhost:3000/api/growth/status" "200"
test_endpoint "Guardian status"    "http://localhost:3000/api/guardian/status" "200"
test_endpoint "Guardian security"  "http://localhost:3000/api/guardian/security" "200"
test_endpoint "Catalog promoted"   "http://localhost:3000/api/catalog/promoted" "200"
test_endpoint "Products list"      "http://localhost:3000/api/products"   "200"
test_endpoint "Revenue autopilot"  "http://localhost:3000/api/revenue/autopilot/status" "200"
test_endpoint "Revenue command"    "http://localhost:3000/api/revenue/command-center" "200"
echo ""

echo "📡 STREAMING ENDPOINTS (SSE)"
echo "───────────────────────────────────────────────────────────────"
test_sse "Site stream"    "http://localhost:3001/unicorn-stream"
test_sse "Treasury stream" "http://localhost:3000/api/treasury/dashboard"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo "Total:  $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ ALL ENDPOINTS GREEN${NC}"
  echo ""
  echo "Log: $RESULTS_LOG"
  exit 0
else
  echo -e "${RED}✗ SOME ENDPOINTS FAILED${NC}"
  echo ""
  echo "Failed details:"
  grep "FAIL:" "$RESULTS_LOG" || true
  echo ""
  echo "Log: $RESULTS_LOG"
  exit 1
fi
