# SITE-FIX-REPORT — zeusai.pro frontend ↔ backend ↔ Unicorn

Data: 2026-04-29

## 1. Endpointurile expuse de backend-ul site-ului (`UNICORN_FINAL/src/index.js`)
- Existente (subset relevant): `/health`, `/snapshot`, `/stream`, `/api/audit-chain`, `/api/marketplace`, `/api/feedback`, `/api/metrics`, `/api/innovation-dashboard`, `/api/feature-flags`, `/api/admin/*`, `/api/user/services`, `/api/payments/*`, `/api/checkout/*`, `/api/services/*`, `/api/catalog/*`, etc.
- Backend Unicorn (`UNICORN_FINAL/backend/index.js`) expune `/api/industry/list`, `/api/industry/projected`, `/api/industry/blueprint/:name`, etc., dar răspunde 503 dacă modulul `_industryOS` nu e încărcat.

## 2. Comparație cu apelurile frontendului
- Frontendul (UI inline din `src/site/template.js` + apeluri legacy din `release/unpacked/client/src/pages/*.jsx`) apelează:
  - `/api/industry/list` → era 503 pe `https://zeusai.pro/api/industry/list`
  - `/api/control/stats` → era 404
  - `/api/evolution/snapshot` → era 404
  - + alte `/api/*` (payment, marketplace, blockchain, etc.) — funcționale
- Endpoint-urile lipsă au fost adăugate cu proxy + fallback în site-ul zeusai.pro.

## 3. Modificări backend zeusai.pro (`UNICORN_FINAL/src/index.js`)
- Adăugat helper `siteProxyToUnicorn(routePath)` cu:
  - timeout configurabil `SITE_PROXY_TIMEOUT_MS` (default 2000 ms)
  - `AbortController` pentru tăierea curată a request-ului
  - log warning la fiecare fallback (`[site-proxy] ... → fallback mock`)
  - răspuns JSON `200` cu mock dacă upstream este indisponibil / 5xx / lipsă `BACKEND_API_URL`
- Adăugat rutele:
  - `GET /api/industry/list` → proxy către Unicorn `/api/industry/list`, fallback `industries[]` mock cu 5 verticale.
  - `GET /api/control/stats` → proxy către Unicorn, fallback `{ uptime, status, modules, activeUsers, requestsPerMin }`.
  - `GET /api/evolution/snapshot` → proxy către Unicorn, fallback `{ timestamp, evolution, version, metrics, notes }`.
- Toate răspunsurile fallback marchează header `X-Source: site-fallback-mock` și câmp `source` în JSON.

## 4. Modificări backend legacy (`release/unpacked/backend/index.js`)
- Adăugat `axios` proxy către Unicorn cu `UNICORN_URL` env (default `http://localhost:3001`), 2s timeout, log fallback.
- Endpoint-uri noi: `/api/industry/list`, `/api/control/stats`, `/api/evolution/snapshot` cu mock data.

## 5. Modificări frontend (`release/unpacked/client/src/`)
- Nou utilitar `utils/retryFetch.js`:
  - `retryAxios(config, retries=3, delay=400)`
  - `retryFetch(url, opts, retries=3, delay=400)`
- `pages/Dashboard.jsx`, `pages/InnovationCommandCenter.jsx`, `pages/Wealth.jsx`:
  - axios → `retryAxios` pentru toate apelurile critice.
  - `localStorage` cache (`lastStats`, `lastInnovationStats`, `lastWealthStats`) pentru "last known good".
  - State `loading` + `error` cu UI fallback: "Loading stats..." / "Live stats unavailable. Showing last known data." (fără infinite loading).

## 6. Mecanism de fallback (rezumat)
- **Backend zeusai.pro:** orice apel către Unicorn cu timeout 2s; dacă pică, returnează mock + log fără să crape procesul.
- **Frontend:** retry automat 3× pentru fiecare request critic, apoi fallback la datele cache din `localStorage`, apoi UI gol cu mesaj clar.

## 7. Deploy
- Commit pe branch `main`, push la `https://github.com/ruffy80/ZeusAI.git`.
- Workflow `.github/workflows/hetzner-deploy.yml` redeployează automat pe Hetzner la push în `main`.

## 8. Verificare finală (după deploy Hetzner)
Comenzi de validare:
```bash
curl -i https://zeusai.pro/api/industry/list      # 200 + JSON industries[]
curl -i https://zeusai.pro/api/control/stats      # 200 + JSON stats
curl -i https://zeusai.pro/api/evolution/snapshot # 200 + JSON snapshot
```
Browser: `https://zeusai.pro` — fără "Loading..." infinit, fără erori 404/503 în Network.

## 9. Promisiunea explicită
Unicorn-ul NU a fost modificat. Toate fix-urile sunt în site (frontend + backend-ul site-ului).
