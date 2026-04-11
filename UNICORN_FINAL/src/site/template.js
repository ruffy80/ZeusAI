function getSiteHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ZEUS AI — Universal AI Unicorn Platform</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@400;700;900&display=swap');
    :root { color-scheme: dark; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Rajdhani', system-ui, Arial; color: #e8f4ff; background: #05060e; overflow-x: hidden; }
    #bg-canvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
    .wrap { max-width: 1260px; margin: 0 auto; padding: 24px 20px; position: relative; z-index: 1; }

    /* ── HERO ─────────────────────────────────────── */
    .hero { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start; margin-bottom: 24px; }
    @media(max-width:900px){ .hero{ grid-template-columns:1fr; } }

    /* ── CARD ─────────────────────────────────────── */
    .card { background: rgba(10,14,36,.75); border: 1px solid rgba(0,200,255,.2); border-radius: 20px; padding: 20px; backdrop-filter: blur(10px); }
    .card-glow { box-shadow: 0 0 30px rgba(0,180,255,.15) inset, 0 4px 24px rgba(0,0,0,.5); }

    /* ── TYPOGRAPHY ───────────────────────────────── */
    .title { font-family: 'Orbitron', monospace; font-size: clamp(22px,3.5vw,38px); font-weight: 900; line-height: 1.1; letter-spacing: .5px; background: linear-gradient(135deg,#00d4ff,#c084fc,#00ffa3); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .subtitle { color: #7dd3fc; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
    .kpi-val { font-family: 'Orbitron', monospace; font-size: 28px; font-weight: 700; color: #00d4ff; }
    .label { font-size: 12px; color: #7090b0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .green { color: #00ffa3; }
    .purple { color: #c084fc; }
    .cyan { color: #00d4ff; }

    /* ── ZEUS 3D FACE ─────────────────────────────── */
    .zeus-face { position: relative; height: 260px; border-radius: 18px; overflow: hidden; border: 1px solid rgba(0,200,255,.3); background: linear-gradient(145deg,#0a0e24,#060810); }
    #zeusCanvas { width: 100%; height: 100%; display: block; }
    .zeus-overlay { position: absolute; inset: 0; pointer-events: none; }
    .zeus-ring { position: absolute; inset: -10%; border-radius: 50%; border: 2px solid rgba(0,212,255,.18); animation: rotateRing 8s linear infinite; }
    .zeus-ring2 { position: absolute; inset: -20%; border-radius: 50%; border: 1px solid rgba(192,132,252,.12); animation: rotateRing 14s linear infinite reverse; }
    .zeus-scan { position: absolute; left: 0; right: 0; top: -30%; height: 70%; background: linear-gradient(to bottom, transparent, rgba(0,212,255,.2), transparent); animation: scan 3.6s infinite linear; }
    .zeus-label { position: absolute; left: 14px; bottom: 12px; font-family: 'Orbitron', monospace; font-size: 11px; color: #00d4ff; letter-spacing: 1px; text-shadow: 0 0 8px #00d4ff; }
    .zeus-status { position: absolute; right: 14px; top: 12px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: #00ffa3; }
    .zeus-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ffa3; box-shadow: 0 0 8px #00ffa3; animation: pulse 1.8s infinite; }

    /* ── LUXURY CLOCK ─────────────────────────────── */
    .clock-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    #luxClock { width: 180px; height: 180px; }
    .clock-digital { font-family: 'Orbitron', monospace; font-size: 20px; font-weight: 700; color: #00d4ff; letter-spacing: 3px; text-shadow: 0 0 12px rgba(0,212,255,.7); text-align: center; }
    .clock-date { font-size: 11px; color: #7090b0; letter-spacing: 2px; text-align: center; text-transform: uppercase; }

    /* ── GRID STATS ───────────────────────────────── */
    .stats-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 20px; }
    @media(max-width:600px){ .stats-row{ grid-template-columns:1fr 1fr; } }

    /* ── CODEX SECTION ────────────────────────────── */
    .codex-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 14px; margin-bottom: 20px; }
    .codex-card { padding: 16px 18px; border-radius: 16px; background: rgba(10,14,36,.65); border: 1px solid rgba(0,200,255,.15); position: relative; overflow: hidden; transition: border-color .3s, transform .3s; cursor: default; }
    .codex-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg,rgba(0,212,255,.05),transparent); opacity: 0; transition: opacity .3s; }
    .codex-card:hover { border-color: rgba(0,212,255,.5); transform: translateY(-3px); }
    .codex-card:hover::before { opacity: 1; }
    .codex-tag { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #c084fc; margin-bottom: 6px; }
    .codex-title { font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 700; color: #e8f4ff; margin-bottom: 6px; }
    .codex-desc { font-size: 12px; color: #7090b0; line-height: 1.5; }
    .codex-arrow { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #00d4ff; font-size: 16px; opacity: 0; transition: opacity .3s; }
    .codex-card:hover .codex-arrow { opacity: 1; }

    /* ── PROGRESS BARS ────────────────────────────── */
    .bar-wrap { margin-bottom: 10px; }
    .bar { height: 6px; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; margin-top: 4px; }
    .bar > span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg,#00d4ff,#c084fc); box-shadow: 0 0 8px rgba(0,212,255,.5); transition: width 1.2s ease; }

    /* ── MODULES LIST ─────────────────────────────── */
    .module-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 13px; }
    .module-item:last-child { border-bottom: 0; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: rgba(0,255,163,.15); color: #00ffa3; border: 1px solid rgba(0,255,163,.3); }

    /* ── BILLING ──────────────────────────────────── */
    .btc-addr { font-family: monospace; font-size: 11px; color: #00ffa3; word-break: break-all; background: rgba(0,255,163,.06); border: 1px solid rgba(0,255,163,.2); border-radius: 8px; padding: 8px 10px; margin-top: 8px; }

    /* ── FOOTER ───────────────────────────────────── */
    .footer { margin-top: 30px; padding: 20px; text-align: center; border-top: 1px solid rgba(0,200,255,.15); font-size: 12px; color: #7090b0; }
    .footer a { color: #00d4ff; text-decoration: none; }

    /* ── ANIMATIONS ───────────────────────────────── */
    @keyframes pulse { 0%,100%{ transform:scale(1);opacity:.9; } 50%{ transform:scale(1.15);opacity:1; } }
    @keyframes scan { 0%{ transform:translateY(-120%); } 100%{ transform:translateY(260%); } }
    @keyframes rotateRing { from{ transform:rotate(0deg); } to{ transform:rotate(360deg); } }
    @keyframes drift { from{ transform:translateY(0); } to{ transform:translateY(40px); } }
    @keyframes fadeIn { from{ opacity:0;transform:translateY(18px); } to{ opacity:1;transform:translateY(0); } }
    .anim-in { animation: fadeIn .7s ease both; }
    .anim-in:nth-child(2){ animation-delay:.1s; }
    .anim-in:nth-child(3){ animation-delay:.2s; }
    .anim-in:nth-child(4){ animation-delay:.3s; }
    .anim-in:nth-child(5){ animation-delay:.4s; }
    .anim-in:nth-child(6){ animation-delay:.5s; }
  </style>
</head>
<body>
  <canvas id="bg-canvas"></canvas>

  <div class="wrap">
    <!-- ── HERO ───────────────────────────────────── -->
    <div class="hero">
      <div>
        <div class="card card-glow" style="margin-bottom:20px;">
          <div class="subtitle">Universal AI Unicorn Platform</div>
          <h1 class="title">ZEUS AI — Build. Automate. Scale.</h1>
          <p style="color:#9db8d0;margin:10px 0 16px;line-height:1.6;font-size:15px;">
            Luxury AI infrastructure for commerce, enterprise, and sovereign-scale operations.
            Powered by autonomous modules, predictive intelligence, and holographic control surfaces.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <a href="#dashboard" style="padding:10px 20px;border-radius:999px;border:1px solid rgba(0,212,255,.5);color:#00d4ff;text-decoration:none;font-family:'Orbitron',monospace;font-size:12px;letter-spacing:1px;box-shadow:0 0 20px rgba(0,212,255,.2) inset;">ENTER UNICORN</a>
            <a href="#codex" style="padding:10px 20px;border-radius:999px;border:1px solid rgba(192,132,252,.5);color:#c084fc;text-decoration:none;font-family:'Orbitron',monospace;font-size:12px;letter-spacing:1px;box-shadow:0 0 20px rgba(192,132,252,.15) inset;">CODEX</a>
          </div>
        </div>

        <!-- Zeus 3D Face -->
        <div class="zeus-face card-glow">
          <canvas id="zeusCanvas"></canvas>
          <div class="zeus-overlay">
            <div class="zeus-ring"></div>
            <div class="zeus-ring2"></div>
            <div class="zeus-scan"></div>
          </div>
          <div class="zeus-label">ZEUS · STRATEGIC INTELLIGENCE</div>
          <div class="zeus-status"><div class="zeus-dot"></div>ONLINE</div>
        </div>
      </div>

      <!-- ── RIGHT COLUMN ─────────────────────────── -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Luxury Clock -->
        <div class="card card-glow">
          <div class="subtitle" style="text-align:center;">Platform Clock</div>
          <div class="clock-wrap">
            <canvas id="luxClock"></canvas>
            <div class="clock-digital" id="clockDigital">--:--:--</div>
            <div class="clock-date" id="clockDate">--- --- --</div>
          </div>
        </div>

        <!-- AI Child Stats -->
        <div class="card card-glow">
          <div class="subtitle">AI Child Status</div>
          <div class="bar-wrap">
            <div class="label">Health <span id="aiHealthLabel" class="green">--%</span></div>
            <div class="bar"><span id="aiHealthBar" style="width:0%"></span></div>
          </div>
          <div class="bar-wrap">
            <div class="label">Growth <span id="aiGrowthLabel" class="purple">--%</span></div>
            <div class="bar"><span id="aiGrowthBar" style="width:0%;background:linear-gradient(90deg,#c084fc,#818cf8)"></span></div>
          </div>
          <div style="margin-top:10px;font-size:12px;color:#7090b0;">Mood: <span id="aiMood" class="cyan">...</span></div>
        </div>

        <!-- Top Innovation -->
        <div class="card card-glow">
          <div class="subtitle">Top Innovation</div>
          <div id="topTitle" style="font-family:'Orbitron',monospace;font-size:13px;margin-bottom:6px;color:#e8f4ff;">Loading…</div>
          <div id="topScore" class="kpi-val">--</div>
          <div id="topProblem" style="font-size:11px;color:#7090b0;margin-top:4px;"></div>
        </div>
      </div>
    </div>

    <!-- ── KPI STATS ────────────────────────────────── -->
    <div id="dashboard" class="stats-row" style="scroll-margin-top:20px;">
      <div class="card card-glow anim-in"><div class="label">Modules Online</div><div class="kpi-val" id="modulesCount">--</div></div>
      <div class="card card-glow anim-in"><div class="label">Active Users</div><div class="kpi-val" id="activeUsers">--</div></div>
      <div class="card card-glow anim-in"><div class="label">Requests / uptime</div><div class="kpi-val" id="requests">--</div></div>
    </div>

    <!-- ── CODEX SECTION ───────────────────────────── -->
    <h2 id="codex" class="title" style="font-size:18px;margin-bottom:16px;scroll-margin-top:20px;">⬡ CODEX — Operational Knowledge Map</h2>
    <div class="codex-grid">
      <div class="codex-card anim-in"><div class="codex-tag">Monetization</div><div class="codex-title">Payments Codex</div><div class="codex-desc">Universal gateway, receipts, BTC pricing, and transaction stats.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Commerce</div><div class="codex-title">Marketplace Codex</div><div class="codex-desc">Service discovery, dynamic pricing, recommendations, and checkout.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Operations</div><div class="codex-title">Enterprise Codex</div><div class="codex-desc">Aviation, defense, government, telecom, partner integrations.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Platform</div><div class="codex-title">Capabilities Codex</div><div class="codex-desc">Strategic capabilities across the full Unicorn stack.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Analytics</div><div class="codex-title">Dashboard Codex</div><div class="codex-desc">Risk, compliance, opportunities, payments, marketplace metrics.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Innovation</div><div class="codex-title">AI Innovation Codex</div><div class="codex-desc" id="codexInnovation">Autonomous idea scoring, sprint planning, deployment intelligence.</div><div class="codex-arrow">→</div></div>
    </div>

    <!-- ── TWO COLUMN SECTION ──────────────────────── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;" class="two-col">
      <div class="card card-glow">
        <div class="subtitle">Module Status</div>
        <ul id="modulesList" style="list-style:none;"></ul>
      </div>
      <div class="card card-glow">
        <div class="subtitle">Sprint Plan</div>
        <ul id="sprintList" style="list-style:none;"></ul>
      </div>
    </div>

    <!-- ── MARKETPLACE + BILLING ──────────────────── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;" class="two-col">
      <div class="card card-glow">
        <div class="subtitle">Marketplace</div>
        <ul id="marketplaceList" style="list-style:none;"></ul>
      </div>
      <div class="card card-glow">
        <div class="subtitle">Billing Strategy</div>
        <div id="billingInfo" style="font-size:13px;color:#9db8d0;"></div>
        <div class="btc-addr" id="btcAddress">bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e</div>
      </div>
    </div>

    <!-- ── FOOTER ──────────────────────────────────── -->
    <div class="footer">
      <p>🦄 <a href="https://zeusai.pro" target="_blank">zeusai.pro</a> — Universal AI Unicorn Platform</p>
      <p style="margin-top:6px;">© 2026 Vladoi Ionut · <a href="mailto:vladoi_ionut@yahoo.com">vladoi_ionut@yahoo.com</a></p>
      <p style="margin-top:6px;font-family:monospace;font-size:11px;color:#00ffa3;">BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e</p>
    </div>
  </div>

  <style>
    @media(max-width:700px){ .two-col{ grid-template-columns:1fr !important; } }
  </style>

  <script>
  /* ────────────────────────────────────────────────────
     1. BACKGROUND — 3D starfield on bg-canvas
  ──────────────────────────────────────────────────── */
  (function() {
    var c = document.getElementById('bg-canvas');
    var ctx = c.getContext('2d');
    var stars = [];
    function resize() { c.width = innerWidth; c.height = innerHeight; }
    resize(); window.addEventListener('resize', resize);
    for (var i = 0; i < 180; i++) {
      stars.push({ x: Math.random(), y: Math.random(), z: Math.random(), speed: 0.00004 + Math.random() * 0.00008 });
    }
    function drawBg(t) {
      ctx.fillStyle = 'rgba(5,6,14,0.45)';
      ctx.fillRect(0, 0, c.width, c.height);
      stars.forEach(function(s) {
        s.z = (s.z + s.speed) % 1;
        var px = (s.x - 0.5) * c.width * (0.15 + s.z * 0.85) + c.width / 2;
        var py = (s.y - 0.5) * c.height * (0.15 + s.z * 0.85) + c.height / 2;
        var r = 0.5 + s.z * 2.5;
        var alpha = 0.2 + s.z * 0.8;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + (190 + s.z * 60) + ',90%,70%,' + alpha + ')';
        ctx.fill();
      });
      requestAnimationFrame(drawBg);
    }
    requestAnimationFrame(drawBg);
  })();

  /* ────────────────────────────────────────────────────
     2. ZEUS 3D FACE — animated 3D sphere with wireframe
  ──────────────────────────────────────────────────── */
  (function() {
    var cv = document.getElementById('zeusCanvas');
    var ctx = cv.getContext('2d');
    var mouse = { x: 0, y: 0 };
    document.addEventListener('mousemove', function(e) {
      mouse.x = (e.clientX / innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / innerHeight - 0.5) * 2;
    });
    function resize() { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
    resize(); window.addEventListener('resize', resize);

    // Build sphere geometry
    var RINGS = 14, SEGS = 24;
    var verts = [];
    for (var lat = 0; lat <= RINGS; lat++) {
      for (var lon = 0; lon <= SEGS; lon++) {
        var theta = lat * Math.PI / RINGS;
        var phi = lon * 2 * Math.PI / SEGS;
        verts.push([Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)]);
      }
    }

    function project(v, rx, ry, cx, cy, scale) {
      // rotate Y
      var x0 = v[0] * Math.cos(ry) + v[2] * Math.sin(ry);
      var y0 = v[1];
      var z0 = -v[0] * Math.sin(ry) + v[2] * Math.cos(ry);
      // rotate X
      var x1 = x0;
      var y1 = y0 * Math.cos(rx) - z0 * Math.sin(rx);
      var z1 = y0 * Math.sin(rx) + z0 * Math.cos(rx);
      var fov = 3.5;
      var pz = z1 + fov;
      return { px: cx + x1 / pz * scale, py: cy + y1 / pz * scale, z: z1, depth: pz };
    }

    var rot = { x: 0.3, y: 0 };
    function drawZeus(t) {
      rot.y += 0.008 + mouse.x * 0.004;
      rot.x = 0.3 + mouse.y * 0.2;
      var w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.32;

      // Draw sphere wireframe lines
      for (var lat = 0; lat < RINGS; lat++) {
        for (var lon = 0; lon < SEGS; lon++) {
          var idx = lat * (SEGS + 1) + lon;
          var p0 = project(verts[idx], rot.x, rot.y, cx, cy, scale);
          var p1 = project(verts[idx + 1], rot.x, rot.y, cx, cy, scale);
          var p2 = project(verts[idx + SEGS + 1], rot.x, rot.y, cx, cy, scale);

          var visible0 = p0.depth > 0 && p1.depth > 0;
          var visible1 = p0.depth > 0 && p2.depth > 0;

          if (visible0) {
            var alpha0 = Math.max(0, (p0.z + 0.6) / 1.2) * 0.6;
            ctx.beginPath();
            ctx.moveTo(p0.px, p0.py);
            ctx.lineTo(p1.px, p1.py);
            ctx.strokeStyle = 'rgba(0,210,255,' + alpha0.toFixed(2) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          if (visible1) {
            var alpha1 = Math.max(0, (p0.z + 0.6) / 1.2) * 0.6;
            ctx.beginPath();
            ctx.moveTo(p0.px, p0.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.strokeStyle = 'rgba(192,132,252,' + alpha1.toFixed(2) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Core glow orb
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.38);
      grad.addColorStop(0, 'rgba(0,200,255,0.55)');
      grad.addColorStop(0.5, 'rgba(100,80,255,0.25)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, scale * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Particle dots at vertices (front half only)
      verts.forEach(function(v, i) {
        if (i % 7 !== 0) return;
        var p = project(v, rot.x, rot.y, cx, cy, scale);
        if (p.z < -0.2) return;
        var alpha = Math.max(0, (p.z + 0.5) / 1.2);
        ctx.beginPath();
        ctx.arc(p.px, p.py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,255,200,' + (alpha * 0.9).toFixed(2) + ')';
        ctx.fill();
      });

      requestAnimationFrame(drawZeus);
    }
    requestAnimationFrame(drawZeus);
  })();

  /* ────────────────────────────────────────────────────
     3. LUXURY ANALOG CLOCK
  ──────────────────────────────────────────────────── */
  (function() {
    var cv = document.getElementById('luxClock');
    var ctx = cv.getContext('2d');
    cv.width = 180; cv.height = 180;
    var cx = 90, cy = 90, r = 82;
    var DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

    function drawClock() {
      var now = new Date();
      var h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
      ctx.clearRect(0, 0, 180, 180);

      // Outer ring glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,212,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      // Inner ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(192,132,252,0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();

      // Hour markers
      for (var i = 0; i < 12; i++) {
        var angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        var isMain = i % 3 === 0;
        var len = isMain ? 14 : 8;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx + (r - 3) * Math.cos(angle), cy + (r - 3) * Math.sin(angle));
        ctx.lineTo(cx + (r - len) * Math.cos(angle), cy + (r - len) * Math.sin(angle));
        ctx.strokeStyle = isMain ? 'rgba(0,212,255,0.9)' : 'rgba(0,212,255,0.4)';
        ctx.lineWidth = isMain ? 2 : 1;
        if (isMain) { ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 8; }
        ctx.stroke();
        ctx.restore();
      }

      // Minute marks
      for (var j = 0; j < 60; j++) {
        if (j % 5 === 0) continue;
        var ang = (j / 60) * Math.PI * 2 - Math.PI / 2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx + (r - 3) * Math.cos(ang), cy + (r - 3) * Math.sin(ang));
        ctx.lineTo(cx + (r - 8) * Math.cos(ang), cy + (r - 8) * Math.sin(ang));
        ctx.strokeStyle = 'rgba(0,212,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }

      function drawHand(angle, length, width, color, glow) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(angle) * length * 0.15, cy - Math.sin(angle) * length * 0.15);
        ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
        ctx.stroke();
        ctx.restore();
      }

      // Hour hand
      var hourAngle = ((h % 12) + m / 60 + s / 3600) / 12 * Math.PI * 2 - Math.PI / 2;
      drawHand(hourAngle, r * 0.52, 3, '#00d4ff', 12);

      // Minute hand
      var minAngle = (m + s / 60) / 60 * Math.PI * 2 - Math.PI / 2;
      drawHand(minAngle, r * 0.72, 2, '#c084fc', 10);

      // Second hand (smooth)
      var secAngle = (s + ms / 1000) / 60 * Math.PI * 2 - Math.PI / 2;
      drawHand(secAngle, r * 0.82, 1, '#00ffa3', 14);

      // Center dot
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00d4ff';
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();

      // Digital time
      var hStr = String(h).padStart(2,'0');
      var mStr = String(m).padStart(2,'0');
      var sStr = String(s).padStart(2,'0');
      document.getElementById('clockDigital').textContent = hStr + ':' + mStr + ':' + sStr;
      document.getElementById('clockDate').textContent = DAYS[now.getDay()] + ' · ' + MONTHS[now.getMonth()] + ' ' + String(now.getDate()).padStart(2,'0');

      requestAnimationFrame(drawClock);
    }
    requestAnimationFrame(drawClock);
  })();

  /* ────────────────────────────────────────────────────
     4. DATA BINDING — SSE stream + snapshot fallback
  ──────────────────────────────────────────────────── */
  function renderSnapshot(data) {
    var top = (data.innovation && data.innovation.topPriority) || {};
    document.getElementById('topTitle').textContent = top.title || 'AI Innovation Active';
    document.getElementById('topProblem').textContent = top.problem || '';
    document.getElementById('topScore').textContent = top.score ? String(top.score) : '—';
    document.getElementById('modulesCount').textContent = String(data.modules ? data.modules.length : 0);
    document.getElementById('activeUsers').textContent = String((data.telemetry || {}).activeUsers || 0);
    document.getElementById('requests').textContent = String((data.telemetry || {}).requests || 0);
    var child = (data.profile || {}).aiChild || {};
    document.getElementById('aiHealthLabel').textContent = (child.health || 0) + '%';
    document.getElementById('aiGrowthLabel').textContent = (child.growth || 0) + '%';
    document.getElementById('aiHealthBar').style.width = (child.health || 0) + '%';
    document.getElementById('aiGrowthBar').style.width = (child.growth || 0) + '%';
    document.getElementById('aiMood').textContent = child.mood || 'active';
    if (data.modules) {
      document.getElementById('modulesList').innerHTML = data.modules.slice(0,8).map(function(m) {
        return '<li class="module-item"><span>' + m.id + '</span><span class="badge">' + (m.status || 'active') + '</span></li>';
      }).join('');
    }
    if (data.marketplace) {
      document.getElementById('marketplaceList').innerHTML = data.marketplace.map(function(m) {
        return '<li class="module-item"><span>' + m.title + '</span><span style="font-size:11px;color:#7090b0;">' + m.segment + '</span></li>';
      }).join('');
    }
    if (data.sprint && data.sprint.tasks) {
      document.getElementById('sprintList').innerHTML = data.sprint.tasks.slice(0,6).map(function(t) {
        return '<li class="module-item"><span>' + t.title + '</span><span style="font-size:11px;color:#c084fc;">' + t.etaDays + 'd</span></li>';
      }).join('');
    }
    if (data.billing) {
      document.getElementById('billingInfo').textContent = 'Primary: ' + data.billing.primary + ' | Supported: ' + (data.billing.supported || []).join(', ');
      if (data.billing.btcAddress) document.getElementById('btcAddress').textContent = data.billing.btcAddress;
    }
  }

  async function pullFallback() {
    try {
      var res = await fetch('/snapshot');
      renderSnapshot(await res.json());
    } catch(_) {}
  }

  (function() {
    if (!window.EventSource) { pullFallback(); setInterval(pullFallback, 10000); return; }
    var es = new EventSource('/stream');
    es.onmessage = function(e) { try { renderSnapshot(JSON.parse(e.data)); } catch(_) {} };
    es.onerror = function() { pullFallback(); };
    pullFallback();
  })();
  </script>
</body>
</html>`;
}

module.exports = { getSiteHtml };
