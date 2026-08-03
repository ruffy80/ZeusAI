// =====================================================================
// genome-http.js — AI Genome Engine site page + local API handlers
// =====================================================================
'use strict';

function matchesPage(urlPath) {
  return urlPath === '/genome' || String(urlPath || '').indexOf('/genome/') === 0;
}

function matchesApi(urlPath) {
  return String(urlPath || '').startsWith('/api/genome')
    || urlPath === '/.well-known/genome.json';
}

function _genome() {
  return require('../../backend/modules/ai-genome-engine');
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

function renderGenomePage(urlPath, requestUrl, renderPage, res) {
  const body = `
<section style="max-width:980px;margin:0 auto;padding:48px 20px 80px;color:#e8eef7">
  <p style="letter-spacing:.2em;text-transform:uppercase;color:#8aa0b8;font-size:12px;margin:0 0 12px">G/1.0 · GENOME/1.0 · Living Digital DNA</p>
  <h1 style="font-size:clamp(2.1rem,5.5vw,3.4rem);line-height:1.05;margin:0 0 14px;font-family:Georgia,'Times New Roman',serif">ZeusAI Genome — every product carries living DNA.</h1>
  <p style="max-width:58ch;color:#b7c5d6;font-size:1.08rem;margin:0 0 28px">Not metadata. A complete intelligence blueprint: capabilities, relationships, workflows, security, and evolution — wired into one Universal Intelligence Graph. Register a product once; the ecosystem does the rest.</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px">
    <button type="button" data-live-inspect="/api/genome/status" data-live-title="AI Genome Engine" style="padding:14px 22px;border-radius:10px;background:linear-gradient(135deg,#c9a227,#8b6914);color:#0a0f1e;border:0;cursor:pointer;font-weight:700">Inspect Genome live →</button>
    <a href="/omega" style="padding:14px 22px;border-radius:10px;border:1px solid #2c3550;color:#cfd6ff;text-decoration:none;font-weight:600">Omega Continuum</a>
    <a href="/services" style="padding:14px 22px;border-radius:10px;border:1px solid #2c3550;color:#cfd6ff;text-decoration:none;font-weight:600">Catalog</a>
    <a href="/api/genome/discovery" style="padding:14px 22px;border-radius:10px;border:1px solid #2c3550;color:#cfd6ff;text-decoration:none;font-weight:600">Discovery JSON</a>
  </div>
  <p id="gnm-meta" style="color:#8aa0b8;margin:0 0 18px">Loading genomes…</p>
  <div id="gnm-kpis" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:28px"></div>
  <div id="gnm-detail" style="display:none;margin-bottom:28px;padding:18px 20px;border:1px solid #2a3544;background:rgba(20,28,40,.55)">
    <h2 id="gnm-detail-title" style="font-size:1.15rem;margin:0 0 10px"></h2>
    <pre id="gnm-detail-body" style="margin:0;white-space:pre-wrap;color:#cfd6ff;font-size:13px;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></pre>
  </div>
  <h2 style="font-size:1.2rem;margin:0 0 10px">22 Chromosomes</h2>
  <ul id="gnm-chromo" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));list-style:none;padding:0;margin:0 0 28px;color:#cfd6ff"></ul>
  <p id="gnm-principle" style="color:#8aa0b8;margin:0;font-style:italic"></p>
</section>`;

  const js = `(function(){
  function card(k,v){return '<div style="padding:14px 16px;border:1px solid #2a3544;background:rgba(20,28,40,.55)"><div style="color:#8aa0b8;font-size:12px">'+k+'</div><div style="font-size:1.35rem;font-weight:700;margin-top:4px">'+v+'</div></div>';}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var path=location.pathname||'/genome';
  Promise.all([
    fetch('/api/genome/status',{cache:'no-store'}).then(function(r){return r.json();}),
    fetch('/api/genome/discovery',{cache:'no-store'}).then(function(r){return r.json();})
  ]).then(function(arr){
    var st=arr[0]||{}; var d=arr[1]||{};
    var m=document.getElementById('gnm-meta');
    var k=document.getElementById('gnm-kpis');
    var chromo=document.getElementById('gnm-chromo');
    var prin=document.getElementById('gnm-principle');
    if(m) m.textContent=(st.started?'Armed':'Warming')+' · '+(st.protocol||'GENOME/1.0')+' · '+(st.design||d.design||'Living Genome')+' · '+(st.invention||'AI Genome');
    var c=st.counts||{};
    if(k) k.innerHTML=[
      card('Genomes',c.genomesLive||c.genomesBorn||0),
      card('Graph nodes',c.graphNodes||0),
      card('Graph edges',c.graphEdges||0),
      card('Registrations',c.registrations||0),
      card('Opportunities',c.opportunities||0),
      card('Evolutions',c.evolutions||0),
      card('Orchestrator ticks',c.orchestratorTicks||0),
      card('Maintenance ops',c.maintenanceOps||0),
      card('Chromosomes',st.chromosomeCount||22)
    ].join('');
    var list=d.chromosomes||st.chromosomes||[];
    if(chromo) chromo.innerHTML=list.map(function(x){return '<li style="padding:10px 12px;border:1px solid #2a3544;background:rgba(20,28,40,.4)">'+esc(String(x).replace(/_/g,' '))+'</li>';}).join('');
    if(prin) prin.textContent=st.principle||d.principle||'';
  }).catch(function(){var m=document.getElementById('gnm-meta');if(m)m.textContent='Status temporarily unreachable.';});

  var detail=document.getElementById('gnm-detail');
  var title=document.getElementById('gnm-detail-title');
  var bodyEl=document.getElementById('gnm-detail-body');
  function showDetail(t,obj){
    if(!detail)return;
    detail.style.display='block';
    if(title) title.textContent=t;
    if(bodyEl) bodyEl.textContent=typeof obj==='string'?obj:JSON.stringify(obj,null,2);
  }
  var idMatch=path.match(/^\\/genome\\/([^/]+)/);
  if(idMatch && idMatch[1] && idMatch[1] !== ''){
    fetch('/api/genome/'+encodeURIComponent(idMatch[1]),{cache:'no-store'}).then(function(r){return r.json();}).then(function(out){
      showDetail('Genome '+(out.genome&&out.genome.id||idMatch[1]), out);
    }).catch(function(){showDetail('Genome','unreachable');});
  } else if(path.indexOf('/genome/graph')===0){
    fetch('/api/genome/graph',{cache:'no-store'}).then(function(r){return r.json();}).then(function(out){
      showDetail('Universal Intelligence Graph', out);
    }).catch(function(){showDetail('Graph','unreachable');});
  }
})();`;

  try {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30',
      'X-Unicorn-Page': 'genome',
    });
  } catch (_) { /* ignore */ }
  return res.end(renderPage('AI Genome Engine · ZeusAI', body, js));
}

async function handleApi(req, res, urlPath, requestUrl) {
  const genome = _genome();
  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(obj));
  };

  if (urlPath === '/api/genome/status' || urlPath === '/api/genome' || urlPath === '/.well-known/genome.json') {
    return json(200, genome.getStatus());
  }
  if (urlPath === '/api/genome/discovery') {
    return json(200, genome.discovery());
  }
  if (urlPath === '/api/genome/graph' && req.method === 'GET') {
    const sku = requestUrl && requestUrl.searchParams && requestUrl.searchParams.get('sku');
    return json(200, genome.getGraph({ sku }));
  }
  if (urlPath === '/api/genome/search' && req.method === 'GET') {
    const q = requestUrl && requestUrl.searchParams && requestUrl.searchParams.get('q');
    return json(200, genome.searchGenomes(q));
  }
  if (urlPath.startsWith('/api/genome/') && req.method === 'GET'
    && !['status', 'discovery', 'graph', 'search', 'register', 'evolve', 'orchestrate', 'migrate'].includes(urlPath.split('/')[3])) {
    const id = decodeURIComponent(urlPath.split('/').pop() || '');
    const out = genome.getGenome(id);
    return json(out && out.ok ? 200 : 404, out);
  }
  if ((urlPath === '/api/genome/register' || urlPath === '/api/genome/evolve'
    || urlPath === '/api/genome/orchestrate' || urlPath === '/api/genome/migrate') && req.method === 'POST') {
    const gate = adminOk(req);
    if (!gate.ok) return json(gate.code || 401, { ok: false, error: gate.error });
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (_) { body = {}; }
    let out;
    if (urlPath.endsWith('/evolve')) out = genome.evolveOnce();
    else if (urlPath.endsWith('/orchestrate')) out = genome.orchestrateOnce();
    else if (urlPath.endsWith('/migrate')) out = genome.planMigration(body);
    else out = genome.registerProduct(body.product || body);
    return json(out && out.ok ? 200 : 400, out);
  }
  return json(404, { ok: false, error: 'genome_route_not_found' });
}

module.exports = {
  matchesPage,
  matchesApi,
  renderGenomePage,
  handleApi,
  adminOk,
};
