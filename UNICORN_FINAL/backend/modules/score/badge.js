'use strict';

function badgeSvg(score) {
  const n = Number(score.score_total);
  const label = 'Business Score: ' + n + '/100 | zeusai.pro';
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="48" viewBox="0 0 360 48">'
    + '<rect width="360" height="48" rx="8" fill="#0b0f17" stroke="#8eb6ff"/>'
    + '<text x="16" y="30" fill="#eaf0ff" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16">'
    + label.replace(/[<>&]/g, '')
    + '</text></svg>';
}

function embedCode(base, slug) {
  const url = base + '/score/' + slug;
  return '<a href="' + url + '" target="_blank"><img src="' + url + '/badge.svg" alt="Business Score" /></a>';
}

module.exports = { badgeSvg, embedCode };
