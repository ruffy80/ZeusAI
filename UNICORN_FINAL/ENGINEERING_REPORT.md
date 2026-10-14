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
