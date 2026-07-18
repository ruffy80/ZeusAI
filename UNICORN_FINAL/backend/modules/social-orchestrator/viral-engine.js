// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.348Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

class ViralEngine {
  constructor(opts = {}) {
    this.maxPostsPerRun = Number(process.env.SOCIAL_VIRAL_MAX_POSTS || 3);
    this.creatorFirstWeight = Number(process.env.SOCIAL_VIRAL_CREATOR_FIRST_WEIGHT || 0.65);
    this.manipulationThreshold = Number(process.env.SOCIAL_VIRAL_MANIPULATION_THRESHOLD || 0.75);
    this.lastRun = null;
    this.totalRuns = 0;
  }

  _safeNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  _creatorFirstScore(item = {}) {
    const quality = this._safeNumber(item.qualityScore, this._safeNumber(item.score, 0));
    const creatorTrust = this._safeNumber(item.creatorTrust, 50);
    const retention = this._safeNumber(item.retentionPct, 30);
    const engagement = this._safeNumber(item.engagementRate, 10);
    return Math.round((quality * this.creatorFirstWeight + creatorTrust * 0.2 + retention * 0.1 + engagement * 0.05) * 100) / 100;
  }

  _manipulationRisk(item = {}) {
    const botSignal = this._safeNumber(item.botSignal, 0);
    const velocitySpike = this._safeNumber(item.velocitySpike, 0);
    const suspiciousRatio = this._safeNumber(item.suspiciousRatio, 0);
    const risk = Math.max(0, Math.min(1, botSignal * 0.5 + velocitySpike * 0.3 + suspiciousRatio * 0.2));
    return Math.round(risk * 1000) / 1000;
  }

  _trendingSignal(item = {}) {
    const interactions = this._safeNumber(item.interactions, this._safeNumber(item.likes, 0));
    const comments = this._safeNumber(item.comments, 0);
    const saves = this._safeNumber(item.saves, 0);
    const shares = this._safeNumber(item.shares, 0);
    const freshnessHours = Math.max(1, this._safeNumber(item.freshnessHours, 6));
    const signal = (interactions + comments * 1.4 + saves * 1.8 + shares * 2.2) / freshnessHours;
    return Math.round(signal * 100) / 100;
  }

  rankItems(items = []) {
    const ranked = [];
    for (const raw of Array.isArray(items) ? items : []) {
      const item = Object.assign({}, raw);
      item.creatorFirstScore = this._creatorFirstScore(item);
      item.manipulationRisk = this._manipulationRisk(item);
      item.trendingSignal = this._trendingSignal(item);
      item.safeForBoost = item.manipulationRisk < this.manipulationThreshold;
      item.finalRankScore = Math.round((item.creatorFirstScore * 0.6 + item.trendingSignal * 0.4) * 100) / 100;
      ranked.push(item);
    }

    return ranked
      .filter((x) => x.safeForBoost)
      .sort((a, b) => (b.finalRankScore || 0) - (a.finalRankScore || 0));
  }

  buildFallbackCopy(item) {
    const title = String(item.title || item.id || 'Top community moment');
    const score = Number(item.score || item.likes || 0);
    return `${title}\n\nZeusAI Social autonomy is moving. Score: ${score}. #ZeusAI #ZeusAISocial #Autonomous`;
  }

  async generateCopy(item, ctx = {}) {
    if (typeof ctx.llm !== 'function') return this.buildFallbackCopy(item);
    try {
      const out = await ctx.llm(
        `Create one viral social post under 280 chars for this item: ${JSON.stringify(item)}. Keep CTA + hashtags. Strict plain text.`,
        { temperature: 0.35 }
      );
      if (typeof out === 'string' && out.trim()) return out.trim().slice(0, 280);
    } catch (_) {}
    return this.buildFallbackCopy(item);
  }

  async runOnce(ctx = {}) {
    const items = typeof ctx.getTopPosts === 'function'
      ? await Promise.resolve(ctx.getTopPosts())
      : [];
    const ranked = this.rankItems(items);
    const top = ranked.slice(0, this.maxPostsPerRun);
    const posts = [];
    for (const item of top) {
      posts.push({ item, text: await this.generateCopy(item, ctx) });
    }

    const published = [];
    if (!ctx.dryRun && typeof ctx.postToChannels === 'function') {
      for (const p of posts) {
        published.push(await ctx.postToChannels(p));
      }
    }

    const out = {
      ok: true,
      dryRun: !!ctx.dryRun,
      ts: new Date().toISOString(),
      analyzed: Array.isArray(items) ? items.length : 0,
      selected: top.length,
      blockedForManipulation: (Array.isArray(items) ? items.length : 0) - ranked.length,
      drafts: posts,
      published,
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
      maxPostsPerRun: this.maxPostsPerRun,
      creatorFirstWeight: this.creatorFirstWeight,
      manipulationThreshold: this.manipulationThreshold,
    };
  }
}

module.exports = ViralEngine;
