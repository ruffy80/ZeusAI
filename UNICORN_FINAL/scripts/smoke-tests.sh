#!/bin/bash
# SaaS Smoke Tests: health, catalog, homepage
set -e

BASE_URL="http://localhost:3000"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

echo "[SMOKE] /api/health..."
curl -sf "$BASE_URL/api/health" || fail "/api/health failed"

echo "[SMOKE] /api/catalog..."
curl -sf "$BASE_URL/api/catalog" || fail "/api/catalog failed"

echo "[SMOKE] homepage..."
curl -sf "$BASE_URL/" || fail "/ homepage failed"

echo "[OK] All smoke tests passed."
