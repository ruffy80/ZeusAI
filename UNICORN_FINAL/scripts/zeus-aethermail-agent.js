#!/usr/bin/env node
// =====================================================================
// zeus-aethermail-agent.js — permanent AetherMail Continuum poller (AMC/1.0)
//
// Owns IMAP poll + Reply Gravity + deferred SMTP arming flush.
// Safe to run without SMTP_PASS: queues replies, notifies owner via Telegram.
// When SMTP_PASS (or Resend/Brevo) appears in env, next tick flushes the queue.
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
process.chdir(ROOT);

const SHARED_ENV = process.env.UNICORN_SHARED_ENV || '/var/www/unicorn/shared/.env';
const SECRETS_ENV = process.env.ZEUS_TG_SECRETS_ENV || '/etc/zeusai/secrets/telegram.env';

function log(msg) { process.stdout.write(`[aethermail] ${msg}\n`); }

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!raw || raw[0] === '#') continue;
    const i = raw.indexOf('=');
    if (i <= 0) continue;
    const k = raw.slice(0, i).trim();
    if (/PRIVATE_KEY|BEGIN OPENSSH|BEGIN RSA/i.test(k) || /BEGIN OPENSSH|BEGIN RSA/.test(raw)) continue;
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) continue;
    out[k] = raw.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function hydrateEnv() {
  const merged = { ...readEnvFile(SECRETS_ENV), ...readEnvFile(SHARED_ENV) };
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
  }
}

hydrateEnv();

const amc = require('../backend/modules/aethermail-continuum-os');

async function main() {
  const started = amc.start({ force: true });
  log(`start ${JSON.stringify(started)}`);
  const st = amc.getStatus();
  log(`smtpArmed=${st.smtpArmed} imapArmed=${st.imapArmed} waiting=${(st.waitingFor || []).join(' | ') || 'none'}`);
  if (!st.imapArmed) {
    log('IMAP unarmed — add SMTP_PASS (Yahoo app password) or IMAP_PASS; agent keeps running and will arm automatically');
  }
  let wasArmed = amc.smtpArmed();
  // Re-hydrate env so SMTP_PASS added later is picked up without PM2 restart
  setInterval(() => {
    hydrateEnv();
    const armed = amc.smtpArmed();
    if (armed && !wasArmed) {
      log('SMTP armed — flushing deferred queue + polling inbox');
      amc.flushQueue().then((r) => log(`flush ${JSON.stringify(r)}`)).catch(() => {});
      amc.tick().then((r) => log(`tick ${JSON.stringify({ ok: r.ok, reason: r.reason, n: r.processed })}`)).catch(() => {});
    }
    wasArmed = armed;
  }, 30_000);
}

process.on('SIGTERM', () => { amc.stop(); process.exit(0); });
process.on('SIGINT', () => { amc.stop(); process.exit(0); });

if (require.main === module) {
  main().catch((e) => {
    log(`fatal: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
  });
}

module.exports = { hydrateEnv };
