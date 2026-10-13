'use strict';

/**
 * GDO/1.0 — Growth discover agent.
 * Builds content briefs and unpublished draft records from pages that already
 * exist. It does not call a model, does not send email, does not ping IndexNow,
 * and does not call Google. Traffic-engine owns the single IndexNow pulse and
 * the Search Console bridge.
 */

const PROTOCOL = 'GDO/1.0';

function _desk() {
  return require('../../src/site/v2/discover-trust-os');
}

function _gsc() {
  try {
    const bridge = require('./search-console-bridge');
    const armed = typeof bridge.armedEngines === 'function' ? bridge.armedEngines() : [];
    if (armed.indexOf('google') >= 0) {
      return { submitted: false, armed: true, reason: 'delegated_to_traffic_engine' };
    }
    return { submitted: false, armed: false, reason: 'no_engine_secret' };
  } catch (e) {
    return { submitted: false, armed: false, reason: 'bridge_unavailable', error: e && e.message };
  }
}

function briefs() {
  const desk = _desk();
  const fromArticles = desk.ARTICLES.map((a) => ({
    kind: 'article',
    slug: a.slug,
    keyword: a.keywords,
    title: a.title,
    description: a.description,
    canonical: '/insights/' + a.slug,
    internalLinks: ['/guides', '/trust-safety', '/refund'],
    modelCalled: false,
  }));
  const fromLandings = desk.LANDINGS.map((l) => ({
    kind: 'landing',
    slug: l.slug,
    keyword: l.slug,
    title: l.title,
    description: l.description,
    canonical: '/' + l.slug,
    internalLinks: [l.href, l.article, '/refund'],
    modelCalled: false,
  }));
  return fromArticles.concat(fromLandings);
}

function seoCheck(draft) {
  const title = String(draft && draft.title || '');
  const description = String(draft && draft.description || '');
  const markdown = String(draft && draft.markdown || '');
  const keyword = String(draft && draft.keyword || '').toLowerCase();
  const hay = (title + ' ' + markdown).toLowerCase();
  return {
    titleOk: title.length >= 20 && title.length <= 70,
    descriptionOk: description.length >= 50 && description.length <= 180,
    internalLink: /\]\(\//.test(markdown),
    keywordPresent: keyword.length > 0 && hay.indexOf(keyword) >= 0,
  };
}

function draftArticle(brief) {
  const desk = _desk();
  const article = desk.article(brief.slug);
  const landing = desk.landing(brief.slug);
  const source = article || landing;
  const paragraphs = article ? article.paragraphs : [
    landing.sub,
    'This page is a topic, not a new checkout line.',
    'The next step is ' + landing.cta + ' at ' + landing.href + '.',
  ];
  const links = (brief.internalLinks || []).map((href) => '[' + href + '](' + href + ')').join(' · ');
  const markdown = [
    '# ' + brief.title,
    '',
    brief.description,
    '',
    paragraphs.join('\n\n'),
    '',
    links,
  ].join('\n');
  const draft = {
    protocol: PROTOCOL,
    status: 'draft',
    published: false,
    createdNewUrl: false,
    modelCalled: false,
    kind: brief.kind,
    slug: brief.slug,
    keyword: brief.keyword,
    title: source && source.title ? source.title : brief.title,
    description: brief.description,
    canonical: brief.canonical,
    markdown,
  };
  draft.seo = seoCheck(draft);
  return draft;
}

function tick(opts) {
  const o = opts || {};
  const rows = briefs().map(draftArticle);
  return {
    ok: true,
    protocol: PROTOCOL,
    source: o.source || 'manual',
    dryRun: o.dryRun !== false,
    published: false,
    createdNewUrl: false,
    modelCalled: false,
    indexNowPinged: false,
    indexNow: { pinged: false, owner: 'traffic-engine', reason: 'single_pinger' },
    searchConsole: _gsc(),
    inventsReach: false,
    inventsPosts: false,
    inventsIndexed: false,
    drafts: rows.length,
    records: rows,
  };
}

module.exports = {
  PROTOCOL,
  briefs,
  draftArticle,
  seoCheck,
  tick,
};
