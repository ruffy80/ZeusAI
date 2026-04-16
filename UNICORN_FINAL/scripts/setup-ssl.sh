#!/usr/bin/env bash
# =============================================================================
# setup-ssl.sh — Activare HTTPS completă și automată pentru ZeusAI / zeusai.pro
#
# Execută în ordine exactă:
#   1. Verifică / instalează Nginx + pornește serviciul
#   2. Deschide portul 443 în firewall (UFW + iptables)
#   3. Verifică că DNS-ul domeniului pointează la acest server
#   4. Rulează Certbot --nginx → obține / reînnoiește certificatul SSL
#   5. Verifică HTTPS local și raportează statusul final
#
# Certbot injectează automat blocurile listen 443 ssl în nginx.conf.
# Script-ul NU suprascrie config-ul Nginx dacă certificatul există deja.
#
# Utilizare (ca root pe serverul Hetzner):
#   bash setup-ssl.sh [DOMAIN] [ADMIN_EMAIL] [DEPLOY_PATH]
#   bash setup-ssl.sh zeusai.pro admin@zeusai.pro /var/www/unicorn
# =============================================================================
set -uo pipefail

DOMAIN="${1:-${SITE_DOMAIN:-zeusai.pro}}"
ADMIN_EMAIL="${2:-${ADMIN_EMAIL:-admin@${DOMAIN}}}"
DEPLOY_PATH="${3:-${DEPLOY_PATH:-/var/www/unicorn}}"
NGINX_CONF_SRC="${DEPLOY_PATH}/scripts/nginx-unicorn.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/unicorn"
NGINX_ENABLED="/etc/nginx/sites-enabled/unicorn"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()      { echo -e "${GREEN}✅  $1${NC}"; }
ko()      { echo -e "${RED}❌  $1${NC}"; }
info()    { echo -e "${BLUE}ℹ️   $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️   $1${NC}"; }
fixed()   { echo -e "${CYAN}🔧  $1${NC}"; }
section() {
  echo ""
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${BLUE}  $1${NC}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
}

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Rulați ca root: sudo bash setup-ssl.sh${NC}"; exit 1
fi

echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ZeusAI — HTTPS Auto-Setup (setup-ssl.sh)          ║"
printf "║   %-52s║\n" "$(date '+%Y-%m-%d %H:%M:%S')"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Domain       : $DOMAIN"
info "Admin email  : $ADMIN_EMAIL"
info "Deploy path  : $DEPLOY_PATH"

# =============================================================================
# PAS 1 — Nginx: instalare + config HTTP + pornire
# =============================================================================
section "1. Nginx — instalare, configurare, pornire"

if ! command -v nginx &>/dev/null; then
  info "Instalez Nginx..."
  apt-get update -qq
  apt-get install -y nginx
  fixed "Nginx instalat: $(nginx -v 2>&1)"
else
  ok "Nginx instalat: $(nginx -v 2>&1)"
fi

# Generare/deploy config Nginx:
#   nginx-unicorn.conf conține DOAR blocuri HTTP (portul 80).
#   Blocurile HTTPS (listen 443 ssl) sunt adăugate exclusiv de certbot --nginx.
#   NU adăuga listen 443 ssl fără ssl_certificate — nginx refuză să pornească!
mkdir -p /var/www/certbot
# Asigură directorul cache nginx există — proxy_cache_path din nginx-unicorn.conf necesită acest dir
mkdir -p /var/cache/nginx/unicorn 2>/dev/null || true
chown -R www-data:www-data /var/cache/nginx 2>/dev/null || true
if [ -f "$NGINX_CONF_SRC" ]; then
  # Nu suprascrie dacă certificatul SSL și blocurile ssl_certificate sunt deja active.
  # Fiecare deploy copiaza nginx-unicorn.conf (HTTP-only) din repo, distrugand blocurile
  # SSL injectate de certbot. Pastrarea config-ului existent previne ERR_CONNECTION_REFUSED.
  if [ -f "$CERT_PATH" ] && grep -q "ssl_certificate" "$NGINX_AVAILABLE" 2>/dev/null; then
    info "Config Nginx SSL existent păstrat (certificat valid + blocuri SSL prezente)"
  else
    sed "s/zeusai\.pro/${DOMAIN}/g" "$NGINX_CONF_SRC" > "$NGINX_AVAILABLE"
    fixed "Config Nginx HTTP instalat: $NGINX_AVAILABLE"
  fi
else
  # Fallback: nginx-minimal-http.conf dacă nginx-unicorn.conf lipsește
  MINIMAL_SRC="${DEPLOY_PATH}/scripts/nginx-minimal-http.conf"
  if [ -f "$MINIMAL_SRC" ]; then
    sed "s/zeusai\.pro/${DOMAIN}/g" "$MINIMAL_SRC" > "$NGINX_AVAILABLE"
    fixed "Config Nginx minimal instalat (fallback): $NGINX_AVAILABLE"
  else
    warn "Nici nginx-unicorn.conf, nici nginx-minimal-http.conf nu au fost găsite — se generează config inline"
    cat > "$NGINX_AVAILABLE" <<NGINXCONF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/certbot; default_type "text/plain"; }
    location = /health     { proxy_pass http://127.0.0.1:3000; }
    location = /api/health { proxy_pass http://127.0.0.1:3000; }
    location / { proxy_pass http://127.0.0.1:3000; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }
}
NGINXCONF
    fixed "Config Nginx inline generat: $NGINX_AVAILABLE"
  fi
fi

# Activare symlink
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
rm -f /etc/nginx/sites-enabled/default

if nginx -t 2>&1; then
  systemctl enable nginx
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    ok "Nginx reloaded"
  else
    systemctl start nginx
    fixed "Nginx pornit"
  fi
else
  warn "nginx -t a eșuat cu config curent — resetare la config HTTP minimal de siguranță"
  nginx -t 2>&1 || true
  # Fallback: folosește nginx-minimal-http.conf din repo (HTTP-only, garantat fără SSL)
  mkdir -p /var/www/certbot
  MINIMAL_SRC="${DEPLOY_PATH}/scripts/nginx-minimal-http.conf"
  if [ -f "$MINIMAL_SRC" ]; then
    cp "$MINIMAL_SRC" "$NGINX_AVAILABLE"
    fixed "Config Nginx minimal copiat din $MINIMAL_SRC"
  else
    printf 'server {\n    listen 80 default_server;\n    listen [::]:80 default_server;\n    server_name _;\n    location /.well-known/acme-challenge/ { root /var/www/certbot; }\n    location = /health { proxy_pass http://127.0.0.1:3000; }\n    location = /api/health { proxy_pass http://127.0.0.1:3000; }\n    location / { proxy_pass http://127.0.0.1:3000; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }\n}\n' > "$NGINX_AVAILABLE"
    fixed "Config Nginx inline generat: $NGINX_AVAILABLE"
  fi
  if nginx -t 2>&1; then
    systemctl enable nginx
    systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null || true
    fixed "Nginx pornit cu config fallback"
  else
    ko "nginx -t eșuat chiar și cu config minimal — verifică instalarea nginx"
    nginx -t 2>&1 || true
  fi
fi

# =============================================================================
# PAS 2 — Firewall: deschide portul 443
# =============================================================================
section "2. Firewall — deschide portul 443"

# UFW
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp  comment 'SSH'   2>/dev/null || true
  ufw allow 80/tcp  comment 'HTTP'  2>/dev/null || true
  ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
  ufw deny  3000/tcp 2>/dev/null || true
  UFW_STATUS=$(ufw status 2>/dev/null | head -1 || echo "inactive")
  if echo "$UFW_STATUS" | grep -qi "inactive"; then
    echo "y" | ufw enable
    fixed "UFW activat cu reguli 22/80/443"
  else
    ufw reload
    ok "UFW reloaded (22/80/443 permise)"
  fi
  ufw status | grep -E "^22|^80|^443" | head -6 || true
else
  warn "UFW nu este disponibil — se folosesc iptables direct"
fi

# iptables (backup, asigură că portul 443 e deschis indiferent de UFW)
iptables  -I INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
iptables  -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
ip6tables -I INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
ip6tables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
ok "iptables: porturile 80 și 443 deschise"

# Verificare că nginx ascultă pe 443 (dacă cert există deja)
if ss -tlnp | grep -q ':443'; then
  ok "Nginx ascultă deja pe portul 443 ✓"
else
  info "Portul 443 va fi activ după ce Certbot rulează cu succes"
fi

# =============================================================================
# PAS 3 — Verificare DNS (domeniu → IP server)
# =============================================================================
section "3. Verificare DNS"

SERVER_IP=$(curl -4 -fsS --max-time 8 https://ifconfig.me 2>/dev/null || \
            curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || \
            hostname -I | awk '{print $1}')
DOMAIN_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || \
            dig +short "$DOMAIN" A 2>/dev/null | head -1 || echo "")
WWW_IP=$(getent ahostsv4 "www.${DOMAIN}" 2>/dev/null | awk 'NR==1{print $1}' || echo "")

echo "  Server IP   : ${SERVER_IP}"
echo "  ${DOMAIN} → ${DOMAIN_IP:-'(nererezolvat)'}"
echo "  www.${DOMAIN} → ${WWW_IP:-'(nererezolvat)'}"

DNS_OK=false
if [ -n "$DOMAIN_IP" ] && [ "$DOMAIN_IP" = "$SERVER_IP" ]; then
  ok "DNS OK: ${DOMAIN} → ${SERVER_IP}"
  DNS_OK=true
else
  warn "DNS MISMATCH sau nererezolvat: ${DOMAIN} → '${DOMAIN_IP:-N/A}' (expected: ${SERVER_IP})"
  warn "Certbot va eșua până când DNS-ul pointează corect la acest server."
  if [ -f "$CERT_PATH" ]; then
    info "Certificat existent — se încearcă reînnoirea oricum..."
    DNS_OK=true
  fi
fi

# =============================================================================
# PAS 4 — Certbot: obține sau reînnoiește certificatul SSL
# =============================================================================
section "4. Certbot — SSL Let's Encrypt"

# Instalare Certbot dacă lipsește
if ! command -v certbot &>/dev/null; then
  info "Instalez Certbot..."
  apt-get install -y certbot python3-certbot-nginx 2>/dev/null || \
    snap install --classic certbot 2>/dev/null || true
fi

if ! command -v certbot &>/dev/null; then
  ko "Certbot nu a putut fi instalat. Instalează manual: apt-get install -y certbot python3-certbot-nginx"
  exit 1
fi

ok "Certbot disponibil: $(certbot --version 2>&1)"

if [ "$DNS_OK" = "true" ]; then
  if [ -f "$CERT_PATH" ]; then
    # Cert există — verifică că nginx are blocurile SSL; dacă nu, reinstalează certbot config
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" 2>/dev/null | cut -d= -f2 || echo "necunoscut")
    info "Certificat existent (expiră: $EXPIRY) — verificare blocuri SSL în nginx..."
    if ! grep -q "ssl_certificate" "$NGINX_AVAILABLE" 2>/dev/null; then
      # Config nginx a fost suprascris (HTTP-only) dar cert există — forțează reinstalare SSL în nginx
      warn "Blocuri SSL lipsesc din nginx (config suprascris) — reinstalare certbot → nginx..."
      certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
        --email "${ADMIN_EMAIL}" --keep-until-expiring 2>&1 && \
        fixed "Certbot: blocuri SSL reinstalate în nginx" || \
        warn "Certbot reinstall a eșuat — verificați: certbot certificates && journalctl -u nginx"
    fi
    certbot renew --nginx --non-interactive --quiet \
      --post-hook "systemctl reload nginx" 2>&1 && \
      ok "Certbot renew verificat" || \
      warn "certbot renew: nu e necesară reînnoirea sau a eșuat (>30 zile rămase)"
  else
    # Certificat nou
    info "Obțin certificat nou pentru ${DOMAIN}..."

    # Construiește lista de domenii care rezolvă la acest server
    CERT_DOMAINS="-d ${DOMAIN}"
    [ -n "$WWW_IP"  ] && [ "$WWW_IP"  = "$SERVER_IP" ] && CERT_DOMAINS="${CERT_DOMAINS} -d www.${DOMAIN}"
    API_IP=$(getent ahostsv4 "api.${DOMAIN}" 2>/dev/null | awk 'NR==1{print $1}' || echo "")
    ORCH_IP=$(getent ahostsv4 "orchestrator.${DOMAIN}" 2>/dev/null | awk 'NR==1{print $1}' || echo "")
    [ -n "$API_IP"  ] && [ "$API_IP"  = "$SERVER_IP" ] && CERT_DOMAINS="${CERT_DOMAINS} -d api.${DOMAIN}"
    [ -n "$ORCH_IP" ] && [ "$ORCH_IP" = "$SERVER_IP" ] && CERT_DOMAINS="${CERT_DOMAINS} -d orchestrator.${DOMAIN}"

    echo "  Domenii certificate: ${CERT_DOMAINS}"

    if eval certbot --nginx ${CERT_DOMAINS} \
        --non-interactive --agree-tos --email "${ADMIN_EMAIL}" \
        --redirect --keep-until-expiring; then
      fixed "Certificat SSL obținut și Nginx configurat pentru HTTPS"
    else
      warn "Certbot a eșuat — verifică logurile: journalctl -u certbot"
      # Încearcă cu doar domeniul principal dacă subdomenii cauzează probleme
      if [ "$CERT_DOMAINS" != "-d ${DOMAIN}" ]; then
        info "Reîncerc cu doar domeniul principal..."
        certbot --nginx -d "${DOMAIN}" \
          --non-interactive --agree-tos --email "${ADMIN_EMAIL}" \
          --redirect --keep-until-expiring 2>&1 && \
          fixed "Certificat SSL obținut pentru ${DOMAIN} (fără subdomenii)" || \
          ko "Certbot a eșuat complet. Verifică DNS și logurile: certbot certificates"
      fi
    fi
  fi
else
  warn "DNS nu pointează corect — Certbot sărit pentru a evita arderea rate-limit Let's Encrypt."
  info "Fixează DNS: A @ → ${SERVER_IP} și A www → ${SERVER_IP}, apoi rulează din nou setup-ssl.sh"
fi

# Reîncarcă Nginx după certbot (dacă config e valid)
if nginx -t 2>/dev/null; then
  systemctl reload nginx 2>/dev/null || true
  ok "Nginx reloaded după Certbot"
fi

# Configurare auto-renewal certbot (systemd timer sau cron)
if systemctl list-unit-files 2>/dev/null | grep -q "certbot.timer"; then
  systemctl enable certbot.timer 2>/dev/null || true
  systemctl start  certbot.timer 2>/dev/null || true
  ok "Certbot auto-renew via systemd timer activat"
else
  # Cron fallback (de 2x pe zi, recomandat de Let's Encrypt)
  (crontab -l 2>/dev/null | grep -v certbot
   echo "0 3,15 * * * certbot renew --nginx --quiet --post-hook 'systemctl reload nginx' >> /var/log/certbot-renew.log 2>&1"
  ) | crontab - 2>/dev/null || true
  ok "Certbot auto-renew via cron (de 2x/zi la 03:00 și 15:00)"
fi

# =============================================================================
# PAS 5 — Verificare HTTPS + raport final
# =============================================================================
section "5. Verificare HTTPS + Raport final"

# Verificare port 443
sleep 2
if ss -tlnp | grep -q ':443'; then
  ok "Nginx ascultă pe portul 443 ✓"
else
  warn "Portul 443 nu este activ (certbot poate nu a reușit)"
fi

# Verificare HTTPS local
HTTPS_CODE=$(curl -kfsS -o /dev/null -w "%{http_code}" \
  --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/health" \
  --max-time 8 2>/dev/null || echo "000")
HTTP_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1/health" --max-time 5 2>/dev/null || echo "000")

echo ""
echo -e "${BOLD}Status servicii:${NC}"
systemctl is-active --quiet nginx 2>/dev/null && \
  echo -e "  ${GREEN}✅ Nginx            → ACTIV${NC}" || \
  echo -e "  ${RED}❌ Nginx            → OPRIT${NC}"

if ss -tlnp | grep -q ':80'; then
  echo -e "  ${GREEN}✅ Port 80 (HTTP)   → ASCULTAT${NC}"
else
  echo -e "  ${RED}❌ Port 80 (HTTP)   → NU ascultă${NC}"
fi

if ss -tlnp | grep -q ':443'; then
  echo -e "  ${GREEN}✅ Port 443 (HTTPS) → ASCULTAT${NC}"
else
  echo -e "  ${YELLOW}⚠️  Port 443 (HTTPS) → NU ascultă${NC}"
fi

if [ -f "$CERT_PATH" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" 2>/dev/null | cut -d= -f2 || echo "necunoscut")
  echo -e "  ${GREEN}✅ SSL Certbot      → CERTIFICAT VALID (expiră: $EXPIRY)${NC}"
else
  echo -e "  ${YELLOW}⚠️  SSL Certbot      → fără certificat (HTTP only)${NC}"
fi

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "  ${GREEN}✅ Health HTTP      → 200 OK${NC}"
else
  echo -e "  ${YELLOW}⚠️  Health HTTP      → $HTTP_CODE${NC}"
fi

if [ "$HTTPS_CODE" = "200" ]; then
  echo -e "  ${GREEN}✅ Health HTTPS     → 200 OK${NC}"
else
  echo -e "  ${YELLOW}⚠️  Health HTTPS     → $HTTPS_CODE${NC}"
fi

echo ""
if [ -f "$CERT_PATH" ] && ss -tlnp | grep -q ':443'; then
  echo -e "${BOLD}${GREEN}✅ HTTPS activ! Accesează: https://${DOMAIN}${NC}"
else
  echo -e "${BOLD}${YELLOW}⚠️  HTTPS nu este complet activ. Verifică pașii de mai sus.${NC}"
  echo -e "  Rulează din nou: ${CYAN}bash ${DEPLOY_PATH}/scripts/setup-ssl.sh ${DOMAIN} ${ADMIN_EMAIL} ${DEPLOY_PATH}${NC}"
fi
echo ""
echo -e "${BLUE}Comenzi utile:${NC}"
echo "  sudo nginx -T | grep -A5 'server_name ${DOMAIN}'"
echo "  sudo ss -tulpn | grep nginx"
echo "  sudo ufw status"
echo "  sudo certbot certificates"
echo ""
