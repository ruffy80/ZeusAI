'use strict';

const fs = require('fs');
const path = require('path');

function locate() {
  const candidates = [];
  if (process.env.ZEUS_ROOT) {
    candidates.push(path.join(process.env.ZEUS_ROOT, 'backend/modules/orchestrator/index.js'));
  }
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    candidates.push(path.join(dir, 'backend/modules/orchestrator/index.js'));
    dir = path.dirname(dir);
  }
  return candidates.find((file) => fs.existsSync(file)) || null;
}

const file = locate();
if (!file) {
  throw new Error('ZeusAI orchestrator source was not found. This package is not on the public npm registry. Set ZEUS_ROOT to the UNICORN_FINAL directory.');
}

module.exports = require(file);
