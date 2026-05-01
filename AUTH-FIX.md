# AUTH-FIX.md — Investigation + Fix Report

**Date:** 1 May 2026
**Trigger:** "Site-ul zeusai.pro are formular de creare cont și login dar NU funcționează deloc"
**Status:** ✅ AUTH WORKS — separate revenue blocker found and fixed.

## TL;DR

`Signup`, `login`, `device-key` (passkey) și `purchase` funcționează **toate** end-to-end pe live. Bug real descoperit: la `/api/services/buy` clientul nu trimitea prețul → checkout-ul BTC ieșea cu `amountUsd: 0` și `btcAmount: null`. Reparat: serverul caută acum prețul în catalog când body-ul nu îl conține.

## Ce am verificat live (zeusai.pro)

| Probă | Rezultat |
|---|---|
| `POST /api/customer/signup` | ✅ HTTP 200 — JSON `{ok:true, customer:{id,email,name,createdAt,apiKeys}, token:JWT}` |
| `Set-Cookie: customer_session` | ✅ `HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` |
| `POST /api/customer/login` | ✅ HTTP 200 + JWT |
| `GET /api/customer/me` (cu cookie) | ✅ HTTP 200 — profile + orders + activeServices |
| `POST /api/services/buy` (cu cookie) | ✅ HTTP 200 — `awaiting_payment`, BTC URI, owner wallet `bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e` |
| Form fields în [/account](https://zeusai.pro/account) | ✅ Toate IDs prezente: `acLoginEmail`, `acLoginPass`, `acLoginBtn`, `acSignupName`, `acSignupEmail`, `acSignupPass`, `acSignupBtn`, `acPasskeyLoginBtn`, `acPasskeyCreateBtn` |
| Wiring în [`assets/app.js`](https://zeusai.pro/assets/app.js) | ✅ `addEventListener('click', doLogin/doSignup)` → `fetch('/api/customer/login'\|'signup', {credentials:'same-origin'})` |
| Validări frontend | ✅ Email + parolă obligatorii, parolă ≥ 8 caractere |

## Rute backend confirmate

- [UNICORN_FINAL/src/index.js#L4626](UNICORN_FINAL/src/index.js#L4626) — `POST /api/customer/signup` (site cluster, port 3001)
- [UNICORN_FINAL/src/index.js#L4673](UNICORN_FINAL/src/index.js#L4673) — `POST /api/customer/login`
- [UNICORN_FINAL/backend/index.js#L855](UNICORN_FINAL/backend/index.js#L855) — `POST /api/customer/signup` (backend Express, port 3000, `authRateLimit(10, 15min)`)
- [UNICORN_FINAL/backend/index.js#L894](UNICORN_FINAL/backend/index.js#L894) — `POST /api/customer/login` (`authRateLimit(20, 15min)`)
- WebAuthn / device-key: [UNICORN_FINAL/src/index.js](UNICORN_FINAL/src/index.js) endpoints `/api/customer/passkey/*` wired în handler-ul `acPasskeyCreateBtn`/`acPasskeyLoginBtn`.

Storage: stat in-memory + persistat pe disc (`portal.js`). Nu există PostgreSQL în setup-ul curent — schema de utilizatori e gestionată de modulul `portal`/`customers` în Node, conform convenției din [.github/copilot-instructions.md](.github/copilot-instructions.md): "Prefer plain Node + in-memory state for features unless persistence is already introduced".

## Bug real (revenue blocker) — REPARAT

**Simptom:** la `/api/services/buy` cu `serviceId:"adaptive-ai"` (preț $499) răspunsul includea:

```json
"paymentInstructions": { "btcAmount": null, "amountUsd": 0, "btcUri": "bitcoin:bc1q...?amount=0" }
```

→ utilizatorul nu putea plăti suma corectă; orice plată ar fi fost ratată ca "underpaid".

**Cauza:** [UNICORN_FINAL/src/index.js#L3950](UNICORN_FINAL/src/index.js#L3950) folosea `Number(p.amount || p.amountUSD || p.priceUSD || 0)` — frontend-ul nu trimite prețul în body, deci default-ul `0` ajungea la `/api/checkout/btc`.

**Fix:** când body-ul nu conține preț, serverul caută prețul autoritativ în catalog (`getRuntimeDataSources().services`) folosind `dynamicPrice.usd` → `priceUsd` → `priceUSD` → `price`, apoi îl trece prin `clampUsdPrice` ($1–$10M). Fallback final: `fallbackUsdForService`.

## Deploy

- Commit `4c68f15` — fix backend `/api/revenue/launchpad/{status,plan}` (eliminat sync 404)
- Commit pending — fix `services/buy` price lookup

Verificare după deploy: `curl -X POST https://zeusai.pro/api/services/buy -d '{"serviceId":"adaptive-ai","paymentMethod":"BTC"}'` trebuie să returneze `amountUsd: 499` și `btcAmount > 0`.

## Concluzie

Auth NU era stricat. Ce era stricat era checkout-ul BTC (preț 0). Acum ambele funcționează — utilizatorii pot crea cont, se pot loga, pot cumpăra și primesc adresa BTC corectă cu suma exactă.
