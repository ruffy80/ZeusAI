'use strict';

/**
 * Autonomy Money Surface OS (AMOS/1.0)
 *
 * Closes the discovery→intent leak: BALOS already selects buyable SKUs and
 * IndexNow-pings them, but buyers never saw them on the homepage and Telegram
 * CTAs soft-failed on a broken postValue(object) contract.
 *
 * AMOS:
 *  - Builds a public money surface payload (top buyable digital SKUs)
 *  - Renders SSR home strip HTML with real /checkout/?plan= CTAs
 *  - Posts money offers to Telegram via hard path (sendGroup → owner alert)
 *  - Never invents GMV
 */

const PROTOCOL = 'AMOS/1.0';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function topMoneySkus(limit) {
  let list = [];
  try {
    const balos = require('./billion-autonomy-loop-os');
    if (balos && typeof balos.topBuyableInstant === 'function') {
      list = balos.topBuyableInstant(limit || 6);
    }
  } catch (_) { /* fall through */ }
  if (!list.length) {
    try {
      const instant = require('./instant-catalog');
      const buy = require('./commerce-buyability');
      const all = typeof instant.all === 'function' ? instant.all() : [];
      list = (all || [])
        .filter((p) => p && p.id)
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
            checkoutHref: '/checkout/?plan=' + encodeURIComponent(p.id),
          };
        })
        .filter((p) => p.buyable && p.priceUsd > 0)
        .sort((a, b) => b.priceUsd - a.priceUsd)
        .slice(0, Math.max(1, Math.min(12, Number(limit) || 6)));
    } catch (_) {
      list = [];
    }
  }
  // RIVOS PECG — reorder by attested paid-evidence gravity when available
  try {
    const rivos = require('./revenue-invention-continuum-os');
    if (rivos && typeof rivos.reorderSkus === 'function' && list.length) {
      list = rivos.reorderSkus(list).slice(0, Math.max(1, Math.min(12, Number(limit) || 6)));
    }
  } catch (_) { /* ignore */ }
  return list;
}

function telegramArmed() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || process.env.ZEUS_TG_BOT_TOKEN || '').trim();
  const chat = String(
    process.env.ZEUS_TG_GROUP_CHAT_ID
    || process.env.TELEGRAM_CHAT_ID
    || process.env.TELEGRAM_OWNER_CHAT_ID
    || ''
  ).trim();
  return { bot: !!token, chat: !!chat, ready: !!(token && chat) };
}

/**
 * Hard Telegram path for money offers.
 * Prefer TPG.postMoneyOffers → sendGroup → owner zacAlertChannel.
 */
async function postMoneyOffers(skus, opts) {
  const o = opts || {};
  const top = (Array.isArray(skus) ? skus : topMoneySkus(3)).slice(0, 3);
  if (!top.length) return { ok: false, reason: 'no_skus' };
  const lines = [
    '⚡ ZeusAI Money Surface — buyable now',
    ...top.map((s) => {
      const href = s.checkoutHref && String(s.checkoutHref).startsWith('http')
        ? s.checkoutHref
        : (APP_URL + (s.checkoutHref || ('/checkout/?plan=' + encodeURIComponent(s.id))));
      return `• ${s.title} · $${s.priceUsd} → ${href}`;
    }),
    'Enterprise: ' + APP_URL + '/enterprise#enterprise-contact',
    'Buy hub: ' + APP_URL + '/buy',
  ];
  const text = lines.join('\n');
  if (o.dryRun) return { ok: true, dryRun: true, preview: text, channel: 'dry-run' };

  const armed = telegramArmed();
  let last = { ok: false, reason: 'not_attempted' };

  try {
    const tpg = require('../../backend/modules/telegram-profit-group-os');
    if (tpg && typeof tpg.postMoneyOffers === 'function') {
      last = await Promise.resolve(tpg.postMoneyOffers({
        lines,
        text,
        url: APP_URL + (top[0].checkoutHref || '/buy'),
        force: !!o.force,
      }));
      if (last && last.ok) return { ok: true, channel: 'tpg_postMoneyOffers', detail: last };
    }
    if (tpg && typeof tpg.sendGroup === 'function') {
      last = await Promise.resolve(tpg.sendGroup(text, { kind: 'money_surface' }));
      if (last && last.ok) return { ok: true, channel: 'tpg_sendGroup', detail: last };
      if (last && last.reason) {
        // keep reason (silenced / not_configured / etc.)
      }
    }
  } catch (e) {
    last = { ok: false, reason: 'tpg_error', error: String(e && e.message || e).slice(0, 120) };
  }

  // Owner alert fallback — never silent when bot+owner chat exist
  try {
    const zac = require('../../backend/modules/zacAlertChannel');
    if (zac && typeof zac.sendTelegram === 'function' && armed.bot) {
      await Promise.resolve(zac.sendTelegram(text));
      return { ok: true, channel: 'owner_alert_fallback', previous: last };
    }
  } catch (e) {
    last = { ok: false, reason: 'owner_alert_error', error: String(e && e.message || e).slice(0, 120) };
  }

  if (!armed.ready && !armed.bot) {
    return { ok: false, reason: 'not_configured', honesty: 'Telegram bot/chat not armed' };
  }
  return {
    ok: false,
    reason: (last && last.reason) || 'send_failed',
    detail: last,
    honesty: 'CTA attempted; not counted as posted',
  };
}

function homeMoneyStripHtml(opts) {
  const o = opts || {};
  const skus = Array.isArray(o.skus) ? o.skus : topMoneySkus(o.limit || 6);
  const catalogCount = Number(o.catalogCount || 0);
  const cards = skus.slice(0, 6).map((s) => {
    const checkout = s.checkoutHref && String(s.checkoutHref).startsWith('/')
      ? s.checkoutHref
      : ('/checkout/?plan=' + encodeURIComponent(s.id));
    const mode = String(s.mode || 'btc');
    const tag = mode === 'reserve' ? 'Reserve' : 'Buy now';
    return `<a class="card" href="${_esc(checkout)}" data-link data-amos-sku="${_esc(s.id)}" style="padding:16px;text-decoration:none;border:1px solid rgba(247,147,26,.35);background:rgba(8,10,18,.55);display:block">
      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#f7931a">${_esc(tag)}</div>
      <div style="font-size:15px;font-weight:700;margin:6px 0 4px;color:var(--ink)">${_esc(s.title)}</div>
      <div style="font-size:18px;font-weight:800;color:#ffd36a">$${Number(s.priceUsd || 0).toLocaleString('en-US')}</div>
      <div style="margin-top:10px;font-size:12.5px;color:var(--violet2)">Checkout → choose payment</div>
    </a>`;
  }).join('');

  return `<section id="homeMoneySurface" data-amos="1" style="margin:28px 0 0">
  <div class="section-title" style="margin-bottom:14px">
    <div>
      <span class="kicker" style="color:#f7931a">Autonomy Money Surface</span>
      <h2 style="margin:6px 0 4px;font-size:clamp(22px,2.6vw,32px)">Live offers the loop is <span class="grad">pushing to buyers</span></h2>
      <p style="margin:0;color:var(--ink-dim);font-size:14px;max-width:720px">${catalogCount ? (catalogCount + ' catalog products · ') : ''}Top buyable digital SKUs ranked by RIVOS paid-evidence gravity when available — real checkout links, no invented GMV.</p>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a class="btn btn-primary" href="/buy" data-link>Open /buy →</a>
      <a class="btn btn-ghost" href="/enterprise#enterprise-contact" data-link>Enterprise</a>
    </div>
  </div>
  <div class="grid phone-stack" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">${cards || '<div class="card" style="padding:16px;color:var(--ink-dim)">Money surface warming up — visit /buy.</div>'}</div>
</section>`;
}

function status() {
  const skus = topMoneySkus(8);
  const tg = telegramArmed();
  return {
    ok: true,
    protocol: PROTOCOL,
    generatedAt: new Date().toISOString(),
    skus,
    skuCount: skus.length,
    telegramArmed: tg,
    endpoints: {
      status: '/api/billion-scale/money-surface',
      autonomyLoop: '/api/billion-scale/autonomy-loop',
      homeAnchor: '/#homeMoneySurface',
    },
    honesty: 'Surfaces only buyable SKUs from catalog/BALOS. Never invents GMV or dispatchable dropship.',
  };
}

module.exports = {
  PROTOCOL,
  topMoneySkus,
  telegramArmed,
  postMoneyOffers,
  homeMoneyStripHtml,
  status,
};
