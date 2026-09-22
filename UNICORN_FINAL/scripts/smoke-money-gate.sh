#!/usr/bin/env bash
# MONEY GATE — fail-closed BTC checkout create on the live/canary stack.
# Optional rails (Stripe/PayPal/SMTP) are never required.
set -euo pipefail

MONEY_GATE_BASE="${MONEY_GATE_BASE:-${BASE_URL:-http://127.0.0.1:3000}}"
MONEY_GATE_SKU="${MONEY_GATE_SKU:-instant-resume-makeover}"
MONEY_GATE_EMAIL="${MONEY_GATE_EMAIL:-deploy-money-gate@noreply.local}"

fail() { echo "❌ money-gate: $*" >&2; exit 1; }

echo "[money-gate] base=$MONEY_GATE_BASE sku=$MONEY_GATE_SKU"

CATALOG="$(curl -fsS --max-time 15 -H 'Cache-Control: no-cache' "$MONEY_GATE_BASE/api/catalog" || true)"
[ -n "$CATALOG" ] || fail "GET /api/catalog empty"
printf '%s' "$CATALOG" | MONEY_GATE_SKU="$MONEY_GATE_SKU" node -e '
let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
  const sku=process.env.MONEY_GATE_SKU||"instant-resume-makeover";
  let d; try { d=JSON.parse(b); } catch(_) { process.exit(1); }
  const ids=[];
  const walk=(x)=>{
    if (!x) return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x==="object") {
      if (x.id) ids.push(String(x.id));
      if (x.serviceId) ids.push(String(x.serviceId));
      Object.keys(x).forEach((k)=>walk(x[k]));
    }
  };
  walk(d);
  if (!ids.includes(sku)) process.exit(1);
});
' || fail "catalog missing $MONEY_GATE_SKU"
echo "✅ catalog includes $MONEY_GATE_SKU"

RATE="$(curl -fsS --max-time 8 "$MONEY_GATE_BASE/api/payment/btc-rate" || true)"
[ -n "$RATE" ] || fail "GET /api/payment/btc-rate empty"
printf '%s' "$RATE" | node -e '
let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
  let d; try { d=JSON.parse(b); } catch(_) { process.exit(1); }
  const n=Number(d.usdPerBtc||d.usd||d.rate||d.btcUsd||d.priceUsd||0);
  if (!(n>0)) process.exit(1);
});
' || fail "btc-rate not a positive number"
echo "✅ btc-rate live"

ORDER_JSON="$(curl -sS --max-time 25 -X POST \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: money-gate-$(date +%s)-$$" \
  -d "{\"serviceId\":\"${MONEY_GATE_SKU}\",\"qty\":1,\"email\":\"${MONEY_GATE_EMAIL}\"}" \
  "$MONEY_GATE_BASE/api/checkout/create" || true)"
[ -n "$ORDER_JSON" ] || fail "POST /api/checkout/create empty"

ORDER_ID="$(printf '%s' "$ORDER_JSON" | node -e '
let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
  let d; try { d=JSON.parse(b); } catch(_) { process.exit(1); }
  if (d.error === "btc_wallet_unconfigured") { console.error("wallet_unconfigured"); process.exit(2); }
  const id=d.orderId|| (d.order&&d.order.orderId) || d.id;
  const bip=String(d.bip21|| (d.order&&d.order.bip21) || "");
  const addr=String(d.receive_address|| (d.order&&d.order.receive_address) || "");
  const sats=Number(d.amount_sats|| (d.order&&d.order.amount_sats) || d.subtotal_fiat || 0);
  if (!id) process.exit(1);
  if (!(bip.indexOf("bitcoin:")===0 || (addr && sats>0))) process.exit(1);
  process.stdout.write(String(id));
});
')" || fail "checkout create did not return BIP-21 / sats invoice"
echo "✅ checkout create $ORDER_ID"

STATUS="$(curl -sS --max-time 15 -H 'Accept: application/json' "$MONEY_GATE_BASE/api/order/${ORDER_ID}/status" || true)"
[ -n "$STATUS" ] || fail "GET /api/order/$ORDER_ID/status empty"
printf '%s' "$STATUS" | ORDER_ID="$ORDER_ID" node -e '
let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
  const expect=String(process.env.ORDER_ID||"");
  const trimmed=String(b||"").trim();
  if (trimmed.charAt(0) === "<") {
    console.error("got HTML (SPA catch-all) instead of JSON — backend must proxy /api/order/:id/status to site");
    process.exit(1);
  }
  let d; try { d=JSON.parse(trimmed); } catch(e) {
    console.error("status body is not JSON:", trimmed.slice(0,180));
    process.exit(1);
  }
  const id=d.orderId || (d.order && d.order.orderId) || d.id;
  if (!id || (expect && String(id) !== expect)) {
    console.error("orderId mismatch", { expect, got: id, keys: Object.keys(d||{}) });
    process.exit(1);
  }
  const st=String(d.status || (d.order && d.order.status) || "").toLowerCase();
  const ok = st && st !== "paid" && st !== "settled" && st !== "fulfilled";
  if (!ok) {
    console.error("unexpected smoke status", st || "(empty)");
    process.exit(1);
  }
});
' || fail "order status missing, HTML, or already paid (unexpected for smoke mint)"
echo "✅ order status pending"

echo "✅ money-gate"
exit 0
