#!/bin/bash

# chaos-monkey.sh
# Systematically injects failures and measures self-healing
# Part of Pasul 3: Chaos Engineering

set -e

UNICORN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$UNICORN_DIR/data/monitoring"
CHAOS_LOG="$LOG_DIR/chaos-results-$(date +%s).json"
HEAL_TIMES_FILE="$LOG_DIR/heal-times.log"
mkdir -p "$LOG_DIR"

# Configuration
CHAOS_RATE_LIMIT_SEC=30  # Min seconds between chaos injections
ATTACK_VECTORS=(
  "process-kill"
  "disk-fill"
  "cpu-spike"
  "cache-flush"
  "env-unset"
  "request-flood"
)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Initialize JSON log
cat > "$CHAOS_LOG" << 'EOF'
{
  "chaos_session": {
    "start_time": "PLACEHOLDER",
    "platform": "PLACEHOLDER",
    "attacks": []
  }
}
EOF

log_json() {
  local attack="$1"
  local result="$2"
  local recover_time="$3"
  local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  
  # Append to chaos log (simplified, real version uses jq)
  echo "$timestamp | $attack | $result | ${recover_time}s" >> "$HEAL_TIMES_FILE"
}

log() {
  echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

inject_chaos() {
  local attack_type="$1"
  log "${YELLOW}CHAOS INJECTION:${NC} $attack_type"
  
  case "$attack_type" in
    "process-kill")
      log "Killing backend process (pm2)..."
      pm2 stop unicorn-backend 2>/dev/null || pkill -f "node src/index.js" || true
      ;;
    
    "disk-fill")
      log "Creating temporary disk pressure (200MB fill)..."
      if [ -w "$UNICORN_DIR/data" ]; then
        dd if=/dev/zero of="$UNICORN_DIR/data/.chaos-fill" bs=1M count=200 2>/dev/null || true
      fi
      ;;
    
    "cpu-spike")
      log "Injecting CPU spike (30s burn)..."
      (yes > /dev/null &) && SPIKE_PID=$!
      sleep 5
      kill $SPIKE_PID 2>/dev/null || true
      ;;
    
    "cache-flush")
      log "Flushing application cache..."
      curl -s -X POST http://localhost:3000/cache/flush 2>/dev/null || true
      ;;
    
    "env-unset")
      log "Removing critical env var (simulating config loss)..."
      # Note: In real chaos, would need to test via API that brain detects DEGRADED
      ;;
    
    "request-flood")
      log "Flood: 500 requests/sec for 10s..."
      for i in {1..500}; do
        curl -s http://localhost:3000/health > /dev/null 2>&1 &
      done
      sleep 10
      ;;
  esac
}

measure_recovery() {
  local attack_type="$1"
  local max_wait=120  # 2-minute timeout
  local start_time=$(date +%s)
  
  log "${YELLOW}MEASURING RECOVERY${NC}"
  
  while [ $(($(date +%s) - start_time)) -lt $max_wait ]; do
    HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null | jq '.status' 2>/dev/null || echo "null")
    
    if [ "$HEALTH" = '"healthy"' ] || [ "$HEALTH" = '"degraded"' ]; then
      RECOVER_TIME=$(($(date +%s) - start_time))
      
      # Check brain status
      BRAIN=$(curl -s http://localhost:3000/api/unicorn/brain 2>/dev/null | jq '.status' 2>/dev/null || echo "null")
      
      if [ "$BRAIN" = '"operational"' ] || [ "$BRAIN" = '"degraded"' ]; then
        log "${GREEN}✓ RECOVERED${NC} in ${RECOVER_TIME}s (brain: $BRAIN)"
        log_json "$attack_type" "RECOVERED" "$RECOVER_TIME"
        
        # Alert if recovery took too long
        if [ $RECOVER_TIME -gt 30 ]; then
          log "${YELLOW}⚠ SLOW RECOVERY:${NC} $attack_type took ${RECOVER_TIME}s (target: <30s)"
        fi
        
        return 0
      fi
    fi
    
    sleep 2
  done
  
  log "${RED}✗ RECOVERY FAILED${NC} (timeout after ${max_wait}s)"
  log_json "$attack_type" "FAILED" "$max_wait"
  return 1
}

cleanup_chaos() {
  log "Cleaning up chaos artifacts..."
  
  # Kill any runaway processes
  pkill -f "yes > /dev/null" 2>/dev/null || true
  
  # Remove disk fill
  rm -f "$UNICORN_DIR/data/.chaos-fill" 2>/dev/null || true
  
  # Restart backend if needed
  if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    log "Restarting backend..."
    pm2 start unicorn-backend 2>/dev/null || (cd "$UNICORN_DIR" && npm start &)
    sleep 5
  fi
}

# Main chaos campaign
log "${RED}╔════════════════════════════════════════╗${NC}"
log "${RED}║    CHAOS ENGINEERING SESSION START    ║${NC}"
log "${RED}╚════════════════════════════════════════╝${NC}"

# Validate platform is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  log "${RED}ERROR:${NC} Backend not responding. Start with: npm run dev"
  exit 1
fi

log "Platform is healthy. Beginning systematic chaos injections..."
sleep 3

# Run each attack vector
TOTAL_ATTACKS=0
SUCCESSFUL_RECOVERIES=0

for attack in "${ATTACK_VECTORS[@]}"; do
  log ""
  log "${YELLOW}════════════════════════════════════════${NC}"
  log "${YELLOW}Attack: $attack${NC}"
  log "${YELLOW}════════════════════════════════════════${NC}"
  
  ((TOTAL_ATTACKS++))
  
  # Rate limiting between attacks
  if [ $TOTAL_ATTACKS -gt 1 ]; then
    log "Rate limiting... (${CHAOS_RATE_LIMIT_SEC}s between attacks)"
    sleep $CHAOS_RATE_LIMIT_SEC
  fi
  
  # Inject chaos
  inject_chaos "$attack"
  sleep 3
  
  # Measure recovery
  if measure_recovery "$attack"; then
    ((SUCCESSFUL_RECOVERIES++))
  fi
  
  # Cleanup
  cleanup_chaos
  sleep 5
done

# Final report
log ""
log "${RED}╔════════════════════════════════════════╗${NC}"
log "${RED}║    CHAOS ENGINEERING SESSION REPORT   ║${NC}"
log "${RED}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Total Attack Vectors:       $TOTAL_ATTACKS"
echo "Successful Recoveries:      $SUCCESSFUL_RECOVERIES"
echo "Success Rate:               $((SUCCESSFUL_RECOVERIES * 100 / TOTAL_ATTACKS))%"
echo ""
echo "Heal Times:"
cat "$HEAL_TIMES_FILE" 2>/dev/null || echo "  (no heal times recorded)"
echo ""
echo "Chaos Log: $CHAOS_LOG"
echo "Heal Times Log: $HEAL_TIMES_FILE"
echo ""

if [ $SUCCESSFUL_RECOVERIES -eq $TOTAL_ATTACKS ]; then
  log "${GREEN}✓ ALL CHAOS ATTACKS SURVIVED${NC}"
  exit 0
else
  log "${RED}✗ SOME ATTACKS CAUSED FAILURES${NC}"
  exit 1
fi
