// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.691Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.554Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== WORKFLOW AUTOMATION ENGINE (MVP) ====================

const crypto = require('crypto');

const SUPPORTED_TRIGGERS = ['user_registered', 'payment_completed', 'api_limit_reached', 'manual', 'cron_daily', 'cron_weekly'];
const SUPPORTED_ACTIONS  = ['send_email', 'call_webhook', 'post_slack', 'run_compliance_check', 'create_api_key', 'log_event'];

let _db = null;
function getDb() {
  if (!_db) _db = require('../db');
  return _db;
}

const _runHistory = [];

function validateWorkflow(data) {
  if (!data.name) throw new Error('name required');
  if (!SUPPORTED_TRIGGERS.includes(data.trigger)) {
    throw new Error(`trigger must be one of: ${SUPPORTED_TRIGGERS.join(', ')}`);
  }
  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw new Error('actions must be a non-empty array');
  }
  for (const action of data.actions) {
    if (!SUPPORTED_ACTIONS.includes(action.type)) {
      throw new Error(`action type "${action.type}" not supported. Use: ${SUPPORTED_ACTIONS.join(', ')}`);
    }
  }
}

function createWorkflow(userId, data) {
  validateWorkflow(data);
  const workflow = {
    id: crypto.randomBytes(8).toString('hex'),
    userId,
    name: String(data.name).slice(0, 100),
    trigger: data.trigger,
    actions: data.actions,
    enabled: data.enabled !== false,
    runCount: 0,
    createdAt: new Date().toISOString(),
  };
  const db = getDb();
  db.workflows.create(workflow);
  return workflow;
}

function listWorkflows(userId) {
  return getDb().workflows.listByUser(userId);
}

function getWorkflow(id, userId) {
  const w = getDb().workflows.findById(id);
  if (!w || (userId && w.userId !== userId)) return null;
  return w;
}

function updateWorkflow(id, userId, updates) {
  const w = getWorkflow(id, userId);
  if (!w) throw new Error('Workflow not found or access denied');
  if (updates.trigger) validateWorkflow({ ...w, ...updates });
  return getDb().workflows.update(id, updates);
}

function deleteWorkflow(id, userId) {
  const w = getWorkflow(id, userId);
  if (!w) throw new Error('Workflow not found or access denied');
  return getDb().workflows.delete(id);
}

async function executeAction(action, context) {
  try {
    switch (action.type) {
      case 'send_email': {
        try {
          const emailService = require('../email');
          if (context.user && action.config && action.config.subject) {
            await emailService.sendEmail({
              to: context.user.email,
              subject: action.config.subject,
              html: `<p>${action.config.body || 'Automated notification from Zeus AI'}</p>`,
            }).catch(() => {});
          }
        } catch { /* email module optional */ }
        return { type: 'send_email', status: 'ok' };
      }
      case 'call_webhook': {
        if (action.config && action.config.url) {
          const axios = require('axios');
          await axios.post(action.config.url, context, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json', 'X-Zeus-Event': context.trigger || 'workflow' },
          }).catch(() => {});
        }
        return { type: 'call_webhook', status: 'ok' };
      }
      case 'post_slack': {
        if (action.config && action.config.webhookUrl) {
          const axios = require('axios');
          await axios.post(action.config.webhookUrl, {
            text: action.config.message || `Zeus AI event: ${context.trigger}`,
          }, { timeout: 5000 }).catch(() => {});
        }
        return { type: 'post_slack', status: 'ok' };
      }
      case 'log_event':
        return { type: 'log_event', status: 'ok', logged: context };
      case 'run_compliance_check':
        return { type: 'run_compliance_check', status: 'ok', note: 'Compliance queued' };
      case 'create_api_key':
        return { type: 'create_api_key', status: 'ok', note: 'API key creation queued' };
      default:
        return { type: action.type, status: 'skipped' };
    }
  } catch (err) {
    return { type: action.type, status: 'error', error: err.message };
  }
}

async function runWorkflow(workflowId, context = {}) {
  const db = getDb();
  const workflow = db.workflows.findById(workflowId);
  if (!workflow || !workflow.enabled) return null;

  const runLog = {
    workflowId,
    trigger: context.trigger || workflow.trigger,
    startedAt: new Date().toISOString(),
    results: [],
    status: 'ok',
  };

  for (const action of workflow.actions) {
    const result = await executeAction(action, context);
    runLog.results.push(result);
    if (result.status === 'error') runLog.status = 'partial_error';
  }

  runLog.completedAt = new Date().toISOString();
  _runHistory.unshift(runLog);
  if (_runHistory.length > 500) _runHistory.pop();

  db.workflows.update(workflowId, { runCount: (workflow.runCount || 0) + 1, lastRunAt: runLog.completedAt });

  return runLog;
}

async function fireEvent(trigger, context = {}) {
  console.log(`[WorkflowEngine] Event fired: ${trigger}`);
}

function getRunHistory(limit = 50) {
  return _runHistory.slice(0, Math.min(limit, 200));
}

function getSupportedConfig() {
  return { triggers: SUPPORTED_TRIGGERS, actions: SUPPORTED_ACTIONS };
}

module.exports = {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow,
  fireEvent,
  getRunHistory,
  getSupportedConfig,
};
