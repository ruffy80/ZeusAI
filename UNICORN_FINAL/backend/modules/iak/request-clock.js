// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

/**
 * Request Solution Clock — RCLK/1.0
 *
 * Every inbound request walks the same six beats: hear, match, deliver,
 * price, gate, close. The match comes from the public shelf. The price is
 * the list price. Bitcoin collects 10% under that list. Card and PayPal
 * collect the list price when they are configured. Delivery fee is $0 and
 * the file stays with the buyer. Cost is not measured, so margin is not
 * claimed. A refund or a restart is not executed.
 */

const PROTOCOL = 'RCLK/1.0';
const ORCHESTRATOR = 'IAK/1.1';
const BEATS = Object.freeze(['hear', 'match', 'deliver', 'price', 'gate', 'close']);

let _last = null;

function usd(n) {
  const price = Number(n);
  if (!Number.isFinite(price)) return null;
  const frac = Math.abs(price - Math.round(price)) > 0.0049;
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 });
}

function bitcoinUsd(listUsd) {
  const n = Number(listUsd);
  if (!Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  return Math.round(cents * 90 / 100) / 100;
}

function dutyOf(text) {
  const q = String(text || '').toLowerCase();
  if (/\b(refund|ramburs|chargeback|redeploy|restart)\b/.test(q) || /migrate production/.test(q)) {
    return 'owner_gate';
  }
  return 'client_offer';
}

function beat(name, fn) {
  const started = Date.now();
  let value = null;
  let error = null;
  try {
    value = fn();
  } catch (e) {
    error = String(e && e.message || e).slice(0, 180);
  }
  return { name, ms: Date.now() - started, error, value };
}

function shelfAdvise(text) {
  return require('../../../src/commerce/public-shelf').advise(text);
}

function deliveryPack(serviceId) {
  return require('../native-capability-desk').productPack(serviceId);
}

function solve(text) {
  const beats = [];
  const heardBeat = beat('hear', () => {
    const heard = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
    return { heard, duty: dutyOf(heard) };
  });
  beats.push(heardBeat);
  const heard = (heardBeat.value && heardBeat.value.heard) || '';
  const duty = (heardBeat.value && heardBeat.value.duty) || 'client_offer';

  const matchBeat = beat('match', () => shelfAdvise(heard));
  beats.push(matchBeat);
  const advice = matchBeat.value || {};
  const primary = advice.primary || null;
  const lang = advice.lang === 'ro' ? 'ro' : 'en';
  const gated = duty === 'owner_gate';

  const deliverBeat = beat('deliver', () => {
    if (gated || !primary || !primary.id) return { skipped: true, fileTitle: null, verified: false, kind: null };
    const pack = deliveryPack(primary.id);
    const verdict = pack && pack.verdict;
    const doc = pack && pack.parts && pack.parts.documentation;
    return {
      skipped: false,
      fileTitle: doc && doc.fileTitle || null,
      verified: !!(verdict && verdict.pass),
      kind: doc && doc.kind || null,
      filesWritten: (pack && pack.filesWritten) || [],
    };
  });
  beats.push(deliverBeat);
  const delivery = deliverBeat.value || { skipped: true, fileTitle: null, verified: false, kind: null, filesWritten: [] };

  const priceBeat = beat('price', () => {
    if (gated || !primary || !(Number(primary.priceUsd) > 0)) {
      return { listUsd: null, listLabel: null, bitcoinUsd: null, cardUsd: null, deliveryFeeUsd: 0 };
    }
    const listUsd = Number(primary.priceUsd);
    const buyable = primary.buyable === true && primary.mode !== 'contact' && primary.mode !== 'unavailable';
    return {
      listUsd,
      listLabel: primary.priceLabel || usd(listUsd),
      bitcoinUsd: buyable ? bitcoinUsd(listUsd) : null,
      cardUsd: buyable ? listUsd : null,
      deliveryFeeUsd: 0,
    };
  });
  beats.push(priceBeat);
  const price = priceBeat.value || { listUsd: null, listLabel: null, bitcoinUsd: null, cardUsd: null, deliveryFeeUsd: 0 };

  const gateBeat = beat('gate', () => {
    if (!gated) return { requiresHuman: false, applied: false, kind: 'offer' };
    return { requiresHuman: true, applied: false, kind: 'owner_gate' };
  });
  beats.push(gateBeat);

  const buyable = !gated && primary && primary.buyable === true && primary.mode !== 'contact' && primary.mode !== 'unavailable';
  let fit = 'none';
  if (!gated && primary && primary.role === 'match') fit = 'match';
  else if (!gated && primary) fit = primary.role || 'start';
  let action = 'ask_again';
  if (gated) action = 'wait_for_owner';
  else if (buyable) action = 'checkout';
  else if (primary) action = 'open_offer';

  const closeBeat = beat('close', () => ({ action, fit }));
  beats.push(closeBeat);

  const reply = composeReply({ lang, advice, primary, price, delivery, gated, buyable });
  const offer = (!gated && primary) ? Object.assign({}, primary, {
    priceNote: priceNote(lang, price, buyable),
  }) : null;

  const out = {
    protocol: PROTOCOL,
    orchestrator: ORCHESTRATOR,
    ok: true,
    at: new Date().toISOString(),
    heard,
    lang,
    fit,
    action,
    reply,
    client: {
      offerId: offer ? offer.id : null,
      title: offer ? offer.title : null,
      checkout: buyable ? primary.ctaHref : (offer && offer.ctaHref) || null,
      buyable: !!buyable,
      receives: offer ? offer.strategy : null,
      offer,
    },
    price: Object.assign({ fileStaysWithBuyer: true }, price),
    owner: {
      collects: buyable ? 'published_price' : 'nothing_until_a_person_decides',
      listUsd: buyable ? price.listUsd : null,
      bitcoinUsd: buyable ? price.bitcoinUsd : null,
      cardUsd: buyable ? price.cardUsd : null,
      marginUsd: null,
      marginMeasured: false,
      reason: buyable
        ? 'The amount collected is the published price. Bitcoin is 10% under the list. Card and PayPal collect the list when configured. Cost is not measured, so margin is not claimed.'
        : 'This request does not collect a payment.',
    },
    delivery: {
      fileTitle: delivery.fileTitle || null,
      verified: delivery.verified === true,
      kind: delivery.kind || null,
    },
    gate: gateBeat.value,
    beats: beats.map((row) => ({ name: row.name, ms: row.ms, error: row.error })),
    limits: advice.limits || [],
    also: gated ? [] : (advice.also || []),
    applied: false,
    spent: false,
    externalModel: false,
    filesWritten: [],
  };
  _last = { at: out.at, fit: out.fit, action: out.action, offerId: out.client.offerId };
  return out;
}

function priceNote(lang, price, buyable) {
  if (!price || price.listUsd == null) return '';
  if (!buyable) {
    return lang === 'ro'
      ? (price.listLabel + ' · nu este un coș')
      : (price.listLabel + ' · not a cart');
  }
  const btc = usd(price.bitcoinUsd);
  return lang === 'ro'
    ? ('Listă ' + price.listLabel + ' · Bitcoin ' + btc + ' · livrare $0')
    : ('List ' + price.listLabel + ' · Bitcoin ' + btc + ' · delivery $0');
}

function composeReply({ lang, advice, primary, price, delivery, gated, buyable }) {
  const ro = lang === 'ro';
  if (gated) {
    return ro
      ? 'Cererea schimbă o plată sau producția. Nu am rambursat, nu am repornit și nu am încasat nimic. Rămâne pentru o decizie umană.'
      : 'This request changes a payment or production. Nothing was refunded, restarted, or charged. It waits for a person.';
  }
  const lines = [];
  if (advice && advice.question) lines.push(advice.question);
  if (!primary) return lines.join('\n');
  if (buyable && price && price.listLabel) {
    const btc = usd(price.bitcoinUsd);
    lines.push(ro
      ? ('Oferta potrivită este ' + primary.title + '. Lista este ' + price.listLabel + '. Bitcoin, calea deschisă, este ' + btc + '. Cardul și PayPal încasează lista când sunt configurate. Livrarea fișierului este $0 și fișierul rămâne la tine.')
      : ('The matched offer is ' + primary.title + '. The list price is ' + price.listLabel + '. Bitcoin, the live rail, is ' + btc + '. Card and PayPal collect the list price when they are configured. File delivery is $0 and you keep the file.'));
    if (delivery && delivery.verified && delivery.fileTitle) {
      lines.push(ro
        ? ('Fișierul verificat se numește ' + delivery.fileTitle + '.')
        : ('The verified file is ' + delivery.fileTitle + '.'));
    }
    lines.push(ro
      ? 'Costul nu este măsurat, deci suma încasată este prețul publicat, nu o marjă.'
      : 'Cost is not measured, so the amount collected is the published price, not a margin.');
  } else if (primary.strategy) {
    lines.push(primary.strategy);
  }
  return lines.join('\n');
}

function getStatus() {
  return {
    ok: true,
    id: PROTOCOL,
    orchestrator: ORCHESTRATOR,
    beats: BEATS.slice(),
    last: _last,
    inventsMargin: false,
    externalModel: false,
    applied: false,
  };
}

module.exports = {
  PROTOCOL,
  ORCHESTRATOR,
  BEATS,
  bitcoinUsd,
  solve,
  getStatus,
};
