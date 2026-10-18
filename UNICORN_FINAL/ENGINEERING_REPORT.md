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

`/api/omega/vault`, vault search, `/api/dna/strand`, and DNA personalize, observe, and settings now require the signed-in buyer's proven email, or a commerce/admin secret. A query email that does not match that account returns `email_mismatch` and no record. `/api/dna/search` is admin-only because it lists other strands. The vault and DNA pages ask for `/account` instead of `?email=`. Anonymous `?email=` is not a login.

## Native capability desk

`NCD/1.0` (`backend/modules/native-capability-desk.js`) is one desk in front of organs that already exist. The Integrated Autonomy Kernel stays the only orchestrator. `GET /api/native-desk/status` and `POST /api/native-desk/assign` are served by the site and by the backend.

- Demand calls `publicShelf().advise`. The hypothesis stays untested. Competition comes from the competitor spy status. An unarmed spy adds a risk and invents no competitor list.
- The factory assembles the existing shelf card, the checkout route name (not invoked), the fulfillment preview, the existing test names, and `/pricing`, `/services`, `/buy`. A separate verifier rejects a missing offer, a contact card that opens `/checkout`, a preview that disagrees with itself, or a pack that writes files. `launch` stays false.
- Revenue reads the CFO status and the spend gate. Paid revenue is copied only when the CFO `dataMode` is `live`. Acquisition cost, AI dollars, conversion, and margin stay unmeasured: the CFO keeps expenses at 0 because no cost API exists, and that zero is not a margin. Retention scores only rows supplied on that request. Nothing is stopped.
- Governance names `self-healing-engine` and the port 3100 canary. Refunds, charges, deploys, and restarts stay proposals with `requiresHuman`.
- Contest picks the verifier when a pack fails. Otherwise the organ with measured evidence wins. `externalModel` is false. Nothing is spent.

This desk does not generate new interface, backend, documentation, or tests. No second orchestrator. No production self-modification. No deploy.

## Public HTML edge and the deploy sentinel

`location ~* \.html$` on the live vhost sets a cache header and does not proxy. Exact files the site already serves, including the Google verification file and `/offline.html`, 404 at nginx. The discovery self-heal has listed the Google location since `acd9afc5`, and every deploy still dropped it: the same append also copied `/.well-known/zeusai.json`, which the vhost already declares. `nginx -t` failed on the duplicate and the restore deleted the Google block with it.

`_ensure_required_locations` now skips a location the vhost already has. A failed vhost edit re-applies the remaining exact matches and keeps them only when `nginx -t` passes.

The bot and Aethermail restart counters are not a crash loop. Both processes are online with exit code 0. The bot logs `poll error: fetch failed` and waits 5 seconds. Aethermail is waiting for `SMTP_PASS`. No social token was added.

The sentinel unit defaults to `monitor`. A drop-in had set `ZEUS_SENTINEL_MODE=act`, and the timer was disabled after it quarantined releases on 2026-07-25. Monitor logs only. It does not move the live symlink.

## Restart probe integrity

`auto-restart` used to treat a missing PM2 status as healthy and clear that process's backoff. A failed `pm2 list`, or a table the parser did not read, therefore looked like both `unicorn-backend` and `unicorn-site` were online.

The probe now prefers `pm2 jlist`. A failed command, or a grid with no parsed row, sets health to `unknown` and returns before any backoff clear or restart. A process that is absent from a real list is recorded and is not started. Restart still runs only for `stopped`, `errored`, `stopping`, and `waiting restart`, with the existing backoff. The Integrated Autonomy Kernel remains the only orchestrator. This change does not restart the live PM2 processes.

## Healer counts and buyer credentials

`repairDaemon` writes a ledger note when a module file has no export. That note is not a repair, and it no longer increments `healings`. `processGuardian` records a failed PM2 probe as `process-probe-unknown` and an app missing from a real list as `process-absent`. Neither event is a healing, and neither starts a process.

A delivery API key is created through the frontier key store and must verify in the same process. A receipt without an email gets no key. A webhook secret is created only when the receipt already has an `https` callback URL. No decorative `whsec_` value is minted.

## Shelf delivery contract

A backend module file is an internal organ. The filename effect on the census is not a customer delivery, and `deliversCustomer` stays false for every row. The customer advertisement is the public shelf.

`SIO/1.0` checks every shelf offer. The button, the price, and the fulfillment file have to agree. Contact mode cannot open a cart. The enterprise kickoff still says it does not deliver the license, the source, or a private cloud. `POST /api/checkout/create` refuses a shelf id that fails that check. `GET /api/service-integrity` publishes the result. The Integrated Autonomy Kernel stays the only orchestrator.
