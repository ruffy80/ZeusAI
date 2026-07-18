// =====================================================================
// ZACC — Self-hosted product cover art (SVG).
// Always-on images served from our own origin so CSP/img hotlink never blanks
// the storefront. Deterministic colours from the product slug.
// =====================================================================
'use strict';

const crypto = require('crypto');

function hashHue(slug) {
  const h = crypto.createHash('sha1').update(String(slug || 'product')).digest();
  return h[0] % 360;
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a cinematic SVG cover for a product (640×480).
 */
function renderCoverSvg({ title, category, slug }) {
  const hue = hashHue(slug || title);
  const hue2 = (hue + 42) % 360;
  const label = escapeXml(String(title || 'Zeus Dropship').slice(0, 48));
  const cat = escapeXml(String(category || 'product').toUpperCase().slice(0, 18));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},55%,18%)"/>
      <stop offset="55%" stop-color="hsl(${hue2},48%,12%)"/>
      <stop offset="100%" stop-color="#050710"/>
    </linearGradient>
    <radialGradient id="r" cx="70%" cy="30%" r="55%">
      <stop offset="0%" stop-color="hsla(${hue2},80%,60%,.35)"/>
      <stop offset="100%" stop-color="hsla(${hue2},80%,60%,0)"/>
    </radialGradient>
  </defs>
  <rect width="640" height="480" fill="url(#g)"/>
  <rect width="640" height="480" fill="url(#r)"/>
  <circle cx="520" cy="120" r="90" fill="none" stroke="hsla(${hue},70%,70%,.25)" stroke-width="2"/>
  <circle cx="520" cy="120" r="140" fill="none" stroke="hsla(${hue2},70%,65%,.12)" stroke-width="1"/>
  <text x="40" y="72" fill="hsla(${hue2},80%,75%,.95)" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14" font-weight="700" letter-spacing="3">${cat}</text>
  <text x="40" y="250" fill="#f3f5ff" font-family="ui-sans-serif,system-ui,sans-serif" font-size="34" font-weight="650">${label}</text>
  <text x="40" y="430" fill="#8df4df" font-family="ui-monospace,monospace" font-size="12" letter-spacing="2">ZEUS DROPSHIP OS · AUTO LISTED</text>
</svg>`;
}

function coverPath(slug) {
  const s = String(slug || 'product').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
  return '/api/dropship/cover/' + encodeURIComponent(s) + '.svg';
}

module.exports = { renderCoverSvg, coverPath };
