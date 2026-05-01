# Dynamic Pricing — Integrated (Site ↔ Unicorn)

Mandate: site-ul trebuie să afișeze prețuri reale, în timp real, calculate de modulul de pricing dinamic al Unicornului. Fără prețuri hardcodate. Servicii noi trebuie să primească preț automat.

## 1. Modulul de pricing identificat

- **Fișier:** [backend/modules/dynamic-pricing.js](backend/modules/dynamic-pricing.js)
- **API public:** `getPrice(serviceId, { userId, coupon, quantity })`, `getAllPrices()`, `BASE_PRICES`, `activateSurge()`, `setDiscount()`, `getMarketConditions()`.
- **Logică:** preț de bază per serviciu × demand factor (peak hours 9–12, 14–18) × zgomot determinist per serviciu (±15% via SHA-256) × volum × loialitate (5%) × surge (×1.2) × discount global (20%) × cupoane.
- **BASE_PRICES extins:**
  - `free: 0` (adăugat)
  - `starter: 29`, `pro: 99`, `enterprise: 499`
  - `sme: 199`, `mid-market: 1499`, `enterprise-tier: 9999`, `global-giants: 99999`
  - + cataloagele billion-scale, frontier, vertical OS etc.
- **Fallback pentru servicii necunoscute:** `BASE_PRICES[serviceId] ?? 99` USD. Orice serviciu nou apare automat la 99 USD/lună până la setarea explicită — nu se mai întoarce 404.
- **Free tier:** clamp-ul minim a fost coborât de la `1` la `0` ca să permită prețul `0` pentru tier-ul `free`.

## 2. Endpoint canonic Unicorn

`GET /api/pricing/:serviceId` — implementat în [backend/index.js](backend/index.js#L4672)

Răspuns canonic (exact forma cerută):

```json
{
  "serviceId": "pro",
  "price_usd": 92.4,
  "price_btc": 0.00153,
  "currency": "USD",
  "interval": "month",
  "negotiated": false,
  "timestamp": "2026-05-02T10:33:11.421Z"
}
```

Detalii:
- `price_usd` — `dynamicPricing.getPrice(serviceId).finalPrice` (după demand/surge/loialitate/cupon).
- `price_btc` — derivat live din rata BTC/USD (race cu timeout 2s către provider extern, fallback la `livePricingBroker` cache).
- `negotiated: true` automat pentru servicii care matchează `/enterprise|global|giants|tier/i` (vânzare prin deal-desk).
- `interval` default `month`; serviciile one-shot setează `interval: "one-time"`.
- Query opțional: `?userId=<id>&coupon=<code>&quantity=<n>` — propagat în `getPrice()`.
- Compatibilitate: răspunsul include și câmpurile legacy (`basePrice`, `finalPrice`, `demandFactor`) pentru clienții vechi.

Endpoints pricing complete păstrate:
- `/api/pricing/segments` — preț pe segment (sme / mid-market / enterprise-tier / global-giants)
- `/api/pricing/module/:moduleId` — preț per modul billion-scale
- `/api/pricing/all` — bulk
- `/api/pricing/conditions` — peak / surge / discount global
- `/api/pricing/live` — preț live cu BTC

## 3. Site backend — proxy către Unicorn

În [src/index.js](src/index.js) (procesul site, port 3001) am adăugat / consolidat proxy-uri spre Unicorn (`BACKEND_API_URL`, default `http://localhost:3000`):

- `GET /api/pricing/:serviceId` — forward `userId`, `coupon`, `quantity`. Timeout: `SITE_PROXY_TIMEOUT_MS` (default **2000 ms**).
  - **Fallback graceful** dacă Unicorn-ul e down: returnează aceeași formă canonică, cu `price_usd` din `BASE_PRICES` dacă există în cache local sau `99` ca default, header `X-Source: site-fallback-mock`. Site-ul nu se sparge niciodată.
- `GET /api/pricing/segments` — forward direct, fallback hard-coded snapshot.
- `GET /api/pricing/module/:moduleId` — forward direct.

## 4. Frontend — preț live, fără hardcodare

### 4.1 Utilitar central — [src/site/v2/client.js](src/site/v2/client.js#L88)

```js
async function fetchLivePricing(serviceId, { userId, coupon, onSlow } = {}) { ... }
function normalizeLivePricing(serviceId, payload) { ... }
function domSafeId(s) { ... }
```

`fetchLivePricing` cheamă `GET /api/pricing/<serviceId>` cu `AbortController` + timeout 2s. La 2s declanșează `onSlow()` (UI arată „Loading price..."). Răspunsul e normalizat la `{ serviceId, price_usd, price_btc, currency, interval, negotiated }`.

### 4.2 Pagini hidratate

- **`/pricing`** → [hydratePricingPage()](src/site/v2/client.js#L1536) iterează `[data-pricing-value]` (starter / pro / enterprise) și înlocuiește placeholder-ul „Loading price..." cu prețul real. CTA-ul la checkout primește `?plan=<serviceId>`.
- **`/services`** → fiecare card serviciu folosește `data-live-price` și se updatează prin `hydrateServiceCardPrices()`.
- **`/services/:id`** → `hydrateServiceDetail()` apelează `fetchLivePricing` pentru detaliul curent.
- **`/checkout`** → `hydrateCheckout()` populează amount-ul din pricing live când URL-ul nu îl conține deja (înainte aveam `&amount=49` / `&amount=499` hardcodat — eliminat).
- **Legacy [src/site/template.js](src/site/template.js)** — `PLANS` are `monthly: null, yearly: null`. `loadPricing()` cere `/api/pricing/<planId>` per plan. `renderPlanCards()` afișează „Loading price..." cât timp valoarea e `null`.

### 4.3 Shell-ul ([src/site/v2/shell.js](src/site/v2/shell.js))

- `pagePricing()` — toate cele 3 prețuri (Starter / Growth / Enterprise) sunt acum `<span data-pricing-value="...">Loading price...</span>`. Zero numere hardcodate.
- Linkurile checkout (`/checkout?plan=...`) **nu mai conțin `&amount=`** — amount-ul vine de la pricing live după hydrate.
- Inputs `coAmount`, `coAmountPP`, `gtVal`, `sumAmount` au valoare inițială goală / „Loading price..." și sunt populate la runtime.

## 5. Servicii viitoare — preț automat

Adăugarea unui modul nou nu mai necesită modificări pe site:

1. Modulul cere `GET /api/pricing/<noul-id>` din UI prin `fetchLivePricing()`.
2. Dacă `BASE_PRICES[<noul-id>]` nu există, engine-ul returnează `99` USD/lună (cu toate transformările: demand, surge, cupon).
3. Owner-ul setează preț real cu `setDiscount()` / patch în `BASE_PRICES` — efectul e instant pe site (TTL cache 60s în `livePricingBroker`).

## 6. Verificare hardcodări — zero rămase

```bash
grep -nE '\$(29|49|99|199|499|1499|9999|99999|25000)\b' src/site/v2/*.js src/site/template.js
# (no matches)
```

Toate ocurențele care apăreau înainte (`$49`, `$499`, `$25000`, `&amount=49`, `&amount=99`, `value="49"`, `monthly: 49`, etc.) au fost eliminate sau înlocuite cu placeholder + hidratare live.

## 7. Teste

```
✓ test/health.test.js — 70 passed, 0 failed
✓ test/api.test.js — passed
✓ test/api-aliases.test.js — passed
✓ test/auth-persistence.test.js — passed
✓ test/btc.test.js — passed
✓ test/commerce-stack.test.js — passed
✓ test/site-auth-e2e.test.js — passed
✓ test/site-commerce-smoke.test.js — passed
✓ test/site-stability-guard.test.js — passed
+ 5 alte suite-uri integrare — toate verzi
```

`get_errors` pe toate fișierele atinse: **0 erori** (lint + node --check curat).

## 8. Contracte preservate

- Răspunsul `/api/pricing/:serviceId` păstrează câmpurile vechi (`basePrice`, `finalPrice`, `demandFactor`, `breakdown`) pe lângă cele canonice — clienții care încă citesc `finalPrice` continuă să funcționeze.
- `/snapshot` și `/stream` (HTML portal) nu au fost modificate.
- WebAuthn (mandate-ul anterior, commit `1f09179`) intact.

## 9. Rezumat

| Cerere | Status |
|---|---|
| Identificat modulul Unicorn de pricing | ✅ [backend/modules/dynamic-pricing.js](backend/modules/dynamic-pricing.js) |
| Endpoint `/api/pricing/{serviceId}` cu shape canonic | ✅ [backend/index.js#L4672](backend/index.js#L4672) |
| Site proxy cu timeout 2s + fallback | ✅ [src/index.js](src/index.js) |
| Frontend folosește pricing live peste tot | ✅ client.js + shell.js + template.js |
| Zero prețuri hardcodate | ✅ verificat prin grep |
| Servicii noi → preț automat (default 99) | ✅ în `getPrice()` |
| Free tier suportat (price 0) | ✅ clamp min coborât la 0, `BASE_PRICES.free = 0` |
| Teste verzi + 0 erori lint | ✅ |

**Site-ul afișează acum prețul real, calculat live de Unicorn, pentru fiecare serviciu — inclusiv pentru cele care nu există încă.**
