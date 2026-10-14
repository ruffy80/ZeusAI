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
