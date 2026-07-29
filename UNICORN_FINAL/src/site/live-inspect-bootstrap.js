'use strict';
/**
 * Minimal Live Inspect bootstrap for standalone HTML pages that do NOT load
 * src/site/v2/client.js. Inject once before </body>. Buttons/anchors with
 * data-live-inspect open an in-page drawer instead of dumping raw JSON.
 */
function scriptTag() {
  return `<script>(function(){
if(window.__zeusLiveInspectBoot)return;window.__zeusLiveInspectBoot=1;
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function ensure(){
  var d=document.getElementById('zeusLiveInspect');
  if(d)return d;
  d=document.createElement('div');
  d.id='zeusLiveInspect';
  d.setAttribute('role','dialog');
  d.style.cssText='display:none;position:fixed;inset:0;z-index:12000;background:rgba(5,4,10,.72);padding:16px;align-items:flex-end;justify-content:center';
  d.innerHTML='<div style="width:min(920px,100%);max-height:86vh;overflow:auto;background:#0b0f17;border:1px solid rgba(163,138,255,.35);border-radius:16px;padding:18px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><span style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8aa0b8">Live inspect</span><h3 id="zeusLiveInspectTitle" style="margin:6px 0 0;color:#e8ecff">…</h3></div><div style="display:flex;gap:8px"><button type="button" id="zeusLiveInspectCopy" style="padding:8px 12px;border-radius:8px;border:1px solid #2c3550;background:#14132a;color:#eaf0ff">Copy JSON</button><button type="button" id="zeusLiveInspectClose" style="padding:8px 12px;border-radius:8px;border:1px solid #2c3550;background:#14132a;color:#eaf0ff">Close</button></div></div><div id="zeusLiveInspectSummary" style="margin-top:12px;color:#cfd6ff"></div><details style="margin-top:12px"><summary style="cursor:pointer;color:#8aa0b8">Raw JSON</summary><pre id="zeusLiveInspectRaw" style="margin-top:8px;max-height:40vh;overflow:auto;font:12px/1.45 ui-monospace,monospace;color:#9ad;white-space:pre-wrap"></pre></details></div>';
  document.body.appendChild(d);
  d.addEventListener('click',function(e){if(e.target===d)close();});
  document.getElementById('zeusLiveInspectClose').onclick=close;
  document.getElementById('zeusLiveInspectCopy').onclick=function(){
    var t=(document.getElementById('zeusLiveInspectRaw')||{}).textContent||'';
    try{navigator.clipboard.writeText(t);this.textContent='Copied ✓';var b=this;setTimeout(function(){b.textContent='Copy JSON';},1200);}catch(_){ }
  };
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  return d;
}
function close(){var d=document.getElementById('zeusLiveInspect');if(d)d.style.display='none';}
function summarize(data,endpoint){
  if(data==null)return '<p>Empty response.</p>';
  if(typeof data!=='object')return '<p>'+esc(data)+'</p>';
  var parts=['<div style="font-size:12px;color:#8aa0b8;margin-bottom:8px"><code>'+esc(endpoint)+'</code> · live</div>'];
  if(data.title)parts.push('<div><b>'+esc(data.title)+'</b></div>');
  if(data.version)parts.push('<div>Version · <code>'+esc(data.version)+'</code></div>');
  if(data.ok!=null)parts.push('<div>Status · <b style="color:#7fffd4">'+esc(data.ok?'ok':'degraded')+'</b></div>');
  if(data.summary&&typeof data.summary==='object')parts.push('<div>Summary · '+esc(JSON.stringify(data.summary))+'</div>');
  var keys=Object.keys(data).slice(0,14);
  if(parts.length<3)parts.push('<div style="font-size:13px;color:#8aa0b8">Keys: '+keys.map(esc).join(', ')+(Object.keys(data).length>14?'…':'')+'</div>');
  return parts.join('');
}
async function open(endpoint,title){
  var d=ensure();d.style.display='flex';
  document.getElementById('zeusLiveInspectTitle').textContent=String(title||'Live inspect').slice(0,80);
  document.getElementById('zeusLiveInspectSummary').innerHTML='<p style="color:#8aa0b8">Loading…</p>';
  document.getElementById('zeusLiveInspectRaw').textContent='';
  try{
    var r=await fetch(endpoint,{cache:'no-store',headers:{Accept:'application/json'}});
    var ct=String(r.headers.get('content-type')||'');
    var data; if(ct.indexOf('json')>=0) data=await r.json(); else { var t=await r.text(); try{data=JSON.parse(t);}catch(_){data={ok:r.ok,status:r.status,body:t.slice(0,4000)};} }
    document.getElementById('zeusLiveInspectSummary').innerHTML=summarize(data,endpoint);
    document.getElementById('zeusLiveInspectRaw').textContent=JSON.stringify(data,null,2);
  }catch(e){
    document.getElementById('zeusLiveInspectSummary').innerHTML='<p style="color:#ff6b6b">'+esc(e&&e.message||e)+'</p>';
  }
}
window.__zeusOpenLiveInspect=open;
window.__zeusCloseLiveInspect=close;
document.addEventListener('click',function(e){
  var a=e.target.closest('[data-live-inspect],a[href]');
  if(!a)return;
  if(a.hasAttribute('download')||a.getAttribute('data-allow-raw')==='1')return;
  var href=a.getAttribute('data-live-inspect')||a.getAttribute('href')||'';
  href=String(href).trim();
  if(!href||href.charAt(0)==='#'||/^https?:|^mailto:|^javascript:/i.test(href))return;
  try{ if(href.indexOf('/api-explorer')===0){ var u=new URL(href,location.origin); href=u.searchParams.get('endpoint')||href; } }catch(_){ }
  if(/^\\/api-explorer\\/?$/.test(href.split('?')[0])&&href.indexOf('endpoint=')<0)return;
  var isApi=/^(\\/api\\/|\\/\\.well-known\\/|\\/integrity\\.json|\\/openapi)/.test(href);
  var isInspect=a.hasAttribute('data-live-inspect');
  if(!isInspect&&!isApi)return;
  if(/\\.(svg|png|jpe?g|gif|webp|csv|zip|pdf)$/i.test(href))return;
  e.preventDefault();e.stopPropagation();
  open(href,a.getAttribute('data-live-title')||a.textContent||'Live inspect');
},true);
})();</script>`;
}

function btn(endpoint, label, attrs) {
  const a = attrs || {};
  const cls = a.className || 'btn';
  const style = a.style ? ` style="${String(a.style).replace(/"/g, '&quot;')}"` : '';
  const title = String(label || 'Inspect live').replace(/</g, '');
  return `<button type="button" class="${cls}" data-live-inspect="${endpoint}" data-live-title="${title.replace(/"/g, '')}"${style}>${title}</button>`;
}

module.exports = { scriptTag, btn };
