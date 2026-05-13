#!/usr/bin/env bash
# =============================================================================
# bootstrap-hetzner.sh — Bootstrap complet server Hetzner pentru Docker stack
#
# Rulat automat via SSH de workflow-ul live.yml la primul deploy.
# Instalează: Docker, Docker Compose v2, Nginx, Certbot, node-exporter.
# Configurează: firewall UFW, structuri directoare, healer systemd timer.
#
# Utilizare:
#   bash bootstrap-hetzner.sh [DOMAIN] [ADMIN_EMAIL] [DEPLOY_PATH]
# =============================================================================
set -euo pipefail

DOMAIN="${1:-${SITE_DOMAIN:-zeusai.pro}}"
ADMIN_EMAIL="${2:-admin@${DOMAIN}}"
DEPLOY_PATH="${3:-/var/www/unicorn}"

ok()   { echo "✅  $1"; }
info() { echo "ℹ️   $1"; }
step() { echo -e "\n══════════════════════════════════════════════"; echo "  $1"; echo "══════════════════════════════════════════════"; }

if [ "$EUID" -ne 0 ]; then
  echo "❌ Rulați ca root: sudo bash bootstrap-hetzner.sh"
  exit 1
fi

step "1. Actualizare sistem"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git unzip ufw ca-certificates gnupg lsb-release

step "2. Instalare Docker"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | bash
  systemctl enable --now docker
  ok "Docker instalat: $(docker --version)"
else
  ok "Docker deja instalat: $(docker --version)"
fi

# Docker Compose v2 (plugin)
if ! docker compose version &>/dev/null; then
  apt-get install -y docker-compose-plugin
  ok "Docker Compose v2 instalat"
else
  ok "Docker Compose: $(docker compose version)"
fi

step "3. Instalare Nginx + Certbot"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
ok "Nginx instalat: $(nginx -v 2>&1)"

step "4. Instalare node-exporter (Prometheus)"
if ! command -v node_exporter &>/dev/null; then
  NODE_EXPORTER_VER="1.8.2"
  wget -qO /tmp/node_exporter.tar.gz \
    "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VER}/node_exporter-${NODE_EXPORTER_VER}.linux-amd64.tar.gz"
  tar -xzf /tmp/node_exporter.tar.gz -C /tmp/
  cp "/tmp/node_exporter-${NODE_EXPORTER_VER}.linux-amd64/node_exporter" /usr/local/bin/
  chmod +x /usr/local/bin/node_exporter

  cat > /etc/systemd/system/node_exporter.service << 'EOF'
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/node_exporter --web.listen-address=:9100
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now node_exporter
  ok "node_exporter instalat și pornit"
fi

step "5. Configurare Firewall UFW"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
# Portul 3000 (app) accesibil doar local — nginx face proxy
ufw deny 3000/tcp  comment "App - local only"
# Prometheus și Grafana - local only
ufw deny 9090/tcp  comment "Prometheus - local only"
ufw deny 9100/tcp  comment "NodeExporter - local only"
ufw deny 3001/tcp  comment "Grafana - local only"
ufw --force enable
ok "Firewall configurat (22/80/443 deschise)"

step "6. Creare structuri directoare"
mkdir -p "${DEPLOY_PATH}"/{data,logs,scripts,monitoring,backup}
chmod 750 "${DEPLOY_PATH}"
ok "Directoare create în ${DEPLOY_PATH}"

step "7. SSL cu Certbot (Let's Encrypt)"
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  info "Obțin certificat SSL pentru ${DOMAIN}..."
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "${ADMIN_EMAIL}" \
    --redirect 2>/dev/null || info "SSL: va fi configurat manual sau la primul request"
else
  ok "SSL deja configurat pentru ${DOMAIN}"
fi

# Auto-renewal certbot
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

step "8. Healer systemd timer"
if [ -f "/etc/systemd/system/healer.service" ] && [ -f "/etc/systemd/system/healer.timer" ]; then
  chmod +x /usr/local/bin/healer.sh 2>/dev/null || true
  systemctl daemon-reload
  systemctl enable --now healer.timer
  ok "Healer timer activat (30s interval)"
else
  info "Fișierele healer.service/timer vor fi copiate la deploy (live.yml)"
fi

step "9. Creare /etc/environment pentru deploy"
cat >> /etc/environment << EOF
DEPLOY_PATH=${DEPLOY_PATH}
SITE_DOMAIN=${DOMAIN}
EOF

ok "Bootstrap complet pe $(hostname) — $(date)"
echo ""
echo "════════════════════════════════════════════"
echo "  NEXT STEPS:"
echo "  1. Setează GitHub Secret: HETZNER_SERVER_IP=$(curl -s ifconfig.me)"
echo "  2. Push pe main branch → live.yml face deploy automat"
echo "  3. Verifică: curl http://$(curl -s ifconfig.me):3000/health"
echo "════════════════════════════════════════════"
