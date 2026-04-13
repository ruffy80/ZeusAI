#!/usr/bin/env bash
# =============================================================================
# setup-production.sh — Configurare completă producție pentru ZeusAI / Unicorn
#
# Rulează pe un server Hetzner Ubuntu/Debian proaspăt (sau existent).
# Acoperă toți pașii necesari pentru un deploy complet:
#   1. Instalare Certbot + plugin Nginx
#   2. Generare certificat SSL real (Certbot + Nginx)
#   3. Verificare și pornire Nginx
#   4. Firewall (UFW) — porturi 22/80/443
#   5. Backend Unicorn (PM2)
#   6. Frontend Unicorn (build React)
#   7. Configurare Nginx (proxy invers → portul 3000)
#
# Utilizare (ca root pe serverul Hetzner):
#   bash scripts/setup-production.sh [DEPLOY_PATH] [DOMAIN] [ADMIN_EMAIL]
#
# Exemple:
#   bash scripts/setup-production.sh
#   bash scripts/setup-production.sh /root/unicorn-final zeusai.pro admin@zeusai.pro
#
# Sau cu variabile de mediu:
#   DEPLOY_PATH=/root/unicorn-final DOMAIN=zeusai.pro \
#     bash scripts/setup-production.sh
# =============================================================================
set -euo pipefail

# ─── Parametri configurabili ──────────────────────────────────────────────────
DEPLOY_PATH="${1:-${DEPLOY_PATH:-/root/unicorn-final}}"
DOMAIN="${2:-${DOMAIN:-zeusai.pro}}"
ADMIN_EMAIL="${3:-${ADMIN_EMAIL:-admin@zeusai.pro}}"
NODE_PORT="${NODE_PORT:-3000}"
NGINX_SITE="unicorn"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"

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
info()    { echo -e "${BLUE}ℹ️   $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️   $1${NC}"; }
section() {
  echo ""
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${BLUE}  $1${NC}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
}

# ─── Verificare root ──────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}⚠️  Scriptul trebuie rulat ca root (sudo bash setup-production.sh)${NC}"
  exit 1
fi

echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ZeusAI / Unicorn — Production Setup Script            ║"
printf "║   %s%-29s║\n" "$(date '+%Y-%m-%d %H:%M:%S')" " "
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Deploy path  : $DEPLOY_PATH"
info "Domain       : $DOMAIN"
info "Admin email  : $ADMIN_EMAIL"
info "Node port    : $NODE_PORT"

# =============================================================================
# PASUL 1 — Instalare Certbot + plugin Nginx
# =============================================================================
section "1. Instalare Certbot + python3-certbot-nginx"

apt-get update -qq
if ! command -v certbot &>/dev/null; then
  apt-get install -y certbot python3-certbot-nginx
  ok "Certbot instalat: $(certbot --version 2>&1)"
else
  ok "Certbot deja instalat: $(certbot --version 2>&1)"
  # Asigură că plugin-ul Nginx este prezent
  apt-get install -y python3-certbot-nginx 2>/dev/null || true
fi

# =============================================================================
# PASUL 2 — Nginx (instalare + pornire înainte de Certbot)
# =============================================================================
section "2. Instalare + pornire Nginx (necesară pentru Certbot)"

if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx
  ok "Nginx instalat: $(nginx -v 2>&1)"
else
  ok "Nginx deja instalat: $(nginx -v 2>&1)"
fi

# Copiază configurația site din repo (sau generează una minimală)
NGINX_CONF_SRC="${DEPLOY_PATH}/scripts/nginx-unicorn.conf"
if [ -f "$NGINX_CONF_SRC" ]; then
  cp "$NGINX_CONF_SRC" "$NGINX_AVAILABLE"
  # Actualizează server_name cu domeniul curent
  sed -i "s/server_name .*;/server_name ${DOMAIN} www.${DOMAIN};/" "$NGINX_AVAILABLE"
  ok "Config Nginx instalat din repo → $NGINX_AVAILABLE (domain: $DOMAIN)"
else
  warn "nginx-unicorn.conf nu a fost găsit în repo. Se generează config minimal..."
  mkdir -p /var/www/certbot
  cat > "$NGINX_AVAILABLE" <<NGINXCONF
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ""      close;
}
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 256;

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
        proxy_read_timeout 3600s;
        chunked_transfer_encoding on;
    }

    location / {
        proxy_pass         http://127.0.0.1:${NODE_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        \$connection_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }
}
NGINXCONF
  ok "Config Nginx minimal generat → $NGINX_AVAILABLE"
fi

# Activare site (symlink sites-enabled)
if [ ! -L "$NGINX_ENABLED" ]; then
  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  ok "Site Nginx activat (symlink: $NGINX_ENABLED)"
fi

# Elimină config default pentru a evita conflicte
[ -f "/etc/nginx/sites-enabled/default" ] && rm -f /etc/nginx/sites-enabled/default && info "Config 'default' eliminat"

# Validare și pornire Nginx
nginx -t
systemctl enable nginx
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
  ok "Nginx reloaded"
else
  systemctl start nginx
  ok "Nginx pornit și activat la boot"
fi

# =============================================================================
# PASUL 3 — Generare certificat SSL real (Certbot + Nginx)
# =============================================================================
section "3. Generare SSL real (Certbot --nginx)"

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [ -f "$CERT_PATH" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" 2>/dev/null | cut -d= -f2 || echo "necunoscut")
  ok "Certificat SSL există deja (expiră: $EXPIRY)"
  info "Dacă vrei să reînnoiești: certbot renew --nginx"
else
  info "Obținere certificat SSL pentru ${DOMAIN} și www.${DOMAIN}..."
  if certbot --nginx \
       -d "${DOMAIN}" -d "www.${DOMAIN}" \
       --non-interactive \
       --agree-tos \
       -m "${ADMIN_EMAIL}" \
       --redirect; then
    ok "Certificat SSL generat și Nginx configurat pentru HTTPS"
  else
    warn "Certbot a eșuat — site-ul va funcționa pe HTTP (port 80)"
    warn "Verifică că DNS-ul domeniului pointează corect la IP-ul serverului"
    warn "Reîncearcă manual: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
  fi
fi

# =============================================================================
# PASUL 4 — Firewall UFW (porturi necesare)
# =============================================================================
section "4. Firewall (UFW)"

if ! command -v ufw &>/dev/null; then
  apt-get install -y ufw
  ok "UFW instalat"
fi

# Permite SSH înainte de orice altceva pentru a nu ne bloca accesul
ufw allow OpenSSH
ufw allow 22/tcp  comment 'SSH'
ufw allow 80/tcp  comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Blochează portul Node direct (traficul trece prin Nginx)
ufw delete allow 3000/tcp 2>/dev/null || true
ufw delete allow 3000     2>/dev/null || true

UFW_STATUS=$(ufw status 2>/dev/null | head -1 || echo "inactive")
if echo "$UFW_STATUS" | grep -qi "inactive"; then
  echo "y" | ufw enable
  ok "UFW activat cu reguli SSH/HTTP/HTTPS"
else
  ufw reload
  ok "UFW reloaded — reguli actualizate"
fi

info "Reguli UFW active:"
ufw status numbered 2>/dev/null | head -15 || ufw status || true

# =============================================================================
# PASUL 5 — Node.js + PM2 + Backend Unicorn
# =============================================================================
section "5. Backend Unicorn (Node.js + PM2)"

# 5a. Verificare/instalare Node.js
if ! command -v node &>/dev/null; then
  warn "Node.js nu este instalat. Instalare via NodeSource (Node 20)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  ok "Node.js instalat: $(node --version)"
else
  ok "Node.js: $(node --version)"
fi

# 5b. Verificare/instalare PM2
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
  ok "PM2 instalat: $(pm2 --version)"
else
  ok "PM2: $(pm2 --version)"
fi

# 5c. Deploy path verificare
if [ ! -d "$DEPLOY_PATH" ]; then
  ko "Directorul $DEPLOY_PATH nu există. Asigură-te că repo-ul este clonat."
  echo ""
  echo "  git clone https://github.com/ruffy80/ZeusAI.git /tmp/ZeusAI"
  echo "  cp -r /tmp/ZeusAI/UNICORN_FINAL $DEPLOY_PATH"
  exit 1
fi
ok "Director deploy: $DEPLOY_PATH"

# 5d. Instalare dependențe npm
cd "$DEPLOY_PATH"
if [ ! -d "node_modules" ]; then
  info "Instalare dependențe npm (production)..."
  npm install --production
  ok "Dependențe npm instalate"
else
  ok "node_modules există și sunt la zi"
fi

# 5e. Creare/actualizare .env
if [ ! -f ".env" ]; then
  info "Creare .env cu valori implicite..."
  bash scripts/create-env.sh "$DEPLOY_PATH" 2>/dev/null || {
    JWT_SECRET=$(openssl rand -hex 32)
    cat > .env <<ENVFILE
NODE_ENV=production
PORT=${NODE_PORT}
DOMAIN=${DOMAIN}
SITE_DOMAIN=${DOMAIN}
PUBLIC_APP_URL=https://${DOMAIN}
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ENVFILE
  }
  chmod 600 .env
  ok ".env creat (editează cu cheile API reale)"
else
  ok ".env există"
fi

# 5f. Pornire PM2 (clean start conform memoriei project)
info "Pornire PM2 (clean start: delete all → start ecosystem)..."
pm2 delete all 2>/dev/null || true

if [ -f "$DEPLOY_PATH/ecosystem.config.js" ]; then
  pm2 start ecosystem.config.js
  ok "PM2 pornit din ecosystem.config.js"
elif [ -f "$DEPLOY_PATH/backend/index.js" ]; then
  pm2 start backend/index.js --name unicorn-backend --env production
  ok "PM2 pornit din backend/index.js"
else
  ko "Niciun punct de intrare găsit (ecosystem.config.js sau backend/index.js)"
  exit 1
fi

pm2 save

# 5g. Configurare PM2 la startup
RUN_USER="${SUDO_USER:-root}"
STARTUP_CMD=$(pm2 startup systemd -u "$RUN_USER" --hp "$(eval echo ~$RUN_USER)" 2>/dev/null | grep "^sudo" | head -1 || true)
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD"
  ok "PM2 configurat să pornească la reboot (systemd)"
fi

# =============================================================================
# PASUL 6 — Frontend Unicorn (build React)
# =============================================================================
section "6. Frontend Unicorn (build)"

CLIENT_DIR="${DEPLOY_PATH}/client"

if [ -d "$CLIENT_DIR" ] && [ -f "$CLIENT_DIR/package.json" ]; then
  cd "$CLIENT_DIR"
  info "Instalare dependențe frontend..."
  npm install
  info "Build frontend (CI=false pentru a ignora warning-urile ca erori)..."
  CI=false npm run build
  ok "Build frontend finalizat → $CLIENT_DIR/build"
  cd "$DEPLOY_PATH"
else
  info "Directorul client/ nu există sau nu are package.json — frontend servit din src/site/template.js (SSR)"
fi

# =============================================================================
# PASUL 7 — Configurare finală Nginx (reload cu HTTPS dacă certbot a reușit)
# =============================================================================
section "7. Configurare finală Nginx"

# Actualizează proxy_port dacă diferă
if [ -f "$NGINX_AVAILABLE" ]; then
  # Asigură că portul Node în config reflectă NODE_PORT
  sed -i "s|proxy_pass.*http://127\.0\.0\.1:[0-9]*;|proxy_pass         http://127.0.0.1:${NODE_PORT};|g" \
    "$NGINX_AVAILABLE" 2>/dev/null || true
  ok "Config Nginx actualizat (proxy → 127.0.0.1:${NODE_PORT})"
fi

# Reload final cu configurația completă (inclusiv HTTPS dacă certbot a rulat)
nginx -t && systemctl reload nginx
ok "Nginx reloaded cu configurația finală"

# =============================================================================
# RAPORT FINAL
# =============================================================================
section "✅ Raport final"

echo ""
echo -e "${BOLD}Status servicii:${NC}"

systemctl is-active --quiet nginx 2>/dev/null && \
  echo -e "  ${GREEN}✅ Nginx         → ACTIV${NC}" || \
  echo -e "  ${RED}❌ Nginx         → OPRIT${NC}"

pm2 list 2>/dev/null | grep -q "online" && \
  echo -e "  ${GREEN}✅ PM2 / Node    → ACTIV${NC}" || \
  echo -e "  ${YELLOW}⚠️  PM2 / Node    → niciun proces online${NC}"

ufw status 2>/dev/null | grep -qi "active" && \
  echo -e "  ${GREEN}✅ Firewall UFW  → ACTIV${NC}" || \
  echo -e "  ${YELLOW}⚠️  Firewall UFW  → INACTIV${NC}"

[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && \
  echo -e "  ${GREEN}✅ SSL Certbot   → CERTIFICAT VALID${NC}" || \
  echo -e "  ${YELLOW}⚠️  SSL Certbot   → fără certificat (HTTP only)${NC}"

echo ""
echo -e "${BOLD}URLs:${NC}"
[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && \
  echo -e "  ${CYAN}https://${DOMAIN}${NC}" || \
  echo -e "  ${CYAN}http://${DOMAIN}${NC}"

echo ""
echo -e "${BOLD}Comenzi utile:${NC}"
echo "  pm2 list && pm2 logs"
echo "  systemctl status nginx"
echo "  ufw status verbose"
echo "  curl https://${DOMAIN}/health"
echo ""
echo -e "${BOLD}Pentru reparare/diagnosticare:${NC}"
echo "  bash ${DEPLOY_PATH}/scripts/fix-server.sh ${DEPLOY_PATH} ${DOMAIN}"
echo ""
