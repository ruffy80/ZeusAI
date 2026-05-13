#!/bin/bash

# stress-test.sh
# Load testing: p50/p95/p99 latency, error rates, throughput
# Part of Pasul 3: Chaos Engineering

set -e

UNICORN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$UNICORN_DIR/data/monitoring"
RESULTS_FILE="$LOG_DIR/stress-test-$(date +%s).log"
LATENCIES_FILE="/tmp/latencies-$$.txt"
mkdir -p "$LOG_DIR"

# Configuration
DURATION_SEC=${1:-30}
CONCURRENCY=${2:-10}
TARGET_ERROR_RATE=1  # Max 1% errors

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
  echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$RESULTS_FILE"
}

pass() {
  echo -e "${GREEN}✓${NC} $1" | tee -a "$RESULTS_FILE"
}

fail() {
  echo -e "${RED}✗${NC} $1" | tee -a "$RESULTS_FILE"
}

log "${CYAN}╔════════════════════════════════════════╗${NC}"
log "${CYAN}║      STRESS TEST SUITE (30s load)    ║${NC}"
log "${CYAN}╚════════════════════════════════════════╝${NC}"

# Verify platform is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  fail "Backend not responding"
  exit 1
fi

log "Configuration:"
log "  Duration: ${DURATION_SEC}s"
log "  Concurrency: ${CONCURRENCY} workers"
log "  Target error rate: <${TARGET_ERROR_RATE}%"
log ""

# Endpoints to stress test
ENDPOINTS=(
  "/health"
  "/api/products"
  "/api/services"
  "/api/revenue/command-center"
  "/api/treasury/dashboard"
)

# Run stress test
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
FAILED_REQUESTS=0
START_TIME=$(date +%s)

log "Starting stress test..."

run_worker() {
  local worker_id=$1
  local worker_start=$(date +%s)
  
  while [ $(($(date +%s) - START_TIME)) -lt $DURATION_SEC ]; do
    # Random endpoint
    ENDPOINT=${ENDPOINTS[$((RANDOM % ${#ENDPOINTS[@]}))]}
    
    # Measure latency
    RESP_TIME=$( { time curl -s http://localhost:3000$ENDPOINT > /dev/null 2>&1; } 2>&1 | grep real | awk '{print $2}' | tr -d 's' || echo "999")
    
    # Convert to milliseconds
    LATENCY_MS=$(echo "$RESP_TIME * 1000" | bc 2>/dev/null || echo "999")
    
    # Record latency
    echo "$LATENCY_MS" >> "$LATENCIES_FILE"
    
    ((TOTAL_REQUESTS++))
    
    if [ "$?" -eq 0 ]; then
      ((SUCCESSFUL_REQUESTS++))
    else
      ((FAILED_REQUESTS++))
    fi
    
    sleep 0.1
  done
}

# Launch worker threads
for w in $(seq 1 $CONCURRENCY); do
  run_worker $w &
done

# Wait for all workers
wait

# Analyze latencies
log ""
log "Calculating latency percentiles..."

if [ -f "$LATENCIES_FILE" ]; then
  P50=$(sort -n "$LATENCIES_FILE" | awk '{a[NR]=$1} END {print a[int(NR*0.5)]}')
  P95=$(sort -n "$LATENCIES_FILE" | awk '{a[NR]=$1} END {print a[int(NR*0.95)]}')
  P99=$(sort -n "$LATENCIES_FILE" | awk '{a[NR]=$1} END {print a[int(NR*0.99)]}')
  MAX=$(sort -n "$LATENCIES_FILE" | tail -1)
  MIN=$(sort -n "$LATENCIES_FILE" | head -1)
  
  rm -f "$LATENCIES_FILE"
else
  P50="0"
  P95="0"
  P99="0"
  MAX="0"
  MIN="0"
fi

# Calculate error rate
ERROR_RATE=$(echo "scale=2; $FAILED_REQUESTS * 100 / $TOTAL_REQUESTS" | bc 2>/dev/null || echo "0")
THROUGHPUT=$(echo "scale=2; $TOTAL_REQUESTS / $DURATION_SEC" | bc)

# Report
log ""
log "${CYAN}╔════════════════════════════════════════╗${NC}"
log "${CYAN}║     STRESS TEST RESULTS              ║${NC}"
log "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Total Requests:         $TOTAL_REQUESTS"
echo "Successful:             $SUCCESSFUL_REQUESTS"
echo "Failed:                 $FAILED_REQUESTS"
echo "Error Rate:             ${ERROR_RATE}%"
echo ""
echo "Throughput:             ${THROUGHPUT} req/sec"
echo ""
echo "Latency (milliseconds):"
echo "  p50:                  ${P50}ms"
echo "  p95:                  ${P95}ms"
echo "  p99:                  ${P99}ms"
echo "  min:                  ${MIN}ms"
echo "  max:                  ${MAX}ms"
echo ""
echo "Target error rate:      <${TARGET_ERROR_RATE}%"
echo "Results: $RESULTS_FILE"
echo ""

# Validation
PASS=true

if [ $(echo "$ERROR_RATE > $TARGET_ERROR_RATE" | bc) -eq 1 ]; then
  fail "Error rate ${ERROR_RATE}% exceeds target ${TARGET_ERROR_RATE}%"
  PASS=false
else
  pass "Error rate within target: ${ERROR_RATE}% <= ${TARGET_ERROR_RATE}%"
fi

if [ $(echo "$P99 > 1000" | bc) -eq 1 ]; then
  log "${YELLOW}⚠ p99 latency high:${NC} ${P99}ms (target: <1000ms)"
else
  pass "p99 latency acceptable: ${P99}ms"
fi

if [ "$PASS" = true ]; then
  pass "Stress test passed"
  exit 0
else
  fail "Stress test failed"
  exit 1
fi
