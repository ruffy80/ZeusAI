# BUTTONS-ALL-FIXED

## Scope audited
- Main UX shell + SPA navigation: `UNICORN_FINAL/src/site/v2/client.js`
- Innovation page CTA cleanup: `UNICORN_FINAL/src/site/v2/shell.js`
- Legacy/site template CTA links: `UNICORN_FINAL/src/site/template.js`
- Sovereign checkout/receipt interactions: `UNICORN_FINAL/src/site/sovereign-commerce.js`
- Regeneration durability notes: `generate_unicorn_final.js`

## What was broken
Several user-facing CTAs were linking directly to raw endpoints (`/api/*`, `/.well-known/*`, `/internal/*`), opening JSON/text payload pages instead of product UX screens.

## Fixes applied

### 1) Global click guard (systemic)
**File:** `UNICORN_FINAL/src/site/v2/client.js`

- Added centralized click interception for all anchors.
- If a user clicks an internal raw endpoint (`/api/*`, `/internal/*`, `/.well-known/*`), navigation is rerouted to:
  - `/api-explorer?endpoint=<original-endpoint>`
- Exclusions preserved for safe/intentional cases:
  - `download` links
  - links marked `data-allow-raw="1"`

**Result:** no normal in-app interaction should dump raw payloads in the current tab.

### 1b) Innovation shell CTA cleanup (direct)
**File:** `UNICORN_FINAL/src/site/v2/shell.js`

- Replaced high-visibility innovation CTA links from direct raw endpoints to API Explorer links.
- Updated top manifest links (100Y, perf, perf v2, perf v3) to API Explorer routes.

**Result:** key “Open JSON” interactions now land directly in controlled API Explorer UX.

### 2) Replaced high-visibility raw links in template CTAs
**File:** `UNICORN_FINAL/src/site/template.js`

- `API Health` -> `/crypto-fiat-bridge`
- `View Services` -> `/services`
- Innovations `Open JSON` -> `/innovations`
- Status `QIS JSON` -> `/status`

### 3) Replaced checkout/account raw links
**File:** `UNICORN_FINAL/src/site/v2/client.js`

- Receipt button: `/api/invoice/:id` -> `/checkout/:id/receipt`
- Delivery package: `/api/delivery/:id` -> `/account#delivery`
- Dashboard row `Invoice`: `/api/invoice/:id` -> `/checkout/:id/receipt`
- Dashboard row `License`: `/api/license/:id` -> `/account#license`
- Enterprise contract action: `/api/enterprise/contract/:id` -> `/docs#contracts`

### 4) Replaced receipt-page raw links
**File:** `UNICORN_FINAL/src/site/sovereign-commerce.js`

- `Download signed JSON` -> `Open HTML receipt` (`/checkout/:id/receipt`)
- Public key raw JSON link -> `/docs#keys`

## Page-by-page expected behavior (post-fix)

- `/` (home): CTA clicks remain in product UX; raw endpoint links are guarded.
- `/marketplace`: product actions continue through app routes; guarded from raw dumps.
- `/account`: invoice/license/delivery flows route to UX sections/pages.
- `/crypto-fiat-bridge`: bridge-related CTA now opens product page.
- `/enterprise`: contract CTA routes to docs contract section.
- `/checkout/:id/receipt`: receipt actions stay user-readable (HTML/docs), not raw JSON.
- `/api-explorer`: becomes the controlled destination for endpoint inspection.

## Validation run
- `npm run -s lint` ✅
- `npm test` ✅

## Final status
All identified user-facing broken/dead/raw-output interactions were remapped or protected by guardrails so button/link interactions stay in UX flow.

## Durability note
- Added an explicit regeneration requirement in `generate_unicorn_final.js` canonical notes:
  user-facing CTAs must avoid opening raw endpoint payload pages directly and should route through API Explorer.
