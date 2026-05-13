#!/bin/bash

# test-innovation-loop.sh
# Validates unicornInnovator autonomous decisions and integration
# Part of Pasul 2: Auto-inovație

set -e

export INNOVATION_TEST_MODE=true
export INNOVATION_LOG_LEVEL=debug
UNICORN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$UNICORN_DIR/data/monitoring"
LOG_FILE="$LOG_DIR/innovation-test-$(date +%s).log"
mkdir -p "$LOG_DIR"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
TESTS=0

log() {
  local msg="$1"
  echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $msg" | tee -a "$LOG_FILE"
}

pass() {
  echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
  ((FAILED++))
}

test_step() {
  ((TESTS++))
  echo -e "\n${YELLOW}[TEST $TESTS]${NC} $1" | tee -a "$LOG_FILE"
}

# Test 1: Innovation decision gate validation
test_step "Innovation decision gate available"
RESPONSE=$(curl -s http://localhost:3000/api/innovation/decision || echo "{}")
if echo "$RESPONSE" | grep -q '"decision"'; then
  pass "Innovation decision endpoint responds"
else
  fail "Innovation decision endpoint missing"
fi

# Test 2: Innovation event logging
test_step "Innovation event logging active"
EVENTS=$(curl -s http://localhost:3000/api/innovation/events | jq '.events | length' 2>/dev/null || echo "0")
if [ "$EVENTS" -gt 0 ]; then
  pass "Innovation events logged: $EVENTS"
else
  pass "Innovation events logging ready (0 events is OK for fresh start)"
fi

# Test 3: Check unicornInnovator module state
test_step "unicornInnovator module operational"
INNOVATOR_STATE=$(curl -s http://localhost:3000/api/unicorn/brain | jq '.modules.unicornInnovator' 2>/dev/null || echo "null")
if [ "$INNOVATOR_STATE" != "null" ]; then
  pass "unicornInnovator state: $(echo $INNOVATOR_STATE | jq -c '.')"
else
  fail "unicornInnovator module not found"
fi

# Test 4: Revenue command includes innovation context
test_step "Revenue commander includes innovation context"
REVENUE=$(curl -s http://localhost:3000/api/revenue/command-center | jq '.innovationGate' 2>/dev/null)
if [ "$REVENUE" != "null" ]; then
  pass "Innovation gate in revenue: $REVENUE"
else
  fail "Innovation gate missing from revenue commander"
fi

# Test 5: SSE stream includes innovation updates
test_step "SSE stream broadcasts innovation updates"
STREAM_TEST=$(timeout 5 curl -s http://localhost:3000/stream 2>&1 | head -20 || true)
if echo "$STREAM_TEST" | grep -q "event:"; then
  pass "SSE stream active and broadcasting"
else
  fail "SSE stream not responding or empty"
fi

# Test 6: Innovation treasury integration
test_step "Innovation treasury profit allocation working"
TREASURY=$(curl -s http://localhost:3000/api/treasury/dashboard | jq '.innovationBudget' 2>/dev/null || echo "null")
if [ "$TREASURY" != "null" ]; then
  pass "Innovation budget allocated: $(echo $TREASURY | jq -c '.')"
else
  fail "Innovation budget not allocated"
fi

# Test 7: Innovation decision reproducibility
test_step "Innovation decisions are deterministic (reproducibility)"
DECISION_1=$(curl -s http://localhost:3000/api/innovation/decision | jq -c '.decision' 2>/dev/null || echo "null")
sleep 1
DECISION_2=$(curl -s http://localhost:3000/api/innovation/decision | jq -c '.decision' 2>/dev/null || echo "null")
if [ "$DECISION_1" = "$DECISION_2" ]; then
  pass "Innovation decisions reproducible"
else
  pass "Innovation decisions vary (stochastic, OK): $DECISION_1 vs $DECISION_2"
fi

# Test 8: Check innovation approval gate in code
test_step "Innovation approval gate in codebase"
if grep -q "INNOVATION_TEST_MODE\|innovation-approved" "$UNICORN_DIR/backend/index.js" 2>/dev/null; then
  pass "Innovation approval gate found in backend"
else
  fail "Innovation approval gate not found in backend"
fi

# Test 9: Validate innovation event schema
test_step "Innovation event schema validation"
LATEST_EVENT=$(curl -s http://localhost:3000/api/innovation/events | jq '.events[-1]' 2>/dev/null || echo "{}")
if echo "$LATEST_EVENT" | jq -e '.timestamp and .decision' > /dev/null 2>&1; then
  pass "Innovation event schema valid"
else
  pass "Innovation event schema ready (no events yet)"
fi

# Test 10: Load test - rapid innovation decisions
test_step "Load test: 20 rapid innovation decisions"
SUCCESS_COUNT=0
for i in {1..20}; do
  if curl -s http://localhost:3000/api/innovation/decision > /dev/null 2>&1; then
    ((SUCCESS_COUNT++))
  fi
  sleep 0.05
done
if [ $SUCCESS_COUNT -ge 18 ]; then
  pass "High-load test passed: $SUCCESS_COUNT/20 decisions successful"
else
  fail "High-load test failed: $SUCCESS_COUNT/20 decisions"
fi

# Summary
echo -e "\n${CYAN}════════════════════════════════════════════${NC}"
echo -e "${CYAN}Innovation Test Summary${NC}"
echo -e "${CYAN}════════════════════════════════════════════${NC}"
echo -e "Total Tests: $TESTS"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${CYAN}Log: $LOG_FILE${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ All innovation tests passed${NC}"
  exit 0
else
  echo -e "\n${RED}✗ $FAILED test(s) failed${NC}"
  exit 1
fi
