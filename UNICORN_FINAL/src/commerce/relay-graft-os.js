'use strict';

/**
 * Relay Graft Protocol — RGP/1.0
 *
 * World sites can buy ads or wait for social API tokens. They still cannot
 * hand another site a script-free cite that carries the exact payable offer
 * and a one-hop forward (WhatsApp, SMS, email, the phone share sheet)
 * without an account on either side.
 *
 * A graft tap is not a visitor. An embed is not a user. A page load is not
 * a customer. Only a confirmed payment moves paidHumans.
 *
 * RO: /relay — trimiți oferta o dată, din telefonul tău. Serverul nu postează
 * și nu numără vizitatori.
 */

const PROTOCOL = 'RGP/1.0';
const NAME = 'relay-graft-os';
const PUBLIC_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _offer() {
  try {
    const gravity = require('./storefront-gravity-os');
    const d = gravity.discovery();
    const fd = d && d.firstDollar ? d.firstDollar : {};
    return {
      serviceId: fd.serviceId || 'instant-resume-makeover',
      title: fd.title || 'Instant Resume + LinkedIn Makeover',
      priceUsd: Number(fd.priceUsd) > 0 ? Number(fd.priceUsd) : 39,
      buyUrl: fd.buyUrl || (PUBLIC_URL + '/checkout/?plan=instant-resume-makeover'),
      paypalUrl: fd.paypalUrl || (PUBLIC_URL + '/checkout/?plan=instant-resume-makeover&rail=paypal'),
      cardUrl: fd.cardUrl || (PUBLIC_URL + '/checkout/?plan=instant-resume-makeover&rail=nowpayments'),
      humanRails: fd.humanRails || { btc: true, paypal: false, nowpayments: false },
      paidHumans: Number(d && d.paidHumans) || 0,
    };
  } catch (_) {
    return {
      serviceId: 'instant-resume-makeover',
      title: 'Instant Resume + LinkedIn Makeover',
      priceUsd: 39,
      buyUrl: PUBLIC_URL + '/checkout/?plan=instant-resume-makeover',
      paypalUrl: PUBLIC_URL + '/checkout/?plan=instant-resume-makeover&rail=paypal',
      cardUrl: PUBLIC_URL + '/checkout/?plan=instant-resume-makeover&rail=nowpayments',
      humanRails: { btc: true, paypal: false, nowpayments: false },
      paidHumans: 0,
    };
  }
}

function passSentence(offer) {
  const o = offer || _offer();
  const usd = Number(o.priceUsd) || 39;
  const paid = Number(o.paidHumans) || 0;
  return paid > 0
    ? (paid + ' confirmed payment' + (paid === 1 ? '' : 's') + ' on ZeusAI. ' + o.title + ' is $' + usd + '. PayPal, card, or Bitcoin.')
    : ('0 paid humans. Origin #1 is still open. ' + o.title + ' is $' + usd + '. PayPal, card, or Bitcoin — traction is never invented.');
}

function discovery() {
  const offer = _offer();
  const sentence = passSentence(offer);
  const landing = PUBLIC_URL + '/relay';
  const smsBody = encodeURIComponent(sentence + '\n' + landing);
  return {
    protocol: PROTOCOL,
    name: NAME,
    ok: true,
    page: '/relay',
    wellKnown: '/.well-known/relay-graft.json',
    inventsVisitors: false,
    inventsUsers: false,
    inventsHumans: false,
    inventsGmv: false,
    inventsReach: false,
    inventsShares: false,
    countsPageLoadsAsUsers: false,
    paidHumans: offer.paidHumans,
    offer: {
      serviceId: offer.serviceId,
      title: offer.title,
      priceUsd: offer.priceUsd,
      buyUrl: offer.buyUrl,
      paypalUrl: offer.paypalUrl,
      cardUrl: offer.cardUrl,
      humanRails: offer.humanRails,
    },
    sentence,
    landing,
    pass: {
      whatsapp: 'https://wa.me/?text=' + smsBody,
      sms: 'sms:?&body=' + smsBody,
      email: 'mailto:?subject=' + encodeURIComponent(offer.title + ' · $' + offer.priceUsd) + '&body=' + smsBody,
      native: 'navigator.share on the device. The server never receives the contact list.',
      sharePage: '/share',
    },
    embed: {
      cite: landing,
      html: '<blockquote cite="' + landing + '"><p>' + sentence + '</p><p><a href="' + offer.buyUrl + '">Pay $' + offer.priceUsd + '</a> · <a href="' + landing + '">Pass it on</a></p></blockquote>',
      note: 'Script-free. Any site can paste this. The embed is not a visitor and not a backlink counter.',
    },
    note: 'Opening WhatsApp, SMS, or email is not a post. A post is not a visitor. A visitor is not a customer. This protocol publishes no visitor count.',
    generatedAt: new Date().toISOString(),
  };
}

function homeStripHtml() {
  const d = discovery();
  const usd = d.offer.priceUsd;
  return `<section id="homeRelayGraft" class="card" style="margin:16px 0 0;padding:18px 20px;border:1px solid rgba(45,226,230,.35);background:linear-gradient(135deg,rgba(0,232,160,.08),rgba(45,226,230,.05))">
  <span class="kicker" style="color:#2de2e6">RGP/1.0 · Relay Graft</span>
  <h2 style="margin:8px 0 6px;font-size:clamp(18px,2.4vw,26px);line-height:1.2">Send the $${usd} offer to one person. <span class="grad">The server does not post, and it does not count you.</span></h2>
  <p style="margin:0 0 12px;color:var(--ink-dim);font-size:14px;line-height:1.55;max-width:720px">${_esc(d.sentence)}</p>
  <div style="display:flex;flex-wrap:wrap;gap:10px">
    <a class="btn btn-primary" href="${_esc(d.pass.whatsapp)}" target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
    <a class="btn btn-ghost" href="/relay" data-link>Pass page →</a>
    <a class="btn btn-ghost" href="${_esc(d.offer.buyUrl)}" data-link>Pay $${usd}</a>
  </div>
</section>`;
}

function graftHtml() {
  const d = discovery();
  let head = `  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Relay Graft · ZeusAI</title>
  <link rel="canonical" href="${PUBLIC_URL}/relay"/>`;
  try {
    head = require('./world-index-os').shareHead({
      title: 'Relay Graft · pass the $' + d.offer.priceUsd + ' offer once',
      description: d.sentence,
      path: '/relay',
      protocol: PROTOCOL,
    });
  } catch (_) { /* share head optional */ }

  return `<!doctype html>
<html lang="en">
<head>
${head}
  <style>
    :root{color-scheme:dark}
    body{margin:0;background:#07080f;color:#e8eef8;font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
    main{max-width:680px;margin:0 auto;padding:40px 18px 80px}
    .kicker{letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:#2de2e6;margin:0}
    h1{font-size:clamp(26px,6vw,40px);line-height:1.1;margin:8px 0 12px}
    p.sub{color:#9aa6bd;margin:0 0 20px}
    a.tap,button.tap{display:block;width:100%;box-sizing:border-box;text-align:left;padding:14px 16px;border-radius:14px;background:#0e1220;border:1px solid #1e2740;text-decoration:none;color:#e8eef8;font:inherit;cursor:pointer;margin:0 0 10px}
    a.tap strong,button.tap strong{display:block}
    a.tap span,button.tap span{display:block;font-size:12px;color:#7d8aa3;margin-top:2px}
    pre{white-space:pre-wrap;word-break:break-word;background:#0b0e1a;border:1px solid #1a2340;border-radius:12px;padding:14px;font:12.5px/1.5 ui-monospace,SFMono-Regular,monospace;color:#cdd6e4}
    .note{font-size:13px;color:#7d8aa3}
    a.link{color:#7aa9ff}
  </style>
</head>
<body>
  <main>
    <p class="kicker">RGP/1.0 · one hop, zero tokens, zero invented visitors</p>
    <h1>Pass it to one person.</h1>
    <p class="sub">${_esc(d.sentence)} paidHumans = <b>${d.paidHumans}</b>. This page does not publish a visitor count.</p>
    <a class="tap" href="${_esc(d.pass.whatsapp)}" target="_blank" rel="noopener noreferrer"><strong>WhatsApp</strong><span>Opens your chat list. Nothing is sent until you press send.</span></a>
    <a class="tap" href="${_esc(d.pass.sms)}"><strong>SMS</strong><span>Opens the phone message composer. The server never sees the number.</span></a>
    <a class="tap" href="${_esc(d.pass.email)}"><strong>Email</strong><span>Opens your mail client. The server does not send mail.</span></a>
    <button class="tap" id="native-btn" type="button" hidden><strong>Share from this phone</strong><span>Uses the operating-system share sheet.</span></button>
    <p style="margin:18px 0 8px"><a class="link" href="${_esc(d.offer.paypalUrl)}">Pay $${d.offer.priceUsd} with PayPal</a> · <a class="link" href="${_esc(d.offer.cardUrl)}">card</a> · <a class="link" href="${_esc(d.offer.buyUrl)}">Bitcoin</a></p>
    <h2 style="font-size:17px;margin:28px 0 8px">Cite block any site can paste</h2>
    <p class="note">No script. No pixel. Pasting this does not increment a counter here.</p>
    <pre id="embed">${_esc(d.embed.html)}</pre>
    <button class="tap" id="copy-btn" type="button"><strong>Copy the cite block</strong><span>Clipboard only. Not a share count.</span></button>
    <ul class="note" style="padding-left:18px">
      <li>Facebook, X, TikTok and Instagram still need their own tokens before the server can post. This graft does not pretend otherwise.</li>
      <li>IndexNow and a sitemap notify engines. They are not visitors.</li>
      <li><a class="link" href="/share">/share</a> still opens the full composer list. <a class="link" href="/.well-known/relay-graft.json">relay-graft.json</a> is the machine copy of this page.</li>
    </ul>
  </main>
  <script>
  (function () {
    var sentence = ${JSON.stringify(d.sentence + '\n' + d.landing)};
    var embedEl = document.getElementById('embed');
    var embed = embedEl ? embedEl.textContent : '';
    var nativeBtn = document.getElementById('native-btn');
    if (nativeBtn && navigator.share) {
      nativeBtn.hidden = false;
      nativeBtn.addEventListener('click', function () {
        navigator.share({ title: ${JSON.stringify('ZeusAI · $' + d.offer.priceUsd)}, text: sentence, url: ${JSON.stringify(d.landing)} }).catch(function () {});
      });
    }
    var copyBtn = document.getElementById('copy-btn');
    if (copyBtn && embedEl) {
      copyBtn.addEventListener('click', function () {
        var done = function () { copyBtn.querySelector('strong').textContent = 'Copied'; };
        var fallback = function () {
          try {
            var range = document.createRange();
            range.selectNodeContents(embedEl);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            if (document.execCommand('copy')) done();
          } catch (e) {}
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(embed).then(done, fallback);
        } else {
          fallback();
        }
      });
    }
  }());
  </script>
</body>
</html>`;
}

module.exports = {
  PROTOCOL,
  NAME,
  passSentence,
  discovery,
  homeStripHtml,
  graftHtml,
};
