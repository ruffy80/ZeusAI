// UNICORN V2 — cinematic dark/electric styles
// Original work, © Vladoi Ionut
'use strict';

module.exports.CSS = `
/* Note: Google Fonts (Space Grotesk + JetBrains Mono + Cinzel + Orbitron) are
   loaded via a single non-render-blocking <link> in src/site/v2/shell.js.
   We intentionally do NOT @import them here to avoid a render-blocking
   chained request that hurts FCP/LCP. */
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
body{min-height:100vh;background:radial-gradient(1400px 900px at 50% 0%,rgba(138,92,255,.12),transparent 55%),radial-gradient(1200px 800px at 100% 100%,rgba(62,160,255,.08),transparent 60%),linear-gradient(180deg,#05040a 0%,#0a0818 100%);position:relative}
a{color:var(--blue2);text-decoration:none}
a:hover{color:var(--violet2)}
img{max-width:100%;display:block}
button{font-family:inherit}

/* ZEUS dual-image background, visible on every v2 page */
body::before,
body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background-repeat:no-repeat;background-size:cover;opacity:.17}
body::before{background-image:linear-gradient(180deg,rgba(5,4,10,.66),rgba(5,4,10,.74)),url('/assets/hero.jpg');background-position:center 10%;filter:contrast(1.04) saturate(1.08)}
body::after{background-image:radial-gradient(760px 520px at 84% 74%,rgba(5,4,10,.08),rgba(5,4,10,.72) 76%),url('/assets/watch.jpg');background-position:right -120px bottom -20px;background-size:760px auto;opacity:.22;mix-blend-mode:screen;filter:contrast(1.08)}

/* subtle vignette */
html::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.5) 100%);opacity:.6}

/* ============ NAV ============ */
.nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:18px 32px;backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);background:linear-gradient(180deg,rgba(5,4,10,.7),rgba(5,4,10,.3));border-bottom:1px solid var(--stroke)}
.brand{display:flex;align-items:center;gap:14px;font-weight:700;letter-spacing:.5px;font-size:18px}
.brand-logo{width:56px;height:56px;border-radius:14px;background:conic-gradient(from 210deg,var(--violet),var(--blue),var(--gold),var(--violet));box-shadow:0 0 30px rgba(138,92,255,.55),inset 0 0 10px rgba(255,255,255,.25);position:relative;overflow:hidden}
.brand-logo::after{content:"";position:absolute;inset:4px;border-radius:7px;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.7),rgba(255,255,255,0) 60%),#0a0818}
.brand-logo-photo::after{display:none}
.brand-logo-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:contrast(1.08) saturate(1.08)}
.brand small{display:block;font-weight:500;font-size:10px;color:var(--ink-dim);letter-spacing:2.5px;text-transform:uppercase;font-family:'Orbitron',monospace;margin-top:3px;text-shadow:0 0 8px rgba(138,92,255,.4)}

/* ============ ZEUS WORDMARK · cinematic gold+silver+lightning (matches brand image) ============ */
.zeus-wordmark{
  position:relative;display:inline-flex;align-items:center;gap:.22em;
  font-family:'Cinzel',serif;font-weight:900;letter-spacing:.05em;line-height:1;
  /* GOLD METAL — bevel ridge brighter at mid, deeper shadows top/bottom (matches image) */
  background:linear-gradient(180deg,
    #3a2405 0%,
    #8a5e10 8%,
    #d8a534 22%,
    #ffe48a 42%,
    #fff7c2 50%,
    #ffd36a 58%,
    #c98a18 78%,
    #6a4208 92%,
    #2a1a02 100%);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent;
  -webkit-text-stroke:.6px rgba(40,22,2,.7);
  filter:drop-shadow(0 1px 0 rgba(0,0,0,.7))
         drop-shadow(0 0 14px rgba(255,200,80,.4));
  animation:zeusGoldPulse 3.6s ease-in-out infinite;
}
.zeus-wordmark .ai{
  position:relative;
  font-family:'Cinzel',serif;font-weight:900;font-size:1em;letter-spacing:.07em;margin-left:.18em;
  /* SILVER / CHROME — mirror bevel */
  background:linear-gradient(180deg,
    #181d2a 0%,
    #4d586d 10%,
    #8e9aae 24%,
    #d8e0ed 42%,
    #ffffff 50%,
    #cfd8e6 58%,
    #7d8a9f 78%,
    #2a3140 92%,
    #0e131e 100%);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent;
  -webkit-text-stroke:.6px rgba(15,22,38,.7);
  filter:drop-shadow(0 1px 0 rgba(0,0,0,.7))
         drop-shadow(0 0 12px rgba(180,210,255,.4));
  animation:zeusSilverPulse 3.6s ease-in-out infinite;
}
/* LIGHTNING BOLT — vertical, electric blue-white, sits between ZEUS and AI */
.zeus-wordmark .ai::before{
  content:"";display:inline-block;vertical-align:middle;
  width:.42em;height:1.42em;margin:0 .18em 0 -.04em;
  background:linear-gradient(180deg,
    #ffffff 0%,
    #dff5ff 18%,
    #7ec4ff 38%,
    #00E6FF 52%,
    #9fe7ff 70%,
    #ffffff 88%,
    #bfeeff 100%);
  -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 64' preserveAspectRatio='none'><path d='M17 0 L3 32 L11 32 L9 64 L25 28 L15 28 Z' fill='black'/></svg>") no-repeat center/contain;
          mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 64' preserveAspectRatio='none'><path d='M17 0 L3 32 L11 32 L9 64 L25 28 L15 28 Z' fill='black'/></svg>") no-repeat center/contain;
  filter:drop-shadow(0 0 4px #ffffff)
         drop-shadow(0 0 12px #00E6FF)
         drop-shadow(0 0 28px #0098c0)
         drop-shadow(0 0 50px rgba(0,230,255,.45));
  animation:zeusBoltPulse 1.8s ease-in-out infinite, zeusBoltFlicker 5.5s linear infinite;
  transform-origin:center;
}
/* faint vertical electric crack trail behind the bolt */
.zeus-wordmark::before{
  content:"";position:absolute;left:50%;top:-22%;bottom:-22%;width:2px;transform:translateX(-50%);
  background:linear-gradient(180deg,
    transparent 0%,
    rgba(0,230,255,.45) 30%,
    rgba(180,235,255,.85) 50%,
    rgba(0,230,255,.45) 70%,
    transparent 100%);
  filter:blur(1.4px);z-index:-1;pointer-events:none;
  animation:zeusBoltFlicker 5.5s linear infinite;
}

@keyframes zeusGoldPulse{
  0%,100%{opacity:.85}
  50%   {opacity:1}
}
@keyframes zeusSilverPulse{
  0%,100%{opacity:.85}
  50%   {opacity:1}
}
@keyframes zeusBoltPulse{
  0%,100%{transform:scaleY(1) scaleX(1);opacity:.92}
  50%   {transform:scaleY(1.04) scaleX(1.06);opacity:1}
}
@keyframes zeusBoltFlicker{
  0%,18%,22%,42%,46%,82%,86%,100%{opacity:1}
  20%{opacity:.55}44%{opacity:.7}84%{opacity:.45}
}

.brand .zeus-wordmark{font-size:24px}
.zeus-wordmark-hero{display:inline-flex;font-size:clamp(72px,11vw,168px);margin:0 0 6px}
.zeus-wordmark-hero .ai{font-size:1em}
.zeus-wordmark-hero .ai::before{width:.46em;height:1.5em;margin:0 .22em 0 .04em}
.zeus-tagline{display:block;font-family:'Cinzel',serif;font-weight:600;font-size:clamp(11px,1.15vw,15px);letter-spacing:.42em;text-transform:uppercase;margin:6px 0 22px;opacity:0;animation:zeusFadeUp 1.4s .3s ease-out forwards;text-align:center}
.zeus-tagline .tg-a{background:linear-gradient(180deg,#b87914,#ffd36a 45%,#fff7c2 55%,#b87914);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;filter:drop-shadow(0 0 8px rgba(255,200,80,.35))}
.zeus-tagline .tg-b{background:linear-gradient(180deg,#bfeeff,#00E6FF 50%,#bfeeff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;filter:drop-shadow(0 0 8px rgba(0,230,255,.45))}
.zeus-tagline::before,.zeus-tagline::after{content:"";display:inline-block;vertical-align:middle;width:clamp(60px,9vw,140px);height:1px;margin:0 14px;background:linear-gradient(90deg,transparent,#b87914 40%,#ffd36a 50%,#b87914 60%,transparent)}
.zeus-tagline::after{background:linear-gradient(90deg,transparent,#b87914 40%,#ffd36a 50%,#b87914 60%,transparent)}
@keyframes zeusFadeUp{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){.zeus-wordmark,.zeus-wordmark::after,.zeus-wordmark::before,.zeus-wordmark .ai,.zeus-wordmark .ai::before,.zeus-tagline span{animation:none}}

.nav-links{display:flex;gap:4px;align-items:center}
.nav-links a{color:var(--ink);padding:9px 14px;border-radius:12px;font-size:14px;font-weight:500;opacity:.8;transition:transform .2s,opacity .2s,background-color .2s,border-color .2s,color .2s}
.nav-links a:hover,.nav-links a.active{background:rgba(138,92,255,.12);opacity:1;color:var(--violet2)}
.nav-more{position:relative}
.nav-more-btn{background:transparent;border:1px solid transparent;color:var(--ink);padding:9px 12px;border-radius:12px;font-size:14px;font-weight:500;opacity:.8;cursor:pointer;font-family:inherit;transition:opacity .2s,background-color .2s,border-color .2s,color .2s}
.nav-more-btn:hover,.nav-more[data-open="true"] .nav-more-btn{background:rgba(138,92,255,.12);opacity:1;color:var(--violet2);border-color:var(--stroke)}
.nav-more-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:220px;background:rgba(11,10,18,.96);border:1px solid var(--stroke);border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:2px;box-shadow:0 20px 60px -20px rgba(0,0,0,.6);z-index:60}
.nav-more-menu[hidden]{display:none}
.nav-more-menu a{padding:10px 12px;border-radius:10px;font-size:13.5px;color:var(--ink);opacity:.85;display:block}
.nav-more-menu a:hover,.nav-more-menu a.active{background:rgba(138,92,255,.14);color:var(--violet2);opacity:1}
.nav-cta{display:flex;gap:10px;align-items:center}
.lang-switch{display:inline-flex;border:1px solid rgba(160,200,255,.18);border-radius:8px;overflow:hidden;font:600 11px/1 'JetBrains Mono',monospace}
.lang-switch .lang-btn{background:transparent;color:var(--ink-dim);border:none;padding:6px 9px;cursor:pointer;letter-spacing:.5px;transition:background .15s,color .15s}
.lang-switch .lang-btn:hover{background:rgba(62,160,255,.08);color:var(--ink)}
.lang-switch .lang-btn.active{background:linear-gradient(135deg,#3ea0ff,#8a5cff);color:#fff}
/* Single small auto/EN translation toggle (replaces the EN/RO/ES bar). */
.lang-toggle{display:inline-flex;align-items:center;gap:4px;background:rgba(8,12,20,.55);color:var(--ink-dim);border:1px solid rgba(160,200,255,.22);border-radius:999px;padding:5px 11px;cursor:pointer;font:600 11px/1 'JetBrains Mono',monospace;letter-spacing:.5px;transition:transform .2s,opacity .2s,background-color .2s,border-color .2s,color .2s}
.lang-toggle:hover{background:linear-gradient(135deg,rgba(62,160,255,.18),rgba(138,92,255,.18));color:var(--ink);border-color:rgba(138,92,255,.5)}

.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:14px;border:1px solid var(--stroke);background:var(--glass);color:var(--ink);font-weight:600;font-size:14px;cursor:pointer;transition:transform .2s,opacity .2s,background-color .2s,border-color .2s,color .2s;text-decoration:none}
.btn:hover{border-color:var(--stroke-hot);transform:translateY(-1px);box-shadow:0 10px 30px -10px rgba(138,92,255,.4)}
.btn-primary{background:linear-gradient(135deg,var(--violet),var(--blue));border-color:transparent;color:#fff;box-shadow:0 10px 30px -8px rgba(138,92,255,.55)}
.btn-primary:hover{box-shadow:0 14px 40px -8px rgba(138,92,255,.8);color:#fff}
.btn-gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#1a1000;border-color:transparent}
.btn-ghost{background:transparent}

/* ============ HERO ============ */
.hero{position:relative;min-height:100vh;padding:120px 32px 40px;overflow:hidden}
.zeus-scene{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.zeus-hero-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;filter:contrast(1.12) saturate(1.16) brightness(.84);transform:scale(1.02);animation:zeusDrift 18s ease-in-out infinite;will-change:transform}
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

@media(max-width:920px){
  body::before{opacity:.14;background-position:center top}
  body::after{opacity:.14;background-position:center bottom -90px;background-size:520px auto}
}
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
.section-title h1,.section-title h2{font-size:clamp(30px,3.2vw,44px);margin:0;font-weight:700;letter-spacing:-.5px}
.section-title h1 .grad,.section-title h2 .grad{background:linear-gradient(120deg,#fff,var(--violet2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.section-title p{color:var(--ink-dim);max-width:520px;margin:0;font-size:15px;line-height:1.6}
.kicker{display:inline-block;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:var(--violet2);margin-bottom:10px}

/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.card{position:relative;padding:22px;border-radius:var(--radius);border:1px solid var(--stroke);background:linear-gradient(180deg,var(--glass),rgba(10,8,24,.3));backdrop-filter:blur(var(--autotune-blur));transition:transform .25s,opacity .25s,border-color .25s;overflow:hidden}
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
.chip{padding:8px 14px;border-radius:999px;border:1px solid var(--stroke);background:var(--glass);color:var(--ink-dim);cursor:pointer;font-size:13px;font-weight:500;transition:transform .2s,opacity .2s,background-color .2s,border-color .2s,color .2s}
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
/* Commerce surfaces must never stay invisible (nested sections + SPA re-hydrate). */
#autonomousLiveSection,#unicornModulesMirror,#catalogGrid,#storeGrid,#storeCheckout,#servicePage,
.ds-world section,[data-reveal].commerce-visible{opacity:1!important;transform:none!important}
#autonomousLiveSection[data-reveal],#unicornModulesMirror[data-reveal]{opacity:1!important;transform:none!important}

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
.chip{padding:6px 12px;border-radius:999px;border:1px solid var(--stroke);background:rgba(138,92,255,.08);color:var(--ink);font-size:12px;cursor:pointer;font-family:inherit;transition:transform .15s,opacity .15s,background-color .15s,border-color .15s,color .15s}
.chip:hover{border-color:var(--violet);background:rgba(138,92,255,.18)}
.concierge-foot{padding:12px;border-top:1px solid var(--stroke);display:flex;gap:8px}
.concierge-foot input{flex:1;padding:10px 14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-size:13.5px;font-family:inherit}
.concierge-foot input:focus{outline:none;border-color:var(--stroke-hot)}
.concierge-foot button{padding:10px 16px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;font-weight:600;cursor:pointer;font-family:inherit;font-size:13.5px}
.concierge-foot button:disabled{opacity:.5;cursor:not-allowed}

/* ===== Zeus-30Y enhancements ===== */
.concierge-panel.fullscreen{position:fixed;inset:16px;width:auto;max-width:none;height:auto;max-height:none;bottom:16px;right:16px}
.cc-tools{display:flex;gap:4px;margin-left:8px}
.cc-tool{width:28px;height:28px;border-radius:8px;border:1px solid var(--stroke);background:rgba(138,92,255,.08);color:var(--ink);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;font-family:inherit;transition:transform .15s,opacity .15s,background-color .15s,border-color .15s,color .15s}
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
.mt-btn{width:26px;height:26px;border-radius:7px;border:1px solid var(--stroke);background:rgba(0,0,0,.25);cursor:pointer;font-size:12px;color:var(--ink-dim);font-family:inherit;transition:transform .15s,opacity .15s,background-color .15s,border-color .15s,color .15s}
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

/* =====================================================================
   WORLD-CLASS RESPONSIVE LAYER (Zeus 2025)
   Mobile-first, fluid, safe-area-aware, touch-target compliant.
   Breakpoints: 380 / 480 / 640 / 768 / 980 / 1280 / 1600 / 1920+
   ===================================================================== */

/* universal sizing & overflow guard */
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth}
img,svg,video,canvas{max-width:100%;height:auto}
body{overflow-x:hidden;min-height:100vh;min-height:100dvh}

/* safe-area insets for notched devices */
.nav,footer,.hero,section{padding-left:max(env(safe-area-inset-left,0px),16px);padding-right:max(env(safe-area-inset-right,0px),16px)}
.zeus-cookie,.zeus-buy-bar{padding-bottom:max(env(safe-area-inset-bottom,0px),12px)}

/* fluid typography — universal */
.hero h1{font-size:clamp(36px,7vw,88px)}
.hero p.lead{font-size:clamp(14px,1.6vw,19px)}
.section-title h1,.section-title h2{font-size:clamp(26px,4vw,44px)}
.section-title p{font-size:clamp(13px,1.3vw,15px)}

/* hamburger — hidden on desktop */
.nav-toggle{display:none;background:transparent;border:1px solid var(--stroke);border-radius:12px;width:44px;height:44px;cursor:pointer;align-items:center;justify-content:center;flex-direction:column;gap:4px;padding:0;margin-left:auto;transition:border-color .2s,background .2s}
.nav-toggle:hover{border-color:var(--stroke-hot);background:rgba(138,92,255,.08)}
.nav-toggle-bar{display:block;width:20px;height:2px;background:var(--ink);border-radius:2px;transition:transform .25s,opacity .2s}
nav.nav[data-nav-open="true"] .nav-toggle-bar:nth-child(1){transform:translateY(6px) rotate(45deg)}
nav.nav[data-nav-open="true"] .nav-toggle-bar:nth-child(2){opacity:0}
nav.nav[data-nav-open="true"] .nav-toggle-bar:nth-child(3){transform:translateY(-6px) rotate(-45deg)}

/* Tablet & below: collapse nav into a sheet */
@media (max-width:980px){
  .nav{padding:14px 18px;flex-wrap:wrap;gap:10px}
  .nav-toggle{display:flex}
  .nav-links{order:99;flex-basis:100%;display:none;flex-direction:column;gap:4px;padding:14px 0 6px;border-top:1px solid var(--stroke);margin-top:10px;max-height:calc(100vh - 110px);overflow-y:auto;-webkit-overflow-scrolling:touch}
  .nav-links a{padding:14px 12px;border-radius:12px;font-size:15px;min-height:44px;display:flex;align-items:center}
  .nav-links a:hover,.nav-links a.active{background:rgba(138,92,255,.12)}
  nav.nav[data-nav-open="true"] .nav-links{display:flex}
  .nav-more{width:100%}
  .nav-more-btn{width:100%;text-align:left;padding:14px 12px;font-size:15px;min-height:44px}
  .nav-more-menu{position:static;background:transparent;border:none;padding:0 0 0 12px;box-shadow:none;margin-top:4px}
  .nav-more-menu a{padding:12px 10px;font-size:14px}
  .nav-cta{margin-left:auto;flex-wrap:wrap;gap:8px}
  .nav-cta .btn{padding:10px 14px;font-size:13px;min-height:44px}
  .lang-switch{order:1}
  .lang-btn{min-width:36px;min-height:36px}
  .brand small{display:none}
  .brand-logo{width:48px;height:48px}
  .zeus-wordmark{font-size:clamp(18px,4vw,24px) !important}
}

/* Laptop: tighten hero grid */
@media (max-width:1280px){
  .hero-grid{gap:32px}
  section{padding:64px 24px}
  footer{padding:48px 24px 32px}
}

/* Tablet portrait */
@media (max-width:980px){
  .hero{padding:96px 18px 36px;min-height:auto}
  .hero-grid{grid-template-columns:1fr;gap:28px;min-height:auto;text-align:center}
  .hero-copy{padding:0}
  .hero-cta{justify-content:center}
  .hero-stats{margin-left:auto;margin-right:auto;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
  .hero-side{align-items:center}
  .tourbillon-wrap,.tourbillon-label{width:min(360px,86vw)}
  .immersive-strip{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .foot-grid{grid-template-columns:1fr 1fr;gap:24px}
  .checkout{grid-template-columns:1fr}
  .dash-grid{grid-template-columns:repeat(2,1fr)}
  .pillar-live .pl-row{grid-template-columns:1fr}
  .section-title{flex-direction:column;align-items:flex-start;gap:12px}
  section{padding:56px 18px}
}

/* Phone landscape / large phone */
@media (max-width:768px){
  .hero{padding:88px 16px 28px}
  .hero h1{margin:14px 0 16px;letter-spacing:-1px}
  .hero p.lead{margin-bottom:22px}
  .hero-stat{padding:12px 14px}
  .hero-stat b{font-size:18px}
  .tourbillon-wrap,.tourbillon-label{width:min(320px,82vw)}
  .grid{grid-template-columns:1fr;gap:14px}
  .panels{grid-template-columns:1fr;gap:14px}
  .pricing{grid-template-columns:1fr;gap:14px}
  .card,.panel,.plan{padding:18px}
  .plan{padding:22px}
  .immersive-strip{grid-template-columns:1fr}
  .foot-grid{grid-template-columns:1fr;gap:24px;text-align:left}
  .foot-bot{flex-direction:column;align-items:flex-start;gap:8px}
  .toasts{top:auto;bottom:90px;right:12px;left:12px;align-items:stretch}
  .toast{max-width:100%}
}

/* Phone portrait */
@media (max-width:640px){
  .nav{padding:12px 14px}
  /* Sign in MUST stay visible & functional on mobile (was hidden by .btn-ghost rule). */
  .nav-cta .btn-ghost{display:inline-flex !important;align-items:center;justify-content:center;padding:10px 14px;font-size:13px;min-height:44px;min-width:44px;border:1px solid var(--violet);background:rgba(138,92,255,.10);color:var(--ink)}
  .nav-cta .btn{padding:10px 12px;font-size:12.5px;min-height:44px}
  .nav-cta{flex-wrap:nowrap;gap:6px}
  .hero{padding:80px 14px 24px}
  .hero-eyebrow{font-size:11px;padding:5px 12px;letter-spacing:2px}
  .hero h1{font-size:clamp(30px,8.5vw,46px);line-height:1.05}
  .hero p.lead{font-size:14.5px;line-height:1.55}
  .hero-cta .btn{flex:1;min-width:140px;justify-content:center;display:inline-flex;align-items:center}
  .hero-stats{grid-template-columns:repeat(2,1fr);gap:10px;margin-top:28px}
  .dash-grid{grid-template-columns:1fr;gap:12px}
  section{padding:44px 14px}
  footer{padding:36px 14px 24px;margin-top:48px}
  .section-title h1,.section-title h2{font-size:clamp(22px,7vw,30px)}
  .filters{gap:6px}
  .chip{padding:7px 12px;font-size:12.5px}
  .btn{min-height:44px}
  .field input,.field select{font-size:16px} /* prevent iOS zoom on focus */
  .concierge{right:12px;bottom:12px}
  .concierge-btn{width:54px;height:54px;font-size:24px}
  .zeus-buy-bar{flex-direction:column;gap:10px;padding:12px 14px;text-align:center}
  .zeus-cookie{flex-direction:column;gap:10px;padding:14px;text-align:center}
}

/* Small phone (iPhone SE / 360px range) */
@media (max-width:480px){
  .brand-logo{width:42px;height:42px}
  .zeus-wordmark{font-size:18px !important;letter-spacing:1px !important}
  .lang-switch{padding:2px}
  .lang-btn{padding:5px 8px;font-size:11px;min-width:32px;min-height:32px}
  .hero h1{font-size:clamp(26px,9vw,38px)}
  .hero-eyebrow{letter-spacing:1.5px}
  .hero-stats{grid-template-columns:1fr 1fr}
  .hero-stat b{font-size:16px}
  .tourbillon-wrap,.tourbillon-label{width:min(280px,78vw)}
  .pillar-live .pl-stats{grid-template-columns:1fr 1fr}
  section{padding:36px 12px}
  .card h3,.panel h4{font-size:16px}
}

/* Tiny screens (folded phones) */
@media (max-width:380px){
  .nav-cta .btn-primary{padding:8px 10px;font-size:12px}
  .nav-cta .btn-ghost{padding:8px 10px;font-size:12px;min-width:44px}
  .lang-switch{display:none}
  .hero-stats{grid-template-columns:1fr}
  .immersive-strip{gap:8px}
}

/* Large desktop — widen container, tighten gutters */
@media (min-width:1600px){
  section,.foot-grid,.hero-grid,.foot-bot{max-width:1640px}
  .nav{max-width:1720px;margin:0 auto}
  .grid{grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:22px}
}

/* Ultra-wide / 4K */
@media (min-width:1920px){
  :root{--radius:22px;--radius-lg:26px}
  section,.foot-grid,.hero-grid,.foot-bot{max-width:1840px}
  .hero h1{font-size:clamp(64px,5.6vw,108px)}
  .hero p.lead{font-size:clamp(17px,1.1vw,22px);max-width:760px}
  .grid{grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:24px}
  .panels{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px}
}
@media (min-width:2560px){
  section,.foot-grid,.hero-grid,.foot-bot,.nav{max-width:2200px}
  body{font-size:18px}
}

/* Landscape phones — keep hero compact */
@media (max-height:520px) and (orientation:landscape){
  .hero{min-height:auto;padding:80px 16px 24px}
  .hero-grid{min-height:auto}
  .nav{padding:8px 16px}
  .brand-logo{width:38px;height:38px}
}

/* Touch-target compliance globally */
@media (pointer:coarse){
  a,button,.btn,.chip,.lang-btn,.nav-links a,.field input,.field select{min-height:44px}
  .btn,.chip,.lang-btn{padding-top:max(10px,.6em);padding-bottom:max(10px,.6em)}
}

/* High-DPI image rendering */
@media (-webkit-min-device-pixel-ratio:2),(min-resolution:192dpi){
  .brand-logo img,.watch-photo,.zeus-hero-image{image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges}
}

/* Reduced motion — extend coverage */
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important;scroll-behavior:auto !important}
  .hero-canvas,.galaxy-bg,.fx-orb-a,.fx-orb-b,.fx-orb-c,.fx-scan,.zeus-stars{display:none !important}
}

/* Print */
@media print{
  .nav,.nav-toggle,footer,.concierge,.toasts,.zeus-cookie,.zeus-buy-bar,.zeus-exit,.hero-canvas,.galaxy-bg,.zeus-page-bg,.fx-orb-a,.fx-orb-b,.fx-orb-c,.fx-scan,.fx-grid{display:none !important}
  body{background:#fff;color:#000}
  .hero,section{padding:18px;page-break-inside:avoid}
  .hero h1,.section-title h1,.section-title h2{color:#000;-webkit-text-fill-color:#000;background:none;filter:none}
  a{color:#0033cc;text-decoration:underline}
}

/* ============ ZEUS PER-PAGE BACKDROP ============
   Fixed-position decorative Zeus portrait that sits behind every non-home
   page. Two crossfading layers (a/b) so changing routes does a smooth
   dissolve between Zeus #1 and Zeus #2. Soft radial vignette fades the
   image into the violet/blue ambient theme so cards and copy stay
   perfectly readable. Suppressed on the home page (which already shows
   the full-bleed hero) and on print. Respects reduced-motion. */
.zeus-page-bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;opacity:0;transition:opacity 1.1s ease}
.zeus-page-bg.is-active{opacity:1}
/* Cinematic Zeus portrait — now clearly visible & beautiful on EVERY content
   page (not just marketplace/pricing/store). The dedicated layer stays bright
   enough to read as a real portrait while the veil keeps copy crisp. */
.zeus-page-bg__layer{position:absolute;inset:-4% -4%;background-position:center 30%;background-size:cover;background-repeat:no-repeat;filter:contrast(1.1) saturate(1.12) brightness(.86);opacity:0;transition:opacity 1.4s ease, transform 22s ease-out;transform:scale(1.04)}
.zeus-page-bg__layer.is-on{opacity:.97;transform:scale(1.0)}
.zeus-page-bg__veil{position:absolute;inset:0;background:
  radial-gradient(960px 720px at 50% 26%,rgba(8,5,20,0) 0%,rgba(8,5,20,.26) 58%,rgba(5,4,10,.76) 94%),
  linear-gradient(180deg,rgba(5,4,10,.40) 0%,rgba(5,4,10,.16) 42%,rgba(5,4,10,.80) 100%),
  radial-gradient(1100px 600px at 50% 100%,rgba(138,92,255,.14),transparent 65%)}
/* Home already shows zeus full-bleed via .zeus-hero-image — hide the global backdrop to avoid double-exposure. */
body[data-route="/"] .zeus-page-bg{opacity:0 !important}
/* Soften the generic violet/blue body overlays on EVERY non-home page so the
   dedicated Zeus portrait reads cinematically instead of being muddied. */
body:not([data-route="/"])::before{opacity:.07}
body:not([data-route="/"])::after{opacity:.10}
body:not([data-route="/"]) .zeus-page-bg{opacity:1}
/* Marketplace / Pricing / Store: extra portrait clarity behind the card grids
   (slightly thinner veil because these pages have dense product cards on top). */
body[data-route="/services"] .zeus-page-bg__layer.is-on,
body[data-route="/pricing"] .zeus-page-bg__layer.is-on,
body[data-route="/store"] .zeus-page-bg__layer.is-on{opacity:.99;filter:contrast(1.12) saturate(1.14) brightness(.9)}
body[data-route="/services"] .zeus-page-bg__veil,
body[data-route="/pricing"] .zeus-page-bg__veil,
body[data-route="/store"] .zeus-page-bg__veil{background:
  radial-gradient(960px 720px at 50% 26%,rgba(8,5,20,0) 0%,rgba(8,5,20,.22) 60%,rgba(5,4,10,.68) 95%),
  linear-gradient(180deg,rgba(5,4,10,.32) 0%,rgba(5,4,10,.12) 44%,rgba(5,4,10,.70) 100%),
  radial-gradient(1100px 600px at 50% 100%,rgba(138,92,255,.14),transparent 65%)}
@media (max-width:900px){
  .zeus-page-bg__layer{background-position:50% 26%;filter:contrast(1.08) saturate(1.1) brightness(.8)}
}
@media (prefers-reduced-motion: reduce){
  .zeus-page-bg,.zeus-page-bg__layer{transition:opacity .3s ease}
  .zeus-page-bg__layer.is-on{transform:none}
}

/* ============ ZEUSAI SOCIAL — world-standard surface ============ */
.za-social{--za-ink:#eef3fa;--za-dim:rgba(210,222,240,.72);--za-mint:#6ff2c0;--za-amber:#f0c57a;--za-deep:#05080f;position:relative;isolation:isolate;font-family:"Source Sans 3",ui-sans-serif,system-ui,sans-serif;color:var(--za-ink)}
.za-social-hero{position:relative;min-height:min(94vh,900px);display:flex;align-items:flex-end;padding:0 0 64px;overflow:hidden}
.za-social-hero__atm{position:absolute;inset:0;background:
  radial-gradient(110% 75% at 12% 18%,rgba(111,242,192,.26),transparent 52%),
  radial-gradient(80% 60% at 92% 22%,rgba(240,197,122,.16),transparent 48%),
  linear-gradient(168deg,#071018 0%,#0b1522 46%,#04060c 100%);
  animation:za-social-drift 20s ease-in-out infinite alternate}
.za-social-hero__plane{position:absolute;inset:0;background:
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cpath d='M0 80h160M80 0v160' stroke='%236ff2c0' stroke-opacity='.05'/%3E%3C/svg%3E") center/160px 160px,
  linear-gradient(180deg,transparent 35%,rgba(4,6,12,.75) 100%);
  animation:za-social-scan 14s linear infinite}
.za-social-hero__inner{position:relative;z-index:1;width:min(920px,92vw);margin:0 auto;padding:0 4vw}
.za-social-live{display:inline-flex;align-items:center;gap:8px;margin:0 0 18px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--za-dim)}
.za-social-live__dot{width:8px;height:8px;border-radius:50%;background:var(--za-mint);animation:za-social-ping 1.8s ease-out infinite}
.za-social-brand{margin:0;font-family:Syne,ui-sans-serif,system-ui,sans-serif;font-size:clamp(3.1rem,9.5vw,5.8rem);line-height:.92;letter-spacing:-.045em;font-weight:800;color:#f7fafc}
.za-social-brand span{color:var(--za-mint);display:inline-block;animation:za-social-rise .85s ease both}
.za-social-lead{margin:18px 0 0;max-width:32em;font-size:clamp(1.05rem,2.1vw,1.28rem);line-height:1.5;color:var(--za-dim)}
.za-social-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.za-social-body{width:min(880px,94vw);margin:0 auto;padding:36px 0 88px}
.za-world-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:12px}
.za-world-card{padding:14px 0;border-bottom:1px solid rgba(111,242,192,.12);display:grid;gap:8px}
.za-world-card h3{margin:0;font:700 1.05rem/1.2 Syne,sans-serif}
.za-world-card p{margin:0;font-size:13px;color:var(--za-dim)}
.za-world-card input,.za-world-card select{border:1px solid rgba(111,242,192,.2);background:rgba(8,14,22,.65);color:var(--za-ink);padding:8px 10px;font:500 13px "Source Sans 3",sans-serif}
.za-world-card label{font-size:12.5px;color:var(--za-dim);display:inline-flex;gap:6px;align-items:center;margin-right:8px}
.za-bond-row{font-size:12px;color:var(--za-dim);margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.za-bond-row button{border:0;background:transparent;color:var(--za-mint);cursor:pointer;font:600 12px Syne,sans-serif}
.za-post-flags{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px;font:600 11px/1 Syne,sans-serif;letter-spacing:.04em;text-transform:uppercase}
.za-post-flags [data-claim="verified"]{color:var(--za-mint)}
.za-post-flags [data-claim="contested"]{color:var(--za-amber)}
.za-post-flags [data-claim="unverified"]{color:var(--za-dim)}
.za-viral-expired{color:#ff8e8e}.za-viral-live{color:var(--za-mint)}.za-cid{color:#7fd7ff}
.za-authbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 16px;padding:12px 0;border-bottom:1px solid rgba(111,242,192,.12);font-size:13.5px;color:var(--za-dim)}
.za-authbar #zaAuthLabel{flex:1 1 220px}
.za-auth-hint{margin:0;font-size:12.5px;color:var(--za-amber)}
.za-system{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--za-amber);margin-left:4px}
.za-dm-compose{display:grid;grid-template-columns:1fr 2fr auto;gap:8px;margin:0 0 14px}
.za-dm-compose input{border:1px solid rgba(111,242,192,.2);background:rgba(8,14,22,.65);color:var(--za-ink);padding:10px 12px;font:500 14px "Source Sans 3",sans-serif}
.za-story-viewer{margin:0 0 16px}
.za-story-view{padding:16px;border:1px solid rgba(111,242,192,.25);background:rgba(8,14,22,.75)}
.za-story-view button{margin-top:10px;border:0;background:transparent;color:var(--za-mint);cursor:pointer;font:600 13px Syne,sans-serif}
@media (max-width:720px){.za-dm-compose{grid-template-columns:1fr}}
.za-rail{display:flex;gap:6px;overflow-x:auto;padding:4px 0 14px;scrollbar-width:thin;position:sticky;top:0;z-index:5;background:linear-gradient(180deg,rgba(5,8,15,.96),rgba(5,8,15,.88) 70%,transparent);backdrop-filter:blur(8px)}
.za-rail-btn{flex:0 0 auto;border:0;background:transparent;color:var(--za-dim);font:600 13px/1 Syne,sans-serif;letter-spacing:.04em;padding:10px 12px;cursor:pointer;border-bottom:2px solid transparent}
.za-rail-btn.is-on{color:var(--za-mint);border-bottom-color:var(--za-mint)}
.za-intent{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 16px;font-size:13px;color:var(--za-dim)}
.za-intent button{border:1px solid rgba(111,242,192,.22);background:transparent;color:var(--za-dim);padding:6px 10px;font:500 12px/1 "Source Sans 3",sans-serif;cursor:pointer}
.za-intent button.is-on{border-color:var(--za-mint);color:var(--za-mint)}
.za-wellbeing{margin-left:auto;font-weight:600;color:var(--za-amber);font-size:12px;max-width:42ch}
.za-composer{display:grid;gap:10px;margin:0 0 18px;padding-bottom:16px;border-bottom:1px solid rgba(111,242,192,.12)}
.za-composer textarea{width:100%;min-height:64px;resize:vertical;border:1px solid rgba(111,242,192,.2);background:rgba(8,14,22,.65);color:var(--za-ink);padding:12px 14px;font:500 15px/1.45 "Source Sans 3",sans-serif}
.za-composer-actions{display:flex;gap:10px;justify-content:flex-end;align-items:center}
.za-composer select{background:rgba(8,14,22,.8);color:var(--za-ink);border:1px solid rgba(111,242,192,.2);padding:8px 10px;font:500 13px "Source Sans 3",sans-serif}
.za-stories{display:flex;gap:14px;overflow-x:auto;padding:4px 0 18px;scrollbar-width:thin}
.za-story{flex:0 0 auto;border:0;background:transparent;color:var(--za-dim);display:grid;gap:6px;justify-items:center;cursor:pointer;font:500 11px/1.2 "Source Sans 3",sans-serif;width:72px}
.za-story-ring{width:58px;height:58px;border-radius:50%;padding:2px;background:linear-gradient(135deg,rgba(111,242,192,.15),rgba(240,197,122,.2))}
.za-story.is-unseen .za-story-ring{background:conic-gradient(from 200deg,var(--za-mint),var(--za-amber),var(--za-mint));animation:za-social-spin 8s linear infinite}
.za-story-av{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:#0a121c;font:700 18px Syne,sans-serif;color:var(--za-ink)}
.za-pane{display:none}.za-pane.is-on{display:block;animation:za-social-in .45s ease both}
.za-feed,.za-shorts,.za-explore,.za-messages,.za-inv-grid{display:grid;gap:14px}
.za-post{padding:14px 0 16px;border-bottom:1px solid rgba(111,242,192,.1);content-visibility:auto;contain-intrinsic-size:1px 280px}
.za-post-head{display:flex;gap:12px;align-items:center}
.za-avatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#143024,#0c1824);font:700 15px Syne,sans-serif;position:relative}
.za-avatar[data-presence="active"]::after,.za-dm i[data-presence="active"]{content:"";position:absolute;right:0;bottom:0;width:9px;height:9px;border-radius:50%;background:var(--za-mint);box-shadow:0 0 0 2px #05080f}
.za-avatar[data-presence="recent"]::after,.za-dm i[data-presence="recent"]{content:"";position:absolute;right:0;bottom:0;width:9px;height:9px;border-radius:50%;background:var(--za-amber);box-shadow:0 0 0 2px #05080f}
.za-post-meta{display:grid;gap:2px}.za-post-meta strong{font:700 14px/1.2 Syne,sans-serif}.za-post-meta span{font-size:12px;color:var(--za-dim)}
.za-verified{color:var(--za-mint);font-size:12px}
.za-post-text{margin:12px 0;font-size:15.5px;line-height:1.5;color:rgba(238,243,250,.92)}
.za-post-media{min-height:180px;display:flex;flex-direction:column;justify-content:flex-end;padding:14px;margin:0 0 10px;color:#041018;font:700 12px/1.2 Syne,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.za-post-media[data-aspect="9:16"]{min-height:320px;max-width:280px}
.za-post-media em{font:500 12px/1.3 "Source Sans 3",sans-serif;margin-top:6px;opacity:.85;font-style:normal;letter-spacing:0;text-transform:none}
.za-post-media--gradient-mint{background:linear-gradient(145deg,#6ff2c0,#1a6b55 55%,#0b2030)}
.za-post-media--gradient-amber{background:linear-gradient(145deg,#f0c57a,#8a5a28 55%,#1a1420)}
.za-post-media--gradient-cyan{background:linear-gradient(145deg,#7fd7ff,#1a4d6b 55%,#0b1520)}
.za-post-foot{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.za-post-foot button{border:0;background:transparent;color:var(--za-dim);font:600 12.5px/1 "Source Sans 3",sans-serif;cursor:pointer;padding:4px 0}
.za-post-foot button:hover{color:var(--za-mint)}
.za-post-proof{margin-left:auto;font:500 11px/1 ui-monospace,Menlo,monospace;color:rgba(111,242,192,.7)}
.za-short{padding-bottom:8px}.za-royalty{font-size:12px;color:var(--za-amber);margin-top:4px}
.za-tags{display:flex;flex-wrap:wrap;gap:8px}.za-tags span{font:600 12px Syne,sans-serif;color:var(--za-mint);letter-spacing:.04em}
.za-creators{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.za-creators button{border:1px solid rgba(111,242,192,.18);background:rgba(8,14,22,.45);color:var(--za-ink);padding:12px;text-align:left;cursor:pointer;display:grid;gap:4px}
.za-creators button span{font-size:12px;color:var(--za-dim)}
.za-grid{display:grid;gap:12px}
.za-dm{padding:12px 0;border-bottom:1px solid rgba(111,242,192,.1)}.za-dm header{font:600 12px Syne,sans-serif;color:var(--za-mint);margin-bottom:8px}.za-dm p{margin:0 0 6px;font-size:14px;color:var(--za-dim)}.za-dm i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#3a4660;margin-left:4px;position:relative}
.za-inv-grid{grid-template-columns:1fr;gap:18px}
.za-inv{padding:4px 0 14px;border-bottom:1px solid rgba(111,242,192,.1)}
.za-inv h3{margin:0 0 8px;font:700 1.2rem/1.2 Syne,sans-serif;letter-spacing:-.02em}
.za-inv p{margin:0 0 6px;color:var(--za-dim);font-size:14.5px;line-height:1.5}
.za-inv-sol{color:rgba(238,243,250,.88)!important}
.za-social-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:0 0 18px}
.za-social-metric{display:flex;flex-direction:column;gap:4px}
.za-social-metric__l{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(214,224,245,.5)}
.za-social-metric__v{font:700 1.45rem/1.1 Syne,sans-serif;color:#f4f7ff;letter-spacing:-.02em}
.za-social-loops{display:flex;flex-wrap:wrap;gap:10px 14px;margin-top:16px}
.za-social-loop{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:rgba(214,224,245,.55)}
.za-social-loop.is-on{color:#d6e0f5}
.za-social-loop__dot{width:7px;height:7px;border-radius:50%;background:#3a4660}
.za-social-loop.is-on .za-social-loop__dot{background:var(--za-mint);animation:za-social-ping 2.2s ease-out infinite}
.za-social-ledger__head{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:12px 0}
.za-social-ledger__head span{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(214,224,245,.5);margin-bottom:4px}
.za-social-ledger__head strong,.za-social-ledger__head code{font-size:13px;word-break:break-all;color:#e8eefc}
.za-social-ledger__hash code{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--za-mint)}
.za-social-empty,.za-social-foot,.za-social-sub{color:var(--za-dim);font-size:13.5px}
.za-social-foot{margin-top:28px}
/* ---- upgraded social surface: notifications, bookmarks, profile, comments, quote, ad slot ---- */
.za-notif-badge{display:inline-grid;place-items:center;min-width:16px;height:16px;padding:0 4px;margin-left:4px;border-radius:9px;background:var(--za-mint);color:#04120c;font:700 10px/1 "Source Sans 3",sans-serif;vertical-align:middle}
.za-notif-head{display:flex;justify-content:flex-end;margin:0 0 12px}
.za-notif{padding:12px 0;border-bottom:1px solid rgba(111,242,192,.1);font-size:14px;color:var(--za-dim);display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
.za-notif strong{font:700 13px Syne,sans-serif;color:var(--za-ink)}
.za-notif em{font-style:normal;font-size:11px;color:rgba(214,224,245,.5);margin-left:auto}
.za-notif.is-unread{border-left:2px solid var(--za-mint);padding-left:10px}
.za-notif.is-unread strong{color:var(--za-mint)}
.za-handle{border:0;background:transparent;color:var(--za-mint);cursor:pointer;font:inherit;padding:0}
.za-handle:hover{text-decoration:underline}
.za-tag{border:1px solid rgba(111,242,192,.22);background:transparent;color:var(--za-mint);cursor:pointer;font:600 12px Syne,sans-serif;letter-spacing:.04em;padding:5px 10px;border-radius:14px}
.za-tag:hover{border-color:var(--za-mint);background:rgba(111,242,192,.08)}
.za-tag-head{font:700 1.05rem/1.2 Syne,sans-serif;color:var(--za-mint);margin:0 0 10px}
.za-attn-strip{font-weight:600;color:var(--za-mint);font-size:12px}
.za-profile-head{display:flex;gap:14px;align-items:center;margin:0 0 12px}
.za-profile-av{width:56px;height:56px;font-size:20px}
.za-profile-id{display:grid;gap:2px}
.za-profile-id h2{margin:0;font:700 1.35rem/1.1 Syne,sans-serif}
.za-profile-id span{font-size:13px;color:var(--za-dim)}
.za-profile-head .za-profile-follow{margin-left:auto}
.za-profile-bio{margin:0 0 12px;font-size:14.5px;line-height:1.5;color:rgba(238,243,250,.9)}
.za-profile-stats{display:flex;flex-wrap:wrap;gap:8px 20px;margin:0 0 18px;padding:0 0 14px;border-bottom:1px solid rgba(111,242,192,.12)}
.za-profile-stats span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(214,224,245,.5);display:flex;flex-direction:column;gap:2px}
.za-profile-stats strong{font:700 1.1rem/1 Syne,sans-serif;color:#f4f7ff;letter-spacing:-.02em}
.za-composer-extra{margin:-4px 0 0}
.za-composer-extra summary{cursor:pointer;font:600 12px Syne,sans-serif;letter-spacing:.04em;color:var(--za-mint);list-style:none}
.za-composer-extra summary::-webkit-details-marker{display:none}
.za-composer-extra-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:10px}
.za-composer-extra-grid label{display:grid;gap:4px;font-size:12px;color:var(--za-dim)}
.za-composer-extra-grid input,.za-composer-extra-grid select{border:1px solid rgba(111,242,192,.2);background:rgba(8,14,22,.65);color:var(--za-ink);padding:8px 10px;font:500 13px "Source Sans 3",sans-serif}
.za-composer-extra-grid .za-cx-check{flex-direction:row;align-items:center;gap:8px}
.za-quote{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(127,215,255,.28);border-radius:8px;background:rgba(8,14,22,.5);cursor:pointer;display:grid;gap:4px}
.za-quote-h{font:700 12px Syne,sans-serif;color:#7fd7ff}
.za-quote-h strong{font-weight:700}
.za-quote-t{font-size:14px;color:rgba(238,243,250,.86)}
.za-comments{margin:10px 0 0;padding:12px 0 0;border-top:1px solid rgba(111,242,192,.1)}
.za-comment-list{display:grid;gap:10px;margin:0 0 12px}
.za-comment{font-size:14px;color:var(--za-dim)}
.za-comment strong{font:700 13px Syne,sans-serif;color:var(--za-ink)}
.za-comment .za-comment-h{font-size:12px;color:var(--za-dim);margin-left:4px}
.za-comment p{margin:4px 0 0;color:rgba(238,243,250,.9)}
.za-comment-form{display:flex;gap:8px}
.za-comment-input{flex:1;border:1px solid rgba(111,242,192,.2);background:rgba(8,14,22,.65);color:var(--za-ink);padding:8px 12px;font:500 14px "Source Sans 3",sans-serif}
.za-adslot{padding:14px;margin:0 0 6px;border:1px dashed rgba(240,197,122,.4);border-radius:10px;background:rgba(240,197,122,.06);display:grid;gap:6px}
.za-adslot-tag{font:700 10px Syne,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--za-amber)}
.za-adslot-body{margin:0;font-size:14px;color:rgba(238,243,250,.9)}
.za-adslot-sig{font:500 11px/1 ui-monospace,Menlo,monospace;color:rgba(240,197,122,.75)}
.za-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
@keyframes za-social-drift{from{transform:scale(1)}to{transform:scale(1.045) translate3d(-1.2%,.8%,0)}}
@keyframes za-social-scan{from{background-position:0 0,0 0}to{background-position:0 160px,0 0}}
@keyframes za-social-ping{0%{box-shadow:0 0 0 0 rgba(111,242,192,.55)}70%{box-shadow:0 0 0 10px rgba(111,242,192,0)}100%{box-shadow:0 0 0 0 rgba(111,242,192,0)}}
@keyframes za-social-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes za-social-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes za-social-spin{to{transform:rotate(360deg)}}
@media (max-width:720px){
  .za-social-hero{min-height:78vh;padding-bottom:44px;align-items:center}
  .za-social-brand{font-size:clamp(2.7rem,13vw,3.7rem)}
  .za-wellbeing{margin-left:0;width:100%}
  .za-post-media[data-aspect="9:16"]{max-width:100%}
}
@media (prefers-reduced-motion:reduce){
  .za-social-hero__atm,.za-social-hero__plane,.za-social-live__dot,.za-social-brand span,.za-pane.is-on,.za-story.is-unseen .za-story-ring,.za-social-loop.is-on .za-social-loop__dot{animation:none!important}
}

/* ============ PAGESPEED PASS-3 (additive, zero-regression) ============ */
   1. Composer hints on every node we already animate so the browser
      promotes them to their own layer once and avoids forced reflow.
   2. content-visibility: auto on below-the-fold sections so the browser
      skips rendering+layout work for offscreen content (huge LCP/TBT win
      on mobile pages with long catalogues).
   3. A stricter prefers-reduced-motion guard that disables every keyframe
      animation we declare, not just the wordmark family. */
.zeus-hero-image,.zeus-halo-b,.zeus-stars,.fx-orb,.fx-scan,.hero-eyebrow .dot{will-change:transform,opacity}
section,.section,footer,.foot-grid{content-visibility:auto;contain-intrinsic-size:1px 1200px}
/* Hero must always render — it's the LCP target. */
.hero,.hero *{content-visibility:visible}
@media (prefers-reduced-motion: reduce){
  .zeus-hero-image,.zeus-halo-b,.zeus-stars,.fx-orb,.fx-scan,.hero-eyebrow .dot{animation:none !important;transform:none !important}
}

`;
