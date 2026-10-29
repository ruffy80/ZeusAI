'use strict';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page(title, body, extraHead) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'
    + esc(title) + '</title>' + (extraHead || '')
    + '<style>body{margin:0;background:#0b0f17;color:#eaf0ff;font:16px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:32px 20px}a{color:#8eb6ff}input,button{font:inherit;padding:10px 12px}button{background:#8eb6ff;color:#0b0f17;border:0;border-radius:8px}</style></head><body><main>'
    + body + '</main></body></html>';
}

function landing(stats, examples) {
  const cards = examples.length
    ? examples.map((row) => '<p><a href="/score/' + esc(row.public_slug) + '">' + esc(row.domain) + ' · ' + esc(row.score_total) + '/100</a></p>').join('')
    : '<p>No score has been stored yet.</p>';
  return page('What\'s your business score?', [
    '<h1>What\'s your business score? Free, signed, verifiable.</h1>',
    '<form method="post" action="/api/score"><input name="url" type="url" required placeholder="https://example.com"> <button type="submit">Get my score</button></form>',
    '<p>' + Number(stats.total_scores || 0) + ' businesses scored</p>',
    '<p>First 100 scores are Founding Scores — permanently in the public ledger</p>',
    cards,
    '<p>Every score is cryptographically signed. Verify at <a href="/witness.json">/witness.json</a></p>',
  ].join(''));
}

function report(score, pack) {
  const bars = Object.keys(score.sub_scores || {}).map((name) => (
    '<p>' + esc(name) + ': ' + esc(score.sub_scores[name]) + '/20</p>'
  )).join('');
  const recs = (score.recommendations || []).map((line) => '<li>' + esc(line) + '</li>').join('');
  const head = '<meta property="og:title" content="' + esc(score.domain) + ' scored ' + esc(score.score_total) + '/100">'
    + '<meta property="og:image" content="' + esc(pack.og_image_url) + '">'
    + '<meta name="twitter:card" content="summary_large_image">'
    + '<meta name="twitter:image" content="' + esc(pack.og_image_url) + '">';
  return page(score.domain + ' · ' + score.score_total + '/100', [
    '<h1>' + esc(score.domain) + '</h1>',
    '<p style="font-size:48px;margin:0">' + esc(score.score_total) + '/100</p>',
    bars,
    '<p>' + esc(score.summary || 'No summary was produced.') + '</p>',
    '<ul>' + recs + '</ul>',
    '<p>Price locked for 24h until ' + esc(pack.locked_until) + '.</p>',
    '<p><a href="/score/' + esc(score.public_slug) + '/upgrade?tier=report">Full report — $' + esc(pack.report_usd) + '</a></p>',
    '<p><a href="/score/' + esc(score.public_slug) + '/upgrade?tier=audit">Full audit — $' + esc(pack.audit_usd) + '</a></p>',
    '<p>' + esc(pack.copy_text) + '</p>',
    '<pre>' + esc(pack.badge_embed_code) + '</pre>',
    '<p><a href="' + esc(pack.witness_url) + '">Witness</a> · <a href="' + esc(pack.ledger_url) + '">Ledger</a> · <a href="/witness.json">Public key</a></p>',
    '<p>Powered by ZeusAI — <a href="/score">get your free score</a></p>',
  ].join(''), head);
}

module.exports = { landing, report };
