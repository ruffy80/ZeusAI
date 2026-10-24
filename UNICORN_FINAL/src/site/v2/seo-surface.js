'use strict';

/**
 * Human SEO desk — explains sitemap index / urlsets without dumping raw XML.
 */

function pageSeo() {
  let seven = '';
  try { seven = require('../../../backend/modules/discovery-seven').sevenHtml(); } catch (_) { seven = ''; }
  return `<section class="hero" style="min-height:auto;padding:48px 0 20px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> SEO · discovery desk</span>
    <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Sitemap that humans and crawlers both understand.</span></h1>
    <p class="lead">Search engines read XML. Humans get a styled desk. No more blank “document tree” shock when you open the sitemap from the footer.</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px">
      <a class="btn btn-primary" href="/sitemap.xml" data-allow-raw="1">Open main sitemap</a>
      <a class="btn btn-ghost" href="/seo/sitemap-index.xml" data-allow-raw="1">Open sitemap index</a>
      <a class="btn btn-ghost" href="/buy" data-link>Buy now</a>
    </div>
  </div>
</section>

<section class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:28px">
  <div class="card" style="padding:16px">
    <span class="kicker">/sitemap.xml</span>
    <h3 style="margin:8px 0 6px;font-size:16px">Public pages + services</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Homepage, about, pricing, contact, public insight articles, and public service pages such as /services/instant-resume-makeover. Internal routes stay out.</p>
  </div>
  <div class="card" style="padding:16px">
    <span class="kicker">/seo/sitemap-services.xml</span>
    <h3 style="margin:8px 0 6px;font-size:16px">Service detail pages</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Dedicated index of /services/:id for catalog depth.</p>
  </div>
  <div class="card" style="padding:16px">
    <span class="kicker">/seo/sitemap-index.xml</span>
    <h3 style="margin:8px 0 6px;font-size:16px">Index of sitemaps</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Points crawlers at both files. Same content as /seo/sitemap.xml.</p>
  </div>
  <div class="card" style="padding:16px">
    <span class="kicker">/robots.txt</span>
    <h3 style="margin:8px 0 6px;font-size:16px">Crawl policy</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Googlebot is blocked from /api/, /status, /health, /origin, /admin, /dashboard, /metrics, and /internal/. HTML that is not a public marketing page sends noindex. The homepage, about, pricing, contact, insight articles, and shelf services stay allowed.</p>
  </div>
</section>

${seven}
${require('../../seo/organic-growth').deskHtml()}
${require('../../seo/merchant-offer').contractHtml()}
<section class="card" style="padding:20px;margin-bottom:48px">
  <span class="kicker">Honesty</span>
  <h2 style="margin:8px 0 10px">What we index — and what we don’t</h2>
  <ul style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:0;padding-left:18px">
    <li>The sitemap lists /, /about, /pricing, /contact, each public insight article, and each public shelf service. /api/, /status, /health, /origin, /admin, and /dashboard are excluded.</li>
    <li>/dashboard and /account stay out of the sitemap (robots disallow)</li>
    <li>No fake “indexed billions of pages” claims — inventory is generated from the live catalog</li>
    <li>IndexNow pings Bing/Yandex. A 403 from Bing means the host is not verified yet — add <code>BING_WEBMASTER_API_KEY</code>.</li>
    <li>Google ranking needs <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> so Search Console gets the sitemap. Google retired the ping API in 2023. This desk does not claim the site is indexed.</li>
    <li>Every shelf offer has a guide at <a href="/guides" data-link>/guides</a>. The price on the article is the shelf price. The same list is in <a href="/llms.txt" data-allow-raw="1">/llms.txt</a>.</li>
    <li>A generated matrix of <code>/solutions/&#123;vertical&#125;/for/&#123;industry&#125;</code> had no page. Ten verticals by fifty industries is five hundred addresses. Search Console still lists the ones it crawled (the overview showed 480) under Not indexed, because the old 410 also sent <code>noindex</code>. They now return 410 with no robots tag, and they stay out of every sitemap. Google drops them after it recrawls. This page does not report that count as zero. The ledger is <a href="/indexing.json" data-allow-raw="1">/indexing.json</a>.</li>
    <li>A visitor does not need Facebook, TikTok, Instagram, or X. Search, guides, docs, and llms.txt stay up with no social token.</li>
    <li>Those networks stay optional. Tokenless hop: <a href="/relay" data-link>/relay</a> and <a href="/share" data-link>/share</a>.</li>
  </ul>
  <p style="margin-top:14px;font-size:13px;color:var(--ink-dim)">
    <a href="/robots.txt" data-allow-raw="1">robots.txt</a> ·
    <a href="/api/seo/status" data-allow-raw="1">/api/seo/status</a> ·
    <a href="/visible-world" data-link>/visible-world</a> ·
    <a href="/relay" data-link>/relay</a>
  </p>
</section>
${require('../../commerce/share-surface').pageShareHtml({ path: '/seo', title: 'ZeusAI SEO desk', text: 'Sitemap, Search Console numbers when Google returns them, and 50 unpublished article proposals.' })}`;
}

module.exports = { pageSeo };
