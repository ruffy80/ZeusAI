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
3. The neutralized `scripts/auto-sync-push.sh` and the legacy live-sync
   launchers — the old push-to-git path still exits immediately, while the
   launcher names now resolve to the forward-only daemon in
   `UNICORN_FINAL/scripts/live-sync-forward.js`. The live filesystem on
   Hetzner can no longer push a stale snapshot back into git the way it did
   with commit `0dacd1c` (`live-sync: 2026-05-03 00:47:25` → -1216 lines).
4. The **AutoInnovation guard** in `no-downgrade-guard.yml` and the
   `deploy.yml` pre-flight: any commit whose subject begins with
   `[AutoInnovation]` between baseline and HEAD must carry the
   `[innovation-approved]` trailer in its body **or** be explicitly
   allowlisted in `.github/baselines/innovation-approved-shas.txt`
   (one SHA per line, optional trailing comment).
   Otherwise CI fails red and the deploy refuses to ssh-rsync.
   This stops the auto-innovation bot (which currently opens + auto-merges
   PRs from `auto-innovation/**` branches) from ever pushing unreviewed code
   to live, even if it merges to `main` via an external PAT.

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

## Emergency runtime rollback — `SITE_LEGACY_BASELINE_MODE=1`

Independent of the git-baseline pin above, the site worker
(`UNICORN_FINAL/src/index.js`) honors a single env knob that collapses
every post-`89a8b7f3` (2026-05-04 17:21 UTC) feature back to the exact
`89a8b7f3` baseline behavior, **without any code revert**:

```bash
SITE_LEGACY_BASELINE_MODE=1 pm2 restart unicorn-site --update-env
```

When set, the `legacyBaselineModeGuard` IIFE at the top of
`src/index.js` propagates these defaults (operator-set values are never
overwritten):

| Disabled | Restores |
|---|---|
| `SITE_COMPRESSION_DISABLED=1` | No gzip/brotli at the dispatcher level. |
| `SITE_ASSET_MEMCACHE_DISABLED=1` | `/assets/app.js` + `/assets/aeon.js` re-read from disk per request (pre-PR #515 behavior). |
| `SITE_PREDICTIVE_PREFETCH_DISABLED=1` | No HTTP 103 Early Hints, no `Link: rel=prefetch` extension. |
| `SITE_SPECULATION_RULES_DISABLED=1` | No `<script type="speculationrules">` in SSR `<head>`. |
| `SITE_RUM_BEACONS_DISABLED=1` | No Web Vitals collector script; `/internal/rum*` endpoints respond 204 / 503. |
| `PREFETCH_PERSIST_DISABLED=1` | No `data/perf/prefetch-graph.jsonl` read or write. |

This is the canonical answer to "give me the site exactly as it was 4.5
hours ago, with everything I added since untouched but inactive". The
PR #515 / PR #516 / prerender-gate code paths remain in the binary; the
guard only disables their runtime side effects. Each individual disable
knob can also be flipped on its own for surgical rollbacks.

Verified by `UNICORN_FINAL/test/legacy-baseline-mode.test.js`.


## Auto-advance log

This section is appended to by `.github/workflows/auto-baseline-advance.yml` after every verified-green deploy + global-health probe.

| When (UTC) | From | To |
|---|---|---|
| 2026-05-04 21:42 UTC | `9b8431a9bd83` | `3a69ee76eb68` |
| 2026-05-04 23:01 UTC | `3a69ee76eb68` | `59c71ef9f89d` |
| 2026-05-05 01:14 UTC | `59c71ef9f89d` | `2eaff4dba2c7` |
| 2026-05-05 18:55 UTC | `43b1653a69c7` | `884867178119` |
| 2026-05-05 20:13 UTC | `884867178119` | `908a2a1d495e` |
| 2026-05-06 15:17 UTC | `908a2a1d495e` | `7aa971ec6220` |
| 2026-05-06 17:07 UTC | `7aa971ec6220` | `e1002b5816f2` |
| 2026-05-06 19:12 UTC | `e1002b5816f2` | `2c361100ec0a` |
| 2026-05-06 22:04 UTC | `2c361100ec0a` | `d43f8e35daa9` |
| 2026-05-06 23:29 UTC | `d43f8e35daa9` | `c8d87a37295d` |
| 2026-05-08 08:12 UTC | `c8d87a37295d` | `6bdb1e01b162` |
| 2026-05-08 16:07 UTC | `fdd3cbd7a352` | `617785540540` |
| 2026-05-08 19:40 UTC | `617785540540` | `9a60e9c0b14d` |
| 2026-05-09 00:02 UTC | `9a60e9c0b14d` | `c03c2b8d63b3` |
| 2026-05-09 04:05 UTC | `5fd819719f1c` | `35d5c8111fd3` |
| 2026-05-09 14:21 UTC | `35d5c8111fd3` | `91e7540d4292` |
| 2026-05-09 15:36 UTC | `91e7540d4292` | `e711cf4b1de3` |
| 2026-05-09 18:34 UTC | `e711cf4b1de3` | `54cc7f05830b` |
| 2026-05-10 15:03 UTC | `51e42e33d927` | `44d99b4e3302` |
| 2026-05-10 16:05 UTC | `44d99b4e3302` | `4f4b375261e8` |
| 2026-05-10 19:16 UTC | `4f4b375261e8` | `8e5645ec8366` |
| 2026-05-13 16:32 UTC | `8e5645ec8366` | `33593faeb868` |
| 2026-05-13 20:27 UTC | `33593faeb868` | `43211f7439dd` |
| 2026-05-13 21:55 UTC | `43211f7439dd` | `2c79bcc5689e` |
| 2026-05-13 23:13 UTC | `2c79bcc5689e` | `ccc1ee2d11b8` |
| 2026-05-14 18:00 UTC | `ccc1ee2d11b8` | `f1c09a352fa4` |
| 2026-05-14 21:20 UTC | `f1c09a352fa4` | `b91b1299e3ac` |
| 2026-05-15 04:37 UTC | `b91b1299e3ac` | `5807a2d168cb` |
| 2026-05-15 08:12 UTC | `5807a2d168cb` | `cd998c7cb2b7` |
| 2026-05-15 10:35 UTC | `cd998c7cb2b7` | `3639f6e61a1e` |
| 2026-05-15 13:00 UTC | `3639f6e61a1e` | `9a7297d8a080` |
| 2026-05-15 22:04 UTC | `9a7297d8a080` | `509670550541` |
| 2026-05-16 15:04 UTC | `509670550541` | `e6ee42aee16b` |
| 2026-05-16 16:30 UTC | `e6ee42aee16b` | `a5bbc3f8800e` |
| 2026-05-16 19:16 UTC | `a5bbc3f8800e` | `706838c73499` |
| 2026-05-17 05:33 UTC | `706838c73499` | `528f1e88e100` |
| 2026-05-24 14:13 UTC | `528f1e88e100` | `aa487491ab71` |
| 2026-05-24 19:57 UTC | `aa487491ab71` | `9a1607ad5cf2` |
| 2026-05-26 15:22 UTC | `9a1607ad5cf2` | `941f7300531e` |
| 2026-05-26 16:17 UTC | `941f7300531e` | `c8526fd7d266` |
| 2026-05-26 16:31 UTC | `c8526fd7d266` | `66e5c265bf26` |
| 2026-05-26 16:44 UTC | `66e5c265bf26` | `73826fe06c09` |
| 2026-05-26 19:57 UTC | `73826fe06c09` | `ed651a5ddccf` |
| 2026-05-26 20:20 UTC | `ed651a5ddccf` | `7ca81aa9b991` |
| 2026-05-26 20:40 UTC | `7ca81aa9b991` | `b18f16629be3` |
| 2026-05-26 20:49 UTC | `b18f16629be3` | `3726fdc8b78f` |
| 2026-05-26 20:59 UTC | `3726fdc8b78f` | `ce94ebeb240b` |
| 2026-05-26 21:09 UTC | `ce94ebeb240b` | `147a5a9ebe7b` |
| 2026-05-26 21:18 UTC | `147a5a9ebe7b` | `ffa6a7df60a1` |
| 2026-05-26 21:27 UTC | `ffa6a7df60a1` | `0bfcd2a2abb9` |
| 2026-05-26 21:35 UTC | `0bfcd2a2abb9` | `a1beb3349da3` |
| 2026-05-26 21:43 UTC | `a1beb3349da3` | `81a083a72282` |
| 2026-05-26 21:51 UTC | `81a083a72282` | `6bf5c9dbe0dc` |
| 2026-05-26 22:01 UTC | `6bf5c9dbe0dc` | `7fc828f0dfed` |
| 2026-05-26 22:09 UTC | `7fc828f0dfed` | `fee998cf40c9` |
| 2026-05-26 22:17 UTC | `fee998cf40c9` | `03f1ee4f91c3` |
| 2026-05-26 22:25 UTC | `03f1ee4f91c3` | `5fcbd720ecd9` |
| 2026-05-26 22:34 UTC | `5fcbd720ecd9` | `91ff14f0ae87` |
| 2026-05-26 22:43 UTC | `91ff14f0ae87` | `5658e62c62ab` |
| 2026-05-26 22:52 UTC | `5658e62c62ab` | `7a3cda7a5609` |
| 2026-05-26 23:01 UTC | `7a3cda7a5609` | `2770379901da` |
| 2026-05-26 23:08 UTC | `2770379901da` | `c193c35672b8` |
| 2026-05-26 23:17 UTC | `c193c35672b8` | `60078fca7a3a` |
| 2026-05-26 23:25 UTC | `60078fca7a3a` | `5a162afca4df` |
| 2026-05-26 23:33 UTC | `5a162afca4df` | `66c8a0526d4f` |
| 2026-05-26 23:41 UTC | `66c8a0526d4f` | `ce4c16472139` |
| 2026-05-26 23:51 UTC | `ce4c16472139` | `633897d3a661` |
| 2026-05-27 00:00 UTC | `633897d3a661` | `a1e807bea6b9` |
| 2026-05-27 00:07 UTC | `a1e807bea6b9` | `d86ab5a79050` |
| 2026-05-27 00:16 UTC | `d86ab5a79050` | `02bed852bd5d` |
| 2026-05-27 00:25 UTC | `02bed852bd5d` | `798432df831e` |
| 2026-05-27 00:33 UTC | `798432df831e` | `66c2714d40e0` |
| 2026-05-27 00:42 UTC | `66c2714d40e0` | `60e42db37290` |
| 2026-05-27 00:51 UTC | `60e42db37290` | `77e251dc8811` |
| 2026-05-27 01:00 UTC | `77e251dc8811` | `625e4e2c043b` |
| 2026-05-27 01:08 UTC | `625e4e2c043b` | `4bc35843df57` |
| 2026-05-27 01:16 UTC | `4bc35843df57` | `3448bc0110f6` |
| 2026-05-27 01:25 UTC | `3448bc0110f6` | `7a36081f4181` |
| 2026-05-27 01:34 UTC | `7a36081f4181` | `f3a2d3aa76fc` |
| 2026-05-27 01:43 UTC | `f3a2d3aa76fc` | `8c06a6f92188` |
| 2026-05-27 01:53 UTC | `8c06a6f92188` | `c509a99fdd0d` |
| 2026-05-27 02:01 UTC | `c509a99fdd0d` | `f3bbeeb1040e` |
| 2026-05-27 02:10 UTC | `f3bbeeb1040e` | `cbeb45eb8226` |
| 2026-05-27 02:19 UTC | `cbeb45eb8226` | `a4ca89ebe3d9` |
| 2026-05-27 02:27 UTC | `a4ca89ebe3d9` | `83c927280b2b` |
| 2026-05-27 02:35 UTC | `83c927280b2b` | `de22b89ed4cf` |
| 2026-05-27 02:43 UTC | `de22b89ed4cf` | `277802f0f42f` |
| 2026-05-27 02:51 UTC | `277802f0f42f` | `2c53e1340358` |
| 2026-05-27 03:00 UTC | `2c53e1340358` | `0ffa1428915f` |
| 2026-05-27 03:09 UTC | `0ffa1428915f` | `10823a69b9df` |
| 2026-05-27 03:18 UTC | `10823a69b9df` | `e40fe92f1b7b` |
| 2026-05-27 03:27 UTC | `e40fe92f1b7b` | `924a313d9d68` |
| 2026-05-27 03:35 UTC | `924a313d9d68` | `b19e37a7d72c` |
| 2026-05-27 03:44 UTC | `b19e37a7d72c` | `449a23b3457e` |
| 2026-05-27 03:53 UTC | `449a23b3457e` | `64707bd3fea7` |
| 2026-05-27 04:03 UTC | `64707bd3fea7` | `a141b847b143` |
| 2026-05-27 04:11 UTC | `a141b847b143` | `321148877c46` |
| 2026-05-27 04:20 UTC | `321148877c46` | `1d94a510206f` |
| 2026-05-27 04:30 UTC | `1d94a510206f` | `97399e820d5b` |
| 2026-05-27 04:38 UTC | `97399e820d5b` | `dc1edfcfc971` |
| 2026-05-27 04:46 UTC | `dc1edfcfc971` | `bb3bf8ab8dbe` |
| 2026-05-27 04:55 UTC | `bb3bf8ab8dbe` | `6769e17557df` |
| 2026-05-27 05:04 UTC | `6769e17557df` | `52393dff811d` |
| 2026-05-27 05:12 UTC | `52393dff811d` | `e89954d3740f` |
| 2026-05-27 05:20 UTC | `e89954d3740f` | `c2adf1a7f903` |
| 2026-05-27 05:29 UTC | `c2adf1a7f903` | `ada3501d17d6` |
| 2026-05-27 05:38 UTC | `ada3501d17d6` | `63339a5987dd` |
| 2026-05-27 05:46 UTC | `63339a5987dd` | `1457754dbd05` |
| 2026-05-27 06:40 UTC | `1457754dbd05` | `3c252ac98e1f` |
| 2026-05-27 06:48 UTC | `3c252ac98e1f` | `899ed51d6c13` |
| 2026-05-27 06:56 UTC | `899ed51d6c13` | `93ce35a7d858` |
| 2026-05-27 07:07 UTC | `93ce35a7d858` | `96fcb73b8db7` |
| 2026-05-27 07:15 UTC | `96fcb73b8db7` | `66653ab569b9` |
| 2026-05-27 07:24 UTC | `66653ab569b9` | `5c3f0f46ac5c` |
| 2026-05-27 07:33 UTC | `5c3f0f46ac5c` | `cbff13ad445f` |
| 2026-05-27 07:50 UTC | `cbff13ad445f` | `4aaddbb13b0e` |
| 2026-05-27 07:58 UTC | `4aaddbb13b0e` | `3fb3a6e86b5e` |
| 2026-05-27 08:06 UTC | `3fb3a6e86b5e` | `40c14d455c30` |
| 2026-05-27 08:15 UTC | `40c14d455c30` | `b4485f1e14eb` |
| 2026-05-27 08:23 UTC | `b4485f1e14eb` | `85265f241023` |
| 2026-05-27 08:32 UTC | `85265f241023` | `2e7a249eff80` |
| 2026-05-27 08:41 UTC | `2e7a249eff80` | `dd291a24730b` |
| 2026-05-27 08:49 UTC | `dd291a24730b` | `b23ccb5c0124` |
| 2026-05-27 08:57 UTC | `b23ccb5c0124` | `ed3c8e77ec85` |
| 2026-05-27 09:06 UTC | `ed3c8e77ec85` | `cdbb17e75015` |
| 2026-05-27 09:16 UTC | `cdbb17e75015` | `a42e24c986b5` |
| 2026-05-27 09:25 UTC | `a42e24c986b5` | `6dcf3c6ddc6a` |
| 2026-05-27 09:33 UTC | `6dcf3c6ddc6a` | `66b3c813ff08` |
| 2026-05-27 09:42 UTC | `66b3c813ff08` | `77e16f4835d9` |
| 2026-05-27 09:50 UTC | `77e16f4835d9` | `6341688f6054` |
| 2026-05-27 09:59 UTC | `6341688f6054` | `e171fefaff9f` |
| 2026-05-27 10:09 UTC | `e171fefaff9f` | `2f46f18897ef` |
| 2026-05-27 10:18 UTC | `2f46f18897ef` | `48c28c7c60f2` |
| 2026-05-27 10:28 UTC | `48c28c7c60f2` | `b3d68bd9c6f5` |
| 2026-05-27 10:36 UTC | `b3d68bd9c6f5` | `429af31e3ba2` |
| 2026-05-27 10:45 UTC | `429af31e3ba2` | `0912796a4d93` |
| 2026-05-27 10:55 UTC | `0912796a4d93` | `f77e722a1a6d` |
| 2026-05-27 11:03 UTC | `f77e722a1a6d` | `5846fcfa40f2` |
| 2026-05-27 11:12 UTC | `5846fcfa40f2` | `a03ca6dc8e47` |
| 2026-05-27 11:20 UTC | `a03ca6dc8e47` | `00c39bfbc771` |
| 2026-05-27 11:28 UTC | `00c39bfbc771` | `f301cb6ecf0f` |
| 2026-05-27 11:38 UTC | `f301cb6ecf0f` | `1cc13e7fd2fd` |
| 2026-05-27 11:52 UTC | `1cc13e7fd2fd` | `f0eafe9be662` |
| 2026-05-27 12:03 UTC | `f0eafe9be662` | `0ce30d7234fb` |
| 2026-05-27 12:16 UTC | `0ce30d7234fb` | `eb7425b89539` |
| 2026-05-27 12:26 UTC | `eb7425b89539` | `6ce385bc2ae9` |
| 2026-05-27 12:35 UTC | `6ce385bc2ae9` | `c9d07ee60c8c` |
| 2026-05-27 12:46 UTC | `c9d07ee60c8c` | `52a4364e4d55` |
| 2026-05-27 13:00 UTC | `52a4364e4d55` | `5b1eb8519694` |
| 2026-05-27 13:09 UTC | `5b1eb8519694` | `1cc8533e5bd0` |
| 2026-05-27 13:19 UTC | `1cc8533e5bd0` | `60a1b17b4b52` |
| 2026-05-27 13:28 UTC | `60a1b17b4b52` | `b99f16f1270d` |
| 2026-05-27 13:37 UTC | `b99f16f1270d` | `7541de4d4f34` |
| 2026-05-27 13:46 UTC | `7541de4d4f34` | `83225d4605fc` |
| 2026-05-27 13:55 UTC | `83225d4605fc` | `5dbeaf7a8d7d` |
| 2026-05-27 14:04 UTC | `5dbeaf7a8d7d` | `7e5eafae2a18` |
| 2026-05-27 14:13 UTC | `7e5eafae2a18` | `0e5ff1dd778e` |
| 2026-05-27 14:22 UTC | `0e5ff1dd778e` | `827bf085cbc3` |
| 2026-05-27 14:31 UTC | `827bf085cbc3` | `943324f09882` |
| 2026-05-27 14:41 UTC | `943324f09882` | `617979e7650e` |
| 2026-05-27 14:49 UTC | `617979e7650e` | `9453469990ab` |
| 2026-05-27 15:00 UTC | `9453469990ab` | `9c5aae78d324` |
| 2026-05-27 15:09 UTC | `9c5aae78d324` | `d6113742d59e` |
| 2026-05-27 15:18 UTC | `d6113742d59e` | `63a7a00c2672` |
| 2026-05-27 15:28 UTC | `63a7a00c2672` | `5ef31e749b4d` |
| 2026-05-27 15:37 UTC | `5ef31e749b4d` | `3e7f9899dcd6` |
| 2026-05-27 15:45 UTC | `3e7f9899dcd6` | `7d00711d9cfc` |
| 2026-05-27 15:57 UTC | `7d00711d9cfc` | `96dddcf42f71` |
| 2026-05-27 16:06 UTC | `96dddcf42f71` | `804931b54d74` |
| 2026-05-27 16:14 UTC | `804931b54d74` | `07370bd0a55d` |
| 2026-05-27 16:24 UTC | `07370bd0a55d` | `1d12d01181f9` |
| 2026-05-27 16:33 UTC | `1d12d01181f9` | `be6ebfdd757f` |
| 2026-05-27 16:43 UTC | `be6ebfdd757f` | `33b4995826d8` |
| 2026-05-27 16:51 UTC | `33b4995826d8` | `a6ec7ac90468` |
| 2026-05-27 16:59 UTC | `a6ec7ac90468` | `d0b69f3183fb` |
| 2026-05-27 17:08 UTC | `d0b69f3183fb` | `0d4258c190cb` |
| 2026-05-27 17:17 UTC | `0d4258c190cb` | `69caf643eaab` |
| 2026-05-27 17:26 UTC | `69caf643eaab` | `0788d06dba1f` |
| 2026-05-27 17:34 UTC | `0788d06dba1f` | `a0ff27d2823d` |
| 2026-05-27 17:44 UTC | `a0ff27d2823d` | `f19690f1d865` |
| 2026-05-27 17:53 UTC | `f19690f1d865` | `d45c6758e895` |
| 2026-05-27 18:02 UTC | `d45c6758e895` | `b38ef08dd68c` |
| 2026-05-27 18:10 UTC | `b38ef08dd68c` | `cf967d546c5b` |
| 2026-05-27 18:19 UTC | `cf967d546c5b` | `e001d16e17dc` |
| 2026-05-27 18:28 UTC | `e001d16e17dc` | `94b6600d72d4` |
| 2026-05-27 18:38 UTC | `94b6600d72d4` | `04d8faa5572d` |
| 2026-05-27 18:47 UTC | `04d8faa5572d` | `ac423527ab91` |
| 2026-05-27 18:57 UTC | `ac423527ab91` | `7ff16fee713f` |
| 2026-05-27 21:08 UTC | `7ff16fee713f` | `93378af69603` |
| 2026-05-27 21:16 UTC | `93378af69603` | `863c17492dfd` |
| 2026-05-27 21:27 UTC | `863c17492dfd` | `1369764ebe23` |
| 2026-05-27 21:35 UTC | `1369764ebe23` | `0e400c7b4460` |
| 2026-05-27 21:43 UTC | `0e400c7b4460` | `84c149bceacf` |
| 2026-05-27 21:52 UTC | `84c149bceacf` | `6a26dc94fec5` |
| 2026-05-27 22:02 UTC | `6a26dc94fec5` | `300cba5fc70d` |
| 2026-05-27 22:11 UTC | `300cba5fc70d` | `87d7a6a49c7c` |
| 2026-05-27 22:20 UTC | `87d7a6a49c7c` | `c01cc27a1dc1` |
| 2026-05-27 22:28 UTC | `c01cc27a1dc1` | `13ab9fb75290` |
| 2026-05-27 22:37 UTC | `13ab9fb75290` | `3abb1857bee9` |
| 2026-05-27 22:45 UTC | `3abb1857bee9` | `82a1b9b5b56e` |
| 2026-05-27 22:54 UTC | `82a1b9b5b56e` | `e06816770057` |
| 2026-05-27 23:03 UTC | `e06816770057` | `c5181bf8eef0` |
| 2026-05-27 23:12 UTC | `c5181bf8eef0` | `59544f7bfc22` |
| 2026-05-27 23:20 UTC | `59544f7bfc22` | `43a4f28ba335` |
| 2026-05-27 23:29 UTC | `43a4f28ba335` | `bf112b7a81cd` |
| 2026-05-27 23:39 UTC | `bf112b7a81cd` | `998dd968b17e` |
| 2026-05-27 23:47 UTC | `998dd968b17e` | `ba399647e488` |
| 2026-05-27 23:56 UTC | `ba399647e488` | `26dae11ed941` |
| 2026-05-28 00:04 UTC | `26dae11ed941` | `97b6b0ca8df0` |
| 2026-05-28 00:14 UTC | `97b6b0ca8df0` | `b2dc3f5698d1` |
| 2026-05-28 00:23 UTC | `b2dc3f5698d1` | `e79801f09d8f` |
| 2026-05-28 16:12 UTC | `e79801f09d8f` | `d4484e1b7a01` |
| 2026-05-28 16:22 UTC | `d4484e1b7a01` | `b2a425dd2d14` |
| 2026-05-28 16:31 UTC | `b2a425dd2d14` | `528045e658eb` |
| 2026-05-29 01:41 UTC | `528045e658eb` | `e1c7f93a3837` |
| 2026-05-29 01:50 UTC | `e1c7f93a3837` | `46e3b8d3364d` |
| 2026-05-29 02:00 UTC | `46e3b8d3364d` | `53b8a561411c` |
| 2026-05-29 02:08 UTC | `53b8a561411c` | `ab6802441a71` |
| 2026-05-29 02:17 UTC | `ab6802441a71` | `9241f1701606` |
| 2026-05-29 02:26 UTC | `9241f1701606` | `d51ad235cf44` |
| 2026-05-29 02:35 UTC | `d51ad235cf44` | `2617c4359ea8` |
| 2026-05-29 02:45 UTC | `2617c4359ea8` | `40ba099a00fd` |
| 2026-05-29 02:55 UTC | `40ba099a00fd` | `83101c74c1e3` |
| 2026-05-29 03:03 UTC | `83101c74c1e3` | `80708d54e9eb` |
| 2026-05-29 03:12 UTC | `80708d54e9eb` | `1678fc0d49d1` |
| 2026-05-29 03:21 UTC | `1678fc0d49d1` | `f1023cb34e79` |
| 2026-05-29 03:30 UTC | `f1023cb34e79` | `d9f76ebbf18c` |
| 2026-05-29 03:38 UTC | `d9f76ebbf18c` | `0bcd7831ca78` |
| 2026-05-29 03:49 UTC | `0bcd7831ca78` | `4f1ae6af35d3` |
| 2026-05-29 03:58 UTC | `4f1ae6af35d3` | `563945b0aa2d` |
| 2026-05-29 04:08 UTC | `563945b0aa2d` | `38ae5d97d6a0` |
| 2026-05-29 04:16 UTC | `38ae5d97d6a0` | `c6268f13000e` |
| 2026-05-29 04:25 UTC | `c6268f13000e` | `b863393ecfb9` |
| 2026-05-29 04:35 UTC | `b863393ecfb9` | `a8f34b1ab380` |
| 2026-05-29 04:48 UTC | `a8f34b1ab380` | `f8206c32c1ad` |
| 2026-05-29 04:58 UTC | `f8206c32c1ad` | `78bcec02d878` |
| 2026-05-29 05:08 UTC | `78bcec02d878` | `cb9c03bc5aa1` |
| 2026-05-29 05:17 UTC | `cb9c03bc5aa1` | `c9d8fe7235ce` |
| 2026-05-29 05:26 UTC | `c9d8fe7235ce` | `ebb7148bb4bb` |
| 2026-05-29 05:35 UTC | `ebb7148bb4bb` | `dbeb2f7b4d04` |
| 2026-05-29 05:44 UTC | `dbeb2f7b4d04` | `684f9d7f13c2` |
| 2026-05-29 05:54 UTC | `684f9d7f13c2` | `2a77e9211c42` |
| 2026-05-29 06:04 UTC | `2a77e9211c42` | `3a458e7a6c91` |
| 2026-05-29 06:13 UTC | `3a458e7a6c91` | `9d381ae7bc0b` |
| 2026-05-29 06:22 UTC | `9d381ae7bc0b` | `1377ac04df4e` |
| 2026-05-29 06:31 UTC | `1377ac04df4e` | `1ac3e50b0aab` |
| 2026-05-29 06:41 UTC | `1ac3e50b0aab` | `ddee19c6bb52` |
| 2026-05-29 06:51 UTC | `ddee19c6bb52` | `6bb19734d997` |
| 2026-05-29 07:01 UTC | `6bb19734d997` | `daacc1ccb829` |
| 2026-05-29 07:10 UTC | `daacc1ccb829` | `f0298c407b12` |
| 2026-05-29 07:19 UTC | `f0298c407b12` | `3e5c8c5b6d20` |
| 2026-05-29 07:27 UTC | `3e5c8c5b6d20` | `2582bf654b16` |
| 2026-05-29 07:36 UTC | `2582bf654b16` | `08e078b04a0c` |
| 2026-05-29 07:45 UTC | `08e078b04a0c` | `0425cc129eb0` |
| 2026-05-29 07:55 UTC | `0425cc129eb0` | `cd579e7d3dea` |
| 2026-05-29 08:04 UTC | `cd579e7d3dea` | `0dd2e2d118b2` |
| 2026-05-29 08:12 UTC | `0dd2e2d118b2` | `84715b70c165` |
| 2026-05-29 08:22 UTC | `84715b70c165` | `bfa30d8f9350` |
| 2026-05-29 08:32 UTC | `bfa30d8f9350` | `8beecb32379e` |
| 2026-05-29 08:40 UTC | `8beecb32379e` | `e98f8becee6d` |
| 2026-05-29 08:49 UTC | `e98f8becee6d` | `b9c96fcf4b87` |
| 2026-05-29 08:59 UTC | `b9c96fcf4b87` | `7dfdda8c678f` |
| 2026-05-29 16:29 UTC | `7dfdda8c678f` | `0a9e785eec41` |
| 2026-05-29 16:39 UTC | `0a9e785eec41` | `64237fd04209` |
| 2026-05-29 20:37 UTC | `64237fd04209` | `b7dc6c73e6ce` |
| 2026-05-30 04:16 UTC | `b7dc6c73e6ce` | `b1324f6576c4` |
| 2026-05-30 08:39 UTC | `b1324f6576c4` | `ad9f66897837` |
| 2026-05-30 14:03 UTC | `ad9f66897837` | `40a3a270d234` |
| 2026-05-30 19:40 UTC | `40a3a270d234` | `d59235950256` |
| 2026-05-31 04:48 UTC | `d59235950256` | `dd453bd59413` |
| 2026-05-31 09:23 UTC | `dd453bd59413` | `59cd7ec64bdb` |
| 2026-05-31 14:09 UTC | `59cd7ec64bdb` | `cd6099821e5b` |
| 2026-06-02 16:54 UTC | `cd6099821e5b` | `b7e00f0f208d` |
| 2026-06-02 21:23 UTC | `b7e00f0f208d` | `67537c78573a` |
| 2026-06-03 05:14 UTC | `67537c78573a` | `33488b00323b` |
| 2026-06-03 11:22 UTC | `33488b00323b` | `60905ba09a62` |
| 2026-06-03 17:15 UTC | `60905ba09a62` | `84c25109df0f` |
| 2026-06-03 21:29 UTC | `84c25109df0f` | `3409d3bfcbc4` |
| 2026-06-04 05:03 UTC | `3409d3bfcbc4` | `9c09b2ee89d2` |
| 2026-06-04 10:11 UTC | `9c09b2ee89d2` | `1a7b97611d19` |
| 2026-06-04 15:39 UTC | `1a7b97611d19` | `ff45b10d1193` |
| 2026-06-04 20:22 UTC | `ff45b10d1193` | `c7ab4856c73e` |
| 2026-06-05 04:44 UTC | `c7ab4856c73e` | `af3694e99adf` |
| 2026-06-09 20:20 UTC | `af3694e99adf` | `2d1da8139d67` |
| 2026-06-10 04:45 UTC | `2d1da8139d67` | `13811041f27b` |
| 2026-06-10 10:22 UTC | `13811041f27b` | `f4cfc6ae2f51` |
| 2026-06-10 16:06 UTC | `f4cfc6ae2f51` | `4b9d440b5e4f` |
| 2026-06-12 01:27 UTC | `4b9d440b5e4f` | `efeac299d99b` |
| 2026-06-12 07:56 UTC | `efeac299d99b` | `0527e5aa277f` |
| 2026-06-12 13:28 UTC | `0527e5aa277f` | `0f928d6bb0e2` |
| 2026-06-12 18:56 UTC | `0f928d6bb0e2` | `941b4dc32f0e` |
| 2026-06-13 01:25 UTC | `941b4dc32f0e` | `0b767b2438f9` |
| 2026-06-13 07:34 UTC | `0b767b2438f9` | `1d38f5eaafe2` |
| 2026-06-13 12:53 UTC | `1d38f5eaafe2` | `eb744ad778dc` |
| 2026-06-13 18:45 UTC | `eb744ad778dc` | `4e9a97cb4867` |
| 2026-06-14 01:28 UTC | `4e9a97cb4867` | `3e6b3ade53ca` |
| 2026-06-14 07:53 UTC | `3e6b3ade53ca` | `0008dd3a6c52` |
| 2026-06-14 12:56 UTC | `0008dd3a6c52` | `889223eaccfd` |
| 2026-06-14 18:45 UTC | `889223eaccfd` | `7ec3eb992b55` |
| 2026-06-15 01:30 UTC | `7ec3eb992b55` | `282984a1581f` |
| 2026-06-15 08:28 UTC | `282984a1581f` | `71e8f1f9c433` |
| 2026-06-15 14:25 UTC | `71e8f1f9c433` | `4c15f141e622` |
| 2026-06-15 19:32 UTC | `4c15f141e622` | `8d0e1a0a0ddd` |
| 2026-06-16 01:31 UTC | `8d0e1a0a0ddd` | `209dd245d490` |
| 2026-06-16 08:20 UTC | `209dd245d490` | `38b3838793d5` |
| 2026-06-16 14:08 UTC | `38b3838793d5` | `6ad6999dcd78` |
| 2026-06-16 19:26 UTC | `6ad6999dcd78` | `7910abcd4699` |
| 2026-06-17 01:29 UTC | `7910abcd4699` | `69aca227b341` |
| 2026-06-17 08:12 UTC | `69aca227b341` | `24776bcc64db` |
| 2026-06-17 13:31 UTC | `24776bcc64db` | `32a81408e960` |
| 2026-06-17 19:07 UTC | `32a81408e960` | `1d154ef71c73` |
| 2026-06-18 01:26 UTC | `1d154ef71c73` | `e5043653c911` |
| 2026-06-18 08:01 UTC | `e5043653c911` | `a05d13ca42c2` |
| 2026-06-18 13:28 UTC | `a05d13ca42c2` | `c89b33773eff` |
| 2026-06-18 19:05 UTC | `c89b33773eff` | `7ba1e15117ff` |
| 2026-06-19 01:32 UTC | `7ba1e15117ff` | `5900bfeb62d6` |
| 2026-06-19 08:13 UTC | `5900bfeb62d6` | `130a909ddf69` |
| 2026-06-19 15:40 UTC | `130a909ddf69` | `fa86e8dad768` |
| 2026-06-19 20:02 UTC | `fa86e8dad768` | `ce98234a5795` |
| 2026-06-20 01:21 UTC | `ce98234a5795` | `383f9fef4432` |
| 2026-06-20 07:36 UTC | `383f9fef4432` | `e96f1afad73d` |
