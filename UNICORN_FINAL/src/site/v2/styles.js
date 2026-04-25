// UNICORN V2 — cinematic dark/electric styles
// Original work, © Vladoi Ionut
'use strict';

module.exports.CSS = `
:root{
  --bg:#05040a;
  --bg2:#0a0818;
  --ink:#e8ecff;
  --ink-dim:#8fa1d4;
  --violet:#8a5cff;
  --violet2:#b89bff;
  --blue:#3ea0ff;
  --blue2:#6fd3ff;
  --gold:#ffd36a;
  --gold2:#ffaa2b;
  --danger:#ff3d6e;
  --ok:#3bffb0;
  --glass: rgba(18,14,40,0.42);
  --glass-strong: rgba(26,20,58,0.68);
  --stroke: rgba(163,138,255,0.22);
  --stroke-hot: rgba(163,138,255,0.6);
  --shadow: 0 30px 80px -20px rgba(80,40,200,0.45);
  --autotune-blur: 12px;
  --autotune-glow: .75;
  --radius: 18px;
  --radius-lg: 28px;
  --font: "Space Grotesk","Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --mono: "JetBrains Mono","SFMono-Regular",ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--font);-webkit-font-smoothing:antialiased;overflow-x:hidden}
body{min-height:100vh;background:radial-gradient(1400px 900px at 50% 0%,rgba(138,92,255,.12),transparent 55%),radial-gradient(1200px 800px at 100% 100%,rgba(62,160,255,.08),transparent 60%),linear-gradient(180deg,#05040a 0%,#0a0818 100%)}
a{color:var(--blue2);text-decoration:none}
a:hover{color:var(--violet2)}
img{max-width:100%;display:block}
button{font-family:inherit}

/* subtle vignette */
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.5) 100%);opacity:.6}

/* ============ NAV ============ */
.nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:18px 32px;backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);background:linear-gradient(180deg,rgba(5,4,10,.7),rgba(5,4,10,.3));border-bottom:1px solid var(--stroke)}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;letter-spacing:.5px;font-size:18px}
.brand-logo{width:40px;height:40px;border-radius:12px;background:conic-gradient(from 210deg,var(--violet),var(--blue),var(--gold),var(--violet));box-shadow:0 0 30px rgba(138,92,255,.55),inset 0 0 10px rgba(255,255,255,.25);position:relative;overflow:hidden}
.brand-logo::after{content:"";position:absolute;inset:4px;border-radius:7px;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.7),rgba(255,255,255,0) 60%),#0a0818}
.brand-logo-photo::after{display:none}
.brand-logo-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:contrast(1.08) saturate(1.08)}
.brand small{display:block;font-weight:500;font-size:10px;color:var(--ink-dim);letter-spacing:2px;text-transform:uppercase}
.nav-links{display:flex;gap:4px;align-items:center}
.nav-links a{color:var(--ink);padding:9px 14px;border-radius:12px;font-size:14px;font-weight:500;opacity:.8;transition:all .2s}
.nav-links a:hover,.nav-links a.active{background:rgba(138,92,255,.12);opacity:1;color:var(--violet2)}
.nav-cta{display:flex;gap:10px;align-items:center}
.lang-switch{display:inline-flex;border:1px solid rgba(160,200,255,.18);border-radius:8px;overflow:hidden;font:600 11px/1 'JetBrains Mono',monospace}
.lang-switch .lang-btn{background:transparent;color:var(--ink-dim);border:none;padding:6px 9px;cursor:pointer;letter-spacing:.5px;transition:background .15s,color .15s}
.lang-switch .lang-btn:hover{background:rgba(62,160,255,.08);color:var(--ink)}
.lang-switch .lang-btn.active{background:linear-gradient(135deg,#3ea0ff,#8a5cff);color:#fff}

.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:14px;border:1px solid var(--stroke);background:var(--glass);color:var(--ink);font-weight:600;font-size:14px;cursor:pointer;transition:all .2s;text-decoration:none}
.btn:hover{border-color:var(--stroke-hot);transform:translateY(-1px);box-shadow:0 10px 30px -10px rgba(138,92,255,.4)}
.btn-primary{background:linear-gradient(135deg,var(--violet),var(--blue));border-color:transparent;color:#fff;box-shadow:0 10px 30px -8px rgba(138,92,255,.55)}
.btn-primary:hover{box-shadow:0 14px 40px -8px rgba(138,92,255,.8);color:#fff}
.btn-gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#1a1000;border-color:transparent}
.btn-ghost{background:transparent}

/* ============ HERO ============ */
.hero{position:relative;min-height:100vh;padding:120px 32px 40px;overflow:hidden}
.zeus-scene{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.zeus-hero-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;filter:contrast(1.12) saturate(1.16) brightness(.84);transform:scale(1.02);animation:zeusDrift 18s ease-in-out infinite}
.zeus-vignette{position:absolute;inset:0;background:
  radial-gradient(62% 62% at 50% 30%,rgba(255,228,160,.19),rgba(255,228,160,0) 58%),
  linear-gradient(180deg,rgba(3,2,8,.08) 0%,rgba(3,2,8,.38) 44%,rgba(3,2,8,.66) 100%)}
.zeus-stars{position:absolute;inset:0;opacity:.55;background-image:
  radial-gradient(circle at 14% 20%,rgba(255,255,255,.85) 0 1px,transparent 2px),
  radial-gradient(circle at 72% 16%,rgba(255,255,255,.9) 0 1px,transparent 2px),
  radial-gradient(circle at 84% 36%,rgba(255,255,255,.75) 0 1px,transparent 2px),
  radial-gradient(circle at 26% 54%,rgba(255,255,255,.7) 0 1px,transparent 2px),
  radial-gradient(circle at 58% 72%,rgba(255,255,255,.75) 0 1px,transparent 2px);
  animation:zeusTwinkle 5.8s ease-in-out infinite;
}
.zeus-halo{position:absolute;border-radius:50%;filter:blur(24px);mix-blend-mode:screen;opacity:.45}
.zeus-halo-a{width:56vw;height:56vw;max-width:760px;max-height:760px;left:50%;top:-18%;transform:translateX(-50%);background:radial-gradient(circle,rgba(255,215,140,.46),rgba(255,215,140,0) 62%)}
.zeus-halo-b{width:48vw;height:48vw;max-width:620px;max-height:620px;left:8%;top:12%;background:radial-gradient(circle,rgba(111,211,255,.26),rgba(111,211,255,0) 66%);animation:haloDrift 12s ease-in-out infinite}
@keyframes zeusDrift{0%,100%{transform:scale(1.03) translate3d(0,0,0)}50%{transform:scale(1.06) translate3d(0,-1.6%,0)}}
@keyframes zeusTwinkle{0%,100%{opacity:.5}50%{opacity:.78}}
@keyframes haloDrift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(2.2%,-1.4%,0)}}
@media(max-width:900px){.zeus-hero-image{object-position:58% center;filter:contrast(1.1) saturate(1.14) brightness(.8)}}
.hero-fx{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}
.fx-orb{position:absolute;border-radius:50%;filter:blur(30px);opacity:.45;mix-blend-mode:screen;animation:orbFloat 16s ease-in-out infinite}
.fx-orb-a{width:42vw;height:42vw;max-width:620px;max-height:620px;left:-8vw;top:8vh;background:radial-gradient(circle at 35% 35%,rgba(138,92,255,.9),rgba(138,92,255,0) 62%)}
.fx-orb-b{width:34vw;height:34vw;max-width:500px;max-height:500px;right:-10vw;top:18vh;background:radial-gradient(circle at 45% 45%,rgba(62,160,255,.85),rgba(62,160,255,0) 65%);animation-delay:-6s}
.fx-orb-c{width:26vw;height:26vw;max-width:360px;max-height:360px;left:40vw;bottom:-10vh;background:radial-gradient(circle at 50% 50%,rgba(111,211,255,.78),rgba(111,211,255,0) 62%);animation-delay:-11s}
.fx-grid{position:absolute;inset:0;background:
  linear-gradient(to right, rgba(111,211,255,.08) 1px, transparent 1px),
  linear-gradient(to bottom, rgba(111,211,255,.06) 1px, transparent 1px);
  background-size:64px 64px;
  transform:perspective(900px) rotateX(62deg) translateY(48%);
  transform-origin:center bottom;
  opacity:.25;
}
.fx-scan{position:absolute;inset:-20% 0 auto;height:45%;background:linear-gradient(180deg,rgba(111,211,255,.22),rgba(111,211,255,0));filter:blur(10px);animation:scanDrop 7s linear infinite}
@keyframes orbFloat{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-3%,0) scale(1.06)}}
@keyframes scanDrop{0%{transform:translateY(-120%)}100%{transform:translateY(210%)}}
.hero-canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
.hero-canvas canvas{width:100% !important;height:100% !important;display:block}
.galaxy-bg{position:fixed;inset:0;z-index:0;pointer-events:none}
.galaxy-bg canvas{width:100vw !important;height:100vh !important;display:block;opacity:.9}
.hero-grid{position:relative;z-index:3;display:grid;grid-template-columns:1.35fr 1fr;gap:40px;align-items:center;max-width:1480px;margin:0 auto;min-height:calc(100vh - 160px)}
.hero-copy{padding:20px 0}
.hero-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;border:1px solid var(--stroke);background:var(--glass);font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--violet2)}
.hero-eyebrow .dot{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 10px var(--ok);animation:pulse 1.8s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.85)}}
.hero h1{font-size:clamp(44px,6vw,88px);line-height:1.02;margin:20px 0 22px;letter-spacing:-1.5px;font-weight:700}
.hero h1 .grad{background:linear-gradient(120deg,#fff 0%,var(--violet2) 40%,var(--blue2) 75%,var(--gold) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 30px rgba(138,92,255,.35))}
.hero p.lead{font-size:clamp(15px,1.3vw,19px);color:var(--ink-dim);max-width:640px;line-height:1.6;margin:0 0 30px}
.hero-cta{display:flex;gap:14px;flex-wrap:wrap}
.hero-stats{margin-top:38px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;max-width:640px}
.hero-stat{padding:14px 16px;border:1px solid var(--stroke);border-radius:14px;background:var(--glass)}
.hero-stat b{display:block;font-size:20px;color:#fff;background:linear-gradient(120deg,var(--violet2),var(--blue2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:700}
.hero-stat span{font-size:11px;color:var(--ink-dim);letter-spacing:1.5px;text-transform:uppercase}

.hero-side{position:relative;display:flex;flex-direction:column;gap:20px;align-items:flex-end;z-index:3}
.hero-copy,.hero-side{text-shadow:0 2px 18px rgba(0,0,0,.46)}
.tourbillon-wrap{position:relative;width:420px;max-width:100%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle at 30% 30%,rgba(138,92,255,.2),transparent 60%),radial-gradient(circle at 70% 70%,rgba(62,160,255,.14),transparent 55%),rgba(10,8,24,.55);backdrop-filter:blur(18px);border:1px solid var(--stroke-hot);box-shadow:var(--shadow),inset 0 0 60px rgba(138,92,255,.2);transform:perspective(900px) rotateX(var(--watch-rx,0deg)) rotateY(var(--watch-ry,0deg));transition:transform .2s ease}
.tourbillon-wrap canvas{position:absolute;inset:0;width:100% !important;height:100% !important;border-radius:50%}
.watch-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;filter:contrast(1.08) saturate(1.1) brightness(.88)}
.watch-gear{position:absolute;border:2px solid rgba(111,211,255,.55);border-radius:50%;box-shadow:0 0 26px rgba(111,211,255,.28),inset 0 0 18px rgba(138,92,255,.3);backdrop-filter:blur(1px)}
.watch-gear::before{content:"";position:absolute;inset:10%;border-radius:50%;border:1px dashed rgba(255,211,106,.45)}
.watch-gear-a{width:32%;height:32%;left:8%;top:20%;animation:gearSpin 12s linear infinite}
.watch-gear-b{width:42%;height:42%;right:10%;top:12%;animation:gearSpinRev 16s linear infinite}
.watch-gear-c{width:36%;height:36%;right:18%;bottom:10%;animation:gearSpin 10s linear infinite}
@keyframes gearSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes gearSpinRev{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
.tourbillon-label{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 18px;border:1px solid var(--stroke);border-radius:14px;background:var(--glass);width:420px;max-width:100%}
.tourbillon-label b{color:var(--gold);letter-spacing:2px;font-size:12px;text-transform:uppercase}
.tourbillon-label span{font-family:var(--mono);font-size:13px;color:var(--ink-dim)}

/* ============ SECTIONS ============ */
section{position:relative;z-index:3;padding:80px 32px;max-width:1480px;margin:0 auto}
.section-title{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:32px;gap:24px;flex-wrap:wrap}
.section-title h2{font-size:clamp(30px,3.2vw,44px);margin:0;font-weight:700;letter-spacing:-.5px}
.section-title h2 .grad{background:linear-gradient(120deg,#fff,var(--violet2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.section-title p{color:var(--ink-dim);max-width:520px;margin:0;font-size:15px;line-height:1.6}
.kicker{display:inline-block;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:var(--violet2);margin-bottom:10px}

/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.card{position:relative;padding:22px;border-radius:var(--radius);border:1px solid var(--stroke);background:linear-gradient(180deg,var(--glass),rgba(10,8,24,.3));backdrop-filter:blur(var(--autotune-blur));transition:all .25s;overflow:hidden}
.card::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(138,92,255,.35),transparent 50%,rgba(62,160,255,.25));-webkit-mask:linear-gradient(#000,#000) content-box,linear-gradient(#000,#000);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.4;transition:opacity .3s}
.card:hover{transform:translateY(-3px);border-color:var(--stroke-hot);box-shadow:0 24px 60px -20px rgba(138,92,255,calc(.35 * var(--autotune-glow)))}
.card:hover::before{opacity:1}
.card[data-tilt]{transform-style:preserve-3d;will-change:transform}
.card h3{margin:0 0 8px;font-size:18px;font-weight:650}
.card .tag{display:inline-block;padding:3px 10px;font-size:10px;letter-spacing:2px;text-transform:uppercase;border-radius:999px;background:rgba(138,92,255,.15);color:var(--violet2);margin-bottom:12px}
.card p{color:var(--ink-dim);font-size:14px;line-height:1.55;margin:0 0 14px}
.card .row{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--ink-dim);border-top:1px solid var(--stroke);padding-top:12px;margin-top:12px}
.card .row b{color:var(--gold);font-family:var(--mono)}

.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.chip{padding:8px 14px;border-radius:999px;border:1px solid var(--stroke);background:var(--glass);color:var(--ink-dim);cursor:pointer;font-size:13px;font-weight:500;transition:all .2s}
.chip:hover,.chip.on{color:#fff;border-color:var(--stroke-hot);background:rgba(138,92,255,.18)}

/* features panels */
.panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.panel{padding:22px;border-radius:var(--radius);border:1px solid var(--stroke);background:linear-gradient(180deg,rgba(138,92,255,.07),rgba(10,8,24,.3));backdrop-filter:blur(calc(var(--autotune-blur) - 2px));position:relative}
.panel[data-tilt]{transform-style:preserve-3d;will-change:transform}

.cinema-boost .card{border-color:rgba(111,211,255,.35)}
.cinema-boost .hero h1 .grad{filter:drop-shadow(0 0 46px rgba(138,92,255,.55))}
.cinema-boost .tourbillon-wrap{box-shadow:0 40px 110px -20px rgba(138,92,255,.65),inset 0 0 80px rgba(138,92,255,.28)}
.perf-safe-mode .hero-fx,.perf-safe-mode .fx-scan{display:none}
.perf-safe-mode .im-tile::before{animation-duration:12s;opacity:.35}
.perf-safe-mode{--autotune-blur:8px;--autotune-glow:.55}

/* immersive cinematic strip */
.immersive-strip{position:relative;z-index:3;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:0;padding-top:0}
.im-tile{position:relative;padding:18px 16px;border-radius:14px;border:1px solid var(--stroke);background:linear-gradient(135deg,rgba(138,92,255,.12),rgba(62,160,255,.08));backdrop-filter:blur(10px);overflow:hidden;transform-style:preserve-3d;transition:transform .22s,border-color .22s,box-shadow .22s}
.im-tile::before{content:"";position:absolute;inset:-120% -20%;background:linear-gradient(120deg,transparent,rgba(255,255,255,.28),transparent);transform:translateX(-40%) rotate(8deg);animation:tileSweep 6s linear infinite}
.im-tile span{display:block;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--blue2);margin-bottom:8px}
.im-tile b{font-size:14px;letter-spacing:.2px}
.im-tile:hover{border-color:var(--stroke-hot);box-shadow:0 18px 45px -16px rgba(62,160,255,.45)}
@keyframes tileSweep{0%{transform:translateX(-120%) rotate(8deg)}100%{transform:translateX(160%) rotate(8deg)}}

/* service cinematic narrative */
.svc-cine-card{position:relative;padding:18px;border-radius:20px;border:1px solid rgba(111,211,255,.2);background:linear-gradient(180deg,rgba(18,14,40,.35),rgba(10,8,24,.3))}
.svc-storyline{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:18px}
.svc-step{padding:12px;border-radius:12px;border:1px solid var(--stroke);background:rgba(10,8,24,.35)}
.svc-step span{display:block;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--blue2);margin-bottom:6px}
.svc-step b{display:block;font-size:14px;margin-bottom:6px}
.svc-step p{margin:0;color:var(--ink-dim);font-size:12.5px;line-height:1.5}
.svc-unlock{margin-top:14px;padding:14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(8,6,18,.45)}
.svc-unlock-top{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px}
.svc-unlock-top span{font-family:var(--mono);color:var(--gold)}
.svc-unlock-bar{margin-top:10px;height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
.svc-unlock-bar i{display:block;height:100%;width:0%;background:linear-gradient(90deg,var(--violet),var(--blue),var(--gold));transition:width .16s ease}
.cinema-unlocked{box-shadow:0 0 0 1px rgba(111,211,255,.65),0 20px 46px -18px rgba(111,211,255,.55)}

/* section reveal motion */
section[data-reveal]{opacity:0;transform:translateY(20px) scale(.99);transition:opacity .65s ease,transform .65s cubic-bezier(.2,.8,.2,1)}
section[data-reveal].revealed{opacity:1;transform:translateY(0) scale(1)}

/* holographic button polish */
.btn{position:relative;overflow:hidden}
.btn::after{content:"";position:absolute;inset:-120% -30%;background:linear-gradient(120deg,transparent,rgba(255,255,255,.34),transparent);transform:translateX(-120%);transition:transform .55s ease}
.btn:hover::after{transform:translateX(120%)}
.panel .ic{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--violet),var(--blue));box-shadow:0 8px 22px -6px rgba(138,92,255,.6);margin-bottom:14px;font-size:20px}
.panel h4{margin:0 0 8px;font-size:16px;font-weight:650}
.panel p{margin:0;color:var(--ink-dim);font-size:13.5px;line-height:1.55}

/* pricing table */
.pricing{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.plan{padding:26px;border-radius:var(--radius-lg);border:1px solid var(--stroke);background:linear-gradient(180deg,var(--glass),rgba(10,8,24,.4));backdrop-filter:blur(12px);position:relative}
.plan.highlight{border-color:transparent;background:linear-gradient(180deg,rgba(138,92,255,.18),rgba(62,160,255,.08));box-shadow:var(--shadow),inset 0 0 0 1px rgba(138,92,255,.4)}
.plan h3{margin:0 0 6px;font-size:20px}
.plan .price{font-size:40px;font-weight:700;margin:8px 0 2px;background:linear-gradient(120deg,#fff,var(--violet2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.plan .price small{font-size:14px;color:var(--ink-dim);font-weight:500;-webkit-text-fill-color:var(--ink-dim)}
.plan ul{list-style:none;padding:0;margin:18px 0;display:flex;flex-direction:column;gap:10px}
.plan li{padding-left:24px;position:relative;color:var(--ink-dim);font-size:14px;line-height:1.4}
.plan li::before{content:"";position:absolute;left:0;top:7px;width:12px;height:12px;border-radius:3px;background:linear-gradient(135deg,var(--violet),var(--blue))}

/* checkout */
.checkout{display:grid;grid-template-columns:1.2fr 1fr;gap:28px}
@media(max-width:900px){.checkout{grid-template-columns:1fr}}
.co-box{padding:26px;border-radius:var(--radius-lg);border:1px solid var(--stroke);background:var(--glass);backdrop-filter:blur(10px)}
.co-method{display:flex;gap:10px;margin-bottom:18px}
.co-method .chip{flex:1;justify-content:center;display:flex;padding:12px}
.co-method .chip.on{background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;border-color:transparent}
.co-qr{aspect-ratio:1/1;border-radius:var(--radius);background:#fff;padding:14px;display:flex;align-items:center;justify-content:center}
.co-qr canvas{width:100%;height:100%}
.btc-addr{font-family:var(--mono);font-size:12px;word-break:break-all;background:rgba(0,0,0,.35);padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);margin-top:12px;color:var(--gold2)}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.field label{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-dim)}
.field input,.field select{padding:12px 14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.5);color:var(--ink);font-size:14px;font-family:inherit}
.field input:focus,.field select:focus{outline:none;border-color:var(--stroke-hot);box-shadow:0 0 0 3px rgba(138,92,255,.15)}

/* dashboard */
.dash-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
@media(max-width:900px){.dash-grid{grid-template-columns:repeat(2,1fr)}}
.kpi{padding:18px;border-radius:var(--radius);border:1px solid var(--stroke);background:var(--glass)}
.kpi small{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-dim)}
.kpi b{display:block;font-size:24px;margin-top:6px;color:#fff;font-family:var(--mono)}

/* footer */
footer{position:relative;z-index:3;padding:60px 32px 40px;border-top:1px solid var(--stroke);background:linear-gradient(180deg,transparent,rgba(0,0,0,.35));margin-top:80px}
.foot-grid{max-width:1480px;margin:0 auto;display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:30px}
.foot-grid h5{margin:0 0 12px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--violet2)}
.foot-grid ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
.foot-grid li a{color:var(--ink-dim);font-size:13.5px}
.foot-grid li a:hover{color:var(--ink)}
.foot-bot{max-width:1480px;margin:30px auto 0;padding-top:20px;border-top:1px solid var(--stroke);display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--ink-dim)}

/* AI concierge */
.concierge{position:fixed;right:22px;bottom:22px;z-index:50}
.concierge-btn{width:62px;height:62px;border-radius:50%;background:conic-gradient(from 0deg,var(--violet),var(--blue),var(--gold),var(--violet));border:none;cursor:pointer;box-shadow:0 0 40px rgba(138,92,255,.55),0 10px 30px -6px rgba(0,0,0,.5);color:#fff;font-size:28px;display:flex;align-items:center;justify-content:center;transition:transform .2s}
.concierge-btn:hover{transform:scale(1.08)}
.concierge-btn::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px solid var(--stroke-hot);animation:haloPulse 2.4s infinite}
@keyframes haloPulse{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.4);opacity:0}}
.concierge-panel{position:absolute;right:0;bottom:80px;width:400px;max-width:calc(100vw - 32px);height:560px;max-height:82vh;border-radius:22px;border:1px solid var(--stroke-hot);background:linear-gradient(180deg,var(--glass-strong),rgba(10,8,24,.95));backdrop-filter:blur(20px);display:none;flex-direction:column;overflow:hidden;box-shadow:var(--shadow)}
.concierge-panel.open{display:flex}
.concierge-head{padding:14px 18px;border-bottom:1px solid var(--stroke);display:flex;align-items:center;gap:10px;font-weight:600}
.concierge-head .dot{width:9px;height:9px;border-radius:50%;background:var(--ok);box-shadow:0 0 10px var(--ok)}
.concierge-head .meta{margin-left:auto;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-dim);font-weight:500}
.concierge-body{flex:1;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
.concierge-body::-webkit-scrollbar{width:6px}
.concierge-body::-webkit-scrollbar-thumb{background:rgba(138,92,255,.3);border-radius:3px}
.msg{padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.55;max-width:88%;white-space:pre-wrap;word-wrap:break-word;animation:msgIn .25s ease-out}
@keyframes msgIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.msg.bot{background:rgba(138,92,255,.12);align-self:flex-start;border:1px solid var(--stroke)}
.msg.user{background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;align-self:flex-end}
.msg.typing{align-self:flex-start;padding:12px 16px;background:rgba(138,92,255,.1);border:1px solid var(--stroke);border-radius:14px;display:flex;gap:5px}
.msg.typing span{width:7px;height:7px;border-radius:50%;background:var(--violet);animation:typingDot 1.2s infinite ease-in-out}
.msg.typing span:nth-child(2){animation-delay:.2s}
.msg.typing span:nth-child(3){animation-delay:.4s}
@keyframes typingDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
.rec-list{display:flex;flex-direction:column;gap:8px;align-self:stretch;margin:2px 0}
.rec-card{border:1px solid var(--stroke-hot);border-radius:14px;padding:12px 14px;background:linear-gradient(135deg,rgba(138,92,255,.1),rgba(111,211,255,.06));display:flex;flex-direction:column;gap:6px;transition:transform .15s,border-color .15s}
.rec-card:hover{transform:translateY(-1px);border-color:var(--violet)}
.rec-card .rec-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.rec-card .rec-title{font-weight:600;font-size:13.5px;color:#fff}
.rec-card .rec-price{font-weight:700;font-size:13px;color:var(--gold);white-space:nowrap}
.rec-card .rec-desc{font-size:12px;color:var(--ink-dim);line-height:1.45}
.rec-card .rec-buy{margin-top:4px;padding:7px 12px;border-radius:9px;border:none;background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;font-weight:600;font-size:12px;cursor:pointer;letter-spacing:.02em;align-self:flex-start;font-family:inherit}
.rec-card .rec-buy:hover{filter:brightness(1.15)}
.chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}
.chip{padding:6px 12px;border-radius:999px;border:1px solid var(--stroke);background:rgba(138,92,255,.08);color:var(--ink);font-size:12px;cursor:pointer;font-family:inherit;transition:all .15s}
.chip:hover{border-color:var(--violet);background:rgba(138,92,255,.18)}
.concierge-foot{padding:12px;border-top:1px solid var(--stroke);display:flex;gap:8px}
.concierge-foot input{flex:1;padding:10px 14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-size:13.5px;font-family:inherit}
.concierge-foot input:focus{outline:none;border-color:var(--stroke-hot)}
.concierge-foot button{padding:10px 16px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;font-weight:600;cursor:pointer;font-family:inherit;font-size:13.5px}
.concierge-foot button:disabled{opacity:.5;cursor:not-allowed}

/* ===== Zeus-30Y enhancements ===== */
.concierge-panel.fullscreen{position:fixed;inset:16px;width:auto;max-width:none;height:auto;max-height:none;bottom:16px;right:16px}
.cc-tools{display:flex;gap:4px;margin-left:8px}
.cc-tool{width:28px;height:28px;border-radius:8px;border:1px solid var(--stroke);background:rgba(138,92,255,.08);color:var(--ink);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;font-family:inherit;transition:all .15s}
.cc-tool:hover{border-color:var(--violet);background:rgba(138,92,255,.18)}
.cc-tool.on{background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;border-color:transparent}
.cc-tool.listening{background:linear-gradient(135deg,#ff3d6e,#ff8c42);color:#fff;border-color:transparent;animation:micPulse 1.1s infinite}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,61,110,.55)}50%{box-shadow:0 0 0 8px rgba(255,61,110,0)}}
.msg{position:relative}
.msg .msg-body{word-wrap:break-word}
.msg .msg-body a{color:var(--violet2);text-decoration:underline}
.msg .msg-body strong{color:#fff}
.msg .msg-body .md-code{font-family:var(--mono);background:rgba(0,0,0,.35);padding:1px 6px;border-radius:5px;font-size:12px;color:var(--violet2)}
.msg .msg-body .md-pre{font-family:var(--mono);background:rgba(0,0,0,.5);border:1px solid var(--stroke);padding:10px;border-radius:10px;margin:6px 0;overflow-x:auto;font-size:12px;line-height:1.5;white-space:pre}
.msg-tools{display:flex;gap:4px;margin-top:6px;opacity:0;transition:opacity .15s}
.msg:hover .msg-tools,.msg-tools:focus-within{opacity:.9}
.mt-btn{width:26px;height:26px;border-radius:7px;border:1px solid var(--stroke);background:rgba(0,0,0,.25);cursor:pointer;font-size:12px;color:var(--ink-dim);font-family:inherit;transition:all .15s}
.mt-btn:hover{border-color:var(--violet);color:#fff;background:rgba(138,92,255,.18)}
.stream-caret{display:inline-block;animation:caretBlink 1s steps(2) infinite;color:var(--violet2);font-weight:700}
@keyframes caretBlink{0%,50%{opacity:1}51%,100%{opacity:0}}
.action-pills{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0;align-self:stretch}
.action-pill{padding:7px 12px;border-radius:10px;border:1px solid var(--stroke-hot);background:linear-gradient(135deg,rgba(138,92,255,.18),rgba(111,211,255,.12));color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:transform .12s,filter .12s}
.action-pill:hover{transform:translateY(-1px);filter:brightness(1.15)}
.svc-cards{display:flex;flex-direction:column;gap:8px;align-self:stretch;margin:2px 0}
.svc-card{border:1px solid rgba(59,255,176,.35);border-radius:12px;padding:10px 12px;background:linear-gradient(135deg,rgba(59,255,176,.08),rgba(111,211,255,.04));display:flex;flex-direction:column;gap:6px}
.svc-card .svc-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13.5px}
.svc-card .svc-badge.ok{font-size:9.5px;letter-spacing:.14em;padding:2px 8px;border-radius:999px;background:rgba(59,255,176,.18);color:#3bffb0;font-weight:700}
.svc-card .svc-meta{font-size:11px;color:var(--ink-dim)}
.svc-card .svc-actions{display:flex;gap:6px}
.svc-card .btn-mini{padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--stroke);background:rgba(138,92,255,.12);color:#fff;text-decoration:none;cursor:pointer;font-family:inherit}
.svc-card .btn-mini:hover{border-color:var(--violet);background:rgba(138,92,255,.22)}
.concierge-foot textarea{flex:1;padding:10px 14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-size:13.5px;font-family:inherit;resize:none;max-height:140px;line-height:1.45}
.concierge-foot textarea:focus{outline:none;border-color:var(--stroke-hot)}
@media(max-width:640px){
  .concierge-panel{width:calc(100vw - 24px);right:-10px;height:78vh;bottom:80px}
  .concierge-panel.fullscreen{inset:8px}
}

/* toasts */
.toasts{position:fixed;top:82px;right:22px;z-index:60;display:flex;flex-direction:column;gap:10px}
.toast{padding:12px 16px;border-radius:12px;border:1px solid var(--stroke-hot);background:var(--glass-strong);backdrop-filter:blur(12px);font-size:13.5px;box-shadow:var(--shadow);max-width:360px;animation:toastIn .35s ease-out}
.toast.ok{border-color:rgba(59,255,176,.4)}
.toast.err{border-color:rgba(255,61,110,.4)}
@keyframes toastIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}

/* table */
table.doc{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px}
table.doc th,table.doc td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--stroke)}
table.doc th{color:var(--violet2);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600}
code.inline{font-family:var(--mono);background:rgba(138,92,255,.12);padding:1px 7px;border-radius:6px;font-size:12.5px;color:var(--violet2)}
pre.code{font-family:var(--mono);background:rgba(0,0,0,.45);border:1px solid var(--stroke);padding:16px;border-radius:12px;overflow-x:auto;font-size:12.5px;line-height:1.55;color:#d8e0ff}

/* responsive */
@media(max-width:1100px){
  .hero-grid{grid-template-columns:1fr;gap:30px}
  .hero-side{align-items:center}
  .tourbillon-wrap,.tourbillon-label{width:min(380px,90vw)}
  .hero-stats{grid-template-columns:repeat(2,1fr)}
  .foot-grid{grid-template-columns:1fr 1fr}
  .immersive-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:640px){
  .nav{padding:14px 16px}
  .nav-links{display:none}
  .hero{padding:100px 18px 30px}
  section{padding:50px 18px}
  footer{padding:40px 18px 30px}
  .foot-grid{grid-template-columns:1fr}
  .immersive-strip{grid-template-columns:1fr}
}

/* View Transitions API */
::view-transition-old(root),::view-transition-new(root){animation-duration:.42s;animation-timing-function:cubic-bezier(.22,.8,.2,1)}
::view-transition-old(root){animation-name:uVtOut}
::view-transition-new(root){animation-name:uVtIn}
@keyframes uVtOut{to{opacity:0;filter:blur(6px) brightness(1.4);transform:scale(1.02)}}
@keyframes uVtIn{from{opacity:0;filter:blur(8px) brightness(.6);transform:scale(.98)}}

/* Reduced motion */
.reduced-motion *{animation:none !important;transition:none !important}
.reduced-motion .hero-canvas canvas,.reduced-motion #tourbillon{display:none}
.reduced-motion .tourbillon-wrap{background:linear-gradient(135deg,var(--violet),var(--blue))}

/* High contrast */
@media (prefers-contrast: more){ :root{ --ink-dim:#cfd8ff; --stroke:rgba(200,200,255,0.5) } }

/* RTL */
[dir="rtl"] .nav-cta{flex-direction:row-reverse}
/* === Interactive pillar cards === */
.panel.pillar{cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}
.panel.pillar:hover,.panel.pillar:focus{transform:translateY(-3px);border-color:var(--violet);box-shadow:0 14px 34px -12px rgba(138,92,255,.5);outline:none}
.panel.pillar.active{border-color:var(--violet);box-shadow:0 0 0 2px rgba(138,92,255,.35)}
.pillar-cta{display:inline-block;margin-top:12px;font-size:12px;font-weight:600;color:var(--violet);letter-spacing:.02em}
.pillar-live{margin-top:18px;border-radius:var(--radius)}
.pillar-live:empty{display:none}
.pillar-live .pl-card{padding:22px;border-radius:var(--radius);border:1px solid var(--violet);background:linear-gradient(180deg,rgba(138,92,255,.10),rgba(10,8,24,.55));backdrop-filter:blur(10px)}
.pillar-live .pl-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
.pillar-live .pl-head h3{margin:0;font-size:17px}
.pillar-live .pl-close{background:transparent;border:1px solid var(--stroke);color:var(--ink-dim);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px}
.pillar-live .pl-close:hover{color:var(--ink);border-color:var(--violet)}
.pillar-live .pl-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}
.pillar-live .pl-stat{padding:12px;border-radius:10px;background:rgba(10,8,24,.45);border:1px solid var(--stroke)}
.pillar-live .pl-stat .lbl{font-size:11px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.06em}
.pillar-live .pl-stat .val{font-size:18px;font-weight:700;margin-top:4px;word-break:break-all}
.pillar-live .pl-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pillar-live .pl-btn{padding:10px 16px;border-radius:10px;border:1px solid var(--violet);background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;font-weight:600;font-size:13px;cursor:pointer}
.pillar-live .pl-btn.ghost{background:transparent;color:var(--violet)}
.pillar-live .pl-btn:disabled{opacity:.5;cursor:not-allowed}
.pillar-live .pl-output{margin-top:12px;padding:12px;border-radius:10px;background:rgba(0,0,0,.35);border:1px solid var(--stroke);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:var(--ink);max-height:340px;overflow:auto;white-space:pre-wrap;word-break:break-all}
.pillar-live .pl-list{margin:10px 0 0;padding:0;list-style:none;max-height:260px;overflow:auto}
.pillar-live .pl-list li{padding:8px 10px;border-bottom:1px solid var(--stroke);font-size:12.5px;color:var(--ink-dim)}
.pillar-live .pl-list li:last-child{border-bottom:none}
.pillar-live .pl-list b{color:var(--ink)}
.pillar-live input,.pillar-live textarea,.pillar-live select{width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--stroke);background:rgba(10,8,24,.5);color:var(--ink);font-size:13px;font-family:inherit;margin-top:6px}
.pillar-live label{display:block;font-size:11.5px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.06em;margin-top:10px}
.pillar-live .pl-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

`;
