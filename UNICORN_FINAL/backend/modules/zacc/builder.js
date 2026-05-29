// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC component 3 — Auto-Builder.
// RO: pentru fiecare idee aprobată, construiește un produs real, vandabil:
// pagină (titlu/descriere/preț/FAQ), checkout BTC și pipeline de livrare.
// Produsul fizic → seam Printful (când e configurat). Serviciu AI → pipeline
// de capabilitate apelat după plată.

'use strict';

const { OWNER_BTC, now, slug, round2, logger } = require('./util');

const log = logger('builder');

// Maps an idea type to its delivery strategy. Digital/AI = instant automated;
// physical = fulfilment seam (Printful) gated behind a configured API key.
function deliveryFor(type) {
  switch (type) {
    case 'physical':
      return process.env.ZACC_PRINTFUL_API_KEY
        ? { mode: 'printful', automated: true, note: 'Routed to Printful fulfilment.' }
        : { mode: 'manual-fulfilment', automated: false, note: 'Awaiting Printful onboarding (set ZACC_PRINTFUL_API_KEY).' };
    case 'subscription':
      return { mode: 'recurring-provisioning', automated: true, note: 'Tenant provisioned on confirmation, renews monthly.' };
    case 'crypto':
      return { mode: 'on-chain-delivery', automated: true, note: 'Access token + signed receipt issued on BTC confirmation.' };
    default: // ai-service, digital
      return { mode: 'instant-ai-pipeline', automated: true, note: 'Capability pipeline runs the moment payment confirms.' };
  }
}

function buildFaq(idea) {
  return [
    { q: 'How fast is delivery?', a: idea.type === 'physical'
      ? 'Production starts the moment your BTC payment confirms; tracking is emailed automatically.'
      : 'Instantly. The AI pipeline runs the second your BTC payment confirms — no human in the loop.' },
    { q: 'How do I pay?', a: 'Self-custody Bitcoin. You get a signed receipt and a verifiable on-chain reference.' },
    { q: 'What exactly do I get?', a: idea.description },
    { q: 'Can I get a refund?', a: '30-day outcome guarantee. The specialized support agent processes eligible refunds automatically.' },
  ];
}

class AutoBuilder {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.products = []; // active products, newest-first
    this.maxProducts = 400;
    this.built = 0;
  }

  has(productId) { return this.products.some(p => p.id === productId); }

  // Turn an approved idea into a live, buyable product object.
  build(idea, opts) {
    if (!idea) return null;
    const niche = (opts && opts.niche) || 'core';
    const id = 'zacc-' + slug(idea.slug || idea.name) + '-' + (idea.id || '').slice(-6);
    if (this.has(id)) return this.products.find(p => p.id === id);

    const basePriceUsd = round2(idea.priceUsd);
    const product = {
      id,
      ideaId: idea.id,
      title: idea.name,
      description: idea.description,
      type: idea.type,
      niche,
      group: 'zacc',
      capabilities: idea.capabilities || [],
      market: idea.market,
      basePriceUsd,
      priceUsd: basePriceUsd,
      marginPct: idea.marginPct,
      faq: buildFaq(idea),
      delivery: deliveryFor(idea.type),
      page: '/zacc/products/' + id,
      checkout: { btcAddress: OWNER_BTC, priceUsd: basePriceUsd },
      buyUrl: '/checkout?serviceId=' + encodeURIComponent(id) + '&plan=' + encodeURIComponent(id),
      metrics: { views: 0, carts: 0, sales: 0, revenueUsd: 0 },
      status: 'active',
      createdAt: now(),
    };

    // Seed the live dynamic-pricing engine so /api/pricing/<id> returns the
    // real floor instead of the generic fallback. Best-effort, never throws.
    try {
      const dpe = require('../dynamic-pricing');
      if (dpe && typeof dpe.registerService === 'function') {
        dpe.registerService(id, basePriceUsd, { force: false });
      } else if (dpe && typeof dpe.registerServices === 'function') {
        dpe.registerServices([{ id, priceUsd: basePriceUsd, title: product.title }], { force: false });
      }
    } catch (e) { log.warn('pricing seed skipped:', e.message); }

    this.products = [product].concat(this.products).slice(0, this.maxProducts);
    this.built += 1;
    log.info('built product', id, '(' + idea.type + ', $' + basePriceUsd + ')');
    return product;
  }

  getProduct(id) { return this.products.find(p => p.id === id) || null; }

  recordEvent(productId, event) {
    const p = this.getProduct(productId);
    if (!p) return null;
    if (event === 'view') p.metrics.views += 1;
    else if (event === 'cart') p.metrics.carts += 1;
    else if (event === 'sale') p.metrics.sales += 1;
    else if (event === 'delivered') { p.metrics.delivered = (p.metrics.delivered || 0) + 1; p.lastDeliveredAt = now(); }
    return p;
  }

  publicList(limit) {
    return this.products.slice(0, limit || 60).map(p => ({
      id: p.id, title: p.title, description: p.description, type: p.type,
      niche: p.niche, priceUsd: p.priceUsd, basePriceUsd: p.basePriceUsd,
      marginPct: p.marginPct, page: p.page, buyUrl: p.buyUrl,
      checkout: p.checkout, delivery: p.delivery, metrics: p.metrics,
      group: 'zacc',
    }));
  }

  status() {
    return {
      ok: true,
      built: this.built,
      active: this.products.length,
      automatedDelivery: this.products.filter(p => p.delivery.automated).length,
      latest: this.products.slice(0, 5).map(p => ({ id: p.id, title: p.title, priceUsd: p.priceUsd, type: p.type, niche: p.niche })),
    };
  }
}

module.exports = { AutoBuilder, deliveryFor };
