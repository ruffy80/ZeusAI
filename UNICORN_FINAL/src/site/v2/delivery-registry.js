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

function buildApiKey(receipt, serviceId) {
  const seed = `${receipt.id}:${serviceId}:${Date.now()}:${Math.random()}`;
  return 'zai_' + crypto.createHash('sha256').update(seed).digest('base64url').slice(0, 38);
}

function classify(serviceId) {
  const id = String(serviceId || '').toLowerCase();
  if (id.includes('frontier') || id.includes('quantum') || id.includes('nexus')) return 'workspace+agent';
  if (id.includes('growth') || id.includes('viral') || id.includes('aura') || id.includes('outreach')) return 'report+automation';
  if (id.includes('api') || id.includes('engine') || id.includes('blocks') || id.includes('predictive')) return 'api+task';
  if (id.includes('os') || id.includes('vertical') || id.includes('enterprise')) return 'workspace+onboarding';
  return 'license+onboarding';
}

function deliverableSet(receipt, serviceId) {
  const type = classify(serviceId);
  const apiKey = buildApiKey(receipt, serviceId);
  const base = {
    serviceId,
    apiKey,
    apiKeyPreview: publicKey(apiKey),
    workspaceId: 'ws_' + crypto.createHash('sha1').update(receipt.id + serviceId).digest('hex').slice(0, 12),
    taskId: 'task_' + crypto.randomBytes(8).toString('hex'),
    webhookSecret: 'whsec_' + crypto.randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString()
  };
  const files = [
    { filename: `${serviceId}-receipt-${receipt.id.slice(0, 8)}.json`, kind: 'receipt', downloadUrl: `/api/invoice/${encodeURIComponent(receipt.id)}` },
    { filename: `${serviceId}-license-${receipt.id.slice(0, 8)}.txt`, kind: 'license', downloadUrl: `/api/license/${encodeURIComponent(receipt.id)}` }
  ];
  if (type.includes('report')) files.push({ filename: `${serviceId}-growth-plan-${receipt.id.slice(0, 8)}.json`, kind: 'report', downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=report&serviceId=${encodeURIComponent(serviceId)}` });
  if (type.includes('workspace')) files.push({ filename: `${serviceId}-workspace-${base.workspaceId}.json`, kind: 'workspace', downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=workspace&serviceId=${encodeURIComponent(serviceId)}` });
  if (type.includes('api')) files.push({ filename: `${serviceId}-api-key-${receipt.id.slice(0, 8)}.json`, kind: 'api-key', downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=api-key&serviceId=${encodeURIComponent(serviceId)}` });
  files.push({ filename: `${serviceId}-onboarding-${receipt.id.slice(0, 8)}.json`, kind: 'onboarding', downloadUrl: `/api/delivery/${encodeURIComponent(receipt.id)}?format=onboarding&serviceId=${encodeURIComponent(serviceId)}` });

  return {
    ...base,
    type,
    status: 'delivered',
    summary: type === 'report+automation'
      ? 'Growth report, automation task and activation webhook prepared.'
      : type === 'api+task'
        ? 'API key, task runner and signed license prepared.'
        : type === 'workspace+agent'
          ? 'Workspace, agent task and signed license prepared.'
          : 'Onboarding, signed license and delivery workspace prepared.',
    files,
    endpoints: {
      workspace: `/workspace/${base.workspaceId}`,
      task: `/api/unicorn/tasks/${base.taskId}`,
      webhook: `/api/webhooks/service-delivery/${base.taskId}`
    },
    report: {
      serviceId,
      receiptId: receipt.id,
      objective: `Activate ${serviceId} for ${receipt.email || 'customer'}`,
      nextSteps: [
        'Review signed license token',
        'Open workspace and complete onboarding inputs',
        'Use API key for programmatic access',
        'Track fulfilment through /api/delivery/:receiptId'
      ],
      kpis: ['time-to-value', 'automation coverage', 'conversion lift', 'cost reduction']
    },
    onboarding: {
      requiredInputs: ['company name', 'target market', 'desired KPI', 'preferred integration channel'],
      sla: 'Initial autonomous setup within 15 minutes after confirmed payment; advanced fulfilment continues asynchronously.',
      support: 'Concierge + service.activated SSE event + customer dashboard'
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
  if (format === 'api-key') return { serviceId: item.serviceId, apiKey: item.apiKey, apiKeyPreview: item.apiKeyPreview, createdAt: item.createdAt };
  if (format === 'onboarding') return item.onboarding;
  return item;
}

module.exports = { all, list, get, deliver, renderPayload };
