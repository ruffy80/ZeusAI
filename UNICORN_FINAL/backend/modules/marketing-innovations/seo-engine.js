// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/seo-engine.js
//
// SEO assistance: long-tail keyword expansion, OG/Twitter meta-tag
// generator, JSON-LD schema.org builder for Product / Organization /
// FAQPage / BreadcrumbList / WebSite (sitelinks searchbox).
//
// All outputs are pure strings/objects — no DB, no network. Safe to
// call inline from any HTTP handler.
// =====================================================================

'use strict';

const SEO_INTENTS = ['best', 'free', 'how to', 'top', 'cheap', 'open source', 'alternative to', 'vs', 'pricing', 'reviews', 'tutorial', 'demo', 'API', 'with AI', 'for startups', 'for enterprise', 'self-hosted', 'no-code', 'integration', '2026'];
const SEO_QUALIFIERS = ['guide', 'platform', 'tool', 'agent', 'automation', 'SaaS', 'engine', 'system', 'framework', 'workflow'];
const SEO_AUDIENCES = ['for developers', 'for marketers', 'for solo founders', 'for agencies', 'for SaaS', 'for e-commerce'];

function _slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

function _esc(s) {
  return String(s || '').replace(/[<>"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Expand a seed keyword into a list of long-tail variants.
 */
function expandKeywords(seed, opts) {
  const o = opts || {};
  const max = Math.max(5, Math.min(parseInt(o.max, 10) || 30, 200));
  const cleanSeed = String(seed || '').trim();
  if (!cleanSeed) return { seed: '', keywords: [] };
  const out = new Set();
  out.add(cleanSeed);
  for (const intent of SEO_INTENTS) out.add(`${intent} ${cleanSeed}`);
  for (const q of SEO_QUALIFIERS) out.add(`${cleanSeed} ${q}`);
  for (const a of SEO_AUDIENCES) out.add(`${cleanSeed} ${a}`);
  for (const intent of SEO_INTENTS) {
    for (const a of SEO_AUDIENCES) out.add(`${intent} ${cleanSeed} ${a}`);
    if (out.size >= max + 50) break;
  }
  // Add question forms.
  for (const q of ['what is', 'why use', 'how does', 'is it worth', 'how much does']) {
    out.add(`${q} ${cleanSeed}`);
  }
  const keywords = Array.from(out).slice(0, max).map((kw) => ({
    keyword: kw,
    slug: _slug(kw),
    estDifficulty: Math.min(100, 20 + (kw.length % 7) * 8 + (kw.split(' ').length * 3)),
    intent: kw.startsWith('how') || kw.startsWith('what') || kw.startsWith('why') ? 'informational'
      : (kw.includes('vs') || kw.includes('alternative') ? 'comparison'
      : (kw.includes('pricing') || kw.includes('reviews') ? 'commercial' : 'navigational')),
  }));
  return { seed: cleanSeed, keywords, generatedAt: new Date().toISOString() };
}

/**
 * Build OpenGraph + Twitter Card + standard meta tags.
 */
function buildMetaTags(opts) {
  const o = opts || {};
  const title = _esc(o.title || 'Unicorn — Autonomous SaaS Platform');
  const description = _esc(o.description || 'Autonomous AI agents that grow your SaaS revenue 24/7.');
  const url = _esc(o.url || 'https://unicorn.example');
  const image = _esc(o.image || `${url}/og.png`);
  const siteName = _esc(o.siteName || 'Unicorn');
  const twitter = _esc(o.twitter || '@UnicornAI');
  const lang = _esc(o.lang || 'en');

  const tags = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta http-equiv="Content-Language" content="${lang}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:site_name" content="${siteName}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="${twitter}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
  ];
  return { title, description, url, image, html: tags.join('\n'), tags };
}

/**
 * Build a JSON-LD schema.org object.
 */
function buildJsonLd(type, data) {
  const t = String(type || 'Organization');
  const d = data || {};
  switch (t) {
    case 'Product': return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: d.name || 'Unicorn Platform',
      description: d.description || 'Autonomous SaaS automation agents.',
      brand: { '@type': 'Brand', name: d.brand || 'Unicorn' },
      sku: d.sku || `UNI-${_slug(d.name || 'platform')}`,
      offers: {
        '@type': 'Offer',
        priceCurrency: d.currency || 'USD',
        price: d.price != null ? String(d.price) : '99.00',
        availability: 'https://schema.org/InStock',
        url: d.url || 'https://unicorn.example',
      },
      aggregateRating: d.rating ? {
        '@type': 'AggregateRating',
        ratingValue: String(d.rating),
        reviewCount: String(d.reviewCount || 1),
      } : undefined,
    };
    case 'Organization': return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: d.name || 'Unicorn',
      url: d.url || 'https://unicorn.example',
      logo: d.logo || 'https://unicorn.example/logo.png',
      sameAs: Array.isArray(d.sameAs) ? d.sameAs : [],
    };
    case 'FAQPage': return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (Array.isArray(d.faqs) ? d.faqs : []).map((q) => ({
        '@type': 'Question',
        name: q.q || q.question || '',
        acceptedAnswer: { '@type': 'Answer', text: q.a || q.answer || '' },
      })),
    };
    case 'BreadcrumbList': return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: (Array.isArray(d.items) ? d.items : []).map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        item: it.url,
      })),
    };
    case 'WebSite': return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: d.name || 'Unicorn',
      url: d.url || 'https://unicorn.example',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${d.url || 'https://unicorn.example'}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    };
    default:
      return { '@context': 'https://schema.org', '@type': t, ...d };
  }
}

/**
 * One-shot SEO bundle: meta + JSON-LD + suggested keywords for a page.
 */
function buildPageBundle(opts) {
  const o = opts || {};
  const meta = buildMetaTags(o);
  const jsonld = buildJsonLd(o.schemaType || 'WebSite', o.schemaData || { name: o.siteName, url: o.url });
  const keywords = expandKeywords(o.seedKeyword || (o.title || 'Unicorn'), { max: 20 });
  return {
    meta,
    jsonld,
    jsonldHtml: `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
    keywords,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  expandKeywords,
  buildMetaTags,
  buildJsonLd,
  buildPageBundle,
};
