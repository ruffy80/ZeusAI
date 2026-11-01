'use strict';

const dns = require('dns').promises;
const http = require('http');
const https = require('https');
const net = require('net');
const { URL } = require('url');

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

function loopbackAllowed() {
  return process.env.AUDIT_SCAN_ALLOW_LOOPBACK === '1';
}

function isPrivateIp(ip) {
  const kind = net.isIP(String(ip || ''));
  if (kind === 4) {
    const parts = String(ip).split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (kind === 6) {
    const n = String(ip).toLowerCase();
    if (n === '::1' || n === '::') return true;
    if (n.startsWith('fe80:') || n.startsWith('fc') || n.startsWith('fd')) return true;
    if (n.startsWith('::ffff:')) return isPrivateIp(n.slice(7));
    return false;
  }
  return true;
}

function hostBlocked(hostname) {
  const name = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!name) return 'blocked_host';
  if (name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.local')) return 'blocked_host';
  if (name === 'metadata.google.internal') return 'blocked_host';
  if (net.isIP(name)) {
    if (isPrivateIp(name)) {
      if (loopbackAllowed() && (name === '127.0.0.1' || name === '::1')) return null;
      return 'blocked_host';
    }
  }
  return null;
}

function normalizePublicUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: false, reason: 'audit_url_required' };
  if (text.length > 300) return { ok: false, reason: 'invalid_url' };
  let candidate = text;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = 'https://' + candidate;
  let parsed;
  try { parsed = new URL(candidate); } catch (_) {
    return { ok: false, reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported_protocol' };
  }
  if (parsed.username || parsed.password) return { ok: false, reason: 'credentials_in_url' };
  const blocked = hostBlocked(parsed.hostname);
  if (blocked) return { ok: false, reason: blocked };
  parsed.hash = '';
  return { ok: true, url: parsed.toString() };
}

async function resolvePublic(hostname) {
  const blocked = hostBlocked(hostname);
  if (blocked) {
    const err = new Error(blocked);
    err.code = blocked;
    throw err;
  }
  if (net.isIP(hostname)) return hostname;
  let records = [];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (_) {
    const err = new Error('dns_failed');
    err.code = 'dns_failed';
    throw err;
  }
  if (!records.length) {
    const err = new Error('dns_failed');
    err.code = 'dns_failed';
    throw err;
  }
  for (const rec of records) {
    if (isPrivateIp(rec.address) && !(loopbackAllowed() && (rec.address === '127.0.0.1' || rec.address === '::1'))) {
      const err = new Error('blocked_host');
      err.code = 'blocked_host';
      throw err;
    }
  }
  return records[0].address;
}

function clip(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function decodeBasic(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function attr(tag, name) {
  const re = new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
  const match = re.exec(tag);
  return match ? (match[2] || match[3] || match[4] || '') : '';
}

function measure(html, status, headers, finalUrl) {
  const body = String(html || '');
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body);
  const title = clip(decodeBasic(titleMatch ? titleMatch[1] : ''), 180);
  let description = '';
  const metas = body.match(/<meta\b[^>]*>/gi) || [];
  metas.forEach((tag) => {
    const name = attr(tag, 'name').toLowerCase();
    const property = attr(tag, 'property').toLowerCase();
    if (name === 'description' || property === 'og:description') {
      if (!description) description = clip(decodeBasic(attr(tag, 'content')), 220);
    }
  });
  const h1 = (body.match(/<h1\b/gi) || []).length;
  let canonical = '';
  const links = body.match(/<link\b[^>]*>/gi) || [];
  links.forEach((tag) => {
    if (attr(tag, 'rel').toLowerCase().split(/\s+/).includes('canonical') && !canonical) {
      canonical = clip(attr(tag, 'href'), 300);
    }
  });
  const htmlTag = /<html\b[^>]*>/i.exec(body);
  const lang = htmlTag ? clip(attr(htmlTag[0], 'lang'), 16) : '';
  const images = body.match(/<img\b[^>]*>/gi) || [];
  let missingAlt = 0;
  images.forEach((tag) => {
    if (!attr(tag, 'alt')) missingAlt += 1;
  });
  const checks = [
    { id: 'http_status_200', pass: status === 200, evidence: String(status) },
    { id: 'title_present', pass: title.length > 0, evidence: title || 'missing' },
    { id: 'meta_description_present', pass: description.length > 0, evidence: description || 'missing' },
    { id: 'single_h1', pass: h1 === 1, evidence: String(h1) },
    { id: 'canonical_present', pass: canonical.length > 0, evidence: canonical || 'missing' },
    { id: 'html_lang_present', pass: lang.length > 0, evidence: lang || 'missing' },
  ];
  const headerMap = headers || {};
  return {
    fetched: true,
    ok: status > 0,
    status,
    finalUrl,
    score: checks.filter((row) => row.pass).length,
    scoreMax: checks.length,
    checks,
    title,
    description,
    h1,
    canonical,
    lang,
    bytes: Buffer.byteLength(body, 'utf8'),
    contentType: clip(headerMap['content-type'] || '', 80),
    cacheControl: clip(headerMap['cache-control'] || '', 80),
    images: images.length,
    imagesMissingAlt: missingAlt,
    reason: null,
  };
}

function requestOnce(target, address) {
  return new Promise((resolve, reject) => {
    const lib = target.protocol === 'https:' ? https : http;
    const headers = {
      Host: target.host,
      'User-Agent': 'ZeusAI-Audit/1.0',
      Accept: 'text/html,application/xhtml+xml',
    };
    const req = lib.request({
      protocol: target.protocol,
      hostname: address,
      port: target.port || undefined,
      path: (target.pathname || '/') + target.search,
      method: 'GET',
      headers,
      servername: target.hostname,
      timeout: TIMEOUT_MS,
      rejectUnauthorized: true,
    }, (res) => {
      const code = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(code) && res.headers.location) {
        res.resume();
        resolve({ redirect: res.headers.location, status: code });
        return;
      }
      const chunks = [];
      let size = 0;
      let failed = false;
      res.on('data', (buf) => {
        if (failed) return;
        size += buf.length;
        if (size > MAX_BYTES) {
          failed = true;
          req.destroy();
          reject(Object.assign(new Error('body_too_large'), { code: 'body_too_large' }));
          return;
        }
        chunks.push(buf);
      });
      res.on('end', () => {
        if (failed) return;
        resolve({
          status: code,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          finalUrl: target.href,
        });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(Object.assign(new Error('timeout'), { code: 'timeout' }));
    });
    req.on('error', (err) => {
      reject(Object.assign(new Error(err.code || 'fetch_failed'), { code: err.code || 'fetch_failed' }));
    });
    req.end();
  });
}

async function scan(raw) {
  let current;
  try {
    current = new URL(String(raw || '').trim());
  } catch (_) {
    return { fetched: false, score: null, scoreMax: 6, reason: 'invalid_url', checks: [] };
  }
  if (current.username || current.password) {
    return { fetched: false, score: null, scoreMax: 6, reason: 'credentials_in_url', checks: [] };
  }
  if (current.protocol !== 'http:' && current.protocol !== 'https:') {
    return { fetched: false, score: null, scoreMax: 6, reason: 'unsupported_protocol', checks: [] };
  }
  let redirects = 0;
  while (redirects <= MAX_REDIRECTS) {
    let address;
    try {
      address = await resolvePublic(current.hostname);
    } catch (err) {
      return { fetched: false, score: null, scoreMax: 6, reason: err.code || 'blocked_host', checks: [], requestedUrl: current.href };
    }
    let result;
    try {
      result = await requestOnce(current, address);
    } catch (err) {
      return { fetched: false, score: null, scoreMax: 6, reason: err.code || 'fetch_failed', checks: [], requestedUrl: current.href };
    }
    if (result.redirect) {
      redirects += 1;
      if (redirects > MAX_REDIRECTS) {
        return { fetched: false, score: null, scoreMax: 6, reason: 'too_many_redirects', checks: [], requestedUrl: current.href };
      }
      try {
        current = new URL(result.redirect, current);
      } catch (_) {
        return { fetched: false, score: null, scoreMax: 6, reason: 'bad_redirect', checks: [] };
      }
      continue;
    }
    const measured = measure(result.body, result.status, result.headers, result.finalUrl);
    measured.requestedUrl = String(raw || '').trim();
    return measured;
  }
  return { fetched: false, score: null, scoreMax: 6, reason: 'too_many_redirects', checks: [] };
}

function urlFromReceipt(receipt) {
  const bags = [
    receipt && receipt.meta && receipt.meta.inputs,
    receipt && receipt.buyer && receipt.buyer.inputs,
    receipt && receipt.inputs,
  ];
  for (const bag of bags) {
    if (!bag || typeof bag !== 'object') continue;
    const direct = bag.url || bag.website || bag.site;
    if (direct) return String(direct).trim();
  }
  return '';
}

function line(id, row) {
  return '- ' + id + ': ' + (row && row.pass ? 'pass' : 'fail') + ' (' + (row ? row.evidence : 'missing') + ')';
}

function render(opts) {
  const seed = opts && opts.seed ? opts.seed : '';
  const quoted = Array.isArray(opts && opts.quoted) ? opts.quoted : [];
  const scanResult = opts && opts.scan;
  const urlLine = quoted.map((row) => String(row)).find((row) => /^url:/i.test(row))
    || (scanResult && scanResult.requestedUrl ? ('url: ' + scanResult.requestedUrl) : 'not on the order. No page was fetched.');
  if (!scanResult || scanResult.fetched !== true || scanResult.score == null) {
    const reason = scanResult && scanResult.reason && scanResult.reason !== 'url_missing'
      ? scanResult.reason
      : null;
    return [
      '## Scorecard',
      'Subject: ' + seed,
      'URL: ' + urlLine,
      reason
        ? 'No score is filled in. Fetch failed: ' + reason + '.'
        : 'No score is filled in. This copy did not fetch the page.',
      '',
      '## SEO findings',
      '- Check the title, the meta description, one H1, and the canonical on that URL.',
      '- Check whether the URL is in the sitemap.',
      '',
      '## Performance',
      '- Check the largest image, render-blocking scripts, and cache headers.',
      '',
      '## Accessibility',
      '- Check contrast, labels on form fields, and keyboard focus.',
      '',
      '## 30-day fix plan',
      '1. Week 1: title, meta, and canonical.',
      '2. Week 2: the largest image and cache headers.',
      '3. Week 3: labels and focus.',
      '4. Week 4: repeat the same checks. Do not invent a score.',
    ].join('\n') + require('./paid-measure-carry').carrySection();
  }
  const byId = {};
  (scanResult.checks || []).forEach((row) => { byId[row.id] = row; });
  const failed = (scanResult.checks || []).filter((row) => !row.pass).map((row) => row.id);
  const plan = failed.length
    ? failed.map((id, index) => (index + 1) + '. Fix ' + id + ' on ' + scanResult.finalUrl + '.')
    : ['1. The six checks passed on the fetched page. No extra fix was invented.'];
  return [
    '## Scorecard',
    'Subject: ' + seed,
    'URL: ' + (scanResult.finalUrl || urlLine),
    'Fetched status: ' + scanResult.status,
    'Measured score: ' + scanResult.score + ' of ' + scanResult.scoreMax + ' checks on this URL. The score is the number of checks that passed. It is not a modeled grade.',
    line('http_status_200', byId.http_status_200),
    line('title_present', byId.title_present),
    line('meta_description_present', byId.meta_description_present),
    line('single_h1', byId.single_h1),
    line('canonical_present', byId.canonical_present),
    line('html_lang_present', byId.html_lang_present),
    '',
    '## SEO findings',
    '- Title: ' + (scanResult.title || 'missing'),
    '- Meta description: ' + (scanResult.description || 'missing'),
    '- H1 count: ' + scanResult.h1,
    '- Canonical: ' + (scanResult.canonical || 'missing'),
    '',
    '## Performance',
    '- Response bytes read: ' + scanResult.bytes,
    '- Content-Type: ' + (scanResult.contentType || 'not set'),
    '- Cache-Control: ' + (scanResult.cacheControl || 'not set'),
    'These are the headers this fetch read. No lab score was invented.',
    '',
    '## Accessibility',
    '- html lang: ' + (scanResult.lang || 'missing'),
    '- Images in the fetched HTML: ' + scanResult.images,
    '- Images missing an alt attribute: ' + scanResult.imagesMissingAlt,
    '',
    '## 30-day fix plan',
    plan.join('\n'),
  ].join('\n') + require('./paid-measure-carry').carrySection();
}

module.exports = { scan, render, urlFromReceipt, measure, normalizePublicUrl };
