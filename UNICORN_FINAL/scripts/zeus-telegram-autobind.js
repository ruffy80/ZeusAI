#!/usr/bin/env node
// =====================================================================
// zeus-telegram-autobind.js
//
// Durable Telegram chat binder for ZeusAI. Long-polls Bot API getUpdates
// and, when @ZEUSAIIBOT is added to a channel/group with post rights OR
// someone sends /start|/bind|/chatid, upserts TELEGRAM_CHAT_ID (and
// aliases) into the live shared .env + /etc/zeusai/secrets/telegram.env,
// then soft-reloads unicorn-backend so outbound publishers start posting.
//
// Bots cannot self-join channels — a human admin must add the bot once.
// This process removes every other manual step after that.
//
// Env:
//   TELEGRAM_BOT_TOKEN / TG_BOT_TOKEN / ZAC_TELEGRAM_TOKEN
//   UNICORN_SHARED_ENV   (default /var/www/unicorn/shared/.env)
//   ZEUS_TG_SECRETS_ENV  (default /etc/zeusai/secrets/telegram.env)
//   ZEUS_TG_STATUS_FILE  (default <shared>/data/telegram/bind-status.json)
//   ZEUS_TG_PREFERRED_CHAT  (optional username without @, e.g. unicorn_platform)
//   ZEUS_TG_RELOAD_PM2=1 (default) — pm2 restart unicorn-backend --update-env
//   ZEUS_TG_POLL_TIMEOUT=25
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SHARED_ENV = process.env.UNICORN_SHARED_ENV || '/var/www/unicorn/shared/.env';
const SECRETS_ENV = process.env.ZEUS_TG_SECRETS_ENV || '/etc/zeusai/secrets/telegram.env';
const STATUS_FILE = process.env.ZEUS_TG_STATUS_FILE
  || path.join(path.dirname(SHARED_ENV), 'data', 'telegram', 'bind-status.json');
const PREFERRED = String(process.env.ZEUS_TG_PREFERRED_CHAT || 'unicorn_platform')
  .replace(/^@/, '').toLowerCase();
const POLL_TIMEOUT = Math.max(5, Number(process.env.ZEUS_TG_POLL_TIMEOUT) || 25);
const RELOAD_PM2 = String(process.env.ZEUS_TG_RELOAD_PM2 || '1') !== '0';
const OFFSET_FILE = path.join(path.dirname(STATUS_FILE), 'updates-offset.json');

function log(msg) {
  process.stdout.write(`[tg-autobind] ${msg}\n`);
}

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const ln = raw.trim();
    if (!ln || ln.startsWith('#')) continue;
    const i = ln.indexOf('=');
    if (i <= 0) continue;
    out[ln.slice(0, i).trim()] = ln.slice(i + 1).trim();
  }
  return out;
}

function upsertEnv(file, pairs) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let lines = [];
  if (fs.existsSync(file)) {
    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  }
  const seen = new Set();
  const next = lines.map((ln) => {
    const i = ln.indexOf('=');
    if (i <= 0) return ln;
    const k = ln.slice(0, i).trim();
    if (!Object.prototype.hasOwnProperty.call(pairs, k)) return ln;
    seen.add(k);
    return `${k}=${pairs[k]}`;
  });
  for (const [k, v] of Object.entries(pairs)) {
    if (!seen.has(k)) next.push(`${k}=${v}`);
  }
  const body = next.filter((l, idx, arr) => !(l === '' && arr[idx - 1] === '')).join('\n');
  fs.writeFileSync(file, body.endsWith('\n') ? body : `${body}\n`, { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch (_) { /* ignore */ }
}

function resolveToken() {
  const env = { ...readEnvFile(SHARED_ENV), ...process.env };
  return env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || env.ZAC_TELEGRAM_TOKEN || '';
}

function writeStatus(patch) {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  let cur = {};
  try { cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch (_) { /* ignore */ }
  const next = {
    ...cur,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATUS_FILE, `${JSON.stringify(next, null, 2)}\n`);
}

function loadOffset() {
  try {
    const j = JSON.parse(fs.readFileSync(OFFSET_FILE, 'utf8'));
    return Number(j.offset) || 0;
  } catch (_) {
    return 0;
  }
}

function saveOffset(offset) {
  fs.mkdirSync(path.dirname(OFFSET_FILE), { recursive: true });
  fs.writeFileSync(OFFSET_FILE, `${JSON.stringify({ offset }, null, 2)}\n`);
}

async function tg(token, method, body) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`;
  const init = body == null
    ? { method: 'GET' }
    : {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    };
  const r = await fetch(url, init);
  const data = await r.json().catch(() => ({}));
  return data;
}

function chatRank(chat) {
  if (!chat || chat.id == null) return -1;
  const uname = String(chat.username || '').toLowerCase();
  if (PREFERRED && uname === PREFERRED) return 100;
  if (chat.type === 'channel') return 80;
  if (chat.type === 'supergroup' || chat.type === 'group') return 60;
  if (chat.type === 'private') return 20;
  return 0;
}

function formatChatRef(chat) {
  if (!chat || chat.id == null) return '';
  if (chat.username) return `@${chat.username}`;
  return String(chat.id);
}

function canPostFromMember(member) {
  if (!member) return false;
  const st = member.status;
  if (st === 'creator') return true;
  if (st === 'administrator') {
    // Channels require can_post_messages; groups treat admin as writable.
    if (Object.prototype.hasOwnProperty.call(member, 'can_post_messages')) {
      return member.can_post_messages === true;
    }
    return true;
  }
  return false;
}

/** Prefer admin/channel binds; private only via explicit /bind|/start|/chatid. */
function extractBindCandidate(update) {
  const mcm = update.my_chat_member;
  if (mcm && mcm.chat) {
    const neu = mcm.new_chat_member || {};
    if (canPostFromMember(neu) && (mcm.chat.type === 'channel' || mcm.chat.type === 'supergroup' || mcm.chat.type === 'group')) {
      return {
        chat: mcm.chat,
        reason: `my_chat_member:${neu.status}`,
        prefer: true,
      };
    }
  }

  const post = update.channel_post;
  if (post && post.chat && post.chat.type === 'channel') {
    return { chat: post.chat, reason: 'channel_post', prefer: true };
  }

  const msg = update.message;
  if (msg && msg.chat && typeof msg.text === 'string') {
    const text = msg.text.trim();
    const cmd = text.split(/\s+/)[0].toLowerCase().split('@')[0];
    if (cmd === '/start' || cmd === '/bind' || cmd === '/chatid') {
      return {
        chat: msg.chat,
        reason: `command:${cmd}`,
        prefer: msg.chat.type !== 'private',
        replyCommand: true,
        messageId: msg.message_id,
      };
    }
  }
  return null;
}

async function probeWritable(token, chatRef) {
  const r = await tg(token, 'sendChatAction', { chat_id: chatRef, action: 'typing' });
  if (r && r.ok) return { ok: true };
  return { ok: false, description: (r && r.description) || 'probe_failed' };
}

function reloadBackend() {
  if (!RELOAD_PM2) return { ok: false, skipped: true };
  const r = spawnSync('pm2', ['restart', 'unicorn-backend', '--update-env'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: process.env.HOME || '/root', PM2_HOME: process.env.PM2_HOME || '/root/.pm2' },
  });
  return { ok: r.status === 0, status: r.status, stderr: (r.stderr || '').slice(0, 200) };
}

async function applyBind(token, chat, reason) {
  const chatRef = formatChatRef(chat);
  const probe = await probeWritable(token, chat.id);
  if (!probe.ok) {
    log(`skip bind ${chatRef}: not writable (${probe.description})`);
    writeStatus({
      waiting: true,
      lastAttempt: { chatRef, chatId: chat.id, reason, error: probe.description, at: new Date().toISOString() },
    });
    return { ok: false, reason: 'not_writable', description: probe.description };
  }

  // Prefer numeric id so username renames don't break posting.
  const pairs = {
    TELEGRAM_CHAT_ID: String(chat.id),
    TG_CHAT_ID: String(chat.id),
    ZAC_TELEGRAM_CHAT_ID: String(chat.id),
    TELEGRAM_CHAT_REF: chatRef,
  };
  const tok = resolveToken();
  const secretPairs = { ...pairs };
  if (tok) {
    secretPairs.TELEGRAM_BOT_TOKEN = tok;
    secretPairs.TG_BOT_TOKEN = tok;
    secretPairs.ZAC_TELEGRAM_TOKEN = tok;
  }

  upsertEnv(SHARED_ENV, pairs);
  upsertEnv(SECRETS_ENV, secretPairs);

  const reload = reloadBackend();
  writeStatus({
    waiting: false,
    bound: true,
    chatId: chat.id,
    chatRef,
    username: chat.username || null,
    title: chat.title || chat.first_name || null,
    type: chat.type,
    reason,
    reload,
  });

  await tg(token, 'sendMessage', {
    chat_id: chat.id,
    text: [
      '✅ ZeusAI Telegram bound.',
      `chat_id: ${chat.id}`,
      chat.username ? `username: @${chat.username}` : null,
      'Outbound alerts + marketing can post here now.',
    ].filter(Boolean).join('\n'),
  });

  log(`bound ${chatRef} (${chat.id}) via ${reason}; reload=${JSON.stringify(reload)}`);
  return { ok: true, chatId: chat.id, chatRef };
}

async function replyChatId(token, chat, messageId) {
  await tg(token, 'sendMessage', {
    chat_id: chat.id,
    reply_to_message_id: messageId,
    text: [
      `chat_id: ${chat.id}`,
      chat.username ? `username: @${chat.username}` : null,
      `type: ${chat.type}`,
      '',
      'To bind ZeusAI outbound to a CHANNEL:',
      '1) Open the channel → Administrators → Add Admin',
      '2) Add @ZEUSAIIBOT with "Post Messages"',
      '3) Autobind will capture it within ~30s',
      '',
      'Or send /bind here to use THIS chat as the destination.',
    ].filter(Boolean).join('\n'),
  });
}

async function bootstrapPreferred(token) {
  if (!PREFERRED) return;
  const ref = `@${PREFERRED}`;
  const chat = await tg(token, 'getChat', { chat_id: ref });
  if (!chat.ok) {
    writeStatus({
      waiting: true,
      preferred: PREFERRED,
      preferredExists: false,
      hint: `Preferred @${PREFERRED} not found or inaccessible. Add @ZEUSAIIBOT as channel admin, or /bind in a private chat.`,
    });
    return;
  }
  const probe = await probeWritable(token, chat.result.id);
  writeStatus({
    waiting: !probe.ok,
    preferred: PREFERRED,
    preferredExists: true,
    preferredChatId: chat.result.id,
    preferredWritable: probe.ok,
    hint: probe.ok
      ? null
      : `Add @ZEUSAIIBOT as admin of @${PREFERRED} with Post Messages. Autobind is watching.`,
  });
  if (probe.ok) {
    await applyBind(token, chat.result, 'bootstrap_preferred');
  }
}

async function loop() {
  const token = resolveToken();
  if (!token) {
    log('no TELEGRAM_BOT_TOKEN — sleeping 60s');
    writeStatus({ waiting: true, error: 'no_token' });
    setTimeout(loop, 60_000);
    return;
  }

  const me = await tg(token, 'getMe');
  if (!me.ok) {
    log(`getMe failed: ${me.description || 'unknown'}`);
    writeStatus({ waiting: true, error: me.description || 'getMe_failed' });
    setTimeout(loop, 30_000);
    return;
  }
  log(`bot @${me.result.username} id=${me.result.id}; preferred=@${PREFERRED || '(none)'}`);
  await bootstrapPreferred(token);

  let offset = loadOffset();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const data = await tg(token, 'getUpdates', {
        offset,
        timeout: POLL_TIMEOUT,
        allowed_updates: ['message', 'channel_post', 'my_chat_member'],
      });
      if (!data.ok) {
        log(`getUpdates error: ${data.description || data.error_code}`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const update of data.result || []) {
        offset = update.update_id + 1;
        saveOffset(offset);
        const cand = extractBindCandidate(update);
        if (!cand) continue;

        if (cand.replyCommand && cand.chat.type === 'private') {
          const text = String((update.message && update.message.text) || '');
          const cmd = text.trim().split(/\s+/)[0].toLowerCase().split('@')[0];
          if (cmd === '/chatid' || cmd === '/start') {
            await replyChatId(token, cand.chat, cand.messageId);
          }
          if (cmd === '/bind' || cmd === '/start') {
            // Private bind only on explicit /bind, or /start with payload "bind"
            const payload = text.trim().split(/\s+/).slice(1).join(' ').toLowerCase();
            if (cmd === '/bind' || payload === 'bind' || payload.startsWith('bind')) {
              await applyBind(token, cand.chat, cand.reason);
            }
          }
          continue;
        }

        if (cand.prefer) {
          await applyBind(token, cand.chat, cand.reason);
        }
      }
    } catch (e) {
      log(`loop error: ${e && e.message ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Exported for unit tests
module.exports = {
  extractBindCandidate,
  canPostFromMember,
  chatRank,
  formatChatRef,
  upsertEnv,
  readEnvFile,
};

if (require.main === module) {
  loop().catch((e) => {
    log(`fatal: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
  });
}
