// =====================================================================
// ZACC — Margin OS (world-standard differentiator vs Shopify-class platforms)
// Transparent platform-tax comparison + autonomous yield snapshot.
// Fail-soft, pure functions — never blocks the commerce loop.
// =====================================================================
'use strict';

const { round2 } = require('./util');

// Public Shopify Online Store pricing (card rate + monthly) as of 2026 —
// used only for transparent "keep vs hand-off" education, not legal claims.
const SHOPIFY_CARD_PCT = 0.029;
const SHOPIFY_CARD_FIXED = 0.30;
const SHOPIFY_BASIC_MONTHLY = 39;

function shopifyTaxOnSale(priceUsd) {
  const price = Math.max(0, Number(priceUsd) || 0);
  const txn = round2(price * SHOPIFY_CARD_PCT + SHOPIFY_CARD_FIXED);
  return {
    monthlyUsd: SHOPIFY_BASIC_MONTHLY,
    transactionFeeUsd: txn,
    transactionPct: round2(SHOPIFY_CARD_PCT * 100),
    note: 'Illustrative Shopify Basic card checkout fees; Zeus settles BTC direct to owner wallet with $0 platform take-rate on the sale.',
  };
}

function compareToShopify(product) {
  const price = round2(Number(product && product.priceUsd) || 0);
  const net = round2(Number(product && product.netProfitUsd) || 0);
  const shop = shopifyTaxOnSale(price);
  const zeusKeep = net;
  const shopifyKeepApprox = round2(Math.max(0, net - shop.transactionFeeUsd));
  const advantageUsd = round2(Math.max(0, zeusKeep - shopifyKeepApprox));
  return {
    ok: true,
    retailUsd: price,
    zeusNetMarginUsd: zeusKeep,
    shopifyApproxNetUsd: shopifyKeepApprox,
      platformTaxAvoidedUsd: advantageUsd,
    shopify: shop,
    rails: {
      zeus: 'btc-direct · zero login passport · autonomous sourcing',
      shopifyClass: 'card rails · monthly SaaS · merchant ops',
    },
  };
}

function yieldSnapshot(publisher, profit, scraper) {
  const published = (publisher && publisher.published) || [];
  const n = published.length;
  let marginSum = 0;
  let profitSum = 0;
  let views = 0;
  let sales = 0;
  for (const p of published) {
    marginSum += Number(p.marginPct) || 0;
    profitSum += Number(p.netProfitUsd) || 0;
    views += (p.metrics && p.metrics.views) || 0;
    sales += (p.metrics && p.metrics.sales) || 0;
  }
  const avgMargin = n ? round2(marginSum / n) : 0;
  const avgProfit = n ? round2(profitSum / n) : 0;
  const top = [...published]
    .sort((a, b) => (b.profitPotential || 0) - (a.profitPotential || 0))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      title: p.title,
      priceUsd: p.priceUsd,
      marginPct: p.marginPct,
      netProfitUsd: p.netProfitUsd,
    }));
  return {
    ok: true,
    listed: n,
    avgMarginPct: avgMargin,
    avgNetProfitUsd: avgProfit,
    views,
    sales,
    sourced: (scraper && (scraper.cached || scraper.total)) || 0,
    qualified: (profit && profit.qualified) || 0,
    topYield: top,
    differentiators: [
      'Autonomous source → margin-filter → publish loop',
      'Proof-of-Margin on every SKU (cost / ship / net)',
      'BTC settles to owner wallet — no card platform take-rate',
      'No-login order passport (payment → fulfil → track)',
      'Related SKUs ranked by profitPotential for AOV lift',
    ],
  };
}

module.exports = {
  SHOPIFY_CARD_PCT,
  SHOPIFY_CARD_FIXED,
  SHOPIFY_BASIC_MONTHLY,
  shopifyTaxOnSale,
  compareToShopify,
  yieldSnapshot,
};
