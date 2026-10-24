'use strict';

/**
 * Organic growth desk — OGD/1.0
 *
 * Technical indexability, the Search Console read, and 50 article proposals
 * grounded in the live shelf. Sessions, competition, and Lighthouse stay
 * unmeasured until a real tool returns them. A proposal is not a published URL.
 */

const PROTOCOL = 'OGD/1.0';

const ALIASES = [
  { from: '/marketplace', to: '/services' },
  { from: '/autonomy', to: '/live-actions' },
  { from: '/innovation-log', to: '/live-actions' },
];

const OFFERS = [
  { id: 'instant-website-audit', name: 'website audit', clock: 'minutes' },
  { id: 'instant-logo-kit', name: 'logo kit', clock: 'minutes' },
  { id: 'instant-pitch-deck', name: 'pitch deck', clock: 'minutes' },
  { id: 'instant-seo-content-pack', name: 'SEO content pack', clock: 'minutes' },
  { id: 'instant-landing-page', name: 'landing page', clock: 'minutes' },
  { id: 'instant-brand-voice', name: 'brand voice', clock: 'minutes' },
  { id: 'instant-social-media-kit', name: 'social media kit', clock: 'minutes' },
  { id: 'instant-email-sequence', name: 'email sequence', clock: 'minutes' },
  { id: 'instant-product-naming', name: 'product naming', clock: 'minutes' },
  { id: 'instant-resume-makeover', name: 'resume makeover', clock: 'minutes' },
  { id: 'professional-saas-mvp', name: 'SaaS MVP kickoff', clock: 'days' },
  { id: 'professional-ai-agent', name: 'AI agent kickoff', clock: 'days' },
  { id: 'professional-mobile-app', name: 'mobile app kickoff', clock: 'days' },
  { id: 'professional-ecommerce-store', name: 'ecommerce store kickoff', clock: 'days' },
  { id: 'professional-ai-chatbot', name: 'AI chatbot kickoff', clock: 'days' },
  { id: 'professional-data-pipeline', name: 'data pipeline kickoff', clock: 'days' },
  { id: 'professional-ai-marketing', name: 'AI marketing kickoff', clock: 'days' },
  { id: 'professional-investor-package', name: 'investor package kickoff', clock: 'days' },
  { id: 'ent-engagement-kickoff', name: 'enterprise engagement kickoff', clock: 'contract' },
];

const ANGLES = [
  (offer) => ({
    title: 'What the ' + offer.name + ' file contains',
    phrase: offer.name + ' deliverable',
  }),
  (offer) => ({
    title: 'What the ' + offer.name + ' does not include',
    phrase: offer.name + ' limits',
  }),
  (offer) => ({
    title: 'Paying for the ' + offer.name + ' with Bitcoin',
    phrase: 'buy ' + offer.name + ' with bitcoin',
  }),
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function aliasTarget(path) {
  const hit = ALIASES.find((row) => row.from === path);
  return hit ? hit.to : null;
}

function articleBriefs() {
  const out = [];
  for (const angle of ANGLES) {
    for (const offer of OFFERS) {
      if (out.length >= 50) return out;
      const built = angle(offer);
      out.push({
        n: out.length + 1,
        title: built.title,
        phrase: built.phrase,
        href: '/services/' + offer.id,
        guide: '/guides/' + offer.id,
        published: false,
        reason: 'The shelf already sells this file. A separate article is a proposal, not a live URL.',
        competition: 'unmeasured',
        estimatedSessions: null,
        priority: offer.clock === 'minutes' ? 'buyable-now' : 'engagement',
      });
    }
  }
  return out;
}

function keywordPotential(queries) {
  if (!queries || queries.status !== 'measured' || !Array.isArray(queries.value)) {
    return {
      status: 'unavailable',
      value: null,
      note: 'A keyword is potential only after Search Console returns the query. None is invented here.',
    };
  }
  const value = queries.value.filter((row) => (
    Number(row.impressions) > 0 && Number(row.position) > 10
  ));
  return {
    status: 'measured',
    value,
    note: 'These queries were returned by Search Console and their average position is past the first page.',
  };
}

const NOINDEX_EXACT = new Set([
  '/checkout', '/dashboard', '/account', '/admin', '/login', '/signup', '/auth', '/outreach-desk',
]);

function pagePath(url) {
  try {
    const parsed = new URL(String(url || ''), 'https://zeusai.pro');
    const pathName = parsed.pathname.replace(/\/+$/, '');
    return pathName || '/';
  } catch (_) {
    return '';
  }
}

function noindexLeaks(pages) {
  if (!pages || pages.status !== 'measured' || !Array.isArray(pages.value)) {
    return { status: 'unavailable', value: null };
  }
  const value = pages.value.filter((row) => {
    const pathName = pagePath(row && row.page);
    if (!(Number(row && row.impressions) > 0)) return false;
    if (NOINDEX_EXACT.has(pathName)) return true;
    return pathName.startsWith('/checkout/') || pathName.startsWith('/admin/');
  });
  return {
    status: 'measured',
    value,
    note: 'Google showed a URL this site marks noindex. Showing is not a ranking claim.',
  };
}

function classifyQueries(queries) {
  if (!queries || queries.status !== 'measured' || !Array.isArray(queries.value)) {
    return { status: 'unavailable', residue: null, echoes: null };
  }
  const residue = [];
  const echoes = [];
  for (const row of queries.value) {
    const tokens = String(row.query || '').toLowerCase().split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && token !== 'zeus');
    const hit = OFFERS.find((offer) => tokens.some((token) => offer.name.toLowerCase().indexOf(token) !== -1));
    const item = {
      query: row.query,
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    };
    if (hit) {
      item.href = '/services/' + hit.id;
      echoes.push(item);
    } else {
      item.article = null;
      residue.push(item);
    }
  }
  return {
    status: 'measured',
    residue,
    echoes,
    note: 'A measured query becomes an offer echo only when it shares a shelf word of four letters or more. Otherwise it stays brand residue and does not create an article.',
  };
}

function formatMetric(row, kind) {
  if (!row || row.status !== 'measured' || row.value == null || !Number.isFinite(Number(row.value))) return 'Unavailable';
  const value = Number(row.value);
  if (kind === 'ctr') return (value * 100).toFixed(1) + '%';
  if (kind === 'position') return value.toFixed(1);
  if (kind === 'clicks' || kind === 'impressions') return String(Math.round(value));
  return String(value);
}

function recommendations(view) {
  const metrics = view && view.metrics;
  const needed = ['clicks', 'impressions', 'ctr', 'position'];
  const missing = !metrics || needed.some((key) => !metrics[key] || metrics[key].status !== 'measured' || metrics[key].value == null);
  if (missing) {
    return {
      status: 'unavailable',
      value: null,
      note: 'A recommendation is written only after clicks, impressions, CTR, and average position are all measured.',
    };
  }
  const items = [];
  const impressions = Number(metrics.impressions.value);
  if (impressions < 30) {
    items.push({
      id: 'small-sample',
      action: 'Do not change titles or publish new URLs from this CTR.',
      because: 'Google measured ' + Math.round(impressions) + ' impressions. The CTR is real and too small to treat as a stable rate.',
    });
  }
  const leaks = view.leaks && view.leaks.status === 'measured' && Array.isArray(view.leaks.value) ? view.leaks.value : [];
  leaks.forEach((row) => {
    items.push({
      id: 'noindex-shown',
      action: 'Keep ' + pagePath(row.page) + ' on noindex and wait for Google to recrawl it.',
      because: 'Search Console showed that URL with ' + row.impressions + ' impression(s).',
    });
  });
  const demand = view.demand && view.demand.status === 'measured' ? view.demand : null;
  (demand && demand.residue || []).forEach((row) => {
    items.push({
      id: 'brand-residue',
      action: 'Do not create an article for "' + row.query + '".',
      because: 'Google measured the query and it does not match a shelf offer.',
    });
  });
  (demand && demand.echoes || []).forEach((row) => {
    items.push({
      id: 'offer-echo',
      action: 'Point "' + row.query + '" at the existing page ' + row.href + '.',
      because: 'The query shares a shelf word. A new URL is not required.',
    });
  });
  const pages = view.pages && view.pages.status === 'measured' && Array.isArray(view.pages.value) ? view.pages.value : [];
  pages.forEach((row) => {
    const pathName = pagePath(row.page);
    if (!pathName || NOINDEX_EXACT.has(pathName) || pathName.startsWith('/checkout/') || pathName.startsWith('/admin/')) return;
    if (Number(row.impressions) > 0 && Number(row.clicks) === 0 && Number(row.impressions) < 30) {
      items.push({
        id: 'shown-not-clicked',
        action: 'Leave ' + pathName + ' unchanged until it gathers more impressions.',
        because: 'Google showed it ' + row.impressions + ' time(s) and recorded 0 clicks.',
      });
    }
  });
  const inspections = view.inspections && view.inspections.status === 'measured' && Array.isArray(view.inspections.value)
    ? view.inspections.value : [];
  inspections.forEach((row) => {
    const pathName = pagePath(row.inspectionUrl);
    const noindex = NOINDEX_EXACT.has(pathName) || pathName.startsWith('/checkout/') || pathName.startsWith('/admin/');
    if (row.status === 'measured' && row.verdict === 'PASS' && noindex) {
      items.push({
        id: 'indexed-noindex',
        action: 'The noindex header is already on ' + pathName + '. Google still has that URL indexed from its last crawl.',
        because: row.coverageState ? String(row.coverageState) : 'URL Inspection returned PASS.',
      });
    }
    if (row.googleCanonical && row.userCanonical && row.googleCanonical !== row.userCanonical) {
      items.push({
        id: 'canonical-split',
        action: 'Compare the page canonical with the canonical Google chose for ' + pathName + '.',
        because: 'Google canonical is ' + row.googleCanonical + '.',
      });
    }
  });
  return { status: 'measured', value: items, inventsTraffic: false };
}

function sampleNote(metrics) {
  const impressions = metrics && metrics.impressions;
  if (!impressions || impressions.status !== 'measured' || impressions.value == null) return null;
  if (Number(impressions.value) >= 30) return null;
  return 'This window has ' + Math.round(Number(impressions.value)) + ' impressions. That is too small to treat CTR as a stable rate.';
}

function consoleView() {
  let status = null;
  try {
    status = require('../../backend/modules/search-console-bridge').getStatus();
  } catch (_) { status = null; }
  const perf = (status && status.performance) || {};
  const rawMetrics = perf.metrics || {};
  const pick = (key) => {
    const row = rawMetrics[key] || {};
    if (row.status !== 'measured') return { status: 'unavailable', value: null };
    return { status: 'measured', value: row.value };
  };
  const queries = perf.queries && perf.queries.status === 'measured'
    ? { status: 'measured', value: perf.queries.value }
    : { status: 'unavailable', value: null };
  const pages = perf.pages && perf.pages.status === 'measured'
    ? { status: 'measured', value: perf.pages.value }
    : { status: 'unavailable', value: null };
  const metrics = {
    clicks: pick('clicks'),
    impressions: pick('impressions'),
    ctr: pick('ctr'),
    position: pick('position'),
  };
  const view = {
    armed: !!(status && Array.isArray(status.armedEngines) && status.armedEngines.indexOf('google') !== -1),
    reason: perf.reason || 'not_read_yet',
    siteUrl: perf.siteUrl || null,
    range: perf.range || null,
    metrics,
    access: {
      impressions: metrics.impressions.status === 'measured',
      clicks: metrics.clicks.status === 'measured',
      position: metrics.position.status === 'measured',
      ctr: metrics.ctr.status === 'measured',
    },
    queries,
    pages,
    leaks: noindexLeaks(pages),
    demand: classifyQueries(queries),
    sampleNote: sampleNote(metrics),
    inspections: perf.inspections && perf.inspections.status === 'measured'
      ? perf.inspections
      : { status: 'unavailable', value: null },
    sitemap: perf.sitemap || { status: 'unavailable' },
    sitemapSubmit: perf.sitemapSubmit || null,
    potential: keywordPotential(queries),
    inventsClicks: false,
    inventsImpressions: false,
    inventsCtr: false,
    inventsPosition: false,
    inventsQueries: false,
    inventsTraffic: false,
  };
  view.recommendations = recommendations(view);
  return view;
}

function findings() {
  return [
    {
      id: 'alias-duplicate',
      found: '/marketplace, /autonomy, and /innovation-log answered 200 while their canonical pointed elsewhere.',
      fix: 'GET and HEAD now 301 to /services or /live-actions. A known /blog/:slug 301s to /insights/:slug.',
    },
    {
      id: '404-indexable',
      found: 'Unknown HTML returned 404, and the document had no robots noindex.',
      fix: 'The 404 carries meta robots noindex,nofollow and the X-Robots-Tag header.',
    },
    {
      id: 'admin-crawl',
      found: 'robots.txt disallowed /dashboard and /account, and left /admin crawlable.',
      fix: 'robots.txt disallows /admin. The page is also noindex.',
    },
    {
      id: 'console-hidden',
      found: 'Search Console clicks, impressions, CTR, and position were not on the SEO desk.',
      fix: 'The desk prints those four numbers only when the last Google read measured them.',
    },
    {
      id: 'js-preload',
      found: 'Every document preloaded app.js next to the hero image.',
      fix: 'The early hint and the Link header preload the stylesheet. The script loads with the page.',
    },
    {
      id: 'lighthouse',
      found: 'This process does not run Lighthouse.',
      fix: 'The score stays unmeasured. Critical text already uses the system font stack, so Orbitron is not preloaded.',
    },
  ];
}

function report() {
  const briefs = articleBriefs();
  const search = consoleView();
  return {
    ok: true,
    protocol: PROTOCOL,
    inventsVisitors: false,
    inventsClicks: false,
    inventsImpressions: false,
    inventsRankings: false,
    inventsCompetition: false,
    estimatedSessions: null,
    lighthouse: { status: 'unmeasured', value: null, before: null, after: null },
    checklist: {
      passed: 5,
      total: 6,
      note: 'Five code checks are in place. Lighthouse is the one that stays unmeasured.',
    },
    aliases: ALIASES,
    findings: findings(),
    search,
    briefs,
    briefCount: briefs.length,
    publishedBriefs: 0,
    note: 'Estimated traffic is unavailable. Competition is unmeasured. The 50 titles point at shelf pages that already exist. They are not new indexable URLs.',
  };
}

function publicReport() {
  const body = report();
  const text = JSON.stringify(body);
  if (/-----BEGIN|private_key|ya29\./.test(text)) {
    return {
      ok: false,
      protocol: PROTOCOL,
      blocked: true,
      reason: 'refused_to_print_secret',
      inventsClicks: false,
      estimatedSessions: null,
    };
  }
  return body;
}

function deskHtml() {
  const body = publicReport();
  const search = body.search || {};
  const metrics = search.metrics || {};
  const cells = [
    ['Clicks', formatMetric(metrics.clicks, 'clicks'), 'clicks'],
    ['Impressions', formatMetric(metrics.impressions, 'impressions'), 'impressions'],
    ['CTR', formatMetric(metrics.ctr, 'ctr'), 'ctr'],
    ['Average position', formatMetric(metrics.position, 'position'), 'position'],
  ].map(([label, value, key]) => (
    '<div class="card" style="padding:14px"><span class="kicker">' + esc(label) + '</span>'
    + '<p style="margin:8px 0 0;font-size:22px">' + esc(value) + '</p>'
    + '<p style="margin:4px 0 0;font-size:12px;color:var(--ink-dim)">'
    + (search.access && search.access[key] ? 'Accessible' : 'Not read') + '</p></div>'
  )).join('');
  const rowCells = (row) => (
    '<td>' + esc(formatMetric({ status: row.clicks == null ? 'unavailable' : 'measured', value: row.clicks }, 'clicks')) + '</td>'
    + '<td>' + esc(formatMetric({ status: row.impressions == null ? 'unavailable' : 'measured', value: row.impressions }, 'impressions')) + '</td>'
    + '<td>' + esc(formatMetric({ status: row.ctr == null ? 'unavailable' : 'measured', value: row.ctr }, 'ctr')) + '</td>'
    + '<td>' + esc(formatMetric({ status: row.position == null ? 'unavailable' : 'measured', value: row.position }, 'position')) + '</td>'
  );
  const queryRows = search.queries && search.queries.status === 'measured' && Array.isArray(search.queries.value)
    ? search.queries.value : null;
  const queryHtml = queryRows
    ? (queryRows.length
      ? '<div style="overflow-x:auto"><table style="width:100%;min-width:640px;border-collapse:collapse;font-size:14px;margin-top:8px"><thead><tr><th style="text-align:left">Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>'
        + queryRows.map((row) => '<tr><td>' + esc(row.query) + '</td>' + rowCells(row) + '</tr>').join('')
        + '</tbody></table></div>'
      : '<p style="margin:8px 0 0;color:var(--ink-dim)">Google returned no queries in this window.</p>')
    : '<p style="margin:8px 0 0;color:var(--ink-dim)">Queries are unavailable until Search Console returns them.</p>';
  const pageRows = search.pages && search.pages.status === 'measured' && Array.isArray(search.pages.value)
    ? search.pages.value : null;
  const pageHtml = pageRows
    ? (pageRows.length
      ? '<div style="overflow-x:auto"><table style="width:100%;min-width:640px;border-collapse:collapse;font-size:14px;margin-top:8px"><thead><tr><th style="text-align:left">Page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>'
        + pageRows.map((row) => '<tr><td>' + esc(row.page) + '</td>' + rowCells(row) + '</tr>').join('')
        + '</tbody></table></div>'
      : '<p style="margin:8px 0 0;color:var(--ink-dim)">Google returned no pages in this window.</p>')
    : '<p style="margin:8px 0 0;color:var(--ink-dim)">Pages are unavailable until Search Console returns them.</p>';
  const pageNote = pageRows
    ? '<p style="margin:8px 0 0;color:var(--ink-dim);font-size:13px">These are the page rows Google returned. They are not added into the property totals above.</p>'
    : '';
  const recs = search.recommendations;
  const recHtml = recs && recs.status === 'measured' && Array.isArray(recs.value)
    ? (recs.value.length
      ? '<ol style="margin:8px 0 0;padding-left:18px;font-size:14px;line-height:1.55">'
        + recs.value.map((item) => '<li style="margin:0 0 8px"><strong>' + esc(item.action) + '</strong> ' + esc(item.because) + '</li>').join('')
        + '</ol>'
      : '<p style="margin:8px 0 0;color:var(--ink-dim)">The four metrics are measured. No rule fired for this window.</p>')
    : '<p style="margin:8px 0 0;color:var(--ink-dim)">' + esc((recs && recs.note) || 'Recommendations stay unwritten until the four metrics are measured.') + '</p>';
  const range = search.range && search.range.startDate
    ? (search.range.startDate + ' → ' + search.range.endDate)
    : '';
  const sample = search.sampleNote
    ? '<p style="color:var(--ink-dim);font-size:13.5px">' + esc(search.sampleNote) + '</p>'
    : '';
  const demand = search.demand && search.demand.status === 'measured' ? search.demand : null;
  const residue = demand ? demand.residue : [];
  const echoes = demand ? demand.echoes : [];
  const demandHtml = demand
    ? '<p style="margin:8px 0 0;color:var(--ink-dim)">' + esc(demand.note) + '</p>'
      + '<p style="margin:8px 0 0"><strong>Brand residue</strong></p><ul style="margin:6px 0 0;padding-left:18px">'
      + (residue.length ? residue.map((row) => '<li>' + esc(row.query) + ' · position ' + esc(row.position) + ' · no article</li>').join('') : '<li>None in this window.</li>')
      + '</ul><p style="margin:8px 0 0"><strong>Offer echoes</strong></p><ul style="margin:6px 0 0;padding-left:18px">'
      + (echoes.length ? echoes.map((row) => '<li>' + esc(row.query) + ' → <a href="' + esc(row.href) + '" data-link>' + esc(row.href) + '</a></li>').join('') : '<li>None in this window.</li>')
      + '</ul>'
    : '<p style="margin:8px 0 0;color:var(--ink-dim)">Queries are unavailable until Search Console returns them.</p>';
  const leaks = search.leaks && search.leaks.status === 'measured' && Array.isArray(search.leaks.value)
    ? search.leaks.value : null;
  const leakHtml = leaks
    ? (leaks.length
      ? '<ul style="margin:8px 0 0;padding-left:18px">' + leaks.map((row) => '<li>' + esc(row.page) + ' · impressions ' + esc(row.impressions) + '</li>').join('') + '</ul>'
      : '<p style="margin:8px 0 0;color:var(--ink-dim)">No noindex URL was in the shown-page rows.</p>')
    : '<p style="margin:8px 0 0;color:var(--ink-dim)">Shown pages are unavailable.</p>';
  const inspections = search.inspections && search.inspections.status === 'measured' && Array.isArray(search.inspections.value)
    ? search.inspections.value : [];
  const inspectionHtml = inspections.length
    ? '<ul style="margin:8px 0 0;padding-left:18px">' + inspections.map((row) => (
      '<li>' + esc(row.inspectionUrl) + ' · ' + esc(row.status === 'measured' ? (row.verdict || row.coverageState || 'measured') : ('HTTP ' + row.httpStatus))
      + (row.googleCanonical ? ' · Google canonical ' + esc(row.googleCanonical) : '') + '</li>'
    )).join('') + '</ul>'
    : '<p style="margin:8px 0 0;color:var(--ink-dim)">Inspection runs only for URLs Google already showed, and only after that call returns.</p>';
  const sitemap = search.sitemap || {};
  const sitemapLine = 'Sitemap on ' + esc(search.siteUrl || 'the property') + ': ' + esc(sitemap.status || 'unavailable')
    + (search.sitemapSubmit && search.sitemapSubmit.status ? ' · submit HTTP ' + esc(search.sitemapSubmit.status) : '');
  const briefs = (body.briefs || []).map((item) => (
    '<li style="margin:0 0 8px"><a href="' + esc(item.href) + '" data-link>' + esc(item.title) + '</a>'
    + ' <span style="color:var(--ink-dim)">· ' + esc(item.phrase) + ' · sessions unavailable</span></li>'
  )).join('');
  const found = (body.findings || []).map((item) => (
    '<li style="margin:0 0 10px"><strong>' + esc(item.found) + '</strong> ' + esc(item.fix) + '</li>'
  )).join('');
  const potential = search.potential && search.potential.status === 'measured' && Array.isArray(search.potential.value)
    ? search.potential.value
    : [];
  const potentialHtml = potential.length
    ? '<ul style="margin:8px 0 0;padding-left:18px">' + potential.slice(0, 10).map((row) => (
      '<li>' + esc(row.query) + ' · position ' + esc(row.position) + '</li>'
    )).join('') + '</ul>'
    : '<p style="margin:8px 0 0;color:var(--ink-dim)">No query has been measured yet. Search Console has to return one before a keyword can be called potential.</p>';
  return '<section id="organicGrowth" style="margin:8px 0 28px">'
    + '<span class="kicker">OGD/1.0 · Search Console</span>'
    + '<h2 style="margin:8px 0 10px">Clicks, impressions, CTR, position</h2>'
    + '<p style="color:var(--ink-dim);font-size:14px;max-width:46rem">Reason: ' + esc(search.reason || 'not_read_yet')
    + (range ? ' · ' + esc(range) : '')
    + '. A number appears only when Google measured it. Estimated traffic is not available. Lighthouse is unmeasured.</p>'
    + sample
    + '<div id="searchConsoleDashboard">'
    + '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px">' + cells + '</div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">Queries Google returned</span>' + queryHtml + '</div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">Pages Google returned</span>' + pageHtml + pageNote + '</div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">Recommendations from this read</span>' + recHtml + '</div>'
    + '</div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">Measured demand</span>' + demandHtml + '</div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">Noindex URLs Google showed</span>' + leakHtml + '</div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">Shown-page inspection</span>' + inspectionHtml + '<p style="margin:8px 0 0;color:var(--ink-dim);font-size:13px">' + sitemapLine + '</p></div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">Potential queries</span>' + potentialHtml + '</div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">What changed</span><ul style="margin:8px 0 0;padding-left:18px;color:var(--ink-dim);font-size:14px;line-height:1.55">' + found + '</ul></div>'
    + '<div class="card" style="padding:16px;margin-top:12px"><span class="kicker">50 article proposals</span>'
    + '<p style="color:var(--ink-dim);font-size:13.5px">Each title links to the shelf page that already delivers the file. None of these titles is a new URL, and none has an estimated session count.</p>'
    + '<ol style="margin:8px 0 0;padding-left:18px;font-size:14px;line-height:1.5">' + briefs + '</ol></div>'
    + '</section>';
}

module.exports = {
  PROTOCOL,
  ALIASES,
  aliasTarget,
  articleBriefs,
  keywordPotential,
  consoleView,
  findings,
  report,
  publicReport,
  deskHtml,
  noindexLeaks,
  classifyQueries,
  formatMetric,
  sampleNote,
  recommendations,
};
