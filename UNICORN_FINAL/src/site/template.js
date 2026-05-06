// --- Performance: Debounce/Throttle helpers ---
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
function throttle(fn, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
// --- SYNCHRONIZED WITH ZEUSAI/UNICORN_FINAL/src/site/template.js ---
// This file is now a direct copy of the ZeusAI reference for maximum visual and functional parity.
// All advanced UI/UX, dashboard, admin, marketplace, and innovation features are present.
// NOTE: getSiteHtmlLegacy was removed (2026-04-24) — it was a placeholder stub, never called.
// The live v2 shell is served from src/site/v2/shell.js; getSiteHtml() below is kept
// only for legacy compatibility. It is NOT referenced by src/index.js on zeusai.pro.

function getSiteHtmlLegacy() { return null; } // stub kept for any cached import

function escapeTemplateValue(value) {
  return String(value || '').replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}

function getSiteHtml() {
  const btcWallet = escapeTemplateValue(process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
  const ownerName = escapeTemplateValue(process.env.OWNER_NAME || 'Vladoi Ionut');
  const ownerEmail = escapeTemplateValue(process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/>
<meta http-equiv="Pragma" content="no-cache"/>
<meta http-equiv="Expires" content="0"/>
<meta name="theme-color" content="#05060e"/>
<title>ZEUS AI — Build. Automate. Scale.</title>
<link rel="canonical" href="https://zeusai.pro/"/>
<meta name="description" content="ZEUS AI — Universal AI Unicorn Platform. Build, automate, and scale with the most advanced AI and autonomous business tools."/>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="ZEUS AI — Build. Automate. Scale."/>
<meta property="og:description" content="Universal AI Unicorn Platform. Build, automate, and scale with the most advanced AI and autonomous business tools."/>
<meta property="og:url" content="https://zeusai.pro/"/>
<meta property="og:site_name" content="ZEUS AI"/>
<meta property="og:image" content="https://zeusai.pro/assets/og-image.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="ZEUS AI — Build. Automate. Scale."/>
<meta name="twitter:description" content="Universal AI Unicorn Platform. Build, automate, and scale with the most advanced AI and autonomous business tools."/>
<meta name="twitter:image" content="https://zeusai.pro/assets/og-image.png"/>
<link rel="sitemap" type="application/xml" href="/sitemap.xml"/>
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ZEUS AI",
  "url": "https://zeusai.pro/",
  "logo": "https://zeusai.pro/assets/og-image.png",
  "sameAs": [
    "https://twitter.com/zeusai_pro",
    "https://www.linkedin.com/company/zeusai-pro/"
  ],
  "description": "Universal AI Unicorn Platform. Build, automate, and scale with the most advanced AI and autonomous business tools.",
  "contactPoint": [{
    "@type": "ContactPoint",
    "email": "${ownerEmail}",
    "contactType": "customer support"
  }]
}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>
:root{color-scheme:dark;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Rajdhani',system-ui,Arial;color:#e8f4ff;background:#05060e;overflow-x:hidden;min-height:100vh;}
#bg-canvas{position:fixed;inset:0;z-index:0;pointer-events:none;}

/* SCROLLBAR */
::-webkit-scrollbar{width:6px;}
::-webkit-scrollbar-track{background:rgba(0,0,0,.3);}
::-webkit-scrollbar-thumb{background:rgba(0,200,255,.3);border-radius:3px;}

/* HEADER */
#site-header{position:fixed;top:0;left:0;right:0;z-index:100;height:62px;background:rgba(5,6,14,.92);border-bottom:1px solid rgba(0,200,255,.18);backdrop-filter:blur(16px);display:flex;align-items:center;padding:0 24px;gap:20px;}
.hdr-logo{font-family:'Orbitron',monospace;font-size:18px;font-weight:900;background:linear-gradient(135deg,#00d4ff,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;cursor:pointer;white-space:nowrap;text-decoration:none;}
.hdr-nav{display:flex;gap:4px;align-items:center;flex:1;justify-content:center;}
.nav-btn{background:none;border:none;color:#7090b0;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:600;padding:6px 14px;border-radius:8px;cursor:pointer;transition:color .2s,background .2s;letter-spacing:.5px;}
.nav-btn:hover,.nav-btn.active{color:#00d4ff;background:rgba(0,212,255,.1);}
.hdr-right{display:flex;align-items:center;gap:12px;flex-shrink:0;}
.btc-ticker{font-family:'Orbitron',monospace;font-size:12px;color:#00ffa3;background:rgba(0,255,163,.08);border:1px solid rgba(0,255,163,.2);padding:4px 10px;border-radius:8px;white-space:nowrap;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:transform .2s,opacity .2s,box-shadow .2s,filter .2s;letter-spacing:.5px;text-decoration:none;}
.btn-primary{background:linear-gradient(135deg,#00d4ff,#0ea5e9);color:#05060e;}
.btn-primary:hover{filter:brightness(1.15);transform:translateY(-1px);}
.btn-outline{background:transparent;border:1px solid rgba(0,200,255,.4);color:#00d4ff;}
.btn-outline:hover{background:rgba(0,212,255,.1);}
.btn-danger{background:rgba(255,60,60,.15);border:1px solid rgba(255,60,60,.3);color:#ff6060;}
.btn-danger:hover{background:rgba(255,60,60,.25);}
.btn-ghost{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#e8f4ff;}
.btn-ghost:hover{background:rgba(255,255,255,.1);}
.btn-green{background:linear-gradient(135deg,#00ffa3,#00c87d);color:#05060e;}
.btn-green:hover{filter:brightness(1.1);}
.btn-sm{padding:5px 12px;font-size:13px;}
.btn-lg{padding:12px 28px;font-size:16px;}
.user-badge{display:flex;align-items:center;gap:8px;cursor:pointer;}
.user-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#c084fc);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',monospace;font-size:12px;color:#05060e;font-weight:900;}
.plan-pill{font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(0,255,163,.15);color:#00ffa3;border:1px solid rgba(0,255,163,.3);font-weight:700;text-transform:uppercase;}

/* LAYOUT */
.page-wrap{max-width:1280px;margin:0 auto;padding:82px 20px 40px;position:relative;z-index:1;}
.view{display:none;animation:fadeIn .4s ease;}
.view.active{display:block;}
@keyframes fadeIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}

/* CARD */
.card{background:rgba(10,14,36,.75);border:1px solid rgba(0,200,255,.2);border-radius:20px;padding:20px;backdrop-filter:blur(10px);}
.card-glow{box-shadow:0 0 30px rgba(0,180,255,.15) inset,0 4px 24px rgba(0,0,0,.5);}
.card-sm{padding:14px 16px;border-radius:14px;}
.card-hover{transition:transform .3s,box-shadow .3s,opacity .3s;}
.card-hover:hover{box-shadow:0 4px 20px rgba(0,212,255,.12);transform:translateY(-3px);}

/* TYPOGRAPHY */
.title{font-family:'Orbitron',monospace;font-size:clamp(22px,3.5vw,38px);font-weight:900;line-height:1.1;letter-spacing:.5px;background:linear-gradient(135deg,#00d4ff,#c084fc,#00ffa3);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.title-sm{font-family:'Orbitron',monospace;font-size:clamp(16px,2vw,22px);font-weight:700;color:#e8f4ff;}
.subtitle{color:#7dd3fc;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;}
.kpi-val{font-family:'Orbitron',monospace;font-size:28px;font-weight:700;color:#00d4ff;}
.label{font-size:12px;color:#7090b0;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
.muted{color:#7090b0;}
.green{color:#00ffa3;}
.purple{color:#c084fc;}
.cyan{color:#00d4ff;}
.badge{font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(0,255,163,.15);color:#00ffa3;border:1px solid rgba(0,255,163,.3);}
.badge-cyan{background:rgba(0,212,255,.15);color:#00d4ff;border-color:rgba(0,212,255,.3);}
.badge-purple{background:rgba(192,132,252,.15);color:#c084fc;border-color:rgba(192,132,252,.3);}
.badge-red{background:rgba(255,60,60,.15);color:#ff6060;border-color:rgba(255,60,60,.3);}
.btc-addr{font-family:monospace;font-size:11px;color:#00ffa3;word-break:break-all;background:rgba(0,255,163,.06);border:1px solid rgba(0,255,163,.2);border-radius:8px;padding:8px 10px;margin-top:8px;cursor:pointer;}

/* GRID HELPERS */
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.grid-auto{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;}
@media(max-width:900px){.grid-4,.grid-3{grid-template-columns:repeat(2,1fr);}.grid-2{grid-template-columns:1fr;}}
@media(max-width:600px){.grid-4,.grid-3,.grid-2{grid-template-columns:1fr;}}

/* HERO */
.hero-section{text-align:center;padding:60px 20px 40px;max-width:800px;margin:0 auto;}
.hero-title{font-family:'Orbitron',monospace;font-size:clamp(28px,5vw,56px);font-weight:900;line-height:1.1;background:linear-gradient(135deg,#00d4ff,#c084fc,#00ffa3);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:16px;}
.hero-sub{color:#7090b0;font-size:18px;margin-bottom:32px;line-height:1.6;}
.hero-ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}

/* ZEUS SPHERE */
.zeus-wrap{display:grid;grid-template-columns:1fr 200px;gap:20px;align-items:start;margin-bottom:24px;}
@media(max-width:700px){.zeus-wrap{grid-template-columns:1fr;}}
.zeus-face{position:relative;height:260px;border-radius:18px;overflow:hidden;border:1px solid rgba(0,200,255,.3);background:linear-gradient(145deg,#0a0e24,#060810);}
#zeusCanvas{width:100%;height:100%;display:block;}
.zeus-overlay{position:absolute;inset:0;pointer-events:none;}
.zeus-ring{position:absolute;inset:-10%;border-radius:50%;border:2px solid rgba(0,212,255,.18);animation:rotateRing 8s linear infinite;}
.zeus-ring2{position:absolute;inset:-20%;border-radius:50%;border:1px solid rgba(192,132,252,.12);animation:rotateRing 14s linear infinite reverse;}
.zeus-scan{position:absolute;left:0;right:0;top:-30%;height:70%;background:linear-gradient(to bottom,transparent,rgba(0,212,255,.2),transparent);animation:scan 3.6s infinite linear;}
.zeus-label{position:absolute;left:14px;bottom:12px;font-family:'Orbitron',monospace;font-size:11px;color:#00d4ff;letter-spacing:1px;text-shadow:0 0 8px #00d4ff;}
.zeus-status{position:absolute;right:14px;top:12px;display:flex;align-items:center;gap:6px;font-size:11px;color:#00ffa3;}
.zeus-dot{width:7px;height:7px;border-radius:50%;background:#00ffa3;box-shadow:0 0 8px #00ffa3;animation:pulse 1.8s infinite;}
.clock-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;}
#luxClock{width:180px;height:180px;}
.clock-digital{font-family:'Orbitron',monospace;font-size:20px;font-weight:700;color:#00d4ff;letter-spacing:3px;text-shadow:0 0 12px rgba(0,212,255,.7);text-align:center;}
.clock-date{font-size:11px;color:#7090b0;letter-spacing:2px;text-align:center;text-transform:uppercase;}

/* STATS BAR */
.stats-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:20px 0;}
@media(max-width:600px){.stats-bar{grid-template-columns:1fr 1fr;}}

/* HOW IT WORKS */
.how-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0;}
@media(max-width:700px){.how-steps{grid-template-columns:1fr;}}
.step-num{font-family:'Orbitron',monospace;font-size:32px;font-weight:900;color:rgba(0,212,255,.2);margin-bottom:8px;}
.step-title{font-family:'Orbitron',monospace;font-size:14px;font-weight:700;color:#e8f4ff;margin-bottom:6px;}
.step-desc{font-size:13px;color:#7090b0;line-height:1.6;}

/* SERVICE CARDS */
.svc-card{background:rgba(10,14,36,.75);border:1px solid rgba(0,200,255,.2);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px;transition:transform .3s,box-shadow .3s,opacity .3s;}
.svc-card:hover{box-shadow:0 4px 20px rgba(0,212,255,.12);transform:translateY(-4px);}
.svc-name{font-family:'Orbitron',monospace;font-size:14px;font-weight:700;color:#e8f4ff;}
.svc-desc{font-size:13px;color:#7090b0;line-height:1.5;flex:1;}
.svc-price{font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:#00ffa3;}
.svc-btc{font-size:11px;color:#7090b0;font-family:monospace;}
.svc-cat{display:inline-block;font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(192,132,252,.15);color:#c084fc;border:1px solid rgba(192,132,252,.3);text-transform:uppercase;letter-spacing:1px;}

/* SEARCH / FILTER */
.search-row{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;}
.search-inp{background:rgba(10,14,36,.8);border:1px solid rgba(0,200,255,.25);color:#e8f4ff;padding:8px 14px;border-radius:10px;font-family:'Rajdhani',sans-serif;font-size:14px;flex:1;min-width:200px;outline:none;}
.search-inp:focus{border-color:rgba(0,212,255,.6);}
.filter-btns{display:flex;gap:6px;flex-wrap:wrap;}
.filter-btn{background:rgba(10,14,36,.8);border:1px solid rgba(0,200,255,.2);color:#7090b0;padding:5px 12px;border-radius:8px;font-family:'Rajdhani',sans-serif;font-size:13px;cursor:pointer;transition:transform .2s,opacity .2s,box-shadow .2s;}
.filter-btn:hover,.filter-btn.active{background:rgba(0,212,255,.15);border-color:rgba(0,212,255,.5);color:#00d4ff;transform:scale(1.04);}

/* PRICING */
.pricing-toggle{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:28px;}
.toggle-label{font-size:14px;color:#7090b0;}
.toggle-label.active{color:#e8f4ff;}
.toggle-switch{position:relative;width:44px;height:24px;background:rgba(0,200,255,.2);border:1px solid rgba(0,200,255,.3);border-radius:12px;cursor:pointer;}
.toggle-switch .knob{position:absolute;top:2px;left:2px;width:18px;height:18px;background:#00d4ff;border-radius:50%;transition:left .2s;box-shadow:0 0 8px rgba(0,212,255,.6);}
.toggle-switch.on .knob{left:22px;}
.savings-badge{background:rgba(0,255,163,.15);color:#00ffa3;border:1px solid rgba(0,255,163,.3);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;}
.plan-card{background:rgba(10,14,36,.75);border:1px solid rgba(0,200,255,.2);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:12px;position:relative;transition:border-color .3s,transform .3s;}
.plan-card:hover{border-color:rgba(0,212,255,.4);transform:translateY(-4px);}
.plan-card.popular{border-color:rgba(192,132,252,.5);box-shadow:0 0 30px rgba(192,132,252,.15);}
.popular-tag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#c084fc,#818cf8);color:#fff;font-size:11px;font-weight:700;padding:3px 14px;border-radius:999px;white-space:nowrap;}
.plan-name{font-family:'Orbitron',monospace;font-size:16px;font-weight:700;color:#e8f4ff;}
.plan-price{font-family:'Orbitron',monospace;font-size:36px;font-weight:900;color:#00d4ff;}
.plan-price span{font-size:16px;color:#7090b0;font-weight:400;}
.plan-btc{font-size:11px;color:#7090b0;font-family:monospace;margin-top:-8px;}
.plan-features{list-style:none;display:flex;flex-direction:column;gap:8px;flex:1;}
.plan-features li{font-size:13px;color:#7090b0;padding-left:18px;position:relative;}
.plan-features li::before{content:'✓';position:absolute;left:0;color:#00ffa3;}
.plan-features li.no::before{content:'✗';color:#ff6060;}

/* ROI CALCULATOR */
.roi-form{display:grid;gap:14px;}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:600px){.form-row{grid-template-columns:1fr;}}
.form-group{display:flex;flex-direction:column;gap:6px;}
.form-label{font-size:12px;color:#7090b0;text-transform:uppercase;letter-spacing:1px;}
.form-inp{background:rgba(10,14,36,.8);border:1px solid rgba(0,200,255,.25);color:#e8f4ff;padding:10px 14px;border-radius:10px;font-family:'Rajdhani',sans-serif;font-size:14px;outline:none;}
.form-inp:focus{border-color:rgba(0,212,255,.6);}
select.form-inp option{background:#0a0e24;}
.roi-result{background:rgba(0,255,163,.06);border:1px solid rgba(0,255,163,.2);border-radius:14px;padding:16px;margin-top:8px;display:none;}
.roi-result.show{display:block;}

/* CASE STUDIES */
.case-card{background:rgba(10,14,36,.65);border:1px solid rgba(0,200,255,.15);border-radius:16px;padding:18px;transition:border-color .3s,transform .3s;}
.case-card:hover{border-color:rgba(0,212,255,.4);transform:translateY(-3px);}
.case-company{font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#00d4ff;margin-bottom:4px;}
.case-result{font-size:22px;font-weight:700;color:#00ffa3;margin-bottom:4px;}
.case-desc{font-size:12px;color:#7090b0;line-height:1.5;}

/* DASHBOARD */
.dash-grid{display:grid;grid-template-columns:2fr 1fr;gap:20px;}
@media(max-width:900px){.dash-grid{grid-template-columns:1fr;}}
.dash-section{margin-bottom:20px;}
.dash-section-title{font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#7090b0;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(0,200,255,.1);}
.hist-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;}
.hist-row:last-child{border-bottom:0;}
.key-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;}
.key-row:last-child{border-bottom:0;}
.key-val{font-family:monospace;color:#00d4ff;font-size:11px;}
.ref-link-box{background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:8px;padding:8px 12px;font-family:monospace;font-size:12px;color:#00d4ff;cursor:pointer;word-break:break-all;}

/* BAR */
.bar-wrap{margin-bottom:10px;}
.bar{height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:4px;}
.bar>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#00d4ff,#c084fc);box-shadow:0 0 8px rgba(0,212,255,.5);transition:width 1.2s ease;}

/* MODAL */
.modal-backdrop{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;}
.modal-backdrop.hidden{display:none;}
.modal-box{background:#0a0e24;border:1px solid rgba(0,200,255,.3);border-radius:24px;padding:32px;width:100%;max-width:440px;position:relative;max-height:90vh;overflow-y:auto;box-shadow:0 0 60px rgba(0,180,255,.2);}
.modal-box.wide{max-width:560px;}
.modal-close{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.08);border:none;color:#7090b0;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;}
.modal-close:hover{color:#e8f4ff;background:rgba(255,255,255,.15);}
.modal-title{font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:#e8f4ff;margin-bottom:20px;}
.tab-row{display:flex;gap:4px;margin-bottom:20px;background:rgba(255,255,255,.04);border-radius:10px;padding:4px;}
.tab-btn{flex:1;background:none;border:none;color:#7090b0;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;padding:7px;border-radius:8px;cursor:pointer;transition:all .2s;}
.tab-btn.active{background:rgba(0,212,255,.15);color:#00d4ff;}
.tab-panel{display:none;}
.tab-panel.active{display:block;}
.inp-group{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
.inp-label{font-size:12px;color:#7090b0;text-transform:uppercase;letter-spacing:1px;}
.inp-field{background:rgba(5,6,14,.8);border:1px solid rgba(0,200,255,.25);color:#e8f4ff;padding:11px 14px;border-radius:10px;font-family:'Rajdhani',sans-serif;font-size:14px;outline:none;width:100%;}
.inp-field:focus{border-color:rgba(0,212,255,.6);}
.msg-ok{font-size:13px;color:#00ffa3;background:rgba(0,255,163,.08);border:1px solid rgba(0,255,163,.2);border-radius:8px;padding:8px 12px;margin-top:8px;}
.msg-err{font-size:13px;color:#ff6060;background:rgba(255,60,60,.08);border:1px solid rgba(255,60,60,.2);border-radius:8px;padding:8px 12px;margin-top:8px;}

/* CHECKOUT STEPS */
.pay-methods{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;}
.pay-method-btn{background:rgba(10,14,36,.9);border:1px solid rgba(0,200,255,.25);color:#e8f4ff;padding:16px 8px;border-radius:12px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;text-align:center;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:6px;}
.pay-method-btn:hover{border-color:#00d4ff;background:rgba(0,212,255,.1);}
.pay-method-icon{font-size:24px;}
.qr-img{width:160px;height:160px;display:block;margin:10px auto;border-radius:8px;border:2px solid rgba(0,200,255,.3);}
.countdown{font-family:'Orbitron',monospace;font-size:18px;color:#c084fc;text-align:center;margin:8px 0;}

/* TOAST */
#toast-container{position:fixed;bottom:24px;right:24px;z-index:999;display:flex;flex-direction:column;gap:8px;}
.toast{background:#0a0e24;border:1px solid rgba(0,200,255,.3);border-radius:12px;padding:12px 18px;font-size:13px;color:#e8f4ff;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:toastIn .3s ease;max-width:320px;}
.toast.ok{border-color:rgba(0,255,163,.4);color:#00ffa3;}
.toast.err{border-color:rgba(255,60,60,.4);color:#ff6060;}
@keyframes toastIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}

/* CHAT */
#chat-fab{position:fixed;bottom:28px;right:28px;z-index:150;background:linear-gradient(135deg,#00d4ff,#c084fc);border:none;border-radius:50px;padding:12px 20px;color:#05060e;font-family:'Orbitron',monospace;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(0,212,255,.4);transition:transform .2s,box-shadow .2s;}
#chat-fab:hover{transform:translateY(-3px);box-shadow:0 8px 30px rgba(0,212,255,.6);}
#chat-panel{position:fixed;bottom:90px;right:28px;z-index:150;width:320px;height:420px;background:#0a0e24;border:1px solid rgba(0,200,255,.3);border-radius:20px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6);transition:opacity .3s,transform .3s;}
#chat-panel.hidden{opacity:0;pointer-events:none;transform:translateY(20px);}
.chat-hdr{padding:14px 16px;border-bottom:1px solid rgba(0,200,255,.15);display:flex;align-items:center;justify-content:space-between;}
.chat-title{font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#00d4ff;}
.chat-close{background:none;border:none;color:#7090b0;cursor:pointer;font-size:18px;}
.chat-close:hover{color:#e8f4ff;}
#chat-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}
.chat-msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;}
.chat-msg.user{background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.2);align-self:flex-end;color:#e8f4ff;}
.chat-msg.bot{background:rgba(192,132,252,.1);border:1px solid rgba(192,132,252,.2);align-self:flex-start;color:#e8f4ff;}
.chat-msg.sys{background:rgba(255,165,0,.1);border:1px solid rgba(255,165,0,.2);color:#fbbf24;font-size:12px;text-align:center;align-self:center;max-width:95%;}
.chat-inp-row{padding:10px;border-top:1px solid rgba(0,200,255,.15);display:flex;gap:8px;}
.chat-inp{flex:1;background:rgba(5,6,14,.8);border:1px solid rgba(0,200,255,.2);color:#e8f4ff;padding:8px 12px;border-radius:10px;font-family:'Rajdhani',sans-serif;font-size:13px;outline:none;}
.chat-inp:focus{border-color:rgba(0,212,255,.5);}
.chat-send{background:linear-gradient(135deg,#00d4ff,#0ea5e9);border:none;border-radius:8px;color:#05060e;padding:8px 12px;cursor:pointer;font-weight:700;}

/* MODULE LIST */
.module-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;}
.module-item:last-child{border-bottom:0;}

/* FOOTER */
.footer{margin-top:40px;padding:24px;text-align:center;border-top:1px solid rgba(0,200,255,.1);font-size:12px;color:#7090b0;}
.footer a{color:#00d4ff;text-decoration:none;}
.footer a:hover{text-decoration:underline;}

/* SECTION TITLE */
.sec-title{font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:#e8f4ff;margin-bottom:20px;display:flex;align-items:center;gap:10px;}
.sec-title::after{content:'';flex:1;height:1px;background:rgba(0,200,255,.15);}

/* ANIMATIONS */
@keyframes rotateRing{to{transform:rotate(360deg);}}
@keyframes scan{0%{top:-30%;}100%{top:130%;}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
@keyframes spin{to{transform:rotate(360deg);}}
.spin{animation:spin 1s linear infinite;}

/* LOADER */
.loader{display:inline-block;width:16px;height:16px;border:2px solid rgba(0,212,255,.2);border-top-color:#00d4ff;border-radius:50%;animation:spin .8s linear infinite;}

/* NOTIFICATION BELL */
.notif-bell{position:relative;background:none;border:none;color:#7090b0;font-size:18px;cursor:pointer;padding:6px;border-radius:8px;transition:color .2s;}
.notif-bell:hover{color:#00d4ff;background:rgba(0,212,255,.08);}
.notif-badge{position:absolute;top:2px;right:2px;background:#ff4444;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;}
.notif-badge.hidden{display:none;}

/* ADMIN TABS */
.adm-tabs{display:flex;gap:4px;margin-bottom:20px;background:rgba(255,255,255,.04);border-radius:10px;padding:4px;flex-wrap:wrap;}
.adm-tab-btn{background:none;border:none;color:#7090b0;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;padding:7px 14px;border-radius:8px;cursor:pointer;transition:all .2s;white-space:nowrap;}
.adm-tab-btn.active{background:rgba(0,212,255,.15);color:#00d4ff;}
.adm-tab-panel{display:none;}
.adm-tab-panel.active{display:block;}

/* DATA TABLE */
.data-table{width:100%;border-collapse:collapse;font-size:13px;}
.data-table th{color:#7090b0;font-weight:700;text-transform:uppercase;letter-spacing:.8px;font-size:11px;padding:8px 10px;border-bottom:1px solid rgba(0,200,255,.15);text-align:left;}
.data-table td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle;}
.data-table tr:hover td{background:rgba(0,212,255,.04);}
.tbl-wrap{overflow-x:auto;border-radius:10px;border:1px solid rgba(0,200,255,.12);}

/* STATUS INDICATORS */
.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;}
.status-dot.ok{background:#00ffa3;box-shadow:0 0 6px #00ffa3;}
.status-dot.warn{background:#f59e0b;box-shadow:0 0 6px #f59e0b;}
.status-dot.err{background:#ff4444;box-shadow:0 0 6px #ff4444;}

/* DASHBOARD SUB-TABS */
.dash-tabs{display:flex;gap:4px;margin-bottom:20px;background:rgba(255,255,255,.04);border-radius:10px;padding:4px;}
.dash-tab-btn{flex:1;background:none;border:none;color:#7090b0;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;padding:7px;border-radius:8px;cursor:pointer;transition:all .2s;text-align:center;}
.dash-tab-btn.active{background:rgba(0,212,255,.15);color:#00d4ff;}
.dash-tab-panel{display:none;}
.dash-tab-panel.active{display:block;}

/* WORKFLOW */
.workflow-card{background:rgba(10,14,36,.8);border:1px solid rgba(0,200,255,.15);border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.workflow-name{font-weight:700;font-size:14px;color:#e8f4ff;}
.workflow-status{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;}
.workflow-status.active{background:rgba(0,255,163,.15);color:#00ffa3;border:1px solid rgba(0,255,163,.3);}
.workflow-status.inactive{background:rgba(192,132,252,.15);color:#c084fc;border:1px solid rgba(192,132,252,.3);}

/* ALERT CARD */
.alert-card{background:rgba(10,14,36,.8);border:1px solid rgba(0,200,255,.15);border-radius:12px;padding:12px 14px;margin-bottom:8px;}
.alert-card.unread{border-color:rgba(0,212,255,.4);background:rgba(0,212,255,.05);}
.alert-title{font-weight:700;font-size:13px;color:#e8f4ff;margin-bottom:4px;}
.alert-desc{font-size:12px;color:#7090b0;line-height:1.5;}

/* HEALTH SCORE */
.health-ring{width:100px;height:100px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',monospace;font-size:20px;font-weight:900;border:4px solid;}
.health-ring.good{border-color:#00ffa3;color:#00ffa3;box-shadow:0 0 20px rgba(0,255,163,.3);}
.health-ring.warn{border-color:#f59e0b;color:#f59e0b;box-shadow:0 0 20px rgba(245,158,11,.3);}
.health-ring.poor{border-color:#ff4444;color:#ff4444;box-shadow:0 0 20px rgba(255,68,68,.3);}

/* BD CRM */
.deal-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);gap:10px;}
.deal-row:last-child{border-bottom:0;}
.deal-stage{font-size:10px;padding:2px 8px;border-radius:999px;font-weight:700;}
.deal-stage.lead{background:rgba(192,132,252,.15);color:#c084fc;border:1px solid rgba(192,132,252,.3);}
.deal-stage.prospect{background:rgba(0,212,255,.15);color:#00d4ff;border:1px solid rgba(0,212,255,.3);}
.deal-stage.negotiation{background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);}
.deal-stage.closed{background:rgba(0,255,163,.15);color:#00ffa3;border:1px solid rgba(0,255,163,.3);}

/* CHAT STREAMING */
.chat-cursor{display:inline-block;width:2px;height:14px;background:#00d4ff;margin-left:2px;animation:blink .7s infinite;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}

/* RESPONSIVE NAV */
@media(max-width:700px){
  .hdr-nav .nav-btn span{display:none;}
  #site-header{padding:0 12px;gap:8px;}
  .hdr-logo{font-size:14px;}
  .btc-ticker{font-size:10px;padding:3px 7px;}
  .hero-title{font-size:28px;}
  .hero-sub{font-size:15px;}
  .pay-methods{grid-template-columns:1fr;}
  #chat-panel{width:calc(100vw - 20px);right:10px;}
}
@media(max-width:480px){
  .hdr-nav{gap:0;}
  .nav-btn{padding:5px 8px;font-size:13px;}
}
</style>
</head>
<body>
<canvas id="bg-canvas"></canvas>
<div id="toast-container"></div>

<!-- HEADER -->
<header id="site-header">
  <a class="hdr-logo" onclick="navigate('home')">⚡ ZEUS AI</a>
  <nav class="hdr-nav">
    <button class="nav-btn active" data-view="home" onclick="navigate('home')"><span>Home</span></button>
    <button class="nav-btn" data-view="marketplace" onclick="navigate('marketplace')"><span>Services</span></button>
    <button class="nav-btn" data-view="crypto-bridge" onclick="navigate('crypto-bridge')"><span>Crypto Bridge</span></button>
    <button class="nav-btn" data-view="pricing" onclick="navigate('pricing')"><span>Pricing</span></button>
    <button class="nav-btn" data-view="innovations" onclick="navigate('innovations')"><span>Innovations</span></button>
    <button class="nav-btn" data-view="status" onclick="navigate('status')"><span>Status</span></button>
    <button class="nav-btn hidden" id="nav-dashboard" data-view="dashboard" onclick="navigate('dashboard')"><span>Dashboard</span></button>
    <button class="nav-btn" data-view="admin" onclick="navigate('admin')" id="nav-admin" style="display:none"><span>Admin</span></button>
  </nav>
  <div class="hdr-right">
    <div class="btc-ticker" id="btc-ticker">BTC $—</div>
    <button class="notif-bell" id="notif-bell" onclick="toggleNotifPanel()" title="Opportunity Alerts" style="display:none">
      🔔<span class="notif-badge hidden" id="notif-count">0</span>
    </button>
    <div id="hdr-auth">
      <button class="btn btn-outline btn-sm" onclick="openModal('auth-modal')">Login</button>
    </div>
    <div id="hdr-user" style="display:none">
      <div class="user-badge" onclick="navigate('dashboard')">
        <div class="user-avatar" id="user-avatar">Z</div>
        <span class="plan-pill" id="user-plan-pill">FREE</span>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="doLogout()" style="margin-left:8px">Logout</button>
    </div>
  </div>
</header>

<!-- MAIN -->
<main class="page-wrap">


  <!-- HOME VIEW (DOM simplified) -->
  <section id="view-home" class="view hero-section">
    <p class="subtitle">Live autonomous AI commerce platform</p>
    <h1 class="hero-title">ZEUS AI<br/>Launch AI products faster.</h1>
    <p class="hero-sub">Buy ready-to-run AI services, monitor the live Unicorn engine, and activate automation with direct BTC checkout plus enterprise-grade integrity checks.</p>
    <div class="hero-ctas">
      <button class="btn btn-primary btn-lg" onclick="navigate('marketplace')">🚀 Buy AI Service</button>
      <button class="btn btn-outline btn-lg" onclick="navigate('status')">🟢 Live Status</button>
      <button class="btn btn-ghost btn-lg" onclick="navigate('innovations')">💡 Innovations</button>
    </div>
    <div class="grid-4" style="max-width:920px;margin:18px auto 0;">
      <div class="card card-sm"><div class="label">Deploy</div><div class="kpi-val green" style="font-size:16px;">Forward-only</div></div>
      <div class="card card-sm"><div class="label">Integrity</div><div class="kpi-val cyan" style="font-size:16px;">QIS guarded</div></div>
      <div class="card card-sm"><div class="label">Checkout</div><div class="kpi-val" style="font-size:16px;">BTC direct</div></div>
      <div class="card card-sm"><div class="label">Delivery</div><div class="kpi-val purple" style="font-size:16px;">Live catalog</div></div>
    </div>
    <div class="zeus-face-wrap">
      <canvas id="zeusCanvas"></canvas>
      <div class="zeus-overlay">
        <div class="zeus-ring"></div>
        <div class="zeus-ring2"></div>
        <div class="zeus-scan"></div>
        <div class="zeus-label">ZEUS AI CORE v4.0</div>
        <div class="zeus-status"><span class="zeus-dot"></span>ONLINE</div>
      </div>
      <div class="clock-wrap card card-sm" style="justify-content:center;">
        <canvas id="luxClock" width="180" height="180"></canvas>
        <div class="clock-digital" id="clkDig">00:00:00</div>
        <div class="clock-date" id="clkDate">—</div>
      </div>
    </div>
  </section>

    <!-- Stats Bar (flattened) -->
    <div class="stats-bar">
      <div class="card card-sm"><span class="label">Active Users</span><span class="kpi-val" id="stat-users">—</span></div>
      <div class="card card-sm"><span class="label">Uptime</span><span class="kpi-val green" id="stat-uptime">—</span></div>
      <div class="card card-sm"><span class="label">BTC Rate</span><span class="kpi-val cyan" id="stat-btc">—</span></div>
    </div>

    <!-- How it works (flattened) -->
    <div class="sec-title">How It Works</div>
    <div class="how-steps">
      <div class="card card-hover"><span class="step-num">01</span><span class="step-title">Register Free</span><span class="step-desc">Create your Zeus AI account in seconds. No credit card required to get started with our free tier.</span></div>
      <div class="card card-hover"><span class="step-num">02</span><span class="step-title">Choose a Service</span><span class="step-desc">Browse our marketplace of AI-powered services. From automation to intelligence, find your solution.</span></div>
      <div class="card card-hover"><span class="step-num">03</span><span class="step-title">Pay &amp; Activate</span><span class="step-desc" id="payment-step-desc">Pay direct by BTC owner wallet. Card, PayPal, and global crypto rails appear only when configured live.</span></div>
    </div>

    <!-- KPI Cards (from snapshot) -->
    <div class="sec-title" style="margin-top:24px;">Platform Intelligence</div>
    <div class="grid-4" id="home-kpi-grid">
      <div class="card card-sm"><div class="label">Sprint</div><div class="kpi-val" id="kpi-sprint" style="font-size:18px">—</div></div>
      <div class="card card-sm"><div class="label">Modules</div><div class="kpi-val" id="kpi-modules" style="font-size:18px">—</div></div>
      <div class="card card-sm"><div class="label">Services</div><div class="kpi-val" id="kpi-services" style="font-size:18px">—</div></div>
      <div class="card card-sm"><div class="label">Innovations</div><div class="kpi-val" id="kpi-innov" style="font-size:18px">—</div></div>
    </div>

    <!-- Case Studies -->
    <div class="sec-title" style="margin-top:28px;">Success Stories</div>
    <div class="grid-3" id="case-studies-grid">
      <div class="case-card"><div class="loader"></div></div>
    </div>

    <!-- ROI Calculator -->
    <div class="sec-title" style="margin-top:28px;">ROI Calculator</div>
    <div class="card card-glow" style="max-width:720px;">
      <p class="muted" style="font-size:13px;margin-bottom:16px;">Calculate your potential ROI with Zeus AI automation.</p>
      <div class="roi-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="roi-emp">Employees</label>
            <input class="form-inp" type="number" id="roi-emp" name="roi-emp" placeholder="e.g. 50" min="1" aria-label="Employees"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="roi-rev">Monthly Revenue ($)</label>
            <input class="form-inp" type="number" id="roi-rev" name="roi-rev" placeholder="e.g. 500000" min="1" aria-label="Monthly Revenue ($)"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="roi-ind">Industry</label>
          <select class="form-inp" id="roi-ind" name="roi-ind" aria-label="Industry">
            <option value="technology">Technology</option>
            <option value="finance">Finance</option>
            <option value="healthcare">Healthcare</option>
            <option value="retail">Retail</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="logistics">Logistics</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="calcRoi()">⚡ Calculate ROI</button>
        <div class="roi-result" id="roi-result"></div>
      </div>
    </div>

    <footer class="footer">
      <form id="lead-form" onsubmit="return submitLead(event)" style="max-width:520px;margin:0 auto 18px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center">
        <label for="lead-email" class="visually-hidden">Email</label>
        <input id="lead-email" type="email" name="email" required placeholder="your@email.com" style="flex:1;min-width:220px;padding:10px 14px;border-radius:8px;border:1px solid rgba(0,212,255,.25);background:rgba(0,0,0,.35);color:#cfe;" aria-label="Email">
        <input type="text" name="hp_field" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true">
        <button type="submit" aria-label="Notify me when sovereign AI ships" style="padding:10px 18px;border-radius:8px;border:0;background:linear-gradient(90deg,#00d4ff,#0050ff);color:#fff;font-weight:600;cursor:pointer">Notify me when sovereign AI ships →</button>
        <span id="lead-msg" style="flex-basis:100%;font-size:12px;color:#7090b0"></span>
      </form>
      <p>🦄 <a href="https://zeusai.pro" target="_blank">zeusai.pro</a> — Universal AI Unicorn Platform</p>
      <p style="margin-top:4px;">Owner: ${ownerName} &nbsp;|&nbsp; <a href="mailto:${ownerEmail}">${ownerEmail}</a></p>
      <p style="margin-top:6px;">BTC: <span class="btc-addr" data-btc-address="1" onclick="copyText(this.textContent,this)" title="Click to copy">${btcWallet}</span></p>
      <p style="margin-top:10px;font-size:11px;opacity:.75"><a href="/transparency/live">Live transparency dashboard</a> · <a href="/feed.xml">RSS</a> · <a href="/tos">ToS</a> · <a href="/privacy">Privacy</a> · <a href="/imprint">Imprint</a> · <a href="/cookies">Cookies</a></p>
    </footer>
  </div><!-- end #view-home -->

  <!-- MARKETPLACE VIEW -->
  <div id="view-marketplace" class="view">
    <div class="sec-title">Services Marketplace</div>
    <div class="search-row">
      <input class="search-inp" type="text" id="svc-search" placeholder="🔍 Search services..." oninput="filterServices()"/>
      <div class="filter-btns" id="cat-filters"></div>
    </div>
    <div class="grid-auto" id="svc-grid">
      <div class="card" style="text-align:center;padding:40px;"><div class="loader"></div></div>
    </div>
  </div><!-- end #view-marketplace -->

  <!-- PRICING VIEW -->
  <div id="view-pricing" class="view">
    <div class="sec-title">Pricing Plans</div>
    <div class="pricing-toggle">
      <span class="toggle-label active" id="lbl-monthly">Monthly</span>
      <div class="toggle-switch" id="pricing-toggle" onclick="togglePricing()"><div class="knob"></div></div>
      <span class="toggle-label" id="lbl-yearly">Yearly <span class="savings-badge">Save 17%</span></span>
    </div>
    <div class="grid-4" id="plans-grid">
      <div class="card" style="text-align:center;padding:40px;"><div class="loader"></div></div>
    </div>
    <!-- Revenue-tier modules: SME / Mid-Market / Enterprise / Global Giants ─
         Live, AI-negotiated price per segment (USD + BTC). The sales flow
         varies per tier: BTC direct (SME/Mid-Market), Contact Sales
         (Enterprise), Partnership (Global Giants). -->
    <div class="sec-title" style="margin-top:48px;">Business Segments — Live Pricing</div>
    <div style="text-align:center;color:#7090b0;font-size:13px;margin-bottom:18px;">
      Prices below are computed in real-time by the Unicorn pricing engine.
      They include demand, peak hours, surge and personalisation — refreshed on every visit.
    </div>
    <div class="grid-4" id="segments-grid">
      <div class="card" style="text-align:center;padding:40px;"><div class="loader"></div></div>
    </div>
    <div style="text-align:center;margin-top:24px;color:#7090b0;font-size:13px;">
      All plans include: SSL, 99.9% uptime SLA, 24/7 monitoring.<br/>
      <span id="pricing-payment-copy">Payments via BTC direct owner wallet. Optional providers appear only when configured.</span> Cancel anytime.
    </div>
  </div><!-- end #view-pricing -->

  <!-- CRYPTO BRIDGE VIEW -->
  <div id="view-crypto-bridge" class="view">
    <div class="sec-title">Crypto ↔ Fiat Bridge</div>
    <div class="card card-glow" style="max-width:920px;margin:0 auto;">
      <p class="muted" style="font-size:14px;line-height:1.6;margin-bottom:14px;">
        Suite non-custodial pentru rutare inteligentă, optimizare fee și monitorizare de sănătate pentru transferuri crypto.
      </p>
      <div class="grid-2" style="margin-bottom:14px;">
        <div class="card card-sm">
          <div class="label">Service status</div>
          <div class="kpi-val" id="cb-health" style="font-size:20px;">Loading...</div>
        </div>
        <div class="card card-sm">
          <div class="label">BTC / USD</div>
          <div class="kpi-val green" id="cb-rate" style="font-size:20px;">Loading...</div>
        </div>
      </div>
      <ul style="color:#7090b0;line-height:1.8;padding-left:18px;">
        <li>GET /api/crypto-bridge/services</li>
        <li>GET /api/crypto-bridge/btc-rate</li>
        <li>POST /api/crypto-bridge/smart-routing</li>
        <li>GET /api/crypto-bridge/health</li>
      </ul>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <a class="btn btn-outline" href="/api/crypto-bridge/health" target="_blank" rel="noopener">API Health</a>
        <a class="btn btn-primary" href="/api/crypto-bridge/services" target="_blank" rel="noopener">View Services</a>
      </div>
    </div>
  </div><!-- end #view-crypto-bridge -->

  <!-- INNOVATIONS VIEW -->
  <div id="view-innovations" class="view">
    <div class="sec-title">Live Innovation Coverage</div>
    <div class="card card-glow" style="max-width:980px;margin:0 auto 18px;">
      <p class="muted" style="font-size:14px;line-height:1.6;margin-bottom:14px;">A public control panel for the modules shipped in the last innovation cycles: live APIs, foundation layers, optional integrations and provider-dependent capabilities.</p>
      <div class="grid-4" id="innovation-summary-grid">
        <div class="card card-sm"><div class="label">Total</div><div class="kpi-val">—</div></div>
        <div class="card card-sm"><div class="label">Live</div><div class="kpi-val green">—</div></div>
        <div class="card card-sm"><div class="label">Foundation</div><div class="kpi-val cyan">—</div></div>
        <div class="card card-sm"><div class="label">Needs Secrets</div><div class="kpi-val purple">—</div></div>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="loadInnovationCoverage(true)">Refresh Coverage</button>
        <a class="btn btn-outline" href="/api/innovation/coverage" target="_blank" rel="noopener">Open JSON</a>
      </div>
    </div>
    <div class="grid-auto" id="innovation-coverage-grid">
      <div class="card" style="text-align:center;padding:40px;"><div class="loader"></div></div>
    </div>
  </div><!-- end #view-innovations -->

  <!-- STATUS VIEW -->
  <div id="view-status" class="view">
    <div class="sec-title">Live Unicorn Status</div>
    <div class="grid-4" id="status-summary-grid">
      <div class="card card-sm"><div class="label">Site</div><div class="kpi-val">Checking…</div></div>
      <div class="card card-sm"><div class="label">Backend</div><div class="kpi-val">Checking…</div></div>
      <div class="card card-sm"><div class="label">QIS</div><div class="kpi-val">Checking…</div></div>
      <div class="card card-sm"><div class="label">Build</div><div class="kpi-val">—</div></div>
    </div>
    <div class="card card-glow" style="margin-top:18px;">
      <div class="dash-section-title">Operational checks</div>
      <div id="status-checks"><div style="text-align:center;padding:30px;"><div class="loader"></div></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
        <button class="btn btn-primary" onclick="loadLiveStatus(true)">Refresh Status</button>
        <a class="btn btn-outline" href="/api/quantum-integrity/status" target="_blank" rel="noopener">QIS JSON</a>
        <a class="btn btn-outline" href="/health" target="_blank" rel="noopener">Public Health</a>
      </div>
    </div>
  </div><!-- end #view-status -->

  <!-- DASHBOARD VIEW -->
  <div id="view-dashboard" class="view">
    <div class="sec-title">My Dashboard</div>
    <div class="dash-tabs">
      <button class="dash-tab-btn active" data-dtab="overview" onclick="switchDashTab('overview')">📊 Overview</button>
      <button class="dash-tab-btn" data-dtab="workflows" onclick="switchDashTab('workflows')">⚙️ Workflows</button>
      <button class="dash-tab-btn" data-dtab="alerts" onclick="switchDashTab('alerts')">🔔 Alerts</button>
      <button class="dash-tab-btn" data-dtab="labs" onclick="switchDashTab('labs')">🔬 Labs</button>
      <button class="dash-tab-btn" data-dtab="enterprise" onclick="switchDashTab('enterprise')">🏛️ Enterprise</button>
      <button class="dash-tab-btn" data-dtab="markets" onclick="switchDashTab('markets')">🌐 Markets</button>
      <button class="dash-tab-btn" data-dtab="tenant" onclick="switchDashTab('tenant')">💎 Tenant</button>
      <button class="dash-tab-btn" data-dtab="healthscore" onclick="switchDashTab('healthscore')">💊 Health</button>
      <button class="dash-tab-btn" data-dtab="qpay" onclick="switchDashTab('qpay')">⚛️ Q-Pay</button>
      <button class="dash-tab-btn" data-dtab="profile" onclick="switchDashTab('profile')">👤 Profile</button>
    </div>
    <div class="dash-tab-panel active" id="dtab-overview">
      <div id="dash-content">
        <div style="text-align:center;padding:60px;color:#7090b0;">Loading dashboard...</div>
      </div>
    </div>
    <div class="dash-tab-panel" id="dtab-workflows">
      <div id="workflows-content">
        <div style="text-align:center;padding:40px;"><div class="loader"></div></div>
      </div>
    </div>
    <div class="dash-tab-panel" id="dtab-alerts">
      <div id="alerts-content">
        <div style="text-align:center;padding:40px;"><div class="loader"></div></div>
      </div>
    </div>
    <div class="dash-tab-panel" id="dtab-labs">
      <div id="labs-content"><div style="text-align:center;padding:40px;"><div class="loader"></div></div></div>
    </div>
    <div class="dash-tab-panel" id="dtab-enterprise">
      <div id="enterprise-content"><div style="text-align:center;padding:40px;"><div class="loader"></div></div></div>
    </div>
    <div class="dash-tab-panel" id="dtab-markets">
      <div id="markets-content"><div style="text-align:center;padding:40px;"><div class="loader"></div></div></div>
    </div>
    <div class="dash-tab-panel" id="dtab-tenant">
      <div id="tenant-content"><div style="text-align:center;padding:40px;"><div class="loader"></div></div></div>
    </div>
    <div class="dash-tab-panel" id="dtab-healthscore">
      <div id="healthscore-content"><div style="text-align:center;padding:40px;"><div class="loader"></div></div></div>
    </div>
    <div class="dash-tab-panel" id="dtab-qpay">
      <div id="qpay-content"><div style="text-align:center;padding:40px;"><div class="loader"></div></div></div>
    </div>
    <div class="dash-tab-panel" id="dtab-profile">
      <div id="profile-content">
        <div style="text-align:center;padding:40px;"><div class="loader"></div></div>
      </div>
    </div>
  </div><!-- end #view-dashboard -->
  <div id="view-admin" class="view">
    <div class="sec-title">⚙️ Admin Panel</div>
    <div id="admin-login-section">
      <div class="card" style="max-width:400px;margin:0 auto;">
        <div class="modal-title">Admin Authentication</div>
        <div class="inp-group">
          <label class="inp-label">Admin Password</label>
          <input class="inp-field" type="password" id="admin-pass-inp" placeholder="Enter admin password"/>
        </div>
        <div class="inp-group">
          <label class="inp-label">2FA Code (if enabled)</label>
          <input class="inp-field" type="text" id="admin-2fa-inp" placeholder="6-digit code" maxlength="6"/>
        </div>
        <div id="admin-login-msg"></div>
        <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="doAdminLogin()">🔐 Authenticate</button>
      </div>
    </div>
    <div id="admin-panel-section" style="display:none">
      <div class="adm-tabs">
        <button class="adm-tab-btn active" data-atab="overview" onclick="switchAdminTab('overview')">📊 Overview</button>
        <button class="adm-tab-btn" data-atab="users" onclick="switchAdminTab('users')">👥 Users</button>
        <button class="adm-tab-btn" data-atab="revenue" onclick="switchAdminTab('revenue')">💰 Revenue</button>
        <button class="adm-tab-btn" data-atab="system" onclick="switchAdminTab('system')">🛡️ System</button>
        <button class="adm-tab-btn" data-atab="ai" onclick="switchAdminTab('ai')">🤖 AI</button>
        <button class="adm-tab-btn" data-atab="crm" onclick="switchAdminTab('crm')">🤝 CRM</button>
        <button class="adm-tab-btn" data-atab="viral" onclick="switchAdminTab('viral')">🚀 Viral</button>
        <button class="adm-tab-btn" data-atab="innovation" onclick="switchAdminTab('innovation')">💡 Innovation</button>
        <button class="adm-tab-btn" data-atab="pricing" onclick="switchAdminTab('pricing')">🏷️ Pricing</button>
        <button class="adm-tab-btn" data-atab="autonomous" onclick="switchAdminTab('autonomous')">🔄 Autonomous</button>
        <button class="adm-tab-btn" data-atab="modules" onclick="switchAdminTab('modules')">🔧 Modules</button>
        <button class="adm-tab-btn" data-atab="advanced" onclick="switchAdminTab('advanced')">🌌 Advanced</button>
      </div>
      <!-- OVERVIEW TAB -->
      <div class="adm-tab-panel active" id="atab-overview">
        <div class="grid-3" style="margin-bottom:20px;">
          <div class="card card-sm"><div class="label">Health</div><div class="kpi-val green" id="adm-health">—</div></div>
          <div class="card card-sm"><div class="label">Uptime</div><div class="kpi-val cyan" id="adm-uptime">—</div></div>
          <div class="card card-sm"><div class="label">Active Users</div><div class="kpi-val" id="adm-users">—</div></div>
        </div>
        <div class="card" style="margin-bottom:20px;">
          <div class="dash-section-title">BTC Collection Address</div>
          <div class="btc-addr" data-btc-address="1" onclick="copyText(this.textContent,this)">${btcWallet}</div>
          <p class="muted" style="font-size:12px;margin-top:8px;">Owner: ${ownerName} | ${ownerEmail}</p>
        </div>
        <div class="card" style="margin-bottom:20px;">
          <div class="dash-section-title">Platform Snapshot</div>
          <div id="adm-snapshot" style="font-size:12px;color:#7090b0;"></div>
        </div>
      </div>
      <!-- USERS TAB -->
      <div class="adm-tab-panel" id="atab-users">
        <div class="card">
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
            <input class="inp-field" type="text" id="usr-search" placeholder="🔍 Search by email or name..." style="flex:1;min-width:200px;" oninput="loadAdminUsers()"/>
            <button class="btn btn-outline btn-sm" onclick="loadAdminUsers()">Refresh</button>
          </div>
          <div class="tbl-wrap" id="users-tbl-wrap">
            <div style="text-align:center;padding:30px;"><div class="loader"></div></div>
          </div>
          <div id="users-pagination" style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;align-items:center;font-size:13px;color:#7090b0;"></div>
        </div>
      </div>
      <!-- REVENUE TAB -->
      <div class="adm-tab-panel" id="atab-revenue">
        <div class="grid-3" style="margin-bottom:20px;" id="rev-kpis">
          <div class="card card-sm"><div class="label">Total Revenue</div><div class="kpi-val green" id="rev-total">—</div></div>
          <div class="card card-sm"><div class="label">MRR</div><div class="kpi-val cyan" id="rev-mrr">—</div></div>
          <div class="card card-sm"><div class="label">Profit Margin</div><div class="kpi-val" id="rev-margin">—</div></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Revenue Breakdown</div>
          <div id="rev-breakdown" style="color:#7090b0;font-size:13px;padding:10px 0;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Growth Metrics</div>
          <div id="rev-growth" style="color:#7090b0;font-size:13px;padding:10px 0;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Wealth Engine Stats</div>
          <div id="rev-wealth-stats" style="color:#7090b0;font-size:12px;">Loading...</div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="adminSaveWealthSettings()">💾 Save Wealth Settings</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Quantum Payment Revenue</div>
          <div id="rev-qpay-stats" style="color:#7090b0;font-size:12px;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Executive Modules & Innovations</div>
          <div id="rev-exec-modules" style="color:#7090b0;font-size:12px;">Loading...</div>
          <div id="rev-exec-innovations" style="color:#7090b0;font-size:12px;margin-top:8px;"></div>
        </div>
        <div class="card">
          <div class="dash-section-title">Executive AI Copilot</div>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input class="inp-field" type="text" id="exec-copilot-inp" placeholder="Ask the Executive AI..." style="flex:1;"/>
            <button class="btn btn-primary btn-sm" onclick="askExecCopilot()">Ask</button>
          </div>
          <div id="exec-copilot-response" style="font-size:13px;color:#e8f4ff;background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.1);border-radius:8px;padding:10px;min-height:40px;display:none;"></div>
        </div>
      </div>
      <!-- SYSTEM TAB -->
      <div class="adm-tab-panel" id="atab-system">
        <div class="grid-3" style="margin-bottom:16px;">
          <div class="card card-sm" id="sys-slo-card">
            <div class="label">SLO Status</div>
            <div id="sys-slo" class="kpi-val" style="font-size:16px;">—</div>
          </div>
          <div class="card card-sm" id="sys-cb-card">
            <div class="label">Circuit Breaker</div>
            <div id="sys-cb" class="kpi-val" style="font-size:16px;">—</div>
          </div>
          <div class="card card-sm" id="sys-canary-card">
            <div class="label">Canary</div>
            <div id="sys-canary" class="kpi-val" style="font-size:16px;">—</div>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Control Plane Decisions</div>
          <div id="sys-decisions" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-danger btn-sm" onclick="adminControlPlaneRollback()">⏪ Rollback</button></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Canary Deployments</div>
          <div id="sys-canary-decisions" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="adminRegisterCanary()">+ Register Canary</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Shadow Test Variants</div>
          <div id="sys-shadow-variants" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="adminRegisterShadow()">+ Register Shadow</button></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">A/B Experiments</div>
          <div id="sys-experiments" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="adminAddExperiment()">+ New Experiment</button></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Profit Attribution Metrics</div>
          <div id="sys-profit-metrics" style="font-size:12px;color:#7090b0;">Loading...</div>
        </div>
        <div class="card">
          <div class="dash-section-title">Profit Loop Status</div>
          <div id="sys-profit-loop" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="loadAdminSystem()">🔄 Refresh</button>
            <button class="btn btn-ghost btn-sm" onclick="adminResetCircuitBreaker()">Reset CB</button>
          </div>
        </div>
      </div>
      <!-- AI TAB -->
      <div class="adm-tab-panel" id="atab-ai">
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">AI Providers Status</div>
          <div id="ai-providers-list" style="color:#7090b0;font-size:13px;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">UAIC Models</div>
          <div id="ai-uaic-models" style="color:#7090b0;font-size:13px;">Loading...</div>
        </div>
        <div class="card">
          <div class="dash-section-title">Ask UAIC (Admin)</div>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input class="inp-field" type="text" id="uaic-query" placeholder="Ask the AI anything..." style="flex:1;"/>
            <button class="btn btn-primary btn-sm" onclick="askUaic()">Ask</button>
          </div>
          <div id="uaic-response" style="font-size:13px;color:#e8f4ff;background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.1);border-radius:8px;padding:10px;min-height:40px;display:none;"></div>
        </div>
      </div>
      <!-- CRM TAB -->
      <div class="adm-tab-panel" id="atab-crm">
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <div class="dash-section-title" style="margin:0;">BD Deals</div>
            <button class="btn btn-primary btn-sm" onclick="openAddDealModal()">+ New Deal</button>
          </div>
          <div id="crm-deals-list">
            <div style="text-align:center;padding:20px;"><div class="loader"></div></div>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Leads</div>
          <div id="crm-leads-list" style="color:#7090b0;font-size:13px;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Affiliate / Referral Stats</div>
          <div id="crm-affiliate-stats" style="color:#7090b0;font-size:12px;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div class="dash-section-title" style="margin:0;">All Referrals (Admin)</div>
            <button class="btn btn-outline btn-sm" onclick="loadAdminCRM()">🔄 Refresh</button>
          </div>
          <div id="crm-all-referrals" style="color:#7090b0;font-size:12px;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Onboarding Flow</div>
          <div id="crm-onboarding" style="color:#7090b0;font-size:12px;">Loading...</div>
          <div style="margin-top:8px;">
            <input class="inp-field" type="text" id="onboard-company-inp" placeholder="Company name..." style="width:100%;margin-bottom:6px;"/>
            <button class="btn btn-primary btn-sm" onclick="adminStartOnboarding()">🚀 Start Onboarding</button>
          </div>
        </div>
        <div class="card">
          <div class="dash-section-title">Marketplace Intelligence</div>
          <div id="crm-mkt-intelligence" style="color:#7090b0;font-size:12px;">Loading...</div>
        </div>
      </div>
      <!-- VIRAL TAB -->
      <div class="adm-tab-panel" id="atab-viral">
        <div class="grid-3" style="margin-bottom:16px;">
          <div class="card card-sm"><div class="label">Viral Score</div><div class="kpi-val cyan" id="viral-score">—</div></div>
          <div class="card card-sm"><div class="label">Est. Reach</div><div class="kpi-val" id="viral-reach">—</div></div>
          <div class="card card-sm"><div class="label">Growth Loop</div><div class="kpi-val green" id="viral-loop">—</div></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Auto Viral Growth Status</div>
          <div id="viral-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="triggerViralLoop()">▶ Trigger Growth Loop</button>
            <button class="btn btn-outline btn-sm" onclick="loadAdminViral()">🔄 Refresh</button>
          </div>
        </div>
        <div class="card">
          <div class="dash-section-title">Social Viralization</div>
          <div id="social-viral-status" style="font-size:12px;color:#7090b0;">Loading...</div>
        </div>
      </div>
      <!-- INNOVATION TAB -->
      <div class="adm-tab-panel" id="atab-innovation">
        <div class="grid-3" style="margin-bottom:16px;">
          <div class="card card-sm"><div class="label">Loop Status</div><div class="kpi-val cyan" id="innov-loop-status">—</div></div>
          <div class="card card-sm"><div class="label">Proposals</div><div class="kpi-val" id="innov-proposals-count">—</div></div>
          <div class="card card-sm"><div class="label">Auto-Deploy</div><div class="kpi-val green" id="innov-deploy-status">—</div></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Innovation Loop</div>
          <div id="innov-loop-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="triggerInnovationLoop()">▶ Trigger Innovation Loop</button>
            <button class="btn btn-outline btn-sm" onclick="loadAdminInnovation()">🔄 Refresh</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Recent Proposals</div>
          <div id="innov-proposals-list" style="font-size:12px;color:#7090b0;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Future-Proof Innovation Modules Status</div>
          <div id="innovation-modules-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:10px;">
            <button class="btn btn-outline btn-sm" onclick="loadInnovationModulesStatus()">🔄 Refresh Status</button>
          </div>
        </div>
        <div class="card">
          <div class="dash-section-title">Innovation Engine Report</div>
          <div id="innov-engine-report" style="font-size:12px;color:#7090b0;">Loading...</div>
        </div>
      </div>
      <!-- PRICING TAB -->
      <div class="adm-tab-panel" id="atab-pricing">
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <div class="dash-section-title" style="margin:0;">Dynamic Pricing</div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-primary btn-sm" onclick="activatePricingSurge()">⚡ Activate Surge</button>
              <button class="btn btn-outline btn-sm" onclick="loadAdminPricing()">🔄 Refresh</button>
            </div>
          </div>
          <div id="pricing-all-list" style="font-size:12px;color:#7090b0;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">White Label Tenants (Admin)</div>
          <div id="pricing-tenants-list" style="font-size:12px;color:#7090b0;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Credits Plans & Admin</div>
          <div id="adm-credits-plans" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:10px;"><div id="adm-credits-users" style="font-size:12px;color:#7090b0;max-height:180px;overflow-y:auto;"></div></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Billing Plans (Admin)</div>
          <div id="adm-billing-plans" style="font-size:12px;color:#7090b0;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Platform Webhooks</div>
          <div id="adm-webhooks-list" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="adminAddWebhook()">+ Add Webhook</button>
            <button class="btn btn-outline btn-sm" onclick="loadAdminPricing()">🔄 Refresh</button>
          </div>
        </div>
        <div class="card">
          <div class="dash-section-title">Admin Health Scores</div>
          <div id="adm-health-scores" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:10px;"><div id="adm-churn-risk" style="font-size:12px;color:#7090b0;"></div></div>
        </div>
      </div>
      <!-- AUTONOMOUS TAB -->
      <div class="adm-tab-panel" id="atab-autonomous">
        <div class="grid-3" style="margin-bottom:16px;">
          <div class="card card-sm"><div class="label">Innovation</div><div class="kpi-val cyan" id="auto-innov-status">—</div></div>
          <div class="card card-sm"><div class="label">Revenue Engine</div><div class="kpi-val green" id="auto-rev-status">—</div></div>
          <div class="card card-sm"><div class="label">Platform</div><div class="kpi-val" id="auto-platform-status">—</div></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Autonomous Innovation Status</div>
          <div id="auto-innov-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="triggerAutoInnovation()">▶ Trigger Innovation</button>
            <button class="btn btn-outline btn-sm" onclick="optimizeAutoInnovation()">⚡ Optimize</button>
            <button class="btn btn-ghost btn-sm" onclick="loadAdminAutonomous()">🔄 Refresh</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Autonomous Revenue Engine</div>
          <div id="auto-rev-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="generateAutoDeals()">💰 Generate Deals</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Orchestrator</div>
          <div id="auto-orchestrator-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="runOrchestratorCheck()">🔍 Run Check</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Self-Healer</div>
          <div id="auto-healer-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="adminHealerRestart()">🔁 Restart</button>
            <button class="btn btn-danger btn-sm" onclick="adminHealerRedeploy()">🚀 Redeploy</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Innovation Loop Logs</div>
          <div id="auto-innov-log" style="font-size:11px;color:#7090b0;max-height:150px;overflow-y:auto;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Pending PRs</div>
          <div id="auto-pending-prs" style="font-size:12px;color:#7090b0;">Loading...</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Self-Construction</div>
          <div id="auto-self-construction" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="runSelfConstruction()">🏗️ Run Build</button>
          </div>
        </div>
        <div class="card">
          <div class="dash-section-title">Total System Healer</div>
          <div id="auto-total-healer" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="runTotalHeal()">🩺 Heal All</button>
            <button class="btn btn-outline btn-sm" onclick="checkAllModules()">📋 Check Modules</button>
          </div>
        </div>
      </div>
      <!-- MODULES TAB -->
      <div class="adm-tab-panel" id="atab-modules">
        <!-- MODULE REGISTRY (292+ modules) -->
        <div class="card card-glow" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div class="dash-section-title" style="margin:0;">🔗 Module Registry</div>
            <button class="btn btn-outline btn-sm" onclick="loadAdminModules()">🔄 Refresh</button>
          </div>
          <div id="mod-registry-total" style="font-family:'Orbitron',monospace;font-size:28px;font-weight:700;color:#00d4ff;margin-bottom:8px;">—</div>
          <div id="mod-registry-categories" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Module Loader</div>
          <div id="mod-loader-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div id="mod-loader-list" style="font-size:12px;color:#7090b0;margin-top:8px;max-height:160px;overflow-y:auto;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Future Compatibility Bridge</div>
          <div id="mod-future-compat" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="runFutureCompatProcess()">▶ Process</button></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Configuration Manager</div>
          <div id="mod-config-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
            <input class="inp-field" type="text" id="cfg-key-inp" placeholder="Config key..." style="flex:1;min-width:100px;"/>
            <input class="inp-field" type="text" id="cfg-val-inp" placeholder="Value..." style="flex:1;min-width:100px;"/>
            <button class="btn btn-primary btn-sm" onclick="adminSetConfig()">Set</button>
            <button class="btn btn-outline btn-sm" onclick="adminGetConfig()">Get</button>
          </div>
          <div id="cfg-result" style="font-size:12px;color:#00d4ff;margin-top:8px;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Revenue Modules Status</div>
          <div id="mod-rev-modules" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="executeTradingRevenue()">📈 Execute Trading</button>
            <button class="btn btn-outline btn-sm" onclick="optimizeCloudRevenue()">☁️ Optimize Cloud</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Quantum Security Layer</div>
          <div id="mod-qsec-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="runQuantumSecurityProcess()">🔐 Process</button></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Quantum Integrity Shield</div>
          <div id="mod-qintegrity-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="runQuantumIntegrityScan()">🛡️ Scan</button>
          </div>
          <div id="mod-qintegrity-history" style="font-size:11px;color:#7090b0;margin-top:8px;max-height:100px;overflow-y:auto;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Quantum Vault</div>
          <div id="mod-qvault-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
            <input class="inp-field" type="text" id="vault-key-inp" placeholder="Vault key..." style="flex:1;min-width:100px;"/>
            <input class="inp-field" type="text" id="vault-val-inp" placeholder="Secret value..." style="flex:1;min-width:100px;"/>
            <button class="btn btn-primary btn-sm" onclick="adminVaultStore()">Store</button>
            <button class="btn btn-outline btn-sm" onclick="adminVaultRetrieve()">Retrieve</button>
            <button class="btn btn-ghost btn-sm" onclick="adminVaultUnlock()">🔓 Unlock</button>
          </div>
          <div id="vault-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Temporal Processor</div>
          <div id="mod-temporal-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="runTemporalProcess()">⏱️ Process</button></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">UAC (Universal Autonomous Controller)</div>
          <div id="mod-uac-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="runUacCycle()">🔄 Cycle</button>
            <button class="btn btn-outline btn-sm" onclick="runUacInnovate()">💡 Innovate</button>
            <button class="btn btn-outline btn-sm" onclick="runUacOptimize()">⚡ Optimize</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Mesh Orchestrator</div>
          <div id="mod-mesh-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="adminMeshSync()">🔄 Sync</button>
          </div>
          <div id="mod-mesh-log" style="font-size:11px;color:#7090b0;margin-top:8px;max-height:100px;overflow-y:auto;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Code Sanity Engine</div>
          <div id="mod-code-sanity" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="runCodeSanityScan()">🔍 Scan</button>
          </div>
        </div>
        <div class="card">
          <div class="dash-section-title">Trust & Audit</div>
          <div id="mod-trust-status" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div id="mod-trust-incidents" style="font-size:12px;color:#7090b0;margin-top:8px;"></div>
        </div>
      </div>
      <!-- ADVANCED TAB -->
      <div class="adm-tab-panel" id="atab-advanced">
        <div class="grid-3" style="margin-bottom:16px;">
          <div class="card card-sm"><div class="label">AGI Engine</div><div class="kpi-val cyan" id="adv-agi-status">—</div></div>
          <div class="card card-sm"><div class="label">Sovereign</div><div class="kpi-val green" id="adv-sovereign-status">—</div></div>
          <div class="card card-sm"><div class="label">Quantum ML</div><div class="kpi-val" id="adv-qml-status">—</div></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div class="dash-section-title" style="margin:0;">AGI Self-Evolution Engine</div>
            <button class="btn btn-outline btn-sm" onclick="loadAdminAdvanced()">🔄 Refresh</button>
          </div>
          <div id="adv-agi-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="runAgiProcess()">▶ Process Task</button>
          <input class="inp-field" type="text" id="agi-task-inp" placeholder="AGI task..." style="margin-top:6px;width:100%;"/></div>
          <div id="agi-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Sovereign Access Guardian</div>
          <div id="adv-sovereign-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="adminSetupTotp()">🔐 Setup TOTP</button>
          </div>
          <div id="totp-result" style="font-size:12px;color:#00ffa3;margin-top:8px;word-break:break-all;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Autonomous Space Computing</div>
          <div id="adv-space-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="runSpaceProcess()">🚀 Process</button>
          <input class="inp-field" type="text" id="space-task-inp" placeholder="Space computing task..." style="margin-top:6px;width:100%;"/></div>
          <div id="space-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Decentralized Digital Twin Network</div>
          <div id="adv-dtwin-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="runDigitalTwinProcess()">🔄 Process</button>
          <input class="inp-field" type="text" id="dtwin-task-inp" placeholder="Digital twin task..." style="margin-top:6px;width:100%;"/></div>
          <div id="dtwin-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Neural Interface API</div>
          <div id="adv-neural-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="runNeuralProcess()">🧠 Process</button>
          <input class="inp-field" type="text" id="neural-task-inp" placeholder="Neural interface task..." style="margin-top:6px;width:100%;"/></div>
          <div id="neural-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Quantum Internet Protocol</div>
          <div id="adv-qinternet-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="runQuantumInternetProcess()">🌐 Process</button>
          <input class="inp-field" type="text" id="qinternet-task-inp" placeholder="Quantum internet task..." style="margin-top:6px;width:100%;"/></div>
          <div id="qinternet-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="dash-section-title">Quantum ML Core</div>
          <div id="adv-qml-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="runQuantumMlProcess()">⚛️ Process</button>
          <input class="inp-field" type="text" id="qml-task-inp" placeholder="Quantum ML task..." style="margin-top:6px;width:100%;"/></div>
          <div id="qml-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>
        </div>
        <div class="card">
          <div class="dash-section-title">Temporal Data Layer</div>
          <div id="adv-temporal-detail" style="font-size:12px;color:#7090b0;">Loading...</div>
          <div style="margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="runTemporalDataProcess()">⏳ Process</button>
          <input class="inp-field" type="text" id="temporaldata-task-inp" placeholder="Temporal data task..." style="margin-top:6px;width:100%;"/></div>
          <div id="temporaldata-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>
        </div>
      </div>
    </div>
  </div><!-- end #view-admin -->

</main>

<!-- AUTH MODAL -->
<div class="modal-backdrop hidden" id="auth-modal" onclick="backdropClose(event,'auth-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeModal('auth-modal')">✕</button>
    <div class="tab-row">
      <button class="tab-btn active" id="tab-login-btn" onclick="switchTab('tab-login')">Login</button>
      <button class="tab-btn" id="tab-register-btn" onclick="switchTab('tab-register')">Register</button>
      <button class="tab-btn" id="tab-forgot-btn" onclick="switchTab('tab-forgot')">Forgot</button>
    </div>
    <!-- Login -->
    <div class="tab-panel active" id="tab-login">
      <div class="inp-group">
        <label class="inp-label">Email</label>
        <input class="inp-field" type="email" id="login-email" placeholder="you@example.com" autocomplete="username"/>
      </div>
      <div class="inp-group">
        <label class="inp-label">Password</label>
        <input class="inp-field" type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()"/>
      </div>
      <div id="login-msg"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="doLogin()">🔑 Login</button>
      <p style="text-align:center;margin-top:12px;font-size:12px;color:#7090b0;">No account? <a href="#" style="color:#00d4ff;" onclick="switchTab('tab-register');return false">Register free</a></p>
    </div>
    <!-- Register -->
    <div class="tab-panel" id="tab-register">
      <div class="inp-group">
        <label class="inp-label">Full Name</label>
        <input class="inp-field" type="text" id="reg-name" placeholder="Your Name"/>
      </div>
      <div class="inp-group">
        <label class="inp-label">Email</label>
        <input class="inp-field" type="email" id="reg-email" placeholder="you@example.com" autocomplete="username"/>
      </div>
      <div class="inp-group">
        <label class="inp-label">Password</label>
        <input class="inp-field" type="password" id="reg-pass" placeholder="Min 8 characters" autocomplete="new-password" onkeydown="if(event.key==='Enter')doRegister()"/>
      </div>
      <div id="reg-msg"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="doRegister()">🚀 Create Free Account</button>
    </div>
    <!-- Forgot -->
    <div class="tab-panel" id="tab-forgot">
      <p class="muted" style="font-size:13px;margin-bottom:14px;">Enter your email to receive a password reset link.</p>
      <div class="inp-group">
        <label class="inp-label">Email</label>
        <input class="inp-field" type="email" id="forgot-email" placeholder="you@example.com"/>
      </div>
      <div id="forgot-msg"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="doForgot()">📧 Send Reset Link</button>
    </div>
  </div>
</div>

<!-- CHECKOUT MODAL -->
<div class="modal-backdrop hidden" id="checkout-modal" onclick="backdropClose(event,'checkout-modal')">
  <div class="modal-box wide" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeModal('checkout-modal')">✕</button>
    <div class="modal-title" id="checkout-title">Checkout</div>
    <div id="checkout-body"></div>
  </div>
</div>

<!-- ADD DEAL MODAL -->
<div class="modal-backdrop hidden" id="add-deal-modal" onclick="backdropClose(event,'add-deal-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeModal('add-deal-modal')">✕</button>
    <div class="modal-title">New BD Deal</div>
    <div class="inp-group">
      <label class="inp-label">Company</label>
      <input class="inp-field" type="text" id="deal-company" placeholder="Company Name"/>
    </div>
    <div class="inp-group">
      <label class="inp-label">Value ($)</label>
      <input class="inp-field" type="number" id="deal-value" placeholder="e.g. 50000"/>
    </div>
    <div class="inp-group">
      <label class="inp-label">Stage</label>
      <select class="inp-field" id="deal-stage">
        <option value="lead">Lead</option>
        <option value="prospect">Prospect</option>
        <option value="negotiation">Negotiation</option>
        <option value="closed">Closed</option>
      </select>
    </div>
    <div class="inp-group">
      <label class="inp-label">Notes</label>
      <input class="inp-field" type="text" id="deal-notes" placeholder="Optional notes"/>
    </div>
    <div id="deal-msg"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="submitDeal()">💼 Add Deal</button>
  </div>
</div>

<!-- NOTIFICATION PANEL -->
<div id="notif-panel" style="position:fixed;top:70px;right:20px;z-index:190;width:300px;background:#0a0e24;border:1px solid rgba(0,200,255,.3);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.6);display:none;">
  <div style="padding:12px 16px;border-bottom:1px solid rgba(0,200,255,.15);display:flex;align-items:center;justify-content:space-between;">
    <span style="font-family:Orbitron,monospace;font-size:13px;color:#00d4ff;font-weight:700;">Opportunity Alerts</span>
    <button style="background:none;border:none;color:#7090b0;cursor:pointer;font-size:14px;" onclick="closeNotifPanel()">✕</button>
  </div>
  <div id="notif-list" style="max-height:320px;overflow-y:auto;padding:8px;"></div>
</div>

<!-- CHAT WIDGET -->
<button id="chat-fab" onclick="toggleChat()">💬 Zeus AI</button>
<div id="chat-panel" class="hidden">
  <div class="chat-hdr">
    <span class="chat-title">⚡ Zeus AI Assistant</span>
    <button class="chat-close" onclick="toggleChat()">✕</button>
  </div>
  <div id="chat-messages"></div>
  <div class="chat-inp-row">
    <input class="chat-inp" id="chat-input" type="text" placeholder="Ask Zeus anything..." onkeydown="if(event.key==='Enter')sendChat()"/>
    <button class="chat-send" onclick="sendChat()">▶</button>
  </div>
</div>

<script>
// ================================================================
// INNOVATION MODULES STATUS UI LOGIC
// ================================================================
function loadInnovationModulesStatus() {
  var el = document.getElementById('innovation-modules-status');
  if (!el) return;
  el.textContent = 'Loading...';
  fetch('/api/innovation/status').then(function(r){
    if (!r.ok) throw new Error('API error');
    return r.json();
  }).then(function(data){
    if (!data || !data.modules) {
      el.textContent = 'No data.';
      return;
    }
    var html = '<table style="width:100%;font-size:12px;border-collapse:collapse;">';
    html += '<tr><th style="text-align:left;padding:4px 8px;">Module</th><th style="text-align:left;padding:4px 8px;">Status</th><th style="text-align:left;padding:4px 8px;">Details</th></tr>';
    for (var k in data.modules) {
      var m = data.modules[k];
      html += '<tr>';
      html += '<td style="padding:4px 8px;font-weight:700;color:#00d4ff;">'+escHtml(k)+'</td>';
      html += '<td style="padding:4px 8px;">'+escHtml(m.status||'-')+'</td>';
      html += '<td style="padding:4px 8px;">'+escHtml(m.details||'-')+'</td>';
      html += '</tr>';
    }
    html += '</table>';
    el.innerHTML = html;
  }).catch(function(e){
    el.textContent = 'Failed to load: '+e;
  });
}
document.addEventListener('DOMContentLoaded',function(){
  setTimeout(debounce(loadInnovationModulesStatus, 1200), 1200);
});
// STATE
// ================================================================
var STATE = {
  token: localStorage.getItem('zeus_token') || null,
  user: (function(){try{return JSON.parse(localStorage.getItem('zeus_user')||'null');}catch(e){return null;}})(),
  isAdmin: false,
  adminToken: localStorage.getItem('zeus_admin_token') || null,
  btcRate: 0,
  currentView: 'home',
  freeChats: parseInt(localStorage.getItem('zeus_free_chats')||'0',10),
  chatHistory: [],
  chatOpen: false,
  checkoutItem: null,
  checkoutPaymentTxId: null,
  services: [],
  filteredServices: [],
  pricingYearly: false,
  marketConditions: null,
  countdownTimer: null,
  adminTab: 'overview',
  dashTab: 'overview',
  adminUsersPage: 1,
  notifOpen: false,
  paymentMethodIds: ['crypto_btc'],
  paymentMethods: [{ id: 'crypto_btc', name: 'Bitcoin', active: true }],
  nowPaymentsReady: false,
  btcAddress: '${btcWallet}'
};

// ================================================================
// UTILITIES
// ================================================================
function authHeaders(){
  var h={'Content-Type':'application/json'};
  if(STATE.token) h['Authorization']='Bearer '+STATE.token;
  return h;
}
function adminHeaders(){
  var h={'Content-Type':'application/json'};
  if(STATE.adminToken) h['Authorization']='Bearer '+STATE.adminToken;
  return h;
}
function isLoggedIn(){return !!STATE.token;}

(function installResilientFetch(){
  if(window.__zeusResilientFetchInstalled || !window.fetch) return;
  window.__zeusResilientFetchInstalled=true;
  var nativeFetch=window.fetch.bind(window);
  var CACHE_PREFIX='zeus_last_good_response:';
  function methodOf(input,init){return ((init&&init.method)||(input&&input.method)||'GET').toUpperCase();}
  function urlOf(input){try{return new URL((typeof input==='string'?input:input.url),window.location.origin).href;}catch(e){return String(input||'');}}
  function sameSite(url){try{return new URL(url,window.location.origin).origin===window.location.origin;}catch(e){return false;}}
  function cacheKey(method,url){return CACHE_PREFIX+method+':'+url;}
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  function markFallback(url){
    window.__zeusLastDataFallback={url:url,ts:new Date().toISOString()};
    try{document.documentElement.setAttribute('data-zeus-api-fallback','1');}catch(e){}
  }
  function clearStuckLoading(){
    try{
      var nodes=document.querySelectorAll('[id]');
      for(var i=0;i<nodes.length;i++){
        var n=nodes[i];
        if(/^\s*(Loading( dashboard)?|Revenue data loading|Growth data loading)\.\.\.\s*$/i.test(n.textContent||'')){
          n.textContent='Date temporar indisponibile — se afișează ultimele date cunoscute când există.';
        }
      }
    }catch(e){}
  }
  function remember(method,url,response){
    if(method!=='GET' || !sameSite(url) || !response || !response.ok) return;
    try{
      response.clone().text().then(function(body){
        if(!body || body.length>250000) return;
        var type=response.headers&&response.headers.get?response.headers.get('content-type')||'application/json':'application/json';
        localStorage.setItem(cacheKey(method,url),JSON.stringify({body:body,type:type,status:response.status,ts:Date.now()}));
      }).catch(function(){});
    }catch(e){}
  }
  function cachedResponse(method,url){
    if(method!=='GET' || !sameSite(url)) return null;
    try{
      var raw=localStorage.getItem(cacheKey(method,url));
      if(!raw) return null;
      var item=JSON.parse(raw);
      if(!item || typeof item.body!=='string') return null;
      markFallback(url);
      clearStuckLoading();
      return new Response(item.body,{status:200,statusText:'OK (cached)',headers:{'Content-Type':item.type||'application/json','X-Zeus-Cache-Fallback':'1','X-Zeus-Cache-Ts':String(item.ts||'')}});
    }catch(e){return null;}
  }
  window.__zeusClearStuckLoading=clearStuckLoading;
  window.fetch=async function resilientFetch(input,init){
    var method=methodOf(input,init);
    var url=urlOf(input);
    var attempts=3;
    var lastError=null;
    var lastResponse=null;
    for(var attempt=1;attempt<=attempts;attempt++){
      try{
        var response=await nativeFetch(input,init);
        if(response.ok){remember(method,url,response);return response;}
        lastResponse=response;
        if(response.status<500) return response;
      }catch(e){
        lastError=e;
        if(init&&init.signal&&init.signal.aborted) break;
      }
      if(attempt<attempts) await wait(250*attempt);
    }
    var cached=cachedResponse(method,url);
    if(cached) return cached;
    clearStuckLoading();
    if(lastResponse) return lastResponse;
    throw lastError||new Error('Network error');
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(clearStuckLoading,8000);});
  else setTimeout(clearStuckLoading,8000);
})();

async function api(method,path,body,useAdmin){
  try{
    var opts={method:method,headers:useAdmin?adminHeaders():authHeaders()};
    if(body) opts.body=JSON.stringify(body);
    var r=await fetch(path,opts);
    if(!r.ok){
      if(r.status===429){
        var msg=rateLimitMessage(r);
        toast(msg,'err');
        return {error:msg,rateLimited:true,status:429};
      }
      var t=await r.text();
      try{return JSON.parse(t);}catch(e){return {error:t||('HTTP '+r.status)};}
    }
    return r.json();
  }catch(e){
    if(window.__zeusClearStuckLoading) window.__zeusClearStuckLoading();
    return {error:e.message||'Network error'};
  }
}

function toast(msg,type){
  var c=document.getElementById('toast-container');
  var d=document.createElement('div');
  d.className='toast '+(type||'');
  d.textContent=msg;
  c.appendChild(d);
  setTimeout(function(){d.remove();},3500);
}

function copyText(txt,el){
  navigator.clipboard.writeText(txt).then(function(){
    toast('Copied to clipboard!','ok');
    if(el){var old=el.textContent;el.textContent='✓ Copied!';setTimeout(function(){el.textContent=old;},1500);}
  }).catch(function(){toast('Copy failed','err');});
}

function submitLead(ev){
  ev.preventDefault();
  var f=ev.target, msg=document.getElementById('lead-msg');
  var data={ email:f.email.value, hp_field:f.hp_field.value, source:'homepage-footer', interest:'general' };
  if(msg) msg.textContent='Sending…';
  fetch('/api/lead',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
    .then(function(r){return r.json();})
    .then(function(j){
      if(j && j.ok){ if(msg) msg.textContent='✓ You\'re on the list. Welcome.'; f.reset(); }
      else { if(msg) msg.textContent='✗ '+(j&&j.error||'Could not save. Try again.'); }
    })
    .catch(function(){ if(msg) msg.textContent='✗ Network error.'; });
  return false;
}

function usdToBtc(usd){
  if(!STATE.btcRate||STATE.btcRate<=0) return '—';
  return (usd/STATE.btcRate).toFixed(6)+' BTC';
}

function fmtMs(ms){
  var s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60),d=Math.floor(h/24);
  if(d>0) return d+'d '+( h%24)+'h';
  if(h>0) return h+'h '+(m%60)+'m';
  return m+'m '+(s%60)+'s';
}

function setElText(id,val){var e=document.getElementById(id);if(e)e.textContent=val;}

function syncBtcAddress(address){
  if(!address) return;
  STATE.btcAddress=String(address);
  document.querySelectorAll('[data-btc-address]').forEach(function(el){el.textContent=STATE.btcAddress;});
}

function activePaymentLabels(){
  var ids=STATE.paymentMethodIds||['crypto_btc'];
  var labels=['BTC direct'];
  if(ids.indexOf('stripe')>=0||ids.indexOf('card')>=0) labels.push('Card/Stripe');
  if(ids.indexOf('paypal')>=0) labels.push('PayPal');
  if(STATE.nowPaymentsReady||ids.indexOf('nowpayments')>=0) labels.push('global crypto');
  return labels;
}

function updatePaymentCopy(){
  var labels=activePaymentLabels();
  setElText('payment-step-desc','Pay with '+labels.join(', ')+'. Optional external rails are shown only when configured live; service activation stays automatic.');
  setElText('pricing-payment-copy','Payments via '+labels.join(', ')+'.');
}

function rateLimitMessage(response){
  var retry=response&&response.headers&&response.headers.get?response.headers.get('retry-after'):'';
  return 'Live API is protecting the platform from too many rapid requests. '+(retry?'Retry in '+retry+' seconds.':'Please wait a few seconds and retry.');
}

function buildStatusCard(label,value,tone,detail){
  return '<div class="card card-sm"><div class="label">'+escHtml(label)+'</div><div class="kpi-val '+(tone||'')+'" style="font-size:18px;">'+escHtml(value)+'</div>'+(detail?'<p class="muted" style="font-size:11px;margin-top:6px;">'+escHtml(detail)+'</p>':'')+'</div>';
}

function metaBuild(){
  var m=document.querySelector('meta[name="x-zeus-build"]');
  return m&&m.content?m.content:'live';
}

async function fetchJsonStatus(path){
  var started=Date.now();
  try{
    var response=await fetch(path,{headers:{'Cache-Control':'no-cache'}});
    var ms=Date.now()-started;
    var text=await response.text();
    var json={};
    try{json=text?JSON.parse(text):{};}catch(e){json={raw:text};}
    return {path:path,ok:response.ok,status:response.status,ms:ms,json:json};
  }catch(e){
    return {path:path,ok:false,status:0,ms:Date.now()-started,json:{error:e.message||'Network error'}};
  }
}

async function loadLiveStatus(force){
  var grid=document.getElementById('status-summary-grid');
  var checks=document.getElementById('status-checks');
  if(!grid||!checks) return;
  if(force) toast('Refreshing live status…','');
  var results=await Promise.all([
    fetchJsonStatus('/health'),
    fetchJsonStatus('/api/health'),
    fetchJsonStatus('/api/quantum-integrity/status'),
    fetchJsonStatus('/api/instant/catalog'),
    fetchJsonStatus('/api/innovation/coverage')
  ]);
  var site=results[0], backend=results[1], qis=results[2];
  var qisIntact=qis.ok&&qis.json&&qis.json.integrity==='intact';
  grid.innerHTML=buildStatusCard('Site',site.ok?'Online':'Issue',site.ok?'green':'','HTTP '+site.status+' · '+site.ms+'ms')
    +buildStatusCard('Backend',backend.ok?'Online':'Limited',backend.ok?'green':'purple','HTTP '+backend.status+' · '+backend.ms+'ms')
    +buildStatusCard('QIS',qisIntact?'Intact':'Review',qisIntact?'green':'purple',qis.json&&qis.json.lastScan?'Last scan '+(qis.json.lastScan.status||'n/a'):'HTTP '+qis.status)
    +buildStatusCard('Build',metaBuild().slice(0,7),'cyan','Forward-only live release');
  checks.innerHTML=results.map(function(r){
    var ok=r.ok&&(r.status<400);
    var detail=r.status===429?'Rate limited safely':(r.json&&r.json.error?r.json.error:(r.ms+'ms'));
    return '<div class="hist-row"><div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(r.path)+'</div><div class="muted" style="font-size:11px;">'+escHtml(detail)+'</div></div><span class="badge '+(ok?'':'badge-purple')+'">HTTP '+escHtml(String(r.status))+'</span></div>';
  }).join('');
}

function renderInnovationCards(data){
  var grid=document.getElementById('innovation-coverage-grid');
  var summaryGrid=document.getElementById('innovation-summary-grid');
  if(!grid||!summaryGrid) return;
  var summary=data&&data.summary||{};
  summaryGrid.innerHTML=buildStatusCard('Total',String(summary.total!=null?summary.total:'—'),'')
    +buildStatusCard('Live',String(summary.live!=null?summary.live:'—'),'green')
    +buildStatusCard('Foundation',String(summary.foundation!=null?summary.foundation:'—'),'cyan')
    +buildStatusCard('Needs Secrets',String(summary.optionalNeedsSecrets!=null?summary.optionalNeedsSecrets:'—'),'purple');
  var counts=summary.counts||{};
  var cards=Object.keys(counts).sort().map(function(key){
    var tone=key.indexOf('live')>=0?'green':key.indexOf('secret')>=0?'purple':'cyan';
    return '<div class="card card-hover"><div class="label">'+escHtml(key.replace(/-/g,' '))+'</div><div class="kpi-val '+tone+'" style="font-size:24px;">'+escHtml(String(counts[key]))+'</div><p class="muted" style="font-size:12px;margin-top:8px;">Coverage category from the live innovation engine.</p></div>';
  });
  if(!cards.length){
    cards.push('<div class="card"><div class="dash-section-title">Coverage payload</div><pre style="white-space:pre-wrap;color:#9fb7d8;font-size:12px;">'+escHtml(JSON.stringify(data,null,2).slice(0,1800))+'</pre></div>');
  }
  grid.innerHTML=cards.join('');
}

async function loadInnovationCoverage(force){
  var grid=document.getElementById('innovation-coverage-grid');
  if(!grid) return;
  if(force) toast('Refreshing innovation coverage…','');
  grid.innerHTML='<div class="card" style="text-align:center;padding:40px;"><div class="loader"></div></div>';
  var r=await fetchJsonStatus('/api/innovation/coverage');
  if(r.status===429){
    grid.innerHTML='<div class="card card-glow" style="text-align:center;padding:32px;"><div style="font-size:28px;">🛡️</div><p class="muted">'+escHtml(rateLimitMessage({headers:{get:function(){return '';}}}))+'</p><button class="btn btn-primary" style="margin-top:12px;" onclick="loadInnovationCoverage(true)">Retry</button></div>';
    return;
  }
  if(!r.ok){
    grid.innerHTML='<div class="card card-glow" style="text-align:center;padding:32px;color:#ff9090;">Could not load coverage · HTTP '+escHtml(String(r.status))+'</div>';
    return;
  }
  renderInnovationCards(r.json||{});
}

// ================================================================
// NAVIGATION
// ================================================================
function navigate(view){
  STATE.currentView=view;
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active');});
  var el=document.getElementById('view-'+view);
  if(el) el.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(function(b){
    b.classList.toggle('active',b.dataset.view===view);
  });
  window.location.hash=view==='home'?'':view;
  if(view==='marketplace') loadMarketplace();
  else if(view==='crypto-bridge') loadCryptoBridgeView();
  else if(view==='pricing') loadPricing();
  else if(view==='innovations') loadInnovationCoverage();
  else if(view==='status') loadLiveStatus();
  else if(view==='dashboard'){
    if(!isLoggedIn()){openModal('auth-modal');return;}
    switchDashTab(STATE.dashTab||'overview');
  }
  else if(view==='admin') initAdmin();
  window.scrollTo(0,0);
}

function initRouting(){
  var h=(window.location.hash||'').replace('#','').trim();
  var valid=['home','marketplace','crypto-bridge','pricing','innovations','status','dashboard','admin'];
  if(valid.indexOf(h)>=0){
    navigate(h);
    return;
  }
  var p=(window.location.pathname||'/').replace(/\/+$/,'')||'/';
  if(p==='/crypto-fiat-bridge' || p==='/crypto-bridge'){
    navigate('crypto-bridge');
    return;
  }
  navigate('home');
}

// ================================================================
// MODALS
// ================================================================
function openModal(id){document.getElementById(id).classList.remove('hidden');}
function closeModal(id){document.getElementById(id).classList.add('hidden');}
function backdropClose(e,id){if(e.target===document.getElementById(id))closeModal(id);}

function switchTab(tab){
  ['login','register','forgot'].forEach(function(t){
    var p=document.getElementById('tab-'+t);
    var b=document.getElementById('tab-'+t+'-btn');
    if(p) p.classList.remove('active');
    if(b) b.classList.remove('active');
  });
  var n=tab.replace('tab-','');
  var target=document.getElementById('tab-'+n);
  var tbtn=document.getElementById('tab-'+n+'-btn');
  if(target) target.classList.add('active');
  if(tbtn) tbtn.classList.add('active');
}

// ================================================================
// AUTH
// ================================================================
function updateHeaderAuth(){
  var loggedIn=isLoggedIn();
  document.getElementById('hdr-auth').style.display=loggedIn?'none':'flex';
  document.getElementById('hdr-user').style.display=loggedIn?'flex':'none';
  var dashBtn=document.getElementById('nav-dashboard');
  if(dashBtn) dashBtn.style.display=loggedIn?'':'none';
  var bell=document.getElementById('notif-bell');
  if(bell) bell.style.display=loggedIn?'block':'none';
  if(loggedIn&&STATE.user){
    var av=document.getElementById('user-avatar');
    if(av) av.textContent=(STATE.user.name||STATE.user.email||'?').charAt(0).toUpperCase();
    var pp=document.getElementById('user-plan-pill');
    if(pp) pp.textContent=(STATE.user.plan||'FREE').toUpperCase();
  }
}

async function doLogin(){
  var email=document.getElementById('login-email').value.trim();
  var pass=document.getElementById('login-pass').value;
  var msg=document.getElementById('login-msg');
  if(!email||!pass){msg.innerHTML='<div class="msg-err">Please fill all fields.</div>';return;}
  msg.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/customer/login',{email:email,password:pass});
  if(r.error||r.message){
    msg.innerHTML='<div class="msg-err">'+(r.error||r.message)+'</div>';
    return;
  }
  var token=r.token||r.accessToken||(r.data&&r.data.token);
  if(!token){msg.innerHTML='<div class="msg-err">Login failed. Check credentials.</div>';return;}
  STATE.token=token;
  STATE.user=r.user||r.customer||(r.data&&(r.data.user||r.data.customer))||{email:email};
  localStorage.setItem('zeus_token',token);
  localStorage.setItem('zeus_user',JSON.stringify(STATE.user));
  updateHeaderAuth();
  closeModal('auth-modal');
  toast('Welcome back!','ok');
  msg.innerHTML='';
}

async function doRegister(){
  var name=document.getElementById('reg-name').value.trim();
  var email=document.getElementById('reg-email').value.trim();
  var pass=document.getElementById('reg-pass').value;
  var msg=document.getElementById('reg-msg');
  if(!name||!email||!pass){msg.innerHTML='<div class="msg-err">Please fill all fields.</div>';return;}
  if(pass.length<8){msg.innerHTML='<div class="msg-err">Password must be at least 8 characters.</div>';return;}
  msg.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/customer/signup',{name:name,email:email,password:pass});
  if(r.error||(r.message&&!r.token&&!r.customer&&!r.user)){
    msg.innerHTML='<div class="msg-err">'+(r.error||r.message||'Registration failed')+'</div>';
    return;
  }
  var token=r.token||r.accessToken||(r.data&&r.data.token);
  if(token){
    STATE.token=token;
    STATE.user=r.user||r.customer||(r.data&&(r.data.user||r.data.customer))||{name:name,email:email};
    localStorage.setItem('zeus_token',token);
    localStorage.setItem('zeus_user',JSON.stringify(STATE.user));
    updateHeaderAuth();
    closeModal('auth-modal');
    toast('Account created! Welcome to Zeus AI 🚀','ok');
  } else {
    msg.innerHTML='<div class="msg-ok">Account created! Please log in.</div>';
    setTimeout(function(){switchTab('tab-login');},1500);
  }
}

async function doForgot(){
  var email=document.getElementById('forgot-email').value.trim();
  var msg=document.getElementById('forgot-msg');
  if(!email){msg.innerHTML='<div class="msg-err">Please enter your email.</div>';return;}
  msg.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/customer/forgot-password',{email:email});
  if(r.error){msg.innerHTML='<div class="msg-err">'+(r.error||'Failed')+'</div>';return;}
  msg.innerHTML='<div class="msg-ok">✓ If that email exists, a reset link has been sent.</div>';
}

function doLogout(){
  STATE.token=null;STATE.user=null;STATE.isAdmin=false;STATE.adminToken=null;
  localStorage.removeItem('zeus_token');
  localStorage.removeItem('zeus_user');
  localStorage.removeItem('zeus_admin_token');
  updateHeaderAuth();
  if(STATE.currentView==='dashboard'||STATE.currentView==='admin') navigate('home');
  toast('Logged out.','');
}

// ================================================================
// HOME DATA
// ================================================================
async function loadHomeData(){
  // Snapshot
  try{
    var snap=await fetch('/snapshot').then(function(r){return r.json();}).catch(function(){return {};});
    setElText('stat-users',(snap.telemetry&&snap.telemetry.activeUsers!=null)?snap.telemetry.activeUsers:'12');
    var up=snap.telemetry&&snap.telemetry.uptime;
    setElText('stat-uptime',up?fmtMs(up*1000):'99.9%');
    setElText('kpi-sprint',(snap.sprint&&snap.sprint.current)||'42');
    setElText('kpi-services',(snap.marketplace&&snap.marketplace.length)||'24');
    setElText('kpi-innov',(snap.innovations&&snap.innovations.count)||'7');
  }catch(e){}
  // Module Registry — fetch real count from public endpoint
  try{
    var mreg=await fetch('/api/module-registry').then(function(r){return r.json();}).catch(function(){return {};});
    var mcount=mreg.total;
    setElText('kpi-modules',mcount!=null?mcount+'':'?');
  }catch(e){setElText('kpi-modules','?');}
  // BTC rate — fetch on home load and push to all price displays
  try{
    var br=await fetch('/api/payment/btc-rate').then(function(r){return r.json();}).catch(function(){return {};});
    if(br.btcAddress) syncBtcAddress(br.btcAddress);
    if(br.rate||br.usd){
      STATE.btcRate=br.rate||br.usd||0;
      var fmt='$'+Number(STATE.btcRate).toLocaleString('en-US',{maximumFractionDigits:0});
      setElText('stat-btc',fmt);
      setElText('btc-ticker','BTC '+fmt);
      // Re-render service/plan cards now that we have a live rate
      if(STATE.filteredServices&&STATE.filteredServices.length) renderServiceGrid();
      if(document.getElementById('plans-grid')&&document.getElementById('plans-grid').children.length) renderPlanCards(null,STATE.marketConditions||null);
    }
  }catch(e){}

  // Payment capabilities (BTC-only by default; enable others when configured)
  try{
    var pm=await fetch('/api/payment/methods').then(function(r){return r.json();}).catch(function(){return {};});
    var methods=(pm.methods||[]).filter(function(m){return m&&m.active!==false;});
    STATE.paymentMethods=methods.length?methods:[{id:'crypto_btc',name:'Bitcoin',active:true}];
    STATE.paymentMethodIds=STATE.paymentMethods.map(function(m){return m.id;});
  }catch(e){
    STATE.paymentMethodIds=['crypto_btc'];
    STATE.paymentMethods=[{id:'crypto_btc',name:'Bitcoin',active:true}];
  }
  try{
    var sec=await fetch('/api/payment/nowpayments/security').then(function(r){return r.json();}).catch(function(){return {};});
    STATE.nowPaymentsReady=!!(sec&&sec.apiKeyConfigured&&sec.ipnSecretConfigured&&sec.webhookSecurityReady);
  }catch(e){
    STATE.nowPaymentsReady=false;
  }
  updatePaymentCopy();
  loadCaseStudies();
}

async function loadCaseStudies(){
  var grid=document.getElementById('case-studies-grid');
  if(!grid) return;
  try{
    var r=await api('GET','/api/site/case-studies');
    var cases=(r.caseStudies||r.data||[]);
    if(!cases.length){
      cases=[
        {company:'TechCorp',result:'+340% ROI',description:'Automated customer support with Zeus AI agents, reducing costs by 68%.'},
        {company:'FinanceHub',result:'-82% Costs',description:'AI-powered fraud detection saved $2.4M in first quarter.'},
        {company:'RetailMax',result:'3x Revenue',description:'Personalized AI recommendations drove triple-digit growth.'}
      ];
    }
    grid.innerHTML=cases.map(function(c){
      return '<div class="case-card"><div class="case-company">'+escHtml(c.company||'Company')+'</div><div class="case-result">'+escHtml(c.result||c.roi||'—')+'</div><div class="case-desc">'+escHtml(c.description||c.desc||'')+'</div></div>';
    }).join('');
  }catch(e){grid.innerHTML='<div class="card"><span class="muted">No case studies available.</span></div>';}
}

async function calcRoi(){
  var emp=parseInt(document.getElementById('roi-emp').value)||0;
  var rev=parseInt(document.getElementById('roi-rev').value)||0;
  var ind=document.getElementById('roi-ind').value;
  var res=document.getElementById('roi-result');
  if(!emp||!rev){toast('Please enter employees and revenue','err');return;}
  res.innerHTML='<div class="loader"></div>';
  res.classList.add('show');
  var r=await api('POST','/api/site/roi/calculate',{employees:emp,revenue:rev,industry:ind});
  var data=r.roi||r.data||r;
  var savings=data.annualSavings||data.savings||(rev*0.25);
  var roiPct=data.roiPercent||data.roi||(savings/rev*100).toFixed(0);
  var payback=data.paybackMonths||data.payback||'3';
  res.innerHTML='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;">'
    +'<div><div class="label">Annual Savings</div><div class="kpi-val green" style="font-size:20px;">$'+Number(savings).toLocaleString('en-US',{maximumFractionDigits:0})+'</div></div>'
    +'<div><div class="label">ROI</div><div class="kpi-val" style="font-size:20px;">'+roiPct+'%</div></div>'
    +'<div><div class="label">Payback</div><div class="kpi-val purple" style="font-size:20px;">'+payback+' mo</div></div>'
    +'</div><p class="muted" style="font-size:12px;margin-top:10px;text-align:center;">Based on '+ind+' industry benchmarks. <a href="#" onclick="openModal(\\'auth-modal\\');return false;" style="color:#00d4ff;">Get detailed report →</a></p>';
}

// ================================================================
// MARKETPLACE
// ================================================================
var allCategories=[];
var activeCategory='all';

async function loadCryptoBridgeView(){
  try{
    var h=await fetch('/api/crypto-bridge/health').then(function(r){return r.json();}).catch(function(){return null;});
    var healthLabel=(h&&h.ok)?'ONLINE':'DEGRADED';
    setElText('cb-health',healthLabel);
  }catch(_){
    setElText('cb-health','OFFLINE');
  }

  try{
    var rate=await fetch('/api/crypto-bridge/btc-rate').then(function(r){return r.json();}).catch(function(){return null;});
    var usd=(rate&&(rate.usd||rate.rate))?Number(rate.usd||rate.rate):0;
    setElText('cb-rate',usd>0?('$'+usd.toLocaleString('en-US',{maximumFractionDigits:0})):'N/A');
  }catch(_){
    setElText('cb-rate','N/A');
  }
}

async function loadMarketplace(){
  var grid=document.getElementById('svc-grid');
  if(!grid) return;
  // Ensure live BTC rate is available before rendering prices
  if(!STATE.btcRate||STATE.btcRate<=0){
    try{
      var br=await fetch('/api/payment/btc-rate').then(function(r){return r.json();}).catch(function(){return {};});
      if(br.rate||br.usd){STATE.btcRate=br.rate||br.usd;var f='$'+Number(STATE.btcRate).toLocaleString('en-US',{maximumFractionDigits:0});setElText('btc-ticker','BTC '+f);setElText('stat-btc',f);}
    }catch(e){}
  }
  if(STATE.services.length){renderServiceGrid();return;}
  grid.innerHTML='<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;"><div class="loader"></div></div>';

  // --- Failsafe fetch for /api/catalog with 5s timeout and fallback ---
  let svcs = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('/api/catalog', { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length && typeof data[0] === 'object' && data[0].name) {
        svcs = data;
      } else if (Array.isArray(data)) {
        // fallback: array of names
        svcs = data.map((n,i) => ({ id: 'svc-'+(i+1), name: n, description: '', price: 99, category: 'AI' }));
      }
    }
  } catch (e) {
    // fallback mock
    svcs = [
      {id:'svc-1',name:'AI Website Generator',description:'Generate websites with AI.',price:99,category:'AI'},
      {id:'svc-2',name:'AI Trading Bot',description:'Automated trading with AI.',price:149,category:'AI'}
    ];
  }
  STATE.services=svcs;
  STATE.filteredServices=svcs.slice();
  allCategories=['all'];
  svcs.forEach(function(s){if(s.category&&allCategories.indexOf(s.category)<0)allCategories.push(s.category);});
  renderCatFilters();
  renderServiceGrid();
}

function renderCatFilters(){
  var el=document.getElementById('cat-filters');
  if(!el) return;
  el.innerHTML=allCategories.map(function(c){
    return '<button class="filter-btn'+(c===activeCategory?' active':'')+'" onclick="setCat(\\''+escHtml(c)+'\\')">'+escHtml(c==='all'?'All':c)+'</button>';
  }).join('');
}

function setCat(cat){
  activeCategory=cat;
  renderCatFilters();
  filterServices();
}

function filterServices(){
  var q=(document.getElementById('svc-search')||{}).value||'';
  q=q.toLowerCase();
  STATE.filteredServices=STATE.services.filter(function(s){
    var matchCat=activeCategory==='all'||s.category===activeCategory;
    var matchQ=!q||s.name.toLowerCase().indexOf(q)>=0||((s.description||'').toLowerCase().indexOf(q)>=0);
    return matchCat&&matchQ;
  });
  renderServiceGrid();
}

function renderServiceGrid(){
  var grid=document.getElementById('svc-grid');
  if(!grid) return;
  if(!STATE.filteredServices.length){
    grid.innerHTML='<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:#7090b0;">No services match your search.</div>';
    return;
  }
  grid.innerHTML=STATE.filteredServices.map(function(s){
    var price=s.price||s.priceUsd||0;
    var btcEq=usdToBtc(price);
    var surgeBadge=s.surgeActive?'<span style="background:#ff4444;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;">⚡ SURGE</span>':'';
    var dynamicNote=s.dynamicFactor&&s.dynamicFactor!==1?'<div style="font-size:11px;color:#7090b0;">Demand: ×'+s.dynamicFactor.toFixed(2)+'</div>':'';
    return '<div class="svc-card">'
      +'<div><span class="svc-cat">'+escHtml(s.category||'Service')+'</span>'+surgeBadge+'</div>'
      +'<div class="svc-name">'+escHtml(s.name||'Service')+'</div>'
      +'<div class="svc-desc">'+escHtml(s.description||'')+'</div>'
      +'<div><div class="svc-price">$'+price+' <span style="font-size:12px;color:#7090b0;">/ mo</span></div>'
      +'<div class="svc-btc">≈ '+btcEq+'</div>'+dynamicNote+'</div>'
      +'<button class="btn btn-green btn-sm" onclick="openCheckout('+JSON.stringify({id:s.id,name:s.name,priceUsd:price})+')">Buy Now →</button>'
      +'</div>';
  }).join('');
}

// ================================================================
// PRICING
// ================================================================
var PLANS=[
  {id:'free',name:'Free',monthly:null,yearly:null,features:['3 AI requests/day','1 workspace','Community support','Basic analytics'],noFeatures:['Custom integrations','API access','Priority support']},
  {id:'starter',name:'Starter',monthly:null,yearly:null,features:['500 AI requests/day','5 workspaces','Email support','Full analytics','API access'],noFeatures:['Custom integrations','Dedicated support'],popular:false},
  {id:'pro',name:'Pro',monthly:null,yearly:null,features:['Unlimited AI requests','Unlimited workspaces','Priority support','Custom integrations','API access','Advanced analytics'],noFeatures:[],popular:true},
  {id:'enterprise',name:'Enterprise',monthly:null,yearly:null,features:['Everything in Pro','Dedicated account manager','Custom AI training','SLA 99.99%','White-label option','On-premise deployment'],noFeatures:[],popular:false},
];

async function loadPricing(){
  // Ensure live BTC rate is available
  if(!STATE.btcRate||STATE.btcRate<=0){
    try{
      var br=await fetch('/api/payment/btc-rate').then(function(r){return r.json();}).catch(function(){return {};});
      if(br.rate||br.usd){STATE.btcRate=br.rate||br.usd;var f='$'+Number(STATE.btcRate).toLocaleString('en-US',{maximumFractionDigits:0});setElText('btc-ticker','BTC '+f);setElText('stat-btc',f);}
    }catch(e){}
  }
  renderPlanCards();
  try{
    for(var i=0;i<PLANS.length;i++){
      var pid=PLANS[i].id;
      var pr=await fetch('/api/pricing/'+encodeURIComponent(pid)).then(function(r){return r.json();}).catch(function(){return null;});
      if(pr&&pr.price_usd!=null){
        var usd=Number(pr.price_usd);
        PLANS[i].monthly=usd;
        PLANS[i].yearly=usd;
      }
    }
    renderPlanCards();
  }catch(_){ }
  // Try to get live plans from API (with dynamic pricing applied)
  var r=await api('GET','/api/billing/plans/public');
  if(r.plans&&r.plans.length){
    STATE.marketConditions=r.marketConditions||null;
    renderPlanCards(r.plans,r.marketConditions);
  }
  // Live revenue-segment pricing (SME / Mid-Market / Enterprise / Global Giants)
  loadSegments();
}

// ================================================================
// REVENUE SEGMENTS — LIVE DYNAMIC PRICING
// ================================================================
// Calls /api/pricing/segments to get the real-time price (USD + BTC) for
// SME, Mid-Market, Enterprise and Global Giants tiers, then renders cards
// with the appropriate sales CTA per segment. Buy CTAs re-fetch the price
// at the moment of purchase and confirm with the user if it has changed
// (so the displayed price always matches what's actually paid).
var SEGMENT_MODULES=['sme','mid-market','enterprise-tier','global-giants'];
async function loadSegments(){
  var grid=document.getElementById('segments-grid');
  if(!grid) return;
  var segs=[];
  try{
    var r=await fetch('/api/pricing/segments').then(function(x){return x.json();}).catch(function(){return null;});
    if(r&&Array.isArray(r.segments)&&r.segments.length){segs=r.segments;}
  }catch(e){}
  if(!segs.length){
    // Per-module fallback (each call has its own server-side fallback)
    for(var i=0;i<SEGMENT_MODULES.length;i++){
      try{
        var p=await fetch('/api/pricing/module/'+encodeURIComponent(SEGMENT_MODULES[i])).then(function(x){return x.json();}).catch(function(){return null;});
        if(p&&p.pricing) segs.push(p);
      }catch(_){}
    }
  }
  STATE.segmentPrices={};
  segs.forEach(function(s){STATE.segmentPrices[s.moduleId]=s;});
  renderSegments(segs);
}
function renderSegments(segs){
  var grid=document.getElementById('segments-grid');
  if(!grid) return;
  if(!segs||!segs.length){grid.innerHTML='<div class="card" style="text-align:center;padding:24px;color:#7090b0;">Live pricing temporarily unavailable.</div>';return;}
  grid.innerHTML=segs.map(function(s){
    var meta=s.segment||{};
    var p=s.pricing||{};
    var usd=Number(p.usd||0);
    var btc=p.btc!=null?Number(p.btc).toFixed(8)+' BTC':'';
    var sats=p.sats!=null?Number(p.sats).toLocaleString('en-US')+' sats':'';
    var label=meta.label||s.moduleId;
    var desc=escHtml(meta.description||'');
    var ctaBtn='';
    if(meta.cta==='buy_btc'){
      ctaBtn='<button class="btn btn-primary btn-sm" onclick="buyDynamicSegment(\''+s.moduleId+'\')">⚡ Buy with Bitcoin</button>';
    } else if(meta.cta==='contact_sales'){
      ctaBtn='<button class="btn btn-outline btn-sm" onclick="contactSalesSegment(\''+s.moduleId+'\')">📞 Contact Sales</button>';
    } else if(meta.cta==='partnership'){
      ctaBtn='<button class="btn btn-outline btn-sm" onclick="partnershipSegment(\''+s.moduleId+'\')">🤝 Partnership</button>';
    }
    var negotiableBadge=meta.negotiable?'<div style="font-size:10px;color:#e6a817;margin-top:4px;">Indicative — negotiable</div>':'';
    var demandNote=p.demandFactor&&p.demandFactor!==1?'<div style="font-size:11px;color:#7090b0;margin-top:6px;">Demand ×'+Number(p.demandFactor).toFixed(2)+(p.peakHours?' · peak':'')+(p.surgeActive?' · surge':'')+'</div>':'';
    return '<div class="plan-card" data-module-id="'+escHtml(s.moduleId)+'">'
      +'<div class="plan-name">'+escHtml(label)+'</div>'
      +'<div class="plan-price">$'+(usd>=1?Number(usd).toLocaleString('en-US',{maximumFractionDigits:2}):usd)+'<span>/mo</span></div>'
      +(btc?'<div class="plan-btc">≈ '+btc+'</div>':'')
      +(sats?'<div style="font-size:11px;color:#7090b0;font-family:monospace;">'+sats+'</div>':'')
      +negotiableBadge
      +demandNote
      +'<p class="muted" style="font-size:12px;margin-top:10px;">'+desc+'</p>'
      +'<div style="margin-top:12px;">'+ctaBtn+'</div>'
      +'</div>';
  }).join('');
}

// Buy flow for SME/Mid-Market: re-fetch the live price at purchase time and
// require confirmation if it changed materially (>0.5%) since rendering.
async function buyDynamicSegment(moduleId){
  var prev=STATE.segmentPrices&&STATE.segmentPrices[moduleId];
  var prevUsd=prev&&prev.pricing?Number(prev.pricing.usd):0;
  toast('Confirming live price...','');
  var fresh=null;
  try{
    fresh=await fetch('/api/pricing/module/'+encodeURIComponent(moduleId)+'?userId='+encodeURIComponent((STATE.user&&STATE.user.id)||''))
      .then(function(r){return r.json();}).catch(function(){return null;});
  }catch(e){}
  if(!fresh||!fresh.pricing){
    toast('Could not confirm live price. Please try again.','err');
    return;
  }
  STATE.segmentPrices=STATE.segmentPrices||{};
  STATE.segmentPrices[moduleId]=fresh;
  var newUsd=Number(fresh.pricing.usd);
  if(prevUsd>0){
    var delta=Math.abs(newUsd-prevUsd)/prevUsd;
    if(delta>0.005){
      // Price changed — re-render and require confirmation
      var label=(fresh.segment&&fresh.segment.label)||moduleId;
      renderSegments(Object.values(STATE.segmentPrices));
      var ok=window.confirm('Preț actualizat / Price updated\n\n'+label+': $'+prevUsd.toFixed(2)+' → $'+newUsd.toFixed(2)+'\n\nContinue with the new price?');
      if(!ok){toast('Cancelled — price was updated.','');return;}
    }
  }
  var seg=fresh.segment||{};
  openCheckout({
    id:moduleId,
    serviceId:moduleId,
    name:(seg.label||moduleId)+' (live price)',
    priceUsd:newUsd
  });
}

function contactSalesSegment(moduleId){
  var p=(STATE.segmentPrices&&STATE.segmentPrices[moduleId])||null;
  var label=p&&p.segment?p.segment.label:moduleId;
  var price=p&&p.pricing?Number(p.pricing.usd).toLocaleString('en-US',{maximumFractionDigits:0}):'?';
  var subject=encodeURIComponent('Enterprise inquiry — '+label);
  var body=encodeURIComponent('Hi, I would like to discuss the '+label+' tier.\n\nIndicative price seen: $'+price+' (negotiable).\n\nPlease contact me to finalise scope and pricing.');
  window.location.href='mailto:sales@zeusai.pro?subject='+subject+'&body='+body;
}

function partnershipSegment(moduleId){
  var p=(STATE.segmentPrices&&STATE.segmentPrices[moduleId])||null;
  var label=p&&p.segment?p.segment.label:moduleId;
  var subject=encodeURIComponent('Global Giants partnership — '+label);
  var body=encodeURIComponent('Hello,\n\nWe are interested in an exclusive partnership for the '+label+' tier. Please share next steps.\n\nThank you.');
  window.location.href='mailto:partners@zeusai.pro?subject='+subject+'&body='+body;
}

function togglePricing(){
  STATE.pricingYearly=!STATE.pricingYearly;
  var tog=document.getElementById('pricing-toggle');
  tog.classList.toggle('on',STATE.pricingYearly);
  document.getElementById('lbl-monthly').classList.toggle('active',!STATE.pricingYearly);
  document.getElementById('lbl-yearly').classList.toggle('active',STATE.pricingYearly);
  renderPlanCards(null,STATE.marketConditions||null);
}

function renderPlanCards(apiPlans,marketConditions){
  var grid=document.getElementById('plans-grid');
  if(!grid) return;
  var plans=PLANS;
  if(apiPlans){
    plans=PLANS.map(function(local){
      var ap=apiPlans.find(function(p){return p.id===local.id||p.name===local.name;});
      return ap?Object.assign({},local,{monthly:ap.priceMonthly||local.monthly,yearly:ap.priceYearly||local.yearly,surgeActive:ap.surgeActive,peakHours:ap.peakHours,dynamicFactor:ap.dynamicFactor}):local;
    });
  }
  var mc=marketConditions||STATE.marketConditions||null;
  var marketBanner='';
  if(mc&&mc.surgeActive){marketBanner='<div style="text-align:center;margin-bottom:12px;padding:8px;background:#ff4444;color:#fff;border-radius:8px;font-weight:700;">⚡ SURGE PRICING ACTIVE — prices temporarily higher</div>';}
  else if(mc&&mc.peakHours){marketBanner='<div style="text-align:center;margin-bottom:12px;padding:8px;background:#e6a817;color:#000;border-radius:8px;font-weight:700;">🕐 Peak hours — dynamic pricing in effect</div>';}
  grid.innerHTML=marketBanner+plans.map(function(p){
    var price=STATE.pricingYearly?p.yearly:p.monthly;
    var hasPrice=price!=null&&isFinite(Number(price));
    var btcEq=hasPrice&&price>0?usdToBtc(price):'—';
    var feats=(p.features||[]).map(function(f){return '<li>'+escHtml(f)+'</li>';}).join('');
    var noFeats=(p.noFeatures||[]).map(function(f){return '<li class="no">'+escHtml(f)+'</li>';}).join('');
    var dynamicNote=p.dynamicFactor&&p.dynamicFactor!==1?'<div style="font-size:11px;color:#7090b0;margin-top:4px;">Demand factor: ×'+p.dynamicFactor.toFixed(2)+'</div>':'';
    return '<div class="plan-card'+(p.popular?' popular':'') +'">'
      +(p.popular?'<div class="popular-tag">⭐ Most Popular</div>':'')
      +'<div class="plan-name">'+escHtml(p.name)+'</div>'
      +'<div class="plan-price">'+(!hasPrice?'Loading price...':(price===0?'Free':'$'+price))+'<span>'+(hasPrice&&price>0?(STATE.pricingYearly?'/mo, billed yearly':'/mo'):'')+'</span></div>'
      +(hasPrice&&price>0?'<div class="plan-btc">≈ '+btcEq+'/mo</div>':'')
      +dynamicNote
      +'<ul class="plan-features">'+feats+noFeats+'</ul>'
      +(!hasPrice
        ?'<button class="btn btn-outline" disabled>Loading price...</button>'
        :(price===0
        ?'<button class="btn btn-outline" onclick="openModal(\\'auth-modal\\');switchTab(\\'tab-register\\')">Get Started Free</button>'
        :'<button class="btn '+(p.popular?'btn-primary':'btn-outline')+'" onclick="handleSubscribe(\\''+p.id+'\\','+price+')">Subscribe</button>'
      ))
      +'</div>';
  }).join('');
}

async function handleSubscribe(planId,price){
  if(price===0){openModal('auth-modal');switchTab('tab-register');return;}
  // Try Stripe session only when logged in
  if(isLoggedIn()){
    toast('Redirecting to checkout...','');
    var r=await api('POST','/api/billing/subscribe/stripe',{planId:planId,interval:STATE.pricingYearly?'yearly':'monthly'});
    if(r.checkoutUrl||r.url){window.location.href=r.checkoutUrl||r.url;return;}
  }
  // Direct checkout modal — works for guests too (BTC/PayPal no login required)
  openCheckout({name:planId+' Plan',priceUsd:price,serviceId:planId});
}

// ================================================================
// DASHBOARD
// ================================================================
async function loadDashboard(){
  var el=document.getElementById('dash-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:40px;"><div class="loader"></div></div>';
  var [credits,history,keys,refs]=await Promise.all([
    api('GET','/api/credits/usage'),
    api('GET','/api/payment/history?clientId='+(STATE.user&&STATE.user.id||'')),
    api('GET','/api/platform/api-keys/mine'),
    api('GET','/api/referrals/mine')
  ]);
  var u=STATE.user||{};
  var plan=(u.plan||'FREE').toUpperCase();
  var credUsed=(credits.used||credits.creditsUsed||0);
  var credTotal=(credits.total||credits.creditsTotal||1000);
  var credPct=Math.min(100,Math.round(credUsed/credTotal*100));
  var payments=(history.payments||history.data||[]);
  var apiKeys=(keys.keys||keys.data||[]);
  var referral=refs.referral||refs.data||{};
  var refCode=referral.code||referral.referralCode||(u.id?'REF-'+u.id.slice(-6).toUpperCase():'REF-ZEUS00');
  var refLink=window.location.origin+'?ref='+refCode;
  el.innerHTML='<div class="dash-grid">'
  // LEFT COLUMN
  +'<div>'
  // User info
  +'<div class="card card-glow" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">Command Center</div>'
  +'<p class="muted" style="font-size:12px;margin-bottom:12px;">Track purchases, keys, credits and platform health from one place.</p>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
  +'<button class="btn btn-outline btn-sm" onclick="navigate(\'marketplace\')">Buy service</button>'
  +'<button class="btn btn-outline btn-sm" onclick="navigate(\'status\')">Live status</button>'
  +'<button class="btn btn-outline btn-sm" onclick="navigate(\'innovations\')">Innovation map</button>'
  +'</div>'
  +'<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">'
  +'<div class="user-avatar" style="width:52px;height:52px;font-size:20px;">'+((u.name||u.email||'Z').charAt(0).toUpperCase())+'</div>'
  +'<div><div style="font-family:Orbitron,monospace;font-size:16px;font-weight:700;color:#e8f4ff;">'+escHtml(u.name||'Zeus User')+'</div>'
  +'<div style="font-size:13px;color:#7090b0;">'+escHtml(u.email||'')+'</div>'
  +'<div style="margin-top:4px;"><span class="badge">'+plan+'</span></div></div></div>'
  +'<button class="btn btn-primary btn-sm" onclick="navigate(\\'pricing\\')">⚡ Upgrade Plan</button>'
  +'</div>'
  // Credits
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">Credits Usage</div>'
  +'<div class="bar-wrap">'
  +'<div style="display:flex;justify-content:space-between;font-size:13px;"><span>'+credUsed+' used</span><span class="muted">'+credTotal+' total</span></div>'
  +'<div class="bar"><span style="width:'+credPct+'%"></span></div>'
  +'</div>'
  +'<p class="muted" style="font-size:12px;margin-top:8px;">'+credPct+'% of monthly credits used</p>'
  +'</div>'
  // Payment history
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">Payment History</div>'
  +(payments.length?payments.slice(0,8).map(function(p){
    return '<div class="hist-row">'
      +'<div><div style="font-weight:600;">'+escHtml(p.service||p.description||p.planId||'Payment')+'</div>'
      +'<div class="muted" style="font-size:11px;">'+escHtml(p.date||(p.createdAt?new Date(p.createdAt).toLocaleDateString():'—'))+'</div></div>'
      +'<div style="text-align:right;"><div class="green">$'+escHtml(String(p.amount||p.total||'—'))+'</div>'
      +'<div><span class="badge '+(p.status==='failed'?'badge-red':p.status==='pending'?'badge-purple':'')+'">'+escHtml(p.status||'paid')+'</span></div></div>'
      +'</div>';
  }).join(''):'<p class="muted" style="font-size:13px;">No payments yet. <a href="#" onclick="navigate(\\'marketplace\\');return false;" style="color:#00d4ff;">Browse services →</a></p>')
  +'</div>'
  +'</div>'
  // RIGHT COLUMN
  +'<div>'
  // API Keys
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">API Keys</div>'
  +(apiKeys.length?apiKeys.map(function(k){
    var kval=k.key||k.apiKey||'•••••••••••••••';
    var short=kval.length>20?kval.slice(0,8)+'...'+kval.slice(-6):kval;
    return '<div class="key-row"><div><div style="font-size:12px;font-weight:600;">'+escHtml(k.name||'API Key')+'</div><div class="key-val">'+escHtml(short)+'</div></div>'
      +'<button class="btn btn-ghost btn-sm" onclick="copyText(\\''+escHtml(kval)+'\\',this)">Copy</button></div>';
  }).join(''):'<p class="muted" style="font-size:12px;">No API keys yet.</p>')
  +'<button class="btn btn-outline btn-sm" style="margin-top:10px;width:100%;" onclick="generateApiKey()">+ Generate Key</button>'
  +'</div>'
  // Referrals
  +'<div class="card">'
  +'<div class="dash-section-title">Referrals</div>'
  +'<p class="muted" style="font-size:12px;margin-bottom:8px;">Earn credits for every referral. Share your link:</p>'
  +'<div class="ref-link-box" onclick="copyText(\\''+refLink+'\\',this)" title="Click to copy">'+escHtml(refLink)+'</div>'
  +'<p class="muted" style="font-size:11px;margin-top:6px;">Code: <span style="color:#00d4ff;">'+escHtml(refCode)+'</span></p>'
  +(referral.count!=null?'<p class="muted" style="font-size:12px;margin-top:8px;"><span class="green">'+referral.count+'</span> referrals so far</p>':'')
  +'<button class="btn btn-ghost btn-sm" style="margin-top:10px;width:100%;" onclick="generateReferral()">Generate New Code</button>'
  +'</div>'
  +'</div>'
  +'</div>';
}

async function generateApiKey(){
  if(!isLoggedIn()){openModal('auth-modal');return;}
  var r=await api('POST','/api/platform/api-keys/generate',{name:'Key-'+Date.now()});
  if(r.error){toast(r.error,'err');return;}
  toast('API key generated!','ok');
  loadDashboard();
}

async function generateReferral(){
  if(!isLoggedIn()){openModal('auth-modal');return;}
  var r=await api('POST','/api/referrals/create');
  if(r.error){toast(r.error,'err');return;}
  toast('Referral code generated!','ok');
  loadDashboard();
}

// ================================================================
// DASHBOARD SUB-TABS
// ================================================================
function switchDashTab(tab){
  STATE.dashTab=tab;
  document.querySelectorAll('.dash-tab-btn').forEach(function(b){b.classList.toggle('active',b.dataset.dtab===tab);});
  document.querySelectorAll('.dash-tab-panel').forEach(function(p){p.classList.remove('active');});
  var el=document.getElementById('dtab-'+tab);
  if(el) el.classList.add('active');
  if(tab==='overview') loadDashboard();
  else if(tab==='workflows') loadWorkflows();
  else if(tab==='alerts') loadAlerts();
  else if(tab==='labs') loadDashLabs();
  else if(tab==='enterprise') loadDashEnterprise();
  else if(tab==='markets') loadDashMarkets();
  else if(tab==='tenant') loadDashTenant();
  else if(tab==='healthscore') loadDashHealthScore();
  else if(tab==='qpay') loadDashQPay();
  else if(tab==='profile') loadProfile();
}

async function loadWorkflows(){
  var el=document.getElementById('workflows-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div></div>';
  var r=await api('GET','/api/workflows');
  var wfs=(r.workflows||r.data||r||[]);
  if(!Array.isArray(wfs)) wfs=[];
  el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    +'<div style="color:#7090b0;font-size:13px;">'+wfs.length+' workflow(s)</div>'
    +'<button class="btn btn-primary btn-sm" onclick="openCreateWorkflowModal()">+ New Workflow</button>'
    +'</div>'
    +(wfs.length?wfs.map(function(w){
      var statusCls=(w.status==='active')?'active':'inactive';
      return '<div class="workflow-card">'
        +'<div><div class="workflow-name">'+escHtml(w.name||w.id||'Workflow')+'</div>'
        +'<div style="font-size:12px;color:#7090b0;margin-top:3px;">'+escHtml(w.description||w.trigger||'Automated workflow')+'</div>'
        +'<div style="font-size:11px;color:#7090b0;margin-top:2px;">Steps: '+(w.steps?w.steps.length:0)
        +' | Runs: '+(w.runs||w.runCount||0)+'</div></div>'
        +'<div style="display:flex;gap:6px;align-items:center;">'
        +'<span class="workflow-status '+statusCls+'">'+(w.status||'inactive')+'</span>'
        +'<button class="btn btn-ghost btn-sm" onclick="runWorkflow(\\''+escAttr(String(w.id||''))+'\\')" title="Run">▶</button>'
        +'<button class="btn btn-danger btn-sm" onclick="deleteWorkflow(\\''+escAttr(String(w.id||''))+'\\')" title="Delete">✕</button>'
        +'</div></div>';
    }).join(''):'<div class="card" style="text-align:center;padding:40px;color:#7090b0;"><p>No workflows yet.</p><button class="btn btn-outline" style="margin-top:12px;" onclick="openCreateWorkflowModal()">Create your first workflow</button></div>');
}

function openCreateWorkflowModal(){
  if(!isLoggedIn()){openModal('auth-modal');return;}
  var name=prompt('Workflow name:');
  if(!name) return;
  var desc=prompt('Description (optional):') || '';
  createWorkflow(name,desc);
}

async function createWorkflow(name,desc){
  var r=await api('POST','/api/workflows',{name:name,description:desc,steps:[],trigger:'manual'});
  if(r.error){toast(r.error||'Failed to create workflow','err');return;}
  toast('Workflow created!','ok');
  loadWorkflows();
}

async function runWorkflow(id){
  var r=await api('POST','/api/workflows/'+id+'/run',{});
  if(r.error){toast(r.error,'err');return;}
  toast('Workflow started!','ok');
}

async function deleteWorkflow(id){
  if(!confirm('Delete this workflow?')) return;
  var r=await api('DELETE','/api/workflows/'+id);
  if(r.error){toast(r.error,'err');return;}
  toast('Workflow deleted.','ok');
  loadWorkflows();
}

async function loadAlerts(){
  var el=document.getElementById('alerts-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div></div>';
  var [alerts,opps]=await Promise.all([
    api('GET','/api/opportunity/alerts/unread'),
    api('GET','/api/opportunity/list')
  ]);
  var unread=(alerts.alerts||alerts.data||[]);
  var opList=(opps.opportunities||opps.data||[]);
  if(!Array.isArray(unread)) unread=[];
  if(!Array.isArray(opList)) opList=[];
  el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    +'<div><span class="badge">'+unread.length+' unread</span></div>'
    +(unread.length?'<button class="btn btn-ghost btn-sm" onclick="markAllAlertsRead()">Mark all read</button>':'')
    +'</div>';
  if(unread.length){
    el.innerHTML+=unread.map(function(a){
      return '<div class="alert-card unread">'
        +'<div class="alert-title">'+escHtml(a.title||a.type||'New Opportunity')+'</div>'
        +'<div class="alert-desc">'+escHtml(a.description||a.message||'')+'</div>'
        +(a.value?'<div style="margin-top:6px;font-size:12px;font-weight:700;color:#00ffa3;">Value: $'+escHtml(String(a.value))+'</div>':'')
        +'</div>';
    }).join('');
  }
  if(opList.length){
    el.innerHTML+='<div class="sec-title" style="font-size:14px;margin-top:20px;">All Opportunities</div>';
    el.innerHTML+=opList.slice(0,10).map(function(o){
      return '<div class="alert-card">'
        +'<div class="alert-title">'+escHtml(o.title||o.type||'Opportunity')+'</div>'
        +'<div class="alert-desc">'+escHtml(o.description||o.details||'')+'</div>'
        +(o.score?'<div style="margin-top:4px;font-size:11px;color:#c084fc;">Score: '+escHtml(String(o.score))+'</div>':'')
        +'</div>';
    }).join('');
  }
  if(!unread.length&&!opList.length){
    el.innerHTML+='<div class="card" style="text-align:center;padding:40px;color:#7090b0;">No alerts or opportunities at this time.</div>';
  }
}

async function markAllAlertsRead(){
  await api('POST','/api/opportunity/alerts/read',{});
  toast('All alerts marked as read.','ok');
  loadAlerts();
  updateNotifBadge(0);
}

async function loadProfile(){
  var el=document.getElementById('profile-content');
  if(!el) return;
  var u=STATE.user||{};
  el.innerHTML='<div class="card" style="max-width:500px;">'
    +'<div class="dash-section-title">Update Profile</div>'
    +'<div class="inp-group"><label class="inp-label">Name</label>'
    +'<input class="inp-field" type="text" id="prof-name" value="'+escAttr(u.name||'')+'"/></div>'
    +'<div class="inp-group"><label class="inp-label">Email</label>'
    +'<input class="inp-field" type="email" id="prof-email" value="'+escAttr(u.email||'')+'" readonly style="opacity:.6;cursor:not-allowed;"/></div>'
    +'<div id="prof-msg"></div>'
    +'<button class="btn btn-primary btn-sm" style="margin-top:4px;" onclick="saveProfile()">💾 Save Profile</button>'
    +'</div>'
    +'<div class="card" style="max-width:500px;margin-top:16px;">'
    +'<div class="dash-section-title">Change Password</div>'
    +'<div class="inp-group"><label class="inp-label">Current Password</label>'
    +'<input class="inp-field" type="password" id="prof-cur-pass" placeholder="Current password"/></div>'
    +'<div class="inp-group"><label class="inp-label">New Password</label>'
    +'<input class="inp-field" type="password" id="prof-new-pass" placeholder="Min 8 characters"/></div>'
    +'<div class="inp-group"><label class="inp-label">Confirm New Password</label>'
    +'<input class="inp-field" type="password" id="prof-conf-pass" placeholder="Repeat new password"/></div>'
    +'<div id="pass-msg"></div>'
    +'<button class="btn btn-outline btn-sm" style="margin-top:4px;" onclick="changePassword()">🔑 Change Password</button>'
    +'</div>';
}

async function saveProfile(){
  var name=document.getElementById('prof-name').value.trim();
  var msg=document.getElementById('prof-msg');
  if(!name){msg.innerHTML='<div class="msg-err">Name cannot be empty.</div>';return;}
  var r=await api('PUT','/api/auth/profile',{name:name});
  if(r.error){msg.innerHTML='<div class="msg-err">'+escHtml(r.error)+'</div>';return;}
  STATE.user=Object.assign(STATE.user||{},{name:name});
  localStorage.setItem('zeus_user',JSON.stringify(STATE.user));
  updateHeaderAuth();
  msg.innerHTML='<div class="msg-ok">Profile updated!</div>';
  setTimeout(function(){msg.innerHTML='';},2000);
}

async function changePassword(){
  var cur=document.getElementById('prof-cur-pass').value;
  var nw=document.getElementById('prof-new-pass').value;
  var cf=document.getElementById('prof-conf-pass').value;
  var msg=document.getElementById('pass-msg');
  if(!cur||!nw||!cf){msg.innerHTML='<div class="msg-err">All fields required.</div>';return;}
  if(nw!==cf){msg.innerHTML='<div class="msg-err">New passwords do not match.</div>';return;}
  if(nw.length<8){msg.innerHTML='<div class="msg-err">Min 8 characters.</div>';return;}
  var r=await api('POST','/api/user/change-password',{currentPassword:cur,newPassword:nw});
  if(r.error){msg.innerHTML='<div class="msg-err">'+escHtml(r.error||'Failed')+'</div>';return;}
  msg.innerHTML='<div class="msg-ok">Password changed successfully!</div>';
  document.getElementById('prof-cur-pass').value='';
  document.getElementById('prof-new-pass').value='';
  document.getElementById('prof-conf-pass').value='';
  setTimeout(function(){msg.innerHTML='';},2500);
}

// ================================================================
// NOTIFICATIONS
// ================================================================
function toggleNotifPanel(){
  STATE.notifOpen=!STATE.notifOpen;
  var panel=document.getElementById('notif-panel');
  if(panel) panel.style.display=STATE.notifOpen?'block':'none';
  if(STATE.notifOpen) pollNotifications();
}

function closeNotifPanel(){
  STATE.notifOpen=false;
  var panel=document.getElementById('notif-panel');
  if(panel) panel.style.display='none';
}

function updateNotifBadge(count){
  var badge=document.getElementById('notif-count');
  if(!badge) return;
  if(count>0){
    badge.textContent=count>99?'99+':String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function pollNotifications(){
  if(!isLoggedIn()) return;
  var r=await api('GET','/api/opportunity/alerts/unread').catch(function(){return {};});
  var items=(r.alerts||r.data||[]);
  if(!Array.isArray(items)) items=[];
  updateNotifBadge(items.length);
  var list=document.getElementById('notif-list');
  if(!list) return;
  if(!items.length){
    list.innerHTML='<div style="padding:16px;text-align:center;color:#7090b0;font-size:13px;">No unread alerts</div>';
    return;
  }
  list.innerHTML=items.slice(0,8).map(function(a){
    return '<div style="padding:10px 12px;border-bottom:1px solid rgba(0,200,255,.1);cursor:pointer;" onclick="switchDashTab(\\'alerts\\');closeNotifPanel();navigate(\\'dashboard\\')">'
      +'<div style="font-size:13px;font-weight:600;color:#e8f4ff;">'+escHtml(a.title||a.type||'Alert')+'</div>'
      +'<div style="font-size:11px;color:#7090b0;margin-top:2px;">'+escHtml((a.description||a.message||'').slice(0,80))+'</div>'
      +'</div>';
  }).join('');
}

// ================================================================
// ADMIN
// ================================================================
function initAdmin(){
  if(STATE.adminToken){
    document.getElementById('admin-login-section').style.display='none';
    document.getElementById('admin-panel-section').style.display='block';
    switchAdminTab(STATE.adminTab||'overview');
  } else {
    document.getElementById('admin-login-section').style.display='block';
    document.getElementById('admin-panel-section').style.display='none';
  }
}

async function doAdminLogin(){
  var pass=document.getElementById('admin-pass-inp').value;
  var tfa=document.getElementById('admin-2fa-inp').value;
  var msg=document.getElementById('admin-login-msg');
  if(!pass){msg.innerHTML='<div class="msg-err">Enter admin password.</div>';return;}
  msg.innerHTML='<div class="loader"></div>';
  var body={password:pass};
  if(tfa) body.twoFactorCode=tfa;
  var r=await api('POST','/api/auth/login',body);
  if(r.error||r.message&&!r.token){msg.innerHTML='<div class="msg-err">'+(r.error||r.message||'Auth failed')+'</div>';return;}
  var token=r.token||r.accessToken;
  if(!token){msg.innerHTML='<div class="msg-err">Authentication failed.</div>';return;}
  STATE.adminToken=token;STATE.isAdmin=true;
  localStorage.setItem('zeus_admin_token',token);
  document.getElementById('admin-login-section').style.display='none';
  document.getElementById('admin-panel-section').style.display='block';
  document.getElementById('nav-admin').style.display='';
  msg.innerHTML='';
  switchAdminTab('overview');
}

function switchAdminTab(tab){
  STATE.adminTab=tab;
  document.querySelectorAll('.adm-tab-btn').forEach(function(b){b.classList.toggle('active',b.dataset.atab===tab);});
  document.querySelectorAll('.adm-tab-panel').forEach(function(p){p.classList.remove('active');});
  var el=document.getElementById('atab-'+tab);
  if(el) el.classList.add('active');
  if(tab==='overview') loadAdminData();
  else if(tab==='users') loadAdminUsers();
  else if(tab==='revenue') loadAdminRevenue();
  else if(tab==='system') loadAdminSystem();
  else if(tab==='ai') loadAdminAI();
  else if(tab==='crm') loadAdminCRM();
  else if(tab==='viral') loadAdminViral();
  else if(tab==='innovation') loadAdminInnovation();
  else if(tab==='pricing') loadAdminPricing();
  else if(tab==='autonomous') loadAdminAutonomous();
  else if(tab==='modules') loadAdminModules();
  else if(tab==='advanced') loadAdminAdvanced();
}

async function loadAdminData(){
  var health=await api('GET','/api/health');
  setElText('adm-health',(health.status||'OK').toUpperCase());
  var snap=await fetch('/snapshot').then(function(r){return r.json();}).catch(function(){return {};});
  setElText('adm-uptime',snap.telemetry&&snap.telemetry.uptime?fmtMs(snap.telemetry.uptime*1000):'—');
  setElText('adm-users',snap.telemetry&&snap.telemetry.activeUsers!=null?snap.telemetry.activeUsers:'—');
  var snapEl=document.getElementById('adm-snapshot');
  if(snapEl) snapEl.innerHTML='<pre style="overflow:auto;max-height:200px;font-size:11px;">'+escHtml(JSON.stringify(snap,null,2))+'</pre>';
}

async function loadAdminUsers(){
  var wrap=document.getElementById('users-tbl-wrap');
  if(!wrap) return;
  var search=(document.getElementById('usr-search')||{}).value||'';
  var page=STATE.adminUsersPage||1;
  var params='page='+page+'&limit=20'+(search?'&search='+encodeURIComponent(search):'');
  wrap.innerHTML='<div style="text-align:center;padding:20px;"><div class="loader"></div></div>';
  var r=await api('GET','/api/admin/users?'+params,null,true);
  var users=(r.users||r.data||[]);
  var total=(r.total||users.length);
  if(!Array.isArray(users)||!users.length){
    wrap.innerHTML='<div style="padding:20px;text-align:center;color:#7090b0;font-size:13px;">No users found.</div>';
    return;
  }
  wrap.innerHTML='<table class="data-table">'
    +'<thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Joined</th><th>Actions</th></tr></thead>'
    +'<tbody>'+users.map(function(u){
      return '<tr>'
        +'<td>'+escHtml(u.name||'—')+'</td>'
        +'<td style="font-family:monospace;font-size:12px;">'+escHtml(u.email||'—')+'</td>'
        +'<td><span class="badge '+(u.plan==='enterprise'?'badge-purple':u.plan==='pro'?'badge-cyan':'')+'">'+escHtml((u.plan||'free').toUpperCase())+'</span></td>'
        +'<td style="font-size:11px;color:#7090b0;">'+(u.createdAt?new Date(u.createdAt).toLocaleDateString():'—')+'</td>'
        +'<td><div style="display:flex;gap:4px;">'
        +'<button class="btn btn-ghost btn-sm" onclick="adminChangePlan(\\''+escAttr(String(u.id||u._id||''))+'\\',\\''+escAttr(u.email||'')+'\\')">Plan</button>'
        +'<button class="btn btn-danger btn-sm" onclick="adminDeleteUser(\\''+escAttr(String(u.id||u._id||''))+'\\',\\''+escAttr(u.email||'')+'\\')">Del</button>'
        +'</div></td>'
        +'</tr>';
    }).join('')+'</tbody></table>';
  var pagEl=document.getElementById('users-pagination');
  if(pagEl){
    var pages=Math.ceil(total/20)||1;
    pagEl.innerHTML='Page '+page+' of '+pages
      +(page>1?'<button class="btn btn-ghost btn-sm" onclick="STATE.adminUsersPage='+(page-1)+';loadAdminUsers()">‹ Prev</button>':'')
      +(page<pages?'<button class="btn btn-ghost btn-sm" onclick="STATE.adminUsersPage='+(page+1)+';loadAdminUsers()">Next ›</button>':'');
  }
}

async function adminChangePlan(userId,email){
  var plan=prompt('New plan for '+email+' (free/starter/pro/enterprise):');
  if(!plan||!['free','starter','pro','enterprise'].includes(plan.toLowerCase())) return;
  var r=await api('PUT','/api/admin/users/'+userId+'/plan',{planId:plan.toLowerCase()},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Plan updated to '+plan,'ok');
  loadAdminUsers();
}

async function adminDeleteUser(userId,email){
  if(!confirm('Delete user '+email+'? This cannot be undone.')) return;
  var r=await api('DELETE','/api/admin/users/'+userId,null,true);
  if(r.error){toast(r.error,'err');return;}
  toast('User deleted.','ok');
  loadAdminUsers();
}

async function loadAdminRevenue(){
  var [stats,rev,growth]=await Promise.all([
    api('GET','/api/admin/executive/stats',null,true),
    api('GET','/api/admin/executive/revenue',null,true),
    api('GET','/api/admin/executive/growth',null,true)
  ]);
  setElText('rev-total','$'+(stats.totalRevenue||rev.total||0).toLocaleString());
  setElText('rev-mrr','$'+(stats.mrr||rev.mrr||0).toLocaleString());
  setElText('rev-margin',(stats.profitMargin||rev.margin||0)+'%');
  var bkEl=document.getElementById('rev-breakdown');
  if(bkEl){
    var src=rev.breakdown||rev.sources||stats.breakdown;
    if(src&&typeof src==='object'){
      bkEl.innerHTML=Object.keys(src).map(function(k){
        return '<div class="deal-row"><div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(k)+'</div></div>'
          +'<div class="green">$'+Number(src[k]).toLocaleString()+'</div></div>';
      }).join('');
    } else {
      bkEl.innerHTML='<div style="color:#7090b0;">Revenue data loading...</div>';
    }
  }
  var grEl=document.getElementById('rev-growth');
  if(grEl){
    var g=growth.metrics||growth.data||growth;
    if(g&&typeof g==='object'){
      grEl.innerHTML=Object.keys(g).slice(0,6).map(function(k){
        var v=g[k];
        var isPos=typeof v==='number'?v>=0:true;
        return '<div class="deal-row"><div style="color:#e8f4ff;font-size:13px;">'+escHtml(k)+'</div>'
          +'<div class="'+(isPos?'green':'')+'">'+escHtml(String(v))+'</div></div>';
      }).join('');
    } else {
      grEl.innerHTML='<div style="color:#7090b0;">Growth data loading...</div>';
    }
  }
}

async function loadAdminSystem(){
  var [slo,cb,canary,decisions,loop]=await Promise.all([
    api('GET','/api/slo/status').catch(function(){return {};}),
    api('GET','/api/circuit-breaker/status').catch(function(){return {};}),
    api('GET','/api/canary').catch(function(){return {};}),
    api('GET','/api/control-plane/decisions',null,true).catch(function(){return {};}),
    api('GET','/api/profit-loop/status',null,true).catch(function(){return {};})
  ]);
  var sloOk=(slo.healthy||slo.status==='ok'||slo.all_met);
  setElText('sys-slo',sloOk?'✅ Healthy':'⚠️ Degraded');
  var cbOk=cb.state==='closed'||cb.status==='closed'||!cb.open;
  setElText('sys-cb',cbOk?'✅ Closed':'🔴 Open');
  var cOk=(canary.active||canary.status==='running');
  setElText('sys-canary',cOk?'🟡 Active':'⚪ Idle');
  var decEl=document.getElementById('sys-decisions');
  if(decEl){
    var decs=(decisions.decisions||decisions.data||[]);
    if(Array.isArray(decs)&&decs.length){
      decEl.innerHTML=decs.slice(0,5).map(function(d){
        return '<div class="deal-row"><div><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(d.action||d.type||'Decision')+'</div>'
          +'<div style="font-size:11px;color:#7090b0;">'+escHtml((d.reason||d.description||'').slice(0,80))+'</div></div>'
          +'<div style="font-size:11px;color:#7090b0;">'+(d.timestamp?new Date(d.timestamp).toLocaleDateString():'')+'</div>'
          +'</div>';
      }).join('');
    } else {
      decEl.innerHTML='<div style="color:#7090b0;padding:8px 0;">No recent decisions.</div>';
    }
  }
  var loopEl=document.getElementById('sys-profit-loop');
  if(loopEl){
    var ls=loop.status||loop.state||loop;
    loopEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:120px;">'+escHtml(JSON.stringify(ls,null,2))+'</pre>';
  }
}

async function adminResetCircuitBreaker(){
  if(!confirm('Reset circuit breaker?')) return;
  var r=await api('POST','/api/circuit-breaker/reset',{},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Circuit breaker reset!','ok');
  loadAdminSystem();
}

async function loadAdminAI(){
  var [aiStatus,uaicModels,uaicStats]=await Promise.all([
    api('GET','/api/ai/status').catch(function(){return {};}),
    api('GET','/api/admin/uaic/models',null,true).catch(function(){return {};}),
    api('GET','/api/admin/uaic/stats',null,true).catch(function(){return {};})
  ]);
  var provEl=document.getElementById('ai-providers-list');
  if(provEl){
    var provs=aiStatus.providers||aiStatus.data||aiStatus;
    if(provs&&typeof provs==='object'&&!Array.isArray(provs)){
      provEl.innerHTML=Object.keys(provs).map(function(k){
        var ok=provs[k].available||provs[k].ok||provs[k].active||provs[k]===true;
        return '<div class="deal-row">'
          +'<div style="font-weight:600;color:#e8f4ff;">'+escHtml(k)+'</div>'
          +'<div><span class="status-dot '+(ok?'ok':'err')+'"></span>'+(ok?'<span class="green">Active</span>':'<span style="color:#ff6060">Unavailable</span>')+'</div>'
          +'</div>';
      }).join('');
    } else if(Array.isArray(provs)){
      provEl.innerHTML=provs.map(function(p){
        return '<div class="deal-row"><div class="' +(p.available?'green':'') +'">'+escHtml(p.name||p.id||p)+'</div>'
          +'<span class="status-dot '+(p.available?'ok':'err')+'"></span>'
          +'</div>';
      }).join('');
    } else {
      provEl.innerHTML='<div style="color:#7090b0;">Provider status unavailable.</div>';
    }
  }
  var modEl=document.getElementById('ai-uaic-models');
  if(modEl){
    var models=uaicModels.models||uaicModels.data||[];
    var stats=uaicStats.stats||uaicStats.data||uaicStats||{};
    var html='';
    if(stats.totalRequests!=null){
      html+='<div class="deal-row"><div>Total Requests</div><div class="cyan">'+stats.totalRequests+'</div></div>';
      html+='<div class="deal-row"><div>Success Rate</div><div class="green">'+(stats.successRate||'—')+'</div></div>';
      if(stats.cheapestProvider) html+='<div class="deal-row"><div>Cheapest Provider</div><div class="green">'+escHtml(stats.cheapestProvider)+'</div></div>';
    }
    if(Array.isArray(models)&&models.length){
      html+=models.slice(0,6).map(function(m){
        return '<div class="deal-row"><div style="font-size:12px;color:#e8f4ff;">'+escHtml(m.name||m.id||m)+'</div>'
          +'<div style="font-size:11px;color:#7090b0;">'+(m.provider||'')+'</div>'
          +'</div>';
      }).join('');
    }
    modEl.innerHTML=html||'<div style="color:#7090b0;">No model info.</div>';
  }
}

async function askUaic(){
  var inp=document.getElementById('uaic-query');
  var respEl=document.getElementById('uaic-response');
  if(!inp||!respEl) return;
  var q=inp.value.trim();
  if(!q) return;
  respEl.style.display='block';
  respEl.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/admin/uaic/ask',{task:q},true);
  var reply=r.reply||r.response||r.result||r.answer||JSON.stringify(r);
  respEl.innerHTML=escHtml(String(reply));
}

async function loadAdminCRM(){
  var [deals,leads]=await Promise.all([
    api('GET','/api/bd/deals',null,true).catch(function(){return {};}),
    api('GET','/api/bd/leads',null,true).catch(function(){return {};})
  ]);
  var dealList=(deals.deals||deals.data||deals||[]);
  var leadList=(leads.leads||leads.data||leads||[]);
  if(!Array.isArray(dealList)) dealList=[];
  if(!Array.isArray(leadList)) leadList=[];
  var dealsEl=document.getElementById('crm-deals-list');
  if(dealsEl){
    dealsEl.innerHTML=dealList.length?dealList.map(function(d){
      var stage=(d.stage||'lead').toLowerCase();
      return '<div class="deal-row">'
        +'<div><div style="font-weight:700;color:#e8f4ff;font-size:13px;">'+escHtml(d.company||d.name||'Deal')+'</div>'
        +'<div style="font-size:12px;color:#7090b0;margin-top:2px;">'+escHtml(d.notes||d.description||'')+'</div></div>'
        +'<div style="display:flex;gap:8px;align-items:center;">'
        +(d.value?'<div style="font-family:Orbitron,monospace;color:#00ffa3;font-size:13px;">$'+Number(d.value).toLocaleString()+'</div>':'')
        +'<span class="deal-stage '+escAttr(stage)+'">'+escHtml(stage)+'</span>'
        +'</div></div>';
    }).join(''):'<div style="padding:16px;text-align:center;color:#7090b0;font-size:13px;">No deals yet. Add your first deal!</div>';
  }
  var leadsEl=document.getElementById('crm-leads-list');
  if(leadsEl){
    leadsEl.innerHTML=leadList.length?leadList.slice(0,10).map(function(l){
      return '<div class="deal-row">'
        +'<div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(l.name||l.company||'Lead')+'</div>'
        +'<div style="font-size:12px;color:#7090b0;">'+escHtml(l.email||l.contact||'')+'</div></div>'
        +'<div style="font-size:11px;color:#7090b0;">'+(l.createdAt?new Date(l.createdAt).toLocaleDateString():'—')+'</div>'
        +'</div>';
    }).join(''):'<div style="padding:10px 0;color:#7090b0;font-size:13px;">No leads yet.</div>';
  }
}

function openAddDealModal(){
  openModal('add-deal-modal');
}

async function submitDeal(){
  var company=document.getElementById('deal-company').value.trim();
  var value=document.getElementById('deal-value').value;
  var stage=document.getElementById('deal-stage').value;
  var notes=document.getElementById('deal-notes').value.trim();
  var msg=document.getElementById('deal-msg');
  if(!company){msg.innerHTML='<div class="msg-err">Company name required.</div>';return;}
  var r=await api('POST','/api/bd/deals',{company:company,value:value?Number(value):0,stage:stage,notes:notes},true);
  if(r.error){msg.innerHTML='<div class="msg-err">'+escHtml(r.error)+'</div>';return;}
  toast('Deal added!','ok');
  closeModal('add-deal-modal');
  document.getElementById('deal-company').value='';
  document.getElementById('deal-value').value='';
  document.getElementById('deal-notes').value='';
  msg.innerHTML='';
  loadAdminCRM();
}

async function loadAdminViral(){
  var [viralStatus, socialStatus]=await Promise.all([
    api('GET','/api/autonomous/viral/status').catch(function(){return {};}),
    api('GET','/api/viral/status',null,true).catch(function(){return {};})
  ]);
  var metrics=viralStatus.metrics||viralStatus.data||viralStatus||{};
  setElText('viral-score',metrics.viralScore!=null?metrics.viralScore.toFixed(2):'—');
  setElText('viral-reach',metrics.estimatedReach!=null?Number(metrics.estimatedReach).toLocaleString():'—');
  setElText('viral-loop',(viralStatus.loopActive||viralStatus.active)?'🟢 Active':'⚪ Idle');
  var stEl=document.getElementById('viral-status');
  if(stEl){
    var keys=Object.keys(metrics).filter(function(k){return k!=='viralScore'&&k!=='estimatedReach';});
    stEl.innerHTML=keys.length?keys.map(function(k){
      return '<div class="deal-row"><div style="color:#e8f4ff;">'+escHtml(k)+'</div><div class="cyan">'+escHtml(String(metrics[k]))+'</div></div>';
    }).join(''):'<div style="color:#7090b0;">No viral metrics yet.</div>';
  }
  var socialEl=document.getElementById('social-viral-status');
  if(socialEl){
    var ss=socialStatus.status||socialStatus.data||socialStatus||{};
    socialEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:140px;">'+escHtml(JSON.stringify(ss,null,2))+'</pre>';
  }
}

async function triggerViralLoop(){
  var r=await api('POST','/api/autonomous/viral/trigger',{},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Viral growth loop triggered!','ok');
  loadAdminViral();
}

async function loadAdminInnovation(){
  var [loopStatus, proposals, deployStatus, report]=await Promise.all([
    api('GET','/api/innovation-loop/status').catch(function(){return {};}),
    api('GET','/api/innovation-loop/proposals',null,true).catch(function(){return {};}),
    api('GET','/api/auto-deploy-orchestrator/status',null,true).catch(function(){return {};}),
    api('GET','/api/innovation-engine/report',null,true).catch(function(){return {};})
  ]);
  var ls=loopStatus.status||loopStatus.state||loopStatus||{};
  var isRunning=loopStatus.running||loopStatus.active||loopStatus.status==='running';
  setElText('innov-loop-status',isRunning?'🟢 Running':'⚪ Idle');
  var propList=proposals.proposals||proposals.data||proposals||[];
  if(!Array.isArray(propList)) propList=[];
  setElText('innov-proposals-count',propList.length);
  var depOk=deployStatus.active||deployStatus.status==='ok'||deployStatus.running;
  setElText('innov-deploy-status',depOk?'🟢 Active':'⚪ Idle');
  var loopEl=document.getElementById('innov-loop-detail');
  if(loopEl){
    loopEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:100px;">'+escHtml(JSON.stringify(ls,null,2))+'</pre>';
  }
  var propEl=document.getElementById('innov-proposals-list');
  if(propEl){
    propEl.innerHTML=propList.length?propList.slice(0,8).map(function(p){
      return '<div class="deal-row">'
        +'<div><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(p.title||p.name||p.id||'Proposal')+'</div>'
        +'<div style="font-size:11px;color:#7090b0;">'+escHtml((p.description||p.summary||'').slice(0,80))+'</div></div>'
        +'<div><span class="badge '+(p.status==='merged'?'badge-cyan':p.status==='pending'?'badge-purple':'')+'">'+escHtml(p.status||'—')+'</span></div>'
        +'</div>';
    }).join(''):'<div style="color:#7090b0;">No proposals yet.</div>';
  }
  var repEl=document.getElementById('innov-engine-report');
  if(repEl){
    var rep=report.report||report.data||report||{};
    repEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:120px;">'+escHtml(JSON.stringify(rep,null,2))+'</pre>';
  }
}

async function triggerInnovationLoop(){
  var r=await api('POST','/api/innovation-loop/trigger',{},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Innovation loop triggered!','ok');
  loadAdminInnovation();
}

async function loadAdminPricing(){
  var [allPricing, tenants]=await Promise.all([
    api('GET','/api/pricing/all').catch(function(){return {};}),
    api('GET','/api/tenants/mine').catch(function(){return {};})
  ]);
  var pricingEl=document.getElementById('pricing-all-list');
  if(pricingEl){
    var items=allPricing.pricing||allPricing.data||allPricing||{};
    if(typeof items==='object'&&!Array.isArray(items)&&Object.keys(items).length){
      pricingEl.innerHTML=Object.keys(items).map(function(k){
        var v=items[k];
        var price=v.currentPrice||v.price||v.basePrice||v;
        var surge=v.surgeActive||v.isSurge||false;
        return '<div class="deal-row">'
          +'<div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(k)+'</div>'
          +(surge?'<span class="badge badge-purple" style="font-size:10px;">SURGE</span>':'')+'</div>'
          +'<div style="font-family:Orbitron,monospace;color:#00d4ff;">$'+escHtml(String(typeof price==='number'?price.toFixed(2):price))+'</div>'
          +'</div>';
      }).join('');
    } else if(Array.isArray(items)&&items.length){
      pricingEl.innerHTML=items.map(function(p){
        return '<div class="deal-row">'
          +'<div style="font-weight:600;color:#e8f4ff;">'+escHtml(p.name||p.id||'Service')+'</div>'
          +'<div style="font-family:Orbitron,monospace;color:#00d4ff;">$'+escHtml(String(p.price||p.currentPrice||0))+'</div>'
          +'</div>';
      }).join('');
    } else {
      pricingEl.innerHTML='<div style="color:#7090b0;">No pricing data available.</div>';
    }
  }
  var tenantsEl=document.getElementById('pricing-tenants-list');
  if(tenantsEl){
    var tList=tenants.tenants||tenants.data||tenants||[];
    if(!Array.isArray(tList)) tList=[];
    tenantsEl.innerHTML=tList.length?tList.map(function(t){
      return '<div class="deal-row">'
        +'<div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(t.name||t.subdomain||t.id||'Tenant')+'</div>'
        +'<div style="font-size:11px;color:#7090b0;">'+escHtml(t.subdomain||t.domain||'')+'</div></div>'
        +'<span class="badge badge-cyan">'+escHtml(t.plan||'enterprise')+'</span>'
        +'</div>';
    }).join(''):'<div style="color:#7090b0;">No white-label tenants yet.</div>';
  }
}

async function activatePricingSurge(){
  var svc=prompt('Service ID for surge (leave blank for all):');
  var dur=prompt('Duration (30min / 1h / 2h / 6h / 24h):') || '1h';
  var mult=prompt('Surge multiplier (e.g. 1.5):') || '1.5';
  var r=await api('POST','/api/pricing/surge',{serviceId:svc||undefined,durationKey:dur,multiplier:parseFloat(mult)||1.5},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Surge pricing activated!','ok');
  loadAdminPricing();
}

async function activatePricingSurge(){
  var svc=prompt('Service ID for surge (leave blank for all):');
  var dur=prompt('Duration (30min / 1h / 2h / 6h / 24h):') || '1h';
  var mult=prompt('Surge multiplier (e.g. 1.5):') || '1.5';
  var r=await api('POST','/api/pricing/surge',{serviceId:svc||undefined,durationKey:dur,multiplier:parseFloat(mult)||1.5},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Surge pricing activated!','ok');
  loadAdminPricing();
}

// ================================================================
// ADMIN REVENUE ENHANCEMENTS
// ================================================================
async function loadAdminRevenue(){
  var [stats,rev,growth,wealth,qpayRev,execModules,execInnovations]=await Promise.all([
    api('GET','/api/admin/executive/stats',null,true).catch(function(){return {};}),
    api('GET','/api/admin/executive/revenue',null,true).catch(function(){return {};}),
    api('GET','/api/admin/executive/growth',null,true).catch(function(){return {};}),
    api('GET','/api/wealth/stats',null,true).catch(function(){return {};}),
    api('GET','/api/quantum-payment/revenue',null,true).catch(function(){return {};}),
    api('GET','/api/admin/executive/modules',null,true).catch(function(){return {};}),
    api('GET','/api/admin/executive/innovations',null,true).catch(function(){return {};})
  ]);
  setElText('rev-total','$'+(stats.totalRevenue||rev.total||0).toLocaleString());
  setElText('rev-mrr','$'+(stats.mrr||rev.mrr||0).toLocaleString());
  setElText('rev-margin',(stats.profitMargin||rev.margin||0)+'%');
  var bkEl=document.getElementById('rev-breakdown');
  if(bkEl){
    var src=rev.breakdown||rev.sources||stats.breakdown;
    if(src&&typeof src==='object'){
      bkEl.innerHTML=Object.keys(src).map(function(k){
        return '<div class="deal-row"><div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(k)+'</div></div>'
          +'<div class="green">$'+Number(src[k]).toLocaleString()+'</div></div>';
      }).join('');
    } else {
      bkEl.innerHTML='<div style="color:#7090b0;">Revenue data loading...</div>';
    }
  }
  var grEl=document.getElementById('rev-growth');
  if(grEl){
    var g=growth.metrics||growth.data||growth;
    if(g&&typeof g==='object'){
      grEl.innerHTML=Object.keys(g).slice(0,6).map(function(k){
        var v=g[k];
        var isPos=typeof v==='number'?v>=0:true;
        return '<div class="deal-row"><div style="color:#e8f4ff;font-size:13px;">'+escHtml(k)+'</div>'
          +'<div class="'+(isPos?'green':'')+'">'+escHtml(String(v))+'</div></div>';
      }).join('');
    } else {
      grEl.innerHTML='<div style="color:#7090b0;">Growth data loading...</div>';
    }
  }
  var wEl=document.getElementById('rev-wealth-stats');
  if(wEl){
    var ws=wealth.stats||wealth.data||wealth||{};
    wEl.innerHTML=Object.keys(ws).slice(0,8).map(function(k){
      return '<div class="deal-row"><div style="color:#e8f4ff;">'+escHtml(k)+'</div><div class="cyan">'+escHtml(String(ws[k]))+'</div></div>';
    }).join('')||'<div style="color:#7090b0;">No wealth data.</div>';
  }
  var qpEl=document.getElementById('rev-qpay-stats');
  if(qpEl){
    var qps=qpayRev.revenue||qpayRev.data||qpayRev||{};
    qpEl.innerHTML=Object.keys(qps).slice(0,6).map(function(k){
      return '<div class="deal-row"><div style="color:#e8f4ff;">'+escHtml(k)+'</div><div class="green">'+escHtml(String(qps[k]))+'</div></div>';
    }).join('')||'<div style="color:#7090b0;">No quantum payment revenue yet.</div>';
  }
  var emEl=document.getElementById('rev-exec-modules');
  if(emEl){
    var mods=execModules.modules||execModules.data||execModules||[];
    if(Array.isArray(mods)&&mods.length){
      emEl.innerHTML='<div style="font-weight:600;color:#00d4ff;margin-bottom:6px;">Active Modules ('+mods.length+')</div>'
        +mods.slice(0,10).map(function(m){return '<span class="badge badge-cyan" style="margin:2px;">'+escHtml(m.name||m.id||m)+'</span>';}).join('');
    } else if(mods&&typeof mods==='object'){
      emEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(mods,null,2))+'</pre>';
    } else {
      emEl.innerHTML='<div style="color:#7090b0;">No module info.</div>';
    }
  }
  var eiEl=document.getElementById('rev-exec-innovations');
  if(eiEl){
    var inns=execInnovations.innovations||execInnovations.data||execInnovations||{};
    eiEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(inns,null,2))+'</pre>';
  }
}

async function adminSaveWealthSettings(){
  var settings={autoInvest:true,riskTolerance:'medium'};
  var r=await api('POST','/api/admin/wealth/settings',settings,true);
  if(r.error){toast(r.error,'err');return;}
  toast('Wealth settings saved!','ok');
}

async function askExecCopilot(){
  var inp=document.getElementById('exec-copilot-inp');
  var respEl=document.getElementById('exec-copilot-response');
  if(!inp||!respEl) return;
  var q=inp.value.trim();
  if(!q) return;
  respEl.style.display='block';
  respEl.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/executive/copilot',{query:q},true);
  var reply=r.reply||r.response||r.result||r.answer||JSON.stringify(r);
  respEl.innerHTML=escHtml(String(reply));
}

// ================================================================
// ADMIN SYSTEM ENHANCEMENTS
// ================================================================
async function loadAdminSystem(){
  var [slo,cb,canary,decisions,loop,canaryDecs,shadow,experiments,profitMetrics]=await Promise.all([
    api('GET','/api/slo/status').catch(function(){return {};}),
    api('GET','/api/circuit-breaker/status').catch(function(){return {};}),
    api('GET','/api/canary').catch(function(){return {};}),
    api('GET','/api/control-plane/decisions',null,true).catch(function(){return {};}),
    api('GET','/api/profit-loop/status',null,true).catch(function(){return {};}),
    api('GET','/api/canary/decisions',null,true).catch(function(){return {};}),
    api('GET','/api/shadow/variants',null,true).catch(function(){return {};}),
    api('GET','/api/experiments',null,true).catch(function(){return {};}),
    api('GET','/api/profit/metrics',null,true).catch(function(){return {};})
  ]);
  var sloOk=(slo.healthy||slo.status==='ok'||slo.all_met);
  setElText('sys-slo',sloOk?'✅ Healthy':'⚠️ Degraded');
  var cbOk=cb.state==='closed'||cb.status==='closed'||!cb.open;
  setElText('sys-cb',cbOk?'✅ Closed':'🔴 Open');
  var cOk=(canary.active||canary.status==='running');
  setElText('sys-canary',cOk?'🟡 Active':'⚪ Idle');
  var decEl=document.getElementById('sys-decisions');
  if(decEl){
    var decs=(decisions.decisions||decisions.data||[]);
    if(Array.isArray(decs)&&decs.length){
      decEl.innerHTML=decs.slice(0,5).map(function(d){
        return '<div class="deal-row"><div><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(d.action||d.type||'Decision')+'</div>'
          +'<div style="font-size:11px;color:#7090b0;">'+escHtml((d.reason||d.description||'').slice(0,80))+'</div></div>'
          +'<div style="font-size:11px;color:#7090b0;">'+(d.timestamp?new Date(d.timestamp).toLocaleDateString():'')+'</div>'
          +'</div>';
      }).join('');
    } else {
      decEl.innerHTML='<div style="color:#7090b0;padding:8px 0;">No recent decisions.</div>';
    }
  }
  var loopEl=document.getElementById('sys-profit-loop');
  if(loopEl){
    var ls=loop.status||loop.state||loop;
    loopEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:120px;">'+escHtml(JSON.stringify(ls,null,2))+'</pre>';
  }
  var cdEl=document.getElementById('sys-canary-decisions');
  if(cdEl){
    var cds=canaryDecs.decisions||canaryDecs.data||[];
    if(Array.isArray(cds)&&cds.length){
      cdEl.innerHTML=cds.slice(0,5).map(function(d){
        return '<div class="deal-row"><div style="color:#e8f4ff;font-size:12px;">'+escHtml(d.canaryId||d.id||'Canary')+'</div>'
          +'<div><span class="badge '+(d.action==='promote'?'badge-cyan':d.action==='rollback'?'badge-purple':'')+'">'+escHtml(d.action||'—')+'</span></div></div>';
      }).join('');
    } else {
      cdEl.innerHTML='<div style="color:#7090b0;">No canary decisions.</div>';
    }
  }
  var svEl=document.getElementById('sys-shadow-variants');
  if(svEl){
    var svs=shadow.variants||shadow.data||[];
    if(Array.isArray(svs)&&svs.length){
      svEl.innerHTML=svs.slice(0,5).map(function(v){
        return '<div class="deal-row"><div><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(v.name||v.id||'Variant')+'</div></div>'
          +'<div><span class="badge '+(v.status==='promoted'?'badge-cyan':v.status==='rejected'?'badge-purple':'')+'">'+escHtml(v.status||'testing')+'</span></div></div>';
      }).join('');
    } else {
      svEl.innerHTML='<div style="color:#7090b0;">No shadow variants.</div>';
    }
  }
  var expEl=document.getElementById('sys-experiments');
  if(expEl){
    var exps=experiments.experiments||experiments.data||[];
    if(Array.isArray(exps)&&exps.length){
      expEl.innerHTML=exps.slice(0,5).map(function(e){
        return '<div class="deal-row"><div><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(e.name||e.id||'Experiment')+'</div>'
          +'<div style="font-size:11px;color:#7090b0;">Traffic: '+(e.trafficSplit||50)+'%</div></div>'
          +'<div><span class="badge '+(e.status==='running'?'badge-cyan':'')+'">'+escHtml(e.status||'idle')+'</span>'
          +'<button class="btn btn-ghost btn-sm" style="margin-left:4px;" onclick="evaluateExperiment(\\''+escAttr(String(e.id||''))+'\\')">Eval</button></div></div>';
      }).join('');
    } else {
      expEl.innerHTML='<div style="color:#7090b0;">No experiments.</div>';
    }
  }
  var pmEl=document.getElementById('sys-profit-metrics');
  if(pmEl){
    var pm=profitMetrics.metrics||profitMetrics.data||profitMetrics||{};
    pmEl.innerHTML=Object.keys(pm).slice(0,6).map(function(k){
      return '<div class="deal-row"><div style="color:#e8f4ff;font-size:12px;">'+escHtml(k)+'</div><div class="green">'+escHtml(String(pm[k]))+'</div></div>';
    }).join('')||'<div style="color:#7090b0;">No profit metrics yet.</div>';
  }
}

async function adminControlPlaneRollback(){
  var reason=prompt('Rollback reason:');
  if(!reason) return;
  var r=await api('POST','/api/control-plane/rollback',{reason:reason},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Rollback initiated!','ok');
  loadAdminSystem();
}

async function adminRegisterCanary(){
  var name=prompt('Canary deployment name:');
  if(!name) return;
  var r=await api('POST','/api/canary/register',{name:name,description:'New canary deployment'},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Canary registered!','ok');
  loadAdminSystem();
}

async function adminRegisterShadow(){
  var name=prompt('Shadow variant name:');
  if(!name) return;
  var r=await api('POST','/api/shadow/register',{name:name,description:'Shadow test variant'},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Shadow variant registered!','ok');
  loadAdminSystem();
}

async function adminAddExperiment(){
  var name=prompt('Experiment name:');
  if(!name) return;
  var split=prompt('Traffic split % for variant B (default 50):') || '50';
  var r=await api('POST','/api/experiments',{name:name,trafficSplit:parseInt(split)||50},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Experiment created!','ok');
  loadAdminSystem();
}

async function evaluateExperiment(id){
  var r=await api('POST','/api/experiments/'+id+'/evaluate',{},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Experiment evaluated!','ok');
  loadAdminSystem();
}

// ================================================================
// ADMIN CRM ENHANCEMENTS
// ================================================================
async function loadAdminCRM(){
  var [deals,leads,affiliateStats,allReferrals,mktIntel]=await Promise.all([
    api('GET','/api/bd/deals',null,true).catch(function(){return {};}),
    api('GET','/api/bd/leads',null,true).catch(function(){return {};}),
    api('GET','/api/partners/affiliate/stats',null,true).catch(function(){return {};}),
    api('GET','/api/admin/referrals/all',null,true).catch(function(){return {};}),
    api('GET','/api/marketplace/intelligence').catch(function(){return {};})
  ]);
  var dealList=(deals.deals||deals.data||deals||[]);
  var leadList=(leads.leads||leads.data||leads||[]);
  if(!Array.isArray(dealList)) dealList=[];
  if(!Array.isArray(leadList)) leadList=[];
  var dealsEl=document.getElementById('crm-deals-list');
  if(dealsEl){
    dealsEl.innerHTML=dealList.length?dealList.map(function(d){
      var stage=(d.stage||'lead').toLowerCase();
      return '<div class="deal-row">'
        +'<div><div style="font-weight:700;color:#e8f4ff;font-size:13px;">'+escHtml(d.company||d.name||'Deal')+'</div>'
        +'<div style="font-size:12px;color:#7090b0;margin-top:2px;">'+escHtml(d.notes||d.description||'')+'</div></div>'
        +'<div style="display:flex;gap:8px;align-items:center;">'
        +(d.value?'<div style="font-family:Orbitron,monospace;color:#00ffa3;font-size:13px;">$'+Number(d.value).toLocaleString()+'</div>':'')
        +'<span class="deal-stage '+escAttr(stage)+'">'+escHtml(stage)+'</span>'
        +'</div></div>';
    }).join(''):'<div style="padding:16px;text-align:center;color:#7090b0;font-size:13px;">No deals yet. Add your first deal!</div>';
  }
  var leadsEl=document.getElementById('crm-leads-list');
  if(leadsEl){
    leadsEl.innerHTML=leadList.length?leadList.slice(0,10).map(function(l){
      return '<div class="deal-row">'
        +'<div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(l.name||l.company||'Lead')+'</div>'
        +'<div style="font-size:12px;color:#7090b0;">'+escHtml(l.email||l.contact||'')+'</div></div>'
        +'<div style="font-size:11px;color:#7090b0;">'+(l.createdAt?new Date(l.createdAt).toLocaleDateString():'—')+'</div>'
        +'</div>';
    }).join(''):'<div style="padding:10px 0;color:#7090b0;font-size:13px;">No leads yet.</div>';
  }
  var affEl=document.getElementById('crm-affiliate-stats');
  if(affEl){
    var aff=affiliateStats.stats||affiliateStats.data||affiliateStats||{};
    affEl.innerHTML=Object.keys(aff).slice(0,8).map(function(k){
      return '<div class="deal-row"><div style="color:#e8f4ff;">'+escHtml(k)+'</div><div class="cyan">'+escHtml(String(aff[k]))+'</div></div>';
    }).join('')||'<div style="color:#7090b0;">No affiliate stats.</div>';
  }
  var refEl=document.getElementById('crm-all-referrals');
  if(refEl){
    var refs=allReferrals.referrals||allReferrals.data||[];
    if(!Array.isArray(refs)) refs=[];
    refEl.innerHTML=refs.length?refs.slice(0,10).map(function(r){
      return '<div class="deal-row"><div><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(r.code||r.id||'Referral')+'</div>'
        +'<div style="font-size:11px;color:#7090b0;">'+escHtml(r.referredEmail||r.email||'')+'</div></div>'
        +'<div style="font-size:12px;color:#00ffa3;">'+escHtml(String(r.reward||r.credits||0))+'</div></div>';
    }).join(''):'<div style="color:#7090b0;">No referrals yet.</div>';
  }
  var mktEl=document.getElementById('crm-mkt-intelligence');
  if(mktEl){
    var mi=mktIntel.intelligence||mktIntel.data||mktIntel||{};
    mktEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:100px;">'+escHtml(JSON.stringify(mi,null,2))+'</pre>';
  }
}

async function adminStartOnboarding(){
  var company=document.getElementById('onboard-company-inp').value.trim();
  var r=await api('POST','/api/onboarding/start',{company:company||'New Company'});
  if(r.error){toast(r.error,'err');return;}
  toast('Onboarding started!','ok');
  var id=r.id||r.sessionId;
  if(id){
    var recs=await api('GET','/api/onboarding/recommendations/'+id);
    var d=document.getElementById('crm-onboarding');
    if(d){d.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(recs,null,2))+'</pre>';}
  }
}

// ================================================================
// ADMIN PRICING ENHANCEMENTS
// ================================================================
async function loadAdminPricing(){
  var [allPricing,adminTenants,creditsPlans,creditsUsers,billingPlans,healthScores,churnRisk]=await Promise.all([
    api('GET','/api/pricing/all').catch(function(){return {};}),
    api('GET','/api/admin/tenants',null,true).catch(function(){return {};}),
    api('GET','/api/credits/plans').catch(function(){return {};}),
    api('GET','/api/admin/credits/users',null,true).catch(function(){return {};}),
    api('GET','/api/billing/plans',null,true).catch(function(){return {};}),
    api('GET','/api/admin/health-scores',null,true).catch(function(){return {};}),
    api('GET','/api/admin/health-scores/churn-risk',null,true).catch(function(){return {};})
  ]);
  var pricingEl=document.getElementById('pricing-all-list');
  if(pricingEl){
    var items=allPricing.pricing||allPricing.data||allPricing||{};
    if(typeof items==='object'&&!Array.isArray(items)&&Object.keys(items).length){
      pricingEl.innerHTML=Object.keys(items).map(function(k){
        var v=items[k];
        var price=v.currentPrice||v.price||v.basePrice||v;
        var surge=v.surgeActive||v.isSurge||false;
        return '<div class="deal-row">'
          +'<div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(k)+'</div>'
          +(surge?'<span class="badge badge-purple" style="font-size:10px;">SURGE</span>':'')+'</div>'
          +'<div style="font-family:Orbitron,monospace;color:#00d4ff;">$'+escHtml(String(typeof price==='number'?price.toFixed(2):price))+'</div>'
          +'</div>';
      }).join('');
    } else if(Array.isArray(items)&&items.length){
      pricingEl.innerHTML=items.map(function(p){
        return '<div class="deal-row">'
          +'<div style="font-weight:600;color:#e8f4ff;">'+escHtml(p.name||p.id||'Service')+'</div>'
          +'<div style="font-family:Orbitron,monospace;color:#00d4ff;">$'+escHtml(String(p.price||p.currentPrice||0))+'</div>'
          +'</div>';
      }).join('');
    } else {
      pricingEl.innerHTML='<div style="color:#7090b0;">No pricing data available.</div>';
    }
  }
  var tenantsEl=document.getElementById('pricing-tenants-list');
  if(tenantsEl){
    var tList=adminTenants.tenants||adminTenants.data||adminTenants||[];
    if(!Array.isArray(tList)) tList=[];
    tenantsEl.innerHTML=tList.length?tList.map(function(t){
      return '<div class="deal-row">'
        +'<div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(t.name||t.subdomain||t.id||'Tenant')+'</div>'
        +'<div style="font-size:11px;color:#7090b0;">'+escHtml(t.subdomain||t.domain||'')+'</div></div>'
        +'<div><span class="badge badge-cyan">'+escHtml(t.plan||'enterprise')+'</span>'
        +'<button class="btn btn-ghost btn-sm" style="margin-left:4px;" onclick="updateTenantBranding(\\''+escAttr(String(t.id||''))+'\\')">🎨 Brand</button></div>'
        +'</div>';
    }).join(''):'<div style="color:#7090b0;">No white-label tenants yet. Enterprise plan required.</div>';
  }
  var cpEl=document.getElementById('adm-credits-plans');
  if(cpEl){
    var plans=creditsPlans.plans||creditsPlans.data||[];
    if(!Array.isArray(plans)) plans=Object.values(creditsPlans)||[];
    cpEl.innerHTML=plans.length?plans.map(function(p){
      return '<div class="deal-row"><div style="font-weight:600;color:#e8f4ff;">'+escHtml(p.name||p.id||'Plan')+'</div>'
        +'<div class="cyan">'+escHtml(String(p.credits||p.amount||0))+' credits</div></div>';
    }).join(''):'<div style="color:#7090b0;">No credit plans defined.</div>';
  }
  var cuEl=document.getElementById('adm-credits-users');
  if(cuEl){
    var cusers=creditsUsers.users||creditsUsers.data||[];
    if(!Array.isArray(cusers)) cusers=[];
    cuEl.innerHTML=cusers.length?cusers.slice(0,10).map(function(u){
      return '<div class="deal-row"><div style="font-size:12px;color:#e8f4ff;">'+escHtml(u.email||u.id||'User')+'</div>'
        +'<div class="green">'+escHtml(String(u.credits||u.balance||0))+' credits</div></div>';
    }).join(''):'<div style="color:#7090b0;">No credit usage data.</div>';
  }
  var bpEl=document.getElementById('adm-billing-plans');
  if(bpEl){
    var bplans=billingPlans.plans||billingPlans.data||[];
    if(!Array.isArray(bplans)) bplans=[];
    bpEl.innerHTML=bplans.length?bplans.map(function(p){
      return '<div class="deal-row"><div style="font-weight:600;color:#e8f4ff;">'+escHtml(p.name||p.id||'Plan')+'</div>'
        +'<div><span class="badge">'+escHtml(String(p.priceMonthly||p.price||0))+'/mo</span></div></div>';
    }).join(''):'<div style="color:#7090b0;">No billing plans.</div>';
  }
  var hsEl=document.getElementById('adm-health-scores');
  if(hsEl){
    var scores=healthScores.scores||healthScores.data||[];
    if(!Array.isArray(scores)) scores=[];
    hsEl.innerHTML=scores.length?scores.slice(0,8).map(function(s){
      var score=s.score||s.healthScore||0;
      var cls=score>=80?'green':score>=50?'cyan':'';
      return '<div class="deal-row"><div style="font-size:12px;color:#e8f4ff;">'+escHtml(s.email||s.userId||'User')+'</div>'
        +'<div class="'+cls+'">'+escHtml(String(score))+'</div></div>';
    }).join(''):'<div style="color:#7090b0;">No health scores.</div>';
  }
  var crEl=document.getElementById('adm-churn-risk');
  if(crEl){
    var churn=churnRisk.users||churnRisk.data||[];
    if(!Array.isArray(churn)) churn=[];
    crEl.innerHTML=churn.length?'<div style="color:#ff6060;font-weight:600;margin-bottom:6px;">⚠️ Churn Risk Users</div>'
      +churn.slice(0,5).map(function(u){
        return '<div class="deal-row"><div style="font-size:12px;color:#e8f4ff;">'+escHtml(u.email||u.userId||'User')+'</div>'
          +'<div style="color:#ff6060;">'+escHtml(String(u.churnRisk||u.risk||'High'))+'</div></div>';
      }).join(''):'';
  }
}

async function adminAddWebhook(){
  var url=prompt('Webhook URL:');
  if(!url) return;
  var r=await api('POST','/api/platform/webhooks',{url:url,events:['payment','subscription']},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Webhook added!','ok');
  loadAdminPricing();
}

async function updateTenantBranding(tenantId){
  var primaryColor=prompt('Primary color (hex, e.g. #00d4ff):') || '#00d4ff';
  var logo=prompt('Logo URL (optional):') || '';
  var r=await api('PUT','/api/tenants/'+tenantId+'/branding',{primaryColor:primaryColor,logo:logo||undefined},true);
  if(r.error){toast(r.error,'err');return;}
  toast('Tenant branding updated!','ok');
  loadAdminPricing();
}

// ================================================================
// DASHBOARD LABS TAB
// ================================================================
async function loadDashLabs(){
  if(!isLoggedIn()){switchDashTab('overview');return;}
  var el=document.getElementById('labs-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div></div>';
  var [carbonStats,blockchainStats,energyStats]=await Promise.all([
    api('GET','/api/carbon/stats').catch(function(){return {};}),
    api('GET','/api/blockchain/stats').catch(function(){return {};}),
    api('GET','/api/energy/stats').catch(function(){return {};})
  ]);
  var u=STATE.user||{};
  el.innerHTML=
  // Carbon Exchange
  '<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">🌱 Carbon Exchange</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
  +'<button class="btn btn-primary btn-sm" onclick="openCarbonModal(\\'issue\\')">Issue Credits</button>'
  +'<button class="btn btn-outline btn-sm" onclick="openCarbonModal(\\'trade\\')">Trade</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="openCarbonModal(\\'portfolio\\')">Portfolio</button>'
  +'</div>'
  +'<div id="carbon-stats-disp" style="font-size:12px;color:#7090b0;">'
  +renderKVObj(carbonStats.stats||carbonStats.data||carbonStats)
  +'</div></div>'
  // Blockchain
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">⛓️ Quantum Blockchain</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
  +'<button class="btn btn-primary btn-sm" onclick="openBlockchainModal()">New Transaction</button>'
  +'<button class="btn btn-outline btn-sm" onclick="mineBlock()">⛏️ Mine Block</button>'
  +'</div>'
  +'<div id="blockchain-stats-disp" style="font-size:12px;color:#7090b0;">'
  +renderKVObj(blockchainStats.stats||blockchainStats.data||blockchainStats)
  +'</div></div>'
  // Energy Grid
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">⚡ Energy Grid</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
  +'<button class="btn btn-primary btn-sm" onclick="openEnergyModal(\\'producer\\')">Register Producer</button>'
  +'<button class="btn btn-outline btn-sm" onclick="openEnergyModal(\\'consumer\\')">Register Consumer</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="openEnergyModal(\\'optimize\\')">⚡ Optimize</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="openEnergyModal(\\'trade\\')">Trade Energy</button>'
  +'</div>'
  +'<div id="energy-stats-disp" style="font-size:12px;color:#7090b0;">'
  +renderKVObj(energyStats.stats||energyStats.data||energyStats)
  +'</div></div>'
  // Digital Identity
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">🪪 Digital Identity (QR)</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
  +'<button class="btn btn-primary btn-sm" onclick="createDigitalIdentity()">Create Identity</button>'
  +'<button class="btn btn-outline btn-sm" onclick="openIdentitySignModal()">Sign Document</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="openIdentityVerifyModal()">Verify</button>'
  +'</div>'
  +'<div id="identity-result" style="font-size:12px;color:#00ffa3;word-break:break-all;"></div>'
  +'</div>'
  // Blueprint
  +'<div class="card">'
  +'<div class="dash-section-title">📋 Business Blueprint Generator</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
  +'<input class="inp-field" type="text" id="blueprint-idea-inp" placeholder="Your business idea..." style="flex:1;min-width:140px;"/>'
  +'<button class="btn btn-primary btn-sm" onclick="generateBlueprint()">Generate Blueprint</button>'
  +'</div>'
  +'<div id="blueprint-list" style="font-size:12px;color:#7090b0;"></div>'
  +'</div>';
  loadBlueprintList();
}

function renderKVObj(obj){
  if(!obj||typeof obj!=='object') return '<div style="color:#7090b0;">No data yet.</div>';
  var keys=Object.keys(obj);
  if(!keys.length) return '<div style="color:#7090b0;">No data yet.</div>';
  return keys.slice(0,8).map(function(k){
    return '<div class="deal-row"><div style="color:#e8f4ff;">'+escHtml(k)+'</div><div class="cyan">'+escHtml(String(obj[k]))+'</div></div>';
  }).join('');
}

async function openCarbonModal(type){
  if(type==='issue'){
    var amount=prompt('Amount of carbon credits to issue:');
    if(!amount) return;
    var r=await api('POST','/api/carbon/issue',{amount:parseFloat(amount)||1,vintage:new Date().getFullYear()});
    toast(r.error?r.error:'Carbon credits issued!',r.error?'err':'ok');
  } else if(type==='trade'){
    var to=prompt('Recipient address:');
    var amt=prompt('Amount to trade:');
    if(!to||!amt) return;
    var r=await api('POST','/api/carbon/trade',{to:to,amount:parseFloat(amt)||1});
    toast(r.error?r.error:'Trade initiated!',r.error?'err':'ok');
  } else if(type==='portfolio'){
    var owner=(STATE.user&&STATE.user.id)||'me';
    var r=await api('GET','/api/carbon/portfolio/'+owner);
    var d=document.getElementById('carbon-stats-disp');
    if(d) d.innerHTML=renderKVObj(r.portfolio||r.data||r);
  }
}

async function openBlockchainModal(){
  var to=prompt('Recipient address:');
  var amount=prompt('Amount:');
  var data=prompt('Data (optional):') || '';
  if(!to||!amount) return;
  var r=await api('POST','/api/blockchain/transaction',{to:to,amount:parseFloat(amount)||1,data:data});
  toast(r.error?r.error:'Transaction submitted!',r.error?'err':'ok');
}

async function mineBlock(){
  var r=await api('POST','/api/blockchain/mine',{});
  toast(r.error?r.error:'Block mined!',r.error?'err':'ok');
  if(!r.error){
    var r2=await api('GET','/api/blockchain/stats');
    var d=document.getElementById('blockchain-stats-disp');
    if(d) d.innerHTML=renderKVObj(r2.stats||r2.data||r2);
  }
}

async function openEnergyModal(type){
  if(type==='producer'){
    var capacity=prompt('Energy capacity (kWh):');
    if(!capacity) return;
    var r=await api('POST','/api/energy/producer',{capacity:parseFloat(capacity)||100,source:'solar'});
    toast(r.error?r.error:'Producer registered!',r.error?'err':'ok');
  } else if(type==='consumer'){
    var demand=prompt('Energy demand (kWh):');
    if(!demand) return;
    var r=await api('POST','/api/energy/consumer',{demand:parseFloat(demand)||50});
    toast(r.error?r.error:'Consumer registered!',r.error?'err':'ok');
  } else if(type==='optimize'){
    var r=await api('POST','/api/energy/optimize',{});
    toast(r.error?r.error:'Grid optimized!',r.error?'err':'ok');
  } else if(type==='trade'){
    var amount=prompt('Energy amount to trade (kWh):');
    if(!amount) return;
    var r=await api('POST','/api/energy/trade',{amount:parseFloat(amount)||10,price:0.12});
    toast(r.error?r.error:'Energy traded!',r.error?'err':'ok');
  }
}

async function createDigitalIdentity(){
  var name=(STATE.user&&STATE.user.name)||'Zeus User';
  var r=await api('POST','/api/identity/create',{name:name,email:(STATE.user&&STATE.user.email)||''});
  var d=document.getElementById('identity-result');
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'<span>✅ Identity created! DID: '+escHtml(r.did||r.id||JSON.stringify(r))+'</span>';}
}

async function openIdentitySignModal(){
  var docHash=prompt('Document hash to sign:');
  if(!docHash) return;
  var r=await api('POST','/api/identity/sign',{hash:docHash});
  toast(r.error?r.error:'Document signed!',r.error?'err':'ok');
  var d=document.getElementById('identity-result');
  if(d&&!r.error) d.innerHTML='✅ Signature: '+escHtml(r.signature||JSON.stringify(r));
}

async function openIdentityVerifyModal(){
  var docHash=prompt('Document hash to verify:');
  var sig=prompt('Signature:');
  if(!docHash||!sig) return;
  var r=await api('POST','/api/identity/verify',{hash:docHash,signature:sig});
  toast(r.error?r.error:(r.valid?'✅ Valid signature!':'❌ Invalid signature'),r.error||!r.valid?'err':'ok');
}

async function generateBlueprint(){
  var idea=document.getElementById('blueprint-idea-inp').value.trim();
  if(!idea){toast('Enter a business idea','err');return;}
  var d=document.getElementById('blueprint-list');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/blueprint/generate',{idea:idea,industry:'tech'});
  if(r.error){toast(r.error,'err');if(d)d.innerHTML='<span style="color:#ff6060;">'+escHtml(r.error)+'</span>';return;}
  toast('Blueprint generated!','ok');
  loadBlueprintList();
}

async function loadBlueprintList(){
  var d=document.getElementById('blueprint-list');
  if(!d) return;
  var r=await api('GET','/api/blueprint/list');
  var list=r.blueprints||r.data||[];
  if(!Array.isArray(list)) list=[];
  d.innerHTML=list.length?list.slice(0,5).map(function(b){
    return '<div class="deal-row"><div><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(b.title||b.idea||b.id||'Blueprint')+'</div>'
      +'<div style="font-size:11px;color:#7090b0;">'+(b.createdAt?new Date(b.createdAt).toLocaleDateString():'')+'</div></div>'
      +'<button class="btn btn-ghost btn-sm" onclick="viewBlueprint(\\''+escAttr(String(b.id||''))+'\\')">View</button></div>';
  }).join(''):'<div style="color:#7090b0;margin-top:8px;">No blueprints yet. Generate your first one!</div>';
}

async function viewBlueprint(id){
  var r=await api('GET','/api/blueprint/'+id);
  var bp=r.blueprint||r.data||r;
  var text=bp.content||bp.plan||bp.description||JSON.stringify(bp,null,2);
  alert(text.slice(0,1000));
}

// ================================================================
// DASHBOARD ENTERPRISE TAB
// ================================================================
async function loadDashEnterprise(){
  if(!isLoggedIn()){switchDashTab('overview');return;}
  var el=document.getElementById('enterprise-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div></div>';
  var [wfStats,maStats,legalStats,compStats,riskStats,repStats]=await Promise.all([
    api('GET','/api/workforce/stats').catch(function(){return {};}),
    api('GET','/api/ma/stats').catch(function(){return {};}),
    api('GET','/api/legal/stats').catch(function(){return {};}),
    api('GET','/api/compliance/stats').catch(function(){return {};}),
    api('GET','/api/risk/stats').catch(function(){return {};}),
    api('GET','/api/reputation/stats').catch(function(){return {};})
  ]);
  el.innerHTML=
  // Workforce
  '<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">👥 AI Workforce</div>'
  +'<div id="wf-agents-list" style="font-size:12px;color:#7090b0;margin-bottom:10px;">'+renderKVObj(wfStats.stats||wfStats.data||wfStats)+'</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="loadWorkforceAgents()">View Agents</button>'
  +'<button class="btn btn-outline btn-sm" onclick="deployWorkforceAgent()">Deploy Agent</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="submitWorkforceJob()">Submit Job</button>'
  +'</div></div>'
  // M&A Advisor
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">🤝 M&A Advisor <span class="badge badge-purple" style="font-size:10px;margin-left:6px;">PRO</span></div>'
  +'<div id="ma-detail" style="font-size:12px;color:#7090b0;margin-bottom:10px;">'+renderKVObj(maStats.stats||maStats.data||maStats)+'</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="findMaTargets()">Find Targets</button>'
  +'<button class="btn btn-outline btn-sm" onclick="startMaNegotiation()">Negotiate</button>'
  +'</div></div>'
  // Legal
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">⚖️ Legal Contracts <span class="badge" style="font-size:10px;margin-left:6px;">STARTER+</span></div>'
  +'<div id="legal-detail" style="font-size:12px;color:#7090b0;margin-bottom:10px;">'+renderKVObj(legalStats.stats||legalStats.data||legalStats)+'</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<input class="inp-field" type="text" id="legal-type-inp" placeholder="Contract type (NDA/SaaS/...)..." style="flex:1;min-width:120px;"/>'
  +'<button class="btn btn-primary btn-sm" onclick="generateLegalContract()">Generate</button>'
  +'<button class="btn btn-outline btn-sm" onclick="analyzeLegalContract()">Analyze</button>'
  +'</div>'
  +'<div id="legal-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>'
  +'</div>'
  // Compliance
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">✅ Compliance Engine</div>'
  +'<div id="compliance-detail" style="font-size:12px;color:#7090b0;margin-bottom:10px;">'+renderKVObj(compStats.stats||compStats.data||compStats)+'</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<input class="inp-field" type="text" id="compliance-domain-inp" placeholder="Domain (GDPR/SOC2/...)..." style="flex:1;min-width:120px;"/>'
  +'<button class="btn btn-primary btn-sm" onclick="runComplianceCheck()">Check</button>'
  +'<button class="btn btn-outline btn-sm" onclick="loadComplianceReport()">Report</button>'
  +'</div>'
  +'<div id="compliance-result" style="font-size:12px;color:#00d4ff;margin-top:8px;"></div>'
  +'</div>'
  // Risk
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">⚠️ Risk Analyzer</div>'
  +'<div id="risk-detail" style="font-size:12px;color:#7090b0;margin-bottom:10px;">'+renderKVObj(riskStats.stats||riskStats.data||riskStats)+'</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<input class="inp-field" type="text" id="risk-domain-inp" placeholder="Risk domain..." style="flex:1;min-width:120px;"/>'
  +'<button class="btn btn-primary btn-sm" onclick="analyzeRisk()">Analyze</button>'
  +'<button class="btn btn-outline btn-sm" onclick="loadRiskHistory()">History</button>'
  +'</div>'
  +'<div id="risk-result" style="font-size:12px;color:#00d4ff;margin-top:8px;"></div>'
  +'</div>'
  // Reputation
  +'<div class="card">'
  +'<div class="dash-section-title">⭐ Reputation Protocol</div>'
  +'<div id="reputation-detail" style="font-size:12px;color:#7090b0;margin-bottom:10px;">'+renderKVObj(repStats.stats||repStats.data||repStats)+'</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="registerReputation()">Register Entity</button>'
  +'<button class="btn btn-outline btn-sm" onclick="loadTopReputation()">Top List</button>'
  +'</div>'
  +'<div id="reputation-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>'
  +'</div>';
}

async function loadWorkforceAgents(){
  var r=await api('GET','/api/workforce/agents');
  var agents=r.agents||r.data||[];
  var d=document.getElementById('wf-agents-list');
  if(d){
    d.innerHTML=Array.isArray(agents)&&agents.length?agents.slice(0,6).map(function(a){
      return '<div class="deal-row"><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(a.name||a.id||'Agent')+'</div>'
        +'<span class="badge '+(a.status==='active'?'badge-cyan':'')+'">'+escHtml(a.status||'idle')+'</span></div>';
    }).join(''):'<div style="color:#7090b0;">No agents deployed.</div>';
  }
}

async function deployWorkforceAgent(){
  var name=prompt('Agent name:');
  var role=prompt('Agent role (e.g. sales/support/analysis):') || 'general';
  if(!name) return;
  var r=await api('POST','/api/workforce/agent',{name:name,role:role});
  toast(r.error?r.error:'Agent deployed!',r.error?'err':'ok');
  if(!r.error) loadWorkforceAgents();
}

async function submitWorkforceJob(){
  var task=prompt('Job task description:');
  var priority=prompt('Priority (1=high, 5=low):') || '3';
  if(!task) return;
  var r=await api('POST','/api/workforce/job',{task:task,priority:parseInt(priority)||3});
  toast(r.error?r.error:'Job submitted! Job ID: '+(r.jobId||r.id||'—'),r.error?'err':'ok');
}

async function findMaTargets(){
  var industry=prompt('Industry to find M&A targets:') || 'tech';
  var d=document.getElementById('ma-detail');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/ma/targets',{industry:industry,criteria:{minRevenue:1000000}});
  if(d) d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.targets||r.data||r);
}

async function startMaNegotiation(){
  var target=prompt('Target company name:');
  var value=prompt('Offer value ($):');
  if(!target) return;
  var r=await api('POST','/api/ma/negotiate',{target:target,offerValue:parseFloat(value)||1000000});
  toast(r.error?r.error:'Negotiation started!',r.error?'err':'ok');
}

async function generateLegalContract(){
  var type=document.getElementById('legal-type-inp').value||'NDA';
  var d=document.getElementById('legal-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/legal/generate',{type:type,parties:['Company A','Company B']});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'✅ Contract: '+escHtml((r.contract||r.content||JSON.stringify(r)).slice(0,200))+'...';}
}

async function analyzeLegalContract(){
  var text=prompt('Paste contract text to analyze (first 500 chars):');
  if(!text) return;
  var d=document.getElementById('legal-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/legal/analyze',{text:text});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'📊 Analysis: '+escHtml((r.analysis||r.result||JSON.stringify(r)).slice(0,300));}
}

async function runComplianceCheck(){
  var domain=document.getElementById('compliance-domain-inp').value||'GDPR';
  var d=document.getElementById('compliance-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/compliance/check',{domain:domain,data:{}});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.result||r.data||r);}
}

async function loadComplianceReport(){
  var d=document.getElementById('compliance-result');
  var r=await api('GET','/api/compliance/report');
  if(d){d.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:120px;">'+escHtml(JSON.stringify(r.report||r.data||r,null,2))+'</pre>';}
}

async function analyzeRisk(){
  var domain=document.getElementById('risk-domain-inp').value||'operational';
  var d=document.getElementById('risk-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/risk/analyze',{domain:domain,factors:{}});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.analysis||r.data||r);}
}

async function loadRiskHistory(){
  var d=document.getElementById('risk-result');
  var r=await api('GET','/api/risk/history');
  if(d){d.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:100px;">'+escHtml(JSON.stringify(r.history||r.data||r,null,2))+'</pre>';}
}

async function registerReputation(){
  var name=(STATE.user&&STATE.user.name)||'My Entity';
  var r=await api('POST','/api/reputation/register',{name:name,type:'business'});
  var d=document.getElementById('reputation-result');
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'✅ Entity: '+escHtml(r.entityId||r.id||JSON.stringify(r));}
}

async function loadTopReputation(){
  var r=await api('GET','/api/reputation/top/list');
  var d=document.getElementById('reputation-result');
  var list=r.entities||r.data||[];
  if(!Array.isArray(list)) list=[];
  if(d){d.innerHTML=list.length?list.slice(0,5).map(function(e){
    return '<div class="deal-row"><div style="font-size:12px;color:#e8f4ff;">'+escHtml(e.name||e.entityId||'Entity')+'</div>'
      +'<div class="green">'+escHtml(String(e.score||e.reputation||0))+'</div></div>';
  }).join(''):'<div style="color:#7090b0;">No reputation data.</div>';}
}

// ================================================================
// DASHBOARD MARKETS TAB
// ================================================================
async function loadDashMarkets(){
  if(!isLoggedIn()){switchDashTab('overview');return;}
  var el=document.getElementById('markets-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div></div>';
  el.innerHTML=
  // Aviation
  '<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">✈️ Aviation Optimization</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="runAviationRouteOpt()">Optimize Routes</button>'
  +'<button class="btn btn-outline btn-sm" onclick="runAviationMaintenance()">Predictive Maintenance</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="runAviationPricing()">Dynamic Ticket Pricing</button>'
  +'</div>'
  +'<div id="aviation-result" style="font-size:12px;color:#00d4ff;margin-top:8px;"></div>'
  +'</div>'
  // Government
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">🏛️ Government Services AI</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="runGovCompliance()">Compliance Check</button>'
  +'<button class="btn btn-outline btn-sm" onclick="runGovDigitalize()">Digitalize Service</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="runGovPolicyAnalysis()">Analyze Policy</button>'
  +'</div>'
  +'<div id="government-result" style="font-size:12px;color:#00d4ff;margin-top:8px;"></div>'
  +'</div>'
  // Defense
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">🛡️ Defense & Security</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="runDefenseEncrypt()">Encrypt Data</button>'
  +'<button class="btn btn-outline btn-sm" onclick="runDefenseThreats()">Threat Analysis</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="runDefenseSecureInfra()">Secure Infrastructure</button>'
  +'</div>'
  +'<div id="defense-result" style="font-size:12px;color:#00d4ff;margin-top:8px;"></div>'
  +'</div>'
  // Telecom
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">📡 Telecom AI</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="runTelecomOptimize5g()">Optimize 5G</button>'
  +'<button class="btn btn-outline btn-sm" onclick="runTelecomPredictFailures()">Predict Failures</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="runTelecomRevenueAssurance()">Revenue Assurance</button>'
  +'</div>'
  +'<div id="telecom-result" style="font-size:12px;color:#00d4ff;margin-top:8px;"></div>'
  +'</div>'
  // Cross-border Payments
  +'<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">💸 Cross-Border Payments</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
  +'<input class="inp-field" type="number" id="cbp-amount-inp" placeholder="Amount..." style="width:100px;"/>'
  +'<select class="inp-field" id="cbp-currency-inp" style="width:100px;"><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option></select>'
  +'<input class="inp-field" type="text" id="cbp-dest-inp" placeholder="Destination country..." style="flex:1;"/>'
  +'</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="runCrossBorderPayment()">Send Payment</button>'
  +'<button class="btn btn-outline btn-sm" onclick="runFraudDetection()">Fraud Check</button>'
  +'<button class="btn btn-ghost btn-sm" onclick="runCardPayment()">Card Payment</button>'
  +'</div>'
  +'<div id="payments-result" style="font-size:12px;color:#00d4ff;margin-top:8px;"></div>'
  +'</div>'
  // Enterprise Partner
  +'<div class="card">'
  +'<div class="dash-section-title">🤝 Enterprise Partnership</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
  +'<input class="inp-field" type="text" id="partner-company-inp" placeholder="Company name..." style="flex:1;"/>'
  +'<input class="inp-field" type="text" id="partner-domain-inp" placeholder="Domain..." style="width:140px;"/>'
  +'</div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-primary btn-sm" onclick="registerEnterprise()">Register Enterprise</button>'
  +'</div>'
  +'<div id="enterprise-result" style="font-size:12px;color:#00ffa3;margin-top:8px;"></div>'
  +'</div>';
}

async function runAviationRouteOpt(){
  var d=document.getElementById('aviation-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/aviation/optimize-routes',{routes:[{from:'JFK',to:'LHR'},{from:'CDG',to:'SIN'}]});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.optimized||r.data||r);}
}
async function runAviationMaintenance(){
  var d=document.getElementById('aviation-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/aviation/predictive-maintenance',{aircraftId:'AC-'+Math.floor(Math.random()*1000)});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.maintenance||r.data||r);}
}
async function runAviationPricing(){
  var d=document.getElementById('aviation-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/aviation/ticket-pricing',{route:'JFK-LHR',date:new Date().toISOString().slice(0,10)});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.pricing||r.data||r);}
}
async function runGovCompliance(){
  var d=document.getElementById('government-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/government/compliance',{regulation:'GDPR',scope:'data-processing'});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.result||r.data||r);}
}
async function runGovDigitalize(){
  var service=prompt('Service to digitalize:') || 'Permit Application';
  var d=document.getElementById('government-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/government/digitalize-service',{service:service});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.result||r.data||r);}
}
async function runGovPolicyAnalysis(){
  var policy=prompt('Policy text to analyze (first 200 chars):') || 'National AI Strategy 2025';
  var d=document.getElementById('government-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/government/analyze-policy',{policy:policy});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.analysis||r.data||r);}
}
async function runDefenseEncrypt(){
  var data=prompt('Data to encrypt:') || 'sensitive-payload';
  var d=document.getElementById('defense-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/defense/encrypt',{data:data,level:'top-secret'});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'🔒 Encrypted: '+escHtml((r.encrypted||r.ciphertext||JSON.stringify(r)).slice(0,80))+'...';}
}
async function runDefenseThreats(){
  var d=document.getElementById('defense-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/defense/threats',{network:'corporate',timeframe:'24h'});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.threats||r.data||r);}
}
async function runDefenseSecureInfra(){
  var d=document.getElementById('defense-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/defense/secure-infrastructure',{systems:['web','db','api'],level:'high'});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.result||r.data||r);}
}
async function runTelecomOptimize5g(){
  var d=document.getElementById('telecom-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/telecom/optimize-5g',{region:'urban',towers:120});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.optimization||r.data||r);}
}
async function runTelecomPredictFailures(){
  var d=document.getElementById('telecom-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/telecom/predict-failures',{network:'5g-core',lookAhead:'7d'});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.predictions||r.data||r);}
}
async function runTelecomRevenueAssurance(){
  var d=document.getElementById('telecom-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/telecom/revenue-assurance',{period:'monthly'});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.assurance||r.data||r);}
}
async function runCrossBorderPayment(){
  var amount=parseFloat(document.getElementById('cbp-amount-inp').value)||100;
  var currency=(document.getElementById('cbp-currency-inp')||{}).value||'USD';
  var destination=(document.getElementById('cbp-dest-inp')||{}).value||'UK';
  var d=document.getElementById('payments-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/payments/cross-border',{amount:amount,currency:currency,destination:destination});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.payment||r.data||r);}
}
async function runFraudDetection(){
  var d=document.getElementById('payments-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/payments/fraud-detection',{transaction:{amount:9999,country:'NG',velocity:5}});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.result||r.data||r);}
}
async function runCardPayment(){
  var amount=parseFloat(document.getElementById('cbp-amount-inp').value)||100;
  var d=document.getElementById('payments-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/payments/card',{amount:amount,currency:'USD',last4:'4242'});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':renderKVObj(r.result||r.data||r);}
}
async function registerEnterprise(){
  var company=document.getElementById('partner-company-inp').value.trim();
  var domain=document.getElementById('partner-domain-inp').value.trim();
  if(!company){toast('Enter company name','err');return;}
  var d=document.getElementById('enterprise-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/enterprise/register',{company:company,domain:domain||'enterprise.com'});
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'✅ Partner ID: '+escHtml(r.partnerId||r.id||JSON.stringify(r));}
}

// ================================================================
// DASHBOARD TENANT TAB
// ================================================================
async function loadDashTenant(){
  if(!isLoggedIn()){switchDashTab('overview');return;}
  var el=document.getElementById('tenant-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div></div>';
  var r=await api('GET','/api/tenants/mine');
  var tenants=r.tenants||r.data||[];
  if(!Array.isArray(tenants)) tenants=[];
  el.innerHTML='<div class="card" style="margin-bottom:16px;">'
  +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'
  +'<div class="dash-section-title" style="margin:0;">💎 White-Label Tenants <span class="badge badge-purple" style="font-size:10px;margin-left:6px;">ENTERPRISE</span></div>'
  +'<button class="btn btn-primary btn-sm" onclick="createTenant()">+ Create Tenant</button>'
  +'</div>'
  +(tenants.length?tenants.map(function(t){
    return '<div class="deal-row">'
      +'<div><div style="font-weight:600;color:#e8f4ff;">'+escHtml(t.name||t.subdomain||t.id||'Tenant')+'</div>'
      +'<div style="font-size:11px;color:#7090b0;">'+escHtml(t.subdomain||t.domain||'')+'</div></div>'
      +'<div style="display:flex;gap:6px;align-items:center;">'
      +'<span class="badge badge-cyan">'+escHtml(t.plan||'enterprise')+'</span>'
      +'<button class="btn btn-ghost btn-sm" onclick="editTenantBranding(\\''+escAttr(String(t.id||''))+'\\')">🎨</button>'
      +'</div></div>';
  }).join(''):'<div style="text-align:center;padding:30px;color:#7090b0;">'
  +'<p>No tenants yet. Enterprise plan required.</p>'
  +'<p style="font-size:12px;margin-top:8px;">Create white-label instances of Zeus AI for your clients.</p>'
  +'</div>')
  +'</div>'
  +'<div class="card">'
  +'<div class="dash-section-title">Branding Preview</div>'
  +'<div id="tenant-branding-preview" style="color:#7090b0;font-size:13px;">Select a tenant to see branding.</div>'
  +'</div>';
}

async function createTenant(){
  var name=prompt('Tenant name:');
  var subdomain=prompt('Subdomain (e.g. client-co):');
  if(!name||!subdomain){toast('Name and subdomain required','err');return;}
  var r=await api('POST','/api/tenants',{name:name,subdomain:subdomain,plan:'enterprise'});
  if(r.error){toast(r.error,'err');return;}
  toast('Tenant created!','ok');
  loadDashTenant();
}

async function editTenantBranding(id){
  var color=prompt('Primary color (hex):') || '#00d4ff';
  var logo=prompt('Logo URL (optional):') || '';
  var r=await api('PUT','/api/tenants/'+id+'/branding',{primaryColor:color,logo:logo||undefined});
  if(r.error){toast(r.error,'err');return;}
  toast('Branding updated!','ok');
  var d=document.getElementById('tenant-branding-preview');
  if(d) d.innerHTML='<div style="display:flex;align-items:center;gap:12px;">'
    +(logo?'<picture>'+
      '<source srcset="'+escAttr(logo).replace(/\.(png|jpg|jpeg)/, '.webp')+'" type="image/webp">'+
      '<img src="'+escAttr(logo)+'" width="40" height="40" style="height:40px;" alt="Tenant logo preview" loading="lazy" decoding="async"/>'+
      '</picture>':'')
    +'<div style="width:40px;height:40px;border-radius:8px;background:'+escAttr(color)+';"></div>'
    +'<span style="color:#e8f4ff;">Preview: '+escHtml(color)+'</span>'
    +'</div>';
}

// ================================================================
// DASHBOARD HEALTH SCORE TAB
// ================================================================
async function loadDashHealthScore(){
  if(!isLoggedIn()){switchDashTab('overview');return;}
  var el=document.getElementById('healthscore-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div></div>';
  var r=await api('GET','/api/health-score/mine');
  var score=r.score||r.healthScore||r.data||{};
  var val=typeof score==='number'?score:(score.score||score.overall||0);
  var cls=val>=80?'green':val>=50?'cyan':'';
  el.innerHTML='<div class="card" style="margin-bottom:16px;text-align:center;">'
  +'<div class="dash-section-title">💊 Your Health Score</div>'
  +'<div class="kpi-val '+cls+'" style="font-size:60px;margin:20px 0;">'+val+'</div>'
  +'<div class="muted" style="font-size:13px;">'+(val>=80?'🟢 Excellent — keep it up!':val>=60?'🟡 Good — some room for improvement':val>=40?'🟠 Fair — take action to improve':'🔴 At risk — urgent attention needed')+'</div>'
  +'</div>'
  +'<div class="card">'
  +'<div class="dash-section-title">Score Breakdown</div>'
  +'<div style="font-size:12px;color:#7090b0;">'
  +(typeof score==='object'?renderKVObj(score):'<div style="color:#7090b0;">No breakdown available.</div>')
  +'</div>'
  +'<p class="muted" style="font-size:11px;margin-top:10px;">Health score is based on your platform activity, payment history, and feature usage.</p>'
  +'</div>';
}

// ================================================================
// DASHBOARD Q-PAY TAB
// ================================================================
async function loadDashQPay(){
  if(!isLoggedIn()){switchDashTab('overview');return;}
  var el=document.getElementById('qpay-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div></div>';
  el.innerHTML='<div class="card" style="margin-bottom:16px;">'
  +'<div class="dash-section-title">⚛️ Quantum Payment</div>'
  +'<p class="muted" style="font-size:13px;margin-bottom:16px;">Ultra-secure quantum-encrypted payment processing.</p>'
  +'<div class="inp-group"><label class="inp-label">Amount (USD)</label>'
  +'<input class="inp-field" type="number" id="qpay-amount" placeholder="e.g. 100" min="1"/></div>'
  +'<div class="inp-group"><label class="inp-label">Currency</label>'
  +'<select class="inp-field" id="qpay-currency"><option>USD</option><option>EUR</option><option>BTC</option></select></div>'
  +'<div class="inp-group"><label class="inp-label">Description</label>'
  +'<input class="inp-field" type="text" id="qpay-desc" placeholder="Payment description..."/></div>'
  +'<div id="qpay-msg"></div>'
  +'<button class="btn btn-primary" style="width:100%;margin-top:4px;" onclick="processQuantumPayment()">⚛️ Process Quantum Payment</button>'
  +'</div>'
  +'<div class="card">'
  +'<div class="dash-section-title">Quantum Payment History</div>'
  +'<div id="qpay-history" style="font-size:12px;color:#7090b0;"><div class="loader"></div></div>'
  +'</div>';
  loadQPayHistory();
}

async function processQuantumPayment(){
  var amount=parseFloat(document.getElementById('qpay-amount').value)||0;
  var currency=(document.getElementById('qpay-currency')||{}).value||'USD';
  var desc=(document.getElementById('qpay-desc')||{}).value||'Quantum payment';
  var msg=document.getElementById('qpay-msg');
  if(!amount){if(msg)msg.innerHTML='<div class="msg-err">Amount required.</div>';return;}
  if(msg) msg.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/quantum-payment/process',{amount:amount,currency:currency,description:desc});
  if(r.error){if(msg)msg.innerHTML='<div class="msg-err">'+escHtml(r.error)+'</div>';return;}
  if(msg) msg.innerHTML='<div class="msg-ok">✅ Payment ID: '+escHtml(r.paymentId||r.id||'—')+'</div>';
  toast('Quantum payment initiated!','ok');
  loadQPayHistory();
}

async function loadQPayHistory(){
  var d=document.getElementById('qpay-history');
  if(!d) return;
  var r=await api('GET','/api/quantum-payment/history',null,true).catch(function(){return {};});
  var hist=r.payments||r.history||r.data||[];
  if(!Array.isArray(hist)) hist=[];
  d.innerHTML=hist.length?hist.slice(0,8).map(function(p){
    return '<div class="deal-row">'
      +'<div><div style="font-weight:600;color:#e8f4ff;font-size:12px;">'+escHtml(p.description||p.id||'Payment')+'</div>'
      +'<div style="font-size:11px;color:#7090b0;">'+(p.createdAt?new Date(p.createdAt).toLocaleDateString():'—')+'</div></div>'
      +'<div><div class="green">'+escHtml(String(p.amount||'—'))+' '+escHtml(p.currency||'USD')+'</div>'
      +'<span class="badge '+(p.status==='confirmed'?'badge-cyan':p.status==='failed'?'badge-purple':'')+'">'+escHtml(p.status||'pending')+'</span></div>'
      +'</div>';
  }).join(''):'<div style="color:#7090b0;">No quantum payments yet.</div>';
}

// ================================================================
// ADMIN AUTONOMOUS TAB
// ================================================================
async function loadAdminAutonomous(){
  var [innovStatus,innovMetrics,revStatus,revMetrics,platStatus,orchStatus,healerStatus,selfConstr,totalHealer,pendPrs,innovLog]=await Promise.all([
    api('GET','/api/autonomous/innovation/status').catch(function(){return {};}),
    api('GET','/api/autonomous/innovation/metrics').catch(function(){return {};}),
    api('GET','/api/autonomous/revenue/status').catch(function(){return {};}),
    api('GET','/api/autonomous/revenue/metrics').catch(function(){return {};}),
    api('GET','/api/autonomous/platform/status').catch(function(){return {};}),
    api('GET','/api/orchestrator/status').catch(function(){return {};}),
    api('GET','/api/self-healer/status').catch(function(){return {};}),
    api('GET','/api/self-construction/status',null,true).catch(function(){return {};}),
    api('GET','/api/total-system-healer/status',null,true).catch(function(){return {};}),
    api('GET','/api/innovation-loop/pending-prs',null,true).catch(function(){return {};}),
    api('GET','/api/innovation-loop/log',null,true).catch(function(){return {};})
  ]);
  var innovOk=innovStatus.active||innovStatus.running||innovStatus.status==='active';
  setElText('auto-innov-status',innovOk?'🟢 Active':'⚪ Idle');
  var revOk=revStatus.active||revStatus.running||revStatus.status==='active';
  setElText('auto-rev-status',revOk?'🟢 Active':'⚪ Idle');
  var platOk=platStatus.active||platStatus.running||platStatus.status==='active';
  setElText('auto-platform-status',platOk?'🟢 Active':'⚪ Idle');
  var idEl=document.getElementById('auto-innov-detail');
  if(idEl){
    var im=innovMetrics.metrics||innovMetrics.data||innovMetrics||{};
    idEl.innerHTML=renderKVObj(im)||'<div style="color:#7090b0;">No metrics.</div>';
  }
  var rdEl=document.getElementById('auto-rev-detail');
  if(rdEl){
    var rm=revMetrics.metrics||revMetrics.data||revMetrics||{};
    rdEl.innerHTML=renderKVObj(rm)||'<div style="color:#7090b0;">No metrics.</div>';
  }
  var odEl=document.getElementById('auto-orchestrator-detail');
  if(odEl){
    odEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:100px;">'+escHtml(JSON.stringify(orchStatus,null,2))+'</pre>';
  }
  var hdEl=document.getElementById('auto-healer-status');
  if(hdEl){
    hdEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(healerStatus,null,2))+'</pre>';
  }
  var logEl=document.getElementById('auto-innov-log');
  if(logEl){
    var log=innovLog.log||innovLog.data||innovLog||[];
    if(Array.isArray(log)){
      logEl.innerHTML=log.slice(-10).reverse().map(function(l){
        return '<div style="border-bottom:1px solid rgba(0,200,255,.05);padding:3px 0;font-size:11px;color:#7090b0;">'+escHtml(typeof l==='string'?l:JSON.stringify(l))+'</div>';
      }).join('');
    } else {
      logEl.innerHTML='<pre>'+escHtml(JSON.stringify(log,null,2))+'</pre>';
    }
  }
  var ppEl=document.getElementById('auto-pending-prs');
  if(ppEl){
    var prs=pendPrs.prs||pendPrs.data||pendPrs||[];
    if(Array.isArray(prs)&&prs.length){
      ppEl.innerHTML=prs.slice(0,5).map(function(p){
        return '<div class="deal-row"><div style="font-size:12px;color:#e8f4ff;">'+escHtml(p.title||p.url||p)+'</div>'
          +'<a href="'+escAttr(p.url||'#')+'" target="_blank" class="btn btn-ghost btn-sm">View PR</a></div>';
      }).join('');
    } else {
      ppEl.innerHTML='<div style="color:#7090b0;">No pending PRs.</div>';
    }
  }
  var scEl=document.getElementById('auto-self-construction');
  if(scEl){
    scEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(selfConstr,null,2))+'</pre>';
  }
  var thEl=document.getElementById('auto-total-healer');
  if(thEl){
    thEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(totalHealer,null,2))+'</pre>';
  }
}

async function triggerAutoInnovation(){
  var r=await api('POST','/api/autonomous/innovation/trigger',{},true);
  toast(r.error?r.error:'Innovation triggered!',r.error?'err':'ok');
  loadAdminAutonomous();
}

async function optimizeAutoInnovation(){
  var r=await api('POST','/api/autonomous/innovation/optimize',{},true);
  toast(r.error?r.error:'Optimization started!',r.error?'err':'ok');
}

async function generateAutoDeals(){
  var r=await api('POST','/api/autonomous/revenue/generate-deals',{count:5},true);
  toast(r.error?r.error:'Deals generated!',r.error?'err':'ok');
  loadAdminAutonomous();
}

async function runOrchestratorCheck(){
  var r=await api('POST','/api/orchestrator/check',{},true);
  toast(r.error?r.error:'Orchestrator check complete!',r.error?'err':'ok');
  loadAdminAutonomous();
}

async function adminHealerRestart(){
  if(!confirm('Restart the self-healer?')) return;
  var r=await api('POST','/api/self-healer/restart',{},true);
  toast(r.error?r.error:'Healer restarted!',r.error?'err':'ok');
  loadAdminAutonomous();
}

async function adminHealerRedeploy(){
  if(!confirm('Trigger full redeploy?')) return;
  var r=await api('POST','/api/self-healer/redeploy',{},true);
  toast(r.error?r.error:'Redeploy triggered!',r.error?'err':'ok');
}

async function runSelfConstruction(){
  var r=await api('POST','/api/self-construction/run',{},true);
  toast(r.error?r.error:'Self-construction run started!',r.error?'err':'ok');
  loadAdminAutonomous();
}

async function runTotalHeal(){
  var r=await api('POST','/api/total-system-healer/heal',{},true);
  toast(r.error?r.error:'Total heal started!',r.error?'err':'ok');
  loadAdminAutonomous();
}

async function checkAllModules(){
  var r=await api('POST','/api/total-system-healer/check-modules',{},true);
  toast(r.error?r.error:'Module check complete!',r.error?'err':'ok');
  var d=document.getElementById('auto-total-healer');
  if(d) d.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(r,null,2))+'</pre>';
}

// ================================================================
// ADMIN MODULES TAB
// ================================================================
async function loadAdminModules(){
  // Fetch module registry first (public endpoint — no auth needed)
  var regData=await fetch('/api/module-registry').then(function(r){return r.json();}).catch(function(){return {};});
  var regTotalEl=document.getElementById('mod-registry-total');
  if(regTotalEl) regTotalEl.textContent=(regData.total||'—')+' modules';
  var regCatEl=document.getElementById('mod-registry-categories');
  if(regCatEl){
    var cats=regData.categories||{};
    var catEmoji={orchestrator:'🎛️',shield:'🛡️',healthDaemon:'💊',watchdog:'🐕',ai:'🤖',dynamic:'⚙️',engines:'🔧',generated:'🔮',internal:'🏠',external:'🌐'};
    regCatEl.innerHTML=Object.keys(cats).map(function(cat){
      var info=cats[cat];
      var count=info.count||0;
      var em=catEmoji[cat]||'📦';
      return '<div style="background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);border-radius:10px;padding:6px 12px;font-size:12px;color:#e8f4ff;">'
        +em+' <strong style="color:#00d4ff;">'+escHtml(cat)+'</strong><br/>'
        +'<span style="color:#7090b0;">'+count+' modules</span></div>';
    }).join('');
  }

  var [mlStatus,mlAvail,fcStatus,cfgStatus,revModStatus,qsecStatus,qintStatus,qvaultStatus,tempStatus,uacStatus,meshStatus,codeSanityStatus,trustStatus]=await Promise.all([
    api('GET','/api/module-loader/status',null,true).catch(function(){return {};}),
    api('GET','/api/module-loader/available',null,true).catch(function(){return {};}),
    api('GET','/api/future-compat/status').catch(function(){return {};}),
    api('GET','/api/config/status',null,true).catch(function(){return {};}),
    api('GET','/api/revenue-modules/status',null,true).catch(function(){return {};}),
    api('GET','/api/quantum-security/status').catch(function(){return {};}),
    api('GET','/api/quantum-integrity/status').catch(function(){return {};}),
    api('GET','/api/quantum-vault/status',null,true).catch(function(){return {};}),
    api('GET','/api/temporal-processor/status').catch(function(){return {};}),
    api('GET','/api/uac/status').catch(function(){return {};}),
    api('GET','/api/mesh/status').catch(function(){return {};}),
    api('GET','/api/code-sanity/status').catch(function(){return {};}),
    api('GET','/api/trust/status').catch(function(){return {};})
  ]);
  var mlEl=document.getElementById('mod-loader-status');
  if(mlEl) mlEl.innerHTML=renderKVObj(mlStatus.status||mlStatus.data||mlStatus);
  var mlListEl=document.getElementById('mod-loader-list');
  if(mlListEl){
    var avail=mlAvail.modules||mlAvail.data||[];
    if(Array.isArray(avail)&&avail.length){
      mlListEl.innerHTML=avail.map(function(m){
        var name=typeof m==='string'?m:(m.name||m.id||'module');
        return '<div class="deal-row"><div style="font-size:12px;color:#e8f4ff;">'+escHtml(name)+'</div>'
          +'<button class="btn btn-ghost btn-sm" onclick="adminReloadModule(\\''+escAttr(name)+'\\')">🔄</button></div>';
      }).join('');
    } else {
      mlListEl.innerHTML='<div style="color:#7090b0;">No modules listed.</div>';
    }
  }
  var fcEl=document.getElementById('mod-future-compat');
  if(fcEl) fcEl.innerHTML=renderKVObj(fcStatus.status||fcStatus.data||fcStatus);
  var cfgEl=document.getElementById('mod-config-status');
  if(cfgEl) cfgEl.innerHTML=renderKVObj(cfgStatus.status||cfgStatus.data||cfgStatus);
  var rmEl=document.getElementById('mod-rev-modules');
  if(rmEl){
    var rmTotal=await api('GET','/api/revenue-modules/total',null,true).catch(function(){return {};});
    rmEl.innerHTML=renderKVObj(revModStatus.status||revModStatus.data||revModStatus)
      +'<div class="deal-row" style="margin-top:8px;"><div style="color:#e8f4ff;">Total Revenue (Modules)</div><div class="green">$'+escHtml(String((rmTotal.total||rmTotal.revenue||0).toLocaleString()))+'</div></div>';
  }
  var qsEl=document.getElementById('mod-qsec-status');
  if(qsEl) qsEl.innerHTML=renderKVObj(qsecStatus.status||qsecStatus.data||qsecStatus);
  var qiEl=document.getElementById('mod-qintegrity-status');
  if(qiEl) qiEl.innerHTML=renderKVObj(qintStatus.status||qintStatus.data||qintStatus);
  var qihEl=document.getElementById('mod-qintegrity-history');
  if(qihEl){
    var hist=await api('GET','/api/quantum-integrity/history',null,true).catch(function(){return {};});
    var hl=hist.history||hist.data||[];
    qihEl.innerHTML=Array.isArray(hl)&&hl.length?hl.slice(0,5).map(function(h){
      return '<div style="font-size:11px;color:#7090b0;border-bottom:1px solid rgba(0,200,255,.05);padding:2px 0;">'+escHtml(JSON.stringify(h).slice(0,80))+'</div>';
    }).join(''):'<div style="color:#7090b0;font-size:11px;">No history.</div>';
  }
  var qvEl=document.getElementById('mod-qvault-status');
  if(qvEl) qvEl.innerHTML=renderKVObj(qvaultStatus.status||qvaultStatus.data||qvaultStatus);
  var tpEl=document.getElementById('mod-temporal-status');
  if(tpEl) tpEl.innerHTML=renderKVObj(tempStatus.status||tempStatus.data||tempStatus);
  var uacEl=document.getElementById('mod-uac-status');
  if(uacEl) uacEl.innerHTML=renderKVObj(uacStatus.status||uacStatus.data||uacStatus);
  var meshEl=document.getElementById('mod-mesh-status');
  if(meshEl) meshEl.innerHTML=renderKVObj(meshStatus.status||meshStatus.data||meshStatus);
  var meshLogEl=document.getElementById('mod-mesh-log');
  if(meshLogEl){
    var mlog=await api('GET','/api/mesh/log',null,true).catch(function(){return {};});
    meshLogEl.innerHTML='<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(mlog,null,2).slice(0,500))+'</pre>';
  }
  var csEl=document.getElementById('mod-code-sanity');
  if(csEl) csEl.innerHTML=renderKVObj(codeSanityStatus.status||codeSanityStatus.data||codeSanityStatus);
  var tEl=document.getElementById('mod-trust-status');
  if(tEl) tEl.innerHTML=renderKVObj(trustStatus.status||trustStatus.data||trustStatus);
  var tiEl=document.getElementById('mod-trust-incidents');
  if(tiEl){
    var incs=await api('GET','/api/trust/incidents').catch(function(){return {};});
    var incList=incs.incidents||incs.data||[];
    tiEl.innerHTML=Array.isArray(incList)&&incList.length?incList.slice(0,3).map(function(i){
      return '<div class="deal-row"><div style="font-size:12px;color:#e8f4ff;">'+escHtml(i.type||i.id||'Incident')+'</div>'
        +'<div style="font-size:11px;color:#7090b0;">'+(i.timestamp?new Date(i.timestamp).toLocaleDateString():'')+'</div></div>';
    }).join(''):'<div style="color:#7090b0;font-size:11px;">No incidents.</div>';
  }
}

async function adminReloadModule(name){
  var r=await api('POST','/api/module-loader/reload/'+encodeURIComponent(name),{},true);
  toast(r.error?r.error:'Module '+name+' reloaded!',r.error?'err':'ok');
}

async function runFutureCompatProcess(){
  var r=await api('POST','/api/future-compat/process',{},true);
  toast(r.error?r.error:'Future-compat processed!',r.error?'err':'ok');
  var d=document.getElementById('mod-future-compat');
  if(d) d.innerHTML=renderKVObj(r.result||r.data||r);
}

async function adminSetConfig(){
  var key=document.getElementById('cfg-key-inp').value.trim();
  var val=document.getElementById('cfg-val-inp').value.trim();
  if(!key){toast('Key required','err');return;}
  var r=await api('POST','/api/config/'+encodeURIComponent(key),{value:val},true);
  var d=document.getElementById('cfg-result');
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'✅ Set: '+escHtml(key)+' = '+escHtml(val);}
}

async function adminGetConfig(){
  var key=document.getElementById('cfg-key-inp').value.trim();
  if(!key){
    var r=await api('GET','/api/config/all-keys',null,true);
    var d=document.getElementById('cfg-result');
    if(d) d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'<pre style="font-size:11px;overflow:auto;max-height:80px;">'+escHtml(JSON.stringify(r.keys||r.data||r,null,2))+'</pre>';
    return;
  }
  var r=await api('GET','/api/config/'+encodeURIComponent(key),null,true);
  var d=document.getElementById('cfg-result');
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':''+escHtml(key)+': '+escHtml(String(r.value||r.data||JSON.stringify(r)));}
}

async function executeTradingRevenue(){
  var r=await api('POST','/api/revenue-modules/trading/execute',{amount:10000},true);
  toast(r.error?r.error:'Trading executed! Profit: $'+(r.profit||r.data||0),r.error?'err':'ok');
}

async function optimizeCloudRevenue(){
  var r=await api('POST','/api/revenue-modules/cloud/optimize',{},true);
  toast(r.error?r.error:'Cloud optimized! Savings: $'+(r.savings||r.data||0),r.error?'err':'ok');
}

async function runQuantumSecurityProcess(){
  var data=prompt('Data/payload to secure:') || 'test-payload';
  var r=await api('POST','/api/quantum-security/process',{data:data},true);
  toast(r.error?r.error:'Quantum security processed!',r.error?'err':'ok');
  var d=document.getElementById('mod-qsec-status');
  if(d&&!r.error) d.innerHTML=renderKVObj(r.result||r.data||r);
}

async function runQuantumIntegrityScan(){
  var r=await api('POST','/api/quantum-integrity/scan',{scope:'full'},true);
  toast(r.error?r.error:'Integrity scan complete!',r.error?'err':'ok');
  loadAdminModules();
}

async function adminVaultStore(){
  var key=document.getElementById('vault-key-inp').value.trim();
  var val=document.getElementById('vault-val-inp').value.trim();
  if(!key||!val){toast('Key and value required','err');return;}
  var r=await api('POST','/api/quantum-vault/store',{key:key,value:val},true);
  var d=document.getElementById('vault-result');
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'✅ Stored: '+escHtml(key);}
}

async function adminVaultRetrieve(){
  var key=document.getElementById('vault-key-inp').value.trim();
  if(!key){toast('Key required','err');return;}
  var r=await api('POST','/api/quantum-vault/retrieve',{key:key},true);
  var d=document.getElementById('vault-result');
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':'🔓 Value: '+escHtml(String(r.value||r.data||JSON.stringify(r)));}
}

async function adminVaultUnlock(){
  var pass=prompt('Vault master password:');
  if(!pass) return;
  var r=await api('POST','/api/quantum-vault/unlock',{password:pass},true);
  toast(r.error?r.error:'Vault unlocked!',r.error?'err':'ok');
}

async function runTemporalProcess(){
  var data=prompt('Data to process temporally:') || 'timeseries-event';
  var r=await api('POST','/api/temporal-processor/process',{data:data,timestamp:Date.now()},true);
  toast(r.error?r.error:'Temporal processing complete!',r.error?'err':'ok');
  var d=document.getElementById('mod-temporal-status');
  if(d&&!r.error) d.innerHTML=renderKVObj(r.result||r.data||r);
}

async function runUacCycle(){
  var r=await api('POST','/api/uac/cycle',{});
  toast(r.error?r.error:'UAC cycle complete!',r.error?'err':'ok');
}
async function runUacInnovate(){
  var r=await api('POST','/api/uac/innovate',{});
  toast(r.error?r.error:'UAC innovation triggered!',r.error?'err':'ok');
}
async function runUacOptimize(){
  var r=await api('POST','/api/uac/optimize',{});
  toast(r.error?r.error:'UAC optimization complete!',r.error?'err':'ok');
}

async function adminMeshSync(){
  var r=await api('POST','/api/mesh/sync',{},true);
  toast(r.error?r.error:'Mesh synced!',r.error?'err':'ok');
  loadAdminModules();
}

async function runCodeSanityScan(){
  var r=await api('POST','/api/code-sanity/scan',{},true);
  toast(r.error?r.error:'Code sanity scan started!',r.error?'err':'ok');
  var d=document.getElementById('mod-code-sanity');
  if(d&&!r.error) d.innerHTML=renderKVObj(r.result||r.data||r);
}

// ================================================================
// ADMIN ADVANCED TAB
// ================================================================
async function loadAdminAdvanced(){
  var [agiSt,sovSt,spaceSt,dtwinSt,neuralSt,qinetSt,qmlSt,tempDataSt]=await Promise.all([
    api('GET','/api/agi/status',null,true).catch(function(){return {};}),
    api('GET','/api/sovereign/status',null,true).catch(function(){return {};}),
    api('GET','/api/space-computing/status').catch(function(){return {};}),
    api('GET','/api/digital-twin/status').catch(function(){return {};}),
    api('GET','/api/neural-interface/status').catch(function(){return {};}),
    api('GET','/api/quantum-internet/status').catch(function(){return {};}),
    api('GET','/api/quantum-ml/status').catch(function(){return {};}),
    api('GET','/api/temporal-data/status').catch(function(){return {};})
  ]);
  var agiOk=agiSt.active||agiSt.status==='active'||agiSt.running;
  setElText('adv-agi-status',agiOk?'🟢 Online':'⚪ Offline');
  var sovOk=sovSt.active||sovSt.status==='active'||sovSt.secured;
  setElText('adv-sovereign-status',sovOk?'🔒 Secured':'⚠️ Open');
  var qmlOk=qmlSt.active||qmlSt.status==='active';
  setElText('adv-qml-status',qmlOk?'⚛️ Active':'⚪ Idle');
  function setDetail(id,data){
    var el=document.getElementById(id);
    if(el) el.innerHTML=renderKVObj(data.status||data.data||data);
  }
  setDetail('adv-agi-detail',agiSt);
  setDetail('adv-sovereign-detail',sovSt);
  setDetail('adv-space-detail',spaceSt);
  setDetail('adv-dtwin-detail',dtwinSt);
  setDetail('adv-neural-detail',neuralSt);
  setDetail('adv-qinternet-detail',qinetSt);
  setDetail('adv-qml-detail',qmlSt);
  setDetail('adv-temporal-detail',tempDataSt);
}

async function runAgiProcess(){
  var task=document.getElementById('agi-task-inp').value.trim()||'Analyze system performance';
  var d=document.getElementById('agi-result');
  if(d) d.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/agi/process',{task:task},true);
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':escHtml(String(r.result||r.response||r.output||JSON.stringify(r)).slice(0,300));}
}

async function adminSetupTotp(){
  var r=await api('POST','/api/sovereign/setup-totp',{},true);
  var d=document.getElementById('totp-result');
  if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>'
    :'✅ TOTP Secret: <span class="badge badge-cyan">'+escHtml(r.secret||r.data||'—')+'</span>'
    +(r.otpauthUrl?'<br/><small style="color:#7090b0;">URL: '+escHtml(r.otpauthUrl)+'</small>':'');}
}

function makeAdvancedRunner(apiPath,inputId,resultId,label){
  return async function(){
    var task=(document.getElementById(inputId)||{}).value||label;
    var d=document.getElementById(resultId);
    if(d) d.innerHTML='<div class="loader"></div>';
    var r=await api('POST',apiPath,{task:task},true);
    if(d){d.innerHTML=r.error?'<span style="color:#ff6060;">'+escHtml(r.error)+'</span>':escHtml(String(r.result||r.response||r.output||JSON.stringify(r)).slice(0,300));}
  };
}
var runSpaceProcess=makeAdvancedRunner('/api/space-computing/process','space-task-inp','space-result','compute-orbit');
var runDigitalTwinProcess=makeAdvancedRunner('/api/digital-twin/process','dtwin-task-inp','dtwin-result','sync-twin');
var runNeuralProcess=makeAdvancedRunner('/api/neural-interface/process','neural-task-inp','neural-result','neural-signal');
var runQuantumInternetProcess=makeAdvancedRunner('/api/quantum-internet/process','qinternet-task-inp','qinternet-result','qinternet-route');
var runQuantumMlProcess=makeAdvancedRunner('/api/quantum-ml/process','qml-task-inp','qml-result','classify');
var runTemporalDataProcess=makeAdvancedRunner('/api/temporal-data/process','temporaldata-task-inp','temporaldata-result','analyze-temporal');
function openCheckout(item){
  STATE.checkoutItem=item;
  var title=document.getElementById('checkout-title');
  if(title) title.textContent='Checkout: '+item.name;
  renderCheckoutStep1();
  openModal('checkout-modal');
}

function renderCheckoutStep1(){
  var body=document.getElementById('checkout-body');
  if(!body) return;
  var price=STATE.checkoutItem.priceUsd||0;
  var btcEq=usdToBtc(price);
  var methods=STATE.paymentMethodIds||['crypto_btc'];
  var showStripe=methods.indexOf('stripe')>=0||methods.indexOf('card')>=0;
  var showPaypal=methods.indexOf('paypal')>=0;
  var showNow=!!STATE.nowPaymentsReady;
  var buttons='';
  // Sovereign direct BTC (non-custodial, real on-chain settlement to owner wallet)
  buttons+='<button class="pay-method-btn pay-method-featured" onclick="checkoutSovereignBtc()" style="grid-column:1/-1;background:linear-gradient(135deg,#0a2818 0%,#0f4428 100%);border:1.5px solid #00ffa3;position:relative;"><div style="position:absolute;top:4px;right:6px;background:#00ffa3;color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;">DIRECT</div><div class="pay-method-icon">⚡</div><div style="font-weight:600;">Pay direct to BTC wallet</div><div style="font-size:10px;color:#7090b0;">Non-custodial · on-chain · instant access</div></button>';
  if(showNow){
    buttons+='<button class="pay-method-btn pay-method-featured" onclick="checkoutNowPayments()" style="grid-column:1/-1;background:linear-gradient(135deg,#0a1628 0%,#112244 100%);border:1.5px solid #00d4ff;position:relative;"><div style="position:absolute;top:4px;right:6px;background:#00d4ff;color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;">GLOBAL</div><div class="pay-method-icon">🌍</div><div style="font-weight:600;">Pay with Any Currency</div><div style="font-size:10px;color:#7090b0;">300+ crypto · cards · bank · worldwide → auto BTC</div></button>';
  }
  buttons+='<button class="pay-method-btn" onclick="checkoutBtc()"><div class="pay-method-icon">₿</div><div>Bitcoin</div><div style="font-size:10px;color:#7090b0;">BTC direct</div></button>';
  if(showStripe){
    buttons+='<button class="pay-method-btn" onclick="checkoutStripe()"><div class="pay-method-icon">💳</div><div>Card</div><div style="font-size:10px;color:#7090b0;">Stripe</div></button>';
  }
  if(showPaypal){
    buttons+='<button class="pay-method-btn" onclick="checkoutPaypal()"><div class="pay-method-icon">🅿️</div><div>PayPal</div><div style="font-size:10px;color:#7090b0;">Balance</div></button>';
  }
  body.innerHTML='<div style="text-align:center;margin-bottom:16px;">'
    +'<div style="font-size:28px;font-weight:700;font-family:Orbitron,monospace;color:#00d4ff;">$'+price+'</div>'
    +(btcEq!=='—'?'<div style="color:#7090b0;font-size:12px;font-family:monospace;">≈ '+btcEq+'</div>':'')
    +'</div>'
    +'<div style="font-size:13px;color:#7090b0;text-align:center;margin-bottom:12px;">Select payment method. Direct BTC settles to the owner wallet; configured providers appear automatically when live.</div>'
    +'<div class="card card-sm" style="margin-bottom:14px;text-align:left;"><div class="label">Checkout promise</div><p class="muted" style="font-size:12px;line-height:1.6;">Transparent amount · order ID generated · payment status tracked · access granted automatically after confirmation.</p></div>'
    +'<div class="pay-methods">'+buttons+'</div>';
}

// Sovereign direct-on-chain checkout: creates a REAL order bound to the owner's
// BTC wallet with a unique sat-amount for automatic matching. The buyer is
// navigated to /checkout/:orderId where a background watcher confirms payment
// (0-conf or N-conf configurable) and grants service access automatically.
// Fully non-custodial. All funds settle directly on-chain.
async function checkoutSovereignBtc(){
  var body=document.getElementById('checkout-body');
  var item=STATE.checkoutItem||{};
  body.innerHTML='<div style="text-align:center;margin-bottom:10px;"><div class="loader"></div><p class="muted" style="margin-top:8px;">Preparing non-custodial BTC checkout…</p></div>';
  try{
    var r=await fetch('/api/checkout/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceId:item.serviceId||item.id,qty:1,currency:'USD',email:(STATE.user&&STATE.user.email)||''})});
    var j=await r.json();
    if(!r.ok||!j||!j.checkout_url){
      body.innerHTML='<div style="color:#ff7070;text-align:center;padding:16px;">Could not create checkout.<br><small>'+escHtml(j&&j.error||('HTTP '+r.status))+'</small></div>';
      return;
    }
    window.location.href=j.checkout_url;
  }catch(e){
    body.innerHTML='<div style="color:#ff7070;text-align:center;padding:16px;">Network error.<br><small>'+escHtml(String(e))+'</small></div>';
  }
}

async function checkoutBtc(){
  var body=document.getElementById('checkout-body');
  var item=STATE.checkoutItem;
  var price=item.priceUsd||0;
  body.innerHTML='<div style="text-align:center;margin-bottom:10px;"><div class="loader"></div><p class="muted" style="margin-top:8px;">Generating secure BTC invoice and order ID...</p></div>';
  var created=await api('POST','/api/payment/create',{
    amount:price,
    currency:'USD',
    method:'crypto_btc',
    clientId:(STATE.user&&STATE.user.id)||'anonymous',
    description:item.name||'Unicorn AI Service',
    metadata:{serviceId:item.serviceId||item.id||'service'}
  });
  if(created.error||!created.walletAddress){
    body.innerHTML='<div style="text-align:center;padding:20px;"><div style="color:#ff6060;font-size:24px;">⚠️</div><p class="muted">'+escHtml(created.error||'Failed to create BTC payment')+'</p><button class="btn btn-ghost btn-sm" style="margin-top:12px;" onclick="renderCheckoutStep1()">← Back</button></div>';
    return;
  }
  STATE.checkoutPaymentTxId=created.txId||null;
  var addr=created.walletAddress;
  var btcAmount=(created.cryptoAmount!=null)?Number(created.cryptoAmount).toFixed(8):(STATE.btcRate>0?(price/STATE.btcRate).toFixed(8):'0.00100000');
  var qrData=await api('GET','/api/payment/btc-qr?address='+encodeURIComponent(addr)+'&amount='+encodeURIComponent(btcAmount));
  var qrSrc=qrData.qr||('https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=bitcoin:'+addr+'%3Famount%3D'+btcAmount);
  var seconds=1800;
  body.innerHTML='<div style="text-align:center;">'
    +'<picture>'+
      '<source srcset="'+escAttr(qrSrc).replace(/\.(png|jpg|jpeg)/, '.webp')+'" type="image/webp">'+
      '<img class="qr-img" src="'+escAttr(qrSrc)+'" width="160" height="160" alt="Bitcoin payment QR code" loading="lazy" decoding="async"/>'+
      '</picture>'
    +'<div class="countdown" id="pay-countdown"></div>'
    +(created.txId?'<div style="font-size:11px;color:#7090b0;margin:6px 0;">Order ID: <span style="font-family:monospace;">'+escHtml(created.txId)+'</span></div>':'')
    +'<div style="margin:8px 0;font-size:13px;color:#7090b0;">Send exactly:</div>'
    +'<div style="font-family:monospace;font-size:20px;font-weight:700;color:#00ffa3;">'+btcAmount+' BTC</div>'
    +'<div style="font-size:12px;color:#7090b0;margin:4px 0;">≈ $'+price+' USD</div>'
    +'<div style="font-size:12px;color:#7090b0;margin-bottom:4px;">To address:</div>'
    +'<div class="btc-addr" onclick="copyText(\\''+addr+'\\',this)" style="text-align:left;">'+addr+'</div>'
    +'<button class="btn btn-green" style="width:100%;margin-top:16px;" onclick="confirmBtcPayment()">✓ I\\'ve Sent the Payment</button>'
    +'<p class="muted" style="font-size:11px;line-height:1.5;margin-top:8px;">Keep this window open. The platform tracks the order and unlocks access after payment confirmation.</p>'
    +'<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;" onclick="renderCheckoutStep1()">← Back</button>'
    +'</div>';
  if(STATE.countdownTimer) clearInterval(STATE.countdownTimer);
  STATE.countdownTimer=setInterval(function(){
    seconds--;
    var el=document.getElementById('pay-countdown');
    if(!el){clearInterval(STATE.countdownTimer);return;}
    if(seconds<=0){clearInterval(STATE.countdownTimer);el.textContent='EXPIRED';return;}
    var m=Math.floor(seconds/60),s=seconds%60;
    el.textContent='⏱ '+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
  },1000);
}

// NOWPayments — Global: 300+ crypto + cards, auto-converts to BTC → owner wallet
async function checkoutNowPayments(){
  var body=document.getElementById('checkout-body');
  var item=STATE.checkoutItem;
  var price=item.priceUsd||0;
  body.innerHTML='<div style="text-align:center;padding:20px;"><div class="loader"></div><p class="muted" style="margin-top:8px;">Preparing global checkout...</p></div>';
  var r=await api('POST','/api/payment/nowpayments/create',{
    amountUsd:price,
    itemName:item.name||'Unicorn AI Service',
    itemId:item.serviceId||item.id||'service',
    clientId:(STATE.user&&STATE.user.id)||'guest',
    successUrl:window.location.origin+'/?payment=success',
    cancelUrl:window.location.origin+'/?payment=cancel'
  });
  if(r.error){
    body.innerHTML='<div style="text-align:center;padding:20px;"><div style="color:#ff6060;font-size:24px;">⚠️</div><p class="muted">'+escHtml(r.error)+'</p><button class="btn btn-ghost btn-sm" style="margin-top:12px;" onclick="renderCheckoutStep1()">← Back</button></div>';
    return;
  }
  // If we have a hosted invoice URL → redirect customer to NOWPayments checkout
  if(r.invoice_url){
    body.innerHTML='<div style="text-align:center;padding:20px;">'  
      +'<div style="font-size:36px;margin-bottom:8px;">🌍</div>'
      +'<div class="title-sm" style="margin-bottom:8px;">Global Checkout Ready</div>'
      +'<p class="muted" style="font-size:12px;margin-bottom:16px;">Choose your currency on the next page.<br/>ETH, USDT, SOL, XRP, card, and 300+ more options.<br/>Payment auto-converts to BTC — arrives in owner wallet.</p>'
      +'<a href="'+escAttr(r.invoice_url)+'" class="btn btn-primary" style="width:100%;display:block;text-align:center;">Open Checkout →</a>'
      +'<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;" onclick="renderCheckoutStep1()">← Back</button>'
      +'</div>';
    // Store payment ID to poll status
    if(r.id) STATE.nowPaymentsId=r.id;
    return;
  }
  // Fallback: no API key configured → show direct BTC
  if(r.fallback){
    toast('NOWPayments not yet configured — using direct BTC','');
    checkoutBtc();
  }
}

async function confirmBtcPayment(){
  var txId=STATE.checkoutPaymentTxId;
  var r=txId
    ? await api('POST','/api/payment/process/'+encodeURIComponent(txId),{approved:true,note:'Customer confirmed BTC transfer from checkout UI'})
    : {error:'Missing payment order. Please restart checkout.'};
  if(r.error){
    toast(r.error||'Could not confirm payment','err');
    var bodyErr=document.getElementById('checkout-body');
    if(bodyErr) bodyErr.innerHTML='<div style="text-align:center;padding:20px;"><div style="color:#ff6060;font-size:24px;">⚠️</div><p class="muted">'+escHtml(r.error||'Could not confirm payment')+'</p><button class="btn btn-ghost btn-sm" style="margin-top:12px;" onclick="renderCheckoutStep1()">← Back</button></div>';
    return;
  }
  if(STATE.countdownTimer) clearInterval(STATE.countdownTimer);
  var body=document.getElementById('checkout-body');
  if(body) body.innerHTML='<div style="text-align:center;padding:30px;">'
    +'<div style="font-size:48px;margin-bottom:12px;">✅</div>'
    +'<div class="title-sm">Payment Received!</div>'
    +'<p class="muted" style="margin-top:8px;font-size:13px;">Your payment is being confirmed on the blockchain.<br/>We\\'ll activate your service within 15 minutes.</p>'
    +'<button class="btn btn-primary" style="margin-top:16px;" onclick="closeModal(\\'checkout-modal\\')">Done</button>'
    +'</div>';
  toast('BTC payment recorded!','ok');
}

async function checkoutStripe(){
  if(!isLoggedIn()){
    closeModal('checkout-modal');
    openModal('auth-modal');
    toast('Please login to proceed','');
    return;
  }
  var item=STATE.checkoutItem;
  var body=document.getElementById('checkout-body');
  if(body) body.innerHTML='<div style="text-align:center;padding:30px;"><div class="loader"></div><p class="muted" style="margin-top:12px;">Redirecting to Stripe...</p></div>';
  var r=await api('POST','/api/billing/subscribe/stripe',{planId:item.serviceId||item.id||'service',interval:'monthly'});
  if(r.checkoutUrl||r.url){
    window.location.href=r.checkoutUrl||r.url;
    return;
  }
  var r2=await api('POST','/api/payment/create',{
    serviceId:item.serviceId||item.id||'service',
    amount:item.priceUsd,currency:'USD',method:'stripe',
    clientId:(STATE.user&&STATE.user.id)||'anonymous'
  });
  if(r2.checkoutUrl||r2.url){window.location.href=r2.checkoutUrl||r2.url;return;}
  if(body) body.innerHTML='<div style="text-align:center;padding:30px;">'
    +'<div style="font-size:48px;margin-bottom:12px;">💳</div>'
    +'<div class="title-sm">Stripe Checkout</div>'
    +'<p class="muted" style="margin-top:8px;font-size:13px;">Please contact <a href="mailto:vladoi_ionut@yahoo.com" style="color:#00d4ff;">vladoi_ionut@yahoo.com</a> to complete your purchase of <strong>'+escHtml(item.name)+'</strong> for $'+item.priceUsd+'.</p>'
    +'<button class="btn btn-primary" style="margin-top:16px;" onclick="closeModal(\\'checkout-modal\\')">OK</button>'
    +'</div>';
}

function checkoutPaypal(){
  var item=STATE.checkoutItem;
  var body=document.getElementById('checkout-body');
  if(body) body.innerHTML='<div style="text-align:center;padding:20px;">'
    +'<div style="font-size:40px;margin-bottom:12px;">🅿️</div>'
    +'<div class="title-sm">Pay via PayPal</div>'
    +'<p class="muted" style="font-size:13px;margin:12px 0;">Send $'+item.priceUsd+' USD for <strong>'+escHtml(item.name)+'</strong><br/>to PayPal account:</p>'
    +'<div class="btc-addr" onclick="copyText(\\'vladoi_ionut@yahoo.com\\',this)">vladoi_ionut@yahoo.com</div>'
    +'<p class="muted" style="font-size:11px;margin-top:8px;">Include your email in payment note for faster activation.</p>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="confirmPaypalPayment()">✓ I\\'ve Sent the Payment</button>'
    +'<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;" onclick="renderCheckoutStep1()">← Back</button>'
    +'</div>';
}

async function confirmPaypalPayment(){
  var item=STATE.checkoutItem;
  await api('POST','/api/payment/create',{
    serviceId:item.serviceId||item.id||'service',
    amount:item.priceUsd,currency:'USD',method:'paypal',
    clientId:(STATE.user&&STATE.user.id)||'anonymous'
  });
  var body=document.getElementById('checkout-body');
  if(body) body.innerHTML='<div style="text-align:center;padding:30px;">'
    +'<div style="font-size:48px;margin-bottom:12px;">✅</div>'
    +'<div class="title-sm">Payment Recorded!</div>'
    +'<p class="muted" style="font-size:13px;margin-top:8px;">We\\'ll verify and activate your service within 24 hours.</p>'
    +'<button class="btn btn-primary" style="margin-top:16px;" onclick="closeModal(\\'checkout-modal\\')">Done</button>'
    +'</div>';
  toast('PayPal payment recorded!','ok');
}

// ================================================================
// CHAT
// ================================================================
function toggleChat(){
  STATE.chatOpen=!STATE.chatOpen;
  document.getElementById('chat-panel').classList.toggle('hidden',!STATE.chatOpen);
  if(STATE.chatOpen&&document.getElementById('chat-messages').children.length===0){
    appendChatMsg('bot','👋 Salut! Sunt Zeus Concierge — consultant AI + sales pentru Unicorn. Spune-mi obiectivul tău (ex: lead-uri, automatizare, suport, enterprise) și îți recomand direct pachetul optim.');
    appendChatMsg('sys','Exemple rapide: „Vreau mai multe vânzări”, „Am nevoie de automatizare suport clienți”, „Am companie enterprise și vreau scalare AI”.');
  }
}

function appendChatMsg(role,text){
  var msgs=document.getElementById('chat-messages');
  if(!msgs) return;
  var d=document.createElement('div');
  d.className='chat-msg '+(role==='user'?'user':role==='sys'?'sys':'bot');
  d.textContent=text;
  msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
}

function appendChatRecommendations(recommendations){
  var msgs=document.getElementById('chat-messages');
  if(!msgs||!recommendations||!recommendations.length) return;
  var host=document.createElement('div');
  host.className='chat-msg bot';
  host.style.whiteSpace='normal';
  var html='<div style="font-size:12px;color:#8fb0cf;margin-bottom:8px;">🎯 Recommended for your goal:</div>';
  html+='<div style="display:grid;gap:8px;">';
  recommendations.slice(0,3).forEach(function(r){
    var reason=escHtml(r.reasonRo||r.reasonEn||'best fit');
    html+='<div style="border:1px solid rgba(0,212,255,.25);border-radius:10px;padding:8px;background:rgba(8,16,32,.5)">'
      +'<div style="font-weight:700;color:#d9f4ff;">'+escHtml(r.title||r.id||'Service')+'</div>'
      +'<div style="font-size:11px;color:#8fb0cf;margin:4px 0;">'+escHtml((r.description||'').slice(0,120))+'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'
      +'<span style="font-size:12px;color:#00ffa3;">$'+Number(r.price||0).toLocaleString('en-US')+'/'+escHtml(r.billing||'monthly')+'</span>'
      +'<button class="btn btn-primary btn-sm" onclick="openCheckout({id:'+JSON.stringify(String(r.id||'service'))+',serviceId:'+JSON.stringify(String(r.id||'service'))+',name:'+JSON.stringify(String(r.title||'Service'))+',priceUsd:'+Number(r.price||0)+'})">Buy now</button>'
      +'</div>'
      +'<div style="font-size:10px;color:#7090b0;margin-top:4px;">Why: '+reason+'</div>'
      +'</div>';
  });
  html+='</div>';
  host.innerHTML=html;
  msgs.appendChild(host);
  msgs.scrollTop=msgs.scrollHeight;
}

async function sendChat(){
  var inp=document.getElementById('chat-input');
  if(!inp) return;
  var msg=inp.value.trim();
  if(!msg) return;
  inp.value='';
  if(!isLoggedIn()&&STATE.freeChats>=3){
    appendChatMsg('sys','You\\'ve used your 3 free messages. Create a free account to continue!');
    var msgs=document.getElementById('chat-messages');
    if(msgs){
      var d=document.createElement('div');
      d.style.cssText='display:flex;gap:8px;justify-content:center;margin:8px 0;';
      d.innerHTML='<button class="btn btn-primary btn-sm" onclick="openModal(\\'auth-modal\\');switchTab(\\'tab-register\\')">Register Free</button>'
        +'<button class="btn btn-outline btn-sm" onclick="openModal(\\'auth-modal\\')">Login</button>';
      msgs.appendChild(d);
      msgs.scrollTop=msgs.scrollHeight;
    }
    return;
  }
  appendChatMsg('user',msg);
  STATE.chatHistory.push({role:'user',content:msg});
  // Try SSE streaming first (logged-in users), fall back to regular POST
  if(isLoggedIn()){
    await sendChatStream(msg);
  } else {
    await sendChatPost(msg);
  }
}

async function sendChatStream(msg){
  var msgs=document.getElementById('chat-messages');
  var botEl=document.createElement('div');
  botEl.className='chat-msg bot';
  botEl.textContent='';
  var cursor=document.createElement('span');
  cursor.className='chat-cursor';
  botEl.appendChild(cursor);
  if(msgs){msgs.appendChild(botEl);msgs.scrollTop=msgs.scrollHeight;}
  var fullText='';
  try{
    var params=new URLSearchParams({message:msg});
    var es=new EventSource('/api/chat/stream?'+params.toString()+'&token='+encodeURIComponent(STATE.token||''));
    var resolved=false;
    await new Promise(function(resolve){
      var timeout=setTimeout(function(){es.close();resolve();},30000);
      es.onmessage=function(e){
        try{
          var data=JSON.parse(e.data);
          if(data.done||data.finish){
            clearTimeout(timeout);
            es.close();
            resolved=true;
            resolve();
            return;
          }
          var chunk=data.chunk||data.text||data.content||'';
          fullText+=chunk;
          botEl.textContent=fullText;
          botEl.appendChild(cursor);
          if(msgs) msgs.scrollTop=msgs.scrollHeight;
        }catch(ex){}
      };
      es.onerror=function(){clearTimeout(timeout);es.close();if(!resolved)resolve();};
    });
  }catch(ex){}
  cursor.remove();
  if(!fullText){
    // Fallback to regular POST
    botEl.remove();
    await sendChatPost(msg);
    return;
  }
  botEl.textContent=fullText;
  STATE.chatHistory.push({role:'assistant',content:fullText});
}

async function sendChatPost(msg){
  var msgs=document.getElementById('chat-messages');
  var typingEl=document.createElement('div');
  typingEl.className='chat-msg bot';
  typingEl.innerHTML='<span class="loader"></span>';
  if(msgs){msgs.appendChild(typingEl);msgs.scrollTop=msgs.scrollHeight;}
  var r=await api('POST','/api/chat',{message:msg,history:STATE.chatHistory.slice(-10)});
  if(msgs&&typingEl.parentNode===msgs) msgs.removeChild(typingEl);
  var reply=r.reply||r.message||r.response||'I\\'m processing your request. Please try again in a moment.';
  appendChatMsg('bot',reply);
  if(r.recommendations&&r.recommendations.length) appendChatRecommendations(r.recommendations);
  STATE.chatHistory.push({role:'assistant',content:reply});
  if(!isLoggedIn()){
    STATE.freeChats++;
    localStorage.setItem('zeus_free_chats',String(STATE.freeChats));
    if(STATE.freeChats>=3){
      appendChatMsg('sys','You have used all 3 free messages. Register for unlimited access!');
    } else {
      appendChatMsg('sys',(3-STATE.freeChats)+' free message(s) remaining.');
    }
  }
}

// ================================================================
// STARFIELD BACKGROUND
// ================================================================
(function(){
  var canvas=document.getElementById('bg-canvas');
  var ctx=canvas.getContext('2d');
  var stars=[];
  var NUM=180;
  function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
  function init(){
    resize();
    stars=[];
    for(var i=0;i<NUM;i++){
      stars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*1.5+.3,speed:Math.random()*.3+.05,opacity:Math.random()*.7+.2});
    }
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    stars.forEach(function(s){
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle='rgba(200,230,255,'+s.opacity+')';
      ctx.fill();
      s.y+=s.speed;
      if(s.y>canvas.height){s.y=0;s.x=Math.random()*canvas.width;}
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize',init);
  init();draw();
})();

// ================================================================
// ZEUS 3D SPHERE
// ================================================================
(function(){
  var canvas=document.getElementById('zeusCanvas');
  if(!canvas) return;
  var ctx=canvas.getContext('2d');
  var W,H,cx,cy,R=90,t=0;
  var pts=[];
  function resize(){W=canvas.offsetWidth;H=canvas.offsetHeight;canvas.width=W;canvas.height=H;cx=W/2;cy=H/2;}
  function genPts(){
    pts=[];
    var N=220;
    for(var i=0;i<N;i++){
      var phi=Math.acos(1-2*(i+.5)/N);
      var theta=Math.PI*(1+Math.sqrt(5))*i;
      pts.push([Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)]);
    }
  }
  function frame(){
    ctx.clearRect(0,0,W,H);
    t+=.008;
    var cosA=Math.cos(t*.7),sinA=Math.sin(t*.7),cosB=Math.cos(t*.4),sinB=Math.sin(t*.4);
    var projected=pts.map(function(p){
      var x=p[0],y=p[1],z=p[2];
      var x1=cosA*x+sinA*z,z1=-sinA*x+cosA*z;
      var y2=cosB*y-sinB*z1,z2=sinB*y+cosB*z1;
      return {sx:cx+x1*R,sy:cy+y2*R,z:z2,orig:p};
    });
    projected.forEach(function(p){
      if(p.z<0) return;
      var a=0.15+0.6*(p.z+1)/2;
      var g=ctx.createRadialGradient(p.sx,p.sy,0,p.sx,p.sy,2.5);
      g.addColorStop(0,'rgba(0,212,255,'+a+')');
      g.addColorStop(1,'rgba(0,212,255,0)');
      ctx.beginPath();ctx.arc(p.sx,p.sy,2.5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    });
    // Orbiting ring
    ctx.save();ctx.translate(cx,cy);ctx.rotate(t*.5);
    ctx.beginPath();ctx.ellipse(0,0,R+18,12,0,0,Math.PI*2);
    ctx.strokeStyle='rgba(192,132,252,.35)';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
    // Glow core
    var gc=ctx.createRadialGradient(cx,cy,0,cx,cy,R*.6);
    gc.addColorStop(0,'rgba(0,212,255,.12)');gc.addColorStop(1,'rgba(0,212,255,0)');
    ctx.beginPath();ctx.arc(cx,cy,R*.6,0,Math.PI*2);ctx.fillStyle=gc;ctx.fill();
    requestAnimationFrame(frame);
  }
  resize();genPts();frame();
  window.addEventListener('resize',function(){resize();});
})();

// ================================================================
// ANALOG CLOCK
// ================================================================
(function(){
  var canvas=document.getElementById('luxClock');
  if(!canvas) return;
  var ctx=canvas.getContext('2d');
  function draw(){
    var now=new Date();
    var W=canvas.width,H=canvas.height,cx=W/2,cy=H/2,R=Math.min(W,H)/2-6;
    ctx.clearRect(0,0,W,H);
    // Face
    var gf=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    gf.addColorStop(0,'rgba(15,22,50,.9)');gf.addColorStop(1,'rgba(5,6,14,.95)');
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fillStyle=gf;ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,200,255,.4)';ctx.lineWidth=2;ctx.stroke();
    // Ticks
    for(var i=0;i<60;i++){
      var a=i*Math.PI/30;var big=i%5===0;
      var r1=R-(big?12:6),r2=R-2;
      ctx.beginPath();
      ctx.moveTo(cx+r1*Math.sin(a),cy-r1*Math.cos(a));
      ctx.lineTo(cx+r2*Math.sin(a),cy-r2*Math.cos(a));
      ctx.strokeStyle=big?'rgba(0,212,255,.8)':'rgba(0,200,255,.3)';
      ctx.lineWidth=big?2:1;ctx.stroke();
    }
    // Hour numbers
    ctx.fillStyle='rgba(0,212,255,.7)';ctx.font='bold '+(R*.13)+'px Orbitron,monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    for(var n=1;n<=12;n++){
      var an=n*Math.PI/6;
      ctx.fillText(String(n),cx+(R-R*.28)*Math.sin(an),cy-(R-R*.28)*Math.cos(an));
    }
    var h=now.getHours()%12,m=now.getMinutes(),s=now.getSeconds();
    var ms=now.getMilliseconds();
    // Hour hand
    var ah=(h+m/60)*Math.PI/6;
    drawHand(ctx,cx,cy,ah,R*.5,4,'rgba(0,212,255,.9)');
    // Minute hand
    var am=(m+s/60)*Math.PI/30;
    drawHand(ctx,cx,cy,am,R*.72,2.5,'rgba(0,212,255,.8)');
    // Second hand
    var as=(s+(ms/1000))*Math.PI/30;
    drawHand(ctx,cx,cy,as,R*.82,1.2,'#00ffa3');
    // Center dot
    ctx.beginPath();ctx.arc(cx,cy,4,0,Math.PI*2);ctx.fillStyle='#00d4ff';ctx.fill();
    // Digital
    var dig=document.getElementById('clkDig');
    if(dig) dig.textContent=(h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
    var dd=document.getElementById('clkDate');
    if(dd){
      var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      dd.textContent=days[now.getDay()]+' '+now.getDate()+' '+months[now.getMonth()]+' '+now.getFullYear();
    }
    requestAnimationFrame(draw);
  }
  function drawHand(c,cx,cy,angle,len,width,color){
    c.beginPath();c.moveTo(cx,cy);
    c.lineTo(cx+len*Math.sin(angle),cy-len*Math.cos(angle));
    c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();
  }
  draw();
})();

// ================================================================
// HTML ESCAPE
// ================================================================
function escHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(s){return escHtml(s);}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded',function(){
  updateHeaderAuth();
  initRouting();
  loadHomeData();
  // BTC ticker polling — every 30s, re-renders all price displays
  function refreshBtcTicker(){
    fetch('/api/payment/btc-rate').then(function(r){return r.json();}).then(function(d){
      if(d.rate||d.usd){
        var prev=STATE.btcRate;
        STATE.btcRate=d.rate||d.usd;
        var f='$'+Number(STATE.btcRate).toLocaleString('en-US',{maximumFractionDigits:0});
        setElText('btc-ticker','BTC '+f);
        setElText('stat-btc',f);
        // Re-render BTC amounts on visible cards if rate changed meaningfully
        if(Math.abs(STATE.btcRate-prev)>10){
          if(STATE.filteredServices&&STATE.filteredServices.length) renderServiceGrid();
          if(document.getElementById('plans-grid')&&document.getElementById('plans-grid').children.length) renderPlanCards(null,STATE.marketConditions||null);
        }
      }
    }).catch(function(){});
  }
  refreshBtcTicker();
  setInterval(refreshBtcTicker,30000);
  // Notification polling (every 2 min, only when logged in)
  setInterval(function(){
    if(isLoggedIn()) pollNotifications();
  },120000);
  if(isLoggedIn()) pollNotifications();
  // SSE for live updates
  try{
    var es=new EventSource('/stream');
    es.onmessage=function(e){
      try{
        var d=JSON.parse(e.data);
        if(d.activeUsers!=null) setElText('stat-users',d.activeUsers);
      }catch(ex){}
    };
    es.onerror=function(){es.close();};
  }catch(e){}
  // Close notif panel on outside click
  document.addEventListener('click',function(e){
    var panel=document.getElementById('notif-panel');
    var bell=document.getElementById('notif-bell');
    if(STATE.notifOpen&&panel&&!panel.contains(e.target)&&e.target!==bell&&!bell.contains(e.target)){
      closeNotifPanel();
    }
  });
});
window.addEventListener('hashchange',initRouting);
</script>
</body>
</html>`;
}

module.exports = { getSiteHtml };
