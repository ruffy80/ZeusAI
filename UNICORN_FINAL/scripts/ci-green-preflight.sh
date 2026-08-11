#!/usr/bin/env bash
# =============================================================================
# CI Green Preflight (CGP/1.0) — fail-fast gate before the full unit suite.
#
# Catches the two failure classes that recently blocked Stable Deploy + heal:
#   1) Phone console recovery regressing to curl (zeus-trust-sync.test.js)
#   2) Phoenix Continuity OS contract drift (phoenix-continuity.test.js)
#
# Runs in <30s so Actions fails in the first minute instead of after ~12m of
# suite work. Invoked from .github/workflows/deploy.yml before `npm test`.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DISABLE_SELF_MUTATION="${DISABLE_SELF_MUTATION:-1}"
export NODE_ENV="${NODE_ENV:-test}"
export UNICORN_RUNTIME_PROFILE="${UNICORN_RUNTIME_PROFILE:-stable}"

echo "[ci-green-preflight] critical contract tests"
node test/zeus-trust-sync.test.js
if [ -f test/phoenix-continuity.test.js ]; then
  node test/phoenix-continuity.test.js
fi
echo "[ci-green-preflight] OK"
