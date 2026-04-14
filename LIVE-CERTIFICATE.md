# LIVE-CERTIFICATE.md — ZeusAI / Unicorn

> **TEMPLATE FILE** — Variabilele `${...}` sunt înlocuite automat de workflow-ul
> `.github/workflows/live.yml` (job `tag-and-certify`) la fiecare deploy reușit.
> Nu edita manual — acest fișier este suprascris la fiecare deployment.
>
> Ultima actualizare: ${DEPLOY_DATE}

---

## 🟢 STATUS: LIVE

| Proprietate | Valoare |
|-------------|---------|
| **URL Live** | https://${SITE_DOMAIN} |
| **IP Server** | ${HETZNER_SERVER_IP} |
| **Data confirmare** | ${DEPLOY_DATE} |
| **Versiune tag** | ${DEPLOY_TAG} |
| **SHA commit** | ${GITHUB_SHA} |
| **Workflow Run** | ${GITHUB_RUN_URL} |

---

## Module Active (verificate la deploy)

| Modul | Port/Endpoint | Status |
|-------|---------------|--------|
| Backend API (Express) | :3000 /health | ✅ UP |
| Frontend SPA | :3000 / | ✅ UP |
| Health Endpoint | :3000 /health | ✅ UP |
| Snapshot API | :3000 /snapshot | ✅ UP |
| Auth API | :3000 /api/auth/* | ✅ UP |
| Admin API | :3000 /api/admin/* | ✅ UP |
| Payment API | :3000 /api/payment/* | ✅ UP |
| Innovation API | :3000 /api/innovation/* | ✅ UP |
| Nginx Reverse Proxy | :80/:443 | ✅ UP |
| Healer Service | systemd | ✅ UP |

---

## Pași urmați la deploy

1. ✅ Checkout & Lint (`node --check`)
2. ✅ Teste automate (`npm test`)
3. ✅ Build imagine Docker → GHCR
4. ✅ SSH → Hetzner VPS
5. ✅ `docker-compose -f docker-compose.prod.yml pull && up -d`
6. ✅ Health check 2 minute (toate modulele)
7. ✅ Tag `${DEPLOY_TAG}` creat în repository
8. ✅ LIVE-CERTIFICATE.md actualizat

---

## Auto-Vindecare

- Healer script rulează la **30 secunde**
- Rollback automat după **3 eșecuri consecutive**
- Log: `/var/log/healer.log` pe server

## Auto-Inovare

- Innovation Loop: **săptămânal (Luni 03:00 UTC)**
- Workflow: `.github/workflows/innovation-loop.yml`
- A/B testing activ: variante preț / layout / text

---

*Certificat generat de ZeusAI Autonomous Deploy Agent*
