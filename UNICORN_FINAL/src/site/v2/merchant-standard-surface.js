'use strict';

/**
 * Merchant Trust Standard — public human desk (/standard).
 * Cards + Live Inspect; never dump JSON as the primary UI.
 */

function pageStandard() {
  return `<section class="hero" style="min-height:auto;padding:48px 0 20px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Merchant Trust Standard · MTS/1.0</span>
    <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Is this merchant safe to pay — right now?</span></h1>
    <p class="lead">One signed envelope for humans and agents: buyable floor, armed rails honesty, bond + continuity pointers, and real checkout paths. Never invents GMV, uptime, or payment rails.</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px">
      <a class="btn btn-primary" href="/buy" data-link>Buy what we deliver →</a>
      <button type="button" class="btn btn-ghost" data-live-inspect="/.well-known/merchant.json" data-live-title="Merchant envelope">Inspect merchant envelope</button>
      <a class="btn btn-ghost" href="/continuity" data-link>Continuity desk</a>
    </div>
  </div>
</section>

<section class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:22px" id="mtsStats">
  <div class="card" style="padding:16px"><span class="kicker">Commerce ready</span><h3 id="mtsReady" style="margin:8px 0 0">Loading…</h3></div>
  <div class="card" style="padding:16px"><span class="kicker">BTC self-serve</span><h3 id="mtsBtc" style="margin:8px 0 0">—</h3></div>
  <div class="card" style="padding:16px"><span class="kicker">Rails armed</span><h3 id="mtsRails" style="margin:8px 0 0">—</h3></div>
  <div class="card" style="padding:16px"><span class="kicker">Site↔Unicorn</span><h3 id="mtsBond" style="margin:8px 0 0">—</h3></div>
</section>

<section style="margin-bottom:28px">
  <div class="section-title">
    <div><span class="kicker">Buyable floor</span><h2>Real SKUs you can pay for now</h2></div>
    <p>Only items that pass Commerce Reality buyability — BTC self-serve or reserve. Contact-only and unavailable stay out.</p>
  </div>
  <div id="mtsFloor" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px"></div>
</section>

<section class="card" style="padding:20px;margin-bottom:48px">
  <span class="kicker">Honesty contract</span>
  <h2 style="margin:8px 0 10px">What this standard never claims</h2>
  <ul style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:0;padding-left:18px">
    <li>No invented GMV or “billion ARR” theater</li>
    <li>No 100% uptime guarantee — continuity is attested via CAC heartbeats</li>
    <li>Idle rails (Stripe/PayPal/NOWPayments) stay idle until keys exist</li>
    <li><code class="inline">commerceReady</code> means: ≥1 BTC self-serve SKU and commerce not pressure-blocked</li>
  </ul>
  <p style="margin-top:14px;font-size:13px;color:var(--ink-dim)">Also: <a href="/trust" data-link>/trust</a> · <a href="/rails" data-link>/rails</a> · <a href="/outcomes" data-link>/outcomes</a> · <a href="/agents" data-link>/agents</a></p>
  <details style="margin-top:12px"><summary style="cursor:pointer;font-size:12px;color:var(--ink-dim)">Technical detail</summary>
    <pre class="code" id="mtsRaw" style="margin-top:8px;font-size:11px;max-height:180px;overflow:auto">—</pre>
  </details>
</section>

<script>
(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function tech(obj){
    try { return esc(JSON.stringify(obj,null,2)); } catch(_){ return '—'; }
  }
  function paint(d){
    var ready=document.getElementById('mtsReady');
    if(ready){
      ready.textContent = d.commerceReady ? 'YES — safe to buy' : 'NOT READY';
      ready.style.color = d.commerceReady ? '#7fffd4' : '#ff9aa8';
    }
    var btc=document.getElementById('mtsBtc');
    if(btc) btc.textContent = (d.buyableFloor && d.buyableFloor.btcSelfServeCount != null) ? d.buyableFloor.btcSelfServeCount : '—';
    var rails=document.getElementById('mtsRails');
    if(rails){
      var r=d.rails||{};
      rails.textContent = (r.armedCount!=null?r.armedCount:'—') + ' / ' + (r.totalRails!=null?r.totalRails:'—');
    }
    var bond=document.getElementById('mtsBond');
    if(bond){
      var s=d.bonds && d.bonds.siteUnicorn;
      if(s && s.pending) bond.textContent = 'warming…';
      else bond.textContent = s ? ((s.grade||'—') + ' · ' + (s.score!=null?s.score:'—')) : '—';
    }
    var floor=document.getElementById('mtsFloor');
    if(floor){
      var sample=(d.buyableFloor && d.buyableFloor.sample) || [];
      if(!sample.length){
        floor.innerHTML='<p style="color:var(--ink-dim)">No buyable SKUs in envelope — check catalog.</p>';
      } else {
        floor.innerHTML = sample.map(function(it){
          var href = it.ctaHref || ('/checkout/?plan='+encodeURIComponent(it.id||''));
          return '<div class="card" style="padding:16px"><span class="tag">'+esc(it.mode||'btc')+'</span>'
            +'<h3 style="margin:8px 0 4px;font-size:16px">'+esc(it.name||it.id)+'</h3>'
            +'<p style="margin:0;color:var(--ink-dim);font-size:13px">'+(it.priceUsd!=null?('$'+esc(it.priceUsd)):'')+'</p>'
            +'<div style="margin-top:10px"><a class="btn btn-primary" href="'+esc(href)+'" data-link>Buy →</a></div></div>';
        }).join('');
      }
    }
    var raw=document.getElementById('mtsRaw');
    if(raw) raw.textContent = '';
    if(raw) raw.appendChild(document.createTextNode(JSON.stringify({protocol:d.protocol,commerceReady:d.commerceReady,hash:d.hash,signature:d.signature,honesty:d.honesty}, null, 2)));
  }
  fetch('/api/merchant/standard',{cache:'no-store'}).then(function(r){return r.json()}).then(paint).catch(function(e){
    var ready=document.getElementById('mtsReady');
    if(ready) ready.textContent = 'unavailable';
    var floor=document.getElementById('mtsFloor');
    if(floor) floor.innerHTML='<p style="color:var(--ink-dim)">Envelope unavailable: '+esc(e&&e.message||e)+'</p>';
  });
})();
</script>`;
}

function homeStripHtml() {
  return `<aside class="mts-home-strip" data-mts-strip="1" aria-label="Merchant Trust Standard" style="margin:18px 0 8px;padding:16px 18px;border:1px solid rgba(13,148,136,.35);border-radius:14px;background:linear-gradient(165deg,rgba(13,148,136,.08),transparent 60%)">
  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
    <div>
      <span class="kicker">MTS/1.0 · World merchant standard</span>
      <p style="margin:6px 0 0;color:var(--ink-dim);font-size:13.5px;max-width:42rem">Agents and buyers can verify ZeusAI is commerce-ready before paying — signed buyable floor, rails honesty, continuity.</p>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <a class="btn btn-primary" href="/standard" data-link>Open standard</a>
      <a class="btn btn-ghost" href="/buy" data-link>Buy now</a>
    </div>
  </div>
</aside>`;
}

module.exports = { pageStandard, homeStripHtml };
