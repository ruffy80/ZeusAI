// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-30T15:05:08.925Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/*
 * industryOS
 * ----------
 * Vertical industry blueprints + projected annual revenue + activation +
 * revenue booking. Catalog is static + extensible via env override; revenue
 * activations are routed through sovereignRevenueRouter to keep one ledger.
 *
 * SO industrii — proiecte verticale (FinTech, HealthTech, EnergyTech, Legal,
 * Government, Aviation, Telecom, Defense, Marketplace, Media). Aditiv,
 * non-distructiv: nu mută endpoint-uri existente.
 */

const _router = require('./sovereignRevenueRouter');

const _BLUEPRINTS = [
  { name: 'fintech',           market: 'Global FinTech',           tamUsd: 12500_000_000_000, projectedAnnualUsd: 95_000_000, modules: ['paymentGateway', 'paymentSystems', 'billing-engine', 'btcInvoiceLedger'] },
  { name: 'healthtech',        market: 'Global HealthTech',        tamUsd: 10000_000_000_000, projectedAnnualUsd: 80_000_000, modules: ['ai-orchestrator', 'complianceEngine', 'tenant-engine'] },
  { name: 'energytech',        market: 'Energy & Carbon Markets',  tamUsd:  9000_000_000_000, projectedAnnualUsd: 70_000_000, modules: ['energyGrid', 'carbonExchange', 'globalEnergyCarbonTrader'] },
  { name: 'legal',             market: 'LegalTech',                tamUsd:  1000_000_000_000, projectedAnnualUsd: 35_000_000, modules: ['legalContract', 'legalFortress', 'autonomousLegalEntity'] },
  { name: 'government',        market: 'Government Tech',          tamUsd:  5000_000_000_000, projectedAnnualUsd: 60_000_000, modules: ['governmentModule', 'sovereignAccessGuardian'] },
  { name: 'aviation',          market: 'Aviation',                 tamUsd:   850_000_000_000, projectedAnnualUsd: 25_000_000, modules: ['aviationModule'] },
  { name: 'telecom',           market: 'Telecom',                  tamUsd:  1700_000_000_000, projectedAnnualUsd: 40_000_000, modules: ['telecomModule'] },
  { name: 'defense',           market: 'Defense',                  tamUsd:  2200_000_000_000, projectedAnnualUsd: 50_000_000, modules: ['defenseModule'] },
  { name: 'marketplace',       market: 'Vertical Marketplaces',    tamUsd:  6000_000_000_000, projectedAnnualUsd: 90_000_000, modules: ['serviceMarketplace', 'universalAITrainingMarketplace', 'universalMarketNexus'] },
  { name: 'media',             market: 'AI Media & Distribution',  tamUsd:  2500_000_000_000, projectedAnnualUsd: 30_000_000, modules: ['socialMediaViralizer', 'autoViralGrowth', 'auto-marketing'] },
];

const _activations = new Map(); // name → { activatedAt, bookings: [] }

function list() {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    count: _BLUEPRINTS.length,
    items: _BLUEPRINTS.map((b) => ({ ...b, activated: _activations.has(b.name) })),
  };
}

function projectedAnnual() {
  const totalUsd = _BLUEPRINTS.reduce((s, b) => s + b.projectedAnnualUsd, 0);
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    totalUsd,
    perVertical: _BLUEPRINTS.map((b) => ({ name: b.name, projectedAnnualUsd: b.projectedAnnualUsd })),
  };
}

function blueprintOf(name) {
  const key = String(name || '').toLowerCase();
  const bp = _BLUEPRINTS.find((b) => b.name === key);
  if (!bp) return null;
  return { ...bp, activated: _activations.has(bp.name) };
}

function activate(name) {
  const bp = blueprintOf(name);
  if (!bp) return { ok: false, error: 'unknown vertical' };
  if (!_activations.has(bp.name)) _activations.set(bp.name, { activatedAt: new Date().toISOString(), bookings: [] });
  return { ok: true, vertical: bp.name, activatedAt: _activations.get(bp.name).activatedAt, blueprint: bp };
}

function bookRevenue(input = {}) {
  const name = String(input.name || input.vertical || '').toLowerCase();
  const amountUsd = Number(input.amountUsd || input.amount || 0);
  const bp = blueprintOf(name);
  if (!bp) return { ok: false, error: 'unknown vertical' };
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return { ok: false, error: 'amountUsd must be positive' };
  const routed = _router.route({
    amountUsd,
    channel: 'industry-os:' + bp.name,
    tenantId: String(input.tenantId || 'self'),
    productId: String(input.productId || 'industry-' + bp.name),
    receipt: input.receipt,
  });
  if (!_activations.has(bp.name)) activate(bp.name);
  _activations.get(bp.name).bookings.push(routed.event);
  return { ok: true, vertical: bp.name, booking: routed.event };
}

function getStatus() {
  return {
    ok: true,
    name: 'industryOS',
    verticals: _BLUEPRINTS.length,
    activated: _activations.size,
    projectedAnnualUsd: projectedAnnual().totalUsd,
  };
}

module.exports = { list, projectedAnnual, blueprintOf, activate, bookRevenue, getStatus };
