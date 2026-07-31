'use strict';

/**
 * SEO sitemap helpers — human-readable XSL + complete public URL inventory.
 * Crawlers get valid XML; humans clicking footer "Sitemap" see a styled desk.
 */

const PROTOCOL = 'SEO/1.0';

/** Public conversion + trust pages that MUST appear in /sitemap.xml */
const CORE_PUBLIC_PATHS = [
  '/',
  '/buy',
  '/services',
  '/marketplace',
  '/store',
  '/pricing',
  '/checkout',
  '/how',
  '/docs',
  '/about',
  '/legal',
  '/trust',
  '/standard',
  '/continuity',
  '/rails',
  '/outcomes',
  '/vom',
  '/twin',
  '/agents',
  '/zacc',
  '/security',
  '/responsible-ai',
  '/dpa',
  '/payment-terms',
  '/observability',
  '/innovations',
  '/wizard',
  '/status',
  '/changelog',
  '/terms',
  '/privacy',
  '/refund',
  '/sla',
  '/pledge',
  '/cancel',
  '/gift',
  '/aura',
  '/api-explorer',
  '/transparency',
  '/frontier',
  '/contact',
  '/faq',
  '/blog',
  '/affiliate',
  '/partners',
  '/roadmap',
  '/careers',
  '/press',
  '/verticals',
  '/social-network',
  '/enterprise',
  '/operator',
];

/** Paths robots.txt disallows — never list in public sitemaps */
const ROBOTS_DISALLOW = new Set([
  '/dashboard',
  '/account',
  '/admin',
  '/api/admin',
  '/api/admin/',
]);

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

function buildUrlsetXml(base, paths, opts) {
  const b = normalizeBase(base);
  const lastmod = (opts && opts.lastmod) || todayDate();
  const changefreq = (opts && opts.changefreq) || 'daily';
  const seen = new Set();
  const rows = [];
  for (const raw of paths || []) {
    let p = String(raw || '').trim();
    if (!p) continue;
    if (!p.startsWith('/')) p = '/' + p;
    if (ROBOTS_DISALLOW.has(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    const priority = p === '/' ? '1.0' : (opts && opts.priority) || '0.7';
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

function corePublicPaths() {
  return CORE_PUBLIC_PATHS.slice();
}

module.exports = {
  PROTOCOL,
  CORE_PUBLIC_PATHS,
  ROBOTS_DISALLOW,
  normalizeBase,
  todayDate,
  escapeXml,
  xmlStylesheetPi,
  sitemapXsl,
  buildUrlsetXml,
  buildSitemapIndexXml,
  corePublicPaths,
};
