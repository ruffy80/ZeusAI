// =====================================================================
// telegram-profit-group-os.js — Telegram Profit Group OS (TPG/1.0)
//
// Innovation: turns a bound Telegram group/channel into an autonomous
// profit + promotion engine for ZeusAI / Unicorn — without human ops.
//
// Dual-rail:
//   owner alerts  → TELEGRAM_CHAT_ID (private / ops)
//   profit group  → ZEUS_TG_GROUP_CHAT_ID || TELEGRAM_GROUP_CHAT_ID || TELEGRAM_CHAT_ID
//
// Loops:
//   • Welcome Gravity — onboard every new member with tracked CTA
//   • Value Calendar — daily/interval editorial posts (not spam)
//   • Profit Gravity — pick post type by funnel hunger × engagement velocity
//   • Soft Moderation — rate-limit link spam for non-admins
//   • Lead Capture — /lead email → local lead file + optional /api/lead
//   • Viral Invite — createChatInviteLink when permissions allow
//
// RO: grup Telegram autonom care promovează site-ul și maximizează conversia.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const NAME = 'telegram-profit-group-os';
const VERSION = 'TPG/1.0';
const SITE = String(
  process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://zeusai.pro'
).replace(/\/$/, '');

function _defaultDataDir() {
  const shared = '/var/www/unicorn/shared/data/telegram/group-os';
  try { if (fs.existsSync('/var/www/unicorn/shared')) return shared; } catch (_) { /* ignore */ }
  return path.join(__dirname, '..', '..', 'data', 'telegram', 'group-os');
}

const DATA_DIR = process.env.ZEUS_TG_GROUP_OS_DIR || _defaultDataDir();
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LEDGER = path.join(DATA_DIR, 'events.jsonl');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');

const TICK_MS = Math.max(60_000, Number(process.env.ZEUS_TG_GROUP_TICK_MS) || 15 * 60_000);
const VALUE_GAP_MS = Math.max(30 * 60_000, Number(process.env.ZEUS_TG_VALUE_GAP_MS) || 6 * 60_000);
const MAX_VALUE_POSTS_DAY = Math.max(1, Number(process.env.ZEUS_TG_MAX_VALUE_DAY) || 6);
const WELCOME_COOLDOWN_MS = Math.max(10_000, Number(process.env.ZEUS_TG_WELCOME_COOLDOWN_MS) || 60_000);
const DISABLED = String(process.env.ZEUS_TG_GROUP_OS_DISABLED || '') === '1';

let _timer = null;
let _started = false;
let _affiliate = null;
let _funnel = null;

try { _affiliate = require('./marketing-innovations/affiliate-revenue'); } catch (_) { _affiliate = null; }
try { _funnel = require('./funnel-intelligence'); } catch (_) { _funnel = null; }

const state = {
  startedAt: null,
  postsToday: 0,
  postsDayKey: '',
  lastValueAt: 0,
  lastWelcomeAt: 0,
  joins: 0,
  leaves: 0,
  messages: 0,
  commands: 0,
  leads: 0,
  moderated: 0,
  lastPost: null,
  lastInviteLink: null,
  silenced: false,
  profitScore: 0,
  engagementVelocity: 0, // messages per hour (rolling estimate)
  _msgWindow: [],
};

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

function _loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    Object.assign(state, raw, { _msgWindow: Array.isArray(raw._msgWindow) ? raw._msgWindow : [] });
  } catch (_) { /* ignore */ }
}

function _saveState() {
  _ensureDir();
  try {
    const { _msgWindow, ...rest } = state;
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      ...rest,
      _msgWindow: (_msgWindow || []).slice(-200),
      savedAt: new Date().toISOString(),
    }, null, 2));
  } catch (_) { /* ignore */ }
}

function _append(file, obj) {
  _ensureDir();
  try { fs.appendFileSync(file, `${JSON.stringify(obj)}\n`); } catch (_) { /* ignore */ }
}

function _envArmed(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) return false;
  return !/^(your|skip|changeme|todo|placeholder|xxx+|none|null|undefined|tbd|n\/a)/i.test(v);
}

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || process.env.ZAC_TELEGRAM_TOKEN || '';
}

/** Prefer dedicated profit-group chat; fall back to canonical outbound chat. */
function groupChatId() {
  return String(
    process.env.ZEUS_TG_GROUP_CHAT_ID
    || process.env.TELEGRAM_GROUP_CHAT_ID
    || process.env.TELEGRAM_CHAT_ID
    || process.env.TG_CHAT_ID
    || ''
  ).trim();
}

function ownerChatId() {
  return String(process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID || '').trim();
}

function buildCta(kind) {
  const target = `${SITE}/services`;
  const base = {
    target,
    code: 'tg-group',
    source: 'telegram',
    medium: 'group',
    campaign: 'profit-group-os',
    content: String(kind || 'value').slice(0, 48),
  };
  if (_affiliate && typeof _affiliate.buildLink === 'function') {
    const built = _affiliate.buildLink(base);
    if (built && built.ok) return built.url;
  }
  const u = new URL(target);
  u.searchParams.set('utm_source', 'telegram');
  u.searchParams.set('utm_medium', 'group');
  u.searchParams.set('utm_campaign', 'profit-group-os');
  u.searchParams.set('utm_content', String(kind || 'value'));
  u.searchParams.set('ref', 'tg-group');
  return u.toString();
}

async function tg(method, body) {
  const tok = token();
  if (!tok) return { ok: false, description: 'no_token' };
  const url = `https://api.telegram.org/bot${encodeURIComponent(tok)}/${method}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return r.json().catch(() => ({ ok: false, description: 'bad_json' }));
  } catch (e) {
    return { ok: false, description: e && e.message };
  }
}

async function sendGroup(text, opts) {
  const chat = (opts && opts.chatId) || groupChatId();
  if (!token() || !chat) return { ok: false, reason: 'not_configured' };
  if (state.silenced) return { ok: false, reason: 'silenced' };
  const payload = {
    chat_id: chat,
    text: String(text).slice(0, 3900),
    disable_web_page_preview: !!(opts && opts.disablePreview),
  };
  if (opts && opts.replyTo) payload.reply_to_message_id = opts.replyTo;
  if (opts && opts.buttons) {
    payload.reply_markup = {
      inline_keyboard: opts.buttons,
    };
  }
  const r = await tg('sendMessage', payload);
  _append(LEDGER, {
    ts: new Date().toISOString(),
    type: 'send',
    chatId: chat,
    ok: !!(r && r.ok),
    kind: (opts && opts.kind) || 'message',
  });
  return r;
}

function _rollDay() {
  const k = _dayKey();
  if (state.postsDayKey !== k) {
    state.postsDayKey = k;
    state.postsToday = 0;
  }
}

function _touchMessage() {
  const now = Date.now();
  state.messages += 1;
  state._msgWindow = (state._msgWindow || []).filter((t) => now - t < 3600_000);
  state._msgWindow.push(now);
  state.engagementVelocity = state._msgWindow.length;
  _saveState();
}

function _funnelHunger() {
  try {
    if (!_funnel || typeof _funnel.summary !== 'function') return { stage: 'traffic', score: 40 };
    const s = _funnel.summary();
    const w = (s && s.windows && s.windows.last7d) || {};
    const sessions = Number(w.sessions || 0);
    const checkouts = Number(w.checkoutStarts || 0);
    const paid = Number(w.paid || 0);
    if (sessions < 20) return { stage: 'traffic', score: 20 };
    if (checkouts < 3) return { stage: 'convert', score: 35 };
    if (paid < 1) return { stage: 'monetize', score: 25 };
    return { stage: 'expand', score: 70 };
  } catch (_) {
    return { stage: 'traffic', score: 40 };
  }
}

function _computeProfitScore() {
  const hunger = _funnelHunger();
  const eng = Math.min(40, state.engagementVelocity * 2);
  const leadBoost = Math.min(20, state.leads * 4);
  const joinBoost = Math.min(20, state.joins * 2);
  const postPenalty = state.postsToday > MAX_VALUE_POSTS_DAY ? -10 : 0;
  state.profitScore = Math.max(0, Math.min(100, Math.round(
    (100 - hunger.score) * 0.35 + eng + leadBoost + joinBoost + postPenalty
  )));
  return { profitScore: state.profitScore, hunger, engagementVelocity: state.engagementVelocity };
}

// ── Editorial library (value-first, soft CTA) ───────────────────────────
const VALUE_TEMPLATES = [
  {
    id: 'autonomy_proof',
    stages: ['traffic', 'expand'],
    build: (cta) => ([
      '🦄 *ZeusAI Profit Pulse*',
      '',
      'Unicorn runs checkout, fulfillment signals, and growth loops without a human sitting on the keyboard.',
      '',
      `Explore live catalog → ${cta}`,
      '#ZeusAI #Unicorn #autonomousCommerce',
    ].join('\n')),
  },
  {
    id: 'btc_rail',
    stages: ['convert', 'monetize'],
    build: (cta) => ([
      '₿ *BTC-native commerce*',
      '',
      'Non-custodial owner wallet · signed receipts · no fake dashboards.',
      'When card/crypto rails arm, the same settle path fulfills instantly.',
      '',
      `Start at ${cta}`,
    ].join('\n')),
  },
  {
    id: 'pomx_edge',
    stages: ['expand', 'traffic'],
    build: (cta) => ([
      '📐 *Proof-of-Margin Exchange*',
      '',
      'Every SKU carries a verifiable margin attestation — world-first multi-product protocol.',
      '',
      `Open PoMX → ${SITE}/pomx`,
      `Shop → ${cta}`,
    ].join('\n')),
  },
  {
    id: 'dropship_shelf',
    stages: ['convert', 'monetize'],
    build: (cta) => ([
      '🛒 *Autonomous dropship shelf*',
      '',
      'Sourced · margin-ranked · BTC invoice in one flow.',
      '',
      `Browse → ${SITE}/dropship`,
      `All services → ${cta}`,
    ].join('\n')),
  },
  {
    id: 'never_down',
    stages: ['traffic', 'expand'],
    build: (cta) => ([
      '🛡 *Never-Down Kernel*',
      '',
      'Health enrichment + healerFail gate — the storefront stays up so growth compounds.',
      '',
      `Live status → ${SITE}/health`,
      `Catalog → ${cta}`,
    ].join('\n')),
  },
  {
    id: 'invite_gravity',
    stages: ['expand', 'capture'],
    build: (cta, invite) => ([
      '🚀 *Grow with us*',
      '',
      'This group is the live Unicorn command surface — value posts, product drops, BTC rails.',
      invite ? `Invite friends → ${invite}` : 'Ask an admin for an invite link.',
      '',
      `Enter the marketplace → ${cta}`,
    ].join('\n')),
  },
];

function pickValueTemplate() {
  const hunger = _funnelHunger();
  const scored = VALUE_TEMPLATES.map((t) => ({
    t,
    score: (t.stages.includes(hunger.stage) ? 2 : 0)
      + (state.lastPost && state.lastPost.id === t.id ? -1 : 0)
      + Math.random() * 0.3,
  })).sort((a, b) => b.score - a.score);
  return scored[0].t;
}

async function ensureInviteLink() {
  const chat = groupChatId();
  if (!token() || !chat) return null;
  if (state.lastInviteLink && state.lastInviteLink.expiresAt > Date.now()) {
    return state.lastInviteLink.url;
  }
  const r = await tg('createChatInviteLink', {
    chat_id: chat,
    name: 'ZeusAI Profit Group',
    creates_join_request: false,
  });
  if (r && r.ok && r.result && r.result.invite_link) {
    state.lastInviteLink = {
      url: r.result.invite_link,
      expiresAt: Date.now() + 6 * 3600_000,
    };
    _saveState();
    return state.lastInviteLink.url;
  }
  return null;
}

async function postValue(force) {
  _rollDay();
  if (!force) {
    if (state.silenced) return { ok: false, reason: 'silenced' };
    if (state.postsToday >= MAX_VALUE_POSTS_DAY) return { ok: false, reason: 'daily_cap' };
    if (Date.now() - state.lastValueAt < VALUE_GAP_MS) return { ok: false, reason: 'cadence_wait' };
  }
  const tmpl = pickValueTemplate();
  const cta = buildCta(tmpl.id);
  const invite = tmpl.id === 'invite_gravity' ? await ensureInviteLink() : null;
  const text = tmpl.build(cta, invite);
  const buttons = [[
    { text: 'Open ZeusAI catalog', url: cta },
    { text: 'Live site', url: SITE },
  ]];
  const r = await sendGroup(text, { kind: 'value', buttons });
  if (r && r.ok) {
    state.postsToday += 1;
    state.lastValueAt = Date.now();
    state.lastPost = { id: tmpl.id, at: new Date().toISOString(), cta };
    _computeProfitScore();
    _saveState();
    _append(LEDGER, { ts: new Date().toISOString(), type: 'value_post', template: tmpl.id, cta });
  }
  return { ok: !!(r && r.ok), template: tmpl.id, result: r, cta };
}

async function welcomeMember(member, chat) {
  if (!member || member.is_bot) return { ok: false, reason: 'bot' };
  if (Date.now() - state.lastWelcomeAt < WELCOME_COOLDOWN_MS) {
    // still count join, skip spammy welcome burst
    state.joins += 1;
    _saveState();
    return { ok: true, skipped: 'cooldown' };
  }
  const name = member.username ? `@${member.username}` : (member.first_name || 'builder');
  const cta = buildCta('welcome');
  const invite = await ensureInviteLink();
  const text = [
    `👋 Welcome ${name} — you just entered the *ZeusAI Profit Group*.`,
    '',
    'Here you get autonomous commerce drops, BTC rails, and live Unicorn product signals.',
    '',
    `▶ Catalog: ${cta}`,
    `▶ PoMX exchange: ${SITE}/pomx`,
    `▶ Dropship shelf: ${SITE}/dropship`,
    '',
    'Commands: /value · /profit · /lead you@email.com · /invite',
    invite ? `\nShare the group: ${invite}` : '',
  ].filter(Boolean).join('\n');
  const r = await sendGroup(text, {
    chatId: chat && chat.id,
    kind: 'welcome',
    buttons: [[{ text: 'Start on ZeusAI', url: cta }]],
  });
  state.joins += 1;
  state.lastWelcomeAt = Date.now();
  _saveState();
  return { ok: !!(r && r.ok), result: r };
}

function captureLead(email, from) {
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: 'invalid_email' };
  const row = {
    ts: new Date().toISOString(),
    email: clean,
    fromId: from && from.id,
    username: from && from.username || null,
    source: 'telegram-profit-group',
  };
  _append(LEADS_FILE, row);
  state.leads += 1;
  _saveState();
  // Best-effort HTTP lead ingest (never throw)
  try {
    const http = require('http');
    const body = JSON.stringify({ email: clean, source: 'telegram-group', name: from && from.first_name });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/leads',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 3000,
    }, () => {});
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch (_) { /* ignore */ }
  return { ok: true, email: clean };
}

function shouldModerate(msg) {
  if (!msg || !msg.from || msg.from.is_bot) return null;
  const text = String(msg.text || msg.caption || '');
  if (!text) return null;
  // Soft: many http links in one message from non-admin
  const links = (text.match(/https?:\/\//gi) || []).length;
  if (links >= 3) {
    return { action: 'warn', reason: 'link_spam' };
  }
  // Crypto tip spam heuristics
  if (/\b(send\s*btc|double\s*your|free\s*airdrop)\b/i.test(text) && links >= 1) {
    return { action: 'warn', reason: 'scam_pattern' };
  }
  return null;
}

async function handleUpdate(update) {
  if (!update || DISABLED) return { ok: false, reason: 'disabled' };

  // New members (classic groups)
  if (update.message && Array.isArray(update.message.new_chat_members)) {
    const chat = update.message.chat;
    const outs = [];
    for (const m of update.message.new_chat_members) {
      // eslint-disable-next-line no-await-in-loop
      outs.push(await welcomeMember(m, chat));
    }
    return { ok: true, welcomes: outs };
  }

  // Left member
  if (update.message && update.message.left_chat_member) {
    state.leaves += 1;
    _saveState();
    return { ok: true, left: true };
  }

  const msg = update.message || update.channel_post;
  if (!msg) return { ok: true, ignored: true };

  _touchMessage();

  // Soft moderation on non-command chatter
  const text = String(msg.text || '');
  if (text && !text.startsWith('/')) {
    const mod = shouldModerate(msg);
    if (mod) {
      state.moderated += 1;
      _saveState();
      await sendGroup(
        `⚠️ Keep the group high-signal. (${mod.reason}) Value > spam. Catalog: ${buildCta('moderation')}`,
        { chatId: msg.chat && msg.chat.id, kind: 'moderation', replyTo: msg.message_id }
      );
      return { ok: true, moderated: mod };
    }
  }

  return { ok: true };
}

async function handleCommand(msg) {
  if (!msg || !msg.text) return { ok: false };
  const chat = msg.chat;
  const text = String(msg.text || '').trim();
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase().split('@')[0];
  const mid = msg.message_id;
  state.commands += 1;

  if (cmd === '/value' || cmd === '/drop') {
    const r = await postValue(true);
    if (!(r && r.ok)) {
      await sendGroup(`⏸ Value post: ${r.reason || 'failed'}`, { chatId: chat.id, replyTo: mid });
    }
    return r;
  }

  if (cmd === '/profit' || cmd === '/group') {
    const score = _computeProfitScore();
    await sendGroup([
      `📈 *TPG/1.0 Profit Score: ${score.profitScore}/100*`,
      `Hunger stage: ${score.hunger.stage} (${score.hunger.score})`,
      `Engagement: ${score.engagementVelocity} msgs/h`,
      `Joins: ${state.joins} · Leads: ${state.leads} · Posts today: ${state.postsToday}/${MAX_VALUE_POSTS_DAY}`,
      `Last drop: ${(state.lastPost && state.lastPost.id) || '—'}`,
      '',
      `Catalog → ${buildCta('profit')}`,
    ].join('\n'), { chatId: chat.id, replyTo: mid, kind: 'status' });
    return { ok: true, score };
  }

  if (cmd === '/invite') {
    const link = await ensureInviteLink();
    await sendGroup(
      link
        ? `🔗 Invite link (auto-rotated):\n${link}\n\nShare → grow the profit group → more Unicorn traffic.`
        : 'Invite link unavailable — make the bot admin with *Invite Users* permission.',
      { chatId: chat.id, replyTo: mid, kind: 'invite' }
    );
    return { ok: !!link, link };
  }

  if (cmd === '/lead') {
    const email = parts[1] || '';
    const r = captureLead(email, msg.from);
    await sendGroup(
      r.ok
        ? `✅ Lead captured. We will only use it for Unicorn onboarding.\nNext: ${buildCta('lead')}`
        : 'Usage: `/lead you@email.com`',
      { chatId: chat.id, replyTo: mid, kind: 'lead' }
    );
    return r;
  }

  if (cmd === '/cta') {
    const cta = buildCta('cta_cmd');
    await sendGroup(`▶ Direct trackable CTA:\n${cta}`, { chatId: chat.id, replyTo: mid });
    return { ok: true, cta };
  }

  return { ok: false, reason: 'unknown_command' };
}

async function tick() {
  if (DISABLED || state.silenced) return { ok: false, reason: 'disabled_or_silenced' };
  if (!token() || !groupChatId()) return { ok: false, reason: 'not_configured' };
  _computeProfitScore();
  // Profit Gravity: when score high OR funnel starving convert/monetize → post value
  const hunger = _funnelHunger();
  const forceHungry = ['convert', 'monetize', 'capture'].includes(hunger.stage);
  if (forceHungry || state.profitScore >= 35 || state.engagementVelocity >= 3) {
    return postValue(false);
  }
  _saveState();
  return { ok: true, skipped: 'gravity_wait', profitScore: state.profitScore };
}

function start(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  if (_started && !(opts && opts.force)) return { ok: true, already: true };
  _loadState();
  state.startedAt = state.startedAt || new Date().toISOString();
  _started = true;
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  if (_timer.unref) _timer.unref();
  // First value post shortly after boot (non-blocking)
  setTimeout(() => { postValue(false).catch(() => {}); }, 45_000).unref?.();
  _saveState();
  return { ok: true, module: NAME, protocol: VERSION, tickMs: TICK_MS };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  _started = false;
  _saveState();
  return { ok: true };
}

function setSilenced(v) {
  state.silenced = !!v;
  _saveState();
  return { silenced: state.silenced };
}

function bindGroupChat(chat) {
  if (!chat || chat.id == null) return { ok: false, error: 'chat_required' };
  process.env.ZEUS_TG_GROUP_CHAT_ID = String(chat.id);
  process.env.TELEGRAM_GROUP_CHAT_ID = String(chat.id);
  if (chat.username) process.env.ZEUS_TG_GROUP_REF = `@${chat.username}`;
  _append(LEDGER, {
    ts: new Date().toISOString(),
    type: 'group_bind',
    chatId: chat.id,
    username: chat.username || null,
    title: chat.title || null,
    chatType: chat.type || null,
  });
  _saveState();
  return {
    ok: true,
    groupChatId: String(chat.id),
    ref: chat.username ? `@${chat.username}` : String(chat.id),
  };
}

function getStatus() {
  _computeProfitScore();
  return {
    ok: true,
    module: NAME,
    protocol: VERSION,
    started: _started || !!state.startedAt,
    startedAt: state.startedAt,
    silenced: state.silenced,
    configured: !!(token() && groupChatId()),
    tokenArmed: !!token(),
    groupChatId: groupChatId() || null,
    ownerChatId: ownerChatId() || null,
    dualRail: !!(groupChatId() && ownerChatId() && groupChatId() !== ownerChatId()),
    profitScore: state.profitScore,
    engagementVelocity: state.engagementVelocity,
    postsToday: state.postsToday,
    maxPostsDay: MAX_VALUE_POSTS_DAY,
    joins: state.joins,
    leaves: state.leaves,
    messages: state.messages,
    leads: state.leads,
    moderated: state.moderated,
    lastPost: state.lastPost,
    lastInviteLink: state.lastInviteLink ? { url: state.lastInviteLink.url, expiresAt: state.lastInviteLink.expiresAt } : null,
    site: SITE,
    endpoints: {
      status: '/api/telegram/group-os',
      human: '/tg',
    },
    generatedAt: new Date().toISOString(),
  };
}

function discovery() {
  return {
    protocol: VERSION,
    name: 'Telegram Profit Group OS',
    purpose: 'Autonomous high-signal Telegram group that compounds Unicorn traffic and checkout intent.',
    endpoints: {
      status: '/api/telegram/group-os',
      wellKnown: '/.well-known/telegram-profit-group.json',
      human: '/tg',
    },
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  if (action === 'start') return start(input);
  if (action === 'stop') return stop();
  if (action === 'tick') return tick();
  if (action === 'value' || action === 'post') return postValue(!!input.force);
  if (action === 'invite') return { ok: true, link: await ensureInviteLink() };
  if (action === 'silence') return setSilenced(true);
  if (action === 'resume') return setSilenced(false);
  if (action === 'bind' && input.chat) return bindGroupChat(input.chat);
  if (action === 'lead') return captureLead(input.email, input.from || null);
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  stop();
  Object.assign(state, {
    startedAt: null, postsToday: 0, postsDayKey: '', lastValueAt: 0, lastWelcomeAt: 0,
    joins: 0, leaves: 0, messages: 0, commands: 0, leads: 0, moderated: 0,
    lastPost: null, lastInviteLink: null, silenced: false, profitScore: 0,
    engagementVelocity: 0, _msgWindow: [],
  });
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

_loadState();

module.exports = {
  name: NAME,
  VERSION,
  start,
  stop,
  tick,
  postValue,
  welcomeMember,
  handleUpdate,
  handleCommand,
  captureLead,
  buildCta,
  groupChatId,
  bindGroupChat,
  ensureInviteLink,
  getStatus,
  discovery,
  process: processInput,
  setSilenced,
  _resetForTests,
  // exported for bot wiring
  tg,
  sendGroup,
};
