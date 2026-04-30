# 🦄 Zeus AI — Unicorn Platform

> **Autonomous AI-powered business platform** with ZeusAI commerce, BTC-first checkout, live service marketplace, self-healing APIs and Hetzner/PM2 production deployment.

[![Hetzner Live](https://img.shields.io/badge/deploy-Hetzner-blue.svg)](./README-LIVE.md)
[![License](https://img.shields.io/badge/license-Proprietary-gold.svg)](./SECURITY.md)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 9+
- Docker & Docker Compose (optional)
- PM2 (for Hetzner production)

### 1. Clone & install
```bash
git clone https://github.com/ruffy80/ZeusAI.git
cd ZeusAI
cp .env.example .env
# Edit .env with your real keys
```

### 2. Install dependencies
```bash
# Main platform
cd UNICORN_FINAL && npm install

# Optional React client build; live site is served by UNICORN_FINAL/src/index.js
cd client && npm install && npm run build && cd ..
```

### 3. Run locally
```bash
# From repo root
npm start
# or
cd UNICORN_FINAL && npm start
```

The platform starts at **http://localhost:3000**.

### 4. Validate current live contracts
```bash
cd UNICORN_FINAL
npm run lint
npm test
```

Key public contracts used by the live site:
- `/health`, `/snapshot`, `/stream`
- `/api/catalog` and `/api/catalog/master` for the 100+ service marketplace
- `/api/payment/btc-rate`, `/api/btc/rate`, `/api/payment/methods`
- `/api/payments/config/status` for BTC-primary and optional provider readiness

---

## 🐳 Docker

```bash
# Copy env file
cp .env.example .env   # fill in your secrets

# Start all services (backend + nginx + certbot)
docker compose up -d

# Logs
docker compose logs -f unicorn
```

---

## 💳 Payments

Production is **BTC-first**: revenue routes directly to the owner wallet configured by `BTC_WALLET_ADDRESS` or `OWNER_BTC_ADDRESS`. The site exposes the wallet in the UI from runtime env/config and refreshes it from `/api/payment/btc-rate`.

Optional rails are shown only when configured in runtime env:
- Stripe/Card: `STRIPE_SECRET_KEY`
- PayPal: `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`
- NOWPayments: `NOWPAYMENTS_API_KEY` + `NOWPAYMENTS_IPN_SECRET`

---

## 🖥️ Deploy on Hetzner

### Automated (CI/CD)
Push to `main` — `.github/workflows/hetzner-deploy.yml` validates `UNICORN_FINAL`, SSHs into Hetzner, pulls the latest code and reloads PM2.

The broader live bootstrap flow is `.github/workflows/live.yml` for scheduled/manual SSL, health and deployment checks.

### Manual
```bash
node UNICORN_FINAL/scripts/setup-hetzner-auto.js
```
This script:
- Installs Docker, Node.js 20, Nginx, Certbot
- Clones the repository to `/opt/unicorn`
- Builds the React frontend
- Configures Nginx reverse proxy → port 3000
- Obtains SSL certificate via Certbot
- Starts the platform as a `systemd` service

---

## 📦 Project Structure

```
ZeusAI/
├── UNICORN_FINAL/           # Main application
│   ├── backend/             # Express API server
│   │   ├── index.js         # 50+ API endpoints
│   │   ├── db.js            # SQLite database layer
│   │   └── modules/         # 60+ autonomous modules
│   ├── client/              # Optional React SPA/build assets
│   │   └── src/
│   │       ├── components/  # ZEUS3D, LuxuryClock, HolographicVoice…
│   │       └── pages/       # Home, Dashboard, Marketplace…
│   ├── src/
│   │   ├── index.js         # Live Node HTTP server (site + local APIs)
│   │   └── site/template.js # Legacy inline UI template compatibility
│   ├── scripts/             # Hetzner, DNS, GitHub setup scripts
│   ├── test/                # Health + API tests
│   └── package.json
├── .github/workflows/       # CI/CD pipelines
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 🤖 Autonomous Features

| Feature | Module |
|---|---|
| Auto-innovation every 6h | `unicornEternalEngine.js` |
| Self-healing & monitoring | `totalSystemHealer.js` |
| Infinite scalability | `quantumResilienceCore.js` |
| Auto-deploy on change | `autoDeploy.js` |
| Self-construction of missing modules | `selfConstruction.js` |
| BTC payments (fixed address) | `quantumPaymentNexus.js` |
| Legal fortress & watermark | `legalFortress.js` |
| DNS automation (Sav.com) | `domainAutomationManager.js` |

---

## 💰 Bitcoin Payments

All BTC payments are routed to the fixed address:

```
bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
```

---

## 🧪 Tests

```bash
cd UNICORN_FINAL
npm test        # 26 automated tests
npm run lint    # syntax check
```

---

## 📜 Scripts

```bash
npm run start      # Start the platform
npm run build      # Lint + test
npm run deploy     # Full deploy sequence
npm run heal       # Run health guardian
npm run evolve     # Run innovation sprint
```

---

## 🔐 Security

- JWT authentication (users + admin)
- RBAC plan enforcement (free/starter/pro/enterprise)
- Rate limiting (200 req/min global, 60 req/min admin)
- Content Security Policy headers
- Input sanitization + email validation
- Admin sessions persisted in SQLite

---

## 🌐 Supported Languages

Romanian · English · French · Spanish · German · Italian · Portuguese

---

## 📄 License

Proprietary — © Vladoi Ionut 2024–2026. All rights reserved.
See [SECURITY.md](./SECURITY.md) for vulnerability reporting.
