// =====================================================================
// omega-http.js — Project Omega site page + local API handlers
// Kept out of the mega src/index.js for surgical, fail-soft wiring.
// =====================================================================
'use strict';

function matchesPage(urlPath) {
  return urlPath === '/omega' || String(urlPath || '').indexOf('/omega/') === 0;
}

function matchesApi(urlPath) {
  return String(urlPath || '').startsWith('/api/omega')
    || urlPath === '/.well-known/omega.json';
}

function _omega() {
  return require('../../backend/modules/omega-ecosystem-os');
}

function renderOmegaPage(urlPath, requestUrl, renderPage, res) {
  const body = `
<section style="max-width:960px;margin:0 auto;padding:48px 20px 80px;color:#e8eef7">
  <p style="letter-spacing:.2em;text-transform:uppercase;color:#8aa0b8;font-size:12px;margin:0 0 12px">Ω/1.0 · OMEGA/1.0 · Continuum Instance Graph</p>
  <h1 style="font-size:clamp(2.1rem,5.5vw,3.4rem);line-height:1.05;margin:0 0 14px;font-family:Georgia,'Times New Roman',serif">ZeusAI Omega — every purchase is already alive.</h1>
  <p style="max-width:56ch;color:#b7c5d6;font-size:1.08rem;margin:0 0 28px">Not downloads. Not licenses. Not dashboards to hunt through. Vault, Workspace, Concierge, Delivery, Memory, Recovery — the AI already handled everything.</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px">
    <button type="button" data-live-inspect="/api/omega/status" data-live-title="Omega Ecosystem" style="padding:14px 22px;border-radius:10px;background:linear-gradient(135deg,#c9a227,#8b6914);color:#0a0f1e;border:0;cursor:pointer;font-weight:700">Inspect Omega live →</button>
    <a href="/services" style="padding:14px 22px;border-radius:10px;border:1px solid #2c3550;color:#cfd6ff;text-decoration:none;font-weight:600">Open catalog</a>
    <a href="/api/omega/discovery" style="padding:14px 22px;border-radius:10px;border:1px solid #2c3550;color:#cfd6ff;text-decoration:none;font-weight:600">Discovery JSON</a>
  </div>
  <p id="omg-meta" style="color:#8aa0b8;margin:0 0 18px">Loading continuum…</p>
  <div id="omg-kpis" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:28px"></div>
  <div id="omg-detail" style="display:none;margin-bottom:28px;padding:18px 20px;border:1px solid #2a3544;background:rgba(20,28,40,.55)">
    <h2 id="omg-detail-title" style="font-size:1.15rem;margin:0 0 10px"></h2>
    <pre id="omg-detail-body" style="margin:0;white-space:pre-wrap;color:#cfd6ff;font-size:13px;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></pre>
  </div>
  <h2 style="font-size:1.2rem;margin:0 0 10px">Universal Product Engine</h2>
  <p style="color:#b7c5d6;max-width:60ch;margin:0 0 16px">Register a product once. Omega attaches the full stack to every paid order — current SKUs and every future one — with zero per-product integration code.</p>
  <ul id="omg-caps" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));list-style:none;padding:0;margin:0 0 28px;color:#cfd6ff"></ul>
  <p id="omg-principle" style="color:#8aa0b8;margin:0;font-style:italic"></p>
</section>`;

  const js = `(function(){
  function card(k,v){return '<div style="padding:14px 16px;border:1px solid #2a3544;background:rgba(20,28,40,.55)"><div style="color:#8aa0b8;font-size:12px">'+k+'</div><div style="font-size:1.35rem;font-weight:700;margin-top:4px">'+v+'</div></div>';}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var path=location.pathname||'/omega';
  var params=new URLSearchParams(location.search||'');
  Promise.all([
    fetch('/api/omega/status',{cache:'no-store'}).then(function(r){return r.json();}),
    fetch('/api/omega/discovery',{cache:'no-store'}).then(function(r){return r.json();})
  ]).then(function(arr){
    var st=arr[0]||{}; var d=arr[1]||{};
    var m=document.getElementById('omg-meta');
    var k=document.getElementById('omg-kpis');
    var caps=document.getElementById('omg-caps');
    var prin=document.getElementById('omg-principle');
    if(m) m.textContent=(st.started?'Armed':'Warming')+' · '+(st.protocol||'OMEGA/1.0')+' · '+(st.design||d.design||'Continuum Instance Graph')+' · '+(st.invention||'Autonomous AI Commerce OS');
    var c=st.counts||{};
    if(k) k.innerHTML=[
      card('Live instances',c.instancesLive||c.instancesCreated||0),
      card('Vault accounts',c.vaultAccounts||0),
      card('Vault entries',c.vaultEntries||0),
      card('Bootstraps',c.bootstraps||0),
      card('Deliveries',c.deliveriesFired||0),
      card('Concierge',c.conciergeWelcomes||0),
      card('Evolutions',c.evolutions||0),
      card('Catalog stamps',c.enriched||0),
      card('Engines',st.engineCount||(st.capabilities||[]).length||20)
    ].join('');
    var list=d.capabilities&&d.capabilities.length?d.capabilities:(st.capabilities||[]).map(function(x){return {key:x,name:x};});
    if(caps) caps.innerHTML=list.map(function(x){var label=typeof x==='string'?x:(x.name||x.key);return '<li style="padding:10px 12px;border:1px solid #2a3544;background:rgba(20,28,40,.4)">'+esc(label)+'</li>';}).join('');
    if(prin) prin.textContent=st.principle||d.principle||'The AI already handled everything.';
  }).catch(function(){var m=document.getElementById('omg-meta');if(m)m.textContent='Status temporarily unreachable.';});

  var detail=document.getElementById('omg-detail');
  var title=document.getElementById('omg-detail-title');
  var bodyEl=document.getElementById('omg-detail-body');
  function showDetail(t,obj){
    if(!detail)return;
    detail.style.display='block';
    if(title) title.textContent=t;
    if(bodyEl) bodyEl.textContent=typeof obj==='string'?obj:JSON.stringify(obj,null,2);
  }
  var instMatch=path.match(/^\\/omega\\/instance\\/([^/]+)/);
  if(instMatch){
    fetch('/api/omega/instance/'+encodeURIComponent(instMatch[1]),{cache:'no-store'}).then(function(r){return r.json();}).then(function(out){
      if(!out||!out.ok){showDetail('Instance',out||{ok:false});return;}
      var welcome=(out.instance&&out.instance.concierge&&out.instance.concierge.message)||'';
      showDetail('Instance '+(out.instance&&out.instance.id||instMatch[1]), welcome+'\\n\\n'+JSON.stringify(out.instance,null,2));
    }).catch(function(){showDetail('Instance','unreachable');});
  } else if(path.indexOf('/omega/vault')===0){
    var email=params.get('email')||'';
    if(!email){showDetail('AI Vault','Add ?email=buyer@example.com to open a vault continuum.');}
    else {
      fetch('/api/omega/vault?email='+encodeURIComponent(email),{cache:'no-store'}).then(function(r){return r.json();}).then(function(out){
        showDetail('AI Vault', out);
      }).catch(function(){showDetail('AI Vault','unreachable');});
    }
  }
})();`

  try {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30',
      'X-Unicorn-Page': 'omega',
    });
  } catch (_) { /* ignore */ }
  return res.end(renderPage('Omega Ecosystem · ZeusAI', body, js));
}

/** Fail-closed admin gate for mutating Omega routes (mirrors backend). */
function adminOk(req) {
  const expected = process.env.ADMIN_SECRET || process.env.ADMIN_TOKEN || process.env.ADMIN_API_TOKEN || '';
  const provided = String(
    (req.headers && (req.headers['x-admin-secret'] || req.headers['x-admin-token']))
    || String((req.headers && req.headers.authorization) || '').replace(/^Bearer\s+/i, '')
    || ''
  );
  if (expected && provided && provided === expected) return { ok: true };
  if (!expected) {
    if (process.env.NODE_ENV === 'test') return { ok: true, mode: 'test' };
    return { ok: false, code: 503, error: 'admin_secret_not_configured' };
  }
  return { ok: false, code: 401, error: 'unauthorized' };
}

async function handleApi(req, res, urlPath, requestUrl) {
  const omega = _omega();
  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(obj));
  };

  if (urlPath === '/api/omega/status' || urlPath === '/api/omega' || urlPath === '/.well-known/omega.json') {
    return json(200, omega.getStatus());
  }
  if (urlPath === '/api/omega/discovery') {
    return json(200, omega.discovery());
  }
  if (urlPath.startsWith('/api/omega/instance/') && req.method === 'GET') {
    const id = decodeURIComponent(urlPath.split('/').pop() || '');
    const out = omega.getInstance(id);
    return json(out && out.ok ? 200 : 404, out);
  }
  if (urlPath === '/api/omega/vault' && req.method === 'GET') {
    const email = (requestUrl && requestUrl.searchParams && requestUrl.searchParams.get('email')) || '';
    const out = omega.getVault(email);
    return json(out && out.ok ? 200 : 400, out);
  }
  if (urlPath === '/api/omega/vault/search' && req.method === 'GET') {
    const sp = requestUrl && requestUrl.searchParams;
    const out = omega.searchVault(sp && sp.get('email'), sp && sp.get('q'));
    return json(out && out.ok ? 200 : 400, out);
  }
  if ((urlPath === '/api/omega/bootstrap' || urlPath === '/api/omega/evolve') && req.method === 'POST') {
    const gate = adminOk(req);
    if (!gate.ok) return json(gate.code || 401, { ok: false, error: gate.error });
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (_) { body = {}; }
    const out = urlPath.endsWith('/evolve')
      ? omega.evolveOnce()
      : omega.bootstrapFromOrder(body.order || body);
    return json(out && out.ok ? 200 : 400, out);
  }
  return json(404, { ok: false, error: 'omega_route_not_found' });
}

module.exports = {
  matchesPage,
  matchesApi,
  renderOmegaPage,
  handleApi,
  adminOk,
};
