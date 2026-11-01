'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.UNICORN_DATA_DIR || path.join(__dirname, '..', '..', '..', 'data');
const DELIVERIES_FILE = path.join(DATA_DIR, 'commerce-deliveries.json');

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed == null ? fallback : parsed;
  } catch (_) { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function all() {
  const value = readJson(DELIVERIES_FILE, []);
  return Array.isArray(value) ? value : [];
}

function save(deliveries) {
  writeJson(DELIVERIES_FILE, deliveries);
}

function publicKey(secret) {
  return String(secret || '').slice(0, 10) + '…' + String(secret || '').slice(-6);
}

function buyerEmail(receipt) {
  const email = String(receipt && receipt.email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

// A downloaded key must verify in this process. No email means no key.
// A webhook secret is issued only when the buyer has a callback URL.
function issueBuyerCredential(receipt, serviceId) {
  const blank = {
    apiKey: null,
    apiKeyPreview: null,
    keyId: null,
    credentialsIssued: false,
    webhookSecret: null,
    webhookIssued: false,
  };
  const email = buyerEmail(receipt);
  if (!email) return blank;
  try {
    const frontier = require('../../frontier-engine');
    const created = frontier.apiKeyCreate({
      ownerEmail: email,
      scopes: ['read'],
      label: `delivery:${serviceId}:${receipt.id}`,
      rateLimit: 60,
    });
    const apiKey = created && created.key;
    const verified = apiKey && frontier.apiKeyVerify(apiKey);
    if (!apiKey || !verified || verified.ok !== true) return blank;
    const out = {
      apiKey,
      apiKeyPreview: publicKey(apiKey),
      keyId: created.meta && created.meta.id,
      credentialsIssued: true,
      webhookSecret: null,
      webhookIssued: false,
    };
    const hook = String(receipt.webhookUrl || '').trim();
    if (/^https:\/\//i.test(hook) && typeof frontier.webhookSubscribe === 'function') {
      const sub = frontier.webhookSubscribe({ ownerEmail: email, url: hook, events: ['delivery'] });
      if (sub && sub.secret) {
        out.webhookSecret = sub.secret;
        out.webhookId = sub.id;
        out.webhookIssued = true;
      }
    }
    return out;
  } catch (_) {
    return blank;
  }
}

function classify(serviceId) {
  const id = String(serviceId || '').toLowerCase();
  if (id.includes('frontier') || id.includes('quantum') || id.includes('nexus')) return 'workspace+agent';
  if (id.includes('growth') || id.includes('viral') || id.includes('aura') || id.includes('outreach')) return 'report+automation';
  if (id.includes('api') || id.includes('engine') || id.includes('blocks') || id.includes('predictive')) return 'api+task';
  if (id.includes('os') || id.includes('vertical') || id.includes('enterprise')) return 'workspace+onboarding';
  // Omega universal default: every SKU (even brand-new, unknown ones) gets a
  // workspace + onboarding deliverable so the Omega Ecosystem OS can attach its
  // living instance with zero per-SKU integration code.
  return 'workspace+onboarding';
}

function deliverableSet(receipt, serviceId) {
  const type = classify(serviceId);
  const credential = issueBuyerCredential(receipt, serviceId);
  const base = {
    serviceId,
    apiKey: credential.apiKey,
    apiKeyPreview: credential.apiKeyPreview,
    keyId: credential.keyId,
    credentialsIssued: credential.credentialsIssued,
    workspaceId: 'ws_' + crypto.createHash('sha1').update(receipt.id + serviceId).digest('hex').slice(0, 12),
    taskId: 'task_' + crypto.randomBytes(8).toString('hex'),
    webhookSecret: credential.webhookSecret,
    webhookIssued: credential.webhookIssued,
    createdAt: new Date().toISOString()
  };
  const enterprisePack = /^ent-/i.test(String(serviceId || '')) && serviceId !== 'ent-engagement-kickoff';
  const files = [
    { filename: `${serviceId}-receipt-${receipt.id.slice(0, 8)}.json`, kind: 'receipt', downloadUrl: `/api/invoice/${encodeURIComponent(receipt.id)}` },
  ];
  if (enterprisePack) {
    files.push({
      filename: `${serviceId}-engagement-pack.md`,
      kind: 'engagement-pack',
      downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=artifact&serviceId=${encodeURIComponent(serviceId)}`,
    });
  } else {
    files.push({ filename: `${serviceId}-license-${receipt.id.slice(0, 8)}.txt`, kind: 'license', downloadUrl: `/api/license/${encodeURIComponent(receipt.id)}` });
  }
  if (type.includes('report')) files.push({ filename: `${serviceId}-growth-plan-${receipt.id.slice(0, 8)}.json`, kind: 'report', downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=report&serviceId=${encodeURIComponent(serviceId)}` });
  if (type.includes('workspace')) files.push({ filename: `${serviceId}-workspace-${base.workspaceId}.json`, kind: 'workspace', downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=workspace&serviceId=${encodeURIComponent(serviceId)}` });
  if (type.includes('api')) files.push({ filename: `${serviceId}-api-key-${receipt.id.slice(0, 8)}.json`, kind: 'api-key', downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=api-key&serviceId=${encodeURIComponent(serviceId)}` });
  files.push({ filename: `${serviceId}-onboarding-${receipt.id.slice(0, 8)}.json`, kind: 'onboarding', downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=onboarding&serviceId=${encodeURIComponent(serviceId)}` });

  const isHumanLed = /^(ent-|professional-|enterprise)/i.test(String(serviceId || ''))
    || String(type).includes('workspace');
  return {
    ...base,
    type,
    // Honest status: paperwork is provisioned now; finished product may still
    // be in human/AI fulfillment. Never invent live workspace/task URLs.
    status: isHumanLed ? 'provisioned' : 'ready',
    summary: enterprisePack
      ? 'Signed receipt and the engagement pack. The platform license, the source, and a private cloud are not in this download.'
      : type === 'report+automation'
      ? 'Signed receipt, license and growth-plan download prepared.'
      : type === 'api+task'
        ? 'Signed receipt, license and API-key payload prepared for download.'
        : type === 'workspace+agent'
          ? 'Signed receipt, license and onboarding workspace payload prepared.'
          : 'Signed receipt, license and onboarding downloads prepared.',
    files,
    endpoints: {
      invoice: `/api/invoice/${encodeURIComponent(receipt.id)}`,
      license: `/api/license/${encodeURIComponent(receipt.id)}`,
      delivery: `/api/delivery/${encodeURIComponent(receipt.id)}`,
      artifacts: `/api/delivery/${encodeURIComponent(receipt.id)}?format=artifacts`,
      // Internal correlation ids only — not public app routes.
      workspaceId: base.workspaceId,
      taskId: base.taskId,
    },
    report: {
      serviceId,
      receiptId: receipt.id,
      objective: `Fulfill ${serviceId} for ${receipt.email || 'customer'}`,
      nextSteps: [
        'Review signed license token',
        'Download delivery / onboarding payloads',
        'Complete any required buyer inputs',
        'Track fulfilment through /api/delivery/:receiptId'
      ],
      kpis: ['time-to-value', 'delivery completion', 'buyer confirmation']
    },
    onboarding: {
      requiredInputs: ['company name', 'target market', 'desired KPI', 'preferred integration channel'],
      sla: isHumanLed
        ? 'Kickoff pack available immediately after confirmed payment; human-led milestones follow the SOW timeline.'
        : 'Digital activation pack available immediately after confirmed payment; AI-generated SKU artifacts when fulfillment AI is enabled.',
      support: 'Customer dashboard + /api/delivery/:receiptId + owner concierge email'
    }
  };
}

function serviceIdsForReceipt(receipt) {
  const ids = [];
  if (Array.isArray(receipt.services)) ids.push(...receipt.services);
  if (receipt.plan) ids.push(receipt.plan);
  if (receipt.serviceId) ids.push(receipt.serviceId);
  const clean = ids.map(x => String(x || '').trim()).filter(Boolean);
  return [...new Set(clean.length ? clean : ['starter'])];
}

function deliver(receipt, opts = {}) {
  if (!receipt || !receipt.id) throw new Error('receipt_required');
  const deliveries = all();
  const existingIndex = deliveries.findIndex(d => d.receiptId === receipt.id);
  if (existingIndex >= 0 && !opts.force) return deliveries[existingIndex];

  const serviceIds = serviceIdsForReceipt(receipt);
  const items = serviceIds.map(serviceId => deliverableSet(receipt, serviceId));
  const delivery = {
    id: 'del_' + crypto.createHash('sha1').update(receipt.id + ':' + Date.now()).digest('hex').slice(0, 16),
    receiptId: receipt.id,
    email: receipt.email || '',
    customerId: receipt.customerId || null,
    status: 'delivered',
    serviceIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retryCount: existingIndex >= 0 ? Number(deliveries[existingIndex].retryCount || 0) + 1 : 0,
    items,
    summary: `${items.length} service delivery package${items.length === 1 ? '' : 's'} created automatically.`
  };
  if (existingIndex >= 0) deliveries[existingIndex] = delivery; else deliveries.push(delivery);
  save(deliveries);
  return delivery;
}

// Attach real AI-generated deliverables (from fulfillment-engine) to an
// existing delivery record. Idempotent per receipt; never throws to caller.
function attachArtifacts(receiptId, artifacts, fulfillmentStatus) {
  const deliveries = all();
  const idx = deliveries.findIndex(d => d.receiptId === receiptId || d.id === receiptId);
  if (idx < 0) return null;
  const list = Array.isArray(artifacts) ? artifacts : [];
  deliveries[idx].artifacts = list;
  deliveries[idx].fulfillmentStatus = fulfillmentStatus || 'unknown';
  deliveries[idx].updatedAt = new Date().toISOString();
  // Surface downloadable artifact links alongside paperwork files so the
  // customer portal / emails share one honest download list.
  const rid = encodeURIComponent(String(deliveries[idx].receiptId || receiptId));
  const items = Array.isArray(deliveries[idx].items) ? deliveries[idx].items : [];
  for (const artifact of list) {
    if (!artifact || !artifact.serviceId) continue;
    let item = items.find((x) => x && x.serviceId === artifact.serviceId);
    if (!item) {
      item = { serviceId: artifact.serviceId, files: [] };
      items.push(item);
    }
    if (!Array.isArray(item.files)) item.files = [];
    const filename = artifact.filename || `${artifact.serviceId}-deliverable.md`;
    const downloadUrl = `/api/delivery/${rid}?format=artifact&serviceId=${encodeURIComponent(artifact.serviceId)}`;
    const already = item.files.some((f) => f && (f.downloadUrl === downloadUrl || f.filename === filename));
    if (!already) {
      item.files.push({
        filename,
        kind: artifact.deliverableType || 'artifact',
        downloadUrl,
        bytes: artifact.bytes || 0,
        recipe: artifact.recipe || null,
        requiresHumanFulfillment: !!artifact.requiresHumanFulfillment,
      });
    }
  }
  deliveries[idx].items = items;
  save(deliveries);
  return deliveries[idx];
}

function get(receiptId) {
  return all().find(d => d.receiptId === receiptId || d.id === receiptId) || null;
}

function list(filter = {}) {
  return all().filter(d => {
    if (filter.email && String(d.email || '').toLowerCase() !== String(filter.email).toLowerCase()) return false;
    if (filter.customerId && String(d.customerId || '') !== String(filter.customerId)) return false;
    return true;
  });
}

function renderPayload(delivery, format, serviceId) {
  if (!delivery) return null;
  if (!format) return delivery;
  const item = serviceId ? delivery.items.find(x => x.serviceId === serviceId) : delivery.items[0];
  if (!item) return null;
  if (format === 'report') return item.report;
  if (format === 'workspace') return { workspaceId: item.workspaceId, serviceId: item.serviceId, endpoints: item.endpoints, status: item.status };
  if (format === 'api-key') {
    return {
      serviceId: item.serviceId,
      apiKey: item.apiKey || null,
      apiKeyPreview: item.apiKeyPreview || null,
      keyId: item.keyId || null,
      credentialsIssued: item.credentialsIssued === true,
      webhookIssued: item.webhookIssued === true,
      createdAt: item.createdAt,
    };
  }
  if (format === 'onboarding') return item.onboarding;
  return item;
}

// Render the AI-generated deliverables. `format=artifacts` lists metadata (no
// bulky content); `format=artifact` + serviceId returns one artifact's content.
function renderArtifacts(delivery, format, serviceId) {
  if (!delivery || !Array.isArray(delivery.artifacts)) return null;
  if (format === 'artifacts') {
    return {
      fulfillmentStatus: delivery.fulfillmentStatus || 'unknown',
      artifacts: delivery.artifacts.map(a => ({
        serviceId: a.serviceId, recipe: a.recipe, title: a.title, status: a.status,
        format: a.format, filename: a.filename, bytes: a.bytes, generatedBy: a.generatedBy
      }))
    };
  }
  const item = serviceId
    ? delivery.artifacts.find(a => a.serviceId === serviceId)
    : delivery.artifacts[0];
  return item || null;
}

module.exports = { all, list, get, deliver, deliverableSet, renderPayload, attachArtifacts, renderArtifacts };
