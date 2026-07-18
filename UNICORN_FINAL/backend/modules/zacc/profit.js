// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Profit Maximizer.
// RO: calculează profit net real per produs, filtrează deșeurile (calitate
// scăzută, recenzii puține, margine sub prag) și produce un "profit potential
// score" pentru ranking. Toate pragurile sunt env-tunable.

'use strict';

const { round2, logger, clamp } = require('./util');

const log = logger('profit');

const MIN_PROFIT_USD = Number(process.env.ZACC_MIN_PROFIT || 5);     // $5 net floor
const MIN_MARGIN_PCT = Number(process.env.ZACC_MIN_MARGIN_PCT || 25); // 25% margin floor (shared)
const MIN_RATING = Number(process.env.ZACC_MIN_RATING || 4.0);
const MIN_REVIEWS = Number(process.env.ZACC_MIN_REVIEWS || 100);
const MARKUP = Number(process.env.ZACC_MARKUP || 2.5);                // default 2.5x markup
const PLATFORM_FEE_PCT = Number(process.env.ZACC_PLATFORM_FEE_PCT || 3); // BTC processor + handling
const TAX_PCT = Number(process.env.ZACC_TAX_PCT || 0);                // owner-handled, default 0

function computeRetailUsd(p) {
  if (Number(p.suggestedRetailUsd) > 0) return round2(Number(p.suggestedRetailUsd));
  return round2((Number(p.costUsd) || 0) * MARKUP);
}

// Net profit for a single unit, accounting for cost + shipping + fees + tax.
function computeNetProfitUsd(p, retailUsd) {
  const cost = Number(p.costUsd) || 0;
  const ship = Number(p.shippingUsd) || 0;
  const fees = retailUsd * (PLATFORM_FEE_PCT / 100);
  const tax = retailUsd * (TAX_PCT / 100);
  return round2(retailUsd - cost - ship - fees - tax);
}

// Demand multiplier proxy: reviews are the strongest public sales signal we
// can read without paid trend APIs. Optional Google-Trends-ish boost when an
// external numeric demand index is plugged in via ctx.params().demandIndex.
function _demandWeight(reviews) {
  // Logarithmic so 100 reviews ≠ 10× 10 reviews in score weight.
  return clamp(Math.log10(Math.max(1, reviews)) / 5, 0, 1);
}

class ProfitMaximizer {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.lastRunAt = 0;
    this.runs = 0;
    this.scored = []; // newest scored batch
    this.maxScored = 400;
  }

  // Takes raw scraped products → returns an array of qualified, scored items
  // sorted by profitPotential desc.
  rank(rawProducts) {
    this.runs += 1;
    this.lastRunAt = Date.now();
    const rejected = { rating: 0, reviews: 0, margin: 0, profit: 0 };
    const passed = [];

    for (const p of (rawProducts || [])) {
      const rating = Number(p.rating) || 0;
      const reviews = Number(p.reviews) || 0;
      if (rating < MIN_RATING) { rejected.rating += 1; continue; }
      if (reviews < MIN_REVIEWS) { rejected.reviews += 1; continue; }

      const retailUsd = computeRetailUsd(p);
      const netProfitUsd = computeNetProfitUsd(p, retailUsd);
      if (netProfitUsd < MIN_PROFIT_USD) { rejected.profit += 1; continue; }

      const marginPct = retailUsd > 0 ? round2((netProfitUsd / retailUsd) * 100) : 0;
      if (marginPct < MIN_MARGIN_PCT) { rejected.margin += 1; continue; }

      const demand = _demandWeight(reviews);
      // Profit potential = net profit per unit × demand weight × rating tilt.
      const profitPotential = round2(netProfitUsd * (1 + 4 * demand) * (rating / 5));

      passed.push(Object.assign({}, p, {
        retailUsd, netProfitUsd, marginPct, demandWeight: round2(demand), profitPotential,
        // Carry supplier + logistics metadata through so the publisher can
        // prove margins and route fulfillment (manual-queue for demo SKUs).
        supplier: p.supplier || (p.source === 'zeus-curated' ? 'manual' : (p.source || 'unknown')),
        supplierRef: p.supplierRef != null ? p.supplierRef : null,
        demoOnly: p.demoOnly === true,
        weightKg: Number(p.weightKg) || 0,
        originCountry: p.originCountry || null,
        qualifiedAt: new Date().toISOString(),
      }));
    }

    passed.sort((a, b) => b.profitPotential - a.profitPotential);
    this.scored = passed.slice(0, this.maxScored);
    log.info('ranked',
      'in=' + (rawProducts || []).length,
      'pass=' + passed.length,
      'rejected', JSON.stringify(rejected));
    return this.scored;
  }

  top(n) { return this.scored.slice(0, n || 20); }

  status() {
    const top = this.top(5).map(p => ({ name: p.name, source: p.source, retail: p.retailUsd, profit: p.netProfitUsd, margin: p.marginPct, score: p.profitPotential }));
    return {
      ok: true,
      runs: this.runs,
      lastRunAt: this.lastRunAt ? new Date(this.lastRunAt).toISOString() : null,
      qualified: this.scored.length,
      thresholds: { minProfitUsd: MIN_PROFIT_USD, minMarginPct: MIN_MARGIN_PCT, minRating: MIN_RATING, minReviews: MIN_REVIEWS, markup: MARKUP, platformFeePct: PLATFORM_FEE_PCT },
      top,
    };
  }

  toState() { return { scored: this.scored.slice(0, 100), runs: this.runs, lastRunAt: this.lastRunAt }; }
  fromState(s) {
    if (!s) return;
    if (Array.isArray(s.scored)) this.scored = s.scored.slice(0, this.maxScored);
    if (Number.isFinite(s.runs)) this.runs = s.runs;
    if (Number.isFinite(s.lastRunAt)) this.lastRunAt = s.lastRunAt;
  }
}

module.exports = { ProfitMaximizer, computeRetailUsd, computeNetProfitUsd, MIN_PROFIT_USD, MARKUP };
