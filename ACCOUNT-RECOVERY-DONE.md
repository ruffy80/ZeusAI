# Account Recovery — DONE ✅

**Status: LIVE pe https://zeusai.pro**
**Commit deploiat:** `9a38542` (build 2026-05-01T19-37 UTC, Hetzner)

---

## 1. Conturi permanente & globale — confirmat

### Stocare permanentă (SQLite WAL)
- Fișier: [`UNICORN_FINAL/data/commerce/portal.sqlite`](UNICORN_FINAL/data/commerce/portal.sqlite) — Write-Ahead Logging activ.
- Tabela `customers` (id, email UNIQUE NOCASE, password_hash bcrypt, created_at) este declarată la boot și backupată automat în `portal.json` ca migrare unică.
- Datele rezistă restart-urilor PM2, reboot-urilor Hetzner și redeploy-urilor (workflow-ul nu șterge `data/`).

### Sesiuni 30 de zile, cont permanent
- JWT semnat HS256, payload `{ cid, iat, exp: iat + 30·24·3600·1000 }` — vezi [`makeAuthResult` în customer-portal.js#L283](UNICORN_FINAL/src/commerce/customer-portal.js#L283).
- Cookie `customer_session` setat cu `Max-Age=2592000` (30 zile) la signup, login și reset-password — vezi `customerSessionCookie` în index.js.
- Contul în sine (rândul SQLite) **nu expiră niciodată**; doar tokenul de sesiune se reînnoiește la fiecare login.

### Login global (orice dispozitiv, orice țară)
- Test live efectuat (vezi `live-recover-test.js` pasul 2 și 10): aceeași combinație email + parolă a fost acceptată de două ori, fără cookie context, simulând două dispozitive diferite.
- Endpoint-ul `/api/customer/login` interoghează SQLite-ul global (un singur process PM2 pe Hetzner = un singur portal.sqlite), deci orice client din lume care lovește `https://zeusai.pro/api/customer/login` accesează aceeași sursă de adevăr.

---

## 2. Recuperare parolă — implementare completă

### Backend (`UNICORN_FINAL/src/commerce/customer-portal.js`)
Tabel nou `password_resets`:
```sql
token TEXT PRIMARY KEY,           -- 256 bit, hex, single-use
customer_id TEXT NOT NULL,
email TEXT NOT NULL,
expires_at INTEGER NOT NULL,      -- Date.now() + 1h
used INTEGER DEFAULT 0,
created_at TEXT NOT NULL,
ip TEXT
```

Trei funcții pure exportate:
- `createPasswordResetToken(email, {ip})` — generează 32 bytes random (hex 64), persistă, întoarce `{token, expiresAt}` sau `null` dacă emailul nu există în DB (caller-ul răspunde tot 200 ca să nu permită enumeration).
- `verifyPasswordResetToken(token)` — întoarce `{customerId, email, expiresAt}` sau `null` dacă tokenul e folosit / expirat / invalid.
- `consumePasswordResetToken(token, newPassword)` — într-o tranzacție SQLite: rescrie `customers.password_hash`, marchează `password_resets.used=1`, **invalidează TOATE celelalte tokenuri active pentru același customer** (defense in depth contra link-urilor leakate). Întoarce un JWT proaspăt — auto-login după resetare.

### Endpoints API (`UNICORN_FINAL/src/index.js`)
| Method | Path | Comportament |
|---|---|---|
| POST | `/api/customer/forgot-password` | Rate-limit 5/h/IP. Răspunde mereu 200 (anti-enumeration). Dacă emailul există → token + email transactional + log în pm2. |
| GET  | `/api/customer/reset-password/verify?token=…` | Pentru pagina de reset, verifică tokenul înainte ca user-ul să tasteze. |
| POST | `/api/customer/reset-password` | Body `{ token, password }`. La success: 200 + cookie 30d + JWT proaspăt. |

### Pagina `/reset-password`
- Standalone, self-contained, fără SPA dependency — vezi handler la [index.js#L6413+](UNICORN_FINAL/src/index.js).
- CSP strict (`script-src 'self' 'nonce-…'`), `noindex,nofollow`, `Cache-Control: no-store`.
- Validează tokenul on-load, cere parolă × 2, postează la `/api/customer/reset-password`, persistă tokenul de sesiune în `localStorage.u_cust_token` + `customerToken`, redirect la `/account`.

### Frontend login
- Adăugat link "Forgot password? / Ai uitat parola?" sub butonul Log in din [client.js renderAccountAuth](UNICORN_FINAL/src/site/v2/client.js#L3294).
- Toggle-ează un mini-form bilingual cu email + buton "Send reset link"; tratează `rate_limited` și erori de rețea cu mesaj clar.

### Email transport — mock fallback
> Mențiune cerută de mandat: SMTP nu este configurat în producția curentă pe Hetzner.

Soluția implementată:
1. Endpoint-ul tot încearcă `commerce/transactional-email.sendTransactional({template:'password_reset', …})`.
2. **Independent de succesul/eșecul SMTP**, link-ul complet este logat în pm2 stdout:
   ```
   [pwreset] token issued for live-recover-1777664374064@example.com · expires=2026-05-01T20:39:34.000Z · url=https://zeusai.pro/reset-password?token=… · emailed=false
   ```
3. Owner-ul poate citi log-ul cu `pm2 logs unicorn` (sau `journalctl`) pe Hetzner și livra link-ul manual până când SMTP-ul real este configurat.
4. Când va fi configurat un SMTP (SMTP_HOST/USER/PASS în `.env`), fluxul devine 100% automat fără modificare de cod.

---

## 3. Pop-up "Founders' brief" — eliminat permanent

### Ce s-a șters
- HTML modal `<div id="zeus-exit">` (10 linii) din [shell.js](UNICORN_FINAL/src/site/v2/shell.js).
- IIFE de mouseleave + handlere close/Escape/backdrop/submit (~80 linii).
- CSS dedicat `.zeus-exit*` (8 reguli).

### Defense in depth
Adăugat un cleanup defensiv care șterge orice `<div id="zeus-exit">` rămas din HTML cached:
```js
try {
  var staleExit = document.getElementById('zeus-exit');
  if (staleExit && staleExit.parentNode) staleExit.parentNode.removeChild(staleExit);
} catch(_){ }
```

### Verificare live
Test live `live-recover-test.js` pasul 9:
```
--- 9. Pop-up gone from homepage ---
  popup HTML present: false · text present: false
```
HTML-ul homepage-ului a scăzut de la 19 la 2 ocurențe `zeus-exit` (rămase: comentariul de eliminare + ID-ul defensiv în lookup) — niciuna nu produce DOM vizibil.

### Înlocuitor non-blocking
Newsletter-ul rămâne în footer (formă discretă, NU blochează interacțiunea), conform cerinței "mut-o într-un colț discret".

---

## 4. Verificări live — toate trec ✅

Test executat din browser/CLI împotriva `https://zeusai.pro` (vezi `/tmp/live-recover-test.js`):

| # | Scenariu | Rezultat |
|---|---|---|
| 1 | Signup `live-recover-1777664374064@example.com` | 200 + token JWT |
| 2 | Login pe "alt dispozitiv" (request fără cookie context) | 200 + token nou |
| 3 | Forgot-password cu email inexistent | 200 (anti-enumeration) |
| 4 | Forgot-password cu email real | 200 + log pm2 |
| 5 | Verify token bogus | `{valid:false}` |
| 6 | Reset cu token bogus | 400 `invalid_or_expired_token` |
| 7 | Reset cu parolă scurtă | 400 `password_too_short` |
| 8 | GET `/reset-password?token=…` randează formularul | 200 + form + script CSP-safe |
| 9 | Popup "founders' brief" prezent în HTML | **NU** (eliminat complet) |
| 10 | Login încă funcționează după ciclul complet | 200 + token |

Test isolated portal-level (`/tmp/test-pwreset.js`):
| Invariant | Rezultat |
|---|---|
| Signup → token issue → verify → consume | ✅ |
| Vechea parolă rejected după consume | ✅ `wrong_password` |
| Noua parolă funcționează | ✅ |
| Token reuse rejected | ✅ `invalid_or_expired_token` |
| Token bogus → null | ✅ |
| Email inexistent → null | ✅ |

---

## 5. Dovada permanenței

- Contul `live-recover-1777664374064@example.com` a fost creat la **2026-05-01 19:39:34 UTC** și se află acum în `portal.sqlite` pe Hetzner (`/var/www/unicorn/UNICORN_FINAL/data/commerce/portal.sqlite`).
- Acest fișier este SQLite WAL, care:
  - **NU este șters** la deploy (workflow-ul `hetzner-deploy.yml` face `rsync --exclude=data/`).
  - **NU este șters** la PM2 restart.
  - **NU este șters** la Hetzner reboot.
- Aceeași combinație email + parolă va funcționa peste 1 zi, peste 1 lună, peste 1 an — atât timp cât fișierul SQLite nu este șters manual.
- Pentru o garanție extra, există deja Disaster Recovery Autopilot (commit `4866d38`) care backupează `data/` periodic în `data/dr-backups/` (vezi `disaster-recovery.js`).

---

## 6. Deploy

- **Commit:** [`9a38542`](https://github.com/ruffy80/ZeusAI/commit/9a38542) — `feat(auth): permanent accounts + password recovery + remove founders' brief popup`.
- **CI:** GitHub Actions `hetzner-deploy.yml` → declanșat automat la push pe `main`.
- **Build verificat live:** `2026-05-01T19-37` (vezi `<meta zeus-build>` din HTML).
- **Endpoint-uri noi disponibile pentru toți utilizatorii din lume:**
  - `POST https://zeusai.pro/api/customer/forgot-password`
  - `GET  https://zeusai.pro/api/customer/reset-password/verify?token=…`
  - `POST https://zeusai.pro/api/customer/reset-password`
  - `GET  https://zeusai.pro/reset-password?token=…`

---

## 7. Pași pentru owner — flow complet de utilizat acum

### Crearea contului (orice dispozitiv, orice țară):
1. Vizitează https://zeusai.pro/account
2. Completează formularul "Create account" → cont creat instant, JWT 30 zile setat.

### Recuperare parolă:
1. La https://zeusai.pro/account, click "Forgot password? / Ai uitat parola?".
2. Introdu emailul → buton "Send reset link".
3. **Până când SMTP-ul este configurat:** loghează-te pe Hetzner cu `ssh root@<host>` apoi `pm2 logs unicorn | grep pwreset` — vei vedea linkul complet.
4. **După configurare SMTP:** linkul ajunge automat în inbox-ul utilizatorului în câteva secunde.
5. Deschide linkul → setează parolă nouă × 2 → submit → ești logat automat și redirecționat la `/account`.
6. Vechea parolă nu mai funcționează; tokenul de reset este invalidat după prima utilizare.

### Configurare SMTP (când va fi disponibil):
Adaugă în `.env` pe Hetzner:
```
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@zeusai.pro
```
și `pm2 restart unicorn`. Niciun cod nu trebuie schimbat — `commerce/transactional-email.js` detectează automat ENV-ul.

---

**Toate cerințele mandatului sunt satisfăcute. Sistemul este LIVE și FUNCȚIONAL pentru orice utilizator din lume.**
