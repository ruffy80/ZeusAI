const { execFileSync } = require('child_process');
const path = require('path');

console.warn('[DEPRECATED] `generate_unicorn_final_clean.js` now delegates to `generate_unicorn_final.js`. Use `node generate_unicorn_final.js`.');
execFileSync(process.execPath, [path.join(__dirname, 'generate_unicorn_final.js')], { stdio: 'inherit' });
