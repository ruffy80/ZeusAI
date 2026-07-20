#!/usr/bin/env bash
# zeus-secrets-propagate-live.sh
# ---------------------------------------------------------------------------
# Uses the canonical Unicorn secrets stack (src/config/secrets.js + QuantumVault
# doctrine) to PROPAGATE existing secrets into the live shared .env on Hetzner.
#
# What it DOES:
#   • Merge /etc/zeusai/secrets/*.env → /var/www/unicorn/shared/.env
#   • Merge data/runtime-secrets.json internal keys (JWT/ADMIN/VAULT…)
#   • Resolve aliases via secrets.js bootstrap (TELEGRAM_CHAT_ID ↔ TG_CHAT_ID, …)
#   • Reload PM2 with --update-env
#   • Print /api/activation/readiness (no secret values)
#
# What it NEVER does:
#   • Invent external provider keys (Resend/Stripe/CJ/Telegram bot token, …)
#   • Overwrite a real value with a placeholder / empty string
#   • Log cleartext secret values
#
# Usage (on VPS as root):
#   bash /var/www/unicorn/UNICORN_FINAL/scripts/zeus-secrets-propagate-live.sh
# Remote:
#   ssh -i ~/.ssh/deploy_key root@204.168.230.142 \
#     'bash /var/www/unicorn/UNICORN_FINAL/scripts/zeus-secrets-propagate-live.sh'
# ---------------------------------------------------------------------------
set -euo pipefail

export HOME="${HOME:-/root}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"

SHARED="${UNICORN_SHARED_ROOT:-/var/www/unicorn/shared}"
ENV_FILE="${UNICORN_SHARED_ENV:-$SHARED/.env}"
RUNTIME_SECRETS="${UNICORN_RUNTIME_SECRETS_FILE:-$SHARED/data/runtime-secrets.json}"
AI_KEYS_DIR="${ZEUS_AI_KEYS_DIR:-/etc/zeusai/secrets}"
LIVE="${UNICORN_LIVE:-/var/www/unicorn/UNICORN_FINAL}"

log() { printf '[zeus-secrets] %s\n' "$*"; }

mkdir -p "$(dirname "$ENV_FILE")" "$SHARED/data"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Portable upsert: never replace a real value with empty/placeholder.
upsert() {
  local k="$1" v="$2"
  [ -n "$k" ] || return 0
  v="$(printf '%s' "$v" | tr -d '\r')"
  [ -n "$v" ] || return 0
  case "$v" in
    your_*|changeme|placeholder|xxx|example|TODO|null|undefined|none|skip) return 0 ;;
  esac
  if grep -qE "^${k}=" "$ENV_FILE" 2>/dev/null; then
    local cur
    cur="$(grep -E "^${k}=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
    if [ -n "$cur" ] && [ "$cur" = "$v" ]; then
      return 0
    fi
    # Keep existing non-empty unless the new value is clearly longer/realer
    # OR existing looks like a placeholder.
    if [ -n "$cur" ] && ! printf '%s' "$cur" | grep -qiE '^(your_|changeme|placeholder|xxx|example|TODO|null|undefined|none|skip)'; then
      # Prefer upgrading short stubs (len<8) when we have a longer real key.
      if [ "${#cur}" -ge 8 ] && [ "${#v}" -le "${#cur}" ]; then
        return 0
      fi
    fi
    local tmp
    tmp="$(mktemp)"
    awk -v k="$k" -v val="$v" 'BEGIN{d=0} $0~("^"k"="){print k"="val; d=1; next} {print} END{if(!d) print k"="val}' "$ENV_FILE" >"$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$k" "$v" >>"$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE" || true
  log "upsert $k (len=${#v})"
}

# 1) Merge /etc/zeusai/secrets/*.env
if [ -d "$AI_KEYS_DIR" ]; then
  shopt -s nullglob
  for f in "$AI_KEYS_DIR"/*.env; do
    log "merge source $f"
    while IFS= read -r ln || [ -n "$ln" ]; do
      [[ -z "$ln" || "$ln" =~ ^[[:space:]]*# ]] && continue
      [[ "$ln" != *"="* ]] && continue
      k="${ln%%=*}"; v="${ln#*=}"
      k="$(echo "$k" | xargs)"
      v="${v%$'\r'}"
      v="${v%\"}"; v="${v#\"}"
      v="${v%\'}"; v="${v#\'}"
      upsert "$k" "$v"
    done <"$f"
  done
  shopt -u nullglob
fi

# 2) Merge runtime-secrets.json (internal only)
if [ -f "$RUNTIME_SECRETS" ]; then
  log "merge runtime-secrets.json"
  ENV_FILE="$ENV_FILE" RUNTIME_SECRETS="$RUNTIME_SECRETS" python3 - <<'PY'
import json, os, re
env_file = os.environ["ENV_FILE"]
path = os.environ["RUNTIME_SECRETS"]
INTERNAL = {
  "JWT_SECRET","ADMIN_SECRET","ADMIN_MASTER_PASSWORD","ADMIN_2FA_CODE",
  "WEBHOOK_SECRET","VAULT_MASTER_SECRET","VAULT_EMERGENCY_CODE",
  "MASTER_CONFIG_SECRET","REFERRAL_SECRET","HETZNER_WEBHOOK_SECRET",
}
ph = re.compile(r"^(your_|changeme|placeholder|xxx|example|TODO|null|undefined|none|skip)", re.I)
try:
  data = json.load(open(path))
except Exception as e:
  print("[zeus-secrets] skip runtime-secrets:", e); raise SystemExit(0)
if not isinstance(data, dict):
  raise SystemExit(0)
lines = []
try:
  lines = open(env_file, encoding="utf-8", errors="ignore").read().splitlines()
except FileNotFoundError:
  pass
mp = {}
order = []
for ln in lines:
  if not ln or ln.strip().startswith("#") or "=" not in ln:
    order.append(("raw", ln)); continue
  k, v = ln.split("=", 1)
  k = k.strip()
  mp[k] = v
  order.append(("kv", k))
changed = []
for k, v in data.items():
  if k not in INTERNAL: continue
  v = str(v or "").strip()
  if not v or ph.search(v): continue
  cur = mp.get(k, "")
  if cur and len(cur) >= 8 and not ph.search(cur):
    continue
  mp[k] = v
  if not any(t == "kv" and name == k for t, name in order):
    order.append(("kv", k))
  changed.append(k)
out = []
seen = set()
for kind, val in order:
  if kind == "raw":
    out.append(val)
  else:
    if val in seen: continue
    seen.add(val)
    out.append(f"{val}={mp[val]}")
for k in mp:
  if k not in seen:
    out.append(f"{k}={mp[k]}")
open(env_file, "w").write("\n".join(out).rstrip() + "\n")
os.chmod(env_file, 0o600)
for k in changed:
  print(f"[zeus-secrets] upsert {k} (len={len(mp[k])})")
PY
fi

# 3) Alias resolution via secrets.js (in-process, then write resolved aliases back)
if [ -f "$LIVE/src/config/secrets.js" ]; then
  log "bootstrap aliases via secrets.js"
  node <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');
const ENV_FILE = process.env.ENV_FILE || '/var/www/unicorn/shared/.env';
const LIVE = process.env.LIVE || '/var/www/unicorn/UNICORN_FINAL';

// Load shared .env into process.env first (without clobbering existing).
try {
  for (const ln of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    if (!ln || ln.trim().startsWith('#') || !ln.includes('=')) continue;
    const i = ln.indexOf('=');
    const k = ln.slice(0, i).trim();
    let v = ln.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && v && !process.env[k]) process.env[k] = v;
  }
} catch (_) {}

const secrets = require(path.join(LIVE, 'src/config/secrets.js'));
secrets.bootstrap({ log: false, persistGenerated: true });

// Alias pairs we must ensure exist in shared .env after bootstrap.
const ALIAS_ENSURE = [
  ['TELEGRAM_CHAT_ID', 'TG_CHAT_ID'],
  ['TG_CHAT_ID', 'TELEGRAM_CHAT_ID'],
  ['TELEGRAM_BOT_TOKEN', 'TG_BOT_TOKEN'],
  ['TG_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN'],
  ['ADMIN_SECRET', 'ADMIN_TOKEN'],
  ['ADMIN_TOKEN', 'ADMIN_SECRET'],
  ['WEBHOOK_SECRET', 'HETZNER_WEBHOOK_SECRET'],
  ['HETZNER_WEBHOOK_SECRET', 'WEBHOOK_SECRET'],
  ['BTC_WALLET_ADDRESS', 'OWNER_BTC_ADDRESS'],
  ['OWNER_BTC_ADDRESS', 'BTC_WALLET_ADDRESS'],
  ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEY'], // no-op identity — ensure present if bootstrapped
];

function upsert(k, v) {
  if (!k || !v) return;
  const ph = /^(your_|changeme|placeholder|xxx|example|TODO|null|undefined|none|skip)/i;
  if (ph.test(String(v).trim())) return;
  let body = '';
  try { body = fs.readFileSync(ENV_FILE, 'utf8'); } catch (_) {}
  const lines = body ? body.split(/\r?\n/) : [];
  let found = false;
  const out = lines.map((ln) => {
    if (ln.startsWith(k + '=')) { found = true; return k + '=' + v; }
    return ln;
  });
  if (!found) out.push(k + '=' + v);
  fs.writeFileSync(ENV_FILE, out.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
  console.log('[zeus-secrets] alias ' + k + ' (len=' + String(v).length + ')');
}

for (const [a, b] of ALIAS_ENSURE) {
  const av = String(process.env[a] || '').trim();
  const bv = String(process.env[b] || '').trim();
  if (av && !bv) upsert(b, av);
  if (bv && !av) upsert(a, bv);
  if (av) upsert(a, av);
  if (bv) upsert(b, bv);
}

const f = secrets.features();
console.log('[zeus-secrets] feature readiness:', JSON.stringify({
  coreRuntime: f.coreRuntime && f.coreRuntime.ready,
  btcDirectRevenue: f.btcDirectRevenue && f.btcDirectRevenue.ready,
  aiRouter: f.aiRouter && { ready: f.aiRouter.ready, configured: f.aiRouter.configured },
  email: f.email && { ready: f.email.ready, configured: f.email.configured, missing: f.email.missing },
  socialDistribution: f.socialDistribution && { ready: f.socialDistribution.ready, configured: f.socialDistribution.configured, missing: f.socialDistribution.missing },
  optionalPayments: f.optionalPayments && { ready: f.optionalPayments.ready, configured: f.optionalPayments.configured },
}));
NODE
else
  log "WARN: secrets.js not found at $LIVE — skipping alias bootstrap"
fi

chmod 600 "$ENV_FILE"

# 4) PM2 reload
if command -v pm2 >/dev/null 2>&1; then
  log "pm2 reload --update-env"
  cd "$LIVE" 2>/dev/null || true
  if [ -f "$LIVE/ecosystem.config.js" ]; then
    pm2 reload "$LIVE/ecosystem.config.js" --update-env >/dev/null 2>&1 \
      || pm2 restart unicorn-backend unicorn-site --update-env >/dev/null 2>&1 \
      || true
  else
    pm2 restart unicorn-backend unicorn-site --update-env >/dev/null 2>&1 || true
  fi
fi

sleep 4

# 5) Readiness (no secret values)
log "activation readiness:"
curl -sS --max-time 15 http://127.0.0.1:3000/api/activation/readiness 2>/dev/null \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(json.dumps({"activationScore":d.get("activationScore"),"armed":[x.get("id") for x in d.get("armed") or []],"missing":[{"id":x.get("id"),"envVars":x.get("envVars")} for x in d.get("missing") or []]}, indent=2))' \
  || log "readiness probe failed (backend still warming?)"

log "done — external provider keys still missing must be supplied by owner (module never invents them)"
