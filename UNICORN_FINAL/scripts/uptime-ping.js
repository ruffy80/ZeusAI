#!/usr/bin/env node
'use strict';

/**
 * Ping the site health URL and write one JSON line to stdout.
 * Optional: append the same line to UPTIME_LOG (absolute path).
 * Does not install a system timer. A human cron example:
 *   * /5 * * * * cd /var/www/unicorn/current && node scripts/uptime-ping.js >> /var/log/zeus-uptime.log
 *
 * HEALTH_URL defaults to http://127.0.0.1:3001/health
 */

const fs = require('fs');
const http = require('http');
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: 8000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: raw.length > 200000 ? raw.slice(0, 200000) : raw });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function main() {
  const url = process.env.HEALTH_URL || 'http://127.0.0.1:3001/health';
  const started = Date.now();
  let line;
  try {
    const res = await get(url);
    let parsed = null;
    try { parsed = JSON.parse(res.body); } catch (_) { parsed = null; }
    line = {
      ts: new Date().toISOString(),
      url,
      http: res.status,
      ms: Date.now() - started,
      ok: res.status === 200 && (!parsed || parsed.ok !== false),
      status: parsed && (parsed.status || parsed.ok),
    };
  } catch (err) {
    line = {
      ts: new Date().toISOString(),
      url,
      http: 0,
      ms: Date.now() - started,
      ok: false,
      error: err && err.message ? err.message : 'ping_failed',
    };
  }
  const text = JSON.stringify(line);
  process.stdout.write(text + '\n');
  const logPath = process.env.UPTIME_LOG;
  if (logPath && pathIsAbsolute(logPath)) {
    fs.appendFileSync(logPath, text + '\n');
  }
  if (!line.ok) process.exitCode = 1;
}

function pathIsAbsolute(p) {
  return typeof p === 'string' && p.startsWith('/');
}

main();
