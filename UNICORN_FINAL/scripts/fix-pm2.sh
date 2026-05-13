#!/usr/bin/env bash
# =============================================================================
# fix-pm2.sh — Reparare completă PM2 + autostart la boot pe Hetzner
#
# Acoperă toți pașii necesari pentru a asigura că PM2 este funcțional
# și toate procesele Unicorn pornesc automat după fiecare restart server.
#
# Utilizare (ca root pe serverul Hetzner):
#   bash scripts/fix-pm2.sh [DEPLOY_PATH]
#
# Exemple:
#   bash scripts/fix-pm2.sh
#   bash scripts/fix-pm2.sh /var/www/unicorn
#
# Ce face:
#   1. Verifică instalarea PM2 (reinstalează dacă este corupt)
#   2. Identifică user-ul corect (root / SUDO_USER / nvm user)
#   3. Reconfigurează pm2 startup systemd
#   4. Pornește toate procesele din ecosystem.config.js
#   5. Salvează lista de procese (pm2 save)
#   6. Activează și verifică serviciul systemd pm2-*
#   7. Instalează unicorn.service ca fallback secundar
#   8. Testează că procesele crítico sunt online
# =============================================================================
set -euo pipefail

# ─── Parametri ───────────────────────────────────────────────────────────────
DEPLOY_PATH="${1:-/var/www/unicorn}"
NODE_PORT="${NODE_PORT:-3000}"
LOG_DIR="${DEPLOY_PATH}/logs"
LOG_FILE="${LOG_DIR}/fix-pm2-$(date +%Y%m%d-%H%M%S).log"

# ─── Culori ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0; FAIL=0; FIXED=0

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

ok()      { echo -e "${GREEN}✅  $1${NC}";   PASS=$((PASS+1));  }
ko()      { echo -e "${RED}❌  $1${NC}";     FAIL=$((FAIL+1));  }
fixed()   { echo -e "${CYAN}🔧  $1${NC}";   FIXED=$((FIXED+1)); }
info()    { echo -e "${BLUE}ℹ️   $1${NC}";  }
warn()    { echo -e "${YELLOW}⚠️   $1${NC}"; }
section() {
  echo ""
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${BLUE}  $1${NC}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
}

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}⚠️  Rulați ca root: sudo bash scripts/fix-pm2.sh${NC}"
  exit 1
fi

echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ZeusAI / Unicorn — PM2 Auto-Repair & Autostart        ║"
printf "║   %-56s║\n" "$(date '+%Y-%m-%d %H:%M:%S')  Log: $(basename "$LOG_FILE")"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Deploy path : $DEPLOY_PATH"

# =============================================================================
# SECȚIUNEA 1 — VERIFICARE ȘI INSTALARE PM2
# =============================================================================
section "1. Verificare instalare PM2"

# 1a. Identifică binarele Node/npm (suport NVM + system-wide)
_find_node_bin() {
  # Ordinea de prioritate: nvm user > /usr/local/bin > /usr/bin
  for candidate in \
    "$(command -v node 2>/dev/null || true)" \
    /usr/local/bin/node \
    /usr/bin/node \
    /root/.nvm/versions/node/*/bin/node \
    /home/*/.nvm/versions/node/*/bin/node; do
    if [ -x "$candidate" ] 2>/dev/null; then
      echo "$candidate"
      return
    fi
  done
  echo ""
}

NODE_BIN="$(_find_node_bin)"
if [ -z "$NODE_BIN" ]; then
  warn "Node.js nu este instalat. Se instalează Node 20 via NodeSource..."
  apt-get update -qq
  apt-get install -y curl ca-certificates gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  chmod a+r /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y nodejs
  NODE_BIN="$(command -v node)"
  fixed "Node.js $(node --version) instalat"
else
  ok "Node.js: $($NODE_BIN --version) ($NODE_BIN)"
fi

NODE_DIR="$(dirname "$NODE_BIN")"
NPM_BIN="${NODE_DIR}/npm"
export PATH="${NODE_DIR}:${PATH}"

# 1b. Verifică integritatea PM2 (testează dacă poate fi invocat)
PM2_BIN="$(command -v pm2 2>/dev/null || echo '')"
PM2_OK=false
if [ -n "$PM2_BIN" ]; then
  if "$PM2_BIN" --version >/dev/null 2>&1; then
    ok "PM2 instalat și funcțional: $("$PM2_BIN" --version) ($PM2_BIN)"
    PM2_OK=true
  else
    warn "PM2 binar găsit ($PM2_BIN) dar nu rulează corect — se reinstalează..."
  fi
else
  warn "PM2 nu este instalat."
fi

if [ "$PM2_OK" = false ]; then
  info "Instalare PM2 global via npm..."
  "$NPM_BIN" install -g pm2 2>&1 | tail -5
  PM2_BIN="$(command -v pm2 2>/dev/null || "${NODE_DIR}/pm2")"
  if "$PM2_BIN" --version >/dev/null 2>&1; then
    fixed "PM2 $("$PM2_BIN" --version) instalat cu succes"
  else
    ko "PM2 instalare eșuată. Verificați Node.js și npm."
    exit 1
  fi
fi

# =============================================================================
# SECȚIUNEA 2 — IDENTIFICĂ USER-UL CORECT PENTRU PM2
# =============================================================================
section "2. Identificare user PM2"

# Determină user-ul corect: preferă SUDO_USER, altfel root
if [ -n "${SUDO_USER:-}" ] && id "$SUDO_USER" &>/dev/null; then
  RUN_USER="$SUDO_USER"
  RUN_HOME="$(eval echo ~$SUDO_USER)"
else
  RUN_USER="root"
  RUN_HOME="/root"
fi

ok "User PM2: $RUN_USER (home: $RUN_HOME)"

# PM2_HOME pentru user-ul ales
PM2_HOME="${RUN_HOME}/.pm2"
export PM2_HOME

# Verifică dacă PM2 rulează deja sub alt user — detectează inconsistențe
CURRENT_PM2_USER=""
if pgrep -u root -x pm2 >/dev/null 2>/dev/null; then
  CURRENT_PM2_USER="root"
elif pgrep -x pm2 >/dev/null 2>/dev/null; then
  CURRENT_PM2_USER="$(ps -eo user,comm | grep ' pm2$' | awk '{print $1}' | head -1 || echo 'unknown')"
fi

if [ -n "$CURRENT_PM2_USER" ] && [ "$CURRENT_PM2_USER" != "$RUN_USER" ]; then
  warn "PM2 rulează sub user '$CURRENT_PM2_USER' dar deploy path aparține '$RUN_USER'."
  warn "Se opresc procesele PM2 existente și se repornesc sub '$RUN_USER'..."
  "$PM2_BIN" kill 2>/dev/null || true
  sleep 2
  fixed "PM2 oprit — se repornește sub user corect ($RUN_USER)"
elif [ -n "$CURRENT_PM2_USER" ]; then
  ok "PM2 rulează deja sub user corect: $CURRENT_PM2_USER"
fi

# =============================================================================
# SECȚIUNEA 3 — RECONFIGURARE PM2 STARTUP SYSTEMD
# =============================================================================
section "3. Reconfigurare PM2 startup (systemd)"

# 3a. Generează comanda startup și execut-o
info "Generare comandă pm2 startup systemd -u $RUN_USER..."
STARTUP_CMD=$("$PM2_BIN" startup systemd -u "$RUN_USER" --hp "$RUN_HOME" 2>/dev/null \
  | grep -E "^sudo |^env " | head -1 || true)

if [ -n "$STARTUP_CMD" ]; then
  info "Execut: $STARTUP_CMD"
  eval "$STARTUP_CMD"
  fixed "pm2 startup systemd configurat pentru user $RUN_USER"
else
  # Fallback: scrie fișierul de service direct
  warn "pm2 startup nu a generat o comandă. Se scrie manual fișierul de service..."
  cat > "/etc/systemd/system/pm2-${RUN_USER}.service" <<EOF
[Unit]
Description=PM2 process manager for user ${RUN_USER}
Documentation=https://pm2.keymetrics.io/
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
User=${RUN_USER}
LimitNOFILE=infinity
LimitCORE=infinity
Environment=PATH=${NODE_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PM2_HOME=${PM2_HOME}
PIDFile=${PM2_HOME}/pm2.pid
Restart=on-failure
RestartSec=5s
ExecStart=${PM2_BIN} resurrect
ExecReload=${PM2_BIN} reload all
ExecStop=${PM2_BIN} kill

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  fixed "Fișier /etc/systemd/system/pm2-${RUN_USER}.service creat manual"
fi

# 3b. Activează serviciul
systemctl daemon-reload
systemctl enable "pm2-${RUN_USER}.service" 2>/dev/null || true

# 3c. Verifică că serviciul există și este enabled
if systemctl is-enabled "pm2-${RUN_USER}.service" 2>/dev/null | grep -q "enabled"; then
  ok "Serviciul pm2-${RUN_USER}.service este enabled ✓"
else
  ko "Serviciul pm2-${RUN_USER}.service NU este enabled — verificați manual"
fi

# =============================================================================
# SECȚIUNEA 4 — PORNIRE PROCESE DIN ECOSYSTEM.CONFIG.JS
# =============================================================================
section "4. Regenerare și pornire procese PM2"

# 4a. Verifică că directorul deploy există
if [ ! -d "$DEPLOY_PATH" ]; then
  ko "Director deploy $DEPLOY_PATH nu există!"
  exit 1
fi
ok "Director deploy: $DEPLOY_PATH"

cd "$DEPLOY_PATH"

# 4b. Asigură că directorul de log-uri există
mkdir -p logs

# 4c. Verifică că ecosystem.config.js există
if [ ! -f "ecosystem.config.js" ]; then
  ko "ecosystem.config.js lipsește din $DEPLOY_PATH"
  exit 1
fi
ok "ecosystem.config.js găsit"

# 4d. Pornire procese — folosește startOrRestart pentru a nu pierde procesele deja running
info "Pornire/restart toate procesele din ecosystem.config.js..."
"$PM2_BIN" startOrRestart ecosystem.config.js 2>&1 | tail -20 || {
  warn "startOrRestart a eșuat. Se încearcă pm2 start din nou..."
  "$PM2_BIN" delete all 2>/dev/null || true
  "$PM2_BIN" start ecosystem.config.js 2>&1 | tail -20
}
fixed "PM2: toate procesele din ecosystem.config.js pornite/restarted"

# 4e. Afișează lista de procese
info "Lista procese PM2 după start:"
"$PM2_BIN" list 2>/dev/null || true

# =============================================================================
# SECȚIUNEA 5 — SALVARE CONFIGURAȚIE (pm2 save)
# =============================================================================
section "5. Salvare configurație PM2"

"$PM2_BIN" save --force 2>&1
ok "pm2 save executat — configurația proceselor salvată în ${PM2_HOME}/dump.pm2"

# Verifică că dump.pm2 există
if [ -f "${PM2_HOME}/dump.pm2" ]; then
  ok "dump.pm2 există: ${PM2_HOME}/dump.pm2"
else
  warn "dump.pm2 NU a fost creat la ${PM2_HOME}/dump.pm2 — startup la boot poate fi afectat"
fi

# =============================================================================
# SECȚIUNEA 6 — ACTIVARE ȘI VERIFICARE SERVICIU SYSTEMD
# =============================================================================
section "6. Activare autostart complet (systemd)"

systemctl daemon-reload

# 6a. Activează pm2-USER service
systemctl enable "pm2-${RUN_USER}.service" 2>/dev/null || true

# 6b. Verifică statusul serviciului
PM2_SVC_STATUS=$(systemctl is-active "pm2-${RUN_USER}.service" 2>/dev/null || echo "inactive")
if [ "$PM2_SVC_STATUS" = "active" ]; then
  ok "pm2-${RUN_USER}.service este ACTIV ✓"
else
  info "pm2-${RUN_USER}.service este $PM2_SVC_STATUS (normal dacă PM2 rulează direct — se activează pentru boot)"
  # Încearcă să pornească serviciul (nu e critic dacă deja rulează ca demon)
  systemctl start "pm2-${RUN_USER}.service" 2>/dev/null || true
fi

# 6c. Instalează unicorn.service ca fallback secondary (direct Node.js)
cat > /etc/systemd/system/unicorn.service <<EOF
[Unit]
Description=Unicorn Platform — fallback direct start (dacă PM2 eșuează)
After=network.target pm2-${RUN_USER}.service
Wants=pm2-${RUN_USER}.service

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${DEPLOY_PATH}
EnvironmentFile=-${DEPLOY_PATH}/.env
Environment=NODE_ENV=production
Environment=PORT=${NODE_PORT}
ExecStart=${NODE_BIN} backend/index.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:${DEPLOY_PATH}/logs/backend-systemd.log
StandardError=append:${DEPLOY_PATH}/logs/backend-systemd-error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable unicorn.service 2>/dev/null || true
ok "unicorn.service (fallback) enabled"

# 6d. Raport servicii systemd PM2
info "Status servicii PM2 systemd:"
for svc in "pm2-${RUN_USER}.service" "unicorn.service"; do
  STATUS=$(systemctl is-enabled "$svc" 2>/dev/null || echo "not-found")
  ACTIVE=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
  echo "  $svc → enabled=$STATUS active=$ACTIVE"
done

# =============================================================================
# SECȚIUNEA 7 — VERIFICARE PROCESE CRITICE
# =============================================================================
section "7. Verificare procese critice"

# Procesele obligatorii
CRITICAL_PROCS=(
  "unicorn"
  "unicorn-orchestrator"
  "unicorn-shield"
  "unicorn-health-daemon"
  "unicorn-health-guardian"
  "unicorn-system-shield"
)

ONLINE_COUNT=0
OFFLINE_PROCS=()

for proc in "${CRITICAL_PROCS[@]}"; do
  STATUS=$("$PM2_BIN" describe "$proc" 2>/dev/null | grep "status" | awk '{print $4}' | head -1 || echo "not found")
  if [ "$STATUS" = "online" ]; then
    ok "Process $proc → ONLINE ✓"
    ONLINE_COUNT=$((ONLINE_COUNT+1))
  else
    warn "Process $proc → $STATUS"
    # Încearcă să-l pornești dacă există în ecosystem
    "$PM2_BIN" start ecosystem.config.js --only "$proc" 2>/dev/null && \
      fixed "Process $proc pornit" || \
      ko "Process $proc NU a putut fi pornit"
    OFFLINE_PROCS+=("$proc")
  fi
done

# 7b. Salvare din nou după eventualele remedieri
"$PM2_BIN" save --force 2>/dev/null || true

# =============================================================================
# SECȚIUNEA 8 — TEST FUNCȚIONALITATE
# =============================================================================
section "8. Test funcționalitate"

# 8a. Verifică că portul 3000 ascultă
sleep 5
PORT_OK=false
if ss -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
  PORT_OK=true
elif netstat -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
  PORT_OK=true
fi

if [ "$PORT_OK" = true ]; then
  ok "Portul ${NODE_PORT} ascultat de backend ✓"
else
  warn "Portul ${NODE_PORT} NU ascultă — backend-ul poate mai pornește. Aștept 15s..."
  sleep 15
  if ss -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]" || \
     netstat -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
    ok "Portul ${NODE_PORT} ascultat după așteptare ✓"
    PORT_OK=true
  else
    ko "Portul ${NODE_PORT} NU ascultă — verificați: pm2 logs unicorn"
    pm2 logs unicorn-backend unicorn-site autoscaler --lines 20 --nostream 2>/dev/null || true
  fi
fi

# 8b. Test health endpoint
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "http://127.0.0.1:${NODE_PORT}/health" 2>/dev/null || echo "000")
API_HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "http://127.0.0.1:${NODE_PORT}/api/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CODE" = "200" ]; then
  ok "GET /health → HTTP 200 ✓"
elif [ "$API_HEALTH_CODE" = "200" ]; then
  ok "GET /api/health → HTTP 200 ✓"
else
  warn "Health endpoints nu răspund (HTTP: /health=$HEALTH_CODE, /api/health=$API_HEALTH_CODE)"
  warn "Serverul poate mai pornește — verificați: curl http://localhost:${NODE_PORT}/health"
fi

# 8c. Simulare restart — verifică că dump.pm2 este prezent pentru resurrect
if [ -f "${PM2_HOME}/dump.pm2" ]; then
  ok "dump.pm2 prezent → PM2 va recupera procesele la restart ✓"
  PROC_COUNT=$(python3 -c "import json,sys; d=json.load(open('${PM2_HOME}/dump.pm2')); print(len(d))" 2>/dev/null || \
               node -e "try{const d=require('${PM2_HOME}/dump.pm2');console.log(Array.isArray(d)?d.length:Object.keys(d).length)}catch(e){console.log('?')}" 2>/dev/null || echo "?")
  info "Procese salvate în dump.pm2: $PROC_COUNT"
else
  ko "dump.pm2 LIPSĂ din ${PM2_HOME} — procesele NU vor fi recuperate la restart!"
  warn "Rulați: pm2 save"
fi

# =============================================================================
# RAPORT FINAL
# =============================================================================
section "✅ Raport final PM2"

echo ""
echo -e "${BOLD}Status procese PM2:${NC}"
"$PM2_BIN" list 2>/dev/null | head -30 || true

echo ""
echo -e "${BOLD}Status servicii systemd:${NC}"
systemctl list-units --type=service --state=active 2>/dev/null | grep -E "pm2|unicorn" | head -10 || \
  echo "  (nicio unitate PM2/unicorn activă în systemd)"

echo ""
echo -e "${BOLD}Verificare finală autostart:${NC}"
for svc in "pm2-${RUN_USER}.service" "unicorn.service"; do
  ENB=$(systemctl is-enabled "$svc" 2>/dev/null || echo "not-found")
  if echo "$ENB" | grep -q "enabled"; then
    echo -e "  ${GREEN}✅ $svc → $ENB${NC}"
  else
    echo -e "  ${YELLOW}⚠️  $svc → $ENB${NC}"
  fi
done

echo ""
echo -e "${BOLD}Sumar:${NC}"
echo -e "  ${GREEN}Trecut:   $PASS${NC}"
echo -e "  ${CYAN}Reparat:  $FIXED${NC}"
echo -e "  ${RED}Eșuat:    $FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✅ PM2 complet funcțional! Unicorn va porni automat la orice restart.${NC}"
else
  echo -e "${YELLOW}${BOLD}⚠️  $FAIL probleme necesită intervenție manuală.${NC}"
  echo -e "   Log complet: ${LOG_FILE}"
  echo ""
  echo "  Diagnosticare:"
  echo "    pm2 list"
  echo "    pm2 logs unicorn-backend unicorn-site autoscaler --lines 50"
  echo "    journalctl -u pm2-${RUN_USER}.service -n 50"
  echo "    systemctl status pm2-${RUN_USER}.service"
fi

echo ""
echo -e "${BLUE}Comenzi utile:${NC}"
echo "  pm2 list                              # lista procese"
echo "  pm2 logs                              # logs live"
echo "  pm2 monit                             # monitorizare resurse"
echo "  systemctl status pm2-${RUN_USER}.service  # status systemd PM2"
echo "  systemctl status unicorn.service          # status fallback"
echo "  pm2 resurrect                         # recuperare procese după crash"
echo ""
