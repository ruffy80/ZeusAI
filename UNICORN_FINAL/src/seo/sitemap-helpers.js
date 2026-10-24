'use strict';

/**
 * SEO sitemap helpers — human-readable XSL + complete public URL inventory.
 * Crawlers get valid XML; humans clicking footer "Sitemap" see a styled desk.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'SEO/1.0';

/**
 * Marketing pages a crawler should keep.
 * Service URLs are /services/<shelf id> (the live resume page is
 * /services/instant-resume-makeover). Blog posts are /insights/<slug>.
 */
const MARKETING_PAGES = Object.freeze([
  { path: '/', changefreq: 'weekly', priority: '1.0', source: 'shell' },
  { path: '/about', changefreq: 'monthly', priority: '0.8', source: 'shell' },
  { path: '/pricing', changefreq: 'weekly', priority: '0.9', source: 'shell' },
  { path: '/contact', changefreq: 'monthly', priority: '0.8', source: 'shell' },
]);

/** Exact paths and prefixes that must never appear in a public sitemap. */
const BLOCKED_EXACT = new Set([
  '/status',
  '/health',
  '/origin',
  '/admin',
  '/dashboard',
  '/account',
  '/checkout',
  '/login',
  '/signup',
  '/auth',
  '/operator',
  '/metrics',
  '/outreach-desk',
  '/api',
  '/internal',
]);

const BLOCKED_PREFIXES = [
  '/api/',
  '/admin/',
  '/dashboard/',
  '/account/',
  '/status/',
  '/health/',
  '/origin/',
  '/checkout/',
  '/login/',
  '/signup/',
  '/auth/',
  '/operator/',
  '/metrics/',
  '/internal/',
  '/.well-known/',
];

/** robots.txt Disallow lines. Googlebot gets the same list, because a
 *  more specific user-agent group replaces the * group. */
const ROBOTS_DISALLOW_LINES = Object.freeze([
  'Disallow: /api/',
  'Disallow: /admin',
  'Disallow: /admin/',
  'Disallow: /dashboard',
  'Disallow: /dashboard/',
  'Disallow: /account',
  'Disallow: /status',
  'Disallow: /health',
  'Disallow: /origin',
  'Disallow: /checkout',
  'Disallow: /checkout/',
  'Disallow: /login',
  'Disallow: /signup',
  'Disallow: /auth',
  'Disallow: /operator',
  'Disallow: /outreach-desk',
  'Disallow: /metrics',
  'Disallow: /internal/',
]);

/** Kept so older callers can skip private paths. */
const ROBOTS_DISALLOW = new Set([
  '/dashboard',
  '/account',
  '/admin',
  '/api/admin',
  '/api/admin/',
  '/outreach-desk',
  '/status',
  '/health',
  '/origin',
  '/checkout',
  '/metrics',
  '/operator',
  '/internal',
]);

const SOURCE_FILES = {
  shell: path.join(__dirname, '../site/v2/shell.js'),
  insights: path.join(__dirname, '../site/v2/discover-trust-os.js'),
};

const CATALOG_FILES = [
  'instant-catalog.js',
  'enterprise-catalog.js',
  'money-catalog.js',
].map((name) => path.join(__dirname, '../commerce', name));

function normalizeBase(base) {
  return String(base || 'https://zeusai.pro').replace(/\/+$/, '');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlStylesheetPi() {
  return '<?xml-stylesheet type="text/xsl" href="/seo/sitemap.xsl"?>\n';
}

/**
 * Human-friendly XSL for both urlset and sitemapindex.
 * Browsers apply this when opening sitemap XML; crawlers ignore it.
 */
function sitemapXsl() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sm">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>ZeusAI · Sitemap</title>
        <style>
          :root { color-scheme: dark; --bg:#07090d; --ink:#e9edf5; --muted:#9aa6bd; --line:rgba(160,200,255,.16); --accent:#5eead4; --grad:#3ea0ff; }
          * { box-sizing: border-box; }
          body { margin:0; font:15px/1.55 system-ui,Segoe UI,sans-serif; background:radial-gradient(1200px 600px at 10% -10%,rgba(62,160,255,.18),transparent), var(--bg); color:var(--ink); }
          .wrap { max-width:920px; margin:0 auto; padding:28px 18px 64px; }
          h1 { font-size:clamp(28px,4vw,40px); letter-spacing:-.03em; margin:0 0 8px; }
          .brand { color:var(--accent); }
          .lead { color:var(--muted); margin:0 0 22px; max-width:40rem; }
          .meta { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:22px; }
          .chip { border:1px solid var(--line); border-radius:999px; padding:4px 10px; font-size:12px; color:var(--muted); }
          table { width:100%; border-collapse:collapse; }
          th, td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
          th { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
          a { color:var(--grad); text-decoration:none; }
          a:hover { text-decoration:underline; }
          .foot { margin-top:28px; color:var(--muted); font-size:13px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1><span class="brand">ZeusAI</span> Sitemap</h1>
          <p class="lead">Machine-readable map for search engines and AI agents. This styled view is for humans — crawlers read the raw XML.</p>
          <xsl:choose>
            <xsl:when test="sm:sitemapindex">
              <div class="meta">
                <span class="chip">sitemap index</span>
                <span class="chip"><xsl:value-of select="count(sm:sitemapindex/sm:sitemap)"/> child sitemaps</span>
              </div>
              <table>
                <thead><tr><th>Sitemap</th><th>Last modified</th></tr></thead>
                <tbody>
                  <xsl:for-each select="sm:sitemapindex/sm:sitemap">
                    <tr>
                      <td><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
                      <td><xsl:value-of select="sm:lastmod"/></td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </xsl:when>
            <xsl:otherwise>
              <div class="meta">
                <span class="chip">urlset</span>
                <span class="chip"><xsl:value-of select="count(sm:urlset/sm:url)"/> URLs</span>
              </div>
              <table>
                <thead><tr><th>URL</th><th>Last modified</th><th>Priority</th></tr></thead>
                <tbody>
                  <xsl:for-each select="sm:urlset/sm:url">
                    <tr>
                      <td><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
                      <td><xsl:value-of select="sm:lastmod"/></td>
                      <td><xsl:value-of select="sm:priority"/></td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </xsl:otherwise>
          </xsl:choose>
          <p class="foot">Also: <a href="/seo">/seo desk</a> · <a href="/buy">/buy</a> · <a href="/standard">Merchant Trust Standard</a> · <a href="/robots.txt">robots.txt</a></p>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;
}

function normalizePath(pathname) {
  let p = String(pathname || '').trim();
  if (!p) return '';
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

function isBlockedPath(pathname) {
  const p = normalizePath(pathname);
  if (!p) return true;
  if (BLOCKED_EXACT.has(p) || ROBOTS_DISALLOW.has(p)) return true;
  return BLOCKED_PREFIXES.some((pre) => p.startsWith(pre));
}

function dateFromMtime(file) {
  try {
    const ms = fs.statSync(file).mtimeMs;
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return new Date(ms).toISOString().slice(0, 10);
  } catch (_) {
    return null;
  }
}

function catalogFileForService(id) {
  const key = String(id || '');
  if (!key) return null;
  const needleA = "'" + key + "'";
  const needleB = '"' + key + '"';
  for (const file of CATALOG_FILES) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes(needleA) || text.includes(needleB)) return file;
    } catch (_) { /* next catalog */ }
  }
  return null;
}

function lastmodForEntry(entry) {
  const source = entry && entry.source;
  if (source === 'shell') return dateFromMtime(SOURCE_FILES.shell) || todayDate();
  if (source === 'insights') return dateFromMtime(SOURCE_FILES.insights) || todayDate();
  if (source && source.indexOf('service:') === 0) {
    const id = source.slice('service:'.length);
    const file = catalogFileForService(id) || SOURCE_FILES.shell;
    return dateFromMtime(file) || todayDate();
  }
  return todayDate();
}

function publicBlogEntries() {
  let articles = [];
  try {
    articles = require('../site/v2/discover-trust-os').ARTICLES || [];
  } catch (_) {
    articles = [];
  }
  return articles.filter((article) => article && article.slug).map((article) => ({
    path: '/insights/' + encodeURIComponent(article.slug),
    changefreq: 'monthly',
    priority: '0.6',
    source: 'insights',
  }));
}

function publicServiceEntries() {
  let rows = [];
  try {
    rows = require('../commerce/public-shelf').publicShelf() || [];
  } catch (_) {
    rows = [];
  }
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const id = row && row.id ? String(row.id) : '';
    if (!id || seen.has(id)) continue;
    if (/^synthetic[_-]/i.test(id) || /^unicorn-(auto-)?module-/i.test(id)) continue;
    const servicePath = '/services/' + encodeURIComponent(id);
    if (isBlockedPath(servicePath)) continue;
    seen.add(id);
    out.push({
      path: servicePath,
      changefreq: 'weekly',
      priority: '0.7',
      source: 'service:' + id,
    });
  }
  return out;
}

function marketingEntries() {
  const seen = new Set();
  const out = [];
  MARKETING_PAGES.concat(publicBlogEntries(), publicServiceEntries()).forEach((entry) => {
    const p = normalizePath(entry && entry.path);
    if (!p || seen.has(p) || isBlockedPath(p)) return;
    seen.add(p);
    out.push(Object.assign({}, entry, { path: p }));
  });
  return out;
}

function buildUrlsetXml(base, paths, opts) {
  const b = normalizeBase(base);
  const fallbackLastmod = (opts && opts.lastmod) || todayDate();
  const fallbackFreq = (opts && opts.changefreq) || 'weekly';
  const seen = new Set();
  const rows = [];
  for (const raw of paths || []) {
    const fromObject = raw && typeof raw === 'object';
    const p = normalizePath(fromObject ? (raw.path || raw.loc) : raw);
    if (!p || isBlockedPath(p) || seen.has(p)) continue;
    seen.add(p);
    const lastmod = (fromObject && raw.lastmod) || fallbackLastmod;
    const changefreq = (fromObject && raw.changefreq) || fallbackFreq;
    const priority = p === '/'
      ? '1.0'
      : ((fromObject && raw.priority) || (opts && opts.priority) || '0.7');
    rows.push(
      `  <url><loc>${escapeXml(b + p)}</loc><lastmod>${escapeXml(lastmod)}</lastmod><changefreq>${escapeXml(changefreq)}</changefreq><priority>${priority}</priority></url>`
    );
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n`
    + xmlStylesheetPi()
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + rows.join('\n')
    + `\n</urlset>`
  );
}

function buildSitemapIndexXml(base, children) {
  const b = normalizeBase(base);
  const lastmod = todayDate();
  const rows = (children || []).map((loc) => {
    const full = String(loc).startsWith('http') ? loc : (b + loc);
    return `<sitemap><loc>${escapeXml(full)}</loc><lastmod>${escapeXml(lastmod)}</lastmod></sitemap>`;
  });
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n`
    + xmlStylesheetPi()
    + `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + rows.map((r) => `  ${r}`).join('\n')
    + `\n</sitemapindex>`
  );
}

let _indexableCache = { at: 0, paths: null };

function indexablePaths() {
  const now = Date.now();
  if (_indexableCache.paths && (now - _indexableCache.at) < 30000) return _indexableCache.paths;
  const paths = new Set(marketingEntries().map((entry) => entry.path));
  _indexableCache = { at: now, paths };
  return paths;
}

function isIndexablePath(pathname) {
  const p = normalizePath(pathname);
  if (!p) return false;
  return indexablePaths().has(p);
}

function corePublicPaths() {
  return marketingEntries().map((entry) => entry.path);
}

function marketingUrlset(base) {
  const entries = marketingEntries().map((entry) => ({
    path: entry.path,
    lastmod: lastmodForEntry(entry),
    changefreq: entry.changefreq,
    priority: entry.priority,
  }));
  return buildUrlsetXml(base, entries);
}

function serviceUrlset(base) {
  const entries = publicServiceEntries().map((entry) => ({
    path: entry.path,
    lastmod: lastmodForEntry(entry),
    changefreq: entry.changefreq,
    priority: entry.priority,
  }));
  return buildUrlsetXml(base, entries);
}

function robotsTxt(base) {
  const b = normalizeBase(base);
  const block = ['User-agent: *', 'Allow: /'].concat(ROBOTS_DISALLOW_LINES);
  const google = ['User-agent: Googlebot', 'Allow: /'].concat(ROBOTS_DISALLOW_LINES);
  return block.concat([''], google, [
    '',
    'Sitemap: ' + b + '/seo/sitemap-services.xml',
    'Sitemap: ' + b + '/sitemap.xml',
    '',
  ]).join('\n');
}

module.exports = {
  PROTOCOL,
  MARKETING_PAGES,
  ROBOTS_DISALLOW,
  ROBOTS_DISALLOW_LINES,
  normalizeBase,
  todayDate,
  escapeXml,
  xmlStylesheetPi,
  sitemapXsl,
  isBlockedPath,
  publicBlogEntries,
  publicServiceEntries,
  marketingEntries,
  isIndexablePath,
  buildUrlsetXml,
  buildSitemapIndexXml,
  corePublicPaths,
  marketingUrlset,
  serviceUrlset,
  robotsTxt,
};
