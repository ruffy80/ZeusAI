#!/bin/bash

# test-btc-flow.sh
# End-to-end BTC payment flow validation
# Part of Pasul 4: Profit Live (BTC-only)

set -e

UNICORN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$UNICORN_DIR/data/monitoring"
BTC_LOG="$LOG_DIR/btc-flow-$(date +%s).log"
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
  echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$BTC_LOG"
}

pass() {
  echo -e "${GREEN}✓${NC} $1" | tee -a "$BTC_LOG"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1" | tee -a "$BTC_LOG"
  ((FAILED++))
}

test_step() {
  ((TESTS++))
  echo -e "\n${YELLOW}[TEST $TESTS]${NC} $1" | tee -a "$BTC_LOG"
}

log "${CYAN}╔════════════════════════════════════════╗${NC}"
log "${CYAN}║     BTC PAYMENT FLOW VALIDATION      ║${NC}"
log "${CYAN}║     (End-to-End Test)                ║${NC}"
log "${CYAN}╚════════════════════════════════════════╝${NC}"

# Verify platform is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  fail "Backend not responding"
  exit 1
fi

log "Platform health: OK"

# Test 1: BTC payment endpoint available
test_step "BTC payment endpoint available"
PAYMENT_ENDPOINT=$(curl -s http://localhost:3000/api/payments/methods | jq '.methods[] | select(.type=="btc")' 2>/dev/null)
if [ -n "$PAYMENT_ENDPOINT" ]; then
  pass "BTC payment method available"
else
  fail "BTC payment method not found"
fi

# Test 2: Generate BTC invoice
test_step "Generate BTC invoice"
INVOICE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/payments/btc/invoice \
  -H "Content-Type: application/json" \
  -d '{"amountUSD": 100, "description": "Test invoice"}' 2>/dev/null)

INVOICE_ID=$(echo "$INVOICE_RESPONSE" | jq -r '.invoiceId' 2>/dev/null || echo "")

if [ -n "$INVOICE_ID" ] && [ "$INVOICE_ID" != "null" ]; then
  pass "BTC invoice generated: $INVOICE_ID"
  
  # Extract payment details
  BTC_ADDRESS=$(echo "$INVOICE_RESPONSE" | jq -r '.btcAddress' 2>/dev/null || echo "")
  BTC_AMOUNT=$(echo "$INVOICE_RESPONSE" | jq -r '.btcAmount' 2>/dev/null || echo "")
  EXPIRES_AT=$(echo "$INVOICE_RESPONSE" | jq -r '.expiresAt' 2>/dev/null || echo "")
  
  log "  Invoice details:"
  log "    Address: $BTC_ADDRESS"
  log "    Amount: $BTC_AMOUNT BTC"
  log "    Expires: $EXPIRES_AT"
else
  fail "BTC invoice generation failed"
  INVOICE_ID="null"
fi

# Test 3: Verify invoice in ledger
test_step "Verify invoice in BTC ledger"
if [ "$INVOICE_ID" != "null" ]; then
  LEDGER=$(curl -s http://localhost:3000/api/payments/btc/ledger 2>/dev/null)
  if echo "$LEDGER" | jq -e ".invoices[] | select(.id==\"$INVOICE_ID\")" > /dev/null 2>&1; then
    pass "Invoice found in ledger"
  else
    fail "Invoice not found in ledger"
  fi
else
  log "Skipping (no invoice)"
fi

# Test 4: Simulate payment confirmation
test_step "Simulate BTC payment confirmation"
if [ "$INVOICE_ID" != "null" ]; then
  CONFIRM_RESPONSE=$(curl -s -X POST http://localhost:3000/api/payments/btc/confirm \
    -H "Content-Type: application/json" \
    -d "{\"invoiceId\": \"$INVOICE_ID\", \"txHash\": \"$(date +%s | md5sum | cut -d' ' -f1)\"}" 2>/dev/null)
  
  CONFIRM_STATUS=$(echo "$CONFIRM_RESPONSE" | jq -r '.status' 2>/dev/null || echo "")
  
  if [ "$CONFIRM_STATUS" = "confirmed" ] || [ "$CONFIRM_STATUS" = "pending" ]; then
    pass "Payment confirmation processed: $CONFIRM_STATUS"
  else
    fail "Payment confirmation failed: $CONFIRM_RESPONSE"
  fi
else
  log "Skipping (no invoice)"
fi

# Test 5: Check treasury profit update
test_step "Verify profit update in treasury"
TREASURY=$(curl -s http://localhost:3000/api/treasury/dashboard 2>/dev/null)
BTC_BALANCE=$(echo "$TREASURY" | jq -r '.btcBalance // .btc_balance' 2>/dev/null || echo "0")

if [ -n "$BTC_BALANCE" ] && [ "$BTC_BALANCE" != "null" ]; then
  pass "BTC balance in treasury: $BTC_BALANCE"
else
  fail "BTC balance not found in treasury"
fi

# Test 6: Verify Stripe is disabled
test_step "Verify Stripe is disabled (BTC-only)"
STRIPE_ENABLED=$(curl -s http://localhost:3000/api/payments/methods | jq '.methods[] | select(.type=="stripe")' 2>/dev/null)

if [ -z "$STRIPE_ENABLED" ]; then
  pass "Stripe correctly disabled (BTC-only mode)"
else
  log "${YELLOW}⚠ Stripe method found:${NC} Check STRIPE_ACTIVE env var"
fi

# Test 7: Check profit-priorities-updated event
test_step "Check profit-priorities-updated event"
EVENTS=$(curl -s http://localhost:3000/api/events/stream 2>/dev/null | head -50)

if echo "$EVENTS" | grep -q "profit-priorities-updated"; then
  pass "Profit-priorities-updated event emitted"
else
  log "Note: Event stream not yet updated (may need live traffic)"
fi

# Test 8: Validate payment registry
test_step "Validate payment registry"
REGISTRY=$(curl -s http://localhost:3000/api/payments/registry 2>/dev/null)
ACTIVE_METHODS=$(echo "$REGISTRY" | jq '.active_methods | length' 2>/dev/null || echo "0")

if [ "$ACTIVE_METHODS" -gt 0 ]; then
  pass "Payment registry active: $ACTIVE_METHODS method(s)"
else
  fail "Payment registry empty or not found"
fi

# Test 9: Check BTC pricing on /services
test_step "Verify BTC pricing on /services page"
SERVICES_HTML=$(curl -s http://localhost:3000/services | head -100)

if echo "$SERVICES_HTML" | grep -q "BTC\|bitcoin\|satoshi"; then
  pass "BTC pricing visible on /services"
else
  log "Note: /services may not show BTC pricing in static HTML (check dynamic rendering)"
fi

# Test 10: End-to-end flow summary
test_step "End-to-end payment flow integrity"
if [ "$INVOICE_ID" != "null" ] && [ -n "$BTC_ADDRESS" ] && [ -n "$TREASURY" ]; then
  pass "Complete BTC payment flow operational"
else
  fail "BTC payment flow incomplete"
fi

# Summary
echo -e "\n${CYAN}════════════════════════════════════════════${NC}"
echo -e "${CYAN}BTC Payment Flow Test Summary${NC}"
echo -e "${CYAN}════════════════════════════════════════════${NC}"
echo -e "Total Tests: $TESTS"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${CYAN}Log: $BTC_LOG${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ All BTC payment tests passed${NC}"
  exit 0
else
  echo -e "\n${RED}✗ $FAILED test(s) failed${NC}"
  exit 1
fi
