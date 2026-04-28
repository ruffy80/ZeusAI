// polish-pack — additive site polish layer (well-known + offline + Link preload)
// © Vladoi Ionut. Strictly additive: never overrides existing routes.
'use strict';

const DISABLED = process.env.POLISH_PACK_DISABLED === '1';

const OWNER = {
  name:  process.env.OWNER_NAME  || 'Vladoi Ionut',
  email: process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com',
  domain: process.env.PUBLIC_APP_URL || 'https://zeusai.pro'
};

function expiresIso(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
  return d.toISOString();
}

function securityTxt() {
  // RFC 9116 — security disclosure contact
  const lines = [
    `Contact: mailto:${OWNER.email}`,
    `Contact: ${OWNER.domain.replace(/\/$/, '')}/security`,
    `Expires: ${expiresIso(365)}`,
    'Preferred-Languages: en, ro',
    `Canonical: ${OWNER.domain.replace(/\/$/, '')}/.well-known/security.txt`,
    `Policy: ${OWNER.domain.replace(/\/$/, '')}/security`,
    `Acknowledgments: ${OWNER.domain.replace(/\/$/, '')}/trust`,
    '# Responsible disclosure: 90-day coordinated disclosure window.',
    '# We sign all advisories with Ed25519 (see /.well-known/did.json).',
    ''
  ];
  return lines.join('\n');
}

function humansTxt() {
  return [
    '/* TEAM */',
    `  Owner & Architect: ${OWNER.name}`,
    `  Contact: ${OWNER.email}`,
    `  Site: ${OWNER.domain}`,
    '',
    '/* THANKS */',
    '  To every autonomous agent that bought, audited, or improved ZeusAI.',
    '',
    '/* SITE */',
    '  Built on: Node.js, plain HTTP, Express',
    '  Standards: RFC 9116, W3C Trace Context, RFC 6962, CycloneDX 1.5',
    '  Doctrine: sovereignty, signed outcomes, additive evolution.',
    ''
  ].join('\n');
}

function offlineHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="theme-color" content="#05040a"/>
<title>Offline — ZeusAI</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#05040a;color:#e8f4ff;font-family:'Space Grotesk',system-ui,Arial;
       background-image:radial-gradient(ellipse at 20% 20%,rgba(138,92,255,.15),transparent 60%),
                        radial-gradient(ellipse at 80% 80%,rgba(62,160,255,.12),transparent 55%)}
  .wrap{max-width:520px;text-align:center;padding:40px 24px}
  h1{font-size:clamp(28px,5vw,42px);margin:0 0 14px;background:linear-gradient(135deg,#8a5cff,#3ea0ff,#ffd36a);
     -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  p{color:#9fb3c8;line-height:1.6;font-size:16px;margin:0 0 22px}
  a.btn{display:inline-block;padding:12px 22px;border-radius:12px;text-decoration:none;
        background:linear-gradient(135deg,#8a5cff,#3ea0ff);color:#05040a;font-weight:700}
  small{display:block;margin-top:30px;color:#506a85;font-size:12px}
</style>
</head>
<body>
<div class="wrap">
  <h1>You're offline</h1>
  <p>ZeusAI cached the shell so this page still loads. As soon as your connection is back, hit retry — your dashboard, marketplace, and signed receipts will sync automatically.</p>
  <a class="btn" href="/" id="retry">Retry</a>
  <small>Sovereign · Signed · Self-evolving</small>
</div>
<script>
  document.getElementById('retry').addEventListener('click', function(e){
    e.preventDefault();
    location.reload();
  });
</script>
</body>
</html>`;
}

function send(res, code, type, body, extraHeaders) {
  const headers = Object.assign({
    'Content-Type': type,
    'Cache-Control': 'public, max-age=3600',
    'X-Polish-Pack': '1'
  }, extraHeaders || {});
  res.writeHead(code, headers);
  res.end(body);
}

async function handle(req, res) {
  if (DISABLED) return false;
  const urlPath = (req.url || '/').split('?')[0];

  // RFC 9116 well-known security contact
  if (urlPath === '/.well-known/security.txt' || urlPath === '/security.txt') {
    send(res, 200, 'text/plain; charset=utf-8', securityTxt());
    return true;
  }

  // /humans.txt
  if (urlPath === '/humans.txt') {
    send(res, 200, 'text/plain; charset=utf-8', humansTxt());
    return true;
  }

  // /offline.html — service worker fallback
  if (urlPath === '/offline.html') {
    send(res, 200, 'text/html; charset=utf-8', offlineHtml(), {
      'Cache-Control': 'public, max-age=600'
    });
    return true;
  }

  return false;
}

module.exports = { handle, securityTxt, humansTxt, offlineHtml };
