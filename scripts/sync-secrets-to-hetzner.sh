#!/usr/bin/env bash
# ============================================================================
# sync-secrets-to-hetzner.sh
#
# Pushes Stripe webhook secret + DR (S3 backup) credentials to the production
# Hetzner host and arms DR_AUTOPILOT_ENABLED safely.
#
# Inputs (read from .env.secrets.local — gitignored, never committed):
#   STRIPE_WEBHOOK_SECRET     — whsec_<...>          (from Stripe Dashboard)
#   DR_S3_BUCKET              — bucket name          (created in AWS Console)
#   DR_AWS_ACCESS_KEY_ID      — AKIA<16 chars>       (IAM user keys)
#   DR_AWS_SECRET_ACCESS_KEY  — 40-char secret       (IAM user keys)
#   DR_AUTOPILOT_ENABLED      — 1 (will only be honored if all of above are real)
#
# Hetzner connection details come from .env.auto-connector:
#   HETZNER_HOST, HETZNER_USER, HETZNER_KEY_PATH, HETZNER_DEPLOY_PORT,
#   HETZNER_DEPLOY_PATH
#
# Behavior:
#   • Validates each secret's format. Invalid → abort, no changes.
#   • Refuses to set DR_AUTOPILOT_ENABLED=1 unless all 3 AWS fields are real.
#   • Writes /root/unicorn-final/UNICORN_FINAL/.env.local on the server with
#     chmod 600. Idempotent (replaces only the targeted keys, preserves rest).
#   • Triggers `pm2 reload all --update-env` for a zero-downtime cluster reload.
#   • Verifies the new env was picked up by the running processes.
#
# Run from repo root:  bash scripts/sync-secrets-to-hetzner.sh
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS_FILE="$REPO_ROOT/.env.secrets.local"
CONNECTOR_FILE="$REPO_ROOT/.env.auto-connector"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "❌  $SECRETS_FILE not found." >&2
  echo "    Copy the template first:" >&2
  echo "      cp .env.secrets.local.example .env.secrets.local" >&2
  echo "    Then fill in the values from Stripe Dashboard + AWS Console." >&2
  exit 1
fi

if [ ! -f "$CONNECTOR_FILE" ]; then
  echo "❌  $CONNECTOR_FILE not found — cannot resolve Hetzner host." >&2
  exit 1
fi

# ── Source files in a subshell to extract just what we need ──────────────────
get_var() {
  local file="$1" key="$2"
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//' || true
}

STRIPE_WEBHOOK_SECRET="$(get_var "$SECRETS_FILE" STRIPE_WEBHOOK_SECRET)"
DR_S3_BUCKET="$(get_var "$SECRETS_FILE" DR_S3_BUCKET)"
DR_AWS_ACCESS_KEY_ID="$(get_var "$SECRETS_FILE" DR_AWS_ACCESS_KEY_ID)"
DR_AWS_SECRET_ACCESS_KEY="$(get_var "$SECRETS_FILE" DR_AWS_SECRET_ACCESS_KEY)"
DR_AUTOPILOT_ENABLED_REQUEST="$(get_var "$SECRETS_FILE" DR_AUTOPILOT_ENABLED)"

HETZNER_HOST="$(get_var "$CONNECTOR_FILE" HETZNER_HOST)"
HETZNER_USER="$(get_var "$CONNECTOR_FILE" HETZNER_USER)"
HETZNER_KEY_PATH="$(get_var "$CONNECTOR_FILE" HETZNER_KEY_PATH)"
HETZNER_DEPLOY_PORT="$(get_var "$CONNECTOR_FILE" HETZNER_DEPLOY_PORT)"
HETZNER_DEPLOY_PATH="$(get_var "$CONNECTOR_FILE" HETZNER_DEPLOY_PATH)"
: "${HETZNER_DEPLOY_PORT:=22}"
: "${HETZNER_DEPLOY_PATH:=/root/unicorn-final}"

# ── Validate Hetzner connectivity inputs ─────────────────────────────────────
[ -n "$HETZNER_HOST" ] || { echo "❌ HETZNER_HOST missing in $CONNECTOR_FILE"; exit 1; }
[ -n "$HETZNER_USER" ] || HETZNER_USER=root
[ -f "$HETZNER_KEY_PATH" ] || { echo "❌ SSH key not found at $HETZNER_KEY_PATH"; exit 1; }

# ── Validate secret formats (format check, NOT semantic check) ───────────────
declare -a VALID_KEYS=()
declare -a INVALID_REASONS=()

push_valid()   { VALID_KEYS+=("$1=$2"); }
push_invalid() { INVALID_REASONS+=("$1: $2"); }

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  push_invalid "STRIPE_WEBHOOK_SECRET" "empty — get it from Stripe Dashboard → Developers → Webhooks"
elif [[ "$STRIPE_WEBHOOK_SECRET" =~ ^whsec_[A-Za-z0-9_-]{16,}$ ]]; then
  push_valid "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"
else
  push_invalid "STRIPE_WEBHOOK_SECRET" "format invalid — must start with whsec_ and be ≥22 chars"
fi

DR_FIELDS_VALID=1
if [ -z "$DR_S3_BUCKET" ]; then
  push_invalid "DR_S3_BUCKET" "empty — create the S3 bucket in AWS Console first"
  DR_FIELDS_VALID=0
elif [[ "$DR_S3_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{2,62}$ ]]; then
  push_valid "DR_S3_BUCKET" "$DR_S3_BUCKET"
else
  push_invalid "DR_S3_BUCKET" "invalid bucket name (lowercase, 3–63 chars, alnum + . -)"
  DR_FIELDS_VALID=0
fi

if [ -z "$DR_AWS_ACCESS_KEY_ID" ]; then
  push_invalid "DR_AWS_ACCESS_KEY_ID" "empty — IAM user → Access keys"
  DR_FIELDS_VALID=0
elif [[ "$DR_AWS_ACCESS_KEY_ID" =~ ^(AKIA|ASIA)[A-Z0-9]{16,}$ ]]; then
  push_valid "DR_AWS_ACCESS_KEY_ID" "$DR_AWS_ACCESS_KEY_ID"
else
  push_invalid "DR_AWS_ACCESS_KEY_ID" "format invalid — must start with AKIA or ASIA"
  DR_FIELDS_VALID=0
fi

if [ -z "$DR_AWS_SECRET_ACCESS_KEY" ]; then
  push_invalid "DR_AWS_SECRET_ACCESS_KEY" "empty"
  DR_FIELDS_VALID=0
elif [ ${#DR_AWS_SECRET_ACCESS_KEY} -ge 30 ]; then
  push_valid "DR_AWS_SECRET_ACCESS_KEY" "$DR_AWS_SECRET_ACCESS_KEY"
else
  push_invalid "DR_AWS_SECRET_ACCESS_KEY" "too short — AWS secret access keys are 40 chars"
  DR_FIELDS_VALID=0
fi

# DR_AUTOPILOT_ENABLED is allowed ONLY if every DR field validated.
if [ "$DR_AUTOPILOT_ENABLED_REQUEST" = "1" ] && [ "$DR_FIELDS_VALID" = "1" ]; then
  push_valid "DR_AUTOPILOT_ENABLED" "1"
  AUTOPILOT_FINAL=1
else
  push_valid "DR_AUTOPILOT_ENABLED" "0"
  AUTOPILOT_FINAL=0
  if [ "$DR_AUTOPILOT_ENABLED_REQUEST" = "1" ]; then
    echo "⚠️  Refusing to set DR_AUTOPILOT_ENABLED=1: AWS credentials missing/invalid."
    echo "    The flag will be written as 0 instead — no log spam, no broken cron."
  fi
fi

# ── Print plan ──────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Hetzner secrets sync plan"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Host:       $HETZNER_USER@$HETZNER_HOST:$HETZNER_DEPLOY_PORT"
echo "  Path:       $HETZNER_DEPLOY_PATH/UNICORN_FINAL/.env.local"
echo ""
echo "  Will SET (or replace) these keys:"
for kv in "${VALID_KEYS[@]}"; do
  k="${kv%%=*}"
  v="${kv#*=}"
  if [ ${#v} -gt 8 ]; then
    masked="${v:0:4}...${v: -4}"
  else
    masked="$v"
  fi
  echo "    • $k = $masked"
done

if [ ${#INVALID_REASONS[@]} -gt 0 ]; then
  echo ""
  echo "  Invalid / missing (NOT pushed):"
  for r in "${INVALID_REASONS[@]}"; do
    echo "    ✗ $r"
  done
  echo ""
  echo "  Aborting — fix the issues above in .env.secrets.local and re-run." >&2
  exit 2
fi

echo ""
echo "  DR autopilot 24h cron arm flag → DR_AUTOPILOT_ENABLED=$AUTOPILOT_FINAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Build the remote upsert script ──────────────────────────────────────────
TMP_PAYLOAD="$(mktemp)"
trap 'rm -f "$TMP_PAYLOAD"' EXIT

cat > "$TMP_PAYLOAD" <<EOF_PAYLOAD
$(for kv in "${VALID_KEYS[@]}"; do echo "$kv"; done)
EOF_PAYLOAD

REMOTE_ENV="$HETZNER_DEPLOY_PATH/UNICORN_FINAL/.env.local"

REMOTE_SCRIPT=$(cat <<'REMOTE_EOF'
set -euo pipefail
ENV_FILE="__REMOTE_ENV__"
PAYLOAD="/tmp/.zeus-secrets-payload.$$"
cat > "$PAYLOAD"
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Idempotent upsert: for every KEY=VALUE on stdin, replace existing line
# (matched by KEY=) or append. Preserves all unrelated keys.
TMPNEW="${ENV_FILE}.new.$$"
cp "$ENV_FILE" "$TMPNEW"
while IFS= read -r line; do
  [ -z "$line" ] && continue
  key="${line%%=*}"
  if grep -qE "^${key}=" "$TMPNEW"; then
    # macOS sed and GNU sed both: use a temp swap to avoid -i differences
    awk -v k="$key" -v repl="$line" 'BEGIN{p=0} { if ($0 ~ "^" k "=") { print repl; p=1 } else print $0 } END { if (!p) print repl }' "$TMPNEW" > "${TMPNEW}.tmp"
    mv "${TMPNEW}.tmp" "$TMPNEW"
  else
    echo "$line" >> "$TMPNEW"
  fi
done < "$PAYLOAD"

mv "$TMPNEW" "$ENV_FILE"
chmod 600 "$ENV_FILE"
rm -f "$PAYLOAD"

echo "[hetzner] wrote $ENV_FILE (chmod 600)"
echo "[hetzner] keys present (masked):"
grep -E "^(STRIPE_WEBHOOK_SECRET|DR_S3_BUCKET|DR_AWS_ACCESS_KEY_ID|DR_AWS_SECRET_ACCESS_KEY|DR_AUTOPILOT_ENABLED)=" "$ENV_FILE" \
  | awk -F= '{ k=$1; v=$2; if (length(v) > 8) print "  " k " = " substr(v,1,4) "..." substr(v,length(v)-3); else print "  " k " = " v }'

echo ""
echo "[hetzner] reloading pm2 with --update-env (zero-downtime)…"
cd "$(dirname "$ENV_FILE")"
pm2 reload all --update-env >/dev/null 2>&1 || pm2 restart all --update-env
sleep 2

echo "[hetzner] verifying running processes picked up the new env:"
BACKEND_PID="$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);const b=a.find(x=>x.name==="unicorn-backend");process.stdout.write(String(b?b.pid:""))}catch(e){}})')"
if [ -n "$BACKEND_PID" ] && [ -r "/proc/$BACKEND_PID/environ" ]; then
  for K in STRIPE_WEBHOOK_SECRET DR_S3_BUCKET DR_AWS_ACCESS_KEY_ID DR_AUTOPILOT_ENABLED; do
    V="$(tr '\0' '\n' </proc/$BACKEND_PID/environ | grep -E "^${K}=" | head -1 | cut -d= -f2- || true)"
    if [ -n "$V" ]; then
      if [ ${#V} -gt 8 ]; then
        echo "  ✓ pm2 backend [$BACKEND_PID]: $K = ${V:0:4}...${V: -4}"
      else
        echo "  ✓ pm2 backend [$BACKEND_PID]: $K = $V"
      fi
    else
      echo "  ✗ pm2 backend [$BACKEND_PID]: $K NOT in process env"
    fi
  done
else
  echo "  (could not read /proc/<pid>/environ — check 'pm2 env unicorn-backend' manually)"
fi

echo "[hetzner] sync complete."
REMOTE_EOF
)
REMOTE_SCRIPT="${REMOTE_SCRIPT//__REMOTE_ENV__/$REMOTE_ENV}"

# ── Execute remotely, piping the payload over the same SSH session ──────────
SSH_OPTS=(-i "$HETZNER_KEY_PATH" -p "$HETZNER_DEPLOY_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=15)

# Send REMOTE_SCRIPT via -c, payload via stdin
ssh "${SSH_OPTS[@]}" "$HETZNER_USER@$HETZNER_HOST" "bash -s" < <(
  echo "$REMOTE_SCRIPT"
  echo ""
  echo "# === payload begins ==="
) > /dev/null 2>&1 || true   # discarded; we run the real one below

# Two-stage: write a heredoc-quoted script first then pipe payload
# Cleaner: write the script remotely, then exec it with payload on stdin.
REMOTE_RUNNER="/tmp/zeus-secrets-runner.$$.sh"
ssh "${SSH_OPTS[@]}" "$HETZNER_USER@$HETZNER_HOST" "cat > $REMOTE_RUNNER && chmod +x $REMOTE_RUNNER" <<<"$REMOTE_SCRIPT"
ssh "${SSH_OPTS[@]}" "$HETZNER_USER@$HETZNER_HOST" "bash $REMOTE_RUNNER && rm -f $REMOTE_RUNNER" < "$TMP_PAYLOAD"

echo ""
echo "✅ Done."
if [ "$AUTOPILOT_FINAL" = "1" ]; then
  echo "   DR autopilot is ARMED — first backup will run within 24h."
  echo "   Manual trigger:  ssh into Hetzner and run:"
  echo "     cd $HETZNER_DEPLOY_PATH/UNICORN_FINAL && node -e \"require('./backend/modules/disaster-recovery').backupToS3().then(r=>console.log(r))\""
else
  echo "   DR autopilot remains DISARMED (DR_AUTOPILOT_ENABLED=0)."
  echo "   Provide all three AWS values in .env.secrets.local and re-run to arm it."
fi
