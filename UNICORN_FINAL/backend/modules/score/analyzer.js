'use strict';

const crypto = require('crypto');

function clip(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) : s;
}

function hostOf(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('url_must_be_http');
  }
  return url;
}

async function analyze(rawUrl) {
  const url = hostOf(rawUrl);
  const started = Date.now();
  let response;
  try {
    response = await fetch(url.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'ZeusAI-Score/1.0' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    return { ok: false, error: 'fetch_failed', detail: err && err.message, url: url.href };
  }
  const elapsed = Date.now() - started;
  const html = await response.text().catch(() => '');
  const body = html.slice(0, 200000);
  const title = (body.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
  const description = (body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1]
    || (body.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) || [])[1]
    || '';
  const h1 = (body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
  const reach = response.status >= 200 && response.status < 400 ? 20 : (response.status ? 8 : 0);
  const titleScore = title.trim() ? 20 : 0;
  const descriptionScore = description.trim() ? 20 : 0;
  const headingScore = h1.replace(/<[^>]+>/g, '').trim() ? 20 : 0;
  let speed = 0;
  if (response.ok) {
    if (elapsed < 500) speed = 20;
    else if (elapsed < 1500) speed = 12;
    else speed = 5;
  }
  const sub = {
    reachability: reach,
    title: titleScore,
    description: descriptionScore,
    heading: headingScore,
    speed,
  };
  const score_total = reach + titleScore + descriptionScore + headingScore + speed;
  const recommendations = [];
  if (!titleScore) recommendations.push('Add one title element.');
  if (!descriptionScore) recommendations.push('Add a meta description.');
  if (!headingScore) recommendations.push('Add one h1.');
  if (speed < 20) recommendations.push('The first response took ' + elapsed + ' ms.');
  if (reach < 20) recommendations.push('The HTTP status was ' + response.status + '.');
  while (recommendations.length < 3) recommendations.push('The measured checks that passed stay as they are.');
  return {
    ok: true,
    url: url.href,
    domain: url.hostname,
    status: response.status,
    elapsed_ms: elapsed,
    score_total,
    sub_scores: sub,
    summary: clip((title.trim() || url.hostname) + ' scored ' + score_total + '/100 from five HTTP checks.', 100),
    summary_source: 'checks',
    recommendations: recommendations.slice(0, 3),
  };
}

function reportHash(report) {
  return crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
}

module.exports = { analyze, reportHash };
