# README-LIVE.md — ZeusAI / Unicorn — Live Module Registry

> Generat automat la: 2026-04-14 | Status: **LIVE**
> Domeniu: `zeusai.pro` | Server: Hetzner Cloud CX22+, Ubuntu 22.04

---

## PASUL 1 — Analiză și Plan de Luare în Stăpânire

### Structura Codebase-ului

```
ZeusAI/
├── UNICORN_FINAL/           ← Aplicația principală (Node.js + Express)
│   ├── backend/
│   │   ├── index.js         ← Serverul Express central (toate rutele)
│   │   ├── db.js            ← SQLite + in-memory fallback
│   │   ├── email.js         ← Nodemailer
│   │   └── modules/         ← 104+ module specializate
│   ├── src/
│   │   ├── index.js         ← Server HTTP simplu (SSE, /health, /snapshot)
│   │   └── site/template.js ← SPA HTML complet (1569+ linii)
│   ├── scripts/             ← Setup, deploy, health, nginx, etc.
│   └── test/                ← health.test.js, api.test.js
├── .github/workflows/       ← CI/CD: hetzner-deploy.yml, live.yml, etc.
├── docker-compose.yml       ← Docker pentru dev
├── docker-compose.prod.yml  ← Docker pentru producție (creat de agent)
└── Dockerfile               ← Build imagine Docker
```

---

## MODULELE SISTEMULUI — Status și Acțiuni

### 🔐 AUTENTIFICARE & SECURITATE

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Autentificare JWT | `backend/index.js` (routes /api/auth/*) | ✅ ACTIV | Operațional |
| RBAC / Plan Hierarchy | `backend/index.js` (requirePlan) | ✅ ACTIV | free/starter/pro/enterprise |
| Admin Token Middleware | `backend/index.js` | ✅ ACTIV | JWT admin separat |
| Rate Limiting | `express-rate-limit` (200/min global, 60/min auth) | ✅ ACTIV | Integrat |
| Sovereign Access Guardian | `modules/sovereignAccessGuardian.js` | ✅ ACTIV | Protecție acces suveran |
| Quantum Security Layer | `modules/QuantumSecurityLayer.js` | ✅ ACTIV | Strat securitate cuantică |
| Quantum Integrity Shield | `modules/quantumIntegrityShield.js` | ✅ ACTIV | Integritate sistem |
| Quantum Vault | `modules/quantumVault.js` | ✅ ACTIV | Vault criptare |
| Legal Fortress | `modules/legalFortress.js` | ✅ ACTIV | Protecție legală |
| Security Scanner | `modules/security-scanner.js` | ✅ ACTIV | Scanare securitate |
| CSP Headers | `backend/index.js` | ✅ ACTIV | Content Security Policy |

### 💳 PLĂȚI & FACTURARE

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Payment Gateway | `modules/paymentGateway.js` | ✅ ACTIV | Stripe + PayPal + BTC |
| Payment Systems | `modules/paymentSystems.js` | ✅ ACTIV | Procesare multi-provider |
| Quantum Payment Nexus | `modules/quantumPaymentNexus.js` | ✅ ACTIV | Plăți cuantice |
| Stripe Integration | `backend/index.js` (/api/payment/*) | ✅ ACTIV | Webhook + checkout |
| Credit System | `modules/creditSystem.js` | ✅ ACTIV | Credite utilizator |
| Subscription Plans | `backend/index.js` | ✅ ACTIV | free/starter/pro/enterprise |
| Revenue Modules | `modules/revenueModules.js` | ✅ ACTIV | Motor venituri |

### 📧 NOTIFICĂRI & COMUNICARE

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Email (Nodemailer) | `backend/email.js` | ✅ ACTIV | SMTP configurat |
| Social Media Viralizer | `modules/socialMediaViralizer.js` | ✅ ACTIV | Twitter/X, Meta, YouTube |
| Sentiment Analysis | `modules/sentiment-analysis-engine.js` | ✅ ACTIV | NLP sentiment |
| Auto Marketing | `modules/auto-marketing.js` | ✅ ACTIV | Marketing automat |

### 📊 DASHBOARD & RAPORTĂRI

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Dashboard UI | `src/site/template.js` | ✅ ACTIV | SPA full-featured |
| Executive Dashboard | `modules/executiveDashboard.js` | ✅ ACTIV | Metrici executive |
| Analytics | `modules/analytics.js` | ✅ ACTIV | Analitics business |
| Self Documenter | `modules/self-documenter.js` | ✅ ACTIV | Auto-documentare |
| Profit Attribution | `modules/profit-attribution.js` | ✅ ACTIV | Atribuire profit |
| SLO Tracker | `modules/slo-tracker.js` | ✅ ACTIV | Urmărire SLO |

### 🌐 API PUBLIC & ADMINISTRARE

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Public API | `backend/index.js` (/api/*) | ✅ ACTIV | 100+ endpoints |
| Admin Panel | `backend/index.js` (/api/admin/*) | ✅ ACTIV | CRUD utilizatori/planuri |
| GitHub Ops | `modules/github-ops.js` | ✅ ACTIV | Git ops autonome |
| Configuration Manager | `modules/configurationManager.js` | ✅ ACTIV | Config dinamică |
| Domain Automation | `modules/domainAutomationManager.js` | ✅ ACTIV | DNS/domenii auto |

### 📁 FIȘIERE & STOCARE

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| SQLite Database | `backend/db.js` | ✅ ACTIV | users, sessions, workflows, tenants |
| Quantum Resistant BaaS | `modules/quantumResistantBaaS.js` | ✅ ACTIV | Backup as a service |

### ⚙️ PROCESARE ASINCRONĂ & SCHEDULER

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Workflow Engine | `modules/workflowEngine.js` | ✅ ACTIV | Automatizare workflows |
| Node-cron scheduler | `node-cron` (în backend/index.js) | ✅ ACTIV | Jobs periodice |
| Auto Deploy | `modules/autoDeploy.js` | ✅ ACTIV | Deploy automat |
| Llama Bridge | `modules/llamaBridge.js` | ✅ ACTIV | Queue prioritizată AI |

### 📈 LOGGING & MONITORIZARE

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Health Guardian | `scripts/health-guardian.js` | ✅ ACTIV | Monitorizare continuă |
| Performance Monitor | `modules/performance-monitor.js` | ✅ ACTIV | Metrici performanță |
| Healer Script | `scripts/healer.sh` | ✅ CREAT | Systemd + 30s interval |
| System Shield | `scripts/system-shield.js` | ✅ ACTIV | Shield PM2:3099 |
| Predictive Healing | `modules/predictive-healing.js` | ✅ ACTIV | Self-healing predictiv |
| Quantum Healing | `modules/quantum-healing.js` | ✅ ACTIV | Healing cuantic |
| Total System Healer | `modules/totalSystemHealer.js` | ✅ ACTIV | Healer total |
| Disaster Recovery | `modules/disaster-recovery.js` | ✅ ACTIV | Recuperare dezastre |

### 🧪 A/B TESTING & FEATURE FLAGS

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| AB Testing Engine | `modules/ab-testing.js` | ✅ ACTIV | Variante + trafic split |
| Canary Controller | `modules/canary-controller.js` | ✅ ACTIV | Canary deployments |
| Shadow Tester | `modules/shadow-tester.js` | ✅ ACTIV | Shadow testing |

### 🤖 ML & AI

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Universal AI Connector | `modules/universalAIConnector.js` | ✅ ACTIV | DeepSeek→Claude→Gemini→OpenAI |
| AI Providers | `modules/aiProviders.js` | ✅ ACTIV | Cascade fallback 7 provideri |
| AI CFO Agent | `modules/ai-cfo-agent.js` | ✅ ACTIV | CFO autonom |
| AI Sales Closer | `modules/ai-sales-closer.js` | ✅ ACTIV | Sales AI |
| AI Product Generator | `modules/ai-product-generator.js` | ✅ ACTIV | Generare produse AI |
| AGI Self-Evolution | `backend/generated/AGISelf-EvolutionEngine.js` | ✅ ACTIV | Auto-evoluție |
| Quantum ML Core | `backend/generated/QuantumMachineLearningCore.js` | ✅ ACTIV | ML cuantic |

### 🎫 TICKETING & WEBHOOKS

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Auto Innovation Loop | `modules/auto-innovation-loop.js` | ✅ ACTIV | Inovare automată |
| Autonomous Innovation | `modules/autonomousInnovation.js` | ✅ ACTIV | Ciclu inovare |
| Control Plane Agent | `modules/control-plane-agent.js` | ✅ ACTIV | Orchestrare control |
| Profit Control Loop | `modules/profit-control-loop.js` | ✅ ACTIV | Loop profit autonom |

### 🏢 ENTERPRISE & WHITE-LABEL

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| White Label Engine | `modules/whiteLabelEngine.js` | ✅ ACTIV | Multi-tenant white-label |
| Enterprise Partnership | `modules/enterprisePartnership.js` | ✅ ACTIV | Parteneriate enterprise |
| Referral Engine | `modules/referralEngine.js` | ✅ ACTIV | Sistem referral |
| Customer Health | `modules/customerHealth.js` | ✅ ACTIV | Sănătate client |

### 🌍 DOMENII SPECIALIZATE

| Modul | Fișier | Status | Acțiune |
|-------|--------|--------|---------|
| Carbon Exchange | `modules/carbonExchange.js` | ✅ ACTIV | Piata carbon |
| Energy Grid | `modules/energyGrid.js` | ✅ ACTIV | Rețea energie |
| Aviation Module | `modules/aviationModule.js` | ✅ ACTIV | Aviație |
| Defense Module | `modules/defenseModule.js` | ✅ ACTIV | Apărare |
| Government Module | `modules/governmentModule.js` | ✅ ACTIV | Guvernamental |
| Telecom Module | `modules/telecomModule.js` | ✅ ACTIV | Telecomunicații |
| Global Digital Standard | `modules/globalDigitalStandard.js` | ✅ ACTIV | Standard digital global |

---

## PASUL 2 — Infrastructură Hetzner

### Cerințe secrete GitHub (trebuie setate manual în repository Settings → Secrets):

| Secret | Descriere | Obligatoriu |
|--------|-----------|-------------|
| `HETZNER_API_TOKEN` | Token API Hetzner Cloud | ✅ DA |
| `HETZNER_SSH_PRIVATE_KEY` | Cheie SSH privată pentru VPS | ✅ DA |
| `HETZNER_SERVER_IP` | IP-ul serverului Hetzner (după creare) | ✅ DA |
| `SITE_DOMAIN` | Domeniu (ex: zeusai.pro) | ✅ DA |
| `JWT_SECRET` | Secret JWT | ✅ DA |
| `ADMIN_MASTER_PASSWORD` | Parola admin | ✅ DA |
| `STRIPE_SECRET_KEY` | Stripe key | Recomandat |
| `OPENAI_API_KEY` | OpenAI key | Recomandat |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | SMTP email | Recomandat |
| `WEBHOOK_URL` | URL webhook notificări healer | Opțional |

### Provision VPS (script automat):
```bash
# Din UNICORN_FINAL/scripts/setup-hetzner-auto.js
npm run hetzner:setup
# sau manual via Hetzner Cloud Console:
# - Tip: CX22 sau mai mare
# - OS: Ubuntu 22.04
# - Regiune: eu-central (Nuremberg recomandat)
# - SSH Key: adaugă cheia publică corespunzătoare HETZNER_SSH_PRIVATE_KEY
```

### Stivă software pe VPS:
- Docker + Docker Compose v2
- Nginx (reverse proxy, rate limiting, SSL)
- Certbot (Let's Encrypt SSL)
- Prometheus + Grafana (monitorizare)
- Healer systemd service (auto-vindecare la 30s)

---

## PASUL 3 — CI/CD

Workflow-ul `.github/workflows/live.yml` face la fiecare push pe `main`:
1. ✅ Lint (`node --check`)
2. ✅ Teste (`npm test`)
3. ✅ Build imagine Docker → push la GHCR
4. ✅ SSH pe VPS Hetzner → `docker-compose -f docker-compose.prod.yml up -d`
5. ✅ Health check 2 minute → rollback automat la eșec
6. ✅ Tag `v1.0.0-live` la deploy reușit

---

## PASUL 4 — Auto-Vindecare

Script: `UNICORN_FINAL/scripts/healer.sh`
Service: `UNICORN_FINAL/scripts/healer.service`

Logică:
- Verifică `/health` la fiecare **30 secunde**
- Dacă eșuează → `docker restart unicorn-app`
- Dacă eșuează de **3× în 5 minute** → `docker-compose down && docker-compose up -d`
- Loghează în `/var/log/healer.log`
- Trimite webhook (dacă `WEBHOOK_URL` e setat)

---

## PASUL 5 — Auto-Inovare

Workflow: `.github/workflows/innovation-loop.yml`
- Rulează **săptămânal** (Luni 03:00 UTC)
- Generează 3 variante A/B (preț, layout, text)
- Testează 10% trafic 24h
- Promovează varianta câștigătoare
- Arhivează celelalte

---

## PASUL 6 — Certificate Live

Vezi: `LIVE-CERTIFICATE.md` (generat automat la deploy reușit)

---

*Generat de ZeusAI Copilot Agent — 2026-04-14*
