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
