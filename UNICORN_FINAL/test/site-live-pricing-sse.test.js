/**
 * site-live-pricing-sse.test.js — static regression guard for the live
 * AI-negotiated pricing channel (`/api/pricing/live/stream`).
 *
 * Bug we never want to re-introduce (reported 2026-05-08):
 *   The prices on the public site stayed pinned to their SSR seed value
 *   and never updated, even though `live-pricing-broker` and the
 *   `/api/pricing/live/stream` SSE endpoint were healthy and pushing
 *   snapshots every minute.
 *
 * Root cause: the broker emits the snapshot as a NAMED SSE event
 * (`event: pricing\ndata: …\n\n`, backend/index.js `/api/pricing/live/stream`
 * handler). Named events are NOT delivered to `EventSource.onmessage` —
 * by spec they fire only on listeners registered with
 * `addEventListener(name, …)`. The site's `openPricingStream()` wired
 * only `onmessage`, so `applyPricingSnapshot` was never invoked and the
 * `[data-pricing-value]` anchors stayed at the SSR seed values.
 *
 * The React `useLivePricing` hook DOES use `addEventListener('pricing', …)`,
 * so the backend contract is intentional and must stay. The fix is on the
 * site client: extend `resilientES` with an `events` map that re-attaches
 * named-event listeners on every reconnect, and subscribe to `pricing`
 * from `openPricingStream`.
 *
 * This test pins the contract via static-string analysis of the SSE
 * channel (backend) and the client wiring. It does not boot the server,
 * so it is fast, deterministic, and safe in every CI lane (same shape as
 * site-filter-chips.test.js).
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const CLIENT = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'site', 'v2', 'client.js'), 'utf8');
const BACKEND = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
const HOOK = fs.readFileSync(
  path.join(__dirname, '..', 'client', 'src', 'hooks', 'useLivePricing.js'), 'utf8');

// ---------- 1) Backend contract: named `pricing` event ----------
// We do NOT change the backend contract; pin it so a future "cleanup"
// can't silently flip to default events and break the React consumer.
assert.ok(
  /res\.write\(\s*[`'"]event:\s*pricing\\n[`'"]\s*\)/.test(BACKEND),
  'backend/index.js must emit a named `pricing` SSE event on /api/pricing/live/stream'
);
assert.ok(
  HOOK.includes("addEventListener('pricing'") || HOOK.includes('addEventListener("pricing"'),
  'client/src/hooks/useLivePricing.js must subscribe via addEventListener("pricing", …)'
);

// ---------- 2) resilientES exposes a re-attaching `events` map ----------
// The `events` option is the only safe way to deliver named-event
// listeners across reconnects (each reconnect builds a fresh EventSource).
assert.ok(
  /handlers\.events\s*&&\s*typeof\s+handlers\.events\s*===\s*['"]object['"]/.test(CLIENT),
  'resilientES must accept a `handlers.events` object'
);
assert.ok(
  /src\.addEventListener\(\s*name\s*,/.test(CLIENT),
  'resilientES must attach named-event listeners via src.addEventListener(name, …)'
);
// The named-event listener must reset the heartbeat watchdog just like
// onmessage — otherwise the watchdog would still tear down a perfectly
// healthy connection that only ever delivers the named `pricing` event.
const eventsBlockMatch = CLIENT.match(
  /if\s*\(\s*handlers\.events[\s\S]*?for\s*\(\s*const\s+name[\s\S]*?addEventListener\(\s*name[\s\S]*?\}\s*\}/m
);
assert.ok(eventsBlockMatch, 'could not locate the resilientES events binding block');
assert.ok(
  /lastBeat\s*=\s*Date\.now\(\)/.test(eventsBlockMatch[0]),
  'named-event handler in resilientES must reset lastBeat (heartbeat watchdog)'
);

// ---------- 3) openPricingStream subscribes to the named `pricing` event ----------
// Locate the openPricingStream function body and assert it wires both
// `events.pricing` (the contract path) and an `applyPricingSnapshot` call.
const ops = CLIENT.indexOf('function openPricingStream(');
assert.ok(ops > 0, 'openPricingStream() must exist in client.js');
// Read a generous slice — the function body is ~60 lines.
const opsBody = CLIENT.slice(ops, ops + 4000);
assert.ok(
  /resilientES\(\s*['"]\/api\/pricing\/live\/stream['"]/.test(opsBody),
  'openPricingStream must call resilientES on /api/pricing/live/stream'
);
assert.ok(
  /events\s*:\s*\{[\s\S]*?pricing\s*:/.test(opsBody),
  'openPricingStream must wire `events: { pricing: … }` so the named SSE event is delivered'
);
assert.ok(
  (opsBody.match(/applyPricingSnapshot\(/g) || []).length >= 2,
  'openPricingStream must invoke applyPricingSnapshot from BOTH the named `pricing` handler and the defensive onmessage path'
);

// ---------- 4) applyPricingSnapshot still updates [data-pricing-value] ----------
// Sanity guard: the named-event path must end up updating the SSR
// price anchors, otherwise we'd be subscribed but inert.
assert.ok(
  /applyPricingSnapshot\(snap\)\s*\{/.test(CLIENT) ||
    /function\s+applyPricingSnapshot\s*\(/.test(CLIENT) ||
    /applyPricingSnapshot\s*\(\s*snap\s*\)/.test(CLIENT),
  'applyPricingSnapshot must be defined'
);
assert.ok(
  CLIENT.includes("'[data-pricing-value=\"'") || CLIENT.includes('"[data-pricing-value=\\""'),
  'applyPricingSnapshot must select [data-pricing-value="<id>"] anchors'
);
assert.ok(
  /it\.priceUsd\s*!=\s*null\s*\?\s*it\.priceUsd\s*:\s*it\.price_usd/.test(CLIENT),
  'applyPricingSnapshot must read both priceUsd and price_usd aliases (live-pricing-broker contract)'
);

console.log('✓ site live-pricing SSE: named `pricing` event is correctly subscribed and re-attached on reconnect');
process.exit(0);
