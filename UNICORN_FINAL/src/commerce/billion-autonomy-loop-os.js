'use strict';

/**
 * Billion Autonomy Loop OS (BALOS/1.0)
 *
 * Closes the "no CJ / no traffic / no enterprise sales" gap with an honest
 * digital-first autonomous flywheel that does NOT invent GMV and does NOT
 * mark desk luxury as dispatchable.
 *
 * Loop (each tick):
 *  1. Select top buyable instant digital SKUs
 *  2. Submit money URLs via IndexNow (traffic-engine)
 *  3. Refresh outreach queue from real leads
 *  4. Optional Telegram profit-group CTA posts when armed
 *  5. Watch CJ arming — when key appears, pulse ZACC publish (never fake vids)
 *  6. Persist ledger + public status
 *
 * Enterprise inbound: notifyEnterpriseLead() hooks contact form → Telegram.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'BALOS/1.0';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');
const DATA_DIR = process.env.COMMERCE_DATA_DIR
  || path.join(process.cwd(), 'data', 'commerce');
const STATE_FILE = path.join(DATA_DIR, 'billion-autonomy-loop-state.json');
const LEDGER_FILE = path.join(DATA_DIR, 'billion-autonomy-loop.jsonl');
const MAX_LEDGER = 2000;
const DEFAULT_INTERVAL_MS = Math.max(
  15 * 60 * 1000,
  Number(process.env.BILLION_AUTONOMY_LOOP_MS || 60 * 60 * 1000)
);

const _counts = {
  ticks: 0,
  indexnowRuns: 0,
  indexnowUrls: 0,
  telegramPosts: 0,
  enterpriseNotifies: 0,
  cjPulses: 0,
  outreachBuilds: 0,
  errors: 0,
};

let _state = {
  startedAt: null,
  lastTickAt: null,
  lastResult: null,
  intervalMs: DEFAULT_INTERVAL_MS,
};
let _timer = null;

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') Object.assign(_state, raw);
  } catch (_) { /* ignore */ }
}

function _saveState() {
  try {
    _ensureDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(_state, null, 2));
  } catch (_) { /* ignore */ }
}

function _appendLedger(row) {
  try {
    _ensureDir();
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(Object.assign({ ts: new Date().toISOString(), protocol: PROTOCOL }, row)) + '\n');
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
    const lines = raw.split(/\n+/).filter(Boolean);
    if (lines.length > MAX_LEDGER) {
      fs.writeFileSync(LEDGER_FILE, lines.slice(-Math.floor(MAX_LEDGER / 2)).join('\n') + '\n');
    }
  } catch (_) { /* ignore */ }
}

function topBuyableInstant(limit) {
  const n = Math.max(1, Math.min(24, Number(limit) || 12));
  let items = [];
  try {
    const instant = require('./instant-catalog');
    const buy = require('./commerce-buyability');
    const all = typeof instant.all === 'function' ? instant.all() : [];
    items = (all || [])
      .filter((p) => p && p.id && String(p.tier || '').toLowerCase() !== 'enterprise')
      .map((p) => {
        let a = { buyable: false };
        try { a = buy.assessBuyability(p); } catch (_) { /* ignore */ }
        return {
          id: p.id,
          title: p.title || p.name || p.id,
          priceUsd: Number(p.priceUSD != null ? p.priceUSD : p.priceUsd || p.price || 0),
          buyable: !!a.buyable,
          mode: a.mode || null,
          href: APP_URL + '/services/' + encodeURIComponent(p.id),
          checkoutHref: APP_URL + '/checkout/?plan=' + encodeURIComponent(p.id),
        };
      })
      .filter((p) => p.buyable && p.priceUsd > 0)
      .sort((a, b) => b.priceUsd - a.priceUsd)
      .slice(0, n);
  } catch (_) { items = []; }
  return items;
}

function moneyUrls(skus) {
  const list = Array.isArray(skus) ? skus : topBuyableInstant(12);
  const urls = new Set([
    APP_URL + '/',
    APP_URL + '/buy',
    APP_URL + '/services',
    APP_URL + '/store',
    APP_URL + '/pricing',
    APP_URL + '/enterprise',
    APP_URL + '/affiliate',
    APP_URL + '/wizard',
    APP_URL + '/checkout',
  ]);
  for (const s of list) {
    if (s.href) urls.add(s.href);
    if (s.checkoutHref) urls.add(s.checkoutHref);
  }
  // Billion-scale deal desk surfaces (contact, not fake GMV)
  urls.add(APP_URL + '/enterprise#enterprise-contact');
  return Array.from(urls).slice(0, 80);
}

function cjArmStatus() {
  try {
    const cj = require('../../backend/modules/zacc/cj-api');
    const configured = !!(cj && typeof cj.isConfigured === 'function' && cj.isConfigured());
    return {
      armed: configured,
      honesty: configured
        ? 'CJ key present — ZACC may publish AUTO-SHIP vids on next pulse'
        : 'CJ unarmed — digital flywheel + enterprise inbound remain active; no fake dispatchable SKUs',
    };
  } catch (_) {
    const envArmed = !!(String(process.env.ZACC_CJ_API_KEY || process.env.CJ_API_KEY || '').trim());
    return {
      armed: envArmed,
      honesty: envArmed ? 'CJ env present' : 'CJ unarmed — digital flywheel active',
    };
  }
}

async function _runIndexNow(urls, dryRun) {
  try {
    const te = require('../../backend/modules/traffic-engine');
    if (!te || typeof te.pingAll !== 'function') {
      return { ok: false, reason: 'traffic_engine_unavailable' };
    }
    const submission = await te.pingAll({ urls, dryRun: !!dryRun });
    _counts.indexnowRuns += 1;
    _counts.indexnowUrls += Number(submission && submission.urlCount || urls.length || 0);
    return { ok: true, submission };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

function _runOutreach(dryRun) {
  try {
    const te = require('../../backend/modules/traffic-engine');
    if (!te || typeof te.buildOutreachQueue !== 'function') {
      return { ok: false, reason: 'traffic_engine_unavailable' };
    }
    if (dryRun) return { ok: true, dryRun: true };
    const snap = te.buildOutreachQueue({ limit: 40 });
    _counts.outreachBuilds += 1;
    return { ok: true, queued: snap && snap.queued, sending: snap && snap.sending };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

async function _runTelegramCta(skus, dryRun) {
  const top = (skus || []).slice(0, 3);
  if (!top.length) return { ok: false, reason: 'no_skus' };
  try {
    const tpg = require('../../backend/modules/telegram-profit-group-os');
    if (!tpg) return { ok: false, reason: 'tpg_unavailable' };
    const lines = [
      '⚡ ZeusAI Autonomy Loop — buyable digital offers',
      ...top.map((s) => `• ${s.title} · $${s.priceUsd} → ${s.checkoutHref}`),
      'Enterprise: ' + APP_URL + '/enterprise#enterprise-contact',
      'Honesty: digital flywheel — CJ AUTO-SHIP only when supplier key is armed.',
    ];
    if (dryRun) return { ok: true, dryRun: true, preview: lines.join('\n') };
    let sent = null;
    if (typeof tpg.postValue === 'function') {
      sent = await Promise.resolve(tpg.postValue({
        title: 'Autonomy Loop offers',
        body: lines.join('\n'),
        url: top[0].checkoutHref,
      }));
    } else if (typeof tpg.sendGroup === 'function') {
      sent = await Promise.resolve(tpg.sendGroup(lines.join('\n')));
    } else {
      return { ok: false, reason: 'tpg_send_unavailable' };
    }
    if (sent && sent.ok === false) return { ok: false, detail: sent };
    _counts.telegramPosts += 1;
    return { ok: true, posted: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

async function _cjPulse(dryRun) {
  const arm = cjArmStatus();
  if (!arm.armed) return { ok: true, skipped: true, ...arm };
  if (dryRun) return { ok: true, dryRun: true, ...arm };
  try {
    const zacc = require('../../backend/modules/zacc');
    if (zacc && typeof zacc.worldFeedPulse === 'function') {
      const out = await Promise.resolve(zacc.worldFeedPulse('billion-autonomy-loop'));
      _counts.cjPulses += 1;
      return { ok: true, pulsed: true, arm, detail: out && (out.ok != null ? { ok: out.ok } : undefined) };
    }
    if (zacc && typeof zacc.tick === 'function') {
      const out = await Promise.resolve(zacc.tick('billion-autonomy-loop'));
      _counts.cjPulses += 1;
      return { ok: true, pulsed: true, arm, tick: true, detail: out && { ok: out.ok } };
    }
    return { ok: true, arm, pulsed: false, reason: 'zacc_pulse_unavailable' };
  } catch (e) {
    return { ok: false, arm, error: String(e && e.message || e).slice(0, 160) };
  }
}

/**
 * Notify owner channel of a real enterprise lead (best-effort).
 */
async function notifyEnterpriseLead(lead) {
  if (!lead || !lead.id) return { ok: false, reason: 'missing_lead' };
  const text = [
    '🔥 Enterprise lead',
    `ID: ${lead.id}`,
    `Name: ${lead.name || '—'}`,
    `Email: ${lead.email || '—'}`,
    `Company: ${lead.company || '—'}`,
    `Interest: ${lead.interest || '—'}`,
    lead.quoteId ? `Quote: ${lead.quoteId} ($${lead.netUsd != null ? lead.netUsd : '—'})` : null,
    lead.btcUri ? `BTC: ${lead.btcUri}` : null,
    APP_URL + '/enterprise',
  ].filter(Boolean).join('\n');
  let ok = false;
  try {
    const zac = require('../../backend/modules/zacAlertChannel');
    if (zac && typeof zac.sendTelegram === 'function') {
      await Promise.resolve(zac.sendTelegram(text));
      ok = true;
    }
  } catch (_) { /* fall through */ }
  try {
    const tpg = require('../../backend/modules/telegram-profit-group-os');
    if (tpg && typeof tpg.captureLead === 'function') {
      await Promise.resolve(tpg.captureLead(lead));
    } else if (!ok && tpg && typeof tpg.sendGroup === 'function') {
      await Promise.resolve(tpg.sendGroup(text));
      ok = true;
    }
  } catch (_) { /* ignore */ }
  if (ok) _counts.enterpriseNotifies += 1;
  _appendLedger({ type: 'enterprise_notify', leadId: lead.id, ok });
  return { ok };
}

async function tick(opts) {
  const o = opts || {};
  // Production interval passes forceLive:true. Tests default to dryRun.
  const effectiveDry = o.forceLive
    ? false
    : (o.dryRun != null ? !!o.dryRun : process.env.NODE_ENV === 'test');

  _counts.ticks += 1;
  const skus = topBuyableInstant(o.limit || 12);
  const urls = moneyUrls(skus);
  const actions = [];

  const indexnow = await _runIndexNow(urls, effectiveDry);
  actions.push({ type: 'indexnow_money_urls', ...indexnow, urlCount: urls.length });

  const outreach = _runOutreach(effectiveDry);
  actions.push({ type: 'outreach_queue', ...outreach });

  const tg = await _runTelegramCta(skus, effectiveDry);
  actions.push({ type: 'telegram_cta', ...tg });

  const cj = await _cjPulse(effectiveDry);
  actions.push({ type: 'cj_arm_watch', ...cj });

  // Ensure a stable owner referral code exists (no fake conversions).
  let referral = { ok: false };
  try {
    const ref = require('./referral-engine-real');
    if (ref && typeof ref.ensureTrackedCode === 'function') {
      const code = String(process.env.OWNER_REFERRAL_CODE || 'ZEUSAI').toUpperCase();
      if (!effectiveDry) ref.ensureTrackedCode(code);
      referral = { ok: true, code };
    }
  } catch (e) {
    referral = { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
  actions.push({ type: 'referral_owner_code', ...referral });

  const result = {
    ok: true,
    protocol: PROTOCOL,
    at: new Date().toISOString(),
    dryRun: effectiveDry,
    source: o.source || 'manual',
    skus: skus.map((s) => ({ id: s.id, priceUsd: s.priceUsd, checkoutHref: s.checkoutHref })),
    moneyUrlCount: urls.length,
    actions,
    honesty: 'Digital flywheel + enterprise inbound + IndexNow. Never invents GMV. Never marks non-CJ SKUs dispatchable.',
  };

  const failed = actions.filter((a) => a && a.ok === false).length;
  if (failed) _counts.errors += failed;

  _state.lastTickAt = result.at;
  _state.lastResult = {
    at: result.at,
    dryRun: effectiveDry,
    skuCount: skus.length,
    moneyUrlCount: urls.length,
    actionOk: actions.filter((a) => a && a.ok).length,
    actionFail: failed,
  };
  _saveState();
  _appendLedger({ type: 'tick', source: result.source, dryRun: effectiveDry, skuCount: skus.length, moneyUrlCount: urls.length });
  return result;
}

function status() {
  const skus = topBuyableInstant(8);
  const arm = cjArmStatus();
  let traffic = null;
  try {
    const te = require('../../backend/modules/traffic-engine');
    if (te && typeof te.getStatus === 'function') traffic = te.getStatus();
  } catch (_) { /* ignore */ }
  let enterpriseLeads = 0;
  try {
    const leadFile = path.join(process.cwd(), 'data', 'enterprise-leads.jsonl');
    if (fs.existsSync(leadFile)) {
      enterpriseLeads = fs.readFileSync(leadFile, 'utf8').split(/\n+/).filter(Boolean).length;
    }
  } catch (_) { /* ignore */ }

  return {
    ok: true,
    protocol: PROTOCOL,
    generatedAt: new Date().toISOString(),
    running: !!_timer,
    intervalMs: _state.intervalMs || DEFAULT_INTERVAL_MS,
    startedAt: _state.startedAt,
    lastTickAt: _state.lastTickAt,
    lastResult: _state.lastResult,
    counts: Object.assign({}, _counts),
    flywheel: {
      mode: 'digital_first',
      topSkus: skus,
      moneyUrlsSample: moneyUrls(skus).slice(0, 12),
      cj: arm,
      enterpriseLeadsPersisted: enterpriseLeads,
      traffic: traffic ? {
        running: traffic.running,
        lastRunAt: traffic.lastRunAt,
        urlInventory: traffic.urlInventory,
        lastSubmission: traffic.lastSubmission && {
          at: traffic.lastSubmission.at,
          urlCount: traffic.lastSubmission.urlCount,
        },
      } : null,
    },
    endpoints: {
      status: '/api/billion-scale/autonomy-loop',
      tick: 'POST /api/billion-scale/autonomy-loop/tick',
      profitPath: '/api/billion-scale/profit-path',
      enterpriseContact: 'POST /api/enterprise/contact',
    },
    honesty: 'Autonomy loop creates discovery + inbound + optional CJ pulse. Revenue still requires real buyers — never invented.',
    nextWithoutCj: [
      'IndexNow keeps submitting /services/instant-* money URLs',
      'Enterprise leads → Telegram/email when armed',
      'Telegram group CTAs when TPG credentials exist',
      'Owner referral code ready for ?ref= attribution',
      'When ZACC_CJ_API_KEY is set, next tick pulses AUTO-SHIP publish',
    ],
  };
}

function start(opts) {
  if (_timer) return { ok: true, alreadyRunning: true };
  if (process.env.DISABLE_BILLION_AUTONOMY_LOOP === '1') {
    return { ok: false, reason: 'disabled_by_env' };
  }
  _loadState();
  _state.startedAt = new Date().toISOString();
  _state.intervalMs = Number((opts && opts.intervalMs) || DEFAULT_INTERVAL_MS);
  _saveState();
  const kick = setTimeout(() => {
    tick({ source: 'boot', dryRun: false, forceLive: true }).catch((e) => {
      console.warn('[BALOS] boot tick failed:', e && e.message);
    });
  }, Number((opts && opts.bootDelayMs) || 120000));
  if (kick.unref) kick.unref();
  _timer = setInterval(() => {
    tick({ source: 'interval', dryRun: false, forceLive: true }).catch((e) => {
      console.warn('[BALOS] tick failed:', e && e.message);
    });
  }, _state.intervalMs);
  if (_timer.unref) _timer.unref();
  console.log('[BALOS] Billion Autonomy Loop started — interval ' + Math.round(_state.intervalMs / 60000) + 'min');
  return { ok: true, intervalMs: _state.intervalMs };
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  return { ok: true };
}

_loadState();

module.exports = {
  PROTOCOL,
  topBuyableInstant,
  moneyUrls,
  cjArmStatus,
  tick,
  status,
  start,
  stop,
  notifyEnterpriseLead,
  _counts,
};
