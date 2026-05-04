# 🦄 Live Baseline — Last-Known-Good

**Pinned SHA:** `9b8431a9bd8325acfbead96bfe448881cd5db500`
**Pinned date:** `2026-05-04 16:05 UTC`
**Pinned by:** automation lock-in commit on 2026-05-04 (see PR
"observe-automated-activities") — advances baseline forward over the
restoration work merged 2026-05-04 13:54–16:05 UTC.

**Previous baseline:** `b72ff9b551b93ce8074835062fd9572110ed1529` (2026-05-02 20:23 UTC)

## Why this is pinned

This is the last commit on `main` that was simultaneously confirmed live by:

| Source | Run | Time UTC | Result |
|---|---|---|---|
| `🚀 Unicorn Stable Deploy` (`.github/workflows/deploy.yml`) | last on `9b8431a` | 2026-05-04 16:05 | ✅ success |
| Restoration sequence merged into `main` | `9a72cfd5` → `9b8431a9` | 2026-05-04 14:03–16:05 | ✅ success |

This pin captures the state immediately after the bulk restoration of
features rolled back by PR #492 (commit `9a72cfd5`) plus the subsequent
fixes that brought all six deploy attempts that day green:
auth-guardian loop neutralized (`9970f465`), `/api/catalog/master` routing
fixed (`3626fd21`), site-routed APIs restored (`8a3025e9`/`f49404dc`),
`/api/services` SSE announcer (`b51a787a`), and `/api/services` hydrated
from `buildMasterCatalog` (`9b8431a9`).

Pinning here means **no automation can ever revert `main` below this
state again** — including the `[AutoInnovation]` auto-merge bot, any
live-sync script (already neutralized), or any external runner using a
PAT.

## No-downgrade contract

`.github/baselines/live.sha` contains the SHA above as a single line. It is
read by:

1. `.github/workflows/no-downgrade-guard.yml` — runs on every push to `main`.
   Refuses any HEAD that is **not** a strict descendant of the pinned SHA.
2. The pre-flight step in `.github/workflows/deploy.yml` — refuses to
   ssh-rsync to Hetzner unless HEAD is a descendant of the pinned SHA.
3. The neutralized `scripts/auto-sync-push.sh` and friends — they exit
   immediately, so the live filesystem on Hetzner can never push a stale
   snapshot back into git the way it did with commit `0dacd1c`
   (`live-sync: 2026-05-03 00:47:25` → -1216 lines).
4. The **AutoInnovation guard** in `no-downgrade-guard.yml` and the
   `deploy.yml` pre-flight: any commit whose subject begins with
   `[AutoInnovation]` between baseline and HEAD must carry the
   `[innovation-approved]` trailer in its body. Otherwise CI fails red
   and the deploy refuses to ssh-rsync. This stops the auto-innovation
   bot (which currently opens + auto-merges PRs from `auto-innovation/**`
   branches) from ever pushing unreviewed code to live, even if it
   merges to `main` via an external PAT.

## How to advance the baseline (the only allowed direction)

After a new green deploy + green global probe at the same SHA:

```bash
git rev-parse HEAD > .github/baselines/live.sha
git add .github/baselines/live.sha LIVE_BASELINE.md
git commit -m "baseline(live): advance to <sha> [upgrade-approved]

verified by: deploy.yml run #<N>, global-health.yml run #<M>"
```

The `[upgrade-approved]` trailer is what unlocks the deletion guard for
the bumping commit itself, so the baseline file can be updated without
tripping the no-downgrade workflow.

### Automated advancement

`.github/workflows/auto-baseline-advance.yml` performs the bump
automatically once both gates are simultaneously green at the same SHA:

1. `🚀 Unicorn Stable Deploy` succeeded at SHA `X`.
2. `🌍 Global Availability Probe` succeeded at the same SHA `X`.
3. `X` is a strict descendant of the currently pinned baseline.

When all three hold, the workflow rewrites `.github/baselines/live.sha`,
appends a row to the auto-advance log below, and commits with the
`[upgrade-approved]` trailer so `no-downgrade-guard.yml` accepts the
bumping commit. Re-runs at the same SHA are idempotent. The workflow
also runs on a 1-hour `cron` schedule and is manually dispatchable with
an optional `force_sha` input for emergency forward rolls.

