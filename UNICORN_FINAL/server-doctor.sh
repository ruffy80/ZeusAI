#!/usr/bin/env bash
# =============================================================================
# server-doctor.sh — Diagnostic complet și auto-reparare ZeusAI / Unicorn
#
# Verifică și repară automat:
#   1. Node.js — instalat și funcțional (Node 22 via NodeSource)
#   2. npm dependințe — node_modules prezent și actualizat
#   3. Fișier .env — prezent, permisiuni corecte
#   4. Directoare esențiale — logs/, data/, db/
#   5. Nginx — instalat, configurat, pornit
#   6. Firewall UFW — porturi 22/80/443/3000 deschise
#   7. PM2 — instalat și funcțional
#   8. Permisiuni fișiere critice — scripts/*.sh executabile
#   9. PM2 startup systemd — autostart la boot
#  10. PM2 restart — delete all + start ecosystem + save
#   8. Permisiuni fișiere critice — scripts/*.sh executabile
#
# Utilizare (ca root pe serverul Hetzner):
#   bash /var/www/unicorn/server-doctor.sh [DEPLOY_PATH] [DOMAIN]
#
# Exemple:
#   bash /var/www/unicorn/server-doctor.sh
#   bash /var/www/unicorn/server-doctor.sh /var/www/unicorn zeusai.pro
#
# NOTĂ: La final scriptul repornește automat PM2:
#   pm2 delete all || true
#   pm2 start ecosystem.config.js --update-env
#   pm2 save
# =============================================================================
set -euo pipefail

# ─── Parametri ───────────────────────────────────────────────────────────────
DEPLOY_PATH="${1:-/var/www/unicorn}"
DOMAIN="${2:-zeusai.pro}"
NODE_PORT="${NODE_PORT:-3000}"
LOG_DIR="${DEPLOY_PATH}/logs"
LOG_FILE="${LOG_DIR}/server-doctor-$(date +%Y%m%d-%H%M%S).log"

# ─── Culori terminal ──────────────────────────────────────────────────────────
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

ok()      { echo -e "${GREEN}✅  $1${NC}";  PASS=$((PASS+1));  }
ko()      { echo -e "${RED}❌  $1${NC}";    FAIL=$((FAIL+1));  }
fixed()   { echo -e "${CYAN}🔧  $1${NC}";  FIXED=$((FIXED+1)); }
info()    { echo -e "${BLUE}ℹ️   $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️   $1${NC}"; }
section() {
  echo ""
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${BLUE}  $1${NC}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}"
}

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}⚠️  Rulați ca root: sudo bash /var/www/unicorn/server-doctor.sh${NC}"
  exit 1
fi

echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ZeusAI / Unicorn — Server Doctor                      ║"
printf "║   %-56s║\n" "$(date '+%Y-%m-%d %H:%M:%S')  Log: $(basename "$LOG_FILE")"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Deploy path : $DEPLOY_PATH"
info "Domain      : $DOMAIN"
info "Port        : $NODE_PORT"

# =============================================================================
# SECȚIUNEA 1 — NODE.JS
# =============================================================================
section "1. Verificare Node.js"

_find_node_bin() {
  for candidate in \
    "$(command -v node 2>/dev/null || true)" \
    /usr/local/bin/node \
    /usr/bin/node \
    /root/.nvm/versions/node/*/bin/node \
    /home/*/.nvm/versions/node/*/bin/node; do
    [ -x "$candidate" ] 2>/dev/null && echo "$candidate" && return
  done
  echo ""
}

NODE_BIN="$(_find_node_bin)"
if [ -z "$NODE_BIN" ]; then
  warn "Node.js lipsește. Se instalează Node 22 via NodeSource..."
  apt-get update -qq
  apt-get install -y curl ca-certificates gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  chmod a+r /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
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

# =============================================================================
# SECȚIUNEA 2 — PM2 (verificare instalare, NU restart)
# =============================================================================
section "2. Verificare PM2"

PM2_BIN="$(command -v pm2 2>/dev/null || echo '')"
if [ -n "$PM2_BIN" ] && "$PM2_BIN" --version >/dev/null 2>&1; then
  ok "PM2 instalat și funcțional: $("$PM2_BIN" --version)"
else
  warn "PM2 lipsește sau corupt. Se instalează..."
  "$NPM_BIN" install -g pm2 2>&1 | tail -5
  PM2_BIN="$(command -v pm2 2>/dev/null || "${NODE_DIR}/pm2")"
  if "$PM2_BIN" --version >/dev/null 2>&1; then
    fixed "PM2 $("$PM2_BIN" --version) instalat"
  else
    ko "Instalare PM2 eșuată — verificați Node.js și npm"
  fi
fi

# =============================================================================
# SECȚIUNEA 3 — DIRECTOR DEPLOY ȘI STRUCTURA
# =============================================================================
section "3. Verificare director deploy și structură"

if [ ! -d "$DEPLOY_PATH" ]; then
  warn "Director $DEPLOY_PATH lipsește. Se creează..."
  mkdir -p "$DEPLOY_PATH"
  fixed "Director $DEPLOY_PATH creat"
else
  ok "Director deploy: $DEPLOY_PATH"
fi

cd "$DEPLOY_PATH"

# Directoare esențiale
for dir in logs data db backend/data; do
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    fixed "Director $dir creat"
  else
    ok "Director $dir există"
  fi
done

# ecosystem.config.js
if [ -f "ecosystem.config.js" ]; then
  ok "ecosystem.config.js prezent"
else
  ko "ecosystem.config.js LIPSĂ din $DEPLOY_PATH"
fi

# =============================================================================
# SECȚIUNEA 4 — FIȘIER .ENV
# =============================================================================
section "4. Verificare .env"

if [ -f ".env" ]; then
  chmod 600 .env
  ok ".env prezent (permisiuni 600)"
  # Afișează câteva chei critice (fără valori)
  for key in NODE_ENV PORT JWT_SECRET OPENAI_API_KEY SITE_DOMAIN; do
    if grep -q "^${key}=" .env 2>/dev/null; then
      ok "  .env: $key setat"
    else
      warn "  .env: $key LIPSĂ (poate afecta funcționarea)"
    fi
  done
else
  warn ".env lipsește din $DEPLOY_PATH"
  if [ -f "scripts/create-env.sh" ]; then
    warn "Rulați: bash scripts/create-env.sh $DEPLOY_PATH pentru a-l genera"
  fi
fi

# =============================================================================
# SECȚIUNEA 5 — NPM DEPENDINȚE
# =============================================================================
section "5. Verificare npm dependințe"

if [ -f "package.json" ]; then
  if [ -d "node_modules" ]; then
    # Verifică integritatea minimă
    MODULE_COUNT=$(find node_modules -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l || echo 0)
    if [ "$MODULE_COUNT" -gt 50 ]; then
      ok "node_modules prezent ($MODULE_COUNT module)"
    else
      warn "node_modules pare incomplet ($MODULE_COUNT module). Se rulează npm install..."
      npm ci --omit=dev --prefer-offline 2>&1 | tail -5 || npm install --omit=dev 2>&1 | tail -5
      fixed "npm install completat"
    fi
  else
    warn "node_modules lipsește. Se rulează npm install..."
    npm ci --omit=dev 2>&1 | tail -10 || npm install --omit=dev 2>&1 | tail -10
    fixed "npm install completat"
  fi
else
  warn "package.json lipsește din $DEPLOY_PATH"
fi

# Backend node_modules
if [ -f "backend/package.json" ] && [ ! -d "backend/node_modules" ]; then
  warn "backend/node_modules lipsește. Se rulează npm install în backend/..."
  (cd backend && npm ci --omit=dev 2>&1 | tail -5 || npm install --omit=dev 2>&1 | tail -5)
  fixed "backend npm install completat"
fi

# =============================================================================
# SECȚIUNEA 6 — PERMISIUNI SCRIPTURI
# =============================================================================
section "6. Permisiuni fișiere executabile"

if [ -d "scripts" ]; then
  find scripts -name "*.sh" -type f | while read -r sh_file; do
    if [ ! -x "$sh_file" ]; then
      chmod +x "$sh_file"
      fixed "chmod +x $sh_file"
    fi
  done
  ok "Toate scripturile .sh sunt executabile"
fi

# server-doctor.sh însuși
if [ -f "server-doctor.sh" ] && [ ! -x "server-doctor.sh" ]; then
  chmod +x server-doctor.sh
  fixed "chmod +x server-doctor.sh"
fi

# =============================================================================
# SECȚIUNEA 7 — NGINX
# =============================================================================
section "7. Verificare Nginx"

NGINX_CONF_SRC="${DEPLOY_PATH}/scripts/nginx-unicorn.conf"
NGINX_SITE="unicorn"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"

if ! command -v nginx >/dev/null 2>&1; then
  warn "Nginx nu este instalat. Se instalează..."
  apt-get update -qq
  apt-get install -y nginx
  fixed "Nginx instalat"
else
  ok "Nginx instalat: $(nginx -v 2>&1 | head -1)"
fi

# Asigură directorul cache nginx există — proxy_cache_path din nginx-unicorn.conf necesită acest dir
# /var/www/certbot este necesar pentru blocul location /.well-known/acme-challenge/ din nginx config
mkdir -p /var/cache/nginx/unicorn /var/www/certbot 2>/dev/null || true
chown -R www-data:www-data /var/cache/nginx 2>/dev/null || true

# Configurare site
if [ -f "$NGINX_CONF_SRC" ]; then
  # Nu suprascrie config-ul nginx dacă certificatul SSL și blocurile ssl_certificate
  # sunt deja prezente — certbot le-a adăugat și o suprascriere le-ar distruge,
  # lăsând portul 443 fără listener (ERR_CONNECTION_REFUSED pe domeniu).
  CERT_LIVE_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  if [ -f "$CERT_LIVE_PATH" ] && grep -q "ssl_certificate" "${NGINX_AVAILABLE}" 2>/dev/null; then
    info "Nginx: certificat SSL activ detectat — config existent păstrat (suprascriere HTTP-only sărită)"
  else
    cp "$NGINX_CONF_SRC" "$NGINX_AVAILABLE"
    sed -i "s|__DOMAIN__|${DOMAIN}|g; s|__PORT__|${NODE_PORT}|g; \
            s|server_name .*;|server_name ${DOMAIN} www.${DOMAIN};|g; \
            s|proxy_pass http://localhost:[0-9]*|proxy_pass http://localhost:${NODE_PORT}|g" \
      "$NGINX_AVAILABLE" 2>/dev/null || true
    fixed "Nginx: config HTTP instalat din $NGINX_CONF_SRC"
  fi
  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED" 2>/dev/null || true

  # Elimină config default care ocupă portul 80
  if [ -f /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default
    fixed "Nginx: config default eliminat"
  fi

  # Dedupe `default_server` pe portul 80: dacă alt site activat (ex. zeusai.conf
  # orphan lăsat de instalări anterioare) deține deja flag-ul `default_server`,
  # scoatem flag-ul din fișierul nostru `unicorn` ca să evităm eroarea
  # `[emerg] a duplicate default server for 0.0.0.0:80`. Nu ștergem nimic —
  # doar renunțăm la flag; configul SSL și toate blocurile server rămân intacte.
  NGINX_CANONICAL="$(readlink -f "$NGINX_ENABLED" 2>/dev/null || echo "$NGINX_ENABLED")"
  CONFLICT_FILE=""
  for other in /etc/nginx/sites-enabled/*; do
    [ -f "$other" ] || continue
    other_canonical="$(readlink -f "$other" 2>/dev/null || echo "$other")"
    [ "$other_canonical" = "$NGINX_CANONICAL" ] && continue
    if grep -qE '^[[:space:]]*listen[[:space:]]+(\[::\]:)?80[[:space:]]+default_server' "$other" 2>/dev/null; then
      CONFLICT_FILE="$other"
      break
    fi
  done
  if [ -n "$CONFLICT_FILE" ] && \
     grep -qE '^[[:space:]]*listen[[:space:]]+(\[::\]:)?80[[:space:]]+default_server' "$NGINX_AVAILABLE" 2>/dev/null; then
    if sed -i -E 's|^([[:space:]]*listen[[:space:]]+(\[::\]:)?80)[[:space:]]+default_server|\1|g' "$NGINX_AVAILABLE" 2>/dev/null; then
      fixed "Nginx: flag default_server eliminat din unicorn (deținut deja de $CONFLICT_FILE)"
    else
      warn "Nginx: nu am putut scoate default_server din $NGINX_AVAILABLE (permisiuni?) — conflictul cu $CONFLICT_FILE persistă"
    fi
  fi

  if nginx -t 2>/dev/null; then
    ok "Nginx: configurație validă"
    if systemctl is-active nginx >/dev/null 2>&1; then
      systemctl reload nginx 2>/dev/null || true
      ok "Nginx: reloaded cu noua configurație"
    else
      systemctl start nginx 2>/dev/null || true
      fixed "Nginx: pornit"
    fi
  else
    nginx -t 2>&1 || true
    ko "Nginx: configurație INVALIDĂ — se resetează la config HTTP minimal de siguranță"
    # Fallback: reinstalează config HTTP-only (fără blocuri SSL) aplicând substituțiile de domeniu
    cp "$NGINX_CONF_SRC" "$NGINX_AVAILABLE" 2>/dev/null || true
    sed -i "s|zeusai\.pro|${DOMAIN}|g; s|__DOMAIN__|${DOMAIN}|g; s|__PORT__|${NODE_PORT}|g" \
      "$NGINX_AVAILABLE" 2>/dev/null || true
    if nginx -t 2>/dev/null; then
      systemctl start nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
      fixed "Nginx: repornit cu config HTTP (SSL va fi reinstalat de setup-ssl.sh)"
    fi
  fi
else
  warn "nginx-unicorn.conf lipsește din scripts/"
fi

# Asigură că nginx pornește la boot
if command -v systemctl >/dev/null 2>&1; then
  systemctl enable nginx 2>/dev/null || true
  ok "Nginx: enabled pentru autostart"
fi

# Verifică starea finală nginx
if systemctl is-active nginx >/dev/null 2>&1; then
  ok "Nginx: activ și rulează"
else
  ko "Nginx: NU rulează — verificați: systemctl status nginx"
fi

# =============================================================================
# SECȚIUNEA 8 — FIREWALL UFW
# =============================================================================
section "8. Verificare firewall UFW"

if command -v ufw >/dev/null 2>&1; then
  # Deschide porturile critice
  ufw allow 22/tcp   2>/dev/null || true
  ufw allow 80/tcp   2>/dev/null || true
  ufw allow 443/tcp  2>/dev/null || true
  ufw allow "${NODE_PORT}/tcp" 2>/dev/null || true

  UFW_STATUS=$(ufw status 2>/dev/null | head -1 || echo "inactive")
  if echo "$UFW_STATUS" | grep -q "active"; then
    ok "UFW activ. Porturi 22/80/443/${NODE_PORT} permise."
  else
    info "UFW inactiv — porturile sunt deschise implicit"
  fi
else
  info "UFW nu este instalat — se folosesc regulile iptables implicite"
fi

# iptables fallback: asigură că porturile 80 și 443 sunt permise
if command -v iptables >/dev/null 2>&1; then
  iptables -C INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || \
    iptables -I INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
  iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
    iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
  iptables -C INPUT -p tcp --dport "${NODE_PORT}" -j ACCEPT 2>/dev/null || \
    iptables -I INPUT -p tcp --dport "${NODE_PORT}" -j ACCEPT 2>/dev/null || true
  ok "iptables: porturi 80/443/${NODE_PORT} permise"
fi

# =============================================================================
# SECȚIUNEA 9 — PM2 STARTUP SYSTEMD (pregătire, NU pornire procese)
# =============================================================================
section "9. Configurare PM2 startup systemd"

if [ -n "${SUDO_USER:-}" ] && id "$SUDO_USER" &>/dev/null; then
  RUN_USER="$SUDO_USER"
  RUN_HOME="$(eval echo ~"$SUDO_USER")"
else
  RUN_USER="root"
  RUN_HOME="/root"
fi

info "User PM2: $RUN_USER"

STARTUP_CMD=$("$PM2_BIN" startup systemd -u "$RUN_USER" --hp "$RUN_HOME" 2>/dev/null \
  | grep -E "^sudo |^env " | head -1 || true)

if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD" 2>/dev/null || true
  fixed "pm2 startup systemd configurat pentru user $RUN_USER"
else
  # Fallback: scrie fișierul de service direct
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
Environment=PM2_HOME=${RUN_HOME}/.pm2
PIDFile=${RUN_HOME}/.pm2/pm2.pid
Restart=on-failure
RestartSec=5s
ExecStart=${PM2_BIN} resurrect
ExecReload=${PM2_BIN} reload all
ExecStop=${PM2_BIN} kill

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  fixed "Fișier /etc/systemd/system/pm2-${RUN_USER}.service creat"
fi

systemctl daemon-reload
systemctl enable "pm2-${RUN_USER}.service" 2>/dev/null || true
ok "pm2-${RUN_USER}.service enabled pentru autostart la boot"

# =============================================================================
# SECȚIUNEA 10 — PM2 RESTART (delete all + start ecosystem + save)
# =============================================================================
section "10. PM2 restart — delete all + start + save"

if [ ! -f "${DEPLOY_PATH}/ecosystem.config.js" ]; then
  ko "ecosystem.config.js LIPSĂ din $DEPLOY_PATH — nu se poate porni PM2"
else
  info "Ștergere procese PM2 existente..."
  "$PM2_BIN" delete all 2>/dev/null || true
  fixed "pm2 delete all executat"

  # ── Sursă .env în shell înainte de pm2 start ─────────────────────────────
  # ecosystem.config.js citește process.env.OPENAI_API_KEY, etc. din shell-ul
  # care lansează PM2. Fără export-ul .env, toate cheile AI ar fi goale și
  # router-ul multi-provider ar rula complet ne-configurat. Sursa cu set -a
  # garantează că orice variabilă din .env devine variabilă de mediu exportată.
  if [ -f "${DEPLOY_PATH}/.env" ]; then
    info "Export .env în shell pentru pm2 start (AI keys, Stripe, SMTP etc.)..."
    set -a
    # Defense-in-depth: chiar și dacă .env conține o linie malformată (ex. o
    # valoare neghilimelată cu spațiu care declanșează "command not found"),
    # NU vrem să oprim server-doctor.sh înainte de `pm2 start` — altfel rămânem
    # fără proces unicorn pe :3000 și nginx returnează 502.
    # Dezactivăm temporar `set -e` pe durata source-ului, ca să capturăm exit-code-ul
    # fără a ucide întreg scriptul. Erorile sunt logate ca warning.
    set +e
    # shellcheck disable=SC1091
    source "${DEPLOY_PATH}/.env"
    _env_src_status=$?
    set -e
    set +a
    if [ "$_env_src_status" -ne 0 ]; then
      warn ".env source exit=$_env_src_status (linie malformată ignorată) — continui cu pm2 start"
    fi
    fixed ".env exportat ($(grep -c '^[A-Z]' "${DEPLOY_PATH}/.env" 2>/dev/null || echo '?') variabile)"
  else
    warn ".env LIPSĂ — PM2 va porni fără cheile AI/Stripe/SMTP exportate"
  fi

  info "Pornire procese din ecosystem.config.js..."
  if "$PM2_BIN" start "${DEPLOY_PATH}/ecosystem.config.js" --update-env 2>&1 | tee -a "$LOG_FILE"; then
    ok "pm2 start ecosystem.config.js --update-env — OK"
  else
    ko "pm2 start a eșuat — verificați log-ul PM2: pm2 logs"
  fi

  info "Salvare listă procese PM2..."
  "$PM2_BIN" save --force 2>/dev/null || true
  ok "pm2 save executat"
fi
section "✅ Raport final Server Doctor"

echo ""
echo -e "${BOLD}Sumar:${NC}"
echo -e "  ${GREEN}Trecut:   $PASS${NC}"
echo -e "  ${CYAN}Reparat:  $FIXED${NC}"
echo -e "  ${RED}Eșuat:    $FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✅ Server sănătos! PM2 pornit cu succes.${NC}"
else
  echo -e "${YELLOW}${BOLD}⚠️  $FAIL probleme detectate — verificați log-ul: ${LOG_FILE}${NC}"
fi

echo ""
echo -e "${BLUE}Verificați starea proceselor PM2:${NC}"
echo "  pm2 list"
echo "  pm2 logs"
echo ""
