#!/usr/bin/env bash
# =============================================================================
# setup-server.sh — Bootstrap complet server Hetzner pentru Unicorn / ZeusAI
#
# Acoperă toate etapele de la zero:
#   1. Creare structură /var/www/unicorn (sau DEPLOY_PATH)
#   2. Instalare Node.js 20, Nginx, Certbot, PM2
#   3. Firewall UFW (22/80/443 deschise, 3000 blocat public)
#   4. Build frontend (client/)
#   5. Pornire backend cu PM2
#   6. Configurare Nginx + HTTPS cu Certbot
#   7. Persistență PM2 la reboot
#
# Utilizare (pe serverul Hetzner, ca root):
#   bash /var/www/unicorn/scripts/setup-server.sh [DEPLOY_PATH] [DOMAIN] [ADMIN_EMAIL]
#
# Exemple:
#   bash setup-server.sh
#   bash setup-server.sh /var/www/unicorn zeusai.pro admin@zeusai.pro
#   DEPLOY_PATH=/opt/unicorn DOMAIN=zeusai.pro bash setup-server.sh
#
# Variabile de mediu opționale (pot fi setate înainte de rulare):
#   DEPLOY_PATH    — directorul unde e clonată aplicația  (default: /var/www/unicorn)
#   DOMAIN         — domeniul principal                    (default: zeusai.pro)
#   ADMIN_EMAIL    — email pentru Certbot / Let's Encrypt  (default: admin@<DOMAIN>)
#   NODE_PORT      — portul pe care ascultă Node.js        (default: 3000)
#   SKIP_SSL       — setează la "1" pentru a sări SSL     (default: 0)
#   SKIP_FRONTEND  — setează la "1" pentru a sări build   (default: 0)
# =============================================================================
set -euo pipefail

# ─── Parametri configurabili ──────────────────────────────────────────────────
DEPLOY_PATH="${1:-${DEPLOY_PATH:-/var/www/unicorn}}"
DOMAIN="${2:-${DOMAIN:-zeusai.pro}}"
ADMIN_EMAIL="${3:-${ADMIN_EMAIL:-admin@${DOMAIN}}}"
NODE_PORT="${NODE_PORT:-3000}"
SKIP_SSL="${SKIP_SSL:-0}"
SKIP_FRONTEND="${SKIP_FRONTEND:-0}"

NGINX_SITE="${DOMAIN}"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"

LOG_DIR="${DEPLOY_PATH}/logs"
LOG_FILE="${LOG_DIR}/setup-server-$(date +%Y%m%d-%H%M%S).log"

# ─── Culori terminal ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()      { echo -e "${GREEN}✅  $1${NC}"; }
ko()      { echo -e "${RED}❌  $1${NC}"; }
fixed()   { echo -e "${CYAN}🔧  $1${NC}"; }
info()    { echo -e "${BLUE}ℹ️   $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️   $1${NC}"; }
step()    { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════════${NC}"; \
            echo -e "${BOLD}${BLUE}  $1${NC}"; \
            echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"; }
die()     { echo -e "${RED}💀  FATAL: $1${NC}" >&2; exit 1; }

# ─── Verificare root ──────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  die "Scriptul trebuie rulat ca root: sudo bash setup-server.sh"
fi

# ─── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ZeusAI / Unicorn — Bootstrap Server Script        ║"
echo "║   $(date '+%Y-%m-%d %H:%M:%S')                            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Deploy path  : $DEPLOY_PATH"
info "Domain       : $DOMAIN"
info "Admin email  : $ADMIN_EMAIL"
info "Node port    : $NODE_PORT"
info "Skip SSL     : $SKIP_SSL"
info "Skip frontend: $SKIP_FRONTEND"

# ─── Logging ──────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
info "Log: $LOG_FILE"

# =============================================================================
# ETAPA 0 — Creare structură directoare
# =============================================================================
step "0. Structură directoare"

mkdir -p \
  "${DEPLOY_PATH}" \
  "${DEPLOY_PATH}/logs" \
  /var/www/certbot

if [ ! -d "${DEPLOY_PATH}/backend" ] && [ ! -f "${DEPLOY_PATH}/package.json" ]; then
  warn "Aplicația nu este clonată în $DEPLOY_PATH."
  warn "Clonare manuală necesară înainte de a continua:"
  warn "  git clone https://github.com/ruffy80/ZeusAI.git /tmp/zeusai"
  warn "  cp -r /tmp/zeusai/UNICORN_FINAL/. $DEPLOY_PATH/"
  warn "Sau setează DEPLOY_PATH la un director deja clonat și rulează din nou."
fi

ok "Structură directoare OK: $DEPLOY_PATH"

# =============================================================================
# ETAPA 1 — Update sistem + instalare pachete
# =============================================================================
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

# ─── Node.js 20 via NodeSource ────────────────────────────────────────────────
if command -v node &>/dev/null && node --version 2>/dev/null | grep -q "^v20\."; then
  ok "Node.js $(node --version) deja instalat"
else
  info "Instalare Node.js 20 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  fixed "Node.js $(node --version) instalat"
fi

# ─── PM2 ─────────────────────────────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  ok "PM2 $(pm2 --version) deja instalat"
else
  npm install -g pm2
  fixed "PM2 $(pm2 --version) instalat"
fi

# =============================================================================
# ETAPA 2 — Firewall UFW
# =============================================================================
step "2. Firewall UFW"

# Asigură că SSH nu e blocat ÎNAINTE de activare
ufw allow 22/tcp   comment 'SSH'   2>/dev/null || true
ufw allow 80/tcp   comment 'HTTP'  2>/dev/null || true
ufw allow 443/tcp  comment 'HTTPS' 2>/dev/null || true

# Blochează portul 3000 public (Node.js e accesat doar prin Nginx)
ufw delete allow "${NODE_PORT}/tcp" 2>/dev/null || true
ufw delete allow "${NODE_PORT}"     2>/dev/null || true

# Activare UFW fără prompt
if ufw status 2>/dev/null | grep -q "inactive"; then
  echo "y" | ufw enable
  fixed "UFW activat"
else
  ufw reload 2>/dev/null || true
  ok "UFW deja activ — reguli actualizate"
fi

ufw status numbered 2>/dev/null | head -15 || ufw status || true
ok "Firewall configurat: SSH/HTTP/HTTPS deschise, portul $NODE_PORT blocat public"

# =============================================================================
# ETAPA 3 — Pornire + activare Nginx (HTTP inițial)
# =============================================================================
step "3. Nginx — configurare inițială HTTP"

# Activare Nginx la boot
systemctl enable nginx

# Configurație Nginx pentru zeusai.pro
# (certbot va adăuga blocul HTTPS după obținerea certificatelor)
cat > "$NGINX_AVAILABLE" <<NGINXEOF
# Configurare Nginx pentru Unicorn AI / ZeusAI
# Generat de setup-server.sh pe $(date '+%Y-%m-%d %H:%M:%S')
# certbot --nginx va adăuga automat blocul HTTPS (port 443).

map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ""      close;
}

# Redirect HTTP → HTTPS (va fi activat de certbot)
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
        # WebSocket: trimite header Upgrade doar când clientul îl solicită
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        \$connection_upgrade;
        proxy_connect_timeout  60s;
        proxy_send_timeout     60s;
        proxy_read_timeout     60s;
    }
}
NGINXEOF

# Activare site (symlink)
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

# Elimină config default care poate conflicta
rm -f /etc/nginx/sites-enabled/default

# Test și pornire / reload
nginx -t
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
  ok "Nginx reloaded cu noua configurație"
else
  systemctl start nginx
  fixed "Nginx pornit"
fi

ok "Nginx activ pe portul 80 pentru $DOMAIN"

# =============================================================================
# ETAPA 4 — Build frontend (client/)
# =============================================================================
step "4. Build frontend"

if [ "$SKIP_FRONTEND" = "1" ]; then
  warn "SKIP_FRONTEND=1 — build frontend sărit"
elif [ -d "${DEPLOY_PATH}/client" ]; then
  cd "${DEPLOY_PATH}/client"
  npm install --legacy-peer-deps --no-audit --no-fund
  CI=false npm run build
  fixed "Frontend build finalizat: ${DEPLOY_PATH}/client/build"
  cd "$DEPLOY_PATH"
else
  warn "Directorul client/ nu există în $DEPLOY_PATH — build frontend sărit"
fi

# =============================================================================
# ETAPA 5 — Backend Node.js cu PM2
# =============================================================================
step "5. Backend — PM2"

if [ -d "$DEPLOY_PATH" ]; then
  cd "$DEPLOY_PATH"

  # Instalare dependențe backend
  if [ -f "package.json" ]; then
    npm install --legacy-peer-deps --no-audit --no-fund
    ok "Dependențe backend instalate"
  else
    warn "package.json lipsește în $DEPLOY_PATH — sari instalare npm"
  fi

  # Generare .env dacă lipsește (minim funcțional)
  if [ ! -f ".env" ]; then
    warn ".env lipsește. Se creează cu setări minimale..."
    JWT_SECRET="$(openssl rand -hex 32)" || die "openssl rand pentru JWT_SECRET a eșuat"
    ADMIN_SECRET="$(openssl rand -hex 24)" || die "openssl rand pentru ADMIN_SECRET a eșuat"
    [ -z "$JWT_SECRET" ]   && die "JWT_SECRET generat este gol — verifică openssl"
    [ -z "$ADMIN_SECRET" ] && die "ADMIN_SECRET generat este gol — verifică openssl"
    # Owner / payment credentials — configurabile via env vars
    _OWNER_NAME="${OWNER_NAME:-Vladoi Ionut}"
    _OWNER_EMAIL="${OWNER_EMAIL:-vladoi_ionut@yahoo.com}"
    _BTC_ADDR="${BTC_WALLET_ADDRESS:-bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e}"
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

  # Pornire PM2 (clean start)
  pm2 stop all   2>/dev/null || true
  pm2 delete all 2>/dev/null || true

  if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
    fixed "PM2 pornit din ecosystem.config.js"
  elif [ -f "backend/index.js" ]; then
    pm2 start backend/index.js \
      --name unicorn-backend \
      --env production
    fixed "PM2 pornit din backend/index.js"
  else
    warn "Niciun entry point găsit (ecosystem.config.js sau backend/index.js)"
  fi

  pm2 save
  ok "PM2 save efectuat"
else
  warn "DEPLOY_PATH=$DEPLOY_PATH nu există — PM2 nu a fost pornit"
fi

# =============================================================================
# ETAPA 6 — SSL cu Certbot (Let's Encrypt)
# =============================================================================
step "6. SSL — Certbot Let's Encrypt"

if [ "$SKIP_SSL" = "1" ]; then
  warn "SKIP_SSL=1 — obținere certificat SSL sărită"
  info "Rulează manual când DNS-ul domeniului pointează la acest server:"
  info "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m ${ADMIN_EMAIL}"
else
  CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

  if [ -f "$CERT_PATH" ]; then
    ok "Certificat SSL deja existent pentru $DOMAIN"
    # Verificare expirare
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" 2>/dev/null | cut -d= -f2 || true)
    if [ -n "$EXPIRY" ]; then
      # Validare minimală: trebuie să conțină o literă (lună) și un an 4 cifre
      if echo "$EXPIRY" | grep -qE "[A-Za-z].*[0-9]{4}"; then
        info "Certificat valid până la: $EXPIRY"
      else
        warn "Format dată expimare necunoscut: $EXPIRY"
      fi
    fi
  else
    info "Obținere certificat SSL pentru $DOMAIN și www.$DOMAIN..."
    info "Asigură-te că DNS-ul domeniului pointează la IP-ul acestui server înainte de a continua."
    if certbot --nginx \
        -d "${DOMAIN}" \
        -d "www.${DOMAIN}" \
        --non-interactive \
        --agree-tos \
        -m "${ADMIN_EMAIL}" \
        --redirect; then
      fixed "Certificat SSL obținut și HTTPS configurat automat de certbot"
    else
      warn "Certbot a eșuat — verifică că DNS-ul domeniului pointează la acest server."
      info "Reîncearcă manual: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -m ${ADMIN_EMAIL}"
      info "Site-ul funcționează pe HTTP (port 80) până atunci."
    fi
  fi

  # Activare reînnoire automată (timer systemd — certbot o instalează automat)
  if systemctl is-enabled certbot.timer 2>/dev/null | grep -q "enabled"; then
    ok "Reînnoire automată SSL activă (certbot.timer)"
  else
    # Fallback: cron job
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
      (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --nginx") | crontab -
      fixed "Cron job pentru reînnoire automată SSL adăugat (zilnic, ora 03:00)"
    fi
  fi
fi

# Reload Nginx cu configurația finală (certbot poate fi modificat)
nginx -t && systemctl reload nginx
ok "Nginx reloaded cu configurația finală"

# =============================================================================
# ETAPA 7 — Persistență PM2 la reboot (pm2 startup)
# =============================================================================
step "7. Persistență PM2 la reboot"

RUN_USER="${SUDO_USER:-root}"
PM2_HOME="$(eval echo ~"$RUN_USER")/.pm2"

STARTUP_CMD=$(pm2 startup systemd -u "$RUN_USER" --hp "$(eval echo ~"$RUN_USER")" 2>/dev/null \
  | grep -E "^sudo" | head -1 || true)

if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD"
  fixed "PM2 startup configurat: $STARTUP_CMD"
else
  # Fallback: scriere manuală a unit-ului systemd
  NODE_BIN="$(command -v node || echo '/usr/bin/node')"
  PM2_BIN="$(command -v pm2 || echo '/usr/local/bin/pm2')"
  cat > "/etc/systemd/system/pm2-${RUN_USER}.service" <<UNITEOF
[Unit]
Description=PM2 process manager for ${RUN_USER}
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=${RUN_USER}
LimitNOFILE=infinity
LimitCORE=infinity
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

# =============================================================================
# RAPORT FINAL
# =============================================================================
step "Raport final"

echo ""
echo -e "${BOLD}Status servicii:${NC}"

# Nginx
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo -e "  ${GREEN}✅ Nginx        → ACTIV${NC}"
else
  echo -e "  ${RED}❌ Nginx        → OPRIT${NC}"
fi

# PM2 / Node
if pm2 list 2>/dev/null | grep -q "online"; then
  echo -e "  ${GREEN}✅ PM2/Node     → ACTIV${NC}"
  pm2 list 2>/dev/null | grep -v "^$" | head -10 || true
else
  echo -e "  ${YELLOW}⚠️  PM2/Node     → niciun proces online${NC}"
fi

# Port NODE
PORT_UP=0
ss -tlnp 2>/dev/null | grep -qE ":${NODE_PORT}[[:space:]]|:${NODE_PORT}$" && PORT_UP=1
if [ "$PORT_UP" -eq 1 ]; then
  echo -e "  ${GREEN}✅ Port $NODE_PORT    → ASCULTAT${NC}"
else
  echo -e "  ${RED}❌ Port $NODE_PORT    → NU ascultă${NC}"
fi

# UFW
if ufw status 2>/dev/null | grep -qi "active"; then
  echo -e "  ${GREEN}✅ Firewall UFW → ACTIV${NC}"
else
  echo -e "  ${YELLOW}⚠️  Firewall UFW → inactiv${NC}"
fi

# SSL
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  echo -e "  ${GREEN}✅ SSL Certbot  → CERTIFICAT EXISTENT${NC}"
else
  echo -e "  ${YELLOW}⚠️  SSL Certbot  → fără certificat (HTTP only)${NC}"
fi

echo ""
echo -e "${BOLD}URL-uri:${NC}"
echo -e "  ${CYAN}http://${DOMAIN}${NC}"
[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && \
  echo -e "  ${CYAN}https://${DOMAIN}${NC}"

echo ""
echo -e "${BOLD}Comenzi utile:${NC}"
echo "  pm2 list && pm2 logs"
echo "  systemctl status nginx"
echo "  ufw status verbose"
echo "  curl -I http://localhost:${NODE_PORT}/api/health"
echo "  bash ${DEPLOY_PATH}/scripts/fix-server.sh  # diagnoză + auto-reparare"
echo ""
echo -e "${BLUE}Log complet: ${LOG_FILE}${NC}"
echo ""
echo -e "${GREEN}${BOLD}✅ Bootstrap server finalizat!${NC}"
