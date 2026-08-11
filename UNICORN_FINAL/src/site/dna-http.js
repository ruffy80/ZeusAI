// =====================================================================
// dna-http.js — AI DNA Engine site page + local API handlers
// =====================================================================
'use strict';

function matchesPage(urlPath) {
  return urlPath === '/dna' || String(urlPath || '').indexOf('/dna/') === 0;
}

function matchesApi(urlPath) {
  return String(urlPath || '').startsWith('/api/dna')
    || urlPath === '/.well-known/dna.json';
}

function _dna() {
  return require('../../backend/modules/ai-dna-engine');
}

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

function renderDnaPage(urlPath, requestUrl, renderPage, res) {
  const body = `
<section style="max-width:980px;margin:0 auto;padding:48px 20px 80px;color:#e8eef7">
  <p style="letter-spacing:.2em;text-transform:uppercase;color:#8aa0b8;font-size:12px;margin:0 0 12px">D/1.0 · DNA/1.0 · Adaptive Intelligence</p>
  <h1 style="font-size:clamp(2.1rem,5.5vw,3.4rem);line-height:1.05;margin:0 0 14px;font-family:Georgia,'Times New Roman',serif">ZeusAI DNA — useful over time, never invasive.</h1>
  <p style="max-width:58ch;color:#b7c5d6;font-size:1.08rem;margin:0 0 28px">Not a user profile. An adaptive intelligence layer that personalizes onboarding, Concierge, workflows and recommendations using only platform data and explicit settings — bonded to Omega, Genome, Vault and Workspace.</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px">
    <button type="button" data-live-inspect="/api/dna/status" data-live-title="AI DNA Engine" style="padding:14px 22px;border-radius:10px;background:linear-gradient(135deg,#c9a227,#8b6914);color:#0a0f1e;border:0;cursor:pointer;font-weight:700">Inspect DNA live →</button>
    <a href="/genome" style="padding:14px 22px;border-radius:10px;border:1px solid #2c3550;color:#cfd6ff;text-decoration:none;font-weight:600">Genome</a>
    <a href="/omega" style="padding:14px 22px;border-radius:10px;border:1px solid #2c3550;color:#cfd6ff;text-decoration:none;font-weight:600">Omega</a>
    <a href="/api/dna/discovery" style="padding:14px 22px;border-radius:10px;border:1px solid #2c3550;color:#cfd6ff;text-decoration:none;font-weight:600">Discovery JSON</a>
  </div>
  <p id="dna-meta" style="color:#8aa0b8;margin:0 0 18px">Loading AI DNA…</p>
  <div id="dna-kpis" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:28px"></div>
  <div id="dna-detail" style="display:none;margin-bottom:28px;padding:18px 20px;border:1px solid #2a3544;background:rgba(20,28,40,.55)">
    <h2 id="dna-detail-title" style="font-size:1.15rem;margin:0 0 10px"></h2>
    <pre id="dna-detail-body" style="margin:0;white-space:pre-wrap;color:#cfd6ff;font-size:13px;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></pre>
  </div>
  <h2 style="font-size:1.2rem;margin:0 0 10px">Trait adapters</h2>
  <ul id="dna-adapters" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));list-style:none;padding:0;margin:0 0 28px;color:#cfd6ff"></ul>
  <p id="dna-principle" style="color:#8aa0b8;margin:0;font-style:italic"></p>
</section>`;

  const js = `(function(){
  function card(k,v){return '<div style="padding:14px 16px;border:1px solid #2a3544;background:rgba(20,28,40,.55)"><div style="color:#8aa0b8;font-size:12px">'+k+'</div><div style="font-size:1.35rem;font-weight:700;margin-top:4px">'+v+'</div></div>';}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var path=location.pathname||'/dna';
  var params=new URLSearchParams(location.search||'');
  Promise.all([
    fetch('/api/dna/status',{cache:'no-store'}).then(function(r){return r.json();}),
    fetch('/api/dna/discovery',{cache:'no-store'}).then(function(r){return r.json();})
  ]).then(function(arr){
    var st=arr[0]||{}; var d=arr[1]||{};
    var m=document.getElementById('dna-meta');
    var k=document.getElementById('dna-kpis');
    var adapters=document.getElementById('dna-adapters');
    var prin=document.getElementById('dna-principle');
    if(m) m.textContent=(st.started?'Armed':'Warming')+' · '+(st.protocol||'DNA/1.0')+' · '+(st.design||d.design||'')+' · not a user profile';
    var c=st.counts||{};
    if(k) k.innerHTML=[
      card('Strands',c.strandsLive||c.strandsBorn||0),
      card('Observations',c.observations||0),
      card('Personalizations',c.personalizations||0),
      card('Learnings',c.learnings||0),
      card('Settings updates',c.settingsUpdates||0),
      card('Cache hits',c.cacheHits||0),
      card('Adapters',st.adapterCount||(st.adapters||[]).length||0),
      card('Forbidden guards',st.forbiddenTraitGuard||0)
    ].join('');
    var list=(d.adapters||[]).map(function(a){return a.id||a;}).concat([]);
    if(!list.length) list=st.adapters||[];
    if(adapters) adapters.innerHTML=list.map(function(x){return '<li style="padding:10px 12px;border:1px solid #2a3544;background:rgba(20,28,40,.4)">'+esc(String(x).replace(/_/g,' '))+'</li>';}).join('');
    if(prin) prin.textContent=st.principle||d.principle||'';
  }).catch(function(){var m=document.getElementById('dna-meta');if(m)m.textContent='Status temporarily unreachable.';});

  var detail=document.getElementById('dna-detail');
  var title=document.getElementById('dna-detail-title');
  var bodyEl=document.getElementById('dna-detail-body');
  function showDetail(t,obj){
    if(!detail)return;
    detail.style.display='block';
    if(title) title.textContent=t;
    if(bodyEl) bodyEl.textContent=typeof obj==='string'?obj:JSON.stringify(obj,null,2);
  }
  var email=params.get('email')||'';
  var idMatch=path.match(/^\\/dna\\/([^/]+)/);
  if(email){
    fetch('/api/dna/strand?email='+encodeURIComponent(email),{cache:'no-store'}).then(function(r){return r.json();}).then(function(out){
      showDetail('AI DNA strand', out);
    }).catch(function(){showDetail('AI DNA','unreachable');});
  } else if(idMatch && idMatch[1]){
    fetch('/api/dna/strand?email='+encodeURIComponent(idMatch[1]),{cache:'no-store'}).then(function(r){return r.json();}).then(function(out){
      showDetail('AI DNA '+idMatch[1], out);
    }).catch(function(){showDetail('AI DNA','unreachable');});
  }
})();`;

  try {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30',
      'X-Unicorn-Page': 'dna',
    });
  } catch (_) { /* ignore */ }
  return res.end(renderPage('AI DNA Engine · ZeusAI', body, js));
}

async function handleApi(req, res, urlPath, requestUrl) {
  const dna = _dna();
  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(obj));
  };
  const sp = requestUrl && requestUrl.searchParams;

  if (urlPath === '/api/dna/status' || urlPath === '/api/dna' || urlPath === '/.well-known/dna.json') {
    return json(200, dna.getStatus());
  }
  if (urlPath === '/api/dna/discovery') {
    return json(200, dna.discovery());
  }
  if ((urlPath === '/api/dna/strand' || urlPath === '/api/dna/dna') && req.method === 'GET') {
    const email = (sp && (sp.get('email') || sp.get('id'))) || '';
    const out = dna.getDna(email);
    return json(out && out.ok ? 200 : 400, out);
  }
  if (urlPath === '/api/dna/search' && req.method === 'GET') {
    return json(200, dna.searchDna(sp && sp.get('q')));
  }
  if (urlPath === '/api/dna/personalize' && req.method === 'GET') {
    const out = dna.personalize({
      email: sp && sp.get('email'),
      intent: sp && sp.get('intent'),
      sku: sp && sp.get('sku'),
      language: sp && sp.get('lang'),
    });
    return json(out && out.ok ? 200 : 400, out);
  }
  if (urlPath.startsWith('/api/dna/') && req.method === 'GET'
    && !['status', 'discovery', 'strand', 'dna', 'search', 'personalize', 'observe', 'settings', 'learn', 'migrate'].includes(urlPath.split('/')[3])) {
    const id = decodeURIComponent(urlPath.split('/').pop() || '');
    const out = dna.getDna(id, { create: false });
    return json(out && out.ok ? 200 : 404, out);
  }
  if ((urlPath === '/api/dna/observe' || urlPath === '/api/dna/settings'
    || urlPath === '/api/dna/personalize' || urlPath === '/api/dna/learn'
    || urlPath === '/api/dna/migrate') && req.method === 'POST') {
    // learn/migrate admin-gated; observe/settings/personalize allowed with body email (platform UX)
    if (urlPath.endsWith('/learn') || urlPath.endsWith('/migrate')) {
      const gate = adminOk(req);
      if (!gate.ok) return json(gate.code || 401, { ok: false, error: gate.error });
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (_) { body = {}; }
    let out;
    if (urlPath.endsWith('/observe')) out = dna.observeEvent(body.event || body);
    else if (urlPath.endsWith('/settings')) out = dna.updateSettings(body.email, body.settings || body);
    else if (urlPath.endsWith('/personalize')) out = dna.personalize(body);
    else if (urlPath.endsWith('/learn')) out = dna.learnOnce(body.customerKey || body.id);
    else out = dna.proposePersonalizationMigration(body);
    return json(out && out.ok ? 200 : 400, out);
  }
  return json(404, { ok: false, error: 'dna_route_not_found' });
}

module.exports = {
  matchesPage,
  matchesApi,
  renderDnaPage,
  handleApi,
  adminOk,
};
