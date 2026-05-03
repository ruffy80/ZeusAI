# 🦄 Live Baseline — Last-Known-Good

**Pinned SHA:** `b72ff9b551b93ce8074835062fd9572110ed1529`
**Pinned date:** `2026-05-02 20:23 UTC`
**Pinned by:** restore commit on 2026-05-03

## Why this is pinned

This is the last commit on `main` that was simultaneously confirmed live by:

| Source | Run | Time UTC | Result |
|---|---|---|---|
| `🚀 Unicorn Stable Deploy` (`.github/workflows/deploy.yml`) | #557 | 2026-05-02 20:23 | ✅ success |
| `🌍 Global Availability Probe` (`.github/workflows/global-health.yml`) | #39 | 2026-05-02 20:05 | ✅ success |

Every commit and deploy run between this baseline and the day this file was
created (≈ 24h, 56 commits, 20 deploy attempts, 16 probe attempts) failed
or timed out — production at `https://zeusai.pro` was effectively offline
for that entire window.

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
