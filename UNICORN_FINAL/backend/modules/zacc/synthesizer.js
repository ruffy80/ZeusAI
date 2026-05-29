// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC component 2 — Idea Synthesizer.
// RO: combină trendurile cu modulele/capabilitățile existente în Unicorn și
// generează 3-5 idei noi pe zi (nume, descriere, piață, preț, cost, marjă).

'use strict';

const { now, rng, hash32, clamp, slug, shortId, round2 } = require('./util');

// Unicorn capability palette the synthesizer can fuse with a trend. These map
// to real engines already in the platform (AGI text, image, voice, RAG, etc.).
const CAPABILITIES = [
  { id: 'text-gen', label: 'AGI text generation', floor: 19 },
  { id: 'image-gen', label: 'on-brand image generation', floor: 29 },
  { id: 'voice', label: 'voice synthesis & cloning', floor: 39 },
  { id: 'translation', label: 'multilingual translation', floor: 25 },
  { id: 'rag', label: 'private RAG document search', floor: 49 },
  { id: 'video', label: 'AI video assembly', floor: 59 },
  { id: 'agent', label: 'autonomous task agent', floor: 79 },
  { id: 'analytics', label: 'live analytics dashboard', floor: 35 },
  { id: 'checkout', label: 'BTC checkout + delivery', floor: 0 },
  { id: 'support-bot', label: 'specialized support chatbot', floor: 19 },
  { id: 'seo', label: 'programmatic SEO pages', floor: 29 },
];

const TYPE_BY_CATEGORY = {
  'ai-service': 'ai-service',
  digital: 'digital',
  physical: 'physical',
  crypto: 'crypto',
  b2b: 'subscription',
  external: 'ai-service',
};

// Price anchors per type (USD). Used with margin to set the asking price.
const PRICE_ANCHOR = {
  'ai-service': [39, 199],
  digital: [19, 99],
  physical: [25, 120],
  crypto: [49, 499],
  subscription: [99, 1499],
};

class IdeaSynthesizer {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.ideas = []; // newest-first
    this.maxIdeas = 500;
    this.generated = 0;
    this.minMarginPct = Number(process.env.ZACC_MIN_MARGIN_PCT || 25);
  }

  _composeName(trend, cap, r) {
    const themeWord = trend.label.replace(/\b(AI|& dubbing|generation)\b/gi, '').trim();
    const capWord = cap.label.split(' ')[0];
    const patterns = [
      'Zeus ' + themeWord + ' ' + capWord,
      themeWord + ' Suite',
      'AI ' + themeWord + ' Studio',
      themeWord + ' Autopilot',
      'Sovereign ' + themeWord,
    ];
    const idx = Math.floor(r() * patterns.length) % patterns.length;
    return patterns[idx].replace(/\s+/g, ' ').trim();
  }

  _priceFor(type, trend, r) {
    const [lo, hi] = PRICE_ANCHOR[type] || [29, 199];
    const demand = clamp(trend.demand != null ? trend.demand : trend.score, 0, 1);
    const price = lo + (hi - lo) * (0.35 + 0.65 * demand) * (0.9 + 0.2 * r());
    const cost = price * clamp(0.35 + 0.3 * (1 - demand), 0.2, 0.7);
    const marginPct = round2(((price - cost) / price) * 100);
    return { priceUsd: round2(price), costUsd: round2(cost), marginPct };
  }

  // Generate `count` ideas (default 3-5) from the freshest trends.
  synthesize(trends, count) {
    const list = Array.isArray(trends) ? trends.slice(0, 12) : [];
    if (!list.length) return [];
    const want = count || (3 + Math.floor(Math.random() * 3)); // 3..5
    const daySeed = hash32(now().slice(0, 13));
    const r = rng(daySeed ^ (this.generated + 1));
    const out = [];

    for (let i = 0; i < want && i < list.length; i++) {
      const trend = list[i];
      // Fuse 2-3 capabilities with the trend.
      const capCount = 2 + (r() > 0.5 ? 1 : 0);
      const caps = CAPABILITIES
        .map(c => ({ c, k: r() }))
        .sort((a, b) => b.k - a.k)
        .slice(0, capCount)
        .map(x => x.c);
      const type = TYPE_BY_CATEGORY[trend.category] || 'ai-service';
      const pricing = this._priceFor(type, trend, r);
      if (pricing.marginPct < this.minMarginPct) {
        // Re-anchor price up to satisfy the configured margin floor.
        pricing.priceUsd = round2(pricing.costUsd / (1 - this.minMarginPct / 100));
        pricing.marginPct = this.minMarginPct;
      }
      const name = this._composeName(trend, caps[0], r);
      const capText = caps.map(c => c.label).join(' + ');
      const idea = {
        id: shortId('idea'),
        name,
        slug: slug(name),
        description: 'Productizes the "' + trend.label + '" trend by fusing '
          + capText + '. Delivered the moment BTC payment confirms, with a '
          + 'specialized support agent and self-tuning pricing.',
        market: this._marketFor(type),
        type,
        capabilities: caps.map(c => c.id),
        priceUsd: pricing.priceUsd,
        costUsd: pricing.costUsd,
        marginPct: pricing.marginPct,
        basedOn: [trend.id],
        trendScore: trend.score,
        status: 'proposed',
        createdAt: now(),
      };
      out.push(idea);
    }

    this.ideas = out.concat(this.ideas).slice(0, this.maxIdeas);
    this.generated += out.length;
    return out;
  }

  _marketFor(type) {
    return {
      'ai-service': 'SMB & creators needing automated AI output',
      digital: 'Solo founders & marketers',
      physical: 'DTC / creator merch buyers',
      crypto: 'Crypto-native businesses & treasuries',
      subscription: 'B2B teams (sales, support, compliance)',
    }[type] || 'General AI buyers';
  }

  byStatus(status) { return this.ideas.filter(i => i.status === status); }

  setStatus(ideaId, status) {
    const idea = this.ideas.find(i => i.id === ideaId);
    if (idea) idea.status = status;
    return idea || null;
  }

  status() {
    const proposed = this.byStatus('proposed').length;
    return {
      ok: true,
      generated: this.generated,
      tracked: this.ideas.length,
      proposed,
      approved: this.byStatus('approved').length,
      active: this.byStatus('active').length,
      minMarginPct: this.minMarginPct,
      latest: this.ideas.slice(0, 5).map(i => ({ id: i.id, name: i.name, type: i.type, priceUsd: i.priceUsd, marginPct: i.marginPct, status: i.status })),
    };
  }
}

module.exports = { IdeaSynthesizer, CAPABILITIES };
