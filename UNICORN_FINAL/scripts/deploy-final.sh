#!/usr/bin/env bash
# ============================================================
# deploy-final.sh — UNICORN: INSTALARE COMPLETĂ + DEPLOY FINAL
# zeusai.pro – Hetzner – IP 204.168.230.142
#
# Acoperă toate etapele de la zero (sau actualizare):
#   1. Instalare pachete sistem (Nginx, Certbot, git, ufw)
#   2. SSL real (Certbot + Let's Encrypt)
#   3. Pornire + activare Nginx
#   4. Firewall UFW (22/80/443 deschise, 3000 blocat public)
#   5. Clonare / actualizare cod din GitHub
#   6. Backend Unicorn — npm install + PM2 (ecosystem.config.js)
#   7. Frontend Unicorn — npm install + npm run build (client/)
#   8. Configurare Nginx completă (proxy → Node 3000, SSE, WebSocket)
#   9. Persistență PM2 la reboot
#
# Utilizare (pe serverul Hetzner, ca root):
#   bash deploy-final.sh [DEPLOY_PATH] [DOMAIN] [ADMIN_EMAIL]
#
# Exemple:
#   bash deploy-final.sh
#   bash deploy-final.sh /var/www/unicorn zeusai.pro admin@zeusai.pro
#   SKIP_SSL=1 bash deploy-final.sh     # sare obținerea certificatului SSL
#   SKIP_GIT=1 bash deploy-final.sh     # sare pasul git (codul deja prezent)
#   SKIP_FRONTEND=1 bash deploy-final.sh  # sare build-ul frontend
#
# Variabile de mediu opționale:
#   DEPLOY_PATH   — directorul de deploy          (default: /var/www/unicorn)
#   GITHUB_REPO   — URL repo GitHub               (default: https://github.com/ruffy80/ZeusAI.git)
#   BRANCH        — branch GitHub                 (default: main)
#   DOMAIN        — domeniu principal             (default: zeusai.pro)
#   ADMIN_EMAIL   — email Certbot/Let's Encrypt   (default: admin@<DOMAIN>)
#   NODE_PORT     — portul Node.js                (default: 3000)
#   SKIP_SSL      — "1" pentru a sări SSL         (default: 0)
#   SKIP_GIT      — "1" pentru a sări git pull    (default: 0)
#   SKIP_FRONTEND — "1" pentru a sări frontend    (default: 0)
# ============================================================
set -euo pipefail

# ─── Parametri configurabili ─────────────────────────────────
DEPLOY_PATH="${1:-${DEPLOY_PATH:-/var/www/unicorn}}"
DOMAIN="${2:-${DOMAIN:-zeusai.pro}}"
ADMIN_EMAIL="${3:-${ADMIN_EMAIL:-admin@${DOMAIN}}}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/ruffy80/ZeusAI.git}"
BRANCH="${BRANCH:-main}"
NODE_PORT="${NODE_PORT:-3000}"
SKIP_SSL="${SKIP_SSL:-0}"
SKIP_GIT="${SKIP_GIT:-0}"
SKIP_FRONTEND="${SKIP_FRONTEND:-0}"

NGINX_AVAILABLE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"
LOG_DIR="${DEPLOY_PATH}/logs"
LOG_FILE="${LOG_DIR}/deploy-final-$(date +%Y%m%d-%H%M%S).log"

# ─── Culori terminal ─────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m';  CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

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

# ─── Verificare root ─────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  die "Scriptul trebuie rulat ca root: sudo bash deploy-final.sh"
fi

# ─── Banner ──────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   UNICORN – INSTALARE COMPLETĂ + DEPLOY FINAL           ║"
echo "║   zeusai.pro – Hetzner – IP 204.168.230.142             ║"
echo "║   $(date '+%Y-%m-%d %H:%M:%S')                                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Deploy path  : $DEPLOY_PATH"
info "GitHub repo  : $GITHUB_REPO (branch: $BRANCH)"
info "Domain       : $DOMAIN"
info "Admin email  : $ADMIN_EMAIL"
info "Node port    : $NODE_PORT"
info "Skip SSL     : $SKIP_SSL"
info "Skip git     : $SKIP_GIT"
info "Skip frontend: $SKIP_FRONTEND"

# ─── Logging ─────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
info "Log: $LOG_FILE"

# ============================================================
# 1. Structură + update + pachete
# ============================================================
step "1. Update sistem + instalare pachete"

apt-get update -qq
apt-get install -y --no-install-recommends \
  curl ca-certificates gnupg \
  nginx \
  certbot python3-certbot-nginx \
  ufw \
  git \
  build-essential
ok "Pachete sistem instalate"

# Node.js >= 20 via NodeSource
_node_major=0
if command -v node &>/dev/null; then
  _node_major=$(node --version 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)
fi
if [ "$_node_major" -ge 20 ] 2>/dev/null; then
  ok "Node.js $(node --version) deja instalat"
else
  info "Instalare Node.js 20 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  fixed "Node.js $(node --version) instalat"
fi

# PM2
if command -v pm2 &>/dev/null; then
  ok "PM2 $(pm2 --version) deja instalat"
else
  npm install -g pm2
  fixed "PM2 $(pm2 --version) instalat"
fi

# ============================================================
# 2. Firewall UFW
# ============================================================
step "2. Firewall UFW"

ufw allow 22/tcp   comment 'SSH'   2>/dev/null || true
ufw allow 80/tcp   comment 'HTTP'  2>/dev/null || true
ufw allow 443/tcp  comment 'HTTPS' 2>/dev/null || true
# Blochează portul Node.js — accesat doar prin Nginx
ufw delete allow "${NODE_PORT}/tcp" 2>/dev/null || true
ufw delete allow "${NODE_PORT}"     2>/dev/null || true

if ufw status 2>/dev/null | grep -q "inactive"; then
  echo "y" | ufw enable
  fixed "UFW activat"
else
  ufw reload 2>/dev/null || true
  ok "UFW deja activ — reguli actualizate"
fi
ok "Firewall: SSH/HTTP/HTTPS deschise, portul $NODE_PORT blocat public"

# ============================================================
# 3. Pornire + activare Nginx
# ============================================================
step "3. Nginx — configurare HTTP inițială"

systemctl enable nginx

cat > "$NGINX_AVAILABLE" <<NGINXEOF
# Configurare Nginx pentru Unicorn AI / ZeusAI
# Generat de deploy-final.sh pe $(date '+%Y-%m-%d %H:%M:%S')
# certbot --nginx va adăuga automat blocul HTTPS (port 443).

map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ""      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    # ACME challenge pentru Certbot Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Compresie gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 256;
    gzip_vary on;

    # SSE (Server-Sent Events) — dezactivare buffering + timeout extins
    location /stream {
        proxy_pass         http://127.0.0.1:${NODE_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Connection        '';
        proxy_buffering    off;
        proxy_cache        off;
        proxy_connect_timeout  60s;
        proxy_send_timeout     60s;
        proxy_read_timeout  3600s;
        chunked_transfer_encoding on;
    }

    # API + UI — proxy principal către Node.js
    location / {
        proxy_pass         http://127.0.0.1:${NODE_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        \$connection_upgrade;
        proxy_connect_timeout  60s;
        proxy_send_timeout     60s;
        proxy_read_timeout     60s;
    }
}
NGINXEOF

ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
rm -f /etc/nginx/sites-enabled/default

nginx -t
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
  ok "Nginx reloaded"
else
  systemctl start nginx
  fixed "Nginx pornit"
fi
ok "Nginx activ pe portul 80 pentru $DOMAIN"

# ============================================================
# 4. SSL real (Certbot + Nginx)
# ============================================================
step "4. SSL — Certbot Let's Encrypt"

if [ "$SKIP_SSL" = "1" ]; then
  warn "SKIP_SSL=1 — SSL sărit"
  info "Rulează manual după ce DNS-ul pointează la acest server:"
  info "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m ${ADMIN_EMAIL}"
else
  CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  if [ -f "$CERT_PATH" ]; then
    ok "Certificat SSL deja existent pentru $DOMAIN"
  else
    info "Asigură-te că DNS-ul domeniului pointează la IP-ul acestui server."
    if certbot --nginx \
        -d "${DOMAIN}" \
        -d "www.${DOMAIN}" \
        --non-interactive \
        --agree-tos \
        -m "${ADMIN_EMAIL}" \
        --redirect; then
      fixed "Certificat SSL obținut și HTTPS configurat"
    else
      warn "Certbot a eșuat — site-ul funcționează pe HTTP până la configurarea DNS."
      info "Reîncearcă: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -m ${ADMIN_EMAIL}"
    fi
  fi

  # Reînnoire automată: preferă certbot.timer (systemd), fallback la cron
  if systemctl list-unit-files certbot.timer &>/dev/null 2>&1 \
      && systemctl is-enabled certbot.timer 2>/dev/null | grep -q "enabled"; then
    ok "Reînnoire automată SSL activă (certbot.timer)"
  else
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
      (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --nginx") | crontab -
      fixed "Cron job pentru reînnoire automată SSL (zilnic, 03:00)"
    fi
  fi
fi

nginx -t && systemctl reload nginx
ok "Nginx reloaded cu configurația SSL"

# ============================================================
# 5. Deploy din GitHub
# ============================================================
step "5. Deploy cod din GitHub"

if [ "$SKIP_GIT" = "1" ]; then
  warn "SKIP_GIT=1 — actualizare din GitHub sărită"
elif [ -d "${DEPLOY_PATH}/.git" ]; then
  # Repo deja clonat — actualizare
  info "Actualizare cod din GitHub (branch: $BRANCH)..."
  cd "${DEPLOY_PATH}"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
  git clean -fd
  fixed "Cod actualizat din origin/${BRANCH}"
elif [ -d "${DEPLOY_PATH}/backend" ] && [ -f "${DEPLOY_PATH}/package.json" ]; then
  # Conținut UNICORN_FINAL deja sincronizat (via CI rsync), nu e un repo git — OK
  ok "Codul aplicației este prezent în $DEPLOY_PATH (deploy CI)"
else
  # Prima instalare — clonare repo și copiere UNICORN_FINAL
  info "Clonare repository din GitHub..."
  TMP_CLONE=$(mktemp -d)
  git clone --depth=1 --branch "${BRANCH}" "${GITHUB_REPO}" "${TMP_CLONE}"
  mkdir -p "${DEPLOY_PATH}"
  cp -a "${TMP_CLONE}/UNICORN_FINAL/." "${DEPLOY_PATH}/"
  rm -rf "${TMP_CLONE}"
  fixed "Repository clonat → $DEPLOY_PATH"
fi

# ============================================================
# 6. Backend Unicorn (PM2)
# ============================================================
step "6. Backend Unicorn — PM2"

if [ -d "${DEPLOY_PATH}" ]; then
  cd "${DEPLOY_PATH}"

  # Instalare dependențe
  if [ -f "package.json" ]; then
    npm install --legacy-peer-deps --no-audit --no-fund
    ok "Dependențe backend instalate"
  fi

  # Generare .env dacă lipsește
  if [ ! -f ".env" ]; then
    warn ".env lipsește — se creează cu setări minimale..."
    command -v openssl &>/dev/null || die "openssl nu este instalat — necesar pentru generarea secretelor"
    JWT_SECRET="$(openssl rand -hex 32)"
    ADMIN_SECRET="$(openssl rand -hex 24)"
    [ -z "$JWT_SECRET" ]   && die "JWT_SECRET generat este gol — verifică openssl"
    [ -z "$ADMIN_SECRET" ] && die "ADMIN_SECRET generat este gol — verifică openssl"
    _BTC_ADDR="${BTC_WALLET_ADDRESS:-bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e}"
    _OWNER_NAME="${OWNER_NAME:-Vladoi Ionut}"
    _OWNER_EMAIL="${OWNER_EMAIL:-vladoi_ionut@yahoo.com}"
    cat > ".env" <<ENVEOF
NODE_ENV=production
PORT=${NODE_PORT}
DOMAIN=${DOMAIN}
SITE_DOMAIN=${DOMAIN}
PUBLIC_APP_URL=https://${DOMAIN}
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
JWT_SECRET=${JWT_SECRET}
ADMIN_SECRET=${ADMIN_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
BTC_WALLET_ADDRESS=${_BTC_ADDR}
OWNER_NAME=${_OWNER_NAME}
OWNER_EMAIL=${_OWNER_EMAIL}
ENVEOF
    chmod 600 ".env"
    fixed ".env minimal creat (editează cu cheile API reale)"
  else
    ok ".env există"
  fi

  # Pornire PM2 (clean start — evită erori cu procese vechi crashate)
  pm2 stop all   2>/dev/null || true
  pm2 delete all 2>/dev/null || true

  if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
    fixed "PM2 pornit din ecosystem.config.js"
  elif [ -f "backend/index.js" ]; then
    pm2 start backend/index.js --name unicorn-backend --env production
    fixed "PM2 pornit din backend/index.js"
  else
    warn "Niciun entry point găsit (ecosystem.config.js sau backend/index.js)"
  fi

  pm2 save
  ok "PM2 save efectuat"
fi

# ============================================================
# 7. Frontend Unicorn (build)
# ============================================================
step "7. Frontend Unicorn — build"

# Directorul frontend este client/ (nu frontend/)
FRONTEND_DIR="${DEPLOY_PATH}/client"

if [ "$SKIP_FRONTEND" = "1" ]; then
  warn "SKIP_FRONTEND=1 — build frontend sărit"
elif [ -d "$FRONTEND_DIR" ]; then
  cd "$FRONTEND_DIR"
  npm install --legacy-peer-deps --no-audit --no-fund
  CI=false npm run build
  fixed "Frontend build finalizat: ${FRONTEND_DIR}/build"
  cd "${DEPLOY_PATH}"
else
  warn "Directorul client/ nu există în $DEPLOY_PATH — build frontend sărit"
fi

# ============================================================
# 8. Persistență PM2 la reboot
# ============================================================
step "8. Persistență PM2 la reboot"

RUN_USER="${SUDO_USER:-root}"
# Obține home directory fără eval (evită injecție prin SUDO_USER)
RUN_HOME="$(getent passwd "$RUN_USER" 2>/dev/null | cut -d: -f6)" \
  || RUN_HOME="$(cd ~"$RUN_USER" 2>/dev/null && pwd)" \
  || RUN_HOME="/root"

STARTUP_CMD=$(pm2 startup systemd -u "$RUN_USER" --hp "$RUN_HOME" 2>/dev/null \
  | grep -E "^sudo" | head -1 || true)

if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD"
  fixed "PM2 startup configurat"
else
  NODE_BIN="$(command -v node 2>/dev/null)" || { warn "node nu a fost găsit în PATH"; NODE_BIN="/usr/bin/node"; }
  PM2_BIN="$(command -v pm2 2>/dev/null)"   || { warn "pm2 nu a fost găsit în PATH";  PM2_BIN="/usr/local/bin/pm2"; }
  PM2_HOME="${RUN_HOME}/.pm2"
  cat > "/etc/systemd/system/pm2-${RUN_USER}.service" <<UNITEOF
[Unit]
Description=PM2 process manager for ${RUN_USER}
After=network.target

[Service]
Type=forking
User=${RUN_USER}
LimitNOFILE=infinity
Environment=PATH=${NODE_BIN%/node}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PM2_HOME=${PM2_HOME}
PIDFile=${PM2_HOME}/pm2.pid
Restart=on-failure
ExecStart=${PM2_BIN} resurrect
ExecReload=${PM2_BIN} reload all
ExecStop=${PM2_BIN} kill

[Install]
WantedBy=multi-user.target
UNITEOF
  systemctl daemon-reload
  systemctl enable "pm2-${RUN_USER}.service"
  fixed "pm2-${RUN_USER}.service instalat și activat"
fi

pm2 save
ok "PM2 process list salvată pentru reboot"

# ============================================================
# RAPORT FINAL
# ============================================================
step "Raport final"

echo ""
echo -e "${BOLD}Status servicii:${NC}"

systemctl is-active --quiet nginx 2>/dev/null \
  && echo -e "  ${GREEN}✅ Nginx        → ACTIV${NC}" \
  || echo -e "  ${RED}❌ Nginx        → OPRIT${NC}"

if pm2 list 2>/dev/null | grep -q "online"; then
  echo -e "  ${GREEN}✅ PM2/Node     → ACTIV${NC}"
  pm2 list 2>/dev/null | grep -v "^$" | head -10 || true
else
  echo -e "  ${YELLOW}⚠️  PM2/Node     → niciun proces online${NC}"
fi

ss -tlnp 2>/dev/null | grep -qE ":${NODE_PORT}[[:space:]]|:${NODE_PORT}$" \
  && echo -e "  ${GREEN}✅ Port $NODE_PORT    → ASCULTAT${NC}" \
  || echo -e "  ${RED}❌ Port $NODE_PORT    → NU ascultă${NC}"

ufw status 2>/dev/null | grep -qi "active" \
  && echo -e "  ${GREEN}✅ Firewall UFW → ACTIV${NC}" \
  || echo -e "  ${YELLOW}⚠️  Firewall UFW → inactiv${NC}"

[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] \
  && echo -e "  ${GREEN}✅ SSL Certbot  → CERTIFICAT EXISTENT${NC}" \
  || echo -e "  ${YELLOW}⚠️  SSL Certbot  → fără certificat (HTTP only)${NC}"

echo ""
echo -e "${BOLD}URL-uri:${NC}"
echo -e "  ${CYAN}http://${DOMAIN}${NC}"
[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] \
  && echo -e "  ${CYAN}https://${DOMAIN}${NC}"

echo ""
echo -e "${BOLD}Comenzi utile:${NC}"
echo "  pm2 list && pm2 logs"
echo "  systemctl status nginx"
echo "  ufw status verbose"
echo "  curl -I http://localhost:${NODE_PORT}/api/health"
echo "  bash ${DEPLOY_PATH}/scripts/fix-server.sh   # diagnoză + auto-reparare"
echo ""
echo -e "${BLUE}Log complet: ${LOG_FILE}${NC}"
echo ""
echo -e "${GREEN}${BOLD}✅ Deploy final finalizat!${NC}"
