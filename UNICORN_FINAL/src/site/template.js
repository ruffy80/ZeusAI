// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

function getSiteHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ZEUS AI — Build. Automate. Scale.</title>
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
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:.5px;text-decoration:none;}
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
.card-hover{transition:border-color .3s,transform .3s;}
.card-hover:hover{border-color:rgba(0,212,255,.5);transform:translateY(-3px);}

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
.svc-card{background:rgba(10,14,36,.75);border:1px solid rgba(0,200,255,.2);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px;transition:border-color .3s,transform .3s;}
.svc-card:hover{border-color:rgba(0,212,255,.5);transform:translateY(-4px);}
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
.filter-btn{background:rgba(10,14,36,.8);border:1px solid rgba(0,200,255,.2);color:#7090b0;padding:5px 12px;border-radius:8px;font-family:'Rajdhani',sans-serif;font-size:13px;cursor:pointer;transition:all .2s;}
.filter-btn:hover,.filter-btn.active{background:rgba(0,212,255,.15);border-color:rgba(0,212,255,.5);color:#00d4ff;}

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
    <button class="nav-btn" data-view="pricing" onclick="navigate('pricing')"><span>Pricing</span></button>
    <button class="nav-btn hidden" id="nav-dashboard" data-view="dashboard" onclick="navigate('dashboard')"><span>Dashboard</span></button>
    <button class="nav-btn" data-view="admin" onclick="navigate('admin')" id="nav-admin" style="display:none"><span>Admin</span></button>
  </nav>
  <div class="hdr-right">
    <div class="btc-ticker" id="btc-ticker">BTC $—</div>
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

  <!-- HOME VIEW -->
  <div id="view-home" class="view">
    <!-- Hero -->
    <section class="hero-section">
      <p class="subtitle">Powered by Advanced AI</p>
      <h1 class="hero-title">ZEUS AI<br/>Build. Automate. Scale.</h1>
      <p class="hero-sub">The all-in-one AI platform for autonomous businesses. Deploy intelligent agents, automate workflows, and scale without limits.</p>
      <div class="hero-ctas">
        <button class="btn btn-primary btn-lg" onclick="openModal('auth-modal');switchTab('tab-register')">🚀 Get Started Free</button>
        <button class="btn btn-outline btn-lg" onclick="navigate('marketplace')">⚡ Explore Services</button>
      </div>
    </section>

    <!-- Zeus + Clock -->
    <div class="zeus-wrap card card-glow" style="margin-bottom:24px;">
      <div class="zeus-face">
        <canvas id="zeusCanvas"></canvas>
        <div class="zeus-overlay">
          <div class="zeus-ring"></div>
          <div class="zeus-ring2"></div>
          <div class="zeus-scan"></div>
          <div class="zeus-label">ZEUS AI CORE v3.9</div>
          <div class="zeus-status"><div class="zeus-dot"></div>ONLINE</div>
        </div>
      </div>
      <div class="clock-wrap card card-sm" style="justify-content:center;">
        <canvas id="luxClock" width="180" height="180"></canvas>
        <div class="clock-digital" id="clkDig">00:00:00</div>
        <div class="clock-date" id="clkDate">—</div>
      </div>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="card card-sm">
        <div class="label">Active Users</div>
        <div class="kpi-val" id="stat-users">—</div>
      </div>
      <div class="card card-sm">
        <div class="label">Uptime</div>
        <div class="kpi-val green" id="stat-uptime">—</div>
      </div>
      <div class="card card-sm">
        <div class="label">BTC Rate</div>
        <div class="kpi-val cyan" id="stat-btc">—</div>
      </div>
    </div>

    <!-- How it works -->
    <div class="sec-title">How It Works</div>
    <div class="how-steps">
      <div class="card card-hover">
        <div class="step-num">01</div>
        <div class="step-title">Register Free</div>
        <div class="step-desc">Create your Zeus AI account in seconds. No credit card required to get started with our free tier.</div>
      </div>
      <div class="card card-hover">
        <div class="step-num">02</div>
        <div class="step-title">Choose a Service</div>
        <div class="step-desc">Browse our marketplace of AI-powered services. From automation to intelligence, find your solution.</div>
      </div>
      <div class="card card-hover">
        <div class="step-num">03</div>
        <div class="step-title">Pay &amp; Activate</div>
        <div class="step-desc">Pay with BTC, Stripe, or PayPal. Your service activates instantly with enterprise-grade reliability.</div>
      </div>
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
            <label class="form-label">Employees</label>
            <input class="form-inp" type="number" id="roi-emp" placeholder="e.g. 50" min="1"/>
          </div>
          <div class="form-group">
            <label class="form-label">Monthly Revenue ($)</label>
            <input class="form-inp" type="number" id="roi-rev" placeholder="e.g. 500000" min="1"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Industry</label>
          <select class="form-inp" id="roi-ind">
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
      <p>⚡ ZEUS AI Platform &nbsp;|&nbsp; Owner: Vladoi Ionut &nbsp;|&nbsp; <a href="mailto:vladoi_ionut@yahoo.com">vladoi_ionut@yahoo.com</a></p>
      <p style="margin-top:6px;">BTC: <span class="btc-addr" onclick="copyText('bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',this)" title="Click to copy">bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e</span></p>
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
    <div style="text-align:center;margin-top:24px;color:#7090b0;font-size:13px;">
      All plans include: SSL, 99.9% uptime SLA, 24/7 monitoring.<br/>
      Payments via BTC, Stripe, or PayPal. Cancel anytime.
    </div>
  </div><!-- end #view-pricing -->

  <!-- DASHBOARD VIEW -->
  <div id="view-dashboard" class="view">
    <div class="sec-title">My Dashboard</div>
    <div id="dash-content">
      <div style="text-align:center;padding:60px;color:#7090b0;">Loading dashboard...</div>
    </div>
  </div><!-- end #view-dashboard -->

  <!-- ADMIN VIEW -->
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
      <div class="grid-3" style="margin-bottom:20px;">
        <div class="card card-sm"><div class="label">Health</div><div class="kpi-val green" id="adm-health">—</div></div>
        <div class="card card-sm"><div class="label">Uptime</div><div class="kpi-val cyan" id="adm-uptime">—</div></div>
        <div class="card card-sm"><div class="label">Active Users</div><div class="kpi-val" id="adm-users">—</div></div>
      </div>
      <div class="card" style="margin-bottom:20px;">
        <div class="dash-section-title">BTC Collection Address</div>
        <div class="btc-addr" onclick="copyText('bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',this)">bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e</div>
        <p class="muted" style="font-size:12px;margin-top:8px;">Owner: Vladoi Ionut | vladoi_ionut@yahoo.com</p>
      </div>
      <div class="card">
        <div class="dash-section-title">Admin API Access</div>
        <p class="muted" style="font-size:13px;">Full admin dashboard available via <code style="color:#00d4ff">/api/admin/*</code> endpoints using your admin JWT token.</p>
        <div id="adm-snapshot" style="margin-top:12px;font-size:12px;color:#7090b0;"></div>
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
  services: [],
  filteredServices: [],
  pricingYearly: false,
  countdownTimer: null
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

async function api(method,path,body,useAdmin){
  try{
    var opts={method:method,headers:useAdmin?adminHeaders():authHeaders()};
    if(body) opts.body=JSON.stringify(body);
    var r=await fetch(path,opts);
    if(!r.ok){
      var t=await r.text();
      try{return JSON.parse(t);}catch(e){return {error:t||('HTTP '+r.status)};}
    }
    return r.json();
  }catch(e){
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
  else if(view==='pricing') loadPricing();
  else if(view==='dashboard'){
    if(!isLoggedIn()){openModal('auth-modal');return;}
    loadDashboard();
  }
  else if(view==='admin') initAdmin();
  window.scrollTo(0,0);
}

function initRouting(){
  var h=(window.location.hash||'').replace('#','').trim();
  var valid=['home','marketplace','pricing','dashboard','admin'];
  navigate(valid.indexOf(h)>=0?h:'home');
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
  var r=await api('POST','/api/auth/login',{email:email,password:pass});
  if(r.error||r.message){
    msg.innerHTML='<div class="msg-err">'+(r.error||r.message)+'</div>';
    return;
  }
  var token=r.token||r.accessToken||(r.data&&r.data.token);
  if(!token){msg.innerHTML='<div class="msg-err">Login failed. Check credentials.</div>';return;}
  STATE.token=token;
  STATE.user=r.user||(r.data&&r.data.user)||{email:email};
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
  if(pass.length<6){msg.innerHTML='<div class="msg-err">Password must be at least 6 characters.</div>';return;}
  msg.innerHTML='<div class="loader"></div>';
  var r=await api('POST','/api/auth/register',{name:name,email:email,password:pass});
  if(r.error||r.message&&!r.token&&!r.user){
    msg.innerHTML='<div class="msg-err">'+(r.error||r.message||'Registration failed')+'</div>';
    return;
  }
  var token=r.token||r.accessToken||(r.data&&r.data.token);
  if(token){
    STATE.token=token;
    STATE.user=r.user||(r.data&&r.data.user)||{name:name,email:email};
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
  var r=await api('POST','/api/auth/forgot-password',{email:email});
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
    setElText('kpi-modules',(snap.modules&&snap.modules.length)||'18');
    setElText('kpi-services',(snap.marketplace&&snap.marketplace.length)||'24');
    setElText('kpi-innov',(snap.innovations&&snap.innovations.count)||'7');
  }catch(e){}
  // BTC rate
  try{
    var br=await fetch('/api/payment/btc-rate').then(function(r){return r.json();}).catch(function(){return {};});
    if(br.rate||br.usd){
      STATE.btcRate=br.rate||br.usd||0;
      var fmt='$'+Number(STATE.btcRate).toLocaleString('en-US',{maximumFractionDigits:0});
      setElText('stat-btc',fmt);
      setElText('btc-ticker','BTC '+fmt);
    }
  }catch(e){}
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
    +'</div><p class="muted" style="font-size:12px;margin-top:10px;text-align:center;">Based on '+ind+' industry benchmarks. <a href="#" onclick="openModal(\'auth-modal\');return false;" style="color:#00d4ff;">Get detailed report →</a></p>';
}

// ================================================================
// MARKETPLACE
// ================================================================
var allCategories=[];
var activeCategory='all';

async function loadMarketplace(){
  var grid=document.getElementById('svc-grid');
  if(!grid) return;
  if(STATE.services.length){renderServiceGrid();return;}
  grid.innerHTML='<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;"><div class="loader"></div></div>';
  var r=await api('GET','/api/marketplace/services');
  var svcs=r.services||r.data||[];
  if(!svcs.length){
    svcs=[
      {id:'svc-1',name:'AI Automation Suite',description:'Full workflow automation powered by advanced AI models. Deploy bots that handle tasks 24/7.',price:299,category:'Automation'},
      {id:'svc-2',name:'Intelligent Analytics',description:'Deep data insights with predictive analytics. Turn raw data into actionable intelligence.',price:199,category:'Analytics'},
      {id:'svc-3',name:'NLP Processing API',description:'Advanced natural language processing with 50+ language support and sentiment analysis.',price:149,category:'API'},
      {id:'svc-4',name:'Computer Vision',description:'Real-time image and video analysis. Object detection, facial recognition, and more.',price:399,category:'Vision'},
      {id:'svc-5',name:'AI Chatbot Builder',description:'Deploy custom AI chatbots on any platform. Train on your data in minutes.',price:99,category:'Communication'},
      {id:'svc-6',name:'Predictive Modeling',description:'Build and deploy ML models without code. Enterprise-grade predictions at startup prices.',price:499,category:'Analytics'},
      {id:'svc-7',name:'Zeus AI Assistant',description:'Personal AI assistant integration for your team. Boost productivity by 3x.',price:79,category:'Productivity'},
      {id:'svc-8',name:'Data Pipeline AI',description:'Automated ETL pipelines with AI-powered data validation and transformation.',price:249,category:'Data'},
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
    return '<button class="filter-btn'+(c===activeCategory?' active':'')+'" onclick="setCat(\''+escHtml(c)+'\')">'+escHtml(c==='all'?'All':c)+'</button>';
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
    return '<div class="svc-card">'
      +'<div><span class="svc-cat">'+escHtml(s.category||'Service')+'</span></div>'
      +'<div class="svc-name">'+escHtml(s.name||'Service')+'</div>'
      +'<div class="svc-desc">'+escHtml(s.description||'')+'</div>'
      +'<div><div class="svc-price">$'+price+' <span style="font-size:12px;color:#7090b0;">/ mo</span></div>'
      +'<div class="svc-btc">≈ '+btcEq+'</div></div>'
      +'<button class="btn btn-green btn-sm" onclick="openCheckout('+JSON.stringify({id:s.id,name:s.name,priceUsd:price})+')">Buy Now →</button>'
      +'</div>';
  }).join('');
}

// ================================================================
// PRICING
// ================================================================
var PLANS=[
  {id:'free',name:'Free',monthly:0,yearly:0,features:['3 AI requests/day','1 workspace','Community support','Basic analytics'],noFeatures:['Custom integrations','API access','Priority support']},
  {id:'starter',name:'Starter',monthly:29,yearly:24,features:['500 AI requests/day','5 workspaces','Email support','Full analytics','API access'],noFeatures:['Custom integrations','Dedicated support'],popular:false},
  {id:'pro',name:'Pro',monthly:99,yearly:82,features:['Unlimited AI requests','Unlimited workspaces','Priority support','Custom integrations','API access','Advanced analytics'],noFeatures:[],popular:true},
  {id:'enterprise',name:'Enterprise',monthly:499,yearly:415,features:['Everything in Pro','Dedicated account manager','Custom AI training','SLA 99.99%','White-label option','On-premise deployment'],noFeatures:[],popular:false},
];

async function loadPricing(){
  renderPlanCards();
  // Try to get live plans from API
  var r=await api('GET','/api/billing/plans/public');
  if(r.plans&&r.plans.length){
    // Merge with static data for BTC prices
    renderPlanCards(r.plans);
  }
}

function togglePricing(){
  STATE.pricingYearly=!STATE.pricingYearly;
  var tog=document.getElementById('pricing-toggle');
  tog.classList.toggle('on',STATE.pricingYearly);
  document.getElementById('lbl-monthly').classList.toggle('active',!STATE.pricingYearly);
  document.getElementById('lbl-yearly').classList.toggle('active',STATE.pricingYearly);
  renderPlanCards();
}

function renderPlanCards(apiPlans){
  var grid=document.getElementById('plans-grid');
  if(!grid) return;
  var plans=PLANS;
  if(apiPlans){
    plans=PLANS.map(function(local){
      var ap=apiPlans.find(function(p){return p.id===local.id||p.name===local.name;});
      return ap?Object.assign({},local,{monthly:ap.priceMonthly||local.monthly,yearly:ap.priceYearly||local.yearly}):local;
    });
  }
  grid.innerHTML=plans.map(function(p){
    var price=STATE.pricingYearly?p.yearly:p.monthly;
    var btcEq=price>0?usdToBtc(price):'Free';
    var feats=(p.features||[]).map(function(f){return '<li>'+escHtml(f)+'</li>';}).join('');
    var noFeats=(p.noFeatures||[]).map(function(f){return '<li class="no">'+escHtml(f)+'</li>';}).join('');
    return '<div class="plan-card'+(p.popular?' popular':'') +'">'
      +(p.popular?'<div class="popular-tag">⭐ Most Popular</div>':'')
      +'<div class="plan-name">'+escHtml(p.name)+'</div>'
      +'<div class="plan-price">'+(price===0?'Free':'$'+price)+'<span>'+(price>0?(STATE.pricingYearly?'/mo, billed yearly':'/mo'):'')+'</span></div>'
      +(price>0?'<div class="plan-btc">≈ '+btcEq+'/mo</div>':'')
      +'<ul class="plan-features">'+feats+noFeats+'</ul>'
      +(price===0
        ?'<button class="btn btn-outline" onclick="openModal(\'auth-modal\');switchTab(\'tab-register\')">Get Started Free</button>'
        :'<button class="btn '+(p.popular?'btn-primary':'btn-outline')+'" onclick="handleSubscribe(\''+p.id+'\','+price+')">Subscribe</button>'
      )
      +'</div>';
  }).join('');
}

async function handleSubscribe(planId,price){
  if(!isLoggedIn()){openModal('auth-modal');toast('Please login to subscribe','');return;}
  toast('Redirecting to checkout...','');
  var r=await api('POST','/api/billing/subscribe/stripe',{planId:planId,interval:STATE.pricingYearly?'yearly':'monthly'});
  if(r.checkoutUrl||r.url){
    window.location.href=r.checkoutUrl||r.url;
  } else {
    openCheckout({name:planId+' Plan',priceUsd:price,serviceId:planId});
  }
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
  +'<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">'
  +'<div class="user-avatar" style="width:52px;height:52px;font-size:20px;">'+((u.name||u.email||'Z').charAt(0).toUpperCase())+'</div>'
  +'<div><div style="font-family:Orbitron,monospace;font-size:16px;font-weight:700;color:#e8f4ff;">'+escHtml(u.name||'Zeus User')+'</div>'
  +'<div style="font-size:13px;color:#7090b0;">'+escHtml(u.email||'')+'</div>'
  +'<div style="margin-top:4px;"><span class="badge">'+plan+'</span></div></div></div>'
  +'<button class="btn btn-primary btn-sm" onclick="navigate(\'pricing\')">⚡ Upgrade Plan</button>'
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
  }).join(''):'<p class="muted" style="font-size:13px;">No payments yet. <a href="#" onclick="navigate(\'marketplace\');return false;" style="color:#00d4ff;">Browse services →</a></p>')
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
      +'<button class="btn btn-ghost btn-sm" onclick="copyText(\''+escHtml(kval)+'\',this)">Copy</button></div>';
  }).join(''):'<p class="muted" style="font-size:12px;">No API keys yet.</p>')
  +'<button class="btn btn-outline btn-sm" style="margin-top:10px;width:100%;" onclick="generateApiKey()">+ Generate Key</button>'
  +'</div>'
  // Referrals
  +'<div class="card">'
  +'<div class="dash-section-title">Referrals</div>'
  +'<p class="muted" style="font-size:12px;margin-bottom:8px;">Earn credits for every referral. Share your link:</p>'
  +'<div class="ref-link-box" onclick="copyText(\''+refLink+'\',this)" title="Click to copy">'+escHtml(refLink)+'</div>'
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
// ADMIN
// ================================================================
function initAdmin(){
  if(STATE.adminToken){
    document.getElementById('admin-login-section').style.display='none';
    document.getElementById('admin-panel-section').style.display='block';
    loadAdminData();
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
  loadAdminData();
}

async function loadAdminData(){
  var health=await api('GET','/api/health');
  setElText('adm-health',(health.status||'OK').toUpperCase());
  var snap=await fetch('/snapshot').then(function(r){return r.json();}).catch(function(){return {};});
  setElText('adm-uptime',snap.telemetry&&snap.telemetry.uptime?fmtMs(snap.telemetry.uptime*1000):'—');
  setElText('adm-users',snap.telemetry&&snap.telemetry.activeUsers!=null?snap.telemetry.activeUsers:'—');
  var snapEl=document.getElementById('adm-snapshot');
  if(snapEl) snapEl.innerHTML='<pre style="overflow:auto;max-height:200px;">'+escHtml(JSON.stringify(snap,null,2))+'</pre>';
}

// ================================================================
// CHECKOUT
// ================================================================
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
  body.innerHTML='<div style="text-align:center;margin-bottom:16px;">'
    +'<div style="font-size:28px;font-weight:700;font-family:Orbitron,monospace;color:#00d4ff;">$'+price+'</div>'
    +(btcEq!=='—'?'<div style="color:#7090b0;font-size:12px;font-family:monospace;">≈ '+btcEq+'</div>':'')
    +'</div>'
    +'<div style="font-size:13px;color:#7090b0;text-align:center;margin-bottom:16px;">Select payment method:</div>'
    +'<div class="pay-methods">'
    +'<button class="pay-method-btn" onclick="checkoutBtc()"><div class="pay-method-icon">₿</div><div>Bitcoin</div><div style="font-size:10px;color:#7090b0;">BTC</div></button>'
    +'<button class="pay-method-btn" onclick="checkoutStripe()"><div class="pay-method-icon">💳</div><div>Card</div><div style="font-size:10px;color:#7090b0;">Stripe</div></button>'
    +'<button class="pay-method-btn" onclick="checkoutPaypal()"><div class="pay-method-icon">🅿️</div><div>PayPal</div><div style="font-size:10px;color:#7090b0;">Balance</div></button>'
    +'</div>';
}

async function checkoutBtc(){
  var body=document.getElementById('checkout-body');
  var item=STATE.checkoutItem;
  var price=item.priceUsd||0;
  var btcAmount=STATE.btcRate>0?(price/STATE.btcRate).toFixed(8):'0.00100000';
  body.innerHTML='<div style="text-align:center;margin-bottom:10px;"><div class="loader"></div><p class="muted" style="margin-top:8px;">Generating payment address...</p></div>';
  var addr='bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
  var qrData=await api('GET','/api/payment/btc-qr?address='+encodeURIComponent(addr)+'&amount='+encodeURIComponent(btcAmount));
  var qrSrc=qrData.qr||('https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=bitcoin:'+addr+'%3Famount%3D'+btcAmount);
  var seconds=1800;
  body.innerHTML='<div style="text-align:center;">'
    +'<img class="qr-img" src="'+escAttr(qrSrc)+'" alt="BTC QR Code"/>'
    +'<div class="countdown" id="pay-countdown"></div>'
    +'<div style="margin:8px 0;font-size:13px;color:#7090b0;">Send exactly:</div>'
    +'<div style="font-family:monospace;font-size:20px;font-weight:700;color:#00ffa3;">'+btcAmount+' BTC</div>'
    +'<div style="font-size:12px;color:#7090b0;margin:4px 0;">≈ $'+price+' USD</div>'
    +'<div style="font-size:12px;color:#7090b0;margin-bottom:4px;">To address:</div>'
    +'<div class="btc-addr" onclick="copyText(\''+addr+'\',this)" style="text-align:left;">'+addr+'</div>'
    +'<button class="btn btn-green" style="width:100%;margin-top:16px;" onclick="confirmBtcPayment()">✓ I\'ve Sent the Payment</button>'
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

async function confirmBtcPayment(){
  var item=STATE.checkoutItem;
  var r=await api('POST','/api/payment/create',{
    serviceId:item.serviceId||item.id||'service',
    amount:item.priceUsd,currency:'USD',method:'btc',
    clientId:(STATE.user&&STATE.user.id)||'anonymous'
  });
  if(STATE.countdownTimer) clearInterval(STATE.countdownTimer);
  var body=document.getElementById('checkout-body');
  if(body) body.innerHTML='<div style="text-align:center;padding:30px;">'
    +'<div style="font-size:48px;margin-bottom:12px;">✅</div>'
    +'<div class="title-sm">Payment Received!</div>'
    +'<p class="muted" style="margin-top:8px;font-size:13px;">Your payment is being confirmed on the blockchain.<br/>We\'ll activate your service within 15 minutes.</p>'
    +'<button class="btn btn-primary" style="margin-top:16px;" onclick="closeModal(\'checkout-modal\')">Done</button>'
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
    +'<button class="btn btn-primary" style="margin-top:16px;" onclick="closeModal(\'checkout-modal\')">OK</button>'
    +'</div>';
}

function checkoutPaypal(){
  var item=STATE.checkoutItem;
  var body=document.getElementById('checkout-body');
  if(body) body.innerHTML='<div style="text-align:center;padding:20px;">'
    +'<div style="font-size:40px;margin-bottom:12px;">🅿️</div>'
    +'<div class="title-sm">Pay via PayPal</div>'
    +'<p class="muted" style="font-size:13px;margin:12px 0;">Send $'+item.priceUsd+' USD for <strong>'+escHtml(item.name)+'</strong><br/>to PayPal account:</p>'
    +'<div class="btc-addr" onclick="copyText(\'vladoi_ionut@yahoo.com\',this)">vladoi_ionut@yahoo.com</div>'
    +'<p class="muted" style="font-size:11px;margin-top:8px;">Include your email in payment note for faster activation.</p>'
    +'<button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="confirmPaypalPayment()">✓ I\'ve Sent the Payment</button>'
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
    +'<p class="muted" style="font-size:13px;margin-top:8px;">We\'ll verify and activate your service within 24 hours.</p>'
    +'<button class="btn btn-primary" style="margin-top:16px;" onclick="closeModal(\'checkout-modal\')">Done</button>'
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
    appendChatMsg('bot','👋 Hello! I\'m Zeus AI. How can I help you today?');
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

async function sendChat(){
  var inp=document.getElementById('chat-input');
  if(!inp) return;
  var msg=inp.value.trim();
  if(!msg) return;
  inp.value='';
  if(!isLoggedIn()&&STATE.freeChats>=3){
    appendChatMsg('sys','You\'ve used your 3 free messages. Create a free account to continue!');
    var msgs=document.getElementById('chat-messages');
    if(msgs){
      var d=document.createElement('div');
      d.style.cssText='display:flex;gap:8px;justify-content:center;margin:8px 0;';
      d.innerHTML='<button class="btn btn-primary btn-sm" onclick="openModal(\'auth-modal\');switchTab(\'tab-register\')">Register Free</button>'
        +'<button class="btn btn-outline btn-sm" onclick="openModal(\'auth-modal\')">Login</button>';
      msgs.appendChild(d);
      msgs.scrollTop=msgs.scrollHeight;
    }
    return;
  }
  appendChatMsg('user',msg);
  STATE.chatHistory.push({role:'user',content:msg});
  var typingEl=document.createElement('div');
  typingEl.className='chat-msg bot';
  typingEl.innerHTML='<span class="loader"></span>';
  var msgs=document.getElementById('chat-messages');
  if(msgs){msgs.appendChild(typingEl);msgs.scrollTop=msgs.scrollHeight;}
  var r=await api('POST','/api/chat',{message:msg,history:STATE.chatHistory.slice(-10)});
  if(msgs) msgs.removeChild(typingEl);
  var reply=r.reply||r.message||r.response||'I\'m processing your request. Please try again in a moment.';
  appendChatMsg('bot',reply);
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
  // BTC ticker polling
  setInterval(function(){
    fetch('/api/payment/btc-rate').then(function(r){return r.json();}).then(function(d){
      if(d.rate||d.usd){
        STATE.btcRate=d.rate||d.usd;
        var f='$'+Number(STATE.btcRate).toLocaleString('en-US',{maximumFractionDigits:0});
        setElText('btc-ticker','BTC '+f);
        setElText('stat-btc',f);
      }
    }).catch(function(){});
  },60000);
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
});
window.addEventListener('hashchange',initRouting);
</script>
</body>
</html>`;
}

module.exports = { getSiteHtml };
