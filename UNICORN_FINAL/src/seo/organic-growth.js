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

function consoleView() {
  let status = null;
  try {
    status = require('../../backend/modules/search-console-bridge').getStatus();
  } catch (_) { status = null; }
  const perf = (status && status.performance) || {};
  const metrics = perf.metrics || {};
  const pick = (key) => {
    const row = metrics[key] || {};
    if (row.status !== 'measured') return { status: 'unavailable', value: null };
    return { status: 'measured', value: row.value };
  };
  const queries = perf.queries && perf.queries.status === 'measured'
    ? { status: 'measured', value: perf.queries.value }
    : { status: 'unavailable', value: null };
  return {
    armed: !!(status && Array.isArray(status.armedEngines) && status.armedEngines.indexOf('google') !== -1),
    reason: perf.reason || 'not_read_yet',
    siteUrl: perf.siteUrl || null,
    metrics: {
      clicks: pick('clicks'),
      impressions: pick('impressions'),
      ctr: pick('ctr'),
      position: pick('position'),
    },
    queries,
    potential: keywordPotential(queries),
    inventsClicks: false,
    inventsImpressions: false,
    inventsCtr: false,
    inventsPosition: false,
    inventsQueries: false,
  };
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

function metricCell(row) {
  if (!row || row.status !== 'measured' || row.value == null) return 'Unavailable';
  return String(row.value);
}

function deskHtml() {
  const body = publicReport();
  const search = body.search || {};
  const metrics = search.metrics || {};
  const cells = [
    ['Clicks', metricCell(metrics.clicks)],
    ['Impressions', metricCell(metrics.impressions)],
    ['CTR', metricCell(metrics.ctr)],
    ['Average position', metricCell(metrics.position)],
  ].map(([label, value]) => (
    '<div class="card" style="padding:14px"><span class="kicker">' + esc(label) + '</span>'
    + '<p style="margin:8px 0 0;font-size:22px">' + esc(value) + '</p></div>'
  )).join('');
  const potential = search.potential && search.potential.status === 'measured' && Array.isArray(search.potential.value)
    ? search.potential.value
    : [];
  const potentialHtml = potential.length
    ? '<ul style="margin:8px 0 0;padding-left:18px">' + potential.slice(0, 10).map((row) => (
      '<li>' + esc(row.query) + ' · position ' + esc(row.position) + '</li>'
    )).join('') + '</ul>'
    : '<p style="margin:8px 0 0;color:var(--ink-dim)">No query has been measured yet. Search Console has to return one before a keyword can be called potential.</p>';
  const briefs = (body.briefs || []).map((item) => (
    '<li style="margin:0 0 8px"><a href="' + esc(item.href) + '" data-link>' + esc(item.title) + '</a>'
    + ' <span style="color:var(--ink-dim)">· ' + esc(item.phrase) + ' · sessions unavailable</span></li>'
  )).join('');
  const found = (body.findings || []).map((item) => (
    '<li style="margin:0 0 10px"><strong>' + esc(item.found) + '</strong> ' + esc(item.fix) + '</li>'
  )).join('');
  return '<section id="organicGrowth" style="margin:8px 0 28px">'
    + '<span class="kicker">OGD/1.0 · Search Console</span>'
    + '<h2 style="margin:8px 0 10px">Clicks, impressions, CTR, position</h2>'
    + '<p style="color:var(--ink-dim);font-size:14px;max-width:46rem">Reason: ' + esc(search.reason || 'not_read_yet')
    + '. A number appears only when Google measured it. Estimated traffic is not available. Lighthouse is unmeasured.</p>'
    + '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px">' + cells + '</div>'
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
};
