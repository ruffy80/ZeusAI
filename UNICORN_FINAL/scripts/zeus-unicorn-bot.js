#!/usr/bin/env node
// =====================================================================
// zeus-unicorn-bot.js — permanent ZeusAI Growth Mission-Control bot
//
// Owns Telegram long-poll (single consumer), owner commands, chat bind,
// the Causal Virality Reflex (growthCausalitySentinel), and the
// Telegram Profit Group OS (autonomous community → site profit loop).
//
// Commands (owner allowlist or ZEUS_TG_ALLOW_PRIVATE_BIND=1):
//   /start /help  — command card
//   /pulse /boost /status /catalog /silence /resume /bind /bindgroup /chatid
//   Group: /value /profit /invite /lead /cta
//
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ZEUS_TG_GROUP_CHAT_ID, ZEUS_TG_OWNER_CHAT_IDS
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
process.chdir(ROOT);

const SHARED_ENV = process.env.UNICORN_SHARED_ENV || '/var/www/unicorn/shared/.env';
const SECRETS_ENV = process.env.ZEUS_TG_SECRETS_ENV || '/etc/zeusai/secrets/telegram.env';
const STATUS_FILE = process.env.ZEUS_TG_STATUS_FILE
  || path.join(path.dirname(SHARED_ENV), 'data', 'telegram', 'bind-status.json');
const OFFSET_FILE = path.join(path.dirname(STATUS_FILE), 'unicorn-bot-offset.json');
const POLL_TIMEOUT = Math.max(5, Number(process.env.ZEUS_TG_POLL_TIMEOUT) || 25);

function log(msg) { process.stdout.write(`[unicorn-bot] ${msg}\n`); }

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!raw || raw[0] === '#') continue;
    const i = raw.indexOf('=');
    if (i <= 0) continue;
    const k = raw.slice(0, i).trim();
    // Skip broken multi-line SSH private keys that poison dotenv-style parsers
    if (/PRIVATE_KEY|BEGIN OPENSSH|BEGIN RSA/i.test(k) || /BEGIN OPENSSH|BEGIN RSA/.test(raw)) continue;
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) continue;
    out[k] = raw.slice(i + 1).trim();
  }
  return out;
}

function hydrateEnv() {
  const merged = { ...readEnvFile(SECRETS_ENV), ...readEnvFile(SHARED_ENV) };
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
  }
}

function upsertEnv(file, pairs) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
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
  fs.writeFileSync(file, `${next.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')}\n`, { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch (_) { /* ignore */ }
}

hydrateEnv();

const cvr = require('../backend/modules/growthCausalitySentinel');
const groupOs = require('../backend/modules/telegram-profit-group-os');

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || process.env.ZAC_TELEGRAM_TOKEN || '';
}

function ownerIds() {
  return new Set(
    String(process.env.ZEUS_TG_OWNER_CHAT_IDS || process.env.TELEGRAM_OWNER_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isOwner(chat) {
  if (!chat) return false;
  if (String(process.env.ZEUS_TG_ALLOW_PRIVATE_BIND || '') === '1') return true;
  const ids = ownerIds();
  if (ids.size === 0) return false;
  return ids.has(String(chat.id));
}

async function tg(method, body) {
  const tok = token();
  if (!tok) return { ok: false, description: 'no_token' };
  const url = `https://api.telegram.org/bot${encodeURIComponent(tok)}/${method}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return r.json().catch(() => ({ ok: false }));
}

async function reply(chatId, text, replyTo) {
  const payload = { chat_id: chatId, text: String(text).slice(0, 3900), disable_web_page_preview: false };
  if (replyTo) payload.reply_to_message_id = replyTo;
  return tg('sendMessage', payload);
}

function writeBindStatus(patch) {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  let cur = {};
  try { cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch (_) { /* ignore */ }
  fs.writeFileSync(STATUS_FILE, `${JSON.stringify({ ...cur, ...patch, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

async function applyBind(chat) {
  const pairs = {
    TELEGRAM_CHAT_ID: String(chat.id),
    TG_CHAT_ID: String(chat.id),
    ZAC_TELEGRAM_CHAT_ID: String(chat.id),
    ZEUS_TG_OWNER_CHAT_IDS: String(chat.id),
  };
  upsertEnv(SHARED_ENV, pairs);
  const tok = token();
  const secretPairs = { ...pairs };
  if (tok) {
    secretPairs.TELEGRAM_BOT_TOKEN = tok;
    secretPairs.TG_BOT_TOKEN = tok;
    secretPairs.ZAC_TELEGRAM_TOKEN = tok;
  }
  upsertEnv(SECRETS_ENV, secretPairs);
  for (const [k, v] of Object.entries(pairs)) process.env[k] = v;
  writeBindStatus({
    waiting: false,
    bound: true,
    chatId: chat.id,
    type: chat.type,
    reason: 'unicorn_bot_bind',
  });
  spawnSync('pm2', ['restart', 'unicorn-backend', '--update-env'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: process.env.HOME || '/root', PM2_HOME: process.env.PM2_HOME || '/root/.pm2' },
  });
  await reply(chat.id, `✅ Bound ZeusAI outbound to chat_id ${chat.id}. CVR armed.`);
  return { ok: true, chatId: chat.id };
}

/** Bind a group/channel as the PROFIT rail without overwriting owner alert chat. */
async function applyGroupBind(chat) {
  const pairs = {
    ZEUS_TG_GROUP_CHAT_ID: String(chat.id),
    TELEGRAM_GROUP_CHAT_ID: String(chat.id),
  };
  if (chat.username) pairs.ZEUS_TG_GROUP_REF = `@${chat.username}`;
  upsertEnv(SHARED_ENV, pairs);
  upsertEnv(SECRETS_ENV, pairs);
  for (const [k, v] of Object.entries(pairs)) process.env[k] = v;
  groupOs.bindGroupChat(chat);
  writeBindStatus({
    groupBound: true,
    groupChatId: chat.id,
    groupRef: chat.username ? `@${chat.username}` : String(chat.id),
    groupType: chat.type,
    groupTitle: chat.title || null,
    groupBoundAt: new Date().toISOString(),
  });
  spawnSync('pm2', ['restart', 'unicorn-backend', '--update-env'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: process.env.HOME || '/root', PM2_HOME: process.env.PM2_HOME || '/root/.pm2' },
  });
  await reply(chat.id, [
    '🚀 Profit Group rail bound.',
    `group_chat_id: ${chat.id}`,
    'TPG/1.0 armed — welcome · value calendar · profit gravity · tracked CTAs.',
    'Try /value · /profit · /invite',
  ].join('\n'));
  try { await groupOs.postValue(true); } catch (_) { /* ignore */ }
  return { ok: true, groupChatId: chat.id };
}


async function handleCommand(msg) {
  const chat = msg.chat;
  const text = String(msg.text || '').trim();
  const cmd = text.split(/\s+/)[0].toLowerCase().split('@')[0];
  const mid = msg.message_id;

  if (cmd === '/chatid') {
    await reply(chat.id, `chat_id: ${chat.id}\ntype: ${chat.type}`, mid);
    return;
  }

  if (cmd === '/start' || cmd === '/help') {
    await reply(chat.id, [
      '🦄 ZeusAI Unicorn Bot — CVR + Telegram Profit Group OS',
      '',
      'I run two autonomous engines:',
      '1) Causal Virality Reflex — multi-rail posts when funnel hunger clears the noise floor',
      '2) Profit Group OS — welcome, daily value, tracked CTAs, leads, invite gravity',
      '',
      'Owner: /pulse /boost /channels /catalog /silence /resume /status /bind /bindgroup',
      'Group: /value /profit /invite /lead you@email.com /cta',
      '',
      'Site: https://zeusai.pro · Group status: https://zeusai.pro/tg',
    ].join('\n'), mid);
    return;
  }

  // Public group commands (no owner gate)
  if (['/value', '/drop', '/profit', '/group', '/invite', '/lead', '/cta'].includes(cmd)) {
    await groupOs.handleCommand(msg);
    return;
  }

  if (cmd === '/bind') {
    if (!isOwner(chat) && chat.type === 'private') {
      await reply(chat.id, 'Private /bind denied. Set ZEUS_TG_OWNER_CHAT_IDS or add me as channel admin.', mid);
      return;
    }
    await applyBind(chat);
    return;
  }

  if (cmd === '/bindgroup') {
    if (chat.type === 'private') {
      await reply(chat.id, 'Run /bindgroup inside the target group/channel (bot must be admin).', mid);
      return;
    }
    await applyGroupBind(chat);
    return;
  }

  // Owner-gated ops commands
  if (!isOwner(chat) && chat.type === 'private') {
    await reply(chat.id, 'Owner commands only. Ask the operator to allowlist your chat_id.', mid);
    return;
  }

  if (cmd === '/pulse') {
    const st = await cvr.process({ action: 'pulse' });
    await reply(chat.id, st.text || cvr.formatPulse(), mid);
    return;
  }
  if (cmd === '/status') {
    const st = cvr.getStatus();
    await reply(chat.id, `\`\`\`\n${JSON.stringify({
      cycles: st.cycles,
      postsToday: st.postsToday,
      cadenceMs: st.cadenceMs,
      silenced: st.silenced,
      pending: st.pending,
      last: st.lastCycle,
      snap: st.snapshot,
    }, null, 2).slice(0, 3500)}\n\`\`\``, mid);
    return;
  }
  if (cmd === '/silence') {
    cvr.setSilenced(true);
    groupOs.setSilenced(true);
    await reply(chat.id, '⏸ CVR + Profit Group silenced. /resume to arm.', mid);
    return;
  }
  if (cmd === '/resume') {
    cvr.setSilenced(false);
    groupOs.setSilenced(false);
    await reply(chat.id, '▶️ CVR + Profit Group resumed.', mid);
    return;
  }
  if (cmd === '/catalog') {
    const snap = await cvr.sense();
    const lines = (snap.topServices || []).map((s, i) => `${i + 1}. ${s.name || s.id} ${s.price != null ? `($${s.price})` : ''}`);
    await reply(chat.id, lines.length ? `Catalog top:\n${lines.join('\n')}\n\n${process.env.PUBLIC_APP_URL || 'https://zeusai.pro'}/services` : 'Catalog empty or API unreachable.', mid);
    return;
  }
  if (cmd === '/channels') {
    const ch = await cvr.process({ action: 'channels' });
    await reply(chat.id, [
      '📡 CVR armed channels (auto fan-out):',
      ...(ch.armed || []).map((p) => `• ${p}`),
      '',
      'Also triggers: IndexNow SEO + socialMediaViralizer + public site feed',
      'Feed: https://zeusai.pro/api/growth/cvr/feed',
    ].join('\n'), mid);
    return;
  }
  if (cmd === '/boost') {
    await reply(chat.id, '⚡ Forcing multi-channel CVR cycle…', mid);
    const st = await cvr.process({ action: 'boost' });
    const a = st.lastCycle && st.lastCycle.action;
    const posted = (st.lastCycle && st.lastCycle.posted) || [];
    const failed = (st.lastCycle && st.lastCycle.failed) || [];
    await reply(chat.id, [
      a && a.ok
        ? `✅ Fan-out ok (${a.id})\nposted: ${posted.join(', ') || '—'}\nfailed: ${failed.map((f) => f.platform).join(', ') || '—'}`
        : `⏸ ${a && a.reason ? a.reason : (st.lastCycle && st.lastCycle.gate && st.lastCycle.gate.reason) || 'no_act'}`,
      cvr.formatPulse(st),
    ].join('\n\n'), mid);
  }
}

function loadOffset() {
  try { return Number(JSON.parse(fs.readFileSync(OFFSET_FILE, 'utf8')).offset) || 0; } catch (_) { return 0; }
}
function saveOffset(offset) {
  fs.mkdirSync(path.dirname(OFFSET_FILE), { recursive: true });
  fs.writeFileSync(OFFSET_FILE, `${JSON.stringify({ offset })}\n`);
}

async function handleMyChatMember(update) {
  const mcm = update.my_chat_member;
  if (!mcm || !mcm.chat) return;
  const neu = mcm.new_chat_member || {};
  const chat = mcm.chat;
  const canPost = neu.status === 'creator'
    || (neu.status === 'administrator' && (neu.can_post_messages === true || chat.type !== 'channel'));
  if (!canPost) return;
  if (chat.type === 'channel' || chat.type === 'supergroup' || chat.type === 'group') {
    // Dual-rail: group/channel → profit group OS; keep owner private alert chat intact.
    log(`group/channel grant on ${chat.username || chat.id} — binding profit rail`);
    await applyGroupBind(chat);
  }
}

async function pollLoop() {
  let offset = loadOffset();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const data = await tg('getUpdates', {
        offset,
        timeout: POLL_TIMEOUT,
        allowed_updates: ['message', 'my_chat_member', 'channel_post', 'chat_member'],
      });
      if (!data.ok) {
        log(`getUpdates: ${data.description || data.error_code}`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const u of data.result || []) {
        offset = u.update_id + 1;
        saveOffset(offset);
        if (u.my_chat_member) {
          // eslint-disable-next-line no-await-in-loop
          await handleMyChatMember(u);
          continue;
        }
        // Profit Group OS: welcomes, moderation, engagement
        // eslint-disable-next-line no-await-in-loop
        await groupOs.handleUpdate(u).catch(() => {});
        const msg = u.message || u.channel_post;
        if (msg && typeof msg.text === 'string' && msg.text.trim().startsWith('/')) {
          // eslint-disable-next-line no-await-in-loop
          await handleCommand(msg);
        }
      }
    } catch (e) {
      log(`poll error: ${e && e.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function main() {
  if (!token()) {
    log('no TELEGRAM_BOT_TOKEN — CVR will run without inbound commands');
  } else {
    const me = await tg('getMe', {});
    log(`bot @${(me.result && me.result.username) || '?'} · ownerIds=${[...ownerIds()].join(',') || '(none)'}`);
    await tg('setMyCommands', {
      commands: [
        { command: 'pulse', description: 'Live CVR funnel scores' },
        { command: 'boost', description: 'Force multi-channel virality cycle' },
        { command: 'channels', description: 'List armed outbound rails' },
        { command: 'status', description: 'Machine status' },
        { command: 'catalog', description: 'Top catalog offers' },
        { command: 'value', description: 'Force a Profit Group value drop' },
        { command: 'profit', description: 'Group profit score' },
        { command: 'invite', description: 'Auto invite link' },
        { command: 'lead', description: 'Capture email lead' },
        { command: 'bindgroup', description: 'Bind this group as profit rail' },
        { command: 'silence', description: 'Pause auto-posts' },
        { command: 'resume', description: 'Resume auto-posts' },
        { command: 'help', description: 'What this bot invents' },
      ],
    });
  }

  const started = cvr.start({ apply: false });
  log(`CVR start ${JSON.stringify(started)}`);
  const gStarted = groupOs.start({ force: false });
  log(`TPG start ${JSON.stringify(gStarted)}`);

  // Brief owner once on boot if chat known
  const chat = process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID;
  if (token() && chat) {
    const g = groupOs.getStatus();
    await reply(chat, [
      '🦄 ZeusAI Unicorn Bot online.',
      'CVR armed + Telegram Profit Group OS (TPG/1.0) armed.',
      g.groupChatId
        ? `Profit rail: ${g.groupChatId}${g.dualRail ? ' (dual-rail)' : ''}`
        : 'Profit rail: add me as GROUP admin + /bindgroup (or auto-bind on admin grant).',
      'Try /pulse · /boost · /profit · /value',
      'Human: https://zeusai.pro/tg',
    ].join('\n')).catch(() => {});
  }

  if (token()) await pollLoop();
  else setInterval(() => {}, 60_000);
}

process.on('SIGTERM', () => { cvr.stop(); groupOs.stop(); process.exit(0); });
process.on('SIGINT', () => { cvr.stop(); groupOs.stop(); process.exit(0); });

if (require.main === module) {
  main().catch((e) => {
    log(`fatal: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
  });
}

module.exports = { handleCommand, isOwner, readEnvFile, applyGroupBind, applyBind };
