// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.347Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

class InnovationLoop {
  constructor(opts = {}) {
    this.minLiftPct = Number(process.env.SOCIAL_INNOVATION_MIN_LIFT_PCT || 5);
    this.maxProposals = Number(process.env.SOCIAL_INNOVATION_MAX_PROPOSALS || 5);
    this.lastRun = null;
    this.totalRuns = 0;
  }

  fallbackProposals() {
    return [
      { id: 'ui-short-form-boost', title: 'Optimize short-form composer UX', category: 'ui' },
      { id: 'creator-referral-multiplier', title: 'Creator referral multiplier campaign', category: 'marketing' },
      { id: 'smart-feed-interest-clusters', title: 'Feed recommendation based on interest clusters', category: 'feed' },
      { id: 'frictionless-onboarding', title: 'One-click onboarding simplification', category: 'growth' },
      { id: 'high-value-retention-nudges', title: 'Retention nudges for high-value creators', category: 'retention' },
    ].slice(0, this.maxProposals);
  }

  async generateProposals(ctx = {}) {
    if (typeof ctx.llm !== 'function') return this.fallbackProposals();
    const prompt = [
      'Generate 3-5 practical social network growth innovations as strict JSON array.',
      'Each item keys: id,title,category,hypothesis.',
      'No markdown.',
      JSON.stringify({ metrics: ctx.metrics || {}, limit: this.maxProposals }),
    ].join('\n');
    try {
      const out = await ctx.llm(prompt, { temperature: 0.25 });
      if (!Array.isArray(out)) return this.fallbackProposals();
      return out.slice(0, this.maxProposals).map((x, i) => ({
        id: String(x.id || `proposal-${i + 1}`),
        title: String(x.title || 'Untitled improvement'),
        category: String(x.category || 'growth'),
        hypothesis: String(x.hypothesis || ''),
      }));
    } catch (_) {
      return this.fallbackProposals();
    }
  }

  evaluateProposal(proposal, metrics = {}) {
    const baseGrowth = Number(metrics.userGrowthPct24h || 0.8);
    const baseEng = Number(metrics.engagementPct || 3.2);
    const idScore = (String(proposal.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 700) / 100;
    const estimatedLiftPct = Math.round((baseGrowth * 1.1 + baseEng * 0.3 + idScore) * 100) / 100;
    return {
      estimatedLiftPct,
      passed: estimatedLiftPct >= this.minLiftPct,
      sandboxHours: 24,
    };
  }

  async runOnce(ctx = {}) {
    const proposals = await this.generateProposals(ctx);
    const results = proposals.map((p) => {
      const evalOut = this.evaluateProposal(p, ctx.metrics || {});
      return Object.assign({}, p, evalOut);
    });

    const accepted = results.filter((r) => r.passed);
    const applied = [];
    if (!ctx.dryRun && typeof ctx.applyInnovation === 'function') {
      for (const r of accepted) {
        applied.push(await ctx.applyInnovation(r));
      }
    }

    const out = {
      ok: true,
      dryRun: !!ctx.dryRun,
      ts: new Date().toISOString(),
      minLiftPct: this.minLiftPct,
      proposals: results,
      accepted: accepted.length,
      applied,
    };

    this.lastRun = out;
    this.totalRuns += 1;
    return out;
  }

  getStatus() {
    return {
      ok: true,
      totalRuns: this.totalRuns,
      lastRunAt: this.lastRun ? this.lastRun.ts : null,
      lastRun: this.lastRun,
      minLiftPct: this.minLiftPct,
    };
  }
}

module.exports = InnovationLoop;
