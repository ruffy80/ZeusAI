'use strict';

/**
 * Continuity Attestation public UI — human cards, not JSON dumps.
 */

function pageContinuity() {
  return `<section class="hero" style="min-height:auto;padding:48px 0 20px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Continuity Attestation Chain · CAC/1.0</span>
    <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Proof the merchant plane was alive while you paid.</span></h1>
    <p class="lead">Escrow proves money. Delivery passports prove packs. CAC proves the autonomous operator OS was bonded (or honestly degraded) during your payment window — a layer the internet never invented for solo/AI merchants.</p>
  </div>
</section>

<section class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:22px" id="cacStats">
  <div class="card" style="padding:16px"><span class="kicker">Chain tip</span><h3 id="cacTip" style="margin:8px 0 0;font-size:15px;word-break:break-all">Loading…</h3></div>
  <div class="card" style="padding:16px"><span class="kicker">Heartbeats</span><h3 id="cacBeats" style="margin:8px 0 0">—</h3></div>
  <div class="card" style="padding:16px"><span class="kicker">Plane hint</span><h3 id="cacHint" style="margin:8px 0 0">—</h3></div>
  <div class="card" style="padding:16px"><span class="kicker">Signing</span><h3 id="cacSign" style="margin:8px 0 0">—</h3></div>
</section>

<section style="margin-bottom:28px">
  <div class="section-title">
    <div><span class="kicker">Live chain</span><h2>Recent continuity heartbeats</h2></div>
    <p>Each beat hash-links to the previous and is signed. Never a fake 100% uptime claim.</p>
  </div>
  <div id="cacBeatList" class="grid" style="grid-template-columns:1fr;gap:10px"></div>
  <p style="margin-top:12px"><button type="button" class="btn btn-primary" id="cacRefresh">Refresh chain</button>
  <button type="button" class="btn btn-ghost" id="cacVerify" style="margin-left:8px">Verify chain integrity</button></p>
  <p id="cacVerifyOut" style="color:var(--ink-dim);font-size:13.5px;margin-top:10px"></p>
</section>

<section class="card" style="padding:20px;margin-bottom:48px">
  <span class="kicker">Order continuity passport</span>
  <h2 style="margin:8px 0 10px">Bind or look up a real order</h2>
  <p style="color:var(--ink-dim);margin:0 0 14px">After BTC payment, CAC can issue a Continuity Passport for your orderId. Paste it below to verify.</p>
  <form id="cacForm" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center" onsubmit="return false">
    <input id="cacOrder" type="text" placeholder="ord_…" style="flex:2;min-width:200px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink)"/>
    <button type="button" class="btn btn-primary" id="cacLookup">Look up passport</button>
    <button type="button" class="btn btn-ghost" id="cacBind">Issue / rebind</button>
  </form>
  <div id="cacPassport" style="margin-top:14px"></div>
  <p style="margin-top:14px;font-size:13px;color:var(--ink-dim)">Also: <a href="/buy" data-link>/buy</a> · <a href="/outcomes" data-link>/outcomes</a> · <a href="/rails" data-link>/rails</a> · <a href="/trust" data-link>/trust</a></p>
</section>

<script>
(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function details(obj){
    try { return '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--ink-dim)">Technical detail</summary><pre class="code" style="margin-top:8px;font-size:11px;max-height:140px;overflow:auto">'+esc(JSON.stringify(obj,null,2))+'</pre></details>'; }
    catch(_){ return ''; }
  }
  function paintStatus(d){
    var tip=document.getElementById('cacTip'); if(tip) tip.textContent = d.tipHash ? String(d.tipHash).slice(0,24)+'…' : '—';
    var b=document.getElementById('cacBeats'); if(b) b.textContent = (d.beatCount!=null?d.beatCount:'—') + ' · seq ' + (d.seq!=null?d.seq:'—');
    var h=document.getElementById('cacHint'); if(h) h.textContent = d.lastVerdictHint || '—';
    var s=document.getElementById('cacSign'); if(s) s.textContent = (d.publicKey && d.publicKey.algorithm) || '—';
  }
  function paintBeats(beats){
    var el=document.getElementById('cacBeatList'); if(!el) return;
    if(!beats || !beats.length){ el.innerHTML='<p style="color:var(--ink-dim)">No heartbeats yet — chain boots with the immortality tick.</p>'; return; }
    el.innerHTML = beats.slice().reverse().slice(0,12).map(function(beat){
      var color = beat.commerceBlocked || beat.healerFail ? 'rgba(255,120,160,.35)' : (beat.bonded ? 'rgba(0,255,163,.3)' : 'rgba(255,211,106,.35)');
      var badge = beat.commerceBlocked ? 'BLOCKED' : (beat.healerFail ? 'HEALER-FAIL' : (beat.bonded ? 'BONDED' : 'STRESSED'));
      return '<div class="card" style="padding:14px;border-color:'+color+'"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
        +'<span class="tag">#'+esc(beat.seq)+'</span><span class="tag">'+badge+'</span><span class="tag">NDK '+esc(beat.ndkHealth||'—')+'</span>'
        +(beat.subosScore!=null?'<span class="tag">SUBOS '+esc(beat.subosScore)+'</span>':'')
        +(beat.tbosScore!=null?'<span class="tag">TBOS '+esc(beat.tbosScore)+'</span>':'')
        +'</div><p style="margin:8px 0 0;font-size:12.5px;color:var(--ink-dim)">'+esc(beat.at)+' · hash '+esc(String(beat.hash||'').slice(0,18))+'…</p></div>';
    }).join('');
  }
  function paintPassport(d){
    var el=document.getElementById('cacPassport'); if(!el) return;
    if(!d || d.ok===false){
      el.innerHTML='<div class="card" style="padding:14px;border-color:rgba(255,120,160,.35)"><strong>No passport</strong><p style="margin:6px 0 0;color:var(--ink-dim)">'+esc((d&&(d.reason||d.error))||'not found')+'</p></div>';
      return;
    }
    var p=d.passport||d;
    var v=d.verification||{};
    var ok = v.ok!==false;
    el.innerHTML='<div class="card" style="padding:16px;border-color:'+(ok?'rgba(0,255,163,.35)':'rgba(255,120,160,.35)')+'">'
      +'<span class="tag">'+esc(p.verdict||'passport')+'</span>'
      +'<h3 style="margin:8px 0 4px">'+esc(p.passportId||'passport')+'</h3>'
      +'<p style="margin:0;color:var(--ink-dim);font-size:13.5px">Order <strong style="color:var(--ink)">'+esc(p.orderId||'—')+'</strong> · beats '+esc(p.beatCount)+' · bonded '+esc(p.bondedCount)+' · degraded '+esc(p.degradedCount)+'</p>'
      +'<p style="margin:8px 0 0;font-size:12.5px;color:var(--ink-dim)">Window '+esc(p.windowFrom)+' → '+esc(p.windowTo)+'</p>'
      +(ok?'<p style="margin:10px 0 0;color:#7fffd4">Verification OK'+(v.signingMode?(' · '+esc(v.signingMode)):'')+'</p>':'')
      +details(p)+'</div>';
  }
  function load(){
    fetch('/api/cac/status',{cache:'no-store'}).then(function(r){return r.json()}).then(paintStatus).catch(function(){});
    fetch('/api/cac/beats?limit=12',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){ paintBeats(d.beats||[]); }).catch(function(){});
  }
  var refr=document.getElementById('cacRefresh'); if(refr) refr.onclick=load;
  var ver=document.getElementById('cacVerify'); if(ver) ver.onclick=function(){
    fetch('/api/cac/verify-chain?limit=40',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      var out=document.getElementById('cacVerifyOut');
      if(out) out.textContent = d.ok ? ('Chain OK · checked '+d.checked+' beats · tip '+(d.tipHash||'').slice(0,16)+'…') : ('Chain issues: '+(d.failures&&d.failures[0]&&d.failures[0].reason||'fail'));
    }).catch(function(e){ var out=document.getElementById('cacVerifyOut'); if(out) out.textContent=String(e&&e.message||e); });
  };
  var lookup=document.getElementById('cacLookup');
  if(lookup) lookup.onclick=function(){
    var id=document.getElementById('cacOrder').value.trim();
    if(!id) return;
    fetch('/api/cac/passport/'+encodeURIComponent(id),{cache:'no-store'}).then(function(r){return r.json()}).then(paintPassport).catch(function(e){ paintPassport({ok:false,error:String(e&&e.message||e)}); });
  };
  var bind=document.getElementById('cacBind');
  if(bind) bind.onclick=function(){
    var id=document.getElementById('cacOrder').value.trim();
    if(!id) return;
    fetch('/api/cac/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:id})})
      .then(function(r){return r.json()}).then(function(d){ paintPassport(d); load(); })
      .catch(function(e){ paintPassport({ok:false,error:String(e&&e.message||e)}); });
  };
  load();
})();
</script>`;
}

module.exports = { pageContinuity };
