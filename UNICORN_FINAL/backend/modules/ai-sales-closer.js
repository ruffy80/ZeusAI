// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Rebuilt 2026-05-01 — Math.random simulations removed.
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== AI SALES CLOSER (reality-grounded) ====================
// Reads real leads from data/money-machine/sales-leads.jsonl + paid orders from
// the receipt ledger. No fabricated prospects, no Math.random deal values.

const fs = require('fs');
const path = require('path');

const LEADS_PATH = path.resolve(__dirname, '..', '..', 'data', 'money-machine', 'sales-leads.jsonl');
const RECEIPTS_PATH = path.resolve(__dirname, '..', '..', 'data', 'commerce', 'uaic-receipts.jsonl');

const _state = {
  name: 'ai-sales-closer',
  label: 'AI Sales Closer',
  startedAt: new Date().toISOString(),
  processCount: 0,
  lastRun: null,
  simulated: false,
};

function _readJsonl(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter(Boolean);
  } catch (_) { return []; }
}

function _realPipeline() {
  const leads = _readJsonl(LEADS_PATH);
  const receipts = _readJsonl(RECEIPTS_PATH);
  const paidEmails = new Set(
    receipts.filter((r) => r && r.status === 'paid')
      .map((r) => String(r.email || r.customerEmail || '').toLowerCase())
      .filter(Boolean)
  );
  const open = leads.filter((l) => l && l.email && !paidEmails.has(String(l.email).toLowerCase()));
  return { leads, receipts, paidEmails, open };
}

function getStatus() {
  const { leads, receipts, paidEmails, open } = _realPipeline();
  const paidRevenue = receipts
    .filter((r) => r && r.status === 'paid')
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  return {
    ..._state,
    source: 'sales-leads.jsonl + uaic-receipts.jsonl (no Math.random)',
    realLeadsTotal: leads.length,
    realPaidCustomers: paidEmails.size,
    openPipelineSize: open.length,
    realRevenueUsd: Math.round(paidRevenue * 100) / 100,
    closedWon: receipts.filter((r) => r && r.status === 'paid').slice(-5)
      .map((r) => ({ id: r.id, amount: r.amount, plan: r.plan, paidAt: r.paidAt })),
    nextStep: open.length === 0
      ? 'No open leads yet. Drive traffic via socialMediaViralizer (configure tokens) and content; leads will appear here as they sign up.'
      : `Follow up on ${open.length} open lead(s) via transactional-email + AI router copy.`,
  };
}

async function process(input = {}) {
  _state.processCount += 1;
  _state.lastRun = new Date().toISOString();
  const email = String(input.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'skipped', reason: 'invalid_or_missing_email', module: _state.name };
  }
  const lead = {
    email,
    name: input.name ? String(input.name).slice(0, 80) : null,
    source: input.source ? String(input.source).slice(0, 60) : 'unknown',
    interest: input.interest ? String(input.interest).slice(0, 80) : null,
    note: input.note ? String(input.note).slice(0, 200) : null,
    createdAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(LEADS_PATH), { recursive: true });
    fs.appendFileSync(LEADS_PATH, JSON.stringify(lead) + '\n');
  } catch (e) {
    return { status: 'error', error: 'lead_persist_failed', message: e.message };
  }
  return { status: 'ok', module: _state.name, lead, dispatched: 'lead_persisted' };
}

function init() { return true; }
function addDeal(input) { return process(input); } // back-compat shim

module.exports = { process, getStatus, init, addDeal, name: 'ai-sales-closer' };
