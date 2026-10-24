'use strict';

/**
 * INDEX/1.0 — which URLs Unicorn asks a crawler to keep.
 * The retired matrix was listed in a generated sitemap and never had a page.
 * This file does not read Search Console and does not report an indexed count.
 */

const PROTOCOL = 'INDEX/1.0';

const LIVE_SOLUTIONS = Object.freeze([
  '/solutions/ai-pricing',
  '/solutions/ai-checkout',
  '/solutions/ai-self-healing',
]);

const MATRIX_VERTICALS = Object.freeze([
  'ai-revenue-os', 'sovereign-ai-os', 'autonomous-saas', 'ai-self-healing',
  'btc-native-checkout', 'revenue-autopilot', 'ai-orchestrator',
  'compliance-snapshot', 'ai-cost-optimizer', 'multi-llm-router',
]);

const MATRIX_INDUSTRIES = Object.freeze([
  'fintech', 'healthcare', 'e-commerce', 'logistics', 'legal', 'real-estate',
  'manufacturing', 'edtech', 'martech', 'media', 'travel', 'energy',
  'agritech', 'gaming', 'devtools', 'climate', 'biotech', 'insurance',
  'aerospace', 'security', 'crypto', 'consumer', 'b2b-saas', 'government',
  'nonprofit', 'sports', 'hr', 'sales', 'support', 'finance', 'iot',
  'cybersecurity', 'food', 'fashion', 'mobility', 'pharma', 'telecom',
  'construction', 'retail', 'social', 'streaming', 'ar-vr', 'web3',
  'quantum', 'space', 'robotics', 'climate-tech', 'sustainability',
  'workplace', 'community',
]);

const _verticals = new Set(MATRIX_VERTICALS);
const _industries = new Set(MATRIX_INDUSTRIES);

function normalizePath(pathname) {
  const raw = String(pathname || '').split('?')[0].trim();
  if (!raw || raw === '/') return '/';
  return raw.replace(/\/+$/, '') || '/';
}

function isGhost(pathname) {
  const path = normalizePath(pathname);
  const match = path.match(/^\/solutions\/([^/]+)\/for\/([^/]+)$/);
  if (!match) return false;
  return _verticals.has(match[1]) && _industries.has(match[2]);
}

function matrixSize() {
  return MATRIX_VERTICALS.length * MATRIX_INDUSTRIES.length;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function goneHtml(pathname) {
  const path = escapeHtml(normalizePath(pathname));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>This address has no page</title>
</head>
<body>
<p>This address has no page. It was generated as a vertical-and-industry pair and was never a document.</p>
<p><code>${path}</code></p>
<p><a href="/services">Public shelf</a> · <a href="/indexing.json">Index ledger</a></p>
</body>
</html>
`;
}

function document() {
  return {
    protocol: PROTOCOL,
    inventsGoogleCounts: false,
    note: 'This ledger is the set Unicorn asks crawlers to keep, and the matrix it retired. It is not a Search Console report and it does not state how many URLs Google has indexed.',
    sitemap: '/sitemap.xml',
    liveSolutions: LIVE_SOLUTIONS.slice(),
    retired: {
      pattern: '/solutions/{vertical}/for/{industry}',
      verticals: MATRIX_VERTICALS.length,
      industries: MATRIX_INDUSTRIES.length,
      urls: matrixSize(),
      http: 410,
      robots: null,
      reason: 'These URLs were listed in a generated sitemap. No page was rendered for them. The response is 410 and carries no noindex tag. A noindex tag keeps the address in Search Console under Not indexed.',
    },
  };
}

module.exports = {
  PROTOCOL,
  LIVE_SOLUTIONS,
  MATRIX_VERTICALS,
  MATRIX_INDUSTRIES,
  normalizePath,
  isGhost,
  matrixSize,
  goneHtml,
  document,
};
