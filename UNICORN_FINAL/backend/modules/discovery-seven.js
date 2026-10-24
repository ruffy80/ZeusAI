'use strict';

/**
 * Discovery Seven — D7/1.0
 *
 * The seven checks a stranger uses to explain an empty store:
 *   1. Is the site indexed in Google?
 *   2. Is Google Search Console connected?
 *   3. Is there a sitemap.xml?
 *   4. Are there SEO-optimized pages?
 *   5. Are there articles or landing pages?
 *   6. Is there promotion on Reddit, X, LinkedIn, Facebook?
 *   7. Is there a mechanism by which people find the product?
 *
 * Points 3, 4, 5 and 7 are closed in code and refreshed from the live shelf
 * on every read and on every traffic-engine cycle. Points 1, 2 and 6 stay
 * open until Google, the owner secret, or channel keys say otherwise.
 * This module never invents an index, a verification token, a post, or a visitor.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'D7/1.0';
const NAME = 'discovery-seven';
const ORIGIN = String(process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');
const STATE_FILE = process.env.DISCOVERY_SEVEN_FILE
  || path.resolve(__dirname, '..', '..', 'data', 'discovery', 'discovery-seven.json');

const PROMO_IDS = ['reddit', 'x', 'linkedin', 'facebook'];

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _shelf() {
  try { return require('../../src/commerce/public-shelf'); } catch (_) { return null; }
}

function catalogOffers() {
  const rows = [];
  const seen = new Set();
  for (const modPath of ['../../src/commerce/instant-catalog', '../../src/commerce/enterprise-catalog']) {
    try {
      const mod = require(modPath);
      const all = mod && typeof mod.all === 'function' ? mod.all() : [];
      for (const raw of all || []) {
        const id = raw && raw.id ? String(raw.id) : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        rows.push(raw);
      }
    } catch (_) { /* catalog optional in isolation */ }
  }
  return rows;
}

function liveOffer(id) {
  const shelf = _shelf();
  if (!shelf || typeof shelf.byId !== 'function') return null;
  try { return shelf.byId(String(id || '')); } catch (_) { return null; }
}

function _money(item) {
  const shelf = _shelf();
  if (item && shelf && typeof shelf.money === 'function') return shelf.money(item.priceUsd);
  const n = Number(item && item.priceUsd);
  return Number.isFinite(n) && n > 0 ? ('$' + n) : '';
}

function guidePath(id) {
  return '/guides/' + encodeURIComponent(String(id || ''));
}

function publicPaths() {
  const out = ['/guides', '/seo'];
  const shelf = _shelf();
  const rows = shelf && typeof shelf.publicShelf === 'function' ? shelf.publicShelf() : [];
  for (const raw of rows) {
    if (!raw || !raw.id || !liveOffer(raw.id)) continue;
    out.push(guidePath(raw.id));
  }
  return out;
}

function serviceMeta(id) {
  const item = liveOffer(id);
  if (!item) return null;
  const price = _money(item);
  const when = String(item.when || '');
  const title = String(item.title || item.id).slice(0, 90);
  let description;
  if (item.buyable === true && item.ctaHref) {
    description = title + ' is ' + price + '. ' + when + '. The button opens the same checkout as the shelf.';
  } else if (item.mode === 'contact' || item.buyable !== true) {
    description = title + ' is listed at ' + price + '. It is not a cart. ' + when + '.';
  } else {
    description = title + '. ' + when + '.';
  }
  return {
    id: item.id,
    title,
    description: description.replace(/\s+/g, ' ').trim().slice(0, 170),
    path: '/services/' + encodeURIComponent(item.id),
    guide: guidePath(item.id),
    priceUsd: item.priceUsd,
    priceLabel: price,
    ctaHref: item.ctaHref || null,
    ctaLabel: item.ctaLabel || null,
    buyable: item.buyable === true,
  };
}

function guideFor(id) {
  const key = String(id || '').replace(/^\/guides\//, '').replace(/\/+$/, '');
  let decoded = key;
  try { decoded = decodeURIComponent(key); } catch (_) { decoded = key; }
  const item = liveOffer(decoded);
  if (!item) return null;
  const price = _money(item);
  const buyable = item.buyable === true && !!item.ctaHref;
  const meta = serviceMeta(decoded);
  return {
    id: item.id,
    path: guidePath(item.id),
    servicePath: '/services/' + encodeURIComponent(item.id),
    title: String(item.title || item.id),
    description: item.description ? String(item.description) : (meta ? meta.description : ''),
    metaDescription: meta ? meta.description : '',
    when: String(item.when || ''),
    priceUsd: item.priceUsd,
    priceLabel: price,
    buyable,
    mode: item.mode || null,
    ctaHref: item.ctaHref || null,
    ctaLabel: item.ctaLabel || (buyable ? 'Buy → choose payment' : 'View the offer'),
    clock: item.clock || null,
  };
}

function llmsOfferLines(origin) {
  const base = String(origin || ORIGIN).replace(/\/+$/, '');
  const rows = guideCards();
  const lines = [
    '## Find a buyer without a social network',
    '- A visitor does not need Facebook, TikTok, Instagram, X, or any other social account.',
    '- Guides: ' + base + '/guides',
    '- Shelf: ' + base + '/pricing',
    '- Docs: ' + base + '/docs',
    '- API explorer: ' + base + '/api-explorer',
    '- This index: ' + base + '/llms.txt',
    '- Sitemap: ' + base + '/sitemap.xml',
    '## Shelf offers',
    '- Each line is a current offer. The price is the shelf price. The guide URL and the service URL are the same offer.',
  ];
  rows.forEach((g) => {
    lines.push('- ' + g.title + ' (' + g.priceLabel + ') — ' + base + g.path + ' — ' + base + g.servicePath);
  });
  return lines.join('\n');
}

function guideCards() {
  const shelf = _shelf();
  const rows = shelf && typeof shelf.publicShelf === 'function' ? shelf.publicShelf() : [];
  return rows.filter((p) => p && p.id).map((p) => {
    const g = guideFor(p.id);
    return g;
  }).filter(Boolean);
}

function _searchConsole() {
  let bridgeArmed = false;
  let secret = 'GOOGLE_SERVICE_ACCOUNT_JSON';
  try {
    const bridge = require('./search-console-bridge');
    const armed = bridge.armedEngines ? bridge.armedEngines() : [];
    bridgeArmed = Array.isArray(armed) && armed.includes('google');
    const missing = bridge.missingSecrets ? bridge.missingSecrets() : [];
    const google = (missing || []).find((m) => m && m.engine === 'google');
    if (google && google.secret) secret = google.secret;
  } catch (_) { /* bridge optional */ }
  const meta = String(process.env.GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION_META || '').trim();
  const html = String(process.env.GOOGLE_SITE_VERIFICATION_TOKEN || process.env.GSC_HTML_TOKEN || '').trim();
  const tokenPresent = meta.length >= 8 || html.length >= 8;
  const connected = bridgeArmed || tokenPresent;
  return {
    connected,
    bridgeArmed,
    tokenPresent,
    blocker: connected ? null : secret,
  };
}

function _promotion() {
  let channels = [];
  try {
    channels = require('./social-orchestrator/service-broadcast').worldChannels() || [];
  } catch (_) { channels = []; }
  const rows = PROMO_IDS.map((id) => {
    const found = channels.find((c) => c && c.id === id) || null;
    const armed = !!(found && found.armed);
    return {
      id,
      label: (found && found.label) || id,
      armed,
      posted: false,
      reason: armed ? 'armed_poster_is_viralizer' : 'keys_missing',
    };
  });
  return {
    channels: rows,
    anyArmed: rows.some((r) => r.armed),
    allArmed: rows.every((r) => r.armed),
    keyless: [
      { id: 'zeusai-social', path: '/social-network', note: 'Unicorn posts every buyable service on this network without third-party keys.' },
      { id: 'share', path: '/share', note: 'One tap opens Reddit, X, LinkedIn, or Facebook in a human session. A module cannot press it.' },
      { id: 'guides', path: '/guides', note: 'Each offer has a public article with the live price and the same checkout link.' },
    ],
  };
}

function _readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (_) { return null; }
}

function _writeState(report) {
  if (process.env.NODE_ENV === 'test' && !process.env.DISCOVERY_SEVEN_FILE) return;
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const prev = _readState();
    const history = Array.isArray(prev && prev.history) ? prev.history.slice(0, 19) : [];
    history.unshift({
      at: report.generatedAt,
      guides: report.guides,
      closed: report.points.filter((p) => p.closed).map((p) => p.key),
    });
    const body = {
      at: report.generatedAt,
      guideIds: report.guideIds,
      history,
    };
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  } catch (_) { /* disk is optional */ }
}

function audit() {
  const guides = guideCards();
  const guideIds = guides.map((g) => g.id);
  const buyable = guides.filter((g) => g.buyable);
  const seoReady = buyable.filter((g) => {
    const meta = serviceMeta(g.id);
    return meta && meta.title && meta.title !== 'Service' && meta.description && meta.description.indexOf(meta.title.slice(0, 24)) === 0;
  });
  const gsc = _searchConsole();
  const promo = _promotion();
  const prev = _readState();
  const prevIds = new Set((prev && prev.guideIds) || []);
  const added = guideIds.filter((id) => !prevIds.has(id));
  const paths = publicPaths();

  const points = [
    {
      n: 1,
      key: 'googleIndexed',
      question: 'Is the site indexed in Google?',
      questionRo: 'Site-ul este indexat în Google?',
      closed: false,
      known: false,
      indexed: null,
      whyOpen: 'Google retired the sitemap ping API in 2023 and does not publish an index answer without Search Console. Unicorn serves the sitemap and does not claim indexed.',
    },
    {
      n: 2,
      key: 'searchConsole',
      question: 'Is Google Search Console connected?',
      questionRo: 'Există Google Search Console?',
      closed: gsc.connected,
      connected: gsc.connected,
      blocker: gsc.blocker,
      whyOpen: gsc.connected
        ? null
        : 'The bridge that verifies ownership and submits /sitemap.xml is already in the traffic cycle. It stays idle until ' + gsc.blocker + ' exists. A fake verification tag would fail Google’s check.',
    },
    {
      n: 3,
      key: 'sitemap',
      question: 'Is there a sitemap.xml?',
      questionRo: 'Există sitemap.xml?',
      closed: paths.length > 2,
      url: '/sitemap.xml',
      robots: '/robots.txt',
      guidePaths: paths.filter((p) => p.startsWith('/guides/')).length,
      whyOpen: null,
    },
    {
      n: 4,
      key: 'seoPages',
      question: 'Are there SEO-optimized pages?',
      questionRo: 'Există pagini optimizate SEO?',
      closed: buyable.length > 0 && seoReady.length === buyable.length,
      buyable: buyable.length,
      withUniqueTitle: seoReady.length,
      whyOpen: null,
    },
    {
      n: 5,
      key: 'articles',
      question: 'Are there articles or landing pages?',
      questionRo: 'Există articole sau landing page-uri?',
      closed: guides.length > 0 && guides.every((g) => paths.indexOf(g.path) >= 0),
      guides: guides.length,
      index: '/guides',
      whyOpen: null,
    },
    {
      n: 6,
      key: 'promotion',
      question: 'Is there promotion on Reddit, X, LinkedIn, Facebook?',
      questionRo: 'Există promovare pe Reddit, X, LinkedIn, Facebook?',
      closed: false,
      channels: promo.channels,
      keyless: promo.keyless,
      posted: false,
      whyOpen: promo.anyArmed
        ? 'At least one channel has keys. The existing viralizer is the only poster. This audit does not mark a post successful until that channel API accepts it. A visitor can still arrive through /guides, /pricing, and /llms.txt.'
        : 'Reddit, X, LinkedIn, and Facebook are optional. /guides, /pricing, /sitemap.xml, and /llms.txt do not need those accounts. This check stays open because no post was sent. An open check is not an empty site.',
    },
    {
      n: 7,
      key: 'findability',
      question: 'Is there a mechanism by which people find the product?',
      questionRo: 'Există un mecanism prin care utilizatorii găsesc produsul?',
      closed: guides.length > 0 && paths.indexOf('/guides') >= 0,
      mechanisms: [
        { id: 'sitemap', path: '/sitemap.xml', note: 'robots.txt points crawlers here, including every offer guide.' },
        { id: 'indexnow', path: '/api/traffic/status', note: 'IndexNow notifies Bing and Yandex. It does not create visitors. Google discovers the sitemap.' },
        { id: 'guides', path: '/guides', note: 'One article per shelf offer, price and checkout read live.' },
        { id: 'share', path: '/share', note: 'Tokenless hop into Reddit, X, LinkedIn, Facebook, and others.' },
        { id: 'social', path: '/social-network', note: 'On-site catalog posts need no third-party key.' },
        { id: 'homepage', path: '/', note: 'The concierge answers with a real shelf offer.' },
      ],
      whyOpen: null,
    },
  ];

  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    inventsIndexed: false,
    inventsVisitors: false,
    inventsReach: false,
    inventsPosts: false,
    inventsHumans: false,
    inventsGmv: false,
    improvesForever: true,
    points,
    closedCount: points.filter((p) => p.closed).length,
    openCount: points.filter((p) => !p.closed).length,
    guides: guides.length,
    guideIds,
    addedSinceLastTick: prev ? added : [],
    firstObservation: !prev,
    innovations: [
      { id: 'live-guides', note: 'Every shelf offer grows a /guides/:id article. A new offer is indexed on the next cycle without a hand-written page.' },
      { id: 'live-price', note: 'Title, description, price, and checkout href are read from the public shelf on each request, so the article cannot drift from the card.' },
      { id: 'sitemap-indexnow', note: 'Guide URLs join /sitemap.xml and the IndexNow inventory. Google still needs Search Console to confirm indexing.' },
      { id: 'unique-service-head', note: '/services/:id uses the offer title and a description that names the price and the delivery clock.' },
      { id: 'promo-waits', note: 'Reddit, X, LinkedIn, and Facebook drafts ride the existing viralizer. Missing keys stay keys_missing.' },
    ],
    generatedAt: new Date().toISOString(),
  };
}

function tick() {
  const report = audit();
  _writeState(report);
  return report;
}

function _jsonLd(guide) {
  const origin = ORIGIN;
  const url = origin + guide.path;
  const body = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.metaDescription || guide.description,
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'ZeusAI', url: origin },
    publisher: { '@type': 'Organization', name: 'ZeusAI', url: origin },
    about: { '@type': 'Service', name: guide.title, url: origin + guide.servicePath },
  };
  if (guide.buyable && guide.priceUsd > 0 && guide.ctaHref) {
    const href = /^https?:/i.test(guide.ctaHref) ? guide.ctaHref : origin + guide.ctaHref;
    let offerExtra = {};
    try { offerExtra = require('../../src/seo/merchant-offer').offerFields(guide, origin); } catch (_) { offerExtra = {}; }
    body.about.offers = Object.assign({
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: Number(guide.priceUsd).toFixed(2),
      url: href,
      availability: 'https://schema.org/InStock',
    }, offerExtra);
  }
  return body;
}

function guideHtml(id) {
  const guide = guideFor(id);
  if (!guide) {
    return `<section style="padding-top:140px;max-width:760px"><h1>Guide not on the shelf</h1><p style="color:var(--ink-dim)">This id is not a current ZeusAI offer.</p><p><a class="btn btn-primary" href="/guides" data-link>All guides</a></p></section>`;
  }
  const href = guide.ctaHref || guide.servicePath;
  const ld = JSON.stringify(_jsonLd(guide)).replace(/</g, '\\u003c');
  const cartNote = guide.id === 'ent-engagement-kickoff'
    ? 'Paid start only. It does not deliver the license, the source, or a private cloud.'
    : (/^ent-/i.test(guide.id) && guide.buyable
      ? 'Payment issues the engagement pack. The license, the source, and a private cloud are milestones in the pack. They are not in this download.'
      : (guide.buyable
      ? 'The button uses the same checkout as the shelf card.'
      : 'This figure is a proposal, not a cart.'));
  return `<section style="padding-top:140px;max-width:820px" id="offerGuide" data-product-id="${_esc(guide.id)}" data-price-usd="${_esc(guide.priceUsd)}">
  <script type="application/ld+json">${ld}</script>
  <span class="kicker">Offer guide · live shelf</span>
  <h1 style="font-size:clamp(32px,4vw,52px);margin:10px 0 12px">${_esc(guide.title)}</h1>
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.65">${_esc(guide.description)}</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:18px">
    <div class="card" style="padding:16px"><span class="kicker">Price</span><p style="margin:8px 0 0;font-size:28px">${_esc(guide.priceLabel)}</p><p style="color:var(--ink-dim);font-size:13px;margin:6px 0 0">${_esc(cartNote)}</p></div>
    <div class="card" style="padding:16px"><span class="kicker">When</span><p style="margin:8px 0 0;color:var(--ink-dim);font-size:14.5px;line-height:1.55">${_esc(guide.when)}</p></div>
  </div>
  <p style="margin-top:16px"><a class="btn btn-primary" href="${_esc(href)}" data-link>${_esc(guide.ctaLabel)}</a> <a class="btn btn-ghost" href="${_esc(guide.servicePath)}" data-link>Service page</a></p>
  <div class="card" style="padding:18px;margin-top:18px">
    <span class="kicker">How someone finds this</span>
    <ul style="color:var(--ink-dim);font-size:14.5px;line-height:1.7;margin:10px 0 0;padding-left:18px">
      <li>This URL is listed in <a href="/sitemap.xml" data-allow-raw="1">/sitemap.xml</a>, and robots.txt points at that file.</li>
      <li>IndexNow can notify Bing and Yandex. That notification is not a visitor and not a Google index confirmation.</li>
      <li>The same offer is on <a href="/social-network" data-link>ZeusAI Social</a> and can be opened from <a href="/share" data-link>/share</a> into Reddit, X, LinkedIn, or Facebook when a person taps.</li>
    </ul>
    <p style="color:var(--ink-dim);font-size:13px;margin:12px 0 0">This page does not claim the site is indexed, that Search Console is connected, or that a social post already went out.</p>
  </div>
</section>`;
}

function indexHtml(report) {
  const cards = guideCards().map((g) => (
    `<a class="card" href="${_esc(g.path)}" data-link data-product-id="${_esc(g.id)}" data-price-usd="${_esc(g.priceUsd)}" style="padding:18px;text-decoration:none;display:block"><span class="tag">${_esc(g.priceLabel)} · ${_esc(g.buyable ? 'checkout' : 'proposal')}</span><h3 style="margin:10px 0 6px;font-size:18px;color:#fff">${_esc(g.title)}</h3><p style="color:var(--ink-dim);font-size:13.5px;line-height:1.55;margin:0">${_esc(g.metaDescription || g.description)}</p></a>`
  )).join('');
  const auditReport = report || audit();
  const rows = auditReport.points.map((p) => {
    const state = p.closed ? 'Closed in code' : 'Open — owner or Google';
    return `<li><strong>${_esc(p.questionRo)}</strong> — ${state}.${p.whyOpen ? ' ' + _esc(p.whyOpen) : ''}</li>`;
  }).join('');
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">Discovery seven</span>
  <h1 style="font-size:clamp(32px,4vw,52px);margin:10px 0 12px">One public article <span class="grad">per shelf offer.</span></h1>
  <p style="color:var(--ink-dim);max-width:680px">Each guide names the deliverable, the clock, and the same price as checkout. New offers join the sitemap on the next traffic cycle. Indexed status, Search Console, and off-site posts stay honest.</p>
  <ol style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:18px 0;padding-left:18px">${rows}</ol>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:12px;margin-top:8px">${cards}</div>
</section>`;
}

function sevenHtml() {
  const report = audit();
  const items = report.points.map((p) => {
    const mark = p.closed ? 'Yes, in code' : 'Not yet';
    const extra = p.whyOpen ? `<p style="margin:6px 0 0;color:var(--ink-dim);font-size:13px">${_esc(p.whyOpen)}</p>` : '';
    return `<li style="margin:0 0 12px"><strong>${p.n}. ${_esc(p.questionRo)}</strong> — ${mark}.${extra}</li>`;
  }).join('');
  return `<section class="card" style="padding:20px;margin-bottom:28px" id="discoverySeven">
  <span class="kicker">D7/1.0 · refreshed from the live shelf</span>
  <h2 style="margin:8px 0 10px">The seven discovery checks</h2>
  <ol style="margin:0;padding-left:18px;font-size:14.5px;line-height:1.55">${items}</ol>
  <p style="margin:14px 0 0;font-size:13px"><a href="/guides" data-link>Offer guides</a> · <a href="/api/discovery-seven" data-allow-raw="1">/api/discovery-seven</a> · <a href="/.well-known/discovery-seven.json" data-allow-raw="1">discovery-seven.json</a></p>
</section>`;
}

module.exports = {
  PROTOCOL,
  NAME,
  catalogOffers,
  publicPaths,
  serviceMeta,
  guideFor,
  guideCards,
  llmsOfferLines,
  guideHtml,
  indexHtml,
  sevenHtml,
  audit,
  tick,
};
