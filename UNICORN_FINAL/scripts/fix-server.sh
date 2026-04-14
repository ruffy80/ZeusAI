#!/usr/bin/env bash
# =============================================================================
# fix-server.sh — Auto-diagnosticare și auto-reparare pentru ZeusAI / Unicorn
#
# Verifică și rezolvă automat:
#   1. Nginx — instalat, configurat, pornit
#   2. Firewall UFW — porturi 22/80/443 deschise
#   3. Node.js / PM2 — backend ascultat pe portul 3000
#   4. SSL Certbot — certificat valid sau reînnoit
#
# Utilizare (pe serverul Hetzner, ca root):
#   bash /root/unicorn-final/scripts/fix-server.sh [DEPLOY_PATH] [DOMAIN]
#
# Exemple:
#   bash /root/unicorn-final/scripts/fix-server.sh
#   bash /root/unicorn-final/scripts/fix-server.sh /root/unicorn-final zeusai.pro
# =============================================================================
set -euo pipefail

# ─── Parametri configurabili ──────────────────────────────────────────────────
DEPLOY_PATH="${1:-/root/unicorn-final}"
DOMAIN="${2:-zeusai.pro}"
NODE_PORT="${NODE_PORT:-3000}"
NGINX_SITE="unicorn"
NGINX_CONF_SRC="${DEPLOY_PATH}/scripts/nginx-unicorn.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"
LOG_FILE="${DEPLOY_PATH}/logs/fix-server-$(date +%Y%m%d-%H%M%S).log"

# ─── Culori terminal ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
FIXED=0

# ─── Utilitare logging ────────────────────────────────────────────────────────
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

ok()    { echo -e "${GREEN}✅  $1${NC}"; PASS=$((PASS + 1)); }
ko()    { echo -e "${RED}❌  $1${NC}"; FAIL=$((FAIL + 1)); }
fixed() { echo -e "${CYAN}🔧  $1${NC}"; FIXED=$((FIXED + 1)); }
info()  { echo -e "${BLUE}ℹ️   $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️   $1${NC}"; }
section() {
  echo ""
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${BLUE}  $1${NC}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
}

# ─── Verificare root ──────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}⚠️  Scriptul trebuie rulat ca root (sudo bash fix-server.sh)${NC}"
  exit 1
fi

echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   ZeusAI / Unicorn — Auto-Repair Server Script  ║"
echo "║   $(date '+%Y-%m-%d %H:%M:%S')  Log: $(basename "$LOG_FILE")  ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Deploy path : $DEPLOY_PATH"
info "Domain      : $DOMAIN"
info "Node port   : $NODE_PORT"

# =============================================================================
# SECȚIUNEA 1 — NGINX
# =============================================================================
section "1. Nginx"

# 1a. Instalare Nginx dacă lipsește
if ! command -v nginx &>/dev/null; then
  warn "Nginx nu este instalat. Instalare..."
  apt-get update -qq
  apt-get install -y nginx
  fixed "Nginx instalat cu succes"
else
  ok "Nginx este instalat ($(nginx -v 2>&1 | head -1))"
fi

# 1b. Instalare configurație site Unicorn
if [ -f "$NGINX_CONF_SRC" ]; then
  # Copy the base config
  cp "$NGINX_CONF_SRC" "$NGINX_AVAILABLE"
  # Replace only the explicit domain server_name lines (not the default_server catch-all: server_name _)
  # Targets lines like: server_name zeusai.pro www.zeusai.pro;
  sed -i "s/server_name zeusai\.pro.*;/server_name ${DOMAIN} www.${DOMAIN};/" "$NGINX_AVAILABLE"
  sed -i "s/server_name api\.zeusai\.pro.*;/server_name api.${DOMAIN};/" "$NGINX_AVAILABLE"
  sed -i "s/server_name orchestrator\.zeusai\.pro.*;/server_name orchestrator.${DOMAIN};/" "$NGINX_AVAILABLE"
  sed -i "s/server_name \*\.zeusai\.pro.*;/server_name *.${DOMAIN};/" "$NGINX_AVAILABLE"
  fixed "Config Nginx instalat la $NGINX_AVAILABLE (domain: $DOMAIN)"
else
  # Generează config minimal dacă fișierul sursă lipsește
  warn "nginx-unicorn.conf lipsește din repo. Se generează config minim..."
  cat > "$NGINX_AVAILABLE" <<NGINXCONF
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ""      close;
}
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN} api.${DOMAIN} orchestrator.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
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
  fixed "Config Nginx minimal generat la $NGINX_AVAILABLE"
fi

# 1c. Activare site (symlink sites-enabled)
if [ ! -L "$NGINX_ENABLED" ]; then
  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  fixed "Site Nginx activat (symlink creat: $NGINX_ENABLED)"
else
  ok "Site Nginx deja activat în sites-enabled"
fi

# Elimină config default Nginx dacă există și poate conflicta
if [ -f "/etc/nginx/sites-enabled/default" ]; then
  rm -f /etc/nginx/sites-enabled/default
  fixed "Config Nginx 'default' eliminat pentru a evita conflicte"
fi

# 1d. Test configurație Nginx
if nginx -t 2>/dev/null; then
  ok "Configurație Nginx validă (nginx -t)"
else
  ko "Configurație Nginx invalidă — verifică manual: nginx -t"
  nginx -t || true
fi

# 1e. Pornire / reload Nginx
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
  ok "Nginx reloaded (config actualizat)"
else
  systemctl enable nginx
  systemctl start nginx
  fixed "Nginx pornit și activat la boot"
fi

# Verificare finală Nginx
if systemctl is-active --quiet nginx; then
  ok "Nginx rulează ✓"
else
  ko "Nginx NU rulează după tentativa de pornire"
fi

# =============================================================================
# SECȚIUNEA 2 — FIREWALL UFW
# =============================================================================
section "2. Firewall (UFW)"

# 2a. Instalare UFW dacă lipsește
if ! command -v ufw &>/dev/null; then
  warn "UFW nu este instalat. Instalare..."
  apt-get install -y ufw
  fixed "UFW instalat"
fi

# 2b. Activare UFW (dacă nu e activ, activăm cu --force pentru a nu bloca SSH)
UFW_STATUS=$(ufw status 2>/dev/null | head -1 || echo "inactive")
if echo "$UFW_STATUS" | grep -q "inactive"; then
  warn "UFW este inactiv. Configurare reguli și activare..."

  # Asigură că SSH nu e blocat ÎNAINTE de activare
  ufw allow 22/tcp comment 'SSH'
  ufw allow 80/tcp comment 'HTTP'
  ufw allow 443/tcp comment 'HTTPS'
  # Activare fără prompt
  echo "y" | ufw enable
  fixed "UFW activat cu regulile SSH/HTTP/HTTPS"
else
  ok "UFW este activ"
fi

# 2c. Verificare și deschidere porturi necesare
declare -A REQUIRED_PORTS=(
  ["22/tcp"]="SSH"
  ["80/tcp"]="HTTP"
  ["443/tcp"]="HTTPS"
)

for PORT_PROTO in "${!REQUIRED_PORTS[@]}"; do
  SERVICE_NAME="${REQUIRED_PORTS[$PORT_PROTO]}"
  PORT_NUM="${PORT_PROTO%/*}"
  PORT_PROTO_TYPE="${PORT_PROTO#*/}"

  # Verifică dacă regula există
  if ufw status | grep -qE "^${PORT_NUM}[[:space:]]|^${PORT_NUM}/${PORT_PROTO_TYPE}[[:space:]]"; then
    ok "Port ${PORT_PROTO} (${SERVICE_NAME}) deschis în UFW ✓"
  else
    ufw allow "${PORT_PROTO}" comment "${SERVICE_NAME}"
    fixed "Port ${PORT_PROTO} (${SERVICE_NAME}) deschis în UFW"
  fi
done

# 2d. Portul 3000 (Node) trebuie să fie BLOCAT public (traficul vine prin Nginx)
if ufw status | grep -qE "^3000[[:space:]]|^3000/tcp[[:space:]]"; then
  ufw delete allow 3000/tcp 2>/dev/null || true
  ufw delete allow 3000 2>/dev/null || true
  fixed "Port 3000 (Node) eliminat din UFW public — securitate îmbunătățită (proxy prin Nginx)"
else
  ok "Port 3000 (Node) nu este expus public ✓ (corect — accesibil doar prin Nginx)"
fi

ufw reload 2>/dev/null || true
info "Reguli UFW active:"
ufw status numbered 2>/dev/null | head -20 || ufw status || true

# =============================================================================
# SECȚIUNEA 3 — NODE.JS / PM2 pe portul 3000
# =============================================================================
section "3. Backend Node.js / PM2 (port $NODE_PORT)"

# 3a. Verificare Node.js
if ! command -v node &>/dev/null; then
  warn "Node.js nu este instalat. Instalare via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  fixed "Node.js $(node --version) instalat"
else
  ok "Node.js instalat: $(node --version)"
fi

# 3b. Verificare PM2
if ! command -v pm2 &>/dev/null; then
  warn "PM2 nu este instalat. Instalare..."
  npm install -g pm2
  fixed "PM2 instalat: $(pm2 --version)"
else
  ok "PM2 instalat: $(pm2 --version)"
fi

# 3c. Verificare că DEPLOY_PATH există
if [ ! -d "$DEPLOY_PATH" ]; then
  ko "Directorul deploy $DEPLOY_PATH nu există — nu se poate porni Node"
else
  ok "Director deploy există: $DEPLOY_PATH"

  # 3d. Instalare dependențe npm dacă node_modules lipsesc
  if [ ! -d "$DEPLOY_PATH/node_modules" ]; then
    warn "node_modules lipsesc. Se instalează dependențele..."
    cd "$DEPLOY_PATH"
    npm install --production
    npm rebuild better-sqlite3 2>/dev/null || true
    fixed "Dependențe npm instalate"
  else
    ok "node_modules există"
    # Rebuild native modules to match current Node.js ABI
    cd "$DEPLOY_PATH"
    npm rebuild better-sqlite3 2>/dev/null || true
  fi

  # 3e. Creare .env dacă lipsește sau JWT_SECRET invalid
  if [ ! -f "$DEPLOY_PATH/.env" ]; then
    warn ".env lipsește. Se creează cu setări minimale..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
    cat > "$DEPLOY_PATH/.env" <<ENVFILE
NODE_ENV=production
PORT=${NODE_PORT}
JWT_SECRET=${JWT_SECRET}
ENVFILE
    fixed ".env creat cu JWT_SECRET generat aleatoriu"
  else
    ok ".env există"
    # Asigură că PORT este setat
    if ! grep -q "^PORT=" "$DEPLOY_PATH/.env"; then
      echo "PORT=${NODE_PORT}" >> "$DEPLOY_PATH/.env"
      fixed "PORT=${NODE_PORT} adăugat în .env"
    fi
    # Asigură că JWT_SECRET este setat și valid (nu valoarea implicită)
    EXISTING_JWT=$(grep '^JWT_SECRET=' "$DEPLOY_PATH/.env" | cut -d= -f2- | tr -d '"' | tr -d "'" | head -1)
    if [ -z "$EXISTING_JWT" ] || [ "$EXISTING_JWT" = "unicorn-jwt-secret-change-in-prod" ]; then
      NEW_JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
      if grep -q '^JWT_SECRET=' "$DEPLOY_PATH/.env"; then
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT}|" "$DEPLOY_PATH/.env"
      else
        echo "JWT_SECRET=${NEW_JWT}" >> "$DEPLOY_PATH/.env"
      fi
      fixed "JWT_SECRET generat și salvat în .env"
    fi
  fi

  # 3f. Verificare dacă portul 3000 este ocupat
  PORT_IN_USE=0
  if ss -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
    PORT_IN_USE=1
  elif netstat -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
    PORT_IN_USE=1
  fi

  if [ "$PORT_IN_USE" -eq 1 ]; then
    ok "Portul ${NODE_PORT} este deja ocupat (Node.js probabil rulează) ✓"
  else
    warn "Portul ${NODE_PORT} nu este ascultat. Se încearcă (re)pornirea serviciului..."
    cd "$DEPLOY_PATH"

    # Încearcă mai întâi unicorn.service (dacă există)
    if systemctl is-enabled --quiet unicorn.service 2>/dev/null; then
      systemctl restart unicorn.service 2>/dev/null || true
      sleep 3
      if ss -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
        fixed "unicorn.service (re)pornit cu succes"
        PORT_IN_USE=1
      else
        warn "unicorn.service nu a pornit backend-ul. Se trece la PM2..."
      fi
    fi

    # Fallback: PM2 clean start
    if [ "$PORT_IN_USE" -eq 0 ]; then
      pm2 stop all 2>/dev/null || true
      pm2 delete all 2>/dev/null || true

      if [ -f "$DEPLOY_PATH/ecosystem.config.js" ]; then
        cd "$DEPLOY_PATH"
        pm2 start ecosystem.config.js
        fixed "PM2 pornit din ecosystem.config.js"
      elif [ -f "$DEPLOY_PATH/UNICORN_FINAL/ecosystem.config.js" ]; then
        cd "$DEPLOY_PATH/UNICORN_FINAL"
        pm2 start ecosystem.config.js
        fixed "PM2 pornit din UNICORN_FINAL/ecosystem.config.js"
      elif [ -f "$DEPLOY_PATH/backend/index.js" ]; then
        cd "$DEPLOY_PATH"
        pm2 start backend/index.js \
          --name unicorn-backend \
          --env production \
          -- PORT="${NODE_PORT}"
        fixed "PM2 pornit direct din backend/index.js"
      else
        ko "Niciun punct de intrare găsit (ecosystem.config.js sau backend/index.js)"
      fi

      pm2 save
    fi
  fi

  # 3g. Activare PM2 la boot
  RUN_USER="${SUDO_USER:-root}"
  PM2_STARTUP=$(pm2 startup systemd -u "$RUN_USER" --hp "$(eval echo ~$RUN_USER)" 2>/dev/null | grep "^sudo" | head -1 || true)
  if [ -n "$PM2_STARTUP" ]; then
    eval "$PM2_STARTUP"
    fixed "PM2 configurat să pornească la reboot"
  fi
fi

# 3h. Verificare finală port 3000
sleep 10
PORT_CHECK=0
if ss -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
  PORT_CHECK=1
elif netstat -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
  PORT_CHECK=1
fi

if [ "$PORT_CHECK" -eq 1 ]; then
  ok "Backend ascultă pe portul ${NODE_PORT} ✓"
else
  ko "Backend NU ascultă pe portul ${NODE_PORT}"
  warn "Verifică manual: pm2 logs && pm2 list"
  # Afișează ultimele loguri PM2 pentru diagnosticare
  pm2 logs unicorn --lines 30 --nostream 2>/dev/null || true
fi

# 3i. Test health endpoint
sleep 2
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${NODE_PORT}/health" 2>/dev/null || echo "000")
API_HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${NODE_PORT}/api/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CODE" = "200" ]; then
  ok "GET /health → HTTP $HEALTH_CODE ✓"
elif [ "$API_HEALTH_CODE" = "200" ]; then
  ok "GET /api/health → HTTP $API_HEALTH_CODE ✓"
else
  warn "Health endpoint nu răspunde (HTTP: /health=$HEALTH_CODE, /api/health=$API_HEALTH_CODE)"
  warn "Poate serverul mai pornește — verifică: curl http://localhost:${NODE_PORT}/health"
fi

# =============================================================================
# SECȚIUNEA 4 — SSL CERTBOT
# =============================================================================
section "4. SSL Certificate (Certbot)"

if command -v certbot &>/dev/null; then
  ok "Certbot instalat"

  # Verifică certificatul pentru domeniu
  CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  if [ -f "$CERT_PATH" ]; then
    # Verifică expirarea (mai puțin de 30 zile → reînnoire)
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_PATH" 2>/dev/null | cut -d= -f2 || echo "")
    if [ -n "$EXPIRY_DATE" ]; then
      EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY_DATE" +%s 2>/dev/null || echo 0)
      NOW_EPOCH=$(date +%s)
      DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

      if [ "$DAYS_LEFT" -gt 30 ]; then
        ok "Certificat SSL valid — expiră în ${DAYS_LEFT} zile ($EXPIRY_DATE)"
      elif [ "$DAYS_LEFT" -gt 0 ]; then
        warn "Certificat SSL expiră în ${DAYS_LEFT} zile. Se încearcă reînnoirea..."
        certbot renew --nginx --non-interactive --quiet 2>/dev/null && \
          fixed "Certificat SSL reînnoit cu succes" || \
          warn "Reînnoirea automată a eșuat — rulează manual: certbot renew --nginx"
      else
        warn "Certificat SSL EXPIRAT. Se încearcă reînnoirea..."
        certbot renew --nginx --non-interactive --quiet 2>/dev/null && \
          fixed "Certificat SSL reînnoit cu succes" || \
          ko "Reînnoire SSL eșuată — rulează manual: certbot renew --nginx"
      fi
    fi
  else
    warn "Niciun certificat SSL găsit pentru $DOMAIN. Se obține automat..."
    # SSL off la registrar (sav.com) — certbot gestionează HTTPS direct pe server
    certbot --nginx \
      -d "${DOMAIN}" -d "www.${DOMAIN}" -d "api.${DOMAIN}" -d "orchestrator.${DOMAIN}" \
      --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect 2>/dev/null && \
      fixed "Certificat SSL obținut pentru ${DOMAIN} + www + api + orchestrator" || {
        warn "Certbot a eșuat (DNS poate nu s-a propagat încă). Nginx rulează pe HTTP."
        info "Reîncearcă manual: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d api.${DOMAIN} -d orchestrator.${DOMAIN}"
      }
  fi
else
  warn "Certbot nu este instalat."
  info "Instalează cu: apt-get install -y certbot python3-certbot-nginx"
  info "Apoi obține certificat: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d api.${DOMAIN} -d orchestrator.${DOMAIN}"
fi

# =============================================================================
# SECȚIUNEA 5 — RAPORT FINAL
# =============================================================================
section "5. Raport final"

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
  echo -e "  ${GREEN}✅ PM2/Node     → ACTIV (procese online)${NC}"
  pm2 list 2>/dev/null | grep -v "^$" | head -10 || true
else
  echo -e "  ${YELLOW}⚠️  PM2/Node     → niciun proces online${NC}"
fi

# Port 3000
if ss -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]" || \
   netstat -tlnp 2>/dev/null | grep -q ":${NODE_PORT}[[:space:]]"; then
  echo -e "  ${GREEN}✅ Port $NODE_PORT    → ASCULTAT${NC}"
else
  echo -e "  ${RED}❌ Port $NODE_PORT    → NU ascultă${NC}"
fi

# UFW
UFW_NOW=$(ufw status 2>/dev/null | head -1 || echo "unknown")
if echo "$UFW_NOW" | grep -qi "active"; then
  echo -e "  ${GREEN}✅ Firewall UFW → ACTIV${NC}"
else
  echo -e "  ${YELLOW}⚠️  Firewall UFW → $UFW_NOW${NC}"
fi

# SSL
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  echo -e "  ${GREEN}✅ SSL Certbot  → CERTIFICAT EXISTENT${NC}"
else
  echo -e "  ${YELLOW}⚠️  SSL Certbot  → fără certificat (HTTP only)${NC}"
fi

# unicorn.service
if systemctl is-active --quiet unicorn.service 2>/dev/null; then
  echo -e "  ${GREEN}✅ unicorn.service → ACTIV${NC}"
elif systemctl is-enabled --quiet unicorn.service 2>/dev/null; then
  echo -e "  ${GREEN}✅ unicorn.service → enabled (PM2 gestionează procesele)${NC}"
else
  echo -e "  ${YELLOW}⚠️  unicorn.service → neinstalat (rulați setup-systemd.sh)${NC}"
fi

echo ""
echo -e "${BOLD}Sumar verificări:${NC}"
echo -e "  ${GREEN}Trecut:  $PASS${NC}"
echo -e "  ${CYAN}Reparate: $FIXED${NC}"
echo -e "  ${RED}Eșuat:   $FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✅ Toate verificările au trecut! Site-ul funcționează corect.${NC}"
  echo -e "   URL: ${CYAN}http://${DOMAIN}${NC}"
  [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && \
    echo -e "   URL securizat: ${CYAN}https://${DOMAIN}${NC}"
else
  echo -e "${YELLOW}${BOLD}⚠️  ${FAIL} probleme necesită intervenție manuală.${NC}"
  echo -e "   Log complet: ${LOG_FILE}"
fi

echo ""
echo -e "${BLUE}Comenzi utile de diagnoza:${NC}"
echo "  systemctl status nginx"
echo "  pm2 list && pm2 logs"
echo "  ufw status verbose"
echo "  ss -tlnp | grep -E '80|443|3000'"
echo "  curl -I http://localhost:${NODE_PORT}/health"
echo ""
