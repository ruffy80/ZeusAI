# Forward-Only Deploy Contract

Acest repo folosește deploy forward-only pentru `UNICORN_FINAL`: nu face downgrade și nu rulează rollback automat peste stack-ul live.

## Reguli obligatorii

1. **No downgrade:** commitul candidat trebuie să fie descendent al baseline-ului live și al commitului deja deployat.
2. **Fail closed:** dacă preflight/canary/smoke eșuează, deploy-ul se oprește; nu revine automat la cod vechi.
3. **Canary înainte de promote:** candidatul pornește pe port separat (`CANARY_PORT`, default `3100`) și trebuie să treacă health/QIS înainte ca symlink-ul live să fie schimbat.
4. **Promote atomic:** `/var/www/unicorn/UNICORN_FINAL` se schimbă atomic doar după canary verde.
5. **PM2 canonic:** doar `unicorn-backend`, `unicorn-site`, `autoscaler`; fără procese legacy `unicorn` sau release-uri mixate.
6. **State persistent:** `.env`, `data`, `db`, `logs`, `backups`, `snapshots` sunt păstrate din release-ul live prin link-uri, ca deploy-ul să nu piardă date.
7. **Fallback-uri API scoped:** modulele nu au voie să monteze fallback global `app.use('/api/*')`; fallback-urile trebuie limitate la prefixele lor.

## Scripturi

- `npm run preflight:forward` — syntax checks, verificări require, rute critice, PM2/QIS contract, fallback-uri API nesigure.
- `npm run smoke:forward` — verifică `/health`, `/api/quantum-integrity/status`, PM2 topology și domeniul public.
- `npm run deploy:forward -- /path/to/candidate/UNICORN_FINAL /var/www/unicorn/UNICORN_FINAL` — canary + promote atomic + restart PM2 canonic + smoke final.

## Flux CI/CD

Workflow-ul principal `.github/workflows/deploy.yml`:

1. rulează no-downgrade guard;
2. rulează teste și `npm run preflight:forward`;
3. sincronizează candidatul într-un release nou;
4. rulează `scripts/deploy-atomic-forward.sh` pe server;
5. verifică smoke public/intern fără rollback automat.

Workflow-ul manual `.github/workflows/diagnose-and-repair.yml` repară doar proces state: pornește stack-ul canonic din `/var/www/unicorn/UNICORN_FINAL`, nu schimbă cod și nu face rollback.

## De ce nu rollback automat

Rollback-ul automat poate reintroduce cod vechi sau release-uri incomplete. Contractul actual preferă să blocheze promovarea înainte să atingă live-ul. Dacă un incident apare după promote, se face doar **forward fix**: un commit nou, validat prin același pipeline.
