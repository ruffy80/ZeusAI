// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/programmatic-seo.js
//
// Long-tail page generator. Given a list of categories × cities (or any
// 2D combinator), produces:
//   - per-page meta tags + JSON-LD (FAQPage / HowTo / LocalBusiness)
//   - a deterministic slug per pair
//   - a sitemap.xml shard
//   - an IndexNow ping payload (key + url list) — actual ping is opt-in
//     via MARKETING_INDEXNOW_KEY (no-op if missing).
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const seo = require('./seo-engine');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const SITEMAP_FILE = process.env.MARKETING_PSEO_SITEMAP
  || path.join(DATA_DIR, 'pseo-sitemap.xml');

const DISABLED = process.env.MARKETING_PSEO_DISABLED === '1';

function _slug(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function _escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]);
}

/**
 * Build a single long-tail page bundle.
 *  opts = { category, region?, baseUrl?, brand? }
 */
function buildPage(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const o = opts || {};
  const category = String(o.category || 'service');
  const region = String(o.region || '');
  const baseUrl = String(o.baseUrl || 'https://unicorn.local').replace(/\/$/, '');
  const brand = String(o.brand || 'Unicorn');
  const slug = `/services/${_slug(category)}${region ? '/' + _slug(region) : ''}`;
  const url = baseUrl + slug;
  const title = region
    ? `${category} in ${region} | ${brand}`
    : `${category} | ${brand}`;
  const description = `Best ${category}${region ? ' in ' + region : ''} — automated, BTC-friendly, instant onboarding by ${brand}.`;
  const meta = seo.buildMetaTags({ title, description, url });
  const faqs = [
    { q: `How does ${brand} deliver ${category}${region ? ' in ' + region : ''}?`, a: `Through fully autonomous workflows and 24/7 monitoring.` },
    { q: `Can I pay in BTC?`, a: `Yes — BTC, fiat and PayPal are supported.` },
    { q: `How fast is onboarding?`, a: `Under 60 seconds, instant API keys.` },
  ];
  const jsonLd = seo.buildJsonLd('FAQPage', { faqs });
  return {
    ok: true,
    slug, url, title, description,
    meta, jsonLd, faqs,
  };
}

/**
 * Build many pages from a category × region grid.
 */
function buildBatch(opts) {
  const o = opts || {};
  const cats = (o.categories || []).slice(0, 200);
  const regs = (o.regions || ['']).slice(0, 200);
  const baseUrl = o.baseUrl || 'https://unicorn.local';
  const brand = o.brand || 'Unicorn';
  const pages = [];
  for (const c of cats) {
    for (const r of regs) {
      const p = buildPage({ category: c, region: r, baseUrl, brand });
      if (p.ok) pages.push(p);
      if (pages.length >= 5000) break;
    }
    if (pages.length >= 5000) break;
  }
  return { ok: true, count: pages.length, pages };
}

/**
 * Build a sitemap.xml from a list of pages (or url strings).
 */
function buildSitemap(items) {
  const list = Array.isArray(items) ? items : [];
  const urls = list.map((it) => typeof it === 'string' ? it : it.url).filter(Boolean);
  const now = new Date().toISOString();
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map((u) => `  <url><loc>${_escapeXml(u)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`).join('\n')
    + '\n</urlset>\n';
  try { fs.mkdirSync(path.dirname(SITEMAP_FILE), { recursive: true }); fs.writeFileSync(SITEMAP_FILE, xml); } catch (_) {}
  return { ok: true, count: urls.length, file: SITEMAP_FILE, xml };
}

/**
 * Prepare an IndexNow payload. If MARKETING_INDEXNOW_KEY is set and
 * MARKETING_INDEXNOW_PING=1, attempt the ping via fetch (best-effort).
 */
async function indexNowPing(opts) {
  const o = opts || {};
  const key = process.env.MARKETING_INDEXNOW_KEY || '';
  if (!key) return { ok: false, reason: 'no_key', urls: o.urls || [] };
  const host = String(o.host || 'unicorn.local').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const payload = { host, key, urlList: (o.urls || []).slice(0, 10000) };
  if (process.env.MARKETING_INDEXNOW_PING !== '1' || typeof fetch !== 'function') {
    return { ok: true, dryRun: true, payload };
  }
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: r.ok, status: r.status, payload };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), payload };
  }
}

function status() {
  let exists = false; try { exists = fs.existsSync(SITEMAP_FILE); } catch (_) {}
  return {
    disabled: DISABLED,
    sitemapFile: SITEMAP_FILE,
    sitemapExists: exists,
    indexNowConfigured: !!process.env.MARKETING_INDEXNOW_KEY,
  };
}

module.exports = { buildPage, buildBatch, buildSitemap, indexNowPing, status, _slug };
