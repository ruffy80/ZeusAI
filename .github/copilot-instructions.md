# Copilot instructions for generate-unicorn

## Big picture architecture
- This repo has one active production layer:
  - `UNICORN_FINAL/` — the generated product, validated/deployed in CI and containing all business logic. Runs on Hetzner via PM2.
- `generate_unicorn_final.js` is the canonical generator (explicitly documented in file header); use it for durable template-level changes.
- `UNICORN_FINAL/src/index.js` is a standalone Node HTTP server (no Express) that serves:
  - JSON APIs like `/health`, `/snapshot`, `/innovation`
  - SSE stream at `/stream`
  - Full UI HTML from `src/site/template.js`
- `UNICORN_FINAL/backend/index.js` is a separate Express runtime with many `/api/*` endpoints and module-based in-memory domain engines in `backend/modules/`.

## Critical workflows
- Root app:
  - `npm run dev` / `npm run start` → `node UNICORN_FINAL/src/index.js`
  - `npm run build` → UNICORN_FINAL lint + test
  - `npm test` → UNICORN_FINAL test suite
- Main generated app (`UNICORN_FINAL/`):
  - `npm run start` → `node src/index.js`
  - `npm test` → `node test/health.test.js && node test/api.test.js` (Node 20+ global `fetch`)
  - `npm run lint` → syntax checks via `node --check` (not ESLint)
  - `npm run innovation:report`, `npm run innovation:sprint`
- CI deploy path is centered on `UNICORN_FINAL/`:
  - `.github/workflows/hetzner-deploy.yml` — canonical push-to-main deploy, runs lint/test, SSH-deploys to Hetzner.
  - `.github/workflows/live.yml` — full bootstrap + deploy + SSL + health check (schedule + workflow_dispatch).

## Project-specific coding conventions
- Prefer plain Node + in-memory state for features unless persistence is already introduced:
  - Example: `users` array auth store in `UNICORN_FINAL/backend/index.js`.
- Endpoint style is explicit and grouped by domain blocks in `backend/index.js` (identity, negotiate, carbon, marketplace, payment, etc.); follow the same grouping/comments when adding routes.
- Keep generated UI server-side inline in `src/site/template.js` (single HTML string) rather than adding frontend frameworks inside `UNICORN_FINAL/src`.
- Preserve bilingual comments/logs (English + Romanian) where present; do not normalize naming unless requested.

## Integration boundaries and external systems
- Deployment automation is first-class:
  - `github-vercel-hetzner-connector.js` — historical connector script (Vercel is no longer used; Hetzner is the sole deployment target).
  - `setup-platform-auto-connect.sh` validates `.env.auto-connector` and bootstraps Hetzner runtime.
- GitHub Actions deploy only to Hetzner from secrets (`HETZNER_*`). Vercel integration is disabled (`vercel.json` sets `"github": { "enabled": false }`).
- Auto-sync scripts (`scripts/start-auto-sync.sh`, `scripts/auto-sync-push.sh`) continuously `git add/commit/push`; avoid enabling/changing them unintentionally during feature work.

## Practical change strategy for AI agents
- If a fix must survive future regeneration, patch generator templates in `generate_unicorn_final.js`.
- If user asks for immediate runtime behavior in current generated app, patch `UNICORN_FINAL/` directly and run its `lint` + `test`.
- For API/UI consistency checks, validate `/snapshot` and `/stream` behavior because the HTML portal depends on those payload shapes.

## Golden rules (enforced 2026-05-15)

These rules guarantee every change made by humans or AI agents lands LIVE on
https://zeusai.pro within minutes, with zero regression and full auditability.

1. **Durable fix → patch the generator.** Anything that must survive a regen
   of `UNICORN_FINAL/` belongs in `generate_unicorn_final.js`. After editing,
   run `node generate_unicorn_final.js` locally if regen is needed.
2. **Live runtime fix → edit `UNICORN_FINAL/` directly.** For hot-fixes on
   site/backend, edit under `UNICORN_FINAL/src/**`, `UNICORN_FINAL/backend/**`,
   commit and push. The workflow `.github/workflows/deploy.yml` auto-deploys
   to Hetzner on every `main` push that touches those paths.
3. **Push-to-main = production.** No manual SSH/rsync needed once the patch is
   committed. CI runs `node --check` + tests, rsyncs a new release dir,
   atomically switches `/var/www/unicorn/current`, then `pm2 reload` both
   clusters (`unicorn-backend` port 3000, `unicorn-site` port 3001).
4. **NEVER run auto-sync scripts.** `scripts/start-auto-sync.sh` and
   `UNICORN_FINAL/scripts/start-auto-sync.sh` are PERMANENTLY DISABLED. They
   used to `git add/commit/push` in a loop and corrupted feature work.
5. **CSP / Trusted Types contract.** Every server-rendered HTML page goes
   through `renderPage()` in `UNICORN_FINAL/src/index.js`, which injects the
   `default` Trusted Types policy BEFORE any inline `<script>`. All client
   `innerHTML` assignments must use server-escaped strings (helper `esc()`).
   Never remove this policy script or `/services`, `/pricing`,
   `/unicorn-cockpit`, `/revenue-command`, `/status`, `/proof` will silently
   break (stuck on "Catalog warming up").
6. **Resource monitor never kills backend.** `backend/modules/resource-monitor.js`
   uses `CPU_WARN_PCT=99` and only logs. Do not reintroduce `process.exit`,
   `kill`, or PM2-restart-on-CPU-spike logic.
7. **PM2 backend memory ≥ 2560M.** `ecosystem.config.js` reads
   `PM2_MAX_MEMORY` (env override). The server has it pinned to `2560M`,
   saved via `pm2 save`. Do not lower without measuring real RSS first.
8. **Domain truth: `zeusai.pro` only.** DNS on Cloudflare → 204.168.230.142.
   SSL via Let's Encrypt (`zeusai.pro-0001`). Ignore `zeusai.live` —
   unrelated/parked; never automate certs or nginx for it.
9. **Verify after every push.** Hard-refresh https://zeusai.pro/services and
   /pricing (≥ 1 service card with live USD+BTC price = success). For backend,
   curl `https://zeusai.pro/health` + `https://zeusai.pro/api/pricing/all`.
10. **Bilingual comments are intentional.** Romanian + English coexists in
    logs and code comments. Do not normalize.
