#!/usr/bin/env bash
# =============================================================================
# UNICORN — PRODUCTION VERIFICATION SCRIPT
# Verifică toate componentele din "Checklist de verificare finală":
#   1. GitHub / structura repo
#   2. Software instalat (Node, PM2, Nginx, Certbot, Git, UFW, Fail2ban)
#   3. Nginx + SSL + DNS
#   4. Procese PM2 și autopornire
#   5. Funcționalitate live (health endpoints)
#
# Utilizare:
#   bash UNICORN_FINAL/scripts/production-verify.sh
#   bash UNICORN_FINAL/scripts/production-verify.sh --fix   (încearcă auto-repair)
# =============================================================================
set -euo pipefail

SITE_DOMAIN="${SITE_DOMAIN:-zeusai.pro}"
BACKEND_PORT="${PORT:-3000}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FIX_MODE=false
[[ "${1:-}" == "--fix" ]] && FIX_MODE=true

PASS=0; WARN=0; FAIL=0

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✅ $*${NC}"; ((PASS++)); }
warn() { echo -e "  ${YELLOW}⚠️  $*${NC}"; ((WARN++)); }
fail() { echo -e "  ${RED}❌ $*${NC}"; ((FAIL++)); }

section() { echo ""; echo -e "${YELLOW}── $* ────────────────────────────────────${NC}"; }

# ─────────────────────────────────────────────────────────────────
section "1. STRUCTURĂ REPO"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
check_file() { [[ -f "$ROOT_DIR/$1" ]] && ok "$1 exists" || fail "$1 MISSING"; }
check_dir()  { [[ -d "$ROOT_DIR/$1" ]] && ok "$1/ exists" || fail "$1/ MISSING"; }

check_dir  "backend"
check_dir  "backend/modules"
check_dir  "src"
check_dir  "client"
check_dir  "scripts"
check_dir  "test"
check_file "backend/index.js"
check_file "src/index.js"
check_file "package.json"
check_file "ecosystem.config.js"
check_file "autonomous-orchestrator.js"
check_file "scripts/unicorn-shield.js"
check_file "scripts/unicorn-health-daemon.js"
check_file "scripts/unicorn-main-orchestrator.js"
check_file "scripts/health-guardian.js"
check_file "scripts/system-shield.js"
check_file "scripts/nginx-unicorn.conf"
check_file "scripts/deploy-final.sh"
check_file "scripts/rollback-last-backup.sh"

# ─────────────────────────────────────────────────────────────────
section "2. SOFTWARE INSTALAT"

cmd_ok() {
  if command -v "$1" &>/dev/null; then
    ok "$1 installed ($(command -v "$1"))"
  else
    fail "$1 NOT installed"
  fi
}

cmd_ok node
cmd_ok npm
cmd_ok pm2
cmd_ok nginx
cmd_ok certbot
cmd_ok git
cmd_ok ufw

# Fail2ban: poate fi fie în PATH fie ca serviciu
if command -v fail2ban-server &>/dev/null || systemctl is-active --quiet fail2ban 2>/dev/null; then
  ok "fail2ban active"
else
  warn "fail2ban not found / not running (recomandat pentru producție)"
fi

# Node version check (minim 18)
NODE_VER=$(node -e "process.stdout.write(process.versions.node)" 2>/dev/null || echo "0.0.0")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [[ "$NODE_MAJOR" -ge 18 ]]; then
  ok "Node.js v${NODE_VER} (>= 18)"
else
  fail "Node.js v${NODE_VER} prea vechi (necesită >= 18)"
fi

# ─────────────────────────────────────────────────────────────────
section "3. NGINX + SSL + DNS"

# Nginx config
if nginx -t 2>/dev/null; then
  ok "nginx config valid"
else
  fail "nginx config INVALID (rulează: nginx -t)"
fi

# Nginx service
if systemctl is-active --quiet nginx 2>/dev/null; then
  ok "nginx service running"
else
  if "$FIX_MODE"; then
    warn "nginx nu rulează — încerc pornire..."
    systemctl start nginx && ok "nginx pornit cu succes" || fail "nginx nu a putut fi pornit"
  else
    fail "nginx service NOT running (systemctl start nginx)"
  fi
fi

# Nginx enabled at boot
if systemctl is-enabled --quiet nginx 2>/dev/null; then
  ok "nginx enabled at boot"
else
  warn "nginx NOT enabled at boot (systemctl enable nginx)"
fi

# SSL certificate check
if [[ -d "/etc/letsencrypt/live/${SITE_DOMAIN}" ]]; then
  CERT_FILE="/etc/letsencrypt/live/${SITE_DOMAIN}/fullchain.pem"
  if [[ -f "$CERT_FILE" ]]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
    DAYS_LEFT=$(( ( $(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null || echo 0) - $(date +%s) ) / 86400 ))
    if [[ "$DAYS_LEFT" -gt 14 ]]; then
      ok "SSL cert valid, expiră în ${DAYS_LEFT} zile"
    elif [[ "$DAYS_LEFT" -gt 0 ]]; then
      warn "SSL cert expiră în ${DAYS_LEFT} zile — reînnoire necesară curând"
    else
      fail "SSL cert EXPIRAT ($EXPIRY)"
    fi
  else
    fail "SSL cert fullchain.pem lipsă în /etc/letsencrypt/live/${SITE_DOMAIN}/"
  fi
else
  fail "SSL cert NOT found pentru ${SITE_DOMAIN} (rulează: certbot --nginx -d ${SITE_DOMAIN} -d www.${SITE_DOMAIN})"
fi

# Certbot auto-renew timer
if systemctl is-active --quiet certbot.timer 2>/dev/null || crontab -l 2>/dev/null | grep -q certbot; then
  ok "certbot auto-renew activ"
else
  warn "certbot auto-renew timer inactiv (systemctl enable --now certbot.timer)"
fi

# DNS resolution
if host "$SITE_DOMAIN" &>/dev/null 2>&1; then
  DNS_IP=$(host "$SITE_DOMAIN" 2>/dev/null | grep "has address" | head -1 | awk '{print $NF}')
  SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "?")
  if [[ "$DNS_IP" == "$SERVER_IP" ]]; then
    ok "DNS ${SITE_DOMAIN} → ${DNS_IP} (matches server IP)"
  else
    warn "DNS ${SITE_DOMAIN} → ${DNS_IP} (server IP: ${SERVER_IP}) — poate fi CDN/proxy"
  fi
else
  warn "DNS lookup eșuat pentru ${SITE_DOMAIN} (verifică manual)"
fi

# ─────────────────────────────────────────────────────────────────
section "4. PROCESE PM2"

PM2_STATUS=$(pm2 jlist 2>/dev/null || echo "[]")

check_pm2() {
  local name="$1"
  local status
  status=$(echo "$PM2_STATUS" | node -e "
    const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const p=d.find(x=>x.name==='$name');
    process.stdout.write(p ? p.pm2_env.status : 'not_found');
  " 2>/dev/null || echo "error")
  if [[ "$status" == "online" ]]; then
    ok "PM2: $name → online"
  elif [[ "$status" == "not_found" ]]; then
    if "$FIX_MODE"; then
      warn "PM2: $name nu există — încerc startOrRestart..."
      pm2 startOrRestart "$ROOT_DIR/ecosystem.config.js" --only "$name" 2>/dev/null \
        && ok "PM2: $name pornit" || fail "PM2: $name nu a putut fi pornit"
    else
      fail "PM2: $name NOT FOUND (pm2 start ecosystem.config.js --only $name)"
    fi
  else
    if "$FIX_MODE"; then
      warn "PM2: $name → $status — încerc restart..."
      pm2 restart "$name" 2>/dev/null && ok "PM2: $name restartat" || fail "PM2: $name restart eșuat"
    else
      fail "PM2: $name → $status (necesită restart)"
    fi
  fi
}

check_pm2 "unicorn"
check_pm2 "unicorn-orchestrator"
check_pm2 "unicorn-main-orchestrator"
check_pm2 "unicorn-shield"
check_pm2 "unicorn-health-daemon"
check_pm2 "unicorn-health-guardian"
check_pm2 "unicorn-quantum-watchdog"
check_pm2 "unicorn-platform-connector"
check_pm2 "unicorn-system-shield"
check_pm2 "unicorn-uaic"
check_pm2 "unicorn-innovation-agent"

# PM2 startup config saved
if pm2 save --dry-run &>/dev/null 2>&1 || pm2 list &>/dev/null 2>&1; then
  DUMP_FILE="$HOME/.pm2/dump.pm2"
  if [[ -f "$DUMP_FILE" ]]; then
    ok "PM2 dump saved (startup config exists)"
  else
    warn "PM2 dump lipsă (rulează: pm2 save)"
  fi
fi

# ─────────────────────────────────────────────────────────────────
section "5. FUNCȚIONALITATE LIVE"

http_check() {
  local url="$1"; local expected_code="${2:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expected_code" ]]; then
    ok "HTTP $code ← $url"
  else
    fail "HTTP $code ← $url (așteptat $expected_code)"
  fi
}

# Backend health (local)
http_check "${BACKEND_URL}/health"
http_check "${BACKEND_URL}/api/health"

# Verify health response has ok:true
HEALTH_JSON=$(curl -s --max-time 10 "${BACKEND_URL}/api/health" 2>/dev/null || echo "{}")
if echo "$HEALTH_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.exit(d.health&&d.health.ok?0:1);" 2>/dev/null; then
  ok "Backend /api/health returns {health:{ok:true}}"
else
  warn "Backend /api/health response format unexpected"
fi

# New production/status endpoint (requires admin token from env)
if [[ -n "${ADMIN_TOKEN:-}" ]]; then
  PROD_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" "${BACKEND_URL}/api/production/status" 2>/dev/null || echo "000")
  [[ "$PROD_CODE" == "200" ]] && ok "Production status endpoint responsive (200)" \
    || warn "Production status endpoint → $PROD_CODE (ADMIN_TOKEN set?)"
fi

# HTTPS live check
http_check "https://${SITE_DOMAIN}/"
http_check "https://api.${SITE_DOMAIN}/api/health"
http_check "https://www.${SITE_DOMAIN}/" "301"

# Orchestrator notify endpoint
NOTIFY_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -X POST -H "Content-Type: application/json" \
  -d '{"source":"production-verify","level":"info","message":"verify script check"}' \
  "${BACKEND_URL}/api/orchestrator/notify" 2>/dev/null || echo "000")
[[ "$NOTIFY_CODE" == "200" ]] \
  && ok "POST /api/orchestrator/notify → 200" \
  || fail "POST /api/orchestrator/notify → $NOTIFY_CODE (endpoint lipsă?)"

# Health daemon report endpoint
REPORT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -X POST -H "Content-Type: application/json" \
  -d '{"cycle":0,"overall":"healthy","issues":[]}' \
  "${BACKEND_URL}/api/health-daemon/report" 2>/dev/null || echo "000")
[[ "$REPORT_CODE" == "200" ]] \
  && ok "POST /api/health-daemon/report → 200" \
  || fail "POST /api/health-daemon/report → $REPORT_CODE (endpoint lipsă?)"

# Quantum integrity status
QIS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  "${BACKEND_URL}/api/quantum-integrity/status" 2>/dev/null || echo "000")
[[ "$QIS_CODE" == "200" ]] && ok "GET /api/quantum-integrity/status → 200" \
  || fail "GET /api/quantum-integrity/status → $QIS_CODE"

# ─────────────────────────────────────────────────────────────────
section "SUMAR FINAL"

TOTAL=$((PASS + WARN + FAIL))
echo ""
echo -e "  Verificări totale: ${TOTAL}"
echo -e "  ${GREEN}✅ PASS: ${PASS}${NC}"
echo -e "  ${YELLOW}⚠️  WARN: ${WARN}${NC}"
echo -e "  ${RED}❌ FAIL: ${FAIL}${NC}"
echo ""

if [[ "$FAIL" -eq 0 ]] && [[ "$WARN" -le 3 ]]; then
  echo -e "${GREEN}🟢 PRODUCTION LIVE — toate verificările critice au trecut.${NC}"
  exit 0
elif [[ "$FAIL" -eq 0 ]]; then
  echo -e "${YELLOW}🟡 PRODUCȚIE OK cu avertismente — verifică WARN-urile de mai sus.${NC}"
  exit 0
else
  echo -e "${RED}🔴 PRODUCȚIE DEGRADATĂ — ${FAIL} verificări au eșuat. Repară și rulează din nou.${NC}"
  if ! "$FIX_MODE"; then
    echo -e "  Sfat: rulează cu --fix pentru auto-repair: bash $0 --fix"
  fi
  exit 1
fi
