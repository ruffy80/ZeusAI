# VERSION-FIXED

Data: 2026-05-02

## 1) Verificare versiune live pe Hetzner
- Comandă: `cd /opt/unicorn && git log -1 --oneline`
- Rezultat live inițial: `130f674 live-sync: 2026-05-02 22:48:45`
- Ultimul commit `origin/main`: `b72ff9b551b93ce8074835062fd9572110ed1529`
- Concluzie: serverul era pe o versiune diferită (mai veche/stale).

## 2) Deploy forțat executat
Am executat secvența cerută pe server:
- `docker-compose down`
- `docker system prune -a -f`
- `git fetch origin`
- `git reset --hard origin/main`
- `git clean -fd`
- `docker-compose up -d --build --force-recreate`

Observație: ultimul pas Docker a eșuat deoarece `/opt/unicorn/.env` lipsea după reset (`Couldn't find env file: /opt/unicorn/.env`).
Repo-ul a fost totuși aliniat la `origin/main` (HEAD = `b72ff9b...`). Runtime-ul activ rămâne PM2 (site+backend), unde am aplicat fixurile și restart controlat.

## 3) Eliminare cache versiune veche
### Nginx
- Fișier patch-uit: `/etc/nginx/sites-enabled/zeusai.conf`
- Am adăugat `Cache-Control: no-cache, no-store, must-revalidate` pentru răspunsurile site-ului (`location /`) și pentru `.html`.
- `nginx -t` OK + reload efectuat.

### Meta tags no-cache în `<head>`
Am adăugat:
- `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/>`
- `<meta http-equiv="Pragma" content="no-cache"/>`
- `<meta http-equiv="Expires" content="0"/>`

în:
- `UNICORN_FINAL/src/site/template.js`
- `UNICORN_FINAL/src/site/v2/shell.js`

și am sincronizat fișierele pe server în:
- `/var/www/unicorn/UNICORN_FINAL/src/site/...`
- `/opt/unicorn/UNICORN_FINAL/src/site/...`

### Cloudflare
- Verificare headere publice: nu apare `cf-ray` / `cf-cache-status`; `server: nginx/1.18.0`.
- Concluzie: nu există Cloudflare activ în fața domeniului în acest moment (nu se aplică Page Rule aici).

## 4) Deploy atomic (symlink)
- Am convertit pointerul `/var/www/unicorn/current` în symlink atomic către release-ul activ.
- Pointer activ confirmat:
  - `/var/www/unicorn/current -> /var/www/unicorn/releases/b72ff9b551b93ce8074835062fd9572110ed1529-1777753505`
- Am întărit și pipeline-ul CI (`.github/workflows/deploy.yml`) ca la deploy să comute atomic atât:
  - `/var/www/unicorn/UNICORN_FINAL`
  - cât și `/var/www/unicorn/current`

## 5) Verificare finală cache-control
- Comandă: `curl -I https://zeusai.pro/ | grep -i cache-control`
- Rezultat:
  - `cache-control: no-cache, no-store, must-revalidate`

## 6) Restart runtime live
- `pm2 restart unicorn-site --update-env`
- `pm2 restart unicorn-backend --update-env`
- `pm2 save --force`

Status: FIX APLICAT. Răspunsurile pentru homepage sunt acum marcate explicit no-cache și pointerele de release sunt atomice.

## 7) Remediere automată erori apărute în deploy-ul Docker
- Problemă 1: build-ul Docker eșua deoarece hook-ul `prepare` din `UNICORN_FINAL/package.json` rula `git config` într-un context fără `.git`.
  - Fix aplicat: scriptul `prepare` este acum resilient (`husky skipped (no .git)` în Docker).
- Problemă 2: build-ul Docker necesita `git` în imagine.
  - Fix aplicat: în `Dockerfile` am adăugat `RUN apk add --no-cache git`.
- Problemă 3: conflict de port (`0.0.0.0:3000 already in use`) între stack Docker și runtime-ul activ PM2.
  - Fix aplicat: am oprit stack-ul Docker parțial pornit și am stabilizat runtime-ul live pe PM2 (`unicorn-site`, `unicorn-backend`), cu restart + `pm2 save`.

## 8) Verificare finală extinsă
- `git rev-parse HEAD` pe `/opt/unicorn` = `b72ff9b551b93ce8074835062fd9572110ed1529` (aliniat cu main).
- `readlink -f /var/www/unicorn/current` și `readlink -f /var/www/unicorn/UNICORN_FINAL` indică același release activ.
- `curl -I https://zeusai.pro/` livrează `cache-control: no-cache, no-store, must-revalidate`.
