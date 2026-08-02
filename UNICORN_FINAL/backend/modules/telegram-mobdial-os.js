// =====================================================================
// telegram-mobdial-os.js — Telegram MobDial OS (MDB/1.0)
//
// INVENTION (not previously shipped): Membership-Orchestrated Bidirectional Dial.
// A Telegram swarm becomes a live bidirectional control surface for Unicorn:
//
//   Group → Site   Member Dial Codes (UDIAL-xxxx) bind TG identity into
//                  trackable CTAs + checkout attribution (closed loop).
//   Site  → Group  Causal Echo — privacy-safe proof pulses when funnel
//                  hunger or paid events fire (no PII, no card data).
//   Swarm Rate Governor — shared token-bucket so TPG/CVR/AMOS never
//                  stampede the same chat.
//   Creative Genome — bandit-style template weights learned from dial
//                  clicks + attributed checkouts (not static A/B).
//   Rank Ladder — member contribution score from invites/dials/claims.
//
// Extends TPG without replacing it. Bot remains the sole getUpdates owner.
// RO: dialul Mondial — grupul Telegram ↔ site, plus-valoare în buclă închisă.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'telegram-mobdial-os';
const VERSION = 'MDB/1.0';
const SITE = String(
  process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://zeusai.pro'
).replace(/\/$/, '');

function _defaultDataDir() {
  const shared = '/var/www/unicorn/shared/data/telegram/mobdial';
  try { if (fs.existsSync('/var/www/unicorn/shared')) return shared; } catch (_) { /* ignore */ }
  return path.join(__dirname, '..', '..', 'data', 'telegram', 'mobdial');
}

const DATA_DIR = process.env.ZEUS_TG_MOBDIAL_DIR || _defaultDataDir();
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const LEDGER = path.join(DATA_DIR, 'events.jsonl');
const DISABLED = String(process.env.ZEUS_TG_MOBDIAL_DISABLED || '') === '1';

/** Shared swarm governor: max outbound posts / rolling window across all senders. */
const GOV_WINDOW_MS = Math.max(60_000, Number(process.env.ZEUS_TG_MOBDIAL_GOV_WINDOW_MS) || 10 * 60_000);
const GOV_MAX = Math.max(1, Number(process.env.ZEUS_TG_MOBDIAL_GOV_MAX) || 4);
const ECHO_GAP_MS = Math.max(60_000, Number(process.env.ZEUS_TG_MOBDIAL_ECHO_GAP_MS) || 20 * 60_000);
const TICK_MS = Math.max(60_000, Number(process.env.ZEUS_TG_MOBDIAL_TICK_MS) || 12 * 60_000);

let _timer = null;
let _started = false;
let _funnel = null;

try { _funnel = require('./funnel-intelligence'); } catch (_) { _funnel = null; }

/** Lazy require — avoids circular init with telegram-profit-group-os. */
function _tpg() {
  try { return require('./telegram-profit-group-os'); } catch (_) { return null; }
}

const state = {
  startedAt: null,
  dialsIssued: 0,
  dialClicks: 0,
  attributedCheckouts: 0,
  attributedPaid: 0,
  echoes: 0,
  governorBlocks: 0,
  lastEchoAt: 0,
  lastTickAt: 0,
  sendTimestamps: [],
  creativeWeights: {},
  swarmScore: 0,
};

/** @type {Record<string, object>} tgUserId → member */
let members = {};

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _load() {
  try {
    if (fs.existsSync(STATE_FILE)) Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch (_) { /* ignore */ }
  try {
    if (fs.existsSync(MEMBERS_FILE)) members = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8')) || {};
  } catch (_) { members = {}; }
  if (!state.creativeWeights || typeof state.creativeWeights !== 'object') state.creativeWeights = {};
  if (!Array.isArray(state.sendTimestamps)) state.sendTimestamps = [];
}

function _save() {
  _ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      ...state,
      sendTimestamps: (state.sendTimestamps || []).slice(-80),
      savedAt: new Date().toISOString(),
    }, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
  } catch (_) { /* ignore */ }
}

function _append(obj) {
  _ensureDir();
  try { fs.appendFileSync(LEDGER, `${JSON.stringify(obj)}\n`); } catch (_) { /* ignore */ }
}

function _hashId(n) {
  return crypto.createHash('sha256').update(String(n)).digest('hex').slice(0, 8).toUpperCase();
}

/** Issue or return existing Membership Dial Code for a Telegram user. */
function issueDial(from) {
  if (!from || from.id == null) return { ok: false, error: 'from_required' };
  if (from.is_bot) return { ok: false, error: 'bot' };
  const id = String(from.id);
  let m = members[id];
  if (!m) {
    const code = `UDIAL-${_hashId(id + ':' + (from.username || ''))}`;
    m = {
      tgId: id,
      username: from.username || null,
      firstName: from.first_name || null,
      code,
      issuedAt: new Date().toISOString(),
      clicks: 0,
      checkouts: 0,
      paid: 0,
      invites: 0,
      rankScore: 1,
      lastSeenAt: new Date().toISOString(),
    };
    members[id] = m;
    state.dialsIssued += 1;
    _append({ ts: new Date().toISOString(), type: 'dial_issue', code, tgId: id });
    _save();
  } else {
    m.lastSeenAt = new Date().toISOString();
    if (from.username) m.username = from.username;
    _save();
  }
  return { ok: true, member: publicMember(m) };
}

function publicMember(m) {
  if (!m) return null;
  return {
    code: m.code,
    username: m.username,
    rankScore: m.rankScore,
    clicks: m.clicks,
    checkouts: m.checkouts,
    paid: m.paid,
    invites: m.invites,
    issuedAt: m.issuedAt,
  };
}

function findByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  for (const m of Object.values(members)) {
    if (String(m.code).toUpperCase() === c) return m;
  }
  return null;
}

function buildDialUrl(code, kind) {
  const u = new URL(`${SITE}/services`);
  u.searchParams.set('utm_source', 'telegram');
  u.searchParams.set('utm_medium', 'mobdial');
  u.searchParams.set('utm_campaign', 'mdb-1');
  u.searchParams.set('utm_content', String(kind || 'dial').slice(0, 48));
  u.searchParams.set('dial', String(code).toUpperCase());
  u.searchParams.set('ref', String(code).toUpperCase());
  return u.toString();
}

function checkoutUrl(code, serviceId) {
  const sid = encodeURIComponent(String(serviceId || 'starter'));
  const u = new URL(`${SITE}/checkout`);
  u.searchParams.set('serviceId', sid);
  u.searchParams.set('dial', String(code).toUpperCase());
  u.searchParams.set('utm_source', 'telegram');
  u.searchParams.set('utm_medium', 'mobdial');
  u.searchParams.set('utm_campaign', 'mdb-checkout');
  return u.toString();
}

/** Shared Swarm Rate Governor — call before any group outbound. */
function governorAllow(sender) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const now = Date.now();
  state.sendTimestamps = (state.sendTimestamps || []).filter((t) => now - t < GOV_WINDOW_MS);
  if (state.sendTimestamps.length >= GOV_MAX) {
    state.governorBlocks += 1;
    _save();
    _append({ ts: new Date().toISOString(), type: 'gov_block', sender: sender || 'unknown' });
    return {
      ok: false,
      reason: 'swarm_governor',
      windowMs: GOV_WINDOW_MS,
      max: GOV_MAX,
      used: state.sendTimestamps.length,
    };
  }
  return { ok: true, used: state.sendTimestamps.length, max: GOV_MAX };
}

function governorCommit(sender) {
  state.sendTimestamps.push(Date.now());
  _append({ ts: new Date().toISOString(), type: 'gov_send', sender: sender || 'unknown' });
  _save();
}

/**
 * Wrap TPG sendGroup with governor. Prefer this from multi-sender paths.
 */
async function sendGoverned(text, opts) {
  const sender = (opts && opts.sender) || (opts && opts.kind) || 'mobdial';
  const gate = governorAllow(sender);
  if (!gate.ok) return gate;
  const tpg = _tpg();
  if (!tpg || typeof tpg.sendGroup !== 'function') return { ok: false, reason: 'tpg_missing' };
  // skipGovernor: we already gated + will commit — avoid double-count in TPG
  const r = await tpg.sendGroup(text, { ...(opts || {}), skipGovernor: true });
  if (r && r.ok) governorCommit(sender);
  return r;
}

function _rewardCreative(templateId, amount) {
  const id = String(templateId || 'generic');
  const cur = Number(state.creativeWeights[id] || 1);
  state.creativeWeights[id] = Math.max(0.1, Math.min(12, cur + amount));
  _save();
}

function recordDialClick(code, meta) {
  const m = findByCode(code);
  if (!m) return { ok: false, error: 'unknown_dial' };
  m.clicks += 1;
  m.rankScore = _recomputeRank(m);
  state.dialClicks += 1;
  if (meta && meta.templateId) _rewardCreative(meta.templateId, 0.15);
  _append({
    ts: new Date().toISOString(),
    type: 'dial_click',
    code: m.code,
    templateId: meta && meta.templateId || null,
  });
  _save();
  return { ok: true, member: publicMember(m) };
}

function attributeCheckout(input) {
  const o = input && typeof input === 'object' ? input : {};
  const code = String(o.dial || o.ref || o.code || '').trim().toUpperCase();
  if (!code.startsWith('UDIAL-')) return { ok: false, reason: 'no_dial' };
  const m = findByCode(code);
  if (!m) return { ok: false, reason: 'unknown_dial' };
  const paid = !!(o.paid || o.status === 'paid' || o.status === 'settled');
  m.checkouts += 1;
  state.attributedCheckouts += 1;
  if (paid) {
    m.paid += 1;
    state.attributedPaid += 1;
    _rewardCreative(o.templateId || 'checkout', 0.8);
  } else {
    _rewardCreative(o.templateId || 'checkout', 0.35);
  }
  m.rankScore = _recomputeRank(m);
  _append({
    ts: new Date().toISOString(),
    type: paid ? 'dial_paid' : 'dial_checkout',
    code: m.code,
    orderId: o.orderId || null,
    serviceId: o.serviceId || null,
  });
  _save();
  _computeSwarmScore();
  return { ok: true, member: publicMember(m), paid };
}

function _recomputeRank(m) {
  return Math.round(
    1
    + (m.clicks || 0) * 1
    + (m.checkouts || 0) * 5
    + (m.paid || 0) * 20
    + (m.invites || 0) * 8
  );
}

function _computeSwarmScore() {
  const memberCount = Object.keys(members).length;
  const eng = Math.min(30, state.dialClicks);
  const money = Math.min(40, state.attributedPaid * 10 + state.attributedCheckouts * 3);
  const dens = Math.min(30, memberCount * 2);
  state.swarmScore = Math.max(0, Math.min(100, eng + money + dens));
  return state.swarmScore;
}

function topMembers(limit) {
  const n = Math.max(1, Math.min(25, Number(limit) || 10));
  return Object.values(members)
    .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
    .slice(0, n)
    .map(publicMember);
}

function pickCreativeId(candidates) {
  const list = Array.isArray(candidates) && candidates.length ? candidates : ['autonomy_proof', 'btc_rail', 'pomx_edge', 'dropship_shelf', 'never_down', 'invite_gravity', 'causal_echo'];
  let best = list[0];
  let bestScore = -1;
  for (const id of list) {
    const w = Number(state.creativeWeights[id] || 1) + Math.random() * 0.25;
    if (w > bestScore) { bestScore = w; best = id; }
  }
  return best;
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

/** Privacy-safe Causal Echo — invents the Site→Group mirror loop. */
async function postCausalEcho(force) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  if (!force && Date.now() - (state.lastEchoAt || 0) < ECHO_GAP_MS) {
    return { ok: false, reason: 'echo_gap' };
  }
  const hunger = _funnelHunger();
  const score = _computeSwarmScore();
  const creative = pickCreativeId(['causal_echo', 'btc_rail', 'autonomy_proof', 'pomx_edge']);
  const top = topMembers(3);
  const dialHint = top[0] ? top[0].code : 'UDIAL-••••';
  const lines = [
    '📡 *MobDial Causal Echo* · MDB/1.0',
    '',
    `Funnel hunger: *${hunger.stage}* · Swarm score: *${score}/100*`,
    `Dial clicks: ${state.dialClicks} · Attributed checkouts: ${state.attributedCheckouts} · Paid: ${state.attributedPaid}`,
    '',
    'Closed loop: your Dial Code → catalog → checkout → proof back here (no personal data).',
    top.length
      ? `Top dials: ${top.map((m) => m.code).join(' · ')}`
      : `Claim yours in-group: /dial`,
    '',
    `▶ Enter with dial → ${buildDialUrl(dialHint, creative)}`,
    `▶ Live group OS → ${SITE}/tg`,
  ];
  const r = await sendGoverned(lines.join('\n'), {
    kind: 'causal_echo',
    sender: 'mobdial_echo',
    buttons: [[
      { text: 'Open catalog with Dial', url: buildDialUrl(dialHint, creative) },
      { text: 'MobDial status', url: `${SITE}/tg` },
    ]],
  });
  if (r && r.ok) {
    state.echoes += 1;
    state.lastEchoAt = Date.now();
    _rewardCreative(creative, 0.05);
    _save();
    _append({ ts: new Date().toISOString(), type: 'causal_echo', creative, hunger: hunger.stage });
  }
  return { ok: !!(r && r.ok), creative, hunger, result: r };
}

async function welcomeWithDial(member, chat) {
  const issued = issueDial(member);
  if (!issued.ok) return issued;
  const code = issued.member.code;
  const url = buildDialUrl(code, 'welcome');
  const buy = checkoutUrl(code, 'starter');
  const name = member.username ? `@${member.username}` : (member.first_name || 'builder');
  const text = [
    `🌀 Welcome ${name} — *MobDial* armed.`,
    '',
    `Your personal Unicorn Dial Code: \`${code}\``,
    'Every click & checkout with this code compounds the swarm AND your rank.',
    '',
    `▶ Your dial CTA: ${url}`,
    `▶ Fast checkout: ${buy}`,
    '',
    'Commands: /dial · /rank · /claim · /swarm · /value · /invite',
  ].join('\n');
  const r = await sendGoverned(text, {
    chatId: chat && chat.id,
    kind: 'mobdial_welcome',
    sender: 'mobdial_welcome',
    buttons: [[
      { text: 'Enter with my Dial', url },
      { text: 'Checkout starter', url: buy },
    ]],
  });
  return { ok: !!(r && r.ok), dial: code, result: r };
}

async function handleCommand(msg) {
  if (!msg || !msg.text) return { ok: false };
  const text = String(msg.text || '').trim();
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase().split('@')[0];
  const chat = msg.chat;
  const mid = msg.message_id;

  if (cmd === '/dial' || cmd === '/udial') {
    const issued = issueDial(msg.from);
    if (!issued.ok) {
      const tpg = _tpg();
      if (tpg) await tpg.sendGroup('Could not issue dial.', { chatId: chat.id, replyTo: mid, skipGovernor: true });
      return issued;
    }
    const code = issued.member.code;
    const url = buildDialUrl(code, 'dial_cmd');
    await sendGoverned([
      `🌀 *Your MobDial code:* \`${code}\``,
      `Rank score: ${issued.member.rankScore}`,
      `Clicks ${issued.member.clicks} · Checkouts ${issued.member.checkouts} · Paid ${issued.member.paid}`,
      '',
      `Shareable CTA:\n${url}`,
      '',
      'Tip: put ?dial=' + code + ' on any ZeusAI link you share.',
    ].join('\n'), {
      chatId: chat.id,
      replyTo: mid,
      kind: 'dial_card',
      sender: 'mobdial_cmd',
      buttons: [[{ text: 'Open my Dial CTA', url }, { text: 'Buy hub', url: `${SITE}/buy` }]],
    });
    return issued;
  }

  if (cmd === '/rank' || cmd === '/leaderboard') {
    const top = topMembers(8);
    const lines = [
      '🏆 *MobDial Rank Ladder*',
      `Swarm score: ${_computeSwarmScore()}/100 · Members with dials: ${Object.keys(members).length}`,
      '',
      ...(top.length
        ? top.map((m, i) => `${i + 1}. \`${m.code}\` · score ${m.rankScore} · paid ${m.paid}`)
        : ['No dials yet — send /dial']),
      '',
      `Climb: share your dial → ${SITE}/tg`,
    ];
    await sendGoverned(lines.join('\n'), {
      chatId: chat.id, replyTo: mid, kind: 'rank', sender: 'mobdial_cmd',
    });
    return { ok: true, top };
  }

  if (cmd === '/claim') {
    const email = parts[1] || '';
    const issued = issueDial(msg.from);
    const tpg = _tpg();
    if (tpg && typeof tpg.captureLead === 'function' && email) {
      const lead = tpg.captureLead(email, msg.from);
      await sendGoverned(
        lead.ok
          ? `✅ Claimed. Dial \`${issued.member && issued.member.code}\` linked to onboarding.\nNext: ${buildDialUrl(issued.member.code, 'claim')}`
          : 'Usage: `/claim you@email.com`',
        { chatId: chat.id, replyTo: mid, kind: 'claim', sender: 'mobdial_cmd' }
      );
      return { ok: !!(lead && lead.ok), dial: issued.member, lead };
    }
    await sendGoverned(
      issued.ok
        ? `Dial \`${issued.member.code}\` ready. Usage: \`/claim you@email.com\``
        : 'Usage: `/claim you@email.com`',
      { chatId: chat.id, replyTo: mid, kind: 'claim', sender: 'mobdial_cmd' }
    );
    return issued;
  }

  if (cmd === '/swarm' || cmd === '/mobdial') {
    const st = getStatus();
    await sendGoverned([
      '🌀 *MobDial OS · MDB/1.0*',
      `Swarm score: ${st.swarmScore}/100`,
      `Dials issued: ${st.dialsIssued} · Clicks: ${st.dialClicks}`,
      `Attributed checkouts: ${st.attributedCheckouts} · Paid: ${st.attributedPaid}`,
      `Causal echoes: ${st.echoes} · Governor blocks: ${st.governorBlocks}`,
      `Governor: ${st.governor.used}/${st.governor.max} in window`,
      '',
      `Human surface → ${SITE}/tg`,
      `Machine → ${SITE}/api/telegram/mobdial`,
    ].join('\n'), { chatId: chat.id, replyTo: mid, kind: 'swarm_status', sender: 'mobdial_cmd' });
    return { ok: true, status: st };
  }

  if (cmd === '/echo') {
    return postCausalEcho(true);
  }

  return { ok: false, reason: 'unknown_command' };
}

async function onMemberJoin(member, chat) {
  if (!member || member.is_bot) return { ok: false, reason: 'bot' };
  // Count invite credit for inviter if Telegram provides it later; for now issue dial + welcome.
  return welcomeWithDial(member, chat);
}

async function tick() {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  state.lastTickAt = Date.now();
  _computeSwarmScore();
  const hunger = _funnelHunger();
  // Echo when funnel is hungry or swarm is warming
  if (['convert', 'monetize', 'capture'].includes(hunger.stage) || state.swarmScore >= 25) {
    const r = await postCausalEcho(false);
    _save();
    return r;
  }
  _save();
  return { ok: true, skipped: 'swarm_wait', swarmScore: state.swarmScore };
}

function start(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  if (_started && !(opts && opts.force)) return { ok: true, already: true };
  _load();
  state.startedAt = state.startedAt || new Date().toISOString();
  _started = true;
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  if (_timer.unref) _timer.unref();
  setTimeout(() => { postCausalEcho(false).catch(() => {}); }, 90_000).unref?.();
  _save();
  return { ok: true, module: NAME, protocol: VERSION, tickMs: TICK_MS };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  _started = false;
  _save();
  return { ok: true };
}

function getStatus() {
  _computeSwarmScore();
  const now = Date.now();
  const used = (state.sendTimestamps || []).filter((t) => now - t < GOV_WINDOW_MS).length;
  return {
    ok: true,
    module: NAME,
    protocol: VERSION,
    invention: 'Membership-Orchestrated Bidirectional Dial',
    started: _started || !!state.startedAt,
    startedAt: state.startedAt,
    disabled: DISABLED,
    swarmScore: state.swarmScore,
    dialsIssued: state.dialsIssued,
    dialClicks: state.dialClicks,
    attributedCheckouts: state.attributedCheckouts,
    attributedPaid: state.attributedPaid,
    echoes: state.echoes,
    governorBlocks: state.governorBlocks,
    memberCount: Object.keys(members).length,
    topMembers: topMembers(5),
    creativeWeights: { ...state.creativeWeights },
    governor: { used, max: GOV_MAX, windowMs: GOV_WINDOW_MS },
    site: SITE,
    endpoints: {
      status: '/api/telegram/mobdial',
      resolve: '/api/telegram/mobdial/resolve/:code',
      click: '/api/telegram/mobdial/click',
      attribute: '/api/telegram/mobdial/attribute',
      wellKnown: '/.well-known/telegram-mobdial.json',
      human: '/tg',
      tpgAlias: '/api/tpg/status',
    },
    generatedAt: new Date().toISOString(),
  };
}

function discovery() {
  return {
    protocol: VERSION,
    name: 'Telegram MobDial OS',
    purpose: 'Bidirectional swarm dial: Telegram members ↔ Unicorn commerce with closed-loop attribution and causal echoes.',
    inventions: [
      'Member Dial Codes (UDIAL)',
      'Causal Echo (Site→Group proof)',
      'Swarm Rate Governor',
      'Creative Genome (bandit weights)',
      'Rank Ladder',
    ],
    endpoints: {
      status: '/api/telegram/mobdial',
      wellKnown: '/.well-known/telegram-mobdial.json',
      human: '/tg',
    },
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  if (action === 'start') return start(input);
  if (action === 'stop') return stop();
  if (action === 'tick') return tick();
  if (action === 'echo') return postCausalEcho(!!input.force);
  if (action === 'issue' && input.from) return issueDial(input.from);
  if (action === 'click') return recordDialClick(input.code || input.dial, input);
  if (action === 'attribute') return attributeCheckout(input);
  if (action === 'rank') return { ok: true, top: topMembers(input.limit || 10) };
  if (action === 'gov_allow') return governorAllow(input.sender);
  if (action === 'gov_commit') { governorCommit(input.sender); return { ok: true }; }
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  stop();
  members = {};
  Object.assign(state, {
    startedAt: null, dialsIssued: 0, dialClicks: 0, attributedCheckouts: 0,
    attributedPaid: 0, echoes: 0, governorBlocks: 0, lastEchoAt: 0, lastTickAt: 0,
    sendTimestamps: [], creativeWeights: {}, swarmScore: 0,
  });
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

_load();

module.exports = {
  name: NAME,
  VERSION,
  start,
  stop,
  tick,
  issueDial,
  findByCode,
  buildDialUrl,
  checkoutUrl,
  recordDialClick,
  attributeCheckout,
  governorAllow,
  governorCommit,
  sendGoverned,
  postCausalEcho,
  welcomeWithDial,
  onMemberJoin,
  handleCommand,
  topMembers,
  pickCreativeId,
  getStatus,
  discovery,
  process: processInput,
  _resetForTests,
};
