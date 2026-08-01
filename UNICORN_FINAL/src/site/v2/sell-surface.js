'use strict';

/**
 * Sell-surface pages — real-world buyable / proof / rails / twin UI.
 * Additive only. Data comes from unified-catalog + WSI APIs.
 */

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _loadBuyable() {
  let items = [];
  try {
    const uc = require('../../commerce/unified-catalog');
    items = typeof uc.all === 'function' ? uc.all() : [];
  } catch (_) {
    try {
      const inst = require('../../commerce/instant-catalog');
      items = typeof inst.all === 'function' ? inst.all() : [];
    } catch (__) { items = []; }
  }
  let buyability = null;
  try { buyability = require('../../commerce/commerce-buyability'); } catch (_) {}

  const out = [];
  for (const p of items) {
    if (!p || !p.id) continue;
    let mode = 'btc';
    let buyable = true;
    let reason = 'self_serve';
    let ctaLabel = 'Buy → choose payment';
    if (buyability && typeof buyability.assessBuyability === 'function') {
      const a = buyability.assessBuyability(p);
      mode = a.mode;
      buyable = !!a.buyable;
      reason = a.reason || reason;
      ctaLabel = a.ctaLabel || ctaLabel;
    }
    try {
      const upr = require('../commerce/universal-payment-rails');
      if (buyable && upr && typeof upr.ctaLabel === 'function') {
        ctaLabel = upr.ctaLabel(mode === 'reserve' ? 'reserve' : 'checkout');
      }
    } catch (_) { /* keep assessed label */ }
    if (mode === 'unavailable') continue;
    out.push({
      id: p.id,
      title: p.title || p.id,
      tier: p.tier || 'instant',
      priceUSD: Number(p.priceUSD != null ? p.priceUSD : (p.priceUsd != null ? p.priceUsd : p.price)) || 0,
      description: p.description || '',
      deliveryMinutes: p.deliveryMinutes || null,
      mode,
      buyable,
      reason,
      ctaLabel,
      ctaHref: buyable
        ? ('/checkout/?plan=' + encodeURIComponent(p.id))
        : (mode === 'contact' ? '/contact' : '/services'),
    });
  }
  return out;
}

function pageBuy() {
  const all = _loadBuyable();
  const instant = all.filter((p) => p.tier === 'instant' && p.mode === 'btc');
  const professional = all.filter((p) => p.tier === 'professional' || p.mode === 'reserve');
  const contact = all.filter((p) => p.mode === 'contact');

  function card(p) {
    const mins = p.deliveryMinutes ? `<span class="tag">${_esc(String(p.deliveryMinutes))} min delivery</span>` : '';
    const modeTag = (p.mode === 'btc' || p.mode === 'checkout')
      ? '<span class="tag" style="background:rgba(247,147,26,.15);color:#f7931a">BTC · PayPal · card/crypto</span>'
      : (p.mode === 'reserve'
        ? '<span class="tag" style="background:rgba(138,92,255,.16);color:var(--violet2)">Reserve · multi-rail</span>'
        : '<span class="tag">Contact / SOW</span>');
    const price = p.priceUSD > 0
      ? ('$' + p.priceUSD.toLocaleString('en-US', { maximumFractionDigits: 0 }))
      : 'Free';
    const href = p.ctaHref;
    const btnClass = p.buyable ? 'btn btn-primary' : 'btn btn-ghost';
    const sov = p.buyable
      ? ` data-sovereign-buy="${_esc(p.id)}" data-buy-mode="checkout"`
      : '';
    return `<article class="card" style="padding:18px;display:flex;flex-direction:column;gap:10px;border-color:${(p.mode === 'btc' || p.mode === 'checkout') ? 'rgba(247,147,26,.35)' : 'var(--stroke)'}">
  <div style="display:flex;flex-wrap:wrap;gap:8px">${modeTag}${mins}</div>
  <h3 style="margin:0;font-size:18px">${_esc(p.title)}</h3>
  <p style="margin:0;color:var(--ink-dim);font-size:13.5px;flex:1;line-height:1.5">${_esc(p.description)}</p>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <strong style="font-size:22px">${_esc(price)}</strong>
    <a class="${btnClass}" href="${_esc(href)}"${sov} data-link>${_esc(p.ctaLabel)}</a>
  </div>
  <p style="margin:0;font-size:11.5px;color:var(--ink-dim)">Receipt signed · Delivery Passport (DPS) · Commerce Twin exportable after pay</p>
</article>`;
  }

  const instantHtml = instant.map(card).join('') || '<p class="card">Instant catalog loading…</p>';
  const proHtml = professional.map(card).join('');
  const contactHtml = contact.slice(0, 6).map(card).join('');

  return `<section class="hero" style="min-height:auto;padding:48px 0 24px">
  <div class="hero-grid">
    <div class="hero-copy">
      <span class="hero-eyebrow"><span class="dot"></span> Real-world storefront · BTC to owner wallet</span>
      <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Buy what we actually deliver.</span></h1>
      <p class="lead">Only self-serve SKUs with real fulfillment recipes appear here. Every buy opens BTC · PayPal · card/crypto — signed receipt and delivery after settlement. Never faked rails.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#buy-instant" data-link>Shop instant delivery</a>
        <a class="btn btn-ghost" href="/outcomes" data-link>See outcome proofs</a>
      </div>
    </div>
  </div>
</section>

<section id="buy-instant" style="margin:8px 0 32px">
  <div class="section-title">
    <div><span class="kicker">Instant · self-serve BTC</span><h2>Pay now. <span class="grad">Get a real pack.</span></h2></div>
    <p>${instant.length} buyable instant products with fulfillment recipes. Deterministic pack if AI keys idle; AI pack when fulfillment AI is armed.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">${instantHtml}</div>
</section>

${proHtml ? `<section id="buy-pro" style="margin:32px 0">
  <div class="section-title">
    <div><span class="kicker">Professional · BTC reserve</span><h2>Kickoff pack now. <span class="grad">Human build next.</span></h2></div>
    <p>Honest reserve rail: you get a kickoff deliverable immediately; finished professional work is milestone/SOW — not fake “done on payment”.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">${proHtml}</div>
</section>` : ''}

${contactHtml ? `<section id="buy-enterprise" style="margin:32px 0 48px">
  <div class="section-title">
    <div><span class="kicker">Enterprise · contact</span><h2>Outcome-priced. <span class="grad">No fake self-serve.</span></h2></div>
    <p>High-ticket work stays contact/SOW. That is commerce honesty — not a missing button.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">${contactHtml}</div>
  <p style="margin-top:16px"><a class="btn btn-primary" href="/contact" data-link>Talk to operator →</a>
  <a class="btn btn-ghost" href="/vom" data-link style="margin-left:8px">Vertical Outcome Machines</a></p>
</section>` : ''}

<section class="card" style="margin:0 0 48px;padding:20px;background:linear-gradient(135deg,rgba(0,255,163,.06),rgba(62,160,255,.06))">
  <span class="kicker">SEO Agency Outcome Machine (VOM)</span>
  <h3 style="margin:8px 0">One vertical to real GMV — Instant SEO Content Pack</h3>
  <p style="color:var(--ink-dim);margin:0 0 12px">Checkout BTC → PoOP escrow → Delivery Passport → closed loop. No invented revenue.</p>
  <a class="btn btn-primary" href="/checkout/?plan=instant-seo-content-pack" data-link>Buy SEO pack ($79) →</a>
  <a class="btn btn-ghost" href="/rails" data-link style="margin-left:8px">Check payment rails</a>
</section>`;
}

function pageOutcomes() {
  return `<section class="hero" style="min-height:auto;padding:48px 0 20px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Proof-of-Outcome · Delivery Passport</span>
    <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Outcomes you can verify.</span></h1>
    <p class="lead">PoOP escrows and DPS passports are live protocols — release attests acceptance; refund intents never fake on-chain clawbacks on BTC-direct.</p>
  </div>
</section>

<section class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:28px">
  <div class="card" style="padding:18px">
    <span class="kicker">PoOP /1.0</span>
    <h3>Proof-of-Outcome Protocol</h3>
    <p style="color:var(--ink-dim);margin:0 0 10px">open → deliver → probe → release</p>
    <div id="poopSummary" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px">
      <div class="tag">Loading status…</div>
    </div>
    <button type="button" class="btn btn-primary" id="poopRefresh">Refresh escrows</button>
    <div id="poopOut" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto"></div>
  </div>
  <div class="card" style="padding:18px">
    <span class="kicker">DPS /1.0</span>
    <h3>Delivery Passport Standard</h3>
    <p style="color:var(--ink-dim);margin:0 0 10px">Signed artifact hash per fulfillment — not a chain NFT.</p>
    <div id="dpsSummary" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px">
      <div class="tag">Loading status…</div>
    </div>
    <button type="button" class="btn btn-primary" id="dpsRefresh">Refresh passports</button>
    <div id="dpsOut" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto"></div>
  </div>
  <div class="card" style="padding:18px">
    <span class="kicker">ACE /1.0</span>
    <h3>Agent Capability Exchange</h3>
    <p style="color:var(--ink-dim);margin:0 0 10px">House listings + prepaid credits (require payment proof).</p>
    <div id="aceSummary" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px">
      <div class="tag">Loading status…</div>
    </div>
    <button type="button" class="btn btn-primary" id="aceRefresh">Refresh listings</button>
    <div id="aceOut" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto"></div>
  </div>
</section>

<section class="card" style="padding:18px;margin-bottom:48px">
  <span class="kicker">VOM · SEO vertical</span>
  <h3>Close a real loop</h3>
  <ol style="color:var(--ink-dim);line-height:1.7">
    <li><a href="/buy#buy-instant" data-link>Buy Instant SEO Content Pack</a> with BTC</li>
    <li>Wait for on-chain confirm → delivery pack</li>
    <li>Passport appears here · twin exportable at <a href="/twin" data-link>/twin</a></li>
  </ol>
  <a class="btn btn-primary" href="/checkout/?plan=instant-seo-content-pack" data-link>Start SEO outcome →</a>
  <a class="btn btn-ghost" href="/vom" data-link style="margin-left:8px">All vertical machines</a>
</section>

<script>
(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function chip(label, value){ return '<div class="tag">'+esc(label)+': <strong style="margin-left:4px">'+esc(value)+'</strong></div>'; }
  function empty(msg){ return '<p style="margin:0;color:var(--ink-dim);font-size:13.5px">'+esc(msg)+'</p>'; }
  function details(obj){
    try {
      return '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--ink-dim)">Technical detail</summary><pre class="code" style="margin-top:8px;font-size:11px;max-height:120px;overflow:auto">'+esc(JSON.stringify(obj,null,2))+'</pre></details>';
    } catch(_){ return ''; }
  }
  function paintStatus(el, d, keys){
    if(!el) return;
    if(!d || d.ok === false){ el.innerHTML = chip('Status', (d && (d.error||d.reason)) || 'unavailable'); return; }
    el.innerHTML = keys.map(function(k){
      var v = d[k.key];
      if (v == null && d.counts) v = d.counts[k.key];
      if (v == null) v = '—';
      return chip(k.label, v);
    }).join('');
  }
  function paintList(el, items, mapFn, emptyMsg){
    if(!el) return;
    if(!items || !items.length){ el.innerHTML = empty(emptyMsg); return; }
    el.innerHTML = items.slice(0,12).map(mapFn).join('') + details({ count: items.length, sample: items.slice(0,3) });
  }
  function loadPoopStatus(){
    fetch('/api/poop/status',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      paintStatus(document.getElementById('poopSummary'), d, [
        {key:'running', label:'Running'},
        {key:'open', label:'Open'},
        {key:'released', label:'Released'},
        {key:'protocol', label:'Protocol'}
      ]);
    }).catch(function(){ paintStatus(document.getElementById('poopSummary'), {ok:false,error:'offline'}, []); });
  }
  function loadDpsStatus(){
    fetch('/api/dps/status',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      paintStatus(document.getElementById('dpsSummary'), d, [
        {key:'running', label:'Running'},
        {key:'issued', label:'Issued'},
        {key:'protocol', label:'Protocol'}
      ]);
    }).catch(function(){ paintStatus(document.getElementById('dpsSummary'), {ok:false,error:'offline'}, []); });
  }
  function loadAceStatus(){
    fetch('/api/ace/status',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      paintStatus(document.getElementById('aceSummary'), d, [
        {key:'running', label:'Running'},
        {key:'listings', label:'Listings'},
        {key:'protocol', label:'Protocol'}
      ]);
    }).catch(function(){ paintStatus(document.getElementById('aceSummary'), {ok:false,error:'offline'}, []); });
  }
  function loadEscrows(){
    fetch('/api/poop/escrows',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      var items = (d && (d.escrows || d.items)) || [];
      paintList(document.getElementById('poopOut'), items, function(e){
        return '<div class="card" style="padding:12px;border-color:rgba(0,255,163,.25)"><strong>'+esc(e.orderId||e.escrowId||'escrow')+'</strong>'
          +' <span class="tag">'+esc(e.status||e.phase||'open')+'</span>'
          +'<p style="margin:6px 0 0;font-size:12.5px;color:var(--ink-dim)">'+esc(e.serviceId||'—')+(e.amountUsd!=null?(' · $'+e.amountUsd):'')+'</p></div>';
      }, 'No open escrows yet — buy a product to open one.');
    }).catch(function(e){ document.getElementById('poopOut').innerHTML = empty(String(e&&e.message||e)); });
  }
  function loadPassports(){
    fetch('/api/dps/passports',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      var items = (d && (d.passports || d.items)) || [];
      paintList(document.getElementById('dpsOut'), items, function(p){
        return '<div class="card" style="padding:12px;border-color:rgba(62,160,255,.3)"><strong>'+esc(p.passportId||p.orderId||'passport')+'</strong>'
          +'<p style="margin:6px 0 0;font-size:12.5px;color:var(--ink-dim)">Order '+esc(p.orderId||'—')+' · hash '+(p.artifactHash?esc(String(p.artifactHash).slice(0,16))+'…':'—')+'</p></div>';
      }, 'No delivery passports yet — they appear after a paid fulfillment.');
    }).catch(function(e){ document.getElementById('dpsOut').innerHTML = empty(String(e&&e.message||e)); });
  }
  function loadListings(){
    fetch('/api/ace/listings',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      var items = (d && (d.listings || d.items)) || [];
      paintList(document.getElementById('aceOut'), items, function(L){
        return '<div class="card" style="padding:12px"><strong>'+esc(L.title||L.id||'listing')+'</strong>'
          +' <span class="tag">'+esc(L.status||'listed')+'</span>'
          +'<p style="margin:6px 0 0;font-size:12.5px;color:var(--ink-dim)">'+esc(L.capability||L.description||'Agent capability')+'</p></div>';
      }, 'House listings load here. Credits still require payment proof.');
    }).catch(function(e){ document.getElementById('aceOut').innerHTML = empty(String(e&&e.message||e)); });
  }
  loadPoopStatus(); loadDpsStatus(); loadAceStatus();
  loadEscrows(); loadPassports(); loadListings();
  var a=document.getElementById('poopRefresh'); if(a) a.onclick=function(){ loadPoopStatus(); loadEscrows(); };
  var b=document.getElementById('dpsRefresh'); if(b) b.onclick=function(){ loadDpsStatus(); loadPassports(); };
  var c=document.getElementById('aceRefresh'); if(c) c.onclick=function(){ loadAceStatus(); loadListings(); };
})();
</script>`;
}

function pageRails() {
  return `<section class="hero" style="min-height:auto;padding:48px 0 20px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Armed Rails Continuum</span>
    <h1><span class="hero-brand">ZeusAI</span> <span class="grad">What is armed — honestly.</span></h1>
    <p class="lead">BTC-direct is primary. Telegram outbound already boots when tokens exist. NOWPayments &amp; PayPal stay idle until you add keys later — this page will never claim them ready without secrets.</p>
  </div>
</section>

<section class="card" style="padding:20px;margin-bottom:20px">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <div>
      <span class="kicker">ARK /1.0 readiness</span>
      <h2 id="arkScore" style="margin:6px 0">Scanning…</h2>
    </div>
    <button type="button" class="btn btn-primary" id="arkRefresh">Rescan rails</button>
  </div>
  <div id="arkGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:16px"></div>
</section>

<section class="card" style="padding:18px;margin-bottom:20px">
  <span class="kicker">DPAK · Dual-Plane Autonomy</span>
  <h3 style="margin:8px 0 12px">Safe plane vs growth plane</h3>
  <div id="dpakOut" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px"><p style="color:var(--ink-dim)">Loading planes…</p></div>
</section>

<section class="card" style="padding:18px;margin-bottom:48px">
  <span class="kicker">EIQ · External Immortality Quorum</span>
  <h3 style="margin:8px 0 12px">Peer health quorum</h3>
  <div id="eiqOut" style="display:flex;flex-wrap:wrap;gap:10px"><span class="tag">Loading quorum…</span></div>
  <p style="color:var(--ink-dim);font-size:13px;margin-top:12px">Add standby peers later via <code>EIQ_PEERS</code>. Quorum never restarts this process from inside a probe.</p>
</section>

<script>
(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function details(obj){
    try { return '<details style="margin-top:10px;grid-column:1/-1"><summary style="cursor:pointer;font-size:12px;color:var(--ink-dim)">Technical detail</summary><pre class="code" style="margin-top:8px;font-size:11px;max-height:120px;overflow:auto">'+esc(JSON.stringify(obj,null,2))+'</pre></details>'; }
    catch(_){ return ''; }
  }
  function paintRails(scan){
    var score = document.getElementById('arkScore');
    if(score) score.textContent = 'Readiness ' + (scan.readinessScore||0) + '% · ' + (scan.armedCount||0) + '/' + (scan.totalRails||0) + ' rails armed';
    var grid = document.getElementById('arkGrid');
    if(!grid) return;
    grid.innerHTML = (scan.rails||[]).map(function(r){
      var color = r.armed ? 'rgba(0,255,163,.35)' : 'rgba(255,120,160,.35)';
      var badge = r.armed ? 'ARMED' : 'IDLE';
      var next = (!r.armed && r.required && r.required.length) ? ('Set: ' + r.required.join(', ')) : (r.note||'');
      return '<div class="card" style="padding:14px;border-color:'+color+'"><strong>'+esc(r.id)+'</strong> · <span class="tag">'+badge+'</span><p style="font-size:12.5px;color:var(--ink-dim);margin:8px 0 0">'+esc(next)+'</p></div>';
    }).join('') + details(scan);
  }
  function paintDpak(d){
    var el=document.getElementById('dpakOut'); if(!el) return;
    var planes = (d && (d.planes || d.items)) || [];
    if (!Array.isArray(planes) && d && typeof d === 'object') {
      planes = Object.keys(d).filter(function(k){ return k==='safe'||k==='growth'||(d[k]&&d[k].mode); }).map(function(k){
        var p = d[k] || {};
        return { id: k, armed: !!p.armed, mode: p.mode || p.state || (p.armed?'armed':'idle'), note: p.note || p.reason || '' };
      });
      if (!planes.length && d.safe) planes = [
        { id: 'safe', armed: !!(d.safe && d.safe.armed !== false), mode: (d.safe && d.safe.mode) || 'monitor', note: 'Stable autonomy plane' },
        { id: 'growth', armed: !!(d.growth && d.growth.armed), mode: (d.growth && d.growth.mode) || 'idle', note: 'Growth plane stays idle until armed' }
      ];
    }
    if (!planes.length) {
      el.innerHTML = '<p style="color:var(--ink-dim);margin:0">Planes unavailable.</p>' + details(d);
      return;
    }
    el.innerHTML = planes.map(function(p){
      var armed = !!p.armed;
      return '<div class="card" style="padding:14px;border-color:'+(armed?'rgba(0,255,163,.35)':'rgba(255,120,160,.3)')+'"><strong>'+esc(p.id||p.name||'plane')+'</strong> · <span class="tag">'+(armed?'ARMED':'IDLE')+'</span><p style="margin:8px 0 0;font-size:12.5px;color:var(--ink-dim)">'+esc(p.mode||'')+(p.note?(' — '+esc(p.note)):'')+'</p></div>';
    }).join('') + details(d);
  }
  function paintEiq(d){
    var el=document.getElementById('eiqOut'); if(!el) return;
    var peers = (d && (d.peers || (d.quorum && d.quorum.peers))) || [];
    var healthy = d && (d.healthyCount != null ? d.healthyCount : (d.quorum && d.quorum.healthy));
    var required = d && (d.required != null ? d.required : (d.quorum && d.quorum.required));
    var ok = d && (d.ok !== false) && (d.quorumOk != null ? d.quorumOk : true);
    var html = '';
    html += '<span class="tag">Quorum: <strong>'+(ok?'OK':'DEGRADED')+'</strong></span>';
    if (healthy != null) html += '<span class="tag">Healthy peers: <strong>'+esc(healthy)+'</strong></span>';
    if (required != null) html += '<span class="tag">Required: <strong>'+esc(required)+'</strong></span>';
    html += '<span class="tag">Peers configured: <strong>'+esc(Array.isArray(peers)?peers.length:0)+'</strong></span>';
    if (Array.isArray(peers) && peers.length) {
      html += peers.slice(0,8).map(function(p){
        return '<span class="tag">'+(p.ok||p.healthy?'●':'○')+' '+esc(p.id||p.url||p.host||'peer')+'</span>';
      }).join('');
    } else {
      html += '<p style="width:100%;margin:8px 0 0;color:var(--ink-dim);font-size:13px">No external peers yet — local process reports alone until you add EIQ_PEERS.</p>';
    }
    el.innerHTML = html + details(d);
  }
  function load(){
    fetch('/api/ark/scan',{cache:'no-store'}).then(function(r){return r.json()}).then(paintRails).catch(function(e){
      var s=document.getElementById('arkScore'); if(s) s.textContent=String(e&&e.message||e);
    });
    fetch('/api/dpak/planes',{cache:'no-store'}).then(function(r){return r.json()}).then(paintDpak).catch(function(){
      var el=document.getElementById('dpakOut'); if(el) el.innerHTML='<p style="color:var(--ink-dim)">Planes offline</p>';
    });
    fetch('/api/eiq/status',{cache:'no-store'}).then(function(r){return r.json()}).then(paintEiq).catch(function(){
      var el=document.getElementById('eiqOut'); if(el) el.innerHTML='<span class="tag">Quorum offline</span>';
    });
  }
  var btn=document.getElementById('arkRefresh'); if(btn) btn.onclick=load;
  load();
})();
</script>`;
}

function _twinPaintScript() {
  return `function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function details(obj){
    try { return '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:var(--ink-dim)">Technical detail</summary><pre class="code" style="margin-top:8px;font-size:11px;max-height:140px;overflow:auto">'+esc(JSON.stringify(obj,null,2))+'</pre></details>'; }
    catch(_){ return ''; }
  }
  function paintTwin(el, d){
    if(!el) return;
    if(!d || d.ok === false){
      el.innerHTML = '<div class="card" style="padding:14px;border-color:rgba(255,120,160,.35)"><strong>Could not load twin</strong><p style="margin:8px 0 0;color:var(--ink-dim)">'+esc((d&&(d.error||d.reason))||'unavailable')+'</p></div>' + details(d||{});
      return;
    }
    var t = d.twin || d;
    var orders = t.orders || [];
    var html = '<div class="card" style="padding:16px;border-color:rgba(0,255,163,.3)">';
    html += '<span class="tag">CTP twin</span>';
    html += '<h3 style="margin:8px 0 4px">'+esc(t.twinId||'twin')+'</h3>';
    html += '<p style="margin:0;color:var(--ink-dim);font-size:13px">Issued '+esc(t.issuedAt||'—')+' · Updated '+esc(t.updatedAt||'—')+'</p>';
    if (t.ownerBtc) html += '<p style="margin:8px 0 0;font-size:12.5px;color:var(--ink-dim)">Owner wallet '+esc(t.ownerBtc)+'</p>';
    if (orders.length) {
      html += '<ul style="margin:12px 0 0;padding-left:18px;color:var(--ink-dim);font-size:13.5px;line-height:1.6">';
      orders.slice(0,8).forEach(function(o){
        html += '<li><strong style="color:var(--ink)">'+esc(o.orderId||'order')+'</strong> · '+esc(o.serviceId||'—')+(o.amountUsd!=null?(' · $'+o.amountUsd):'')+' · '+esc(o.status||'')+'</li>';
      });
      html += '</ul>';
    } else {
      html += '<p style="margin:12px 0 0;color:var(--ink-dim);font-size:13.5px">No linked orders yet — pay for a product first, then re-issue.</p>';
    }
    if (d.bundle || d.export || d.contentHash) {
      html += '<p style="margin:12px 0 0;font-size:13px">Export hash: <code>'+esc(String(d.contentHash||d.exportHash||(d.bundle&&d.bundle.hash)||'ready').slice(0,24))+'…</code></p>';
    }
    if (t.twinId) html += '<p style="margin:14px 0 0"><a class="btn btn-primary" href="/twin/'+encodeURIComponent(t.twinId)+'">Open twin page →</a></p>';
    html += '</div>' + details(d);
    el.innerHTML = html;
  }`;
}

function pageTwin(twinId) {
  const id = String(twinId || '').trim();
  if (!id) {
    return `<section class="hero" style="min-height:auto;padding:48px 0">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Commerce Twin Portable</span>
    <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Your portable buyer twin.</span></h1>
    <p class="lead">After payment, issue a twin from your order email. Export verifies offline via content hash.</p>
    <form id="twinIssueForm" class="card" style="margin-top:18px;padding:16px;display:flex;flex-wrap:wrap;gap:10px;max-width:640px" onsubmit="return false">
      <input id="twinEmail" type="email" required placeholder="buyer@email.com" style="flex:2;min-width:200px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink)"/>
      <input id="twinOrder" type="text" placeholder="orderId (optional)" style="flex:2;min-width:160px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink)"/>
      <button type="button" class="btn btn-primary" id="twinIssueBtn">Issue twin →</button>
    </form>
    <div id="twinOut" style="margin-top:14px;max-width:720px"></div>
  </div>
</section>
<script>
(function(){
  ${_twinPaintScript()}
  var btn=document.getElementById('twinIssueBtn');
  if(!btn) return;
  btn.onclick=function(){
    var email=document.getElementById('twinEmail').value;
    var orderId=document.getElementById('twinOrder').value;
    var el=document.getElementById('twinOut');
    if(el) el.innerHTML='<p style="color:var(--ink-dim)">Issuing twin…</p>';
    fetch('/api/ctp/issue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,orderId:orderId||undefined})})
      .then(function(r){return r.json()}).then(function(d){ paintTwin(el, d); })
      .catch(function(e){ paintTwin(el, {ok:false,error:String(e&&e.message||e)}); });
  };
})();
</script>`;
  }

  return `<section class="hero" style="min-height:auto;padding:48px 0 20px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> CTP twin</span>
    <h1><span class="hero-brand">Twin</span> <span class="grad">${_esc(id)}</span></h1>
    <p class="lead">Buyer-owned portable commerce record. Export for offline verify.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button type="button" class="btn btn-primary" id="twinLoad">Refresh twin</button>
      <button type="button" class="btn btn-ghost" id="twinExport">Export bundle</button>
      <a class="btn btn-ghost" href="/buy" data-link>Back to Buy</a>
    </div>
    <div id="twinOut" style="margin-top:16px;max-width:800px"><p style="color:var(--ink-dim)">Loading twin…</p></div>
  </div>
</section>
<script>
(function(){
  var id=${JSON.stringify(id)};
  ${_twinPaintScript()}
  function load(){ fetch('/api/ctp/twin/'+encodeURIComponent(id),{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){ paintTwin(document.getElementById('twinOut'), d); }).catch(function(e){ paintTwin(document.getElementById('twinOut'), {ok:false,error:String(e&&e.message||e)}); }); }
  function exp(){ fetch('/api/ctp/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({twinId:id})}).then(function(r){return r.json()}).then(function(d){ paintTwin(document.getElementById('twinOut'), d); }).catch(function(e){ paintTwin(document.getElementById('twinOut'), {ok:false,error:String(e&&e.message||e)}); }); }
  var a=document.getElementById('twinLoad'); if(a) a.onclick=load;
  var b=document.getElementById('twinExport'); if(b) b.onclick=exp;
  load();
})();
</script>`;
}

function _loadVomSnapshot() {
  const fallback = [
    {
      id: 'seo-agency',
      title: 'SEO Agency Outcome Machine',
      serviceId: 'instant-seo-content-pack',
      priceUsd: 79,
      promise: 'Keyword pack + content outline delivered with DPS passport',
    },
    {
      id: 'local-services',
      title: 'Local Services Outcome Machine',
      serviceId: 'instant-website-audit',
      priceUsd: 49,
      promise: 'Website audit pack for local service businesses',
    },
    {
      id: 'saas-onboarding',
      title: 'SaaS Onboarding Outcome Machine',
      serviceId: 'instant-pitch-deck',
      priceUsd: 149,
      promise: 'Pitch/onboarding deck pack for SaaS GTM',
    },
  ];
  try {
    const vom = require('../../../backend/modules/world-standard/vertical-outcome-machines');
    if (typeof vom.start === 'function') vom.start();
    const verticals = typeof vom.listVerticals === 'function' ? vom.listVerticals() : fallback;
    const status = typeof vom.getStatus === 'function' ? vom.getStatus() : null;
    return { verticals: verticals && verticals.length ? verticals : fallback, status };
  } catch (_) {
    return { verticals: fallback, status: null };
  }
}

function pageVom() {
  const snap = _loadVomSnapshot();
  const by = (snap.status && snap.status.byVertical) || {};
  const counts = (snap.status && snap.status.counts) || {};
  const cards = (snap.verticals || []).map((v) => {
    const st = by[v.id] || {};
    const price = v.priceUsd != null ? ('$' + Number(v.priceUsd).toLocaleString('en-US')) : '';
    const href = '/checkout/?plan=' + encodeURIComponent(v.serviceId);
    return `<article class="card" style="padding:20px;display:flex;flex-direction:column;gap:10px;border-color:rgba(138,92,255,.35)">
  <span class="tag">${_esc(v.id)}</span>
  <h3 style="margin:0;font-size:20px">${_esc(v.title || v.id)}</h3>
  <p style="margin:0;color:var(--ink-dim);font-size:14px;flex:1;line-height:1.55">${_esc(v.promise || '')}</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px">
    <span class="tag">Open cycles: <strong>${_esc(st.open != null ? st.open : 0)}</strong></span>
    <span class="tag">Closed: <strong>${_esc(st.closed != null ? st.closed : 0)}</strong></span>
    <span class="tag">Observed GMV: <strong>$${_esc(Number(st.gmvObservedUsd || 0).toFixed(0))}</strong></span>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:4px">
    <strong style="font-size:22px">${_esc(price)}</strong>
    <a class="btn btn-primary" href="${_esc(href)}" data-link>Buy &amp; run loop →</a>
  </div>
  <p style="margin:0;font-size:12px;color:var(--ink-dim)">SKU <code>${_esc(v.serviceId)}</code> · real catalog · real fulfillment</p>
</article>`;
  }).join('');

  return `<section class="hero" style="min-height:auto;padding:48px 0 24px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Vertical Outcome Machines</span>
    <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Three real verticals. Zero fake GMV.</span></h1>
    <p class="lead">Each machine is offer → BTC pay → PoOP → DPS → CLOS. Cycles open only with a real paid order — never invented revenue.</p>
    <div id="vomStats" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">
      <span class="tag">Protocol: <strong>${_esc((snap.status && snap.status.protocol) || 'VOM/1.0')}</strong></span>
      <span class="tag">Opened: <strong id="vomOpened">${_esc(counts.cyclesOpened != null ? counts.cyclesOpened : 0)}</strong></span>
      <span class="tag">Closed: <strong id="vomClosed">${_esc(counts.cyclesClosed != null ? counts.cyclesClosed : 0)}</strong></span>
      <span class="tag">Tracked: <strong id="vomTracked">${_esc(counts.tracked != null ? counts.tracked : 0)}</strong></span>
      <span class="tag">Invented GMV: <strong>never</strong></span>
    </div>
  </div>
</section>

<section style="margin:8px 0 28px">
  <div class="section-title">
    <div><span class="kicker">Live machines</span><h2>Pick a vertical. <span class="grad">Pay. Get a passport.</span></h2></div>
    <p>Cards below are the real catalog SKUs wired into VOM — not API debug output.</p>
  </div>
  <div id="vomGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">${cards}</div>
</section>

<section class="card" style="padding:18px;margin-bottom:48px">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <div>
      <span class="kicker">Live refresh</span>
      <h3 style="margin:6px 0">Cycle counters update from the API</h3>
    </div>
    <button type="button" class="btn btn-primary" id="vomRefresh">Refresh stats</button>
  </div>
  <p id="vomMsg" style="margin:12px 0 0;color:var(--ink-dim);font-size:13.5px">Showing SSR snapshot — click refresh for live counters.</p>
  <p style="margin-top:14px">
    <a class="btn btn-primary" href="/checkout/?plan=instant-seo-content-pack" data-link>Run SEO vertical →</a>
    <a class="btn btn-ghost" href="/buy" data-link style="margin-left:8px">All buyable products</a>
    <a class="btn btn-ghost" href="/outcomes" data-link style="margin-left:8px">Outcome proofs</a>
  </p>
</section>
<script>
(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function setText(id, v){ var el=document.getElementById(id); if(el) el.textContent = String(v); }
  function paint(status, catalog){
    var counts = (status && status.counts) || {};
    setText('vomOpened', counts.cyclesOpened != null ? counts.cyclesOpened : 0);
    setText('vomClosed', counts.cyclesClosed != null ? counts.cyclesClosed : 0);
    setText('vomTracked', counts.tracked != null ? counts.tracked : 0);
    var by = (status && status.byVertical) || {};
    var list = (catalog && (catalog.verticals || catalog.items || catalog)) || [];
    if (!Array.isArray(list)) list = [];
    var grid = document.getElementById('vomGrid');
    if (grid && list.length) {
      grid.innerHTML = list.map(function(v){
        var st = by[v.id] || {};
        var price = v.priceUsd != null ? ('$'+Number(v.priceUsd).toLocaleString('en-US')) : '';
        var href = '/checkout/?plan='+encodeURIComponent(v.serviceId||'');
        return '<article class="card" style="padding:20px;display:flex;flex-direction:column;gap:10px;border-color:rgba(138,92,255,.35)">'
          +'<span class="tag">'+esc(v.id)+'</span>'
          +'<h3 style="margin:0;font-size:20px">'+esc(v.title||v.id)+'</h3>'
          +'<p style="margin:0;color:var(--ink-dim);font-size:14px;flex:1;line-height:1.55">'+esc(v.promise||'')+'</p>'
          +'<div style="display:flex;flex-wrap:wrap;gap:8px">'
          +'<span class="tag">Open cycles: <strong>'+esc(st.open!=null?st.open:0)+'</strong></span>'
          +'<span class="tag">Closed: <strong>'+esc(st.closed!=null?st.closed:0)+'</strong></span>'
          +'<span class="tag">Observed GMV: <strong>$'+esc(Number(st.gmvObservedUsd||0).toFixed(0))+'</strong></span>'
          +'</div>'
          +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:4px">'
          +'<strong style="font-size:22px">'+esc(price)+'</strong>'
          +'<a class="btn btn-primary" href="'+esc(href)+'" data-link>Buy &amp; run loop →</a>'
          +'</div>'
          +'<p style="margin:0;font-size:12px;color:var(--ink-dim)">SKU <code>'+esc(v.serviceId)+'</code> · real catalog · real fulfillment</p>'
          +'</article>';
      }).join('');
    }
    var msg = document.getElementById('vomMsg');
    if (msg) msg.textContent = 'Live · ' + (status && status.timestamp ? status.timestamp : new Date().toISOString()) + ' · invented GMV: never';
  }
  function load(){
    Promise.all([
      fetch('/api/vom/status',{cache:'no-store'}).then(function(r){return r.json()}),
      fetch('/api/vom/verticals',{cache:'no-store'}).then(function(r){return r.json()})
    ]).then(function(arr){ paint(arr[0], arr[1]); })
      .catch(function(e){ var msg=document.getElementById('vomMsg'); if(msg) msg.textContent='Live refresh unavailable — SSR cards remain valid. '+String(e&&e.message||e); });
  }
  var b=document.getElementById('vomRefresh'); if(b) b.onclick=load; load();
})();
</script>`;
}

/** Additive ARC panel HTML for social page */
function socialArcPanelHtml() {
  return `<section class="card" id="zaArcPanel" style="margin:24px 0;padding:20px;background:linear-gradient(135deg,rgba(247,147,26,.10),rgba(138,92,255,.08));border:1px solid rgba(247,147,26,.35)">
  <span class="kicker" style="color:#f7931a">Attention → Revenue Continuum</span>
  <h2 style="margin:8px 0 6px;font-size:22px">Your attention can mint a real offer</h2>
  <p style="color:var(--ink-dim);margin:0 0 12px;font-size:14px">Record attention weight → ARC mints a catalog offer → checkout with Bitcoin, PayPal, or card/crypto. Never invents GMV.</p>
  <form id="zaArcForm" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center" onsubmit="return false">
    <input id="zaArcActor" type="text" placeholder="actor id (optional)" style="padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);min-width:160px"/>
    <input id="zaArcWeight" type="number" min="1" max="20" value="5" style="width:90px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink)"/>
    <button type="button" class="btn btn-primary" id="zaArcMint">Mint offer from attention →</button>
  </form>
  <div id="zaArcOut" style="margin-top:12px"></div>
</section>
<script>
(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var btn=document.getElementById('zaArcMint');
  if(!btn) return;
  btn.onclick=function(){
    var actorId=document.getElementById('zaArcActor').value||('social_'+Date.now());
    var weight=Number(document.getElementById('zaArcWeight').value||5);
    var el=document.getElementById('zaArcOut');
    if(el) el.innerHTML='<p style="color:var(--ink-dim);margin:0">Minting offer…</p>';
    fetch('/api/arc/attention',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actorId:actorId,weight:weight,channel:'zeusai-social'})})
      .then(function(r){return r.json()}).then(function(d){
        if(!el) return;
        if(!d || d.ok === false){
          el.innerHTML='<div class="card" style="padding:14px;border-color:rgba(255,120,160,.35)"><strong>Mint failed</strong><p style="margin:6px 0 0;color:var(--ink-dim)">'+esc((d&&(d.error||d.reason))||'unavailable')+'</p></div>';
          return;
        }
        var offer = d.offer || {};
        var html = '<div class="card" style="padding:14px;border-color:rgba(247,147,26,.4)">';
        html += '<span class="tag">Offer minted</span>';
        html += '<h3 style="margin:8px 0 4px">'+esc(offer.title||offer.serviceId||'Attention offer')+'</h3>';
        html += '<p style="margin:0;color:var(--ink-dim);font-size:13.5px">Weight '+esc(weight)+' · actor '+esc(actorId)+'</p>';
        if (offer.priceUsd != null) html += '<p style="margin:8px 0 0;font-size:18px;font-weight:700">$'+esc(offer.priceUsd)+'</p>';
        if (offer.checkoutPath) html += '<p style="margin:12px 0 0"><a class="btn btn-primary" href="'+esc(offer.checkoutPath)+'" data-sovereign-buy="'+esc(offer.serviceId||'')+'" data-buy-mode="checkout">Checkout → choose payment</a></p>';
        else if (offer.serviceId) html += '<p style="margin:12px 0 0"><a class="btn btn-primary" href="/checkout/?plan='+encodeURIComponent(offer.serviceId)+'" data-sovereign-buy="'+esc(offer.serviceId)+'" data-buy-mode="checkout">Checkout → choose payment</a></p>';
        html += '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:var(--ink-dim)">Technical detail</summary><pre class="code" style="margin-top:8px;font-size:11px;max-height:120px;overflow:auto">'+esc(JSON.stringify(d,null,2))+'</pre></details>';
        html += '</div>';
        el.innerHTML = html;
      }).catch(function(e){ if(el) el.innerHTML='<p style="color:#ff9cbe;margin:0">'+esc(String(e&&e.message||e))+'</p>'; });
  };
})();
</script>`;
}

/** Additive home conversion strip */
function homeBuyStripHtml(catalogCount) {
  const n = Number(catalogCount) || 0;
  return `<section id="homeBuyStrip" style="margin:28px 0 0">
  <div class="card" style="padding:22px 24px;background:linear-gradient(135deg,rgba(247,147,26,.14),rgba(0,255,163,.08));border:1px solid rgba(247,147,26,.45);display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between">
    <div style="min-width:260px;flex:1">
      <span class="kicker" style="color:#f7931a">Real-world storefront</span>
      <h2 style="margin:6px 0 4px;font-size:clamp(20px,2.4vw,28px)">Buy only what ZeusAI can deliver today</h2>
      <p style="margin:0;color:var(--ink-dim);font-size:14px">${n} catalog products gated by buyability · BTC to owner wallet · Proof strip: paid → passport → twin</p>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a class="btn btn-primary" href="/buy" data-link>Open /buy →</a>
      <a class="btn btn-ghost" href="/outcomes" data-link>Outcomes</a>
      <a class="btn btn-ghost" href="/rails" data-link>Rails honesty</a>
      <a class="btn btn-ghost" href="/sw-reset">Reset cache</a>
    </div>
  </div>
</section>`;
}

module.exports = {
  pageBuy,
  pageOutcomes,
  pageRails,
  pageTwin,
  pageVom,
  socialArcPanelHtml,
  homeBuyStripHtml,
  _loadBuyable,
};
