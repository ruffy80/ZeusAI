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
