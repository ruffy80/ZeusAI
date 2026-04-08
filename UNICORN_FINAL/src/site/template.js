function getSiteHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>UNIVERSAL AI UNICORN</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: Inter, system-ui, Arial; color: #f4f7ff; background: radial-gradient(circle at 10% 10%, #2b2358, #090b14 50%, #05060a 100%); }
    .bg { position: fixed; inset: 0; pointer-events: none; background-image: radial-gradient(circle at 20% 20%, rgba(0,255,255,.12) 0, transparent 35%), radial-gradient(circle at 80% 10%, rgba(255,0,212,.10) 0, transparent 35%), linear-gradient(transparent 96%, rgba(73,94,160,.16) 96%); background-size: auto, auto, 100% 36px; animation: drift 20s linear infinite; }
    .wrap { max-width: 1220px; margin: 0 auto; padding: 22px; position: relative; z-index: 1; }
    .hero { display: grid; grid-template-columns: 1.2fr .8fr; gap: 16px; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(138,180,248,.25); border-radius: 18px; padding: 16px; backdrop-filter: blur(6px); }
    .faces { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .face { position: relative; height: 240px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(130,196,255,.25); background: linear-gradient(145deg, rgba(19,26,58,.9), rgba(11,13,22,.9)); }
    .avatar { width: 100%; height: 100%; display: block; }
    .scan { position: absolute; left: 0; right: 0; top: -30%; height: 70%; background: linear-gradient(to bottom, transparent, rgba(122,212,255,.25), transparent); animation: scan 3.6s infinite linear; }
    .orb { position: absolute; width: 110px; height: 110px; border-radius: 999px; filter: blur(2px); animation: pulse 2.8s infinite ease-in-out; }
    .zeus .orb { left: 24px; top: 30px; background: radial-gradient(circle, #8bd7ff, #3b82f6 65%, #1f2a7d); box-shadow: 0 0 32px #60a5fa; }
    .robot .orb { right: 24px; top: 30px; background: radial-gradient(circle, #b2ffdb, #34d399 65%, #065f46); box-shadow: 0 0 32px #34d399; }
    .face h3 { position: absolute; left: 12px; bottom: 10px; margin: 0; font-size: 14px; }
    .title { font-size: 32px; margin: 0 0 8px; letter-spacing: .3px; }
    .tag { color: #8bd7ff; font-weight: 700; margin: 0 0 12px; }
    .btn { display: inline-block; padding: 10px 16px; border-radius: 999px; border: 1px solid rgba(120,255,245,.55); color: #d4fffb; text-decoration: none; box-shadow: 0 0 18px rgba(83,212,255,.25) inset; }
    .grid3 { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .kpi { font-size: 28px; color: #8bd7ff; font-weight: 700; }
    .small { color: #b5c2df; font-size: 13px; }
    .status-live { color: #7ef29a; font-weight: 600; }
    .section { margin-top: 14px; }
    .row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .pill { display: inline-block; border: 1px solid rgba(143,176,255,.35); border-radius: 999px; padding: 4px 8px; font-size: 12px; margin-right: 6px; margin-bottom: 6px; }
    .bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,.09); overflow: hidden; margin-top: 6px; }
    .bar > span { display: block; height: 100%; background: linear-gradient(90deg, #34d399, #22d3ee); }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 6px 0; }
    @keyframes pulse { 0%,100%{ transform: scale(1); opacity: .9; } 50%{ transform: scale(1.1); opacity: 1; } }
    @keyframes scan { 0%{ transform: translateY(-120%); } 100%{ transform: translateY(260%); } }
    @keyframes drift { from { transform: translateY(0); } to { transform: translateY(36px); } }
    .footer { margin-top: 20px; padding: 16px; text-align: center; border-top: 1px solid rgba(138,180,248,.2); }
    .footer a { color: #8bd7ff; text-decoration: none; }
    .btc { font-family: monospace; font-size: 12px; color: #7ef29a; word-break: break-all; }
  </style>
</head>
<body>
  <div class="bg"></div>
  <div class="wrap">
    <div class="hero">
      <div class="card">
        <h1 class="title">UNIVERSAL AI UNICORN — Build. Automate. Scale.</h1>
        <p class="tag">Portal futurist, neon/holografic, conectat live la Unicorn. Stream mode: <span id="liveMode" class="status-live">stream</span></p>
        <a class="btn" href="#dashboard">ENTER THE UNICORN</a>
        <div class="section faces" style="margin-top:12px;">
          <div class="face zeus"><canvas id="zeusCanvas" class="avatar"></canvas><div class="orb"></div><div class="scan"></div><h3>ZEUS FACE — Strategic Intelligence</h3></div>
          <div class="face robot"><canvas id="robotCanvas" class="avatar"></canvas><div class="orb"></div><div class="scan"></div><h3>ROBOT FACE — Execution Intelligence</h3></div>
        </div>
      </div>
      <div class="card">
        <div class="small">Top innovation now</div>
        <h2 id="topTitle">Loading...</h2>
        <p id="topProblem" class="small"></p>
        <div class="kpi" id="topScore">--</div>
        <hr style="border-color:rgba(255,255,255,.08)">
        <h3 style="margin:.4rem 0;">AI Child</h3>
        <div class="small">Health <span id="aiChildHealthLabel">--%</span></div>
        <div class="bar"><span id="aiChildHealthBar" style="width:0%"></span></div>
        <div class="small" style="margin-top:8px;">Growth <span id="aiChildGrowthLabel">--%</span></div>
        <div class="bar"><span id="aiChildGrowthBar" style="width:0%"></span></div>
        <div class="small" id="aiChildMood" style="margin-top:10px;">Mood: ...</div>
      </div>
    </div>

    <div id="dashboard" class="grid3 section">
      <div class="card"><div class="small">Modules online</div><div id="modulesCount" class="kpi">--</div></div>
      <div class="card"><div class="small">Active users</div><div id="activeUsers" class="kpi">--</div></div>
      <div class="card"><div class="small">Requests</div><div id="requests" class="kpi">--</div></div>
    </div>

    <div class="row section">
      <div class="card"><h3>Macro / Meso / Micro positioning</h3><ul>
        <li><b>Macro</b>: ce este Unicornul și beneficiile mari (automatizare, claritate, scalare).</li>
        <li><b>Meso</b>: ce poate face pentru oameni, companii, industrii.</li>
        <li><b>Micro</b>: ce face fiecare modul și ce KPI influențează.</li>
      </ul></div>
      <div class="card"><h3>Onboarding inteligent</h3><p class="small">Quick intent:</p>
        <span class="pill">Persoană/Freelancer</span><span class="pill">Startup/SMB</span><span class="pill">Corporație</span><span class="pill">Industrie</span>
        <p class="small" id="recommendationsLabel" style="margin-top:10px;">Recommendations: ...</p>
      </div>
    </div>

    <div class="row3 section">
      <div class="card"><h3>Pentru oameni</h3><ul id="peopleUse"></ul></div>
      <div class="card"><h3>Pentru companii</h3><ul id="companyUse"></ul></div>
      <div class="card"><h3>Pentru industrii</h3><ul id="industryUse"></ul></div>
    </div>

    <div class="row section">
      <div class="card"><h3>Marketplace</h3><ul id="marketplaceList"></ul></div>
      <div class="card"><h3>Codex (Knowledge Base)</h3><div id="codexList"></div></div>
    </div>

    <div class="row section">
      <div class="card"><h3>Automation Studio</h3><p class="small">Node-RED + Zapier + Blueprint inspired flow canvas:</p>
        <div class="pill">Trigger</div><div class="pill">Condition</div><div class="pill">Action</div><div class="pill">AI Block</div><div class="pill">API Block</div>
      </div>
      <div class="card"><h3>Billing</h3><p class="small" id="billingInfo">Loading billing strategy...</p>
        <p class="small">Recommendation: BTC primary + standard payments for enterprise adoption.</p>
        <p class="small">BTC: <span class="btc" id="btcAddress">bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e</span></p>
      </div>
    </div>

    <div class="row3 section">
      <div class="card"><h3>Module Health</h3><div class="kpi" id="moduleHealth">--</div></div>
      <div class="card"><h3>Revenue</h3><div class="kpi" id="revenue">--</div></div>
      <div class="card"><h3>AI Growth</h3><div class="kpi" id="aiGrowth">--</div></div>
    </div>

    <div class="row section">
      <div class="card"><h3>Module Status</h3><ul id="modulesList"></ul></div>
      <div class="card"><h3>Sprint Plan</h3><ul id="sprintList"></ul></div>
    </div>

    <div class="footer">
      <p class="small">🦄 <a href="https://zeusai.pro" target="_blank">zeusai.pro</a> — Universal AI Unicorn Platform</p>
      <p class="small">Plăți BTC acceptate: <span class="btc">bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e</span></p>
      <p class="small" style="color:#b5c2df;">© 2026 Vladoi Ionut · <a href="mailto:vladoi_ionut@yahoo.com">vladoi_ionut@yahoo.com</a></p>
    </div>
  </div>

  <script>
    function drawFace(canvasId, hueOffset) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext('2d');
      const stars = Array.from({ length: 70 }).map(function() { return { x: Math.random(), y: Math.random(), z: Math.random() }; });
      function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
      resize(); window.addEventListener('resize', resize);
      function frame(t) {
        const w = canvas.width; const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(8,12,24,0.6)'; ctx.fillRect(0, 0, w, h);
        stars.forEach(function(s, idx) {
          const z = (s.z + (t * 0.00006) + idx * 0.0005) % 1;
          const px = (s.x - 0.5) * w * (0.2 + z) + w / 2;
          const py = (s.y - 0.5) * h * (0.2 + z) + h / 2;
          const size = 1 + z * 2.8;
          ctx.fillStyle = 'hsla(' + (200 + hueOffset + z * 40) + ',95%,70%,' + (0.35 + z * 0.65) + ')';
          ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
        });
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    function renderSnapshot(data) {
      const top = data.innovation.topPriority || {};
      document.getElementById('topTitle').textContent = top.title || 'No priority';
      document.getElementById('topProblem').textContent = top.problem || '';
      document.getElementById('topScore').textContent = (top.score || 0).toString();
      document.getElementById('modulesCount').textContent = String(data.modules.length);
      document.getElementById('activeUsers').textContent = String(data.telemetry.activeUsers);
      document.getElementById('requests').textContent = String(data.telemetry.requests);

      document.getElementById('moduleHealth').textContent = String(data.telemetry.moduleHealth) + '%';
      document.getElementById('revenue').textContent = '$' + String(data.telemetry.revenue);
      document.getElementById('aiGrowth').textContent = String(data.telemetry.aiGrowth) + '%';

      document.getElementById('aiChildHealthLabel').textContent = String(data.profile.aiChild.health) + '%';
      document.getElementById('aiChildGrowthLabel').textContent = String(data.profile.aiChild.growth) + '%';
      document.getElementById('aiChildHealthBar').style.width = String(data.profile.aiChild.health) + '%';
      document.getElementById('aiChildGrowthBar').style.width = String(data.profile.aiChild.growth) + '%';
      document.getElementById('aiChildMood').textContent = 'Mood: ' + data.profile.aiChild.mood;

      document.getElementById('modulesList').innerHTML = data.modules.map(function(m){ return '<li><b>' + m.id + '</b> — ' + m.status + ' — ' + m.purpose + '</li>'; }).join('');
      document.getElementById('marketplaceList').innerHTML = data.marketplace.map(function(m){ return '<li><b>' + m.title + '</b> (' + m.segment + ') → KPI: ' + m.kpi + '</li>'; }).join('');
      document.getElementById('codexList').innerHTML = data.codex.map(function(c){ return '<details><summary>' + c + '</summary><p class="small">AI-generated knowledge + implementation examples.</p></details>'; }).join('');
      document.getElementById('sprintList').innerHTML = data.sprint.tasks.map(function(t){ return '<li><b>' + t.title + '</b> — ' + t.owner + ' (' + t.etaDays + 'd)</li>'; }).join('');
      document.getElementById('recommendationsLabel').textContent = 'Recommendations: ' + data.recommendations.join(' | ');

      document.getElementById('peopleUse').innerHTML = '<li>Task automation</li><li>Personal AI copil guidance</li><li>Focus and productivity planning</li>';
      document.getElementById('companyUse').innerHTML = '<li>CRM automation</li><li>Dynamic pricing</li><li>Operational AI dashboards</li>';
      document.getElementById('industryUse').innerHTML = data.industries.map(function(i){ return '<li><b>' + i.title + ':</b> ' + i.outcomes.join(', ') + '</li>'; }).join('');

      document.getElementById('billingInfo').textContent = 'Primary: ' + data.billing.primary + ' | Supported: ' + data.billing.supported.join(', ');
      if (data.billing.btcAddress) {
        document.getElementById('btcAddress').textContent = data.billing.btcAddress;
      }
    }

    async function pullFallback() {
      const res = await fetch('/snapshot');
      const data = await res.json();
      renderSnapshot(data);
    }

    function startRealtime() {
      if (!('EventSource' in window)) {
        document.getElementById('liveMode').textContent = 'polling';
        pullFallback();
        setInterval(pullFallback, 8000);
        return;
      }
      const es = new EventSource('/stream');
      es.onmessage = function(event) {
        try { renderSnapshot(JSON.parse(event.data)); } catch (_) {}
      };
      es.onerror = function() {
        document.getElementById('liveMode').textContent = 'polling';
      };
      pullFallback();
    }

    drawFace('zeusCanvas', 0);
    drawFace('robotCanvas', 120);
    startRealtime();
  </script>
</body>
</html>`;
}

module.exports = { getSiteHtml };
