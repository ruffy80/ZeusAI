# Unicorn Instance Unification Report — 2026-08-01

## Instances found

### Workspace (`/workspace` = repo `ruffy80/ZeusAI`)
| Path | Kind | Modules | Action |
|------|------|---------|--------|
| `UNICORN_FINAL/` | **PRIMARY full app** | ~610 JS under `backend/modules` | **Kept / enhanced** |
| `/workspace` root | Thin wrapper (scripts, workflows, docs) | 0 app modules | **Kept** (not a second app) |
| `UNICORN_FINAL.zip`, `release/*.zip` | Stale April 2026 snapshots | obsolete | **Deleted** |
| `UNICORN_FINAL/modules/` | 3 orphan stubs (wrong path) | 3 | **Deleted** |
| `generated/`, `innovations/` | Auto stub JSON/MD residue | n/a | **Deleted** |
| `templates/`, `templates_saas_2026/` | Generator seeds (not runnable apps) | seeds | **Kept** (used by `generate_unicorn_final.js`) |
| `unicorn-backups/` | Runtime `.json.gz` data backups | n/a | **Kept local**, gitignored |

### Production server (Hetzner)
| Path | Kind | Modules | Action |
|------|------|---------|--------|
| `/var/www/unicorn/current` → `releases/<sha>/UNICORN_FINAL` | **Live primary** | 610 | **Kept** |
| `/var/www/unicorn/releases/*` (older) | Atomic deploy history | — | Pruned to **2** newest |
| `/var/www/unicorn_green` | Stale green slot (270 mods, unused by nginx) | 270 | **Archived + deleted** |
| `/var/www/unicorn/UNICORN_FINAL.prelink.*` | Old prelink tree | 244 | **Archived + deleted** |
| `/var/www/unicorn/deepseek-pr-worktree` | Old PR worktree | 336 | **Archived + deleted** |
| `/opt/zeus-autodeploy/repo` | Self-deploy poller clone | — | **Kept** (required) |
| `/opt/unicorn` | Ops tree for `stability-guardian.service` | sandbox only | **Kept** (systemd dependency; inactive unit) |

No second full product tree existed in the git workspace. Unification = restore stubbed modules from green + delete obsolete duplicates.

## Primary chosen
**`UNICORN_FINAL`** — only complete instance: 610 modules, full `src/` SSR + `client/`, 145 scripts, deploy workflows at repo root.

## Modules — correction (2026-08-01 CI follow-up)
An earlier pass restored ~18 “stub-sized” files from `unicorn_green`. That was **wrong**:
those files were intentional thin shims to `supreme-*-adapter` / `integrated-autonomy-kernel`,
not self-mutation damage. Restoring the green bodies broke IAK singleton identity
(`unicornMeshOrchestrator` must `===` IAK) and failed deploy CI.

**Reverted to shim form (pre-unify):**
`ai-self-healing`, `auto-innovation-loop`, `auto-optimize`, `auto-repair`,
`autonomousInnovation`, `code-optimizer`, `error-pattern-detector`, `evolution-core`,
`predictive-healing`, `quantum-healing`, `recovery-engine`, `recovery-orchestrator`,
`self-healing-engine`, `service-watchdog`, `shadow-tester`, `ui-evolution`,
`unicornInnovationSuite`, `unicornMeshOrchestrator`.

## Conflicts resolved
| Module | Decision |
|--------|----------|
| `aiProviders`, `referralEngine`, `unicornAutoGenesis`, `totalSystemHealer`, `universalMarketNexus` | **Kept primary** (already substantial / newer) |
| `central-orchestrator`, `unicornOrchestrator` | Kept IAK facet shims |
| Green “fuller” copies of supreme/IAK shim names | **Rejected** — would regress IAK |
| `universal-ai-connector` template | Already covered by `universalAIConnector.js` + `universal-ai-connector/` |
| `globalEnergyCarbonTrade` template stub | Covered by `globalEnergyCarbonTrader.js` |

## Frontend / workflows / scripts
No missing frontend pages or GitHub workflows in secondaries. Root `.github/workflows` (20) + `UNICORN_FINAL/scripts` remain the single source.

## Deleted
**Workspace:** zip snapshots, orphan `UNICORN_FINAL/modules`, root `generated/`, root `innovations/`.  
**Server:** `unicorn_green`, prelink tree, deepseek worktree, 3 old releases, dead `module-mesh-guardian` PM2 app.  
Archives under `/var/www/unicorn/_unify_archive_2026-08-01/` for rollback.

## Verification
- `unicorn-backend` / `unicorn-site` healthy after restore + restart
- `DISABLE_SELF_MUTATION=1` already set on live backend
