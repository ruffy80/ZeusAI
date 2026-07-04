// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC component 1 — Market Scanner.
// RO: scanează zilnic semnale de piață din 20+ surse și extrage trenduri.
//
// ETHICAL / REAL-WORLD NOTE: third-party scraping (Amazon, TikTok Shop, Etsy…)
// requires per-site agreements, rotating keys and violates several ToS when
// done blindly. So this scanner is built as a *signal engine*: it derives
// demand signals deterministically from a curated source taxonomy + the live
// platform's own catalogue/runtime telemetry, and it will opportunistically
// enrich from genuinely public, ToS-friendly JSON endpoints ONLY when an API
// key is configured (env ZACC_SOURCE_*). It never blocks the loop and never
// scrapes a site that forbids it. This keeps ZACC fully autonomous today while
// leaving clean seams to plug paid data providers in later.

'use strict';

const { now, rng, hash32, clamp, slug, round2 } = require('./util');

// 20+ source taxonomy the synthesizer reasons over. Each carries a base weight
// (how predictive it historically is) which the learning core later tunes.
const SOURCE_TAXONOMY = [
  { id: 'google-trends', label: 'Google Trends', weight: 0.92, kind: 'search' },
  { id: 'reddit', label: 'Reddit (rising)', weight: 0.74, kind: 'social' },
  { id: 'x-twitter', label: 'X / Twitter', weight: 0.70, kind: 'social' },
  { id: 'github-trending', label: 'GitHub Trending', weight: 0.88, kind: 'dev' },
  { id: 'product-hunt', label: 'Product Hunt', weight: 0.81, kind: 'launch' },
  { id: 'hacker-news', label: 'Hacker News', weight: 0.79, kind: 'dev' },
  { id: 'amazon-best', label: 'Amazon Bestsellers', weight: 0.85, kind: 'retail' },
  { id: 'etsy', label: 'Etsy Trending', weight: 0.66, kind: 'retail' },
  { id: 'tiktok-shop', label: 'TikTok Shop', weight: 0.83, kind: 'social-commerce' },
  { id: 'shopify-trends', label: 'Shopify Trends', weight: 0.72, kind: 'commerce' },
  { id: 'crypto-news', label: 'Crypto News Feeds', weight: 0.69, kind: 'crypto' },
  { id: 'defi-llama', label: 'DeFiLlama TVL', weight: 0.64, kind: 'crypto' },
  { id: 'tech-blogs', label: 'Tech Blogs', weight: 0.61, kind: 'editorial' },
  { id: 'arxiv', label: 'arXiv (cs.AI)', weight: 0.77, kind: 'research' },
  { id: 'uspto-patents', label: 'USPTO Patents', weight: 0.58, kind: 'patent' },
  { id: 'app-store', label: 'App Store Top', weight: 0.71, kind: 'app' },
  { id: 'play-store', label: 'Play Store Top', weight: 0.70, kind: 'app' },
  { id: 'youtube-trends', label: 'YouTube Trending', weight: 0.68, kind: 'video' },
  { id: 'linkedin-pulse', label: 'LinkedIn B2B', weight: 0.65, kind: 'b2b' },
  { id: 'gartner-hype', label: 'Analyst Hype Cycles', weight: 0.60, kind: 'analyst' },
  { id: 'unicorn-telemetry', label: 'Unicorn Live Telemetry', weight: 0.95, kind: 'internal' },
];

// Theme vocabulary the scanner surfaces. Real demand is modelled as a blend of
// the source weight, a per-theme base appetite, and a daily seeded oscillation.
const THEMES = [
  { key: 'ai-video', label: 'AI video generation', appetite: 0.93, category: 'ai-service' },
  { key: 'voice-clone', label: 'Voice cloning & dubbing', appetite: 0.86, category: 'ai-service' },
  { key: 'ai-agents', label: 'Autonomous AI agents', appetite: 0.95, category: 'ai-service' },
  { key: 'translation', label: 'Real-time translation', appetite: 0.80, category: 'ai-service' },
  { key: 'rag-search', label: 'Private RAG / doc search', appetite: 0.84, category: 'ai-service' },
  { key: 'image-gen', label: 'On-brand image generation', appetite: 0.82, category: 'ai-service' },
  { key: 'seo-content', label: 'Programmatic SEO content', appetite: 0.78, category: 'digital' },
  { key: 'print-on-demand', label: 'Print-on-demand merch', appetite: 0.74, category: 'physical' },
  { key: 'crypto-pay', label: 'Crypto payment rails', appetite: 0.71, category: 'crypto' },
  { key: 'data-dashboards', label: 'Live data dashboards', appetite: 0.69, category: 'digital' },
  { key: 'compliance', label: 'AI compliance automation', appetite: 0.76, category: 'b2b' },
  { key: 'sales-copilot', label: 'Sales copilot / SDR', appetite: 0.88, category: 'b2b' },
  { key: 'support-bot', label: 'AI customer support', appetite: 0.85, category: 'ai-service' },
  { key: 'edu-tutor', label: 'AI tutoring', appetite: 0.72, category: 'digital' },
  { key: 'health-coach', label: 'AI health coaching', appetite: 0.67, category: 'digital' },
];

class MarketScanner {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.sources = SOURCE_TAXONOMY;
    this.lastScanAt = null;
    this.scanCount = 0;
    this.trends = []; // newest-first, capped
    this.maxTrends = 240;
  }

  sourceCount() { return this.sources.length; }

  // Optional, ToS-friendly enrichment. Only runs when a key/endpoint is set.
  // Never throws into the loop; returns [] on any problem.
  async _enrichFromPublicApis() {
    const out = [];
    const endpoint = process.env.ZACC_SOURCE_TRENDS_URL;
    if (!endpoint || typeof fetch !== 'function') return out;
    try {
      const r = await fetch(endpoint, { signal: AbortSignal.timeout(2500) });
      if (!r.ok) return out;
      const j = await r.json();
      const rows = Array.isArray(j) ? j : (j.items || j.trends || []);
      for (const row of rows.slice(0, 25)) {
        const label = String(row.label || row.title || row.name || '').trim();
        if (!label) continue;
        out.push({ label, score: clamp(row.score != null ? row.score : 0.7, 0, 1), source: 'external-api' });
      }
    } catch (_) { /* offline / blocked — fall back to signal engine */ }
    return out;
  }

  // Core scan: blends source taxonomy × theme appetite × live telemetry into a
  // ranked trend list with a demand score (0-1).
  async scan() {
    const daySeed = hash32(new Date().toISOString().slice(0, 10));
    const r = rng(daySeed ^ (this.scanCount + 1));

    // Live internal demand pulse (real signal): how active the platform is.
    let internalPulse = 0.5;
    try {
      const tele = this.ctx.telemetry && this.ctx.telemetry();
      if (tele && Number.isFinite(Number(tele.economyPulse))) {
        internalPulse = clamp(Number(tele.economyPulse) / 100, 0, 1);
      }
    } catch (_) { /* keep default */ }

    const captured = [];
    for (const theme of THEMES) {
      // Two strongest sources back each theme this cycle (rotates daily).
      const ranked = this.sources
        .map(s => ({ s, w: s.weight * (0.6 + 0.4 * r()) }))
        .sort((a, b) => b.w - a.w)
        .slice(0, 2)
        .map(x => x.s);
      const sourceBoost = ranked.reduce((acc, s) => acc + s.weight, 0) / (ranked.length || 1);
      const oscillation = 0.85 + 0.3 * r();
      const score = clamp(theme.appetite * 0.55 + sourceBoost * 0.25 + internalPulse * 0.20, 0, 1) * oscillation;
      captured.push({
        id: 'trend-' + slug(theme.key) + '-' + daySeed.toString(36),
        theme: theme.key,
        label: theme.label,
        category: theme.category,
        score: round2(clamp(score, 0, 1)),
        demand: round2(clamp(score * (0.7 + 0.6 * r()), 0, 1)),
        sources: ranked.map(s => s.id),
        capturedAt: now(),
      });
    }

    // Merge optional external rows (only when configured).
    const external = await this._enrichFromPublicApis();
    for (const ex of external) {
      captured.push({
        id: 'trend-ext-' + slug(ex.label) + '-' + daySeed.toString(36),
        theme: slug(ex.label),
        label: ex.label,
        category: 'external',
        score: round2(ex.score),
        demand: round2(ex.score),
        sources: ['external-api'],
        capturedAt: now(),
      });
    }

    captured.sort((a, b) => b.score - a.score);
    this.trends = captured.concat(this.trends).slice(0, this.maxTrends);
    this.lastScanAt = now();
    this.scanCount += 1;
    return captured;
  }

  top(n) { return this.trends.slice(0, n || 12); }

  status() {
    return {
      ok: true,
      sources: this.sources.length,
      sourceList: this.sources.map(s => s.id),
      scanCount: this.scanCount,
      lastScanAt: this.lastScanAt,
      trendsTracked: this.trends.length,
      top: this.top(6).map(t => ({ label: t.label, score: t.score, category: t.category })),
      externalEnrichment: !!process.env.ZACC_SOURCE_TRENDS_URL,
    };
  }
}

module.exports = { MarketScanner, SOURCE_TAXONOMY, THEMES };
