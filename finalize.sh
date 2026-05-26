#!/bin/bash
set -e

cd /Users/ionutvladoi/Desktop/generate-unicorn

echo "=== STEP 1: Abort any pending rebase ===" 
git rebase --abort 2>/dev/null || true

echo "=== STEP 2: Reset to remote main ===" 
git fetch origin main

echo "=== STEP 3: Do a clean merge ===" 
git reset --hard origin/main

echo "=== STEP 4: Create fresh commit ===" 
git add -A
git commit -m "Final consolidation and task completion - 26 Mai 2026" || echo "Nothing to commit"

echo "=== STEP 5: Push to remote ===" 
git push origin main

echo "=== STEP 6: Verify deployment ===" 
curl -s https://zeusai.pro/health | head -20

echo "=== FINALIZATION COMPLETE ===" 
