'use strict';

class ViralEngine {
  constructor(opts = {}) {
    this.maxPostsPerRun = Number(process.env.SOCIAL_VIRAL_MAX_POSTS || 3);
    this.lastRun = null;
    this.totalRuns = 0;
  }

  buildFallbackCopy(item) {
    const title = String(item.title || item.id || 'Top community moment');
    const score = Number(item.score || item.likes || 0);
    return `🔥 ${title}\n\nThe community is moving fast. Join Zeus Core Social and ride the momentum. Score: ${score}. #ZeusAI #SocialNetwork #AI`;
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
    const top = (Array.isArray(items) ? items : []).slice(0, this.maxPostsPerRun);
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
      selected: top.length,
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
    };
  }
}

module.exports = ViralEngine;
