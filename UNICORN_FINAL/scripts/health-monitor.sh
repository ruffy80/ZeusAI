#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# 24/7 HEALTH MONITORING
# ═══════════════════════════════════════════════════════════════
# Runs validation every 5 minutes and logs results
# Triggers alert after 3 consecutive failures on same endpoint

set -euo pipefail

LOGS_DIR="${LOGS_DIR:-.}/data/monitoring"
mkdir -p "$LOGS_DIR"

HEALTH_LOG="$LOGS_DIR/health-check.log"
ALERT_LOG="$LOGS_DIR/health-alerts.log"

# Create log files if they don't exist
touch "$HEALTH_LOG" "$ALERT_LOG"

# Temporary failure counters (in-memory during this run)
declare -A FAILURE_COUNTERS

INTERVAL="${1:-300}" # Default 5 minutes
DURATION_HOURS="${2:-48}" # Default 48 hours
DURATION_SECONDS=$((DURATION_HOURS * 3600))
START_TIME=$(date +%s)

log() {
  local msg="$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $msg" | tee -a "$HEALTH_LOG"
}

alert() {
  local msg="$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  ALERT: $msg" | tee -a "$HEALTH_LOG" "$ALERT_LOG"
}

test_endpoint() {
  local endpoint="$1"
  local expected="$2"
  
  local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$endpoint" 2>/dev/null || echo "000")
  
  if [ "$code" = "$expected" ]; then
    log "✓ $endpoint → $code"
    # Reset counter on success
    FAILURE_COUNTERS["$endpoint"]=0
    return 0
  else
    log "✗ $endpoint → $code (expected $expected)"
    # Increment counter
    if [ -z "${FAILURE_COUNTERS[$endpoint]:-}" ]; then
      FAILURE_COUNTERS["$endpoint"]=1
    else
      FAILURE_COUNTERS["$endpoint"]=$((FAILURE_COUNTERS["$endpoint"] + 1))
    fi
    
    # Alert after 3 failures
    if [ "${FAILURE_COUNTERS[$endpoint]}" -ge 3 ]; then
      alert "Endpoint $endpoint failed 3 times in a row. Code: $code"
    fi
    
    return 1
  fi
}

echo "═══════════════════════════════════════════════════════════════"
log "24/7 HEALTH MONITORING STARTED"
log "Interval: ${INTERVAL}s, Duration: ${DURATION_HOURS}h"
echo "═══════════════════════════════════════════════════════════════"
echo ""

while true; do
  ELAPSED=$(($(date +%s) - START_TIME))
  
  if [ $ELAPSED -gt $DURATION_SECONDS ]; then
    log "Monitoring duration completed. Exiting."
    break
  fi
  
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Test critical endpoints
  test_endpoint "http://localhost:3001/health" "200" || true
  test_endpoint "http://localhost:3001/" "200" || true
  test_endpoint "http://localhost:3000/api/health" "200" || true
  test_endpoint "http://localhost:3000/api/brain/status" "200" || true
  test_endpoint "http://localhost:3000/api/treasury/status" "200" || true
  test_endpoint "http://localhost:3000/api/revenue/command-center" "200" || true
  
  log "Sleeping ${INTERVAL}s until next check..."
  sleep "$INTERVAL"
done

log "Health monitoring completed."
log "Full log: $HEALTH_LOG"
log "Alerts: $ALERT_LOG"

exit 0
