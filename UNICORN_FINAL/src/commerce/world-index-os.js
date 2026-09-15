'use strict';

/**
 * World Index Visibility Protocol — WIVP/1.0
 *
 * Makes ZeusAI crawlable, shareable, and honest about empty traffic.
 * Never invents visitors, unique users, crawl counts, social reach, or
 * "biggest site in the world." IndexNow notifies engines; it does not
 * create clicks. Gaze networks stay dark without tokens. Google rank
 * still needs Search Console ownership, time, and real links.
 */

const PROTOCOL = 'WIVP/1.0';
const NAME = 'world-index-os';
const PUBLIC_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

const PRIORITY_PATHS = [
  '/',
  '/buy',
  '/first-dollar',
  '/visible-world',
  '/visible',
  '/origin',
  '/from/x',
  '/from/facebook',
  '/from/instagram',
  '/from/telegram',
  '/llms.txt',
  '/.well-known/world-index.json',
  '/.well-known/first-dollar.json',
  '/.well-known/origin-gravity.json',
  '/.well-known/social-gravity.json',
  '/.well-known/visible-social.json',
];

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ogImageUrl() {
  try {
    const { assetPath } = require('../site/v2/build-id');
    return PUBLIC_URL + assetPath('/assets/icons/og-default.png');
  } catch (_) {
    return PUBLIC_URL + '/assets/icons/og-default.png';
  }
}

function shareHead(opts) {
  const title = String((opts && opts.title) || 'ZeusAI');
  const description = String((opts && opts.description) || 'Autonomous AI commerce OS. Traction is never invented.');
  const pathPart = String((opts && opts.path) || '/');
  const protocol = String((opts && opts.protocol) || PROTOCOL);
  const canonical = PUBLIC_URL + (pathPart.startsWith('/') ? pathPart : '/' + pathPart);
  const image = ogImageUrl();
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'ZeusAI', url: PUBLIC_URL },
    image,
  });
  const gscMeta = String(process.env.GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION_META || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
  const gscTag = gscMeta
    ? `\n  <meta name="google-site-verification" content="${_esc(gscMeta)}"/>`
    : '';
  return `  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${_esc(title)}</title>
  <meta name="description" content="${_esc(description)}"/>
  <link rel="canonical" href="${_esc(canonical)}"/>
  <link rel="alternate" hreflang="en" href="${_esc(canonical)}?lang=en"/>
  <link rel="alternate" hreflang="ro" href="${_esc(canonical)}?lang=ro"/>
  <link rel="alternate" hreflang="x-default" href="${_esc(canonical)}"/>
  <meta name="robots" content="index,follow,max-image-preview:large"/>
  <meta property="og:site_name" content="ZeusAI"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${_esc(title)}"/>
  <meta property="og:description" content="${_esc(description)}"/>
  <meta property="og:url" content="${_esc(canonical)}"/>
  <meta property="og:image" content="${_esc(image)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${_esc(title)}"/>
  <meta name="twitter:description" content="${_esc(description)}"/>
  <meta name="twitter:image" content="${_esc(image)}"/>
  <meta name="x-protocol" content="${_esc(protocol)}"/>${gscTag}
  <script type="application/ld+json">${jsonLd}</script>`;
}

function googleHtmlVerification() {
  const token = String(process.env.GOOGLE_SITE_VERIFICATION_TOKEN || process.env.GSC_HTML_TOKEN || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
  if (!token) return null;
  return {
    path: '/google' + token + '.html',
    body: 'google-site-verification: google' + token + '.html',
  };
}

function indexNowPriorityUrls(base) {
  const origin = String(base || PUBLIC_URL).replace(/\/+$/, '');
  return PRIORITY_PATHS.map((p) => origin + p);
}

function _origin() {
  try {
    const ogp = require('../../backend/modules/origin-gravity-os');
    const st = ogp.getStatus();
    return {
      paidHumans: Number(st && st.paidHumans) || 0,
      originOpen: st && st.originOpen !== false,
    };
  } catch (_) {
    return { paidHumans: 0, originOpen: true };
  }
}

function _gaze() {
  try {
    const vsp = require('../../backend/modules/visible-social-os');
    const st = vsp.getStatus();
    const lit = Array.isArray(st && st.gazeLit) ? st.gazeLit : [];
    const dark = Array.isArray(st && st.gazeDark) ? st.gazeDark : ['facebook', 'x', 'tiktok', 'instagram'];
    return {
      gazeLit: lit,
      gazeDark: dark,
      inventsPosts: false,
      inventsReach: false,
    };
  } catch (_) {
    return {
      gazeLit: [],
      gazeDark: ['facebook', 'x', 'tiktok', 'instagram'],
      inventsPosts: false,
      inventsReach: false,
    };
  }
}

function _indexNow() {
  try {
    const te = require('../../backend/modules/traffic-engine');
    const st = te.getStatus();
    return {
      armed: process.env.TRAFFIC_ENGINE_DISABLED !== '1',
      host: st && st.host,
      keyLocation: st && st.indexNowKeyLocation,
      urlInventory: Number(st && st.urlInventory) || 0,
      lastSubmission: st && st.lastSubmission ? st.lastSubmission : null,
      note: 'IndexNow notifies Bing/Yandex that URLs changed. It does not create visitors. A 403 UserForbiddedToAccessSite means Bing has not verified the host yet.',
    };
  } catch (_) {
    return {
      armed: process.env.TRAFFIC_ENGINE_DISABLED !== '1',
      lastSubmission: null,
      note: 'traffic-engine unavailable in this process',
    };
  }
}

function whyZeroVisitors(opts) {
  const paid = Number(opts && opts.paidHumans);
  const gazeLit = Array.isArray(opts && opts.gazeLit) ? opts.gazeLit : [];
  if (Number.isFinite(paid) && paid > 0 && gazeLit.length > 0) {
    return {
      code: 'distribution_exists',
      message: 'At least one paid human and at least one public gaze permalink exist. Organic visitors still depend on crawlers, shares, and ads — this protocol does not count them.',
    };
  }
  if (gazeLit.length > 0) {
    return {
      code: 'gaze_lit_no_settlement',
      message: 'A public social permalink exists, but paidHumans is still 0. Posts are not visitors and not buyers.',
    };
  }
  return {
    code: 'no_distribution_surface',
    message: 'Zero visitors is the honest state: the storefront is crawlable, but nobody is being sent here. Facebook/X/TikTok/Instagram stay dark without tokens in GitHub → PM2. IndexNow is not traffic. Google ranking needs Search Console ownership, a submitted sitemap, time, and real backlinks. Modules do not invent users.',
  };
}

function operatorChecklist(opts) {
  const gscMeta = !!(process.env.GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION_META);
  const gscHtml = !!googleHtmlVerification();
  const gazeLit = Array.isArray(opts && opts.gazeLit) ? opts.gazeLit : [];
  const trafficDisabled = process.env.TRAFFIC_ENGINE_DISABLED === '1';
  const adsArmed = !!(process.env.GOOGLE_ADS_CUSTOMER_ID || process.env.META_ADS_ACCESS_TOKEN || process.env.TIKTOK_ADS_ACCESS_TOKEN);
  return [
    {
      id: 'indexnow-key',
      ready: true,
      action: 'Keep serving /{indexnow-key}.txt at the site root. Already live when traffic-engine is armed.',
    },
    {
      id: 'bing-webmaster',
      ready: false,
      action: 'Bing Webmaster Tools → Add site zeusai.pro → verify → IndexNow 403 UserForbiddedToAccessSite disappears. Code cannot complete Bing ownership.',
    },
    {
      id: 'google-search-console',
      ready: gscMeta || gscHtml,
      action: gscMeta || gscHtml
        ? 'HTML/meta verification token is armed. Owner must still submit https://zeusai.pro/sitemap.xml inside Google Search Console (Google retired the ping API in 2023).'
        : 'Add GOOGLE_SITE_VERIFICATION (meta content) or GOOGLE_SITE_VERIFICATION_TOKEN (HTML file token) as a GitHub secret, redeploy, then submit /sitemap.xml in Search Console.',
    },
    {
      id: 'gaze-tokens',
      ready: gazeLit.length > 0,
      action: gazeLit.length > 0
        ? ('Public gaze permalinks exist: ' + gazeLit.join(', '))
        : 'Put Facebook / X / TikTok / Instagram tokens in GitHub secrets so sync-all-secrets.yml writes /etc/zeusai/social.env and PM2 can post. Telegram/Discord are operator rails, not public posts.',
    },
    {
      id: 'traffic-engine',
      ready: !trafficDisabled,
      action: trafficDisabled
        ? 'TRAFFIC_ENGINE_DISABLED=1 — IndexNow is parked. Unset it in PM2 to ping engines.'
        : 'IndexNow pulse is armed (every 6h). Still not visitors.',
    },
    {
      id: 'paid-ads',
      ready: adsArmed,
      action: adsArmed
        ? 'An ads account env is present. Spend still requires a human budget.'
        : 'No ads account is armed. Organic code cannot buy clicks. Optional: Google Ads / Meta Ads / TikTok Ads with a real budget.',
    },
    {
      id: 'human-share',
      ready: false,
      action: 'Share https://zeusai.pro/from/x and https://zeusai.pro/first-dollar yourself. A module cannot substitute a human posting once.',
    },
  ];
}

function discovery(opts) {
  const origin = _origin();
  const gaze = _gaze();
  const indexNow = _indexNow();
  const why = whyZeroVisitors({
    paidHumans: origin.paidHumans,
    gazeLit: gaze.gazeLit,
  });
  return {
    protocol: PROTOCOL,
    name: NAME,
    ok: true,
    inventsVisitors: false,
    inventsUsers: false,
    inventsHumans: false,
    inventsGmv: false,
    inventsReach: false,
    inventsCrawlCounts: false,
    paidHumans: origin.paidHumans,
    originOpen: origin.originOpen,
    gazeLit: gaze.gazeLit,
    gazeDark: gaze.gazeDark,
    whyZeroVisitors: why,
    indexNow,
    operatorChecklist: operatorChecklist({ gazeLit: gaze.gazeLit }),
    pages: {
      visibleWorld: '/visible-world',
      firstDollar: '/first-dollar',
      buy: '/buy',
      origin: '/origin',
      visible: '/visible',
      llms: '/llms.txt',
      sitemap: '/sitemap.xml',
      robots: '/robots.txt',
      wellKnown: '/.well-known/world-index.json',
    },
    priorityPaths: PRIORITY_PATHS.slice(),
    nextHumanAction: 'Verify Bing + Google Search Console, arm gaze tokens if you want public posts, optionally buy ads. Code makes URLs discoverable; it does not mint users.',
    generatedAt: new Date().toISOString(),
    ...(opts && typeof opts === 'object' ? opts : {}),
  };
}

function visibleWorldHtml() {
  const d = discovery();
  const why = d.whyZeroVisitors.message;
  const rows = d.operatorChecklist.map((c) => {
    const mark = c.ready ? 'READY' : 'OWNER';
    const color = c.ready ? '#00e8a0' : '#ffb020';
    return `<li><span style="color:${color};font-weight:700">${mark}</span> ${_esc(c.action)}</li>`;
  }).join('\n      ');
  const head = shareHead({
    title: 'World Index · ZeusAI',
    description: 'Honest visibility protocol. Zero visitors is not a fake dashboard. IndexNow, sitemap, and share URLs are live; users are not invented.',
    path: '/visible-world',
    protocol: PROTOCOL,
  });
  return `<!doctype html>
<html lang="en">
<head>
${head}
</head>
<body style="margin:0;background:#07080f;color:#e8eef8;font:16px/1.55 system-ui,sans-serif">
  <main style="max-width:760px;margin:0 auto;padding:48px 20px 80px">
    <p style="letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:#7aa9ff">WIVP/1.0 · World Index Visibility</p>
    <h1 style="font-size:clamp(28px,5vw,44px);line-height:1.1;margin:8px 0 12px">The site is live. The audience is not invented.</h1>
    <p style="color:#9aa6bd">${_esc(why)}</p>
    <p style="font-family:ui-monospace,monospace;font-size:13px;color:#cdd6e4">paidHumans = <b style="color:#00ffa3">${d.paidHumans}</b> · gaze permalinks = <b>${d.gazeLit.length}</b> · inventsVisitors = <b>false</b></p>
    <p style="margin:28px 0">
      <a href="/first-dollar" style="display:inline-block;background:linear-gradient(135deg,#00e8a0,#2de2e6);color:#05060e;font-weight:800;padding:14px 22px;border-radius:12px;text-decoration:none">First dollar path →</a>
      <a href="/buy" style="display:inline-block;margin-left:10px;color:#2de2e6">Buyable SKUs</a>
      <a href="/from/x" style="display:inline-block;margin-left:10px;color:#2de2e6">Share landing</a>
    </p>
    <h2 style="font-size:18px;margin:32px 0 8px">What code can do</h2>
    <ul style="color:#9aa6bd;padding-left:18px">
      <li>Keep /sitemap.xml, /robots.txt, /llms.txt, and IndexNow inventory complete and honest.</li>
      <li>Give every money page Open Graph + JSON-LD so shares and crawlers see a real preview.</li>
      <li>Ping IndexNow when URLs change. That is a notification, not a visitor.</li>
    </ul>
    <h2 style="font-size:18px;margin:32px 0 8px">What only the owner can do</h2>
    <ul style="color:#9aa6bd;padding-left:18px">
      ${rows}
    </ul>
    <p style="font-size:13px;color:#7aa9ff">
      <a href="/.well-known/world-index.json" style="color:#7aa9ff">/.well-known/world-index.json</a>
      · <a href="/.well-known/first-dollar.json" style="color:#7aa9ff">first-dollar.json</a>
      · <a href="/sitemap.xml" style="color:#7aa9ff">sitemap.xml</a>
      · <a href="/llms.txt" style="color:#7aa9ff">llms.txt</a>
    </p>
  </main>
</body>
</html>`;
}

module.exports = {
  PROTOCOL,
  NAME,
  PUBLIC_URL,
  PRIORITY_PATHS,
  ogImageUrl,
  shareHead,
  googleHtmlVerification,
  indexNowPriorityUrls,
  whyZeroVisitors,
  operatorChecklist,
  discovery,
  visibleWorldHtml,
};
