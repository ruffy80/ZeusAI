'use strict';

/**
 * Human SEO desk — explains sitemap index / urlsets without dumping raw XML.
 */

function pageSeo() {
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
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Full urlset: conversion pages (/buy, /standard, /continuity…) and live services. Styled with XSL in the browser.</p>
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
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0">Allows AI bots; disallows /dashboard and /account; lists sitemap URLs.</p>
  </div>
</section>

<section class="card" style="padding:20px;margin-bottom:48px">
  <span class="kicker">Honesty</span>
  <h2 style="margin:8px 0 10px">What we index — and what we don’t</h2>
  <ul style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:0;padding-left:18px">
    <li>Conversion + trust pages are always listed (/buy, /standard, /continuity, /rails…)</li>
    <li>/dashboard and /account stay out of the sitemap (robots disallow)</li>
    <li>No fake “indexed billions of pages” claims — inventory is generated from the live catalog</li>
  </ul>
  <p style="margin-top:14px;font-size:13px;color:var(--ink-dim)">
    <a href="/robots.txt" data-allow-raw="1">robots.txt</a> ·
    <a href="/standard" data-link>/standard</a> ·
    <a href="/trust" data-link>/trust</a>
  </p>
</section>`;
}

module.exports = { pageSeo };
