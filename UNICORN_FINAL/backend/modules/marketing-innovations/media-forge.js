// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/media-forge.js
//
// Pure-SVG generator for OG / social cards. No native dependencies;
// returns SVG markup that can be served directly (browsers and most
// scrapers render SVG natively). Caches by content hash on disk
// (data/marketing/og-cache/<hash>.svg).
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const CACHE_DIR = process.env.MARKETING_OG_CACHE
  || path.join(DATA_DIR, 'og-cache');

const DISABLED = process.env.MARKETING_MEDIA_FORGE_DISABLED === '1';

function _ensure() { try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (_) {} }

function _escape(s) {
  return String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]);
}

function _wrap(text, perLine, maxLines) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= perLine) cur = (cur + ' ' + w).trim();
    else { if (cur) lines.push(cur); cur = w; if (lines.length >= maxLines) break; }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}

/**
 * Build an OG card SVG.
 *  opts = { title, subtitle?, brand?, cta?, width?, height?, theme? }
 */
function buildOgCard(opts) {
  const o = opts || {};
  const w = Math.max(600, Math.min(2400, Number(o.width) || 1200));
  const h = Math.max(315, Math.min(1260, Number(o.height) || 630));
  const theme = (o.theme || 'unicorn').toLowerCase();
  const palette = theme === 'dark'
    ? { bg1: '#0b0b1a', bg2: '#1a1a3a', fg: '#ffffff', accent: '#ff5dff' }
    : theme === 'light'
      ? { bg1: '#fdfcff', bg2: '#e8e3ff', fg: '#1a1a2a', accent: '#7c3aed' }
      : { bg1: '#1a0033', bg2: '#7c3aed', fg: '#ffffff', accent: '#ffd700' };

  const titleLines = _wrap(o.title || 'Unicorn', Math.floor(w / 32), 3);
  const subLines = _wrap(o.subtitle || '', Math.floor(w / 24), 2);
  const brand = _escape(o.brand || 'unicorn.app');
  const cta = _escape(o.cta || '');

  const titleY = Math.floor(h * 0.3);
  const subY = titleY + titleLines.length * 64 + 32;
  const fontSize = Math.floor(h / 9);
  const subSize = Math.floor(fontSize * 0.55);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bg1}"/>
      <stop offset="100%" stop-color="${palette.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="${palette.fg}">
    ${titleLines.map((l, i) => `<text x="60" y="${titleY + i * (fontSize + 8)}" font-size="${fontSize}" font-weight="800">${_escape(l)}</text>`).join('\n    ')}
    ${subLines.map((l, i) => `<text x="60" y="${subY + i * (subSize + 6)}" font-size="${subSize}" opacity="0.85">${_escape(l)}</text>`).join('\n    ')}
    <text x="60" y="${h - 60}" font-size="${Math.floor(subSize * 0.8)}" opacity="0.7">${brand}</text>
    ${cta ? `<text x="${w - 60}" y="${h - 60}" text-anchor="end" font-size="${Math.floor(subSize * 0.9)}" fill="${palette.accent}" font-weight="700">${cta} →</text>` : ''}
    <circle cx="${w - 80}" cy="80" r="32" fill="${palette.accent}" opacity="0.85"/>
  </g>
</svg>`;
  return svg;
}

function buildAndCache(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const svg = buildOgCard(opts || {});
  const hash = crypto.createHash('sha256').update(svg).digest('hex').slice(0, 16);
  _ensure();
  const file = path.join(CACHE_DIR, hash + '.svg');
  try { if (!fs.existsSync(file)) fs.writeFileSync(file, svg); } catch (_) {}
  return { ok: true, hash, file, bytes: svg.length, svg };
}

function loadCached(hash) {
  try {
    const file = path.join(CACHE_DIR, String(hash || '').replace(/[^a-f0-9]/g, '') + '.svg');
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf8');
  } catch (_) { return null; }
}

function status() {
  let count = 0;
  try { count = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.svg')).length; } catch (_) {}
  return { disabled: DISABLED, cacheDir: CACHE_DIR, cached: count };
}

module.exports = { buildOgCard, buildAndCache, loadCached, status };
