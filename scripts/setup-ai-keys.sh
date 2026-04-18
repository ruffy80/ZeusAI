#!/usr/bin/env bash
# ============================================================
# UNICORN — Setup AI Provider API Keys on Hetzner server
#
# Usage:
#   bash scripts/setup-ai-keys.sh [DEPLOY_PATH]
#
# Exemplu interactiv (recomand):
#   bash scripts/setup-ai-keys.sh /opt/unicorn
#
# Sau cu variabile de mediu predefinite:
#   OPENAI_API_KEY=sk-... DEEPSEEK_API_KEY=sk-... bash scripts/setup-ai-keys.sh
#
# Scriptul:
#   1. Cere fiecare cheie interactiv (sau citește din env)
#   2. Actualizează DEPLOY_PATH/.env (create dacă nu există)
#   3. Restarteaza PM2 unicorn-backend
# ============================================================
set -euo pipefail

DEPLOY_PATH="${1:-/opt/unicorn}"
ENV_FILE="$DEPLOY_PATH/.env"

echo "🔑 Zeus AI — Configurare chei AI providers"
echo "   Fișier .env: $ENV_FILE"
echo ""

# ── Funcție: citește valoare din env sau interactiv ───────────────────────────
read_key() {
  local varname="$1"
  local label="$2"
  local current="${!varname:-}"

  if [ -n "$current" ]; then
    echo "  ✅ $label setată din variabila de mediu."
    echo "$current"
    return
  fi

  # Citim din .env existent dacă există
  if [ -f "$ENV_FILE" ]; then
    local existing
    existing=$(grep -E "^${varname}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | head -1 || true)
    if [ -n "$existing" ] && [[ "$existing" != *"your_"* ]] && [[ "$existing" != *"YOUR_"* ]]; then
      echo "  ✅ $label găsită în .env existent."
      echo "$existing"
      return
    fi
  fi

  # Citim interactiv
  local val=""
  while [ -z "$val" ]; do
    read -rsp "  Introduceți $label (Enter pentru a sări): " val 2>/dev/null || true
    echo ""
    if [ -z "$val" ]; then
      echo "  ⏭️  $label omisă."
      echo ""
      return
    fi
  done
  echo "$val"
}

# ── Creare/actualizare .env ───────────────────────────────────────────────────
update_env() {
  local key="$1"
  local val="$2"
  [ -z "$val" ] && return
  [ -f "$ENV_FILE" ] && sed -i "/^${key}=/d" "$ENV_FILE" 2>/dev/null || true
  printf "%s=%s\n" "$key" "$val" >> "$ENV_FILE"
}

# ── Citire chei ───────────────────────────────────────────────────────────────
echo "Completați fiecare cheie API. Apăsați Enter pentru a sări una."
echo "Cheile introduse NU apar pe ecran (securitate)."
echo ""

OPENAI_VAL=$(read_key    "OPENAI_API_KEY"    "OpenAI API Key    (sk-...)")
DEEPSEEK_VAL=$(read_key  "DEEPSEEK_API_KEY"  "DeepSeek API Key  (sk-...)")
ANTHROPIC_VAL=$(read_key "ANTHROPIC_API_KEY" "Anthropic API Key (sk-ant-...)")
GEMINI_VAL=$(read_key    "GEMINI_API_KEY"    "Gemini API Key    (AIza...)")
MISTRAL_VAL=$(read_key   "MISTRAL_API_KEY"   "Mistral API Key")
COHERE_VAL=$(read_key    "COHERE_API_KEY"    "Cohere API Key")
XAI_VAL=$(read_key       "XAI_API_KEY"       "xAI Grok API Key  (xai-...)")

# ── Scriere în .env ───────────────────────────────────────────────────────────
mkdir -p "$DEPLOY_PATH"
touch "$ENV_FILE"

update_env "OPENAI_API_KEY"    "$OPENAI_VAL"
update_env "DEEPSEEK_API_KEY"  "$DEEPSEEK_VAL"
update_env "ANTHROPIC_API_KEY" "$ANTHROPIC_VAL"
update_env "GEMINI_API_KEY"    "$GEMINI_VAL"
update_env "MISTRAL_API_KEY"   "$MISTRAL_VAL"
update_env "COHERE_API_KEY"    "$COHERE_VAL"
update_env "XAI_API_KEY"       "$XAI_VAL"

echo ""
echo "✅ Cheile AI au fost salvate în $ENV_FILE"

# ── Restart PM2 ───────────────────────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  echo "🔄 Repornire PM2 unicorn-backend..."
  cd "$DEPLOY_PATH"
  pm2 restart unicorn-backend 2>/dev/null || pm2 restart all 2>/dev/null || true
  echo "✅ PM2 repornit. Cheile sunt active."
else
  echo "⚠️  PM2 nu este instalat. Reporniți manual aplicația."
fi

echo ""
echo "🧪 Verificare status provideri AI:"
sleep 2
curl -sf "http://localhost:3000/api/ai/status" 2>/dev/null | \
  node -e "
    const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const p=d.providers||[];
    p.forEach(x=>console.log(' '+(x.configured?'✅':'❌')+' '+x.provider));
    console.log('Active:',p.filter(x=>x.configured).length+'/'+p.length);
  " 2>/dev/null || echo "  (status check disponibil după restart complet)"

echo ""
echo "Done! Acces la status: https://zeusai.pro/api/ai/status"
