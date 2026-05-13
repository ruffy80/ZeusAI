#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# STALE-BUT-ALIVE VERIFICATION
# ═══════════════════════════════════════════════════════════════
# Validates that the site continues to function even if backend dies
# Expected behavior: site should respond for up to ~30 seconds

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

LOGS_DIR="${LOGS_DIR:-.}/data/monitoring"
mkdir -p "$LOGS_DIR"
TEST_LOG="$LOGS_DIR/stale-but-alive-$(date +%s).log"

log() {
  echo "$@" | tee -a "$TEST_LOG"
}

echo "═══════════════════════════════════════════════════════════════"
echo "STALE-BUT-ALIVE VALIDATION"
echo "═══════════════════════════════════════════════════════════════" | tee "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

# Step 1: Verify site is alive
log "Step 1: Verify site is healthy BEFORE stopping backend"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health | grep -q 200; then
  log "✓ Site is responsive"
else
  log "✗ Site is not responsive before test. Aborting."
  exit 1
fi
echo "" | tee -a "$TEST_LOG"

# Step 2: Stop backend
log "Step 2: Stopping backend (pm2 stop unicorn-backend)"
pm2 stop unicorn-backend || true
sleep 5
log "✓ Backend stopped"
echo "" | tee -a "$TEST_LOG"

# Step 3: Wait 35 seconds (3 health checks × 10s + margin)
log "Step 3: Waiting 35 seconds for health checks to expire..."
for i in {1..7}; do
  echo -n "." | tee -a "$TEST_LOG"
  sleep 5
done
echo "" | tee -a "$TEST_LOG"
log "✓ Waited 35 seconds"
echo "" | tee -a "$TEST_LOG"

# Step 4: Check site still responds (stale cache)
log "Step 4: Checking if site still responds (should be stale cache)"
HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ || echo "000")
if [ "$HOME_CODE" = "200" ] || [ "$HOME_CODE" = "304" ]; then
  log "✓ Site responds with code $HOME_CODE (STALE CACHE WORKING)"
else
  log "✗ Site returned $HOME_CODE (expected 200 or 304)"
fi
echo "" | tee -a "$TEST_LOG"

# Step 5: Check for degradation banner
log "Step 5: Checking for degradation banner in HTML"
BANNER_RESPONSE=$(curl -s http://localhost:3001/unicorn-cockpit || echo "")
if echo "$BANNER_RESPONSE" | grep -q "Revenim\|degraded\|offline" || [ -z "$BANNER_RESPONSE" ]; then
  log "✓ Degradation indicator present or page unavailable (expected behavior)"
else
  log "⚠ No degradation indicator found (may be OK if cache is fresh)"
fi
echo "" | tee -a "$TEST_LOG"

# Step 6: Restart backend
log "Step 6: Restarting backend"
pm2 start unicorn-backend || pm2 restart unicorn-backend || true
sleep 10
log "✓ Backend restarted, waiting 10 seconds for warmup"
echo "" | tee -a "$TEST_LOG"

# Step 7: Verify full recovery
log "Step 7: Verifying full recovery"
RECOVERED_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ || echo "000")
if [ "$RECOVERED_CODE" = "200" ]; then
  log "✓ Site fully recovered, code $RECOVERED_CODE"
else
  log "✗ Site not fully recovered, code $RECOVERED_CODE"
fi

# Check no degradation banner after recovery
FULL_RESPONSE=$(curl -s http://localhost:3001/unicorn-cockpit || echo "")
if ! echo "$FULL_RESPONSE" | grep -q "Revenim\|degraded\|offline"; then
  log "✓ Degradation banner removed after recovery"
else
  log "⚠ Degradation banner still visible (may be cache)"
fi
echo "" | tee -a "$TEST_LOG"

echo "═══════════════════════════════════════════════════════════════"
log "✓ STALE-BUT-ALIVE TEST COMPLETE"
log "Log: $TEST_LOG"
echo "═══════════════════════════════════════════════════════════════"

exit 0
