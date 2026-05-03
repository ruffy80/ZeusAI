# RESTORE-NORMAL — Restaurare zeusai.pro după regresia "TOTAL PRODUCTS 0"

**Data raport:** 2026-05-03
**Branch verificat:** `main` @ `57005a9`
**Autor:** Copilot cloud agent (sesiune sandbox, fără acces SSH)

---

## 1. Ce s-a raportat

Site-ul `https://zeusai.pro` afișa:
- `TOTAL PRODUCTS 0` în panoul Store (în loc de numărul real)
- pagina `/crypto-fiat-bridge` lipsea sau returna 404
- autentificarea (`/api/auth/login`, `/api/auth/register`) nu mai funcționa
- prețurile erau hardcodate, nu dinamice
- multe corecții recente păreau să fi „dispărut"

## 2. Ce am găsit în repo (cauza reală)

Cauza **nu** este codul de pe `main`. Codul de pe `main` (`HEAD = 57005a9`) este corect. Cauza este că **serverul Hetzner rulează un snapshot vechi** anterior remedierilor recente — și, mai grav, scriptul `scripts/auto-sync-push.sh` care rulează pe server propaga din nou acel snapshot vechi peste `main` prin commit-uri „live-sync: …", ștergând munca recentă.

### 2.1. Cronologia regresiei (din `git log origin/main`)

| SHA | Mesaj | Efect |
|---|---|---|
| `b23e5fa` | feat: add CryptoBridge module + fix LEDGER_PATH ReferenceError (#438) | introduce `/crypto-fiat-bridge` |
| `a0b81af` | fix(site): enable crypto-fiat-bridge route + finalize auth hardening | activează ruta + auth |
| `0dacd1c` | **live-sync: 2026-05-03 00:47:25** | **regresia: șterge -1216 linii**, scoate `/crypto-fiat-bridge`, anulează corecțiile |
| `6fec824` | rollback(live): restore site snapshot from 2026-05-02 21:00 | încercare manuală de rollback |
| `36d2bf0` | Revert "rollback(live): …" | s-a anulat rollback-ul de mai sus |
| `76953c2` | ci(deploy): harden mandatory auth smoke payload + env fallbacks | întărire CI |
| `1d79d96` | fix(site): restore crypto bridge route/page in v2 shell | **restaurează ruta** |
| `fe5d374` | **Restore yesterday's functional build to live (revert destructive live-sync 0dacd1c) (#439)** | **revert curat al regresiei** |
| `57005a9` | backend: add /api/btc/spot + /api/instant/catalog aliases (#440) | **adaugă aliasul în backend pentru ca SSR-ul site-ului să nu mai vadă 0 produse când lovește backendul** |

Concluzie: pe `main` totul e remediat. Restaurarea pe site **se va face automat** când workflow-ul `.github/workflows/hetzner-deploy.yml` rulează la următorul push pe `main` (sau via `workflow_dispatch`).

### 2.2. De ce afișa „TOTAL PRODUCTS 0"

Frontend-ul `UNICORN_FINAL/src/site/v2/client.js:3444` cheamă:
```js
fetch('/api/instant/catalog').then(r => r.json()).catch(() => ({ products: [], summary: null }))
```
Pe serverul live (snapshot vechi, pre-PR #440), backendul (port 3000) NU avea ruta `/api/instant/catalog`. Nginx, conform regulilor din `UNICORN_FINAL/scripts/nginx-unicorn.conf`, rutează `/api/*` către `unicorn_backend:3000`. Backendul răspundea 404 (sau JSON gol), `r.json()` arunca, `.catch` returna `{products: []}`, deci `summary.counts.total = products.length = 0`.

PR #440 (`57005a9`) a adăugat ruta de alias în `UNICORN_FINAL/backend/index.js` — odată ce serverul rulează acest commit, valoarea reală apare.

### 2.3. Câte produse afișează corect codul actual

Catalogul „static" din cod:
- `UNICORN_FINAL/src/commerce/instant-catalog.js` → 5 produse (3 instant + 2 professional)
- `UNICORN_FINAL/src/commerce/enterprise-catalog.js` → 3 produse enterprise
- **Total static:** 8 produse pe 3 niveluri de preț

La runtime, `UNICORN_FINAL/src/index.js:7240` cheamă `unifiedCatalog.setRuntimeSources({ marketplace, industries })` cu sursele din backend (pulled via `getRuntimeDataSources()` la fiecare ciclu de sync). Numărul afișat în site va depinde de ce conține marketplace-ul de pe backend — în mod normal mai mult de 8.

> **Notă:** problema cere „25 de produse pe 3 niveluri de preț". În `git log` nu există nicăieri o stare a repo-ului cu exact 25 de produse hardcodate. Dacă asta e ținta, este o **lucrare nouă** (feature), nu o restaurare — populează `UNICORN_FINAL/src/commerce/instant-catalog.js` și `enterprise-catalog.js` cu cele 17 produse care lipsesc, sau publică-le ca marketplace items. Acest PR nu inventează datele.

## 3. Ce este deja corect în `main` (verificat)

- ✅ `lint:syntax` trece (`node --check backend/index.js && node --check src/index.js`)
- ✅ `test/health.test.js` trece
- ✅ Ruta `/crypto-fiat-bridge` este restaurată (`UNICORN_FINAL/src/site/v2/shell.js`, modulul `cryptoFiatBridge`)
- ✅ `/api/instant/catalog` există ÎN AMBELE servere: `UNICORN_FINAL/src/index.js:5387` (port 3001) și `UNICORN_FINAL/backend/index.js:2657` (port 3000, alias)
- ✅ `/api/btc/spot` este alias public (PR #440)
- ✅ Endpoint-urile de auth (`/api/auth/login`, `/api/auth/register`) sunt în `UNICORN_FINAL/backend/index.js`
- ✅ Prețurile dinamice — `UNICORN_FINAL/backend/modules/live-pricing-broker.js` expune `/api/pricing/live` și `/api/pricing/live/stream`
- ✅ Guardul anti-ștergere distructivă este activ în `scripts/live-sync-hetzner-github.sh:91-105` și `scripts/auto-sync-push.sh:21-37` (refuză orice commit cu > 200 ștergeri, override doar cu `AUTO_SYNC_FORCE=1`)

## 4. Ce trebuie să faci tu pe Hetzner (pași manuali)

> **De ce manual:** agentul cloud rulează într-un sandbox izolat și nu are acces SSH la `204.168.230.142`. Singurul mod în care pot livra cod în repo este prin PR; deploy-ul către server este responsabilitatea workflow-ului `hetzner-deploy.yml` care folosește secret-ele `HETZNER_*` la care nu am acces.

### Opțiunea A — Deploy automat (recomandat)

1. Merge acest PR în `main`. Push-ul va declanșa `.github/workflows/hetzner-deploy.yml`, care:
   - face SSH cu `${{ secrets.HETZNER_*}}`
   - rulează `git pull` în `/opt/unicorn` pe server
   - face `pm2 restart unicorn`
   - rulează un smoke test pe endpoint-urile critice
2. După rularea workflow-ului, verifică:
   ```bash
   curl -fsS https://zeusai.pro/api/health | jq
   curl -fsS https://zeusai.pro/api/instant/catalog | jq '.products | length'
   curl -fsS https://zeusai.pro/api/btc/spot | jq
   curl -fsS -I https://zeusai.pro/crypto-fiat-bridge   # 200
   ```

### Opțiunea B — Manual pe Hetzner (dacă deploy-ul automat e blocat)

```bash
ssh root@204.168.230.142
cd /opt/unicorn

# 1. Verifică versiunea actuală
git log -1 --oneline
# Ar trebui să fie 57005a9 sau mai recent. Dacă e 0dacd1c sau mai vechi → continuă.

# 2. Oprește auto-sync ÎNAINTE de pull, ca să nu suprascrie git-ul
pkill -f auto-sync-push.sh   || true
pkill -f live-sync-hetzner   || true
pm2 stop auto-sync          2>/dev/null || true

# 3. Salvează modificări locale (dacă există) și pull
git stash push -u -m "pre-restore-$(date +%s)"  || true
git fetch origin main
git reset --hard origin/main

# 4. Reinstalează dependențe (dacă s-a schimbat package.json)
cd UNICORN_FINAL && npm ci --omit=dev && cd ..

# 5. Restart aplicația
pm2 restart unicorn || pm2 start ecosystem.config.js

# 6. Verifică
sleep 5
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:3000/api/instant/catalog | head -c 400

# 7. Repornește live-sync DOAR DUPĂ ce ai confirmat că serverul rulează exact origin/main
#    (altfel un loop nou de live-sync poate suprascrie git-ul cu state vechi)
pm2 start scripts/auto-sync-push.sh --name auto-sync   # sau systemctl, după setup
```

### Opțiunea C — Prevenirea regresiei viitoare

Asigură-te că ENV-ul de pe server include:
```
AUTO_SYNC_MAX_DELETIONS=200    # default; refuză orice „live-sync" care ar șterge >200 linii
AUTO_SYNC_FORCE=0              # nu pune NICIODATĂ pe 1 în mod permanent
```
Aceste praguri sunt deja respectate de `scripts/auto-sync-push.sh:21-37`. Dacă vrei zero-toleranță, setează `AUTO_SYNC_MAX_DELETIONS=50`.

## 5. Verificări post-deploy (smoke checklist)

După ce Hetzner rulează `57005a9`+, rulează:

| Endpoint | Așteptări |
|---|---|
| `GET /api/health` | `200`, JSON cu `status:"ok"` |
| `GET /api/instant/catalog` | `200`, `products.length >= 8`, `summary.counts.total >= 8` |
| `GET /api/btc/spot` | `200`, JSON cu `usd` numeric |
| `GET /api/pricing/live` | `200`, snapshot cu prețuri USD/BTC/sats |
| `GET /api/services` (alias) | `200`, listă de servicii |
| `POST /api/auth/register` cu payload valid | `201`/`200`, JWT în răspuns |
| `POST /api/auth/login` | `200`, JWT în răspuns |
| `GET /crypto-fiat-bridge` | `200`, HTML cu shell-ul v2 |
| `GET /frontier` | `200`, HTML cu pagina frontier |
| Pagina principală `https://zeusai.pro` | `Total products` ≥ 8 (nu 0) |

Smoke automat:
```bash
cd /opt/unicorn/UNICORN_FINAL && bash scripts/smoke-tests.sh https://zeusai.pro
bash scripts/smoke-topology.sh   # verifică headerele X-Unicorn-Role + /internal/topology
```

## 6. Acțiuni de follow-up pentru proprietar

- [ ] **Decide** dacă numărul țintă este 8 (catalog static actual) sau 25 (cum ai spus). Dacă e 25, deschide un issue separat: „Populate instant + enterprise catalog to 25 products on 3 tiers" — codul în `UNICORN_FINAL/src/commerce/{instant,enterprise}-catalog.js` permite extensia trivială.
- [ ] **Verifică** că `BACKEND_API_URL` este setat în ENV-ul site-ului (3001) pe server, altfel runtimul site nu poate hidrata marketplace din backend (3000) → catalog rămâne la 8.
- [ ] **Confirmă** că `pm2 list` arată două procese sănătoase: `unicorn-backend` (3000) și `unicorn-site` (3001) — vezi `ecosystem.config.js`.
- [ ] **Periodic**, rulează `git fsck` pe `/opt/unicorn` pentru a detecta corupții de filesystem care ar putea declanșa „live-sync" cu ștergeri masive.

## 7. Limitări declarate

Acest agent **nu poate**:
- să facă SSH pe `204.168.230.142`
- să interogheze direct baza de date de producție (utilizatori, produse, prețuri)
- să facă `git push` pe `main` în afara fluxului PR
- să declanșeze workflow-uri GitHub Actions (`workflow_dispatch`)
- să pornească/oprească procese pe Hetzner

Tot ce am putut face este să verific `main`, să confirm că remedierile sunt aplicate, să rulez lint + smoke local și să livrez acest raport. Restaurarea efectivă a site-ului depinde de pașii din §4 executați de proprietar sau de workflow-ul de deploy.
