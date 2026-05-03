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
  - Source of truth: this GitHub repo. Runtime target: Hetzner only (PM2 cluster behind nginx — `unicorn_backend:3000` + `unicorn_site:3001` on `zeusai.pro`).
  - No other deploy provider is used. Do **not** introduce or reactivate Vercel, Netlify, Render, Fly, etc. Any historical references in archived docs/scripts are stale.
- GitHub Actions deploy only to Hetzner from secrets (`HETZNER_*`) via `.github/workflows/deploy.yml` (SSH/rsync + PM2 reload).
- Auto-sync scripts (`scripts/start-auto-sync.sh`, `scripts/auto-sync-push.sh`) continuously `git add/commit/push`; avoid enabling/changing them unintentionally during feature work.

## Practical change strategy for AI agents
- If a fix must survive future regeneration, patch generator templates in `generate_unicorn_final.js`.
- If user asks for immediate runtime behavior in current generated app, patch `UNICORN_FINAL/` directly and run its `lint` + `test`.
- For API/UI consistency checks, validate `/snapshot` and `/stream` behavior because the HTML portal depends on those payload shapes.
