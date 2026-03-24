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
    <title>ZEUS & AI LUXURY — UNICORN</title>
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(138,180,248,.25); border-radius: 18px; padding: 16px; backdrop-filter: blur(6px); }
      :root { color-scheme: dark; }
      body { margin: 0; font-family: Inter, system-ui, Arial; color: #f4f7ff; background: radial-gradient(circle at 20% 10%, #3d0d4f, #0b1020 45%, #05070f 100%); }
      .bg { position: fixed; inset: 0; pointer-events: none; background-image: radial-gradient(circle at 10% 20%, rgba(255,170,0,.16) 0, transparent 32%), radial-gradient(circle at 86% 8%, rgba(0,255,255,.14) 0, transparent 30%), linear-gradient(transparent 95%, rgba(190,130,255,.11) 95%); background-size: auto, auto, 100% 34px; animation: drift 18s linear infinite; }
      .wrap { max-width: 1260px; margin: 0 auto; padding: 20px; position: relative; z-index: 1; }
      .topbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; }
      .brand { font-size: 22px; font-weight: 800; letter-spacing: .5px; color: #ffcf6c; text-shadow: 0 0 12px rgba(255,170,0,.45); }
      .pills { display: flex; flex-wrap: wrap; gap: 8px; }
      .pill { border: 1px solid rgba(160,200,255,.4); border-radius: 999px; padding: 4px 10px; font-size: 12px; }
      .hero { display: grid; grid-template-columns: 1.1fr .9fr; gap: 14px; }
      .card { background: linear-gradient(135deg, rgba(255,255,255,.045), rgba(255,255,255,.02)); border: 1px solid rgba(188,155,255,.34); border-radius: 16px; padding: 14px; backdrop-filter: blur(6px); }
      .title { font-size: 34px; margin: 0 0 8px; }
      .subtitle { color: #b8c6ff; margin: 0 0 12px; }
      .cta { display: flex; gap: 10px; flex-wrap: wrap; }
      .btn { border: 1px solid rgba(255,180,85,.7); color: #ffd9a1; text-decoration: none; padding: 10px 14px; border-radius: 999px; background: rgba(255,170,0,.08); }
      .btn2 { border-color: rgba(0,245,255,.7); color: #affcff; background: rgba(0,245,255,.08); }
      .grid3 { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .kpi { font-size: 30px; color: #8cf4ff; font-weight: 800; }
      .small { color: #b9c2df; font-size: 13px; }
      .row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
      .row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
      .module { padding: 8px; border-radius: 10px; margin-bottom: 8px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.09); }
      .progress { margin-top: 8px; height: 8px; background: rgba(255,255,255,.11); border-radius: 999px; overflow: hidden; }
      .progress > span { display: block; height: 100%; background: linear-gradient(90deg, #ffaa00, #00eaff); }
      .clock { font-size: 24px; font-weight: 700; color: #ffcf6c; }
      .chat { display: flex; gap: 8px; margin-top: 10px; }
      .chat input { flex: 1; border: 1px solid rgba(255,255,255,.15); background: rgba(0,0,0,.2); color: #fff; border-radius: 10px; padding: 10px; }
      .chat button { border: 1px solid rgba(0,245,255,.7); background: rgba(0,245,255,.15); color: #baffff; border-radius: 10px; padding: 10px 12px; }
      ul { margin: 0; padding-left: 18px; }
      li { margin: 6px 0; }
      @keyframes drift { from { transform: translateY(0); } to { transform: translateY(34px); } }
      @media (max-width: 980px) { .hero, .row, .row3, .grid3 { grid-template-columns: 1fr; } .topbar { flex-direction: column; align-items: flex-start; } }
      <div class="card">
        <h1 class="title">UNIVERSAL AI UNICORN — Build. Automate. Scale.</h1>
        <p class="tag">Portal futurist, neon/holografic, conectat live la Unicorn. Stream mode: <span id="liveMode" class="status-live">stream</span></p>
        <a class="btn" href="#dashboard">ENTER THE UNICORN</a>
        <div class="section faces" style="margin-top:12px;">
      <div class="topbar">
        <div class="brand">✦ ZEUS & AI LUXURY · UNICORN ✦</div>
        <div class="pills">
          <span class="pill">EN</span><span class="pill">RO</span><span class="pill">ES</span><span class="pill">FR</span><span class="pill">DE</span><span class="pill">ZH</span><span class="pill">JA</span>
        </div>
      </div>

      <div class="hero">
        <div class="card">
          <div class="small">ZEUS FACE · ROBOT FACE</div>
          <h1 class="title">The autonomous AI stack for people, companies, and industries</h1>
          <p class="subtitle">New interface loaded: luxury neon style, live modules, impact engine, realtime telemetry, pricing intelligence, and ZEUS assistant.</p>
          <div class="cta">
            <a class="btn" href="#dashboard">Open Dashboard</a>
            <a class="btn btn2" href="#impact">Global Impact</a>
          </div>
          <div class="row" style="margin-top:12px;">
            <div class="card" style="padding:10px;">
              <div class="small">Current time</div>
              <div class="clock" id="clock">--:--:--</div>
            </div>
            <div class="card" style="padding:10px;">
              <div class="small">Auto update</div>
              <div class="clock"><span id="countdown">30</span>s</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="small">Top innovation</div>
          <h2 id="topTitle">Loading...</h2>
          <p id="topProblem" class="small"></p>
          <div class="kpi" id="topScore">--</div>
          <div class="small" id="trendSuggestion" style="margin-top:12px;">Trend: ...</div>
          <div class="chat">
            <input id="askInput" placeholder="Ask ZEUS anything..." />
            <button id="askBtn">Send</button>
          </div>
          <p class="small" id="askResponse" style="margin-top:8px;">ZEUS response appears here.</p>
      <div class="card"><div class="small">Requests</div><div id="requests" class="kpi">--</div></div>
    </div>

      <div id="dashboard" class="grid3">
      <div class="card"><h3>Macro / Meso / Micro positioning</h3><ul>
        <li><b>Macro</b>: ce este Unicornul și beneficiile mari (automatizare, claritate, scalare).</li>
        <li><b>Meso</b>: ce poate face pentru oameni, companii, industrii.</li>
        <li><b>Micro</b>: ce face fiecare modul și ce KPI influențează.</li>
      </ul></div>
      <div class="row">
        <div class="card">
          <h3>Live Modules</h3>
          <div id="modulesList"></div>
        </div>
        <div class="card">
          <h3>Dynamic Pricing Preview</h3>
          <ul id="pricingList"></ul>
        </div>
    </div>

      <div class="row">
        <div class="pill">Trigger</div><div class="pill">Condition</div><div class="pill">Action</div><div class="pill">AI Block</div><div class="pill">API Block</div>
      </div>
      <div class="card"><h3>Billing</h3><p class="small" id="billingInfo">Loading billing strategy...</p>
        <p class="small">Recommendation: BTC primary + standard payments for enterprise adoption.</p>
      <div class="row3">
      <div class="card">
        <h3>Global Impact Engine (30Y)</h3>
        <p class="small" id="impactMission">Loading mission...</p>
        <div class="small" style="margin-top:10px;">Resilience Index: <b id="resilienceIndex">--</b></div>
        <div class="small">Carbon-aware mode: <span id="carbonAware">--</span></div>
      <div class="row">
      <div class="card">
        <div id="impact" class="card">
          <h3>Global Impact (30 Years)</h3>
          <p class="small" id="impactMission">Loading mission...</p>
          <div class="small">Resilience Index: <b id="resilienceIndex">--</b></div>
          <div class="progress"><span id="resilienceBar" style="width:0%"></span></div>
          <ul id="impactPillars" style="margin-top:8px;"></ul>
        </div>
        <h3>Impact Pillars</h3>
        <ul id="impactPillars"></ul>
      </div>
    </div>
      function renderSnapshot(data, trends) {
          ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
        });
        requestAnimationFrame(frame);
      }
        document.getElementById('trendSuggestion').textContent = 'Trend: ' + ((trends && trends[0]) || 'No trend available');

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

      document.getElementById('modulesList').innerHTML = data.modules.map(function(m){ return '<div class="module"><b>' + m.id + '</b><br><span class="small">' + m.purpose + '</span></div>'; }).join('');
      document.getElementById('marketplaceList').innerHTML = data.marketplace.map(function(m){ return '<li><b>' + m.title + '</b> (' + m.segment + ') → KPI: ' + m.kpi + '</li>'; }).join('');
      document.getElementById('codexList').innerHTML = data.codex.map(function(c){ return '<details><summary>' + c + '</summary><p class="small">AI-generated knowledge + implementation examples.</p></details>'; }).join('');
      document.getElementById('sprintList').innerHTML = data.sprint.tasks.map(function(t){ return '<li><b>' + t.title + '</b> — ' + t.owner + ' (' + t.etaDays + 'd)</li>'; }).join('');

      var impact = data.impact || {};
      document.getElementById('impactMission').textContent = impact.mission || 'Impact mission unavailable.';
      document.getElementById('resilienceIndex').textContent = String(impact.resilienceIndex || '--');
      document.getElementById('resilienceBar').style.width = String(impact.resilienceIndex || 0) + '%';
      document.getElementById('impactPillars').innerHTML = Array.isArray(impact.pillars)
        ? impact.pillars.map(function(p){ return '<li><b>' + p.title + '</b> — score ' + p.score + ' — goal: ' + p.goal2030 + '</li>'; }).join('')
        : '<li>No pillars available</li>';
    }

    async function renderPricing() {
      var services = ['AI Consulting', 'API Access', 'Custom Module Development'];
      var list = [];
      for (var i = 0; i < services.length; i += 1) {
        var svc = services[i];
        var res = await fetch('/api/pricing/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientData: { segment: 'retail', service: svc } })
        });
        var data = await res.json();
        list.push('<li><b>' + svc + '</b> — ' + data.optimalPrice + ' ' + (data.currency || 'USD') + '</li>');
      }
      document.getElementById('pricingList').innerHTML = list.join('');
    }

    async function pullFallback() {
      var snapshotRes = await fetch('/snapshot');
      var trendsRes = await fetch('/api/trends/analyze');
      var snapshot = await snapshotRes.json();
      var trends = await trendsRes.json();
      renderSnapshot(snapshot, trends.trends || []);
      renderPricing();
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
        try { renderSnapshot(JSON.parse(event.data), []); } catch (_) {}
      };
      pullFallback();
    }

    async function askZeus() {
      var input = document.getElementById('askInput');
      var out = document.getElementById('askResponse');
      var prompt = (input.value || '').trim();
      if (!prompt) return;
      out.textContent = 'ZEUS is thinking...';
      var res = await fetch('/api/uaic/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'simple', prompt: prompt, maxTokens: 200 })
      });
      var data = await res.json();
      out.textContent = data.result || 'No response';
      input.value = '';
    }

    var countdown = 30;
    setInterval(function() {
      countdown = countdown > 0 ? countdown - 1 : 30;
      document.getElementById('countdown').textContent = String(countdown);
      document.getElementById('clock').textContent = new Date().toLocaleTimeString();
    }, 1000);

    document.getElementById('askBtn').addEventListener('click', askZeus);
    document.getElementById('askInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') askZeus();
    });

    startRealtime();
  </script>
</body>
</html>`;
}

module.exports = { getSiteHtml };
