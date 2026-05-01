// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T17:17:01.639Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// =============================================================================
// Enterprise router — exposes audit, subscriptions, metrics, orgs, activations
// over HTTP. Mounted by backend/index.js with the standard auth helpers.
// All routes are additive and only modify state through ../enterprise.js.
// =============================================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const enterprise = require('../enterprise');
const dbModule = require('../db');

function buildEnterpriseRouter({
  authMiddleware,
  adminTokenMiddleware,
  ownerEmail = process.env.ADMIN_OWNER_EMAIL || 'vladoiionut1980@gmail.com',
  rateLimitWindow = 1000, // 1 second
}) {
  const router = express.Router();

  // -------------------------------------------------- per-API-key rate limit
  const _orgKeyHits = new Map(); // keyId -> [timestamps]
  router.use((req, _res, next) => {
    const raw = req.headers['x-api-key'] || req.headers['x-org-api-key'];
    if (!raw) return next();
    const k = enterprise.orgs.findApiKeyByPlaintext(String(raw));
    if (!k) return next();
    req.orgKey = k;
    const now = Date.now();
    const arr = (_orgKeyHits.get(k.keyId) || []).filter(t => now - t < rateLimitWindow);
    arr.push(now);
    _orgKeyHits.set(k.keyId, arr);
    if (arr.length > k.rateLimitPerSec) {
      return next(Object.assign(new Error('rate-limit'), { status: 429 }));
    }
    next();
  });

  // -------------------------------------------------- /api/audit/log (admin)
  router.get('/api/audit/log', adminTokenMiddleware, (req, res) => {
    const { userId, action, limit = 200, offset = 0 } = req.query;
    res.json({ ok: true, entries: enterprise.audit.list({ userId, action, limit: Number(limit), offset: Number(offset) }) });
  });

  // -------------------------------------------------- /api/metrics/* (admin)
  router.get('/api/metrics/full', adminTokenMiddleware, (_req, res) => {
    const recent = enterprise.metrics.recent({ limit: 1 })[0] || null;
    res.json({
      ok: true,
      now: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      lastSample: recent,
      meta: enterprise.meta(),
    });
  });
  router.get('/api/metrics/timeseries', adminTokenMiddleware, (req, res) => {
    res.json({ ok: true, samples: enterprise.metrics.recent({ limit: Number(req.query.limit) || 500 }) });
  });
  router.get('/api/metrics/report/weekly', adminTokenMiddleware, (_req, res) => {
    const r = enterprise.metrics.weeklyReport();
    res.type('text/plain').send(r.report);
  });

  // -------------------------------------------------- /api/subscriptions
  router.get('/api/subscriptions', authMiddleware, (req, res) => {
    res.json({ ok: true, subscriptions: enterprise.subscriptions.listByUser(req.user.id) });
  });
  router.post('/api/subscriptions', authMiddleware, (req, res) => {
    const { plan = 'starter', serviceId = null, priceUsd = 0, durationDays = 30, autoRenew = true } = req.body || {};
    const sub = enterprise.subscriptions.create({
      userId: req.user.id, plan, serviceId, priceUsd, durationDays, autoRenew,
      metadata: { createdBy: 'self', email: req.user.email },
    });
    enterprise.audit.log({ userId: req.user.id, action: 'subscription.created', ip: req.ip, metadata: { id: sub.id, plan } });
    res.json({ ok: true, subscription: sub });
  });
  router.post('/api/subscriptions/:id/cancel', authMiddleware, (req, res) => {
    const sub = enterprise.subscriptions.cancel(req.params.id);
    if (!sub || sub.userId !== req.user.id) return res.status(404).json({ ok: false, error: 'not found' });
    enterprise.audit.log({ userId: req.user.id, action: 'subscription.cancelled', ip: req.ip, metadata: { id: sub.id } });
    res.json({ ok: true, subscription: sub });
  });
  router.get('/api/subscriptions/:id/invoice', authMiddleware, (req, res) => {
    const sub = enterprise.subscriptions.listByUser(req.user.id).find(s => s.id === req.params.id);
    if (!sub) return res.status(404).json({ ok: false, error: 'not found' });
    res.type('text/plain').send(enterprise.subscriptions.buildInvoiceText(sub));
  });

  // -------------------------------------------------- /api/orgs
  router.get('/api/orgs', authMiddleware, (req, res) => {
    const all = enterprise.orgs.list();
    const mine = all.filter(o => o.ownerUserId === req.user.id);
    res.json({ ok: true, organizations: mine });
  });
  router.post('/api/orgs', authMiddleware, (req, res) => {
    const { name, plan = 'enterprise', rateLimitPerSec = 1000, secrets = {} } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });
    const org = enterprise.orgs.create({ name, ownerUserId: req.user.id, plan, rateLimitPerSec, secrets });
    enterprise.audit.log({ userId: req.user.id, orgId: org.id, action: 'org.created', ip: req.ip, metadata: { name } });
    res.json({ ok: true, organization: org });
  });
  router.post('/api/orgs/:id/members', authMiddleware, (req, res) => {
    const org = enterprise.orgs.findById(req.params.id);
    if (!org || org.ownerUserId !== req.user.id) return res.status(403).json({ ok: false, error: 'forbidden' });
    const { userId, role = 'member' } = req.body || {};
    if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
    enterprise.orgs.addMember(org.id, userId, role);
    enterprise.audit.log({ userId: req.user.id, orgId: org.id, action: 'org.member.added', ip: req.ip, metadata: { addedUserId: userId, role } });
    res.json({ ok: true, members: enterprise.orgs.listMembers(org.id) });
  });
  router.post('/api/orgs/:id/api-keys', authMiddleware, (req, res) => {
    const org = enterprise.orgs.findById(req.params.id);
    if (!org || org.ownerUserId !== req.user.id) return res.status(403).json({ ok: false, error: 'forbidden' });
    const { name = '', rateLimitPerSec = null } = req.body || {};
    const k = enterprise.orgs.issueApiKey(org.id, name, rateLimitPerSec);
    enterprise.audit.log({ userId: req.user.id, orgId: org.id, action: 'org.apikey.issued', ip: req.ip, metadata: { keyId: k.keyId, name } });
    res.json({ ok: true, key: { keyId: k.keyId, name: k.name, plaintext: k.plaintext, rateLimitPerSec: k.rateLimitPerSec } });
  });

  // -------------------------------------------------- /api/activate/:serviceId
  router.post('/api/activate/:serviceId', authMiddleware, (req, res) => {
    const serviceId = String(req.params.serviceId || '').slice(0, 80);
    if (!serviceId) return res.status(400).json({ ok: false, error: 'serviceId required' });
    // require a paid purchase or active subscription before issuing
    const purchases = dbModule.purchases.listByClient(String(req.user.email || '').toLowerCase()) || [];
    const paid = purchases.find(p => String(p.serviceId) === serviceId);
    const subs = enterprise.subscriptions.listByUser(req.user.id).filter(s => s.serviceId === serviceId && s.status === 'active');
    if (!paid && !subs.length) {
      return res.status(402).json({ ok: false, error: 'payment_required', message: 'Buy or subscribe to this service first' });
    }
    const act = enterprise.activations.issue({
      userId: req.user.id,
      serviceId,
      paymentTxId: paid ? paid.paymentTxId : (subs[0] && subs[0].paymentTxId) || null,
    });
    enterprise.audit.log({ userId: req.user.id, action: 'service.activated', ip: req.ip, metadata: { serviceId, activationId: act.id } });
    res.json({
      ok: true,
      activation: {
        id: act.id,
        serviceId: act.serviceId,
        token: act.token,
        createdAt: act.createdAt,
        usage: `Authorization: Bearer ${act.token}  →  ZeusAI service endpoint`,
      },
    });
  });
  router.get('/api/activations', authMiddleware, (req, res) => {
    const list = enterprise.activations.listByUser(req.user.id).map(a => ({
      id: a.id, serviceId: a.serviceId, status: a.status, createdAt: a.createdAt,
    }));
    res.json({ ok: true, activations: list });
  });

  // -------------------------------------------------- admin: suspend / reactivate users
  router.post('/api/admin/users/:id/suspend', adminTokenMiddleware, (req, res) => {
    const u = dbModule.users.findById(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user not found' });
    try { dbModule.users.setPlanId(u.id, 'suspended'); } catch (_) {}
    enterprise.audit.log({ action: 'admin.user.suspend', ip: req.ip, metadata: { adminEmail: req.admin && req.admin.email, userId: u.id } });
    res.json({ ok: true, userId: u.id, status: 'suspended' });
  });
  router.post('/api/admin/users/:id/reactivate', adminTokenMiddleware, (req, res) => {
    const u = dbModule.users.findById(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user not found' });
    try { dbModule.users.setPlanId(u.id, 'starter'); } catch (_) {}
    enterprise.audit.log({ action: 'admin.user.reactivate', ip: req.ip, metadata: { adminEmail: req.admin && req.admin.email, userId: u.id } });
    res.json({ ok: true, userId: u.id, status: 'reactivated' });
  });

  // -------------------------------------------------- /admin owner HTML dashboard
  router.get('/admin', (_req, res) => {
    // Public shell — actual data calls require admin token (xhr). The page
    // itself is just a static viewer; sensitive APIs above stay protected.
    res.type('html').send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>Unicorn Owner Console</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#0b0f17;color:#e6e8ec;margin:0;padding:24px;}
h1{margin:0 0 8px;font-size:20px;color:#7ee0a6}
h2{margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#8aa0c0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin:8px 0 16px}
.card{background:#11182a;border:1px solid #1c2538;border-radius:8px;padding:14px}
.kv{font-size:12px;color:#8aa0c0}.val{font-size:18px;color:#e6e8ec;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{padding:6px 8px;border-bottom:1px solid #1c2538;text-align:left;vertical-align:top}
th{color:#8aa0c0;font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:10px}
tr:hover td{background:#0f1626}
input,button{background:#0f1626;color:#e6e8ec;border:1px solid #2a3a55;border-radius:6px;padding:8px 10px;font-size:13px}
button{cursor:pointer;background:#1f6feb;border-color:#1f6feb}
button:hover{background:#2978f0}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.tag{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;background:#1c2538;color:#7ee0a6}
.err{color:#ff7676}
</style></head><body>
<h1>🦄 Unicorn Owner Console — ${ownerEmail}</h1>
<div class="bar">
  <input id="tok" type="password" placeholder="Admin JWT (x-auth-token)" style="flex:1;min-width:260px">
  <button onclick="loadAll()">Load</button>
  <span id="status" class="tag">disconnected</span>
</div>

<h2>System</h2>
<div class="grid" id="sysGrid"></div>

<h2>Users (latest 50)</h2>
<div class="card"><table id="usersTbl"><thead><tr><th>Email</th><th>Name</th><th>Plan</th><th>Created</th><th></th></tr></thead><tbody></tbody></table></div>

<h2>Recent payments (50)</h2>
<div class="card"><table id="paysTbl"><thead><tr><th>TxId</th><th>Method</th><th>Status</th><th>Amount</th><th>Created</th></tr></thead><tbody></tbody></table></div>

<h2>Subscriptions</h2>
<div class="card"><table id="subsTbl"><thead><tr><th>User</th><th>Plan</th><th>Status</th><th>End</th><th>Auto</th></tr></thead><tbody></tbody></table></div>

<h2>Module registry</h2>
<div class="card"><pre id="modBox" style="white-space:pre-wrap;font-size:11px;max-height:240px;overflow:auto"></pre></div>

<h2>Audit log (200 most recent)</h2>
<div class="card"><table id="auditTbl"><thead><tr><th>When</th><th>Action</th><th>UserId</th><th>IP</th><th>Meta</th></tr></thead><tbody></tbody></table></div>

<script>
const $=s=>document.querySelector(s);
async function api(p){
  const tok=$('#tok').value.trim();
  const r=await fetch(p,{headers:{'x-auth-token':tok,'authorization':'Bearer '+tok}});
  if(!r.ok)throw new Error(p+' → '+r.status);
  return r.json();
}
async function loadAll(){
  $('#status').textContent='loading…';
  try{
    const meta=await api('/api/metrics/full');
    const sys=$('#sysGrid');sys.innerHTML='';
    const cards=[
      ['Uptime',(meta.now.uptime/3600).toFixed(2)+' h'],
      ['RSS', (meta.now.memory.rss/1048576).toFixed(0)+' MB'],
      ['Heap',(meta.now.memory.heapUsed/1048576).toFixed(0)+' MB'],
      ['Audit entries',meta.meta.counts.audit],
      ['Subscriptions',meta.meta.counts.subscriptions],
      ['Activations',meta.meta.counts.activations],
      ['Organizations',meta.meta.counts.organizations],
      ['Metric samples',meta.meta.counts.metrics],
    ];
    for(const [k,v] of cards){
      const d=document.createElement('div');d.className='card';
      d.innerHTML='<div class="kv">'+k+'</div><div class="val">'+v+'</div>';
      sys.appendChild(d);
    }

    const u=await api('/api/admin/users?limit=50');
    const ub=$('#usersTbl tbody');ub.innerHTML='';
    (u.users||u.data||[]).slice(0,50).forEach(x=>{
      const tr=document.createElement('tr');
      tr.innerHTML='<td>'+(x.email||'')+'</td><td>'+(x.name||'')+'</td><td>'+(x.planId||'')+'</td><td>'+(x.createdAt||'').slice(0,16)+'</td>'
        +'<td><button onclick="susp(\\''+x.id+'\\')">suspend</button> <button onclick="react(\\''+x.id+'\\')">reactivate</button></td>';
      ub.appendChild(tr);
    });

    const p=await api('/api/admin/payments?limit=50').catch(()=>({payments:[]}));
    const pb=$('#paysTbl tbody');pb.innerHTML='';
    (p.payments||[]).slice(0,50).forEach(x=>{
      const tr=document.createElement('tr');
      tr.innerHTML='<td>'+(x.txId||'').slice(0,18)+'</td><td>'+(x.method||'')+'</td><td>'+(x.status||'')+'</td><td>'+(x.total||x.amount||0)+' '+(x.currency||'USD')+'</td><td>'+(x.createdAt||'').slice(0,16)+'</td>';
      pb.appendChild(tr);
    });

    const a=await api('/api/audit/log?limit=200');
    const ab=$('#auditTbl tbody');ab.innerHTML='';
    (a.entries||[]).forEach(e=>{
      const tr=document.createElement('tr');
      tr.innerHTML='<td>'+(e.createdAt||'').slice(0,19)+'</td><td>'+(e.action||'')+'</td><td>'+(e.userId||'')+'</td><td>'+(e.ip||'')+'</td><td>'+JSON.stringify(e.metadata||{}).slice(0,80)+'</td>';
      ab.appendChild(tr);
    });

    const reg=await fetch('/api/modules/registry').then(r=>r.json()).catch(()=>({}));
    $('#modBox').textContent=JSON.stringify(reg,null,2).slice(0,4000);
    $('#status').textContent='loaded · '+new Date().toISOString().slice(11,19);
  }catch(e){ $('#status').textContent=e.message; $('#status').className='tag err'; }
}
async function susp(id){await api('/api/admin/users/'+id+'/suspend');loadAll();}
async function react(id){await api('/api/admin/users/'+id+'/reactivate');loadAll();}
window.susp=async id=>{const t=$('#tok').value;await fetch('/api/admin/users/'+id+'/suspend',{method:'POST',headers:{'x-auth-token':t}});loadAll();};
window.react=async id=>{const t=$('#tok').value;await fetch('/api/admin/users/'+id+'/reactivate',{method:'POST',headers:{'x-auth-token':t}});loadAll();};
</script>
</body></html>`);
  });

  return router;
}

// -------------------------------------------------- background workers
function startBackgroundWorkers({ enabled = true, sampleEveryMs = 60_000, renewEveryMs = 60 * 60_000 } = {}) {
  if (!enabled) return { stop() {} };
  const t1 = setInterval(() => {
    try { enterprise.metrics.record({}); } catch (_) {}
  }, sampleEveryMs);
  if (typeof t1.unref === 'function') t1.unref();

  const t2 = setInterval(() => {
    try {
      const expiring = enterprise.subscriptions.listExpiring(new Date());
      for (const s of expiring) {
        if (s.autoRenew) {
          enterprise.subscriptions.renew(s.id, 30);
          enterprise.audit.log({ userId: s.userId, action: 'subscription.renewed', metadata: { id: s.id, plan: s.plan } });
          // best-effort write monthly invoice file
          try {
            const dir = path.join(enterprise.REPORT_DIR, 'invoices');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${s.id}.txt`),
              enterprise.subscriptions.buildInvoiceText({ ...s, lastRenewedAt: new Date().toISOString() }));
          } catch (_) {}
        }
      }
    } catch (_) {}
  }, renewEveryMs);
  if (typeof t2.unref === 'function') t2.unref();

  return { stop() { clearInterval(t1); clearInterval(t2); } };
}

module.exports = { buildEnterpriseRouter, startBackgroundWorkers };
