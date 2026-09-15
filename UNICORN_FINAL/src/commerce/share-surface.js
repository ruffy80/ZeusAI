'use strict';

/**
 * Human Share Distribution Protocol — HSDP/1.0
 *
 * The one distribution step no module can take for the owner is "post it
 * once". This surface reduces that step to a single tap: every destination
 * is a public web intent that needs no API token, no app review, and no
 * OAuth — the owner's own logged-in session does the posting.
 *
 * Honesty rules (identical to WIVP/FDGP): the copy is generated from
 * social-gravity-os, which reads real paidHumans from origin-gravity-os. No
 * follower counts, no reach, no impressions, no visitors are invented here.
 * Opening a share intent is not a post, and a post is not a customer.
 *
 * RO: pagina /share — un tap și postezi din sesiunea ta, fără tokenuri.
 */

const PROTOCOL = 'HSDP/1.0';
const NAME = 'share-surface';
const PUBLIC_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Honest share copy. Delegates to social-gravity-os so /share, the
 * autonomous poster, and /.well-known/social-gravity.json never disagree.
 */
function shareCopy(channel) {
  const ch = String(channel || 'x').toLowerCase();
  try {
    const sgp = require('../../backend/modules/social-gravity-os');
    const post = sgp.composePost(ch);
    if (post && post.text && post.url) {
      return {
        text: String(post.text).replace(/\s*https?:\/\/\S+\s*$/, '').trim(),
        url: String(post.url),
        buyUrl: post.buyUrl,
        firstDollarUrl: post.firstDollarUrl,
        source: 'social-gravity-os',
      };
    }
  } catch (_) { /* fall through to static honest copy */ }
  return {
    text: 'ZeusAI — a live autonomous AI-commerce OS with real Bitcoin checkout. Traction is never invented.',
    url: PUBLIC_URL + '/from/' + encodeURIComponent(ch) + '?utm_source=' + encodeURIComponent(ch) + '&utm_medium=social&utm_campaign=origin1',
    buyUrl: PUBLIC_URL + '/buy',
    firstDollarUrl: PUBLIC_URL + '/first-dollar',
    source: 'static-fallback',
  };
}

const TITLE = 'ZeusAI — autonomous AI-commerce OS';

/**
 * One-tap targets. Every URL is a documented public web intent: it opens the
 * network's own composer in the owner's session. No token is ever required.
 */
function shareTargets(opts) {
  const o = opts || {};
  const enc = encodeURIComponent;
  const title = String(o.title || TITLE);
  const build = (channel, label, make, hint) => {
    const copy = shareCopy(channel);
    const full = copy.text + '\n' + copy.url;
    return {
      channel,
      label,
      requiresToken: false,
      text: copy.text,
      landing: copy.url,
      intentUrl: make({ url: copy.url, text: copy.text, full, title, enc }),
      hint,
    };
  };
  return [
    build('x', 'X / Twitter',
      (c) => `https://twitter.com/intent/tweet?text=${c.enc(c.text)}&url=${c.enc(c.url)}`,
      'Opens the X composer already filled in.'),
    build('facebook', 'Facebook',
      (c) => `https://www.facebook.com/sharer/sharer.php?u=${c.enc(c.url)}&quote=${c.enc(c.text)}`,
      'Facebook reads the Open Graph preview from the landing URL.'),
    build('whatsapp', 'WhatsApp',
      (c) => `https://wa.me/?text=${c.enc(c.full)}`,
      'Best first move: send it to people who already know you.'),
    build('telegram', 'Telegram',
      (c) => `https://t.me/share/url?url=${c.enc(c.url)}&text=${c.enc(c.text)}`,
      'Public channel or group — different from the operator bot rail.'),
    build('linkedin', 'LinkedIn',
      (c) => `https://www.linkedin.com/sharing/share-offsite/?url=${c.enc(c.url)}`,
      'LinkedIn pulls title and image from Open Graph.'),
    build('reddit', 'Reddit',
      (c) => `https://www.reddit.com/submit?url=${c.enc(c.url)}&title=${c.enc(c.title)}`,
      'Pick a subreddit that allows self-promotion, or it gets removed.'),
    build('hackernews', 'Hacker News',
      (c) => `https://news.ycombinator.com/submitlink?u=${c.enc(c.url)}&t=${c.enc(c.title)}`,
      'Show HN works only with a real, working demo link.'),
    build('email', 'Email',
      (c) => `mailto:?subject=${c.enc(c.title)}&body=${c.enc(c.full)}`,
      'Opens your mail client — nothing is sent by the server.'),
  ];
}

function discovery() {
  const targets = shareTargets();
  let paidHumans = 0;
  let originOpen = true;
  try {
    const ogp = require('../../backend/modules/origin-gravity-os');
    const st = ogp.getStatus();
    paidHumans = Number(st && st.paidHumans) || 0;
    originOpen = !(st && st.originOpen === false);
  } catch (_) { /* honest default */ }
  return {
    protocol: PROTOCOL,
    name: NAME,
    ok: true,
    page: '/share',
    paidHumans,
    originOpen,
    tokenlessChannels: targets.map((t) => t.channel),
    targets: targets.map((t) => ({
      channel: t.channel,
      label: t.label,
      intentUrl: t.intentUrl,
      landing: t.landing,
      requiresToken: t.requiresToken,
    })),
    nativeShareApi: 'navigator.share on the device — opens the OS share sheet',
    inventsVisitors: false,
    inventsUsers: false,
    inventsReach: false,
    inventsShares: false,
    note: 'These are web intents, not an API. Opening one is not a post; a post is not a visitor; a visitor is not a customer. Only a confirmed payment moves paidHumans.',
    generatedAt: new Date().toISOString(),
  };
}

function shareHtml() {
  const d = discovery();
  const targets = shareTargets();
  const copy = shareCopy('x');
  let head = `  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Share ZeusAI · one tap</title>
  <link rel="canonical" href="${PUBLIC_URL}/share"/>`;
  try {
    head = require('./world-index-os').shareHead({
      title: 'Share ZeusAI · one tap',
      description: 'Post ZeusAI to X, Facebook, WhatsApp, Telegram, LinkedIn, Reddit or Hacker News in a single tap. No API tokens required — it uses your own session.',
      path: '/share',
      protocol: PROTOCOL,
    });
  } catch (_) { /* share head optional */ }

  const buttons = targets.map((t) => `<a class="tap" href="${_esc(t.intentUrl)}" target="_blank" rel="noopener noreferrer">
        <span class="lbl">${_esc(t.label)}</span>
        <span class="hint">${_esc(t.hint)}</span>
      </a>`).join('\n      ');

  return `<!doctype html>
<html lang="en">
<head>
${head}
  <style>
    :root{color-scheme:dark}
    body{margin:0;background:#07080f;color:#e8eef8;font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
    main{max-width:680px;margin:0 auto;padding:40px 18px 80px}
    .kicker{letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:#00e8a0;margin:0}
    h1{font-size:clamp(26px,6vw,40px);line-height:1.1;margin:8px 0 12px}
    p.sub{color:#9aa6bd;margin:0 0 24px}
    .grid{display:grid;gap:10px}
    .tap{display:block;padding:14px 16px;border-radius:14px;background:#0e1220;border:1px solid #1e2740;text-decoration:none;color:#e8eef8}
    .tap:hover,.tap:focus{border-color:#2de2e6}
    .tap .lbl{display:block;font-weight:700}
    .tap .hint{display:block;font-size:12px;color:#7d8aa3;margin-top:2px}
    button.primary{width:100%;padding:16px;border:0;border-radius:14px;font:inherit;font-weight:800;
      background:linear-gradient(135deg,#00e8a0,#2de2e6);color:#05060e;cursor:pointer}
    button.ghost{width:100%;padding:13px;border:1px solid #1e2740;border-radius:14px;font:inherit;
      background:#0e1220;color:#e8eef8;cursor:pointer;margin-top:10px}
    pre.copy{white-space:pre-wrap;word-break:break-word;background:#0b0e1a;border:1px solid #1a2340;
      border-radius:12px;padding:14px;font:13px/1.5 ui-monospace,SFMono-Regular,monospace;color:#cdd6e4}
    .note{font-size:13px;color:#7d8aa3}
    a.link{color:#7aa9ff}
    [hidden]{display:none!important}
  </style>
</head>
<body>
  <main>
    <p class="kicker">HSDP/1.0 · one tap, zero tokens</p>
    <h1>Post it once. That is the step code cannot take.</h1>
    <p class="sub">Every button below opens the network's own composer in your session. No API key, no app review, nothing is posted by the server. paidHumans = <b>${d.paidHumans}</b>, and only a confirmed payment changes that.</p>

    <div id="native" hidden>
      <button class="primary" id="native-btn" type="button">Share via your phone</button>
    </div>
    <button class="ghost" id="copy-btn" type="button">Copy the post text</button>
    <pre class="copy" id="copy-text">${_esc(copy.text + '\n' + copy.url)}</pre>

    <div class="grid">
      ${buttons}
    </div>

    <h2 style="font-size:17px;margin:32px 0 8px">What happens after the tap</h2>
    <ul class="note" style="padding-left:18px">
      <li>The link lands on <a class="link" href="/from/x">/from/{channel}</a> with utm + ref, so a real checkout is attributable.</li>
      <li>Facebook, LinkedIn, X and Telegram read the Open Graph preview the site already serves.</li>
      <li>Opening a composer is not a post. A post is not a visitor. A visitor is not a customer.</li>
    </ul>
    <p class="note"><a class="link" href="/visible-world">World Index</a> · <a class="link" href="/first-dollar">First dollar</a> · <a class="link" href="/.well-known/share-surface.json">share-surface.json</a></p>
  </main>
  <script>
  (function () {
    var textEl = document.getElementById('copy-text');
    var payload = textEl ? textEl.textContent : '';
    var nativeWrap = document.getElementById('native');
    var nativeBtn = document.getElementById('native-btn');
    if (nativeWrap && nativeBtn && typeof navigator !== 'undefined' && navigator.share) {
      nativeWrap.hidden = false;
      nativeBtn.addEventListener('click', function () {
        navigator.share({ title: ${JSON.stringify(TITLE)}, text: payload }).catch(function () {});
      });
    }
    var copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var done = function () { copyBtn.textContent = 'Copied'; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(payload).then(done, function () {});
        } else if (textEl) {
          var r = document.createRange();
          r.selectNodeContents(textEl);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
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
  PUBLIC_URL,
  shareCopy,
  shareTargets,
  discovery,
  shareHtml,
};
