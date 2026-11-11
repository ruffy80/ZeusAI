'use strict';

const fs = require('fs');
const path = require('path');

function cardSvg(score, base) {
  const bars = ['reachability', 'title', 'description', 'heading', 'speed'].map((name, i) => {
    const value = Number(score.sub_scores && score.sub_scores[name]) || 0;
    const w = Math.max(0, Math.min(20, value)) * 12;
    const y = 150 + (i * 36);
    return '<text x="48" y="' + (y - 8) + '" fill="#9fb0d0" font-size="16" font-family="ui-sans-serif,sans-serif">' + name + '</text>'
      + '<rect x="180" y="' + (y - 22) + '" width="' + w + '" height="16" fill="#8eb6ff"/>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">'
    + '<rect width="1200" height="630" fill="#0b0f17"/>'
    + '<text x="64" y="120" fill="#eaf0ff" font-size="42" font-family="ui-sans-serif,sans-serif">' + String(score.domain).replace(/[<>&]/g, '') + '</text>'
    + '<text x="64" y="230" fill="#ffffff" font-size="120" font-family="ui-sans-serif,sans-serif">' + Number(score.score_total) + '/100</text>'
    + bars
    + '<text x="64" y="560" fill="#8eb6ff" font-size="28" font-family="ui-sans-serif,sans-serif">' + String(base).replace(/[<>&]/g, '') + '/score/' + score.public_slug + '</text>'
    + '</svg>';
}

async function writePng(score, base) {
  const dir = process.env.SCORE_OG_DIR || path.join(process.env.SNM_STATE_DIR || '/opt/zeusai/state', 'score-og');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, score.public_slug + '.png');
  let sharp = null;
  try { sharp = require('sharp'); } catch (err) {
    console.warn('[score] sharp is not installed. OG PNG was not written:', err && err.message);
    return { ok: false, error: 'sharp_missing', file: null };
  }
  await sharp(Buffer.from(cardSvg(score, base))).png().toFile(file);
  return { ok: true, file, url: '/score/' + score.public_slug + '/og.png' };
}

function readPng(slug) {
  const dir = process.env.SCORE_OG_DIR || path.join(process.env.SNM_STATE_DIR || '/opt/zeusai/state', 'score-og');
  const file = path.join(dir, String(slug || '') + '.png');
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

module.exports = { cardSvg, writePng, readPng };
