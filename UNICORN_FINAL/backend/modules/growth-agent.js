'use strict';

/**
 * GDO/1.0 — Growth discover agent.
 * Builds content briefs and unpublished draft records from pages that already
 * exist. It does not call a model, does not send email, does not ping IndexNow,
 * and does not call Google. Traffic-engine owns the single IndexNow pulse.
 * Search Console stays on search-console-bridge and stays blocked without
 * GOOGLE_SERVICE_ACCOUNT_JSON. Public status reads do not write drafts.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'GDO/1.0';
let _busy = false;

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

function _stopped(opts) {
  if (opts && opts.stopped === true) return true;
  return String(process.env.GROWTH_EMERGENCY_STOP || '') === '1';
}

function _slug(raw) {
  return String(raw || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80);
}

function draftDir(opts) {
  const raw = (opts && opts.dir) || process.env.GROWTH_DRAFT_DIR || '';
  if (raw) return path.resolve(String(raw));
  if (process.env.NODE_ENV === 'test') return null;
  return path.resolve(__dirname, '..', '..', 'data', 'growth', 'drafts');
}

function _inside(root, target) {
  const base = path.resolve(root) + path.sep;
  const file = path.resolve(target);
  return file.startsWith(base);
}

function _metric(source, key) {
  if (!source || !Object.prototype.hasOwnProperty.call(source, key) || source[key] == null || source[key] === '') {
    return { status: 'unavailable', value: null };
  }
  const n = Number(source[key]);
  if (!Number.isFinite(n)) return { status: 'unavailable', value: null };
  return { status: 'measured', value: n };
}

function analyticsReport(input) {
  const src = input && input.measurements;
  const keys = [
    'visits',
    'organicClicks',
    'organicImpressions',
    'registrations',
    'checkouts',
    'purchases',
    'refunds',
    'revenueUsd',
    'acquisitionCostUsd',
  ];
  const metrics = {};
  keys.forEach((key) => { metrics[key] = _metric(src, key); });
  return {
    ok: true,
    protocol: PROTOCOL,
    inventsVisits: false,
    inventsRevenue: false,
    inventsRankings: false,
    inventsSearchVolume: false,
    source: (input && input.source) || null,
    freshness: (input && input.freshness) || 'unavailable',
    metrics,
    note: 'A missing measurement is unavailable. Zero is reported only when the source recorded zero.',
  };
}

function seoHealth() {
  let audit = null;
  let error = null;
  try {
    audit = require('./discovery-seven').audit();
  } catch (e) {
    error = e && e.message;
    audit = { ok: false, points: [] };
  }
  const points = Array.isArray(audit.points) ? audit.points : [];
  const byKey = {};
  points.forEach((p) => { if (p && p.key) byKey[p.key] = p; });
  const google = byKey.googleIndexed || {};
  const consolePoint = byKey.searchConsole || {};
  return {
    ok: audit.ok !== false,
    protocol: PROTOCOL,
    owner: 'discovery-seven',
    inventsIndexed: false,
    inventsRankings: false,
    inventsSearchVolume: false,
    error,
    googleIndexed: {
      status: 'unavailable',
      value: null,
      why: google.whyOpen || 'Google does not publish an index answer without Search Console.',
    },
    searchConsole: {
      status: consolePoint.closed ? 'connected' : 'blocked',
      secret: consolePoint.blocker || 'GOOGLE_SERVICE_ACCOUNT_JSON',
    },
    points: points.map((p) => ({
      key: p.key,
      closed: !!p.closed,
      status: p.key === 'googleIndexed' ? 'unavailable' : (p.closed ? 'closed_in_code' : 'open'),
    })),
    closedCount: audit.closedCount == null ? null : audit.closedCount,
    openCount: audit.openCount == null ? null : audit.openCount,
  };
}

function externalAction(request) {
  const kind = String(request && request.kind || '');
  const approved = !!(request && request.approved === true);
  const secretByKind = {
    search_console_submit: 'GOOGLE_SERVICE_ACCOUNT_JSON',
    bing_submit: 'BING_WEBMASTER_API_KEY',
    email_send: 'RESEND_API_KEY',
  };
  const base = {
    ok: false,
    blocked: true,
    executed: false,
    published: false,
    kind,
  };
  if (!kind || kind === 'publish' || kind === 'deploy' || kind === 'indexnow_ping') {
    return Object.assign(base, { reason: 'not_authorized_for_growth_agent' });
  }
  if (!approved) return Object.assign(base, { reason: 'approval_required' });
  if (kind === 'directory_submit') {
    return Object.assign(base, { reason: 'no_verified_directory_api' });
  }
  const secret = secretByKind[kind] || null;
  if (!secret) return Object.assign(base, { reason: 'unknown_action' });
  if (!String(process.env[secret] || '').trim()) {
    return Object.assign(base, { reason: 'secret_missing', secret });
  }
  return Object.assign(base, { reason: 'delegated_not_performed_here', secret });
}

function record(draft, opts) {
  if (_stopped(opts)) {
    return { ok: false, saved: false, published: false, reason: 'emergency_stop' };
  }
  const root = draftDir(opts);
  if (!root) return { ok: false, saved: false, published: false, reason: 'no_draft_dir' };
  const slug = _slug(draft && draft.slug);
  if (!slug) return { ok: false, saved: false, published: false, reason: 'slug_required' };
  const file = path.join(root, slug + '.json');
  if (!_inside(root, file)) {
    return { ok: false, saved: false, published: false, reason: 'path_refused' };
  }
  if (fs.existsSync(path.join(root, 'STOP'))) {
    return { ok: false, saved: false, published: false, reason: 'emergency_stop' };
  }
  const body = {
    protocol: PROTOCOL,
    status: 'draft',
    published: false,
    createdNewUrl: false,
    modelCalled: false,
    kind: draft && draft.kind,
    slug,
    keyword: draft && draft.keyword,
    title: draft && draft.title,
    description: draft && draft.description,
    canonical: draft && draft.canonical,
    markdown: draft && draft.markdown,
    savedAt: new Date().toISOString(),
  };
  body.seo = seoCheck(body);
  fs.mkdirSync(root, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
  fs.renameSync(tmp, file);
  return { ok: true, saved: true, published: false, slug, file, seo: body.seo };
}

function _appendHistory(root, entry) {
  fs.mkdirSync(root, { recursive: true });
  fs.appendFileSync(path.join(root, 'history.jsonl'), JSON.stringify(entry) + '\n');
  return entry;
}

function history(opts) {
  const root = draftDir(opts);
  if (!root) return [];
  const file = path.join(root, 'history.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch (_) { return null; }
  }).filter(Boolean);
}

function runScheduled(opts) {
  const o = opts || {};
  if (_busy) {
    return { ok: false, executed: false, blocked: true, saved: false, published: false, reason: 'already_running' };
  }
  if (_stopped(o)) {
    return { ok: false, executed: false, blocked: true, saved: false, published: false, reason: 'emergency_stop' };
  }
  const root = draftDir(o);
  if (!root) {
    return { ok: false, executed: false, saved: false, published: false, reason: 'no_draft_dir' };
  }
  if (fs.existsSync(path.join(root, 'STOP'))) {
    return { ok: false, executed: false, blocked: true, saved: false, published: false, reason: 'emergency_stop' };
  }
  _busy = true;
  try {
    const list = briefs();
    if (!list.length) {
      return _appendHistory(root, {
        id: crypto.randomBytes(8).toString('hex'),
        at: new Date().toISOString(),
        ok: false,
        executed: true,
        saved: false,
        published: false,
        reason: 'no_briefs',
        source: o.source || 'scheduled',
      });
    }
    const wanted = _slug(o.slug);
    const prior = history({ dir: root }).length;
    const brief = (wanted && list.find((row) => _slug(row.slug) === wanted))
      || list[prior % list.length];
    const draft = draftArticle(brief);
    const seoOk = !!(draft.seo && draft.seo.titleOk && draft.seo.descriptionOk && draft.seo.internalLink);
    let saved = { ok: false, saved: false, reason: 'seo_failed' };
    if (seoOk) saved = record(draft, { dir: root });
    return _appendHistory(root, {
      id: crypto.randomBytes(8).toString('hex'),
      at: new Date().toISOString(),
      ok: !!saved.ok,
      executed: true,
      saved: !!saved.saved,
      published: false,
      createdNewUrl: false,
      modelCalled: false,
      indexNowPinged: false,
      slug: draft.slug,
      reason: saved.ok ? 'draft_saved' : (saved.reason || 'seo_failed'),
      source: o.source || 'scheduled',
      seo: draft.seo,
    });
  } finally {
    _busy = false;
  }
}

function tick(opts) {
  const o = opts || {};
  const rows = briefs().map(draftArticle);
  const report = {
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
    persistsOnPublicGet: false,
    seoHealth: seoHealth(),
    analytics: analyticsReport(o.measurements ? { measurements: o.measurements, source: o.source || null } : null),
  };
  if (o.persist === true) report.scheduled = runScheduled(o);
  return report;
}

module.exports = {
  PROTOCOL,
  briefs,
  draftArticle,
  seoCheck,
  tick,
  record,
  history,
  runScheduled,
  analyticsReport,
  seoHealth,
  externalAction,
  draftDir,
};
