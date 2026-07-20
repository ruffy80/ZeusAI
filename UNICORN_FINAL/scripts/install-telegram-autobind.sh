#!/usr/bin/env bash
# Install / refresh the ZeusAI Telegram autobind PM2 process on the live VPS.
# Idempotent. Does not invent tokens — reads TELEGRAM_BOT_TOKEN from shared .env.
set -euo pipefail

export HOME="${HOME:-/root}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"

LIVE="${UNICORN_LIVE:-/var/www/unicorn/UNICORN_FINAL}"
SHARED="${UNICORN_SHARED_ROOT:-/var/www/unicorn/shared}"
SCRIPT="$LIVE/scripts/zeus-telegram-autobind.js"
NAME="zeus-telegram-autobind"

if [ ! -f "$SCRIPT" ]; then
  echo "[tg-install] missing $SCRIPT" >&2
  exit 1
fi

if ! grep -qE '^TELEGRAM_BOT_TOKEN=.+' "$SHARED/.env" 2>/dev/null \
  && ! grep -qE '^TG_BOT_TOKEN=.+' "$SHARED/.env" 2>/dev/null; then
  echo "[tg-install] TELEGRAM_BOT_TOKEN not set in $SHARED/.env" >&2
  exit 1
fi

mkdir -p "$SHARED/data/telegram"
chmod 700 "$SHARED/data/telegram" || true

# Point preferred target at the real public channel (exists; writable once bot is admin).
# Do NOT invent a fake @unicorn_ai_channel username.
if grep -qE '^TELEGRAM_CHAT_ID=@unicorn_ai_channel$' "$SHARED/.env" 2>/dev/null \
  || grep -qE '^TELEGRAM_CHAT_ID=$' "$SHARED/.env" 2>/dev/null; then
  # Keep placeholder that exists publicly so readiness stays honest until bind.
  tmp="$(mktemp)"
  awk '
    BEGIN{done=0}
    /^TELEGRAM_CHAT_ID=/ { print "TELEGRAM_CHAT_ID=@unicorn_platform"; done=1; next }
    { print }
    END { if (!done) print "TELEGRAM_CHAT_ID=@unicorn_platform" }
  ' "$SHARED/.env" >"$tmp"
  mv "$tmp" "$SHARED/.env"
  chmod 600 "$SHARED/.env"
  # mirror aliases
  for k in TG_CHAT_ID ZAC_TELEGRAM_CHAT_ID; do
    if grep -qE "^${k}=" "$SHARED/.env"; then
      tmp="$(mktemp)"
      awk -v k="$k" 'BEGIN{d=0} $0~("^"k"="){print k"=@unicorn_platform"; d=1; next} {print} END{if(!d) print k"=@unicorn_platform"}' "$SHARED/.env" >"$tmp"
      mv "$tmp" "$SHARED/.env"
      chmod 600 "$SHARED/.env"
    else
      printf '%s=@unicorn_platform\n' "$k" >>"$SHARED/.env"
    fi
  done
  echo "[tg-install] retargeted TELEGRAM_CHAT_ID → @unicorn_platform (pending admin add)"
fi

# Mirror token+chat into /etc/zeusai/secrets/telegram.env (no cleartext logs)
mkdir -p /etc/zeusai/secrets
python3 - <<'PY'
import os, re
shared = os.environ.get("UNICORN_SHARED_ENV", "/var/www/unicorn/shared/.env")
dest = os.environ.get("ZEUS_TG_SECRETS_ENV", "/etc/zeusai/secrets/telegram.env")
keys = [
  "TELEGRAM_BOT_TOKEN","TG_BOT_TOKEN","ZAC_TELEGRAM_TOKEN",
  "TELEGRAM_CHAT_ID","TG_CHAT_ID","ZAC_TELEGRAM_CHAT_ID",
]
env = {}
for ln in open(shared, encoding="utf-8", errors="ignore"):
  ln=ln.strip()
  if not ln or ln.startswith("#") or "=" not in ln: continue
  k,v=ln.split("=",1)
  if k in keys and v.strip(): env[k]=v.strip()
# alias fill
if env.get("TELEGRAM_BOT_TOKEN"):
  env.setdefault("TG_BOT_TOKEN", env["TELEGRAM_BOT_TOKEN"])
  env.setdefault("ZAC_TELEGRAM_TOKEN", env["TELEGRAM_BOT_TOKEN"])
if env.get("TELEGRAM_CHAT_ID"):
  env.setdefault("TG_CHAT_ID", env["TELEGRAM_CHAT_ID"])
  env.setdefault("ZAC_TELEGRAM_CHAT_ID", env["TELEGRAM_CHAT_ID"])
lines=[]
if os.path.exists(dest):
  lines=open(dest, encoding="utf-8", errors="ignore").read().splitlines()
seen=set(); out=[]
for ln in lines:
  if "=" in ln and not ln.strip().startswith("#"):
    k=ln.split("=",1)[0].strip()
    if k in env:
      out.append(f"{k}={env[k]}"); seen.add(k); continue
  out.append(ln)
for k,v in env.items():
  if k not in seen: out.append(f"{k}={v}")
open(dest,"w").write("\n".join(out).rstrip()+"\n")
os.chmod(dest, 0o600)
print("[tg-install] mirrored telegram.env keys:", ",".join(sorted(env)))
PY

export ZEUS_TG_PREFERRED_CHAT="${ZEUS_TG_PREFERRED_CHAT:-unicorn_platform}"
export UNICORN_SHARED_ENV="${UNICORN_SHARED_ENV:-$SHARED/.env}"
export ZEUS_TG_STATUS_FILE="${ZEUS_TG_STATUS_FILE:-$SHARED/data/telegram/bind-status.json}"

if pm2 describe "$NAME" >/dev/null 2>&1; then
  pm2 restart "$NAME" --update-env
else
  pm2 start "$SCRIPT" --name "$NAME" --time \
    --update-env \
    --interpreter node \
    -- \
    || pm2 start "$SCRIPT" --name "$NAME" --time --interpreter node
fi
pm2 save || true
echo "[tg-install] $NAME running; status → $ZEUS_TG_STATUS_FILE"
pm2 describe "$NAME" | head -n 25 || true
