#!/bin/bash

# measure-heal-time.sh
# Measures time-to-recovery (TTR) after backend kill
# Target: <30s per iteration, 5 iterations, zero data loss

set -e

UNICORN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$UNICORN_DIR/data/monitoring"
RESULTS_FILE="$LOG_DIR/heal-times-$(date +%s).log"
mkdir -p "$LOG_DIR"

# Configuration
ITERATIONS=${1:-5}
TARGET_TTR_SEC=30

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
log "${CYAN}║     HEAL-TIME MEASUREMENT SUITE      ║${NC}"
log "${CYAN}║     (Backend kill + recovery)         ║${NC}"
log "${CYAN}╚════════════════════════════════════════╝${NC}"

# Verify platform is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  fail "Backend not responding. Start with: npm run dev"
  exit 1
fi

log "Backend is healthy. Beginning $ITERATIONS iterations..."

TOTAL_TTR=0
FAILED_ITERATIONS=0
FASTEST_TTR=999
SLOWEST_TTR=0

for i in $(seq 1 $ITERATIONS); do
  log ""
  log "${YELLOW}[ITERATION $i/$ITERATIONS]${NC}"
  
  # Pre-kill baseline
  USERS_BEFORE=$(curl -s http://localhost:3000/api/health | jq '.totalUsers' 2>/dev/null || echo "0")
  REVENUE_BEFORE=$(curl -s http://localhost:3000/api/health | jq '.revenue' 2>/dev/null || echo "0")
  log "Baseline: users=$USERS_BEFORE, revenue=$REVENUE_BEFORE"
  
  # Kill backend
  log "Killing backend process..."
  pm2 stop unicorn-backend 2>/dev/null || pkill -f "node src/index.js" || true
  sleep 1
  
  START_TIME=$(date +%s%N)
  
  # Restart backend
  log "Restarting backend..."
  pm2 start unicorn-backend 2>/dev/null || (cd "$UNICORN_DIR" && npm start > /dev/null 2>&1 &)
  
  # Poll until healthy
  RECOVERY_COMPLETE=false
  ATTEMPTS=0
  MAX_ATTEMPTS=$((TARGET_TTR_SEC * 2))  # Timeout after 2x target
  
  while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    sleep 1
    ((ATTEMPTS++))
    
    if curl -s http://localhost:3000/health 2>/dev/null | jq -e '.status' > /dev/null 2>&1; then
      END_TIME=$(date +%s%N)
      TTR=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert nanoseconds to milliseconds
      TTR_SEC=$(echo "scale=2; $TTR / 1000" | bc)
      
      # Verify data integrity
      USERS_AFTER=$(curl -s http://localhost:3000/api/health | jq '.totalUsers' 2>/dev/null || echo "0")
      REVENUE_AFTER=$(curl -s http://localhost:3000/api/health | jq '.revenue' 2>/dev/null || echo "0")
      
      if [ "$USERS_AFTER" -eq "$USERS_BEFORE" ] && [ "$REVENUE_AFTER" -eq "$REVENUE_BEFORE" ]; then
        pass "Recovered in ${TTR_SEC}s (data intact)"
        
        # Track metrics
        TOTAL_TTR=$(echo "$TOTAL_TTR + $TTR_SEC" | bc)
        
        if [ $(echo "$TTR_SEC < $FASTEST_TTR" | bc) -eq 1 ]; then
          FASTEST_TTR=$TTR_SEC
        fi
        
        if [ $(echo "$TTR_SEC > $SLOWEST_TTR" | bc) -eq 1 ]; then
          SLOWEST_TTR=$TTR_SEC
        fi
        
        if [ $(echo "$TTR_SEC > $TARGET_TTR_SEC" | bc) -eq 1 ]; then
          log "${YELLOW}⚠ Exceeded target:${NC} ${TTR_SEC}s > ${TARGET_TTR_SEC}s"
        else
          log "${GREEN}✓ Within target:${NC} ${TTR_SEC}s <= ${TARGET_TTR_SEC}s"
        fi
        
        RECOVERY_COMPLETE=true
        break
      else
        fail "Data loss detected: users $USERS_BEFORE→$USERS_AFTER, revenue $REVENUE_BEFORE→$REVENUE_AFTER"
        ((FAILED_ITERATIONS++))
        RECOVERY_COMPLETE=true
        break
      fi
    fi
  done
  
  if [ "$RECOVERY_COMPLETE" = false ]; then
    fail "Recovery timeout (exceeded ${MAX_ATTEMPTS}s)"
    ((FAILED_ITERATIONS++))
  fi
  
  sleep 3  # Cool-down between iterations
done

# Final summary
AVG_TTR=$(echo "scale=2; $TOTAL_TTR / $ITERATIONS" | bc)

log ""
log "${CYAN}╔════════════════════════════════════════╗${NC}"
log "${CYAN}║       HEAL-TIME FINAL SUMMARY         ║${NC}"
log "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Iterations:              $ITERATIONS"
echo "Successful:              $((ITERATIONS - FAILED_ITERATIONS))"
echo "Failed:                  $FAILED_ITERATIONS"
echo ""
echo "Total TTR:               ${TOTAL_TTR}s"
echo "Average TTR:             ${AVG_TTR}s"
echo "Fastest TTR:             ${FASTEST_TTR}s"
echo "Slowest TTR:             ${SLOWEST_TTR}s"
echo "Target TTR:              ${TARGET_TTR_SEC}s"
echo ""
echo "Results: $RESULTS_FILE"
echo ""

if [ $FAILED_ITERATIONS -eq 0 ] && [ $(echo "$AVG_TTR < $TARGET_TTR_SEC" | bc) -eq 1 ]; then
  pass "All iterations successful and within target"
  exit 0
else
  fail "Some iterations failed or exceeded target"
  exit 1
fi
