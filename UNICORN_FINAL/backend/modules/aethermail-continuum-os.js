// =====================================================================
// aethermail-continuum-os.js — AetherMail Continuum OS (AMC/1.0)
//
// INVENTION: Mail is not a mailbox — it is a causal continuum between
// humans and Unicorn autonomy.
//
// Nobody ships this combo as one OS:
//   • Intent Lattice     — multi-hypothesis classify every inbound epistle
//   • Reply Gravity      — auto-reply only when value ≫ spam/noise risk
//   • Epistle Dial (EDIAL) — bind each thread to a trackable commerce CTA
//                          (mirrors MobDial, but for email threads)
//   • Deferred Arming    — when SMTP_PASS missing, queue replies; flush
//                          the instant transport arms (no human restart ritual)
//   • Local Thought Channel — Ollama/llamaBridge when present; lattice
//                          templates otherwise (never fake "sent")
//   • Dual-Rail Echo     — owner Telegram gets inbound digest; customer
//                          gets the sovereign reply
//   • Hash-chained Ledger — proof every autonomous decision
//
// Receive: IMAP IDLE/poll (Yahoo/Gmail/any). Send: existing transactional
// transports (SMTP/Resend/Brevo) — never needs port 25.
//
// RO: agent de email autonom — citește, gândește, răspunde, leagă de Unicorn.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const net = require('net');

const NAME = 'aethermail-continuum-os';
const VERSION = 'AMC/1.0';
const SITE = String(
  process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://zeusai.pro'
).replace(/\/$/, '');

function _defaultDataDir() {
  const shared = '/var/www/unicorn/shared/data/aethermail';
  try { if (fs.existsSync('/var/www/unicorn/shared')) return shared; } catch (_) { /* ignore */ }
  return path.join(__dirname, '..', '..', 'data', 'aethermail');
}

const DATA_DIR = process.env.ZEUS_AETHERMAIL_DIR || _defaultDataDir();
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LEDGER = path.join(DATA_DIR, 'events.jsonl');
const QUEUE_FILE = path.join(DATA_DIR, 'outbound-queue.jsonl');
const THREADS_FILE = path.join(DATA_DIR, 'threads.json');

const DISABLED = String(process.env.ZEUS_AETHERMAIL_DISABLED || '') === '1';
const AUTO_REPLY = String(process.env.ZEUS_AETHERMAIL_AUTO_REPLY || '1') !== '0';
const POLL_MS = Math.max(15_000, Number(process.env.ZEUS_AETHERMAIL_POLL_MS) || 45_000);
const MAX_REPLY_DAY = Math.max(1, Number(process.env.ZEUS_AETHERMAIL_MAX_REPLY_DAY) || 40);
const GRAVITY_MIN = Math.max(10, Number(process.env.ZEUS_AETHERMAIL_GRAVITY_MIN) || 55);

let _timer = null;
let _started = false;
let _busy = false;
let _mailer = null;
let _llama = null;
let _zac = null;

try { _mailer = require('../../src/commerce/transactional-email'); } catch (_) { _mailer = null; }
try { _llama = require('./llamaBridge'); } catch (_) { _llama = null; }
try { _zac = require('./zacAlertChannel'); } catch (_) { _zac = null; }

const state = {
  startedAt: null,
  inbound: 0,
  classified: 0,
  replied: 0,
  queued: 0,
  flushed: 0,
  skippedGravity: 0,
  errors: 0,
  lastPollAt: 0,
  lastInboundAt: 0,
  lastReplyAt: 0,
  repliesToday: 0,
  repliesDayKey: '',
  lastUid: 0,
  armedTransport: false,
  imapOk: false,
  brain: 'lattice',
};

/** @type {Record<string, object>} */
let threads = {};

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

function _load() {
  try {
    if (fs.existsSync(STATE_FILE)) Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch (_) { /* ignore */ }
  try {
    if (fs.existsSync(THREADS_FILE)) threads = JSON.parse(fs.readFileSync(THREADS_FILE, 'utf8')) || {};
  } catch (_) { threads = {}; }
}

function _save() {
  _ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(THREADS_FILE, JSON.stringify(threads, null, 2));
  } catch (_) { /* ignore */ }
}

function _append(file, obj) {
  _ensureDir();
  try { fs.appendFileSync(file, `${JSON.stringify(obj)}\n`); } catch (_) { /* ignore */ }
}

function _env(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) return '';
  if (/^(your|skip|changeme|todo|placeholder|xxx+|none|null|undefined|tbd|n\/a)/i.test(v)) return '';
  return v;
}

function _realSecret(v) {
  return !!String(v || '').trim() && !/^(your|skip|changeme|todo|placeholder|xxx+|none|null|undefined|tbd|n\/a)/i.test(String(v));
}

function smtpArmed() {
  if (_mailer && typeof _mailer.isConfigured === 'function') {
    try { if (_mailer.isConfigured()) return true; } catch (_) { /* fall through */ }
  }
  if (_mailer && typeof _mailer.configuredProviders === 'function') {
    try {
      const t = _mailer.configuredProviders();
      if (Array.isArray(t) && t.length) return true;
    } catch (_) { /* fall through */ }
  }
  return !!(
    _realSecret(process.env.RESEND_API_KEY)
    || _realSecret(process.env.BREVO_API_KEY)
    || _realSecret(process.env.SENDINBLUE_API_KEY)
    || _realSecret(process.env.MAILERSEND_API_KEY)
    || (_realSecret(process.env.SMTP_HOST) && _realSecret(process.env.SMTP_USER) && _realSecret(process.env.SMTP_PASS))
  );
}

function imapConfig() {
  const user = _env('IMAP_USER') || _env('SMTP_USER');
  const pass = _env('IMAP_PASS') || _env('SMTP_PASS');
  let host = _env('IMAP_HOST');
  if (!host) {
    const smtp = (_env('SMTP_HOST') || '').toLowerCase();
    if (smtp.includes('yahoo')) host = 'imap.mail.yahoo.com';
    else if (smtp.includes('gmail') || smtp.includes('google')) host = 'imap.gmail.com';
    else if (smtp.includes('outlook') || smtp.includes('office365')) host = 'outlook.office365.com';
    else if (smtp) host = smtp.replace(/^smtp\./i, 'imap.');
  }
  const port = Number(process.env.IMAP_PORT || 993);
  return {
    host,
    port,
    user,
    pass,
    tls: String(process.env.IMAP_TLS || '1') !== '0',
    mailbox: process.env.IMAP_MAILBOX || 'INBOX',
  };
}

function imapArmed() {
  const c = imapConfig();
  return !!(c.host && c.user && c.pass);
}

function issueEpistleDial(fromEmail, subject) {
  const seed = `${String(fromEmail || '').toLowerCase()}|${String(subject || '').slice(0, 80)}`;
  const code = `EDIAL-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8).toUpperCase()}`;
  const cta = new URL(`${SITE}/services`);
  cta.searchParams.set('utm_source', 'email');
  cta.searchParams.set('utm_medium', 'aethermail');
  cta.searchParams.set('utm_campaign', 'amc-1');
  cta.searchParams.set('dial', code);
  cta.searchParams.set('ref', code);
  return { code, cta: cta.toString() };
}

// ── Intent Lattice ──────────────────────────────────────────────────────────

const INTENT_WEIGHTS = {
  order_status: ['order', 'payment', 'paid', 'invoice', 'btc', 'txid', 'checkout', 'receipt', 'comanda', 'plata'],
  sales: ['price', 'pricing', 'buy', 'purchase', 'plan', 'enterprise', 'quote', 'oferta', 'pret', 'catalog'],
  support: ['help', 'support', 'issue', 'bug', 'error', 'nu merge', 'problem', 'access', 'login', 'reset'],
  partnership: ['partner', 'collab', 'affiliate', 'integration', 'api', 'white-label'],
  spam: ['unsubscribe', 'lottery', 'crypto airdrop', 'nigerian', 'viagra', 'seo backlink', 'guest post cheap'],
  owner_ops: ['urgent', 'invoice from', 'server', 'downtime', 'dns'],
};

function classifyIntent(mail) {
  const blob = `${mail.subject || ''} ${mail.from || ''} ${mail.text || ''}`.toLowerCase();
  const scores = {};
  for (const [intent, words] of Object.entries(INTENT_WEIGHTS)) {
    scores[intent] = words.reduce((n, w) => n + (blob.includes(w) ? 1 : 0), 0);
  }
  // Structural signals
  if (/no-?reply|mailer-daemon|bounce|newsletter|notifications@/i.test(mail.from || '')) {
    scores.spam = (scores.spam || 0) + 5;
  }
  if ((mail.text || '').split('http').length > 6) scores.spam = (scores.spam || 0) + 2;

  let best = 'support';
  let bestScore = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) { bestScore = v; best = k; }
  }
  if (bestScore <= 0) best = 'sales'; // unknown inbound → treat as sales opportunity
  const confidence = Math.min(0.95, 0.35 + bestScore * 0.12);
  return { intent: best, confidence, scores, lattice: Object.keys(scores).filter((k) => scores[k] > 0) };
}

/**
 * Reply Gravity — invents the gate: do we spend an autonomous reply?
 * High score = reply. Low = archive/notify-only.
 */
function replyGravity(mail, classification) {
  let g = 40;
  const intent = classification.intent;
  if (intent === 'spam') return { score: 5, act: false, reason: 'spam_lattice' };
  if (intent === 'sales') g += 25;
  if (intent === 'order_status') g += 30;
  if (intent === 'support') g += 20;
  if (intent === 'partnership') g += 15;
  if (classification.confidence >= 0.5) g += 10;
  if (/zeusai|unicorn|btc|checkout|order/i.test(mail.subject || '')) g += 10;
  if (/^(re:|fw:|fwd:)/i.test(mail.subject || '')) g += 5;
  // Penalize bulk
  if (/list-unsubscribe/i.test(mail.headers || '')) g -= 40;
  if (!AUTO_REPLY) return { score: g, act: false, reason: 'auto_reply_off' };
  const act = g >= GRAVITY_MIN;
  return { score: Math.max(0, Math.min(100, g)), act, reason: act ? 'gravity_clear' : 'below_threshold' };
}

function _rollDay() {
  const k = _dayKey();
  if (state.repliesDayKey !== k) {
    state.repliesDayKey = k;
    state.repliesToday = 0;
  }
}

// ── Reply synthesis ─────────────────────────────────────────────────────────

function latticeReply(mail, classification, dial) {
  const name = (mail.fromName || mail.from || 'there').split(/[\s<]/)[0] || 'there';
  const intent = classification.intent;
  const openers = {
    sales: `Thanks for writing, ${name}. ZeusAI Unicorn runs autonomous commerce — BTC, PayPal, and NOWPayments — without a human sitting on the keyboard.`,
    order_status: `Thanks ${name}. I can help with order / payment status. If you have an order id (ord_…), reply with it and I'll check the sovereign ledger.`,
    support: `Hi ${name} — support signal received. Share the page URL + what you expected vs what happened, and I'll route it through the Unicorn heal loop.`,
    partnership: `Hello ${name}. Partnerships go through our enterprise rail. Tell me volume, region, and whether you need API / white-label.`,
    owner_ops: `Ops note acknowledged.`,
    spam: '',
  };
  const body = [
    openers[intent] || openers.support,
    '',
    `Your Epistle Dial (trackable): ${dial.code}`,
    `Catalog → ${dial.cta}`,
    `Live site → ${SITE}`,
    `Telegram swarm → ${SITE}/tg`,
    '',
    '— AetherMail Continuum · ZeusAI (autonomous)',
  ].filter(Boolean).join('\n');
  const subjects = {
    sales: `Re: ${mail.subject || 'ZeusAI catalog'}`,
    order_status: `Re: ${mail.subject || 'Order status'}`,
    support: `Re: ${mail.subject || 'Support'}`,
    partnership: `Re: ${mail.subject || 'Partnership'}`,
  };
  return {
    subject: subjects[intent] || `Re: ${mail.subject || 'ZeusAI'}`,
    text: body,
  };
}

async function synthesizeReply(mail, classification, dial) {
  const fallback = latticeReply(mail, classification, dial);
  state.brain = 'lattice';
  if (_llama && typeof _llama.generate === 'function') {
    try {
      const prompt = [
        'You are AetherMail, the autonomous email continuum for ZeusAI (zeusai.pro).',
        'Write a short, helpful, non-spammy reply (max 180 words). No fake claims. BTC-first commerce.',
        `Intent: ${classification.intent} (confidence ${classification.confidence})`,
        `From: ${mail.from}`,
        `Subject: ${mail.subject}`,
        `Body: ${String(mail.text || '').slice(0, 1200)}`,
        `Include this dial link once: ${dial.cta}`,
        'Sign as: AetherMail Continuum · ZeusAI',
      ].join('\n');
      const ai = await _llama.generate(prompt, 3, 'AetherMail AMC/1.0');
      if (ai && ai.length > 40) {
        state.brain = 'ollama';
        return { subject: fallback.subject, text: ai.slice(0, 3500), brain: 'ollama' };
      }
    } catch (_) { /* lattice fallback */ }
  }
  return { ...fallback, brain: 'lattice' };
}

// ── Outbound (honest) ───────────────────────────────────────────────────────

async function sendReply(to, subject, text, meta) {
  _rollDay();
  if (state.repliesToday >= MAX_REPLY_DAY) {
    return { ok: false, reason: 'daily_cap' };
  }
  if (!smtpArmed()) {
    _append(QUEUE_FILE, {
      ts: new Date().toISOString(),
      to, subject, text,
      meta: meta || {},
      status: 'queued_unarmed',
    });
    state.queued += 1;
    _save();
    return { ok: false, reason: 'smtp_unarmed_queued', queued: true };
  }

  // Prefer raw send via nodemailer path inside transactional-email if present
  let result = { ok: false, reason: 'no_transport' };
  try {
    if (_mailer && typeof _mailer.sendRaw === 'function') {
      result = await _mailer.sendRaw({ to, subject, text, html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>` });
    } else if (_mailer && typeof _mailer.sendTransactional === 'function') {
      // Fallback: abuse welcome template shape is wrong — use sendRaw only
      result = { ok: false, reason: 'sendRaw_missing' };
    }
  } catch (e) {
    result = { ok: false, reason: e && e.message };
  }

  // Direct nodemailer fallback
  if (!result.ok) {
    try {
      let nodemailer;
      try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }
      if (nodemailer && _realSecret(process.env.SMTP_HOST) && _realSecret(process.env.SMTP_PASS)) {
        const t = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        const info = await t.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to,
          subject,
          text,
          headers: {
            'X-Zeus-AetherMail': VERSION,
            'X-Zeus-Epistle-Dial': (meta && meta.dial) || '',
          },
        });
        result = { ok: true, id: info.messageId, transport: 'smtp' };
      }
    } catch (e) {
      result = { ok: false, reason: e && e.message };
    }
  }

  if (result && result.ok) {
    state.replied += 1;
    state.repliesToday += 1;
    state.lastReplyAt = Date.now();
    _append(LEDGER, {
      ts: new Date().toISOString(),
      type: 'reply_sent',
      to,
      subject,
      dial: meta && meta.dial,
      intent: meta && meta.intent,
      brain: meta && meta.brain,
      transport: result.transport || 'mailer',
    });
    _save();
  } else {
    state.errors += 1;
    _append(LEDGER, { ts: new Date().toISOString(), type: 'reply_fail', to, reason: result.reason });
    _save();
  }
  return result;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Flush deferred queue once SMTP arms. */
async function flushQueue() {
  if (!smtpArmed()) return { ok: false, reason: 'still_unarmed' };
  if (!fs.existsSync(QUEUE_FILE)) return { ok: true, flushed: 0 };
  const lines = fs.readFileSync(QUEUE_FILE, 'utf8').split(/\n/).filter(Boolean);
  const remain = [];
  let flushed = 0;
  for (const ln of lines) {
    let row;
    try { row = JSON.parse(ln); } catch (_) { continue; }
    if (row.status === 'sent') continue;
    // eslint-disable-next-line no-await-in-loop
    const r = await sendReply(row.to, row.subject, row.text, row.meta || {});
    if (r.ok) {
      flushed += 1;
      state.flushed += 1;
    } else if (r.reason === 'smtp_unarmed_queued') {
      remain.push(ln);
    } else {
      remain.push(JSON.stringify({ ...row, status: 'failed', failReason: r.reason }));
    }
  }
  fs.writeFileSync(QUEUE_FILE, remain.length ? `${remain.join('\n')}\n` : '');
  _save();
  return { ok: true, flushed, remaining: remain.length };
}

// ── Minimal IMAP (TLS) ──────────────────────────────────────────────────────

class MiniImap {
  constructor(cfg) {
    this.cfg = cfg;
    this.socket = null;
    this.buf = '';
    this.tag = 0;
    this._waiters = [];
  }

  _nextTag() {
    this.tag += 1;
    return `A${this.tag}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const onReady = () => {
        this.socket.on('data', (d) => this._onData(d));
        this.socket.on('error', (e) => reject(e));
        // wait for server greeting
        this._expect(/^\* OK/i, 15000).then(resolve).catch(reject);
      };
      if (this.cfg.tls) {
        this.socket = tls.connect({ host: this.cfg.host, port: this.cfg.port, servername: this.cfg.host }, onReady);
      } else {
        this.socket = net.connect({ host: this.cfg.host, port: this.cfg.port }, onReady);
      }
      this.socket.setEncoding('utf8');
      this.socket.setTimeout(60_000);
    });
  }

  _onData(d) {
    this.buf += d;
    // Resolve waiters scanning full buffer
    for (const w of [...this._waiters]) {
      if (w.re.test(this.buf)) {
        this._waiters = this._waiters.filter((x) => x !== w);
        clearTimeout(w.timer);
        const m = this.buf;
        // keep buffer; tagged commands clear themselves
        w.resolve(m);
      }
    }
  }

  _expect(re, ms) {
    return new Promise((resolve, reject) => {
      if (re.test(this.buf)) return resolve(this.buf);
      const timer = setTimeout(() => {
        this._waiters = this._waiters.filter((x) => x.resolve !== resolve);
        reject(new Error('imap_timeout'));
      }, ms || 20000);
      this._waiters.push({ re, resolve, reject, timer });
    });
  }

  async cmd(command) {
    const tag = this._nextTag();
    this.buf = '';
    this.socket.write(`${tag} ${command}\r\n`);
    const re = new RegExp(`^${tag} (OK|NO|BAD)`, 'mi');
    const raw = await this._expect(re, 30000);
    const ok = new RegExp(`^${tag} OK`, 'mi').test(raw);
    return { ok, raw, tag };
  }

  async login() {
    // Prefer AUTHENTICATE PLAIN is harder; LOGIN is fine for app passwords
    const user = this.cfg.user.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const pass = this.cfg.pass.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.cmd(`LOGIN "${user}" "${pass}"`);
  }

  async select(mailbox) {
    return this.cmd(`SELECT "${mailbox}"`);
  }

  async searchUnseen() {
    const r = await this.cmd('UID SEARCH UNSEEN');
    if (!r.ok) return [];
    const m = r.raw.match(/\* SEARCH([\d\s]*)/i);
    if (!m) return [];
    return m[1].trim().split(/\s+/).map(Number).filter(Boolean);
  }

  async fetchRfc822(uid) {
    const tag = this._nextTag();
    this.buf = '';
    this.socket.write(`${tag} UID FETCH ${uid} (RFC822)\r\n`);
    const re = new RegExp(`^${tag} (OK|NO|BAD)`, 'mi');
    const raw = await this._expect(re, 60000);
    if (!new RegExp(`^${tag} OK`, 'mi').test(raw)) return null;
    // Extract body between first {n}\r\n and the closing )
    const start = raw.indexOf('}\r\n');
    if (start < 0) {
      const alt = raw.indexOf('}\n');
      if (alt < 0) return raw;
      return raw.slice(alt + 2);
    }
    return raw.slice(start + 3);
  }

  async storeSeen(uid) {
    return this.cmd(`UID STORE ${uid} +FLAGS (\\Seen)`);
  }

  async logout() {
    try { await this.cmd('LOGOUT'); } catch (_) { /* ignore */ }
    try { this.socket.destroy(); } catch (_) { /* ignore */ }
  }
}

function parseRfc822(raw) {
  const text = String(raw || '');
  const headEnd = text.search(/\r?\n\r?\n/);
  const head = headEnd >= 0 ? text.slice(0, headEnd) : text.slice(0, 2000);
  const body = headEnd >= 0 ? text.slice(headEnd).replace(/^\r?\n\r?\n/, '') : '';
  const get = (name) => {
    const re = new RegExp(`^${name}:\\s*(.+)$`, 'im');
    const m = head.match(re);
    return m ? m[1].trim() : '';
  };
  const fromRaw = get('From');
  const fromMatch = fromRaw.match(/<([^>]+)>/) || fromRaw.match(/([\w.+-]+@[\w.-]+)/);
  const from = fromMatch ? fromMatch[1] : fromRaw;
  const fromName = fromRaw.replace(/<[^>]+>/, '').replace(/"/g, '').trim();
  // strip simple quoted-printable / html crud for classification
  let plain = body;
  if (/Content-Type:\s*text\/html/i.test(head) || /<html/i.test(body)) {
    plain = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  plain = plain.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => {
    try { return String.fromCharCode(parseInt(h, 16)); } catch (_) { return ''; }
  });
  return {
    from,
    fromName,
    subject: get('Subject').replace(/=\?UTF-8\?B\?(.+?)\?=/gi, (_, b) => {
      try { return Buffer.from(b, 'base64').toString('utf8'); } catch (_) { return _; }
    }),
    messageId: get('Message-ID') || get('Message-Id'),
    headers: head.slice(0, 2000),
    text: plain.slice(0, 8000),
  };
}

async function notifyOwner(text) {
  try {
    if (_zac && typeof _zac.sendTelegram === 'function') {
      await Promise.resolve(_zac.sendTelegram(String(text).slice(0, 3500)));
      return { ok: true, rail: 'telegram' };
    }
  } catch (_) { /* ignore */ }
  return { ok: false };
}

async function processMessage(mail, uid) {
  state.inbound += 1;
  state.lastInboundAt = Date.now();
  const classification = classifyIntent(mail);
  state.classified += 1;
  const gravity = replyGravity(mail, classification);
  const dial = issueEpistleDial(mail.from, mail.subject);
  const threadKey = String(mail.messageId || `${mail.from}:${mail.subject}`).slice(0, 180);
  const prevHash = threads[threadKey] && threads[threadKey].hash;
  const hash = crypto.createHash('sha256').update(JSON.stringify({
    prevHash, from: mail.from, subject: mail.subject, intent: classification.intent, ts: Date.now(),
  })).digest('hex').slice(0, 16);

  threads[threadKey] = {
    from: mail.from,
    subject: mail.subject,
    intent: classification.intent,
    dial: dial.code,
    gravity: gravity.score,
    hash,
    prevHash: prevHash || null,
    updatedAt: new Date().toISOString(),
  };

  _append(LEDGER, {
    ts: new Date().toISOString(),
    type: 'inbound',
    uid,
    from: mail.from,
    subject: mail.subject,
    intent: classification.intent,
    confidence: classification.confidence,
    gravity: gravity.score,
    act: gravity.act,
    dial: dial.code,
    hash,
  });

  // Dual-rail: always echo interesting mail to owner Telegram
  if (gravity.score >= 30 && classification.intent !== 'spam') {
    await notifyOwner([
      '📬 AetherMail inbound',
      `From: ${mail.from}`,
      `Subject: ${mail.subject}`,
      `Intent: ${classification.intent} (${Math.round(classification.confidence * 100)}%)`,
      `Gravity: ${gravity.score} · ${gravity.act ? 'AUTO-REPLY' : 'notify-only'}`,
      `Dial: ${dial.code}`,
    ].join('\n'));
  }

  let replyResult = { ok: false, reason: 'gravity_skip' };
  if (gravity.act) {
    const draft = await synthesizeReply(mail, classification, dial);
    replyResult = await sendReply(mail.from, draft.subject, draft.text, {
      dial: dial.code,
      intent: classification.intent,
      brain: draft.brain,
      uid,
    });
    if (!replyResult.ok && replyResult.reason === 'smtp_unarmed_queued') {
      await notifyOwner(`⏸ AetherMail queued reply to ${mail.from} (add SMTP_PASS to flush). Dial ${dial.code}`);
    }
  } else {
    state.skippedGravity += 1;
  }

  _save();
  return { ok: true, classification, gravity, dial, replyResult, hash };
}

async function pollInbox() {
  if (DISABLED || _busy) return { ok: false, reason: _busy ? 'busy' : 'disabled' };
  if (!imapArmed()) {
    state.imapOk = false;
    state.armedTransport = smtpArmed();
    _save();
    return { ok: false, reason: 'imap_unarmed' };
  }
  _busy = true;
  state.lastPollAt = Date.now();
  state.armedTransport = smtpArmed();
  const cfg = imapConfig();
  const client = new MiniImap(cfg);
  const processed = [];
  try {
    await client.connect();
    const login = await client.login();
    if (!login.ok) throw new Error('imap_login_failed');
    const sel = await client.select(cfg.mailbox);
    if (!sel.ok) throw new Error('imap_select_failed');
    state.imapOk = true;
    const uids = await client.searchUnseen();
    const fresh = uids.filter((u) => u > (state.lastUid || 0)).slice(-10);
    for (const uid of fresh) {
      // eslint-disable-next-line no-await-in-loop
      const raw = await client.fetchRfc822(uid);
      const mail = parseRfc822(raw);
      // eslint-disable-next-line no-await-in-loop
      const out = await processMessage(mail, uid);
      processed.push({ uid, intent: out.classification.intent, replied: !!(out.replyResult && out.replyResult.ok) });
      // eslint-disable-next-line no-await-in-loop
      await client.storeSeen(uid);
      state.lastUid = Math.max(state.lastUid || 0, uid);
    }
    await client.logout();
    if (smtpArmed() && state.queued > 0) await flushQueue();
    _save();
    return { ok: true, processed: processed.length, details: processed };
  } catch (e) {
    state.errors += 1;
    state.imapOk = false;
    _append(LEDGER, { ts: new Date().toISOString(), type: 'poll_error', error: e && e.message });
    _save();
    try { await client.logout(); } catch (_) { /* ignore */ }
    return { ok: false, reason: e && e.message };
  } finally {
    _busy = false;
  }
}

async function tick() {
  // Detect SMTP arming transition → flush
  const armed = smtpArmed();
  if (armed && !state.armedTransport) {
    state.armedTransport = true;
    await flushQueue();
    await notifyOwner('✅ AetherMail transport armed — deferred reply queue flushing.');
  }
  state.armedTransport = armed;
  return pollInbox();
}

function start(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  if (_started && !(opts && opts.force)) return { ok: true, already: true };
  _load();
  state.startedAt = state.startedAt || new Date().toISOString();
  state.armedTransport = smtpArmed();
  _started = true;
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => { tick().catch(() => {}); }, POLL_MS);
  if (_timer.unref) _timer.unref();
  setTimeout(() => { tick().catch(() => {}); }, 8_000).unref?.();
  _save();
  return {
    ok: true,
    module: NAME,
    protocol: VERSION,
    pollMs: POLL_MS,
    imapArmed: imapArmed(),
    smtpArmed: state.armedTransport,
    autoReply: AUTO_REPLY,
  };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  _started = false;
  _save();
  return { ok: true };
}

function getStatus() {
  state.armedTransport = smtpArmed();
  const cfg = imapConfig();
  return {
    ok: true,
    module: NAME,
    protocol: VERSION,
    invention: 'Causal email continuum with Intent Lattice, Reply Gravity, Epistle Dials, Deferred Arming',
    started: _started || !!state.startedAt,
    startedAt: state.startedAt,
    disabled: DISABLED,
    autoReply: AUTO_REPLY,
    smtpArmed: state.armedTransport,
    imapArmed: imapArmed(),
    imapOk: state.imapOk,
    imapHost: cfg.host || null,
    imapUser: cfg.user ? `${cfg.user.slice(0, 2)}…${cfg.user.slice(-4)}` : null,
    brain: state.brain,
    inbound: state.inbound,
    classified: state.classified,
    replied: state.replied,
    queued: state.queued,
    flushed: state.flushed,
    skippedGravity: state.skippedGravity,
    errors: state.errors,
    repliesToday: state.repliesToday,
    maxReplyDay: MAX_REPLY_DAY,
    gravityMin: GRAVITY_MIN,
    lastPollAt: state.lastPollAt ? new Date(state.lastPollAt).toISOString() : null,
    lastInboundAt: state.lastInboundAt ? new Date(state.lastInboundAt).toISOString() : null,
    lastReplyAt: state.lastReplyAt ? new Date(state.lastReplyAt).toISOString() : null,
    threadCount: Object.keys(threads).length,
    waitingFor: [
      !imapArmed() && !smtpArmed() ? 'SMTP_PASS (also arms IMAP if IMAP_PASS unset)' : null,
      imapArmed() && !smtpArmed() ? 'SMTP_PASS to flush queued replies' : null,
      !imapArmed() && smtpArmed() ? 'IMAP_PASS or same SMTP_PASS for receive' : null,
    ].filter(Boolean),
    site: SITE,
    endpoints: {
      status: '/api/aethermail/status',
      discovery: '/api/aethermail/discovery',
      tick: '/api/aethermail/tick',
      wellKnown: '/.well-known/aethermail.json',
      human: '/aethermail',
    },
    generatedAt: new Date().toISOString(),
  };
}

function discovery() {
  return {
    protocol: VERSION,
    name: 'AetherMail Continuum OS',
    purpose: 'Autonomous inbound→intent→gravity→reply continuum that arms when SMTP_PASS lands and binds every thread to Unicorn commerce.',
    inventions: [
      'Intent Lattice',
      'Reply Gravity',
      'Epistle Dial (EDIAL)',
      'Deferred Arming Queue',
      'Local Thought Channel (Ollama)',
      'Hash-chained Thread Ledger',
      'Telegram Dual-Rail Echo',
    ],
    endpoints: {
      status: '/api/aethermail/status',
      wellKnown: '/.well-known/aethermail.json',
      human: '/aethermail',
    },
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  if (action === 'start') return start(input);
  if (action === 'stop') return stop();
  if (action === 'tick' || action === 'poll') return tick();
  if (action === 'flush') return flushQueue();
  if (action === 'classify' && input.mail) return classifyIntent(input.mail);
  if (action === 'gravity' && input.mail) {
    const c = classifyIntent(input.mail);
    return replyGravity(input.mail, c);
  }
  if (action === 'simulate' && input.mail) {
    return processMessage(input.mail, input.uid || Date.now());
  }
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  stop();
  threads = {};
  Object.assign(state, {
    startedAt: null, inbound: 0, classified: 0, replied: 0, queued: 0, flushed: 0,
    skippedGravity: 0, errors: 0, lastPollAt: 0, lastInboundAt: 0, lastReplyAt: 0,
    repliesToday: 0, repliesDayKey: '', lastUid: 0, armedTransport: false, imapOk: false, brain: 'lattice',
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
  pollInbox,
  flushQueue,
  processMessage,
  classifyIntent,
  replyGravity,
  issueEpistleDial,
  synthesizeReply,
  smtpArmed,
  imapArmed,
  imapConfig,
  parseRfc822,
  getStatus,
  discovery,
  process: processInput,
  _resetForTests,
};
