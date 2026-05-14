# 🦄 ZeusAI · Golden Rules (locked 2026-05-15)

Every change — human or AI agent — must obey these 10 rules so the patch
lands LIVE on https://zeusai.pro automatically, with zero regression.

| # | Rule | Why |
|---|---|---|
| 1 | **Durable fix → patch the generator.** Edit `generate_unicorn_final.js`. | Survives regen of `UNICORN_FINAL/`. |
| 2 | **Live runtime fix → edit `UNICORN_FINAL/` directly.** | Auto-deploys via `.github/workflows/deploy.yml` on `main` push. |
| 3 | **Push-to-main = production.** No manual SSH/rsync. | CI runs `node --check` + tests, rsyncs new release, `pm2 reload`. |
| 4 | **NEVER run auto-sync scripts.** Both `start-auto-sync.sh` files are disabled. | Past loops corrupted features + spammed CI. |
| 5 | **CSP / Trusted Types contract.** `renderPage()` in `UNICORN_FINAL/src/index.js` injects the `default` TT policy before any inline `<script>`. | Without it `innerHTML` throws and `/services`, `/pricing`, `/unicorn-cockpit`, `/revenue-command`, `/status`, `/proof` stay stuck on "Catalog warming up". |
| 6 | **Resource monitor never kills backend.** `CPU_WARN_PCT=99`, log only. | Past CPU spikes triggered PM2 restart loops. |
| 7 | **PM2 backend memory ≥ 2560M.** `PM2_MAX_MEMORY=2560M` saved. | Lower values cause OOM kills under real load. |
| 8 | **Domain truth: `zeusai.pro` only.** Cloudflare → 204.168.230.142, LE cert `zeusai.pro-0001`. | Ignore `zeusai.live` — unrelated/parked. |
| 9 | **Verify every push** with `curl https://zeusai.pro/health` + hard-refresh `/services` + `/pricing` in a real browser. | Curl-only checks miss client-side render bugs. |
| 10 | **Bilingual comments are intentional.** RO + EN coexist. | Project convention; never normalize. |

## Auto-deploy contract

Push to `main` touching any of:

- `UNICORN_FINAL/src/**` · `UNICORN_FINAL/backend/**` · `UNICORN_FINAL/client/**`
- `UNICORN_FINAL/scripts/**` · `UNICORN_FINAL/templates/**` · `UNICORN_FINAL/templates_saas_2026/**`
- `UNICORN_FINAL/package.json` · `UNICORN_FINAL/package-lock.json`
- `UNICORN_FINAL/ecosystem.config.js` · `UNICORN_FINAL/Dockerfile` · `UNICORN_FINAL/.nvmrc`
- `generate_unicorn_final*.js` · `github-vercel-hetzner-connector.js` · `setup_hetzner.js`
- `scripts/**` · `.github/workflows/deploy.yml`

→ Triggers `.github/workflows/deploy.yml`:

1. Checkout + Node 20 setup
2. `npm ci` + `node --check` lint + tests
3. SSH to Hetzner (`204.168.230.142`) using `HETZNER_*` secrets
4. Rsync to `/var/www/unicorn/releases/<sha>-<ts>/`
5. Atomic symlink swap → `/var/www/unicorn/current`
6. `pm2 reload unicorn-backend unicorn-site --update-env`
7. Health-check: `curl -fsS https://zeusai.pro/health`

If any step fails, the previous release stays active. Zero downtime.

## What an AI agent must do for every task

1. Read context (semantic / grep).
2. Make the minimal patch in the right place per rule 1 or 2.
3. `node --check` the touched JS file.
4. `git add` only the touched files. Avoid mass-staging.
5. `git commit -m "<type>(<scope>): <subject>"` (conventional commits).
6. `git pull --rebase origin main` (handle conflicts with `--ours` on
   data files like `*.jsonl` under `data/` if they conflict).
7. `git push origin main`.
8. Wait ~2-3 min, verify with curl + browser hard-refresh.
9. Update this file if a new rule emerges from the fix.

## Forbidden actions

- ❌ Re-enabling auto-sync scripts
- ❌ Removing/weakening the Trusted Types default policy
- ❌ Adding `process.exit` / `process.kill` in `resource-monitor.js`
- ❌ Lowering `PM2_MAX_MEMORY` below 2560M
- ❌ Touching `zeusai.live` DNS, nginx, or certs
- ❌ Manual SSH edits to `/var/www/unicorn/current/*` (drift risk)
- ❌ Force-pushes to `main`
