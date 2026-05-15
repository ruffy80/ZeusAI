// setup-deepseek-autonomous.js
// Script pentru completarea automată a .env cu valorile optime pentru activare DeepSeek AUTONOM, EXECUTIV, la pornirea Unicorn pe server Hetzner.
// Rulează cu: node UNICORN_FINAL/scripts/setup-deepseek-autonomous.js <DEEPSEEK_API_KEY> <ADMIN_TOKEN>

const fs = require('fs');
const path = require('path');

// Caută UNICORN_FINAL/.env sau îl creează dacă nu există
debug('Caut .env în UNICORN_FINAL/')
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, '');

const key = process.argv[2] || '';
const admin = process.argv[3] || '';
if (!key || !admin) {
  console.error('Folosește: node setup-deepseek-autonomous.js <DEEPSEEK_API_KEY> <ADMIN_TOKEN>');
  process.exit(1);
}

// Caut linia și o rescriu, dacă există, altfel o adaug
function patchOrAdd(lines, key, value, comment) {
  const i = lines.findIndex(l => l.startsWith(key+'='));
  const line = value ? `${key}=${value}${comment? ' # '+comment : ''}` : '';
  if (i >= 0) lines[i] = line;
  else if(line) lines.push(line);
}

const config = [
  ['DEEPSEEK_API_KEY', key, '– cheie live automat'],
  ['DEEPSEEK_MODEL', 'deepseek-reasoner','– model logic default'],
  ['DEEPSEEK_LOOP_ENABLED', '1', '– ACTIVAT automat'],
  ['DEEPSEEK_LOOP_EXECUTE', '1', '– EXECUTIE completă'],
  ['DEEPSEEK_LOOP_ADMIN_TOKEN', admin, '– admin token secret'],
  ['DEEPSEEK_LOOP_INTERVAL_MS', '60000', '– la 60s']
];

let lines = fs.readFileSync(envPath,'utf8').split(/\r?\n/).filter(Boolean);
for(const [varName, val, cmt] of config) patchOrAdd(lines, varName, val, cmt);
fs.writeFileSync(envPath, lines.join('\n') + '\n');

console.log('DeepSeek AUTONOM și EXECUTIV configurat în .env!');
console.log('La orice restart/deploy, DeepSeek pornește și lucrează autonom cu toată puterea lui pe Unicorn.');

function debug(){/* no-op for clarity, add if needed */}
