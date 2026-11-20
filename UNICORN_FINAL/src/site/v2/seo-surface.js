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
    <h3 style="margin:8px 0 6px;font-size:16px">Public marketing pages</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Homepage, /about, /pricing, /contact, and the three enterprise module pages under /solutions. Shelf URLs, insight articles, /api, /origin, and /status stay out of this file.</p>
  </div>
  <div class="card" style="padding:16px">
    <span class="kicker">/seo/sitemap-services.xml</span>
    <h3 style="margin:8px 0 6px;font-size:16px">Service detail pages</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Public shelf pages at /services/:id. robots.txt points crawlers here. The seven-URL marketing sitemap stays the company and solution set.</p>
  </div>
  <div class="card" style="padding:16px">
    <span class="kicker">/seo/sitemap-index.xml</span>
    <h3 style="margin:8px 0 6px;font-size:16px">Index of sitemaps</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Optional index. robots.txt also lists /sitemap-authority.xml. IndexNow still submits only the seven marketing URLs.</p>
  </div>
  <div class="card" style="padding:16px">
    <span class="kicker">/robots.txt</span>
    <h3 style="margin:8px 0 6px;font-size:16px">Crawl policy</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Googlebot is blocked from /api/, /origin, /status, /health, /metrics, /admin, /dashboard, /internal/, and the other private prefixes. Public pages stay allowed.</p>
  </div>
</section>

${seven}
${require('../../seo/organic-growth').deskHtml()}
${require('../../seo/merchant-offer').contractHtml()}
${(() => {
  try {
    const sags = require('../../../backend/modules/seo-aeo-geo-singularity');
    const st = sags.getStatus();
    return `<section id="seoAeoGeoSingularity" class="card" style="padding:22px;margin-bottom:28px;border:1px solid rgba(0,255,163,.35);background:linear-gradient(135deg,rgba(0,255,163,.06),rgba(138,92,255,.08))">
  <span class="kicker" style="color:#00ffa3">SAGS/1.0 · CCPP/1.0 · Autonomous Tri-Layer Continuum</span>
  <h2 style="margin:8px 0 10px">Self-Evolving SEO · AEO · GEO Singularity Engine</h2>
  <p style="color:var(--ink-dim);font-size:14px;margin:0 0 16px">Continuous self-evolving synchronization across Search Engines (Google/Bing/Yandex), Answer Engines (Perplexity, ChatGPT Search, Google AI Overviews), and Frontier Generative Models (Claude, GPT-4o, Gemini, DeepSeek). Every Answer Capsule and RAG vector chunk is cryptographically signed with Ed25519.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
    <div class="card" style="padding:14px;background:rgba(5,4,10,.55)"><span class="kicker">AEO Answer Capsules</span><h3 style="margin:6px 0 2px;color:#00ffa3">${st.totalCapsules} Ed25519 Signed</h3><p style="margin:0;font-size:12px;color:var(--ink-dim)">Atomic claim-evidence-signature triples</p></div>
    <div class="card" style="padding:14px;background:rgba(5,4,10,.55)"><span class="kicker">GEO Semantic RAG Chunks</span><h3 style="margin:6px 0 2px;color:#3ea0ff">${st.totalRagChunks} Vector Blocks</h3><p style="margin:0;font-size:12px;color:var(--ink-dim)">~256-token pre-chunked LLM windows</p></div>
    <div class="card" style="padding:14px;background:rgba(5,4,10,.55)"><span class="kicker">Multilingual Matrix</span><h3 style="margin:6px 0 2px;color:#ffd36a">${st.multilingualLocales} Global Locales</h3><p style="margin:0;font-size:12px;color:var(--ink-dim)">EN · RO · DE · FR · ES · IT · PT · AR</p></div>
    <div class="card" style="padding:14px;background:rgba(5,4,10,.55)"><span class="kicker">Evolution Generation</span><h3 style="margin:6px 0 2px;color:#c7a8ff">Gen #${st.evolutionGeneration}</h3><p style="margin:0;font-size:12px;color:var(--ink-dim)">Auto-learns from live customer queries</p></div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:10px">
    <a class="btn btn-primary" href="/llms-full.txt" data-allow-raw="1">Open /llms-full.txt →</a>
    <a class="btn btn-ghost" href="/.well-known/aeo-answer-graph.json" data-allow-raw="1">AEO Answer Graph (JSON)</a>
    <a class="btn btn-ghost" href="/.well-known/geo-citation-matrix.json" data-allow-raw="1">GEO Citation Matrix (JSON)</a>
    <a class="btn btn-ghost" href="/api/geo/rag-chunks" data-allow-raw="1">Semantic RAG Chunks</a>
    <a class="btn btn-ghost" href="/api/seo-aeo-geo/status" data-allow-raw="1">Tri-Layer Audit Status</a>
  </div>
</section>`;
  } catch (_) { return ''; }
})()}
<section class="card" style="padding:20px;margin-bottom:48px">
  <span class="kicker">Honesty</span>
  <h2 style="margin:8px 0 10px">What we index — and what we don’t</h2>
  <ul style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:0;padding-left:18px">
    <li>The public sitemap lists /, /about, /pricing, /contact, /solutions/model-routing, /solutions/self-healing, and /solutions/autonomous-agents. /api/, /status, /health, /origin, /admin, /dashboard, /internal/, shelf URLs, and insight articles are excluded.</li>
    <li>Shelf offer URLs live in <a href="/seo/sitemap-services.xml" data-allow-raw="1">/seo/sitemap-services.xml</a>. robots.txt lists that file. They stay out of the seven-URL marketing sitemap.</li>
    <li>Engineering guides live in <a href="/sitemap-authority.xml" data-allow-raw="1">/sitemap-authority.xml</a>. Facts and worksheets live in <a href="/sitemap-geo.xml" data-allow-raw="1">/sitemap-geo.xml</a>. Neither is in the seven-URL marketing sitemap, and IndexNow does not submit them.</li>
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
