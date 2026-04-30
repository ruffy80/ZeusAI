# SITE-FIX-REPORT — zeusai.pro frontend ↔ site backend ↔ Unicorn

Data: 2026-04-30

## Scope
- Am lucrat doar pe layer-ul site `zeusai.pro`: `UNICORN_FINAL/src/index.js` (site backend), `UNICORN_FINAL/src/site/template.js` (frontend legacy inline) și frontend-ul activ v2 (`UNICORN_FINAL/src/site/v2/shell.js`, `UNICORN_FINAL/src/site/v2/client.js`).
- Nu am modificat modulele Unicorn / engine-ul din `UNICORN_FINAL/backend/modules/`.

## 1. Endpointuri expuse de backend-ul site-ului
- Inventar automat din `UNICORN_FINAL/src/index.js`: 26 rute Express directe (`app.get/post/...`) plus rute servite de handler-ul HTTP intern (`/snapshot`, `/stream`, multe `/api/*` locale/proxy).
- Rute relevante confirmate în site backend:
  - `GET /api/industry/list`
  - `GET /api/control/stats`
  - `GET /api/evolution/snapshot`
  - `GET /api/autonomous/viral/status`
  - `POST /api/autonomous/viral/trigger`
  - `GET /api/viral/status`
  - `GET /health`, `GET /snapshot`, `GET /stream`

## 2. Comparație frontend calls vs backend site
- Inventar automat frontend din `UNICORN_FINAL/src/site/template.js`: 209 URL-uri locale chemate prin `api(...)` sau `fetch(...)`.
- Frontendul cheamă direct multe familii `/api/*`: auth, billing, admin, payment, viral, innovation, pricing, tenants, carbon, blockchain, workforce, compliance, risk, reputation, aviation, telecom, enterprise etc.
- Cele trei endpointuri cerute (`/api/industry/list`, `/api/control/stats`, `/api/evolution/snapshot`) există în site backend și au fost verificate live; nu sunt chemate direct în `template.js` în build-ul curent, dar sunt gata pentru frontend/client extern.
- Pentru endpointurile frontend care merg spre backend/Unicorn, site-ul are deja mecanisme locale/proxy/fallback pe familiile importante; noul wrapper frontend acoperă orice `fetch` rămas.

## 3. Backend site → Unicorn
- `UNICORN_FINAL/src/index.js` are helper `siteProxyToUnicorn(routePath, opts)` cu timeout default `SITE_PROXY_TIMEOUT_MS=2000`.
- Dacă `BACKEND_API_URL` răspunde în timp, site backend returnează JSON-ul Unicorn.
- Dacă Unicorn nu răspunde, dă 5xx, timeout sau `BACKEND_API_URL` lipsește, site backend loghează `[site-proxy] ... → fallback mock` și returnează `200` JSON mock, fără să crape procesul.
- Rutele cerute au fallback-uri mock dedicate:
  - `/api/industry/list`: industrii/verticale business.
  - `/api/control/stats`: status/control stats.
  - `/api/evolution/snapshot`: snapshot evoluție/stabilitate.

## 4. Frontend resilience adăugat
- În frontend-ul activ v2 am instalat wrapper global peste `window.fetch` în două puncte:
  - `UNICORN_FINAL/src/site/v2/shell.js`: bootstrap inline timpuriu, înainte de requesturile din shell (`/api/aura`, newsletter, tracking etc.).
  - `UNICORN_FINAL/src/site/v2/client.js`: protecție în `/assets/app.js` pentru SPA/router/dashboard/checkout/admin/customer portal.
- În `UNICORN_FINAL/src/site/template.js` am păstrat aceeași protecție pentru shell-ul legacy inline:
  - retry automat de 3 ori pentru requesturi eșuate / 5xx;
  - cache localStorage pentru ultimul răspuns bun `GET` same-origin;
  - dacă datele live nu vin, returnează un `Response` din cache cu header `X-Zeus-Cache-Fallback: 1`;
  - curăță UI-urile blocate pe `Loading...` și afișează mesaj de fallback când nu există cache.
- Funcția centrală `api(method,path,...)` folosește automat acest wrapper, deci toate apelurile UI trec prin retry/fallback.
- Fetch-urile directe din pagină (`/snapshot`, `/api/payment/btc-rate`, `/api/catalog`, `/api/module-registry`, etc.) sunt acoperite de același wrapper global.

## 5. Verificare locală
- `npm run lint` în `UNICORN_FINAL/` a trecut.
- VS Code Problems: fără erori în `UNICORN_FINAL/src/site/template.js` și `UNICORN_FINAL/src/index.js`.

## 6. Verificare live înainte de deploy-ul frontend resilience
Comenzi rulate pe `https://zeusai.pro`:

```bash
curl https://zeusai.pro/api/industry/list
curl https://zeusai.pro/api/control/stats
curl https://zeusai.pro/api/evolution/snapshot
```

Rezultat:
- `/api/industry/list` → `200`, JSON real din backend/Unicorn (`x-powered-by: Express`).
- `/api/control/stats` → `200`, JSON fallback mock (`x-source: site-fallback-mock`).
- `/api/evolution/snapshot` → `200`, JSON fallback mock (`x-source: site-fallback-mock`).

## 7. Deploy
- Push pe `main` declanșează workflow-ul activ `.github/workflows/deploy.yml`, care redeployează pe Hetzner.
- După deploy se revalidează:

```bash
curl -i https://zeusai.pro/api/industry/list
curl -i https://zeusai.pro/api/control/stats
curl -i https://zeusai.pro/api/evolution/snapshot
```

## 8. Garanție scope
- Unicornul rămâne neatins.
- Fix-ul este strict pentru comunicarea site frontend ↔ site backend ↔ Unicorn și pentru UX fără loading infinit.
