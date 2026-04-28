# marketing-innovations — World-Standard Marketing Layer

Additive overlay on top of `autoViralGrowth` that turns the Unicorn into a
self-running, revenue-generating marketing agent more capable than most
mid-tier agencies.

> **Stability contract:** every route is **new** and lives under
> `/api/marketing/*` (plus `/go/<id>` for short-link redirects). The
> existing `autoViralGrowth` module, its `/api/autonomous/viral/*` routes,
> and all `/snapshot`/`/health`/`/stream` payload shapes are **untouched**.
> Disable globally with `MARKETING_PACK_DISABLED=1`.

## Why
The user request: *"adaugă inovații la acest modul să fie cel mai eficient,
inovativ și puternic agent de marketing al unicornului… să devină standard
mondial și să producă venituri pentru mine."*

Owner's BTC payout address (default): `bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e`
(overridable via `LEGAL_OWNER_BTC`).

## Sub-engines
| File | Capability |
|---|---|
| `content-multichannel.js` | Generates platform-tailored variants for X / LinkedIn / Reddit / TikTok / YouTube / Instagram / Email / SMS / Push / Facebook with deterministic seeded hooks, hashtags and CTAs. |
| `bandit-optimizer.js` | Multi-armed bandit (Thompson Sampling on Beta(α,β)) per campaign — picks the variant with the best posterior CTR. Records impressions, clicks, conversions, revenue. Persists to `data/marketing/bandit.jsonl`. |
| `seo-engine.js` | Long-tail keyword expansion, OG/Twitter meta tags, JSON-LD schema.org for Product / Organization / FAQPage / BreadcrumbList / WebSite. |
| `attribution.js` | Multi-touch attribution under 5 models (`first_touch`, `last_touch`, `linear`, `time_decay`, `position`/U-shape), LTV/CAC calculator with verdict (healthy / borderline / unsustainable), viral coefficient (k-factor) with 90-day projection. |
| `affiliate-revenue.js` | Affiliate program with HMAC-signed codes, UTM/short-link builder (`/go/<id>`), click & conversion ledger persisted to `data/marketing/affiliate-ledger.jsonl`. Computes commissions in USD → BTC → sats. **Owner platform fee** (`PLATFORM_FEE_PCT`, default 30%) is sent to `LEGAL_OWNER_BTC`. |
| `outreach-sentiment.js` | Influencer/PR/sales **outreach drafts** (never auto-sent), sentiment scoring (uses installed `sentiment` package or built-in mini-lexicon), growth-experiments registry. |
| `viral-amplifier.js` | **Maximum-force virality** booster: viral-loop registry (referral / content / marketplace / network / FOMO / BTC-payout), share-asset bundle (one-tap URLs for X / LinkedIn / Facebook / Reddit / Telegram / WhatsApp / Email / HackerNews), social-proof badges, computed `viralBoostFactor` (0–10), one-shot launch amplifier that wires content + bandit + affiliate + share assets together. |
| `self-innovation-loop.js` | **Permanent self-innovation engine.** Maintains a registry of viral strategies (channel × hook × CTA × incentive). Every cycle (`MARKETING_INNOVATION_CYCLE_MS`, default 60s) it scores all strategies (k-factor × revenue × CTR × shares), retires the bottom 10%, and spawns new candidate strategies via genetic-style mutation of top performers. Persists to `data/marketing/innovation-ledger.jsonl`. Auto-starts on require, disable with `MARKETING_INNOVATION_LOOP_DISABLED=1`. |

### v1.2 sub-engines (additive)

| File | Capability |
|---|---|
| `outbound-publisher.js` | Real outbound publishing adapters: Telegram / Discord / Mastodon / Bluesky / RSS / generic webhook. **Default dry-run** (`MARKETING_OUTBOUND_DRYRUN=1`); set to `0` to emit real traffic. Per-platform rate limit + circuit breaker. JSONL ledger at `data/marketing/outbound-ledger.jsonl`. |
| `ai-copywriter.js` | LLM-backed copy generator with deterministic fallback. If `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set, calls the provider; otherwise uses seeded variants from `content-multichannel`. SHA-256 prompt cache. |
| `media-forge.js` | Pure-SVG OG / social card generator (no native deps). Disk cache at `data/marketing/og-cache/<hash>.svg`. |
| `scheduler.js` | Best-time-to-post heuristics per channel (24h × 16 channels weight matrix) + drip queue. A single timer drains due items via `outbound-publisher`. Disable with `MARKETING_SCHEDULER_DISABLED=1`. |
| `engagement-bot.js` | Auto-engagement layer: drafts replies for inbound mentions/DMs, gated by sentiment score. Negative items are escalated (`escalate_owner`) instead of auto-replied. Whitelist / blacklist support. |
| `growth-experiments.js` | Landing-page A/B coordinator riding on `bandit-optimizer`. `create()` registers variants, `pickVariant()` returns Thompson-Sampled winner, `track()` forwards events. |
| `viral-coefficient-monitor.js` | Watchdog that samples k-factor and accelerates `self-innovation-loop` mutation when k drops below `MARKETING_VIRAL_K_FLOOR` for `MARKETING_VIRAL_WINDOW` consecutive samples. |
| `waitlist-mechanic.js` | Robinhood/Dropbox-style referral waitlist: each referral promotes the referrer by `MARKETING_WAITLIST_JUMP` slots. |
| `programmatic-seo.js` | Long-tail page generator (category × region grid) + sitemap.xml + IndexNow ping payload. |
| `influencer-crm.js` | Creator scoring (audience × engagement × fit → 0..100) with bronze / silver / gold / platinum tiers and tier-based commission. |
| `abuse-shield.js` | Self-referral / click-farm detection. Computes a per-key risk score 0..1 from fingerprint concentration, burstiness and self-referral rate. |
| `i18n-amplifier.js` | RO / EN / ES / FR / DE / IT / PT translation layer for marketing copy with `Accept-Language` parsing. |
| `metrics.js` | Prometheus-style text metrics aggregator at `/api/marketing/metrics?format=prom`. |
| `dashboard.js` | Server-rendered HTML dashboard at `/internal/marketing/dashboard` (token-gated). |
| `viral-feed-sse.js` | Server-Sent Events stream at `/api/marketing/viral/stream` for real-time event fanout. |
| `admin-toggle.js` | Runtime feature-flag store overriding env-var kill-switches. Routes `/api/marketing/admin/{toggle,flags}`. |

## HTTP routes
All token-gated routes accept `X-Owner-Token: <AUDIT_50Y_TOKEN>` or the same value via `Authorization: Bearer …`.

### Public
- `GET  /api/marketing/status`
- `GET  /api/marketing/channels`
- `GET  /api/marketing/content/variants?topic=&channels=X,LinkedIn&perChannel=2`
- `POST /api/marketing/content/variants`
- `GET  /api/marketing/bandit/best?campaign=launch1`
- `GET  /api/marketing/bandit/summary[?campaign=launch1]`
- `POST /api/marketing/bandit/track` — body: `{campaign, armId, event: impression|click|no_click|conversion, n?, revenueUsd?}`
- `GET  /api/marketing/seo/keywords?seed=AI%20automation&max=30`
- `GET  /api/marketing/seo/meta?title=&description=&url=`
- `POST /api/marketing/seo/jsonld` — body: `{type, data}`
- `POST /api/marketing/seo/page-bundle`
- `POST /api/marketing/attribution/touch` — body: `{sessionId, channel, campaign?, source?, medium?}`
- `POST /api/marketing/attribution/conversion` — body: `{sessionId, value}`
- `GET  /api/marketing/attribution/summary?model=time_decay&halfLifeMs=&sinceMs=`
- `POST /api/marketing/ltv-cac`
- `GET  /api/marketing/viral/k-factor?users=&invitesSent=&invitesAccepted=&cycleDays=`
- `POST /api/marketing/affiliate/link`
- `POST /api/marketing/affiliate/track` — body: `{event: click|conversion, code, amountUsd?}`
- `POST /api/marketing/outreach/{email,dm,press-release}`
- `POST /api/marketing/sentiment`
- `GET  /api/marketing/experiments`
- `POST /api/marketing/experiments/observe`
- `GET  /go/:shortId` → 302 redirect

### Owner-only (token-gated)
- `POST /api/marketing/affiliate/create`
- `GET  /api/marketing/affiliate/list`
- `GET  /api/marketing/affiliate/ledger`
- `GET  /api/marketing/owner/payout`
- `POST /api/marketing/experiments/register`
- `POST /api/marketing/experiments/close`
- `POST /api/marketing/viral/loops/register`
- `POST /api/marketing/innovation/tick` — manually run one self-innovation cycle
- `POST /api/marketing/innovation/strategies/add`

### Viral & innovation (additive in v1.1)
- `GET  /api/marketing/viral/status`
- `GET  /api/marketing/viral/boost`
- `POST /api/marketing/viral/amplify` — body: `{topic, url, channels?, perChannel?, affiliateCode?}` → returns variants + tracked links + share-bundle + boost
- `POST /api/marketing/viral/share-assets` — body: `{url, title, hashtag?}` → one-tap share URLs
- `GET  /api/marketing/viral/social-proof?users=&kFactor=&satsPaid=&...`
- `GET  /api/marketing/viral/loops`
- `POST /api/marketing/viral/loops/observe` — body: `{id, kFactor?, ctr?, shares?}`
- `GET  /api/marketing/viral/recent[?limit=20]`
- `GET  /api/marketing/innovation/status`
- `GET  /api/marketing/innovation/strategies[?status=&limit=]`
- `POST /api/marketing/innovation/observe` — body: `{id, kFactor?, ctr?, revenueUsd?, shares?}`

## Wiring (already done in `backend/index.js`)
```js
let _marketingPack = null;
try { _marketingPack = require('./modules/marketing-innovations'); }
catch (e) { console.warn('[marketing-pack] not loaded:', e.message); }
if (_marketingPack) app.use(_marketingPack.middleware());
```
For raw http servers (e.g. `src/index.js`):
```js
if (await _marketingPack.handle(req, res)) return;
```

## Environment variables
| Var | Default | Purpose |
|---|---|---|
| `MARKETING_PACK_DISABLED` | `0` | Set `1` to disable globally. |
| `MARKETING_INNOVATION_LOOP_DISABLED` | `0` | Set `1` to disable the auto-running self-innovation cycle. |
| `MARKETING_INNOVATION_CYCLE_MS` | `60000` | Self-innovation cycle interval (min 5000). |
| `MARKETING_INNOVATION_LEDGER` | `data/marketing/innovation-ledger.jsonl` | Innovation cycle persistence. |
| `MARKETING_AFFILIATE_SECRET` | `AUDIT_50Y_TOKEN` or built-in | HMAC secret for signed codes. |
| `MARKETING_BTC_USD` | `65000` | Default BTC/USD rate when no live rate is supplied. |
| `LEGAL_OWNER_BTC` | `bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e` | Owner BTC payout address. |
| `PLATFORM_FEE_PCT` | `0.3` | Owner cut on every conversion (0..1). |
| `MARKETING_BANDIT_FILE` | `data/marketing/bandit.jsonl` | Bandit event persistence. |
| `MARKETING_TOUCH_FILE` | `data/marketing/touchpoints.jsonl` | Attribution event persistence. |
| `MARKETING_AFFILIATE_FILE` | `data/marketing/affiliate-ledger.jsonl` | Affiliate ledger persistence. |
| `AUDIT_50Y_TOKEN` (or `OWNER_DASHBOARD_TOKEN`) | _(unset)_ | Required to access owner-only endpoints. |

## Tests
`npm test` (in `UNICORN_FINAL/`) runs `test/marketing-innovations.test.js`,
which exercises every sub-engine and verifies that `autoViralGrowth.getViralStatus()`
shape is preserved (no regression).

## Revenue path (TL;DR)
1. Generate variants → `POST /api/marketing/content/variants`.
2. Build affiliate links → `POST /api/marketing/affiliate/link`.
3. Track clicks/conversions → `POST /api/marketing/affiliate/track`.
4. Owner reads `/api/marketing/owner/payout` → totals in USD/BTC/sats sent to `LEGAL_OWNER_BTC`.
5. Bandit auto-promotes the highest-converting variants over time.
