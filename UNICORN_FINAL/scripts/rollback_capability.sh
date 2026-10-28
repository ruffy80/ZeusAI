#!/bin/bash
# Restore one capability record from the last backup. Does not delete modules.
set -euo pipefail
CAP="${1:-}"
if [ -z "$CAP" ]; then
  echo "usage: rollback_capability.sh <capability>" >&2
  exit 2
fi
BACKUP="$(cat /opt/zeusai/.last_backup)"
SRC="$BACKUP/state/versions/${CAP}.json"
DEST="/opt/zeusai/state/versions/${CAP}.json"
if [ ! -f "$SRC" ]; then
  echo "no backed up version for $CAP" >&2
  exit 1
fi
mkdir -p /opt/zeusai/state/versions
cp "$SRC" "$DEST"
python3 - << PY
import json
p = "$DEST"
body = json.load(open(p))
body["rolled_back_at"] = __import__("datetime").datetime.utcnow().isoformat() + "Z"
json.dump(body, open(p, "w"), indent=2)
print("restored", "$CAP")
PY
