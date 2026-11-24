// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Module: Enterprise B2B Tax Invoice, GDPR DPA/SLA Pack & 1-Line Viral Embed Widget
// =====================================================================

'use strict';

const crypto = require('crypto');

const DOMAIN = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro')
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/+$/, '');
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'vladoi_ionut@yahoo.com';

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmbedWidgetJs() {
  return `(function(){
  'use strict';
  var scriptEl = document.currentScript;
  var ref = (scriptEl && scriptEl.getAttribute('data-ref')) || '';
  var mountId = (scriptEl && scriptEl.getAttribute('data-target')) || '';
  var host = mountId ? document.getElementById(mountId) : null;
  if (!host) {
    host = document.createElement('div');
    host.id = 'zeusai-embed-audit-' + Math.random().toString(36).slice(2, 7);
    if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.insertBefore(host, scriptEl.nextSibling);
    else document.body.appendChild(host);
  }
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var wrap = document.createElement('div');
  wrap.style.cssText = 'font-family:system-ui,-apple-system,sans-serif;background:#0e0d1d;color:#eaf0ff;border:1px solid rgba(138,92,255,.4);border-radius:14px;padding:16px;max-width:520px;box-shadow:0 12px 32px rgba(0,0,0,.35)';
  wrap.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    + '<strong style="font-size:15px">Free Instant Website &amp; AI Readiness Audit</strong>'
    + '<span style="font-size:11px;padding:3px 8px;border-radius:99px;background:rgba(138,92,255,.22);color:#c4b5fd">ZeusAI Live</span>'
    + '</div>'
    + '<div style="font-size:12.5px;color:#b7c0e0;margin-bottom:10px">Run a real 7-point SEO, AEO/GEO &amp; HSTS security scan in under 1 second.</div>'
    + '<form style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<input type="url" placeholder="https://your-site.com" required style="flex:1;min-width:190px;padding:9px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:#171530;color:#fff;font-size:13px"/>'
    + '<button type="submit" style="padding:9px 14px;border-radius:8px;border:0;background:linear-gradient(135deg,#8a5cff,#00d4ff);color:#090915;font-weight:700;font-size:13px;cursor:pointer">Scan Free →</button>'
    + '</form>'
    + '<div data-out style="margin-top:10px;font-size:12.5px;line-height:1.5"></div>';
  root.appendChild(wrap);
  var form = wrap.querySelector('form');
  var inp = wrap.querySelector('input');
  var out = wrap.querySelector('[data-out]');
  form.addEventListener('submit', function(ev){
    ev.preventDefault();
    var u = (inp.value || '').trim();
    if (!u) return;
    if (!/^https?:\\/\\//i.test(u)) u = 'https://' + u;
    out.textContent = 'Scanning ' + u + ' live…';
    fetch('${DOMAIN}/api/magnet/instant-audit-teaser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: u })
    }).then(function(r){ return r.json(); }).then(function(d){
      while (out.firstChild) out.removeChild(out.firstChild);
      if (!d || !d.ok) { out.textContent = 'Unable to scan URL — enter a public https:// domain.'; return; }
      var h = document.createElement('div');
      h.style.fontWeight = '700';
      h.textContent = d.host + ' · Score: ' + d.liveScore + '/100 (' + d.checksPassed + '/' + d.checksTotal + ' passed)';
      out.appendChild(h);
      var a = document.createElement('a');
      var refQ = ref ? ('&ref=' + encodeURIComponent(ref)) : '';
      a.href = '${DOMAIN}/checkout/?plan=' + encodeURIComponent((d.instantActivation && d.instantActivation.recommendedServiceId) || 'instant-website-audit') + '&add=instant-seo-content-pack&url=' + encodeURIComponent(u) + refQ + '&rail=btc';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.cssText = 'display:inline-block;margin-top:8px;padding:8px 12px;border-radius:8px;background:#10b981;color:#04120c;font-weight:700;text-decoration:none;font-size:12.5px';
      a.textContent = 'Fix Detected Gaps Autonomously (-15% Bundle + -10% BTC) →';
      out.appendChild(a);
    }).catch(function(){ out.textContent = 'Network error — retry scan.'; });
  });
})();`;
}

function getSdkAndEmbedManifest(refCode) {
  const cleanRef = String(refCode || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const refAttr = cleanRef ? ` data-ref="${cleanRef}"` : '';
  const embedScript = `<script src="${DOMAIN}/embed/zeus-audit.js"${refAttr}></script>`;
  return {
    ok: true,
    domain: DOMAIN,
    mcpServer: {
      registryName: 'io.github.ruffy80/zeusai-unicorn-mcp',
      endpoint: `${DOMAIN}/api/mcp`,
      transport: 'streamable-http',
      toolsCount: 21,
    },
    sdks: {
      nodejs: {
        packageName: '@zeusai/sdk',
        pathInRepo: 'packages/zeusai-sdk',
        installSnippet: 'const { ZeusAI } = require("@zeusai/sdk");',
      },
      python: {
        packageName: 'zeusai',
        pathInRepo: 'packages/zeusai-python',
        installSnippet: 'from zeusai import ZeusAI',
      },
    },
    viralEmbedWidget: {
      scriptUrl: `${DOMAIN}/embed/zeus-audit.js`,
      htmlSnippet: embedScript,
      wordpressSnippet: `<!-- Paste in WordPress Custom HTML block or Footer -->\n${embedScript}`,
      shopifySnippet: `<!-- Paste in Shopify theme.liquid before </body> -->\n${embedScript}`,
      affiliateAttributionPct: 10,
      friendDiscountPct: 10,
    },
  };
}

function getEnterpriseCompliancePack() {
  return {
    ok: true,
    protocol: 'ECP/1.0',
    organization: 'ZeusAI / Unicorn',
    ownerContact: OWNER_EMAIL,
    domain: DOMAIN,
    gdprDpa: {
      dataMinimization: true,
      buyerEmailOptionalAtCheckout: true,
      zeroPiiPublicTreasury: true,
      dpaUrl: `${DOMAIN}/legal/dpa`,
      subprocessors: ['Hetzner Online GmbH (EU — Helsinki)', 'Groq / OpenRouter (optional cloud LLM rails)', 'Local Sovereign Ollama (EU on-box zero-egress inference)'],
    },
    sla: {
      slaUrl: `${DOMAIN}/legal/sla`,
      targetUptimePct: 99.9,
      canaryAutoRollbackSec: 5,
      zeroCveSupplyChainVerified: true,
      ed25519VerifiableReceipts: true,
      backupEngine: 'Daily SQLite WAL checkpoint + AES-256-CBC archive + optional S3/R2 off-site sync',
    },
    invoicing: {
      b2bPrintableInvoicePattern: `${DOMAIN}/invoice/{orderId}?access_token={accessToken}`,
      supportsVatAndCompanyFields: true,
      settlementRails: ['Bitcoin Direct On-Chain (-10%)', 'PayPal Live', 'NOWPayments Live (Multi-Crypto + Card)'],
    },
  };
}

function renderB2BInvoiceHtml(order, aspeInstance) {
  const ord = order || {};
  const invoiceNo = 'INV-' + String(ord.orderId || 'UNKNOWN').toUpperCase();
  const issuedAt = ord.paid_at || ord.created_at || new Date().toISOString();
  const status = String(ord.status || 'pending').toUpperCase();
  const items = (ord.bundle && Array.isArray(ord.bundle.items) && ord.bundle.items.length)
    ? ord.bundle.items
    : [{ id: ord.serviceId || 'service', name: ord.serviceName || ord.serviceId || 'ZeusAI Autonomous Service', listPriceUsd: Number(ord.unit_price_full_fiat || ord.subtotal_fiat || 0) }];

  const rowsHtml = items.map((it) => `<tr>
    <td>${escHtml(it.name || it.id)}</td>
    <td style="font-family:monospace;font-size:12px">${escHtml(it.id)}</td>
    <td style="text-align:right">${Number(it.listPriceUsd || 0).toFixed(2)} ${escHtml(ord.currency || 'USD')}</td>
  </tr>`).join('');

  const txid = (Array.isArray(ord.txids) && ord.txids[0]) || (ord.paid_via ? ('rail:' + ord.paid_via) : 'pending');
  const sigShort = ord.signature ? String(ord.signature).slice(0, 48) + '…' : 'Ed25519-pending';
  const aspeBlock = aspeInstance
    ? `<div class="box"><strong>ASPE/1.0 Autonomous Execution Proof</strong><br/>Workspace: <code>${escHtml(aspeInstance.workspaceId)}</code> · Modules Activated: <code>${escHtml((aspeInstance.modulesActivated || []).join(', '))}</code> · Cycles Executed: <code>${Number(aspeInstance.cyclesExecuted || 1)}</code></div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>ZeusAI B2B Tax Invoice · ${escHtml(invoiceNo)}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#f7f8fc;color:#111827;margin:0;padding:24px}
    .sheet{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;box-shadow:0 8px 28px rgba(0,0,0,.06)}
    .row{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
    h1{margin:0;font-size:22px}
    .badge{display:inline-block;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700;background:${status === 'PAID' ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e'}}
    table{width:100%;border-collapse:collapse;margin:18px 0}
    th,td{border-bottom:1px solid #e5e7eb;padding:10px 8px;text-align:left;font-size:14px}
    th{background:#f9fafb;font-weight:700}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px;margin-top:14px}
    .btn{padding:10px 16px;border-radius:8px;border:0;background:#111827;color:#fff;font-weight:700;cursor:pointer}
    input{border:1px solid #d1d5db;border-radius:6px;padding:6px 8px;font-size:13px;width:260px}
    @media print{.no-print{display:none!important}body{background:#fff;padding:0}.sheet{box-shadow:none;border:0}}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="row">
      <div>
        <h1>ZeusAI / Unicorn — Commercial Tax Invoice</h1>
        <div style="font-size:13px;color:#4b5563">Invoice No: <strong>${escHtml(invoiceNo)}</strong> · Issued: ${escHtml(issuedAt)}</div>
      </div>
      <div><span class="badge">${escHtml(status)}</span></div>
    </div>
    <div class="row">
      <div>
        <strong>Supplier</strong><br/>
        ZeusAI / Unicorn Sovereign Platform<br/>
        Owner: Vladoi Ionut · ${escHtml(OWNER_EMAIL)}<br/>
        ${escHtml(DOMAIN)}
      </div>
      <div>
        <strong>Bill To (editable before PDF print)</strong><br/>
        <input type="text" placeholder="Company Name / Individual" value="${escHtml((ord.buyer && ord.buyer.email) || '')}"/><br/>
        <input type="text" placeholder="VAT / CUI / Tax ID (optional)" style="margin-top:6px"/>
      </div>
    </div>
    <table>
      <thead><tr><th>Autonomous Service</th><th>SKU</th><th style="text-align:right">List Price</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr><th colspan="2">Total Settled (${escHtml(ord.currency || 'USD')}${ord.bundle ? ` · Bundle -${ord.bundle.discountPct}%` : ''})</th><th style="text-align:right">${Number(ord.subtotal_fiat || 0).toFixed(2)} ${escHtml(ord.currency || 'USD')}</th></tr>
      </tfoot>
    </table>
    <div class="box">
      <strong>Settlement &amp; Cryptographic Receipt</strong><br/>
      Order ID: <code>${escHtml(ord.orderId)}</code> · Rail/TX: <code>${escHtml(txid)}</code><br/>
      Ed25519 Signature: <code>${escHtml(sigShort)}</code>
    </div>
    ${aspeBlock}
    <div class="no-print" style="margin-top:20px;display:flex;gap:10px">
      <button type="button" class="btn" id="printInvoiceBtn">Print / Save as PDF</button>
      <a href="/checkout/${encodeURIComponent(ord.orderId || '')}" style="padding:10px 14px;border-radius:8px;border:1px solid #d1d5db;color:#111827;text-decoration:none;font-size:13px;font-weight:600">← Back to Order</a>
    </div>
  </div>
  <script>document.getElementById('printInvoiceBtn').addEventListener('click',function(){window.print();});</script>
</body>
</html>`;
}

function renderLegalPageHtml(kind) {
  const isDpa = kind === 'dpa';
  const title = isDpa ? 'GDPR Data Processing Agreement (DPA)' : 'Enterprise Service Level Agreement (SLA)';
  const body = isDpa
    ? `<p>ZeusAI / Unicorn adheres strictly to GDPR data minimization principles:</p>
       <ul>
         <li><strong>Email-Optional Checkout:</strong> Buyers may settle and receive Ed25519-signed autonomous deliverables without submitting personal email addresses.</li>
         <li><strong>Zero-PII Public Attestations:</strong> All public endpoints (<code>/.well-known/treasury-autonomy.json</code>, <code>/.well-known/living-organism.json</code>, <code>/.well-known/evolution-ledger.json</code>) strip personal emails, hashes, and tokens.</li>
         <li><strong>Sovereign EU Infrastructure:</strong> Primary compute runs in Helsinki, Finland (Hetzner Online GmbH) with local on-box Ollama inference for zero-egress workloads.</li>
         <li><strong>Data Controller Contact:</strong> ${escHtml(OWNER_EMAIL)}</li>
       </ul>`
    : `<p>ZeusAI / Unicorn Enterprise SLA &amp; Operational Immortality Commitments:</p>
       <ul>
         <li><strong>Availability Target:</strong> 99.9% monthly uptime backed by PM2 cluster mode, Nginx reverse proxy, and automated 5-minute Canary Auto-Rollback (&lt;5s atomic symlink recovery).</li>
         <li><strong>Cryptographic Verifiability:</strong> Every autonomous service activation, evolution ledger entry, and M2M quote is signed with Ed25519.</li>
         <li><strong>Zero-CVE Supply Chain:</strong> Continuous <code>npm audit</code> enforcement and weekly GitHub Actions perpetual audits.</li>
         <li><strong>Backup &amp; Recovery:</strong> Daily SQLite WAL checkpoints and AES-256-CBC state snapshots with off-site S3/R2 sync support.</li>
       </ul>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>ZeusAI · ${escHtml(title)}</title><style>body{font-family:system-ui,sans-serif;background:#090915;color:#eaf0ff;margin:0;padding:32px}.card{max-width:780px;margin:0 auto;background:#121126;border:1px solid rgba(138,92,255,.3);border-radius:14px;padding:28px;line-height:1.65}a{color:#7dd3fc}</style></head><body><div class="card"><h1>${escHtml(title)}</h1>${body}<p style="margin-top:20px"><a href="/">← Back to ZeusAI</a> · <a href="/enterprise">Enterprise</a></p></div></body></html>`;
}

function constantTimeEqual(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (!s1 || !s2 || s1.length !== s2.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(s1, 'utf8'), Buffer.from(s2, 'utf8')); } catch (_) { return false; }
}

module.exports = {
  buildEmbedWidgetJs,
  getSdkAndEmbedManifest,
  getEnterpriseCompliancePack,
  renderB2BInvoiceHtml,
  renderLegalPageHtml,
  constantTimeEqual,
};
