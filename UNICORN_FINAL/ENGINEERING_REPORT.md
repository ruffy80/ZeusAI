# Engineering report — buyer pack honesty

Date: 2026-10-14. Branch: `cursor/pack-ready-honest-c3b6`.

## Baseline

A confirmed Bitcoin payment on the public checkout marks the order `paid` and creates a delivery row with `status: 'delivered'` before `fulfillReceipt` attaches a file. `enrichOrderStatus` treated that row as `deliveryReady`. The checkout poll then printed "Pack ready" and stopped. The order passport marked "Delivery pack issued" as soon as `status === 'paid'` and an entitlement id existed. The delivery email asked the portal for a token on the sovereign order id, got null, and linked to `/account` without the checkout `access_token` that `/api/delivery` accepts.

The Integrated Autonomy Kernel on the already-running local backend was healthy (`IAK/1.1`, 563/563). That process was not restarted and was not changed.

## Fixed

- `deliveryReady` is true only after the delivery row has an artifact file.
- The order passport keeps the last step at "Generating pack…" until `deliveryReady` or `artifactsReady` is true. A status of `delivered` / `activated` / `completed` still opens the card when the payload does not explicitly say the pack is missing.
- `buildDeliveryUrl` puts the sovereign checkout `access_token` on `/api/delivery/:orderId`. Portal account tokens remain the fallback when that checkout token is absent. The token is not written to the log line.

## Not changed

- Payment rails, prices, shelf copy, and `/api/health` fields.
- The registry row is still created with `status: 'delivered'` so existing delivery readers keep their contract. The buyer-facing flag is the seam that changed.
- No second orchestrator. No production deploy. No credentials added.
- Fulfillment AI still requires a real provider key. The deterministic markdown pack is a real file, and the UI calls it ready only after that file is attached.

## Verified

- `node test/money-pack-continuum.test.js` — 8 checks passed, including a paperwork row that stays `deliveryReady: false` until `attachArtifacts`.
- `node test/pay-fulfill-idempotent.test.js` — 12 checks passed. A checkout `access_token` builds `/api/delivery/:id?access_token=`. Mail stayed `email_unconfigured` because no provider key is set.
- `node test/site-spine-p1.test.js` — 8 checks passed. `/order/:id` still renders the passport.
- ESLint `--max-warnings=0` on the edited JavaScript files, including `shell.js`, exited 0.

Not run: the full `test:chain`. Not deployed. The live backend on port 3000 was not restarted, so production and that process still serve the previous checkout page.

## Shelf file shape

The public shelf stays the whole catalog. The $39 resume is one minute-clock file among the others, not the front door.

Each card on `/`, `/pricing`, `/services`, and `/buy` names the file payment unlocks today:

- A proposal figure says there is no checkout file.
- A day or contract engagement names the Project Kickoff Pack.
- A minute offer names the Service Activation Pack when no model key is armed for that SKU, and the recipe title when a key is armed.
- The old services block that promised an HTML audit, an SVG logo, and a finished SEO pack is gone. Those three names remain as part of the shelf, with the real file on the card.

After payment, the checkout page and the order passport (when the checkout token is in the URL) render the artifact text on the page. The text is inserted as text, not as HTML.

## Native concierge gate

The Integrated Autonomy Kernel remains the only orchestrator. Shelf advise, the ecosystem bond, and fulfillment packs were already native. Fulfillment still calls a model only for the six allowlisted minute SKUs when a real provider key is armed.

The remaining routine leak was `POST /api/concierge`. A set `BACKEND_API_URL` replaced the local reply for every intent except `catalog`, with no check that a provider key existed.

`src/commerce/native-ops-policy.js` (`NOP/1.0`) classifies those intents:

- Catalog, pricing, checkout, Bitcoin, PayPal, account, support, greetings, enterprise, compare, demo, security, growth, and automation stay on `composeReply`.
- `general`, `forecast`, and `roi` may call `POST /api/chat` only when `hasBillableLlm()` is true and the backend URL is set.
- Any other intent stays native. A missing key, a failed require, or a failed fetch keeps the local reply.

The JSON and stream responses add `nativeOps` (`protocol`, `external`, `billable`). Clients that ignore unknown fields are unchanged.

This does not make the platform fully autonomous. Payments, delivery files, and mail still require their own real rails. No second orchestrator. No production self-modification. No deploy. Category C is still a real model call when a key exists; the local template is the fallback, not a silent substitute for that call.

Verified on a local site (`PORT=3011`) pointed at a fake `POST /api/chat`:

- With no provider key, pricing, a general sentence, forecast, and roi stayed on `zeus-local-v30y` and did not call `/api/chat`.
- With a synthetic billable key, pricing and a catalog question stayed native. `general`, `forecast`, and `roi` called `/api/chat` and used that reply.
- `node test/native-ops-policy.test.js` — 5 checks passed. ESLint on the edited JavaScript exited 0.
## Receipt and invoice privacy

Baseline for this pass is `origin/main` at `8c7b1489`. The previous checkout in this workspace was `cursor/force-backend-redeploy-c3b6` at `4c3f094d`, 163 commits behind that main and 2442 commits on a diverged history. New work starts from main. Muse Wonder (max, high, and medium) could not start because the model usage limit was already spent, so this pass was done in the main agent.

Verified on main:

- `GET /api/uaic/receipts` with no email returned every stored receipt, including buyer emails. The same path with an email returned that buyer's full receipt rows to anyone.
- `GET /api/invoice/list` and `GET /api/invoice/:id` are public. Invoice ids are sequential. Each row includes `customerEmail` and `metadata`.
- `POST /api/alerts/test` and `POST /api/invoice/verify-now` had no admin gate. `POST /api/order/:id/simulate-payment` already uses `salesAdminGate`.

Changed:

- An email lookup returns whether that email and order id match. A missing email or a missing order id returns an error and no rows.
- A public receipt omits `email`, `customerId`, and `did`. Public invoice and QR responses keep the payment fields and omit `customerEmail` and `metadata`.
- The invoice list, the ledger status, the verifier tick, and the alert test require the existing admin gate.
- `/api/user/services`, `/api/customer/me`, and delivery download no longer treat `x-user-email` as proof of identity.

Not changed: `/api/health`, shelf prices, the concierge, payment confirmation, or production. A receipt fetched by its random id still returns that one receipt, because checkout and the passport use that id. The simulate-payment route stays admin-only. No deploy.

## Buyer identity is no longer a header

The receipt lookup now needs the email and the order id together. It answers only whether that pair matches. It does not return a count, so an email alone does not reveal how many orders exist. A public receipt omits `email`, `customerId`, and `did`. Checkout still reads status, amount, and the Bitcoin fields.

`GET /api/user/services` uses only a verified bearer token. A caller-supplied `x-user-email` or `?email=` is ignored. `/api/customer/me` uses the customer token or a verified cryptoauth token, not the header. Delivery download no longer accepts the buyer email header as a substitute for the access token.

Still open: `/api/omega/vault` and `/api/dna/strand` accept an email query and return that vault or strand. Those pages are built around that query. They need a signed-in buyer before they can stay useful and private. No deploy.
