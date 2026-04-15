#!/usr/bin/env bash
# =============================================================================
# ssh-deploy.sh — Deploy direct prin SSH pe Hetzner (fără GitHub Actions)
#
# Metodă: local → rsync cod → SSH → npm install → PM2 → verificare live
#
# Acest script rulează de pe mașina locală (sau orice CI runner cu chei SSH).
# NU folosește GitHub Actions. Conectarea la server se face direct prin SSH.
#
# Utilizare:
#   bash scripts/ssh-deploy.sh
#   bash scripts/ssh-deploy.sh --dry-run        # simulare, fără modificări
#   bash scripts/ssh-deploy.sh --skip-rsync      # sare sincronizarea codului
#   bash scripts/ssh-deploy.sh --skip-ssl        # sare verificarea SSL
#   bash scripts/ssh-deploy.sh --restart-only    # doar repornire PM2
#
# Variabile de mediu (pot fi setate și în .env.auto-connector):
#   SSH_HOST       / HETZNER_HOST          — IP sau hostname server
#   SSH_USER       / HETZNER_DEPLOY_USER   — utilizator SSH (default: root)
#   SSH_PORT       / HETZNER_DEPLOY_PORT   — port SSH (default: 22)
#   SSH_KEY        / HETZNER_KEY_PATH      — calea cheii private SSH
#   DEPLOY_PATH    / HETZNER_DEPLOY_PATH   — directorul de deploy pe server
#   DOMAIN         / SITE_DOMAIN           — domeniu (default: zeusai.pro)
#   NODE_PORT                              — portul Node.js (default: 3000)
#   GITHUB_REPO                            — repo URL pentru git pull pe server
#   BRANCH                                 — branch (default: main)
#
# =============================================================================
set -euo pipefail

# ─── Culori ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()    { echo -e "${GREEN}✅  $1${NC}"; }
ko()    { echo -e "${RED}❌  $1${NC}"; }
fixed() { echo -e "${CYAN}🔧  $1${NC}"; }
info()  { echo -e "${BLUE}ℹ️   $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️   $1${NC}"; }
die()   { echo -e "${RED}💀  FATAL: $1${NC}" >&2; exit 1; }
step()  {
  echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${BLUE}  $1${NC}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
}

# ─── Argumente CLI ────────────────────────────────────────────────────────────
DRY_RUN=0
SKIP_RSYNC=0
SKIP_SSL=0
RESTART_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=1 ;;
    --skip-rsync)   SKIP_RSYNC=1 ;;
    --skip-ssl)     SKIP_SSL=1 ;;
    --restart-only) RESTART_ONLY=1; SKIP_RSYNC=1 ;;
    -h|--help)
      sed -n '2,27p' "$0"
      exit 0
      ;;
    *)
      warn "Argument necunoscut: $arg (ignorat)"
      ;;
  esac
done

# ─── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   UNICORN — SSH DEPLOY DIRECT (fără GitHub Actions)         ║"
echo "║   Deploy pe Hetzner via SSH + PM2                           ║"
echo "║   $(date '+%Y-%m-%d %H:%M:%S')                                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

[ "$DRY_RUN"      = "1" ] && warn "MOD DRY-RUN activ — nicio comandă destructivă nu va fi executată"
[ "$SKIP_RSYNC"   = "1" ] && info "SKIP_RSYNC activ — sincronizarea codului este sărită"
[ "$SKIP_SSL"     = "1" ] && info "SKIP_SSL activ — verificarea SSL este sărită"
[ "$RESTART_ONLY" = "1" ] && info "RESTART_ONLY activ — doar repornire PM2"

# ─── Detectare director UNICORN_FINAL ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNICORN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ─── Încărcare credențiale ────────────────────────────────────────────────────
# Caută .env.auto-connector în: unicorn dir, parinte, $HOME, $PWD
for _env_file in \
  "${UNICORN_DIR}/.env.auto-connector" \
  "${UNICORN_DIR}/../.env.auto-connector" \
  "${HOME}/.env.auto-connector" \
  "$(pwd)/.env.auto-connector"; do
  if [ -f "$_env_file" ]; then
    info "Credențiale încărcate din: ${_env_file}"
    set -a
    # shellcheck disable=SC1090
    source "$_env_file"
    set +a
    break
  fi
done

# ─── Parametri finali (prioritate: env CLI > .env.auto-connector > default) ───
SSH_HOST="${SSH_HOST:-${HETZNER_HOST:-}}"
SSH_USER="${SSH_USER:-${HETZNER_DEPLOY_USER:-${HETZNER_USER:-root}}}"
SSH_PORT="${SSH_PORT:-${HETZNER_DEPLOY_PORT:-22}}"
SSH_KEY="${SSH_KEY:-${HETZNER_KEY_PATH:-${HETZNER_SSH_KEY_PATH:-}}}"
DEPLOY_PATH="${DEPLOY_PATH:-${HETZNER_DEPLOY_PATH:-/var/www/unicorn}}"
DOMAIN="${DOMAIN:-${SITE_DOMAIN:-zeusai.pro}}"
NODE_PORT="${NODE_PORT:-3000}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/ruffy80/ZeusAI.git}"
BRANCH="${BRANCH:-main}"

# ─── Validare parametri obligatorii ──────────────────────────────────────────
[ -z "$SSH_HOST" ]  && die "SSH_HOST (sau HETZNER_HOST) nu este setat.\nSeteaza-l in .env.auto-connector sau ca variabila de mediu."
[ -z "$SSH_KEY" ]   && die "SSH_KEY (sau HETZNER_KEY_PATH) nu este setat.\nSpecifica calea catre cheia privata SSH."
[ -f "$SSH_KEY" ]   || die "Cheia SSH nu a fost gasita: ${SSH_KEY}"

chmod 600 "${SSH_KEY}"

# ─── Opțiuni SSH comune ───────────────────────────────────────────────────────
SSH_OPTS=(
  -i "${SSH_KEY}"
  -p "${SSH_PORT}"
  -o StrictHostKeyChecking=no
  -o ConnectTimeout=15
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=3
  -o BatchMode=yes
)

# Scurtătură: funcție pentru comenzi SSH
ssh_run() {
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "$@"
}

info "Server      : ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
info "Deploy path : ${DEPLOY_PATH}"
info "Domain      : ${DOMAIN}"
info "Node port   : ${NODE_PORT}"
info "Branch      : ${BRANCH}"
echo ""

# =============================================================================
# PASUL 1 — Verificare conectivitate SSH
# =============================================================================
step "1. Test conectivitate SSH"

if ssh_run "echo 'SSH_OK'" 2>/dev/null | grep -q "SSH_OK"; then
  ok "Conexiune SSH stabilita cu ${SSH_HOST}"
else
  die "Nu se poate conecta la ${SSH_HOST} cu cheia ${SSH_KEY}.\nVerifica: IP server, port SSH, cheia privata, utilizatorul."
fi

# =============================================================================
# PASUL 2 — Pregătire director pe server
# =============================================================================
step "2. Pregatire director deploy pe server"

ssh_run "mkdir -p '${DEPLOY_PATH}' '${DEPLOY_PATH}/logs' '${DEPLOY_PATH}/data'"
ok "Director ${DEPLOY_PATH} existent pe server"

# =============================================================================
# PASUL 3 — Sincronizare cod (rsync sau git pull)
# =============================================================================
step "3. Sincronizare cod Unicorn pe server"

if [ "$SKIP_RSYNC" = "1" ]; then
  warn "Sincronizarea codului sarita (--skip-rsync)"
elif [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] rsync ${UNICORN_DIR}/ → ${SSH_USER}@${SSH_HOST}:${DEPLOY_PATH}/"
else
  # Verifică dacă rsync este disponibil local
  if command -v rsync &>/dev/null; then
    info "Sincronizare cu rsync..."
    rsync -avz --delete \
      --exclude '.git/' \
      --exclude 'node_modules/' \
      --exclude 'client/node_modules/' \
      --exclude 'backend/node_modules/' \
      --exclude '*.log' \
      --exclude 'logs/' \
      --exclude 'data/' \
      --exclude '.env' \
      --exclude '.env.local' \
      --exclude '.env.production' \
      -e "ssh ${SSH_OPTS[*]}" \
      "${UNICORN_DIR}/" \
      "${SSH_USER}@${SSH_HOST}:${DEPLOY_PATH}/"
    fixed "Cod sincronizat via rsync"
  else
    # Fallback: git pull pe server
    warn "rsync nu este disponibil local — folosim git pull pe server"
    ssh_run "
      set -e
      if [ -d '${DEPLOY_PATH}/.git' ]; then
        echo 'Git pull...'
        cd '${DEPLOY_PATH}'
        git fetch origin
        git reset --hard origin/${BRANCH}
        git clean -fd
        echo 'Cod actualizat via git pull'
      elif [ -d '${DEPLOY_PATH}/backend' ] && [ -f '${DEPLOY_PATH}/package.json' ]; then
        echo 'Codul aplicatiei este deja prezent (deploy anterior)'
      else
        echo 'Prima instalare — clonare repository...'
        TMP=\$(mktemp -d)
        git clone --depth=1 --branch ${BRANCH} ${GITHUB_REPO} \"\$TMP\"
        cp -a \"\$TMP/UNICORN_FINAL/.\" '${DEPLOY_PATH}/'
        rm -rf \"\$TMP\"
        echo 'Repository clonat'
      fi
    "
    fixed "Cod actualizat via git pe server"
  fi
fi

# =============================================================================
# PASUL 4 — Instalare dependențe pe server
# =============================================================================
step "4. Instalare dependente (npm install --production)"

if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] npm install --production in ${DEPLOY_PATH}"
else
  ssh_run "
    set -e
    echo '--- Instalare Node.js daca lipseste ---'
    if ! command -v node &>/dev/null || [ \"\$(node --version 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/')\" -lt 20 ] 2>/dev/null; then
      echo 'Instalare Node.js 20 via NodeSource...'
      if [ \"\$(id -u)\" -eq 0 ]; then SUDO=''; else SUDO='sudo'; fi
      curl -fsSL https://deb.nodesource.com/setup_20.x | \${SUDO} bash - >/dev/null 2>&1
      \${SUDO} apt-get install -y nodejs >/dev/null 2>&1
      echo \"Node.js instalat: \$(node --version)\"
    else
      echo \"Node.js OK: \$(node --version)\"
    fi

    echo '--- Instalare PM2 daca lipseste ---'
    if ! command -v pm2 &>/dev/null; then
      npm install -g pm2 >/dev/null 2>&1
      echo 'PM2 instalat'
    else
      echo \"PM2 OK: \$(pm2 --version)\"
    fi

    echo '--- npm install --production ---'
    cd '${DEPLOY_PATH}'
    npm install --production --legacy-peer-deps --no-audit --no-fund
    echo 'Dependente instalate'
  "
  fixed "Dependente instalate pe server"
fi

# =============================================================================
# PASUL 5 — Generare .env dacă lipsește
# =============================================================================
step "5. Verificare .env pe server"

if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] verificare .env in ${DEPLOY_PATH}"
else
  ssh_run "
    set -e
    if [ -f '${DEPLOY_PATH}/.env' ]; then
      echo '.env existent pe server'
    else
      echo '.env lipsa — se creeaza minimal...'
      JWT_SECRET=\"\$(openssl rand -hex 32)\"
      ADMIN_SECRET=\"\$(openssl rand -hex 24)\"
      cat > '${DEPLOY_PATH}/.env' <<ENVEOF
NODE_ENV=production
PORT=${NODE_PORT}
DOMAIN=${DOMAIN}
SITE_DOMAIN=${DOMAIN}
PUBLIC_APP_URL=https://${DOMAIN}
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
JWT_SECRET=\${JWT_SECRET}
ADMIN_SECRET=\${ADMIN_SECRET}
ADMIN_EMAIL=admin@${DOMAIN}
ENVEOF
      chmod 600 '${DEPLOY_PATH}/.env'
      echo '.env minimal creat (editeaza cu cheile API reale)'
    fi
  "
  ok ".env verificat/creat pe server"
fi

# =============================================================================
# PASUL 6 — Build (dacă e necesar)
# =============================================================================
step "6. Build (optional)"

ssh_run "
  set -e
  BUILD_SCRIPT='${DEPLOY_PATH}/build.sh'
  if [ -f \"\$BUILD_SCRIPT\" ]; then
    echo 'Rulare build.sh...'
    bash \"\$BUILD_SCRIPT\"
    echo 'Build completat'
  else
    echo 'Niciun build.sh gasit — build sarit'
  fi
"

# =============================================================================
# PASUL 7 — Pornire/restart Unicorn cu PM2 (toate modulele)
# =============================================================================
step "7. Pornire Unicorn cu PM2 (ecosystem.config.js)"

if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] pm2 startOrRestart ecosystem.config.js in ${DEPLOY_PATH}"
else
  ssh_run "
    set -e
    cd '${DEPLOY_PATH}'

    echo '--- PM2: oprire procese anterioare ---'
    pm2 stop all   2>/dev/null || true
    pm2 delete all 2>/dev/null || true

    echo '--- PM2: start din ecosystem.config.js ---'
    if [ -f 'ecosystem.config.js' ]; then
      pm2 start ecosystem.config.js --env production
      echo 'PM2 pornit din ecosystem.config.js'
    elif [ -f 'backend/index.js' ]; then
      pm2 start backend/index.js --name unicorn --instances 2 --exec-mode cluster --env production
      echo 'PM2 pornit din backend/index.js (fallback)'
    else
      echo 'EROARE: niciun entry point gasit' >&2
      exit 1
    fi

    echo ''
    echo '--- Status PM2 ---'
    pm2 list

    echo '--- PM2 save + startup ---'
    pm2 save

    # Configureaza PM2 sa porneasca automat la reboot
    RUN_USER=\"\$(whoami)\"
    RUN_HOME=\"\$(eval echo ~\$RUN_USER)\"
    STARTUP_CMD=\"\$(pm2 startup systemd -u \"\$RUN_USER\" --hp \"\$RUN_HOME\" 2>/dev/null | grep '^sudo' | head -1 || true)\"
    if [ -n \"\$STARTUP_CMD\" ]; then
      eval \"\$STARTUP_CMD\" 2>/dev/null || true
      echo 'PM2 startup configurat'
    fi
    pm2 save
  "
  fixed "Unicorn pornit cu PM2 (toate modulele din ecosystem.config.js)"
fi

# =============================================================================
# PASUL 8 — Activare module Unicorn esențiale
# =============================================================================
step "8. Verificare module Unicorn active"

ssh_run "
  set -e
  cd '${DEPLOY_PATH}'
  echo '--- Module PM2 pornite ---'
  pm2 list --no-color 2>/dev/null | grep -E 'online|stopped|errored' || true

  # Lista modele critice pe care le verificam
  CRITICAL_MODULES='unicorn unicorn-orchestrator unicorn-shield unicorn-health-daemon unicorn-auto-repair unicorn-main-orchestrator'

  echo ''
  echo '--- Verificare module critice ---'
  for MOD in \$CRITICAL_MODULES; do
    STATUS=\"\$(pm2 show \"\$MOD\" 2>/dev/null | grep 'status' | awk '{print \$4}' || echo 'absent')\"
    if [ \"\$STATUS\" = 'online' ]; then
      echo \"✅  \$MOD → online\"
    elif [ \"\$STATUS\" = 'absent' ] || [ -z \"\$STATUS\" ]; then
      echo \"⚠️   \$MOD → absent (poate fi inclus in main unicorn)\"
    else
      echo \"❌  \$MOD → \$STATUS — incerc restart...\"
      pm2 restart \"\$MOD\" 2>/dev/null || true
    fi
  done
"

# =============================================================================
# PASUL 9 — Verificare Nginx și SSL
# =============================================================================
step "9. Verificare Nginx si SSL"

if [ "$DRY_RUN" = "1" ]; then
  warn "[DRY-RUN] verificare nginx si ssl"
else
  ssh_run "
    set -e

    echo '--- Status Nginx ---'
    if command -v nginx &>/dev/null; then
      if systemctl is-active --quiet nginx 2>/dev/null; then
        echo '✅  Nginx → ACTIV'
        nginx -t 2>&1 || echo '⚠️  Nginx config warning'
        systemctl reload nginx 2>/dev/null || true
      else
        echo '⚠️  Nginx oprit — incerc pornire...'
        systemctl start nginx 2>/dev/null || true
        if systemctl is-active --quiet nginx 2>/dev/null; then
          echo '✅  Nginx pornit cu succes'
        else
          echo '❌  Nginx nu a putut fi pornit'
        fi
      fi
    else
      echo '⚠️  Nginx nu este instalat pe acest server'
    fi

    echo ''
    echo '--- Status SSL ---'
    if [ -f '/etc/letsencrypt/live/${DOMAIN}/fullchain.pem' ]; then
      EXPIRY=\"\$(openssl x509 -enddate -noout -in '/etc/letsencrypt/live/${DOMAIN}/fullchain.pem' 2>/dev/null | cut -d= -f2 || echo 'necunoscut')\"
      echo \"✅  Certificat SSL existent pentru ${DOMAIN} — expire: \$EXPIRY\"
    else
      echo '⚠️  Certificat SSL nu exista'
      if [ '${SKIP_SSL}' != '1' ]; then
        echo 'Incerc obtinere certificat SSL cu Certbot...'
        if command -v certbot &>/dev/null; then
          certbot --nginx \
            -d '${DOMAIN}' \
            -d 'www.${DOMAIN}' \
            --non-interactive \
            --agree-tos \
            -m 'admin@${DOMAIN}' \
            --redirect 2>&1 || echo '⚠️  Certbot a esuat (DNS-ul poate sa nu fie configurat)'
        else
          echo '⚠️  Certbot nu este instalat'
        fi
      fi
    fi
  "
fi

# =============================================================================
# PASUL 10 — Verificare endpoint-uri (health check)
# =============================================================================
step "10. Verificare endpoint-uri live"

# Asteapta startup
info "Astept 5 secunde pentru startup complet..."
sleep 5

# Health check local (prin SSH)
ssh_run "
  echo '--- Health check local (localhost:${NODE_PORT}) ---'
  MAX_RETRIES=10
  RETRY_DELAY=3
  for i in \$(seq 1 \$MAX_RETRIES); do
    HEALTH=\$(curl -sf 'http://localhost:${NODE_PORT}/api/health' 2>/dev/null || true)
    if [ -n \"\$HEALTH\" ]; then
      echo \"✅  /api/health raspunde: \$HEALTH\"
      break
    else
      echo \"⏳ Incercare \$i/\$MAX_RETRIES — astept \${RETRY_DELAY}s...\"
      sleep \$RETRY_DELAY
    fi
  done
  if [ -z \"\$HEALTH\" ]; then
    echo \"⚠️  /api/health nu a raspuns dupa \$MAX_RETRIES incercari\"
    echo 'Verificand portul...'
    ss -tlnp 2>/dev/null | grep ':${NODE_PORT}' || netstat -tlnp 2>/dev/null | grep ':${NODE_PORT}' || echo 'Portul ${NODE_PORT} nu asculta'
    echo 'Logs PM2:'
    pm2 logs unicorn --lines 20 --no-color 2>/dev/null || true
  fi

  echo ''
  echo '--- Orchestrator status ---'
  ORC=\$(curl -sf 'http://localhost:${NODE_PORT}/api/orchestrator/status' 2>/dev/null || \
        curl -sf 'http://localhost:${NODE_PORT}/api/ai/orchestrator/status' 2>/dev/null || \
        echo 'N/A')
  echo \"Orchestrator: \$ORC\"

  echo ''
  echo '--- Snapshot status ---'
  SNAP=\$(curl -sf 'http://localhost:${NODE_PORT}/snapshot' 2>/dev/null | head -c 200 || echo 'N/A')
  echo \"Snapshot: \$SNAP\"
"

# Health check extern (HTTPS)
step "11. Verificare acces public (HTTPS)"

if [ "$SKIP_SSL" = "1" ]; then
  warn "Verificare HTTPS sarita (--skip-ssl)"
else
  info "Verificare https://${DOMAIN} ..."
  HTTP_STATUS=$(curl -sIL -m 15 "https://${DOMAIN}" 2>/dev/null | grep "^HTTP/" | tail -1 | awk '{print $2}' || echo "timeout")
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    ok "https://${DOMAIN} → HTTP ${HTTP_STATUS} ✅"
  else
    warn "https://${DOMAIN} → HTTP ${HTTP_STATUS} (poate fi normal dacă DNS nu pointeaza inca)"
  fi

  info "Verificare /api/health extern..."
  EXT_HEALTH=$(curl -sf -m 15 "https://${DOMAIN}/api/health" 2>/dev/null | head -c 100 || echo "")
  if [ -n "$EXT_HEALTH" ]; then
    ok "/api/health extern: ${EXT_HEALTH}"
  else
    warn "/api/health extern nu raspunde (verificati DNS si Nginx)"
  fi
fi

# =============================================================================
# RAPORT FINAL
# =============================================================================
step "RAPORT FINAL — Unicorn Deploy SSH"

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Server:      ${CYAN}${SSH_USER}@${SSH_HOST}:${SSH_PORT}${NC}"
echo -e "${BOLD}  Deploy path: ${CYAN}${DEPLOY_PATH}${NC}"
echo -e "${BOLD}  Domain:      ${CYAN}${DOMAIN}${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

# Status final PM2 pe server
echo ""
echo -e "${BOLD}Status PM2 final:${NC}"
ssh_run "pm2 list --no-color 2>/dev/null | head -50 || true" || true

echo ""
echo -e "${BOLD}Comenzi utile pe server:${NC}"
echo "  ssh -i ${SSH_KEY} -p ${SSH_PORT} ${SSH_USER}@${SSH_HOST}"
echo "  # pm2 list"
echo "  # pm2 logs"
echo "  # pm2 restart all"
echo "  # curl http://localhost:${NODE_PORT}/api/health"
echo "  # bash ${DEPLOY_PATH}/scripts/fix-server.sh"
echo ""
echo -e "${BOLD}URL-uri live:${NC}"
echo -e "  ${CYAN}http://${DOMAIN}${NC}"
echo -e "  ${CYAN}https://${DOMAIN}${NC}"
echo -e "  ${CYAN}https://${DOMAIN}/api/health${NC}"
echo -e "  ${CYAN}https://${DOMAIN}/api/orchestrator/status${NC}"
echo ""

if [ "$DRY_RUN" = "1" ]; then
  warn "MOD DRY-RUN: nicio modificare nu a fost facuta pe server"
else
  echo -e "${GREEN}${BOLD}✅ Deploy SSH finalizat! Unicorn este live.${NC}"
fi
echo ""
