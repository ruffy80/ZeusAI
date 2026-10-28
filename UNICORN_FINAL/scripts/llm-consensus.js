'use strict';

/**
 * Ask three configured providers whether one retired facade is redundant.
 * Reads keys from the environment. Does not print secrets.
 * A missing key or a non-200 response is recorded as an error, not a vote.
 *
 *   node scripts/llm-consensus.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = process.env.ZEUS_STATE_DIR
  ? path.join(process.env.ZEUS_STATE_DIR, 'llm-consensus.json')
  : path.join('/opt/zeusai/state', 'llm-consensus.json');

const QUESTION = 'The file unicornOrchestrator.js only re-exports a retired facade. Should this be migrated or is it redundant? Answer ONLY: MIGRATE or REDUNDANT with 1-sentence reason.';

function post(url, headers, body) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const req = https.request({
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      timeout: 20000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8').slice(0, 500);
        resolve({ status: res.statusCode, text });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, text: 'timeout' }); });
    req.on('error', (e) => resolve({ status: 0, text: e.message }));
    req.end(body);
  });
}

function voteOf(text) {
  const upper = String(text || '').toUpperCase();
  if (upper.includes('REDUNDANT') && !upper.includes('MIGRATE')) return 'REDUNDANT';
  if (upper.includes('MIGRATE') && !upper.includes('REDUNDANT')) return 'MIGRATE';
  if (upper.indexOf('REDUNDANT') >= 0 && upper.indexOf('MIGRATE') >= 0) {
    return upper.indexOf('REDUNDANT') < upper.indexOf('MIGRATE') ? 'REDUNDANT' : 'MIGRATE';
  }
  return null;
}

async function main() {
  const calls = [];
  if (process.env.OPENAI_API_KEY) {
    const body = JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: QUESTION }],
      max_tokens: 80,
    });
    calls.push(post('https://api.openai.com/v1/chat/completions', {
      Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    }, body).then((res) => ({ provider: 'openai', ...res })));
  } else calls.push(Promise.resolve({ provider: 'openai', status: 0, text: 'OPENAI_API_KEY missing' }));

  if (process.env.ANTHROPIC_API_KEY) {
    const body = JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 80,
      messages: [{ role: 'user', content: QUESTION }],
    });
    calls.push(post('https://api.anthropic.com/v1/messages', {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }, body).then((res) => ({ provider: 'anthropic', ...res })));
  } else calls.push(Promise.resolve({ provider: 'anthropic', status: 0, text: 'ANTHROPIC_API_KEY missing' }));

  if (process.env.DEEPSEEK_API_KEY) {
    const body = JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [{ role: 'user', content: QUESTION }],
      max_tokens: 80,
    });
    calls.push(post('https://api.deepseek.com/chat/completions', {
      Authorization: 'Bearer ' + process.env.DEEPSEEK_API_KEY,
      'Content-Type': 'application/json',
    }, body).then((res) => ({ provider: 'deepseek', ...res })));
  } else calls.push(Promise.resolve({ provider: 'deepseek', status: 0, text: 'DEEPSEEK_API_KEY missing' }));

  const results = await Promise.all(calls);
  const votes = results.map((row) => ({
    provider: row.provider,
    status: row.status,
    vote: row.status === 200 ? voteOf(row.text) : null,
    error: row.status === 200 ? null : String(row.text).slice(0, 180),
  }));
  const tally = { MIGRATE: 0, REDUNDANT: 0 };
  for (const row of votes) if (row.vote) tally[row.vote] += 1;
  let decision = 'NO_DECISION';
  if (tally.MIGRATE >= 2) decision = 'MIGRATE';
  else if (tally.REDUNDANT >= 2) decision = 'REDUNDANT';
  const report = {
    at: new Date().toISOString(),
    subject: 'unicornOrchestrator.js',
    decision,
    deleted: false,
    reason: decision === 'NO_DECISION'
      ? 'No 2/3 vote. The file stays.'
      : 'Vote recorded. The file stays until a 24h shadow with identical fingerprints.',
    tally,
    votes,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ decision, tally, statuses: votes.map((v) => v.provider + ':' + v.status) }));
}

main().catch((e) => {
  console.error(e && e.message);
  process.exit(1);
});
