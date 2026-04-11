// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:15:50.130Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.886Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.361Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.343Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.967Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.687Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.550Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T08:29:24.007Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * SHADOW TESTER
 * Runs feature variants alongside the real request without affecting the user.
 * Records profit for both control and variant paths, then decides whether
 * to promote to full A/B test based on predicted profit uplift.
 *
 * Usage:
 *   shadowTester.registerVariant(variantSpec)
 *   shadowTester.runShadow(action, value, userId, metadata) → controlResult
 *   shadowTester.shouldPromoteToAB(variantId) → Boolean
 */

'use strict';

const crypto = require('crypto');
const profitService = require('./profit-attribution');

const MIN_SAMPLES   = parseInt(process.env.SHADOW_MIN_SAMPLES   || '50',   10);
const UPLIFT_THRESH = parseFloat(process.env.SHADOW_UPLIFT_THRESH || '0.02'); // 2%

class ShadowTester {
  constructor() {
    this.variants       = new Map(); // variantId → spec
    this.shadowResults  = new Map(); // variantId → Array<{controlProfit, variantProfit, uplift, ts}>
    this.status         = 'ACTIVE';
  }

  /**
   * Register a new variant for shadow testing.
   * @param {Object} spec - { id, domain, name, description, handler? }
   */
  registerVariant(spec) {
    if (!spec || !spec.id) throw new Error('variant spec must have an id');
    const id = spec.id;
    if (!this.variants.has(id)) {
      this.variants.set(id, { ...spec, registeredAt: Date.now(), status: 'SHADOW' });
      this.shadowResults.set(id, []);
      profitService.setExperimentCost(id, spec.cost || 0);
      console.log(`[ShadowTester] Registered variant ${id} (${spec.domain || 'unknown'} / ${spec.name || id})`);
    }
    return this.variants.get(id);
  }

  /**
   * Run shadow comparison for one event.
   * Returns the CONTROL result — the variant runs silently.
   *
   * @param {string} action  - event type (order | subscription | ad_click | api_usage)
   * @param {number} value   - monetary value of the event
   * @param {string} userId
   * @param {Object} meta    - arbitrary context; meta.variantId determines which variant to shadow
   * @returns {number}       control attributed profit
   */
  runShadow(action, value, userId = 'anon', meta = {}) {
    const variantId = meta.variantId;
    if (!variantId || !this.variants.has(variantId)) {
      // No active variant — just record control
      return profitService.record({ userId, action, value, meta });
    }

    const variant = this.variants.get(variantId);
    if (variant.status !== 'SHADOW') {
      return profitService.record({ userId, action, value, meta });
    }

    // Control path
    const controlProfit = profitService.record({
      userId, action, value,
      experimentId: variantId, variantId: 'control', meta,
    });

    // Variant path — apply variant's value modifier (if any) but return control to user
    const variantValue  = variant.valueModifier ? variant.valueModifier(value, meta) : value;
    const variantProfit = profitService.record({
      userId, action, value: variantValue,
      experimentId: variantId, variantId, meta,
    });

    const uplift = controlProfit > 0 ? (variantProfit - controlProfit) / controlProfit : 0;
    const results = this.shadowResults.get(variantId);
    results.push({ ts: Date.now(), controlProfit, variantProfit, uplift });
    if (results.length > 5000) results.shift();

    return controlProfit; // user always gets control result
  }

  /**
   * Returns true when the variant has enough samples and predicted uplift > threshold.
   */
  shouldPromoteToAB(variantId) {
    const results = this.shadowResults.get(variantId);
    if (!results || results.length < MIN_SAMPLES) return false;
    const avgUplift = results.reduce((s, r) => s + r.uplift, 0) / results.length;
    return avgUplift > UPLIFT_THRESH;
  }

  /**
   * Promote variant from SHADOW to AB_TEST.
   */
  promoteToAB(variantId) {
    const variant = this.variants.get(variantId);
    if (!variant) throw new Error(`Unknown variant: ${variantId}`);
    variant.status = 'AB_TEST';
    variant.promotedAt = Date.now();
    console.log(`[ShadowTester] Promoted ${variantId} → AB_TEST`);
    return variant;
  }

  /**
   * Reject and deactivate a variant.
   */
  reject(variantId, reason = '') {
    const variant = this.variants.get(variantId);
    if (!variant) return;
    variant.status = 'REJECTED';
    variant.rejectedAt = Date.now();
    variant.rejectReason = reason;
    console.log(`[ShadowTester] Rejected ${variantId}: ${reason}`);
  }

  getVariantStatus(variantId) {
    const variant = this.variants.get(variantId);
    if (!variant) return null;
    const results = this.shadowResults.get(variantId) || [];
    const avgUplift = results.length
      ? results.reduce((s, r) => s + r.uplift, 0) / results.length
      : 0;
    return {
      ...variant,
      sampleCount:    results.length,
      avgUplift:      parseFloat(avgUplift.toFixed(6)),
      readyForAB:     this.shouldPromoteToAB(variantId),
      minSamples:     MIN_SAMPLES,
      upliftThreshold: UPLIFT_THRESH,
    };
  }

  getAllVariants() {
    return [...this.variants.keys()].map(id => this.getVariantStatus(id));
  }

  getMetrics() {
    const variants   = this.getAllVariants();
    const shadow     = variants.filter(v => v.status === 'SHADOW').length;
    const abTest     = variants.filter(v => v.status === 'AB_TEST').length;
    const promoted   = variants.filter(v => v.status === 'PROMOTED').length;
    const rejected   = variants.filter(v => v.status === 'REJECTED').length;
    const readyForAB = variants.filter(v => v.readyForAB).length;
    return { total: variants.length, shadow, abTest, promoted, rejected, readyForAB };
  }
}

const tester = new ShadowTester();
module.exports = tester;
module.exports.ShadowTester = ShadowTester;
