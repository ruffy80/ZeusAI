// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-13T19:30:29.406Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// crash-notifier.js — Lightweight error alerting via webhook/email.
//
// Hooks into process-level uncaughtException and unhandledRejection events
// and sends a throttled notification to the configured CRASH_WEBHOOK_URL
// (Discord, Slack, or any endpoint accepting JSON POST).
//
// Fallback: if SMTP is configured, sends an email to ADMIN_EMAIL.
// Throttle: max 1 alert per 5 minutes per unique error message to avoid spam.
//
// Env vars:
//   CRASH_WEBHOOK_URL   — Discord/Slack webhook URL (preferred)
//   ADMIN_EMAIL         — fallback email recipient
//   CRASH_NOTIFY_DISABLED=1 — disable this module entirely

const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_HISTORY = 50;

const _state = {
  name: 'crash-notifier',
  enabled: false,
  notificationsSent: 0,
  throttled: 0,
  lastErrors: [],
  recentHashes: new Map(),
};

function _hash(msg) {
  return String(msg || '').slice(0, 120);
}

function _isThrottled(msg) {
  const key = _hash(msg);
  const last = _state.recentHashes.get(key);
  if (last && (Date.now() - last) < THROTTLE_MS) {
    _state.throttled++;
    return true;
  }
  _state.recentHashes.set(key, Date.now());
  if (_state.recentHashes.size > MAX_HISTORY) {
    const first = _state.recentHashes.keys().next().value;
    _state.recentHashes.delete(first);
  }
  return false;
}

function _record(type, message, stack) {
  _state.lastErrors.unshift({ type, message, ts: new Date().toISOString(), stack: (stack || '').slice(0, 500) });
  if (_state.lastErrors.length > MAX_HISTORY) _state.lastErrors.length = MAX_HISTORY;
}

async function _sendWebhook(type, message, stack) {
  const url = process.env.CRASH_WEBHOOK_URL;
  if (!url) return false;

  const hostname = require('os').hostname();
  const payload = {
    content: `🚨 **[${type}]** on \`${hostname}\` (pid ${process.pid})\n\`\`\`\n${message}\n${(stack || '').split('\n').slice(0, 5).join('\n')}\n\`\`\``,
    username: 'ZeusAI Crash Alert',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function _sendEmail(type, message, stack) {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return false;

  // Try to use the existing transactional-email module if available
  try {
    const mailer = require('../../src/commerce/transactional-email');
    if (mailer && typeof mailer.send === 'function') {
      await mailer.send({
        to: email,
        subject: `[ZeusAI CRASH] ${type}: ${message.slice(0, 80)}`,
        text: `${type} at ${new Date().toISOString()}\n\n${message}\n\nStack:\n${stack || 'N/A'}`,
      });
      return true;
    }
  } catch (_) { /* mailer not available */ }
  return false;
}

async function notify(type, message, stack) {
  if (process.env.CRASH_NOTIFY_DISABLED === '1') return;
  if (!_state.enabled) return;
  if (_isThrottled(message)) return;

  _record(type, message, stack);

  const sent = await _sendWebhook(type, message, stack);
  if (!sent) await _sendEmail(type, message, stack);
  if (sent) _state.notificationsSent++;
}

function start() {
  if (process.env.CRASH_NOTIFY_DISABLED === '1') return;
  if (!process.env.CRASH_WEBHOOK_URL && !process.env.ADMIN_EMAIL) {
    console.log('[crash-notifier] No CRASH_WEBHOOK_URL or ADMIN_EMAIL configured — disabled');
    return;
  }

  _state.enabled = true;

  process.on('uncaughtException', (err) => {
    const msg = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? err.stack : '';
    notify('uncaughtException', msg, stack).catch(() => {});
  });

  process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : '';
    notify('unhandledRejection', msg, stack).catch(() => {});
  });

  console.log('[crash-notifier] Active — alerts via', process.env.CRASH_WEBHOOK_URL ? 'webhook' : 'email');
}

function getStatus() {
  return {
    name: _state.name,
    enabled: _state.enabled,
    notificationsSent: _state.notificationsSent,
    throttled: _state.throttled,
    recentErrors: _state.lastErrors.slice(0, 5),
    target: process.env.CRASH_WEBHOOK_URL ? 'webhook' : (process.env.ADMIN_EMAIL ? 'email' : 'none'),
  };
}

module.exports = { start, notify, getStatus };
