# FINAL-FORWARD-REPORT — zeusai.pro audit & forward upgrade

**Data:** 2026-05-09
**Mod:** forward-only · zero rollback · zero regression

## Ce am verificat (live + local)
- Live `https://zeusai.pro/` răspunde HTTP 200, `/health` OK.
- Endpoint-urile reale care alimentează UI-ul:
  - `/api/pricing/all` — live, dynamic-pricing engine OK (free/starter/pro/enterprise + module).
  - `/api/pricing/{serviceId}` — live, surge + demandFactor + finalPrice.
  - `/api/marketplace/services` — live, 330+ servicii cu preț dinamic.
  - `/api/catalog` și `/api/catalog/master` — live, schema completă (priceUsd, priceBtc, livePriceSource).
  - `/api/instant/catalog` — live, alimentează `/services` (3 tier-uri: instant / professional / enterprise).
- Testele complete (37 suite-uri) + lint trec pe `0 erori`, post-modificări.

## Defecte reale găsite și reparate forward (fără patch‑uri peste patch‑uri)

### 1. Prețuri afișate trunchiate la întreg (regresie majoră)
**Înainte:** `_catalogCard` (SSR în [src/site/v2/shell.js](UNICORN_FINAL/src/site/v2/shell.js#L196)) și `masterCardHtml` (client în [src/site/v2/client.js](UNICORN_FINAL/src/site/v2/client.js#L1847)) foloseau `Number(price).toLocaleString('en-US')` fără opțiuni → `$25.08` afișa `$25`, `$465.92` afișa `$466`. Engine-ul calcula corect, dar UI-ul mințea utilizatorul.
**Acum:** formatare unificată `{ minimumFractionDigits: hasFrac ? 2 : 0, maximumFractionDigits: 2 }` în SSR, hidratare, pagina `/pricing` și pagina de detaliu serviciu. Integrii rămân `$99`, fracționarele apar exact (`$25.08`, `$465.92`).

### 2. Fallback hardcodat de `$99` în client (interzis explicit de cerință)
**Înainte:** [`fetchLivePricing`](UNICORN_FINAL/src/site/v2/client.js#L142), [`normalizeLivePricing`](UNICORN_FINAL/src/site/v2/client.js#L99), butonul Quick‑Buy și `hydrateCheckout` aveau toate `price_usd: 99` ca fallback la eroare/lipsă serviceId. Utilizatorul putea trimite o comandă cu preț fals.
**Acum:**
- `normalizeLivePricing` → `NaN` când lipsesc datele (nu mai inventează prețuri).
- `fetchLivePricing` → fallback predictiv din `STATE.masterCatalog` (preț SSR deja livrat) când rețeaua cade; în lipsă totală → `null`. Niciun `99` nu mai poate atinge UI-ul.
- Quick‑Buy [client.js#L1740](UNICORN_FINAL/src/site/v2/client.js#L1740) refuză să creeze comanda dacă engine-ul de pricing nu răspunde — afișează „pricing engine warming up — please retry”, **nu mai trimite** request `/api/services/buy` cu sumă falsă.
- `hydrateCheckout` afișează „price refreshing…” în loc de `$99` și nu setează `coAmount`.

### 3. Buy buttons cu JSON neescapat în atribute `onclick` (XSS / break)
**Înainte:** legacy [src/site/template.js](UNICORN_FINAL/src/site/template.js#L2077) injecta `JSON.stringify(...)` direct în `onclick="openCheckout(...)"`. Orice nume cu `"` rupea atributul; orice apostrof rupea executarea.
**Acum:** helper nou `payloadAttr(o)` care HTML‑escape‑ează JSON‑ul (`&quot;`/`&#39;`), folosit în Buy din marketplace + chat recommendations. Browserul decodifică corect → JS valid.

### 4. Marketplace cu fallback mock fictiv (`AI Website Generator $99`, `AI Trading Bot $149`)
**Înainte:** când `/api/catalog` cădea, [legacy template.js](UNICORN_FINAL/src/site/template.js#L1990) afișa două servicii inventate cu prețuri hardcodate.
**Acum:** lanț real de surse — `/api/catalog` → `/api/marketplace/services` → `/api/pricing/all` (mapat din motorul de pricing). Worst‑case: grilă goală cu mesaj clar; **niciodată** servicii fictive.

### 5. Lipsă defensive guards & helper unificat de formatare USD
**Acum:** helper `fmtUsd(n)` în template + format consistent în SSR/client. `Array.isArray` deja prezent în ramurile critice; cele lipsă au fost completate (`if(!Array.isArray(STATE.filteredServices))`).

## Verificări finale
- ESLint: ✓ 0 erori, 0 warnings (`npm run lint`).
- Test suite: ✓ 37/37 (`npm test`), inclusiv `live-pricing-broker`, `site-filter-chips`, `site-live-pricing-sse`, `site-stability-guard`, `site-security-pagespeed`.
- Server pornește local pe `:3037`, `/health` 200, `/api/catalog` returnează listă reală cu prețuri dinamice.
- Cache‑Control: `no-cache, no-store, must-revalidate` deja activ pe toate paginile HTML (verificat la [src/index.js#L421](UNICORN_FINAL/src/index.js#L421)). Asset‑urile versionate rămân cache‑abile.

## Status: SUPERIOR, fără regresii
Site-ul afișează acum **exact** prețul calculat de motorul de pricing al Unicornului (cu zecimale corecte), niciun buton nu mai poate ajunge la checkout cu preț fals, fallback‑urile sunt predictive (SSR cache), nu hardcodate. Fluxurile critice (autentificare passwordless `/api/auth/passwordless/*`, BTC checkout sovereign, marketplace 330+ servicii dinamice) rămân intacte și sunt acoperite de testele care au trecut.

Deploy: push pe `main` declanșează `.github/workflows/hetzner-deploy.yml` → lint + test în CI → SSH deploy către Hetzner. Fără rollback, fără patch‑uri; numai upgrade definitiv.

## Update 2026-05-09T16:50Z — Sovereign commerce reactivat live

### 6. /api/checkout/create și /api/commerce/{health,price,recent-sales} returnau 404 pe producție

**Cauza reală** (descoperită prin headerul `x-unicorn-role: backend`): nginx pe Hetzner are o regulă catch-all `location ^~ /api/` care trimite tot traficul `/api/*` către BACKEND (`:3000`). Modulul sovereign-commerce ([sovereign-commerce.js](UNICORN_FINAL/src/site/sovereign-commerce.js)) rulează exclusiv pe SITE (`:3001`). Cererile loveau backend-ul Express (care nu are aceste rute) și răspundeau cu `Cannot GET /api/commerce/price`. Workflow-ul activ `Unicorn Stable Deploy` ([deploy.yml](.github/workflows/deploy.yml)) nu sincroniza `UNICORN_FINAL/scripts/nginx-unicorn.conf` (acea sincronizare există doar într-un workflow nedetectat din `UNICORN_FINAL/.github/`).

**Forward fix:**

- Patcher nou idempotent [nginx-patch-sovereign-commerce-routes.py](UNICORN_FINAL/scripts/nginx-patch-sovereign-commerce-routes.py) care injectează un bloc `# ZEUS-SOVEREIGN-COMMERCE BEGIN/END` cu `location =` pentru `/api/checkout/create`, `/api/commerce/{health,price,recent-sales,reconcile}` și `location ^~` pentru `/api/order/`, `/api/entitlements/`, `/checkout/` — toate spre `127.0.0.1:3001`. Pattern identic cu `nginx-patch-100y-routes.py`: backup, atomic write, `nginx -t`, auto-revert la failure, reload.
- Wired în [deploy.yml](.github/workflows/deploy.yml) imediat după `nginx-patch-perf-100y-routes.py`, cu `continue-on-error`.
- Bypass adițional în [src/index.js](UNICORN_FINAL/src/index.js#L1182) pentru ca, dacă vreodată nginx trimite aceste paths la SITE, dispatcher-ul să sară Express direct la `unicornHandler` și să cheme `commerce.handle()`.
- Log de pornire îmbogățit la încărcarea modulului commerce ([src/index.js](UNICORN_FINAL/src/index.js#L971)) ca un eventual eșec viitor de `require('./site/sovereign-commerce')` să apară în PM2.

**Verificări live după commit `334b0a3`:**

- `GET /api/commerce/price` returnează `200`, header `x-unicorn-role: site`, body real `{"btc_usd":80606,"btc_eur":68431,"source":"mempool.space",...}`.
- `GET /api/commerce/health` returnează `200`, watcher activ (`lastScanOk:true`, 58 ordere totale).
- `POST /api/checkout/create` cu `serviceId="unicorn-billion-scale-activation"` returnează `201 Created`, ordin real cu `bip21=bitcoin:bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e?amount=5.58271970`, `unit_price_fiat=4500$`, `btc_discount_pct=10`, `access_token` emis, `status=pending` (așteaptă confirmarea on-chain).

### Tests și lint după runda 2

- ESLint: 0 erori, 0 warnings.
- Test suite: 55/55 (extins de la 37/37 prin testele suplimentare ale runtime-ului).
- `py_compile` OK pe noul patcher.

### Commits livrate (forward-only, în ordine cronologică)

1. `19c9acf` — fix(pricing): forward audit – eliminate hardcoded $99 fallbacks, decimal-accurate price rendering, safe Buy onclick payloads.
2. `066da6a` — fix(commerce): bypass Express for sovereign-commerce GET routes.
3. `5ef7b2a` — fix(nginx): route sovereign-commerce paths to unicorn_site upstream.
4. `334b0a3` — fix(deploy): patch live nginx with sovereign-commerce route block.

Toate live, toate verificate cu `curl` direct pe `https://zeusai.pro`. Header-ul `x-zeus-build` corespunde commit SHA pe fiecare etapă.
