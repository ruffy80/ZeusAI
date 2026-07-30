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
    let ctaLabel = 'Buy with BTC';
    if (buyability && typeof buyability.assessBuyability === 'function') {
      const a = buyability.assessBuyability(p);
      mode = a.mode;
      buyable = !!a.buyable;
      reason = a.reason || reason;
      ctaLabel = a.ctaLabel || ctaLabel;
    }
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
    const modeTag = p.mode === 'btc'
      ? '<span class="tag" style="background:rgba(247,147,26,.15);color:#f7931a">BTC self-serve · real delivery</span>'
      : (p.mode === 'reserve'
        ? '<span class="tag" style="background:rgba(138,92,255,.16);color:var(--violet2)">BTC reserve · kickoff pack now</span>'
        : '<span class="tag">Contact / SOW</span>');
    const price = p.priceUSD > 0
      ? ('$' + p.priceUSD.toLocaleString('en-US', { maximumFractionDigits: 0 }))
      : 'Free';
    const href = p.ctaHref;
    const btnClass = p.buyable ? 'btn btn-primary' : 'btn btn-ghost';
    return `<article class="card" style="padding:18px;display:flex;flex-direction:column;gap:10px;border-color:${p.mode === 'btc' ? 'rgba(247,147,26,.35)' : 'var(--stroke)'}">
  <div style="display:flex;flex-wrap:wrap;gap:8px">${modeTag}${mins}</div>
  <h3 style="margin:0;font-size:18px">${_esc(p.title)}</h3>
  <p style="margin:0;color:var(--ink-dim);font-size:13.5px;flex:1;line-height:1.5">${_esc(p.description)}</p>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <strong style="font-size:22px">${_esc(price)}</strong>
    <a class="${btnClass}" href="${_esc(href)}" data-link>${_esc(p.ctaLabel)} →</a>
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
      <p class="lead">Only self-serve SKUs with real fulfillment recipes appear here. Pay in BTC → signed receipt → digital pack (or professional kickoff). Card/PayPal/NOWPayments appear when you arm them later — never faked.</p>
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
    <p style="color:var(--ink-dim)">open → deliver → probe → release | refund_intent</p>
    <button type="button" class="btn btn-primary" id="poopRefresh" style="margin-top:8px">Load live escrows</button>
    <pre id="poopOut" style="margin-top:12px;font-size:12px;white-space:pre-wrap;max-height:280px;overflow:auto;color:var(--ink-dim)">Loading…</pre>
  </div>
  <div class="card" style="padding:18px">
    <span class="kicker">DPS /1.0</span>
    <h3>Delivery Passport Standard</h3>
    <p style="color:var(--ink-dim)">Signed artifact hash per fulfillment — not a chain NFT.</p>
    <button type="button" class="btn btn-primary" id="dpsRefresh" style="margin-top:8px">Load passports</button>
    <pre id="dpsOut" style="margin-top:12px;font-size:12px;white-space:pre-wrap;max-height:280px;overflow:auto;color:var(--ink-dim)">Loading…</pre>
  </div>
  <div class="card" style="padding:18px">
    <span class="kicker">ACE /1.0</span>
    <h3>Agent Capability Exchange</h3>
    <p style="color:var(--ink-dim)">House listing + prepaid credits (require payment proof).</p>
    <button type="button" class="btn btn-primary" id="aceRefresh" style="margin-top:8px">Load listings</button>
    <pre id="aceOut" style="margin-top:12px;font-size:12px;white-space:pre-wrap;max-height:280px;overflow:auto;color:var(--ink-dim)">Loading…</pre>
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
</section>

<script>
(function(){
  function j(url, el){
    var node = document.getElementById(el);
    if(!node) return;
    fetch(url,{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      node.textContent = JSON.stringify(d, null, 2);
    }).catch(function(e){ node.textContent = String(e && e.message || e); });
  }
  function boot(){
    j('/api/poop/status', 'poopOut');
    j('/api/dps/status', 'dpsOut');
    j('/api/ace/status', 'aceOut');
  }
  var a = document.getElementById('poopRefresh'); if(a) a.onclick = function(){ j('/api/poop/escrows','poopOut'); };
  var b = document.getElementById('dpsRefresh'); if(b) b.onclick = function(){ j('/api/dps/passports','dpsOut'); };
  var c = document.getElementById('aceRefresh'); if(c) c.onclick = function(){ j('/api/ace/listings','aceOut'); };
  boot();
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
  <pre id="dpakOut" style="font-size:12px;white-space:pre-wrap;color:var(--ink-dim)">Loading planes…</pre>
</section>

<section class="card" style="padding:18px;margin-bottom:48px">
  <span class="kicker">EIQ · External Immortality Quorum</span>
  <pre id="eiqOut" style="font-size:12px;white-space:pre-wrap;color:var(--ink-dim)">Loading quorum…</pre>
  <p style="color:var(--ink-dim);font-size:13px;margin-top:8px">Add standby peers later via <code>EIQ_PEERS</code>. Quorum never pm2-restarts from inside the probed process.</p>
</section>

<script>
(function(){
  function paintRails(scan){
    var score = document.getElementById('arkScore');
    if(score) score.textContent = 'Readiness ' + (scan.readinessScore||0) + '% · ' + (scan.armedCount||0) + '/' + (scan.totalRails||0) + ' rails armed';
    var grid = document.getElementById('arkGrid');
    if(!grid) return;
    grid.innerHTML = (scan.rails||[]).map(function(r){
      var color = r.armed ? 'rgba(0,255,163,.35)' : 'rgba(255,120,160,.35)';
      var badge = r.armed ? 'ARMED' : 'IDLE';
      var next = (!r.armed && r.required && r.required.length) ? ('Set: ' + r.required.join(', ')) : (r.note||'');
      return '<div class="card" style="padding:14px;border-color:'+color+'"><strong>'+r.id+'</strong> · <span class="tag">'+badge+'</span><p style="font-size:12.5px;color:var(--ink-dim);margin:8px 0 0">'+String(next).replace(/</g,'&lt;')+'</p></div>';
    }).join('');
  }
  function load(){
    fetch('/api/ark/scan',{cache:'no-store'}).then(function(r){return r.json()}).then(paintRails).catch(function(e){
      var s=document.getElementById('arkScore'); if(s) s.textContent=String(e&&e.message||e);
    });
    fetch('/api/dpak/planes',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      var el=document.getElementById('dpakOut'); if(el) el.textContent=JSON.stringify(d,null,2);
    }).catch(function(){});
    fetch('/api/eiq/status',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      var el=document.getElementById('eiqOut'); if(el) el.textContent=JSON.stringify(d,null,2);
    }).catch(function(){});
  }
  var btn=document.getElementById('arkRefresh'); if(btn) btn.onclick=load;
  load();
})();
</script>`;
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
    <pre id="twinOut" style="margin-top:14px;font-size:12px;white-space:pre-wrap;color:var(--ink-dim);max-width:720px"></pre>
  </div>
</section>
<script>
(function(){
  var btn=document.getElementById('twinIssueBtn');
  if(!btn) return;
  btn.onclick=function(){
    var email=document.getElementById('twinEmail').value;
    var orderId=document.getElementById('twinOrder').value;
    fetch('/api/ctp/issue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,orderId:orderId||undefined})})
      .then(function(r){return r.json()}).then(function(d){
        var el=document.getElementById('twinOut');
        el.textContent=JSON.stringify(d,null,2);
        if(d&&d.ok&&d.twin&&d.twin.twinId){
          el.insertAdjacentHTML('afterend','<p style="margin-top:10px"><a class="btn btn-primary" href="/twin/'+d.twin.twinId+'">Open twin '+d.twin.twinId+' →</a></p>');
        }
      }).catch(function(e){ document.getElementById('twinOut').textContent=String(e&&e.message||e); });
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
      <button type="button" class="btn btn-primary" id="twinLoad">Load twin</button>
      <button type="button" class="btn btn-ghost" id="twinExport">Export bundle</button>
      <a class="btn btn-ghost" href="/buy" data-link>Back to Buy</a>
    </div>
    <pre id="twinOut" style="margin-top:16px;font-size:12px;white-space:pre-wrap;color:var(--ink-dim);max-width:800px">Loading…</pre>
  </div>
</section>
<script>
(function(){
  var id=${JSON.stringify(id)};
  function show(d){ var el=document.getElementById('twinOut'); if(el) el.textContent=JSON.stringify(d,null,2); }
  function load(){ fetch('/api/ctp/twin/'+encodeURIComponent(id),{cache:'no-store'}).then(function(r){return r.json()}).then(show).catch(function(e){show({ok:false,error:String(e&&e.message||e)});}); }
  function exp(){ fetch('/api/ctp/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({twinId:id})}).then(function(r){return r.json()}).then(show).catch(function(e){show({ok:false,error:String(e&&e.message||e)});}); }
  var a=document.getElementById('twinLoad'); if(a) a.onclick=load;
  var b=document.getElementById('twinExport'); if(b) b.onclick=exp;
  load();
})();
</script>`;
}

function pageVom() {
  return `<section class="hero" style="min-height:auto;padding:48px 0 24px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Vertical Outcome Machines</span>
    <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Three real verticals. Zero fake GMV.</span></h1>
    <p class="lead">Each machine is offer → BTC pay → PoOP → DPS → CLOS. Open only with a real orderId.</p>
  </div>
</section>
<section class="card" style="padding:18px;margin-bottom:48px">
  <button type="button" class="btn btn-primary" id="vomRefresh">Load verticals</button>
  <pre id="vomOut" style="margin-top:12px;font-size:12px;white-space:pre-wrap;color:var(--ink-dim)"></pre>
  <p style="margin-top:14px"><a class="btn btn-primary" href="/checkout/?plan=instant-seo-content-pack" data-link>Run SEO vertical →</a></p>
</section>
<script>
(function(){
  function load(){
    Promise.all([
      fetch('/api/vom/status',{cache:'no-store'}).then(function(r){return r.json()}),
      fetch('/api/vom/verticals',{cache:'no-store'}).then(function(r){return r.json()})
    ]).then(function(arr){
      document.getElementById('vomOut').textContent=JSON.stringify({status:arr[0],verticals:arr[1]},null,2);
    }).catch(function(e){ document.getElementById('vomOut').textContent=String(e&&e.message||e); });
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
  <p style="color:var(--ink-dim);margin:0 0 12px;font-size:14px">Record attention weight → ARC mints a catalog offer → checkout still requires BTC. Never invents GMV.</p>
  <form id="zaArcForm" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center" onsubmit="return false">
    <input id="zaArcActor" type="text" placeholder="actor id (optional)" style="padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);min-width:160px"/>
    <input id="zaArcWeight" type="number" min="1" max="20" value="5" style="width:90px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink)"/>
    <button type="button" class="btn btn-primary" id="zaArcMint">Mint offer from attention →</button>
  </form>
  <pre id="zaArcOut" style="margin-top:12px;font-size:12px;white-space:pre-wrap;color:var(--ink-dim)"></pre>
</section>
<script>
(function(){
  var btn=document.getElementById('zaArcMint');
  if(!btn) return;
  btn.onclick=function(){
    var actorId=document.getElementById('zaArcActor').value||('social_'+Date.now());
    var weight=Number(document.getElementById('zaArcWeight').value||5);
    fetch('/api/arc/attention',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actorId:actorId,weight:weight,channel:'zeusai-social'})})
      .then(function(r){return r.json()}).then(function(d){
        var el=document.getElementById('zaArcOut');
        el.textContent=JSON.stringify(d,null,2);
        if(d&&d.offer&&d.offer.checkoutPath){
          el.insertAdjacentHTML('afterend','<p style="margin-top:10px"><a class="btn btn-primary" href="'+d.offer.checkoutPath+'">Checkout minted offer →</a></p>');
        }
      }).catch(function(e){ document.getElementById('zaArcOut').textContent=String(e&&e.message||e); });
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
