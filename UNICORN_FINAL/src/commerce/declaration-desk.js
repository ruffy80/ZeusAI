'use strict';

/**
 * DECL/1.0 — a public checklist the visitor signs.
 *
 * The shareable object is the person's own claim, not a grade. Zeus does not
 * open the repository, does not call GitHub, and does not assign an
 * architecture, debt, security, or readiness score. A click on a network
 * composer is not a post. The server never posts.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'DECL/1.0';
const PUBLIC_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');
const CAP = 200;
const DUPLICATE_MS = 60 * 1000;

const CHECKS = Object.freeze([
  { id: 'readme', label: 'The README names how to run it' },
  { id: 'tests', label: 'Tests run with one command' },
  { id: 'deploy', label: 'The deploy path is findable' },
  { id: 'secrets', label: 'Secrets are not in the tree' },
  { id: 'pinned', label: 'Dependencies are pinned' },
  { id: 'owner', label: 'An owner answers issues' },
  { id: 'architecture', label: 'The architecture fits on one page' },
  { id: 'prompt', label: 'An AI prompt can point at a file without guessing' },
]);

const CHECK_IDS = new Set(CHECKS.map((row) => row.id));

const POLICY = Object.freeze({
  opensRepository: false,
  assignsScore: false,
  ranks: false,
  posts: false,
  inventsEvents: false,
  signup: false,
});

let memory = null;
let nextSeq = 0;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dir() {
  return process.env.DECLARATION_DIR || path.join(__dirname, '../../data/declarations');
}

function filePath() {
  return path.join(dir(), 'declarations.json');
}

function load() {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
    memory = Array.isArray(parsed) ? parsed.slice(-CAP) : [];
  } catch (_) {
    memory = [];
  }
  nextSeq = memory.reduce((max, row) => Math.max(max, Number(row && row.seq) || 0), 0);
  return memory;
}

function save(rows) {
  memory = rows.slice(-CAP);
  fs.mkdirSync(dir(), { recursive: true });
  const dest = filePath();
  const tmp = dest + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(memory));
  fs.renameSync(tmp, dest);
}

function resetForTests() {
  memory = [];
  nextSeq = 0;
  if (!process.env.DECLARATION_DIR) return;
  try { fs.unlinkSync(filePath()); } catch (_) { /* already gone */ }
  try { fs.unlinkSync(filePath() + '.tmp'); } catch (_) { /* already gone */ }
}

function normalizeGithub(raw) {
  let s = String(raw || '').trim();
  if (!s || s.length > 200) return null;
  s = s.replace(/\/+$/, '').replace(/\.git$/i, '');
  const match = s.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) return null;
  if (match[1] === '.' || match[1] === '..' || match[2] === '.' || match[2] === '..') return null;
  return {
    url: 'https://github.com/' + match[1] + '/' + match[2],
    repo: match[1] + '/' + match[2],
  };
}

function cleanName(raw) {
  let s = String(raw || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 80 || /https?:\/\//i.test(s) || /github\.com/i.test(s) || /@/.test(s)) {
    return 'unsigned';
  }
  return s.slice(0, 40);
}

function checksFrom(input) {
  const raw = input && (input.check !== undefined ? input.check : input.checks);
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const chosen = new Set(list.map((value) => String(value)));
  const checks = {};
  for (const row of CHECKS) checks[row.id] = chosen.has(row.id);
  return checks;
}

function parseForm(body) {
  const out = { check: [] };
  for (const part of String(body || '').split('&')) {
    if (!part) continue;
    const cut = part.indexOf('=');
    const key = decodeURIComponent((cut < 0 ? part : part.slice(0, cut)).replace(/\+/g, ' '));
    const value = decodeURIComponent((cut < 0 ? '' : part.slice(cut + 1)).replace(/\+/g, ' '));
    if (key === 'check') out.check.push(value);
    else if (out[key] === undefined) out[key] = value;
  }
  return out;
}

function claimedCount(checks) {
  return CHECKS.reduce((sum, row) => sum + (checks[row.id] ? 1 : 0), 0);
}

function cardPath(id) {
  return '/d/' + id;
}

function cardUrl(id) {
  return PUBLIC_URL + cardPath(id);
}

function shareLine(record) {
  return 'I declared ' + record.claimed + ' of 8 checks on ' + record.repo
    + '. ZeusAI did not read the code. ' + cardUrl(record.id);
}

function drafts(record) {
  const line = shareLine(record);
  const extra = 'This is a self-reported checklist. It is not a grade, and nothing was posted for me.';
  return {
    posted: false,
    x: line,
    linkedin: line + '\n\n' + extra,
    reddit: line + '\n\n' + extra,
    hn: line,
  };
}

function publish(input) {
  const body = input || {};
  const repo = normalizeGithub(body.repo || body.url || '');
  if (!repo) {
    return {
      ok: false,
      error: 'Paste a https://github.com/owner/name URL. An organization page is not a repository.',
    };
  }
  const rows = load();
  const now = Date.now();
  const prior = rows.find((row) => row.url === repo.url && (now - Date.parse(row.createdAt)) < DUPLICATE_MS);
  if (prior) return { ok: true, id: prior.id, record: prior, duplicate: true };
  const checks = checksFrom(body);
  const record = {
    id: crypto.randomBytes(6).toString('hex'),
    seq: ++nextSeq,
    url: repo.url,
    repo: repo.repo,
    displayName: cleanName(body.name || body.displayName),
    checks,
    claimed: claimedCount(checks),
    of: CHECKS.length,
    createdAt: new Date(now).toISOString(),
    opened: false,
    scored: false,
    posted: false,
  };
  rows.push(record);
  save(rows);
  return { ok: true, id: record.id, record, duplicate: false };
}

function get(id) {
  const key = String(id || '').toLowerCase();
  if (!/^[a-f0-9]{12}$/.test(key)) return null;
  return load().find((row) => row.id === key) || null;
}

function list(opts) {
  const limit = Math.max(1, Math.min(100, Number(opts && opts.limit) || 50));
  const q = String((opts && opts.q) || '').trim().toLowerCase();
  const rows = load().slice().sort((a, b) => (Number(b.seq) || 0) - (Number(a.seq) || 0));
  const filtered = q
    ? rows.filter((row) => (
      String(row.repo).toLowerCase().includes(q)
      || String(row.displayName).toLowerCase().includes(q)
    ))
    : rows;
  return filtered.slice(0, limit);
}

function relativeTime(iso, now) {
  const ms = (now || Date.now()) - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 5000) return 'just now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return seconds + ' seconds ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' minutes ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours + ' hours ago';
  return Math.floor(hours / 24) + ' days ago';
}

function discovery() {
  return {
    protocol: PROTOCOL,
    policy: POLICY,
    checks: CHECKS.map((row) => ({ id: row.id, label: row.label })),
    form: '/declare',
    feed: '/declarations',
    stored: load().length,
  };
}

function page(title, body, opts) {
  const o = opts || {};
  const robots = o.robots || 'index,follow';
  const desc = o.description || 'A self-reported repository checklist. Zeus does not open the repository.';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}"/>
  <meta name="robots" content="${esc(robots)}"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(desc)}"/>
  <meta property="og:type" content="website"/>
  ${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}"/>` : ''}
  <style>
    :root{color-scheme:dark}
    body{margin:0;background:#07080f;color:#e8eef8;font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
    main{max-width:720px;margin:0 auto;padding:36px 18px 80px}
    a{color:#7aa9ff}
    h1{font-size:clamp(28px,6vw,42px);line-height:1.08;margin:8px 0 12px}
    h2{font-size:18px;margin:28px 0 8px}
    .kicker{letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:#00e8a0;margin:0}
    .sub{color:#9aa6bd;margin:0 0 18px}
    .card{background:#0e1220;border:1px solid #1e2740;border-radius:16px;padding:16px 18px;margin:12px 0}
    label.check{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #161c2e}
    input[type=url],input[type=text],input[type=search]{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:12px;border:1px solid #1e2740;background:#0b0e1a;color:#e8eef8;font:inherit}
    button,.btn{display:inline-block;padding:12px 16px;border-radius:12px;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
    button.primary{border:0;background:linear-gradient(135deg,#00e8a0,#2de2e6);color:#05060e}
    .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .ghost{border:1px solid #1e2740;background:#0e1220;color:#e8eef8}
    pre,textarea{width:100%;box-sizing:border-box;white-space:pre-wrap;word-break:break-word;background:#0b0e1a;border:1px solid #1a2340;border-radius:12px;padding:12px;font:13px/1.5 ui-monospace,SFMono-Regular,monospace;color:#cdd6e4}
    .err{color:#ffb4b4}
    .meta{font-size:13px;color:#7d8aa3}
    ul{padding-left:18px}
  </style>
</head>
<body>
  <main>
    <p class="kicker">DECL/1.0 · self-reported · no account</p>
    ${body}
    <p class="meta"><a href="/declare">Declare a repository</a> · <a href="/declarations">Declarations</a> · <a href="/">ZeusAI</a></p>
  </main>
  ${o.script || ''}
</body>
</html>`;
}

function formHtml(opts) {
  const error = opts && opts.error ? String(opts.error) : '';
  const boxes = CHECKS.map((row) => (
    `<label class="check"><input type="checkbox" name="check" value="${esc(row.id)}"/> <span>${esc(row.label)}</span></label>`
  )).join('');
  const alert = error ? `<p class="err" role="alert">${esc(error)}</p>` : '';
  return page('Declare a repository', `
    <h1>Sign the checks you can stand behind.</h1>
    <p class="sub">Most teams cannot point to one page that describes the architecture. This is the claim you are willing to publish. Zeus does not open the repository. A number that did not read the repository is not a roast.</p>
    ${alert}
    <form method="post" action="/declare" class="card">
      <label>GitHub repository URL<br/><input type="url" name="repo" required placeholder="https://github.com/owner/name" autocomplete="off"/></label>
      <p class="meta">Optional display name. Leave it blank to sign as unsigned. No email is stored.</p>
      <label>Display name<br/><input type="text" name="name" maxlength="40" autocomplete="off"/></label>
      <h2>Eight checks</h2>
      ${boxes}
      <p class="meta">Leave a box empty if you will not claim it. Zero is an allowed declaration.</p>
      <button class="primary" type="submit">Publish the declaration</button>
    </form>
    <h2>What this page will not publish</h2>
    <ul>
      <li>A grade of any kind. The repository is not opened, so there is no measurement.</li>
      <li>A ranking, a percent badge, or a winner list.</li>
      <li>A live event that did not happen.</li>
      <li>A post to X, LinkedIn, Reddit, Hacker News, or anywhere else. A button only opens a composer in your session.</li>
    </ul>
    <h2>Questions this page refuses to answer with a number</h2>
    <ul>
      <li>Can a model understand this codebase?</li>
      <li>Can a model review the repository?</li>
      <li>Can a model maintain the project?</li>
      <li>How much debt is hidden?</li>
    </ul>
    <p class="sub">Those questions need the code. The code was not opened. The public record is the checklist you tick.</p>
  `, {
    description: 'Publish a self-reported repository checklist. No account. Zeus does not open the repository and does not assign a grade.',
    canonical: PUBLIC_URL + '/declare',
  });
}

function intents(record) {
  const url = cardUrl(record.id);
  const line = shareLine(record);
  const enc = encodeURIComponent;
  return [
    ['X', 'https://twitter.com/intent/tweet?text=' + enc(line)],
    ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(url)],
    ['Reddit', 'https://www.reddit.com/submit?url=' + enc(url) + '&title=' + enc(line)],
    ['Hacker News', 'https://news.ycombinator.com/submitlink?u=' + enc(url) + '&t=' + enc('Declaration: ' + record.repo)],
  ];
}

function cardHtml(record) {
  const ticks = CHECKS.map((row) => {
    const on = !!record.checks[row.id];
    return `<li>${on ? 'Claimed' : 'Not claimed'} — ${esc(row.label)}</li>`;
  }).join('');
  const buttons = intents(record).map(([label, href]) => (
    `<a class="btn ghost" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
  )).join('');
  const copy = drafts(record);
  const embed = '<img src="' + cardUrl(record.id) + '/badge.svg" alt="' + record.claimed + ' of 8 declared, self-reported" width="360" height="88"/>';
  return page(record.repo + ' — ' + record.claimed + ' of 8 declared', `
    <h1>${esc(record.repo)}</h1>
    <p class="sub">You declared ${record.claimed} of 8. Zeus did not open the repository.</p>
    <div class="card">
      <p>Signed as <strong>${esc(record.displayName)}</strong> · ${esc(relativeTime(record.createdAt))}</p>
      <ul>${ticks}</ul>
      <p class="meta">Self-reported. Not a grade. Not a ranking.</p>
      <img src="${esc(cardPath(record.id))}/badge.svg" width="360" height="88" alt="${esc(record.claimed + ' of 8 declared, self-reported')}"/>
    </div>
    <h2>Share this declaration</h2>
    <p class="sub">People share this because it is their own sentence, and the sentence says the code was not read. A click opens a composer. The server does not post.</p>
    <pre id="shareText">${esc(copy.x)}</pre>
    <div class="row">
      <button class="primary" type="button" id="copyShare">Share this declaration</button>
      ${buttons}
    </div>
    <h2>Drafts you can paste</h2>
    <p class="meta">Draft. Nothing on this page is posted by the server.</p>
    <h2>LinkedIn draft</h2>
    <textarea readonly rows="4">${esc(copy.linkedin)}</textarea>
    <h2>Reddit draft</h2>
    <textarea readonly rows="4">${esc(copy.reddit)}</textarea>
    <h2>Hacker News draft</h2>
    <textarea readonly rows="3">${esc(copy.hn)}</textarea>
    <h2>Embed</h2>
    <pre>${esc(embed)}</pre>
    <p><a href="${esc(cardPath(record.id))}/card.pdf">Download the one-page PDF</a></p>
  `, {
    robots: 'noindex',
    description: 'Self-reported checklist for ' + record.repo + '. Zeus did not open the repository.',
    canonical: cardUrl(record.id),
    script: `<script>
  (function () {
    var btn = document.getElementById('copyShare');
    var pre = document.getElementById('shareText');
    if (!btn || !pre) return;
    btn.addEventListener('click', function () {
      var text = pre.textContent || '';
      var done = function () { btn.textContent = 'Copied'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
      }
    });
  }());
  </script>`,
  });
}

function feedHtml(opts) {
  const q = String((opts && opts.q) || '');
  const rows = list({ q, limit: 50 });
  const items = rows.length
    ? rows.map((row) => (
      `<li class="card"><a href="${esc(cardPath(row.id))}">${esc(row.repo)}</a>`
      + ` · ${row.claimed} of 8 · ${esc(relativeTime(row.createdAt))}`
      + ` · ${esc(row.displayName)}</li>`
    )).join('')
    : `<li class="card">${q ? 'No declaration matches that search.' : 'No declaration has been published.'}</li>`;
  return page('Declarations', `
    <h1>Declarations</h1>
    <p class="sub">Newest first. This is the order people published them. It is not a ranking, and it is not a health database.</p>
    <form method="get" action="/declarations">
      <label>Search by repository or display name<br/><input type="search" name="q" value="${esc(q)}"/></label>
    </form>
    <ul style="list-style:none;padding:0">${items}</ul>
  `, {
    robots: 'noindex',
    description: 'Public list of self-reported repository checklists, newest first.',
  });
}

function missingHtml() {
  return page('Declaration not found', `
    <h1>That declaration is not here.</h1>
    <p class="sub">The link may be mistyped. Nothing was scored in its place.</p>
  `, { robots: 'noindex' });
}

function badgeSvg(record) {
  const line = record.claimed + ' of 8 declared';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="88" role="img" aria-label="${esc(line)}, self-reported">
  <rect width="360" height="88" rx="12" fill="#0e1220"/>
  <text x="16" y="36" fill="#e8eef8" font-family="system-ui,sans-serif" font-size="18">${esc(line)}</text>
  <text x="16" y="62" fill="#9aa6bd" font-family="system-ui,sans-serif" font-size="13">self-reported · Zeus did not open this repository</text>
</svg>`;
}

function pdfEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function cardPdf(record) {
  const lines = [
    'ZeusAI declaration',
    record.repo,
    'Declared ' + record.claimed + ' of 8.',
    'Zeus did not open the repository.',
    'Self-reported. Not a grade. Not a ranking.',
    'Signed as ' + record.displayName,
  ];
  for (const row of CHECKS) {
    lines.push((record.checks[row.id] ? '[x] ' : '[ ] ') + row.label);
  }
  let y = 740;
  const cmds = ['BT', '/F1 12 Tf'];
  for (const line of lines) {
    cmds.push('1 0 0 1 48 ' + y + ' Tm (' + pdfEscape(line.slice(0, 90)) + ') Tj');
    y -= 18;
  }
  cmds.push('ET');
  const stream = cmds.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    '4 0 obj << /Length ' + Buffer.byteLength(stream) + ' >> stream\n' + stream + '\nendstream endobj\n',
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body));
    body += obj;
  }
  const xref = Buffer.byteLength(body);
  body += 'xref\n0 ' + (objects.length + 1) + '\n';
  body += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    body += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  body += 'trailer << /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return Buffer.from(body);
}

module.exports = {
  PROTOCOL,
  CHECKS,
  CHECK_IDS,
  POLICY,
  normalizeGithub,
  parseForm,
  publish,
  get,
  list,
  drafts,
  discovery,
  formHtml,
  cardHtml,
  feedHtml,
  missingHtml,
  badgeSvg,
  cardPdf,
  relativeTime,
  resetForTests,
  shareLine,
};
