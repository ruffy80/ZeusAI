#!/bin/sh
set -eu

AUTONOMY_ROOT="${AUTONOMY_ROOT:-/opt/unicorn}"
LOG_PATH="${AUTONOMOUS_ACTION_LOG_PATH:-/var/log/autonomous_actions.log}"
REPORT_DIR="$AUTONOMY_ROOT/reports"
mkdir -p "$REPORT_DIR" "$(dirname "$LOG_PATH")"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DATE_TAG="$(date -u +%F)"
export TS

measure() {
  URL="$1"
  curl -sS -o /tmp/autonomy.$$ -w '%{http_code} %{time_total}' --max-time 12 "$URL" || printf '000 12.000'
}

HEALTH_METRIC="$(measure http://127.0.0.1:3001/health)"
PRICING_METRIC="$(measure http://127.0.0.1:3001/api/pricing/all)"
CHECKOUT_METRIC="$(measure http://127.0.0.1:3001/api/checkout/health)"
SNAPSHOT_SAMPLE="$(curl -sS --max-time 12 http://127.0.0.1:3001/snapshot | head -c 1000 || true)"
export HEALTH_METRIC PRICING_METRIC CHECKOUT_METRIC SNAPSHOT_SAMPLE

JSON_LINE=$(python3 - <<'PY'
import json, os
print(json.dumps({
  "ts": os.environ["TS"],
  "kind": "daily_performance_report",
  "health": os.environ.get("HEALTH_METRIC", ""),
  "pricing": os.environ.get("PRICING_METRIC", ""),
  "checkout": os.environ.get("CHECKOUT_METRIC", ""),
  "snapshotSample": os.environ.get("SNAPSHOT_SAMPLE", ""),
}))
PY
)

printf '%s\n' "$JSON_LINE" | tee -a "$LOG_PATH" > "$REPORT_DIR/daily-$DATE_TAG.json"
