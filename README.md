# 🦄 Zeus AI — Unicorn Platform

> **Autonomous AI-powered business platform** with ZEUS 3D avatar, quantum payments, self-healing, infinite scalability and 44-year autonomous evolution.

[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/ruffy80/ZeusAI)
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

# React frontend (optional — SSR fallback works without it)
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

## ☁️ Deploy on Vercel

1. Import the repo in [Vercel](https://vercel.com/import).
2. Set **Root Directory** → `UNICORN_FINAL`
3. Add all environment variables from `.env.example`.
4. Deploy — Vercel auto-builds the React client and deploys the Node server.

CI/CD: every push to `main` triggers `.github/workflows/vercel-deploy.yml`.

---

## 🖥️ Deploy on Hetzner

### Automated (CI/CD)
Push to `main` — the workflow `.github/workflows/vercel-deploy.yml` SSHs into Hetzner,
pulls the latest code, runs `pm2 delete all && pm2 start ecosystem.config.js`.

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
│   ├── client/              # React SPA
│   │   └── src/
│   │       ├── components/  # ZEUS3D, LuxuryClock, HolographicVoice…
│   │       └── pages/       # Home, Dashboard, Marketplace…
│   ├── src/
│   │   └── index.js         # Lightweight Node HTTP server (Vercel/SSR)
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
